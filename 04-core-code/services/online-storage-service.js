// 04-core-code/services/online-storage-service.js
// (此為新服務)

import { db } from '../config/firebase-config.js';
import {
    doc,
    setDoc,
    getDoc,
    collection, // [NEW] Import collection
    query, // [NEW] Import query
    where, // [NEW] Import where
    getDocs, // [NEW] Import getDocs
} from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js';

/**
 * 將完整的報價物件（包含 f1Snapshot 與 f2Snapshot）儲存或覆蓋至 Firestore。
 * @param {object} quoteData - 欲儲存的報價物件。
 * @returns {object} - 一個包含 { success, message } 的物件。
 */
export async function saveQuoteToCloud(quoteData) {
    if (!quoteData || !quoteData.quoteId) {
        const errorMsg = '儲存失敗：Quote ID 為空。';
        console.error(errorMsg);
        return { success: false, message: errorMsg };
    }

    try {
        // 'quotes' 是資料庫中的集合名稱（資料夾）
        // quoteData.quoteId 是「文件」名稱（檔案名稱）
        await setDoc(doc(db, 'quotes', quoteData.quoteId), quoteData);
        const successMsg = `報價單已儲存至雲端 ${quoteData.quoteId}`;
        console.log(successMsg);
        return { success: true, message: successMsg };
    } catch (e) {
        console.error('儲存至雲端失敗：', e);
        return { success: false, message: `儲存至雲端失敗： ${e.message}` };
    }
}

/**
 * 根據 Quote ID 從 Firestore 讀取一份報價單文件。
 * @param {string} quoteId - 欲讀取的報價單 ID。
 * @returns {object} - 一個包含 { success, data, message } 的物件。
 */
export async function loadQuoteFromCloud(quoteId) {
    if (!quoteId) {
        return { success: false, data: null, message: 'Quote ID 為空。' };
    }

    try {
        const docRef = doc(db, 'quotes', quoteId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log('已從雲端讀取：', quoteId);
            return {
                success: true,
                data: docSnap.data(),
                message: '已從雲端讀取。',
            };
        } else {
            const errorMsg = '在資料庫中找不到該筆報價單。';
            console.warn(errorMsg, quoteId);
            return { success: false, data: null, message: errorMsg };
        }
    } catch (e) {
        console.error('從雲端讀取失敗：', e);
        // [MODIFIED] 捕捉權限錯誤
        if (e.code === 'permission-denied') {
            return {
                success: false,
                data: null,
                message: '權限不足。您可能沒有權限讀取此檔案，或者檔案不存在。',
            };
        }
        return {
            success: false,
            data: null,
            message: `讀取時發生錯誤: ${e.message}`,
        };
    }
}

/**
 * [NEW] 根據登入者 UID 與 客戶名稱 搜尋報價單。
 * @param {string} uid - 登入者的 Firebase UID。
 * @param {string} customerName - 欲搜尋的客戶名稱。
 * @returns {Promise<{success: boolean, data: Array, message: string}>}
 */
export async function searchQuotesByOwner(uid, customerName) {
    if (!uid) {
        return { success: false, data: [], message: 'User ID is missing.' };
    }
    if (!customerName) {
        return { success: false, data: [], message: 'Customer Name is required for search.' };
    }

    try {
        // 建立一個複合查詢 (Compound Query)
        const q = query(
            collection(db, 'quotes'),
            where("ownerUid", "==", uid),
            where("customer.name", "==", customerName)
        );

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

        // **關鍵：捕捉索引錯誤**
        if (e.code === 'failed-precondition') {
            const indexCreationURL = e.message.match(/(https?:\/\/[^\s]+)/);
            if (indexCreationURL && indexCreationURL[0]) {
                const url = indexCreationURL[0];
                console.warn(`Firestore 索引缺失。請點擊此連結建立索引： ${url}`);
                return {
                    success: false,
                    data: [],
                    message: 'A required database index is missing. A link to create it has been logged to the console (F12). Please ask the administrator to create the index.',
                    needsIndex: true, // 特殊標記
                    indexUrl: url
                };
            }
        }
        return { success: false, data: [], message: `Search error: ${e.message}` };
    }
}