/* FILE: 04-core-code/services/ocr-api-service.js */

// [NEW] (Step 3 Refactor) Import getter to avoid constructor injection
import { getConfigManager } from '../config-manager.js';

/**
 * @class OcrApiService
 * @description
 * Handles communication with the Gemini Vision API for extracting tabular data
 * from window furnishing measurement forms.
 */
export class OcrApiService {
    constructor() {
        // [NEW] (Step 3 Refactor) No constructor dependency needed.
        // configManager is fetched directly via getter inside recognizeImages().

        this.SYSTEM_PROMPT = `
You are processing a specific window furnishing measurement form. Extract the tabular data and return a valid JSON Array of objects using ONLY the following keys, strictly obeying their data rules.

CRITICAL RULES FOR EXTRACTION (STRICT ENFORCEMENT):

1. "No": Must be the pre-printed item number (digits only).
2. "Location": Text and numbers (e.g., "bed2", "sliding 2").
3. IGNORE "G" COLUMN: Completely ignore the "G" column. Do not include it in the JSON.
4. "Type": Must be STRICTLY "B", "S", "LF", or empty "".
5. "Fabric": Text representing fabric name/material, or empty "".
6. "Color": Text representing fabric color, or empty "".
7. "Width": NUMBERS ONLY. CRITICAL: If the handwritten text contains a formula or calculation (e.g., "30+2250+60" or contains "+", "-", "="), you MUST IGNORE IT and return an empty string "". Do not calculate it. Do not include "mm".
8. "Height": NUMBERS ONLY. Same rule as Width: If it is a formula or calculation, return empty "". Do not include "mm".
9. "Over": Must be STRICTLY "O", "OVER", or empty "".
10. "Mounting": Must be STRICTLY "O", "OUT", "I", "IN", or empty "".
11. "Control": Must be STRICTLY "L", "R", or empty "".
12. "Style": Must be STRICTLY "D" or empty "".
13. "Chain": NUMBERS ONLY (representing chain length), or empty "".
14. "HD-winder": Must be STRICTLY "H", "E", or empty "".

FORMATTING RULES:
- Return ONLY a valid, minified JSON array with no markdown formatting and no code block wrappers.
- Do NOT use unescaped double quotes inside string values.
- Do NOT include raw newline or carriage return characters inside field values.
- The output must be parseable by a strict JSON.parse() call with zero modifications.
`;
    }

    /**
     * Processes a single image DataURL and returns an array of extracted rows.
     * Isolated error handling ensures one failed image doesn't abort the whole batch.
     * @param {string} dataUrl - A single base64 DataURL.
     * @param {string} apiKey - The Gemini API key.
     * @param {number} imageIndex - Index for logging purposes.
     * @returns {Promise<Object[]>} - Extracted rows, or [] on failure.
     * @private
     */
    async _processSingleImage(dataUrl, apiKey, imageIndex) {
        const base64Data = dataUrl.split(',')[1];

        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: this.SYSTEM_PROMPT },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Data
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                response_mime_type: "application/json",
                temperature: 0.1,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
            }
        };

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`[OCR Service] Image #${imageIndex + 1} API Error:`, errorData);
                // Return empty array for this image — don't abort the whole batch
                return [];
            }

            const result = await response.json();
            let jsonString = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!jsonString) {
                console.warn(`[OCR Service] Image #${imageIndex + 1}: Gemini returned empty response. Skipping.`);
                return [];
            }

            // Strip markdown code block wrapping if present
            jsonString = jsonString.replace(/^```(json)?\n?/i, '').replace(/\n?```$/i, '').trim();

            const extractedData = JSON.parse(jsonString);
            const rows = Array.isArray(extractedData) ? extractedData : [extractedData];

            console.log(`[OCR Service] Image #${imageIndex + 1}: Extracted ${rows.length} row(s).`, rows);
            return rows;

        } catch (error) {
            // Isolate per-image failures — log raw text and return empty so other images proceed
            console.error(`[OCR Service] Image #${imageIndex + 1} failed:`, error.message);
            // [NEW] Dashcam: log the exact raw string that failed to parse
            if (typeof jsonString !== 'undefined') {
                console.error(`[OCR Service] Image #${imageIndex + 1} — Raw text that failed JSON.parse:`, jsonString);
            }
            return [];
        }
    }

    /**
     * [REFACTORED] Sends each image in a SEPARATE concurrent API call to Gemini,
     * then flattens all results into a single array of rows.
     * This prevents token truncation and hallucination on multi-page batches.
     * @param {string[]} base64ImageArray - Array of DataURLs (base64).
     * @returns {Promise<Object[]>} - All extracted rows from all images, merged.
     */
    async recognizeImages(base64ImageArray) {
        if (!base64ImageArray || base64ImageArray.length === 0) {
            throw new Error('No images provided for OCR.');
        }

        // Fetch configManager and apiKey (secure, runtime resolution)
        const configManager = getConfigManager();
        if (!configManager) {
            throw new Error('[OCR Service] ❌ CRITICAL: ConfigManager instance not found. App may not have initialized correctly.');
        }

        const apiKey = configManager.getGeminiApiKey();
        if (!apiKey) {
            console.error('[OCR Service] ❌ CRITICAL: Gemini API Key is missing from ConfigManager (not in Firestore).');
            throw new Error('System Configuration Error: OCR API Key not found. Please contact support.');
        }

        console.log(`[OCR Service] Starting CONCURRENT processing of ${base64ImageArray.length} image(s)...`);

        // [NEW] Map each image to its own isolated Promise
        const promises = base64ImageArray.map((dataUrl, index) =>
            this._processSingleImage(dataUrl, apiKey, index)
        );

        // [NEW] Run all requests concurrently
        const resultsPerImage = await Promise.all(promises);

        // [NEW] Flatten array-of-arrays into a single merged result set
        const allRows = resultsPerImage.flat();

        console.log(`[OCR Service] Concurrent processing complete. Total rows extracted: ${allRows.length}`);

        if (allRows.length === 0) {
            throw new Error('OCR processing completed but no data was extracted from any image. Please check image quality.');
        }

        return allRows;
    }
}

