const EventHandlers = require('./script/manager/event_handlers.js');
const LayoutManager = require('./script/manager/layout_manager.js');
const UIManager = require('./script/manager/ui_manager.js');
const UtilsManager = require('./script/manager/utils_manager.js');
const VideoManager = require('./video_manager.js');
const ImageManager = require('./image_manager.js');
const PlaybackManager = require('./script/manager/playback_manager.js');
const TransformManager = require('./script/manager/transform_manager.js');
const EffectManager = require('./script/manager/effect_manager.js');
const CardListManager = require('./cardlist_manager.js');

class MainManager {
    constructor() {
        this.videos = [];
        this.dropZone = document.getElementById('dropZone');
        this.blurAmount = 0;
        this.activeCard = null;
        this.keyInfoVisible = false;
        this.backgroundColor = '#000000';
        this.resizeHandlesVisible = {}; // 用於跟踪每個視頻的調整大小控制點狀態
        
        // 初始化事件處理器
        this.eventHandlers = new EventHandlers(this);
        this.layoutManager = new LayoutManager(this);
        this.uiManager = new UIManager(this);
        this.utilsManager = new UtilsManager(this);
        this.videoManager = new VideoManager(this);
        this.imageManager = new ImageManager(this);
        this.playbackManager = new PlaybackManager(this);
        this.transformManager = new TransformManager(this);
        this.effectManager = new EffectManager(this);
        this.cardListManager = new CardListManager(this);
        
        // 初始化背景顏色
        this.utilsManager.initBackgroundColor();
        
        this.initDropZone();
        this.initGlobalEvents();
        this.initSaveLoadEvents();
        
        // 添加 IPC 事件監聽
        const { ipcRenderer } = require('electron');

        ipcRenderer.on('save-layout', () => {
            this.layoutManager.saveLayout();
        });
        
        ipcRenderer.on('load-layout', () => {
            this.layoutManager.loadLayout();
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

        // 處理批量刪除媒體事件
        ipcRenderer.on('batch-delete-media', (event, indices) => {
            console.log('Batch deleting media at indices:', indices);
            
            let successCount = 0;
            let failCount = 0;
            const errors = [];
            
            // 從大到小排序索引，避免刪除時索引錯位
            const sortedIndices = [...indices].sort((a, b) => b - a);
            
            sortedIndices.forEach(index => {
                try {
                    const videoData = this.videos[index];
                    if (videoData) {
                        // 從 DOM 中移除元素
                        videoData.wrapper.remove();
                        
                        // 從數組中移除元素
                        this.videos.splice(index, 1);
                        
                        successCount++;
                        console.log('Successfully deleted media at index:', index);
                    } else {
                        failCount++;
                        errors.push(`索引 ${index} 處未找到媒體`);
                        console.warn('No video data found at index:', index);
                    }
                } catch (error) {
                    failCount++;
                    errors.push(`刪除索引 ${index} 時出錯: ${error.message}`);
                    console.error('Error deleting media at index:', index, error);
                }
            });
            
            console.log('Batch deletion completed:', { successCount, failCount, errors });
            
            // 如果沒有視頻了，顯示 dropZone
            if (this.videos.length === 0) {
                this.dropZone.style.display = 'flex';
            }
            
            // 立即更新卡片列表
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
            
            // 向主進程發送批量刪除完成通知，讓主進程轉發給卡片窗口
            ipcRenderer.send('batch-delete-completed', {
                successCount,
                failCount,
                errors
            });
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
                        filterValues: v.video.filterValues,
                        currentTime: v.video.currentTime,
                        paused: v.video.paused
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
                const maxInitialWidth = window.innerWidth * 0.8;  // 或其他適的最大寬度
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

        ipcRenderer.on('toggle-play', async (event, index) => {
            const videoData = this.videos[index];
            if (videoData && !videoData.isImage) {
                const video = videoData.video;  // 使用 videoData.video 而不是 querySelectorAll
                if (video.paused) {
                    await video.play();
                    ipcRenderer.send('video-state-changed', { 
                        index, 
                        isPlaying: true 
                    });
                } else {
                    video.pause();
                    ipcRenderer.send('video-state-changed', { 
                        index, 
                        isPlaying: false 
                    });
                }
            }
        });

        // 監聽變換操作
        ipcRenderer.on('transform', (event, { type, index }) => {
            const videoData = this.videos[index];
            if (videoData) {
                switch (type) {
                    case 'reset':
                        videoData.scale = 1;
                        videoData.rotation = 0;
                        videoData.flipX = false;
                        videoData.flipY = false;
                        break;
                    case 'flip-x':
                        videoData.flipX = !videoData.flipX;
                        break;
                    case 'flip-y':
                        videoData.flipY = !videoData.flipY;
                        break;
                }
                this.transformManager.updateVideoTransform(videoData);
            }
        });

        // 添加視頻狀態變化監聽
        this.videos.forEach((videoData, index) => {
            if (!videoData.isImage) {
                // 設置初始狀態
                videoData.video.muted = true;  
                videoData.video.loop = true;   
                // 初始化時間範圍
                videoData.video.startTime = 0;
                videoData.video.endTime = undefined;
                
                videoData.video.addEventListener('play', () => {
                    ipcRenderer.send('video-state-changed', { 
                        index, 
                        isPlaying: true 
                    });
                });

                videoData.video.addEventListener('pause', () => {
                    ipcRenderer.send('video-state-changed', { 
                        index, 
                        isPlaying: false 
                    });
                });
                
                // 監聽時間更新
                videoData.video.addEventListener('timeupdate', () => {
                    // 檢查是否到達結束時間
                    if (videoData.video.endTime && videoData.video.currentTime >= videoData.video.endTime) {
                        if (videoData.video.loop) {
                            videoData.video.currentTime = videoData.video.startTime || 0;
                        } else {
                            videoData.video.pause();
                        }
                    }
                });
                
                // 監聽時間範圍更新
                ipcRenderer.on('time-range-update', (event, { index: videoIndex, startTime, endTime }) => {
                    if (videoIndex === index) {
                        // 更新视频的时间范围
                        videoData.video.startTime = startTime;
                        videoData.video.endTime = endTime;
                        
                        // 如果当前时间在范围外，调整到范围内
                        if (videoData.video.currentTime < startTime) {
                            videoData.video.currentTime = startTime;
                        } else if (endTime && videoData.video.currentTime > endTime) {
                            videoData.video.currentTime = endTime;
                        }
                        
                        // 发送时间更新事件
                        ipcRenderer.send('video-time-update', {
                            index,
                            currentTime: videoData.video.currentTime,
                            duration: videoData.video.duration
                        });
                    }
                });
                
                // 監聽重置時間範圍
                ipcRenderer.on('reset-time-range', (event, { index: videoIndex }) => {
                    if (videoIndex === index) {
                        videoData.video.startTime = 0;
                        videoData.video.endTime = undefined;
                    }
                });
                
                // 發送初始狀態
                ipcRenderer.send('video-mute-changed', {
                    index,
                    isMuted: true
                });
                
                ipcRenderer.send('video-loop-changed', {
                    index,
                    isLooping: true
                });

                // 監聽跳轉請求
                ipcRenderer.on('video-seek-to', (event, { index: videoIndex, currentTime }) => {
                    if (videoIndex === index) {
                        const time = currentTime;
                        if (time >= videoData.video.startTime && 
                            (!videoData.video.endTime || time <= videoData.video.endTime)) {
                            videoData.video.currentTime = time;
                            // 发送时间更新事件
                            ipcRenderer.send('video-time-update', {
                                index: videoIndex,
                                currentTime: time,
                                duration: videoData.video.duration
                            });
                        }
                    }
                });

                // 监听前进和后退事件
                ipcRenderer.on('video-skipnext', (event, videoIndex) => {
                    if (videoIndex === index) {
                        const newTime = Math.min(
                            videoData.video.currentTime + 5,
                            videoData.video.endTime || videoData.video.duration
                        );
                        videoData.video.currentTime = newTime;
                        // 发送时间更新事件
                        ipcRenderer.send('video-time-update', {
                            index,
                            currentTime: newTime,
                            duration: videoData.video.duration
                        });
                    }
                });
                
                ipcRenderer.on('video-skipprev', (event, videoIndex) => {
                    if (videoIndex === index) {
                        const newTime = Math.max(
                            videoData.video.currentTime - 5,
                            videoData.video.startTime || 0
                        );
                        videoData.video.currentTime = newTime;
                        // 发送时间更新事件
                        ipcRenderer.send('video-time-update', {
                            index,
                            currentTime: newTime,
                            duration: videoData.video.duration
                        });
                    }
                });
            }
        });

        ipcRenderer.on('video-skipnext', (event, index) => {
            const videoData = this.videos[index];
            if (videoData) {
                const newTime = Math.min(
                    videoData.video.currentTime + 5,
                    videoData.video.endTime || videoData.video.duration
                );
                videoData.video.currentTime = newTime;
                // 发送时间更新事件
                ipcRenderer.send('video-time-update', {
                    index,
                    currentTime: newTime,
                    duration: videoData.video.duration
                });
            }
        });

        ipcRenderer.on('video-skipprev', (event, index) => {
            const videoData = this.videos[index];
            if (videoData) {
                const newTime = Math.max(
                    videoData.video.currentTime - 5,
                    videoData.video.startTime || 0
                );
                videoData.video.currentTime = newTime;
                // 发送时间更新事件
                ipcRenderer.send('video-time-update', {
                    index,
                    currentTime: newTime,
                    duration: videoData.video.duration
                });
            }
        });

        // 在 MainManager 的 constructor 中
        ipcRenderer.on('toggle-mute', (event, index) => {
            const video = document.querySelectorAll('video')[index];
            if (video) {
                video.muted = !video.muted;
                ipcRenderer.send('video-mute-changed', { 
                    index, 
                    isMuted: video.muted 
                });
            }
        });

        ipcRenderer.on('toggle-loop', (event, index) => {
            const video = document.querySelectorAll('video')[index];
            if (video) {
                video.loop = !video.loop;
                ipcRenderer.send('video-loop-changed', { 
                    index, 
                    isLooping: video.loop 
                });
            }
        });

        // 添加視頻事件監聽
        video.addEventListener('volumechange', () => {
            ipcRenderer.send('video-mute-changed', { 
                index: this.videos.indexOf(videoData), 
                isMuted: video.muted 
            });
        });

        video.addEventListener('loop', () => {
            ipcRenderer.send('video-loop-changed', { 
                index: this.videos.indexOf(videoData), 
                isLooping: video.loop 
            });
        });
    }
    
    initDropZone() {
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        document.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const files = Array.from(e.dataTransfer.files);
            for (const file of files) {
                if (file.type.startsWith('video/')) {
                    await this.videoManager.addVideo(file, file.name);
                } else if (file.type.startsWith('image/') || this.isRawImage(file.name)) {
                    if (this.isRawImage(file.name)) {
                        try {
                            console.log('Processing RAW file:', file.name);
                            const { ipcRenderer } = require('electron');
                            
                            // 等待用戶選擇 RAW 處理選項
                            const optionResult = await new Promise(resolve => {
                                // 確保發送的數據是可序列化的
                                const cleanPath = file.path.toString();
                                ipcRenderer.send('create-raw-options-window', { 
                                    filename: file.name,
                                    path: cleanPath
                                });
                                
                                ipcRenderer.once('raw-option-selected', (event, result) => {
                                    resolve(result);
                                });
                            });

                            if (optionResult.cancelled) {
                                return;
                            }

                            // 確保發送的數據是可序列化的
                            const result = await ipcRenderer.invoke('process-raw-image', {
                                path: file.path.toString(),
                                options: JSON.parse(JSON.stringify(optionResult.options))
                            });

                            if (result.success) {
                                // 確保數據是正確的格式
                                const buffer = Buffer.from(result.data);
                                const blob = new Blob([buffer], { type: 'image/jpeg' });
                                const blobUrl = URL.createObjectURL(blob);
                                this.imageManager.addImage(blobUrl, file.name);
                            } else {
                                console.error('RAW image processing failed:', result.error);
                            }
                        } catch (error) {
                            console.error('Error processing RAW image:', error);
                        }
                    } else {
                        // 處理普通圖片
                        const blobUrl = URL.createObjectURL(file);
                        this.imageManager.addImage(blobUrl, file.name);
                    }
                }
            }
            
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
                this.layoutManager.saveLayout();
            }
            // Ctrl+F 加載布局
            if (e.ctrlKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                this.layoutManager.loadLayout();
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
    
    toggleKeyInfo() {
        this.uiManager.toggleKeyInfo();
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
    
    isRawImage(filename) {
        const rawExtensions = [
            '.arw',  // Sony
            '.cr2',  // Canon
            '.cr3',  // Canon
            '.dng',  // Adobe, Google, etc
            '.nef',  // Nikon
            '.orf',  // Olympus
            '.raf',  // Fujifilm
            '.rw2',  // Panasonic
            '.pef',  // Pentax
            '.srw'   // Samsung
            //'.braw'  // Blackmagic
        ];
        
        const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0];
        return ext && rawExtensions.includes(ext);
    }
}

const videoManager = new MainManager();

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


