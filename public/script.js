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

                // 通知卡片窗口刪除成功
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('media-deleted', { index, success: true });
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
            
            // 不需要立即更新整個卡片列表，批量刪除完成事件會處理
            
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

        // 處理添加直播流事件
        ipcRenderer.on('add-live-stream', (event, streamData) => {
            console.log('Adding live stream:', streamData);
            this.addLiveStream(streamData);
        });

        // 處理移除直播流事件
        ipcRenderer.on('remove-live-stream', (event, streamId) => {
            console.log('Removing live stream:', streamId);
            this.removeLiveStream(streamId);
        });

        // 处理应用变形的事件
        ipcRenderer.on('apply-warp-transform', (event, { index, transform }) => {
            const videoData = this.videos[index];
            if (videoData) {
                // 使用 TransformManager 的新方法来应用 warp 变换
                this.transformManager.applyWarpTransform(videoData, transform);
                console.log(`Applied warp transform to media ${index}:`, transform);
            }
        });

        // 处理实时预览变形的事件
        ipcRenderer.on('preview-warp-transform', (event, { index, transform }) => {
            const videoData = this.videos[index];
            if (videoData) {
                // 直接应用变形到元素，但不保存到数据中
                this.transformManager.previewWarpTransform(videoData, transform);
                console.log(`Previewing warp transform for media ${index}:`, transform);
            }
        });
        


        // 处理获取变形编辑器数据的请求
        ipcRenderer.on('get-warp-editor-data', (event, { index, requestId }) => {
            const videoData = this.videos[index];
            if (videoData) {
                const mediaElement = videoData.video;
                const containerRect = mediaElement.getBoundingClientRect();
                
                const mediaData = {
                    index: index,
                    src: videoData.video.src,
                    isImage: videoData.isImage,
                    originalFileName: videoData.video.dataset.originalFileName,
                    currentWarpTransform: videoData.warpTransform || '', // 包含当前的变形状态
                    mainWindowSize: {
                        width: Math.round(containerRect.width),
                        height: Math.round(containerRect.height)
                    }
                };
                
                console.log('Sending warp editor data:', mediaData);
                console.log('Main window media size:', mediaData.mainWindowSize);
                
                // 回应数据
                ipcRenderer.send('warp-editor-data-response', { mediaData, requestId });
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
            console.log('Main window: Received request-videos-data, sending current data');
            
            const videoData = this.videos.map(v => {
                const wrapperZIndex = parseInt(v.wrapper?.style?.zIndex) || 0;
                const datasetZIndex = parseInt(v.video.dataset?.zIndex) || 0;
                
                console.log(`Video ${v.video.src}: wrapper z-index=${wrapperZIndex}, dataset z-index=${datasetZIndex}`);
                
                return {
                    isImage: v.isImage,
                    video: {
                        src: v.video.src,
                        dataset: {
                            originalFileName: v.video.dataset.originalFileName,
                            scale: v.scale || 1.0,
                            rotation: v.rotation || 0,
                            flipX: v.flipX || false,
                            flipY: v.flipY || false,
                            zIndex: wrapperZIndex
                        },
                        filterValues: v.video.filterValues,
                        currentTime: v.video.currentTime,
                        paused: v.video.paused
                    },
                    zIndex: wrapperZIndex
                };
            });
            
            console.log('Main window: Sending video data with z-indices:', videoData.map(v => v.zIndex));
            
            ipcRenderer.send('update-cards', {
                videos: videoData
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

                // 重置變換屬性（包括 warp 变换）
                videoData.scale = 1;
                videoData.rotation = 0;
                videoData.flipX = false;
                videoData.flipY = false;
                
                // 重置 warp 变换
                this.transformManager.resetWarpTransform(videoData);

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

        // 處理設置媒體縮放事件
        ipcRenderer.on('set-media-scale', (event, { index, scale }) => {
            console.log('Setting scale for video at index:', index, 'to:', scale);
            
            const videoData = this.videos[index];
            if (videoData) {
                // 更新scale值
                videoData.scale = scale;
                
                // 應用變換
                this.transformManager.updateVideoTransform(videoData);
                
                // 通知所有卡片窗口更新scale顯示
                const cardsWindows = require('@electron/remote').BrowserWindow.getAllWindows().filter(win => 
                    win.webContents.getURL().includes('cards.html')
                );
                
                cardsWindows.forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('media-scale-updated', { 
                            videoSrc: videoData.video.src || `live-stream-${videoData.streamId}`, // 为直播流创建唯一标识
                            scale: scale,
                            index: index, // 保留索引作為備用
                            isLiveStream: videoData.isLiveStream || false
                        });
                    }
                });
                
                console.log('Scale updated successfully for index:', index);
            }
        });

        // 處理來自命令行參數的文件添加
        ipcRenderer.on('add-files-from-args', (event, filePaths) => {
            console.log('Adding files from command line arguments:', filePaths);
            
            // 隱藏 dropZone
            if (this.dropZone) {
                this.dropZone.style.display = 'none';
            }
            
            // 處理每個文件
            filePaths.forEach(filePath => {
                this.addFileFromPath(filePath);
            });
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

        // 處理 z-index 順序更新
        ipcRenderer.on('update-zindex-order', (event, newZIndexOrder) => {
            console.log('Received z-index order update in main window:', newZIndexOrder);
            
            // 更新每個視頻的 z-index
            const updatedVideos = [];
            newZIndexOrder.forEach(({ originalIndex, newZIndex }) => {
                const videoData = this.videos[originalIndex];
                if (videoData && videoData.wrapper) {
                    const oldZIndex = parseInt(videoData.wrapper.style.zIndex) || 0;
                    videoData.wrapper.style.zIndex = newZIndex;
                    
                    // 更新 dataset 中的 z-index 信息
                    if (!videoData.video.dataset) {
                        videoData.video.dataset = {};
                    }
                    videoData.video.dataset.zIndex = newZIndex;
                    
                    updatedVideos.push({
                        index: originalIndex,
                        zIndex: newZIndex
                    });
                    
                    console.log(`Updated video ${originalIndex} z-index from ${oldZIndex} to ${newZIndex}`);
                }
            });
            
            // 通知 cards 窗口 z-index 已更新
            if (updatedVideos.length > 0) {
                const cardsWindows = require('@electron/remote').BrowserWindow.getAllWindows().filter(win => 
                    win.webContents.getURL().includes('cards.html')
                );
                
                cardsWindows.forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('zindex-updated', updatedVideos);
                    }
                });
                
                console.log('Notified cards window with updated z-index:', updatedVideos);
            }
        });

        // 處理來自 cards 窗口的文件添加事件
        ipcRenderer.on('add-video-file', async (event, { name, path, type }) => {
            console.log('Adding video file from cards:', name);
            try {
                // 直接使用文件路径，不读取整个文件到内存
                // 创建一个轻量级的 File-like 对象
                const fileInfo = {
                    name: name,
                    path: path,
                    type: type || this.getVideoMimeType(name),
                    isFromPath: true // 标记这是从路径来的文件
                };
                
                // 使用 videoManager.addVideo，它会自动处理转码
                await this.videoManager.addVideo(fileInfo, name);
            } catch (error) {
                console.error('Error loading video file from cards:', error);
            }
        });

        ipcRenderer.on('add-image-file', async (event, { name, path, type }) => {
            console.log('Adding image file from cards:', name);
            try {
                const fs = require('fs').promises;
                const fileData = await fs.readFile(path);
                const blob = new Blob([fileData]);
                const blobUrl = URL.createObjectURL(blob);
                this.imageManager.addImage(blobUrl, name);
            } catch (error) {
                console.error('Error loading image file from cards:', error);
            }
        });

        ipcRenderer.on('add-raw-image-file', async (event, { name, path, options }) => {
            console.log('Adding RAW image file from cards:', name);
            try {
                const result = await ipcRenderer.invoke('process-raw-image', {
                    path: path,
                    options: options
                });

                if (result.success) {
                    const buffer = Buffer.from(result.data);
                    const blob = new Blob([buffer], { type: 'image/jpeg' });
                    const blobUrl = URL.createObjectURL(blob);
                    this.imageManager.addImage(blobUrl, name);
                } else {
                    console.error('RAW image processing failed:', result.error);
                }
            } catch (error) {
                console.error('Error processing RAW image from cards:', error);
            }
        });
    }
    
    initDropZone() {
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 檢查是否是來自 cards 窗口的內部拖動
            const hasInternalData = e.dataTransfer.types.includes('text/plain');
            if (hasInternalData) {
                // 這是內部拖動，不顯示 dropzone
                return;
            }
            
            // 只有外部文件拖入時才顯示 dropzone
            if (e.dataTransfer.types.includes('Files')) {
                this.dropZone.style.display = 'block';
            }
        });
        
        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 檢查是否真的離開了窗口（避免在子元素間移動時誤觸發）
            if (e.clientX === 0 && e.clientY === 0) {
                // 只有在有視頻時才隱藏 dropzone
                if (this.videos.length > 0) {
                    this.dropZone.style.display = 'none';
                }
            }
        });
        
        document.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 檢查是否是來自 cards 窗口的內部拖動
            const hasInternalData = e.dataTransfer.types.includes('text/plain');
            if (hasInternalData) {
                // 這是來自 cards 窗口的內部拖動，不處理
                console.log('Internal card drag from cards window detected, ignoring');
                return;
            }
            
            const files = Array.from(e.dataTransfer.files);
            
            // 只有當確實有文件時才處理
            if (files.length === 0) {
                return;
            }
            
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

    getVideoMimeType(filename) {
        const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0];
        const mimeTypes = {
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.mkv': 'video/x-matroska',
            '.webm': 'video/webm',
            '.flv': 'video/x-flv',
            '.wmv': 'video/x-ms-wmv',
            '.m4v': 'video/x-m4v',
            '.3gp': 'video/3gpp',
            '.ts': 'video/mp2t',
            '.mts': 'video/mp2t',
            '.m2ts': 'video/mp2t'
        };
        return mimeTypes[ext] || 'video/mp4';
    }

    // 添加從文件路徑加載文件的方法
    addFileFromPath(filePath) {
        console.log('Adding file from path:', filePath);
        
        // 檢查文件是否存在
        const fs = require('fs');
        if (!fs.existsSync(filePath)) {
            console.error('File does not exist:', filePath);
            return;
        }
        
        // 檢查是否為RAW圖片
        if (this.isRawImage(filePath)) {
            console.log('Processing RAW image:', filePath);
            // 創建一個類似File對象的結構
            const fileObj = {
                path: filePath,
                name: require('path').basename(filePath)
            };
            
            // 使用與拖拽相同的邏輯處理RAW圖片
            this.processRawImage(fileObj);
            return;
        }
        
        // 檢查是否為普通圖片
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
        const ext = filePath.toLowerCase().match(/\.[^.]*$/)?.[0];
        
        if (imageExtensions.includes(ext)) {
            console.log('Processing image:', filePath);
            // 讀取文件並創建blob URL
            const fs = require('fs');
            const fileBuffer = fs.readFileSync(filePath);
            const blob = new Blob([fileBuffer]);
            const blobUrl = URL.createObjectURL(blob);
            this.imageManager.addImage(blobUrl, require('path').basename(filePath));
            return;
        }
        
        // 檢查是否為視頻
        if (this.getVideoMimeType(filePath)) {
            console.log('Processing video:', filePath);
            // 創建文件信息對象，包含轉碼檢測所需的信息
            const fileInfo = {
                path: filePath,
                name: require('path').basename(filePath),
                type: this.getVideoMimeType(filePath),
                isFromPath: true  // 標記這是從文件路徑來的
            };
            this.videoManager.addVideo(fileInfo);
            return;
        }
        
        console.warn('Unsupported file type:', filePath);
    }

    // 處理RAW圖片的輔助方法
    async processRawImage(fileObj) {
        try {
            const { ipcRenderer } = require('electron');
            
            // 獲取RAW處理選項
            const optionResult = await ipcRenderer.invoke('get-raw-options', fileObj.path);
            
            if (!optionResult.success) {
                console.error('Failed to get RAW options:', optionResult.error);
                return;
            }

            // 確保發送的數據是可序列化的
            const result = await ipcRenderer.invoke('process-raw-image', {
                path: fileObj.path.toString(),
                options: JSON.parse(JSON.stringify(optionResult.options))
            });

            if (result.success) {
                // 確保數據是正確的格式
                const buffer = Buffer.from(result.data);
                const blob = new Blob([buffer], { type: 'image/jpeg' });
                const blobUrl = URL.createObjectURL(blob);
                this.imageManager.addImage(blobUrl, fileObj.name);
            } else {
                console.error('RAW image processing failed:', result.error);
            }
        } catch (error) {
            console.error('Error processing RAW image:', error);
        }
    }

    // 添加直播流支持
    async addLiveStream(streamData) {
        try {
            console.log('Creating live stream element:', streamData);
            
            // 隐藏 dropZone
            this.dropZone.style.display = 'none';
            
            // 创建视频元素
            const video = document.createElement('video');
            video.autoplay = true;
            video.muted = false; // 直播流通常需要声音
            video.loop = false;
            video.controls = false;
            video.dataset.originalFileName = streamData.name;
            video.dataset.filePath = streamData.url;
            video.dataset.streamId = streamData.id;
            video.dataset.isLiveStream = 'true';
            
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';
            
            // 创建包装器（初始大小，等待视频加载后调整）
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.style.cssText = `
                position: absolute;
                width: 480px;
                height: 270px;
                cursor: move;
                user-select: none;
                transform-origin: center;
                will-change: transform;
            `;
            
            // 根据流类型处理媒体流
            if (streamData.type === 'webcam' || streamData.type === 'obs') {
                // 使用 getUserMedia 获取摄像头或虚拟摄像头
                try {
                    // 先列出所有可用的视频设备
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videoDevices = devices.filter(device => device.kind === 'videoinput');
                    
                    console.log('Available video devices:');
                    videoDevices.forEach((device, index) => {
                        console.log(`${index}: ${device.label || 'Unknown Camera'} (${device.deviceId})`);
                    });
                    
                    // 检查是否有OBS虚拟摄像头
                    const obsDevice = videoDevices.find(device => 
                        device.label.toLowerCase().includes('obs') || 
                        device.label.toLowerCase().includes('virtual')
                    );
                    
                    if (streamData.type === 'obs') {
                        if (obsDevice) {
                            console.log('Found OBS Virtual Camera:', obsDevice.label);
                        } else {
                            console.warn('OBS Virtual Camera not found! Available devices:', videoDevices.map(d => d.label));
                            throw new Error('未找到OBS虚拟摄像头！请确认：\n1. OBS Studio已安装\n2. 在OBS中启动虚拟摄像头 (工具→虚拟摄像头→启动)\n3. 重启浏览器后再试');
                        }
                    }
                    
                    let constraints = { video: true, audio: true };
                    
                    if (streamData.type === 'webcam' && streamData.deviceId) {
                        constraints.video = { deviceId: { exact: streamData.deviceId } };
                    } else if (streamData.type === 'obs' && obsDevice) {
                        // 尝试使用找到的OBS设备
                        constraints.video = { deviceId: { exact: obsDevice.deviceId } };
                    }
                    
                    console.log('Requesting media with constraints:', constraints);
                    
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    video.srcObject = stream;
                    
                    // 检查stream的状态
                    const videoTrack = stream.getVideoTracks()[0];
                    if (videoTrack) {
                        console.log('Video track info:', {
                            label: videoTrack.label,
                            enabled: videoTrack.enabled,
                            readyState: videoTrack.readyState,
                            settings: videoTrack.getSettings()
                        });
                    }
                    
                } catch (error) {
                    console.error('Error accessing media devices:', error);
                    
                    // 提供更详细的错误信息
                    let errorMessage = `无法访问${streamData.type === 'webcam' ? '摄像头' : 'OBS虚拟摄像头'}`;
                    
                    if (error.name === 'NotFoundError') {
                        errorMessage += '\n\n设备未找到，请检查：\n• OBS Studio是否已安装\n• 虚拟摄像头是否已启动\n• 设备驱动是否正确安装';
                    } else if (error.name === 'NotAllowedError') {
                        errorMessage += '\n\n权限被拒绝，请：\n• 允许浏览器访问摄像头\n• 检查系统隐私设置';
                    } else if (error.name === 'NotReadableError') {
                        errorMessage += '\n\n设备正在被其他程序使用\n• 关闭其他使用摄像头的程序\n• 重启OBS Studio';
                    } else {
                        errorMessage += `\n\n错误详情: ${error.message}`;
                    }
                    
                    throw new Error(errorMessage);
                }
            } else if (streamData.type === 'custom') {
                // 自定义URL流
                video.src = streamData.url;
                video.crossOrigin = 'anonymous';
            }
            
            // 创建视频容器
            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';
            videoContainer.style.cssText = `
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                transform-origin: center;
                transform-style: preserve-3d;
                will-change: transform;
                position: relative;
            `;
            
            videoContainer.appendChild(video);
            wrapper.appendChild(videoContainer);
            
            // 为直播流视频添加基本的事件监听器
            video.addEventListener('loadedmetadata', () => {
                console.log('Live stream metadata loaded');
                
                // 获取视频原始尺寸
                const originalWidth = video.videoWidth || 1920; // 默认1920，如果无法获取
                const originalHeight = video.videoHeight || 1080; // 默认1080，如果无法获取
                
                console.log('Live stream original size:', originalWidth, 'x', originalHeight);
                
                // 计算适合窗口的尺寸，但保持原始比例
                const winWidth = window.innerWidth;
                const winHeight = window.innerHeight;
                const availWidth = winWidth * 0.6;  // 60% 窗口宽度（比普通视频小一些）
                const availHeight = winHeight * 0.6;  // 60% 窗口高度
                
                // 计算缩放比例以适应窗口
                const scaleX = availWidth / originalWidth;
                const scaleY = availHeight / originalHeight;
                const scale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小
                
                // 设置wrapper尺寸为缩放后的实际显示尺寸
                const displayWidth = originalWidth * scale;
                const displayHeight = originalHeight * scale;
                wrapper.style.width = `${displayWidth}px`;
                wrapper.style.height = `${displayHeight}px`;
                
                // 居中显示
                const centerX = (winWidth - displayWidth) / 2;
                const centerY = (winHeight - displayHeight) / 2;
                wrapper.style.left = `${centerX}px`;
                wrapper.style.top = `${centerY}px`;
                
                console.log('Live stream positioned at:', centerX, centerY, 'size:', displayWidth, 'x', displayHeight);
            });
            
            video.addEventListener('error', (e) => {
                console.error('Live stream error:', e);
            });
            
            // 设置初始translateX和translateY
            const translateX = 0;
            const translateY = 0;
            
            // 设置初始位置（临时位置，等待loadedmetadata事件后居中）
            wrapper.style.left = '50px';
            wrapper.style.top = '50px';
            wrapper.style.zIndex = this.getTopZIndex() + 1;
            
            // 添加到DOM
            document.body.appendChild(wrapper);
            
            // 保存视频数据
            const videoData = {
                video: video,
                wrapper: wrapper,
                container: videoContainer,
                scale: 1,
                rotation: 0,
                flipX: false,
                flipY: false,
                translateX: translateX,
                translateY: translateY,
                isImage: false,
                isLiveStream: true,
                streamId: streamData.id,
                streamData: streamData
            };
            
            this.videos.push(videoData);
            
            // 添加正确的事件监听器，使其支持所有变换功能
            wrapper.addEventListener('mousedown', (e) => this.eventHandlers.handleMouseDown(e));
            wrapper.addEventListener('wheel', (e) => this.eventHandlers.handleWheel(e));
            
            // 应用初始变换
            this.transformManager.updateVideoTransform(videoData);
            
            // 更新卡片列表（如果正在显示）
            if (this.cardListManager.cardListVisible) {
                this.cardListManager.showCardList();
            }
            
            // 通知cards窗口更新数据
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('update-cards', {
                videos: this.videos.map(v => ({
                    isImage: v.isImage || false,
                    isLiveStream: v.isLiveStream || false,
                    streamData: v.streamData ? {
                        id: v.streamId || v.streamData.id,
                        name: v.streamData.name,
                        source: v.streamData.source
                    } : null,
                    video: {
                        src: v.video.src || '',
                        currentSrc: v.video.currentSrc || '',
                        srcObject: v.video.srcObject ? 'stream' : null,
                        dataset: {
                            originalFileName: v.video.dataset.originalFileName,
                            scale: v.scale,
                            rotation: v.rotation,
                            flipX: v.flipX,
                            flipY: v.flipY,
                            zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                        }
                    },
                    zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                }))
            });
            
            console.log('Live stream added successfully:', streamData.name);
            
        } catch (error) {
            console.error('Error adding live stream:', error);
            // 通知用户错误
            alert(`添加直播流失败: ${error.message}`);
        }
    }

    // 移除直播流
    removeLiveStream(streamId) {
        const index = this.videos.findIndex(v => v.streamId === streamId);
        if (index !== -1) {
            const videoData = this.videos[index];
            
            // 停止媒体流
            if (videoData.video.srcObject) {
                const tracks = videoData.video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }
            
            // 从DOM中移除
            videoData.wrapper.remove();
            
            // 从数组中移除
            this.videos.splice(index, 1);
            
            // 如果没有视频了，显示dropZone
            if (this.videos.length === 0) {
                this.dropZone.style.display = 'flex';
            }
            
            // 更新卡片列表（如果正在显示）
            if (this.cardListManager.cardListVisible) {
                this.cardListManager.showCardList();
            }
            
            // 通知cards窗口更新数据
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('update-cards', {
                videos: this.videos.map(v => ({
                    isImage: v.isImage || false,
                    isLiveStream: v.isLiveStream || false,
                    streamData: v.streamData ? {
                        id: v.streamId || v.streamData.id,
                        name: v.streamData.name,
                        source: v.streamData.source
                    } : null,
                    video: {
                        src: v.video.src || '',
                        currentSrc: v.video.currentSrc || '',
                        srcObject: v.video.srcObject ? 'stream' : null,
                        dataset: {
                            originalFileName: v.video.dataset.originalFileName,
                            scale: v.scale,
                            rotation: v.rotation,
                            flipX: v.flipX,
                            flipY: v.flipY,
                            zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                        }
                    },
                    zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                }))
            });
            
            console.log('Live stream removed:', streamId);
        }
    }

    // 获取最高的z-index值
    getTopZIndex() {
        let maxZ = 0;
        this.videos.forEach(videoData => {
            const z = parseInt(videoData.wrapper.style.zIndex) || 0;
            if (z > maxZ) maxZ = z;
        });
        return maxZ;
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

// 添加串流进度监听器
ipcRenderer.on('stream-progress', (event, progress) => {
    console.log('Stream progress:', progress);
    // 在页面上显示串流状态
    const statusDiv = document.getElementById('stream-status') || createStreamStatusDiv();
    if (progress.stage) {
        statusDiv.textContent = `${progress.stage} - FPS: ${Math.round(progress.fps)} - 速度: ${progress.speed.toFixed(1)}x`;
        statusDiv.style.display = 'block';
        
        // 3秒后自动隐藏状态
        clearTimeout(window.streamStatusTimeout);
        window.streamStatusTimeout = setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
});

// 创建串流状态显示元素
function createStreamStatusDiv() {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'stream-status';
    statusDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 10000;
        display: none;
    `;
    document.body.appendChild(statusDiv);
    return statusDiv;
}

// 页面卸载时清理所有串流
window.addEventListener('beforeunload', () => {
    if (window.activeStreamPorts && window.activeStreamPorts.size > 0) {
        console.log('Cleaning up active streams before page unload');
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('cleanup-all-streams');
    }
});


