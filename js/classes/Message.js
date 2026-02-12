class Message {
    constructor(id, senderId, text, timestamp, isRead = false) {
        this.id = id;
        this.senderId = senderId;
        this.text = text;
        this.timestamp = timestamp;
        this.isRead = isRead;
    }
}

// Expose globally for non-module script tags
window.Message = Message;
