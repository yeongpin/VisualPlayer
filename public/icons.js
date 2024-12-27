const fs = require('fs');
const path = require('path');

// 從 icons.json 讀取圖標數據
const iconsPath = path.join(__dirname, 'icons.json');
const iconPaths = JSON.parse(fs.readFileSync(iconsPath, 'utf8'));

// 創建 SVG 圖標的輔助函數
function createSvgIcon(iconName) {
    if (!iconPaths[iconName]) {
        console.error(`Icon not found: ${iconName}`);
        return '';
    }
    return `<svg viewBox="0 0 24 24"><path fill="currentColor" d="${iconPaths[iconName]}"/></svg>`;
}

module.exports = { iconPaths, createSvgIcon }; 