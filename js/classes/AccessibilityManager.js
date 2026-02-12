class AccessibilityManager {
    constructor() {
        this.contrastEnabled = false;
        this.voiceReadingEnabled = false;
    }

    toggleHighContrast() {
        this.contrastEnabled = !this.contrastEnabled;
        const toggleControl = document.getElementById('contrastToggle');

        toggleControl.setAttribute('data-enabled', this.contrastEnabled);

        if (this.contrastEnabled) {
            document.body.style.filter = 'contrast(1.5)';
            localStorage.setItem('highContrast', 'true');
        } else {
            document.body.style.filter = '';
            localStorage.setItem('highContrast', 'false');
        }
    }

    toggleVoiceReading() {
        this.voiceReadingEnabled = !this.voiceReadingEnabled;
        const toggleControl = document.getElementById('voiceToggle');
        toggleControl.setAttribute('data-enabled', this.voiceReadingEnabled);

        if (this.voiceReadingEnabled) {
            console.log('Voice reading enabled');
            localStorage.setItem('voiceReading', 'true');
        } else {
            console.log('Voice reading disabled');
            localStorage.setItem('voiceReading', 'false');
        }
    }

    changeAnimationSpeed(speed) {
        const root = document.documentElement;

        switch (speed) {
            case 'fast':
                root.style.setProperty('--animation-duration', '0.15s');
                break;
            case 'slow':
                root.style.setProperty('--animation-duration', '0.6s');
                break;
            case 'none':
                root.style.setProperty('--animation-duration', '0s');
                break;
            default:
                root.style.setProperty('--animation-duration', '0.3s');
        }
        localStorage.setItem('animationSpeed', speed);
    }
}

// Expose globally for non-module script tags
window.AccessibilityManager = AccessibilityManager;
