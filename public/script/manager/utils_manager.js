class UtilsManager {
    constructor(videoManager) {
        this.videoManager = videoManager;
    }

    // 從 URL 或文件路徑中獲取文件名
    getVideoFileName(src) {
        if (src.startsWith('blob:')) {
            return src.split('/').pop();
        }
        // 使用 path 模組處理路徑
        const path = require('path');
        return path.basename(src);
    }   

    // 初始化背景顏色
    initBackgroundColor() {
        // 嘗試從 localStorage 獲取保存的背景顏色
        const savedColor = localStorage.getItem('backgroundColor');
        if (savedColor) {
            this.videoManager.backgroundColor = savedColor;
        }
        // 應用背景顏色
        document.body.style.backgroundColor = this.videoManager.backgroundColor;
    }
}

module.exports = UtilsManager; 