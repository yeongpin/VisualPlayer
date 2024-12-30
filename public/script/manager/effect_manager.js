class EffectManager {
    constructor(mainManager) {
        this.mainManager = mainManager;
        this.blurAmount = 0;
    }

    adjustBlur(amount) {
        this.blurAmount = Math.max(0, this.blurAmount + amount);
        this.updateBlur();
        this.showBlurIndicator();
    }
    
    resetBlur() {
        this.blurAmount = 0;
        this.updateBlur();
        this.showBlurIndicator();
    }
    
    updateBlur() {
        document.body.style.filter = this.blurAmount > 0 ? `blur(${this.blurAmount}px)` : 'none';
    }
    
    showBlurIndicator() {
        const blurIndicator = document.createElement('div');
        blurIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            z-index: 9999;
            transition: opacity 0.3s;
        `;
        blurIndicator.textContent = this.blurAmount > 0 ? `模糊程度: ${this.blurAmount}px` : '清晰';
        document.body.appendChild(blurIndicator);
        
        setTimeout(() => {
            blurIndicator.style.opacity = '0';
            setTimeout(() => blurIndicator.remove(), 300);
        }, 2000);
    }
}

module.exports = EffectManager; 