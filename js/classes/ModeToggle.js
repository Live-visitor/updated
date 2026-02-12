class ModeToggle {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    toggle() {
        const body = document.body;
        const toggleSlider = document.querySelector('.mode-toggle .toggle-slider');

        if (body.classList.contains('youth-mode')) {
            body.classList.remove('youth-mode');
            body.classList.add('senior-mode');
            toggleSlider.style.transform = 'translateX(28px)';
            this.stateManager.setMode('senior');
            localStorage.setItem('displayMode', 'senior');
        } else {
            body.classList.remove('senior-mode');
            body.classList.add('youth-mode');
            toggleSlider.style.transform = 'translateX(0)';
            this.stateManager.setMode('youth');
            localStorage.setItem('displayMode', 'youth');
        }

        const fontSizeSelect = document.getElementById('fontSizeSelect');
        if (fontSizeSelect) {
            this.changeFontSize(fontSizeSelect.value);
        }
    }

    changeFontSize(size) {
        const root = document.documentElement;
        switch (size) {
            case 'large':
                root.style.setProperty('font-size', '1.1em');
                break;
            case 'extra-large':
                root.style.setProperty('font-size', '1.25em');
                break;
            default:
                root.style.setProperty('font-size', '1em');
        }
        localStorage.setItem('fontSize', size);
    }
}

// Expose globally for non-module script tags
window.ModeToggle = ModeToggle;
