// 更新視頻濾鏡
function updateVideoFilter(element) {
    if (!element || !element.filterValues) {
        console.error('Invalid element or missing filterValues:', element);
        return;
    }

    const {
        red = 100, green = 100, blue = 100,
        brightness = 100, contrast = 100, saturation = 100,
        hue = 0, temperature = 100, gamma = 100,
        blur = 0,
        sharpness = 0,
        highlights = 100,
        shadows = 100,
        clarity = 0,
        grain = 0,
        exposure = 100,
        blacks = 0,
        whites = 0
    } = element.filterValues;

    console.log('Applying filter values:', element.filterValues);

    // 獲取曲線數據
    const rgbCurve = element.filterValues.rgbCurve || { x: 0.5, y: 0.5 };
    const redCurve = element.filterValues.redCurve || { x: 0.5, y: 0.5 };
    const greenCurve = element.filterValues.greenCurve || { x: 0.5, y: 0.5 };
    const blueCurve = element.filterValues.blueCurve || { x: 0.5, y: 0.5 };

    // 創建曲線查找表
    function createCurveLookup(point) {
        if (!point) return '0 1';

        const values = new Array(256);
        for (let i = 0; i < 256; i++) {
            const x = i / 255;
            
            // 使用更精確的曲線計算
            let y;
            if (x <= point.x) {
                // 從 (0,0) 到控制點
                y = x * (point.y / point.x);
            } else {
                // 從控制點到 (1,1)
                y = point.y + ((1 - point.y) / (1 - point.x)) * (x - point.x);
            }
            
            // 確保值在有效範圍內
            y = Math.max(0, Math.min(1, y));
            values[i] = y;
        }
        
        return values.join(' ');
    }

    // 基礎 CSS 濾鏡效果
    const cssFilters = [
        brightness > -1 ? `brightness(${brightness/100})` : ''   ,
        contrast > -1 ? `contrast(${contrast/100})` : '',
        saturation > -1 ? `saturate(${saturation/100})` : '',
        hue > -1 ? `hue-rotate(${hue}deg)` : '',
        blur > -1 ? `blur(${blur/10}px)` : '',
        sharpness > -1 ? `url(#sharpness-${sharpness})` : '',
        highlights !== 100 ? `brightness(${highlights}%) contrast(${200-highlights}%)` : '',
        shadows !== 100 ? `brightness(${shadows}%) contrast(${200-shadows}%)` : '',
        clarity > -1 ? `contrast(${100 + clarity}%) brightness(${100 + clarity/2}%)` : '',
        grain > -1 ? `url(#grain-${grain})` : '',
        exposure !== 100 ? `brightness(${exposure}%)` : '',
        blacks !== 0 ? `url(#blacks-${blacks})` : '',
        whites !== 0 ? `url(#whites-${whites})` : ''
    ].filter(Boolean).join(' ');

    // 色溫調整
    const tempRed = temperature > 100 ? 100 + (temperature - 100) * 0.7 : temperature;
    const tempBlue = temperature < 100 ? 100 + (100 - temperature) * 0.7 : temperature;

    // RGB、Gamma 和黑白階調整
    const svgFilter = `
        <svg xmlns='http://www.w3.org/2000/svg'>
            <filter id='colorize'>
                <feColorMatrix type='matrix' values='
                    ${(red/100) * (tempRed/100)} 0 0 0 0
                    0 ${green/100} 0 0 0
                    0 0 ${(blue/100) * (tempBlue/100)} 0 0
                    0 0 0 1 0
                '/>
                <feComponentTransfer>
                    <feFuncR type='gamma' amplitude='1' exponent='${gamma/100}'/>
                    <feFuncG type='gamma' amplitude='1' exponent='${gamma/100}'/>
                    <feFuncB type='gamma' amplitude='1' exponent='${gamma/100}'/>
                </feComponentTransfer>
                <feComponentTransfer>
                    <feFuncR type='linear' slope='${1 - Math.abs(blacks/200)}' intercept='${Math.max(0, blacks/200)}'/>
                    <feFuncG type='linear' slope='${1 - Math.abs(blacks/200)}' intercept='${Math.max(0, blacks/200)}'/>
                    <feFuncB type='linear' slope='${1 - Math.abs(blacks/200)}' intercept='${Math.max(0, blacks/200)}'/>
                </feComponentTransfer>
                <feComponentTransfer>
                    <feFuncR type='linear' slope='${1 - Math.abs(whites/200)}' intercept='${Math.max(0, whites/200)}'/>
                    <feFuncG type='linear' slope='${1 - Math.abs(whites/200)}' intercept='${Math.max(0, whites/200)}'/>
                    <feFuncB type='linear' slope='${1 - Math.abs(whites/200)}' intercept='${Math.max(0, whites/200)}'/>
                </feComponentTransfer>
                <!-- 添加曲線調整 -->
                <feComponentTransfer>
                    <feFuncR type="table" tableValues="${createCurveLookup(rgbCurve)}"/>
                    <feFuncG type="table" tableValues="${createCurveLookup(rgbCurve)}"/>
                    <feFuncB type="table" tableValues="${createCurveLookup(rgbCurve)}"/>
                </feComponentTransfer>
                <feComponentTransfer>
                    ${redCurve.length ? `<feFuncR type="discrete" tableValues="${createCurveLookup(redCurve)}"/>` : ''}
                    ${greenCurve.length ? `<feFuncG type="discrete" tableValues="${createCurveLookup(greenCurve)}"/>` : ''}
                    ${blueCurve.length ? `<feFuncB type="discrete" tableValues="${createCurveLookup(blueCurve)}"/>` : ''}
                </feComponentTransfer>
            </filter>
        </svg>
    `;

    const filterId = `filter-${Date.now()}`;
    const encodedFilter = encodeURIComponent(svgFilter.replace(/\s+/g, ' '));
    
    try {
        // 應用濾鏡
        const filterString = `
            ${cssFilters}
            url("data:image/svg+xml;utf8,${encodedFilter}#colorize")
        `;
        console.log('Applying filter string:', filterString);
        element.style.filter = filterString;

        // 確濾鏡已應用
        requestAnimationFrame(() => {
            if (element.style.filter !== filterString) {
                element.style.filter = filterString;
            }
        });
    } catch (error) {
        console.error('Error applying filter:', error);
    }
}

// 處理濾鏡更新的 IPC 通信
function setupFilterIPC(videoData) {
    const { ipcRenderer } = require('electron');
    
    // 移除之前的監聽器（如果存在）
    if (videoData.filterListener) {
        ipcRenderer.removeListener('filter-update', videoData.filterListener);
    }
    
    // 獲取視頻或圖片的標題
    const title = videoData.video.dataset.originalFileName;
    
    // 創建新的監聽器函數
    videoData.filterListener = (event, data) => {
        // 只有當更新來自對應的 filter 窗時才應用更新
        if (data.targetTitle === title) {
            console.log('Applying filter update to:', title);
            videoData.video.filterValues = data.filterValues;
            updateVideoFilter(videoData.video);
        }
    };
    
    // 註冊新的監聽器
    ipcRenderer.on('filter-update', videoData.filterListener);
    
    // 發送創建濾鏡窗口的請求
    ipcRenderer.send('create-filter-window', {
        title: title,
        filterData: videoData.video.filterValues || {
            red: 100,
            green: 100,
            blue: 100,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            hue: 0,
            temperature: 100,
            gamma: 100,
            blur: 0,
            sharpness: 0,
            highlights: 100,
            shadows: 100,
            clarity: 0,
            grain: 0,
            exposure: 100,
            blacks: 0,
            whites: 0
        }
    });
}

module.exports = {
    updateVideoFilter,
    setupFilterIPC
};
