class TransformManager {
    constructor(mainManager) {
        this.mainManager = mainManager;
    }

    updateVideoTransform(videoData) {
        const scaleX = videoData.flipX ? -1 : 1;
        const scaleY = videoData.flipY ? -1 : 1;
        
        // 构建媒体元素的变换
        let mediaTransforms = [];
        
        // 添加翻转变换
        if (scaleX !== 1 || scaleY !== 1) {
            mediaTransforms.push(`scale(${scaleX}, ${scaleY})`);
        }
        
        // 添加保存的 warp 变换
        if (videoData.warpTransform && videoData.warpTransform.trim()) {
            mediaTransforms.push(videoData.warpTransform);
        }
        
        // 应用组合的变换
        videoData.video.style.transform = mediaTransforms.join(' ');
        
        // wrapper应用位移、缩放和旋转
        const translateX = videoData.translateX || 0;
        const translateY = videoData.translateY || 0;
        videoData.wrapper.style.transform = 
            `translate(${translateX}px, ${translateY}px) scale(${videoData.scale}) rotate(${videoData.rotation}deg)`;
        
        const controls = videoData.container.querySelector('.video-controls');
        if (controls) {
            controls.style.transform = `translate(-50%, 0) scale(${1/videoData.scale})`;
            const bottomPadding = Math.max(20, 20 * (1/videoData.scale));
            controls.style.bottom = `${bottomPadding}px`;
            const minWidth = Math.max(20, 20 * (1/videoData.scale));
            controls.style.minWidth = `${minWidth}px`;
        }
    }
    
    // 应用 warp 变换
    applyWarpTransform(videoData, warpTransform) {
        // 保存 warp 变换到 videoData
        videoData.warpTransform = warpTransform;
        
        // 重新应用所有变换
        this.updateVideoTransform(videoData);
    }
    
    // 实时预览 warp 变换（不保存到数据中）
    previewWarpTransform(videoData, warpTransform) {
        const scaleX = videoData.flipX ? -1 : 1;
        const scaleY = videoData.flipY ? -1 : 1;
        
        // 构建媒体元素的变换（使用预览的 warp 变换）
        let mediaTransforms = [];
        
        // 添加翻转变换
        if (scaleX !== 1 || scaleY !== 1) {
            mediaTransforms.push(`scale(${scaleX}, ${scaleY})`);
        }
        
        // 添加预览的 warp 变换
        if (warpTransform && warpTransform.trim()) {
            mediaTransforms.push(warpTransform);
        }
        
        // 应用组合的变换（不修改 videoData.warpTransform）
        videoData.video.style.transform = mediaTransforms.join(' ');
    }
    
    // 重置 warp 变换
    resetWarpTransform(videoData) {
        // 清除保存的 warp 变换
        videoData.warpTransform = '';
        
        // 重新应用变换（不包含 warp）
        this.updateVideoTransform(videoData);
    }
}

module.exports = TransformManager; 