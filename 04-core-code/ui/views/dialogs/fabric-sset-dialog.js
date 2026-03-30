/* FILE: 04-core-code/ui/views/dialogs/fabric-sset-dialog.js */
import { EVENTS } from '../../../config/constants.js';
import * as quoteActions from '../../../actions/quote-actions.js';

export class FabricSSetDialog {
    constructor({ stateService, eventAggregator, getItemsFunc, getStateFunc, exitAllK2ModesFunc }) {
        this.stateService = stateService;
        this.eventAggregator = eventAggregator;
        this._getItems = getItemsFunc;
        this._getState = getStateFunc;
        this._exitAllK2Modes = exitAllK2ModesFunc;
    }

    show() {
        const { ui, quoteData } = this._getState();
        const { multiSelectSelectedIndexes } = ui;
        const { lfModifiedRowIndexes } = quoteData.uiMetadata;
        const items = this._getItems();

        if (multiSelectSelectedIndexes.length === 0) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'Please select items from the main table first.' });
            this._exitAllK2Modes();
            return;
        }

        const eligibleTypes = new Set();
        const typeData = {};

        multiSelectSelectedIndexes.forEach(index => {
            const item = items[index];
            if (item && item.width && item.height && item.fabricType) {
                eligibleTypes.add(item.fabricType);
                if (!typeData[item.fabricType]) {
                    typeData[item.fabricType] = {
                        fabric: item.fabric || '',
                        color: item.color || ''
                    };
                }
            }
        });

        const sortedTypes = Array.from(eligibleTypes).sort();

        if (sortedTypes.length === 0) {
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'No items with a valid Fabric Type (B1-SN) were found in your selection.' });
            this._exitAllK2Modes();
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
            const fNameId = `k2-dialog-fname-sset-${type}`;
            const fColorId = `k2-dialog-fcolor-sset-${type}`;
            layout.push([
                { type: 'text', text: type, className: 'text-right' },
                { type: 'input', id: fNameId, value: typeData[type].fabric, 'data-type': type, 'data-field': 'fabric', inputType: 'text', disableEnterConfirm: true },
                { type: 'input', id: fColorId, value: typeData[type].color, 'data-type': type, 'data-field': 'color', inputType: 'text', disableEnterConfirm: true },
            ]);
            inputIds.push(fNameId, fColorId);
        });

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Selective Set (${multiSelectSelectedIndexes.length} selected items)`,
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
                                const typeMap = {};
                                let typesApplied = 0;

                                sortedTypes.forEach(type => {
                                    const fName = document.getElementById(`k2-dialog-fname-sset-${type}`).value;
                                    const fColor = document.getElementById(`k2-dialog-fcolor-sset-${type}`).value;
                                    if (fName && fColor) {
                                        if (!typeMap[type]) typeMap[type] = {};
                                        typeMap[type]['fabric'] = fName;
                                        typeMap[type]['color'] = fColor;
                                        typesApplied++;
                                    }
                                });

                                if (typesApplied === 0) {
                                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'No changes applied. Please fill in both F-Name and F-Color for a type.', type: 'error' });
                                    return false;
                                }

                                this.stateService.dispatch(quoteActions.batchUpdatePropertiesForIndexes(multiSelectSelectedIndexes, typeMap));

                                const { lfModifiedRowIndexes } = this._getState().quoteData.uiMetadata;
                                const lfIndexesToClear = multiSelectSelectedIndexes.filter(index =>
                                    lfModifiedRowIndexes.includes(index)
                                );

                                if (lfIndexesToClear.length > 0) {
                                    this.stateService.dispatch(quoteActions.removeLFModifiedRows(lfIndexesToClear));
                                }

                                this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: `SSet applied to items.` });

                            } catch (e) {
                                console.error('Error applying SSet batch update:', e);
                            } finally {
                                this._exitAllK2Modes();
                            }
                            return true;
                        }
                    },
                    {
                        type: 'button', text: 'Cancel', className: 'secondary', colspan: 1,
                        callback: () => {
                            this._exitAllK2Modes();
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
