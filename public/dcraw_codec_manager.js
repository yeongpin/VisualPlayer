const dcraw = require('dcraw');
const fs = require('fs');

class DcrawCodecManager {
    constructor() {
        this.dcraw = dcraw;
    }

    async convertRawToJpeg(rawFilePath) {
        return new Promise((resolve, reject) => {
            try {
                // 讀取 RAW 文件
                const rawData = fs.readFileSync(rawFilePath);
                
                // 使用 dcraw 處理 RAW 數據
                const buf = new Uint8Array(rawData);
                
                // 提取和處理圖像
                const processedData = this.dcraw(buf, {
                    verbose: true,
                    extractThumbnail: false,  // 設置為 false 以獲取完整圖像
                    outputPixels: true,  // 輸出處理後的像素數據
                    wb: 'camera'  // 使用相機白平衡
                });

                resolve(processedData);
            } catch (error) {
                console.error('RAW processing error:', error);
                reject(error);
            }
        });
    }

    // 保留你原來的其他方法...
}

module.exports = DcrawCodecManager;