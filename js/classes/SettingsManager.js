class SettingsManager {
    constructor(modeToggle, accessibilityManager) {
        this.modeToggle = modeToggle;
        this.accessibilityManager = accessibilityManager;
    }

    load() {
        const savedMode = localStorage.getItem('displayMode');
        if (savedMode === 'senior') {
            document.body.classList.remove('youth-mode');
            document.body.classList.add('senior-mode');
            const toggleSlider = document.querySelector('.mode-toggle .toggle-slider');
            if (toggleSlider) {
                toggleSlider.style.transform = 'translateX(28px)';
            }
            this.modeToggle.stateManager.setMode('senior');
        }

        const savedFontSize = localStorage.getItem('fontSize');
        const fontSizeSelect = document.getElementById('fontSizeSelect');
        if (savedFontSize && fontSizeSelect) {
            fontSizeSelect.value = savedFontSize;
            this.modeToggle.changeFontSize(savedFontSize);
        }

        const savedContrast = localStorage.getItem('highContrast');
        if (savedContrast === 'true') {
            this.accessibilityManager.contrastEnabled = true;
            const toggleControl = document.getElementById('contrastToggle');
            if (toggleControl) {
                toggleControl.setAttribute('data-enabled', 'true');
            }
            document.body.style.filter = 'contrast(1.5)';
        }

        const savedVoice = localStorage.getItem('voiceReading');
        if (savedVoice === 'true') {
            this.accessibilityManager.voiceReadingEnabled = true;
            const toggleControl = document.getElementById('voiceToggle');
            if (toggleControl) {
                toggleControl.setAttribute('data-enabled', 'true');
            }
        }

        const savedAnimation = localStorage.getItem('animationSpeed');
        const animationSelect = document.getElementById('animationSpeed');
        if (savedAnimation && animationSelect) {
            animationSelect.value = savedAnimation;
            this.accessibilityManager.changeAnimationSpeed(savedAnimation);
        }
    }
}

// Expose globally for non-module script tags
window.SettingsManager = SettingsManager;
