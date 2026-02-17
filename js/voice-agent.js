
// Voice Agent & AI Assistant Logic
// Integrates Gemini API, Web Speech API, and LocalStorage

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & State ---
    const STATE = {
        isOpen: false,
        isListening: false,
        messages: [],
        config: {
            apiKey: localStorage.getItem('gemini_api_key') || '',
            model: localStorage.getItem('gemini_model') || 'gemini-2.0-flash-exp',
            customModel: localStorage.getItem('gemini_custom_model') || '',
            useThinking: localStorage.getItem('gemini_thinking') === 'true',
            useTTS: localStorage.getItem('gemini_tts') !== 'false', // Default true
            lang: localStorage.getItem('gemini_lang') || 'es'
        }
    };

    // --- DOM Elements ---
    const UI = {
        btn: document.getElementById('voice-agent-btn'),
        panel: document.getElementById('voice-agent-panel'),
        closeBtn: document.getElementById('voice-close-btn'),
        settingsBtn: document.getElementById('voice-settings-btn'),
        settingsModal: document.getElementById('voice-settings-modal'),
        closeSettingsBtn: document.getElementById('close-settings-btn'),
        chatContainer: document.getElementById('chat-messages'),
        input: document.getElementById('chat-input'),
        sendBtn: document.getElementById('send-btn'),
        micBtn: document.getElementById('mic-btn'),
        indicator: document.getElementById('voice-listening-indicator'),
        
        // Settings Inputs
        apiKeyInput: document.getElementById('api-key-input'),
        modelSelect: document.getElementById('model-select'),
        customModelInput: document.getElementById('custom-model-input'),
        thinkingToggle: document.getElementById('thinking-mode-toggle'),
        ttsToggle: document.getElementById('tts-toggle'),
        langSelect: document.getElementById('voice-lang-select'),
        clearHistoryBtn: document.getElementById('clear-history-btn'),
        modelStatus: document.getElementById('model-status')
    };

    // --- Initialization ---
    initSettings();
    loadHistory();

    // --- Event Listeners ---
    UI.btn.addEventListener('click', togglePanel);
    UI.closeBtn.addEventListener('click', togglePanel);
    UI.settingsBtn.addEventListener('click', () => toggleSettings(true));
    UI.closeSettingsBtn.addEventListener('click', () => toggleSettings(false));
    
    UI.sendBtn.addEventListener('click', handleUserMessage);
    UI.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUserMessage();
    });

    UI.micBtn.addEventListener('click', toggleVoiceRecognition);
    
    // Settings Events
    UI.apiKeyInput.addEventListener('change', (e) => updateConfig('apiKey', e.target.value));
    UI.modelSelect.addEventListener('change', (e) => {
        updateConfig('model', e.target.value);
        toggleCustomModelInput(e.target.value === 'custom');
    });
    UI.customModelInput.addEventListener('change', (e) => updateConfig('customModel', e.target.value));
    UI.thinkingToggle.addEventListener('change', (e) => updateConfig('useThinking', e.target.checked));
    UI.ttsToggle.addEventListener('change', (e) => updateConfig('useTTS', e.target.checked));
    UI.langSelect.addEventListener('change', (e) => updateConfig('lang', e.target.value));
    UI.clearHistoryBtn.addEventListener('click', clearHistory);

    // --- Core Functions ---

    function togglePanel() {
        STATE.isOpen = !STATE.isOpen;
        if (STATE.isOpen) {
            UI.panel.classList.remove('translate-x-full');
            UI.btn.classList.add('scale-0'); // Hide button when open
            scrollToBottom();
            // Focus input
            setTimeout(() => UI.input.focus(), 300);
        } else {
            UI.panel.classList.add('translate-x-full');
            UI.btn.classList.remove('scale-0');
        }
    }

    function toggleSettings(show) {
        if (show) {
            UI.settingsModal.classList.remove('hidden');
            UI.settingsModal.classList.add('flex');
        } else {
            UI.settingsModal.classList.add('hidden');
            UI.settingsModal.classList.remove('flex');
        }
    }

    function initSettings() {
        UI.apiKeyInput.value = STATE.config.apiKey;
        UI.modelSelect.value = STATE.config.model;
        UI.customModelInput.value = STATE.config.customModel;
        UI.thinkingToggle.checked = STATE.config.useThinking;
        UI.ttsToggle.checked = STATE.config.useTTS;
        UI.langSelect.value = STATE.config.lang;
        
        toggleCustomModelInput(STATE.config.model === 'custom');
        updateModelStatus();
    }

    function toggleCustomModelInput(show) {
        if (show) {
            UI.customModelInput.classList.remove('hidden');
        } else {
            UI.customModelInput.classList.add('hidden');
        }
    }

    function updateConfig(key, value) {
        STATE.config[key] = value;
        
        // Storage mapping
        const storageKeys = {
            apiKey: 'gemini_api_key',
            model: 'gemini_model',
            customModel: 'gemini_custom_model',
            useThinking: 'gemini_thinking',
            useTTS: 'gemini_tts',
            lang: 'gemini_lang'
        };
        
        localStorage.setItem(storageKeys[key], value);
        updateModelStatus();
    }

    function updateModelStatus() {
        const modelName = STATE.config.model === 'custom' ? STATE.config.customModel : STATE.config.model;
        UI.modelStatus.textContent = `Model: ${modelName} ${STATE.config.useThinking ? '(Thinking)' : ''}`;
    }

    // --- Chat Logic ---

    async function handleUserMessage() {
        const text = UI.input.value.trim();
        if (!text) return;

        // Clear input
        UI.input.value = '';

        // Add User Message
        addMessage('user', text);

        // Check API Key
        if (!STATE.config.apiKey) {
            addMessage('system', '⚠️ Por favor configura tu API Key de Gemini en los ajustes (⚙️).');
            toggleSettings(true);
            return;
        }

        // Show Loading
        const loadingId = addLoadingIndicator();

        try {
            // Prepare Context
            const context = getSystemPrompt();
            
            // Call Gemini API
            const response = await callGeminiAPI(text, context);
            
            // Remove Loading
            removeMessage(loadingId);
            
            // Add Bot Message
            addMessage('bot', response);

            // TTS (Speak only the response text, ignoring thinking blocks)
            if (STATE.config.useTTS) {
                const speakText = response.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
                speak(speakText);
            }

        } catch (error) {
            removeMessage(loadingId);
            addMessage('system', `❌ Error: ${error.message}`);
            console.error(error);
        }
    }

    function addMessage(role, text) {
        const div = document.createElement('div');
        div.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`;
        
        const bubble = document.createElement('div');
        bubble.className = role === 'user' 
            ? 'bg-primary text-dark rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] text-sm shadow-md'
            : (role === 'system' ? 'bg-red-500/20 text-red-200 rounded-lg px-4 py-2 text-xs border border-red-500/30' 
            : 'bg-white/10 text-light rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] text-sm shadow-md');
        
        // Render Markdown-ish (simple bold/code)
        bubble.innerHTML = formatText(text);
        
        div.appendChild(bubble);
        UI.chatContainer.appendChild(div);
        
        scrollToBottom();

        // Save to history (except system messages)
        if (role !== 'system') {
            saveMessageToHistory(role, text);
        }
        
        return div.id = 'msg-' + Date.now();
    }

    function addLoadingIndicator() {
        const id = 'loading-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'flex justify-start animate-fade-in';
        div.innerHTML = `
            <div class="bg-white/10 text-light rounded-2xl rounded-tl-none px-4 py-3 text-sm flex gap-2 items-center">
                <div class="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-primary rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                <div class="w-2 h-2 bg-primary rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
            </div>
        `;
        UI.chatContainer.appendChild(div);
        scrollToBottom();
        return id;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        UI.chatContainer.scrollTop = UI.chatContainer.scrollHeight;
    }

    function formatText(text) {
        // Handle Thinking Blocks
        let formatted = text.replace(/<thinking>([\s\S]*?)<\/thinking>/gi, (match, content) => {
            return `
                <details class="mb-2 border-l-2 border-secondary/30 pl-2">
                    <summary class="text-xs text-secondary cursor-pointer font-mono hover:text-primary">Thinking Process</summary>
                    <div class="text-xs text-secondary/80 mt-1 italic">${content.replace(/\n/g, '<br>')}</div>
                </details>
            `;
        });

        // Simple formatter
        formatted = formatted
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1 rounded font-mono text-xs">$1</code>')
            .replace(/\n/g, '<br>');
            
        return formatted;
    }

    // --- History Management ---

    function saveMessageToHistory(role, text) {
        STATE.messages.push({ role, text, timestamp: Date.now() });
        localStorage.setItem('chat_history', JSON.stringify(STATE.messages));
    }

    function loadHistory() {
        const saved = localStorage.getItem('chat_history');
        if (saved) {
            STATE.messages = JSON.parse(saved);
            STATE.messages.forEach(msg => {
                // Manually recreate UI without saving again
                const div = document.createElement('div');
                div.className = `flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`;
                const bubble = document.createElement('div');
                bubble.className = msg.role === 'user' 
                    ? 'bg-primary text-dark rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] text-sm shadow-md'
                    : 'bg-white/10 text-light rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] text-sm shadow-md';
                bubble.innerHTML = formatText(msg.text);
                div.appendChild(bubble);
                UI.chatContainer.appendChild(div);
            });
            scrollToBottom();
        }
    }

    function clearHistory() {
        STATE.messages = [];
        localStorage.removeItem('chat_history');
        UI.chatContainer.innerHTML = ''; // Clear UI
        addMessage('bot', 'Historial borrado. ¿En qué puedo ayudarte?');
    }

    // --- Gemini API Integration ---

    function extractPageContext() {
        // Simple extraction of visible text
        const mainContent = document.body.innerText
            .replace(/\s+/g, ' ')
            .substring(0, 20000); // Limit context size
        return mainContent;
    }

    function getSystemPrompt() {
        const pageContent = extractPageContext();
        const thinkingInstruction = STATE.config.useThinking ? 
            "Thinking Process: Before answering, briefly analyze the user's intent and the relevant parts of the portfolio context." : "";

        return `
            You are an AI assistant for Jeremy Live's portfolio website.
            Your goal is to answer questions about Jeremy's skills, experience, projects, and contact info based on the website content.
            
            Website Content Context:
            ${pageContent}

            Instructions:
            1. Be professional, concise, and helpful.
            2. If the answer is in the context, use it.
            3. If the answer is NOT in the context, politely say you only have information about Jeremy's professional profile.
            4. Speak in the language the user initiated (mostly Spanish or English).
            5. ${thinkingInstruction}
        `;
    }

    async function callGeminiAPI(prompt, systemContext) {
        const model = STATE.config.model === 'custom' ? STATE.config.customModel : STATE.config.model;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${STATE.config.apiKey}`;
        
        const payload = {
            contents: [
                {
                    parts: [
                        { text: systemContext + "\n\nUser Question: " + prompt }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'API Request Failed');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    // --- Voice Features (STT & TTS) ---

    // 1. Text-to-Speech (Google Translate Hack)
    function speak(text) {
        const cleanText = text.replace(/[*`]/g, '');
        const lang = STATE.config.lang; // 'es' or 'en'
        
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            
            // Try to select a "Google" voice if available
            const voices = window.speechSynthesis.getVoices();
            // Try to find a Google voice for the selected language
            const googleVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith(lang));
            
            if (googleVoice) {
                utterance.voice = googleVoice;
            } else {
                // Fallback to any voice matching the language
                const langVoice = voices.find(v => v.lang.startsWith(lang));
                if (langVoice) utterance.voice = langVoice;
            }
            
            window.speechSynthesis.speak(utterance);
        } else {
            // Fallback to audio element hack
            const encoded = encodeURIComponent(cleanText.substring(0, 200)); 
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`;
            const audio = new Audio(url);
            audio.play().catch(e => console.error("TTS Playback failed", e));
        }
    }

    // 2. Speech-to-Text (Web Speech API)
    let recognition;
    
    function toggleVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Tu navegador no soporta reconocimiento de voz.');
            return;
        }

        if (STATE.isListening) {
            recognition.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        recognition.lang = STATE.config.lang === 'es' ? 'es-ES' : 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            STATE.isListening = true;
            UI.indicator.classList.remove('hidden');
            UI.micBtn.classList.add('text-red-500', 'animate-pulse');
            UI.input.placeholder = "Escuchando...";
        };

        recognition.onend = () => {
            STATE.isListening = false;
            UI.indicator.classList.add('hidden');
            UI.micBtn.classList.remove('text-red-500', 'animate-pulse');
            UI.input.placeholder = "Escribe o habla...";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            UI.input.value = transcript;
            // Auto send after speech
            setTimeout(() => handleUserMessage(), 500);
        };

        recognition.onerror = (event) => {
            console.error('Speech error:', event.error);
            STATE.isListening = false;
            UI.indicator.classList.add('hidden');
            UI.micBtn.classList.remove('text-red-500', 'animate-pulse');
        };

        recognition.start();
    }
});
