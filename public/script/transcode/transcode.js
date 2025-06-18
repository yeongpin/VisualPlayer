const { ipcRenderer } = require('electron');

const progressBar = document.getElementById('progress-bar');
const fileName = document.getElementById('file-name');
const filePath = document.getElementById('file-path');
const progressText = document.getElementById('progress-text');
const stageText = document.getElementById('stage-text');
const timeProgress = document.getElementById('time-progress');
const fpsSpan = document.getElementById('fps');
const speedSpan = document.getElementById('speed');
const cancelBtn = document.getElementById('cancelBtn');

// 添加取消按钮事件
cancelBtn.addEventListener('click', () => {
    ipcRenderer.send('cancel-transcode');
    cancelBtn.disabled = true;
    cancelBtn.textContent = '正在取消...';
});

ipcRenderer.on('transcode-start', (event, { name, path }) => {
    fileName.textContent = name;
    filePath.textContent = path || '正在處理...';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    stageText.classList.add('processing');
});

ipcRenderer.on('transcode-progress', (event, data) => {
    const progress = typeof data.progress === 'number' ? data.progress : 0;
    
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress.toFixed(2)}%`;
    
    if (data.stage) {
        stageText.textContent = data.stage;
    }
    
    if (data.currentTime && data.duration) {
        const currentTime = formatTime(data.currentTime);
        const totalTime = formatTime(data.duration);
        timeProgress.textContent = `${currentTime} / ${totalTime}`;
    }
    
    if (data.fps) {
        fpsSpan.textContent = `FPS: ${Math.round(data.fps)}`;
    }
    if (data.speed) {
        const speed = (data.speed/1024).toFixed(1);
        speedSpan.textContent = `速度: ${speed.padStart(4, ' ')} MB/s`;
    }
});

ipcRenderer.on('transcode-complete', () => {
    fileName.textContent = '轉碼完成';
    stageText.classList.remove('processing');
    stageText.textContent = '處理完成';
    progressBar.style.width = '100%';
    progressText.textContent = '100.00%';
    progressBar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
});

ipcRenderer.on('transcode-error', (event, { error }) => {
    fileName.textContent = '轉碼失敗';
    filePath.textContent = error;
    stageText.classList.remove('processing');
    stageText.textContent = '處理失敗';
    progressBar.style.background = '#f44336';
    cancelBtn.disabled = false;
    cancelBtn.textContent = '取消轉碼';
});

ipcRenderer.on('transcode-cancelled', () => {
    fileName.textContent = '已取消轉碼';
    stageText.classList.remove('processing');
    stageText.textContent = '已取消';
    progressBar.style.background = '#f44336';
    cancelBtn.disabled = true;
    cancelBtn.textContent = '已取消';
});

// 處理GPU降級事件
ipcRenderer.on('transcode-fallback', (event, { message }) => {
    stageText.textContent = message;
    stageText.style.color = '#ff9800'; // 橙色警告
    fileName.textContent = '正在切換編碼器...';
    
    // 暫時顯示降級消息
    setTimeout(() => {
        stageText.style.color = '';
    }, 3000);
});

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}