const { ipcRenderer } = require('electron');
const remote = require('@electron/remote');
const { app } = require('@electron/remote');
const fs = require('fs');
const path = require('path');
const { createSvgIcon } = require('./icons.js');
const packageJson = require('../package.json');

// 關閉按鈕功能
document.querySelector('.close-button').addEventListener('click', () => {
    const window = remote.getCurrentWindow();
    window.close();
});

// 獲取所有導航項和內容面板
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

// 切換標籤頁
function switchTab(tabId) {
    // 移除所有活動狀態
    navItems.forEach(item => item.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    // 添加新的活動狀態
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

// 為每個導航項添加點擊事件
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const tabId = item.getAttribute('data-tab');
        switchTab(tabId);
    });
});

// 音量滑塊值顯示
const volumeSlider = document.getElementById('defaultVolume');
const volumeDisplay = volumeSlider.nextElementSibling;

volumeSlider.addEventListener('input', () => {
    volumeDisplay.textContent = `${volumeSlider.value}%`;
});

// 保存設置
function saveSettings() {
    const settings = {
        general: {
            autoPlay: document.getElementById('autoPlay').checked,
            rememberPosition: document.getElementById('rememberPosition').checked,
            darkMode: document.getElementById('darkMode').checked
        },
        video: {
            hardwareAcceleration: document.getElementById('hardwareAcceleration').checked,
            autoQuality: document.getElementById('autoQuality').checked,
            defaultVolume: document.getElementById('defaultVolume').value
        }
    };

    ipcRenderer.send('save-settings', settings);
}

// 加載設置
ipcRenderer.on('load-settings', (event, settings) => {
    if (settings) {
        // 一般設置
        document.getElementById('autoPlay').checked = settings.general.autoPlay;
        document.getElementById('rememberPosition').checked = settings.general.rememberPosition;
        document.getElementById('darkMode').checked = settings.general.darkMode;

        // 視頻設置
        document.getElementById('hardwareAcceleration').checked = settings.video.hardwareAcceleration;
        document.getElementById('autoQuality').checked = settings.video.autoQuality;
        document.getElementById('defaultVolume').value = settings.video.defaultVolume;
        volumeDisplay.textContent = `${settings.video.defaultVolume}%`;
    }
});

// 為所有設置項添加變更事件
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', saveSettings);
});

// 初始化語言選擇器
function initLanguageSelector() {
    const languageSelect = document.getElementById('language');
    if (languageSelect) {
        // 設置當前語言
        languageSelect.value = window.languageManager.currentLanguage;

        // 監聽語言變更
        languageSelect.addEventListener('change', async (e) => {
            const newLanguage = e.target.value;
            await window.languageManager.changeLanguage(newLanguage);
        });
    }
}

// 更新界面文本
function updateUIText() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = window.languageManager.getText(key);
    });
}

// 在頁面加載時初始化
document.addEventListener('DOMContentLoaded', () => {
    // 獲取並設置版本號
    const version = packageJson.version;
    const author = packageJson.author.name;
    document.getElementById('version').textContent = version;
    document.getElementById('author').textContent = author;
    initLanguageSelector();
    updateUIText();
    loadChangelog();

    // 初始化導航圖標
    document.querySelectorAll('.nav-icon').forEach(icon => {
        const iconName = icon.dataset.icon;
        if (iconName) {
            icon.innerHTML = createSvgIcon(iconName);
        }
    });
});

// 監聽語言變更事件
window.addEventListener('languagechange', updateUIText);

document.querySelectorAll('.version-header').forEach(header => {
    header.addEventListener('click', () => {
        const versionGroup = header.parentElement;
        versionGroup.classList.toggle('expanded');
    });
});

async function loadChangelog() {
    try {
        const changelogPath = path.join(__dirname, 'changelog.json');
        const changelogData = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
        const container = document.querySelector('.changelog-container');
        
        changelogData.versions.forEach(version => {
            const versionGroup = document.createElement('div');
            versionGroup.className = 'version-group';
            
            versionGroup.innerHTML = `
                <div class="version-header">
                    <span class="version">${version.version}</span>
                    <span class="date">${version.date}</span>
                </div>
                <div class="changes">
                    <ul>
                        ${version.changes.map(change => 
                            `<li data-i18n="${change.key}"></li>`
                        ).join('')}
                    </ul>
                </div>
            `;
            
            container.appendChild(versionGroup);
        });

        // 重新初始化版本組的展開/收起功能
        document.querySelectorAll('.version-header').forEach(header => {
            header.addEventListener('click', () => {
                const versionGroup = header.parentElement;
                versionGroup.classList.toggle('expanded');
            });
        });

        // 更新多語言文本
        updateUIText();
    } catch (error) {
        console.error('Error loading changelog:', error);
    }
}
