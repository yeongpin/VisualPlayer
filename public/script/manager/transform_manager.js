class TransformManager {
    constructor(mainManager) {
        this.mainManager = mainManager;
    }

    updateVideoTransform(videoData) {
        const scaleX = videoData.flipX ? -1 : 1;
        const scaleY = videoData.flipY ? -1 : 1;
        
        // 只對視頻/圖片元素應用翻轉
        videoData.video.style.transform = `scale(${scaleX}, ${scaleY})`;
        
        // 容器只應用縮放和旋轉
        videoData.container.style.transform = 
            `scale(${videoData.scale}) rotate(${videoData.rotation}deg)`;
        
        const controls = videoData.container.querySelector('.video-controls');
        if (controls) {
            controls.style.transform = `translate(-50%, 0) scale(${1/videoData.scale})`;
            const bottomPadding = Math.max(20, 20 * (1/videoData.scale));
            controls.style.bottom = `${bottomPadding}px`;
            const minWidth = Math.max(20, 20 * (1/videoData.scale));
            controls.style.minWidth = `${minWidth}px`;
        }
    }
}

module.exports = TransformManager; 