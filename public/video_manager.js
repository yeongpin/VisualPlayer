const CodecManager = require('./codec_manager.js');

class VideoManager {
    constructor(mainManager) {
        this.mainManager = mainManager;
        this.codecManager = new CodecManager();
    }

    async addVideo(source, originalFileName) {
        // 如果是文件而不是 URL
        if (source instanceof File) {
            // 添加加載提示
            const loadingDiv = document.createElement('div');
            loadingDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 20px;
                border-radius: 8px;
                z-index: 10001;
                font-family: Arial, sans-serif;
            `;
            loadingDiv.textContent = `處理文件中: ${source.name}...`;
            document.body.appendChild(loadingDiv);

            try {
                const videoUrl = await this.codecManager.handleVideoFile(source);
                if (!videoUrl) {
                    console.error('無法處理該視頻文件:', source.name);
                    // 顯示錯誤提示
                    const errorDiv = document.createElement('div');
                    errorDiv.style.cssText = `
                        position: fixed;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: rgba(220, 53, 69, 0.9);
                        color: white;
                        padding: 10px 20px;
                        border-radius: 4px;
                        z-index: 10000;
                        font-family: Arial, sans-serif;
                    `;
                    errorDiv.textContent = `無法處理視頻文件: ${source.name}`;
                    document.body.appendChild(errorDiv);
                    setTimeout(() => errorDiv.remove(), 5000);
                    loadingDiv.remove();
                    return;
                }
                source = videoUrl;
                loadingDiv.remove();
            } catch (error) {
                console.error('處理視頻文件時發生錯誤:', error);
                loadingDiv.remove();
                return;
            }
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';
        
        // 創建��視頻元素來獲取原始尺寸
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
            const baseName = originalFileName || 
                this.mainManager.utilsManager.getVideoFileName(source);
            let finalFileName = baseName;
            let counter = 1;
            
            while (this.mainManager.videos.some(v => v.video.dataset.originalFileName === finalFileName)) {
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

            // 處理控制拖動
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
                    // 起始時不能超過結束時間
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
                this.mainManager.videos = this.mainManager.videos.filter(v => v.wrapper !== wrapper);
                if (this.mainManager.videos.length === 0) {
                    this.mainManager.dropZone.style.display = 'flex';
                }
                
                // 如果卡片列表正在顯示，則更新它
                if (this.mainManager.cardListVisible) {
                    this.mainManager.showCardList();
                }

                // 更新卡片列表
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('update-cards', {
                    videos: this.mainManager.videos.map(v => ({
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
            
            // 添加重置大小和轉的按鈕
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
                const videoData = this.mainManager.videos.find(v => v.wrapper === wrapper);
                if (videoData) {
                    videoData.scale = 1;
                    videoData.rotation = 0;
                    videoData.flipX = false;  // 重置水平翻轉
                    videoData.flipY = false;  // 重置垂直翻轉
                    this.mainManager.transformManager.updateVideoTransform(videoData);
                    // 使用原始視頻尺寸計算重置大小
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
                const videoData = this.mainManager.videos.find(v => v.wrapper === wrapper);
                if (videoData) {
                    videoData.flipX = !videoData.flipX;
                    this.mainManager.transformManager.updateVideoTransform(videoData);
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
                const videoData = this.mainManager.videos.find(v => v.wrapper === wrapper);
                if (videoData) {
                    videoData.flipY = !videoData.flipY;
                    this.mainManager.transformManager.updateVideoTransform(videoData);
                }
            };

            // 按鈕添加到控制欄
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
            
            const offset = this.mainManager.videos.length * 50;
            wrapper.style.left = offset + 'px';
            wrapper.style.top = offset + 'px';
            
            wrapper.addEventListener('mousedown', (e) => this.mainManager.eventHandlers.handleMouseDown(e));
            wrapper.addEventListener('wheel', (e) => this.mainManager.eventHandlers.handleWheel(e));
            
            document.body.appendChild(wrapper);
            this.mainManager.videos.push({ 
                wrapper, 
                video, 
                container: videoContainer, 
                scale: 1,  // 先設置為 1
                rotation: 0,
                flipX: false,
                flipY: false
            });
            
            // 計算適合窗口的縮放比例
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const availableWidth = windowWidth * 0.9;  // 留出 10% 邊距
            const availableHeight = windowHeight * 0.9;

            // 使用 wrapper 的實際尺寸來計算縮放比例
            const wrapperWidth = wrapper.offsetWidth;
            const wrapperHeight = wrapper.offsetHeight;
            const fitScaleX = availableWidth / wrapperWidth;
            const fitScaleY = availableHeight / wrapperHeight;
            const fitScale = Math.min(fitScaleX, fitScaleY);

            // 更新 videoData 的 scale
            const videoData = this.mainManager.videos[this.mainManager.videos.length - 1];
            videoData.scale = fitScale;

            // 應用變換
            this.mainManager.transformManager.updateVideoTransform(videoData);

            // 設置 wrapper 的中心位置（保持原始尺寸）
            const centerX = (windowWidth - wrapperWidth) / 2;
            const centerY = (windowHeight - wrapperHeight) / 2;
            wrapper.style.position = 'fixed';
            wrapper.style.left = `${centerX}px`;
            wrapper.style.top = `${centerY}px`;

            video.play().catch(() => {
                console.log('Auto-play prevented');
            });
            
            this.mainManager.dropZone.style.display = 'none';
            
            // 更新卡片列表
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('update-cards', {
                videos: this.mainManager.videos.map(v => ({
                    isImage: v.isImage,
                    video: {
                        src: v.video.src,
                        dataset: {
                            originalFileName: v.video.dataset.originalFileName
                        }
                    }
                }))
            });

            // 如果卡片列表正在顯示，則更新它
            if (this.mainManager.cardListVisible) {
                this.mainManager.showCardList();
            }
            
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

            // 現有的视频播放器初始化代码中添加以支持
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

            // 添加載入中提示
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
            });
        };
    }
}

module.exports = VideoManager; 