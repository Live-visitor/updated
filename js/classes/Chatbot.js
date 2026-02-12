class Chatbot {
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const messagesContainer = document.getElementById('chatMessages');
        
        if (!input || !messagesContainer) return;
        
        const messageText = input.value.trim();
        if (messageText === '') return;

        // Disable input during request
        input.disabled = true;
        
        // Add user message safely
        this.addMessage(messagesContainer, messageText, 'user');
        input.value = '';

        // Show typing indicator
        const typingIndicator = this.addTypingIndicator(messagesContainer);

        try {
            const response = await fetch('/api/chatbot/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            typingIndicator.remove();
            
            if (data.error) {
                this.addMessage(messagesContainer, data.error, 'bot error');
            } else {
                this.addMessage(messagesContainer, data.response || 'No response received', 'bot');
            }
            
        } catch (error) {
            console.error('Chatbot error:', error);
            typingIndicator.remove();
            this.addMessage(
                messagesContainer, 
                'Sorry, something went wrong. Please try again.', 
                'bot error'
            );
        } finally {
            input.disabled = false;
            input.focus();
        }
    }

    async suggestTopic() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const typingIndicator = this.addTypingIndicator(messagesContainer);
        
        try {
            const response = await fetch('/api/chatbot/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            typingIndicator.remove();
            
            const botMessage = document.createElement('div');
            botMessage.className = 'message bot';
            
            const title = document.createElement('p');
            title.textContent = '💡 Conversation Starters:';
            
            const list = document.createElement('ul');
            (data.topics || []).forEach(topic => {
                const li = document.createElement('li');
                li.textContent = typeof topic === 'string' ? topic : topic.topic || 'Suggestion';
                list.appendChild(li);
            });
            
            botMessage.appendChild(title);
            botMessage.appendChild(list);
            messagesContainer.appendChild(botMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
        } catch (error) {
            console.error('Suggest topic error:', error);
            typingIndicator.remove();
            this.addMessage(
                messagesContainer, 
                'Unable to load topic suggestions.', 
                'bot error'
            );
        }
    }

    translateMessage() {
        window.location.href = 'translator.html';
    }

    // Helper: Safely add messages (prevents XSS)
    addMessage(container, text, className) {
        const message = document.createElement('div');
        message.className = `message ${className}`;
        const p = document.createElement('p');
        p.textContent = text; // Safe text insertion
        message.appendChild(p);
        container.appendChild(message);
        container.scrollTop = container.scrollHeight;
    }

    // Helper: Typing indicator
    addTypingIndicator(container) {
        const indicator = document.createElement('div');
        indicator.className = 'message bot typing-indicator';
        indicator.innerHTML = '<p><span></span><span></span><span></span></p>';
        container.appendChild(indicator);
        container.scrollTop = container.scrollHeight;
        return indicator;
    }
}

window.Chatbot = Chatbot;
```

## Environment Setup

Add to your `.env` file:
```
OPENAI_API_KEY=your_openai_api_key_here