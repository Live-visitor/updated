class MessagesApp {
    constructor(realtimeClient = null) {
        const raw = localStorage.getItem('userData');
        const user = raw ? JSON.parse(raw) : {};
        this.currentUserId = Number(user.user_id || 0) || 0;
        this.realtimeClient = realtimeClient;

        this.contacts = [];
        this.allContacts = [];
        this.conversations = {}; // {contactId: Conversation}
        this.activeContactId = null;

        this.init();
    }

    async init() {
        await this.loadContacts();
        this.bindUI();
        this.bindRealtime();
        this.renderContactsList();
        this.checkURLParams();
    }

    bindUI() {
        const input = document.getElementById('messageInput');
        // Conversation UI elements are in messages.html.
        // Lecturer requirement: use HTML on* handlers (onclick/onkeydown) instead of JS-created buttons.
        // We keep ONLY the auto-resize behavior in JS.
        if (input) {
            input.addEventListener('input', function () {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 150) + 'px';
            });
        }
    }

    bindRealtime() {
        if (!this.realtimeClient) return;
        this.realtimeClient.onMessageNew((payload) => {
            const msg = payload && payload.id ? payload : (payload && payload.message ? payload.message : payload);
            if (!msg) return;
            const senderId = Number(msg.sender_id || msg.senderId || 0);
            const recipientId = Number(msg.recipient_id || msg.recipientId || 0);
            const text = msg.text || '';
            const created = msg.created_at || msg.timestamp || new Date().toISOString();

            const otherId = (senderId === this.currentUserId) ? recipientId : senderId;
            if (!otherId) return;

            if (!this.conversations[otherId]) {
                this.conversations[otherId] = new Conversation(String(otherId));
            }
            const conv = this.conversations[otherId];
            conv.addMessage(new Message(
                Number(msg.id || Date.now()),
                String(senderId),
                text,
                new Date(created),
                (senderId === this.currentUserId)
            ));

            // If I'm not viewing this chat, increment unread
            if (String(this.activeContactId) !== String(otherId) && senderId !== this.currentUserId) {
                conv.unreadCount = (conv.unreadCount || 0) + 1;
            }
            conv.lastMessageTime = new Date(created).getTime();

            this.renderContactsList();

            if (String(this.activeContactId) === String(otherId)) {
                const contact = this.contacts.find(c => String(c.id) === String(otherId));
                this.renderChatArea(contact, conv);
                setTimeout(() => {
                    const messagesArea = document.querySelector('.chat-messages-area');
                    if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
                }, 50);
            }
        });
    }

    async loadContacts() {
        try {
            const res = await fetch('/api/messages/contacts');
            const data = await res.json();
            if (data && data.ok && Array.isArray(data.contacts)) {
                this.allContacts = data.contacts.map(c => new Contact(
                    String(c.id),
                    c.name,
                    c.avatar || '👤',
                    c.age,
                    c.generation,
                    c.interests || [],
                    !!c.online
                ));
                this.contacts = [...this.allContacts];
            }
        } catch (e) {
            this.contacts = [];
            this.allContacts = [];
        }
    }

    filterContacts(query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) {
            this.contacts = [...this.allContacts];
            this.renderContactsList();
            return;
        }
        this.contacts = this.allContacts.filter(c => String(c.name || '').toLowerCase().includes(q));
        this.renderContactsList();
    }

    checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const contactId = urlParams.get('contact');
        if (contactId && this.contacts.find(c => String(c.id) === String(contactId))) {
            this.openChat(String(contactId));
        }
    }

    renderContactsList() {
        const contactsList = document.getElementById('contactsList');
        if (!contactsList) return;
        contactsList.innerHTML = '';

        if (!this.contacts || this.contacts.length === 0) {
            contactsList.innerHTML = '<div class="empty-state" style="padding:1rem;"><div class="empty-state-icon">💬</div><h3>No conversations yet</h3><p>Start a chat from the Matches page.</p></div>';
            return;
        }

        const sortedContacts = [...this.contacts].sort((a, b) => {
            const convA = this.conversations[a.id];
            const convB = this.conversations[b.id];
            if (!convA) return 1;
            if (!convB) return -1;
            return (convB.lastMessageTime || 0) - (convA.lastMessageTime || 0);
        });

        sortedContacts.forEach(contact => {
            const conversation = this.conversations[contact.id];
            const lastMessage = conversation?.getLastMessage();
            const contactItem = document.createElement('div');
            contactItem.className = `contact-item ${this.activeContactId === contact.id ? 'active' : ''}`;
            contactItem.onclick = () => this.openChat(contact.id);

            let preview = 'No messages yet';
            let time = '';
            if (lastMessage) {
                preview = lastMessage.text.length > 40 ? lastMessage.text.substring(0, 40) + '...' : lastMessage.text;
                time = this.formatTime(lastMessage.timestamp);
            }

            contactItem.innerHTML = `
                <div class="contact-avatar">
                    ${contact.avatar}
                    ${contact.online ? '<div class="online-indicator"></div>' : ''}
                </div>
                <div class="contact-info">
                    <div class="contact-name">${contact.name}</div>
                    <div class="contact-preview">${preview}</div>
                </div>
                <div class="contact-meta">
                    ${time ? `<div class="contact-time">${time}</div>` : ''}
                    ${conversation && conversation.unreadCount > 0 ? `<div class="unread-badge">${conversation.unreadCount}</div>` : ''}
                </div>
            `;

            contactsList.appendChild(contactItem);
        });
    }

    async openChat(contactId) {
        this.activeContactId = String(contactId);

        // Load thread from backend
        await this.loadThread(contactId);

        const contact = this.contacts.find(c => String(c.id) === String(contactId));
        const conversation = this.conversations[contactId];
        if (conversation) {
            conversation.markAsRead();
        }

        this.renderContactsList();
        this.renderChatArea(contact, conversation);

        setTimeout(() => {
            const messagesArea = document.querySelector('.chat-messages-area');
            if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
        }, 50);
    }

    async loadThread(contactId) {
        const other = Number(contactId || 0) || 0;
        if (!other) return;
        try {
            const res = await fetch(`/api/messages/thread/${other}`);
            const data = await res.json();
            if (data && data.ok && Array.isArray(data.messages)) {
                const conv = new Conversation(String(contactId));
                data.messages.forEach(m => {
                    conv.addMessage(new Message(
                        Number(m.id),
                        String(m.sender_id),
                        m.text,
                        new Date(m.created_at),
                        !!m.is_read
                    ));
                });
                conv.unreadCount = 0;
                const last = conv.getLastMessage();
                conv.lastMessageTime = last ? new Date(last.timestamp).getTime() : null;
                this.conversations[String(contactId)] = conv;
            }
        } catch (e) {
            // ignore
        }
    }

    renderChatArea(contact, conversation) {
        const emptyState = document.getElementById('chatEmptyState');
        const shell = document.getElementById('chatShell');
        const avatarEl = document.getElementById('chatHeaderAvatar');
        const nameEl = document.getElementById('chatHeaderName');
        const statusEl = document.getElementById('chatHeaderStatus');
        const messagesEl = document.getElementById('chatMessagesArea');
        const input = document.getElementById('messageInput');

        if (!shell || !messagesEl) return;

        if (!contact) {
            if (emptyState) emptyState.style.display = '';
            shell.style.display = 'none';
            if (nameEl) nameEl.textContent = 'Select a conversation';
            if (statusEl) statusEl.textContent = '';
            return;
        }

        const statusText = contact.online ? 'Online' : `${contact.age || ''} years old • ${contact.generation || ''}`;

        if (emptyState) emptyState.style.display = 'none';
        shell.style.display = '';

        if (avatarEl) avatarEl.innerHTML = contact.avatar;
        if (nameEl) nameEl.textContent = contact.name;
        if (statusEl) statusEl.textContent = statusText;

        messagesEl.innerHTML = this.renderMessages(conversation);

        if (input) {
            input.placeholder = `Message ${contact.name}...`;
            input.focus();
        }
    }

    hideMobileContacts() {
        const sidebar = document.getElementById('contactsSidebar');
        if (sidebar) sidebar.classList.remove('mobile-show');
    }

    renderMessages(conversation) {
        if (!conversation || !conversation.messages || conversation.messages.length === 0) {
            return '<div class="empty-state"><div class="empty-state-icon">👋</div><h3>Start the conversation!</h3><p>Send a message to begin chatting</p></div>';
        }

        let html = '';
        let lastDate = null;

        conversation.messages.forEach(message => {
            const messageDate = this.formatDate(message.timestamp);
            if (messageDate !== lastDate) {
                html += `<div class="date-separator">${messageDate}</div>`;
                lastDate = messageDate;
            }

            const senderId = String(message.senderId || message.sender_id || message.senderId);
            const isSent = senderId === String(this.currentUserId);
            html += `
                <div class="message-group ${isSent ? 'sent' : 'received'}">
                    <div class="message-bubble">${this.escapeHtml(message.text)}</div>
                    <div class="message-time">${this.formatMessageTime(message.timestamp)}</div>
                </div>
            `;
        });

        return html;
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input ? input.value.trim() : '';
        if (!text || !this.activeContactId) return;

        const recipientId = Number(this.activeContactId);
        try {
            await fetch('/api/messages/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient_id: recipientId, text })
            });
        } catch (e) {
            // ignore
        }

        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }
    }

    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    showMobileContacts() {
        const sidebar = document.getElementById('contactsSidebar');
        if (sidebar) sidebar.classList.add('mobile-show');
    }

    // ---- Formatting helpers (kept from prior implementation) ----
    formatTime(date) {
        if (!date) return '';
        const d = (date instanceof Date) ? date : new Date(date);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatDate(date) {
        const d = (date instanceof Date) ? date : new Date(date);
        return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    }

    formatMessageTime(date) {
        const d = (date instanceof Date) ? date : new Date(date);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

window.MessagesApp = MessagesApp;

window.MessagesApp = MessagesApp;
