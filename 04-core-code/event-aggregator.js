// /04_CoreCode/EventAggregator.js

/**
 * EventAggregator (溝通中樞 / 中央神經系統)
 * 實作了「發布-訂閱」模式，是整個應用的事件總線核心。
 */
export class EventAggregator {
    constructor() {
        this.events = {};
    }

    /**
     * 訂閱一個事件
     * @param {string} eventName - 事件名稱
     * @param {Function} callback - 事件觸發時要執行的回調函數
     */
    subscribe(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }

    /**
     * [NEW] 取消訂閱一個事件
     * @param {string} eventName - 事件名稱
     * @param {Function} callback - 先前註冊的回調函數
     */
    unsubscribe(eventName, callback) {
        if (!this.events[eventName]) {
            return;
        }

        this.events[eventName] = this.events[eventName].filter(
            (cb) => cb !== callback
        );
    }

    /**
     * 發布一個事件
     * @param {string} eventName - 事件名稱
     * @param {*} data - 要傳遞給訂閱者的資料
     */
    publish(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => callback(data));
        }
    }
}