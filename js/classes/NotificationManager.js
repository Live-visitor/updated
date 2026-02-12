class NotificationManager {
    constructor() {
        this.notifications = [];
        this.realtimeClient = null;
    }

    formatTimestamp(ts) {
        if (!ts) return '';

        // Accept ISO strings (e.g., 2026-02-10T06:32:53.288749+00:00) or any value Date can parse.
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) return String(ts);

        const pad2 = (n) => String(n).padStart(2, '0');
        const dd = pad2(d.getDate());
        const mm = pad2(d.getMonth() + 1);
        const yyyy = d.getFullYear();
        const hh = pad2(d.getHours());
        const min = pad2(d.getMinutes());

        // Format: DD-MM-YYYY HH:mm (local time)
        return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
    }

    setRealtimeClient(client) {
        this.realtimeClient = client;
        if (this.realtimeClient) {
            this.realtimeClient.onNotificationNew((notif) => {
                this.notifications = [notif, ...this.notifications];
                this.updateBadge();
                this.render('dropdown-notification-list', this.notifications);
            });
        }
    }

    async refresh() {
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            if (data && data.ok) {
                this.notifications = Array.isArray(data.notifications) ? data.notifications : [];
            }
        } catch (e) {
            // ignore
        }
        this.render('dropdown-notification-list', this.notifications);
        this.updateBadge();
    }

    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (!badge) return;
        
        const unreadCount = this.notifications.filter(n => !(n.is_read || n.isRead)).length;

        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    clear() {
        (async () => {
            try { await fetch('/api/notifications/clear', { method: 'POST' }); } catch (e) {}
            this.notifications.length = 0;
            this.updateBadge();
            this.render('dropdown-notification-list', this.notifications);
        })();
    }

    toggleDropdown() {
        const dropdown = document.getElementById('notification-dropdown');
        if (!dropdown) return;
        
        const isShowing = dropdown.classList.contains('show');
        
        const profileDropdown = document.getElementById('profile-dropdown');
        if (profileDropdown) {
            profileDropdown.classList.remove('show');
        }

        if (!isShowing) {
            dropdown.classList.add('show');
        } else {
            dropdown.classList.remove('show');
        }
    }

    closeDropdown() {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    render(containerId, notifications) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        const itemsToShow = (containerId === 'dropdown-notification-list') ? notifications.slice(0, 3) : notifications;
        if (itemsToShow.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 1rem; color: var(--youth-text-dim);">No notifications</div>`;
            return;
        }

        itemsToShow.forEach(notification => {
            const rawTime = notification.time || notification.created_at || '';
            const displayTime = this.formatTimestamp(rawTime);

            const item = document.createElement('div');
            item.className = 'notification-item';
            if (notification.is_read || notification.isRead) {
                item.style.opacity = '0.7';
            }
            item.innerHTML = `
                <div class="notification-icon">${notification.icon}</div>
                <div class="notification-content">
                    <h4>${notification.title}</h4>
                    <p>${notification.content}</p>
                    <div class="notification-time">${displayTime}</div>
                </div>
            `;
            container.appendChild(item);
        });
    }
}

// Expose globally for non-module script tags
window.NotificationManager = NotificationManager;
