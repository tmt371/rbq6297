/* FILE: 04-core-code/ui/views/dialogs/fabric-nc-dialog.js */
import { EVENTS } from '../../../config/constants.js';
import * as uiActions from '../../../actions/ui-actions.js';
import * as quoteActions from '../../../actions/quote-actions.js';

export class FabricNCDialog {
    constructor({ stateService, eventAggregator, getItemsFunc, getStateFunc }) {
        this.stateService = stateService;
        this.eventAggregator = eventAggregator;
        this._getItems = getItemsFunc;
        this._getState = getStateFunc;
    }

    handleNCDialogRequest() {
        // [NEW] (Phase 3.5a-Fix) Switch to Fabric View columns when N&C button is clicked
        this.stateService.dispatch(uiActions.setVisibleColumns(['sequence', 'fabricTypeDisplay', 'fabric', 'color']));

        this.stateService.dispatch(uiActions.setModalActive(true));

        const { lfModifiedRowIndexes } = this._getState().quoteData.uiMetadata;
        const lfItemsExist = lfModifiedRowIndexes.length > 0;

        if (!lfItemsExist) {
            this.show(false);
            return;
        }

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: 'This quote contains Light-Filter (LF) items. How would you like to proceed?',
            closeOnOverlayClick: false,
            gridTemplateColumns: '1fr 1fr',
            gap: '10px 10px',
            layout: [
                [
                    {
                        type: 'button',
                        text: 'Overwrite LF items (Update All)',
                        className: 'primary-confirm-button',
                        colspan: 1,
                        callback: () => {
                            this.show(true);
                            return false;
                        }
                    },
                    {
                        type: 'button',
                        text: 'Preserve LF items (Update Non-LF Only)',
                        colspan: 1,
                        callback: () => {
                            this.show(false);
                            return false;
                        }
                    }
                ],
                [
                    { type: 'text', text: '' },
                    {
                        type: 'button',
                        text: 'Cancel',
                        className: 'secondary',
                        colspan: 1,
                        callback: () => {
                            this.stateService.dispatch(uiActions.setModalActive(false));
                            return true;
                        }
                    }
                ]
            ]
        });
    }

    show(overwriteLF = false) {
        const items = this._getItems();
        const { lfModifiedRowIndexes } = this._getState().quoteData.uiMetadata;
        const indexesToExclude = overwriteLF ? new Set() : new Set(lfModifiedRowIndexes);

        const eligibleTypes = new Set();
        const typeData = {};

        items.forEach((item, index) => {
            if (item.width && item.height && item.fabricType) {
                if (!indexesToExclude.has(index)) {
                    eligibleTypes.add(item.fabricType);
                    if (!typeData[item.fabricType]) {
                        typeData[item.fabricType] = {
                            fabric: item.fabric || '',
                            color: item.color || ''
                        };
                    }
                }
            }
        });

        const sortedTypes = Array.from(eligibleTypes).sort();
        if (sortedTypes.length === 0) {
            const message = overwriteLF
                ? 'No items to overwrite.'
                : 'No non-LF items available to edit.';
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: message });
            this.stateService.dispatch(uiActions.setModalActive(false));
            return;
        }

        const layout = [];
        const inputIds = [];
        layout.push([
            { type: 'text', text: 'Type', className: 'font-bold text-right' },
            { type: 'text', text: 'F-Name', className: 'font-bold' },
            { type: 'text', text: 'F-Color', className: 'font-bold' },
        ]);

        sortedTypes.forEach(type => {
            const fNameId = `k2-dialog-fname-${type}`;
            const fColorId = `k2-dialog-fcolor-${type}`;
            layout.push([
                { type: 'text', text: type, className: 'text-right' },
                { type: 'input', id: fNameId, value: typeData[type].fabric, 'data-type': type, 'data-field': 'fabric', inputType: 'text', disableEnterConfirm: true },
                { type: 'input', id: fColorId, value: typeData[type].color, 'data-type': type, 'data-field': 'color', inputType: 'text', disableEnterConfirm: true },
            ]);
            inputIds.push(fNameId, fColorId);
        });

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: 'Batch Edit Fabric (N&C)',
            closeOnOverlayClick: false,
            gridTemplateColumns: '0.8fr 1.2fr 1.2fr',
            layout: [
                ...layout,
                [
                    {
                        type: 'button',
                        text: 'Confirm',
                        className: 'primary-confirm-button',
                        colspan: 2,
                        callback: () => {
                            try {
                                const { lfModifiedRowIndexes } = this._getState().quoteData.uiMetadata;
                                const finalIndexesToExclude = overwriteLF ? new Set() : new Set(lfModifiedRowIndexes);

                                sortedTypes.forEach(type => {
                                    const fName = document.getElementById(`k2-dialog-fname-${type}`).value;
                                    const fColor = document.getElementById(`k2-dialog-fcolor-${type}`).value;
                                    if (fName || fColor) {
                                        this.stateService.dispatch(quoteActions.batchUpdatePropertyByType(type, 'fabric', fName, finalIndexesToExclude));
                                        this.stateService.dispatch(quoteActions.batchUpdatePropertyByType(type, 'color', fColor, finalIndexesToExclude));
                                    }
                                });

                                if (overwriteLF && lfModifiedRowIndexes.length > 0) {
                                    this.stateService.dispatch(quoteActions.removeLFModifiedRows(lfModifiedRowIndexes));
                                }

                            } catch (e) {
                                console.error('Error applying N&C batch update:', e);
                            } finally {
                                this.stateService.dispatch(uiActions.setModalActive(false));
                            }
                            return true;
                        }
                    },
                    {
                        type: 'button', text: 'Cancel', className: 'secondary', colspan: 1,
                        callback: () => {
                            this.stateService.dispatch(uiActions.setModalActive(false));
                            return true;
                        }
                    }
                ]
            ],
            onOpen: () => {
                const confirmButton = document.querySelector('.dialog-overlay .primary-confirm-button');

                inputIds.forEach((id, index) => {
                    const input = document.getElementById(id);
                    if (input) {
                        const focusNext = (isBlur = false) => {
                            const nextId = inputIds[index + 1];
                            const nextInput = nextId ? document.getElementById(nextId) : null;

                            if (nextInput) {
                                nextInput.focus();
                                if (isBlur && (index + 1) % 2 !== 0) {
                                    nextInput.select();
                                }
                                if (isBlur && (index + 1) % 2 === 0) {
                                    nextInput.select();
                                }
                            } else {
                                confirmButton?.focus();
                            }
                        };

                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                focusNext(true);
                            }
                        });

                        input.addEventListener('blur', (e) => {
                            const relatedTarget = e.relatedTarget || document.activeElement;
                            const nextId = inputIds[index + 1];
                            if (relatedTarget && relatedTarget.id === nextId) {
                                return;
                            }
                            focusNext(true);
                        });
                    }
                });

                if (confirmButton) {
                    confirmButton.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            confirmButton.click();
                        }
                    });
                }

                if (inputIds.length > 0) {
                    setTimeout(() => {
                        const firstInput = document.getElementById(inputIds[0]);
                        firstInput?.focus();
                        firstInput?.select();
                    }, 50);
                }
            }
        });
    }
}
