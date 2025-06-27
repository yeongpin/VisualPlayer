const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

class StreamManager {
    constructor() {
        this.servers = new Map(); // 存储活动的服务器
        this.ffmpegProcesses = new Map(); // 存储FFmpeg进程
        this.portRange = { min: 50000, max: 59999 }; // 5位数端口范围
    }

    // 查找可用端口
    async findAvailablePort(startPort = this.portRange.min) {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            
            server.listen(startPort, () => {
                const port = server.address().port;
                server.close(() => {
                    resolve(port);
                });
            });
            
            server.on('error', async (err) => {
                if (err.code === 'EADDRINUSE') {
                    if (startPort < this.portRange.max) {
                        try {
                            const port = await this.findAvailablePort(startPort + 1);
                            resolve(port);
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        reject(new Error('No available ports in range'));
                    }
                } else {
                    reject(err);
                }
            });
        });
    }

    // 创建串流服务器
    async createStreamServer(filePath, preset, onProgress, onError) {
        try {
            const port = await this.findAvailablePort();
            const streamUrl = `http://localhost:${port}`;
            
            console.log(`Creating stream server on port ${port} for file: ${filePath}`);
            
            const server = http.createServer((req, res) => {
                console.log(`Stream request received for ${streamUrl}`);
                
                // 设置CORS头
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                
                if (req.method === 'OPTIONS') {
                    res.writeHead(200);
                    res.end();
                    return;
                }
                
                // 创建FFmpeg进程
                const ffmpegArgs = [
                    '-i', filePath,
                    ...preset.options,
                    'pipe:1'
                ];
                
                console.log('FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));
                
                const ffmpeg = spawn('ffmpeg', ffmpegArgs);
                
                // 存储进程引用
                this.ffmpegProcesses.set(port, ffmpeg);
                
                // 设置响应头
                res.writeHead(200, {
                    'Content-Type': 'video/mp2t',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });
                
                // 将FFmpeg输出管道到响应
                ffmpeg.stdout.pipe(res);
                
                // 监听进度信息
                ffmpeg.stderr.on('data', (data) => {
                    const output = data.toString();
                    console.log('FFmpeg output:', output);
                    
                    // 解析进度信息
                    if (output.includes('time=') && onProgress) {
                        const timeMatch = output.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
                        const fpsMatch = output.match(/fps=\s*(\d+\.?\d*)/);
                        const speedMatch = output.match(/speed=\s*(\d+\.?\d*)x/);
                        
                        if (timeMatch) {
                            const currentTime = this.timeToSeconds(timeMatch[1]);
                            const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 0;
                            const speed = speedMatch ? parseFloat(speedMatch[1]) : 0;
                            
                            onProgress({
                                currentTime,
                                fps,
                                speed,
                                stage: '串流中'
                            });
                        }
                    }
                });
                
                // 错误处理
                ffmpeg.on('error', (error) => {
                    console.error('FFmpeg error:', error);
                    if (onError) onError(error);
                    this.cleanupStream(port);
                });
                
                // 进程结束处理
                ffmpeg.on('close', (code) => {
                    console.log(`FFmpeg process exited with code ${code}`);
                    this.ffmpegProcesses.delete(port);
                });
                
                // 客户端断开连接时清理
                req.on('close', () => {
                    console.log('Client disconnected, cleaning up FFmpeg process');
                    if (ffmpeg && !ffmpeg.killed) {
                        ffmpeg.kill('SIGKILL');
                    }
                });
            });
            
            // 启动服务器
            server.listen(port, () => {
                console.log(`Stream server started on ${streamUrl}`);
            });
            
            // 存储服务器引用
            this.servers.set(port, server);
            
            // 服务器错误处理
            server.on('error', (error) => {
                console.error('Server error:', error);
                if (onError) onError(error);
                this.cleanupStream(port);
            });
            
            return { streamUrl, port };
            
        } catch (error) {
            console.error('Failed to create stream server:', error);
            throw error;
        }
    }
    
    // 清理串流资源
    cleanupStream(port) {
        console.log(`Cleaning up stream resources for port ${port}`);
        
        // 关闭FFmpeg进程
        if (this.ffmpegProcesses.has(port)) {
            const ffmpeg = this.ffmpegProcesses.get(port);
            if (!ffmpeg.killed) {
                ffmpeg.kill('SIGKILL');
            }
            this.ffmpegProcesses.delete(port);
        }
        
        // 关闭服务器
        if (this.servers.has(port)) {
            const server = this.servers.get(port);
            server.close(() => {
                console.log(`Server on port ${port} closed`);
            });
            this.servers.delete(port);
        }
    }
    
    // 清理所有串流
    cleanupAllStreams() {
        console.log('Cleaning up all streams');
        
        for (const port of this.servers.keys()) {
            this.cleanupStream(port);
        }
    }
    
    // 时间字符串转秒数
    timeToSeconds(timeStr) {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseFloat(parts[2]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
    }
}

module.exports = StreamManager; 