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
                // 獲取所有 .video-wrapper 的 zIndex 值，並找到最高值
                const highestZIndex = Array.from(document.querySelectorAll('.video-wrapper'))
                    .map(w => parseInt(w.style.zIndex) || 0)
                    .reduce((max, current) => Math.max(max, current), 0);
        
                wrapper.style.zIndex = highestZIndex + 3;
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

                    // 計算 wrapper 的中心位置
                    const wrapperWidth = videoData.wrapper.offsetWidth;
                    const wrapperHeight = videoData.wrapper.offsetHeight;
                    const newWrapperLeft = (windowWidth - wrapperWidth) / 2;
                    const newWrapperTop = (windowHeight - wrapperHeight) / 2;
                
                    // 移動 wrapper 到屏幕中央
                    videoData.wrapper.style.position = 'fixed';
                    videoData.wrapper.style.left = `${newWrapperLeft}px`;
                    videoData.wrapper.style.top = `${newWrapperTop}px`;
                
                    videoData.scale = newScale;
                    videoData.rotation = 0;
                    this.mainManager.transformManager.updateVideoTransform(videoData);

                    const { ipcRenderer } = require('electron');
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
                                    flipY: v.flipY
                                }
                            }
                        }))
                    });
                }
                return;
            }
            
            this.dragTarget = e.currentTarget;
            const rect = this.dragTarget.getBoundingClientRect();
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            if (e.ctrlKey) {
                this.dragTarget.style.zIndex = this.mainManager.getTopZIndex() + 1;
            }
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
                const x = e.clientX - this.dragOffset.x;
                const y = e.clientY - this.dragOffset.y;
                this.dragTarget.style.left = x + 'px';
                this.dragTarget.style.top = y + 'px';
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
                
                // 找到對應的視頻索引
                const videoIndex = this.mainManager.videos.findIndex(v => v === videoData);
                
                // 通知卡片窗口更新scale顯示
                if (videoIndex !== -1) {
                    const { ipcRenderer } = require('electron');
                    const cardsWindows = require('@electron/remote').BrowserWindow.getAllWindows().filter(win => 
                        win.webContents.getURL().includes('cards.html')
                    );
                    
                    cardsWindows.forEach(win => {
                        if (!win.isDestroyed()) {
                            win.webContents.send('media-scale-updated', { 
                                index: videoIndex, 
                                scale: videoData.scale 
                            });
                        }
                    });
                }
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
                                flipY: v.flipY || false
                            }
                        }
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
                            flipY: v.flipY || false
                        },
                        filterValues: v.video.filterValues
                    }
                }))
            });
        }
    }
}

module.exports = EventHandlers; 