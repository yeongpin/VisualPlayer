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
            ? `圖片 ${index + 1}` 
            : `視頻 ${index + 1}`;
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
        // 直接使用視頻作為縮略圖
        thumbnail.src = videoData.video.src;
        thumbnail.muted = true;
        thumbnail.loop = false;
        thumbnail.controls = false;
        
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
    title.textContent = videoData.isImage ? `圖片 ${index + 1}` : `視頻 ${index + 1}`;
    
    const details = document.createElement('div');
    details.className = 'card-details';
    details.textContent = videoData.video.dataset.originalFileName;
    
    info.appendChild(title);
    info.appendChild(details);

    // 創建操作按鈕容器
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    // 只在非圖片文件時創建播放按鈕
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

        // 添加播放按鈕到操作區
        actions.appendChild(playBtn);
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

    // ���加其他按鈕
    actions.appendChild(toggleVisibleBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(flipXBtn);
    actions.appendChild(flipYBtn);
    actions.appendChild(resizeBtn);
    actions.appendChild(filterBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(thumbnail);
    card.appendChild(info);
    card.appendChild(actions);
    
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