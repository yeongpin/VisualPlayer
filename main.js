const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
require('@electron/remote/main').initialize()
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const CodecManager = require('./public/script/codec/codec_manager.js');
const DcrawCodecManager = require('./public/script/codec/dcraw_codec_manager.js');
const fs = require('fs');

let transcodeWindow = null;
let mainWindow = null;

// 缩略图缓存路径
const thumbnailCacheDir = path.join(os.tmpdir(), 'visualplayer-thumbnails');
const thumbnailCacheFile = path.join(thumbnailCacheDir, 'cache.json');

// 确保缩略图目录存在
if (!fs.existsSync(thumbnailCacheDir)) {
    fs.mkdirSync(thumbnailCacheDir, { recursive: true });
}

// 缩略图缓存对象
let thumbnailCache = {};

// 加载缩略图缓存
try {
    if (fs.existsSync(thumbnailCacheFile)) {
        thumbnailCache = JSON.parse(fs.readFileSync(thumbnailCacheFile, 'utf8'));
        console.log('Loaded thumbnail cache:', Object.keys(thumbnailCache).length, 'items');
    }
} catch (error) {
    console.error('Error loading thumbnail cache:', error);
    thumbnailCache = {};
}

// 处理缩略图保存请求
ipcMain.on('save-thumbnail', (event, { key, url }) => {
    try {
        // 保存到缓存对象
        thumbnailCache[key] = url;
        
        // 写入缓存文件
        fs.writeFileSync(thumbnailCacheFile, JSON.stringify(thumbnailCache));
        console.log('Saved thumbnail to cache:', key);
    } catch (error) {
        console.error('Error saving thumbnail:', error);
    }
});

// 处理加载缩略图请求
ipcMain.on('load-thumbnails', (event) => {
    event.reply('thumbnails-loaded', thumbnailCache);
});

// 处理单个缩略图请求
ipcMain.on('request-thumbnail', (event, { key }) => {
    if (thumbnailCache[key]) {
        event.reply('thumbnail-loaded', { key, url: thumbnailCache[key] });
    }
});

// 獲取 FFmpeg 路徑
function getFFmpegPath() {
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        return path.join(__dirname, 'external', 'ffmpeg', 'bin', 'ffmpeg.exe');
    }
    return path.join(process.resourcesPath, 'external', 'ffmpeg', 'bin', 'ffmpeg.exe');
}

// 獲取 FFprobe 路徑
function getFFprobePath() {
    // 檢查是否在開發環境
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        return path.join(__dirname, 'external', 'ffmpeg', 'bin', 'ffprobe.exe');
    }

    // 生產環境中的路徑
    return path.join(process.resourcesPath, 'external', 'ffmpeg', 'bin', 'ffprobe.exe');
}

// 設置路徑
const ffmpegPathResolved = getFFmpegPath();
const ffprobePathResolved = getFFprobePath();

console.log('FFmpeg 路徑:', ffmpegPathResolved);
console.log('FFprobe 路徑:', ffprobePathResolved);

ffmpeg.setFfmpegPath(ffmpegPathResolved);
ffmpeg.setFfprobePath(ffprobePathResolved);

// 檢查 FFmpeg 是否可用
function checkFFmpeg() {
    try {
        const testCommand = ffmpeg();
        console.log('FFmpeg initialization successful');
        return true;
    } catch (error) {
        console.error('FFmpeg initialization failed:', error);
        return false;
    }
}

// 檢查 FFmpeg 是否可用
if (!checkFFmpeg()) {
    console.error('FFmpeg is not available, transcoding may not work');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
            backgroundThrottling: false,
            webgl: true,
            experimentalFeatures: true
        }
    })

    // 禁用幀率限制
    mainWindow.webContents.setFrameRate(0);
    
    // 禁用 V-Sync 和相關限制
    app.commandLine.appendSwitch('disable-frame-rate-limit');
    app.commandLine.appendSwitch('disable-gpu-vsync');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('enable-begin-frame-scheduling');
    
    // 啟用 GPU 加速和硬件加速
    app.commandLine.appendSwitch('ignore-gpu-blacklist');
    app.commandLine.appendSwitch('enable-gpu-rasterization');
    app.commandLine.appendSwitch('enable-zero-copy');
    app.commandLine.appendSwitch('enable-webgl');
    app.commandLine.appendSwitch('enable-accelerated-video-decode');
    app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
    app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
    app.commandLine.appendSwitch('enable-accelerated-video');
    app.commandLine.appendSwitch('enable-gpu-memory-buffer-compositor-resources');
    app.commandLine.appendSwitch('enable-gpu-memory-buffer-video-frames');
    app.commandLine.appendSwitch('enable-unsafe-webgpu');
    app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization');
    app.commandLine.appendSwitch('canvas-oop-rasterization');
    app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,single-video,single-on-top-video');
    app.commandLine.appendSwitch('force-gpu-mem-available-mb', '1024');
    app.commandLine.appendSwitch('enable-gpu-service-logging');
    app.commandLine.appendSwitch('use-angle', 'gl');
    app.commandLine.appendSwitch('enable-webgl-draft-extensions');
    app.commandLine.appendSwitch('enable-webgl-image-chromium');
    app.commandLine.appendSwitch('enable-gpu-shader-disk-cache');
    
    // 禁用節能和限制
    app.commandLine.appendSwitch('disable-background-timer-throttling');
    app.commandLine.appendSwitch('disable-renderer-backgrounding');
    app.commandLine.appendSwitch('disable-composited-antialiasing');
    app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');
    app.commandLine.appendSwitch('disable-gpu-program-cache');
    
    // 啟用高性能模式
    app.commandLine.appendSwitch('force_high_performance_gpu');
    app.commandLine.appendSwitch('enable-high-resolution-time');
    app.commandLine.appendSwitch('high-dpi-support', '1');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
    
    require('@electron/remote/main').enable(mainWindow.webContents)
    mainWindow.loadFile('public/index.html')

    // 禁用限制器
    mainWindow.webContents.executeJavaScript(`
        delete window.requestAnimationFrame;
        window.requestAnimationFrame = callback => {
            setTimeout(callback, 0);
        };
    `);

    // 添加主窗口關閉事件監聽
    mainWindow.on('closed', () => {
        // 終止所有轉碼進程
        if (isTranscoding && currentFfmpegCommand) {
            try {
                currentFfmpegCommand.kill('SIGKILL');
                isTranscoding = false;
                currentFfmpegCommand = null;
            } catch (error) {
                console.error('Error killing ffmpeg process:', error);
            }
        }

        // 關閉轉碼窗口
        if (transcodeWindow && !transcodeWindow.isDestroyed()) {
            transcodeWindow.close();
            transcodeWindow = null;
        }

        // 關閉其他窗口
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.close();
        }
        
        for (const window of filterWindows.values()) {
            if (!window.isDestroyed()) {
                window.close();
            }
        }
        filterWindows.clear();
        
        if (cardsWindow && !cardsWindow.isDestroyed()) {
            cardsWindow.close();
        }
        cardsWindow = null;
        mainWindow = null;
    });
}

// 存儲所有的濾鏡窗
const filterWindows = new Map();

// 存儲設置窗口的引用
let settingsWindow = null;

// 創建設置窗口的函數
function createSettingsWindow() {
    console.log('Creating settings window...'); // 添加調試日誌

    // 如果設置窗口已經存在，則顯示它
    if (settingsWindow) {
        console.log('Settings window exists, showing it...'); // 添加調試日誌
        settingsWindow.show();
        return;
    }

    // 創建新的設置窗口
    settingsWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        backgroundColor: '#1a1a1a',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false,
        frame: false // 無邊框窗口
    });

    console.log('Loading settings page...'); // 添加調試日誌
    // 加載設置頁面
    settingsWindow.loadFile('public/settings.html')
        .then(() => {
            console.log('Settings page loaded successfully'); // 添加調試日誌
        })
        .catch(err => {
            console.error('Error loading settings page:', err); // 添加錯誤日誌
        });

    // 窗口準備好時顯示
    settingsWindow.once('ready-to-show', () => {
        console.log('Settings window ready to show'); // 添加調試日誌
        settingsWindow.show();
        // 加載設置
        settingsWindow.webContents.send('load-settings', loadSettings());
    });

    // 當窗口關閉時清理引用
    settingsWindow.on('closed', () => {
        console.log('Settings window closed'); // 添加調試日誌
        settingsWindow = null;
    });

    require('@electron/remote/main').enable(settingsWindow.webContents);
}

// 加載設置
function loadSettings() {
    // 這裡可以從文件或數據庫加載設置
    return {
        general: {
            autoPlay: true,
            rememberPosition: true,
            darkMode: true
        },
        video: {
            hardwareAcceleration: true,
            autoQuality: true,
            defaultVolume: 100
        }
    };
}

// 保存設置
function saveSettings(settings) {
    // 這裡可以將設置保存到文件或數據庫
    console.log('Saving settings:', settings);
}

// 添加 IPC 處理器創建或切換 filter 窗口
ipcMain.on('create-filter-window', (event, { title, filterData }) => {
    console.log('Creating filter window for:', title, filterData);
    
    const windowId = title;
    
    // 檢查是否已存在相應的濾鏡窗口
    if (filterWindows.has(windowId)) {
        const existingWindow = filterWindows.get(windowId);
        if (!existingWindow.isDestroyed()) {
            existingWindow.show();
            existingWindow.focus();
            existingWindow.webContents.send('filter-data', { title, filterData });
            return;
        }
    }

    const filterWindow = new BrowserWindow({
        width: 500,
        height: 720,
        minWidth: 450,
        minHeight: 600,
        frame: false,
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        show: false
    });

    filterWindows.set(windowId, filterWindow);
    filterWindow.loadFile('public/filter.html');

    filterWindow.webContents.on('did-finish-load', () => {
        filterWindow.webContents.send('filter-data', { title, filterData });
        filterWindow.show();
        filterWindow.center();
    });

    filterWindow.on('closed', () => {
        filterWindows.delete(windowId);
    });

    require('@electron/remote/main').enable(filterWindow.webContents);
});

// 修改 filter-update 處理器
ipcMain.on('filter-update', (event, filterValues) => {
    // 獲取發送窗口
    const filterWindow = BrowserWindow.fromWebContents(event.sender);
    if (filterWindow) {
        // 獲取窗口
        const mainWindow = BrowserWindow.getAllWindows().find(win => 
            win.webContents.getURL().includes('index.html')
        );
        
        if (mainWindow) {
            // 從 filterWindows Map 中找到對應的標題
            let targetTitle = null;
            for (const [title, window] of filterWindows.entries()) {
                if (window === filterWindow) {
                    targetTitle = title;
                    break;
                }
            }

            if (targetTitle) {
                // 將更新發送到主窗口，包含目標標題
                mainWindow.webContents.send('filter-update', {
                    targetTitle: targetTitle,
                    filterValues: filterValues
                });
            }
        }
    }
});

// 添加 IPC 處理器
ipcMain.on('open-settings', () => {
    console.log('Received open-settings request'); // 添加調試日誌
    createSettingsWindow();
});

ipcMain.on('save-settings', (event, settings) => {
    saveSettings(settings);
});

// 添加調試 IPC 通道
ipcMain.on('debug-info', (event, info) => {
    console.log('Debug info:', info);
});

// 當主進程退出時關閉所有濾鏡窗口
app.on('before-quit', (event) => {
    if (isTranscoding && currentFfmpegCommand) {
        event.preventDefault();
        try {
            currentFfmpegCommand.kill('SIGKILL');
            isTranscoding = false;
            currentFfmpegCommand = null;
            app.quit();
        } catch (error) {
            console.error('Error during app quit:', error);
            app.exit(1);
        }
    }
});

// 初始化設置
app.whenReady().then(() => {
    // 設置高性能模式
    if (process.platform === 'win32') {
        app.commandLine.appendSwitch('high-dpi-support', '1');
        app.commandLine.appendSwitch('force-device-scale-factor', '1');
    }
    
    createWindow();
    
    // 初始化解碼管理器
    const codecManager = new CodecManager();
    
    // 添加切換解碼器的處理
    ipcMain.handle('switch-decoder', async (event, decoder) => {
        try {
            codecManager.currentDecoder = decoder;
            console.log('切換到解碼器:', decoder);
            return { success: true, decoder };
        } catch (error) {
            console.error('切換解碼器失敗:', error);
            return { success: false, error: error.message };
        }
    });

    // 處理解碼請求
    ipcMain.handle('decode-video', async (event, filePath) => {
        try {
            console.log('開始解碼視頻:', filePath);
            const decodedData = await codecManager.decodeVideo(filePath);
            return { success: true, data: decodedData };
        } catch (error) {
            console.error('視頻解碼錯誤:', error);
            return { success: false, error: error.message };
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// 添加到適當的位置
let cardsWindow = null;

ipcMain.on('create-cards-window', (event, { videos }) => {
    if (cardsWindow) {
        cardsWindow.show();
        cardsWindow.focus();
        cardsWindow.webContents.send('cards-data', { videos });
        return;
    }

    cardsWindow = new BrowserWindow({
        width: 900,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        frame: false,
        backgroundColor: '#1a1a1a',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        alwaysOnTop: true,
        focusable: true
    });

    cardsWindow.loadFile('public/cards.html');
    require('@electron/remote/main').enable(cardsWindow.webContents);

    cardsWindow.webContents.on('did-finish-load', () => {
        cardsWindow.webContents.send('cards-data', { videos });
    });

    cardsWindow.on('closed', () => {
        cardsWindow = null;
    });

    // 監聽失去焦點事件
    cardsWindow.on('blur', () => {
        if (cardsWindow && !cardsWindow.isDestroyed()) {
            cardsWindow.setAlwaysOnTop(false);
        }
    });

    // 監聽獲得焦點事件
    cardsWindow.on('focus', () => {
        if (cardsWindow && !cardsWindow.isDestroyed()) {
            cardsWindow.setAlwaysOnTop(true);
        }
    });
});

// 處理聚媒體的請求
ipcMain.on('focus-media', (event, index) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('focus-media', index);
    }
});

// 處理打開濾鏡窗口的請求
ipcMain.on('open-filter', (event, { index, title }) => {
    // 轉發到主窗口，讓主窗口理打開濾鏡窗口的邏輯
    BrowserWindow.getAllWindows()[0].webContents.send('open-filter', { index, title });
});

// 處理刪除體的請求
ipcMain.on('delete-media', (event, index) => {
    console.log('Received delete request for index:', index); // 添加調試日誌
    
    // 獲取主窗口
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    
    if (mainWindow) {
        console.log('Forwarding delete request to main window'); // 添加調試日誌
        mainWindow.webContents.send('delete-media', index);
    }
});

// 處理批量刪除媒體的請求
ipcMain.on('batch-delete-media', (event, indices) => {
    console.log('Received batch delete request for indices:', indices); // 添加調試日誌
    
    // 獲取主窗口
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    
    if (mainWindow) {
        console.log('Forwarding batch delete request to main window'); // 添加調試日誌
        mainWindow.webContents.send('batch-delete-media', indices);
    }
});

// 處理批量刪除完成通知
ipcMain.on('batch-delete-completed', (event, result) => {
    console.log('Received batch delete completion:', result);
    
    // 轉發給所有卡片窗口
    const cardsWindows = BrowserWindow.getAllWindows().filter(win => 
        win.webContents.getURL().includes('cards.html')
    );
    
    cardsWindows.forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('batch-delete-completed', result);
        }
    });
});

// 添加更新卡片的處理
ipcMain.on('update-cards', (event, data) => {
    const cardsWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('cards.html')
    );
    if (cardsWindow) {
        cardsWindow.webContents.send('cards-data', data);
    }
});

// 處理請求 filterValues 的事件
ipcMain.on('request-filter-values', (event, index) => {
    // 轉發窗口
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('request-filter-values', index);
    }
});

// 處理接收到 filterValues
ipcMain.on('send-filter-values', (event, { index, filterValues }) => {
    // 轉發到卡片窗口
    if (cardsWindow && !cardsWindow.isDestroyed()) {
        cardsWindow.webContents.send('receive-filter-values', { index, filterValues });
    }
});

// 處理請求視頻數據的事件
ipcMain.on('request-videos-data', (event) => {
    // 獲取主窗口
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        // 請求主窗口發送最新的視頻數據
        mainWindow.webContents.send('request-videos-data');
    }
});

// 添加這些事件處理器
ipcMain.on('reset-transform', (event, index) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        // 發送到主窗口的 transformManager
        mainWindow.webContents.send('transform', {
            type: 'reset',
            index: index
        });
    }
});

ipcMain.on('flip-x', (event, index) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        // 發送到主窗口的 transformManager
        mainWindow.webContents.send('transform', {
            type: 'flip-x',
            index: index
        });
    }
});

ipcMain.on('flip-y', (event, index) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        // 發送到主窗口的 transformManager
        mainWindow.webContents.send('transform', {
            type: 'flip-y',
            index: index
        });
    }
});

ipcMain.on('resize-media', (event, index) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('resize-media', index);
    }
});

ipcMain.on('save-layout', (event) => {
    // 轉發到主窗口
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('save-layout');
    }
});

ipcMain.on('load-layout', (event) => {
    // 轉發到主窗口
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('load-layout');
    }
});

// 處理顯示/隱藏的事件
ipcMain.on('toggle-visible', (event, index) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('toggle-visible', index);
    }
});

// 處理設置媒體縮放的事件
ipcMain.on('set-media-scale', (event, { index, scale }) => {
    console.log('Setting media scale:', { index, scale });
    
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('set-media-scale', { index, scale });
    }
});

// 添加創建轉碼進度窗口的函數
function createTranscodeWindow() {
    if (transcodeWindow) {
        transcodeWindow.show();
        return transcodeWindow;
    }

    transcodeWindow = new BrowserWindow({
        width: 500,
        height: 325,  // 初始高度
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    transcodeWindow.loadFile('public/transcode.html');

    // 等待頁面加載完成後調整窗口大小
    transcodeWindow.webContents.on('did-finish-load', () => {
        // 獲取內容實際高度
        transcodeWindow.webContents.executeJavaScript(`
            document.body.offsetHeight;
        `).then(contentHeight => {
            // 添加一些邊距
            const windowHeight = contentHeight + 30;  // 20px 邊距
            // 設置最小和最大高度限制
            const minHeight = 220;
            const maxHeight = 400;
            // 計算最終高度
            const finalHeight = Math.min(Math.max(windowHeight, minHeight), maxHeight);
            
            // 調整窗口大小
            transcodeWindow.setSize(500, finalHeight);
            // 重新置中
            transcodeWindow.center();
        });
    });

    // 添加關閉事件處理
    transcodeWindow.on('closed', () => {
        if (currentFfmpegCommand && isTranscoding) {
            currentFfmpegCommand.kill('SIGKILL');
            isTranscoding = false;
            currentFfmpegCommand = null;
        }
        transcodeWindow = null;
    });

    return transcodeWindow;
}

// 添加一個變量來追踪轉碼狀態
let isTranscoding = false;
let currentFfmpegCommand = null;

// 添加新的轉碼選項窗口
let transcodeOptionsWindow = null;

function createTranscodeOptionsWindow() {
    transcodeOptionsWindow = new BrowserWindow({
        width: 500,
        height: 400,
        modal: true,
        alwaysOnTop: true,
        frame: false,
        resizable: false,
        movable: true,  // 確保窗口可以移動
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    transcodeOptionsWindow.loadFile('public/transcode_options.html');

    // 等待頁面加載完成後調整窗口大小
    transcodeOptionsWindow.webContents.on('did-finish-load', () => {
        // 獲取實際內容高度
        transcodeOptionsWindow.webContents.executeJavaScript(`
            new Promise((resolve) => {
                // 獲取各個元素的高度
                const title = document.querySelector('.title').offsetHeight;
                const options = document.querySelector('.options').scrollHeight;
                const buttons = document.querySelector('.buttons').offsetHeight;
                const padding = 30; // 額外邊距
                
                // 計算總高度
                const totalHeight = title + options + buttons + padding;
                resolve(totalHeight);
            });
        `).then(contentHeight => {
            // 設置最小和最大高度限制
            const minHeight = 300;
            const maxHeight = 600;
            // 計算最終高度
            const finalHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);
            
            // 調整窗口大小
            transcodeOptionsWindow.setSize(500, finalHeight);
            // 重新置中
            transcodeOptionsWindow.center();
        });
    });
}

// GPU兼容性檢測函數
async function checkGPUCompatibility() {
    return new Promise((resolve) => {
        const testCommand = ffmpeg()
            .addInput('color=red:size=320x240:duration=1')
            .inputFormat('lavfi')
            .videoCodec('h264_nvenc')
            .addOptions(['-f', 'null', '-y'])
            .output('-')
            .on('start', () => {
                console.log('Testing GPU compatibility...');
            })
            .on('end', () => {
                console.log('GPU encoding is available');
                resolve(true);
            })
            .on('error', (err) => {
                console.log('GPU encoding not available:', err.message);
                resolve(false);
            });
        
        testCommand.run();
    });
}

// 修改轉碼處理部分
ipcMain.on('transcode-video', async (event, { path: videoPath, name }) => {
    try {
        // 創建轉碼選項窗口
        createTranscodeOptionsWindow();

        // 等待用戶選擇
        const optionResult = await new Promise(resolve => {
            ipcMain.once('transcode-option-selected', (event, result) => {
                if (transcodeOptionsWindow) {
                    transcodeOptionsWindow.close();
                    transcodeOptionsWindow = null;
                }
                resolve(result);
            });
        });

        // 如果用戶取消，則終止轉碼
        if (optionResult.cancelled) {
            event.reply('transcode-complete', {
                success: false,
                cancelled: true
            });
            return;
        }

        // 讀取預設配置
        const presets = require('./public/transcode_presets.json');
        let selectedPreset = presets[optionResult.quality];

        // 如果選擇了GPU選項，檢查GPU兼容性
        if (optionResult.quality.startsWith('gpu_')) {
            const gpuAvailable = await checkGPUCompatibility();
            if (!gpuAvailable) {
                console.log('GPU encoding not available, falling back to CPU');
                // 降級到對應的CPU預設
                const fallbackMap = {
                    'gpu_low': 'low',
                    'gpu_medium': 'medium',
                    'gpu_high': 'high',
                    'gpu_ultra': 'ultra'
                };
                selectedPreset = presets[fallbackMap[optionResult.quality]] || presets['medium'];
                
                // 通知用戶降級
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('show-notification', {
                        type: 'warning',
                        message: 'GPU編碼不可用，已切換到CPU編碼'
                    });
                }
            }
        }

        // 繼續原有的轉碼流程...
        console.log('Received transcoding request:', { videoPath, name });
        const outputPath = path.join(os.tmpdir(), `transcoded-${Date.now()}.mp4`);
        
        isTranscoding = true;
        const window = createTranscodeWindow();
        
        try {
            // 先獲取視頻信息
            const probeResult = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(videoPath, (err, metadata) => {
                    if (err) {
                        console.error('Error probing file:', err);
                        // 如果探測失敗，返回一個基本的元數據對象
                        resolve({
                            format: {
                                duration: 0
                            },
                            streams: []
                        });
                        return;
                    }
                    resolve(metadata);
                });
            });

            // 輸出調試信息
            console.log('Video metadata:', probeResult);
            console.log('Video streams:', probeResult.streams);
            
            // 檢查音頻流
            const audioStreams = probeResult.streams.filter(stream => stream.codec_type === 'audio');
            console.log('Available audio streams:', audioStreams);

            // 獲取時長
            const duration = probeResult.format.duration || 0;
            console.log('Video duration:', duration);

            // 創建 FFmpeg 命令
            currentFfmpegCommand = ffmpeg(videoPath)
                .toFormat('mp4')
                .addOptions(selectedPreset.options)
                .addOptions([
                    '-threads 0',
                    '-movflags +faststart',
                    '-y',
                    '-stats',
                    '-progress pipe:1'
                ])
                .on('start', (commandLine) => {
                    if (!isTranscoding) return;
                    console.log('FFmpeg Start Transcoding:', commandLine);
                    if (window && !window.isDestroyed()) {
                        window.webContents.send('transcode-start', { 
                            name: name,
                            path: videoPath
                        });
                    }
                })
                .on('progress', (progress) => {
                    if (!isTranscoding) return;
                    try {
                        // 檢查窗口是否還存在
                        if (!window || window.isDestroyed()) {
                            currentFfmpegCommand.kill('SIGKILL');
                            isTranscoding = false;
                            return;
                        }

                        // 確保時間標記格式正確
                        const currentTime = progress.timemark && /^\d{2}:\d{2}:\d{2}/.test(progress.timemark) 
                            ? timemarkToSeconds(progress.timemark) 
                            : 0;
                            
                        // 計算更精確的進度，不要四捨五入
                        let percentage = duration ? (currentTime / duration) * 100 : 0;
                        // 不限制小數位數讓進度更平滑
                        percentage = Math.max(0, Math.min(percentage, 100));

                        window.webContents.send('transcode-progress', { 
                            progress: percentage,
                            frame: progress.frames || 0,
                            fps: progress.currentFps || 0,
                            speed: progress.currentKbps || 0,
                            stage: '轉碼中',
                            currentTime: Math.max(currentTime, 0),
                            duration: Math.max(duration, 0)
                        });
                    } catch (error) {
                        console.error('Progress calculation error:', error);
                    }
                })
                .on('end', () => {
                    isTranscoding = false;
                    currentFfmpegCommand = null;
                    console.log('Transcoding Complete:', outputPath);
                    
                    if (window && !window.isDestroyed()) {
                        // 先發送 100% 進度
                        window.webContents.send('transcode-progress', { 
                            progress: 100,
                            frame: 0,
                            fps: 0,
                            speed: 0,
                            stage: '完成轉碼',
                            currentTime: duration,
                            duration: duration
                        });

                        // 延遲一秒後再發送完成信號並關閉窗口
                        setTimeout(() => {
                            if (window && !window.isDestroyed()) {
                                window.webContents.send('transcode-complete', { success: true });
                                // 再延遲一秒關閉窗口
                                setTimeout(() => {
                                    if (window && !window.isDestroyed()) {
                                        window.close();
                                    }
                                }, 1000);
                            }
                        }, 1000);
                    }
                    
                    event.reply('transcode-complete', {
                        success: true,
                        url: `file://${outputPath}`
                    });
                })
                .on('error', async (err) => {
                    console.error('Transcoding Error:', err);
                    
                    // 如果是GPU編碼錯誤且使用的是GPU預設，嘗試降級到CPU
                    if (optionResult.quality.startsWith('gpu_') && 
                        (err.message.includes('nvenc') || 
                         err.message.includes('3221225477') ||
                         err.code === 3221225477)) {
                        
                        console.log('GPU encoding failed, attempting CPU fallback...');
                        
                        // 通知用戶正在降級
                        if (window && !window.isDestroyed()) {
                            window.webContents.send('transcode-fallback', { 
                                message: 'GPU編碼失敗，正在切換到CPU編碼...'
                            });
                        }
                        
                        // 降級到對應的CPU預設
                        const fallbackMap = {
                            'gpu_low': 'low',
                            'gpu_medium': 'medium',
                            'gpu_high': 'high',
                            'gpu_ultra': 'ultra'
                        };
                        const fallbackPreset = presets[fallbackMap[optionResult.quality]] || presets['medium'];
                        
                        // 重新開始轉碼，使用CPU編碼
                        currentFfmpegCommand = ffmpeg(videoPath)
                            .toFormat('mp4')
                            .addOptions(fallbackPreset.options)
                            .addOptions([
                                '-threads 0',
                                '-movflags +faststart',
                                '-y',
                                '-stats',
                                '-progress pipe:1'
                            ])
                            .on('start', (commandLine) => {
                                if (!isTranscoding) return;
                                console.log('FFmpeg CPU Fallback:', commandLine);
                                if (window && !window.isDestroyed()) {
                                    window.webContents.send('transcode-start', { 
                                        name: name,
                                        path: videoPath,
                                        fallback: true
                                    });
                                }
                            })
                            .on('progress', (progress) => {
                                if (!isTranscoding) return;
                                try {
                                    if (!window || window.isDestroyed()) {
                                        currentFfmpegCommand.kill('SIGKILL');
                                        isTranscoding = false;
                                        return;
                                    }

                                    const currentTime = progress.timemark && /^\d{2}:\d{2}:\d{2}/.test(progress.timemark) 
                                        ? timemarkToSeconds(progress.timemark) 
                                        : 0;
                                        
                                    let percentage = duration ? (currentTime / duration) * 100 : 0;
                                    percentage = Math.max(0, Math.min(percentage, 100));

                                    window.webContents.send('transcode-progress', { 
                                        progress: percentage,
                                        frame: progress.frames || 0,
                                        fps: progress.currentFps || 0,
                                        speed: progress.currentKbps || 0,
                                        stage: 'CPU轉碼中',
                                        currentTime: Math.max(currentTime, 0),
                                        duration: Math.max(duration, 0)
                                    });
                                } catch (error) {
                                    console.error('Progress calculation error:', error);
                                }
                            })
                            .on('end', () => {
                                isTranscoding = false;
                                currentFfmpegCommand = null;
                                console.log('CPU Fallback Transcoding completed');
                                
                                if (window && !window.isDestroyed()) {
                                    window.webContents.send('transcode-progress', { 
                                        progress: 100,
                                        frame: 0,
                                        fps: 0,
                                        speed: 0,
                                        stage: 'CPU轉碼完成',
                                        currentTime: duration,
                                        duration: duration
                                    });

                                    setTimeout(() => {
                                        if (window && !window.isDestroyed()) {
                                            window.webContents.send('transcode-complete', { success: true });
                                            setTimeout(() => {
                                                if (window && !window.isDestroyed()) {
                                                    window.close();
                                                }
                                            }, 1000);
                                        }
                                    }, 1000);
                                }
                                
                                event.reply('transcode-complete', {
                                    success: true,
                                    url: `file://${outputPath}`
                                });
                            })
                            .on('error', (fallbackError) => {
                                console.error('CPU Fallback also failed:', fallbackError);
                                isTranscoding = false;
                                currentFfmpegCommand = null;
                                
                                if (window && !window.isDestroyed()) {
                                    window.webContents.send('transcode-error', { 
                                        error: `GPU和CPU編碼都失敗: ${fallbackError.message}`
                                    });
                                    setTimeout(() => {
                                        if (!window.isDestroyed()) {
                                            window.close();
                                        }
                                    }, 1500);
                                }
                                
                                event.reply('transcode-complete', {
                                    success: false,
                                    error: fallbackError.message
                                });
                            });
                        
                        // 開始CPU降級轉碼
                        currentFfmpegCommand.save(outputPath);
                        return;
                    }
                    
                    // 非GPU錯誤或無法降級的情況
                    isTranscoding = false;
                    currentFfmpegCommand = null;
                    
                    if (window && !window.isDestroyed()) {
                        window.webContents.send('transcode-error', { error: err.message });
                        setTimeout(() => {
                            if (!window.isDestroyed()) {
                                window.close();
                            }
                        }, 1500);
                    }
                    
                    event.reply('transcode-complete', {
                        success: false,
                        error: err.message
                    });
                });

            // 開始轉碼
            console.log('Starting transcoding to:', outputPath);
            currentFfmpegCommand.save(outputPath);

        } catch (error) {
            console.error('Transcoding error:', error);
            event.reply('transcode-complete', {
                success: false,
                error: error.message
            });
        }
    } catch (error) {
        console.error('Transcoding error:', error);
        event.reply('transcode-complete', {
            success: false,
            error: error.message
        });
    }
});

// 輔助函數：獲取視頻時長
function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            try {
                if (err) {
                    console.error('Error getting video duration:', err);
                    resolve(0);
                    return;
                }
                const duration = metadata?.format?.duration || 0;
                // 確保時長是有效的正數
                resolve(Math.max(duration, 0));
            } catch (error) {
                console.error('Duration calculation error:', error);
                resolve(0);
            }
        });
    });
}

// 輔助函數：將時間標記轉換為秒
function timemarkToSeconds(timemark) {
    try {
        if (!timemark || typeof timemark !== 'string') return 0;
        
        // 確保時間格式正確
        const match = timemark.match(/(\d{2}):(\d{2}):(\d{2})/);
        if (!match) return 0;
        
        const [, hours, minutes, seconds] = match;
        const totalSeconds = (parseInt(hours) * 3600) + 
                           (parseInt(minutes) * 60) + 
                           parseFloat(seconds);
                           
        // 確保返回有效數字
        return isNaN(totalSeconds) ? 0 : Math.max(totalSeconds, 0);
    } catch (error) {
        console.error('Time conversion error:', error);
        return 0;
    }
}

// 處理視頻播放控制
ipcMain.on('toggle-play', (event, index) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        // 發送到主窗口
        mainWindow.webContents.send('toggle-play', index);
        
        // 等待主窗口回應播放狀態
        ipcMain.once('video-state-changed', (event, { index, isPlaying }) => {
            // 發送回卡片窗口
            const cardsWindow = BrowserWindow.getAllWindows().find(win => 
                win.webContents.getURL().includes('cards.html')
            );
            if (cardsWindow) {
                cardsWindow.webContents.send('video-play-state', { index, isPlaying });
            }
        });
    }
});

ipcMain.on('seek-video', (event, { index, time }) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('seek-video', { index, time });
    }
});

// 處理靜音切換
ipcMain.on('toggle-mute', (event, index) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('toggle-mute', index);
        
        // 等待主窗口回應靜音狀態
        ipcMain.once('video-mute-changed', (event, { index, isMuted }) => {
            const cardsWindow = BrowserWindow.getAllWindows().find(win => 
                win.webContents.getURL().includes('cards.html')
            );
            if (cardsWindow) {
                cardsWindow.webContents.send('video-mute-state', { index, isMuted });
            }
        });
    }
});

// 處理循環播切換
ipcMain.on('toggle-loop', (event, index) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('toggle-loop', index);
        
        // 等待主窗口回應循環狀態
        ipcMain.once('video-loop-changed', (event, { index, isLooping }) => {
            const cardsWindow = BrowserWindow.getAllWindows().find(win => 
                win.webContents.getURL().includes('cards.html')
            );
            if (cardsWindow) {
                cardsWindow.webContents.send('video-loop-changed', { index, isLooping });
            }
        });
    }
});

// 添加應用程序退出處理
app.on('window-all-closed', () => {
    if (isTranscoding && currentFfmpegCommand) {
        currentFfmpegCommand.kill('SIGKILL');
        isTranscoding = false;
        currentFfmpegCommand = null;
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 處理視頻狀態變化
ipcMain.on('video-state-changed', (event, { index, isPlaying }) => {
    // 找到卡片窗口
    const cardsWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('cards.html')
    );
    if (cardsWindow) {
        // 發送狀態更新到卡片窗口
        cardsWindow.webContents.send('video-play-state', { index, isPlaying });
    }
});

ipcMain.on('video-time-update', (event, { index, currentTime, duration }) => {
    const cardsWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('cards.html')
    );
    if (cardsWindow) {
        cardsWindow.webContents.send('video-time-update', { index, currentTime, duration });
    }
});

ipcMain.on('video-mute-changed', (event, { index, isMuted }) => {
    const cardsWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('cards.html')
    );
    if (cardsWindow) {
        cardsWindow.webContents.send('video-mute-changed', { index, isMuted });
    }
});

ipcMain.on('video-loop-changed', (event, { index, isLooping }) => {
    const cardsWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('cards.html')
    );
    if (cardsWindow) {
        cardsWindow.webContents.send('video-loop-changed', { index, isLooping });
    }
});

ipcMain.on('video-seek-to', (event, { index, currentTime, duration }) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('video-seek-to', { 
            index, 
            currentTime,
            duration 
        });
    }
});

ipcMain.on('video-skipnext', (event, index) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('video-skipnext', index);
    }
});

ipcMain.on('video-skipprev', (event, index) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('video-skipprev', index);
    }
});

// 處理時間範圍更新
ipcMain.on('time-range-update', (event, { index, startTime, endTime }) => {
    const cardsWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('cards.html')
    );
    if (cardsWindow) {
        cardsWindow.webContents.send('time-range-update', { 
            index, 
            startTime, 
            endTime 
        });
    }
});

// 處理重置時間範圍
ipcMain.on('reset-time-range', (event, { index }) => {
    const cardsWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('cards.html')
    );
    if (cardsWindow) {
        cardsWindow.webContents.send('reset-time-range', { index });
    }
});


ipcMain.handle('process-raw-image', async (event, { path, options }) => {
    console.log('Received RAW file for processing:', path);
    console.log('Processing options:', options);
    
    try {
        const dcrawManager = new DcrawCodecManager();
        const jpegData = await dcrawManager.convertRawToJpeg(path, options);
        console.log('RAW processing successful');

        // 確保返回的數據是可序列化的
        return {
            success: true,
            data: Buffer.from(jpegData) // 確保數據是 Buffer
        };
    } catch (error) {
        console.error('RAW processing failed:', error);
        return {
            success: false,
            error: error.toString() // 確保錯誤是字符串
        };
    }
});

// 添加到適當的位置（在其他 ipcMain 處理器附近）
let rawOptionsWindow = null;

ipcMain.on('create-raw-options-window', (event, { filename }) => {
    if (rawOptionsWindow) {
        rawOptionsWindow.focus();
        return;
    }

    rawOptionsWindow = new BrowserWindow({
        width: 500,
        height: 600,
        modal: true,
        alwaysOnTop: true,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    rawOptionsWindow.loadFile('public/raw_options.html');

    // 設置窗口在屏幕中央
    rawOptionsWindow.once('ready-to-show', () => {
        rawOptionsWindow.center();
        rawOptionsWindow.show();
    });

    rawOptionsWindow.on('closed', () => {
        rawOptionsWindow = null;
    });
});

// 處理選項選擇結果
ipcMain.on('raw-option-selected', (event, result) => {
    // 將結果轉發給主窗口
    mainWindow.webContents.send('raw-option-selected', result);
});

// 處理打開視頻編輯器的請求
ipcMain.on('open-video-editor', (event, videoData) => {
    const editorWindow = new BrowserWindow({
        width: 800,
        height: 800,
        frame: false,
        resizable: true,
        alwaysOnTop: true,
        movable: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // 設置窗口在屏幕中央
    editorWindow.center();

    editorWindow.loadFile('public/video_editor.html');
    
    editorWindow.webContents.on('did-finish-load', () => {
        editorWindow.webContents.send('init-editor', videoData);
    });
});

// 處理視頻輸出請求
ipcMain.on('export-edited-video', async (event, data) => {
    try {
        // 這裡處理視頻輸出邏輯
        // 使用 FFmpeg 進行視頻處理
        // ...

        event.reply('export-complete', {
            success: true,
            outputPath: '輸出路徑'
        });
    } catch (error) {
        event.reply('export-complete', {
            success: false,
            error: error.message
        });
    }
});

// 處理跳轉到指定時間
ipcMain.on('seek-to', (event, { index, position }) => {
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        mainWindow.webContents.send('seek-to', { index, position });
    }
});

// 處理取消轉碼請求
ipcMain.on('cancel-transcode', (event) => {
    if (isTranscoding && currentFfmpegCommand) {
        try {
            currentFfmpegCommand.kill('SIGKILL');
            isTranscoding = false;
            currentFfmpegCommand = null;
            // 通知渲染进程取消成功
            const transcodeWindow = BrowserWindow.getAllWindows().find(win => 
                win.webContents.getURL().includes('transcode.html')
            );
            if (transcodeWindow) {
                transcodeWindow.webContents.send('transcode-cancelled');
                // 等待一段时间后关闭窗口
                setTimeout(() => {
                    if (!transcodeWindow.isDestroyed()) {
                        transcodeWindow.close();
                    }
                }, 1500); // 1.5秒后关闭，给用户时间看到取消状态
            }
        } catch (error) {
            console.error('Error killing ffmpeg process:', error);
        }
    }
});

// 處理視頻順序更新
ipcMain.on('update-video-order', (event, { fromIndex, toIndex }) => {
    // 通知所有窗口更新視頻順序
    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('video-order-updated', { fromIndex, toIndex });
        }
    });
});

// 處理來自 cards 窗口的文件拖拽
ipcMain.on('add-video-from-cards', (event, { name, path, type }) => {
    console.log('Adding video from cards window:', name);
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        // 通知主窗口添加視頻文件
        mainWindow.webContents.send('add-video-file', { name, path, type });
    }
});

ipcMain.on('add-image-from-cards', (event, { name, path, type }) => {
    console.log('Adding image from cards window:', name);
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        // 通知主窗口添加圖片文件
        mainWindow.webContents.send('add-image-file', { name, path, type });
    }
});

ipcMain.on('add-raw-image-from-cards', (event, { name, path, options }) => {
    console.log('Adding RAW image from cards window:', name);
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
        win.webContents.getURL().includes('index.html')
    );
    if (mainWindow) {
        // 通知主窗口添加 RAW 圖片文件
        mainWindow.webContents.send('add-raw-image-file', { name, path, options });
    }
});
