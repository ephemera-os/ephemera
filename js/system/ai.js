const EphemeraAI = {
    _legacyCryptoKey: null,
    _cachedModels: null,
    _modelsFetchPromise: null,
    _cachedModelsByProvider: {},
    _modelsFetchPromiseByProvider: {},
    _sessionUsage: null,

    PROVIDERS: {
        openrouter: {
            id: 'openrouter',
            name: 'OpenRouter',
            apiKeySetting: 'openrouterApiKey',
            defaultModel: 'openrouter/free'
        },
        openai: {
            id: 'openai',
            name: 'OpenAI',
            apiKeySetting: 'openaiApiKey',
            defaultModel: 'gpt-4o-mini'
        },
        anthropic: {
            id: 'anthropic',
            name: 'Anthropic',
            apiKeySetting: 'anthropicApiKey',
            defaultModel: 'claude-3-5-haiku-latest'
        },
        google: {
            id: 'google',
            name: 'Google AI',
            apiKeySetting: 'googleApiKey',
            defaultModel: 'gemini-2.0-flash'
        },
        chatgpt: {
            id: 'chatgpt',
            name: 'ChatGPT Plus/Pro',
            apiKeySetting: null,
            defaultModel: 'gpt-4o',
            authType: 'oauth',
            oauthProvider: 'chatgpt'
        }
    },

    USE_CASE_MODEL_KEYS: {
        default: 'aiModel',
        chat: 'aiModelChat',
        code: 'aiModelCode',
        terminal: 'aiModelTerminal',
        quickActions: 'aiModelQuickActions',
        appBuilder: 'aiModelAppBuilder',
        fileSearch: 'aiModelFileSearch'
    },

    DEFAULT_MODELS: {
        openrouter: [
            { id: 'openrouter/free', name: 'Free (Auto)' },
            { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash (OR)' },
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OR)' },
            { id: 'openai/gpt-4o', name: 'GPT-4o (OR)' },
            { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B (OR)' }
        ],
        openai: [
            { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
            { id: 'o3-mini', name: 'o3-mini' }
        ],
        anthropic: [
            { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
            { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-opus-latest', name: 'Claude 3 Opus' }
        ],
        google: [
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
        ],
        chatgpt: [
            { id: 'gpt-4o', name: 'GPT-4o' },
            { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
            { id: 'o3-mini', name: 'o3-mini' }
        ]
    },

    MODEL_PRICING_USD_PER_TOKEN: {
        'openrouter/free': { prompt: 0, completion: 0 },
        'gpt-4o-mini': { prompt: 0.15 / 1000000, completion: 0.6 / 1000000 },
        'gpt-4.1-mini': { prompt: 0.4 / 1000000, completion: 1.6 / 1000000 },
        'o3-mini': { prompt: 1.1 / 1000000, completion: 4.4 / 1000000 },
        'claude-3-5-haiku-latest': { prompt: 0.8 / 1000000, completion: 4.0 / 1000000 },
        'claude-3-5-sonnet-latest': { prompt: 3.0 / 1000000, completion: 15.0 / 1000000 },
        'claude-3-opus-latest': { prompt: 15.0 / 1000000, completion: 75.0 / 1000000 },
        'gemini-2.0-flash': { prompt: 0.35 / 1000000, completion: 0.53 / 1000000 },
        'gemini-1.5-flash': { prompt: 0.35 / 1000000, completion: 0.53 / 1000000 },
        'gemini-1.5-pro': { prompt: 3.5 / 1000000, completion: 10.5 / 1000000 }
    },

    PROVIDER_DEFAULT_PRICING_USD_PER_TOKEN: {
        openrouter: { prompt: 1.5 / 1000000, completion: 3.0 / 1000000 },
        openai: { prompt: 1.0 / 1000000, completion: 3.0 / 1000000 },
        anthropic: { prompt: 3.0 / 1000000, completion: 15.0 / 1000000 },
        google: { prompt: 0.35 / 1000000, completion: 0.53 / 1000000 },
        chatgpt: { prompt: 0, completion: 0 }
    },

    // Rate limiting configuration
    RATE_LIMIT: {
        maxRequestsPerMinute: 10,
        minIntervalMs: 500,
        tokens: 10,
        lastRefill: Date.now(),
        lastRequest: 0
    },

    /**
     * Check if a request can be made, wait if necessary
     * @returns {Promise<void>}
     * @throws {Error} If rate limited and wait would be too long
     */
    async _waitForRateLimit() {
        const now = Date.now();
        const rl = this.RATE_LIMIT;

        // Refill tokens based on time passed (1 token per 6 seconds = 10 per minute)
        const timePassed = now - rl.lastRefill;
        const tokensToAdd = Math.floor(timePassed / 6000); // 6000ms = 6 seconds per token
        if (tokensToAdd > 0) {
            rl.tokens = Math.min(rl.maxRequestsPerMinute, rl.tokens + tokensToAdd);
            rl.lastRefill = now;
        }

        // Check minimum interval between requests
        const timeSinceLastRequest = now - rl.lastRequest;
        if (timeSinceLastRequest < rl.minIntervalMs) {
            await new Promise(r => setTimeout(r, rl.minIntervalMs - timeSinceLastRequest));
        }

        // Check if we have tokens available
        if (rl.tokens <= 0) {
            const waitTime = 6000 - (now - rl.lastRefill);
            if (waitTime > 0) {
                throw new Error(`Rate limited. Please wait ${Math.ceil(waitTime / 1000)} seconds before sending another message.`);
            }
        }

        // Consume a token
        rl.tokens = Math.max(0, rl.tokens - 1);
        rl.lastRequest = Date.now();
    },

    /**
     * Get current rate limit status
     * @returns {object} Rate limit info
     */
    getRateLimitStatus() {
        const now = Date.now();
        const rl = this.RATE_LIMIT;

        // Refill tokens
        const timePassed = now - rl.lastRefill;
        const tokensToAdd = Math.floor(timePassed / 6000);
        const currentTokens = Math.min(rl.maxRequestsPerMinute, rl.tokens + tokensToAdd);

        const timeSinceLastRequest = now - rl.lastRequest;
        const canRequest = currentTokens > 0 && timeSinceLastRequest >= rl.minIntervalMs;
        const waitTime = canRequest ? 0 : Math.max(
            rl.minIntervalMs - timeSinceLastRequest,
            currentTokens <= 0 ? (6000 - (now - rl.lastRefill)) : 0
        );

        return {
            tokensRemaining: currentTokens,
            maxTokens: rl.maxRequestsPerMinute,
            canRequest,
            waitTimeMs: waitTime
        };
    },

    _getSettings() {
        return window.EphemeraState?.settings || {};
    },

    _normalizeProvider(provider) {
        const normalized = String(provider || '').trim().toLowerCase();
        return this.PROVIDERS[normalized] ? normalized : 'openrouter';
    },

    _getProviderConfig(provider = null) {
        const id = this._normalizeProvider(provider || this.getProvider());
        return this.PROVIDERS[id];
    },

    _normalizeUseCase(useCase) {
        const normalized = String(useCase || 'default').trim();
        return this.USE_CASE_MODEL_KEYS[normalized] ? normalized : 'default';
    },

    getAvailableProviders() {
        return Object.values(this.PROVIDERS).map(({ id, name }) => ({ id, name }));
    },

    getProvider() {
        return this._normalizeProvider(this._getSettings().aiProvider || 'openrouter');
    },

    setProvider(provider) {
        if (!window.EphemeraState) return;
        const normalized = this._normalizeProvider(provider);
        window.EphemeraState.updateSetting('aiProvider', normalized);
    },

    _providerDisplayName(provider) {
        return this._getProviderConfig(provider).name;
    },

    async _getEncryptionKey() {
        if (window.EphemeraSession && window.EphemeraSession.isUnlocked()) {
            return window.EphemeraSession.getMasterKey();
        }
        
        if (window.EphemeraCrypto) {
            return null;
        }
        
        return this._getLegacyCryptoKey();
    },

    async _getLegacyCryptoKey() {
        if (this._legacyCryptoKey) return this._legacyCryptoKey;
        const material = new TextEncoder().encode(window.location.origin + navigator.userAgent.slice(0, 32));
        const hash = await crypto.subtle.digest('SHA-256', material);
        this._legacyCryptoKey = await crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
        return this._legacyCryptoKey;
    },

    async encryptKey(plaintext) {
        if (!plaintext) return '';
        
        if (window.EphemeraCrypto) {
            const key = await this._getEncryptionKey();
            if (key) {
                return await window.EphemeraCrypto.encrypt(plaintext, key);
            }
        }
        
        return this._encryptKeyLegacy(plaintext);
    },

    async _encryptKeyLegacy(plaintext) {
        try {
            const key = await this._getLegacyCryptoKey();
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encoded = new TextEncoder().encode(plaintext);
            const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
            const combined = new Uint8Array(iv.length + ciphertext.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(ciphertext), iv.length);
            return 'enc:' + btoa(String.fromCharCode(...combined));
        } catch {
            return plaintext;
        }
    },

    async decryptKey(stored) {
        if (!stored) return '';
        if (!stored.startsWith('enc:')) return stored;
        
        if (window.EphemeraCrypto) {
            const key = await this._getEncryptionKey();
            if (key) {
                const decrypted = await window.EphemeraCrypto.decrypt(stored, key);
                if (decrypted !== null) {
                    return decrypted;
                }
            }
        }
        
        return this._decryptKeyLegacy(stored);
    },

    async _decryptKeyLegacy(stored) {
        try {
            const key = await this._getLegacyCryptoKey();
            const data = Uint8Array.from(atob(stored.slice(4)), c => c.charCodeAt(0));
            const iv = data.slice(0, 12);
            const ciphertext = data.slice(12);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
            return new TextDecoder().decode(decrypted);
        } catch {
            return '';
        }
    },

    async migrateKeyIfNeeded() {
        if (!window.EphemeraState) return;
        for (const cfg of Object.values(this.PROVIDERS)) {
            if (cfg.authType === 'oauth') continue;
            const settingKey = cfg.apiKeySetting;
            const raw = String(this._getSettings()[settingKey] || '');
            if (!raw || raw.startsWith('enc:')) continue;
            const encrypted = await this.encryptKey(raw);
            window.EphemeraState.updateSetting(settingKey, encrypted);
        }
    },

    _getApiKeySetting(provider = null) {
        return this._getProviderConfig(provider).apiKeySetting;
    },

    async getApiKey(provider = null) {
        const cfg = this._getProviderConfig(provider);
        if (cfg.authType === 'oauth') {
            return window.EphemeraAIOAuth?.getAccessToken?.(cfg.oauthProvider) || '';
        }
        const settingKey = this._getApiKeySetting(provider);
        const stored = String(this._getSettings()[settingKey] || '');
        return await this.decryptKey(stored);
    },

    async setApiKey(key, provider = null) {
        const targetProvider = this._normalizeProvider(provider || this.getProvider());
        const cfg = this._getProviderConfig(targetProvider);
        if (cfg.authType === 'oauth') return;
        const settingKey = this._getApiKeySetting(targetProvider);
        const encrypted = await this.encryptKey(String(key || '').trim());
        if (window.EphemeraState) {
            window.EphemeraState.updateSetting(settingKey, encrypted);
        }

        if (window.EphemeraTelemetry) {
            window.EphemeraTelemetry.addBreadcrumb({
                category: 'settings',
                message: `API key updated for ${targetProvider}`,
                level: 'info'
            });
        }
    },

    async isConfigured(provider = null) {
        const cfg = this._getProviderConfig(provider);
        if (cfg.authType === 'oauth') {
            const oauth = window.EphemeraAIOAuth;
            if (typeof oauth?.getAccessToken === 'function') {
                const token = await oauth.getAccessToken(cfg.oauthProvider);
                return Boolean(token);
            }
            return oauth?.isConnected?.(cfg.oauthProvider) || false;
        }
        const key = await this.getApiKey(provider);
        return !!key;
    },

    _sanitizeModelForProvider(provider, model) {
        const target = this._normalizeProvider(provider);
        const defaultModel = this.PROVIDERS[target].defaultModel;
        const raw = String(model || '').trim();
        if (!raw) return defaultModel;

        if (target === 'openrouter') {
            if (raw.toLowerCase().startsWith('openrouter:')) {
                return raw.slice('openrouter:'.length).trim() || defaultModel;
            }
            return raw;
        }

        if (raw.includes(':')) {
            const [prefix, ...rest] = raw.split(':');
            if (this.PROVIDERS[prefix.toLowerCase()]) {
                if (prefix.toLowerCase() !== target) return defaultModel;
                return rest.join(':').trim() || defaultModel;
            }
        }

        const slashPrefix = `${target}/`;
        if (raw.toLowerCase().startsWith(slashPrefix)) {
            return raw.slice(slashPrefix.length).trim() || defaultModel;
        }

        if (raw.includes('/')) {
            return defaultModel;
        }

        return raw;
    },

    getDefaultModel(provider = null) {
        const targetProvider = this._normalizeProvider(provider || this.getProvider());
        const configured = String(this._getSettings().aiModel || '').trim();
        return this._sanitizeModelForProvider(targetProvider, configured);
    },

    setDefaultModel(model) {
        if (window.EphemeraState) {
            window.EphemeraState.updateSetting('aiModel', model);
        }
    },

    getModelForUseCase(useCase = 'default', provider = null) {
        const targetProvider = this._normalizeProvider(provider || this.getProvider());
        const normalizedUseCase = this._normalizeUseCase(useCase);
        const settingKey = this.USE_CASE_MODEL_KEYS[normalizedUseCase];
        const configured = String(this._getSettings()[settingKey] || '').trim();
        if (configured) {
            return this._sanitizeModelForProvider(targetProvider, configured);
        }
        return this.getDefaultModel(targetProvider);
    },

    setModelForUseCase(useCase, model) {
        if (!window.EphemeraState) return;
        const normalizedUseCase = this._normalizeUseCase(useCase);
        const settingKey = this.USE_CASE_MODEL_KEYS[normalizedUseCase];
        window.EphemeraState.updateSetting(settingKey, String(model || '').trim());
    },

    _resolveRequestProviderAndModel(model, options = {}) {
        const useCase = this._normalizeUseCase(options.useCase || 'default');
        let provider = this._normalizeProvider(options.provider || this.getProvider());
        let resolvedModel = String(model || '').trim();

        if (!resolvedModel) {
            resolvedModel = this.getModelForUseCase(useCase, provider);
        }

        if (resolvedModel.includes(':')) {
            const [prefix, ...rest] = resolvedModel.split(':');
            const lower = prefix.toLowerCase();
            if (this.PROVIDERS[lower]) {
                provider = lower;
                resolvedModel = rest.join(':').trim();
            }
        }

        resolvedModel = this._sanitizeModelForProvider(provider, resolvedModel);
        return { provider, model: resolvedModel, useCase };
    },

    getMaxTokens() {
        return window.EphemeraState?.settings?.aiMaxTokens || 8192;
    },

    setMaxTokens(tokens) {
        if (window.EphemeraState) {
            window.EphemeraState.updateSetting('aiMaxTokens', Math.max(100, Math.min(128000, tokens)));
        }
    },

    getTemperature() {
        return window.EphemeraState?.settings?.aiTemperature ?? 0.7;
    },

    setTemperature(temp) {
        if (window.EphemeraState) {
            window.EphemeraState.updateSetting('aiTemperature', Math.max(0, Math.min(2, temp)));
        }
    },

    async getModels(forceRefresh = false, provider = null) {
        const targetProvider = this._normalizeProvider(provider || this.getProvider());
        if (this._cachedModelsByProvider[targetProvider] && !forceRefresh) {
            return this._cachedModelsByProvider[targetProvider];
        }

        if (this._modelsFetchPromiseByProvider[targetProvider]) {
            return this._modelsFetchPromiseByProvider[targetProvider];
        }

        this._modelsFetchPromiseByProvider[targetProvider] = this._fetchModels(targetProvider);
        try {
            return await this._modelsFetchPromiseByProvider[targetProvider];
        } finally {
            this._modelsFetchPromiseByProvider[targetProvider] = null;
        }
    },

    async _fetchModels(provider = null) {
        const targetProvider = this._normalizeProvider(provider || this.getProvider());
        const apiKey = await this.getApiKey(targetProvider);
        if (!apiKey) return [];

        try {
            let models = [];

            if (targetProvider === 'openrouter') {
                const response = await fetch('https://openrouter.ai/api/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                if (!response.ok) throw new Error(`Failed to fetch models (${response.status})`);
                const data = await response.json();
                models = (data.data || []).map(m => ({
                    id: m.id,
                    name: m.name || m.id,
                    context: m.context_length
                }));
            } else if (targetProvider === 'openai' || targetProvider === 'chatgpt') {
                const response = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                if (!response.ok) throw new Error(`Failed to fetch models (${response.status})`);
                const data = await response.json();
                models = (data.data || [])
                    .filter(m => typeof m?.id === 'string' && (m.id.startsWith('gpt-') || m.id.startsWith('o')))
                    .map(m => ({ id: m.id, name: m.id }));
            } else if (targetProvider === 'anthropic') {
                const response = await fetch('https://api.anthropic.com/v1/models', {
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    }
                });
                if (!response.ok) throw new Error(`Failed to fetch models (${response.status})`);
                const data = await response.json();
                models = (data.data || []).map(m => ({
                    id: m.id,
                    name: m.display_name || m.id
                }));
            } else if (targetProvider === 'google') {
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
                const response = await fetch(endpoint);
                if (!response.ok) throw new Error(`Failed to fetch models (${response.status})`);
                const data = await response.json();
                models = (data.models || [])
                    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
                    .map(m => {
                        const rawName = String(m.name || '');
                        const id = rawName.startsWith('models/') ? rawName.slice('models/'.length) : rawName;
                        return {
                            id,
                            name: m.displayName || id,
                            context: m.inputTokenLimit
                        };
                    });
            }

            const sorted = models
                .filter(m => typeof m?.id === 'string' && m.id)
                .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
            this._cachedModelsByProvider[targetProvider] = sorted;
            this._cachedModels = sorted;
            return sorted;
        } catch (e) {
            console.error('[EphemeraAI] Failed to fetch models:', e);

            if (window.EphemeraTelemetry) {
                window.EphemeraTelemetry.captureException(e, {
                    tags: { component: 'ai' },
                    extra: { operation: 'getModels', provider: targetProvider }
                });
            }

            return this._cachedModelsByProvider[targetProvider] || [];
        }
    },

    getDefaultModels(provider = null) {
        const targetProvider = this._normalizeProvider(provider || this.getProvider());
        return this.DEFAULT_MODELS[targetProvider] ? [...this.DEFAULT_MODELS[targetProvider]] : [];
    },

    async populateModelSelect(selectElement, selectedModel = null, options = {}) {
        if (!selectElement) return;

        const targetProvider = this._normalizeProvider(options.provider || this.getProvider());
        const useCase = this._normalizeUseCase(options.useCase || 'default');
        const currentSelection = String(selectedModel || this.getModelForUseCase(useCase, targetProvider) || '').trim();
        let models = [];

        try {
            models = await this.getModels(Boolean(options.forceRefresh), targetProvider);
        } catch {
            models = [];
        }

        if (models.length === 0) {
            models = this.getDefaultModels(targetProvider);
        }

        selectElement.innerHTML = models.map(m => {
            const safeId = EphemeraSanitize.escapeAttr(m.id);
            const safeName = EphemeraSanitize.escapeHtml(m.name || m.id);
            return `<option value="${safeId}" ${m.id === currentSelection ? 'selected' : ''}>${safeName}</option>`;
        }).join('');

        if (currentSelection && !selectElement.querySelector(`option[value="${currentSelection}"]`)) {
            const option = document.createElement('option');
            option.value = currentSelection;
            option.textContent = currentSelection.split('/').pop();
            option.selected = true;
            selectElement.insertBefore(option, selectElement.firstChild);
        }

        if (currentSelection) {
            selectElement.value = currentSelection;
        }
    },

    clearModelCache(provider = null) {
        if (provider) {
            const targetProvider = this._normalizeProvider(provider);
            this._cachedModelsByProvider[targetProvider] = null;
            return;
        }
        this._cachedModels = null;
        this._cachedModelsByProvider = {};
    },

    _messageContentToText(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content.map(part => {
                if (typeof part === 'string') return part;
                if (part && typeof part === 'object') {
                    if (typeof part.text === 'string') return part.text;
                    if (typeof part.content === 'string') return part.content;
                }
                return '';
            }).filter(Boolean).join('\n');
        }
        if (content && typeof content === 'object') {
            if (typeof content.text === 'string') return content.text;
            if (typeof content.content === 'string') return content.content;
        }
        return String(content || '');
    },

    _normalizeMessages(messages = []) {
        if (!Array.isArray(messages)) return [];
        return messages
            .filter(row => row && typeof row === 'object')
            .map(row => {
                const rawRole = String(row.role || 'user').trim().toLowerCase();
                const role = ['system', 'user', 'assistant'].includes(rawRole) ? rawRole : 'user';
                return {
                    role,
                    content: this._messageContentToText(row.content)
                };
            })
            .filter(row => row.content.length > 0);
    },

    _providerSupportsNativeStreaming(provider) {
        const target = this._normalizeProvider(provider);
        return target === 'openrouter' || target === 'openai' || target === 'chatgpt';
    },

    _buildOpenAICompatibleRequestBody(model, messages, stream) {
        return {
            model,
            messages,
            stream,
            max_tokens: this.getMaxTokens(),
            temperature: this.getTemperature()
        };
    },

    _buildAnthropicRequestBody(model, messages) {
        const system = messages
            .filter(m => m.role === 'system')
            .map(m => m.content)
            .filter(Boolean)
            .join('\n\n')
            .trim();

        const promptMessages = messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({
                role: m.role,
                content: [{ type: 'text', text: m.content }]
            }));

        if (promptMessages.length === 0) {
            promptMessages.push({
                role: 'user',
                content: [{ type: 'text', text: 'Hello' }]
            });
        }

        const body = {
            model,
            max_tokens: this.getMaxTokens(),
            temperature: this.getTemperature(),
            messages: promptMessages
        };
        if (system) body.system = system;
        return body;
    },

    _buildGoogleRequestBody(messages) {
        const systemInstruction = messages
            .filter(m => m.role === 'system')
            .map(m => m.content)
            .filter(Boolean)
            .join('\n\n')
            .trim();

        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

        if (contents.length === 0) {
            contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
        }

        const body = {
            contents,
            generationConfig: {
                temperature: this.getTemperature(),
                maxOutputTokens: this.getMaxTokens()
            }
        };

        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        return body;
    },

    _buildProviderRequest(provider, apiKey, model, messages, stream) {
        const targetProvider = this._normalizeProvider(provider);

        if (targetProvider === 'openrouter') {
            return {
                url: 'https://openrouter.ai/api/v1/chat/completions',
                options: {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': window.location.origin,
                        'X-Title': 'Ephemera'
                    },
                    body: JSON.stringify(this._buildOpenAICompatibleRequestBody(model, messages, stream))
                },
                nativeStream: stream
            };
        }

        if (targetProvider === 'openai' || targetProvider === 'chatgpt') {
            return {
                url: 'https://api.openai.com/v1/chat/completions',
                options: {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this._buildOpenAICompatibleRequestBody(model, messages, stream))
                },
                nativeStream: stream
            };
        }

        if (targetProvider === 'anthropic') {
            return {
                url: 'https://api.anthropic.com/v1/messages',
                options: {
                    method: 'POST',
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this._buildAnthropicRequestBody(model, messages))
                },
                nativeStream: false
            };
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        return {
            url,
            options: {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this._buildGoogleRequestBody(messages))
            },
            nativeStream: false
        };
    },

    _extractTextFromOpenAIContent(content) {
        return this._messageContentToText(content);
    },

    _extractContentFromResponse(provider, payload) {
        const targetProvider = this._normalizeProvider(provider);
        if (!payload || typeof payload !== 'object') return '';

        if (targetProvider === 'openrouter' || targetProvider === 'openai' || targetProvider === 'chatgpt') {
            const content = payload.choices?.[0]?.message?.content;
            return this._extractTextFromOpenAIContent(content);
        }

        if (targetProvider === 'anthropic') {
            if (Array.isArray(payload.content)) {
                return payload.content
                    .map(part => (part?.type === 'text' ? String(part?.text || '') : ''))
                    .filter(Boolean)
                    .join('');
            }
            return String(payload.output_text || '');
        }

        const parts = payload.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
            return parts.map(p => String(p?.text || '')).filter(Boolean).join('');
        }
        return String(payload.text || '');
    },

    _extractErrorMessageFromPayload(payload, status) {
        if (!payload || typeof payload !== 'object') {
            return `API Error: ${status}`;
        }

        return String(
            payload.error?.message
            || payload.error?.details
            || payload.message
            || payload.details
            || `API Error: ${status}`
        );
    },

    _extractUsageFromResponse(provider, payload) {
        const targetProvider = this._normalizeProvider(provider);
        if (!payload || typeof payload !== 'object') {
            return {};
        }

        if (targetProvider === 'openrouter' || targetProvider === 'openai' || targetProvider === 'chatgpt') {
            return {
                promptTokens: Number(payload.usage?.prompt_tokens || 0),
                completionTokens: Number(payload.usage?.completion_tokens || 0),
                totalTokens: Number(payload.usage?.total_tokens || 0),
                costUsd: Number(payload.usage?.cost || payload.usage?.total_cost || payload.cost || 0)
            };
        }

        if (targetProvider === 'anthropic') {
            const usage = payload.usage || {};
            return {
                promptTokens: Number(usage.input_tokens || 0),
                completionTokens: Number(usage.output_tokens || 0),
                totalTokens: Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0),
                costUsd: Number(payload.cost || 0)
            };
        }

        const usageMetadata = payload.usageMetadata || {};
        return {
            promptTokens: Number(usageMetadata.promptTokenCount || 0),
            completionTokens: Number(usageMetadata.candidatesTokenCount || 0),
            totalTokens: Number(usageMetadata.totalTokenCount || 0),
            costUsd: Number(payload.cost || 0)
        };
    },

    _estimateTokens(text) {
        const normalized = String(text || '');
        if (!normalized) return 0;
        return Math.max(1, Math.ceil(normalized.length / 4));
    },

    _estimateRequestTokens(messages) {
        if (!Array.isArray(messages)) return 0;
        return messages.reduce((sum, row) => sum + this._estimateTokens(row?.content), 0);
    },

    _getPricingForModel(provider, model) {
        const normalizedModel = String(model || '').trim().toLowerCase();
        if (this.MODEL_PRICING_USD_PER_TOKEN[normalizedModel]) {
            return this.MODEL_PRICING_USD_PER_TOKEN[normalizedModel];
        }
        return this.PROVIDER_DEFAULT_PRICING_USD_PER_TOKEN[this._normalizeProvider(provider)] || { prompt: 0, completion: 0 };
    },

    _estimateCostUsd(provider, model, promptTokens, completionTokens, explicitCost = 0) {
        if (Number.isFinite(Number(explicitCost)) && Number(explicitCost) > 0) {
            return Number(explicitCost);
        }
        const pricing = this._getPricingForModel(provider, model);
        return (Number(promptTokens) * pricing.prompt) + (Number(completionTokens) * pricing.completion);
    },

    _createEmptySessionUsage() {
        return {
            startedAt: Date.now(),
            updatedAt: Date.now(),
            requests: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            estimatedCostUsd: 0,
            byProvider: {}
        };
    },

    _getOrCreateSessionUsage() {
        if (!this._sessionUsage) {
            this._sessionUsage = this._createEmptySessionUsage();
        }
        return this._sessionUsage;
    },

    _recordUsage(provider, model, messages, completionText, usage = {}) {
        const promptTokens = Number(usage.promptTokens) > 0
            ? Number(usage.promptTokens)
            : this._estimateRequestTokens(messages);
        const completionTokens = Number(usage.completionTokens) > 0
            ? Number(usage.completionTokens)
            : this._estimateTokens(completionText);
        const totalTokens = Number(usage.totalTokens) > 0
            ? Number(usage.totalTokens)
            : (promptTokens + completionTokens);
        const costUsd = this._estimateCostUsd(provider, model, promptTokens, completionTokens, usage.costUsd);

        const state = this._getOrCreateSessionUsage();
        state.requests += 1;
        state.promptTokens += promptTokens;
        state.completionTokens += completionTokens;
        state.totalTokens += totalTokens;
        state.estimatedCostUsd += costUsd;
        state.updatedAt = Date.now();

        const targetProvider = this._normalizeProvider(provider);
        if (!state.byProvider[targetProvider]) {
            state.byProvider[targetProvider] = {
                requests: 0,
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                estimatedCostUsd: 0
            };
        }

        const bucket = state.byProvider[targetProvider];
        bucket.requests += 1;
        bucket.promptTokens += promptTokens;
        bucket.completionTokens += completionTokens;
        bucket.totalTokens += totalTokens;
        bucket.estimatedCostUsd += costUsd;
    },

    getSessionUsage() {
        const usage = this._getOrCreateSessionUsage();
        return {
            ...usage,
            estimatedCostUsd: Number(usage.estimatedCostUsd.toFixed(6)),
            byProvider: Object.fromEntries(
                Object.entries(usage.byProvider).map(([provider, row]) => [
                    provider,
                    { ...row, estimatedCostUsd: Number(row.estimatedCostUsd.toFixed(6)) }
                ])
            )
        };
    },

    resetSessionUsage() {
        this._sessionUsage = this._createEmptySessionUsage();
        return this.getSessionUsage();
    },

    async chat(messages, model, onStream, options = {}) {
        if (onStream && typeof onStream === 'object') {
            options = onStream;
            onStream = null;
        }

        // Check rate limiting unless explicitly bypassed
        if (!options?.bypassRateLimit) {
            await this._waitForRateLimit();
        }

        const normalizedMessages = this._normalizeMessages(messages);
        const { provider, model: resolvedModel } = this._resolveRequestProviderAndModel(model, options || {});
        const apiKey = await this.getApiKey(provider);
        if (!apiKey) {
            const cfg = this._getProviderConfig(provider);
            const hint = cfg.authType === 'oauth'
                ? `${this._providerDisplayName(provider)} is not connected. Please log in via Settings.`
                : `${this._providerDisplayName(provider)} API key not configured. Please add it in Settings.`;
            throw new Error(hint);
        }

        const wantsStream = typeof onStream === 'function';
        const nativeStream = wantsStream && this._providerSupportsNativeStreaming(provider);
        const request = this._buildProviderRequest(provider, apiKey, resolvedModel, normalizedMessages, nativeStream);
        if (options?.signal) request.options.signal = options.signal;
        const aiResponseSpan = window.EphemeraPerformance?.start?.('ai.response_ms', {
            provider,
            model: resolvedModel,
            stream: nativeStream
        });
        let aiResponseStatus = 'error';

        if (window.EphemeraTelemetry) {
            window.EphemeraTelemetry.addBreadcrumb({
                category: 'ai',
                message: `Sending request to ${provider}:${resolvedModel}`,
                level: 'info',
                data: { maxTokens: this.getMaxTokens(), stream: nativeStream, provider }
            });
        }

        try {
            const response = await fetch(request.url, request.options);

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                const errorMessage = this._extractErrorMessageFromPayload(errorPayload, response.status);

                if (window.EphemeraTelemetry) {
                    window.EphemeraTelemetry.captureMessage(`AI API error: ${errorMessage}`, 'error', {
                        extra: { status: response.status, model: resolvedModel, provider }
                    });
                }

                throw new Error(errorMessage);
            }

            if (nativeStream) {
                let streamUsage = {};
                const full = await this.handleStream(response, onStream, options?.signal, (usage) => {
                    streamUsage = {
                        promptTokens: Number(usage?.prompt_tokens || usage?.promptTokens || 0),
                        completionTokens: Number(usage?.completion_tokens || usage?.completionTokens || 0),
                        totalTokens: Number(usage?.total_tokens || usage?.totalTokens || 0),
                        costUsd: Number(usage?.cost || usage?.total_cost || usage?.costUsd || 0)
                    };
                });
                this._recordUsage(provider, resolvedModel, normalizedMessages, full, streamUsage);
                aiResponseStatus = 'ok';
                return full;
            }

            const payload = await response.json().catch(() => ({}));
            const content = this._extractContentFromResponse(provider, payload);
            if (wantsStream) {
                onStream(content, content);
            }
            const usage = this._extractUsageFromResponse(provider, payload);
            this._recordUsage(provider, resolvedModel, normalizedMessages, content, usage);
            aiResponseStatus = 'ok';
            return content;
        } catch (e) {
            if (e.name === 'AbortError') {
                aiResponseStatus = 'aborted';
                throw e;
            }
            if (window.EphemeraTelemetry) {
                window.EphemeraTelemetry.captureException(e, {
                    tags: { component: 'ai' },
                    extra: { model: resolvedModel, provider }
                });
            }
            throw e;
        } finally {
            window.EphemeraPerformance?.end?.(aiResponseSpan, {
                provider,
                model: resolvedModel,
                stream: nativeStream,
                status: aiResponseStatus
            });
        }
    },

    async handleStream(response, onStream, signal, onUsage = null) {
        if (!response?.body) return '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let fallbackBuffer = '';
        const streamWorker = window.EphemeraAIStreamWorker;
        let workerSessionId = null;
        let useWorker = Boolean(
            streamWorker?.createSession
            && streamWorker?.parseChunk
            && streamWorker?.flushSession
            && streamWorker?.closeSession
        );

        if (useWorker) {
            try {
                workerSessionId = streamWorker.createSession();
            } catch (_error) {
                useWorker = false;
            }
        }

        const applyEvents = (events) => {
            if (!Array.isArray(events) || events.length === 0) return;

            events.forEach((event) => {
                if (!event || typeof event !== 'object') return;

                if (event.type === 'usage') {
                    if (onUsage && event.usage && typeof event.usage === 'object') {
                        onUsage(event.usage);
                    }
                    return;
                }

                if (event.type === 'content') {
                    const chunk = String(event.content || '');
                    if (!chunk) return;
                    fullContent += chunk;
                    onStream(chunk, fullContent);
                }
            });
        };

        const parseMainThreadChunk = (chunk, flush = false) => {
            const combined = fallbackBuffer + String(chunk || '');
            const lines = combined.split('\n');
            fallbackBuffer = flush ? '' : (lines.pop() || '');
            const events = [];

            const consumeLine = (line) => {
                const trimmed = String(line || '').trim();
                if (!trimmed || !trimmed.startsWith('data:')) return;
                const data = trimmed.slice('data:'.length).trimStart();
                if (!data || data === '[DONE]') return;

                try {
                    const parsed = JSON.parse(data);
                    if (parsed?.usage && onUsage) {
                        onUsage(parsed.usage);
                    }
                    const content = this._extractTextFromOpenAIContent(parsed?.choices?.[0]?.delta?.content);
                    if (content) {
                        events.push({
                            type: 'content',
                            content
                        });
                    }
                } catch (_e) {
                    // Ignore malformed SSE chunks.
                }
            };

            lines.forEach((line) => consumeLine(line));
            applyEvents(events);
        };

        try {
            for (;;) {
                if (signal?.aborted) break;
                const { done, value } = await reader.read();
                if (done) break;

                const textChunk = decoder.decode(value, { stream: true });
                if (!textChunk) continue;

                if (useWorker && workerSessionId) {
                    try {
                        const events = await streamWorker.parseChunk(workerSessionId, textChunk);
                        applyEvents(events);
                        continue;
                    } catch (_error) {
                        useWorker = false;
                    }
                }

                parseMainThreadChunk(textChunk, false);
            }

            const trailing = decoder.decode();
            if (useWorker && workerSessionId) {
                try {
                    if (trailing) {
                        const trailingEvents = await streamWorker.parseChunk(workerSessionId, trailing);
                        applyEvents(trailingEvents);
                    }
                    const finalEvents = await streamWorker.flushSession(workerSessionId);
                    applyEvents(finalEvents);
                } catch (_error) {
                    useWorker = false;
                    if (trailing) {
                        parseMainThreadChunk(trailing, false);
                    }
                    parseMainThreadChunk('', true);
                }
            } else {
                if (trailing) {
                    parseMainThreadChunk(trailing, false);
                }
                parseMainThreadChunk('', true);
            }
        } catch (e) {
            if (e.name === 'AbortError' || signal?.aborted) {
                return fullContent;
            }
            console.error('[EphemeraAI] Stream error:', e);

            if (window.EphemeraTelemetry) {
                window.EphemeraTelemetry.captureException(e, {
                    tags: { component: 'ai' },
                    extra: { operation: 'handleStream' }
                });
            }

            throw e;
        } finally {
            if (workerSessionId && streamWorker?.closeSession) {
                try {
                    await streamWorker.closeSession(workerSessionId);
                } catch (_error) {
                    // Ignore worker close failures.
                }
            }
        }

        return fullContent;
    },

    async complete(prompt, model) {
        return this.chat([{ role: 'user', content: prompt }], model);
    },

    buildCodePrompt(context, request) {
        return `You are an AI assistant helping a user build an app in Ephemera, a browser-based operating system.

## Ephemera App Development Context

Apps are JavaScript applications that run in a sandbox with access to:
- \`container\` - DOM element to render UI
- \`manifest\` - App configuration from app.json
- \`windowId\` - Unique window ID
- \`EphemeraFS\` - File system API (readFile, writeFile, mkdir, readdir, delete)
- \`EphemeraNetwork\` - Network API (fetch, get, post)
- \`EphemeraEvents\` - Event system (on, emit)
- \`EphemeraWM\` - Window manager (open, close windows)

## Current Context
${context}

## User Request
${request}

## Instructions
Provide helpful code or explanations. If generating code, make it complete and ready to use.
Use inline styles since external CSS is not available. Keep code concise and functional.`;
    },

    async helpWithCode(code, request, model, onStream) {
        const messages = [
            {
                role: 'system',
                content: `You are a helpful coding assistant for Ephemera, a browser-based operating system.
Help users write, debug, and improve their JavaScript code.
Keep responses concise and practical. Use markdown for formatting.
When providing code, use \`\`\`javascript code blocks.`
            },
            {
                role: 'user',
                content: this.buildCodePrompt(
                    code ? `Current code:\n\`\`\`javascript\n${code}\n\`\`\`` : 'No code yet - starting fresh.',
                    request
                )
            }
        ];

        const targetModel = model || this.getModelForUseCase('code');
        return this.chat(messages, targetModel, onStream, { useCase: 'code' });
    },

    _normalizeSingleCommandLine(text) {
        const raw = String(text || '').trim();
        if (!raw) return '';

        let line = raw
            .replace(/^```[\w-]*\s*/i, '')
            .replace(/```$/g, '')
            .trim()
            .split('\n')
            .map((row) => row.trim())
            .find(Boolean) || '';

        line = line.replace(/^command:\s*/i, '').trim();
        line = line.replace(/^`|`$/g, '').trim();
        return line;
    },

    async suggestTerminalCommand(request, context = {}) {
        const task = String(request || '').trim();
        if (!task) return '';

        const cwd = String(context.cwd || '/home/user');
        const homeDir = String(context.homeDir || '/home/user');

        const messages = [
            {
                role: 'system',
                content: [
                    'You convert natural language into one Ephemera terminal command.',
                    'Return exactly one command line and nothing else.',
                    'Do not use markdown fences.',
                    'Available commands: help, clear, pwd, cd, ls, cat, mkdir, touch, rm, cp, mv, echo, date, whoami, neofetch, curl, run, app, calc, proxy.',
                    'No pipes, no shell operators, no unsupported commands.'
                ].join(' ')
            },
            {
                role: 'user',
                content: [
                    `Current directory: ${cwd}`,
                    `Home directory: ${homeDir}`,
                    `Task: ${task}`
                ].join('\n')
            }
        ];

        const response = await this.chat(messages, this.getModelForUseCase('terminal'), null, { useCase: 'terminal' });
        return this._normalizeSingleCommandLine(response);
    },

    async explainTerminalExecution(execution = {}) {
        const payload = {
            rawCommand: String(execution.rawCommand || ''),
            cwdBefore: String(execution.cwdBefore || ''),
            cwdAfter: String(execution.cwdAfter || ''),
            success: Boolean(execution.success),
            output: String(execution.output || ''),
            error: String(execution.error || '')
        };

        const messages = [
            {
                role: 'system',
                content: [
                    'You are a shell tutor for Ephemera terminal users.',
                    'Explain what the command did in concise language.',
                    'If it failed, explain likely cause and a practical next command.',
                    'Use short bullets where useful.'
                ].join(' ')
            },
            {
                role: 'user',
                content: JSON.stringify(payload, null, 2)
            }
        ];

        return this.chat(messages, this.getModelForUseCase('terminal'), null, { useCase: 'terminal' });
    },

    async diagnoseTerminalError(execution = {}) {
        const payload = {
            rawCommand: String(execution.rawCommand || ''),
            cwdBefore: String(execution.cwdBefore || ''),
            cwdAfter: String(execution.cwdAfter || ''),
            output: String(execution.output || ''),
            error: String(execution.error || '')
        };

        const messages = [
            {
                role: 'system',
                content: [
                    'You diagnose Ephemera terminal command failures.',
                    'Return concise output with:',
                    '1) likely cause,',
                    '2) one or two concrete fixes,',
                    '3) an example command the user can run next.'
                ].join(' ')
            },
            {
                role: 'user',
                content: JSON.stringify(payload, null, 2)
            }
        ];

        return this.chat(messages, this.getModelForUseCase('terminal'), null, { useCase: 'terminal' });
    },

    _extractJsonObject(text) {
        const raw = String(text || '').trim();
        if (!raw) return null;

        const unwrapped = raw
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/```$/g, '')
            .trim();

        try {
            return JSON.parse(unwrapped);
        } catch (_e) {
            // Fall through to best-effort object extraction.
        }

        const start = unwrapped.indexOf('{');
        const end = unwrapped.lastIndexOf('}');
        if (start === -1 || end <= start) return null;

        try {
            return JSON.parse(unwrapped.slice(start, end + 1));
        } catch (_e) {
            return null;
        }
    },

    async rankFileSearchCandidates(query, candidates = []) {
        const request = String(query || '').trim();
        if (!request || !Array.isArray(candidates) || candidates.length === 0) return [];

        const limited = candidates.slice(0, 16).map((candidate, index) => {
            const rawId = Number(candidate?.id);
            return {
                id: Number.isFinite(rawId) ? rawId : index,
                candidate
            };
        });

        const payload = limited.map(({ id, candidate }) => ({
            id,
            path: String(candidate?.path || ''),
            modifiedAt: Number(candidate?.modifiedAt || 0),
            extension: String(candidate?.extension || ''),
            snippet: String(candidate?.snippet || '').slice(0, 400)
        }));

        const messages = [
            {
                role: 'system',
                content: [
                    'You rerank file search results for Ephemera.',
                    'Prioritize semantic relevance to the user query.',
                    'Return strict JSON only in this format:',
                    '{"ranked":[{"id":number,"score":number,"reason":"short text"}]}.',
                    'Scores are between 0 and 1.'
                ].join(' ')
            },
            {
                role: 'user',
                content: JSON.stringify({ query: request, candidates: payload }, null, 2)
            }
        ];

        const response = await this.chat(messages, this.getModelForUseCase('fileSearch'), null, { useCase: 'fileSearch' });
        const parsed = this._extractJsonObject(response);
        const rankedRows = Array.isArray(parsed?.ranked) ? parsed.ranked : [];
        if (rankedRows.length === 0) return [];

        const byId = new Map(limited.map(({ id, candidate }) => [id, candidate]));
        const ranked = [];
        for (const row of rankedRows) {
            const rowId = Number(row?.id);
            const base = byId.get(rowId);
            if (!base) continue;
            ranked.push({
                ...base,
                aiScore: Number.isFinite(Number(row?.score)) ? Number(row.score) : null,
                aiReason: String(row?.reason || '').trim()
            });
            byId.delete(rowId);
        }

        for (const remaining of byId.values()) {
            ranked.push(remaining);
        }

        return ranked;
    },

    async summarizeFilePreview(file = {}, query = '') {
        const path = String(file?.path || '').trim();
        if (!path) return '';

        const payload = {
            query: String(query || '').trim(),
            path,
            extension: String(file?.extension || ''),
            modifiedAt: Number(file?.modifiedAt || 0),
            snippet: String(file?.snippet || file?.content || '').slice(0, 3000)
        };

        const messages = [
            {
                role: 'system',
                content: [
                    'You summarize files for an Ephemera AI search preview pane.',
                    'Return concise markdown with:',
                    '- what the file contains,',
                    '- why it matches the query,',
                    '- one suggested next action.',
                    'Use at most 4 short bullets.'
                ].join(' ')
            },
            {
                role: 'user',
                content: JSON.stringify(payload, null, 2)
            }
        ];

        return this.chat(messages, this.getModelForUseCase('fileSearch'), null, { useCase: 'fileSearch' });
    },

    async buildAppFromPrompt(request, context = {}) {
        const task = String(request || '').trim();
        if (!task) {
            throw new Error('App builder request is required.');
        }

        const contextPayload = {
            appName: String(context.appName || ''),
            filePath: String(context.filePath || ''),
            selectedText: String(context.selectedText || '').slice(0, 1200),
            fileContent: String(context.fileContent || '').slice(0, 2000)
        };

        const messages = [
            {
                role: 'system',
                content: [
                    'You generate Ephemera user apps from natural language.',
                    'Return STRICT JSON only (no markdown, no prose) with this schema:',
                    '{"manifest":{"id":"com.user.slug","name":"...","version":"1.0.0","description":"...","category":"user","permissions":[],"window":{"width":600,"height":420},"singleton":false},"code":"..."}',
                    'Allowed permission values: fs, network, events, windows, notifications, dialogs, storage.',
                    'Code is plain JavaScript executed directly in a sandbox with globals:',
                    'container, manifest, windowId, EphemeraFS, EphemeraNetwork, EphemeraEvents, EphemeraWM, EphemeraNotifications, EphemeraDialog, EphemeraStorage, EphemeraSanitize.',
                    'Do NOT use: eval, Function constructor, document.write, script tags, imports, exports, or EphemeraApps.register.',
                    'Use inline styles and keep code concise and runnable.'
                ].join(' ')
            },
            {
                role: 'user',
                content: JSON.stringify({ request: task, context: contextPayload }, null, 2)
            }
        ];

        const response = await this.chat(messages, this.getModelForUseCase('appBuilder'), null, { useCase: 'appBuilder' });
        const parsed = this._extractJsonObject(response);
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('AI did not return a valid app blueprint JSON payload.');
        }

        return {
            manifest: parsed.manifest && typeof parsed.manifest === 'object' ? parsed.manifest : {},
            code: String(parsed.code || '')
        };
    },

    clearApiKey(provider = null) {
        if (!window.EphemeraState) return;
        const settingKey = this._getApiKeySetting(provider || this.getProvider());
        window.EphemeraState.updateSetting(settingKey, '');
        this._legacyCryptoKey = null;
    }
};

window.EphemeraAI = EphemeraAI;
export default EphemeraAI;
