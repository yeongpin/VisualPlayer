class LanguageManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('language') || 'zh_tw';
        this.translations = {};
        this.loadLanguage(this.currentLanguage);
    }

    async loadLanguage(lang) {
        try {
            const response = await fetch(`locale/${lang}.json`);
            this.translations[lang] = await response.json();
            this.currentLanguage = lang;
            localStorage.setItem('language', lang);
            this.notifyLanguageChange();
        } catch (error) {
            console.error('Failed to load language:', error);
        }
    }

    async changeLanguage(lang) {
        await this.loadLanguage(lang);
        window.location.reload();
    }

    getText(key) {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];
        
        for (const k of keys) {
            if (value === undefined) return key;
            value = value[k];
        }
        
        return value || key;
    }

    notifyLanguageChange() {
        window.dispatchEvent(new CustomEvent('languagechange', {
            detail: { language: this.currentLanguage }
        }));
    }

    getAvailableLanguages() {
        return [
            { code: 'zh_tw', name: '繁體中文' },
            { code: 'en', name: 'English' }
        ];
    }
}

// 創建全局實例
window.languageManager = new LanguageManager(); 