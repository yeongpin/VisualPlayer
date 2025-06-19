const { ipcRenderer } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

class CodecManager {
    constructor() {
        // 支持的編解碼器列表
        this.supportedCodecs = {
            'video/mp4; codecs="avc1.42E01E"': 'H.264',
            'video/mp4; codecs="avc1.64001F"': 'H.264 High Profile',
            'video/webm; codecs="vp8"': 'VP8',
            'video/webm; codecs="vp9"': 'VP9',
            'video/mp4; codecs="av01"': 'AV1',
            'video/quicktime': 'QuickTime/MOV',
            'video/x-mjpeg': 'MJPEG',
            'video/mjpeg': 'MJPEG',
            'video/x-matroska': 'MKV',
            'video/x-m4v': 'M4V',
            'video/x-msvideo': 'AVI',
            'video/x-flv': 'FLV'
        };

        // 支持的文件格式
        this.supportedFormats = [
            'mp4', 'webm', 'ogg', 'mov', 
            'mkv', 'm4v', 'avi', 'flv',
            'wmv', '3gp', 'ts', 'mts',
            'm2ts', 'qt', 'mjpeg', 'mjpg'
        ];

        this.decoders = ['ffmpeg', 'lav'];
        this.currentDecoder = 'ffmpeg';

        // 只在渲染進程中檢查編解碼器
        if (process.type === 'renderer') {
            this.checkSystemCodecs();
        }

        // 設置 LAV Filters 路徑
        this.lavFiltersPath = this.getLAVFiltersPath();
    }

    getLAVFiltersPath() {
        // 判斷是否在開發環境
        const isDev = process.env.NODE_ENV === 'development' || !process.resourcesPath;
        
        if (isDev) {
            // 開發環境下的路徑
            return path.join(__dirname, '..', 'external', 'LAVFilters');
        } else {
            // 生產環境下的路徑
            return path.join(process.resourcesPath, 'external', 'LAVFilters');
        }
    }

    async checkSystemCodecs() {
        try {
            if (typeof window === 'undefined' || typeof MediaSource === 'undefined') {
                console.log('MediaSource API not available in this context');
                return;
            }

            console.log('System Codec Support Status:');
            for (let codec in this.supportedCodecs) {
                try {
                    const isSupported = MediaSource.isTypeSupported(codec);
                    console.log(`${this.supportedCodecs[codec]}: ${isSupported ? 'Supported' : 'Not Supported'}`);
                } catch (err) {
                    console.log(`${this.supportedCodecs[codec]}: Check failed`);
                }
            }
        } catch (error) {
            console.error('Error checking system codecs:', error);
        }
    }

    async handleVideoFile(file) {
        console.log('Processing file:', file.name, 'Type:', file.type);

        // 检查文件格式和编码
        // 优先使用直接播放的方式
        const directBlobUrl = URL.createObjectURL(file);
        
        try {
            // 先尝试直接播放
            const canPlayDirectly = await this.tryPlayVideo(directBlobUrl);
            if (canPlayDirectly) {
                console.log('File can be played directly without transcoding');
                return directBlobUrl;
            }
            
            // 如果无法直接播放，释放blob URL
            URL.revokeObjectURL(directBlobUrl);
        } catch (error) {
            console.error('Direct playback test failed:', error);
            URL.revokeObjectURL(directBlobUrl);
        }
        
        // 如果直接播放失败，判断是否需要转码
        const needsTranscoding = await this.checkIfNeedsTranscoding(file);
        console.log('Needs transcoding:', needsTranscoding);

        if (!needsTranscoding) {
            // 如果不需要转码，创建 blob URL
            const blobUrl = URL.createObjectURL(file);
            try {
                // 进行更严格的播放测试
                const canPlay = await this.tryPlayVideo(blobUrl);
                if (canPlay) {
                    console.log('File can be played directly');
                    return blobUrl;
                }
            } catch (error) {
                console.error('Playback test failed:', error);
                URL.revokeObjectURL(blobUrl);
            }
        }

        // 需要转码的情况
        console.log('Starting transcoding process');
        try {
            const result = await this.transcodeVideo(file);
            return result;
        } catch (error) {
            console.error('Transcoding failed:', error);
            throw error;
        }
    }

    tryPlayVideo(url) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            let timeoutId;

            const cleanup = () => {
                clearTimeout(timeoutId);
                video.removeEventListener('loadeddata', onLoadedData);
                video.removeEventListener('error', onError);
                video.remove();
            };

            const onLoadedData = () => {
                if (video.readyState >= 3 && !video.videoWidth) {
                    // 如果视频加载了但没有宽度，可能是音频文件或损坏的视频
                    cleanup();
                    resolve(false);
                } else if (video.readyState >= 3) { // HAVE_FUTURE_DATA
                    cleanup();
                    resolve(true);
                }
            };

            const onError = (error) => {
                cleanup();
                reject(error);
            };

            // 快速检测超时时间
            timeoutId = setTimeout(() => {
                cleanup();
                resolve(false);
            }, 1000); // 1 秒快速检测

            video.addEventListener('loadeddata', onLoadedData);
            video.addEventListener('error', onError);
            video.preload = 'auto';
            video.src = url;
            video.load(); // 强制开始加载
        });
    }

    isDirectlySupported(file) {
        const video = document.createElement('video');
        const canPlay = video.canPlayType(file.type);
        console.log(`Check Format Support: ${file.type} - ${canPlay}`);
        return canPlay !== "" && canPlay !== "no";
    }

    async checkIfNeedsTranscoding(file) {
        // 获取文件扩展名
        const extension = file.name.split('.').pop().toLowerCase();
        const metadata = await this.getVideoMetadata(file);
        
        // 特殊处理MOV文件
        if (extension === 'mov' || file.type === 'video/quicktime') {
            // 对于MOV文件，我们先假设它可以直接播放
            // 除非metadata中发现不兼容的编解码器
            if (metadata && !metadata.error) {
                // 如果MOV使用常见编解码器如H.264，可以直接播放
                const compatibleCodecs = [
                    'avc1', 'h264', 'mp4v', 'mp4a', 'aac'
                ];
                
                // 检查metadata中的编解码器信息
                if (metadata.codec && 
                    compatibleCodecs.some(codec => metadata.codec.toLowerCase().includes(codec))) {
                    console.log('MOV file uses compatible codec, trying direct playback');
                    return false; // 不需要转码
                }
                
                console.log('MOV file uses incompatible codec, needs transcoding');
            }
        }
        
        // 如果不是支持的格式，则需要转码
        if (!this.supportedFormats.includes(extension)) {
            console.log('Unsupported format:', extension);
            return true;
        }
        
        // 检查视频元数据
        if (metadata.error) {
            console.log('Metadata error, needs transcoding:', metadata.error);
            return true;
        }
        
        // 检查编解码器
        const { format, codec } = metadata;
        console.log('Video format:', format, 'Codec:', codec);
        
        // 某些类型的编解码器需要转码
        const needsTranscodingCodecs = [
            'hevc', 'h265', 'vp9', 'av1',
            'prores', 'dnxhd', 'jpeg2000'
        ];
        
        if (codec && needsTranscodingCodecs.some(c => codec.toLowerCase().includes(c))) {
            console.log('Codec needs transcoding:', codec);
            return true;
        }
        
        return false;
    }

    async getDetailedMetadata(file) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            video.onloadedmetadata = () => {
                // 創建 MediaSource 以檢查更多信息
                try {
                    const mediaSource = new MediaSource();
                    mediaSource.addEventListener('sourceopen', () => {
                        try {
                            const sourceBuffer = mediaSource.addSourceBuffer(file.type);
                            resolve({
                                duration: video.duration,
                                width: video.videoWidth,
                                height: video.videoHeight,
                                type: file.type,
                                codec: sourceBuffer.type
                            });
                        } catch (e) {
                            resolve({
                                duration: video.duration,
                                width: video.videoWidth,
                                height: video.videoHeight,
                                type: file.type,
                                needsTranscode: true
                            });
                        }
                        URL.revokeObjectURL(video.src);
                    });
                    video.src = URL.createObjectURL(mediaSource);
                } catch (e) {
                    resolve({
                        duration: video.duration,
                        width: video.videoWidth,
                        height: video.videoHeight,
                        type: file.type,
                        needsTranscode: true
                    });
                    URL.revokeObjectURL(video.src);
                }
            };

            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                resolve({ needsTranscode: true });
            };

            const blobUrl = URL.createObjectURL(file);
            video.src = blobUrl;
        });
    }

    isCodecSupported(codec) {
        // 檢查常見的編解碼器
        const supportedCodecs = {
            'video/mp4; codecs="avc1.42E01E"': true,  // H.264 Baseline
            'video/mp4; codecs="avc1.4D401E"': true,  // H.264 Main
            'video/mp4; codecs="avc1.64001E"': true,  // H.264 High
            'video/webm; codecs="vp8"': true,         // VP8
            'video/webm; codecs="vp9"': true          // VP9
        };

        return supportedCodecs[codec] || false;
    }

    async transcodeVideo(file) {
        return new Promise((resolve, reject) => {
            console.log('Start Transcoding:', file);

            // 獲取文件的實際路徑
            const filePath = file.path || URL.createObjectURL(file);
            console.log('File Path:', filePath);

            // 發送到主進程進行轉碼
            ipcRenderer.send('transcode-video', {
                path: filePath,
                name: file.name
            });

            // 監聽轉碼完成事件
            ipcRenderer.once('transcode-complete', (event, result) => {
                if (result.success) {
                    resolve(result.url);
                } else {
                    console.error('Decode Failed:', result.error);
                    reject(new Error(result.error));
                }
            });
        });
    }

    checkCodecSupport() {
        const support = {};
        for (const [codec, name] of Object.entries(this.supportedCodecs)) {
            support[name] = MediaSource.isTypeSupported(codec);
        }
        return support;
    }

    // 獲取視頻文件的詳細信息
    async getVideoMetadata(file) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = URL.createObjectURL(file);

            video.onloadedmetadata = () => {
                resolve({
                    duration: video.duration,
                    width: video.videoWidth,
                    height: video.videoHeight,
                    format: file.type
                });
                URL.revokeObjectURL(video.src);
            };

            video.onerror = () => {
                resolve({
                    error: 'Unable to read video metadata',
                    format: file.type
                });
                URL.revokeObjectURL(video.src);
            };
        });
    }

    async decodeVideo(filePath) {
        try {
            console.log('開始解碼，嘗試使用:', this.currentDecoder);
            
            // 首先嘗試使用 LAV Filters
            if (this.currentDecoder === 'lav') {
                try {
                    console.log('使用 LAV Filters 解碼...');
                    return await this.decodeWithLAV(filePath);
                } catch (lavError) {
                    console.error('LAV Filters 解碼失敗:', lavError);
                    console.log('切換到 FFmpeg...');
                    this.currentDecoder = 'ffmpeg';
                }
            }
            
            // 如果 LAV 失敗或者默認使用 FFmpeg
            if (this.currentDecoder === 'ffmpeg') {
                return await this.decodeWithFFmpeg(filePath);
            }
        } catch (error) {
            console.error('解碼失敗:', error);
            throw new Error(`視頻解碼失敗: ${error.message}`);
        }
    }

    async decodeWithFFmpeg(filePath) {
        const ffmpegPath = require('ffmpeg-static').path;
        return new Promise((resolve, reject) => {
            const ffmpegProcess = spawn(ffmpegPath, [
                '-i', filePath,
                '-c:v', 'libx264',     // 使用 H.264 編碼器
                '-preset', 'medium',    // 平衡速度和質量
                '-crf', '18',          // 較低的 CRF 值代表更高的質量（範圍 0-51，18 是很好的質量）
                '-pix_fmt', 'yuv420p', // 標準像素格式
                '-vf', 'scale=-2:1080', // 保持寬高比縮放到 1080p
                '-movflags', '+faststart',
                '-y'                    // 覆蓋輸出文件
            ]);

            // ... 其餘錯誤處理代碼 ...
        });
    }

    async decodeWithLAV(filePath) {
        return new Promise((resolve, reject) => {
            // 使用完整路徑
            const lavVideoPath = path.join(this.lavFiltersPath, 'LAVVideo.ax');
            console.log('LAV Video 路徑:', lavVideoPath);
            
            // LAV Filters 的高質量設定
            const lavProcess = spawn(lavVideoPath, [
                '-i', filePath,
                '--hw', '1',           // 啟用硬體加速
                '--threads', '0',      // 使用所有可用線程
                '--output-format', 'yuv420p10le', // 10-bit 色深
                '--deint', 'auto',     // 自動去隔行
                '--dither', 'high',    // 高質量抖動
                '--quality', 'high'    // 高質量模式
            ]);

            lavProcess.on('error', (error) => {
                console.error('LAV Filters 執行錯誤:', error);
                reject(new Error(`LAV Filters 解碼錯誤: ${error.message}`));
            });

            // 添加更多錯誤日誌
            lavProcess.stderr.on('data', (data) => {
                console.log('LAV Filters stderr:', data.toString());
            });

            // 處理輸出流
            const outputChunks = [];
            lavProcess.stdout.on('data', (chunk) => {
                console.log('接收到 LAV 輸出數據，大小:', chunk.length);
                outputChunks.push(chunk);
            });

            lavProcess.on('close', (code) => {
                if (code === 0) {
                    const finalBuffer = Buffer.concat(outputChunks);
                    console.log('LAV 解碼完成，總大小:', finalBuffer.length);
                    resolve(finalBuffer);
                } else {
                    reject(new Error(`LAV Filters 進程退出，代碼: ${code}`));
                }
            });
        });
    }

    // 添加質量檢測方法
    async checkVideoQuality(filePath) {
        try {
            // 首先嘗試 FFmpeg
            const ffmpegResult = await this.decodeWithFFmpeg(filePath);
            const ffmpegQuality = this.analyzeVideoQuality(ffmpegResult);

            // 然後嘗試 LAV
            const lavResult = await this.decodeWithLAV(filePath);
            const lavQuality = this.analyzeVideoQuality(lavResult);

            // 比較質量並選擇更好的解碼器
            if (lavQuality > ffmpegQuality) {
                this.currentDecoder = 'lav';
                console.log('選擇 LAV Filters 解碼器（更好的質量）');
                return lavResult;
            } else {
                this.currentDecoder = 'ffmpeg';
                console.log('選擇 FFmpeg 解碼器（更好的質量）');
                return ffmpegResult;
            }
        } catch (error) {
            console.error('質量檢測失敗:', error);
            // 如果檢測失敗，使用默認解碼器
            return this.decodeVideo(filePath);
        }
    }

    // 分析視頻質量的輔助方法
    analyzeVideoQuality(videoData) {
        // 這裡可以實現更複雜的質量分析
        // 例如：檢查解析度、比特率、幀率等
        // 返回一個質量分數（0-100）
        let qualityScore = 0;
        
        // 檢查視頻大小（假設更大的文件通常有更好的質量）
        qualityScore += Math.min(videoData.length / (1024 * 1024), 50);
        
        // 可以添加更多質量檢測指標
        
        return qualityScore;
    }
}

module.exports = CodecManager; 