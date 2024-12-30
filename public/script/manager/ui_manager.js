class UIManager {
    constructor(videoManager) {
        this.videoManager = videoManager;
        this.keyInfoVisible = false;
        this.statsVisible = false;
        this.stats = null;
        this.backgroundColor = '#000000';
    }

    toggleKeyInfo() {
        const existingPanel = document.querySelector('.key-info-panel');
        if (existingPanel) {
            existingPanel.remove();
            this.keyInfoVisible = false;
        } else {
            this.showKeyInfo();
            this.keyInfoVisible = true;
        }
    }
    
    showKeyInfo() {
        const infoPanel = document.createElement('div');
        infoPanel.className = 'key-info-panel';
        infoPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            padding: 20px;
            border-radius: 12px;
            color: white;
            font-family: Arial, sans-serif;
            min-width: 400px;
            max-width: 600px;
            z-index: 10000;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        `;

        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
        `;
        title.textContent = '捷鍵說明';

        const keyInfos = [
            { key: 'Space', desc: '播放/暫停所有視頻' },
            { key: 'Backspace', desc: '重置所有視頻到起點' },
            { key: 'Delete', desc: '刪除當前懸停的視頻' },
            { key: '0-9', desc: '設置播放速度 (0=10x, 1-9=1-9x)' },
            { key: '←/→', desc: '後退/前進 5 秒' },
            { key: 'M', desc: '切換靜音狀態' },
            { key: 'W/E', desc: '減少/增加模糊程度' },
            { key: 'Q', desc: '重置模糊效果' },
            { key: 'G', desc: '顯示/隱藏視頻卡片列表' },
            { key: 'K', desc: '顯示此說明' },
            { key: 'Ctrl + 左鍵', desc: '將視頻置於最上層' },
            { key: 'Shift + 右鍵拖動', desc: '旋轉視頻' },
            { key: 'B', desc: '調整背景顏色' },
            { key: 'Tab', desc: '顯示/隱藏性能統計' },
            { key: 'N', desc: '打開設置窗口' },
            { key: 'Ctrl + S', desc: '保存布局' },
            { key: 'Ctrl + F', desc: '加載布局' },
            { key: 'H', desc: '啟卡片列表' },
            { key: 'Pin', desc: '阿彬開發中' }
        ];

        const infoList = document.createElement('div');
        infoList.style.cssText = `
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 10px 20px;
            margin-bottom: 20px;
        `;

        keyInfos.forEach(info => {
            const keyCell = document.createElement('div');
            keyCell.style.cssText = `
                background: rgba(255,255,255,0.1);
                padding: 4px 8px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 14px;
                text-align: center;
            `;
            keyCell.textContent = info.key;

            const descCell = document.createElement('div');
            descCell.style.cssText = `
                font-size: 14px;
                line-height: 24px;
            `;
            descCell.textContent = info.desc;

            infoList.appendChild(keyCell);
            infoList.appendChild(descCell);
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = '關閉';
        closeButton.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            display: block;
            margin: 0 auto;
            transition: background 0.2s;
        `;
        closeButton.onmouseover = () => closeButton.style.background = 'rgba(255,255,255,0.3)';
        closeButton.onmouseout = () => closeButton.style.background = 'rgba(255,255,255,0.1)';
        closeButton.onclick = () => infoPanel.remove();

        infoPanel.appendChild(title);
        infoPanel.appendChild(infoList);
        infoPanel.appendChild(closeButton);
        document.body.appendChild(infoPanel);
    }

    toggleStats() {
        if (this.statsVisible) {
            if (this.stats) {
                this.stats.remove();
                this.stats = null;
            }
            this.statsVisible = false;
        } else {
            this.showStats();
            this.statsVisible = true;
        }
    }

    showStats() {
        this.stats = document.createElement('div');
        this.stats.className = 'performance-stats';
        this.stats.style.cssText = `
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 35px;
            z-index: 10000;
            min-width: 200px;
            text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
            text-align: left;
        `;

        document.body.appendChild(this.stats);

        let frameCount = 0;
        let fps = 0;
        let memory = 0;
        let lastFpsUpdate = performance.now();

        // 獲取 GPU 信息
        let gpuInfo = 'N/A';
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    gpuInfo = renderer
                        .replace(/ANGLE \((.*?)\)/, '$1')
                        .replace(/Google Inc\. \((.*?)\)/, '$1')
                        .replace(/\s+/g, ' ')
                        .trim();
                }
            }
        } catch (e) {
            console.log('Unable to get GPU info');
        }

        const updateStats = () => {
            const now = performance.now();
            frameCount++;

            if (now - lastFpsUpdate >= 1000) {
                fps = frameCount;
                frameCount = 0;
                lastFpsUpdate = now;

                if (window.performance && window.performance.memory) {
                    memory = Math.round(window.performance.memory.usedJSHeapSize / 1048576);
                }

                const refreshRate = window.screen?.refreshRate || 60;
                const videoCount = this.videoManager.videos.filter(v => !v.isImage).length;
                const imageCount = this.videoManager.videos.filter(v => v.isImage).length;
                const playingVideos = this.videoManager.videos.filter(v => !v.isImage && !v.video.paused).length;

                this.stats.innerHTML = `
                    <div style="color: #0f0;">FPS: ${fps}/${refreshRate}Hz</div>
                    <div style="color: #0ff;">Memory: ${memory}MB</div>
                    <div style="color: #ff0;">Videos: ${playingVideos}/${videoCount}</div>
                    <div style="color: #f70;">Images: ${imageCount}</div>
                    <div style="color: #f0f;">Resolution: ${window.innerWidth}x${window.innerHeight}</div>
                    <div style="color: #f90;">GPU: ${gpuInfo}</div>
                `;
            }

            if (this.statsVisible) {
                requestAnimationFrame(updateStats);
            }
        };

        requestAnimationFrame(updateStats);
    }

    showBackgroundColorPicker() {
        const existingPicker = document.querySelector('.background-color-picker');
        if (existingPicker) {
            existingPicker.remove();
            return;
        }

        const picker = document.createElement('div');
        picker.className = 'background-color-picker';
        picker.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            padding: 20px;
            border-radius: 12px;
            color: white;
            font-family: Arial, sans-serif;
            width: 300px;
            z-index: 10000;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        `;

        const title = document.createElement('div');
        title.textContent = '背景顏色';
        title.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            text-align: center;
        `;

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = this.videoManager.backgroundColor || '#000000';
        colorInput.style.cssText = `
            width: 100%;
            height: 40px;
            margin-bottom: 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;

        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            justify-content: center;
            gap: 10px;
        `;

        const resetButton = document.createElement('button');
        resetButton.textContent = '重置';
        resetButton.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        resetButton.onclick = () => {
            this.videoManager.backgroundColor = '#000000';
            colorInput.value = '#000000';
            document.body.style.backgroundColor = '#000000';
            localStorage.setItem('backgroundColor', '#000000');
        };

        const closeButton = document.createElement('button');
        closeButton.textContent = '關閉';
        closeButton.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        closeButton.onmouseover = () => closeButton.style.background = 'rgba(255,255,255,0.3)';
        closeButton.onmouseout = () => closeButton.style.background = 'rgba(255,255,255,0.1)';
        closeButton.onclick = () => picker.remove();

        colorInput.oninput = () => {
            this.videoManager.backgroundColor = colorInput.value;
            document.body.style.backgroundColor = this.videoManager.backgroundColor;
            localStorage.setItem('backgroundColor', this.videoManager.backgroundColor);
        };

        buttonsContainer.appendChild(resetButton);
        buttonsContainer.appendChild(closeButton);

        picker.appendChild(title);
        picker.appendChild(colorInput);
        picker.appendChild(buttonsContainer);
        document.body.appendChild(picker);

        const closeOnOutsideClick = (e) => {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('mousedown', closeOnOutsideClick);
            }
        };
        document.addEventListener('mousedown', closeOnOutsideClick);
    }
}

module.exports = UIManager; 