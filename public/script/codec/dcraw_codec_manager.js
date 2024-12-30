const dcraw = require('dcraw');
const fs = require('fs');

class DcrawCodecManager {
    constructor() {
        this.dcraw = dcraw;
    }

    async convertRawToJpeg(rawFilePath, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const rawData = fs.readFileSync(rawFilePath);
                const buf = new Uint8Array(rawData);
                
                // 使用用戶選擇的選項
                const processedData = this.dcraw(buf, {
                    verbose: true,
                    extractThumbnail: false,
                    outputPixels: true,
                    wb: 'camera',
                    ...options  // 合併用戶選擇的選項
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