class Conversation {
    constructor(contactId) {
        this.contactId = contactId;
        this.messages = [];
        this.lastMessageTime = null;
        this.unreadCount = 0;
    }

    addMessage(message) {
        this.messages.push(message);
        this.lastMessageTime = message.timestamp;
        if (message.senderId !== 'user') {
            this.unreadCount++;
        }
    }

    markAsRead() {
        this.unreadCount = 0;
        this.messages.forEach(msg => msg.isRead = true);
    }

    getLastMessage() {
        return this.messages[this.messages.length - 1];
    }
}

// Expose globally for non-module script tags
window.Conversation = Conversation;
