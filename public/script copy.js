// 在 VideoManager 類的開頭添加
const EventHandlers = require('./script/manager/event_handlers.js');

class VideoManager {
    constructor() {
        this.videos = [];
        this.dropZone = document.getElementById('dropZone');
        this.blurAmount = 0;
        this.cardListVisible = false;
        this.activeCard = null;
        this.keyInfoVisible = false;
        this.backgroundColor = '#000000';
        this.statsVisible = false;
        this.stats = null;
        this.resizeHandlesVisible = {}; // 用於跟踪每個視頻的調整大小控制點狀態
        
        // 初始化背景顏色
        this.initBackgroundColor();
        
        // 初始化事件處理器
        this.eventHandlers = new EventHandlers(this);
        
        this.initDropZone();
        this.initGlobalEvents();
        this.initSaveLoadEvents();
        
        // 添加 IPC 事件監聽
        const { ipcRenderer } = require('electron');

        ipcRenderer.on('save-layout', () => {
            this.saveLayout();
        });
        
        ipcRenderer.on('load-layout', () => {
            this.loadLayout();
        });
        
        ipcRenderer.on('open-filter', (event, { index }) => {
            const videoData = this.videos[index];
            if (videoData) {
                const { updateVideoFilter, setupFilterIPC } = require('./filter_utils.js');
                // 創建 filterValues 如果不存在
                if (!videoData.video.filterValues) {
                    videoData.video.filterValues = {
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
                        exposure: 100
                    };
                }
                setupFilterIPC(videoData);
            }
        });

        // 在 constructor 中修改 delete-media 事件處理
        ipcRenderer.on('delete-media', (event, index) => {
            console.log('Deleting media at index:', index); // 添加調試日誌
            console.log('Current videos:', this.videos); // 添加調試日誌
            
            const videoData = this.videos[index];
            if (videoData) {
                console.log('Found video data to delete:', videoData); // 添加調試日誌
                
                // 從 DOM 中移除元素
                videoData.wrapper.remove();
                
                // 從數組中移除元素
                this.videos = this.videos.filter((_, i) => i !== index);
                
                console.log('Videos after deletion:', this.videos); // 添加調試日誌
                
                // 如果沒有視頻了，顯示 dropZone
                if (this.videos.length === 0) {
                    this.dropZone.style.display = 'flex';
                }

                // 立即更新卡片列表
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('update-cards', {
                    videos: this.videos.map(v => ({
                        isImage: v.isImage,
                        video: {
                            src: v.video.src,
                            dataset: {
                                originalFileName: v.video.dataset.originalFileName
                            }
                        }
                    }))
                });
            }
        });

        // 添加請求 filterValues 的處理
        ipcRenderer.on('request-filter-values', (event, index) => {
            const videoData = this.videos[index];
            if (videoData) {
                // 發送當前的 filterValues
                ipcRenderer.send('send-filter-values', {
                    index,
                    filterValues: videoData.video.filterValues || {
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
                        exposure: 100
                    }
                });
            }
        });

        // 在 constructor 中添加
        ipcRenderer.on('focus-media', (event, index) => {
            const videoData = this.videos[index];
            if (videoData) {
                // 將視頻/圖片置於頂層
                videoData.wrapper.style.zIndex = this.getTopZIndex() + 1;
                // 添加高亮效果
                videoData.wrapper.style.outline = '2px solid #0af';
                setTimeout(() => {
                    videoData.wrapper.style.outline = 'none';
                }, 1000);
            }
        });

        // 添加 filter-update 事件監聽
        ipcRenderer.on('filter-update', (event, { targetTitle, filterValues }) => {
            // 找到對應的視頻/圖片
            const targetMedia = this.videos.find(v => 
                v.video.dataset.originalFileName === targetTitle
            );
            
            if (targetMedia) {
                // 更新 filterValues
                targetMedia.video.filterValues = filterValues;
                // 應用濾鏡效果
                const { updateVideoFilter } = require('./filter_utils.js');
                updateVideoFilter(targetMedia.video);
            }
        });

        // 添加請求視頻數據的處理
        ipcRenderer.on('request-videos-data', () => {
            ipcRenderer.send('update-cards', {
                videos: this.videos.map(v => ({
                    isImage: v.isImage,
                    video: {
                        src: v.video.src,
                        dataset: {
                            originalFileName: v.video.dataset.originalFileName
                        },
                        filterValues: v.video.filterValues // 添加 filterValues
                    }
                }))
            });
        });

        // 修改重置變換事件監聽
        ipcRenderer.on('reset-transform', (event, index) => {
            const videoData = this.videos[index];  // 移除錯誤的 find 調用
            if (videoData) {
                // 保存原始尺寸
                const originalWidth = videoData.video.videoWidth || videoData.video.naturalWidth;
                const originalHeight = videoData.video.videoHeight || videoData.video.naturalHeight;
                
                // 計算適當的縮放比例
                const maxInitialWidth = window.innerWidth * 0.8;  // 或其他合適的最大寬度
                const scale = Math.min(1, maxInitialWidth / originalWidth);

                // 重置變換屬性
                videoData.scale = 1;
                videoData.rotation = 0;
                videoData.flipX = false;
                videoData.flipY = false;

                // 更新變換
                this.updateVideoTransform(videoData);

                // 重置 wrapper 尺寸
                videoData.wrapper.style.width = `${originalWidth * scale}px`;
                videoData.wrapper.style.height = `${originalHeight * scale}px`;
            }
        });

        // 添加水平翻轉事件監聽
        ipcRenderer.on('flip-x', (event, index) => {
            const videoData = this.videos[index];
            if (videoData) {
                videoData.flipX = !videoData.flipX;
                this.updateVideoTransform(videoData);
            }
        });

        // 添加垂直翻轉事件監聽
        ipcRenderer.on('flip-y', (event, index) => {
            const videoData = this.videos[index];
            if (videoData) {
                videoData.flipY = !videoData.flipY;
                this.updateVideoTransform(videoData);
            }
        });

        // 添加調整大小事件監聽
        ipcRenderer.on('resize-media', (event, index) => {
            const videoData = this.videos[index];
            if (videoData) {
                this.resizeMedia(videoData);
            }
        });

        // 在 constructor 中添加
        ipcRenderer.on('toggle-visible', (event, index) => {
            const videoData = this.videos[index];
            if (videoData) {
                if (videoData.wrapper.style.display === 'none') {
                    videoData.wrapper.style.display = 'block';
                } else {
                    videoData.wrapper.style.display = 'none';
                }
            }
        });
    }
    
    initDropZone() {
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const files = Array.from(e.dataTransfer.files);
            files.forEach(file => {
                if (file.type.startsWith('video/')) {
                    const blobUrl = URL.createObjectURL(file);
                    this.addVideo(blobUrl, file.name);
                } else if (file.type.startsWith('image/')) {
                    const blobUrl = URL.createObjectURL(file);
                    this.addImage(blobUrl, file.name);
                }
            });
            
            if (this.videos.length > 0) {
                this.dropZone.style.display = 'none';
            }
        });
    }
    
    initGlobalEvents() {
        document.addEventListener('mousemove', this.eventHandlers.handleMouseMove.bind(this.eventHandlers));
        document.addEventListener('mouseup', this.eventHandlers.handleMouseUp.bind(this.eventHandlers));
        document.addEventListener('keydown', this.eventHandlers.handleKeyDown.bind(this.eventHandlers));
    }
    
    initSaveLoadEvents() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+S 保存布局
            if (e.ctrlKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.saveLayout();
            }
            // Ctrl+F 加載布局
            if (e.ctrlKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                this.loadLayout();
            }
            // 添加全局鍵盤事件監聽
            if (e.key === 'n' || e.key === 'N') {
                // 打開設置窗口
                console.log('Opening settings window...'); // 添加調試日誌
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('open-settings');
            }
        });
    }
    
    addVideo(source, originalFileName) {
        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';
        
        // 創建一個臨時視頻元素來獲取原始尺寸
        const tempVideo = document.createElement('video');
        tempVideo.src = source;
        
        // 等待視頻加載以獲取其原始尺寸
        tempVideo.onloadedmetadata = () => {
            const originalWidth = tempVideo.videoWidth;
            const originalHeight = tempVideo.videoHeight;
            
            // 設置初始尺寸，保持原始比例
            const maxInitialWidth = 620;  // 最大初始寬度
            const scale = Math.min(1, maxInitialWidth / originalWidth);
            wrapper.style.width = `${originalWidth * scale}px`;
            wrapper.style.height = `${originalHeight * scale}px`;
            
            // 創建實際的視頻元素
            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';
            
            const video = document.createElement('video');
            video.src = source;
            
            // 檢查是否已經有相同文件名的視頻
            const baseName = originalFileName || source.split('\\').pop().split('/').pop();
            let finalFileName = baseName;
            let counter = 1;
            
            while (this.videos.some(v => v.video.dataset.originalFileName === finalFileName)) {
                const nameWithoutNumber = baseName.replace(/-\d+$/, '');  // 移除已有的編號
                const ext = nameWithoutNumber.match(/\.[^.]*$/)?.[0] || '';  // 獲取副檔名
                const nameWithoutExt = nameWithoutNumber.replace(/\.[^.]*$/, '');  // 移除副檔名
                finalFileName = `${nameWithoutExt}-${counter}${ext}`;
                counter++;
            }
            
            video.dataset.originalFileName = finalFileName;
            
            video.controls = false;
            video.muted = true;
            video.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: fill;
                pointer-events: none;
            `;
            
            videoContainer.appendChild(video);
            wrapper.appendChild(videoContainer);
            
            const controls = document.createElement('div');
            controls.className = 'video-controls';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            
            // 添加開始和結束遮罩
            const startMask = document.createElement('div');
            startMask.className = 'time-mask start-mask';
            
            const endMask = document.createElement('div');
            endMask.className = 'time-mask end-mask';
            
            // 添加開始和結束時間的控制點
            const startHandle = document.createElement('div');
            startHandle.className = 'time-handle start-handle';
            startHandle.title = '設置起始時間';
            
            const endHandle = document.createElement('div');
            endHandle.className = 'time-handle end-handle';
            endHandle.title = '設置結束時間';
            
            const progress = document.createElement('div');
            progress.className = 'progress';
            
            // 添加時間範圍指示器
            const timeRange = document.createElement('div');
            timeRange.className = 'time-range';
            
            progressBar.appendChild(startMask);
            progressBar.appendChild(endMask);
            progressBar.appendChild(startHandle);
            progressBar.appendChild(endHandle);
            progressBar.appendChild(timeRange);
            progressBar.appendChild(progress);

            // 初始化時間範圍
            video.startTime = 0;
            video.endTime = undefined;

            // 處理控制點拖動
            let isDragging = false;
            let activeHandle = null;

            const updateTimeRange = () => {
                const duration = video.duration || 0;
                const startPos = Math.max(0, Math.min(100, (video.startTime / duration) * 100));
                const endPos = video.endTime ? Math.min(100, (video.endTime / duration) * 100) : 100;
                
                startHandle.style.left = `${startPos}%`;
                endHandle.style.left = `${endPos}%`;
                timeRange.style.left = `${startPos}%`;
                timeRange.style.width = `${endPos - startPos}%`;
                
                // 更新遮罩位置
                startMask.style.width = `${startPos}%`;
                endMask.style.width = `${100 - endPos}%`;
            };

            const handleDrag = (e) => {
                if (!isDragging || !activeHandle) return;
                
                const rect = progressBar.getBoundingClientRect();
                let pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const time = pos * video.duration;
                
                if (activeHandle === startHandle) {
                    // 起始時間不能超過結束時間
                    const maxTime = video.endTime || video.duration;
                    video.startTime = Math.min(time, maxTime - 1); // 至少保留1秒
                    if (video.currentTime < video.startTime) {
                        video.currentTime = video.startTime;
                    }
                } else {
                    // 結束時間不能小於起始時間
                    video.endTime = Math.max(time, video.startTime + 1); // 至少保留1秒
                }
                
                updateTimeRange();
            };

            // 監聽視頻時間更新
            video.addEventListener('timeupdate', () => {
                const current = video.currentTime;
                const total = video.duration;
                
                // 更新進度條
                progress.style.width = `${(current / total) * 100}%`;
                timeDisplay.textContent = `${formatTime(current)} / ${formatTime(total)}`;
                
                // 檢查是否到達結束間
                if (video.endTime && current >= video.endTime) {
                    if (video.loop) {
                        video.currentTime = video.startTime;
                    } else {
                        video.pause();
                    }
                }
            });

            // 添加拖動事件監聽
            startHandle.addEventListener('mousedown', (e) => {
                isDragging = true;
                activeHandle = startHandle;
                e.stopPropagation();
            });

            endHandle.addEventListener('mousedown', (e) => {
                isDragging = true;
                activeHandle = endHandle;
                e.stopPropagation();
            });

            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', () => {
                isDragging = false;
                activeHandle = null;
            });

            // 修改進度條擊行為
            progressBar.onclick = (e) => {
                if (e.target === progressBar) {
                    const rect = progressBar.getBoundingClientRect();
                    const pos = (e.clientX - rect.left) / rect.width;
                    const time = pos * video.duration;
                    
                    // 確保在設定的時間範圍內
                    if (time >= video.startTime && (!video.endTime || time <= video.endTime)) {
                        video.currentTime = time;
                    }
                }
            };
            
            const leftControls = document.createElement('div');
            leftControls.className = 'left-controls';
            
            const rightControls = document.createElement('div');
            rightControls.className = 'right-controls';
            
            const playBtn = document.createElement('button');
            playBtn.className = 'control-button play-pause';
            updatePlayButton(playBtn, true);
            
            video.addEventListener('play', () => {
                updatePlayButton(playBtn, true);
            });
            
            video.addEventListener('pause', () => {
                updatePlayButton(playBtn, false);
            });
            
            playBtn.onclick = (e) => {
                e.stopPropagation();
                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                }
            };
            
            const skipBackward = document.createElement('button');
            skipBackward.className = 'control-button skip-button';
            skipBackward.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
                </svg>
            `;
            skipBackward.onclick = (e) => {
                e.stopPropagation();
                video.currentTime = Math.max(0, video.currentTime - 10);
            };
            
            const skipForward = document.createElement('button');
            skipForward.className = 'control-button skip-button';
            skipForward.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M13 6v12l8.5-6L13 6zM4 18l8.5-6L4 6v12z"/>
                </svg>
            `;
            skipForward.onclick = (e) => {
                e.stopPropagation();
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
            };
            
            const timeDisplay = document.createElement('div');
            timeDisplay.className = 'time-display';
            
            video.addEventListener('timeupdate', () => {
                const current = formatTime(video.currentTime);
                const total = formatTime(video.duration);
                timeDisplay.textContent = `${current} / ${total}`;
                progress.style.width = `${(video.currentTime / video.duration) * 100}%`;
            });
            
            progressBar.onclick = (e) => {
                e.stopPropagation();
                const rect = progressBar.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                video.currentTime = pos * video.duration;
            };
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'control-button close-button';
            closeBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            `;
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                wrapper.remove();
                this.videos = this.videos.filter(v => v.wrapper !== wrapper);
                if (this.videos.length === 0) {
                    this.dropZone.style.display = 'flex';
                }
                
                // 如果卡片列表正在顯示，則更新它
                if (this.cardListVisible) {
                    this.showCardList();
                }
                                            // 更新 cards 窗口
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('update-cards', {
                videos: this.videos.map(v => ({
                    isImage: v.isImage,
                    video: {
                        src: v.video.src,
                        dataset: {
                            originalFileName: v.video.dataset.originalFileName
                        }
                    }
                }))
            });
            };
            
            const muteBtn = document.createElement('button');
            muteBtn.className = 'control-button mute-button';
            updateMuteButton(muteBtn, true);
            
            video.addEventListener('volumechange', () => {
                updateMuteButton(muteBtn, video.muted);
            });
            
            muteBtn.onclick = (e) => {
                e.stopPropagation();
                video.muted = !video.muted;
            };
            
            const loopBtn = document.createElement('button');
            loopBtn.className = 'control-button loop-button';
            loopBtn.title = '循環播放';
            loopBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                </svg>
            `;

            video.loop = true;
            updateLoopButton(loopBtn, true);

            loopBtn.onclick = (e) => {
                e.stopPropagation();
                video.loop = !video.loop;
                updateLoopButton(loopBtn, video.loop);
            };
            
            // 添加重置大小和旋轉的按鈕
            const resetSizeBtn = document.createElement('button');
            resetSizeBtn.className = 'control-button reset-size-button';
            resetSizeBtn.title = '重置大小和轉';
            resetSizeBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M9 3L5 7h3v7c0 1.1.9 2 2 2s2-.9 2-2V7h3L9 3zm8 11v-4h2V7h-6v3h2v4c0 3.31-2.69 6-6 6v2c4.42 0 8-3.58 8-8z"/>
                </svg>
            `;
            resetSizeBtn.onclick = (e) => {
                e.stopPropagation();
                const videoData = this.videos.find(v => v.wrapper === wrapper);
                if (videoData) {
                    videoData.scale = 1;
                    videoData.rotation = 0;
                    videoData.flipX = false;  // 重置水平翻轉
                    videoData.flipY = false;  // 重置垂直翻轉
                    this.updateVideoTransform(videoData);
                    // 使用原始視頻尺寸計算重大小
                    const scale = Math.min(1, maxInitialWidth / originalWidth);
                    wrapper.style.width = `${originalWidth * scale}px`;
                    wrapper.style.height = `${originalHeight * scale}px`;
                }
            };

            // 添加調整大小的按鈕
            const resizeBtn = document.createElement('button');
            resizeBtn.className = 'control-button resize-button';
            resizeBtn.title = '調整大小';
            resizeBtn.style.opacity = '0.8';
            resizeBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/>
                </svg>
            `;

            let resizeHandlesVisible = false;

            // 初始化時隱藏所有控制點
            const handles = [
                { classes: ['corner', 'top', 'left'] },
                { classes: ['corner', 'top', 'right'] },
                { classes: ['corner', 'bottom', 'left'] },
                { classes: ['corner', 'bottom', 'right'] },
                { classes: ['edge', 'horizontal', 'top'] },
                { classes: ['edge', 'horizontal', 'bottom'] },
                { classes: ['edge', 'vertical', 'left'] },
                { classes: ['edge', 'vertical', 'right'] }
            ];

            handles.forEach(handle => {
                const div = document.createElement('div');
                div.className = ['resize-handle', ...handle.classes].join(' ');
                div.style.opacity = '0';
                div.style.pointerEvents = 'none';
                wrapper.appendChild(div);
            });

            resizeBtn.onclick = (e) => {
                e.stopPropagation();
                resizeHandlesVisible = !resizeHandlesVisible;
                
                
                // 更新所有控制點的狀態
                wrapper.querySelectorAll('.resize-handle').forEach(handle => {
                    handle.style.opacity = resizeHandlesVisible ? '0.3' : '0';
                    handle.style.pointerEvents = resizeHandlesVisible ? 'auto' : 'none';
                });
                
                // 更新按鈕狀態
                resizeBtn.style.opacity = resizeHandlesVisible ? '1' : '0.8';
            };

            // 添加水平翻轉按鈕
            const flipXBtn = document.createElement('button');
            flipXBtn.className = 'control-button flip-x-button';
            flipXBtn.title = '水平翻轉';
            flipXBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M15,21H17V19H15M19,9H21V7H19M3,5H21V3H3M19,3V5H21V3M15,5H17V3H15M19,13H21V11H19M19,21H21V19H19M19,17H21V15H19M15,9H17V7H15M15,13H17V11H15M15,17H17V15H15M15,21V19H17V21M19,13V11H21V13M19,21V19H21V21M19,17V15H21V17M19,9V7H21V9M19,5V3H21V5H19Z"/>
                </svg>
            `;
            flipXBtn.onclick = (e) => {
                e.stopPropagation();
                const videoData = this.videos.find(v => v.wrapper === wrapper);
                if (videoData) {
                    videoData.flipX = !videoData.flipX;
                    this.updateVideoTransform(videoData);
                }
            };

            // 添加垂直翻轉按鈕
            const flipYBtn = document.createElement('button');
            flipYBtn.className = 'control-button flip-y-button';
            flipYBtn.title = '垂直翻轉';
            flipYBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M3,15H5V13H3M3,19H5V17H3M3,11H5V9H3M3,5H5V3H3M7,13H9V11H7M7,19H9V17H7M7,3H9V5H7M7,11H9V9H7M11,13H13V11H11M11,19H13V17H11M11,3H13V5H11M11,9H13V7H11M15,13H17V11H15M15,19H17V17H15M15,3H17V5H15M15,11H17V9H15M19,13H21V11H19M19,19H21V17H19M19,3H21V5H19M19,11H21V9H19Z"/>
                </svg>
            `;
            flipYBtn.onclick = (e) => {
                e.stopPropagation();
                const videoData = this.videos.find(v => v.wrapper === wrapper);
                if (videoData) {
                    videoData.flipY = !videoData.flipY;
                    this.updateVideoTransform(videoData);
                }
            };

            // 將按鈕添加到控制欄
            leftControls.appendChild(resetSizeBtn);
            leftControls.appendChild(flipXBtn);
            leftControls.appendChild(flipYBtn);
            leftControls.appendChild(resizeBtn);

            leftControls.appendChild(skipBackward);
            leftControls.appendChild(playBtn);
            leftControls.appendChild(skipForward);
            leftControls.appendChild(timeDisplay);
            leftControls.appendChild(muteBtn);
            leftControls.appendChild(loopBtn);
            
            rightControls.appendChild(closeBtn);
            
            const controlsRow = document.createElement('div');
            controlsRow.className = 'controls-row';
            
            controlsRow.appendChild(leftControls);
            controlsRow.appendChild(rightControls);
            controls.appendChild(progressBar);
            controls.appendChild(controlsRow);
            videoContainer.appendChild(controls);
            
            const offset = this.videos.length * 50;
            wrapper.style.left = offset + 'px';
            wrapper.style.top = offset + 'px';
            
            wrapper.addEventListener('mousedown', this.eventHandlers.handleMouseDown.bind(this.eventHandlers));
            wrapper.addEventListener('wheel', this.eventHandlers.handleWheel.bind(this.eventHandlers));
            
            document.body.appendChild(wrapper);
            this.videos.push({ wrapper, video, container: videoContainer, scale: 1, rotation: 0 });
            
            video.play().catch(() => {
                console.log('Auto-play prevented');
            });
            
            this.dropZone.style.display = 'none';
            
            // 如果卡片列表正在顯示，則更新它
            if (this.cardListVisible) {
                this.showCardList();
            }
                                        // 更新 cards 窗口
                                        const { ipcRenderer } = require('electron');
                                        ipcRenderer.send('update-cards', {
                                            videos: this.videos.map(v => ({
                                                isImage: v.isImage,
                                                video: {
                                                    src: v.video.src,
                                                    dataset: {
                                                        originalFileName: v.video.dataset.originalFileName
                                                    }
                                                }
                                            }))
                                        });
            
            // 添加縮放事件處理
            wrapper.addEventListener('mousedown', (e) => {
                const handle = e.target.closest('.resize-handle');
                if (handle) {
                    e.stopPropagation(); // 防止觸發拖動
                    
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startWidth = wrapper.offsetWidth;
                    const startHeight = wrapper.offsetHeight;
                    const isLeft = handle.classList.contains('left');
                    const isTop = handle.classList.contains('top');
                    const isCorner = handle.classList.contains('corner');
                    const startLeft = wrapper.offsetLeft;
                    const startTop = wrapper.offsetTop;
                    const aspectRatio = startWidth / startHeight;

                    const handleResize = (moveEvent) => {
                        let newWidth = startWidth;
                        let newHeight = startHeight;
                        let newLeft = startLeft;
                        let newTop = startTop;

                        if (isCorner) {
                            // 角落控制點 - 等比縮放
                            const deltaX = moveEvent.clientX - startX;
                            const deltaY = moveEvent.clientY - startY;
                            
                            // 使用較大的變化來決定縮放比例
                            const scaleFactor = Math.abs(deltaX) > Math.abs(deltaY) 
                                ? (startWidth + (isLeft ? -deltaX : deltaX)) / startWidth
                                : (startHeight + (isTop ? -deltaY : deltaY)) / startHeight;
                            
                            newWidth = startWidth * scaleFactor;
                            newHeight = startHeight * scaleFactor;

                            if (isLeft) {
                                newLeft = startLeft + (startWidth - newWidth);
                            }
                            if (isTop) {
                                newTop = startTop + (startHeight - newHeight);
                            }
                        } else {
                            // 邊緣控制點 - 自由縮放
                            if (handle.classList.contains('vertical')) {
                                // 垂直邊緣
                                const deltaX = moveEvent.clientX - startX;
                                newWidth = startWidth + (isLeft ? -deltaX : deltaX);
                                if (isLeft && newWidth > 200) {
                                    newLeft = startLeft + deltaX;
                                }
                            }
                            if (handle.classList.contains('horizontal')) {
                                // 水平邊緣
                                const deltaY = moveEvent.clientY - startY;
                                newHeight = startHeight + (isTop ? -deltaY : deltaY);
                                if (isTop && newHeight > 150) {
                                    newTop = startTop + deltaY;
                                }
                            }
                        }

                        // 應用最小尺寸限制
                        if (newWidth >= 200 && newHeight >= 150) {
                            wrapper.style.width = `${newWidth}px`;
                            wrapper.style.height = `${newHeight}px`;
                            wrapper.style.left = `${newLeft}px`;
                            wrapper.style.top = `${newTop}px`;
                        }
                    };

                    const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleResize);
                        document.removeEventListener('mouseup', handleMouseUp);
                    };

                    document.addEventListener('mousemove', handleResize);
                    document.addEventListener('mouseup', handleMouseUp);
                }
            });

            // 在 addVideo 函數中添加重置時間線按鈕
            const resetTimeRangeBtn = document.createElement('button');
            resetTimeRangeBtn.className = 'control-button reset-time-range-button';
            resetTimeRangeBtn.title = '重置時間範圍';
            resetTimeRangeBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                </svg>
            `;

            resetTimeRangeBtn.onclick = (e) => {
                e.stopPropagation();
                video.startTime = 0;
                video.endTime = undefined;
                updateTimeRange();
            };

            // 將按鈕添加到控制欄（在 muteBtn 之後）
            leftControls.appendChild(muteBtn);
            leftControls.appendChild(resetTimeRangeBtn);
            leftControls.appendChild(loopBtn);

            // 在现有的视频播放器初始化代码中添加以下支持
            const videoPlayer = document.querySelector('video');

            // 添加更多支持的视频格式
            videoPlayer.addEventListener('error', function(e) {
                console.log('Video Error:', videoPlayer.error);
                
                // 检查浏览器支持的编解码器
                const supportedCodecs = {
                    'video/mp4; codecs="avc1.42E01E"': 'H.264',
                    'video/mp4; codecs="avc1.64001F"': 'H.264 High Profile',
                    'video/webm; codecs="vp8"': 'VP8',
                    'video/webm; codecs="vp9"': 'VP9',
                    'video/mp4; codecs="av01"': 'AV1'
                };
                
                // 检查编解码器支持
                for (let codec in supportedCodecs) {
                    const isSupported = MediaSource.isTypeSupported(codec);
                    console.log(`${supportedCodecs[codec]}: ${isSupported ? '支持' : '不支持'}`);
                }
            });

            // 添加格式兼容性检查
            function checkVideoCompatibility(videoFile) {
                // 检查文件扩展名
                const extension = videoFile.name.split('.').pop().toLowerCase();
                const supportedFormats = ['mp4', 'webm', 'ogg', 'mov'];
                
                if (!supportedFormats.includes(extension)) {
                    console.warn('不支持的视频格式，建议转换为 MP4 或 WebM 格式');
                }
                
                // 如果是不支持的格式，可以提示用户
                if (!videoPlayer.canPlayType(`video/${extension}`)) {
                    console.warn(`浏览器可能不支持 ${extension} 格式`);
                }
            }

            // 在創建 video 元素後添加錯誤處理
            video.addEventListener('error', (e) => {
                let errorMessage = '視頻格式不支持';
                
                switch (video.error.code) {
                    case 1:
                        errorMessage = '視頻加載被中止';
                        break;
                    case 2:
                        errorMessage = '網絡錯誤';
                        break;
                    case 3:
                        errorMessage = '視頻解碼失敗（格式可能不支持）';
                        break;
                    case 4:
                        errorMessage = '視頻格式不支持或已損壞';
                        break;
                }
                
                const warningDiv = document.getElementById('formatWarning');
                warningDiv.querySelector('strong').textContent = `${errorMessage}`;
                warningDiv.style.display = 'block';
                
                // 5秒後自動隱藏警告
                setTimeout(() => {
                    warningDiv.style.display = 'none';
                }, 10000);
                
                // 檢查編解碼器支持
                const supportedCodecs = {
                    'video/mp4; codecs="avc1.42E01E"': 'H.264',
                    'video/mp4; codecs="avc1.64001F"': 'H.264 High Profile',
                    'video/webm; codecs="vp8"': 'VP8',
                    'video/webm; codecs="vp9"': 'VP9',
                    'video/mp4; codecs="av01"': 'AV1'
                };
                
                // 記錄支持的編解碼器
                for (let codec in supportedCodecs) {
                    const isSupported = MediaSource.isTypeSupported(codec);
                    console.log(`${supportedCodecs[codec]}: ${isSupported ? '支持' : '不支持'}`);
                }
            });

            // 添加載��中提示
            video.addEventListener('loadstart', () => {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'video-loading';
                loadingDiv.textContent = '載入中...';
                videoContainer.appendChild(loadingDiv);
            });

            // 移除載入提示
            video.addEventListener('canplay', () => {
                const loadingDiv = videoContainer.querySelector('.video-loading');
                if (loadingDiv) {
                    loadingDiv.remove();
                }
                            // 更新 cards 窗口
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('update-cards', {
                videos: this.videos.map(v => ({
                    isImage: v.isImage,
                    video: {
                        src: v.video.src,
                        dataset: {
                            originalFileName: v.video.dataset.originalFileName
                        }
                    }
                }))
            });
                    
            });
        };
    }
    
    addImage(source, originalFileName) {
        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';
        
        // 創建一個臨時圖片元素來獲取原始尺寸
        const tempImg = new Image();
        tempImg.src = source;
        
        tempImg.onload = () => {
            const originalWidth = tempImg.width;
            const originalHeight = tempImg.height;
            
            // 設置初始尺寸，保持原始比例
            const maxInitialWidth = 520;  // 最大初始寬度
            const scale = Math.min(1, maxInitialWidth / originalWidth);
            wrapper.style.width = `${originalWidth * scale}px`;
            wrapper.style.height = `${originalHeight * scale}px`;
            
            const imageContainer = document.createElement('div');
            imageContainer.className = 'video-container';
            
            const img = document.createElement('img');
            img.src = source;
            
            // 檢查是否已經有相同文件名的圖片
            const baseName = originalFileName || source.split('\\').pop().split('/').pop();
            let finalFileName = baseName;
            let counter = 1;
            
            while (this.videos.some(v => v.video.dataset.originalFileName === finalFileName)) {
                const nameWithoutNumber = baseName.replace(/-\d+$/, '');  // 移除已有的編號
                const ext = nameWithoutNumber.match(/\.[^.]*$/)?.[0] || '';  // 獲取副檔名
                const nameWithoutExt = nameWithoutNumber.replace(/\.[^.]*$/, '');  // 移除副檔名
                finalFileName = `${nameWithoutExt}-${counter}${ext}`;
                counter++;
            }
            
            img.dataset.originalFileName = finalFileName;
            
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: fill;
                pointer-events: none;
            `;
            
            imageContainer.appendChild(img);
            wrapper.appendChild(imageContainer);
            
            // 創建控制容器，與視頻控制項使用相同的樣式
            const controls = document.createElement('div');
            controls.className = 'video-controls';

            const controlsRow = document.createElement('div');
            controlsRow.className = 'controls-row';

            const leftControls = document.createElement('div');
            leftControls.className = 'left-controls';

            // 添加重置按鈕
            const resetBtn = document.createElement('button');
            resetBtn.className = 'control-button reset-size-button';
            resetBtn.title = '重置大小和旋';
            resetBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M9 3L5 7h3v7c0 1.1.9 2 2 2s2-.9 2-2V7h3L9 3zm8 11v-4h2V7h-6v3h2v4c0 3.31-2.69 6-6 6v2c4.42 0 8-3.58 8-8z"/>
                </svg>
            `;
            resetBtn.onclick = (e) => {
                e.stopPropagation();
                const videoData = this.videos.find(v => v.wrapper === wrapper);
                if (videoData) {
                    videoData.scale = 1;
                    videoData.rotation = 0;
                    videoData.flipX = false;  // 重置水平翻轉
                    videoData.flipY = false;  // 重置垂直翻轉
                    this.updateVideoTransform(videoData);
                    wrapper.style.width = `${originalWidth * scale}px`;
                    wrapper.style.height = `${originalHeight * scale}px`;
                }
            };

               // 添加水平翻轉按鈕
               const flipXBtn = document.createElement('button');
               flipXBtn.className = 'control-button flip-x-button';
               flipXBtn.title = '水平翻轉';
               flipXBtn.innerHTML = `
                   <svg width="20" height="20" viewBox="0 0 24 24">
                       <path fill="currentColor" d="M15,21H17V19H15M19,9H21V7H19M3,5H21V3H3M19,3V5H21V3M15,5H17V3H15M19,13H21V11H19M19,21H21V19H19M19,17H21V15H19M15,9H17V7H15M15,13H17V11H15M15,17H17V15H15M15,21V19H17V21M19,13V11H21V13M19,21V19H21V21M19,17V15H21V17M19,9V7H21V9M19,5V3H21V5H19Z"/>
                   </svg>
               `;
               flipXBtn.onclick = (e) => {
                   e.stopPropagation();
                   const videoData = this.videos.find(v => v.wrapper === wrapper);
                   if (videoData) {
                       videoData.flipX = !videoData.flipX;
                       this.updateVideoTransform(videoData);
                   }
               };

               // 添加垂直翻轉按鈕
               const flipYBtn = document.createElement('button');
               flipYBtn.className = 'control-button flip-y-button';
               flipYBtn.title = '垂直翻轉';
               flipYBtn.innerHTML = `
                   <svg width="20" height="20" viewBox="0 0 24 24">
                       <path fill="currentColor" d="M3,15H5V13H3M3,19H5V17H3M3,11H5V9H3M3,5H5V3H3M7,13H9V11H7M7,19H9V17H7M7,3H9V5H7M7,11H9V9H7M11,13H13V11H11M11,19H13V17H11M11,3H13V5H11M11,9H13V7H11M15,13H17V11H15M15,19H17V17H15M15,3H17V5H15M15,11H17V9H15M19,13H21V11H19M19,19H21V17H19M19,3H21V5H19M19,11H21V9H19Z"/>
                   </svg>
               `;
               flipYBtn.onclick = (e) => {
                   e.stopPropagation();
                   const videoData = this.videos.find(v => v.wrapper === wrapper);
                   if (videoData) {
                       videoData.flipY = !videoData.flipY;
                       this.updateVideoTransform(videoData);
                   }
               };

            const rightControls = document.createElement('div');
            rightControls.className = 'right-controls';

            // 修改關閉按鈕樣式
            const closeBtn = document.createElement('button');
            closeBtn.className = 'control-button close-button';
            closeBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            `;
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                wrapper.remove();
                this.videos = this.videos.filter(v => v.wrapper !== wrapper);
                if (this.videos.length === 0) {
                    this.dropZone.style.display = 'flex';
                }
                
                // 如果卡片列表正在顯示，則更新它
                if (this.cardListVisible) {
                    this.showCardList();
                }
                                            // 更新 cards 窗口
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('update-cards', {
                videos: this.videos.map(v => ({
                    isImage: v.isImage,
                    video: {
                        src: v.video.src,
                        dataset: {
                            originalFileName: v.video.dataset.originalFileName
                        }
                    }
                }))
            });
            };

                        // 添加調整大小的按鈕
                        const resizeBtn = document.createElement('button');
                        resizeBtn.className = 'control-button resize-button';
                        resizeBtn.title = '調整大小';
                        resizeBtn.style.opacity = '0.8';
                        resizeBtn.innerHTML = `
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/>
                            </svg>
                        `;
            
                        let resizeHandlesVisible = false;
            
                        // 初始化時隱藏所有控制點
                        const handles = [
                            { classes: ['corner', 'top', 'left'] },
                            { classes: ['corner', 'top', 'right'] },
                            { classes: ['corner', 'bottom', 'left'] },
                            { classes: ['corner', 'bottom', 'right'] },
                            { classes: ['edge', 'horizontal', 'top'] },
                            { classes: ['edge', 'horizontal', 'bottom'] },
                            { classes: ['edge', 'vertical', 'left'] },
                            { classes: ['edge', 'vertical', 'right'] }
                        ];
            
                        handles.forEach(handle => {
                            const div = document.createElement('div');
                            div.className = ['resize-handle', ...handle.classes].join(' ');
                            div.style.opacity = '0';
                            div.style.pointerEvents = 'none';
                            wrapper.appendChild(div);
                        });
            
                        resizeBtn.onclick = (e) => {
                            e.stopPropagation();
                            resizeHandlesVisible = !resizeHandlesVisible;
                            
                            // 更新所有控制點的狀態
                            wrapper.querySelectorAll('.resize-handle').forEach(handle => {
                                handle.style.opacity = resizeHandlesVisible ? '0.3' : '0';
                                handle.style.pointerEvents = resizeHandlesVisible ? 'auto' : 'none';
                            });
                            
                            // 更新按鈕狀態
                            resizeBtn.style.opacity = resizeHandlesVisible ? '1' : '0.8';
                        };

            leftControls.appendChild(resetBtn);
            leftControls.appendChild(flipXBtn);
            leftControls.appendChild(flipYBtn);
            leftControls.appendChild(resizeBtn);
            rightControls.appendChild(closeBtn);
            controlsRow.appendChild(leftControls);
            controlsRow.appendChild(rightControls);
            controls.appendChild(controlsRow);
            imageContainer.appendChild(controls);
            
            const offset = this.videos.length * 50;
            wrapper.style.left = offset + 'px';
            wrapper.style.top = offset + 'px';
            
            wrapper.addEventListener('mousedown', this.eventHandlers.handleMouseDown.bind(this.eventHandlers));
            wrapper.addEventListener('wheel', this.eventHandlers.handleWheel.bind(this.eventHandlers));
            
            document.body.appendChild(wrapper);
            
            const imageData = { 
                wrapper, 
                video: img,
                container: imageContainer, 
                scale: 1, 
                rotation: 0,
                isImage: true
            };
            
            this.videos.push(imageData);
            this.dropZone.style.display = 'none';
            
            // 如果卡片列表正在顯示，則更新它
            if (this.cardListVisible) {
                this.showCardList();
            }

            // 更新 cards 窗口
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('update-cards', {
                videos: this.videos.map(v => ({
                    isImage: v.isImage,
                    video: {
                        src: v.video.src,
                        dataset: {
                            originalFileName: v.video.dataset.originalFileName
                        }
                    }
                }))
            });

            // 添加縮放事件處理
            wrapper.addEventListener('mousedown', (e) => {
                const handle = e.target.closest('.resize-handle');
                if (handle) {
                    e.stopPropagation(); // 防止觸發拖動
                    
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startWidth = wrapper.offsetWidth;
                    const startHeight = wrapper.offsetHeight;
                    const isLeft = handle.classList.contains('left');
                    const isTop = handle.classList.contains('top');
                    const isCorner = handle.classList.contains('corner');
                    const startLeft = wrapper.offsetLeft;
                    const startTop = wrapper.offsetTop;
                    const aspectRatio = startWidth / startHeight;

                    const handleResize = (moveEvent) => {
                        let newWidth = startWidth;
                        let newHeight = startHeight;
                        let newLeft = startLeft;
                        let newTop = startTop;

                        if (isCorner) {
                            // 角落控制點 - 等比縮放
                            const deltaX = moveEvent.clientX - startX;
                            const deltaY = moveEvent.clientY - startY;
                            
                            // 使用較大的變化來決定縮放比例
                            const scaleFactor = Math.abs(deltaX) > Math.abs(deltaY) 
                                ? (startWidth + (isLeft ? -deltaX : deltaX)) / startWidth
                                : (startHeight + (isTop ? -deltaY : deltaY)) / startHeight;
                            
                            newWidth = startWidth * scaleFactor;
                            newHeight = startHeight * scaleFactor;

                            if (isLeft) {
                                newLeft = startLeft + (startWidth - newWidth);
                            }
                            if (isTop) {
                                newTop = startTop + (startHeight - newHeight);
                            }
                        } else {
                            // 邊緣控制點 - 自由縮放
                            if (handle.classList.contains('vertical')) {
                                // 垂直邊緣
                                const deltaX = moveEvent.clientX - startX;
                                newWidth = startWidth + (isLeft ? -deltaX : deltaX);
                                if (isLeft && newWidth > 200) {
                                    newLeft = startLeft + deltaX;
                                }
                            }
                            if (handle.classList.contains('horizontal')) {
                                // 水平邊緣
                                const deltaY = moveEvent.clientY - startY;
                                newHeight = startHeight + (isTop ? -deltaY : deltaY);
                                if (isTop && newHeight > 150) {
                                    newTop = startTop + deltaY;
                                }
                            }
                        }

                        // 應用最小尺寸限制
                        if (newWidth >= 200 && newHeight >= 150) {
                            wrapper.style.width = `${newWidth}px`;
                            wrapper.style.height = `${newHeight}px`;
                            wrapper.style.left = `${newLeft}px`;
                            wrapper.style.top = `${newTop}px`;
                        }
                    };

                    const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleResize);
                        document.removeEventListener('mouseup', handleMouseUp);
                    };

                    document.addEventListener('mousemove', handleResize);
                    document.addEventListener('mouseup', handleMouseUp);
                }
                            // 更新 cards 窗口
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('update-cards', {
                videos: this.videos.map(v => ({
                    isImage: v.isImage,
                    video: {
                        src: v.video.src,
                        dataset: {
                            originalFileName: v.video.dataset.originalFileName
                        }
                    }
                }))
            });
            });
        };
    }
    
   handleMouseUp() {
       this.dragTarget = null;
       this.rotateMode = false;
   }
   
   handleWheel(e) {
       e.preventDefault();
       const wrapper = e.target.closest('.video-wrapper');
       if (wrapper) {
           const videoData = this.videos.find(v => v.wrapper === wrapper);
           if (videoData) {
               const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;
               videoData.scale *= scaleChange;
               this.updateVideoTransform(videoData);
           }
       }
   }
   
   handleKeyDown(e) {
       if (e.code === 'Space') {
           e.preventDefault();
           this.togglePlayAll();
       } else if (e.code === 'Backspace') {
           e.preventDefault();
           this.resetAllVideos();
       } else if (e.key === 'Delete') {
           const activeVideo = document.querySelector('.video-wrapper:hover');
           if (activeVideo) {
               activeVideo.remove();
               this.videos = this.videos.filter(v => v.wrapper !== activeVideo);
           }
                        // 更新 cards 窗口
                        const { ipcRenderer } = require('electron');
                        ipcRenderer.send('update-cards', {
                            videos: this.videos.map(v => ({
                                isImage: v.isImage,
                                video: {
                                    src: v.video.src,
                                    dataset: {
                                        originalFileName: v.video.dataset.originalFileName
                                    }
                                }
                            }))
                        });
           
       } else if (e.key >= '0' && e.key <= '9') {
           e.preventDefault();
           const speed = e.key === '0' ? 10 : parseInt(e.key);
           this.setPlaybackSpeed(speed);
       }else if (e.key === '-') { // 處理 '-' 鍵
               e.preventDefault();
               this.setPlaybackSpeed(0.25);
           } else if (e.key === '=') { // 處理 '=' 鍵
               e.preventDefault();
               this.setPlaybackSpeed(0.5);
       }else if (e.key.toLowerCase() === 'i') {
           e.preventDefault();
           this.adjustPlaybackSpeed(-0.1);
       } else if (e.key.toLowerCase() === 'o') {
           e.preventDefault();
           this.adjustPlaybackSpeed(0.1);
       } else if (e.key.toLowerCase() === 'p') {
           e.preventDefault();
           this.setPlaybackSpeed(1); // 恢復默認速度 
       } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
           e.preventDefault();
           const timeChange = e.key === 'ArrowLeft' ? -5 : 5;
           this.seekAllVideos(timeChange);
       } else if (e.key.toLowerCase() === 'm') {
           e.preventDefault();
           this.toggleMuteAll();
       } else if (e.key.toLowerCase() === 'w') {
           e.preventDefault();
           this.adjustBlur(-1);
       } else if (e.key.toLowerCase() === 'e') {
           e.preventDefault();
           this.adjustBlur(1);
       } else if (e.key.toLowerCase() === 'q') {
           e.preventDefault();
           this.resetBlur();
       } else if (e.key.toLowerCase() === 'g') {
           e.preventDefault();
           this.toggleCardList();
       } else if (e.key.toLowerCase() === 'k') {
           e.preventDefault();
           this.toggleKeyInfo();
       } else if (e.key.toLowerCase() === 'l') {
           e.preventDefault();
           const activeVideo = document.querySelector('.video-wrapper:hover');
           if (activeVideo) {
               const video = activeVideo.querySelector('video');
               const loopBtn = activeVideo.querySelector('.loop-button');
               if (video && loopBtn) {
                   video.loop = !video.loop;
                   updateLoopButton(loopBtn, video.loop);
               }
           }
       } else if (e.key.toLowerCase() === 'b') {
           e.preventDefault();
           this.showBackgroundColorPicker();
       } else if (e.key === 'Tab') {
           e.preventDefault();
           this.toggleStats();
       } else if (e.key === 'n' || e.key === 'N') {
           e.preventDefault();
           const { ipcRenderer } = require('electron');
           ipcRenderer.send('open-settings');
       } else if (e.key.toLowerCase() === 'h') {
           e.preventDefault();
           const { ipcRenderer } = require('electron');
           // 發送所有視頻數據到新窗口
           ipcRenderer.send('create-cards-window', {
               videos: this.videos.map(v => ({
                   isImage: v.isImage,
                   video: {
                       src: v.video.src,
                       dataset: {
                           originalFileName: v.video.dataset.originalFileName
                       },
                       filterValues: v.video.filterValues // 添加這行
                   }
               }))
           });
       }
   }
    
    adjustPlaybackSpeed(change) {
        this.videos.forEach(({ video }) => {
            const newSpeed = Math.max(0.1, video.playbackRate + change); // 確保最低速度為 0.1
            video.playbackRate = newSpeed;
        });
    
        // 創建並顯示播放速度指示器
        const speedIndicator = document.createElement('div');
        speedIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            z-index: 9999;
            transition: opacity 0.3s;
        `;
        
        // 假設所有 `video` 的播放速度同步，顯示第一的速度即可
        const displaySpeed = this.videos[0]?.video.playbackRate.toFixed(1) || "0.1";
        speedIndicator.textContent = `播放速度: ${displaySpeed}x`;
        document.body.appendChild(speedIndicator);
        
        setTimeout(() => {
            speedIndicator.style.opacity = '0';
            setTimeout(() => speedIndicator.remove(), 300);
        }, 2000);
    }
    
    
    setPlaybackSpeed(speed) {
        this.videos.forEach(({ video }) => {
            video.playbackRate = speed;
        });

        
         const speedIndicator = document.createElement('div');
        speedIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            z-index: 9999;
            transition: opacity 0.3s;
        `;
        speedIndicator.textContent = `播放速度: ${speed}x`;
        document.body.appendChild(speedIndicator);
        
        setTimeout(() => {
            speedIndicator.style.opacity = '0';
            setTimeout(() => speedIndicator.remove(), 300);
        }, 2000);
    }
    
    updateVideoTransform(videoData) {
        const scaleX = videoData.flipX ? -1 : 1;
        const scaleY = videoData.flipY ? -1 : 1;
        
        // 只對視頻/圖片元素應用翻轉
        videoData.video.style.transform = `scale(${scaleX}, ${scaleY})`;
        
        // 容器只應用縮放和旋轉
        videoData.container.style.transform = 
            `scale(${videoData.scale}) rotate(${videoData.rotation}deg)`;
        
        const controls = videoData.container.querySelector('.video-controls');
        if (controls) {
            controls.style.transform = `translate(-50%, 0) scale(${1/videoData.scale})`;
            const bottomPadding = Math.max(20, 20 * (1/videoData.scale));
            controls.style.bottom = `${bottomPadding}px`;
            const minWidth = Math.max(20, 20 * (1/videoData.scale));
            controls.style.minWidth = `${minWidth}px`;
        }
    }
    
    togglePlayAll() {
        const anyPlaying = this.videos.some(({ video }) => !video.paused);
        
        this.videos.forEach(({ video }) => {
            if (anyPlaying) {
                video.pause();
            } else {
                video.play().catch(() => {
                    console.log('Auto-play prevented');
                });
            }
        });
    }
    
    resetAllVideos() {
        this.videos.forEach(({ video }) => {
            video.currentTime = 0;
        });
    }
    
    seekAllVideos(seconds) {
        this.videos.forEach(({ video }) => {
            video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
        });
    }
    
    toggleMuteAll() {
        const anyUnmuted = this.videos.some(({ video }) => !video.muted);
        
        this.videos.forEach(({ video }) => {
            video.muted = anyUnmuted;
        });
        
        const muteIndicator = document.createElement('div');
        muteIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            z-index: 9999;
            transition: opacity 0.3s;
        `;
        muteIndicator.textContent = anyUnmuted ? '靜音' : '取消靜音';
        document.body.appendChild(muteIndicator);
        
        setTimeout(() => {
            muteIndicator.style.opacity = '0';
            setTimeout(() => muteIndicator.remove(), 300);
        }, 2000);
    }
    
    adjustBlur(amount) {
        this.blurAmount = Math.max(0, this.blurAmount + amount);
        this.updateBlur();
        this.showBlurIndicator();
    }
    
    resetBlur() {
        this.blurAmount = 0;
        this.updateBlur();
        this.showBlurIndicator();
    }
    
    updateBlur() {
        document.body.style.filter = this.blurAmount > 0 ? `blur(${this.blurAmount}px)` : 'none';
    }
    
    showBlurIndicator() {
        const blurIndicator = document.createElement('div');
        blurIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            z-index: 9999;
            transition: opacity 0.3s;
        `;
        blurIndicator.textContent = this.blurAmount > 0 ? `模糊程度: ${this.blurAmount}px` : '清晰';
        document.body.appendChild(blurIndicator);
        
        setTimeout(() => {
            blurIndicator.style.opacity = '0';
            setTimeout(() => blurIndicator.remove(), 300);
        }, 2000);
    }
    
    toggleCardList() {
        if (!this.cardListVisible) {
            this.showCardList();
        } else {
            this.hideCardList();
        }
        this.cardListVisible = !this.cardListVisible;
    }
    
    showCardList() {
        // 先移除已存在的卡片列表
        const existingCardList = document.getElementById('videoCardList');
        if (existingCardList) {
            existingCardList.remove();
        }

        const cardList = document.createElement('div');
        cardList.id = 'videoCardList';
        cardList.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 0;
            right: 0;
            height: 150px;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            gap: 10px;
            padding: 10px;
            overflow-x: auto;
            z-index: 999999999;
            transition: transform 0.3s;
        `;

        // 添加滾輪事件處理
        cardList.addEventListener('wheel', (e) => {
            e.preventDefault(); // 阻止默認的垂直滾動
            cardList.scrollLeft += e.deltaY; // 將垂直滾動轉換為水平滾動
        });

        // 檢查是否有視頻或圖片
        if (this.videos.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.style.cssText = `
                color: white;
                width: 100%;
                text-align: center;
                padding: 20px;
            `;
            emptyMessage.textContent = '沒有視頻或圖片';
            cardList.appendChild(emptyMessage);
        } else {
            // 為每個視頻和圖片創建卡片
            this.videos.forEach((videoData, index) => {
                const card = this.createVideoCard(videoData, videoData.wrapper, index);
                cardList.appendChild(card);
            });
        }

        document.body.appendChild(cardList);
        

        // 添加調試信息
        console.log('Videos array:', this.videos);
        console.log('Card list created with', this.videos.length, 'items');
    }
    
    createVideoCard(videoData, wrapper, index) {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.style.cssText = `
            flex: 0 0 200px;
            height: 130px;
            background: #222;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            position: relative;
            transition: transform 0.2s;
        `;

        // 創建縮略圖元素
        const thumbnail = document.createElement(videoData.isImage ? 'img' : 'video');
        
        // 設置縮略圖源
        if (videoData.isImage) {
            thumbnail.src = videoData.video.src;
        } else {
            thumbnail.src = videoData.video.currentSrc;
            thumbnail.muted = true;
        }

        thumbnail.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
        `;

        card.appendChild(thumbnail);

        // 添加標題
        const title = document.createElement('div');
        title.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 8px;
            background: linear-gradient(transparent, rgba(0,0,0,0.8));
            color: white;
            font-size: 12px;
        `;
        title.textContent = videoData.isImage ? `圖片 ${index + 1}` : `視頻 ${index + 1}`;
        card.appendChild(title);

        // 添加點擊事件
        card.onclick = () => {
            if (this.showAdjustmentMenu) {
                this.showAdjustmentMenu(card, videoData);
            }
        };

        return card;
    }
    
    showAdjustmentMenu(card, videoData) {
        const { updateVideoFilter, setupFilterIPC } = require('./filter_utils.js');
        setupFilterIPC(videoData);
    }

    hideCardList() {
        const cardList = document.getElementById('videoCardList');
        if (cardList) {
            cardList.style.transform = 'translateY(100%)';
            setTimeout(() => cardList.remove(), 300);
        }
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
            { key: 'H', desc: '開啟卡片列表' },
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
        colorInput.value = this.backgroundColor || '#000000';
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
            this.backgroundColor = '#000000';
            colorInput.value = '#000000';
            document.body.style.backgroundColor = '#000000';
            // 保存到 localStorage
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
            this.backgroundColor = colorInput.value;
            document.body.style.backgroundColor = this.backgroundColor;
            // 保存到 localStorage
            localStorage.setItem('backgroundColor', this.backgroundColor);
        };

        buttonsContainer.appendChild(resetButton);
        buttonsContainer.appendChild(closeButton);

        picker.appendChild(title);
        picker.appendChild(colorInput);
        picker.appendChild(buttonsContainer);
        document.body.appendChild(picker);

        // 點擊外部關閉
        const closeOnOutsideClick = (e) => {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('mousedown', closeOnOutsideClick);
            }
        };
        document.addEventListener('mousedown', closeOnOutsideClick);
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
        text-align: left; /* 如果有多行內容 */
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
                    // 清理 GPU 信息字符串
                    gpuInfo = renderer
                        .replace(/ANGLE \((.*?)\)/, '$1')  // 移除 ANGLE
                        .replace(/Google Inc\. \((.*?)\)/, '$1')  // 移除 Google Inc.
                        .replace(/\s+/g, ' ')  // 清理多餘空格
                        .trim();  // 清理首尾空格
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
                const videoCount = this.videos.filter(v => !v.isImage).length;
                const imageCount = this.videos.filter(v => v.isImage).length;
                const playingVideos = this.videos.filter(v => !v.isImage && !v.video.paused).length;

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

    // 保存布局
    async saveLayout() {
        const layout = {
            videos: this.videos.map(({ video, wrapper, scale, rotation, flipX, flipY }) => ({
                filename: video.dataset.originalFileName,
                position: {
                    left: wrapper.style.left,
                    top: wrapper.style.top,
                    width: wrapper.style.width,
                    height: wrapper.style.height,
                    zIndex: wrapper.style.zIndex
                },
                transform: {
                    scale,
                    rotation,
                    flipX,
                    flipY
                },
                filterValues: video.filterValues || {}
            }))
        };

        try {
            // 使用 Electron 的對話框
            const { dialog } = require('@electron/remote');
            const { filePath } = await dialog.showSaveDialog({
                title: '保存布局',
                defaultPath: 'layout.json',
                filters: [
                    { name: '布局文件', extensions: ['json'] }
                ]
            });

            if (filePath) {
                const fs = require('fs');
                fs.writeFileSync(filePath, JSON.stringify(layout, null, 2));
                this.showNotification('布局已保存');
            }
        } catch (error) {
            console.error('保存布局失敗:', error);
            this.showNotification('保存布局失敗', 'error');
        }
    }

    // 加載布局
    async loadLayout() {
        try {
            const { dialog } = require('@electron/remote');
            const { filePaths } = await dialog.showOpenDialog({
                title: '加載布局',
                filters: [
                    { name: '布局文件', extensions: ['json'] }
                ],
                properties: ['openFile']
            });

            if (filePaths && filePaths[0]) {
                const fs = require('fs');
                const layout = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
                
                layout.videos.forEach(videoLayout => {
                    // 使用原始文件名查找視頻
                    const existingVideo = this.videos.find(v => 
                        v.video.dataset.originalFileName === videoLayout.filename
                    );

                    if (existingVideo) {
                        // 恢復位置和大小
                        Object.assign(existingVideo.wrapper.style, videoLayout.position);
                        
                        // 恢復變換
                        existingVideo.scale = videoLayout.transform.scale;
                        existingVideo.rotation = videoLayout.transform.rotation;
                        existingVideo.flipX = videoLayout.transform.flipX;  // 重置水平翻轉
                        existingVideo.flipY = videoLayout.transform.flipY;  // 重置垂直翻轉
                        this.updateVideoTransform(existingVideo);

                        // 恢復濾鏡效果
                        if (videoLayout.filterValues) {
                            // 確保目標元素是正確的
                            const targetElement = existingVideo.isImage ? existingVideo.video : existingVideo.video;
                            // 初始化 filterValues 如果不存在
                            if (!targetElement.filterValues) {
                                targetElement.filterValues = {
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
                                    exposure: 100
                                };
                            }
                            // 更新濾鏡值
                            Object.assign(targetElement.filterValues, videoLayout.filterValues);
                            // 應用濾鏡效果
                            const { updateVideoFilter } = require('./filter_utils.js');
                            updateVideoFilter(targetElement);
                            // 更新卡片列表
                            const { ipcRenderer } = require('electron');
                            ipcRenderer.send('update-cards', {
                                videos: this.videos.map(v => ({
                                    isImage: v.isImage,
                                    video: {
                                        src: v.video.src,
                                        dataset: { originalFileName: v.video.dataset.originalFileName },
                                        filterValues: v.video.filterValues // 添加 filterValues
                                    }
                                }))
                            });
                        }
                    }
                });

                this.showNotification('布局已加載');
            }
        } catch (error) {
            console.error('加載布局失敗:', error);
            this.showNotification('加載布局失敗', 'error');
        }
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

    // 顯示通知
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            border-radius: 4px;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 999999;
            transition: opacity 0.3s;
            background: ${type === 'success' ? 'rgba(40, 167, 69, 0.9)' : 'rgba(220, 53, 69, 0.9)'};
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // 添加新方法
    initBackgroundColor() {
        // 嘗試從 localStorage 獲取保存的背景顏色
        const savedColor = localStorage.getItem('backgroundColor');
        if (savedColor) {
            this.backgroundColor = savedColor;
        }
        // 應用背景顏色
        document.body.style.backgroundColor = this.backgroundColor;
    }

    resizeMedia(videoData) {
        console.log('Resizing media:', videoData);
    
        // 初始化狀態容器
        if (!this.resizeHandlesVisible) {
            this.resizeHandlesVisible = {};
        }
    
        // 獲取或初始化此視頻的控制點可見狀態
        const fileName = videoData.video.dataset.originalFileName;
        if (!fileName) {
            console.error('videoData.video.dataset.originalFileName is missing!');
            return;
        }
    
        if (this.resizeHandlesVisible[fileName] === undefined) {
            this.resizeHandlesVisible[fileName] = false;
        }
    
        // 切換可見狀態
        this.resizeHandlesVisible[fileName] = !this.resizeHandlesVisible[fileName];
        const isVisible = this.resizeHandlesVisible[fileName];
    
        // 更新所有控制點的狀態
        const handles = videoData.wrapper.querySelectorAll('.resize-handle');
        if (handles.length === 0) {
            console.error('No resize handles found in the wrapper!');
            return;
        }
    
        handles.forEach(handle => {
            handle.style.opacity = isVisible ? '0.3' : '0';
            handle.style.pointerEvents = isVisible ? 'auto' : 'none';
        });
    
        // 更新按鈕狀態
        const resizeBtn = videoData.wrapper.querySelector('.video-control .resize-button');
        if (resizeBtn) {
            resizeBtn.style.opacity = isVisible ? '1' : '0.8';
        }
    }
    
}

const videoManager = new VideoManager();

function updatePlayButton(button, isPlaying) {
    button.innerHTML = isPlaying ? `
        <svg width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
    ` : `
        <svg width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M8 5v14l11-7z"/>
        </svg>
    `;
}

function updateMuteButton(button, isMuted) {
    button.innerHTML = isMuted ? `
        <svg width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63a.996.996 0 00-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12c0-1.77-1.02-3.29-2.5-4.03v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
        </svg>
    ` : `
        <svg width="24" height="24" viewBox="0 0 24 24">
            <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
    `;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateLoopButton(button, isLooping) {
    button.style.opacity = isLooping ? '1' : '0.5';
    button.title = isLooping ? '關閉循環播放' : '開啟循環播放';
}

// 添加聚焦媒體的處理
ipcRenderer.on('focus-media', (event, index) => {
    const videoData = this.videos[index];
    if (videoData) {
        // 將視頻/圖片置於頂層
        videoData.wrapper.style.zIndex = this.getTopZIndex() + 1;
        // 可以添加高亮效果
        videoData.wrapper.style.outline = '2px solid #0af';
        setTimeout(() => {
            videoData.wrapper.style.outline = 'none';
        }, 1000);
    }
});


