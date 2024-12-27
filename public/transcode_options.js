const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

let selectedQuality = 'medium';

// 載入預設配置
const presets = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'transcode_presets.json'), 
    'utf8'
));

// 創建質量選項
const optionsContainer = document.getElementById('options');
Object.entries(presets).forEach(([key, preset]) => {
    const option = document.createElement('div');
    option.className = `option ${key === selectedQuality ? 'selected' : ''}`;
    option.dataset.quality = key;
    
    option.innerHTML = `
        <div class="option-name">${preset.name}</div>
        <div class="option-desc">${getQualityDescription(key)}</div>
    `;
    
    option.addEventListener('click', () => {
        document.querySelectorAll('.option').forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        selectedQuality = key;
    });
    
    optionsContainer.appendChild(option);
});

// 按鈕事件
document.getElementById('cancelBtn').addEventListener('click', () => {
    ipcRenderer.send('transcode-option-selected', { cancelled: true });
});

document.getElementById('confirmBtn').addEventListener('click', () => {
    ipcRenderer.send('transcode-option-selected', {
        cancelled: false,
        quality: selectedQuality
    });
});

// 添加關閉按鈕事件
document.getElementById('closeBtn').addEventListener('click', () => {
    ipcRenderer.send('transcode-option-selected', { cancelled: true });
});

// 輔助函數：獲取質量描述
function getQualityDescription(quality) {
    const descriptions = {
        ultralow_max: '最低畫質，僅保留基本光影，檔案極小',
        ultralow: '最低畫質，僅用於預覽，檔案最小',
        low: '適合移動設備觀看，節省空間',
        medium: '平衡畫質與文件大小',
        high: '高畫質，適合大屏幕觀看',
        ultra: '超高畫質，適合4K顯示器',
        NoLoss: '極致高畫質，接近無損，檔案較大',
        original: '保持原始畫質，文件較大'
    };
    return descriptions[quality] || '';
} 