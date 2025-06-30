const { ipcRenderer } = require('electron');
const remote = require('@electron/remote');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { shell } = require('electron');

const devmode = false;

class VersionUpdater {
    constructor() {
        this.currentVersion = null;
        this.latestVersion = null;
        this.downloadUrl = null;
        this.downloadPath = null;
        this.isDownloading = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.getCurrentVersion();
        this.checkForUpdates();
    }

    setupEventListeners() {
        // Close button
        document.getElementById('closeBtn').addEventListener('click', () => {
            this.closeWindow();
        });

        // Download button
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.startDownload();
        });

        // Later button
        document.getElementById('laterBtn').addEventListener('click', () => {
            this.closeWindow();
        });

        // Install button
        document.getElementById('installBtn').addEventListener('click', () => {
            this.installUpdate();
        });

        // Install later button
        document.getElementById('installLaterBtn').addEventListener('click', () => {
            this.closeWindow();
        });

        // Retry button
        document.getElementById('retryBtn').addEventListener('click', () => {
            this.checkForUpdates();
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeWindow();
            }
        });
    }

    getCurrentVersion() {
        try {
            const packageJsonPath = path.join(__dirname, '../../../package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            this.currentVersion = packageJson.version;
            console.log('Current version:', this.currentVersion);
        } catch (error) {
            console.error('Error reading current version:', error);
            this.currentVersion = '1.0.0-BETA'; // Fallback version
        }
    }

    async checkForUpdates() {
        this.showState('checking');
        
        try {
            const response = await this.fetchGitHubReleases();
            const releases = JSON.parse(response);
            
            if (releases && releases.length > 0) {
                // Get the latest release (first in the array)
                const latestRelease = releases[0];
                this.latestVersion = latestRelease.tag_name.replace('v', '');
                
                // Find the Windows exe download URL
                const windowsAsset = latestRelease.assets.find(asset => 
                    asset.name.includes('.exe') && asset.name.includes('setup')
                );
                
                if (windowsAsset) {
                    this.downloadUrl = windowsAsset.browser_download_url;
                }

                console.log('Latest version:', this.latestVersion);
                console.log('Download URL:', this.downloadUrl);

                // Set up download path
                const downloadsDir = path.join(require('os').homedir(), 'Downloads');
                const fileName = `VisualPlayer_v${this.latestVersion}_setup.exe`;
                this.downloadPath = path.join(downloadsDir, fileName);

                // Compare versions
                if (this.shouldUpdate(this.currentVersion, this.latestVersion)) {
                    // Check if file already exists
                    if (fs.existsSync(this.downloadPath)) {
                        console.log('Installation file already exists:', this.downloadPath);
                        this.showDownloadComplete();
                    } else {
                        this.showUpdateAvailable();
                    }
                } else {
                    this.showUpToDate();
                }
            } else {
                throw new Error('No releases found');
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
            this.showError('Failed to check for updates. Please check your internet connection.');
        }
    }

    fetchGitHubReleases() {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: '/repos/yeongpin/VisualPlayer/releases',
                method: 'GET',
                headers: {
                    'User-Agent': 'VisualPlayer-Updater',
                    'Accept': 'application/vnd.github.v3+json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.setTimeout(10000, () => {
                req.abort();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    shouldUpdate(currentVersion, latestVersion) {
        // In development mode, always simulate that an update is available
        if (devmode) {
            console.log('Development mode: Simulating update available');
            return true;
        }
        
        // Parse version strings to extract numeric parts and suffixes
        const parseVersion = (version) => {
            // Match patterns like: 1.2.3, 1.2.3-Beta, 1.2.3.Preview, 1.2.3_Beta, etc.
            // Also handles: v1.2.3, V1.2.3 (removes v/V prefix)
            const cleanVersion = version.replace(/^[vV]/, ''); // Remove v/V prefix
            const match = cleanVersion.match(/^(\d+(?:\.\d+)*)(?:[-._](.+))?$/);
            if (!match) {
                console.warn(`Invalid version format: ${version}`);
                return { numeric: '0.0.0', suffix: null };
            }
            
            const numeric = match[1]; // e.g., "1.2.3"
            const suffix = match[2] ? match[2].toLowerCase() : null; // e.g., "beta", "preview"
            
            return { numeric, suffix };
        };
        
        const current = parseVersion(currentVersion);
        const latest = parseVersion(latestVersion);
        
        console.log('Version comparison:');
        console.log(`Current: ${currentVersion} -> numeric: ${current.numeric}, suffix: ${current.suffix}`);
        console.log(`Latest: ${latestVersion} -> numeric: ${latest.numeric}, suffix: ${latest.suffix}`);
        
        // Compare numeric parts first
        const currentParts = current.numeric.split('.').map(Number);
        const latestParts = latest.numeric.split('.').map(Number);
        
        // Ensure both arrays have the same length
        const maxLength = Math.max(currentParts.length, latestParts.length);
        while (currentParts.length < maxLength) currentParts.push(0);
        while (latestParts.length < maxLength) latestParts.push(0);
        
        for (let i = 0; i < maxLength; i++) {
            if (latestParts[i] > currentParts[i]) {
                console.log(`Latest version is newer (${latestParts[i]} > ${currentParts[i]} at position ${i})`);
                return true;
            } else if (latestParts[i] < currentParts[i]) {
                console.log(`Current version is newer (${currentParts[i]} > ${latestParts[i]} at position ${i})`);
                return false;
            }
        }
        
        // If numeric parts are equal, compare suffixes
        // Suffix priority: no suffix (stable) > rc > preview > beta > alpha
        const getSuffixPriority = (suffix) => {
            if (!suffix) return 100; // Stable release has highest priority
            switch (suffix.toLowerCase()) {
                case 'rc':
                case 'release-candidate': return 80;
                case 'preview': return 50;
                case 'beta': return 30;
                case 'alpha': return 10;
                case 'dev':
                case 'development': return 5;
                default: return 20; // Unknown suffix gets medium priority
            }
        };
        
        const currentPriority = getSuffixPriority(current.suffix);
        const latestPriority = getSuffixPriority(latest.suffix);
        
        if (latestPriority > currentPriority) {
            console.log(`Latest version has higher suffix priority (${latestPriority} > ${currentPriority})`);
            return true;
        } else if (latestPriority < currentPriority) {
            console.log(`Current version has higher suffix priority (${currentPriority} > ${latestPriority})`);
            return false;
        }
        
        console.log('Versions are equal');
        return false; // Versions are equal
    }

    showState(state) {
        // Hide all states
        document.querySelectorAll('.update-state').forEach(el => {
            el.classList.add('hidden');
        });

        // Show the specified state
        const stateElement = document.getElementById(`${state}State`);
        if (stateElement) {
            stateElement.classList.remove('hidden');
        }
    }

    showUpToDate() {
        document.getElementById('currentVersionText').textContent = `v${this.currentVersion}`;
        this.showState('upToDate');
    }

    showUpdateAvailable() {
        console.log('Showing update available state');
        console.log('Current version:', this.currentVersion);
        console.log('Latest version:', this.latestVersion);
        console.log('Download URL:', this.downloadUrl);
        
        document.getElementById('currentVersionUpdate').textContent = `v${this.currentVersion}`;
        document.getElementById('newVersionText').textContent = `v${this.latestVersion}`;
        this.showState('updateAvailable');
        
        // Debug: Check if the state is actually shown
        setTimeout(() => {
            const updateState = document.getElementById('updateAvailableState');
            console.log('Update available state visible:', !updateState.classList.contains('hidden'));
            console.log('Download button exists:', !!document.getElementById('downloadBtn'));
        }, 100);
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        this.showState('error');
    }

    async startDownload() {
        console.log('Starting download...');
        
        if (!this.downloadUrl) {
            console.error('No download URL available');
            this.showError('Download URL not available');
            return;
        }

        console.log('Download URL:', this.downloadUrl);
        this.isDownloading = true;
        this.showState('downloading');

        try {
            // Create downloads directory if it doesn't exist
            const downloadsDir = path.join(require('os').homedir(), 'Downloads');
            let fileName = `VisualPlayer_v${this.latestVersion}_setup.exe`;
            let downloadPath = path.join(downloadsDir, fileName);
            
            // If file exists, create a unique name
            let counter = 1;
            while (fs.existsSync(downloadPath)) {
                console.log('File already exists, creating unique name...');
                fileName = `VisualPlayer_v${this.latestVersion}_setup(${counter}).exe`;
                downloadPath = path.join(downloadsDir, fileName);
                counter++;
            }
            
            this.downloadPath = downloadPath;
            console.log('Download path:', this.downloadPath);

            // Start download
            await this.downloadFile(this.downloadUrl, this.downloadPath);
            
            this.isDownloading = false;
            console.log('Download completed successfully');
            this.showDownloadComplete();
        } catch (error) {
            console.error('Download error:', error);
            this.isDownloading = false;
            this.showError(`Download failed: ${error.message}`);
        }
    }

    downloadFile(url, filePath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filePath);
            let downloadedBytes = 0;
            let totalBytes = 0;
            let startTime = Date.now();
            let request = null;

            const cleanup = () => {
                try {
                    if (request) {
                        request.destroy();
                        request = null;
                    }
                    if (file && !file.destroyed) {
                        file.end();
                        file.destroy();
                    }
                } catch (error) {
                    console.log('Cleanup error (non-critical):', error.message);
                }
            };

            request = https.get(url, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    cleanup();
                    // Handle redirect
                    return this.downloadFile(response.headers.location, filePath)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode !== 200) {
                    cleanup();
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                totalBytes = parseInt(response.headers['content-length']) || 0;

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    this.updateDownloadProgress(downloadedBytes, totalBytes, startTime);
                });

                response.pipe(file);

                file.on('finish', () => {
                    console.log('File download finished, closing file handle...');
                    file.close((err) => {
                        if (err) {
                            console.error('Error closing file:', err);
                            reject(err);
                        } else {
                            console.log('File handle closed successfully');
                            // Add a small delay to ensure file is fully released
                            setTimeout(() => {
                                resolve();
                            }, 500);
                        }
                    });
                });

                file.on('error', (error) => {
                    console.error('File write error:', error);
                    cleanup();
                    fs.unlink(filePath, () => {}); // Delete partial file
                    reject(error);
                });
            });

            request.on('error', (error) => {
                console.error('Request error:', error);
                cleanup();
                fs.unlink(filePath, () => {}); // Delete partial file
                reject(error);
            });

            request.setTimeout(30000, () => {
                console.log('Request timeout');
                cleanup();
                fs.unlink(filePath, () => {}); // Delete partial file
                reject(new Error('Download timeout'));
            });
        });
    }

    updateDownloadProgress(downloadedBytes, totalBytes, startTime) {
        const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = downloadedBytes / elapsed;
        
        // Console log for debugging
        console.log(`Download progress: ${percent}% (${this.formatBytes(downloadedBytes)} / ${this.formatBytes(totalBytes)}) at ${this.formatSpeed(speed)}`);
        
        // Update progress circle
        const progressCircle = document.getElementById('progressCircle');
        if (progressCircle) {
            const circumference = 2 * Math.PI * 35; // radius = 35
            const offset = circumference - (percent / 100) * circumference;
            progressCircle.style.strokeDashoffset = offset;
        }

        // Update progress text
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = `${percent}%`;
        }

        // Update download info
        const speedElement = document.getElementById('downloadSpeed');
        const sizeElement = document.getElementById('downloadSize');
        
        if (speedElement) {
            speedElement.textContent = this.formatSpeed(speed);
        }
        
        if (sizeElement) {
            sizeElement.textContent = `${this.formatBytes(downloadedBytes)} / ${this.formatBytes(totalBytes)}`;
        }

        // Update window title with progress
        document.title = `Downloading... ${percent}%`;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatSpeed(bytesPerSecond) {
        return this.formatBytes(bytesPerSecond) + '/s';
    }

    showDownloadComplete() {
        console.log('Showing download complete state');
        // Verify file is accessible before showing complete state
        if (this.downloadPath && fs.existsSync(this.downloadPath)) {
            try {
                // Try to access the file to ensure it's not locked
                const stats = fs.statSync(this.downloadPath);
                console.log('Download file size:', this.formatBytes(stats.size));
                this.showState('downloadComplete');
            } catch (error) {
                console.error('File access error:', error);
                // Wait a bit and try again
                setTimeout(() => {
                    this.showDownloadComplete();
                }, 1000);
            }
        } else {
            console.error('Download file not found');
            this.showError('Download file not found');
        }
    }

    async installUpdate() {
        console.log('Installing update...');
        console.log('Download path:', this.downloadPath);
        
        if (!this.downloadPath) {
            console.error('No download path available');
            this.showError('Installation file path not available');
            return;
        }
        
        if (!fs.existsSync(this.downloadPath)) {
            console.error('Installation file not found:', this.downloadPath);
            this.showError('Installation file not found');
            return;
        }
        
        // Check if file is accessible (not locked by another process)
        try {
            const stats = fs.statSync(this.downloadPath);
            console.log('Installation file size:', this.formatBytes(stats.size));
            
            // Try to open file in read mode to check if it's locked
            const fd = fs.openSync(this.downloadPath, 'r');
            fs.closeSync(fd);
            console.log('File is accessible and not locked');
        } catch (error) {
            console.error('File is locked or inaccessible:', error);
            this.showError('Installation file is currently in use. Please wait a moment and try again.');
            return;
        }
        
        try {
            console.log('Opening installer:', this.downloadPath);
            
            // Try shell.openPath first
            const result = await shell.openPath(this.downloadPath);
            console.log('shell.openPath result:', result);
            
            if (result !== '') {
                console.error('shell.openPath failed:', result);
                // Try alternative method using child_process
                const { spawn } = require('child_process');
                console.log('Trying spawn method...');
                
                const installer = spawn(this.downloadPath, [], {
                    detached: true,
                    stdio: 'ignore'
                });
                
                installer.unref();
                console.log('Installer launched via spawn');
            } else {
                console.log('Installer launched successfully via shell.openPath');
            }
            
            // Wait a moment before closing to ensure installer starts
            setTimeout(() => {
                console.log('Closing updater window');
                this.closeWindow();
            }, 1500);
            
        } catch (error) {
            console.error('Error launching installer:', error);
            this.showError(`Failed to launch installer: ${error.message}`);
        }
    }

    closeWindow() {
        const window = remote.getCurrentWindow();
        window.close();
    }
}

// Initialize the updater when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VersionUpdater();
});

// Handle language updates if available
if (window.languageManager) {
    window.addEventListener('languagechange', () => {
        // Update UI text when language changes
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = window.languageManager.getText(key);
        });
    });
} 