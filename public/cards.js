// 格式化時間顯示
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const { ipcRenderer } = require('electron');
const remote = require('@electron/remote');
const { createSvgIcon } = require('./icons.js');

const cardsContainer = document.querySelector('.cards-container');
const closeButton = document.querySelector('.close-button');
const refreshButton = document.querySelector('.refresh-button');

let videos = []; // 保存視頻數據的引用
let videoStates = new Map(); // 用於保存每個視頻的狀態

// 添加刷新按鈕事件
refreshButton.onclick = () => {
    ipcRenderer.send('request-videos-data');
};

// 添加全局事件監聽器
ipcRenderer.on('receive-filter-values', (event, { index, filterValues }) => {
    const videoData = videos[index];
    if (videoData) {
        // 創建濾鏡窗口，使用接收到的 filterValues
        ipcRenderer.send('create-filter-window', {
            title: videoData.video.dataset.originalFileName,
            filterData: filterValues
        });
    }
});

// 接收主進程發送的數據
ipcRenderer.on('cards-data', (event, { videos: videoData }) => {
    console.log('Received cards data:', videoData); // 調試用
    
    // 清空所有卡片
    cardsContainer.innerHTML = '';
    videos = videoData;
    
    // 為每個視頻創建卡片
    videoData.forEach((data, index) => {
        createCard(data, index);
    });
});

// 更新卡片列表
ipcRenderer.on('update-cards', (event, { videos: videoData }) => {
    console.log('Updating cards:', videoData); // 調試用
    
    // 清空現有卡片
    cardsContainer.innerHTML = '';
    videos = videoData;
    
    // 為每個視頻創建卡片
    videoData.forEach((data, index) => {
        createCard(data, index);
    });
});

// 更新卡片索引的輔助函數
function updateCardIndex(card, index) {
    const title = card.querySelector('.card-title');
    if (title) {
        title.textContent = title.textContent.includes('圖片') 
            ? `Image ${index + 1}` 
            : `Video ${index + 1}`;
    }
}

// 創建單個卡片的函數
function createCard(videoData, index) {
    const card = document.createElement('div');
    card.className = 'video-card';
    
    // 創建縮略圖
    const thumbnail = document.createElement(videoData.isImage ? 'img' : 'video');
    thumbnail.className = 'thumbnail';
    if (!videoData.isImage) {
        // 创建所有控制元素
        const progress = document.createElement('div');
        progress.className = 'video-progress';
        
        // 创建时间显示元素
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'video-time';
        timeDisplay.textContent = '00:00 / 00:00';
        
        const timeRange = document.createElement('div');
        timeRange.className = 'time-range';
        
        const startMask = document.createElement('div');
        startMask.className = 'time-mask start-mask';
        
        const endMask = document.createElement('div');
        endMask.className = 'time-mask end-mask';
        
        const startHandle = document.createElement('div');
        startHandle.className = 'time-handle start-handle';
        startHandle.title = '設置起始時間';
        
        const endHandle = document.createElement('div');
        endHandle.className = 'time-handle end-handle';
        endHandle.title = '設置結束時間';
        
        // 定义更新时间范围显示的函数
        const updateTimeRange = () => {
            const duration = thumbnail.duration || 0;
            const startPos = Math.max(0, Math.min(100, (videoData.video.startTime / duration) * 100));
            const endPos = videoData.video.endTime ? Math.min(100, (videoData.video.endTime / duration) * 100) : 100;
            
            startHandle.style.left = `${startPos}%`;
            endHandle.style.left = `${endPos}%`;
            timeRange.style.left = `${startPos}%`;
            timeRange.style.width = `${endPos - startPos}%`;
            
            startMask.style.width = `${startPos}%`;
            endMask.style.width = `${100 - endPos}%`;
        };
        
        // 直接使用視頻作為縮略圖
        thumbnail.src = videoData.video.src;
        thumbnail.muted = true;
        thumbnail.loop = false;
        thumbnail.controls = false;
        
        // 等待視頻加載完成
        thumbnail.addEventListener('loadedmetadata', () => {
            // 初始化視頻屬性
            videoData.video = {
                ...videoData.video,
                startTime: 0,
                endTime: undefined,
                duration: thumbnail.duration,
                currentTime: 0
            };
            
            // 初始化時間範圍顯示
            updateTimeRange();
            
            // 更新時間顯示
            timeDisplay.textContent = `00:00 / ${formatTime(thumbnail.duration)}`;
        });
        
        // 設置視頻時間到中間位置
        thumbnail.addEventListener('loadedmetadata', () => {
            thumbnail.currentTime = thumbnail.duration / 2;
        });
        
        // 暫停在指定幀
        thumbnail.addEventListener('seeked', () => {
            thumbnail.pause();
        });
    } else {
        thumbnail.src = videoData.video.src;
    }
    
    // 創建信息區域
    const info = document.createElement('div');
    info.className = 'card-info';
    
    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = videoData.isImage ? `Image ${index + 1}` : `Video ${index + 1}`;
    
    const details = document.createElement('div');
    details.className = 'card-details';
    details.textContent = videoData.video.dataset.originalFileName;
    
    info.appendChild(title);
    info.appendChild(details);

    // 創建操作按鈕容器
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    // 只在非圖片文件時創建播放按鈕和編輯按鈕
    if (!videoData.isImage) {
        const playBtn = document.createElement('button');
        playBtn.className = 'action-button play-button';
        playBtn.title = '播放/暫停';
        playBtn.innerHTML = createSvgIcon(videoData.video.paused ? 'play' : 'pause');

        playBtn.onclick = (e) => {
            e.stopPropagation();
            ipcRenderer.send('toggle-play', index);
            ipcRenderer.once('video-play-state', (event, { index: videoIndex, isPlaying }) => {
                if (videoIndex === index) {
                    playBtn.innerHTML = isPlaying ? createSvgIcon('pause') : createSvgIcon('play');
                }
            });
        };

        // 添加視頻編輯按鈕
        const editBtn = document.createElement('button');
        editBtn.className = 'action-button edit-button';
        editBtn.title = '編輯視頻';
        editBtn.innerHTML = createSvgIcon('edit');  // 需要在 icons.js 中添加編輯圖標
        
        editBtn.onclick = (e) => {
            e.stopPropagation();
            // 發送打開編輯器窗口的請求
            ipcRenderer.send('open-video-editor', {
                index,
                videoPath: videoData.video.src,
                originalFileName: videoData.video.dataset.originalFileName
            });
        };

        // 添加按鈕到操作區
        actions.appendChild(playBtn);
        actions.appendChild(editBtn);
    }

    // 添加顯示/隱藏按鈕
    const toggleVisibleBtn = document.createElement('button');
    toggleVisibleBtn.className = 'action-button toggle-visible';
    toggleVisibleBtn.title = '顯示/隱藏';

    // 優先使用保存的狀態，如果沒有則使用傳入的狀態
    const isHidden = videoStates.has(videoData.video.src) 
        ? videoStates.get(videoData.video.src)
        : (videoData.isHidden || (videoData.wrapper && videoData.wrapper.style.display === 'none'));
    
    if (isHidden) {
        toggleVisibleBtn.classList.add('hidden');
    }
    toggleVisibleBtn.innerHTML = isHidden ? createSvgIcon('hidden') : createSvgIcon('visible');

    toggleVisibleBtn.onclick = (e) => {
        e.stopPropagation();
        const newHiddenState = !toggleVisibleBtn.classList.contains('hidden');
        videoStates.set(videoData.video.src, newHiddenState);
        ipcRenderer.send('toggle-visible', index);
        toggleVisibleBtn.classList.toggle('hidden');
        toggleVisibleBtn.innerHTML = toggleVisibleBtn.classList.contains('hidden') 
            ? createSvgIcon('hidden') 
            : createSvgIcon('visible');
    };

    // 重置按鈕
    const resetBtn = document.createElement('button');
    resetBtn.className = 'action-button reset';
    resetBtn.title = '重置大小和旋轉';
    resetBtn.innerHTML = createSvgIcon('reset');
    resetBtn.onclick = (e) => {
        e.stopPropagation();
        ipcRenderer.send('reset-transform', index);
    };

    // 水平翻轉按鈕
    const flipXBtn = document.createElement('button');
    flipXBtn.className = 'action-button flip-x';
    flipXBtn.title = '水平翻轉';
    flipXBtn.innerHTML = createSvgIcon('flipX');
    flipXBtn.onclick = (e) => {
        e.stopPropagation();
        ipcRenderer.send('flip-x', index);
    };

    // 垂直翻轉按鈕
    const flipYBtn = document.createElement('button');
    flipYBtn.className = 'action-button flip-y';
    flipYBtn.title = '垂直翻轉';
    flipYBtn.innerHTML = createSvgIcon('flipY');
    flipYBtn.onclick = (e) => {
        e.stopPropagation();
        ipcRenderer.send('flip-y', index);
    };

    // 調整大小按鈕
    const resizeBtn = document.createElement('button');
    resizeBtn.className = 'action-button resize';
    resizeBtn.title = '調整大小';
    resizeBtn.innerHTML = createSvgIcon('resize');
    resizeBtn.onclick = (e) => {
        e.stopPropagation();
        ipcRenderer.send('resize-media', index);
    };

    // 濾鏡按鈕
    const filterBtn = document.createElement('button');
    filterBtn.className = 'action-button filter';
    filterBtn.title = '打開濾鏡設置';
    filterBtn.innerHTML = createSvgIcon('filter');
    filterBtn.onclick = (e) => {
        e.stopPropagation();
        ipcRenderer.send('focus-media', index);
        ipcRenderer.send('request-filter-values', index);
    };

    // 刪除按鈕
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-button delete';
    deleteBtn.title = '刪除';
    deleteBtn.innerHTML = createSvgIcon('delete');
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm('確定要刪除這個項目嗎？')) {
            ipcRenderer.send('delete-media', index);
            card.remove();
            videos.splice(index, 1);
            Array.from(cardsContainer.children).forEach((card, i) => {
                updateCardIndex(card, i);
            });
        }
    };

    // 添加其他按鈕
    actions.appendChild(toggleVisibleBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(flipXBtn);
    actions.appendChild(flipYBtn);
    actions.appendChild(resizeBtn);
    actions.appendChild(filterBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(thumbnail);
    card.appendChild(info);
    
    // 創建網格容器
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid';
    
    // 添加操作按鈕和視頻控制到網格
    gridContainer.appendChild(actions);
    
    // 為視頻添加控制面板
    if (!videoData.isImage) {
        const controlsPanel = document.createElement('div');
        controlsPanel.className = 'video-controls-panel';
        
        // 進度條和時間顯示
        const progressRow = document.createElement('div');
        progressRow.className = 'video-controls-time-row';
        
        const progress = document.createElement('div');
        progress.className = 'video-progress';
        
        // 添加時間範圍控制
        const timeRange = document.createElement('div');
        timeRange.className = 'time-range';
        
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
        
        const progressPlayed = document.createElement('div');
        progressPlayed.className = 'video-progress-played';
        
        // 更新時間範圍顯示的函數
        const updateTimeRange = () => {
            const duration = videoData.video.duration || 0;
            const startPos = Math.max(0, Math.min(100, (videoData.video.startTime / duration) * 100));
            const endPos = videoData.video.endTime ? Math.min(100, (videoData.video.endTime / duration) * 100) : 100;
            
            startHandle.style.left = `${startPos}%`;
            endHandle.style.left = `${endPos}%`;
            timeRange.style.left = `${startPos}%`;
            timeRange.style.width = `${endPos - startPos}%`;
            
            startMask.style.width = `${startPos}%`;
            endMask.style.width = `${100 - endPos}%`;
        };
        
        progress.appendChild(startMask);
        progress.appendChild(endMask);
        progress.appendChild(timeRange);
        progress.appendChild(startHandle);
        progress.appendChild(endHandle);
        progress.appendChild(progressPlayed);
        
        // 處理控制拖動
        let isDragging = false;
        let activeHandle = null;
        
        const handleDrag = (e) => {
            if (!isDragging || !activeHandle) return;
            
            // 使用縮略圖的持續時間
            const duration = thumbnail.duration;
            if (!duration) {
                console.log('Video duration not available yet');
                return;
            }
            
            const rect = progress.getBoundingClientRect();
            // 确保拖动不会超出进度条
            const x = Math.max(rect.left, Math.min(rect.right, e.clientX));
            let pos = (x - rect.left) / rect.width;
            const time = pos * duration;
            console.log('Drag position:', pos, 'Calculated time:', time);
            
            if (activeHandle === startHandle) {
                // 起始時不能超過結束時間
                const maxTime = videoData.video.endTime || duration;
                videoData.video.startTime = Math.min(time, maxTime - 1);
                console.log('Setting start time to:', videoData.video.startTime);
                if (videoData.video.currentTime < videoData.video.startTime) {
                    videoData.video.currentTime = videoData.video.startTime;
                }
            } else {
                // 結束時間不能小於起始時間
                videoData.video.endTime = Math.max(time, videoData.video.startTime + 1);
                console.log('Setting end time to:', videoData.video.endTime);
            }
            
            updateTimeRange();
            // 發送時間範圍更新事件
            ipcRenderer.send('time-range-update', {
                index,
                startTime: videoData.video.startTime,
                endTime: videoData.video.endTime
            });
        };
        
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
        
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'video-time';
        timeDisplay.textContent = '00:00 / 00:00';
        
        progressRow.appendChild(progress);
        progressRow.appendChild(timeDisplay);
        
        // 控制按鈕
        const controlsRow = document.createElement('div');
        controlsRow.className = 'video-controls-action-row';
        
        // 創建控制按鈕的輔助函數
        const createControlButton = (icon, title) => {
            const btn = document.createElement('button');
            btn.className = 'video-control-btn';
            btn.title = title;
            btn.innerHTML = icon;
            return btn;
        };
        
        const skipBackward = createControlButton(createSvgIcon('skipBackward'), '上一幀');
        const playPause = createControlButton(
            createSvgIcon(videoData.video.paused ? 'play' : 'pause'),
            '播放/暫停'
        );
        const skipForward = createControlButton(createSvgIcon('skipForward'), '下一幀');
        const muteBtn = createControlButton(
            createSvgIcon('mute'),  // 預設顯示靜音圖標
            '靜音'
        );
        const loopBtn = createControlButton(
            createSvgIcon('loop'),
            '循環播放'
        );
        // 預設為 active 狀態
        loopBtn.classList.add('active');
        loopBtn.style.background = 'rgba(0, 102, 204, 0.5)';
        const resetTimeBtn = createControlButton(createSvgIcon('resetTimeRange'), '重設時間');
        
        // 監聽播放狀態變化
        const playStateHandler = (event, { index: videoIndex, isPlaying }) => {
            console.log('Received play state change:', { videoIndex, index, isPlaying });
            if (videoIndex === index) {
                playPause.innerHTML = isPlaying ? createSvgIcon('pause') : createSvgIcon('play');
            }
        };
        ipcRenderer.on('video-play-state', playStateHandler);
        
        // 監聽靜音狀態變化
        const muteStateHandler = (event, { index: videoIndex, isMuted }) => {
            console.log('Received mute state change:', { videoIndex, index, isMuted });
            if (videoIndex === index) {
                muteBtn.innerHTML = isMuted ? createSvgIcon('mute') : createSvgIcon('unmute');
                muteBtn.classList.toggle('muted', isMuted);
            }
        };
        ipcRenderer.on('video-mute-changed', muteStateHandler);
        
        // 監聽循環狀態變化
        const loopStateHandler = (event, { index: videoIndex, isLooping }) => {
            console.log('Received loop state change:', { videoIndex, index, isLooping });
            if (videoIndex === index) {
                loopBtn.classList.toggle('active', isLooping);
                // 更新按鈕樣式
                if (isLooping) {
                    loopBtn.style.background = 'rgba(0, 102, 204, 0.5)';
                } else {
                    loopBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                }
            }
        };
        ipcRenderer.on('video-loop-changed', loopStateHandler);
        
        // 監聽時間更新
        const timeUpdateHandler = (event, { index: videoIndex, currentTime, duration }) => {
            if (videoIndex === index) {
                const played = (currentTime / duration) * 100;
                progressPlayed.style.width = `${played}%`;
                timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
                // 更新時間範圍顯示
                updateTimeRange();
            }
        };
        ipcRenderer.on('video-time-update', timeUpdateHandler);
        
        // 監聽時間範圍更新
        const timeRangeHandler = (event, { index: videoIndex, startTime, endTime }) => {
            console.log('Received time range update:', { videoIndex, index, startTime, endTime });
            if (videoIndex === index) {
                videoData.video.startTime = startTime;
                videoData.video.endTime = endTime;
                updateTimeRange();
            }
        };
        ipcRenderer.on('time-range-update', timeRangeHandler);
        
        // 監聽重置時間範圍
        const resetTimeRangeHandler = (event, { index: videoIndex }) => {
            console.log('Received reset time range:', { videoIndex, index });
            if (videoIndex === index) {
                videoData.video.startTime = 0;
                videoData.video.endTime = undefined;
                updateTimeRange();
            }
        };
        ipcRenderer.on('reset-time-range', resetTimeRangeHandler);
        
        // 在卡片被移除時清理事件監聽器
        const cleanup = () => {
            ipcRenderer.removeListener('video-play-state', playStateHandler);
            ipcRenderer.removeListener('video-mute-changed', muteStateHandler);
            ipcRenderer.removeListener('video-loop-changed', loopStateHandler);
            ipcRenderer.removeListener('video-time-update', timeUpdateHandler);
            ipcRenderer.removeListener('time-range-update', timeRangeHandler);
            ipcRenderer.removeListener('reset-time-range', resetTimeRangeHandler);
        };
        
        // 將清理函數添加到卡片元素上
        card.cleanup = cleanup;
        
        // 添加播放/暫停按鈕事件
        playPause.onclick = (e) => {
            e.stopPropagation();
            console.log('Sending toggle play:', index);
            ipcRenderer.send('toggle-play', index);
        };
        
        // 添加靜音按鈕事件
        muteBtn.onclick = (e) => {
            e.stopPropagation();
            console.log('Sending toggle mute:', index);
            ipcRenderer.send('toggle-mute', index);
            // 立即更新按鈕狀態
            const currentState = muteBtn.classList.contains('muted');
            muteBtn.innerHTML = currentState ? createSvgIcon('unmute') : createSvgIcon('mute');
            muteBtn.classList.toggle('muted');
        };
        
        // 添加循環播放按鈕事件
        loopBtn.onclick = (e) => {
            e.stopPropagation();
            console.log('Sending toggle loop:', index);            ipcRenderer.send('toggle-loop', index);
            // 立即更新按鈕狀態
            const currentState = loopBtn.classList.contains('active');
            loopBtn.classList.toggle('active');
            loopBtn.style.background = currentState ? 
                'rgba(255, 255, 255, 0.1)' : 
                'rgba(0, 102, 204, 0.5)';
        };
        
        // 添加前後幀按鈕事件
        skipBackward.onclick = (e) => {
            e.stopPropagation();
            console.log('Sending skip backward:', index);
            ipcRenderer.send('video-skipprev', index );
        };
        
        skipForward.onclick = (e) => {
            e.stopPropagation();
            console.log('Sending skip forward:', index);
            ipcRenderer.send('video-skipnext',  index );
        };
        
        // 添加重設時間按鈕事件
        resetTimeBtn.onclick = (e) => {
            e.stopPropagation();
            console.log('Sending reset time:', index);
            ipcRenderer.send('reset-time-range', { index });
            // 立即更新本地顯示
            videoData.video.startTime = 0;
            videoData.video.endTime = undefined;
            updateTimeRange();
        };
        
        // 進度條點擊事件
        progress.onclick = (e) => {
            e.stopPropagation();
            console.log('Progress bar clicked');
            
            // 使用縮略圖的持續時間
            const duration = thumbnail.duration;
            if (!duration) {
                console.log('Video duration not available yet');
                return;
            }
            
            const rect = progress.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            const time = pos * duration;
            
            // 確保在設定的時間範圍內
            if (time >= videoData.video.startTime && 
                (!videoData.video.endTime || time <= videoData.video.endTime)) {
                console.log('Time is within range, seeking to:', time);
                // 更新进度条显示
                progressPlayed.style.width = `${(time / duration) * 100}%`;
                ipcRenderer.send('video-seek-to', { 
                    index, 
                    currentTime: time,
                    duration: duration
                });
            }
        };

        controlsRow.appendChild(skipBackward);
        controlsRow.appendChild(playPause);
        controlsRow.appendChild(skipForward);
        controlsRow.appendChild(muteBtn);
        controlsRow.appendChild(loopBtn);
        controlsRow.appendChild(resetTimeBtn);
        
        controlsPanel.appendChild(progressRow);
        controlsPanel.appendChild(controlsRow);
        
        gridContainer.appendChild(controlsPanel);
    }
    
    card.appendChild(gridContainer);
    
    // 點擊卡片時聚焦對應的視頻/圖片
    card.onclick = () => {
        ipcRenderer.send('focus-media', index);
    };
    
    cardsContainer.appendChild(card);
}

// 關閉按鈕事件
closeButton.onclick = () => {
    const window = remote.getCurrentWindow();
    window.close();
};

// 添加保存布局按鈕事件
const saveLayoutBtn = document.querySelector('.saveLayout-button');
saveLayoutBtn.onclick = () => {
    ipcRenderer.send('save-layout');
};

// 加載布局按鈕事件
const loadLayoutBtn = document.querySelector('.loadLayout-button');
loadLayoutBtn.onclick = () => {
    ipcRenderer.send('load-layout');
};

// 添加快捷鍵支持
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        ipcRenderer.send('save-layout');
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        ipcRenderer.send('load-layout');
    }
});

// 初始化按鈕圖標

document.querySelector('.saveLayout-button').innerHTML = createSvgIcon('save');
document.querySelector('.loadLayout-button').innerHTML = createSvgIcon('load');
document.querySelector('.refresh-button').innerHTML = createSvgIcon('refresh');
document.querySelector('.close-button').innerHTML = createSvgIcon('close');

// 監聽視頻播放狀態變化
ipcRenderer.on('video-play-state', (event, { index, isPlaying }) => {
    // 找到對應的卡片
    const card = cardsContainer.children[index];
    if (card) {
        // 找到播放按鈕
        const playBtn = card.querySelector('.play-button');
        if (playBtn) {
            // 更新按鈕圖標
            playBtn.innerHTML = isPlaying ? createSvgIcon('pause') : createSvgIcon('play');
        }
    }
}); 