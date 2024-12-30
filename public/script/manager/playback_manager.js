class PlaybackManager {
    constructor(mainManager) {
        this.mainManager = mainManager;
    }

    adjustPlaybackSpeed(change) {
        this.mainManager.videos.forEach(({ video }) => {
            const newSpeed = Math.max(0.1, video.playbackRate + change);
            video.playbackRate = newSpeed;
        });
    
        this.showSpeedIndicator();
    }
    
    setPlaybackSpeed(speed) {
        this.mainManager.videos.forEach(({ video }) => {
            video.playbackRate = speed;
        });

        this.showSpeedIndicator(speed);
    }

    showSpeedIndicator(speed) {
        const speedIndicator = document.createElement('div');
        speedIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            z-index: 9999;
            transition: opacity 0.3s;
        `;
        
        const displaySpeed = speed || this.mainManager.videos[0]?.video.playbackRate.toFixed(1) || "0.1";
        speedIndicator.textContent = `播放速度: ${displaySpeed}x`;
        document.body.appendChild(speedIndicator);
        
        setTimeout(() => {
            speedIndicator.style.opacity = '0';
            setTimeout(() => speedIndicator.remove(), 300);
        }, 2000);
    }
    
    togglePlayAll() {
        const videos = this.mainManager.videos
            .filter(data => !data.isImage)
            .map(data => data.video);
        
        const anyPlaying = videos.some(video => !video.paused);
        
        const { ipcRenderer } = require('electron');
        
        this.mainManager.videos.forEach((videoData, index) => {
            if (!videoData.isImage) {
                if (anyPlaying) {
                    videoData.video.pause();
                    ipcRenderer.send('video-state-changed', {
                        index,
                        isPlaying: false
                    });
                } else {
                    videoData.video.play().catch(() => {
                        console.log('Auto-play prevented');
                    });
                    ipcRenderer.send('video-state-changed', {
                        index,
                        isPlaying: true
                    });
                }
            }
        });
    }
    
    resetAllVideos() {
        this.mainManager.videos.forEach(({ video }) => {
            video.currentTime = 0;
        });
    }
    
    seekAllVideos(seconds) {
        this.mainManager.videos.forEach(({ video }) => {
            video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
        });
    }
    
    toggleMuteAll() {
        const anyUnmuted = this.mainManager.videos.some(({ video }) => !video.muted);
        
        this.mainManager.videos.forEach(({ video }) => {
            video.muted = anyUnmuted;
        });
        
        const muteIndicator = document.createElement('div');
        muteIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            z-index: 9999;
            transition: opacity 0.3s;
        `;
        muteIndicator.textContent = anyUnmuted ? '靜音' : '取消靜音';
        document.body.appendChild(muteIndicator);
        
        setTimeout(() => {
            muteIndicator.style.opacity = '0';
            setTimeout(() => muteIndicator.remove(), 300);
        }, 2000);
    }
}

module.exports = PlaybackManager; 