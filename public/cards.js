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
let isDragging = false;
let activeHandle = null;
let thumbnailCache = new Map(); // 缩略图缓存
let selectedCards = new Set(); // 保存選中的卡片索引

// 添加刷新按鈕事件
refreshButton.onclick = () => {
    ipcRenderer.send('request-videos-data');
};

// 批量操作相關元素
const selectAllCheckbox = document.getElementById('selectAll');
const deleteSelectedBtn = document.getElementById('deleteSelected');
const selectionCountSpan = document.getElementById('selectionCount');

// 更新選擇狀態顯示
function updateSelectionDisplay() {
    const selectedCount = selectedCards.size;
    const totalCount = videos.length;
    
    // 更新全選checkbox狀態
    if (selectedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (selectedCount === totalCount) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
    
    // 更新刪除按鈕狀態
    deleteSelectedBtn.disabled = selectedCount === 0;
    deleteSelectedBtn.textContent = selectedCount > 0 
        ? `刪除選中項 (${selectedCount})` 
        : '刪除選中項 (0)';
    
    // 更新選擇信息
    if (selectedCount === 0) {
        selectionCountSpan.textContent = '未選中任何項目';
    } else {
        selectionCountSpan.textContent = `已選中 ${selectedCount} / ${totalCount} 項`;
    }
}

// 全選/取消全選事件
selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    
    if (isChecked) {
        // 全選
        selectedCards.clear();
        videos.forEach((_, index) => {
            selectedCards.add(index);
        });
    } else {
        // 取消全選
        selectedCards.clear();
    }
    
    // 更新所有卡片的視覺狀態
    updateAllCardsSelection();
    updateSelectionDisplay();
});

// 批量刪除事件
deleteSelectedBtn.addEventListener('click', () => {
    const selectedCount = selectedCards.size;
    if (selectedCount === 0) return;
    
    const confirmMessage = `確定要刪除選中的 ${selectedCount} 個項目嗎？此操作無法撤銷。`;
    if (confirm(confirmMessage)) {
        // 轉換為數組並排序（從大到小，避免索引問題）
        const selectedIndices = Array.from(selectedCards).sort((a, b) => b - a);
        
        // 發送批量刪除請求
        ipcRenderer.send('batch-delete-media', selectedIndices);
        
        // 清空選中狀態
        selectedCards.clear();
        updateSelectionDisplay();
    }
});

// 更新所有卡片的選中狀態
function updateAllCardsSelection() {
    const cards = cardsContainer.querySelectorAll('.video-card');
    cards.forEach((card, index) => {
        const checkbox = card.querySelector('.card-checkbox');
        const isSelected = selectedCards.has(index);
        
        if (checkbox) {
            checkbox.checked = isSelected;
        }
        card.classList.toggle('selected', isSelected);
    });
}

// 请求加载缓存的缩略图
ipcRenderer.send('load-thumbnails');

// 接收缓存的缩略图
ipcRenderer.on('thumbnails-loaded', (event, cachedThumbnails) => {
    if (cachedThumbnails && typeof cachedThumbnails === 'object') {
        Object.keys(cachedThumbnails).forEach(key => {
            thumbnailCache.set(key, cachedThumbnails[key]);
        });
        console.log('Loaded thumbnails from cache:', thumbnailCache.size);
    }
});

// 接收单个缩略图
ipcRenderer.on('thumbnail-loaded', (event, { key, url }) => {
    if (key && url) {
        thumbnailCache.set(key, url);
        
        // 更新已显示的缩略图
        const cards = document.querySelectorAll('.video-card');
        cards.forEach(card => {
            const thumbnail = card.querySelector('.thumbnail');
            if (thumbnail && thumbnail.tagName === 'VIDEO') {
                const src = thumbnail.src;
                if (src === key) {
                    // 替换为缓存的图片
                    const cachedImg = document.createElement('img');
                    cachedImg.src = url;
                    cachedImg.className = 'thumbnail';
                    cachedImg.style.objectFit = 'cover';
                    thumbnail.parentNode.replaceChild(cachedImg, thumbnail);
                }
            }
        });
    }
});

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
    
    // 检查是否是首次加载
    if (cardsContainer.children.length === 0) {
        // 首次加载，创建所有卡片
        preloadThumbnails(videoData);
        videos = videoData;
        videoData.forEach((data, index) => {
            createCard(data, index);
        });
    } else {
        // 非首次加载，使用智能更新
        updateCardsList(videoData);
    }
});

// 更新卡片列表
ipcRenderer.on('update-cards', (event, { videos: videoData }) => {
    console.log('Updating cards:', videoData); // 調試用
    
    // 智能更新卡片列表，而不是完全重建
    updateCardsList(videoData);
});

// 智能更新卡片列表
function updateCardsList(videoData) {
    // 保存原始视频数据的引用
    const oldVideos = [...videos];
    
    // 更新视频数据引用
    videos = videoData;
    
    // 预加载缩略图
    preloadThumbnails(videoData);
    
    // 获取当前卡片数量
    const currentCards = cardsContainer.querySelectorAll('.video-card');
    const currentCount = currentCards.length;
    const newCount = videoData.length;
    
    // 检查是否只是添加了新视频
    const isJustAddingNewVideos = newCount > currentCount && 
        oldVideos.every((oldVideo, index) => {
            // 检查旧视频是否仍然存在于相同位置
            return index < videoData.length && 
                   oldVideo.video.src === videoData[index].video.src;
        });
    
    if (isJustAddingNewVideos) {
        console.log('只添加新视频，保持现有顺序');
        // 只添加新视频，保持现有顺序
        for (let i = currentCount; i < newCount; i++) {
            createCard(videoData[i], i);
        }
        return;
    }
    
    if (newCount > currentCount) {
        // 有新卡片添加，只添加新卡片
        for (let i = currentCount; i < newCount; i++) {
            createCard(videoData[i], i);
        }
        
        // 更新现有卡片的索引和标题
        currentCards.forEach((card, index) => {
            card.dataset.index = index;
            updateCardTitle(card, index, videoData[index].isImage);
        });
        
        // 更新選中狀態顯示
        updateSelectionDisplay();
    } else if (newCount < currentCount) {
        // 有卡片被删除，移除多余的卡片
        for (let i = currentCount - 1; i >= newCount; i--) {
            if (cardsContainer.children[i]) {
                // 清理選中狀態
                selectedCards.delete(i);
                cardsContainer.removeChild(cardsContainer.children[i]);
            }
        }
        
        // 重新整理選中狀態的索引
        const newSelectedCards = new Set();
        selectedCards.forEach(index => {
            if (index < newCount) {
                newSelectedCards.add(index);
            }
        });
        selectedCards = newSelectedCards;
        
        // 更新剩余卡片
        for (let i = 0; i < newCount; i++) {
            const card = cardsContainer.children[i];
            if (card) {
                card.dataset.index = i;
                updateCardTitle(card, i, videoData[i].isImage);
                updateCardThumbnail(card, videoData[i]);
            }
        }
    } else {
        // 检查是否有顺序变化
        const hasOrderChanged = videoData.some((video, index) => {
            return index < oldVideos.length && 
                   video.video.src !== oldVideos[index].video.src;
        });
        
        if (!hasOrderChanged) {
            console.log('视频顺序未变化，跳过更新');
            return;
        }
        
        // 卡片数量相同，可能只是顺序或内容变化
        for (let i = 0; i < newCount; i++) {
            const card = cardsContainer.children[i];
            if (card) {
                card.dataset.index = i;
                updateCardTitle(card, i, videoData[i].isImage);
                updateCardThumbnail(card, videoData[i]);
            }
        }
        
        // 更新選中狀態顯示
        updateSelectionDisplay();
    }
    
    // 確保所有卡片都有正確的選中狀態
    updateAllCardsSelection();
}

// 更新卡片标题
function updateCardTitle(card, index, isImage) {
    const title = card.querySelector('.card-title');
    if (title) {
        title.textContent = isImage ? `Image ${index + 1}` : `Video ${index + 1}`;
    }
}

// 更新卡片缩略图
function updateCardThumbnail(card, videoData) {
    const thumbnail = card.querySelector('.thumbnail');
    if (thumbnail) {
        // 检查是否需要更新缩略图
        const currentSrc = thumbnail.src;
        const newSrc = videoData.video.src;
        
        // 如果源相同，不需要更新
        if (currentSrc === newSrc) {
            return;
        }
        
        // 源已更改，需要更新缩略图
        console.log('更新缩略图:', currentSrc, '->', newSrc);
        
        // 保存当前缩略图的位置和尺寸，以便平滑过渡
        const rect = thumbnail.getBoundingClientRect();
        
        if (videoData.isImage) {
            // 图片直接更新源
            thumbnail.src = newSrc;
        } else {
            // 视频检查缓存
            const cacheKey = newSrc;
            if (thumbnailCache.has(cacheKey)) {
                // 使用缓存的缩略图
                if (thumbnail.tagName !== 'IMG') {
                    // 替换为图片元素
                    const cachedImg = document.createElement('img');
                    cachedImg.src = thumbnailCache.get(cacheKey);
                    cachedImg.className = 'thumbnail';
                    cachedImg.style.objectFit = 'cover';
                    
                    // 应用平滑过渡
                    cachedImg.style.transition = 'opacity 0.3s';
                    cachedImg.style.opacity = '0';
                    
                    thumbnail.parentNode.replaceChild(cachedImg, thumbnail);
                    
                    // 延迟显示，创建平滑过渡
                    setTimeout(() => {
                        cachedImg.style.opacity = '1';
                    }, 50);
                } else {
                    // 已经是图片元素，只更新源
                    // 应用平滑过渡
                    thumbnail.style.transition = 'opacity 0.3s';
                    thumbnail.style.opacity = '0';
                    
                    thumbnail.src = thumbnailCache.get(cacheKey);
                    
                    // 图片加载完成后显示
                    thumbnail.onload = () => {
                        thumbnail.style.opacity = '1';
                    };
                }
            } else {
                // 没有缓存，使用视频元素
                if (thumbnail.tagName !== 'VIDEO') {
                    // 替换为视频元素
                    const videoEl = document.createElement('video');
                    videoEl.src = newSrc;
                    videoEl.className = 'thumbnail';
                    videoEl.muted = true;
                    videoEl.loop = false;
                    videoEl.controls = false;
                    
                    // 应用平滑过渡
                    videoEl.style.transition = 'opacity 0.3s';
                    videoEl.style.opacity = '0';
                    
                    thumbnail.parentNode.replaceChild(videoEl, thumbnail);
                    
                    // 生成缩略图
                    videoEl.addEventListener('loadeddata', () => {
                        if (videoEl.readyState >= 2) {
                            generateAndCacheThumbnail(videoEl, cacheKey);
                            videoEl.style.opacity = '1';
                        }
                    });
                } else {
                    // 已经是视频元素，只更新源
                    // 应用平滑过渡
                    thumbnail.style.transition = 'opacity 0.3s';
                    thumbnail.style.opacity = '0';
                    
                    thumbnail.src = newSrc;
                    
                    // 视频加载后显示
                    thumbnail.addEventListener('loadeddata', () => {
                        thumbnail.style.opacity = '1';
                    }, { once: true });
                }
            }
        }
        
        // 更新文件名
        const details = card.querySelector('.card-details');
        if (details) {
            details.textContent = videoData.video.dataset.originalFileName;
        }
    }
}

// 预加载缩略图
function preloadThumbnails(videoData) {
    // 对于每个视频，检查是否有缓存的缩略图
    videoData.forEach(data => {
        if (!data.isImage) {
            const cacheKey = data.video.src || data.video.currentSrc;
            if (!thumbnailCache.has(cacheKey)) {
                // 如果没有缓存，请求加载
                ipcRenderer.send('request-thumbnail', { key: cacheKey });
            }
        }
    });
}

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
    card.setAttribute('draggable', 'true');
    card.dataset.index = index;
    
    // 添加拖拽事件
    card.addEventListener('dragstart', (e) => {
        console.log('Dragstart event on card', index);
        // 确保拖拽事件能正常触发
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', index.toString());
        // 设置拖拽效果
        e.dataTransfer.effectAllowed = 'move';
        
        // 添加延时，确保拖拽样式能被应用
        setTimeout(() => {
            card.classList.add('dragging');
            console.log('Added dragging class');
        }, 0);
    });
    
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        console.log('Removed dragging class');
    });
    
    // 創建縮略圖
    const thumbnail = document.createElement(videoData.isImage ? 'img' : 'video');
    thumbnail.className = 'thumbnail';
    if (!videoData.isImage) {
        // 生成缓存键
        const cacheKey = videoData.video.src || videoData.video.currentSrc;
        
        // 检查缓存中是否有缩略图
        if (thumbnailCache.has(cacheKey)) {
            console.log('Using cached thumbnail for:', cacheKey);
            // 创建图片元素代替视频元素作为缩略图
            const cachedImg = document.createElement('img');
            cachedImg.src = thumbnailCache.get(cacheKey);
            cachedImg.className = 'thumbnail';
            cachedImg.style.objectFit = 'cover';
            
            // 替换缩略图元素
            thumbnail = cachedImg;
        } else {
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
            
            // 生成并缓存缩略图
            thumbnail.addEventListener('loadeddata', () => {
                if (thumbnail.readyState >= 2) {
                    generateAndCacheThumbnail(thumbnail, cacheKey);
                }
            });
        }
    } else {
        thumbnail.src = videoData.video.src;
    }
    
    // 創建選擇checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'card-checkbox';
    checkbox.checked = selectedCards.has(index);
    
    // checkbox事件處理
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation(); // 防止觸發卡片點擊事件
        
        if (e.target.checked) {
            selectedCards.add(index);
        } else {
            selectedCards.delete(index);
        }
        
        // 更新卡片視覺狀態
        card.classList.toggle('selected', e.target.checked);
        
        // 更新顯示
        updateSelectionDisplay();
    });

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

    // 創建縮放控制區域 (所有媒體都有)
    const scaleControl = document.createElement('div');
    scaleControl.className = 'scale-control';
    
    const scaleLabel = document.createElement('label');
    scaleLabel.textContent = 'Scale:';
    scaleLabel.className = 'scale-label';
    
    const scaleInput = document.createElement('input');
    scaleInput.type = 'number';
    scaleInput.className = 'scale-input';
    scaleInput.min = '0.1';
    scaleInput.max = '10';
    scaleInput.step = '0.1';
    // 獲取當前實際的scale值，如果沒有則默認為1.0
    const currentScale = videoData.scale || 1.0;
    scaleInput.value = currentScale.toFixed(1);
    scaleInput.dataset.currentScale = currentScale.toFixed(1);
    scaleInput.title = '縮放比例 (0.1-10.0)';
    
    // Scale輸入框事件處理
    scaleInput.addEventListener('change', (e) => {
        e.stopPropagation();
        const newScale = parseFloat(e.target.value);
        if (newScale >= 0.1 && newScale <= 10) {
            ipcRenderer.send('set-media-scale', { index, scale: newScale });
        } else {
            // 如果輸入無效，恢復到當前值
            e.target.value = scaleInput.dataset.currentScale || '1.0';
        }
    });
    
    scaleInput.addEventListener('keydown', (e) => {
        e.stopPropagation(); // 防止觸發其他快捷鍵
        if (e.key === 'Enter') {
            scaleInput.blur(); // 觸發change事件
        }
    });
    
    // 保存scale input的引用到卡片上，方便後續更新
    card.scaleInput = scaleInput;
    
    // 創建上下調節按鈕容器
    const scaleButtons = document.createElement('div');
    scaleButtons.className = 'scale-buttons';
    
    // 向上按鈕 (+0.1)
    const scaleUpBtn = document.createElement('button');
    scaleUpBtn.className = 'scale-btn scale-btn-up';
    scaleUpBtn.innerHTML = '▲';
    scaleUpBtn.title = '增加 0.1';
    scaleUpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentValue = parseFloat(scaleInput.value) || 1.0;
        const newValue = Math.min(10, currentValue + 0.1);
        scaleInput.value = newValue.toFixed(1);
        ipcRenderer.send('set-media-scale', { index, scale: newValue });
    });
    
    // 向下按鈕 (-0.1)
    const scaleDownBtn = document.createElement('button');
    scaleDownBtn.className = 'scale-btn scale-btn-down';
    scaleDownBtn.innerHTML = '▼';
    scaleDownBtn.title = '減少 0.1';
    scaleDownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentValue = parseFloat(scaleInput.value) || 1.0;
        const newValue = Math.max(0.1, currentValue - 0.1);
        scaleInput.value = newValue.toFixed(1);
        ipcRenderer.send('set-media-scale', { index, scale: newValue });
    });
    
    scaleButtons.appendChild(scaleUpBtn);
    scaleButtons.appendChild(scaleDownBtn);
    
    scaleControl.appendChild(scaleLabel);
    scaleControl.appendChild(scaleInput);
    scaleControl.appendChild(scaleButtons);
    
    // 將scale控制添加到actions的第一個位置
    actions.insertBefore(scaleControl, actions.firstChild);

    // 只在非圖片文件時創建編輯按鈕
    if (!videoData.isImage) {
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

        // 添加編輯按鈕到操作區
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
            // 簡單地發送刪除請求，不添加視覺反饋
            ipcRenderer.send('delete-media', index);
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

    card.appendChild(checkbox);
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

// 播放狀態變化已由下方視頻控制面板處理，這裡不再需要

// 監聽刪除操作確認
ipcRenderer.on('media-deleted', (event, { index, success }) => {
    console.log('Received delete confirmation:', { index, success });
    
    // 使用 dataset.index 來查找正確的卡片，而不是DOM位置
    const card = Array.from(cardsContainer.children).find(c => 
        parseInt(c.dataset.index) === index
    );
    
    if (card) {
        if (success) {
            // 刪除成功，清理事件監聽器
            if (card.cleanup) {
                card.cleanup();
            }
            
            // 從DOM中移除卡片
            card.remove();
            
            // 更新videos數組
            videos.splice(index, 1);
            
            // 清理選中狀態中被刪除的項目
            selectedCards.delete(index);
            
            // 重新整理選中狀態的索引（所有大於被刪除索引的都要減1）
            const newSelectedCards = new Set();
            selectedCards.forEach(selectedIndex => {
                if (selectedIndex > index) {
                    newSelectedCards.add(selectedIndex - 1);
                } else {
                    newSelectedCards.add(selectedIndex);
                }
            });
            selectedCards = newSelectedCards;
            
            // 更新剩餘卡片的索引
            Array.from(cardsContainer.children).forEach((remainingCard, i) => {
                remainingCard.dataset.index = i;
                updateCardIndex(remainingCard, i);
            });
            
            // 更新選中狀態顯示
            updateSelectionDisplay();
            updateAllCardsSelection();
            
            console.log('Media deleted successfully at index:', index);
        } else {
            // 刪除失敗，顯示錯誤提示
            alert('刪除失敗，請稍後重試');
            console.error('Failed to delete media at index:', index);
        }
    } else {
        console.warn('Card not found for index:', index);
    }
});

// 監聽刪除操作失敗
ipcRenderer.on('media-delete-failed', (event, { index, error }) => {
    console.error('Delete operation failed:', { index, error });
    
    // 顯示錯誤提示
    alert(`刪除失敗: ${error}`);
});

// 監聽批量刪除結果
ipcRenderer.on('batch-delete-completed', (event, { successCount, failCount, errors }) => {
    console.log('Batch delete completed:', { successCount, failCount, errors });
    
    // 清空選中狀態
    selectedCards.clear();
    updateSelectionDisplay();
    updateAllCardsSelection();
    
    // 顯示結果消息
    if (failCount === 0) {
        if (successCount === 1) {
            alert(`成功刪除 1 個項目`);
        } else {
            alert(`成功刪除 ${successCount} 個項目`);
        }
    } else {
        alert(`刪除完成：成功 ${successCount} 個，失敗 ${failCount} 個`);
        if (errors && errors.length > 0) {
            console.error('Batch delete errors:', errors);
        }
    }
});

// 監聽scale更新事件
ipcRenderer.on('media-scale-updated', (event, { index, scale }) => {
    console.log('Scale updated for index:', index, 'scale:', scale);
    
    const card = Array.from(cardsContainer.children).find(c => 
        parseInt(c.dataset.index) === index
    );
    
    if (card && card.scaleInput) {
        // 更新輸入框顯示
        card.scaleInput.value = scale.toFixed(1);
        card.scaleInput.dataset.currentScale = scale.toFixed(1);
    }
});

// 添加容器的拖拽事件
cardsContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    console.log('Dragover event');
    const afterElement = getDragAfterElement(cardsContainer, e.clientY);
    const draggable = document.querySelector('.dragging');
    if (!draggable) {
        console.log('No dragging element found');
    }
    if (draggable) {
        if (afterElement == null) {
            cardsContainer.appendChild(draggable);
        } else {
            cardsContainer.insertBefore(draggable, afterElement);
        }
    }
});

cardsContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    console.log('Drop event');
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    console.log('From index:', fromIndex);
    const cards = Array.from(cardsContainer.querySelectorAll('.video-card'));
    const toIndex = cards.indexOf(document.querySelector('.dragging'));
    console.log('To index:', toIndex);
    
    if (fromIndex !== toIndex && toIndex !== -1) {
        // 更新数据模型中的顺序
        const movedItem = videos.splice(fromIndex, 1)[0];
        videos.splice(toIndex, 0, movedItem);
        
        // 更新卡片标题
        cards.forEach((card, index) => {
            card.dataset.index = index;
            const title = card.querySelector('.card-title');
            if (title) {
                title.textContent = title.textContent.includes('圖片') 
                    ? `Image ${index + 1}` 
                    : `Video ${index + 1}`;
            }
        });
        
        // 通知主进程更新顺序
        ipcRenderer.send('update-video-order', { fromIndex, toIndex });
    }
});

// 辅助函数：获取拖拽后的位置
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.video-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 生成并缓存缩略图
function generateAndCacheThumbnail(videoElement, cacheKey) {
    try {
        // 创建canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 设置canvas尺寸
        canvas.width = videoElement.videoWidth || 320;
        canvas.height = videoElement.videoHeight || 180;
        
        // 绘制视频帧到canvas
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // 转换为数据URL
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        // 缓存缩略图
        thumbnailCache.set(cacheKey, thumbnailUrl);
        
        // 保存到临时目录
        ipcRenderer.send('save-thumbnail', {
            key: cacheKey,
            url: thumbnailUrl
        });
        
        console.log('Generated and cached thumbnail for:', cacheKey);
        return thumbnailUrl;
    } catch (error) {
        console.error('Error generating thumbnail:', error);
        return null;
    }
} 