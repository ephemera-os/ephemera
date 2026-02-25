import EphemeraStorage from '../js/core/storage.js';

describe('EphemeraStorage crypto worker integration', () => {
    let originalCrypto;
    let originalWorker;
    let originalFields;

    beforeEach(() => {
        originalCrypto = window.EphemeraCrypto;
        originalWorker = window.EphemeraCryptoWorker;
        originalFields = EphemeraStorage.ENCRYPTED_FIELDS;

        EphemeraStorage.ENCRYPTED_FIELDS = {
            files: ['content'],
            fileVersions: [],
            apps: ['code'],
            metadata: ['value']
        };

        window.EphemeraCrypto = {
            encrypt: vi.fn(async (text) => `enc:main:${text}`),
            decrypt: vi.fn(async (ciphertext) => {
                if (typeof ciphertext === 'string' && ciphertext.startsWith('enc:main:')) {
                    return ciphertext.slice('enc:main:'.length);
                }
                return 'main-decoded';
            })
        };
    });

    afterEach(() => {
        window.EphemeraCrypto = originalCrypto;
        window.EphemeraCryptoWorker = originalWorker;
        EphemeraStorage.ENCRYPTED_FIELDS = originalFields;
    });

    it('uses worker encrypt path when available', async () => {
        window.EphemeraCryptoWorker = {
            encrypt: vi.fn(async () => 'enc:worker'),
            decrypt: vi.fn(async () => 'worker-decoded')
        };

        const key = {};
        const encrypted = await EphemeraStorage.encryptData(
            { _storeName: 'files', content: 'hello' },
            key
        );

        expect(window.EphemeraCryptoWorker.encrypt).toHaveBeenCalledWith('hello', key);
        expect(window.EphemeraCrypto.encrypt).not.toHaveBeenCalled();
        expect(encrypted.content).toBe('enc:worker');
        expect(encrypted._contentEncrypted).toBe(true);
    });

    it('falls back to main-thread encrypt when worker fails', async () => {
        window.EphemeraCryptoWorker = {
            encrypt: vi.fn(async () => {
                throw new Error('worker unavailable');
            })
        };

        const encrypted = await EphemeraStorage.encryptData(
            { _storeName: 'files', content: 'hello' },
            {}
        );

        expect(window.EphemeraCrypto.encrypt).toHaveBeenCalledWith('hello', {});
        expect(encrypted.content).toBe('enc:main:hello');
    });

    it('uses worker decrypt path when available', async () => {
        window.EphemeraCryptoWorker = {
            encrypt: vi.fn(),
            decrypt: vi.fn(async () => 'worker-decoded')
        };

        const decrypted = await EphemeraStorage.decryptData(
            { content: 'enc:worker', _contentEncrypted: true },
            {}
        );

        expect(window.EphemeraCryptoWorker.decrypt).toHaveBeenCalledWith('enc:worker', {});
        expect(window.EphemeraCrypto.decrypt).not.toHaveBeenCalled();
        expect(decrypted.content).toBe('worker-decoded');
        expect(decrypted._contentEncrypted).toBeUndefined();
    });

    it('falls back to main-thread decrypt when worker throws', async () => {
        window.EphemeraCryptoWorker = {
            encrypt: vi.fn(),
            decrypt: vi.fn(async () => {
                throw new Error('worker unavailable');
            })
        };

        const decrypted = await EphemeraStorage.decryptData(
            { content: 'enc:main:hello', _contentEncrypted: true },
            {}
        );

        expect(window.EphemeraCrypto.decrypt).toHaveBeenCalledWith('enc:main:hello', {});
        expect(decrypted.content).toBe('hello');
    });

    it('round-trips ArrayBuffer encrypted field values', async () => {
        const source = new Uint8Array([0, 1, 2, 253, 254, 255]).buffer;
        const encrypted = await EphemeraStorage.encryptData(
            { _storeName: 'files', content: source },
            {}
        );

        const decrypted = await EphemeraStorage.decryptData(
            { content: encrypted.content, _contentEncrypted: true },
            {}
        );

        expect(decrypted.content).toBeInstanceOf(ArrayBuffer);
        expect(Array.from(new Uint8Array(decrypted.content))).toEqual([0, 1, 2, 253, 254, 255]);
    });

    it('treats REST sync token metadata as sensitive', () => {
        expect(EphemeraStorage.shouldEncrypt('metadata', 'syncRestToken')).toBe(true);
    });
});
