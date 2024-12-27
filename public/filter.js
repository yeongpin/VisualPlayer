const { ipcRenderer } = require('electron');
const remote = require('@electron/remote');
const { createSvgIcon } = require('./icons.js');

// 獲取元素
const titleElement = document.querySelector('.title');
const closeButton = document.querySelector('.close-button');
const resetButton = document.querySelector('.reset-button');

// 定義濾鏡參數
const filterCategories = {
    basic: [
        { name: 'brightness', label: '亮度', min: 0, max: 200, default: 100 },
        { name: 'contrast', label: '對比度', min: 0, max: 200, default: 100 },
        { name: 'saturation', label: '飽和度', min: 0, max: 200, default: 100 },
        { name: 'gamma', label: '伽瑪', min: 0, max: 200, default: 100 }
    ],
    color: [
        { name: 'red', label: '紅色', min: 0, max: 200, default: 100 },
        { name: 'green', label: '綠色', min: 0, max: 200, default: 100 },
        { name: 'blue', label: '藍色', min: 0, max: 200, default: 100 },
        { name: 'hue', label: '色相', min: -180, max: 180, default: 0 },
        { name: 'temperature', label: '色溫', min: 0, max: 200, default: 100 }
    ],
    light: [
        { name: 'highlights', label: '高光', min: 0, max: 200, default: 100 },
        { name: 'shadows', label: '陰影', min: 0, max: 200, default: 100 },
        { name: 'exposure', label: '曝光', min: 0, max: 200, default: 100 },
        { name: 'blacks', label: '黑階', min: -100, max: 100, default: 0 },
        { name: 'whites', label: '白階', min: -100, max: 100, default: 0 }
    ],
    curves: [
        { name: 'rgbCurve', label: 'RGB曲線', type: 'curve' }
    ],
    effects: [
        { name: 'clarity', label: '清晰度', min: 0, max: 200, default: 0 },
        { name: 'sharpness', label: '銳度', min: 0, max: 200, default: 0 },
        { name: 'blur', label: '模糊', min: 0, max: 200, default: 0 },
        { name: 'grain', label: '顆粒', min: 0, max: 200, default: 0 }
    ]
};

let currentValues = {};

// 接收主進程發送的數據
ipcRenderer.on('filter-data', (event, { title, filterData }) => {
    titleElement.textContent = title;
    currentValues = filterData;
    createFilterControls();
});

// 添加標籤切換功能
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabContent = document.querySelector(`.tab-content[data-tab="${tab.dataset.tab}"]`);
        if (tabContent) {
            tabContent.classList.add('active');
        }
    });
});

// 創建控制項的函數
function createFilterControls() {
    // 清空所有容器
    document.querySelectorAll('.filter-controls').forEach(container => {
        container.innerHTML = '';
    });

    // 為每個類別創建控制項
    Object.entries(filterCategories).forEach(([category, params]) => {
        const container = document.querySelector(`.filter-controls.${category}-controls`);
        if (container) {
            params.forEach(param => {
                // 根據控制項類型創建不同的 UI
                const control = param.type === 'curve' 
                    ? createControlElement(param)  // 使用曲線控制項創建函數
                    : createSliderControl(param);  // 使用原有的滑塊控制項創建邏輯
                
                if (control) {
                    container.appendChild(control);
                }
            });
        }
    });
}

// 修改 createSliderControl 函數
function createSliderControl(param) {
    const group = document.createElement('div');
    group.className = 'filter-group';

    const label = document.createElement('label');
    label.className = 'filter-label';
    label.setAttribute('data-i18n', `filter.parameters.${param.name}`);
    label.textContent = window.languageManager.getText(`filter.parameters.${param.name}`) || param.label;

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = param.min;
    slider.max = param.max;
    
    // 確保當前值存在，即使是 0
    const currentValue = currentValues[param.name] !== undefined ? currentValues[param.name] : param.default;
    slider.value = currentValue;

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'value-input';
    valueInput.value = currentValue;

    // 設置初始進度條，確保在最小值時也能顯示
    const progress = ((currentValue - param.min) / (param.max - param.min)) * 100;
    slider.style.setProperty('--range-progress', `${progress}%`);

    // 滑塊值變化時更新輸入框
    slider.oninput = () => {
        const value = Number(slider.value);
        valueInput.value = value;
        currentValues[param.name] = value;
        const progress = ((value - param.min) / (param.max - param.min)) * 100;
        slider.style.setProperty('--range-progress', `${progress}%`);
        updateFilter();
    };

    // 輸入框值變化時更新滑塊
    valueInput.onchange = () => {
        let value = Number(valueInput.value);
        // 確保值在範圍內
        value = Math.max(param.min, Math.min(param.max, value));
        valueInput.value = value;
        slider.value = value;
        currentValues[param.name] = value;
        const progress = ((value - param.min) / (param.max - param.min)) * 100;
        slider.style.setProperty('--range-progress', `${progress}%`);
        updateFilter();
    };

    // 處理輸入框的按鍵事件
    valueInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            valueInput.blur();
        }
    };

    // 重置按鈕
    const resetItemButton = document.createElement('button');
    resetItemButton.className = 'reset-item';
    resetItemButton.innerHTML = '↺';
    resetItemButton.title = '重置此項';
    resetItemButton.onclick = () => {
        const defaultValue = param.default;
        slider.value = defaultValue;
        valueInput.value = defaultValue;
        currentValues[param.name] = defaultValue;
        const progress = ((defaultValue - param.min) / (param.max - param.min)) * 100;
        slider.style.setProperty('--range-progress', `${progress}%`);
        updateFilter();
    };

    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(valueInput);
    sliderContainer.appendChild(resetItemButton);
    group.appendChild(label);
    group.appendChild(sliderContainer);
    return group;
}

// 更新濾鏡效果
function updateFilter() {
    const processedValues = { ...currentValues };
    
    // 確保曲線數據正確傳遞
    if (processedValues.rgbCurve) {
        processedValues.rgbCurve = {
            x: processedValues.rgbCurve.x,
            y: processedValues.rgbCurve.y
        };
    }

    // 發送處理後的值到主進程
    ipcRenderer.send('filter-update', processedValues);
}

// 重置按鈕事件
resetButton.onclick = () => {
    // 重置所有類別的參數
    Object.values(filterCategories).flat().forEach(param => {
        currentValues[param.name] = param.default;
    });
    createFilterControls();
    updateFilter();
};

// 關閉按鈕事件
closeButton.onclick = () => {
    const window = remote.getCurrentWindow();
    window.close();
};


// 初始化語言選擇器
function initLanguageSelector() {
    const languageSelect = document.getElementById('language');
    if (languageSelect) {
        // 設置當前語言
        languageSelect.value = window.languageManager.currentLanguage;

        // 監聽語言變���
        languageSelect.addEventListener('change', async (e) => {
            const newLanguage = e.target.value;
            await window.languageManager.changeLanguage(newLanguage);
        });
    }
}

// 更新界面文本
function updateUIText() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = window.languageManager.getText(key);
    });
}

// 在頁面加載時初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    
    const presetButton = document.querySelector('.preset-button');
    console.log('Preset button:', presetButton);
    
    const closeButton = document.querySelector('.close-button');
    console.log('Close button:', closeButton);
    
    const resetButton = document.querySelector('.reset-button');
    
    if (presetButton) {
        console.log('Setting preset icon');
        presetButton.innerHTML = createSvgIcon('preset');
    }
    if (closeButton) {
        console.log('Setting close icon');
        closeButton.innerHTML = createSvgIcon('close');
    }
    if (resetButton) {
        console.log('Setting reset button');
        // 創建一個容器來同時顯示圖標和文字
        resetButton.innerHTML = `
             <span style="margin-left: 5px;">重置所有</span>
        `;
    }
});

// 監聽語言變更事件
window.addEventListener('languagechange', updateUIText);

// 加載預設參數
const presets = require('./presets.json');
const presetButton = document.querySelector('.preset-button');
const presetMenu = document.querySelector('.preset-menu');

// 創建預設選項
Object.keys(presets).forEach(presetName => {
    const presetItem = document.createElement('div');
    presetItem.className = 'preset-item';
    presetItem.textContent = presetName;
    presetItem.onclick = () => {
        // 應用預設參數
        const presetValues = presets[presetName];
        Object.assign(currentValues, presetValues);
        createFilterControls();
        updateFilter();
        presetMenu.classList.remove('show');
    };
    presetMenu.appendChild(presetItem);
});

// 切換預設菜單
presetButton.onclick = (e) => {
    e.stopPropagation();
    presetMenu.classList.toggle('show');
};

// 點擊其他地方關閉菜單
document.addEventListener('click', (e) => {
    if (!presetButton.contains(e.target) && !presetMenu.contains(e.target)) {
        presetMenu.classList.remove('show');
    }
});

// 在 createControlElement 函數中添加曲線控制項的處理
function createControlElement(control) {
    if (control.type === 'curve') {
        const container = document.createElement('div');
        container.className = 'filter-group curve-group';

        const label = document.createElement('label');
        label.className = 'filter-label';
        label.setAttribute('data-i18n', `filter.parameters.${control.name}`);
        label.textContent = window.languageManager.getText(`filter.parameters.${control.name}`) || control.label;

        const curveContainer = document.createElement('div');
        curveContainer.className = 'curve-container';

        // 創建曲線編輯器
        const curveEditor = document.createElement('div');
        curveEditor.className = 'curve-editor';
        
        // 添加網格背景
        const grid = document.createElement('div');
        grid.className = 'grid';
        curveEditor.appendChild(grid);

        // 修改畫布尺寸
        const canvas = document.createElement('canvas');
        canvas.width = 400;  // 增加寬度
        canvas.height = 400; // 增加高度
        curveEditor.appendChild(canvas);

        // 初始化控制點位置
        const point = currentValues[control.name] || { x: 0.5, y: 0.5 };
        
        // 創建控制點
        const pointElement = document.createElement('div');
        pointElement.className = 'curve-point';
        pointElement.style.left = `${point.x * 400}px`; // 使用新的寬度
        pointElement.style.top = `${(1 - point.y) * 400}px`; // 使用新的高度
        curveEditor.appendChild(pointElement);

        // 創建數值編輯區域
        const valuesContainer = document.createElement('div');
        valuesContainer.className = 'curve-values';

        // X 值輸入框和重置按鈕
        const xContainer = document.createElement('div');
        xContainer.className = 'value-container';
        const xLabel = document.createElement('label');
        xLabel.textContent = 'X: ';
        const xInput = document.createElement('input');
        xInput.type = 'number';
        xInput.value = Math.round(point.x * 100);
        xInput.min = 0;
        xInput.max = 100;
        const xResetButton = document.createElement('button');
        xResetButton.className = 'reset-item';
        xResetButton.innerHTML = '↺';
        xResetButton.title = '重置 X 值';
        xResetButton.onclick = () => {
            const defaultX = 0.5;
            point.x = defaultX;
            xInput.value = Math.round(defaultX * 100);
            pointElement.style.left = `${defaultX * 400}px`;
            drawCurve(canvas, point);
            currentValues[control.name] = point;
            updateFilter();
        };
        xContainer.appendChild(xLabel);
        xContainer.appendChild(xInput);
        xContainer.appendChild(xResetButton);

        // Y 值輸入框和重置按鈕
        const yContainer = document.createElement('div');
        yContainer.className = 'value-container';
        const yLabel = document.createElement('label');
        yLabel.textContent = 'Y: ';
        const yInput = document.createElement('input');
        yInput.type = 'number';
        yInput.value = Math.round(point.y * 100);
        yInput.min = 0;
        yInput.max = 100;
        const yResetButton = document.createElement('button');
        yResetButton.className = 'reset-item';
        yResetButton.innerHTML = '↺';
        yResetButton.title = '重置 Y 值';
        yResetButton.onclick = () => {
            const defaultY = 0.5;
            point.y = defaultY;
            yInput.value = Math.round(defaultY * 100);
            pointElement.style.top = `${(1 - defaultY) * 400}px`;
            drawCurve(canvas, point);
            currentValues[control.name] = point;
            updateFilter();
        };
        yContainer.appendChild(yLabel);
        yContainer.appendChild(yInput);
        yContainer.appendChild(yResetButton);

        valuesContainer.appendChild(xContainer);
        valuesContainer.appendChild(yContainer);

        // 更新函數
        const updatePoint = () => {
            const x = Math.max(0, Math.min(1, xInput.value / 100));
            const y = Math.max(0, Math.min(1, yInput.value / 100));
            point.x = x;
            point.y = y;
            pointElement.style.left = `${x * 400}px`; // 使用新的寬度
            pointElement.style.top = `${(1 - y) * 400}px`; // 使用新的高度
            drawCurve(canvas, point);
            currentValues[control.name] = point;
            updateFilter();
        };

        // 添加輸入事件
        xInput.onchange = updatePoint;
        yInput.onchange = updatePoint;

        // 添加拖動功能
        let isDragging = false;

        pointElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            pointElement.classList.add('active');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const rect = curveEditor.getBoundingClientRect();
                let x = (e.clientX - rect.left) / rect.width;
                let y = 1 - (e.clientY - rect.top) / rect.height;

                x = Math.max(0, Math.min(1, x));
                y = Math.max(0, Math.min(1, y));

                point.x = x;
                point.y = y;
                pointElement.style.left = `${x * 400}px`; // 使用新的寬度
                pointElement.style.top = `${(1 - y) * 400}px`; // 使用新的高度

                xInput.value = Math.round(x * 100);
                yInput.value = Math.round(y * 100);

                drawCurve(canvas, point);
                currentValues[control.name] = point;
                requestAnimationFrame(() => updateFilter()); // 使用 requestAnimationFrame 優化更新
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            pointElement.classList.remove('active');
        });

        // 初始化繪製曲線
        drawCurve(canvas, point);

        curveContainer.appendChild(curveEditor);
        curveContainer.appendChild(valuesContainer);
        container.appendChild(label);
        container.appendChild(curveContainer);
        return container;
    }
    // ... 其他控制項的處理保持不變
}

// 修改 drawCurve 函數
function drawCurve(canvas, point) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 繪製網格
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // 繪製水平和垂直線
    for (let i = 0; i <= 10; i++) {
        const pos = i * canvas.width / 10;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, canvas.height);
        ctx.moveTo(0, pos);
        ctx.lineTo(canvas.width, pos);
        ctx.stroke();
    }
    
    // 繪製曲線
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    
    // 使用二次貝塞爾曲線使曲線更平滑
    const cp1x = point.x * canvas.width;
    const cp1y = (1 - point.y) * canvas.height;
    ctx.quadraticCurveTo(cp1x, cp1y, canvas.width, 0);
    ctx.stroke();
    
    // 繪製控制點
    ctx.beginPath();
    ctx.arc(point.x * canvas.width, (1 - point.y) * canvas.height, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
}