class RealtimeClient {
    constructor() {
        this.page = (document.body && (document.body.getAttribute('data-page') || '')) || '';
        this.es = null;
        this.handlers = {
            messageNew: [],
            notificationNew: [],
            loginEvent: [],
            reportNew: [],
        };
    }

    async connect() {
        try {
            // Presence first (so notifications can be suppressed for messages page)
            await fetch('/api/realtime/presence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: this.page })
            });
        } catch (e) {
            // ignore
        }

        if (this.es) {
            try { this.es.close(); } catch (e) {}
        }

        this.es = new EventSource('/api/realtime/stream');
        this.es.addEventListener('message:new', (evt) => {
            this._dispatch('messageNew', this._json(evt.data));
        });
        this.es.addEventListener('notification:new', (evt) => {
            this._dispatch('notificationNew', this._json(evt.data));
        });
        this.es.addEventListener('login:event', (evt) => {
            this._dispatch('loginEvent', this._json(evt.data));
        });
        this.es.addEventListener('report:new', (evt) => {
            this._dispatch('reportNew', this._json(evt.data));
        });
    }

    updatePresence(page) {
        this.page = page || this.page;
        try {
            fetch('/api/realtime/presence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: this.page })
            });
        } catch (e) {
            // ignore
        }
    }

    onMessageNew(fn) { this.handlers.messageNew.push(fn); }
    onNotificationNew(fn) { this.handlers.notificationNew.push(fn); }
    onLoginEvent(fn) { this.handlers.loginEvent.push(fn); }
    onReportNew(fn) { this.handlers.reportNew.push(fn); }

    _dispatch(bucket, payload) {
        (this.handlers[bucket] || []).forEach(fn => {
            try { fn(payload); } catch (e) {}
        });
    }

    _json(s) {
        try { return JSON.parse(s); } catch { return s; }
    }
}

window.RealtimeClient = RealtimeClient;
