const { ipcRenderer } = require('electron');

// 默認選項
const defaultOptions = {
    useCameraWhiteBalance: true,
    useAverageWhiteBalance: true,
    useEmbeddedColorMatrix: true,
    use16BitMode: true,
    use16BitLinearMode: true,
    setHalfSizeMode: false,
    setFourColorMode: false,
    useDocumentMode: false,
    useRawMode: false,
    useExportMode: false,
    setNoStretchMode: false,
    setNoAutoBrightnessMode: false
};

// 當前選項
let currentOptions = { ...defaultOptions };

// DOM 元素
const closeBtn = document.getElementById('closeBtn');
const resetBtn = document.getElementById('resetBtn');
const cancelBtn = document.getElementById('cancelBtn');
const confirmBtn = document.getElementById('confirmBtn');

// 初始化所有輸入元素的值
function initializeInputs() {
    for (const [key, value] of Object.entries(currentOptions)) {
        const element = document.getElementById(key);
        if (element) {
            element.checked = value;
        }
    }
}

// 收集所有輸入值
function collectInputValues() {
    const options = {};
    for (const key of Object.keys(defaultOptions)) {
        const element = document.getElementById(key);
        if (element) {
            options[key] = element.checked;
        }
    }
    return options;
}

// 重置為默認值
function resetToDefaults() {
    currentOptions = { ...defaultOptions };
    initializeInputs();
}

// 事件監聽器
closeBtn.addEventListener('click', () => {
    ipcRenderer.send('raw-option-selected', { cancelled: true });
    window.close();
});

cancelBtn.addEventListener('click', () => {
    ipcRenderer.send('raw-option-selected', { cancelled: true });
    window.close();
});

resetBtn.addEventListener('click', resetToDefaults);

confirmBtn.addEventListener('click', () => {
    const options = collectInputValues();
    ipcRenderer.send('raw-option-selected', {
        cancelled: false,
        options: options
    });
    window.close();
});

// 初始化
initializeInputs(); 