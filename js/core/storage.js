const EphemeraStorage = {
    db: null,
    baseDbName: 'EphemeraFS',
    dbName: 'EphemeraFS_default',
    profileId: 'default',
    dbVersion: 4,
    
    ENCRYPTED_FIELDS: {
        files: ['content'],
        fileVersions: [],
        apps: ['code'],
        metadata: ['value']
    },
    
    SENSITIVE_METADATA_KEYS: [
        'openrouterApiKey',
        'openaiApiKey',
        'anthropicApiKey',
        'googleApiKey',
        'oauth_tokens',
        'autosave:code',
        'ephemera_aichat',
        'syncRestToken'
    ],

    _writeQueue: {
        pending: [],
        isProcessing: false
    },
    STRICT_ENCRYPTION_MODE: false,
    ENCRYPTED_VALUE_PREFIX: '__EPHEMERA_ENC_V1__',

    _normalizeProfileId(profileId) {
        const raw = String(profileId || 'default').trim().toLowerCase();
        const normalized = raw
            .replace(/[^a-z0-9_-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        return normalized || 'default';
    },

    validateProfileId(profileId) {
        const raw = String(profileId || '').trim();

        if (!raw) {
            return { valid: false, error: 'Profile ID is required' };
        }

        const normalized = this._normalizeProfileId(profileId);

        if (raw.toLowerCase() !== normalized) {
            return {
                valid: true,
                warning: `Profile ID will be stored as "${normalized}"`,
                normalized
            };
        }

        return { valid: true, normalized };
    },

    _buildDbName(profileId) {
        return `${this.baseDbName}_${this._normalizeProfileId(profileId)}`;
    },

    async init(profileId = null) {
        if (profileId !== null && profileId !== undefined) {
            const normalized = this._normalizeProfileId(profileId);
            if (normalized !== this.profileId) {
                await this.setActiveProfile(normalized);
            }
        }

        if (this.db) {
            return this.db;
        }

        return this._openDb();
    },

    async setActiveProfile(profileId) {
        const normalized = this._normalizeProfileId(profileId);
        if (normalized === this.profileId && this.db) {
            return this.db;
        }

        await this.close();
        this.profileId = normalized;
        this.dbName = this._buildDbName(normalized);
        return this._openDb();
    },

    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    },

    async _openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
			
			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};
			
			request.onupgradeneeded = (event) => {
				const db = event.target.result;
				const transaction = event.target.transaction;

				if (!db.objectStoreNames.contains('files')) {
					const filesStore = db.createObjectStore('files', { keyPath: 'path' });
					filesStore.createIndex('parentDir', 'parentDir', { unique: false });
					filesStore.createIndex('type', 'type', { unique: false });
					filesStore.createIndex('modifiedAt', 'modifiedAt', { unique: false });
					filesStore.createIndex('nameLower', 'nameLower', { unique: false });
				} else if (event.oldVersion < 3) {
					// Add nameLower index to existing files store
					const filesStore = transaction.objectStore('files');
					if (!filesStore.indexNames.contains('nameLower')) {
						filesStore.createIndex('nameLower', 'nameLower', { unique: false });
					}
				}

				if (!db.objectStoreNames.contains('apps')) {
					db.createObjectStore('apps', { keyPath: 'id' });
				}

				if (!db.objectStoreNames.contains('metadata')) {
					db.createObjectStore('metadata', { keyPath: 'key' });
				}

				if (!db.objectStoreNames.contains('fileVersions')) {
					const fileVersionsStore = db.createObjectStore('fileVersions', { keyPath: 'id' });
					fileVersionsStore.createIndex('path', 'path', { unique: false });
					fileVersionsStore.createIndex('createdAt', 'createdAt', { unique: false });
					fileVersionsStore.createIndex('pathCreatedAt', ['path', 'createdAt'], { unique: false });
				}
			};
		});
	},
	
	_getEncryptionKey() {
		if (window.EphemeraSession && window.EphemeraSession.isUnlocked()) {
			return window.EphemeraSession.getMasterKey();
		}
		return null;
	},

	shouldEncrypt(storeName, key) {
		if (storeName === 'metadata') {
			return this.SENSITIVE_METADATA_KEYS.some(k => 
				typeof key === 'string' && key.includes(k)
			);
		}
		return this.ENCRYPTED_FIELDS[storeName] && this.ENCRYPTED_FIELDS[storeName].length > 0;
	},

	async _encryptString(value, key) {
		const text = typeof value === 'string' ? value : JSON.stringify(value);
		if (window.EphemeraCryptoWorker?.encrypt) {
			try {
				return await window.EphemeraCryptoWorker.encrypt(text, key);
			} catch (_error) {
				// Fallback to main-thread crypto when worker is unavailable.
			}
		}
		return await window.EphemeraCrypto.encrypt(text, key);
	},

	async _decryptString(ciphertext, key) {
		if (window.EphemeraCryptoWorker?.decrypt) {
			try {
				return await window.EphemeraCryptoWorker.decrypt(ciphertext, key);
			} catch (_error) {
				// Fallback to main-thread crypto when worker is unavailable.
			}
		}
		return await window.EphemeraCrypto.decrypt(ciphertext, key);
	},

	_bytesToBase64(value) {
		let bytes = value;
		if (bytes instanceof ArrayBuffer) {
			bytes = new Uint8Array(bytes);
		} else if (ArrayBuffer.isView(bytes) && !(bytes instanceof Uint8Array)) {
			bytes = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		}

		if (!(bytes instanceof Uint8Array)) {
			throw new Error('bytes must be an ArrayBuffer or typed array');
		}

		let binary = '';
		const chunkSize = 0x8000;
		for (let i = 0; i < bytes.length; i += chunkSize) {
			binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
		}
		return btoa(binary);
	},

	_base64ToBytes(base64) {
		const binary = atob(String(base64 || ''));
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	},

	_serializeEncryptedFieldValue(value) {
		if (value instanceof ArrayBuffer) {
			return this.ENCRYPTED_VALUE_PREFIX + JSON.stringify({
				t: 'ab',
				d: this._bytesToBase64(new Uint8Array(value))
			});
		}

		if (ArrayBuffer.isView(value)) {
			const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
			return this.ENCRYPTED_VALUE_PREFIX + JSON.stringify({
				t: 'ab',
				d: this._bytesToBase64(bytes)
			});
		}

		if (typeof value === 'string') {
			if (value.startsWith(this.ENCRYPTED_VALUE_PREFIX)) {
				return this.ENCRYPTED_VALUE_PREFIX + JSON.stringify({
					t: 'str',
					d: value
				});
			}
			return value;
		}

		return this.ENCRYPTED_VALUE_PREFIX + JSON.stringify({
			t: 'json',
			d: value
		});
	},

	_deserializeEncryptedFieldValue(value) {
		if (typeof value !== 'string' || !value.startsWith(this.ENCRYPTED_VALUE_PREFIX)) {
			return value;
		}

		const rawPayload = value.slice(this.ENCRYPTED_VALUE_PREFIX.length);
		let payload;
		try {
			payload = JSON.parse(rawPayload);
		} catch (_error) {
			return value;
		}

		if (!payload || typeof payload !== 'object') {
			return value;
		}

		if (payload.t === 'ab' && typeof payload.d === 'string') {
			return this._base64ToBytes(payload.d).buffer;
		}

		if (payload.t === 'json') {
			return payload.d;
		}

		if (payload.t === 'str' && typeof payload.d === 'string') {
			return payload.d;
		}

		return value;
	},

	async encryptData(data, key) {
		if (!key || !window.EphemeraCrypto) {
			return data;
		}

		if (typeof data === 'string') {
			return await this._encryptString(data, key);
		}

		if (typeof data === 'object' && data !== null) {
			const encrypted = { ...data };
			const fieldsToEncrypt = this.ENCRYPTED_FIELDS[data._storeName] || [];
			
			for (const field of fieldsToEncrypt) {
				if (encrypted[field] !== undefined && encrypted[field] !== null) {
					const serialized = this._serializeEncryptedFieldValue(encrypted[field]);
					encrypted[field] = await this._encryptString(serialized, key);
					encrypted[`_${field}Encrypted`] = true;
				}
			}
			
			return encrypted;
		}

		return data;
	},

	async decryptData(data, key) {
		if (!key || !window.EphemeraCrypto) {
			return data;
		}

		if (typeof data === 'object' && data !== null) {
			const decrypted = { ...data };
			
			for (const field of Object.keys(decrypted)) {
				if (field.endsWith('Encrypted') && decrypted[field] === true) {
					const actualField = field.replace('_encrypted', '').replace('Encrypted', '').replace(/^_/, '');
					
					if (decrypted[actualField] && typeof decrypted[actualField] === 'string') {
						const decryptedValue = await this._decryptString(decrypted[actualField], key);
						if (decryptedValue !== null) {
							decrypted[actualField] = this._deserializeEncryptedFieldValue(decryptedValue);
						}
					}
					
					delete decrypted[field];
				}
			}
			
			return decrypted;
		}

		return data;
	},

	async transaction(storeName, mode, callback) {
		if (!this.db) {
			throw new Error('Storage not initialized for active profile');
		}

		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction(storeName, mode);
			const store = transaction.objectStore(storeName);
			const request = callback(store);
			
			if (request) {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			} else {
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
			}
		});
	},

	async get(storeName, key) {
		const result = await this.transaction(storeName, 'readonly', store => store.get(key));
		
		if (result && this.shouldEncrypt(storeName, key)) {
			const encryptionKey = this._getEncryptionKey();
			if (encryptionKey) {
				return await this.decryptData(result, encryptionKey);
			}
		}
		
		return result;
	},

	async put(storeName, data) {
		const key = data.path || data.id || data.key;
		const requiresEncryption = this.shouldEncrypt(storeName, key);
		const sessionLocked = window.EphemeraSession?.isLocked?.();

		if (requiresEncryption && sessionLocked) {
			if (this.STRICT_ENCRYPTION_MODE) {
				throw new Error(`Cannot write encrypted data while session is locked: ${storeName}/${key}`);
			}
			return this._queueWrite(storeName, data, key);
		}

		return this._executePut(storeName, data);
	},

	async _executePut(storeName, data) {
		const key = data.path || data.id || data.key;
		const encryptionKey = this._getEncryptionKey();
		let dataToStore = { ...data };

		if (encryptionKey && this.shouldEncrypt(storeName, key)) {
			dataToStore = await this.encryptData({ ...data, _storeName: storeName }, encryptionKey);
			delete dataToStore._storeName;
		}

		return this.transaction(storeName, 'readwrite', store => store.put(dataToStore));
	},

	_queueWrite(storeName, data, key) {
		return new Promise((resolve, reject) => {
			this._writeQueue.pending.push({ storeName, data: { ...data }, key, resolve, reject, timestamp: Date.now() });
			console.info(`[EphemeraStorage] Queued write for ${storeName}/${key} (session locked)`);
		});
	},

	async processQueuedWrites() {
		if (this._writeQueue.isProcessing || this._writeQueue.pending.length === 0) return;

		this._writeQueue.isProcessing = true;
		const toProcess = [...this._writeQueue.pending];
		this._writeQueue.pending = [];

		console.info(`[EphemeraStorage] Processing ${toProcess.length} queued writes`);

		for (const op of toProcess) {
			try {
				const result = await this._executePut(op.storeName, op.data);
				op.resolve(result);
			} catch (error) {
				console.error(`[EphemeraStorage] Queued write failed for ${op.storeName}/${op.key}:`, error);
				op.reject(error);
			}
		}

		this._writeQueue.isProcessing = false;
	},

	async delete(storeName, key) {
		return this.transaction(storeName, 'readwrite', store => store.delete(key));
	},

	async getAll(storeName) {
		const results = await this.transaction(storeName, 'readonly', store => store.getAll());
		
		const encryptionKey = this._getEncryptionKey();
		if (encryptionKey && this.ENCRYPTED_FIELDS[storeName]) {
			const decrypted = [];
			for (const item of results) {
				decrypted.push(await this.decryptData(item, encryptionKey));
			}
			return decrypted;
		}
		
		return results;
	},

	async clear(storeName) {
		return this.transaction(storeName, 'readwrite', store => store.clear());
	},

	async getByIndex(storeName, indexName, value) {
		return new Promise((resolve, reject) => {
			const transaction = this.db.transaction(storeName, 'readonly');
			const store = transaction.objectStore(storeName);
			const index = store.index(indexName);
			const request = index.getAll(value);
			request.onsuccess = async () => {
				let results = request.result;
				
				const encryptionKey = this._getEncryptionKey();
				if (encryptionKey && this.ENCRYPTED_FIELDS[storeName]) {
					const decrypted = [];
					for (const item of results) {
						decrypted.push(await this.decryptData(item, encryptionKey));
					}
					results = decrypted;
				}
				
				resolve(results);
			};
			request.onerror = () => reject(request.error);
		});
	},

	async getEncrypted(storeName, key) {
		const result = await this.transaction(storeName, 'readonly', store => store.get(key));
		return result;
	},

	async putEncrypted(storeName, data, encryptionKey) {
		if (!encryptionKey) {
			throw new Error('Encryption key required');
		}

		let dataToStore = { ...data };
		
		if (this.ENCRYPTED_FIELDS[storeName]) {
			dataToStore = await this.encryptData({ ...data, _storeName: storeName }, encryptionKey);
			delete dataToStore._storeName;
		}
		
		return this.transaction(storeName, 'readwrite', store => store.put(dataToStore));
	},

	async migrateToEncryption(encryptionKey) {
		if (!encryptionKey) {
			console.warn('[EphemeraStorage] No encryption key provided for migration');
			return;
		}

		console.info('[EphemeraStorage] Starting encryption migration...');

		try {
			for (const storeName of Object.keys(this.ENCRYPTED_FIELDS)) {
				const rawData = await this.transaction(storeName, 'readonly', store => store.getAll());
				
				for (const item of rawData) {
					const key = item.path || item.id || item.key;
					
					if (this.shouldEncrypt(storeName, key)) {
						let needsEncryption = false;
						
						for (const field of this.ENCRYPTED_FIELDS[storeName]) {
							if (item[field] !== undefined && !item[`_${field}Encrypted`]) {
								if (typeof item[field] === 'string' && !item[field].startsWith('enc:')) {
									needsEncryption = true;
									break;
								}
							}
						}
						
						if (needsEncryption) {
							const encrypted = await this.encryptData({ ...item, _storeName: storeName }, encryptionKey);
							delete encrypted._storeName;
							await this.transaction(storeName, 'readwrite', store => store.put(encrypted));
						}
					}
				}
			}

			const metadataKeys = await this.transaction('metadata', 'readonly', store => store.getAllKeys());
			for (const key of metadataKeys) {
				if (this.shouldEncrypt('metadata', key)) {
					const item = await this.transaction('metadata', 'readonly', store => store.get(key));
					if (item && item.value && !item.value.startsWith?.('enc:')) {
						const encrypted = await this._encryptString(item.value, encryptionKey);
						await this.transaction('metadata', 'readwrite', store => 
							store.put({ key, value: encrypted, encrypted: true })
						);
					}
				}
			}

			console.info('[EphemeraStorage] Encryption migration completed');
		} catch (e) {
			console.error('[EphemeraStorage] Migration failed:', e);
			throw e;
		}
	},

	async getStorageEstimate() {
		if (navigator.storage && navigator.storage.estimate) {
			return await navigator.storage.estimate();
		}
		return { quota: 0, usage: 0 };
	},

	isAvailable() {
		return !!this.db;
	},

	// ===== Health Check & Recovery =====

	HEALTH_CHECK_KEY: 'ephemera_last_healthy',

	/**
	 * Perform comprehensive health check on IndexedDB
	 * @returns {Promise<{healthy: boolean, errors: string[], canRecover: boolean}>}
	 */
	async healthCheck() {
		const result = {
			healthy: true,
			errors: [],
			canRecover: false,
			details: {}
		};

		// 1. Check if IndexedDB is available
		if (!window.indexedDB) {
			result.healthy = false;
			result.errors.push('IndexedDB is not available in this browser');
			return result;
		}

		// 2. Try to open the database
		let testDb = null;
		try {
			testDb = await this._openDbForHealthCheck();
			result.details.dbOpened = true;
		} catch (e) {
			result.healthy = false;
			result.errors.push(`Failed to open database: ${e.message}`);
			return result;
		}

		// 3. Check all required object stores exist
		const requiredStores = ['files', 'apps', 'metadata', 'fileVersions'];
		for (const storeName of requiredStores) {
			if (!testDb.objectStoreNames.contains(storeName)) {
				result.healthy = false;
				result.errors.push(`Missing object store: ${storeName}`);
			}
		}
		result.details.storesPresent = requiredStores.filter(s => testDb.objectStoreNames.contains(s));

		if (!result.healthy) {
			result.canRecover = true; // Can recreate stores via version upgrade
			return result;
		}

		// 4. Test read/write capability
		try {
			await this._testReadWrite(testDb);
			result.details.readWrite = true;
		} catch (e) {
			result.healthy = false;
			result.errors.push(`Read/write test failed: ${e.message}`);
			result.canRecover = false; // Data may be corrupted
			return result;
		}

		// 5. Update last healthy timestamp
		this._setLastHealthy();

		return result;
	},

	async _openDbForHealthCheck() {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);
			request.onupgradeneeded = (event) => {
				// Ensure stores exist during health check
				const db = event.target.result;
				if (!db.objectStoreNames.contains('files')) {
					db.createObjectStore('files', { keyPath: 'path' });
				}
				if (!db.objectStoreNames.contains('apps')) {
					db.createObjectStore('apps', { keyPath: 'id' });
				}
				if (!db.objectStoreNames.contains('metadata')) {
					db.createObjectStore('metadata', { keyPath: 'key' });
				}
				if (!db.objectStoreNames.contains('fileVersions')) {
					db.createObjectStore('fileVersions', { keyPath: 'id' });
				}
			};
		});
	},

	async _testReadWrite(db) {
		return new Promise((resolve, reject) => {
			try {
				const transaction = db.transaction('metadata', 'readwrite');
				const store = transaction.objectStore('metadata');
				const testKey = '__health_check_test__';
				const testValue = { key: testKey, value: Date.now().toString() };

				const putRequest = store.put(testValue);
				putRequest.onerror = () => reject(new Error('Failed to write test data'));

				const getRequest = store.get(testKey);
				getRequest.onsuccess = () => {
					if (getRequest.result && getRequest.result.value === testValue.value) {
						// Clean up test data
						store.delete(testKey);
						resolve(true);
					} else {
						reject(new Error('Read data does not match written data'));
					}
				};
				getRequest.onerror = () => reject(new Error('Failed to read test data'));
			} catch (e) {
				reject(e);
			}
		});
	},

	_setLastHealthy() {
		try {
			localStorage.setItem(this.HEALTH_CHECK_KEY, Date.now().toString());
		} catch {
			// localStorage may be unavailable
		}
	},

	getLastHealthy() {
		try {
			const timestamp = localStorage.getItem(this.HEALTH_CHECK_KEY);
			return timestamp ? parseInt(timestamp, 10) : null;
		} catch {
			return null;
		}
	},

	/**
	 * Attempt to recover database by recreating it
	 * @returns {Promise<{success: boolean, error?: string}>}
	 */
	async recoverDatabase() {
		try {
			// Close existing connection
			if (this.db) {
				this.db.close();
				this.db = null;
			}

			// Delete the corrupted database
			await new Promise((resolve, reject) => {
				const request = indexedDB.deleteDatabase(this.dbName);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
				request.onblocked = () => {
					// Force close any remaining connections
					console.warn('[EphemeraStorage] Database deletion blocked, retrying...');
				};
			});

			// Reopen with fresh schema
			await this._openDb();
			this._setLastHealthy();

			return { success: true };
		} catch (e) {
			return { success: false, error: e.message };
		}
	},

	/**
	 * Export all recoverable data before recovery
	 * @returns {Promise<{files: Array, apps: Array, metadata: Array, fileVersions: Array}>}
	 */
	async exportRecoverableData() {
		const data = { files: [], apps: [], metadata: [], fileVersions: [] };

		try {
			// Try to read each store
			for (const storeName of ['files', 'apps', 'metadata', 'fileVersions']) {
				try {
					if (this.db && this.db.objectStoreNames.contains(storeName)) {
						data[storeName] = await new Promise((resolve) => {
							const transaction = this.db.transaction(storeName, 'readonly');
							const store = transaction.objectStore(storeName);
							const request = store.getAll();
							request.onsuccess = () => resolve(request.result || []);
							request.onerror = () => resolve([]); // Return empty on error
						});
					}
				} catch {
					// Continue with other stores
				}
			}
		} catch (e) {
			console.error('[EphemeraStorage] Export recovery data failed:', e);
		}

		return data;
	}
};

window.EphemeraStorage = EphemeraStorage;
export default EphemeraStorage;
