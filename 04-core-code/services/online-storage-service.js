// 04-core-code/services/online-storage-service.js
// (這是新增的檔案)

import { db } from '../config/firebase-config.js';
import {
    doc,
    setDoc,
    getDoc,
} from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js';

/**
 * 將完整的報價單物件（包含 f1Snapshot 和 f2Snapshot）儲存或覆蓋到 Firestore。
 * @param {object} quoteData - 要儲存的報價單物件。
 * @returns {object} - 一個包含 { success, message } 的物件。
 */
export async function saveQuoteToCloud(quoteData) {
    if (!quoteData || !quoteData.quoteId) {
        const errorMsg = '無法儲存：Quote ID 為空。';
        console.error(errorMsg);
        return { success: false, message: errorMsg };
    }

    try {
        // 'quotes' 是資料庫中的「集合」名稱（像資料夾）
        // quoteData.quoteId 是「文件」名稱（像檔案名稱）
        await setDoc(doc(db, 'quotes', quoteData.quoteId), quoteData);
        const successMsg = `成功儲存至雲端: ${quoteData.quoteId}`;
        console.log(successMsg);
        return { success: true, message: successMsg };
    } catch (e) {
        console.error('儲存至雲端失敗:', e);
        return { success: false, message: `儲存至雲端失敗: ${e.message}` };
    }
}

/**
 * 根據 Quote ID 從 Firestore 讀取一份報價單文件。
 * @param {string} quoteId - 要讀取的報價單 ID。
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
            console.log('成功從雲端讀取:', quoteId);
            return {
                success: true,
                data: docSnap.data(),
                message: '成功從雲端讀取。',
            };
        } else {
            const errorMsg = '在資料庫中找不到該筆報價單。';
            console.warn(errorMsg, quoteId);
            return { success: false, data: null, message: errorMsg };
        }
    } catch (e) {
        console.error('從雲端讀取失敗:', e);
        return {
            success: false,
            data: null,
            message: `讀取時發生錯誤: ${e.message}`,
        };
    }
}