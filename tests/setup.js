import { vi } from 'vitest';

// --- localStorage / sessionStorage ---

function createStorageMock() {
    let store = {};
    return {
        getItem: vi.fn((key) => store[key] ?? null),
        setItem: vi.fn((key, value) => { store[key] = String(value); }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        get length() { return Object.keys(store).length; },
        key: vi.fn((i) => Object.keys(store)[i] ?? null),
        _store: store,
        _reset() { store = {}; this._store = store; }
    };
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock, writable: true });

// --- IndexedDB mock with full index support ---

class MockIDBIndex {
    constructor(store, indexName, keyPath, options = {}) {
        this.objectStore = store;
        this.name = indexName;
        this.keyPath = keyPath;
        this.unique = options.unique || false;
        this.multiEntry = options.multiEntry || false;
    }

    _getKeyValue(item) {
        if (typeof this.keyPath === 'string') {
            return item[this.keyPath];
        }
        return this.keyPath.map(k => item[k]);
    }

    getAll(query) {
        const results = this.objectStore._data.filter(item => {
            const val = this._getKeyValue(item);
            if (query === undefined || query === null) return true;
            if (Array.isArray(val)) return val.includes(query);
            return val === query;
        });
        return MockIDBRequest.resolve(results);
    }

    get(query) {
        const item = this.objectStore._data.find(item => {
            const val = this._getKeyValue(item);
            return val === query;
        });
        return MockIDBRequest.resolve(item || undefined);
    }

    count(query) {
        if (query === undefined) return MockIDBRequest.resolve(this.objectStore._data.length);
        const count = this.objectStore._data.filter(item => this._getKeyValue(item) === query).length;
        return MockIDBRequest.resolve(count);
    }
}

class MockIDBObjectStore {
    constructor(name, options = {}) {
        this.name = name;
        this.keyPath = options.keyPath || null;
        this.autoIncrement = options.autoIncrement || false;
        this._data = [];
        this._indexes = {};
        this._autoInc = 1;
    }

    _getKey(item) {
        if (this.keyPath) return item[this.keyPath];
        return undefined;
    }

    createIndex(indexName, keyPath, options = {}) {
        this._indexes[indexName] = new MockIDBIndex(this, indexName, keyPath, options);
        return this._indexes[indexName];
    }

    index(indexName) {
        if (!this._indexes[indexName]) {
            throw new DOMException(`Index '${indexName}' not found`, 'NotFoundError');
        }
        return this._indexes[indexName];
    }

    get(key) {
        const item = this._data.find(d => this._getKey(d) === key);
        return MockIDBRequest.resolve(item || undefined);
    }

    getAll(query) {
        if (query === undefined || query === null) {
            return MockIDBRequest.resolve([...this._data]);
        }
        const results = this._data.filter(d => this._getKey(d) === query);
        return MockIDBRequest.resolve(results);
    }

    getAllKeys() {
        const keys = this._data.map(d => this._getKey(d));
        return MockIDBRequest.resolve(keys);
    }

    put(data) {
        const key = this._getKey(data);
        const idx = this._data.findIndex(d => this._getKey(d) === key);
        if (idx >= 0) {
            this._data[idx] = { ...data };
        } else {
            this._data.push({ ...data });
        }
        return MockIDBRequest.resolve(key);
    }

    add(data) {
        const key = this._getKey(data);
        const exists = this._data.some(d => this._getKey(d) === key);
        if (exists) {
            return MockIDBRequest.reject(new DOMException('Key already exists', 'ConstraintError'));
        }
        this._data.push({ ...data });
        return MockIDBRequest.resolve(key);
    }

    delete(key) {
        this._data = this._data.filter(d => this._getKey(d) !== key);
        return MockIDBRequest.resolve(undefined);
    }

    clear() {
        this._data = [];
        return MockIDBRequest.resolve(undefined);
    }

    count() {
        return MockIDBRequest.resolve(this._data.length);
    }

    openCursor() {
        // Return a mock cursor request
        const store = this;
        const req = new MockIDBRequest();
        let index = 0;

        const advanceCursor = () => {
            if (index < store._data.length) {
                const currentValue = store._data[index];
                req.result = {
                    value: currentValue,
                    key: store._getKey(currentValue),
                    continue: () => {
                        index++;
                        queueMicrotask(advanceCursor);
                    }
                };
                req.readyState = 'done';
                if (req.onsuccess) req.onsuccess({ target: req });
            } else {
                req.result = null;
                req.readyState = 'done';
                if (req.onsuccess) req.onsuccess({ target: req });
            }
        };

        queueMicrotask(advanceCursor);
        return req;
    }
}

class MockIDBRequest {
    constructor() {
        this.result = undefined;
        this.error = null;
        this.onsuccess = null;
        this.onerror = null;
        this.readyState = 'pending';
    }

    static resolve(result) {
        const req = new MockIDBRequest();
        req.result = result;
        req.readyState = 'done';
        queueMicrotask(() => {
            if (req.onsuccess) req.onsuccess({ target: req });
        });
        return req;
    }

    static reject(error) {
        const req = new MockIDBRequest();
        req.error = error;
        req.readyState = 'done';
        queueMicrotask(() => {
            if (req.onerror) req.onerror({ target: req });
        });
        return req;
    }
}

class MockIDBTransaction {
    constructor(db, storeNames, mode) {
        this._db = db;
        this._storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
        this.mode = mode;
        this.oncomplete = null;
        this.onerror = null;
        this.onabort = null;
        this.error = null;
        // Fire oncomplete after microtasks settle
        queueMicrotask(() => {
            queueMicrotask(() => {
                if (this.oncomplete) this.oncomplete({ target: this });
            });
        });
    }

    objectStore(name) {
        if (!this._storeNames.includes(name)) {
            throw new DOMException(`Store '${name}' not in transaction scope`, 'NotFoundError');
        }
        return this._db._stores[name];
    }

    abort() {
        if (this.onabort) this.onabort({ target: this });
    }
}

class MockIDBDatabase {
    constructor(name, version) {
        this.name = name;
        this.version = version;
        this._stores = {};
        this._closed = false;
    }

    get objectStoreNames() {
        const names = Object.keys(this._stores);
        return {
            contains: (n) => names.includes(n),
            length: names.length,
            item: (i) => names[i],
            [Symbol.iterator]: () => names[Symbol.iterator]()
        };
    }

    createObjectStore(name, options = {}) {
        const store = new MockIDBObjectStore(name, options);
        this._stores[name] = store;
        return store;
    }

    deleteObjectStore(name) {
        delete this._stores[name];
    }

    transaction(storeNames, mode = 'readonly') {
        return new MockIDBTransaction(this, storeNames, mode);
    }

    close() {
        this._closed = true;
    }
}

class MockIndexedDB {
    constructor() {
        this._dbs = {};
    }

    open(name, version = 1) {
        const request = new MockIDBRequest();
        request.onupgradeneeded = null;

        queueMicrotask(() => {
            const existing = this._dbs[name];
            const needsUpgrade = !existing || (existing.version < version);

            const db = existing || new MockIDBDatabase(name, version);
            db.version = version;
            this._dbs[name] = db;

            request.result = db;

            if (needsUpgrade && request.onupgradeneeded) {
                const upgradeTransaction = new MockIDBTransaction(db, Object.keys(db._stores), 'versionchange');
                request.onupgradeneeded({
                    target: { result: db, transaction: upgradeTransaction },
                    oldVersion: existing ? existing.version : 0,
                    newVersion: version
                });
            }

            request.readyState = 'done';
            if (request.onsuccess) request.onsuccess({ target: request });
        });

        return request;
    }

    deleteDatabase(name) {
        delete this._dbs[name];
        return MockIDBRequest.resolve(undefined);
    }

    _reset() {
        this._dbs = {};
    }
}

const mockIDB = new MockIndexedDB();
Object.defineProperty(global, 'indexedDB', { value: mockIDB, writable: true });

// --- crypto.subtle mock ---

class MockCrypto {
    getRandomValues(array) {
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    }

    subtle = {
        digest: async (algorithm, data) => {
            const buffer = new Uint8Array(32);
            const src = new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer);
            for (let i = 0; i < 32 && i < src.byteLength; i++) {
                buffer[i] = src[i];
            }
            return buffer.buffer;
        },
        importKey: async (format, keyData, algorithm, extractable, keyUsages) => {
            return { type: 'secret', algorithm, usages: keyUsages, _keyData: keyData };
        },
        deriveKey: async (derivedKeyAlgorithm, baseKey, derivedKeyType, extractable, keyUsages) => {
            return { type: 'secret', algorithm: derivedKeyType, usages: keyUsages };
        },
        deriveBits: async (algorithm, baseKey, length) => {
            return new ArrayBuffer(length / 8);
        },
        encrypt: async (algorithm, key, data) => {
            const iv = algorithm.iv || new Uint8Array(12);
            const src = new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer || data);
            const encrypted = new Uint8Array(src.byteLength + 16); // GCM adds 16-byte tag
            for (let i = 0; i < src.byteLength; i++) {
                encrypted[i] = src[i] ^ 0x42; // simple XOR "encryption" for testing
            }
            return encrypted.buffer;
        },
        decrypt: async (algorithm, key, data) => {
            const src = new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer || data);
            const decrypted = new Uint8Array(src.byteLength - 16);
            for (let i = 0; i < decrypted.length; i++) {
                decrypted[i] = src[i] ^ 0x42;
            }
            return decrypted.buffer;
        },
        generateKey: async (algorithm, extractable, keyUsages) => {
            return { type: 'secret', algorithm, usages: keyUsages };
        }
    };
}

Object.defineProperty(global, 'crypto', { value: new MockCrypto(), writable: true });

// --- TextEncoder / TextDecoder ---

if (!global.TextEncoder) {
    global.TextEncoder = class TextEncoder {
        encode(str) {
            const bytes = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
                bytes[i] = str.charCodeAt(i);
            }
            return bytes;
        }
    };
}

if (!global.TextDecoder) {
    global.TextDecoder = class TextDecoder {
        decode(buffer) {
            const bytes = new Uint8Array(buffer);
            let str = '';
            for (let i = 0; i < bytes.length; i++) {
                str += String.fromCharCode(bytes[i]);
            }
            return str;
        }
    };
}

// --- btoa / atob ---

if (!global.btoa) global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
if (!global.atob) global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

// --- fetch mock ---

global.fetch = vi.fn();

// --- EphemeraEvents mock ---

function createEventsMock() {
    const listeners = {};
    return {
        on: vi.fn((event, fn) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(fn);
        }),
        off: vi.fn((event, fn) => {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter(f => f !== fn);
            }
        }),
        once: vi.fn((event, fn) => {
            const wrapper = (...args) => {
                fn(...args);
                createEventsMock().off(event, wrapper);
            };
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(wrapper);
        }),
        emit: vi.fn((event, ...args) => {
            if (listeners[event]) {
                listeners[event].forEach(fn => fn(...args));
            }
        }),
        _listeners: listeners,
        _reset() {
            Object.keys(listeners).forEach(k => delete listeners[k]);
        }
    };
}

const eventsMock = createEventsMock();
global.window.EphemeraEvents = eventsMock;

// --- EphemeraState mock ---

function createStateMock() {
    return {
        settings: {
            proxyUrl: '',
            proxyEnabled: true,
            theme: 'dark',
            locale: 'en',
            notifications: true,
            wallpaper: 'particles',
            terminalBackendEnabled: false,
            terminalBackendUrl: '',
            openrouterApiKey: '',
            openaiApiKey: '',
            anthropicApiKey: '',
            googleApiKey: '',
            aiProvider: 'openrouter',
            aiModel: 'openrouter/free',
            aiModelChat: '',
            aiModelCode: '',
            aiModelTerminal: '',
            aiModelQuickActions: '',
            aiModelAppBuilder: '',
            aiModelFileSearch: '',
            aiMaxTokens: 8192,
            aiTemperature: 0.7,
            fileHistoryMode: 'every-save',
            fileHistoryMaxVersions: 10,
            fileHistoryWarnMb: 25,
            editorEngine: 'cm5',
        },
        user: {
            id: 'default',
            name: 'Test User',
            homeDir: '/home/testuser'
        },
        windows: [],
        currentWorkspace: 1,
        updateSetting: vi.fn(function(key, value) { this.settings[key] = value; }),
        save: vi.fn(),
        load: vi.fn(),
        _reset() {
            this.settings = { ...createStateMock().settings };
            this.user = { ...createStateMock().user };
            this.windows = [];
        }
    };
}

const stateMock = createStateMock();
global.window.EphemeraState = stateMock;

// --- EphemeraSession mock ---

function createSessionMock() {
    let unlocked = false;
    let masterKey = null;
    return {
        isUnlocked: vi.fn(() => unlocked),
        isLocked: vi.fn(() => !unlocked),
        getMasterKey: vi.fn(() => masterKey),
        _setUnlocked(val, key = null) {
            unlocked = val;
            masterKey = key;
        },
        _reset() {
            unlocked = false;
            masterKey = null;
        }
    };
}

const sessionMock = createSessionMock();
global.window.EphemeraSession = sessionMock;

// --- EphemeraSanitize mock ---

global.window.EphemeraSanitize = {
    escapeHtml: vi.fn(s => String(s)),
    escapeAttr: vi.fn(s => String(s)),
    sanitizeHtml: vi.fn(s => String(s))
};

// --- EphemeraNotifications mock ---

global.window.EphemeraNotifications = {
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
};

// --- EphemeraTelemetry mock ---

global.window.EphemeraTelemetry = {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn()
};

// --- window/document extensions ---

if (!global.window.location) {
    global.window.location = {
        origin: 'http://localhost:3000',
        href: 'http://localhost:3000',
        reload: vi.fn()
    };
}

if (!global.window.navigator) {
    global.window.navigator = {
        userAgent: 'TestAgent/1.0',
        onLine: true
    };
}

global.window.addEventListener = global.window.addEventListener || vi.fn();
global.window.removeEventListener = global.window.removeEventListener || vi.fn();

// --- navigator.storage mock ---

if (!global.navigator) global.navigator = {};
global.navigator.storage = {
    estimate: vi.fn(async () => ({ quota: 100 * 1024 * 1024, usage: 1024 * 1024 }))
};

// --- Sentry mock ---

vi.mock('@sentry/browser', () => ({
    init: vi.fn(),
    setUser: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn(),
    withScope: vi.fn((cb) => cb({
        setTag: vi.fn(),
        setExtra: vi.fn(),
        setLevel: vi.fn(),
        setFingerprint: vi.fn(),
        setContext: vi.fn()
    })),
    browserTracingIntegration: vi.fn(() => ({})),
    replayIntegration: vi.fn(() => ({}))
}));

// --- Export mocks for test use ---

export {
    mockIDB,
    eventsMock,
    stateMock,
    sessionMock,
    localStorageMock,
    sessionStorageMock
};
