/* FILE: 04-core-code/ui/views/dialogs/fabric-lf-dialog.js */
import { EVENTS } from '../../../config/constants.js';
import * as quoteActions from '../../../actions/quote-actions.js';
import { FABRIC_CODES, LOGIC_CODES } from '../../../config/business-constants.js';

export class FabricLFDialog {
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

        const eligibleTypes = [FABRIC_CODES.B2, FABRIC_CODES.B3, FABRIC_CODES.B4];

        const eligibleIndexes = multiSelectSelectedIndexes.filter(index => {
            const item = items[index];
            return item && item.width && item.height &&
                eligibleTypes.includes(item.fabricType) &&
                !lfModifiedRowIndexes.includes(index);
        });

        if (eligibleIndexes.length === 0) {
            const msg = 'The selection contains no eligible B2, B3, or B4 items, or they are already set as LF.';
            this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: msg });
            this._exitAllK2Modes();
            return;
        }

        const fNameId = 'k2-dialog-fname-lf';
        const fColorId = 'k2-dialog-fcolor-lf';
        const layout = [
            [
                { type: 'text', text: 'Type', className: 'font-bold text-right' },
                { type: 'text', text: 'F-Name', className: 'font-bold' },
                { type: 'text', text: 'F-Color', className: 'font-bold' },
            ],
            [
                { type: 'text', text: LOGIC_CODES.LIGHT_FILTER, className: 'text-right' },
                { type: 'input', id: fNameId, value: '', 'data-type': LOGIC_CODES.LIGHT_FILTER, 'data-field': 'fabric', inputType: 'text', disableEnterConfirm: true },
                { type: 'input', id: fColorId, value: '', 'data-type': LOGIC_CODES.LIGHT_FILTER, 'data-field': 'color', inputType: 'text', disableEnterConfirm: true },
            ]
        ];
        const inputIds = [fNameId, fColorId];

        this.eventAggregator.publish(EVENTS.SHOW_CONFIRMATION_DIALOG, {
            message: `Batch Edit Light-Filter (${eligibleIndexes.length} selected items)`,
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
                                const fName = document.getElementById(fNameId).value;
                                const fColor = document.getElementById(fColorId).value;

                                if (fName && fColor) {
                                    const fabricNameWithPrefix = `Light-filter ${fName}`;
                                    this.stateService.dispatch(quoteActions.batchUpdateLFProperties(eligibleIndexes, fabricNameWithPrefix, fColor));
                                    this.stateService.dispatch(quoteActions.addLFModifiedRows(eligibleIndexes));
                                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: `Light-Filter applied to ${eligibleIndexes.length} items.` });
                                } else {
                                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, { message: 'No changes applied. Both F-Name and F-Color are required.', type: 'error' });
                                    return false;
                                }
                            } catch (e) {
                                console.error('Error applying LF batch update:', e);
                            } finally {
                                if (document.getElementById(fNameId).value && document.getElementById(fColorId).value) {
                                    this._exitAllK2Modes();
                                }
                            }
                            return (document.getElementById(fNameId).value && document.getElementById(fColorId).value);
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
                const fNameInput = document.getElementById(fNameId);
                const fColorInput = document.getElementById(fColorId);
                const confirmButton = document.querySelector('.dialog-overlay .primary-confirm-button');

                const focusNext = (currentId, isBlur = false) => {
                    if (currentId === fNameId) {
                        fColorInput?.focus();
                        if (isBlur) fColorInput?.select();
                    } else if (currentId === fColorId) {
                        confirmButton?.focus();
                    }
                };

                inputIds.forEach((id, index) => {
                    const input = document.getElementById(id);
                    if (input) {
                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                focusNext(id, true);
                            }
                        });
                        input.addEventListener('blur', (e) => {
                            const relatedTarget = e.relatedTarget || document.activeElement;
                            const nextId = inputIds[index + 1];
                            if (relatedTarget && relatedTarget.id === nextId) {
                                return;
                            }
                            focusNext(id, true);
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
                        fNameInput?.focus();
                        fNameInput?.select();
                    }, 50);
                }
            }
        });
    }
}
