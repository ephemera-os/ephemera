const EMBED_COMMANDS = [
    'ping',
    'getInfo',
    'getState',
    'listApps',
    'openApp',
    'closeWindow',
    'switchWorkspace',
    'writeFile',
    'readFile',
    'readdir',
    'emitEvent'
];

function parseBoolean(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseAllowedApps(raw) {
    return String(raw || '')
        .split(',')
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
}

function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
        const slice = bytes.subarray(index, index + chunk);
        binary += String.fromCharCode(...slice);
    }
    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(String(value || ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function getParam(message, key, fallback = undefined) {
    if (Object.prototype.hasOwnProperty.call(message, key)) {
        return message[key];
    }
    if (message?.payload && typeof message.payload === 'object' && Object.prototype.hasOwnProperty.call(message.payload, key)) {
        return message.payload[key];
    }
    return fallback;
}

function requirePath(value) {
    const path = String(value || '').trim();
    if (!path) throw new Error('path is required');
    return path;
}

function serializeReadContent(raw) {
    if (raw instanceof Uint8Array) {
        return {
            encoding: 'base64',
            content: bytesToBase64(raw)
        };
    }
    if (raw instanceof ArrayBuffer) {
        return {
            encoding: 'base64',
            content: bytesToBase64(new Uint8Array(raw))
        };
    }
    if (typeof raw === 'string') {
        return {
            encoding: 'utf8',
            content: raw
        };
    }
    return {
        encoding: 'json',
        content: raw
    };
}

function decodeWriteContent(message) {
    const encoding = String(getParam(message, 'encoding', '') || '').trim().toLowerCase();
    const content = getParam(message, 'content', '');
    if (encoding === 'base64' && typeof content === 'string') {
        return base64ToBytes(content);
    }
    return content;
}

const params = new URLSearchParams(window.location.search);
const embedEnabled = parseBoolean(params.get('embed'));
const parentOriginParam = String(params.get('parentOrigin') || '*').trim();
const parentOrigin = parentOriginParam || '*';
const allowedApps = parseAllowedApps(params.get('apps'));

const EphemeraEmbed = {
    enabled: embedEnabled,
    parentOrigin,
    allowedApps,
    capabilities: EMBED_COMMANDS.slice(),
    isEnabled() {
        return this.enabled === true;
    },
    isAppAllowed(appId) {
        if (!this.enabled || this.allowedApps.length === 0) return true;
        return this.allowedApps.includes(String(appId || '').trim());
    }
};

window.EphemeraEmbed = EphemeraEmbed;

if (embedEnabled) {
    document.documentElement.classList.add('embed-mode');
    document.documentElement.dataset.embedMode = 'true';

    if (window.EphemeraApps?.configureEmbed) {
        window.EphemeraApps.configureEmbed({
            enabled: true,
            allowedApps
        });
    }
}

function postToParent(payload) {
    if (!embedEnabled) return;
    if (!window.parent || window.parent === window) return;
    try {
        window.parent.postMessage({
            ephemera: true,
            ...payload
        }, parentOrigin);
    } catch (error) {
        console.warn('[EphemeraEmbed] Failed to post to parent:', error);
    }
}

function ensureApi(api, method) {
    if (!api || typeof api[method] !== 'function') {
        throw new Error(`${method} is not available`);
    }
    return api;
}

const commandHandlers = {
    async ping() {
        return {
            pong: true,
            now: Date.now(),
            version: window.Ephemera?.version || '2.0.0',
            embed: true
        };
    },

    async getInfo() {
        return {
            version: window.Ephemera?.version || '2.0.0',
            embed: true,
            shellMode: window.EphemeraState?.shellMode || null,
            allowedApps: EphemeraEmbed.allowedApps.slice(),
            capabilities: EMBED_COMMANDS.slice()
        };
    },

    async getState() {
        const state = window.EphemeraState || {};
        return {
            activeWindowId: state.activeWindowId ?? null,
            currentWorkspace: state.currentWorkspace ?? 0,
            windowCount: Array.isArray(state.windows) ? state.windows.length : 0,
            workspaceWindowCounts: Array.isArray(state.workspaces)
                ? state.workspaces.map((entry) => Array.isArray(entry) ? entry.length : 0)
                : []
        };
    },

    async listApps() {
        const appsApi = ensureApi(window.EphemeraApps, 'getAll');
        return appsApi.getAll().map((app) => ({
            id: app.id,
            name: app.name,
            category: app.category || 'other',
            description: app.description || ''
        }));
    },

    async openApp(message) {
        const appId = String(getParam(message, 'appId', '') || '').trim();
        if (!appId) throw new Error('appId is required');
        const options = getParam(message, 'options', {}) || {};
        const wm = ensureApi(window.EphemeraWM, 'open');
        const windowId = wm.open(appId, options);
        if (windowId == null) {
            throw new Error(`App not available: ${appId}`);
        }
        return { windowId };
    },

    async closeWindow(message) {
        const windowId = Number.parseInt(String(getParam(message, 'windowId', '')), 10);
        if (!Number.isInteger(windowId)) throw new Error('windowId must be an integer');
        const wm = ensureApi(window.EphemeraWM, 'close');
        await wm.close(windowId);
        return { windowId };
    },

    async switchWorkspace(message) {
        const workspace = Number.parseInt(String(getParam(message, 'workspace', getParam(message, 'index', ''))), 10);
        if (!Number.isInteger(workspace)) throw new Error('workspace must be an integer');
        const boot = ensureApi(window.EphemeraBoot, 'switchWorkspace');
        boot.switchWorkspace(workspace);
        return { workspace };
    },

    async writeFile(message) {
        const path = requirePath(getParam(message, 'path', ''));
        const content = decodeWriteContent(message);
        const metadataInput = getParam(message, 'metadata', {});
        const metadata = metadataInput && typeof metadataInput === 'object' && !Array.isArray(metadataInput)
            ? { ...metadataInput }
            : {};
        const mimeType = getParam(message, 'mimeType', null);
        if (mimeType && !metadata.mimeType) {
            metadata.mimeType = String(mimeType);
        }
        const fs = ensureApi(window.EphemeraFS, 'writeFile');
        await fs.writeFile(path, content, metadata);
        return { path };
    },

    async readFile(message) {
        const path = requirePath(getParam(message, 'path', ''));
        const fs = ensureApi(window.EphemeraFS, 'readFile');
        const content = await fs.readFile(path);
        return {
            path,
            ...serializeReadContent(content)
        };
    },

    async readdir(message) {
        const path = requirePath(getParam(message, 'path', ''));
        const fs = ensureApi(window.EphemeraFS, 'readdir');
        const entries = await fs.readdir(path);
        return { path, entries };
    },

    async emitEvent(message) {
        const eventName = String(getParam(message, 'event', '') || '').trim();
        if (!eventName) throw new Error('event is required');
        window.EphemeraEvents?.emit?.(eventName, getParam(message, 'payload', null));
        return { event: eventName };
    }
};

async function handleCommandMessage(message) {
    const requestId = getParam(message, 'requestId', null);
    const command = String(getParam(message, 'cmd', '') || '').trim();
    if (!command) return;

    const handler = commandHandlers[command];
    if (!handler) {
        if (requestId != null) {
            postToParent({
                type: 'response',
                requestId: String(requestId),
                ok: false,
                error: `Unknown command: ${command}`
            });
        }
        return;
    }

    try {
        const result = await handler(message);
        if (requestId != null) {
            postToParent({
                type: 'response',
                requestId: String(requestId),
                ok: true,
                result
            });
        }
    } catch (error) {
        if (requestId != null) {
            postToParent({
                type: 'response',
                requestId: String(requestId),
                ok: false,
                error: error?.message || String(error)
            });
        } else {
            postToParent({
                type: 'error',
                error: error?.message || String(error)
            });
        }
    }
}

if (embedEnabled) {
    window.addEventListener('message', (event) => {
        if (event.source !== window.parent) return;
        if (parentOrigin !== '*' && event.origin !== parentOrigin) return;
        if (!event.data || event.data.ephemera !== true || typeof event.data.cmd !== 'string') return;
        handleCommandMessage(event.data);
    });

    if (window.EphemeraEvents?.on) {
        window.EphemeraEvents.on('window:opened', (payload) => {
            postToParent({ type: 'event', event: 'window:opened', payload });
        });
        window.EphemeraEvents.on('window:closed', (payload) => {
            postToParent({ type: 'event', event: 'window:closed', payload });
        });
        window.EphemeraEvents.on('workspace:changed', (payload) => {
            postToParent({ type: 'event', event: 'workspace:changed', payload });
        });
        window.EphemeraEvents.on('desktop:ready', () => {
            postToParent({
                type: 'ready',
                version: window.Ephemera?.version || '2.0.0',
                capabilities: EMBED_COMMANDS.slice(),
                allowedApps: EphemeraEmbed.allowedApps.slice()
            });
        });
    }
}

export default EphemeraEmbed;
