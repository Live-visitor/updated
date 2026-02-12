class GenerationBridgeApp {
    constructor() {
        // Core UI (present on most/all pages)
        this.stateManager = window.StateManager ? new StateManager() : null;
        this.modeToggle = (window.ModeToggle && this.stateManager) ? new ModeToggle(this.stateManager) : null;
        this.accessibilityManager = window.AccessibilityManager ? new AccessibilityManager() : null;
        this.notificationManager = window.NotificationManager ? new NotificationManager() : null;
        this.profileManager = window.ProfileManager ? new ProfileManager() : null;
        this.navigationManager = window.NavigationManager ? new NavigationManager() : null;

        // Realtime (Socket.IO) - optional on pages without socket script loaded yet.
        this.realtimeClient = window.RealtimeClient ? new RealtimeClient() : null;

        // Optional, page-specific
        this.chatbot = null;
        this.translator = null;
        this.filterManager = null;
        this.settingsManager = null;
        this.authManager = null;
        this.storyManager = null;
        this.messagesApp = null;
    }

    init() {
        // Realtime connect (if socket.io loaded)
        if (this.realtimeClient) {
            this.realtimeClient.connect();
        }
        // Navigation / active link
        if (this.navigationManager) {
            this.navigationManager.setActiveLink();
        }

        // Settings (applies persisted mode/font/contrast across pages)
        if (window.SettingsManager && this.modeToggle && this.accessibilityManager) {
            this.settingsManager = new SettingsManager(this.modeToggle, this.accessibilityManager);
            this.settingsManager.load();
        }

        // Notifications
        if (this.notificationManager) {
            this.notificationManager.setRealtimeClient?.(this.realtimeClient);
            this.notificationManager.refresh?.();
        }

        // Warning gate: if an admin warning is pending, block UI until acknowledged.
        this.ensureWarningAcknowledged?.();

        // Auth (only relevant on login/signup pages)
        if (window.AuthManager && (document.getElementById('loginForm') || document.getElementById('signupForm'))) {
            this.authManager = new AuthManager();
        }

        // Filters (match/stories/skillswap)
        const hasFilterUI = document.getElementById('matchFilterBar') || document.getElementById('challengeFilterBar') || document.getElementById('skillFilterBar');
        if (window.FilterManager && hasFilterUI) {
            this.filterManager = new FilterManager();
            // These no-op safely on pages without the relevant grids
            this.filterManager.filterMatches?.();
            this.filterManager.filterStories?.();
        }

        // Stories expand/collapse UI (stories.html uses .story-card)
        if (window.StoryManager && (document.querySelector('.story-post') || document.querySelector('.story-card') || document.querySelector('[data-post-id]'))) {
            this.storyManager = new StoryManager();
        }

        // Messages UI
        const hasMessagesUI = document.getElementById('contactsList') && document.getElementById('chatArea');
        if (window.MessagesApp && hasMessagesUI) {
            this.messagesApp = new MessagesApp(this.realtimeClient);
        }

        // Chatbot UI
        const hasChatbotUI = document.getElementById('chatInput') || document.getElementById('chatMessages');
        if (window.Chatbot && hasChatbotUI) {
            this.chatbot = new Chatbot();
        }

        // Translator UI (translator.html uses modernText/traditionalText)
        const hasTranslatorUI = document.getElementById('sourceText') || document.getElementById('translatedText') ||
            document.getElementById('modernText') || document.getElementById('traditionalText');
        if (window.Translator && hasTranslatorUI) {
            this.translator = new Translator();
        }

        this.setupEventListeners();
    }

    async ensureWarningAcknowledged() {
        // Only applies to logged in, non-admin users.
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json().catch(() => ({}));
            const user = data?.user;
            if (!user || user.is_admin) return;

            const warning = data?.warning || {};
            if (!warning?.pending || !warning?.message) return;

            this._showWarningModal(String(warning.message));
        } catch (e) {
            // Silent fail: don't block UI if auth endpoint is unavailable.
        }
    }

    _showWarningModal(message) {
        if (document.getElementById('gb-warning-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'gb-warning-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0,0,0,0.55)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '16px';

        const card = document.createElement('div');
        card.className = 'card';
        card.style.maxWidth = '720px';
        card.style.width = '100%';
        card.style.padding = '18px';

        // Make warning modal opaque (avoid showing the underlying grid through it)
        card.style.background = 'rgba(15, 18, 30, 0.98)';
        card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        card.style.borderRadius = '16px';
        card.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.55)';

        const title = document.createElement('h3');
        title.textContent = 'Warning';
        title.style.marginBottom = '10px';

        const body = document.createElement('div');
        body.style.whiteSpace = 'pre-wrap';
        body.style.marginBottom = '14px';
        body.textContent = message;

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';

        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.textContent = 'Understood';
        btn.onclick = async () => {
            try {
                await fetch('/api/auth/warning_ack', { method: 'POST' });
            } catch (e) {}
            overlay.remove();
        };

        actions.appendChild(btn);
        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(actions);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    setupEventListeners() {
        // Close dropdowns when clicking outside
        document.body.addEventListener('click', (e) => {
            const notificationDropdown = document.getElementById('notification-dropdown');
            const notificationToggle = document.getElementById('notifications-toggle');
            const profileDropdown = document.getElementById('profile-dropdown');
            const profileButton = document.querySelector('.profile-icon-btn');

            if (notificationDropdown && notificationToggle &&
                !notificationDropdown.contains(e.target) &&
                !notificationToggle.contains(e.target)) {
                notificationDropdown.classList.remove('show');
            }

            if (profileDropdown && profileButton &&
                !profileDropdown.contains(e.target) &&
                !profileButton.contains(e.target)) {
                profileDropdown.classList.remove('show');
            }
        });

        // Enter-to-send for chatbot
        const chatInput = document.getElementById('chatInput');
        if (chatInput && this.chatbot) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.chatbot.sendMessage();
                }
            });
        }
    }

}

// Expose globally for non-module script tags
window.GenerationBridgeApp = GenerationBridgeApp;
