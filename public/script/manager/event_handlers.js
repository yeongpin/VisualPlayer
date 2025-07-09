class EventHandlers {
    constructor(mainManager) {
        this.mainManager = mainManager;
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };
        this.rotateMode = false;
        this.rotateStart = 0;
        this.startRotation = 0;
    }

    handleMouseDown(e) {
        if (e.target.tagName === 'BUTTON') return;
    
        const wrapper = e.target.closest('.video-wrapper');
        if (wrapper) {
            if (e.ctrlKey && e.button === 0) {
                // 重新排序 z-index，將當前元素置頂，其他元素依序下移
                const allWrappers = Array.from(document.querySelectorAll('.video-wrapper'));
                const currentZIndex = parseInt(wrapper.style.zIndex) || 0;
                const maxZIndex = allWrappers.length - 1;
                
                // 將所有 z-index 大於當前值的元素減 1
                allWrappers.forEach(w => {
                    const wZIndex = parseInt(w.style.zIndex) || 0;
                    if (wZIndex > currentZIndex) {
                        w.style.zIndex = wZIndex - 1;
                    }
                });
                
                // 將當前元素設為最高層
                wrapper.style.zIndex = maxZIndex;
                
                // 更新對應 videoData 中的 dataset.zIndex
                const videoData = this.mainManager.videos.find(v => v.wrapper === wrapper);
                if (videoData) {
                    const oldZIndex = parseInt(videoData.video.dataset?.zIndex) || 0;
                    if (!videoData.video.dataset) {
                        videoData.video.dataset = {};
                    }
                    videoData.video.dataset.zIndex = maxZIndex;
                    console.log(`Ctrl+Click: Updated video z-index from ${oldZIndex} to ${maxZIndex}, wrapper z-index: ${wrapper.style.zIndex}`);
                } else {
                    console.warn('Ctrl+Click: Could not find videoData for wrapper');
                }
                
                // 通知 cards 窗口更新完整數據（包括 z-index）
                const { ipcRenderer } = require('electron');
                
                // 發送完整的 update-cards 事件，確保數據同步
                ipcRenderer.send('update-cards', {
                    videos: this.mainManager.videos.map(v => ({
                        isImage: v.isImage,
                        video: {
                            src: v.video.src,
                            dataset: {
                                originalFileName: v.video.dataset.originalFileName,
                                scale: v.scale || 1.0,
                                rotation: v.rotation || 0,
                                flipX: v.flipX || false,
                                flipY: v.flipY || false,
                                translateX: v.translateX || 0,
                                translateY: v.translateY || 0,
                                zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                            }
                        },
                        zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                    }))
                });
                
                // 同時發送 z-index 專用更新事件（保持向後兼容）
                const updatedVideos = this.mainManager.videos.map((v, index) => ({
                    index: index,
                    zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                }));
                
                const cardsWindows = require('@electron/remote').BrowserWindow.getAllWindows().filter(win => 
                    win.webContents.getURL().includes('cards.html')
                );
                
                cardsWindows.forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('zindex-updated', updatedVideos);
                    }
                });
                
                console.log('Z-index updated after Ctrl+click, notified cards window with full data update');
                e.preventDefault();
                return;
            }
        }

        if (e.button === 0) {  // 左鍵
            if (e.altKey) {  // Alt + 左鍵
                // 獲取視頻/圖片數據
                const videoData = this.mainManager.videos.find(v => v.wrapper === e.currentTarget);
                if (videoData) {
                    // 獲取窗口尺寸
                    const windowWidth = window.innerWidth;
                    const windowHeight = window.innerHeight;
                
                    // 獲取視頻/圖片的原始比例
                    const originalWidth = videoData.wrapper.offsetWidth;
                    const originalHeight = videoData.wrapper.offsetHeight;

                    // 計算可用空間，留 10% 的邊框
                    const maxWidth = windowWidth * 0.9;
                    const maxHeight = windowHeight * 0.9;

                    // 計算適配屏幕的 scale 值
                    const scaleX = maxWidth / originalWidth;
                    const scaleY = maxHeight / originalHeight;
                    const newScale = Math.min(scaleX, scaleY);

                    // 計算縮放後的實際顯示尺寸
                    const scaledWidth = originalWidth * newScale;
                    const scaledHeight = originalHeight * newScale;
                    
                    // 獲取wrapper的原始位置
                    const originalLeft = parseFloat(videoData.wrapper.style.left) || 0;
                    const originalTop = parseFloat(videoData.wrapper.style.top) || 0;
                    
                    // 計算因為縮放導致的左上角偏移（transform-origin: center的影響）
                    const scaleOffsetX = (scaledWidth - originalWidth) / 2;
                    const scaleOffsetY = (scaledHeight - originalHeight) / 2;
                    
                    // 計算屏幕居中的絕對位置
                    const centerX = (windowWidth - scaledWidth) / 2;
                    const centerY = (windowHeight - scaledHeight) / 2;
                    
                    // translate值 = 目標居中位置 - wrapper的原始left/top位置 + 縮放偏移
                    videoData.translateX = centerX - originalLeft + scaleOffsetX;
                    videoData.translateY = centerY - originalTop + scaleOffsetY;
                    videoData.scale = newScale;
                    videoData.rotation = 0;
                    this.mainManager.transformManager.updateVideoTransform(videoData);

                    const { ipcRenderer } = require('electron');
                    
                    // 發送完整的卡片數據更新
                    ipcRenderer.send('update-cards', {
                        videos: this.mainManager.videos.map(v => ({
                            isImage: v.isImage,
                            video: {
                                src: v.video.src,
                                dataset: {
                                    originalFileName: v.video.dataset.originalFileName,
                                    scale: v.scale,
                                    rotation: v.rotation,
                                    flipX: v.flipX,
                                    flipY: v.flipY,
                                    translateX: v.translateX || 0,
                                    translateY: v.translateY || 0,
                                    zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                                }
                            },
                            zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                        }))
                    });
                    
                    // 發送 scale 更新事件到 cards 窗口
                    const cardsWindows = require('@electron/remote').BrowserWindow.getAllWindows().filter(win => 
                        win.webContents.getURL().includes('cards.html')
                    );
                    
                    cardsWindows.forEach(win => {
                        if (!win.isDestroyed()) {
                            win.webContents.send('media-scale-updated', { 
                                videoSrc: videoData.video.src, // 使用視頻源路徑
                                scale: newScale
                            });
                        }
                    });
                    
                    console.log(`Alt+Click: Updated scale to ${newScale} for video: ${videoData.video.src}`);
                }
                return;
            }
            
            this.dragTarget = e.currentTarget;
            const videoData = this.mainManager.videos.find(v => v.wrapper === this.dragTarget);
            if (videoData) {
                // 记录当前的translate值和鼠标位置
                this.dragOffset = {
                    x: e.clientX - (videoData.translateX || 0),
                    y: e.clientY - (videoData.translateY || 0)
                };
            }
            
            // 置頂邏輯已在 mousedown 事件中處理
        } else if (e.button === 2 && e.shiftKey) {
            e.preventDefault();
            this.dragTarget = e.currentTarget;
            const rect = this.dragTarget.getBoundingClientRect();
            this.rotateMode = true;
            this.rotateStart = Math.atan2(
                e.clientY - rect.top - rect.height/2,
                e.clientX - rect.left - rect.width/2
            );
            const videoData = this.mainManager.videos.find(v => v.wrapper === this.dragTarget);
            this.startRotation = videoData ? videoData.rotation : 0;
        }
    }

    handleMouseMove(e) {
        if (this.dragTarget) {
            if (this.rotateMode) {
                const rect = this.dragTarget.getBoundingClientRect();
                const currentAngle = Math.atan2(
                    e.clientY - rect.top - rect.height/2,
                    e.clientX - rect.left - rect.width/2
                );
                const videoData = this.mainManager.videos.find(v => v.wrapper === this.dragTarget);
                if (videoData) {
                    videoData.rotation = this.startRotation + (currentAngle - this.rotateStart) * (180/Math.PI);
                    this.mainManager.transformManager.updateVideoTransform(videoData);
                }
            } else {
                // 使用transform的translate而不是left/top
                const videoData = this.mainManager.videos.find(v => v.wrapper === this.dragTarget);
                if (videoData) {
                    videoData.translateX = e.clientX - this.dragOffset.x;
                    videoData.translateY = e.clientY - this.dragOffset.y;
                    this.mainManager.transformManager.updateVideoTransform(videoData);
                }
            }
        }
    }

    handleMouseUp() {
        this.dragTarget = null;
        this.rotateMode = false;
    }

    handleWheel(e) {
        e.preventDefault();
        const wrapper = e.target.closest('.video-wrapper');
        if (wrapper) {
            const videoData = this.mainManager.videos.find(v => v.wrapper === wrapper);
            if (videoData) {
                const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;
                videoData.scale *= scaleChange;
                
                // 限制縮放範圍
                videoData.scale = Math.max(0.1, Math.min(10, videoData.scale));
                
                this.mainManager.transformManager.updateVideoTransform(videoData);
                
                // 使用視頻源路徑而不是數組索引來識別視頻
                const videoSrc = videoData.video.src;
                
                // 通知卡片窗口更新scale顯示
                const { ipcRenderer } = require('electron');
                const cardsWindows = require('@electron/remote').BrowserWindow.getAllWindows().filter(win => 
                    win.webContents.getURL().includes('cards.html')
                );
                
                cardsWindows.forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('media-scale-updated', { 
                            videoSrc: videoSrc, // 使用視頻源路徑而不是索引
                            scale: videoData.scale 
                        });
                    }
                });
            }
        }
    }

    handleKeyDown(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            this.mainManager.playbackManager.togglePlayAll();
        } else if (e.code === 'Backspace') {
            e.preventDefault();
            this.mainManager.playbackManager.resetAllVideos();
        } else if (e.key === 'Delete') {
            const activeVideo = document.querySelector('.video-wrapper:hover');
            if (activeVideo) {
                activeVideo.remove();
                this.mainManager.videos = this.mainManager.videos.filter(v => v.wrapper !== activeVideo);
                
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('update-cards', {
                    videos: this.mainManager.videos.map(v => ({
                        isImage: v.isImage,
                        video: {
                            src: v.video.src,
                            dataset: {
                                originalFileName: v.video.dataset.originalFileName,
                                scale: v.scale || 1.0,
                                rotation: v.rotation || 0,
                                flipX: v.flipX || false,
                                flipY: v.flipY || false,
                                translateX: v.translateX || 0,
                                translateY: v.translateY || 0,
                                zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                            }
                        },
                        zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                    }))
                });
            }
        } else if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            const speed = e.key === '0' ? 10 : parseInt(e.key);
            this.mainManager.playbackManager.setPlaybackSpeed(speed);
        } else if (e.key === '-') {
            e.preventDefault();
            this.mainManager.playbackManager.setPlaybackSpeed(0.25);
        } else if (e.key === '=') {
            e.preventDefault();
            this.mainManager.playbackManager.setPlaybackSpeed(0.5);
        } else if (e.key.toLowerCase() === 'i') {
            e.preventDefault();
            this.mainManager.playbackManager.adjustPlaybackSpeed(-0.1);
        } else if (e.key.toLowerCase() === 'o') {
            e.preventDefault();
            this.mainManager.playbackManager.adjustPlaybackSpeed(0.1);
        } else if (e.key.toLowerCase() === 'p') {
            e.preventDefault();
            this.mainManager.playbackManager.setPlaybackSpeed(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const timeChange = e.key === 'ArrowLeft' ? -5 : 5;
            this.mainManager.playbackManager.seekAllVideos(timeChange);
        } else if (e.key.toLowerCase() === 'm') {
            e.preventDefault();
            this.mainManager.playbackManager.toggleMuteAll();
        } else if (e.key.toLowerCase() === 'w') {
            e.preventDefault();
            this.mainManager.effectManager.adjustBlur(-1);
        } else if (e.key.toLowerCase() === 'e') {
            e.preventDefault();
            this.mainManager.effectManager.adjustBlur(1);
        } else if (e.key.toLowerCase() === 'q') {
            e.preventDefault();
            this.mainManager.effectManager.resetBlur();
        } else if (e.key.toLowerCase() === 'g') {
            e.preventDefault();
            this.mainManager.cardListManager.toggleCardList();
        } else if (e.key.toLowerCase() === 'k') {
            e.preventDefault();
            this.mainManager.uiManager.toggleKeyInfo();
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
            this.mainManager.uiManager.showBackgroundColorPicker();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.mainManager.uiManager.toggleStats();
        } else if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('open-settings');
        } else if (e.key.toLowerCase() === 'h') {
            e.preventDefault();
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('create-cards-window', {
                videos: this.mainManager.videos.map(v => ({
                    isImage: v.isImage,
                    video: {
                        src: v.video.src,
                        dataset: {
                            originalFileName: v.video.dataset.originalFileName,
                            scale: v.scale || 1.0,
                            rotation: v.rotation || 0,
                            flipX: v.flipX || false,
                            flipY: v.flipY || false,
                            translateX: v.translateX || 0,
                            translateY: v.translateY || 0
                        },
                        filterValues: v.video.filterValues
                    }
                }))
            });
        }
    }
}

module.exports = EventHandlers; 