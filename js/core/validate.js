// @ts-check

const EphemeraValidate = {
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    MAX_FILENAME_LENGTH: 255,
    MAX_PATH_LENGTH: 4096,
    MAX_CONTENT_LENGTH: 50 * 1024 * 1024,

    FORBIDDEN_PATTERNS: [
        /\.\./,
        /\0/,
        /\.\//,
        /~\//,
        /\.\.\//
    ],

    ALLOWED_EXTENSIONS: [
        'txt', 'md', 'html', 'css', 'js', 'json', 'xml', 'svg',
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp',
        'mp3', 'wav', 'ogg', 'webm', 'mp4',
        'pdf', 'zip', 'tar', 'gz',
        'yml', 'yaml', 'ini', 'cfg', 'conf', 'log', 'sh', 'bat', 'py', 'rb', 'ts', 'jsx', 'tsx', 'vue', 'svelte'
    ],

    isValidFilename(name) {
        if (!name || typeof name !== 'string') {
            return { valid: false, error: 'Filename is required' };
        }

        if (name.length > this.MAX_FILENAME_LENGTH) {
            return { valid: false, error: `Filename too long (max ${this.MAX_FILENAME_LENGTH} chars)` };
        }

        if (name === '.' || name === '..') {
            return { valid: false, error: 'Invalid filename' };
        }

        if (name.startsWith('.') && name.length === 1) {
            return { valid: false, error: 'Invalid filename' };
        }

        const forbiddenChars = /[<>:"|?*\x00-\x1f]/;
        if (forbiddenChars.test(name)) {
            return { valid: false, error: 'Filename contains forbidden characters' };
        }

        const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        if (reserved.includes(name.toUpperCase().split('.')[0])) {
            return { valid: false, error: 'Reserved filename' };
        }

        if (name.startsWith(' ') || name.endsWith(' ') || name.endsWith('.')) {
            return { valid: false, error: 'Filename cannot start/end with space or end with period' };
        }

        return { valid: true };
    },

    isValidPath(path) {
        if (!path || typeof path !== 'string') {
            return { valid: false, error: 'Path is required' };
        }

        if (path.length > this.MAX_PATH_LENGTH) {
            return { valid: false, error: `Path too long (max ${this.MAX_PATH_LENGTH} chars)` };
        }

        if (!path.startsWith('/')) {
            return { valid: false, error: 'Path must start with /' };
        }

        for (const pattern of this.FORBIDDEN_PATTERNS) {
            if (pattern.test(path)) {
                return { valid: false, error: 'Path contains forbidden pattern' };
            }
        }

        const normalized = path.replace(/\/+/g, '/');
        if (normalized !== path) {
            return { valid: false, error: 'Path contains double slashes' };
        }

        return { valid: true };
    },

    sanitizePath(path) {
        if (!path) return '/';
        
        let sanitized = path
            .replace(/\0/g, '')
            .replace(/\/+/g, '/')
            .replace(/\.\.(\/|$)/g, '')
            .trim();
        
        if (!sanitized.startsWith('/')) {
            sanitized = '/' + sanitized;
        }
        
        if (sanitized.length > this.MAX_PATH_LENGTH) {
            sanitized = sanitized.substring(0, this.MAX_PATH_LENGTH);
        }
        
        return sanitized;
    },

    isValidFileContent(content, _mimeType) {
        if (content === null || content === undefined) {
            return { valid: false, error: 'Content is required' };
        }

        const size = typeof content === 'string' 
            ? new TextEncoder().encode(content).length 
            : content.byteLength || content.size || 0;

        if (size > this.MAX_CONTENT_LENGTH) {
            return { valid: false, error: `Content too large (max ${this.MAX_CONTENT_LENGTH / 1024 / 1024}MB)` };
        }

        return { valid: true, size };
    },

    isValidAppManifest(manifest) {
        const errors = [];

        if (!manifest || typeof manifest !== 'object') {
            return { valid: false, errors: ['Manifest must be an object'] };
        }

        if (!manifest.id || typeof manifest.id !== 'string') {
            errors.push('Manifest must have a valid "id" field');
        } else if (!/^[\w.-]+$/.test(manifest.id)) {
            errors.push('Manifest id can only contain letters, numbers, dots, dashes, and underscores');
        } else if (manifest.id.length > 128) {
            errors.push('Manifest id too long (max 128 chars)');
        }

        if (!manifest.name || typeof manifest.name !== 'string') {
            errors.push('Manifest must have a valid "name" field');
        } else if (manifest.name.length > 64) {
            errors.push('Manifest name too long (max 64 chars)');
        }

        if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
            errors.push('Version must be in semver format (e.g., 1.0.0)');
        }

        if (manifest.type !== undefined) {
            const type = String(manifest.type || '').trim().toLowerCase();
            const allowedTypes = new Set(['app', 'system', 'editor', 'theme', 'widget']);
            if (!allowedTypes.has(type)) {
                errors.push('Manifest type must be one of: app, system, editor, theme, widget');
            }
        }

        if (manifest.window) {
            if (manifest.window.width && (manifest.window.width < 200 || manifest.window.width > 4096)) {
                errors.push('Window width must be between 200 and 4096');
            }
            if (manifest.window.height && (manifest.window.height < 200 || manifest.window.height > 4096)) {
                errors.push('Window height must be between 200 and 4096');
            }
        }

        if (manifest.permissions && !Array.isArray(manifest.permissions)) {
            errors.push('Permissions must be an array');
        } else if (Array.isArray(manifest.permissions)) {
            const allowedPermissions = new Set([
                'fs', 'network', 'events', 'windows', 'notifications', 'dialogs', 'storage',
                'filesystem:read', 'filesystem:write', 'filesystem:manage',
                'network:http', 'network:ws',
                'events:emit', 'events:subscribe',
                'windows:open', 'windows:manage',
                'storage:read', 'storage:write',
                'clipboard', 'ai',
                'command-palette', 'shortcuts', 'taskbar', 'contextmenu',
                'editor', 'theme'
            ]);
            for (const permission of manifest.permissions) {
                if (typeof permission !== 'string' || !allowedPermissions.has(permission.trim().toLowerCase())) {
                    errors.push(`Invalid permission: ${permission}`);
                    break;
                }
            }
        }

        if (manifest.icon && typeof manifest.icon === 'string') {
            if (manifest.icon.length > 10000) {
                errors.push('Icon too large (max 10KB)');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    isValidAppCode(code) {
        if (!code || typeof code !== 'string') {
            return { valid: false, error: 'Code is required' };
        }

        if (code.length > 500 * 1024) {
            return { valid: false, error: 'Code too large (max 500KB)' };
        }

        const dangerousPatterns = [
            /eval\s*\(/,
            /Function\s*\(/,
            /document\.write/,
            /<script[^>]*>[\s\S]*<\/script>/i,
            /javascript:/i,
            /vbscript:/i,
            /data:text\/html/i
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(code)) {
                return { valid: false, error: `Code contains potentially dangerous pattern: ${pattern}` };
            }
        }

        return { valid: true };
    },

    isValidPassword(password) {
        const result = {
            valid: true,
            errors: [],
            strength: 0
        };

        if (!password || typeof password !== 'string') {
            return { valid: false, errors: ['Password is required'], strength: 0 };
        }

        if (password.length < 12) {
            result.errors.push('Password must be at least 12 characters');
            result.valid = false;
        }

        if (password.length > 256) {
            result.errors.push('Password too long (max 256 chars)');
            result.valid = false;
        }

        if (password.length >= 12) result.strength += 1;
        if (password.length >= 16) result.strength += 1;
        if (/[a-z]/.test(password)) result.strength += 1;
        if (/[A-Z]/.test(password)) result.strength += 1;
        if (/[0-9]/.test(password)) result.strength += 1;
        if (/[^a-zA-Z0-9]/.test(password)) result.strength += 1;
        if (!/(.)\1{2,}/.test(password)) result.strength += 1;

        const commonPasswords = ['password', '123456', 'qwerty', 'letmein', 'welcome', 'admin', 'monkey', 'password123'];
        if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
            result.errors.push('Password contains common pattern');
            result.strength = Math.max(0, result.strength - 2);
        }

        result.strength = Math.min(5, result.strength);

        return result;
    },

    isValidEmail(email) {
        if (!email || typeof email !== 'string') {
            return { valid: false, error: 'Email is required' };
        }

        if (email.length > 256) {
            return { valid: false, error: 'Email too long' };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: 'Invalid email format' };
        }

        return { valid: true };
    },

    isValidUrl(url, options = {}) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'URL is required' };
        }

        const { allowPrivate = false, allowData = false, allowJavaScript = false } = options;

        if (!allowJavaScript && url.toLowerCase().startsWith('javascript:')) {
            return { valid: false, error: 'JavaScript URLs not allowed' };
        }

        if (!allowData && url.toLowerCase().startsWith('data:')) {
            return { valid: false, error: 'Data URLs not allowed' };
        }

        if (url.toLowerCase().startsWith('vbscript:')) {
            return { valid: false, error: 'VBScript URLs not allowed' };
        }

        try {
            const parsed = new URL(url, window.location.origin);
            
            if (!allowPrivate) {
                const privatePatterns = [
                    /^127\./,
                    /^10\./,
                    /^172\.(1[6-9]|2[0-9]|3[01])\./,
                    /^192\.168\./,
                    /^169\.254\./,
                    /^0\.0\.0\.0$/,
                    /^localhost$/i,
                    /^::1$/,
                    /^fc00:/i,
                    /^fe80:/i
                ];

                const hostname = parsed.hostname;
                for (const pattern of privatePatterns) {
                    if (pattern.test(hostname)) {
                        return { valid: false, error: 'Private IP addresses not allowed' };
                    }
                }
            }

            return { valid: true, url: parsed.href };
        } catch (e) {
            return { valid: false, error: 'Invalid URL format' };
        }
    },

    isValidApiKey(key) {
        if (!key || typeof key !== 'string') {
            return { valid: false, error: 'API key is required' };
        }

        if (key.length < 10 || key.length > 256) {
            return { valid: false, error: 'API key length invalid' };
        }

        if (!/^[\w-]+$/.test(key)) {
            return { valid: false, error: 'API key contains invalid characters' };
        }

        return { valid: true };
    },

    sanitizeHtml(html) {
        if (!html || typeof html !== 'string') return '';

        return html
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .replace(/`/g, '&#96;')
            .replace(/=/g, '&#x3D;');
    },

    sanitizeForLog(data) {
        if (typeof data === 'string') {
            return data
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t')
                .substring(0, 500);
        }
        
        if (typeof data === 'object') {
            try {
                const str = JSON.stringify(data);
                return str.substring(0, 500);
            } catch {
                return '[Object]';
            }
        }
        
        return String(data).substring(0, 500);
    },

    /**
     * @param {string} key
     * @param {unknown} value
     * @returns {{valid: boolean, warning?: string, error?: string | null}}
     */
    validateSettingsValue(key, value) {
        /** @type {Record<string, (candidate: unknown) => boolean>} */
        const validators = {
            theme: (v) => ['dark', 'light'].includes(String(v)),
            accentColor: (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v),
            notifications: (v) => typeof v === 'boolean',
            sounds: (v) => typeof v === 'boolean',
            proxyEnabled: (v) => typeof v === 'boolean',
            proxyUrl: (v) => typeof v === 'string' && (!v || this.isValidUrl(v, { allowPrivate: true }).valid),
            terminalBackendEnabled: (v) => typeof v === 'boolean',
            terminalBackendUrl: (v) => {
                if (typeof v !== 'string') return false;
                const trimmed = v.trim();
                if (!trimmed) return true;
                try {
                    const parsed = new URL(trimmed);
                    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
                } catch (_e) {
                    return false;
                }
            },
            aiProvider: (v) => ['openrouter', 'openai', 'anthropic', 'google'].includes(String(v)),
            openrouterApiKey: (v) => typeof v === 'string' && v.length < 4096,
            openaiApiKey: (v) => typeof v === 'string' && v.length < 4096,
            anthropicApiKey: (v) => typeof v === 'string' && v.length < 4096,
            googleApiKey: (v) => typeof v === 'string' && v.length < 4096,
            aiModel: (v) => typeof v === 'string' && v.length < 128,
            aiModelChat: (v) => typeof v === 'string' && v.length < 128,
            aiModelCode: (v) => typeof v === 'string' && v.length < 128,
            aiModelTerminal: (v) => typeof v === 'string' && v.length < 128,
            aiModelQuickActions: (v) => typeof v === 'string' && v.length < 128,
            aiModelAppBuilder: (v) => typeof v === 'string' && v.length < 128,
            aiModelFileSearch: (v) => typeof v === 'string' && v.length < 128,
            aiMaxTokens: (v) => typeof v === 'number' && v >= 100 && v <= 128000,
            aiTemperature: (v) => typeof v === 'number' && v >= 0 && v <= 2,
            wallpaper: (v) => ['particles', 'solid', 'gradient1', 'gradient2', 'gradient3', 'gradient4'].includes(String(v))
        };

        const validator = validators[key];
        if (!validator) {
            return { valid: true, warning: `Unknown setting: ${key}` };
        }

        const valid = validator(value);
        return { valid, error: valid ? null : `Invalid value for ${key}` };
    }
};

window.EphemeraValidate = EphemeraValidate;
export default EphemeraValidate;
