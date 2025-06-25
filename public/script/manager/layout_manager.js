class LayoutManager {
    constructor(mainManager) {
        this.mainManager = mainManager;
    }

    async saveLayout() {
        const layout = {
            videos: this.mainManager.videos.map(videoData => ({
                filename: videoData.video.dataset.originalFileName,
                position: {
                    left: videoData.wrapper.style.left,
                    top: videoData.wrapper.style.top,
                    width: videoData.wrapper.style.width,
                    height: videoData.wrapper.style.height,
                    zIndex: videoData.wrapper.style.zIndex
                },
                transform: {
                    scale: videoData.scale,
                    rotation: videoData.rotation,
                    flipX: videoData.flipX,
                    flipY: videoData.flipY,
                    warpTransform: videoData.warpTransform || ''
                },
                filterValues: videoData.video.filterValues || {}
            }))
        };

        try {
            const { dialog } = require('@electron/remote');
            const { filePath } = await dialog.showSaveDialog({
                title: '保存布局',
                defaultPath: 'layout.json',
                filters: [
                    { name: '布局文件', extensions: ['json'] }
                ]
            });

            if (filePath) {
                const fs = require('fs');
                fs.writeFileSync(filePath, JSON.stringify(layout, null, 2));
                this.showNotification('布局已保存');
            }
        } catch (error) {
            console.error('保存布局失敗:', error);
            this.showNotification('保存布局失敗', 'error');
        }
    }

    async loadLayout() {
        try {
            const { dialog } = require('@electron/remote');
            const { filePaths } = await dialog.showOpenDialog({
                title: '加載布局',
                filters: [
                    { name: '布局文件', extensions: ['json'] }
                ],
                properties: ['openFile']
            });

            if (filePaths && filePaths[0]) {
                const fs = require('fs');
                const layout = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
                
                layout.videos.forEach(videoLayout => {
                    const existingVideo = this.mainManager.videos.find(v => 
                        v.video.dataset.originalFileName === videoLayout.filename
                    );

                    if (existingVideo) {
                        Object.assign(existingVideo.wrapper.style, videoLayout.position);
                        
                        existingVideo.scale = videoLayout.transform.scale;
                        existingVideo.rotation = videoLayout.transform.rotation;
                        existingVideo.flipX = videoLayout.transform.flipX;
                        existingVideo.flipY = videoLayout.transform.flipY;
                        
                        // 恢复 warp 变换
                        if (videoLayout.transform.warpTransform) {
                            existingVideo.warpTransform = videoLayout.transform.warpTransform;
                        } else {
                            existingVideo.warpTransform = '';
                        }
                        
                        this.mainManager.transformManager.updateVideoTransform(existingVideo);

                        if (videoLayout.filterValues) {
                            const targetElement = existingVideo.video;
                            if (!targetElement.filterValues) {
                                targetElement.filterValues = {
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
                                    exposure: 100,
                                    rgbCurve: { x: 0.5, y: 0.5 }
                                };
                            }
                            Object.assign(targetElement.filterValues, videoLayout.filterValues);
                            const { updateVideoFilter } = require('../../filter_utils.js');
                            updateVideoFilter(targetElement);

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
                    }
                });

                this.showNotification('布局已加載');
            }
        } catch (error) {
            console.error('加載布局失敗:', error);
            this.showNotification('加載布局失敗', 'error');
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 20px;
            border-radius: 4px;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 999999;
            transition: opacity 0.3s;
            background: ${type === 'success' ? 'rgba(40, 167, 69, 0.9)' : 'rgba(220, 53, 69, 0.9)'};
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

module.exports = LayoutManager; 