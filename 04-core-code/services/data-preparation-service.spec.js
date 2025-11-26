/* FILE: 04-core-code/services/data-preparation-service.spec.js */
import { DataPreparationService } from './data-preparation-service.js';

// Mock ConfigManager to provide Price Matrix data
const mockConfigManager = {
    getPriceMatrix: jest.fn((fabricType) => {
        // Simulate matrix with drops: 1000, 1500, 2000...
        return { drops: [1000, 1500, 2000, 2500, 3000] };
    })
};

describe('DataPreparationService', () => {
    let service;

    beforeEach(() => {
        service = new DataPreparationService({ configManager: mockConfigManager });
    });

    describe('Core Logic Verification', () => {

        test('Should calculate correct manufacturing dimensions (IN/OUT & Drop Logic)', () => {
            // Arrange
            const items = [
                // Case A: IN mount (-4mm), Height 1200 (Next drop 1500)
                // Rule: Standard case. 1200 < 1500. mHeight = 1500 - 5 = 1495.
                { itemId: '1', width: 1000, height: 1200, fabricType: 'B1', oi: 'IN', rawWidth: 1000, rawHeight: 1200 },

                // Case B: OUT mount (-2mm), Height 2000 (Matches drop 2000 exactly)
                // Rule: Exact match. 2000 == 2000. mHeight = 2000 (No change).
                { itemId: '2', width: 2000, height: 2000, fabricType: 'B2', oi: 'OUT', rawWidth: 2000, rawHeight: 2000 }
            ];
            const quoteData = { currentProduct: 'rb', products: { rb: { items } } };

            // Act
            const result = service.getExportData(quoteData, {});
            const itemA = result.items.find(i => i.originalIndex === 1);
            const itemB = result.items.find(i => i.originalIndex === 2);

            // Assert
            // Case A
            expect(itemA.mWidth).toBe(996); // 1000 - 4
            expect(itemA.mHeight).toBe(1495); // 1500 - 5

            // Case B
            expect(itemB.mWidth).toBe(1998); // 2000 - 2
            // [MODIFIED] Expect exact match logic (No deduction)
            expect(itemB.mHeight).toBe(2000);
        });

        test('Should sort items correctly (BO > SN > LF)', () => {
            // Arrange
            const items = [
                { itemId: '1', width: 100, height: 100, fabricType: 'SN', fabric: 'Screen' },   // Should be 2nd
                { itemId: '2', width: 100, height: 100, fabricType: 'B1', fabric: 'Blockout' }, // Should be 1st
                { itemId: '3', width: 100, height: 100, fabricType: 'B2', fabric: 'LF_Item' }   // Should be 3rd (marked as LF)
            ];
            const quoteData = { currentProduct: 'rb', products: { rb: { items } } };
            const uiMetadata = { lfModifiedRowIndexes: [2] }; // Mark item index 2 as LF

            // Act
            const result = service.getExportData(quoteData, uiMetadata);

            // Assert
            expect(result.items[0].typeCode).toBe('BO');
            expect(result.items[1].typeCode).toBe('SN');
            expect(result.items[2].typeCode).toBe('LF');
        });

        test('Should sanitize data (Remove invisible chars & prefixes)', () => {
            // Arrange
            const items = [
                {
                    itemId: '1', width: 100, height: 100, fabricType: 'B1',
                    fabric: 'Light-filter Soft White', // Should remove prefix
                    location: 'Living\u200BRoom' // Should remove \u200B
                }
            ];
            const quoteData = { currentProduct: 'rb', products: { rb: { items } } };

            // Act
            const result = service.getExportData(quoteData, {});

            // Assert
            expect(result.items[0].fabricName).toBe('Soft White');
            expect(result.items[0].location).toBe('LivingRoom');
        });

    });
});