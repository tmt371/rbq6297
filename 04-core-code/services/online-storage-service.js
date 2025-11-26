// 04-core-code/services/online-storage-service.js
// (Modified)

import { db } from '../config/firebase-config.js';
import {
    doc,
    setDoc,
    getDoc,
    collection, // [NEW] Import collection
    query, // [NEW] Import query
    where, // [NEW] Import where
    getDocs, // [NEW] Import getDocs
    orderBy, // [NEW] (v6298-F4-Search) Import orderBy
    limit, // [NEW] (v6298-F4-Search) Import limit
} from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js';

/**
 * Saves the entire quote data (including f1Snapshot and f2Snapshot) to Firestore.
 * @param {object} quoteData - The quote data object to save.
 * @returns {object} - { success, message }
 */
export async function saveQuoteToCloud(quoteData) {
    if (!quoteData || !quoteData.quoteId) {
        const errorMsg = 'Save failed: Quote ID is empty.';
        console.error(errorMsg);
        return { success: false, message: errorMsg };
    }

    try {
        // 'quotes' is the collection name in Firestore.
        // quoteData.quoteId is used as the Document ID.
        await setDoc(doc(db, 'quotes', quoteData.quoteId), quoteData);
        const successMsg = `Quote successfully saved to cloud: ${quoteData.quoteId}`;
        console.log(successMsg);
        return { success: true, message: successMsg };
    } catch (e) {
        console.error('Cloud save failed:', e);
        return { success: false, message: `Cloud save failed: ${e.message}` };
    }
}

/**
 * Loads a quote from Firestore using the Quote ID.
 * @param {string} quoteId - The Quote ID to retrieve.
 * @returns {object} - { success, data, message }
 */
export async function loadQuoteFromCloud(quoteId) {
    if (!quoteId) {
        return { success: false, data: null, message: 'Quote ID is empty.' };
    }

    try {
        const docRef = doc(db, 'quotes', quoteId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log('Quote loaded successfully:', quoteId);
            return {
                success: true,
                data: docSnap.data(),
                message: 'Quote loaded successfully.',
            };
        } else {
            const errorMsg = 'Quote not found in database.';
            console.warn(errorMsg, quoteId);
            return { success: false, data: null, message: errorMsg };
        }
    } catch (e) {
        console.error('Failed to load quote:', e);
        // [MODIFIED] Handle Permission Denied error
        if (e.code === 'permission-denied') {
            return {
                success: false,
                data: null,
                message: 'Permission denied. You may not have access to this quote.',
            };
        }
        return {
            success: false,
            data: null,
            message: `Load error: ${e.message}`,
        };
    }
}

/**
 * [NEW] (v6298-F4-Search) Searches for quotes based on multiple filters.
 * @param {string} uid - The User ID (Firebase UID) to search under.
 * @param {object} filters - The search filters.
 * @param {string} [filters.name] - Customer name (starts with...).
 * @param {string} [filters.phone] - Customer phone (exact match).
 * @param {string} [filters.email] - Customer email (exact match).
 * @param {string} [filters.postcode] - Customer postcode (exact match).
 * @param {number} [filters.year] - Issue year (YYYY).
 * @param {number} [filters.month] - Issue month (1-12).
 * @param {boolean} [filters.hasMotor] - Filter by motor presence (true/false).
 * @returns {Promise<{success: boolean, data: Array, message: string, needsIndex?: boolean, indexUrl?: string}>}
 */
export async function searchQuotesAdvanced(uid, filters) {
    if (!uid) {
        return { success: false, data: [], message: 'User ID is missing.' };
    }

    try {
        // 1. Base Query: Filter by ownerUid.
        let q = query(collection(db, 'quotes'), where("ownerUid", "==", uid));

        // 2. Build Filter Conditions
        const conditions = [];

        // Exact Match Filters
        if (filters.phone) {
            conditions.push(where("customer.phone", "==", filters.phone));
        }
        if (filters.email) {
            conditions.push(where("customer.email", "==", filters.email.toLowerCase()));
        }
        if (filters.postcode) {
            conditions.push(where("customer.postcode", "==", filters.postcode));
        }
        if (filters.hasMotor === true || filters.hasMotor === false) {
            conditions.push(where("metadata.hasMotor", "==", filters.hasMotor));
        }

        // Prefix Match Filter (Name)
        if (filters.name) {
            // "Starts with" search logic for Firestore
            const nameStart = filters.name;
            const nameEnd = nameStart.slice(0, -1) + String.fromCharCode(nameStart.charCodeAt(nameStart.length - 1) + 1);
            conditions.push(where("customer.name", ">=", nameStart));
            conditions.push(where("customer.name", "<", nameEnd));
        }

        if (filters.year) {
            let year = parseInt(filters.year, 10);
            let month = parseInt(filters.month, 10);

            let startDate, endDate;

            if (year && month && month >= 1 && month <= 12) {
                // Filter by specific month
                startDate = `${year}-${String(month).padStart(2, '0')}-01`;
                const nextMonth = month === 12 ? 1 : month + 1;
                const nextYear = month === 12 ? year + 1 : year;
                endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
            } else if (year) {
                // Filter by full year
                startDate = `${year}-01-01`;
                endDate = `${year + 1}-01-01`;
            }

            if (startDate && endDate) {
                conditions.push(where("issueDate", ">=", startDate));
                conditions.push(where("issueDate", "<", endDate));
            }
        }

        // 3. Apply Conditions
        if (conditions.length > 0) {
            q = query(q, ...conditions);
        }

        // 4. [MODIFIED] (v6298-F4-Search-Fix) Sorting Strategy
        const orderByClauses = [];

        // Firestore limitation: The first orderBy field must match the field used in inequality filters (>, >=, <, <=).
        if (filters.name) {
            orderByClauses.push(orderBy("customer.name"));
        }
        if (filters.year || filters.month) {
            // If name is also filtered, issueDate must be secondary sort order.
            // If name is NOT filtered, issueDate becomes the primary inequality filter, so it must be first.
            orderByClauses.push(orderBy("issueDate", "desc"));
        }

        // Default sort by issueDate if no inequality filters are applied
        if (!filters.name && !filters.year && !filters.month) {
            orderByClauses.push(orderBy("issueDate", "desc"));
        }

        // 5. Apply Sorting and Limit
        q = query(q, ...orderByClauses, limit(50));

        // 6. Execute Query
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => {
            results.push(doc.data());
        });

        if (results.length === 0) {
            return { success: true, data: [], message: 'No quotes found matching that criteria.' };
        }

        return { success: true, data: results, message: `Found ${results.length} quotes.` };

    } catch (e) {
        console.error('Search failed:', e);

        // Handle Index Requirement Error
        if (e.code === 'failed-precondition') {
            const indexCreationURL = e.message.match(/(https?:\/\/[^\s]+)/);
            if (indexCreationURL && indexCreationURL[0]) {
                const url = indexCreationURL[0];
                console.warn(`Firestore index missing. Please create it using this URL: ${url}`);
                return {
                    success: false,
                    data: [],
                    message: 'A required database index is missing. A link to create it has been logged to the console (F12). Please ask the administrator to create the index.',
                    needsIndex: true,
                    indexUrl: url
                };
            }
        }
        // [NEW] (v6298-F4-Search-Fix) Handle "Invalid query" error
        if (e.code === 'invalid-argument') {
            return { success: false, data: [], message: `Search error: ${e.message}` };
        }
        return { success: false, data: [], message: `Search error: ${e.message}` };
    }
}