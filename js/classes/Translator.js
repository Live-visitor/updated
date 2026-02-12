class Translator {
    constructor() {
        this.translations = {};
    }

    addToHistory(modern, traditional) {
        const historyContainer = document.getElementById('translationHistory');
        if (!historyContainer) return;
        
        const newItem = document.createElement('div');
        newItem.className = 'history-item';
        newItem.innerHTML = `<div><strong>Modern:</strong> "${modern}" → <strong>Traditional:</strong> "${traditional}"</div>`;
        historyContainer.prepend(newItem);
    }

    async performTranslation() {
        const modernTextarea = document.getElementById('modernText');
        const traditionalTextarea = document.getElementById('traditionalText');
        if (!modernTextarea || !traditionalTextarea) return;

        const modernText = modernTextarea.value.trim();
        const traditionalText = traditionalTextarea.value.trim();

        try {
            if (modernText && !traditionalText) {
                // Translate modern to traditional
                const response = await fetch('/api/translator/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: modernText, direction: "to_traditional" })
                });
                const data = await response.json();
                
                if (data.ok) {
                    traditionalTextarea.value = data.translation;
                    this.addToHistory(modernText, data.translation);
                }
            } else if (traditionalText && !modernText) {
                // Translate traditional to modern
                const response = await fetch('/api/translator/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: traditionalText, direction: "to_modern" })
                });
                const data = await response.json();
                
                if (data.ok) {
                    modernTextarea.value = data.translation;
                    this.addToHistory(data.translation, traditionalText);
                }
            }
        } catch (error) {
            console.error('Translation error:', error);
        }
    }

    swap(modeToggle) {
        const modernTextarea = document.getElementById('modernText');
        const traditionalTextarea = document.getElementById('traditionalText');
        if (!modernTextarea || !traditionalTextarea) return;

        const originalModernContent = modernTextarea.value;
        const originalTraditionalContent = traditionalTextarea.value;

        // Swap the content
        modernTextarea.value = originalTraditionalContent;
        traditionalTextarea.value = originalModernContent;

        // Toggle the mode if modeToggle is provided
        if (modeToggle && typeof modeToggle.toggle === 'function') {
            modeToggle.toggle();
        }

        // Clear one field based on which had content
        if (originalModernContent.trim() !== "" && originalTraditionalContent.trim() !== "") {
            // Both had content, keep the swap and clear nothing
            modernTextarea.value = originalTraditionalContent;
            traditionalTextarea.value = "";
        } else if (originalModernContent.trim() === "" && originalTraditionalContent.trim() !== "") {
            // Only traditional had content, it's now in modern field
            traditionalTextarea.value = "";
        } else if (originalModernContent.trim() !== "" && originalTraditionalContent.trim() === "") {
            // Only modern had content, it's now in traditional field
            modernTextarea.value = "";
        }
        
        // Perform translation after swap
        this.performTranslation();
    }
}

window.Translator = Translator;