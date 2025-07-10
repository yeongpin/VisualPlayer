class CardListManager {
    constructor(mainManager) {
        this.mainManager = mainManager;
        this.cardListVisible = false;
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
        if (this.mainManager.videos.length === 0) {
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
            this.mainManager.videos.forEach((videoData, index) => {
                const card = this.createVideoCard(videoData, videoData.wrapper, index);
                cardList.appendChild(card);
            });
        }

        document.body.appendChild(cardList);

        // 添加調試信息
        console.log('Videos array:', this.mainManager.videos);
        console.log('Card list created with', this.mainManager.videos.length, 'items');
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
        let thumbnail;
        
        if (videoData.isImage) {
            // 图片处理
            thumbnail = document.createElement('img');
            thumbnail.src = videoData.video.src;
            thumbnail.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;
        } else if (videoData.isLiveStream) {
            // 直播流处理
            if (videoData.video.srcObject === 'stream' || videoData.video.src) {
                // 有有效的流源，创建video元素
                thumbnail = document.createElement('video');
                if (videoData.video.src) {
                    thumbnail.src = videoData.video.src;
                }
                thumbnail.muted = true;
                thumbnail.autoplay = true;
                thumbnail.style.cssText = `
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                `;
            } else {
                // 没有有效流源，使用占位符
                thumbnail = document.createElement('div');
                thumbnail.style.cssText = `
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #ff4500, #ff6b35);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 10px;
                `;
                
                const iconElement = document.createElement('div');
                iconElement.innerHTML = '📹';
                iconElement.style.fontSize = '16px';
                iconElement.style.marginBottom = '4px';
                
                const textElement = document.createElement('div');
                textElement.innerHTML = 'LIVE';
                textElement.style.fontWeight = 'bold';
                textElement.style.letterSpacing = '1px';
                
                thumbnail.appendChild(iconElement);
                thumbnail.appendChild(textElement);
            }
        } else {
            // 普通视频处理
            thumbnail = document.createElement('video');
            thumbnail.src = videoData.video.currentSrc || videoData.video.src;
            thumbnail.muted = true;
            thumbnail.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;
        }

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
        
        // 根据类型设置不同的标题
        if (videoData.isImage) {
            title.textContent = `圖片 ${index + 1}`;
        } else if (videoData.isLiveStream) {
            title.textContent = `🔴 ${videoData.streamData?.name || 'Live Stream'}`;
        } else {
            title.textContent = `視頻 ${index + 1}`;
        }
        
        card.appendChild(title);

        // 添加點擊事件
        card.onclick = () => {
            if (this.showAdjustmentMenu) {
                this.showAdjustmentMenu(card, videoData);
            }
        };

        return card;
    }

    hideCardList() {
        const cardList = document.getElementById('videoCardList');
        if (cardList) {
            cardList.style.transform = 'translateY(100%)';
            setTimeout(() => cardList.remove(), 300);
        }
    }

    showAdjustmentMenu(card, videoData) {
        const { updateVideoFilter, setupFilterIPC } = require('./filter_utils.js');
        setupFilterIPC(videoData);
    }
}

module.exports = CardListManager; 