
// Voice Agent & AI Assistant Logic
// Integrates Gemini API, Web Speech API, and LocalStorage

document.addEventListener('DOMContentLoaded', () => {
    // Helper to safely parse JSON from localStorage
    const safeJSONParse = (key, fallback) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : fallback;
        } catch (e) {
            console.error(`Error parsing ${key} from localStorage`, e);
            return fallback;
        }
    };

    // --- Configuration & State ---
    const STATE = {
        isOpen: false,
        isListening: false,
        isSpeaking: false,
        isHistoryOpen: false, // New
        currentChatId: null, // New
        chats: safeJSONParse('gemini_chats', []), // Array of {id, title, messages, timestamp}
        // messages: [], // Deprecated in favor of currentChatId -> chats
        config: {
            apiKey: localStorage.getItem('gemini_api_key') || '',
            model: localStorage.getItem('gemini_model') || 'custom',
            customModel: localStorage.getItem('gemini_custom_model') || 'gemini-3-flash-preview',
            useThinking: localStorage.getItem('gemini_thinking') !== 'false', // Default true for thinking model
            useTTS: localStorage.getItem('gemini_tts') !== 'false', // Default true
            lang: localStorage.getItem('gemini_lang') || 'es',
            voiceURI: localStorage.getItem('gemini_voice_uri') || ''
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
        
        // History UI
        historyToggleBtn: document.getElementById('history-toggle-btn'),
        historySidebar: document.getElementById('history-sidebar'),
        historyList: document.getElementById('history-list'),
        newChatBtn: document.getElementById('new-chat-btn'),
        clearAllChatsBtn: document.getElementById('clear-all-chats-btn'),

        // Settings Inputs
        apiKeyInput: document.getElementById('api-key-input'),
        modelSelect: document.getElementById('model-select'),
        refreshModelsBtn: document.getElementById('refresh-models-btn'),
        customModelInput: document.getElementById('custom-model-input'),
        thinkingToggle: document.getElementById('thinking-mode-toggle'),
        ttsToggle: document.getElementById('tts-toggle'),
        langSelect: document.getElementById('voice-lang-select'),
        voiceSelect: document.getElementById('voice-select'),
        clearHistoryBtn: document.getElementById('clear-history-btn'),
        modelStatus: document.getElementById('model-status'),

        // Player Controls
        playerControls: document.getElementById('audio-player-controls'),
        playerPlayPauseBtn: document.getElementById('player-play-pause-btn'),
        playerStopBtn: document.getElementById('player-stop-btn'),
        playerStatus: document.getElementById('player-status'),
        currentVoiceName: document.getElementById('current-voice-name')
    };

    // --- Chat Management ---

    function createNewChat() {
        const chatId = Date.now().toString();
        const newChat = {
            id: chatId,
            title: 'Nuevo Chat',
            messages: [],
            timestamp: Date.now()
        };
        STATE.chats.unshift(newChat);
        STATE.currentChatId = chatId;
        saveChats();
        renderChatHistory();
        loadChat(chatId);
        
        // Clear input
        UI.input.value = '';
        UI.input.focus();
        
        // Close sidebar on mobile/desktop
        if (STATE.isHistoryOpen) toggleHistory();
    }

    function loadChat(chatId) {
        const chat = STATE.chats.find(c => c.id === chatId);
        if (!chat) return;

        STATE.currentChatId = chatId;
        
        // Clear UI
        UI.chatContainer.innerHTML = '';
        
        // Add welcome message always
        addMessage('bot', 'Hola, soy el asistente virtual de Jeremy. ¿En qué puedo ayudarte hoy?', false);

        // Render messages
        chat.messages.forEach(msg => {
            // Don't save to history again when loading
            const div = document.createElement('div');
            div.className = `flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`;
            const bubble = document.createElement('div');
            bubble.className = msg.role === 'user' 
                ? 'bg-primary text-dark rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] text-sm shadow-md'
                : 'bg-white/10 text-light rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] text-sm shadow-md';
            bubble.innerHTML = formatText(msg.content);
            div.appendChild(bubble);
            UI.chatContainer.appendChild(div);
        });
        
        // Scroll to bottom
        scrollToBottom();
        
        // Update active state in sidebar
        renderChatHistory();
    }

    function saveChats() {
        localStorage.setItem('gemini_chats', JSON.stringify(STATE.chats));
    }

    function updateChatTitle(chatId, firstMessage) {
        const chat = STATE.chats.find(c => c.id === chatId);
        if (chat && chat.title === 'Nuevo Chat') {
            // Generate simple title from first message
            let title = firstMessage.substring(0, 30);
            if (firstMessage.length > 30) title += '...';
            chat.title = title;
            saveChats();
            renderChatHistory();
        }
    }

    function deleteChat(chatId, event) {
        if (event) event.stopPropagation();
        if (confirm('¿Borrar este chat?')) {
            STATE.chats = STATE.chats.filter(c => c.id !== chatId);
            saveChats();
            renderChatHistory();
            
            // If deleted active chat, create new or load first
            if (STATE.currentChatId === chatId) {
                if (STATE.chats.length > 0) {
                    loadChat(STATE.chats[0].id);
                } else {
                    createNewChat();
                }
            }
        }
    }

    function clearAllChats() {
        if (confirm('¿Estás seguro de borrar TODO el historial?')) {
            STATE.chats = [];
            saveChats();
            createNewChat();
        }
    }

    function renderChatHistory() {
        UI.historyList.innerHTML = '';
        
        if (STATE.chats.length === 0) {
            UI.historyList.innerHTML = '<div class="text-center text-secondary text-xs mt-4">No hay historial</div>';
            return;
        }

        STATE.chats.forEach(chat => {
            const item = document.createElement('div');
            const isActive = chat.id === STATE.currentChatId;
            item.className = `p-3 rounded cursor-pointer group flex justify-between items-center transition-colors ${isActive ? 'bg-primary/20 border border-primary/30' : 'hover:bg-white/5 border border-transparent'}`;
            
            const date = new Date(chat.timestamp).toLocaleDateString();
            
            item.innerHTML = `
                <div class="flex-1 min-w-0 pr-2">
                    <h5 class="text-sm font-mono ${isActive ? 'text-primary' : 'text-light'} truncate">${chat.title}</h5>
                    <p class="text-[10px] text-secondary truncate">${date}</p>
                </div>
                <button class="text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1" onclick="deleteChat('${chat.id}', event)">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            `;
            
            item.addEventListener('click', () => {
                loadChat(chat.id);
                if (window.innerWidth < 640) toggleHistory(); // Close on mobile
            });
            
            UI.historyList.appendChild(item);
        });
    }

    // Toggle History Sidebar
    function toggleHistory() {
        STATE.isHistoryOpen = !STATE.isHistoryOpen;
        if (STATE.isHistoryOpen) {
            UI.historySidebar.classList.remove('-translate-x-full');
        } else {
            UI.historySidebar.classList.add('-translate-x-full');
        }
    }

    // Adapter for existing handleUserMessage
    function saveMessageToHistory(role, text) {
        if (!STATE.currentChatId) return;
        const chat = STATE.chats.find(c => c.id === STATE.currentChatId);
        if (chat) {
            chat.messages.push({ role, content: text, timestamp: Date.now() });
            saveChats();
            if (role === 'user' && chat.messages.filter(m => m.role === 'user').length === 1) {
                updateChatTitle(chat.id, text);
            }
        }
    }
    
    // Expose for onclick events in HTML string
    window.deleteChat = deleteChat;

    // --- Initialization ---

    function init() {
        // Event Listeners (Initialize first to ensure UI is responsive)
        try {
            UI.btn.addEventListener('click', togglePanel);
            UI.closeBtn.addEventListener('click', togglePanel);
            UI.settingsBtn.addEventListener('click', () => {
                const isHidden = UI.settingsModal.classList.contains('hidden');
                toggleSettings(isHidden);
            });
            UI.closeSettingsBtn.addEventListener('click', () => toggleSettings(false));
            
            UI.sendBtn.addEventListener('click', handleUserMessage);
            UI.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleUserMessage();
            });

            UI.micBtn.addEventListener('click', toggleVoiceRecognition);
            
            // History Listeners
            UI.historyToggleBtn.addEventListener('click', toggleHistory);
            UI.newChatBtn.addEventListener('click', createNewChat);
            UI.clearAllChatsBtn.addEventListener('click', clearAllChats);
            
            // Settings Events
            UI.refreshModelsBtn.addEventListener('click', fetchAvailableModels);
            UI.apiKeyInput.addEventListener('change', (e) => {
                updateConfig('apiKey', e.target.value);
                if (e.target.value) fetchAvailableModels();
            });
            UI.modelSelect.addEventListener('change', (e) => {
                updateConfig('model', e.target.value);
                toggleCustomModelInput(e.target.value === 'custom');
            });
            UI.customModelInput.addEventListener('change', (e) => updateConfig('customModel', e.target.value));
            UI.thinkingToggle.addEventListener('change', (e) => updateConfig('useThinking', e.target.checked));
            UI.ttsToggle.addEventListener('change', (e) => updateConfig('useTTS', e.target.checked));
            UI.langSelect.addEventListener('change', (e) => updateConfig('lang', e.target.value));
            if (UI.clearHistoryBtn) {
                UI.clearHistoryBtn.addEventListener('click', clearAllChats);
            }
        } catch (e) {
            console.error("Error initializing event listeners:", e);
        }

        try {
            initSettings();
            
            // Initialize Chats
            if (!STATE.chats || !Array.isArray(STATE.chats) || STATE.chats.length === 0) {
                STATE.chats = []; // Reset if invalid
                createNewChat();
            } else {
                // Load most recent
                loadChat(STATE.chats[0].id);
                renderChatHistory();
            }
            
            // Auto-fetch models if key exists
            if (STATE.config.apiKey) {
                fetchAvailableModels();
            }
        } catch (e) {
            console.error("Error initializing app state:", e);
            // Fallback: create new chat if loading failed
            createNewChat();
        }
    }

    init();

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

    async function fetchAvailableModels() {
        if (!STATE.config.apiKey) {
            // alert('Por favor configura primero tu API Key.'); // Don't alert on auto-load
            return;
        }

        const btn = UI.refreshModelsBtn;
        const icon = btn.querySelector('i');
        icon.classList.add('animate-spin');
        btn.disabled = true;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${STATE.config.apiKey}`);
            if (!response.ok) throw new Error('Error al obtener modelos');
            
            const data = await response.json();
            let models = [];
            if (data.models) {
                models = data.models.filter(m => 
                    m.supportedGenerationMethods && 
                    m.supportedGenerationMethods.includes('generateContent') &&
                    m.name.includes('gemini') // Filter strictly for Gemini models
                );
            }

            // Save current custom option to restore it
            const customOption = document.createElement('option');
            customOption.value = 'custom';
            customOption.textContent = 'Custom Model ID';

            UI.modelSelect.innerHTML = ''; // Clear existing
            
            // Sort: newer versions first (roughly)
            models.sort((a, b) => b.displayName.localeCompare(a.displayName));

            models.forEach(model => {
                const option = document.createElement('option');
                // model.name is like "models/gemini-pro"
                const value = model.name.replace('models/', '');
                option.value = value;
                option.textContent = `${model.displayName} (${value})`;
                UI.modelSelect.appendChild(option);
            });

            // Always add Custom option at the end
            UI.modelSelect.appendChild(customOption);

            // Restore selection if still valid, else select first available
            if (models.some(m => m.name.replace('models/', '') === STATE.config.model)) {
                UI.modelSelect.value = STATE.config.model;
            } else if (models.length > 0) {
                UI.modelSelect.value = models[0].name.replace('models/', '');
                updateConfig('model', UI.modelSelect.value);
            } else {
                 // Fallback if no models found (e.g. key issue but no error thrown yet)
                 UI.modelSelect.value = 'custom';
            }

            // Show success feedback
            icon.classList.remove('fa-sync-alt', 'animate-spin');
            icon.classList.add('fa-check', 'text-green-400');
            setTimeout(() => {
                icon.classList.remove('fa-check', 'text-green-400');
                icon.classList.add('fa-sync-alt');
            }, 2000);

        } catch (error) {
            console.error('Failed to fetch models:', error);
            // alert('No se pudieron cargar los modelos. Verifica tu API Key.');
        } finally {
            icon.classList.remove('animate-spin');
            btn.disabled = false;
        }
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

    // 3. Text-to-Speech (Web Speech API)
    let synthesis = window.speechSynthesis;
    let currentUtterance = null;
    let availableVoices = [];

    function loadVoices() {
        availableVoices = synthesis.getVoices();
        
        // Filter voices by selected language
        const langCode = STATE.config.lang === 'es' ? 'es' : 'en';
        const filteredVoices = availableVoices.filter(v => v.lang.startsWith(langCode));

        // Populate select
        UI.voiceSelect.innerHTML = '<option value="">Voz automática</option>';
        filteredVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.voiceURI;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (voice.voiceURI === STATE.config.voiceURI) {
                option.selected = true;
            }
            UI.voiceSelect.appendChild(option);
        });
    }

    // Chrome requires an event to load voices
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }

    function speak(text) {
        if (!STATE.config.useTTS) return;

        // Cancel previous
        if (synthesis.speaking) {
            synthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Select voice
        if (STATE.config.voiceURI) {
            const voice = availableVoices.find(v => v.voiceURI === STATE.config.voiceURI);
            if (voice) utterance.voice = voice;
        } else {
             // Fallback to best available for language
             const langCode = STATE.config.lang === 'es' ? 'es-ES' : 'en-US';
             utterance.lang = langCode;
        }

        // Setup events for player UI
        utterance.onstart = () => {
            STATE.isSpeaking = true;
            showPlayer(true);
            UI.playerStatus.textContent = "Reproduciendo...";
            UI.currentVoiceName.textContent = utterance.voice ? utterance.voice.name : 'Voz Automática';
            UI.playerPlayPauseBtn.innerHTML = '<i class="fas fa-pause text-xs"></i>';
        };

        utterance.onend = () => {
            STATE.isSpeaking = false;
            showPlayer(false);
            UI.playerPlayPauseBtn.innerHTML = '<i class="fas fa-play text-xs"></i>';
        };

        utterance.onerror = () => {
            STATE.isSpeaking = false;
            showPlayer(false);
        };

        currentUtterance = utterance;
        synthesis.speak(utterance);
    }

    function showPlayer(show) {
        if (show) {
            UI.playerControls.classList.remove('hidden');
        } else {
            // Delay hiding slightly for smoother UX
            setTimeout(() => {
                if (!synthesis.speaking) {
                    UI.playerControls.classList.add('hidden');
                }
            }, 2000);
        }
    }

    // Player Controls Logic
    UI.playerStopBtn.addEventListener('click', () => {
        if (synthesis.speaking) {
            synthesis.cancel();
            STATE.isSpeaking = false;
            showPlayer(false);
        }
    });

    UI.playerPlayPauseBtn.addEventListener('click', () => {
        if (synthesis.paused) {
            synthesis.resume();
            UI.playerPlayPauseBtn.innerHTML = '<i class="fas fa-pause text-xs"></i>';
            UI.playerStatus.textContent = "Reproduciendo...";
        } else if (synthesis.speaking) {
            synthesis.pause();
            UI.playerPlayPauseBtn.innerHTML = '<i class="fas fa-play text-xs"></i>';
            UI.playerStatus.textContent = "Pausado";
        }
    });

    // Update voice list when language changes
    UI.langSelect.addEventListener('change', () => {
        updateConfig('lang', UI.langSelect.value);
        loadVoices(); // Refresh list
    });

    // Save selected voice
    UI.voiceSelect.addEventListener('change', () => {
        updateConfig('voiceURI', UI.voiceSelect.value);
    });

    // --- End TTS Logic ---

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
        
        // Detect language or use configured one
        // If config.lang is 'es' -> 'es-ES', if 'en' -> 'en-US'
        // But let's make it smarter: if user speaks in english to a spanish config, it might fail.
        // Web Speech API doesn't support auto-detect well. 
        // We will stick to configured language but ensure it updates dynamically.
        recognition.lang = STATE.config.lang === 'es' ? 'es-ES' : 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            STATE.isListening = true;
            UI.indicator.classList.remove('hidden');
            UI.micBtn.classList.add('text-red-500', 'animate-pulse');
            UI.input.placeholder = recognition.lang.startsWith('es') ? "Escuchando..." : "Listening...";
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
            
            // Handle specific errors
            if (event.error === 'no-speech') {
                // Just ignore
            } else if (event.error === 'not-allowed') {
                alert('Permiso de micrófono denegado.');
            }
        };

        recognition.start();
    }
});
