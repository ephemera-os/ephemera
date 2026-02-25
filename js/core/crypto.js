const EphemeraCrypto = {
    PBKDF2_ITERATIONS: 600000,
    SALT_LENGTH: 16,
    TOKEN_LENGTH: 32,
    KEY_LENGTH: 256,
    _exportedKeyCache: typeof WeakMap === 'function' ? new WeakMap() : null,

    generateSalt() {
        const salt = new Uint8Array(this.SALT_LENGTH);
        crypto.getRandomValues(salt);
        return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    generateToken() {
        const token = new Uint8Array(this.TOKEN_LENGTH);
        crypto.getRandomValues(token);
        return Array.from(token).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async hash(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = new Uint8Array(hashBuffer);
        return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async hashPassword(password) {
        const salt = this.generateSalt();
        const saltBytes = new Uint8Array(salt.match(/.{2}/g).map(byte => parseInt(byte, 16)));
        
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveBits']
        );
        
        const hashBuffer = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltBytes,
                iterations: this.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );
        
        const hashArray = new Uint8Array(hashBuffer);
        const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
        
        return {
            hash: hashHex,
            salt: salt,
            algorithm: 'pbkdf2-sha256',
            iterations: this.PBKDF2_ITERATIONS,
            createdAt: Date.now()
        };
    },

    async verifyPassword(password, storedHash) {
        if (!storedHash || !storedHash.salt || !storedHash.hash) {
            return false;
        }
        
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const saltBytes = new Uint8Array(storedHash.salt.match(/.{2}/g).map(byte => parseInt(byte, 16)));
        
        const iterations = storedHash.iterations || this.PBKDF2_ITERATIONS;
        
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveBits']
        );
        
        const hashBuffer = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltBytes,
                iterations: iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );
        
        const hashArray = new Uint8Array(hashBuffer);
        const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
        
        return await this.constantTimeEquals(hashHex, storedHash.hash);
    },

    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const saltBytes = typeof salt === 'string' 
            ? new Uint8Array(salt.match(/.{2}/g).map(byte => parseInt(byte, 16)))
            : salt;
        
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveKey']
        );
        
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: saltBytes,
                iterations: this.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: this.KEY_LENGTH },
            true,
            ['encrypt', 'decrypt']
        );
    },

    async exportRawKeyBase64(key) {
        if (!key || !crypto?.subtle) {
            return null;
        }

        if (this._exportedKeyCache?.has(key)) {
            return this._exportedKeyCache.get(key);
        }

        try {
            const raw = await crypto.subtle.exportKey('raw', key);
            const base64 = this.arrayBufferToBase64(raw);
            this._exportedKeyCache?.set(key, base64);
            return base64;
        } catch (_error) {
            return null;
        }
    },

    async encrypt(data, key) {
        if (data === null || data === undefined) {
            return null;
        }
        
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(typeof data === 'string' ? data : JSON.stringify(data));
        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            dataBuffer
        );
        
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.length);
        
        return 'enc:' + this.arrayBufferToBase64(combined);
    },

    async encryptBytes(bytes, key) {
        if (bytes === null || bytes === undefined) {
            return null;
        }

        let data = bytes;
        if (data instanceof ArrayBuffer) {
            data = new Uint8Array(data);
        } else if (ArrayBuffer.isView(data) && !(data instanceof Uint8Array)) {
            data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }

        if (!(data instanceof Uint8Array)) {
            throw new Error('encryptBytes requires Uint8Array/ArrayBuffer input');
        }

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.length);

        return 'encb:' + this.arrayBufferToBase64(combined);
    },

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, chunk);
        }
        return btoa(binary);
    },

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    },

    async decrypt(ciphertext, key) {
        if (!ciphertext || !ciphertext.startsWith('enc:')) {
            return ciphertext;
        }
        
        try {
            const data = this.base64ToArrayBuffer(ciphertext.slice(4));
            const iv = data.slice(0, 12);
            const encrypted = data.slice(12);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            const text = decoder.decode(decrypted);
            
            return text;
        } catch (e) {
            console.error('[EphemeraCrypto] Decryption failed:', e);
            return null;
        }
    },

    async decryptBytes(ciphertext, key) {
        if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.startsWith('encb:')) {
            return null;
        }

        try {
            const data = this.base64ToArrayBuffer(ciphertext.slice(5));
            const iv = data.slice(0, 12);
            const encrypted = data.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                encrypted
            );

            return new Uint8Array(decrypted);
        } catch (e) {
            console.error('[EphemeraCrypto] Byte decryption failed:', e);
            return null;
        }
    },

    async encryptWithPassword(data, password) {
        const salt = this.generateSalt();
        const key = await this.deriveKey(password, salt);
        const encrypted = await this.encrypt(data, key);
        
        return {
            ciphertext: encrypted,
            salt: salt,
            algorithm: 'AES-256-GCM',
            kdf: 'PBKDF2-SHA256',
            kdfIterations: this.PBKDF2_ITERATIONS,
            version: 1
        };
    },

    async encryptBytesWithPassword(bytes, password) {
        const salt = this.generateSalt();
        const key = await this.deriveKey(password, salt);
        const encrypted = await this.encryptBytes(bytes, key);

        return {
            ciphertext: encrypted,
            salt: salt,
            algorithm: 'AES-256-GCM',
            kdf: 'PBKDF2-SHA256',
            kdfIterations: this.PBKDF2_ITERATIONS,
            version: 1,
            encoding: 'bytes'
        };
    },

    async decryptWithPassword(encryptedData, password) {
        if (!encryptedData || !encryptedData.ciphertext || !encryptedData.salt) {
            return null;
        }
        
        const key = await this.deriveKey(password, encryptedData.salt);
        return await this.decrypt(encryptedData.ciphertext, key);
    },

    async decryptBytesWithPassword(encryptedData, password) {
        if (!encryptedData || !encryptedData.ciphertext || !encryptedData.salt) {
            return null;
        }

        const key = await this.deriveKey(password, encryptedData.salt);
        return await this.decryptBytes(encryptedData.ciphertext, key);
    },

    generateVerificationHash() {
        const data = crypto.getRandomValues(new Uint8Array(16));
        return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async constantTimeEquals(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string') {
            return false;
        }
        
        if (a.length !== b.length) {
            return false;
        }
        
        const encoder = new TextEncoder();
        const aBytes = encoder.encode(a);
        const bBytes = encoder.encode(b);
        
        let result = 0;
        for (let i = 0; i < aBytes.length; i++) {
            result |= aBytes[i] ^ bBytes[i];
        }
        
        return result === 0;
    },

    isEncrypted(value) {
        return typeof value === 'string' && value.startsWith('enc:');
    },

    async migrateFromOldEncryption(oldValue, oldKeyGetter, newKey) {
        if (!oldValue) return null;
        
        if (this.isEncrypted(oldValue)) {
            return oldValue;
        }
        
        const oldKey = await oldKeyGetter();
        if (!oldKey) return oldValue;
        
        const decrypted = await this.decrypt(oldValue, oldKey);
        if (decrypted === null) return oldValue;
        
        return await this.encrypt(decrypted, newKey);
    }
};

window.EphemeraCrypto = EphemeraCrypto;
export default EphemeraCrypto;
