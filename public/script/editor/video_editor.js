const { ipcRenderer } = window.electron;
const path = window.path;

class VideoEditor {
    constructor() {
        this.currentVideoData = null;
        this.editStates = {
            trim: {
                start: 0,
                end: 0,
                isDragging: false,
                currentHandle: null
            },
            filters: {
                brightness: 100,
                contrast: 100,
                saturation: 100,
                hue: 0
            },
            isPreviewMode: false,
            originalTime: 0
        };
        this.initializeEventListeners();
        this.initializeRotateControls();
        this.initializeSubtitleControls();
        this.initializePositionControls();
    }

    initializeEventListeners() {
        // 添加關閉按鈕事件
        document.getElementById('closeBtn').addEventListener('click', () => {
            window.close();
        });

        // 初始化
        ipcRenderer.on('init-editor', (event, data) => {
            this.currentVideoData = data;
            const video = document.querySelector('.preview');
            const controlVideo = document.querySelector('.control-video');
            video.src = data.videoPath;
            controlVideo.src = data.videoPath;
            
            // 同步兩個視頻的播放狀態
            this.syncVideos(video, controlVideo);
            
            // 設置窗口標題
            document.querySelector('.titlebar-title').textContent = 
                `編輯視頻 - ${data.originalFileName}`;
        });

        // 處理輸出按鈕點擊
        document.getElementById('exportBtn').onclick = () => this.handleExport();

        // 監聽輸出完成事件
        ipcRenderer.on('export-complete', (event, result) => this.handleExportComplete(result));

        // 統一處理面板切換和按鈕狀態
        const handlePanelSwitch = (btnId, panelId) => {
            document.getElementById(btnId).onclick = (e) => {
                this.showPanel(panelId);
                // 移除所有按鈕的 active 類
                document.querySelectorAll('.control-group button').forEach(btn => 
                    btn.classList.remove('active')
                );
                // 添加當前按鈕的 active 類
                e.target.classList.add('active');
            };
        };

        // 設置各個面板的切換
        handlePanelSwitch('trimBtn', 'trimPanel');
        handlePanelSwitch('textBtn', 'textPanel');
        handlePanelSwitch('filterBtn', 'filterPanel');
        handlePanelSwitch('speedBtn', 'speedPanel');
        handlePanelSwitch('rotateBtn', 'rotatePanel');
        handlePanelSwitch('positionBtn', 'positionPanel');
        handlePanelSwitch('subtitleBtn', 'subtitlePanel');
        handlePanelSwitch('watermarkBtn', 'watermarkPanel');
        handlePanelSwitch('audioBtn', 'audioPanel');

        // 文字編輯
        document.getElementById('applyText').onclick = () => this.applyText();

        // 濾鏡效果
        this.initializeFilterControls();

        // 初始化時間軸拖動功能
        this.initializeTimelineControls();

        // 初始化速度控制
        this.initializeSpeedControls();

        this.initializeVideoControls();
    }

    syncVideos(mainVideo, controlVideo) {
        // 同步播放/暫停
        controlVideo.addEventListener('play', () => mainVideo.play());
        controlVideo.addEventListener('pause', () => mainVideo.pause());
        
        // 同步時間
        controlVideo.addEventListener('timeupdate', () => {
            if (Math.abs(mainVideo.currentTime - controlVideo.currentTime) > 0.1) {
                mainVideo.currentTime = controlVideo.currentTime;
            }
        });
        
        // 同步音量
        controlVideo.addEventListener('volumechange', () => {
            mainVideo.volume = controlVideo.volume;
            mainVideo.muted = controlVideo.muted;
        });
    }

    initializeTimelineControls() {
        const video = document.querySelector('.preview');
        // 保存原始控制項狀態
        const originalControls = video.controls;

        const timeline = document.querySelector('.timeline-slider');
        const startHandle = document.querySelector('.slider-handle.start');
        const endHandle = document.querySelector('.slider-handle.end');
        const range = document.querySelector('.slider-range');

        // 添加時間預覽元素
        const timePreview = document.createElement('div');
        timePreview.className = 'time-preview';
        timeline.appendChild(timePreview);

        // 視頻加載完成後初始化時間
        video.addEventListener('loadedmetadata', () => {
            this.editStates.trim.end = video.duration;
            videoEditorStore.editStates.trim.end = video.duration;
            // 設置初始位置
            startHandle.style.left = '0%';
            endHandle.style.right = '0%';
            range.style.left = '0%';
            range.style.right = '0%';
            this.updateTimeDisplay();
            this.updateTimelineUI();
        });

        // 處理拖動開始
        const handleDragStart = (e, handle) => {
            e.preventDefault();
            this.editStates.trim.isDragging = true;
            this.editStates.trim.currentHandle = handle;
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleDragEnd);
        };

        // 處理拖動過程
        const handleDrag = (e) => {
            if (!this.editStates.trim.isDragging) return;

            const timelineRect = timeline.getBoundingClientRect();
            const position = Math.max(0, Math.min(1, (e.clientX - timelineRect.left) / timelineRect.width));
            const time = position * video.duration;

            if (this.editStates.trim.currentHandle === 'start') {
                if (time < this.editStates.trim.end) {
                    this.editStates.trim.start = time;
                    const percent = position * 100;
                    startHandle.style.left = `${percent}%`;
                    range.style.left = `${percent}%`;
                    timePreview.textContent = this.formatTime(time);
                    timePreview.style.left = `${percent}%`;
                    if (this.editStates.isPreviewMode) {
                        video.currentTime = time;
                    }
                }
            } else {
                if (time > this.editStates.trim.start) {
                    this.editStates.trim.end = time;
                    const percent = position * 100;
                    endHandle.style.right = `${100 - percent}%`;
                    range.style.right = `${100 - percent}%`;
                    timePreview.textContent = this.formatTime(time);
                    timePreview.style.left = `${percent}%`;
                    if (this.editStates.isPreviewMode) {
                        video.currentTime = time;
                    }
                }
            }

            this.updateTimeDisplay();
        };

        // 處理拖動結束
        const handleDragEnd = () => {
            this.editStates.trim.isDragging = false;
            timePreview.style.display = 'none';
            if (!this.editStates.isPreviewMode) {
                video.currentTime = this.editStates.originalTime;
            }
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', handleDragEnd);
        };

        // 滑鼠進入手柄時顯示時間預覽
        [startHandle, endHandle].forEach(handle => {
            handle.addEventListener('mouseenter', () => {
                const time = handle === startHandle ? this.editStates.trim.start : this.editStates.trim.end;
                timePreview.textContent = this.formatTime(time);
                timePreview.style.display = 'block';
                timePreview.style.left = handle === startHandle ? handle.style.left : `${100 - parseFloat(handle.style.right)}%`;
            });
            
            handle.addEventListener('mouseleave', () => {
                if (!this.editStates.trim.isDragging) {
                    timePreview.style.display = 'none';
                }
            });
        });

        // 添加拖動事件監聽
        startHandle.addEventListener('mousedown', (e) => handleDragStart(e, 'start'));
        endHandle.addEventListener('mousedown', (e) => handleDragStart(e, 'end'));

        // 時間輸入框變化事件
        document.getElementById('startTime').addEventListener('change', (e) => {
            const time = this.parseTimeInput(e.target.value);
            this.editStates.trim.start = Math.min(time, this.editStates.trim.end);
            this.updateTimelineUI();
            video.currentTime = this.editStates.trim.start;
        });

        document.getElementById('endTime').addEventListener('change', (e) => {
            const time = this.parseTimeInput(e.target.value);
            this.editStates.trim.end = Math.max(time, this.editStates.trim.start);
            this.updateTimelineUI();
            video.currentTime = this.editStates.trim.end;
        });

        // 在進入裁剪模式時
        document.getElementById('trimBtn').addEventListener('click', () => {
            // 臨時禁用原生控制項
            video.controls = false;
        });

        // 在離開裁剪模式時（點擊其他按鈕時）
        document.querySelectorAll('.control-group button').forEach(btn => {
            if (btn.id !== 'trimBtn') {
                btn.addEventListener('click', () => {
                    // 恢復原生控制項
                    video.controls = originalControls;
                });
            }
        });

        // 添加預覽按鈕事件
        document.getElementById('previewTrim').addEventListener('click', () => {
            this.editStates.isPreviewMode = true;
            this.editStates.originalTime = video.currentTime;
            video.currentTime = this.editStates.trim.start;
            // 臨時顯示控制項用於暫停
            video.controls = true;
            video.play();
            
            const checkTime = () => {
                if (video.currentTime >= this.editStates.trim.end) {
                    video.pause();
                    video.removeEventListener('timeupdate', checkTime);
                    this.editStates.isPreviewMode = false;
                    // 預覽結束後恢復到裁剪模式
                    video.controls = false;
                }
            };
            video.addEventListener('timeupdate', checkTime);
        });

        // 添加應用按鈕事件
        document.getElementById('applyTrim').addEventListener('click', () => {
            videoEditorStore.setTrimSettings(
                this.editStates.trim.start,
                this.editStates.trim.end
            );
            video.currentTime = this.editStates.trim.start;
            alert('已保存裁剪設置！');
        });
    }

    updateTimeDisplay() {
        const startInput = document.getElementById('startTime');
        const endInput = document.getElementById('endTime');
        
        startInput.value = this.formatTime(this.editStates.trim.start);
        endInput.value = this.formatTime(this.editStates.trim.end);
    }

    updateTimelineUI() {
        const video = document.querySelector('.preview');
        const startHandle = document.querySelector('.slider-handle.start');
        const endHandle = document.querySelector('.slider-handle.end');
        const range = document.querySelector('.slider-range');

        startHandle.style.left = `${(this.editStates.trim.start / video.duration) * 100}%`;
        endHandle.style.right = `${100 - (this.editStates.trim.end / video.duration) * 100}%`;
        range.style.left = `${(this.editStates.trim.start / video.duration) * 100}%`;
        range.style.right = `${100 - (this.editStates.trim.end / video.duration) * 100}%`;
    }

    formatTime(seconds) {
        const pad = (num) => String(num).padStart(2, '0');
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    }

    parseTimeInput(timeString) {
        if (!timeString.match(/^\d{2}:\d{2}:\d{2}$/)) {
            return 0;
        }
        const [hours, minutes, seconds] = timeString.split(':').map(Number);
        if (hours >= 0 && minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60) {
            return hours * 3600 + minutes * 60 + seconds;
        }
        return 0;
    }

    handleExport() {
        if (!this.currentVideoData) return;

        const format = document.getElementById('formatSelect').value;
        const editSettings = videoEditorStore.getAppliedSettings();
        editSettings.format = format;

        ipcRenderer.send('export-edited-video', {
            ...this.currentVideoData,
            settings: editSettings
        });
    }

    handleExportComplete({ success, outputPath, error }) {
        if (success) {
            alert('視頻輸出完成！');
            // 通知主窗口添加新視頻
            ipcRenderer.send('add-exported-video', {
                path: outputPath,
                originalFileName: `edited_${this.currentVideoData.originalFileName}`
            });
            // 關閉編輯器窗口
            window.close();
        } else {
            alert(`輸出失敗：${error}`);
        }
    }

    // 編輯功能處理方法
    handleTrim() {
        // 實現視頻裁剪功能
        console.log('Trim video');
    }

    handleCrop() {
        // 實現視頻剪裁功能
        console.log('Crop video');
    }

    handleRotate() {
        // 實現視頻旋轉功能
        console.log('Rotate video');
    }

    handleSpeed() {
        // 實現視頻速度調整功能
        console.log('Adjust video speed');
    }

    // 獲取各種編輯設置的方法
    getTrimSettings() {
        return {
            start: this.editStates.trim.start,
            end: this.editStates.trim.end,
            applied: this.editStates.trim.applied
        };
    }

    getCropSettings() {
        return {
            x: 0,
            y: 0,
            width: '100%',
            height: '100%'
        };
    }

    getRotateSettings() {
        return {
            angle: 0
        };
    }

    getSpeedSettings() {
        return {
            rate: 1.0
        };
    }

    showPanel(panelId) {
        const panels = document.querySelectorAll('.edit-panel');
        panels.forEach(panel => panel.classList.remove('active'));
        
        // 隱藏所有面板
        document.querySelector('.edit-panels').style.display = 'none';
        
        const targetPanel = document.getElementById(panelId);
        if (targetPanel) {
            document.querySelector('.edit-panels').style.display = 'block';
            targetPanel.classList.add('active');
        }

        // 移除所有按鈕的 active 狀態
        document.querySelectorAll('.control-group button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 為當前按鈕添加 active 狀態
        const currentBtn = document.querySelector(`button#${panelId.replace('Panel', 'Btn')}`);
        if (currentBtn) {
            currentBtn.classList.add('active');
        }
    }

    initializeFilterControls() {
        // 監聽濾鏡控制項的變化
        ['brightness', 'contrast', 'saturation', 'hue'].forEach(filter => {
            const control = document.getElementById(filter);
            control.addEventListener('input', () => {
                this.editStates.filters[filter] = control.value;
                videoEditorStore.setFilter(filter, control.value);
                this.applyFilters();
            });
        });

        // 預設濾鏡按鈕
        document.querySelectorAll('.preset-filters button').forEach(btn => {
            btn.onclick = () => this.applyPresetFilter(btn.dataset.filter);
        });
    }

    applyFilters() {
        const video = document.querySelector('.preview');
        const { brightness, contrast, saturation, hue } = this.editStates.filters;
        
        video.style.filter = `
            brightness(${brightness}%) 
            contrast(${contrast}%) 
            saturate(${saturation}%) 
            hue-rotate(${hue}deg)
        `;
    }

    applyPresetFilter(preset) {
        videoEditorStore.setFilterPreset(preset);
        this.updateFilterControls();
        this.applyFilters();
    }

    updateFilterControls() {
        const filters = videoEditorStore.editStates.filters;
        Object.entries(filters).forEach(([key, value]) => {
            const control = document.getElementById(key);
            if (control && typeof value === 'number') {
                control.value = value;
            }
        });
    }

    applyText() {
        const text = document.getElementById('textInput').value;
        const color = document.getElementById('textColor').value;
        const size = document.getElementById('fontSize').value;
        const opacity = document.getElementById('textOpacity').value;

        // 創建文字元素
        const textElement = document.createElement('div');
        textElement.className = 'text-overlay';
        textElement.textContent = text;
        textElement.style.color = color;
        textElement.style.fontSize = `${size}px`;
        textElement.style.opacity = opacity / 100;
        
        // 設置初始位置
        textElement.style.left = '50%';
        textElement.style.top = '50%';
        textElement.style.transform = 'translate(-50%, -50%)';

        // 添加拖動功能
        this.makeElementDraggable(textElement);

        // 添加到疊加層
        document.querySelector('.text-overlays').appendChild(textElement);

        videoEditorStore.addText({
            text,
            color,
            size,
            opacity: opacity / 100,
            position: { x: 50, y: 50 }
        });

        document.getElementById('textInput').value = '';
    }

    makeElementDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        element.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            const container = element.parentElement;
            const newTop = element.offsetTop - pos2;
            const newLeft = element.offsetLeft - pos1;
            
            // 限制在容器內
            element.style.top = `${Math.max(0, Math.min(newTop, container.offsetHeight - element.offsetHeight))}px`;
            element.style.left = `${Math.max(0, Math.min(newLeft, container.offsetWidth - element.offsetWidth))}px`;
            element.style.transform = 'none';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    initializeSpeedControls() {
        const video = document.querySelector('.preview');
        const speedRange = document.getElementById('speedRange');
        const speedValue = document.querySelector('.speed-value');
        const speedPresets = document.querySelectorAll('.speed-presets button');

        // 更新速度顯示
        const updateSpeedDisplay = (speed) => {
            speedValue.textContent = `${speed.toFixed(2)}x`;
            video.playbackRate = speed;
        };

        // 滑塊控制
        speedRange.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            updateSpeedDisplay(speed);
            
            // 更新預設按鈕狀態
            speedPresets.forEach(btn => {
                btn.classList.toggle('active', 
                    parseFloat(btn.dataset.speed) === speed);
            });
        });

        // 預設按鈕控制
        speedPresets.forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.dataset.speed);
                speedRange.value = speed;
                updateSpeedDisplay(speed);
                
                // 更新按鈕狀態
                speedPresets.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // 應用按鈕
        document.getElementById('applySpeed').addEventListener('click', () => {
            const speed = parseFloat(speedRange.value);
            videoEditorStore.setSpeedRate(speed);
            alert('已保存速度設置！');
        });
    }

    initializeRotateControls() {
        const videoWrapper = document.querySelector('.video-wrapper');
        const angleRange = document.getElementById('angleRange');
        const angleValue = document.querySelector('.angle-value');
        let currentRotation = 0;
        let currentFlipH = false;
        let currentFlipV = false;

        // 更新旋轉顯示
        const updateRotation = () => {
            const scaleX = currentFlipH ? -1 : 1;
            const scaleY = currentFlipV ? -1 : 1;
            videoWrapper.style.transform = `rotate(${currentRotation}deg) scale(${scaleX}, ${scaleY})`;
            angleValue.textContent = `${currentRotation}°`;
        };

        // 角度滑塊
        angleRange.addEventListener('input', (e) => {
            currentRotation = parseInt(e.target.value);
            updateRotation();
        });

        // 90度旋轉按鈕
        document.getElementById('rotateLeft').onclick = () => {
            currentRotation = (currentRotation - 90) % 360;
            angleRange.value = currentRotation;
            updateRotation();
        };

        document.getElementById('rotateRight').onclick = () => {
            currentRotation = (currentRotation + 90) % 360;
            angleRange.value = currentRotation;
            updateRotation();
        };

        // 翻轉按鈕
        document.getElementById('flipHorizontal').onclick = () => {
            currentFlipH = !currentFlipH;
            updateRotation();
        };

        document.getElementById('flipVertical').onclick = () => {
            currentFlipV = !currentFlipV;
            updateRotation();
        };
    }

    initializeVideoControls() {
        const video = document.querySelector('.preview');
        const container = document.querySelector('.video-container');
        const controls = document.querySelector('.custom-controls');
        const playPauseBtn = controls.querySelector('.play-pause');
        const progressBar = controls.querySelector('.progress-bar');
        const progressPlayed = controls.querySelector('.progress-played');
        const progressLoaded = controls.querySelector('.progress-loaded');
        const currentTime = controls.querySelector('.current-time');
        const totalTime = controls.querySelector('.total-time');
        const volumeBtn = controls.querySelector('.volume-btn');
        const volumeSlider = controls.querySelector('.volume-slider');
        const volumeLevel = controls.querySelector('.volume-level');
        const loopBtn = controls.querySelector('.loop-btn');
        const fullscreenBtn = controls.querySelector('.fullscreen-btn');

        // 更新播放/暫停按鈕狀態
        const updatePlayPauseState = (isPlaying) => {
            playPauseBtn.querySelector('.play-icon').style.display = 
                isPlaying ? 'none' : 'block';
            playPauseBtn.querySelector('.pause-icon').style.display = 
                isPlaying ? 'block' : 'none';
        };

        // 播放/暫停控制
        playPauseBtn.addEventListener('click', () => {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
            updatePlayPauseState(!video.paused);
        });

        // 視頻播放狀態變化監聽
        video.addEventListener('play', () => updatePlayPauseState(true));
        video.addEventListener('pause', () => updatePlayPauseState(false));
        video.addEventListener('ended', () => {
            if (!video.loop) {
                updatePlayPauseState(false);
            }
        });

        // 循環播放控制
        let isLooping = false;
        loopBtn.addEventListener('click', () => {
            isLooping = !isLooping;
            video.loop = isLooping;
            loopBtn.classList.toggle('active', isLooping);
        });

        // 初始化時檢查循環狀態
        video.addEventListener('loadedmetadata', () => {
            isLooping = video.loop;
            loopBtn.classList.toggle('active', isLooping);
        });

        // 進度條控制
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
        });

        // 更新進度
        video.addEventListener('timeupdate', () => {
            const percent = (video.currentTime / video.duration) * 100;
            progressPlayed.style.width = `${percent}%`;
            currentTime.textContent = this.formatTime(video.currentTime);
        });

        // 更新緩衝進度
        video.addEventListener('progress', () => {
            if (video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                const duration = video.duration;
                progressLoaded.style.width = `${(bufferedEnd / duration) * 100}%`;
            }
        });

        // 音量控制
        volumeSlider.addEventListener('click', (e) => {
            const rect = volumeSlider.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.volume = pos;
            volumeLevel.style.width = `${pos * 100}%`;
        });

        // 靜音控制
        volumeBtn.addEventListener('click', () => {
            video.muted = !video.muted;
            volumeBtn.textContent = video.muted ? '🔇' : '🔊';
            volumeLevel.style.width = video.muted ? '0%' : `${video.volume * 100}%`;
        });

        // 全螢幕控制
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                container.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });

        // 載入時設置總時長
        video.addEventListener('loadedmetadata', () => {
            totalTime.textContent = this.formatTime(video.duration);
        });
    }

    initializeSubtitleControls() {
        const video = document.querySelector('.preview');
        const subtitleInput = document.getElementById('subtitleInput');
        const startTimeInput = document.getElementById('subtitleStart');
        const endTimeInput = document.getElementById('subtitleEnd');
        const colorInput = document.getElementById('subtitleColor');
        const sizeInput = document.getElementById('subtitleSize');
        const xInput = document.getElementById('subtitleX');
        const yInput = document.getElementById('subtitleY');
        
        // 添加字幕
        document.getElementById('applySubtitle').addEventListener('click', () => {
            const subtitle = {
                text: subtitleInput.value,
                startTime: this.parseTimeInput(startTimeInput.value),
                endTime: this.parseTimeInput(endTimeInput.value),
                color: colorInput.value,
                size: parseInt(sizeInput.value),
                position: {
                    x: parseInt(xInput.value),
                    y: parseInt(yInput.value)
                }
            };
            
            // 創建字幕元素
            const subtitleElement = document.createElement('div');
            subtitleElement.className = 'subtitle-overlay';
            subtitleElement.textContent = subtitle.text;
            subtitleElement.style.color = subtitle.color;
            subtitleElement.style.fontSize = `${subtitle.size}px`;
            subtitleElement.style.left = `${subtitle.position.x}%`;
            subtitleElement.style.top = `${subtitle.position.y}%`;
            
            document.querySelector('.subtitle-overlays').appendChild(subtitleElement);
            
            // 保存到 store
            videoEditorStore.addSubtitle(subtitle);
            
            // 清空輸入
            subtitleInput.value = '';
        });
        
        // 預覽字幕
        document.getElementById('previewSubtitle').addEventListener('click', () => {
            const previewElement = document.createElement('div');
            previewElement.className = 'subtitle-overlay preview';
            previewElement.textContent = subtitleInput.value;
            previewElement.style.color = colorInput.value;
            previewElement.style.fontSize = `${sizeInput.value}px`;
            previewElement.style.left = `${xInput.value}%`;
            previewElement.style.top = `${yInput.value}%`;
            
            const container = document.querySelector('.subtitle-overlays');
            const existingPreview = container.querySelector('.preview');
            if (existingPreview) {
                container.removeChild(existingPreview);
            }
            container.appendChild(previewElement);
            
            // 3秒後移除預覽
            setTimeout(() => {
                if (previewElement.parentNode) {
                    previewElement.parentNode.removeChild(previewElement);
                }
            }, 3000);
        });
    }

    initializePositionControls() {
        const videoWrapper = document.querySelector('.video-wrapper');
        const video = document.querySelector('.preview');
        
        // 獲取所有控制元素
        const positionX = document.getElementById('positionX');
        const positionY = document.getElementById('positionY');
        const positionXRange = document.getElementById('positionXRange');
        const positionYRange = document.getElementById('positionYRange');
        const scale = document.getElementById('scale');
        const scaleRange = document.getElementById('scaleRange');
        
        // 更新位置和縮放
        const updateTransform = () => {
            const x = positionX.value;
            const y = positionY.value;
            const s = scale.value / 100;
            
            video.style.transform = `translate(${x - 50}%, ${y - 50}%) scale(${s})`;
        };
        
        // 同步數字輸入和滑塊
        const syncInputs = (input, range) => {
            input.addEventListener('input', () => {
                range.value = input.value;
                updateTransform();
            });
            
            range.addEventListener('input', () => {
                input.value = range.value;
                updateTransform();
            });
        };
        
        // 綁定所有輸入控制
        syncInputs(positionX, positionXRange);
        syncInputs(positionY, positionYRange);
        syncInputs(scale, scaleRange);
        
        // 預設位置按鈕
        document.querySelectorAll('.preset-positions button').forEach(btn => {
            btn.addEventListener('click', () => {
                switch(btn.dataset.position) {
                    case 'center':
                        positionX.value = positionXRange.value = 50;
                        positionY.value = positionYRange.value = 50;
                        break;
                    case 'reset':
                        positionX.value = positionXRange.value = 50;
                        positionY.value = positionYRange.value = 50;
                        scale.value = scaleRange.value = 100;
                        break;
                }
                updateTransform();
            });
        });
    }
}

// 創建編輯器實例
const editor = new VideoEditor(); 