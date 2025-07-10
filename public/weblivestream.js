const { ipcRenderer } = require('electron');

// 获取DOM元素
const closeButton = document.querySelector('.close-button');
const deviceNameInput = document.getElementById('deviceName');
const streamUrlInput = document.getElementById('streamUrl');
const webcamSelect = document.getElementById('webcamSelect');
const connectBtn = document.getElementById('connectBtn');
const cancelBtn = document.getElementById('cancelBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = statusIndicator.querySelector('.status-text');
const urlSection = document.getElementById('urlSection');
const webcamSection = document.getElementById('webcamSection');

// 获取单选按钮
const radioButtons = document.querySelectorAll('input[name="streamSource"]');

// 当前连接状态
let isConnected = false;
let currentStream = null;

// 关闭窗口
closeButton.onclick = () => {
    window.close();
};

cancelBtn.onclick = () => {
    window.close();
};

// 监听单选按钮变化
radioButtons.forEach(radio => {
    radio.addEventListener('change', handleSourceChange);
});

function handleSourceChange() {
    const selectedSource = document.querySelector('input[name="streamSource"]:checked').value;
    
    // 隐藏所有可选部分
    urlSection.style.display = 'none';
    webcamSection.style.display = 'none';
    
    // 显示相应的部分
    switch (selectedSource) {
        case 'custom':
            urlSection.style.display = 'block';
            break;
        case 'webcam':
            webcamSection.style.display = 'block';
            loadWebcams();
            break;
        case 'obs':
            // OBS虚拟摄像头不需要额外配置
            break;
    }
}

// 加载可用的摄像头
async function loadWebcams() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        webcamSelect.innerHTML = '<option value="">Select a webcam...</option>';
        
        videoDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Camera ${device.deviceId.substring(0, 8)}...`;
            webcamSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading webcams:', error);
    }
}

// 设置状态
function setStatus(status, message) {
    statusIndicator.className = `status-indicator ${status}`;
    statusText.textContent = message;
}

// 验证URL格式
function isValidStreamUrl(url) {
    try {
        const urlObj = new URL(url);
        const validProtocols = ['http:', 'https:', 'rtmp:', 'rtmps:', 'ws:', 'wss:'];
        return validProtocols.includes(urlObj.protocol);
    } catch {
        return false;
    }
}

// 连接处理
connectBtn.onclick = async () => {
    if (isConnected) {
        // 断开连接
        disconnect();
        return;
    }

    const selectedSource = document.querySelector('input[name="streamSource"]:checked').value;
    const deviceName = deviceNameInput.value.trim() || 'Live Stream';

    let streamConfig = {
        name: deviceName,
        type: selectedSource
    };

    // 验证配置
    switch (selectedSource) {
        case 'custom':
            const url = streamUrlInput.value.trim();
            if (!url) {
                alert('Please enter a stream URL');
                return;
            }
            if (!isValidStreamUrl(url)) {
                alert('Invalid URL format');
                return;
            }
            streamConfig.url = url;
            break;
            
        case 'webcam':
            const selectedWebcam = webcamSelect.value;
            if (!selectedWebcam) {
                alert('Please select a webcam');
                return;
            }
            streamConfig.deviceId = selectedWebcam;
            break;
            
        case 'obs':
            // OBS虚拟摄像头配置
            streamConfig.source = 'OBS Virtual Camera';
            break;
    }

    // 开始连接
    setStatus('connecting', 'Connecting...');
    connectBtn.disabled = true;

    try {
        await connectToStream(streamConfig);
        setStatus('connected', 'Connected');
        connectBtn.textContent = 'Disconnect';
        connectBtn.disabled = false;
        isConnected = true;
    } catch (error) {
        console.error('Connection failed:', error);
        setStatus('disconnected', 'Connection Error');
        connectBtn.disabled = false;
        alert(`Connection failed: ${error.message}`);
    }
};

// 连接到流
async function connectToStream(config) {
    return new Promise((resolve, reject) => {
        // 发送配置到主进程
        ipcRenderer.send('connect-live-stream', config);
        
        // 监听连接结果
        const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
        }, 10000);
        
        ipcRenderer.once('live-stream-connected', (event, { success, error, streamData }) => {
            clearTimeout(timeout);
            if (success) {
                currentStream = streamData;
                resolve(streamData);
            } else {
                reject(new Error(error || 'Connection failed'));
            }
        });
    });
}

// 断开连接
function disconnect() {
    if (currentStream) {
        ipcRenderer.send('disconnect-live-stream', currentStream.id);
        currentStream = null;
    }
    
    setStatus('disconnected', 'Disconnected');
    connectBtn.textContent = 'Connect';
    isConnected = false;
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 加载语言
    if (window.languageManager) {
        window.languageManager.updatePageLanguage();
    }
    
    // 请求媒体权限以便枚举设备
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            // 停止流，我们只是需要权限来枚举设备
            stream.getTracks().forEach(track => track.stop());
            loadWebcams();
        })
        .catch(error => {
            console.log('Media permission denied:', error);
        });
});

// 监听窗口关闭前的清理
window.addEventListener('beforeunload', () => {
    if (isConnected) {
        disconnect();
    }
}); 