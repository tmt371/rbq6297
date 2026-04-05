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
You are a highly accurate data extraction system for window furnishing measurement forms.
Analyze the provided image(s) and extract the tabular data.
Return ONLY a valid, raw JSON array of objects. Do not wrap in markdown code blocks.
Each object must represent a row. Extract fields accurately (e.g., Room, Qty, Width, Drop, Control, Fabric, etc.).
Common fields to look for:
- Room / Location
- Quantity
- Width (mm)
- Drop / Height (mm)
- Control Side (L/R)
- Fabric Name / Color
- Mounting (IB/OB)
`;
    }

    /**
     * Sends a batch of cropped images to Gemini for OCR extraction.
     * @param {string[]} base64ImageArray - Array of DataURLs (base64).
     * @returns {Promise<Object[]>} - Extracted JSON data rows.
     */
    async recognizeImages(base64ImageArray) {
        if (!base64ImageArray || base64ImageArray.length === 0) {
            throw new Error('No images provided for OCR.');
        }

        // [NEW] (Step 3 Refactor) Fetch configManager directly via getter
        const configManager = getConfigManager();
        if (!configManager) {
            throw new Error('[OCR Service] ❌ CRITICAL: ConfigManager instance not found. App may not have initialized correctly.');
        }

        // [NEW] (Step 3) Fetch dynamic API Key from ConfigManager
        const apiKey = configManager.getGeminiApiKey();

        if (!apiKey) {
            console.error('[OCR Service] ❌ CRITICAL: Gemini API Key is missing from ConfigManager (not in Firestore).');
            throw new Error('System Configuration Error: OCR API Key not found. Please contact support.');
        }

        try {
            console.log(`[OCR Service] Preparing to process ${base64ImageArray.length} images...`);

            // Prepare Gemini 1.5/2.0 API Payload
            const contents = [
                {
                    role: "user",
                    parts: [
                        { text: this.SYSTEM_PROMPT },
                        ...base64ImageArray.map(dataUrl => {
                            // Extract raw base64 from DataURL
                            const base64Data = dataUrl.split(',')[1];
                            return {
                                inline_data: {
                                    mime_type: "image/jpeg",
                                    data: base64Data
                                }
                            };
                        })
                    ]
                }
            ];

            // [MODIFIED] (Step 3) Use dynamic apiKey instead of this.API_KEY
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        response_mime_type: "application/json",
                        temperature: 0.1,
                        topP: 0.95,
                        topK: 40,
                        maxOutputTokens: 8192,
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[OCR Service] Gemini API Error:', errorData);
                throw new Error(`Gemini API Error: ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            
            // Extract the text content from the first candidate
            let jsonString = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonString) {
                throw new Error('Gemini returned an empty response.');
            }

            // 1. Log the raw string for debugging (Step 2.2 Fix)
            console.log('[OCR Service] Raw Gemini Response:', jsonString);

            // 2. Strip potential markdown wrapping (e.g., ```json ... ```)
            jsonString = jsonString.replace(/^```(json)?\n?/i, '').replace(/\n?```$/i, '').trim();

            // 3. Parse and return the JSON array
            const extractedData = JSON.parse(jsonString);
            console.log('[OCR Service] Successfully extracted data:', extractedData);
            
            return Array.isArray(extractedData) ? extractedData : [extractedData];

        } catch (error) {
            console.error('[OCR Service] Exception during recognition:', error);
            throw error;
        }
    }
}
