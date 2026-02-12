class StateManager {
    constructor() {
        this.currentMode = 'youth';
    }

    setMode(mode) {
        this.currentMode = mode;
    }

    getMode() {
        return this.currentMode;
    }
}

window.StateManager = StateManager;
