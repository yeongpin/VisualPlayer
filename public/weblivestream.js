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

// 监听尺寸模式变化
const dimensionRadioButtons = document.querySelectorAll('input[name="dimensionMode"]');
dimensionRadioButtons.forEach(radio => {
    radio.addEventListener('change', handleDimensionModeChange);
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

function handleDimensionModeChange() {
    const selectedMode = document.querySelector('input[name="dimensionMode"]:checked').value;
    const presetSection = document.getElementById('presetRatioSection');
    const customSection = document.getElementById('customSizeSection');
    
    // 隐藏所有尺寸部分
    presetSection.style.display = 'none';
    customSection.style.display = 'none';
    
    // 显示相应的部分
    switch (selectedMode) {
        case 'preset':
            presetSection.style.display = 'block';
            // 重新初始化比例按钮（因为它们刚刚变为可见）
            setTimeout(() => {
                initRatioButtons();
                // 默认选中16:9比例
                const defaultButton = document.querySelector('.ratio-button[data-ratio="16:9"]');
                if (defaultButton) {
                    defaultButton.click();
                    console.log('Default 16:9 ratio selected');
                }
                console.log('Ratio buttons initialized');
            }, 50);
            break;
        case 'custom':
            customSection.style.display = 'block';
            // 重新初始化预设按钮和自定义输入
            setTimeout(() => {
                initPresetButtons();
                initCustomSizeInputs();
                updateCurrentRatio();
                console.log('Custom size controls initialized');
            }, 50);
            break;
        case 'auto':
            // 自动模式不需要额外配置
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

    // 添加尺寸配置
    const dimensions = getSelectedDimensions();
    streamConfig.dimensions = dimensions;

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

// 比例按钮处理
function initRatioButtons() {
    const ratioButtons = document.querySelectorAll('.ratio-button');
    console.log('Found ratio buttons:', ratioButtons.length);
    
    ratioButtons.forEach((button, index) => {
        // 先移除现有的事件监听器（如果有的话）
        button.replaceWith(button.cloneNode(true));
        const newButton = document.querySelectorAll('.ratio-button')[index];
        
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Ratio button clicked:', newButton.dataset.ratio);
            
            // 移除所有选中状态
            document.querySelectorAll('.ratio-button').forEach(btn => btn.classList.remove('selected'));
            // 添加当前选中状态
            newButton.classList.add('selected');
            
            // 获取选中的尺寸
            const size = newButton.dataset.size;
            if (size) {
                const [width, height] = size.split('x').map(Number);
                const widthInput = document.getElementById('customWidth');
                const heightInput = document.getElementById('customHeight');
                
                if (widthInput && heightInput) {
                    widthInput.value = width;
                    heightInput.value = height;
                    updateCurrentRatio();
                    console.log('Updated dimensions:', width, 'x', height);
                } else {
                    console.error('Width or height input not found');
                }
            }
        });
    });
}

// 预设按钮处理
function initPresetButtons() {
    const presetButtons = document.querySelectorAll('.preset-button');
    console.log('Found preset buttons:', presetButtons.length);
    
    presetButtons.forEach((button, index) => {
        // 先移除现有的事件监听器（如果有的话）
        button.replaceWith(button.cloneNode(true));
        const newButton = document.querySelectorAll('.preset-button')[index];
        
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Preset button clicked:', newButton.textContent);
            
            const size = newButton.dataset.size;
            if (size) {
                const [width, height] = size.split('x').map(Number);
                const widthInput = document.getElementById('customWidth');
                const heightInput = document.getElementById('customHeight');
                
                if (widthInput && heightInput) {
                    widthInput.value = width;
                    heightInput.value = height;
                    updateCurrentRatio();
                    console.log('Updated dimensions via preset:', width, 'x', height);
                } else {
                    console.error('Width or height input not found');
                }
            }
        });
    });
}

// 自定义尺寸输入处理
function initCustomSizeInputs() {
    const widthInput = document.getElementById('customWidth');
    const heightInput = document.getElementById('customHeight');
    
    if (!widthInput || !heightInput) {
        console.error('Custom size inputs not found');
        return;
    }
    
    // 移除现有的事件监听器并添加新的
    [widthInput, heightInput].forEach(input => {
        // 克隆元素以移除所有事件监听器
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        
        newInput.addEventListener('input', updateCurrentRatio);
        newInput.addEventListener('change', updateCurrentRatio);
    });
    
    console.log('Custom size inputs initialized');
}

// 更新当前比例显示
function updateCurrentRatio() {
    const widthInput = document.getElementById('customWidth');
    const heightInput = document.getElementById('customHeight');
    
    if (!widthInput || !heightInput) {
        console.error('Width or height input not found in updateCurrentRatio');
        return;
    }
    
    const width = parseInt(widthInput.value) || 1920;
    const height = parseInt(heightInput.value) || 1080;
    
    console.log('Updating current ratio with:', width, 'x', height);
    
    // 计算最大公约数
    function gcd(a, b) {
        return b === 0 ? a : gcd(b, a % b);
    }
    
    const divisor = gcd(width, height);
    const ratioWidth = width / divisor;
    const ratioHeight = height / divisor;
    
    const currentRatioSpan = document.getElementById('currentRatio');
    if (currentRatioSpan) {
        currentRatioSpan.textContent = `${ratioWidth}:${ratioHeight}`;
        console.log('Updated ratio display to:', `${ratioWidth}:${ratioHeight}`);
    } else {
        console.error('Current ratio span not found');
    }
}

// 获取选择的尺寸配置
function getSelectedDimensions() {
    const dimensionMode = document.querySelector('input[name="dimensionMode"]:checked').value;
    
    switch (dimensionMode) {
        case 'auto':
            return { mode: 'auto' };
            
        case 'preset':
            const selectedRatio = document.querySelector('.ratio-button.selected');
            if (selectedRatio) {
                const size = selectedRatio.dataset.size;
                const [width, height] = size.split('x').map(Number);
                return {
                    mode: 'preset',
                    width: width,
                    height: height,
                    ratio: selectedRatio.dataset.ratio
                };
            }
            return { mode: 'auto' }; // 回退到自动模式
            
        case 'custom':
            const width = parseInt(document.getElementById('customWidth').value) || 1920;
            const height = parseInt(document.getElementById('customHeight').value) || 1080;
            return {
                mode: 'custom',
                width: width,
                height: height
            };
            
        default:
            return { mode: 'auto' };
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 加载语言
    if (window.languageManager) {
        window.languageManager.updatePageLanguage();
    }
    
    // 初始化尺寸控制
    initRatioButtons();
    initPresetButtons();
    initCustomSizeInputs();
    updateCurrentRatio();
    
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