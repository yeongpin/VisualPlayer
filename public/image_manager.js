class ImageManager {
    constructor(mainManager) {
        this.mainManager = mainManager;
    }

    addImage(source, originalFileName) {
        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';
        
        // 創建一個臨時圖片元素來獲取原始尺寸
        const tempImg = new Image();
        tempImg.src = source;
        
        tempImg.onload = () => {
            const originalWidth = tempImg.width;
            const originalHeight = tempImg.height;
            
            // 計算適合窗口的尺寸，但保持原始比例
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;
            const availWidth = winWidth * 0.8;  // 80% 窗口寬度
            const availHeight = winHeight * 0.8;  // 80% 窗口高度
            
            // 計算縮放比例以適應窗口
            const scaleX = availWidth / originalWidth;
            const scaleY = availHeight / originalHeight;
            const scale = Math.min(scaleX, scaleY, 1); // 不放大，只縮小
            
            // 設置wrapper尺寸為縮放後的實際顯示尺寸
            const displayWidth = originalWidth * scale;
            const displayHeight = originalHeight * scale;
            wrapper.style.width = `${displayWidth}px`;
            wrapper.style.height = `${displayHeight}px`;
            
            const imageContainer = document.createElement('div');
            imageContainer.className = 'video-container';
            imageContainer.style.cssText = `
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
            
            const img = document.createElement('img');
            img.src = source;
            
            // 檢查是否已經有相同件名的圖片
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
            
            img.dataset.originalFileName = finalFileName;
            
            img.style.cssText = `
                width: auto;
                height: auto;
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                pointer-events: none;
            `;
            
            // 为变形编辑添加特殊处理
            img.classList.add('warp-compatible-image');
            
            imageContainer.appendChild(img);
            wrapper.appendChild(imageContainer);
            
            // 創建控制容器，與視頻控制項使用相同的樣式
            const controls = document.createElement('div');
            controls.className = 'video-controls';

            const controlsRow = document.createElement('div');
            controlsRow.className = 'controls-row';

            const leftControls = document.createElement('div');
            leftControls.className = 'left-controls';

            // 添加重置按鈕
            const resetSizeBtn = document.createElement('button');
            resetSizeBtn.className = 'control-button reset-size-button';
            resetSizeBtn.title = '重置大小和旋轉';
            resetSizeBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                </svg>
            `;
            resetSizeBtn.onclick = (e) => {
                e.stopPropagation();
                const imageData = this.mainManager.videos.find(v => v.wrapper === wrapper);
                if (imageData) {
                    imageData.scale = 1;
                    imageData.rotation = 0;
                    imageData.flipX = false;  // 重置水平翻轉
                    imageData.flipY = false;  // 重置垂直翻轉
                    this.mainManager.transformManager.updateVideoTransform(imageData);
                    // 使用原始圖片尺寸計算重置大小
                    const scale = Math.min(1, maxInitialWidth / originalWidth);
                    wrapper.style.width = `${originalWidth * scale}px`;
                    wrapper.style.height = `${originalHeight * scale}px`;
                }
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
                   const imageData = this.mainManager.videos.find(v => v.wrapper === wrapper);
                   if (imageData) {
                       imageData.flipX = !imageData.flipX;
                       this.mainManager.transformManager.updateVideoTransform(imageData);
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
                   const imageData = this.mainManager.videos.find(v => v.wrapper === wrapper);
                   if (imageData) {
                       imageData.flipY = !imageData.flipY;
                       this.mainManager.transformManager.updateVideoTransform(imageData);
                   }
               };

            const rightControls = document.createElement('div');
            rightControls.className = 'right-controls';

            // 修改關閉按鈕樣式
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
                                            // 更新 cards 窗口
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
                            flipY: v.flipY,
                            zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                        }
                    },
                    zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                }))
            });
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

            leftControls.appendChild(resetSizeBtn);
            leftControls.appendChild(flipXBtn);
            leftControls.appendChild(flipYBtn);
            leftControls.appendChild(resizeBtn);
            rightControls.appendChild(closeBtn);
            controlsRow.appendChild(leftControls);
            controlsRow.appendChild(rightControls);
            controls.appendChild(controlsRow);
            imageContainer.appendChild(controls);
            
            const offset = this.mainManager.videos.length * 50;
            wrapper.style.left = offset + 'px';
            wrapper.style.top = offset + 'px';
            
            // 設置初始 z-index，按加入順序遞增
            const initialZIndex = this.mainManager.videos.length;
            wrapper.style.zIndex = initialZIndex;
            
            wrapper.addEventListener('mousedown', (e) => this.mainManager.eventHandlers.handleMouseDown(e));
            wrapper.addEventListener('wheel', (e) => this.mainManager.eventHandlers.handleWheel(e));
            
            document.body.appendChild(wrapper);
            
            // 確保 img.dataset 存在並設置 z-index
            if (!img.dataset) {
                img.dataset = {};
            }
            img.dataset.zIndex = initialZIndex;
            
            const imageData = { 
                wrapper, 
                video: img,
                container: imageContainer, 
                scale: 1, 
                rotation: 0,
                isImage: true,
                flipX: false,
                flipY: false
            };
            
            this.mainManager.videos.push(imageData);
            this.mainManager.dropZone.style.display = 'none';
            
            // 设置imageData的初始缩放为1
            imageData.scale = 1; // 使用1作为初始缩放，因为wrapper已经是正确的显示尺寸

            // 應用變換
            this.mainManager.transformManager.updateVideoTransform(imageData);

            // 設置 wrapper 的中心位置
            const centerX = (winWidth - displayWidth) / 2;
            const centerY = (winHeight - displayHeight) / 2;
            wrapper.style.position = 'fixed';
            wrapper.style.left = `${centerX}px`;
            wrapper.style.top = `${centerY}px`;

            // 如果卡片列表正在顯示，則更新它
            if (this.mainManager.cardListVisible) {
                this.mainManager.showCardList();
            }

            // 更新 cards 窗口
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
                            flipY: v.flipY,
                            zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                        }
                    },
                    zIndex: parseInt(v.wrapper?.style?.zIndex) || 0
                }))
            });

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
        };
    }
}

module.exports = ImageManager; 