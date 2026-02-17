
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
        currentChatId: localStorage.getItem('gemini_last_chat_id') || null, // Restore last chat
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
        overlay: document.getElementById('voice-agent-overlay'),
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
        currentVoiceName: document.getElementById('current-voice-name'),

        // Modals & Notifications
        confirmModal: document.getElementById('confirm-modal'),
        confirmMessage: document.getElementById('confirm-message'),
        confirmOkBtn: document.getElementById('confirm-ok-btn'),
        confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
        
        toast: document.getElementById('notification-toast'),
        toastMessage: document.getElementById('notification-message'),
        toastIcon: document.getElementById('notification-icon')
    };

    // --- Notifications & Modals ---

    function showNotification(message, type = 'info') {
        UI.toastMessage.textContent = message;
        UI.toast.classList.remove('hidden');
        
        // Trigger reflow for animation
        void UI.toast.offsetWidth;
        
        UI.toast.classList.remove('translate-x-10', 'opacity-0');
        
        if (type === 'error') {
            UI.toastIcon.className = 'fas fa-exclamation-circle text-red-400';
            UI.toast.firstElementChild.className = 'bg-surface border border-red-500/20 text-light px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 backdrop-blur-xl';
        } else {
            UI.toastIcon.className = 'fas fa-info-circle text-primary';
            UI.toast.firstElementChild.className = 'bg-surface border border-primary/20 text-light px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 backdrop-blur-xl';
        }

        setTimeout(() => {
            UI.toast.classList.add('translate-x-10', 'opacity-0');
            setTimeout(() => {
                UI.toast.classList.add('hidden');
            }, 300);
        }, 3000);
    }

    function showConfirm(message, onConfirm) {
        UI.confirmMessage.textContent = message;
        UI.confirmModal.classList.remove('hidden');
        UI.confirmModal.classList.add('flex');
        
        // Clone buttons to remove old event listeners
        const newOk = UI.confirmOkBtn.cloneNode(true);
        const newCancel = UI.confirmCancelBtn.cloneNode(true);
        
        UI.confirmOkBtn.parentNode.replaceChild(newOk, UI.confirmOkBtn);
        UI.confirmCancelBtn.parentNode.replaceChild(newCancel, UI.confirmCancelBtn);
        
        UI.confirmOkBtn = newOk;
        UI.confirmCancelBtn = newCancel;

        const cleanup = () => {
            UI.confirmModal.classList.add('hidden');
            UI.confirmModal.classList.remove('flex');
        };

        UI.confirmOkBtn.addEventListener('click', () => {
            onConfirm();
            cleanup();
        });

        UI.confirmCancelBtn.addEventListener('click', cleanup);
        
        // Close on click outside
        UI.confirmModal.onclick = (e) => {
            if (e.target === UI.confirmModal) cleanup();
        };
    }

    // --- Empty State ---

    function showEmptyState() {
        STATE.currentChatId = null;
        localStorage.removeItem('gemini_last_chat_id'); // Clear active chat
        UI.chatContainer.innerHTML = '';
        
        const div = document.createElement('div');
        div.className = 'flex flex-col items-center justify-center h-full animate-fade-in opacity-50';
        div.innerHTML = `
            <button id="empty-state-btn" class="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center text-2xl hover:bg-primary/20 hover:scale-110 transition-all shadow-lg shadow-primary/10 mb-4">
                <i class="fas fa-plus"></i>
            </button>
            <p class="text-sm font-mono text-secondary">Inicia un nuevo chat</p>
        `;
        
        UI.chatContainer.appendChild(div);
        
        document.getElementById('empty-state-btn').addEventListener('click', () => {
            createNewChat(true);
        });
        
        // Ensure history reflects no active chat
        renderChatHistory();
    }

    // --- Chat Management ---

    function createNewChat(isUserInitiated = false) {
        // Stop any playing audio when creating a new chat
        if (synthesis.speaking) {
            synthesis.cancel();
            STATE.isSpeaking = false;
            showPlayer(false);
        }

        // Check if current chat is empty, ONLY if user initiated
        // If we are in empty state (currentChatId is null), we allow creation
        if (isUserInitiated && STATE.currentChatId) {
            const currentChat = STATE.chats.find(c => c.id === STATE.currentChatId);
            // Check if there are user messages
            const hasUserMessages = currentChat && currentChat.messages.some(m => m.role === 'user');
            
            if (currentChat && !hasUserMessages) {
                showNotification('¡Ya tienes un chat nuevo abierto! Envía un mensaje primero.', 'error');
                return;
            }
        }

        const chatId = Date.now().toString();
        const newChat = {
            id: chatId,
            title: 'Nuevo Chat',
            messages: [{
                role: 'bot',
                content: 'Hola, soy el asistente virtual de Jeremy. ¿En qué puedo ayudarte hoy?',
                timestamp: Date.now()
            }],
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
        // Stop any playing audio when switching chats
        if (synthesis.speaking) {
            synthesis.cancel();
            STATE.isSpeaking = false;
            showPlayer(false);
        }

        const chat = STATE.chats.find(c => c.id === chatId);
        if (!chat) return;

        STATE.currentChatId = chatId;
        localStorage.setItem('gemini_last_chat_id', chatId); // Persist active chat
        
        // Clear UI
        UI.chatContainer.innerHTML = '';
        
        // Add welcome message if chat is empty (fallback for old chats or edge cases)
        // But normally it should be in history.
        if (chat.messages.length === 0) {
             // If really empty, add one but don't save it yet? 
             // Or better, let's just rely on history.
             // If we add it here, we risk duplication if we save it later.
             // Let's just render what we have.
             // If it's a NEW chat, createNewChat initializes it with a message.
        }

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
        
        showConfirm('¿Estás seguro de eliminar este chat?', () => {
            STATE.chats = STATE.chats.filter(c => c.id !== chatId);
            saveChats();
            renderChatHistory();
            
            // If deleted active chat
            if (STATE.currentChatId === chatId) {
                if (STATE.chats.length > 0) {
                    // Just show empty state instead of auto-loading next one
                    // to match user request: "refrescar el chat a un mensaje por defecto..."
                    // "solo si se borra el chat donde esta el chat ubicado"
                    showEmptyState();
                } else {
                    // No chats left
                    showEmptyState();
                }
            }
            showNotification('Chat eliminado correctamente');
        });
    }

    function clearAllChats() {
        showConfirm('¿Estás seguro de borrar TODO el historial?', () => {
            STATE.chats = [];
            saveChats();
            showEmptyState();
            showNotification('Historial borrado completamente');
        });
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
                <button class="text-secondary hover:text-red-400 opacity-100 transition-opacity p-1" onclick="deleteChat('${chat.id}', event)">
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
            UI.overlay.addEventListener('click', togglePanel);
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
            UI.newChatBtn.addEventListener('click', () => createNewChat(true));
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
                showEmptyState();
            } else {
                // Restore last chat or load most recent
                const lastChatId = localStorage.getItem('gemini_last_chat_id');
                const chatToLoad = STATE.chats.find(c => c.id === lastChatId) ? lastChatId : STATE.chats[0].id;
                
                loadChat(chatToLoad);
                renderChatHistory();
            }
            
            // Auto-fetch models if key exists
            if (STATE.config.apiKey) {
                fetchAvailableModels();
            }
        } catch (e) {
            console.error("Error initializing app state:", e);
            // Fallback: create new chat if loading failed
            showEmptyState();
        }
    }

    init();

    // --- Core Functions ---

    function togglePanel() {
        STATE.isOpen = !STATE.isOpen;
        if (STATE.isOpen) {
            UI.panel.classList.remove('translate-x-full');
            UI.overlay.classList.remove('hidden');
            UI.btn.classList.add('scale-0'); // Hide button when open
            scrollToBottom();
            // Focus input
            setTimeout(() => UI.input.focus(), 300);
        } else {
            UI.panel.classList.add('translate-x-full');
            UI.overlay.classList.add('hidden');
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

        // Auto-create chat if in empty state
        if (!STATE.currentChatId) {
            createNewChat();
        }

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
        if (!STATE.currentChatId) return;

        const chat = STATE.chats.find(c => c.id === STATE.currentChatId);
        if (chat) {
            chat.messages.push({ 
                role: role, 
                content: text, 
                timestamp: Date.now() 
            });
            saveChats();
            
            // Update title if it's the first user message
            if (role === 'user' && chat.messages.filter(m => m.role === 'user').length === 1) {
                 updateChatTitle(STATE.currentChatId, text);
            }
        }
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
        
        // Retry logic: If no voices, try again shortly (some browsers are slow)
        if (availableVoices.length === 0) {
            setTimeout(loadVoices, 100);
            return;
        }

        // Filter voices by selected language
        // Support broader matching: 'es' matches 'es-ES', 'es-MX', etc.
        const langCode = STATE.config.lang; // 'es' or 'en'
        
        // Better filtering: 
        // 1. Starts with langCode (e.g. 'es-ES' starts with 'es')
        // 2. Exact match (rare but possible)
        const filteredVoices = availableVoices.filter(v => 
            v.lang.startsWith(langCode) || 
            v.lang.toLowerCase().includes(langCode.toLowerCase())
        );

        // Sort: Google voices first (usually higher quality), then Microsoft, then others
        filteredVoices.sort((a, b) => {
            const getScore = (name) => {
                if (name.includes('Google')) return 2;
                if (name.includes('Microsoft')) return 1;
                return 0;
            };
            return getScore(b.name) - getScore(a.name);
        });

        // Populate select
        UI.voiceSelect.innerHTML = '<option value="">Voz automática (Por defecto)</option>';
        
        filteredVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.voiceURI;
            // Clean up name for better UI
            let displayName = voice.name;
            displayName = displayName.replace('Google', '').replace('Microsoft', '').replace('Desktop', '').trim();
            // Add region hint if available
            const region = voice.lang.split('-')[1] || voice.lang;
            
            option.textContent = `${displayName} (${region})`;
            
            // Re-select saved voice
            if (voice.voiceURI === STATE.config.voiceURI) {
                option.selected = true;
            }
            UI.voiceSelect.appendChild(option);
        });
        
        // Update current if selected one is missing from the new list
        // Only reset if we actually have options but the selected one isn't there
        if (filteredVoices.length > 0 && STATE.config.voiceURI && !filteredVoices.find(v => v.voiceURI === STATE.config.voiceURI)) {
            UI.voiceSelect.value = "";
            updateConfig('voiceURI', ''); // Clear invalid config
        }
    }

    // Chrome requires an event to load voices
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    // Initial try
    loadVoices();
    // Force retry after delay
    setTimeout(loadVoices, 1000);
    setTimeout(loadVoices, 5000);

    function speak(text) {
        if (!STATE.config.useTTS) return;

        // Cancel previous to clear queue and fix stuck states
        synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Select voice
        if (STATE.config.voiceURI) {
            const voice = availableVoices.find(v => v.voiceURI === STATE.config.voiceURI);
            if (voice) utterance.voice = voice;
        } 
        
        // Fallback/Default settings
        if (!utterance.voice) {
             const langCode = STATE.config.lang === 'es' ? 'es-ES' : 'en-US';
             utterance.lang = langCode;
        }

        // Show player immediately to give feedback
        showPlayer(true);
        STATE.isSpeaking = true;
        UI.playerStatus.textContent = "Preparando audio...";
        UI.currentVoiceName.textContent = utterance.voice ? utterance.voice.name : 'Voz Automática';
        UI.playerPlayPauseBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i>';

        // Setup events for player UI
        utterance.onstart = () => {
            STATE.isSpeaking = true;
            UI.playerStatus.textContent = "Reproduciendo...";
            UI.playerPlayPauseBtn.innerHTML = '<i class="fas fa-pause text-xs"></i>';
        };

        utterance.onend = () => {
            STATE.isSpeaking = false;
            showPlayer(false);
            UI.playerPlayPauseBtn.innerHTML = '<i class="fas fa-play text-xs"></i>';
        };

        utterance.onerror = (e) => {
            console.error('TTS Error:', e);
            STATE.isSpeaking = false;
            UI.playerStatus.textContent = "Error al reproducir";
            setTimeout(() => showPlayer(false), 2000);
        };

        currentUtterance = utterance;
        
        // Fix for Chrome: Resume before speaking if paused
        if (synthesis.paused) synthesis.resume();

        // Small delay to ensure cancellation took effect
        setTimeout(() => {
            synthesis.speak(utterance);
            
            // Safety check: if onstart doesn't fire in 1s, try resuming again
            setTimeout(() => {
                if (STATE.isSpeaking && synthesis.paused) {
                    synthesis.resume();
                }
            }, 500);
        }, 50);
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
        // Always stop and hide, regardless of speaking state
        synthesis.cancel();
        STATE.isSpeaking = false;
        showPlayer(false);
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
            showNotification('Tu navegador no soporta reconocimiento de voz.', 'error');
            return;
        }

        if (STATE.isListening) {
            if (recognition) recognition.stop();
            return;
        }

        // --- Connectivity & Context Checks ---
        if (!navigator.onLine) {
            showNotification('No tienes conexión a internet.', 'error');
            return;
        }

        // Web Speech API requires HTTPS (except localhost)
        // window.isSecureContext is true for HTTPS and localhost
        if (!window.isSecureContext) {
            showNotification('El reconocimiento de voz requiere HTTPS o Localhost.', 'error');
            return;
        }

        // Cleanup previous instance if any to prevent conflicts
        if (recognition) {
            try {
                recognition.abort();
            } catch (e) { /* ignore */ }
            recognition = null;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        // Use configured language
        recognition.lang = STATE.config.lang === 'es' ? 'es-ES' : 'en-US';
        recognition.interimResults = true; // Changed to true for better feedback
        recognition.maxAlternatives = 1;
        recognition.continuous = false; // Stop after one phrase

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

        let finalTranscript = '';

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            // Show interim results in input for feedback
            UI.input.value = finalTranscript || interimTranscript;

            if (finalTranscript) {
                // Auto send after a short delay to allow corrections if needed?
                // Or just send immediately. User asked "que se copie el texto".
                // But typically voice assistants send automatically.
                // Let's keep auto-send but make it robust.
                setTimeout(() => handleUserMessage(), 800);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech error:', event.error);
            STATE.isListening = false;
            UI.indicator.classList.add('hidden');
            UI.micBtn.classList.remove('text-red-500', 'animate-pulse');
            
            // Handle specific errors
            if (event.error === 'no-speech') {
                showNotification('No se detectó voz. Intenta de nuevo.', 'info');
            } else if (event.error === 'not-allowed') {
                showNotification('Permiso de micrófono denegado. Revisa tu navegador.', 'error');
            } else if (event.error === 'network') {
                // Improve network error message
                const isLocal = window.location.protocol === 'file:';
                const msg = isLocal 
                    ? 'Error de red: El reconocimiento de voz no funciona en archivos locales (file://). Usa un servidor local.' 
                    : 'Error de red. Verifica tu conexión a internet o el acceso a los servicios de voz de Google.';
                showNotification(msg, 'error');
            } else {
                showNotification(`Error de reconocimiento: ${event.error}`, 'error');
            }
        };

        try {
            recognition.start();
        } catch (e) {
            console.error("Error starting recognition:", e);
            showNotification("No se pudo iniciar el micrófono.", 'error');
        }
    }
});
