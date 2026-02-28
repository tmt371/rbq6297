// 04-core-code/services/online-storage-service.js
// (此為修改)

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
 * 將完整的報價物件（包含 f1Snapshot 和 f2Snapshot）儲存或覆蓋至 Firestore。
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
 * @param {string} quoteId - 欲讀取的報價 ID。
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
            const errorMsg = '在資料庫中找不到該報價單。';
            console.warn(errorMsg, quoteId);
            return { success: false, data: null, message: errorMsg };
        }
    } catch (e) {
        console.error('從雲端讀取失敗：', e);
        // [MODIFIED] 處理權限錯誤
        if (e.code === 'permission-denied') {
            return {
                success: false,
                data: null,
                message: '權限不足。您可能沒有權限讀取此檔案，或檔案不存在。',
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
 * [NEW] (v6298-F4-Search) 根據多個條件進階搜尋報價單。
 * @param {string} uid - 執行搜尋的用戶 Firebase UID。
 * @param {object} filters - 包含篩選條件的物件。
 * @param {string} [filters.name] - 客戶名稱 (開頭是)
 * @param {string} [filters.phone] - 客戶電話 (完全符合)
 * @param {string} [filters.email] - 客戶電郵 (完全符合)
 * @param {string} [filters.postcode] - 郵遞區號 (完全符合)
 * @param {number} [filters.year] - 年份 (YYYY)
 * @param {number} [filters.month] - 月份 (1-12)
 * @param {boolean} [filters.hasMotor] - 是否有馬達 (true/false)
 * @returns {Promise<{success: boolean, data: Array, message: string, needsIndex?: boolean, indexUrl?: string}>}
 */
export async function searchQuotesAdvanced(uid, filters) {
    if (!uid) {
        return { success: false, data: [], message: 'User ID is missing.' };
    }

    try {
        // 1. 基本查詢：必須是使用者自己的文件
        let q = query(collection(db, 'quotes'), where("ownerUid", "==", uid));

        // 2. 建立動態查詢條件
        const conditions = [];

        // 精確欄位 (優先)
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

        // 範圍/字首 欄位
        if (filters.name) {
            // "開頭是" 查詢
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
                // 年和月都有
                startDate = `${year}-${String(month).padStart(2, '0')}-01`;
                const nextMonth = month === 12 ? 1 : month + 1;
                const nextYear = month === 12 ? year + 1 : year;
                endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
            } else if (year) {
                // 只有年
                startDate = `${year}-01-01`;
                endDate = `${year + 1}-01-01`;
            }

            if (startDate && endDate) {
                conditions.push(where("issueDate", ">=", startDate));
                conditions.push(where("issueDate", "<", endDate));
            }
        }

        // 3. 組合查詢
        if (conditions.length > 0) {
            q = query(q, ...conditions);
        }

        // 4. [MODIFIED] (v6298-F4-Search-Fix) 動態排序
        const orderByClauses = [];

        // Firestore 規則：如果使用了不等式 (>, >=, <, <=)，第一個排序必須是該欄位
        if (filters.name) {
            orderByClauses.push(orderBy("customer.name"));
        }
        if (filters.year || filters.month) {
            // 如果 name 也是篩選條件，issueDate 必須是第二排序
            // 如果 name 不是篩選條件，這會是第一排序
            orderByClauses.push(orderBy("issueDate", "desc"));
        }

        // 如果沒有 name 和 date，則使用預設的 issueDate 排序
        if (!filters.name && !filters.year && !filters.month) {
            orderByClauses.push(orderBy("issueDate", "desc"));
        }

        // 5. 應用排序與限制
        q = query(q, ...orderByClauses, limit(50));

        // 6. 執行查詢
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

        // 關鍵：捕捉「需要索引」的錯誤
        if (e.code === 'failed-precondition') {
            const indexCreationURL = e.message.match(/(https?:\/\/[^\s]+)/);
            if (indexCreationURL && indexCreationURL[0]) {
                const url = indexCreationURL[0];
                console.warn(`Firestore 索引缺失。請點擊此連結建立索引：${url}`);
                return {
                    success: false,
                    data: [],
                    message: 'A required database index is missing. A link to create it has been logged to the console (F12). Please ask the administrator to create the index.',
                    needsIndex: true,
                    indexUrl: url
                };
            }
        }
        // [NEW] (v6298-F4-Search-Fix) 將 "Invalid query" 錯誤明確回報給 UI
        if (e.code === 'invalid-argument') {
            return { success: false, data: [], message: `Search error: ${e.message}` };
        }
        return { success: false, data: [], message: `Search error: ${e.message}` };
    }
}