class VideoEditorStore {
    constructor() {
        this.editStates = {
            // 裁剪設置
            trim: {
                start: 0,
                end: 0,
                applied: false
            },
            // 速度設置
            speed: {
                rate: 1.0,
                applied: false
            },
            // 旋轉設置
            rotation: {
                angle: 0,
                flipHorizontal: false,
                flipVertical: false,
                applied: false
            },
            // 濾鏡設置
            filters: {
                brightness: 100,
                contrast: 100,
                saturation: 100,
                hue: 0,
                applied: false,
                preset: 'none'
            },
            // 文字設置
            texts: [],
            // 字幕設置
            subtitles: [],
            // 浮水印設置
            watermark: null,
            // 音頻設置
            audio: {
                volume: 100,
                muted: false,
                applied: false
            }
        };
    }

    // 裁剪相關方法
    setTrimSettings(start, end) {
        this.editStates.trim = {
            start,
            end,
            applied: true
        };
    }

    // 速度相關方法
    setSpeedRate(rate) {
        if (rate >= 0.25 && rate <= 2.0) {
            this.editStates.speed = {
                rate,
                applied: true
            };
            return true;
        }
        return false;
    }

    // 旋轉相關方法
    setRotation(angle) {
        this.editStates.rotation.angle = angle;
        this.editStates.rotation.applied = true;
    }

    setFlip(direction, value) {
        if (direction === 'horizontal') {
            this.editStates.rotation.flipHorizontal = value;
        } else if (direction === 'vertical') {
            this.editStates.rotation.flipVertical = value;
        }
        this.editStates.rotation.applied = true;
    }

    // 濾鏡相關方法
    setFilter(type, value) {
        this.editStates.filters[type] = value;
        this.editStates.filters.applied = true;
    }

    setFilterPreset(preset) {
        const presets = {
            none: { brightness: 100, contrast: 100, saturation: 100, hue: 0 },
            warm: { brightness: 110, contrast: 110, saturation: 120, hue: 30 },
            cool: { brightness: 100, contrast: 100, saturation: 90, hue: 180 },
            vintage: { brightness: 90, contrast: 120, saturation: 70, hue: 20 }
        };

        this.editStates.filters = {
            ...presets[preset],
            applied: true,
            preset
        };
    }

    // 文字相關方法
    addText(textConfig) {
        this.editStates.texts.push({
            ...textConfig,
            id: Date.now(),
            applied: true
        });
    }

    updateText(id, updates) {
        const index = this.editStates.texts.findIndex(t => t.id === id);
        if (index !== -1) {
            this.editStates.texts[index] = {
                ...this.editStates.texts[index],
                ...updates
            };
        }
    }

    removeText(id) {
        this.editStates.texts = this.editStates.texts.filter(t => t.id !== id);
    }

    // 字幕相關方法
    addSubtitle(subtitleConfig) {
        this.editStates.subtitles.push({
            ...subtitleConfig,
            id: Date.now(),
            applied: true
        });
    }

    // 浮水印相關方法
    setWatermark(watermarkConfig) {
        this.editStates.watermark = {
            ...watermarkConfig,
            applied: true
        };
    }

    // 音頻相關方法
    setAudioSettings(settings) {
        this.editStates.audio = {
            ...settings,
            applied: true
        };
    }

    // 獲取所有已應用的編輯設置
    getAppliedSettings() {
        const settings = {};

        // 只返回已應用的設置
        if (this.editStates.trim.applied) {
            settings.trim = {
                start: this.editStates.trim.start,
                end: this.editStates.trim.end
            };
        }

        if (this.editStates.speed.applied) {
            settings.speed = {
                rate: this.editStates.speed.rate
            };
        }

        if (this.editStates.rotation.applied) {
            settings.rotation = {
                angle: this.editStates.rotation.angle,
                flipHorizontal: this.editStates.rotation.flipHorizontal,
                flipVertical: this.editStates.rotation.flipVertical
            };
        }

        if (this.editStates.filters.applied) {
            settings.filters = {
                brightness: this.editStates.filters.brightness,
                contrast: this.editStates.filters.contrast,
                saturation: this.editStates.filters.saturation,
                hue: this.editStates.filters.hue,
                preset: this.editStates.filters.preset
            };
        }

        if (this.editStates.texts.length > 0) {
            settings.texts = this.editStates.texts.filter(t => t.applied);
        }

        if (this.editStates.subtitles.length > 0) {
            settings.subtitles = this.editStates.subtitles.filter(s => s.applied);
        }

        if (this.editStates.watermark?.applied) {
            settings.watermark = this.editStates.watermark;
        }

        if (this.editStates.audio.applied) {
            settings.audio = {
                volume: this.editStates.audio.volume,
                muted: this.editStates.audio.muted
            };
        }

        return settings;
    }

    // 重置所有設置
    reset() {
        this.editStates = new VideoEditorStore().editStates;
    }

    getSpeedRate() {
        return this.editStates.speed.rate;
    }
}

// 創建全局實例
window.videoEditorStore = new VideoEditorStore(); 