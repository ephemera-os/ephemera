import EphemeraDataManagement from '../js/system/data-management.js';
import '../js/core/crypto.js';

describe('EphemeraDataManagement backup export/import', () => {
    let originalStorage;
    let originalExportWorker;
    let originalCreateObjectURL;
    let originalRevokeObjectURL;
    let anchorClickSpy;

    const createStorageMock = () => ({
        getAll: vi.fn(async (store) => {
            if (store === 'files') {
                return [{
                    path: '/home/testuser/Documents/note.txt',
                    name: 'note.txt',
                    type: 'file',
                    content: 'hello world',
                    size: 11
                }];
            }
            if (store === 'fileVersions') {
                return [{
                    id: 'v1',
                    path: '/home/testuser/Documents/note.txt',
                    content: 'previous'
                }];
            }
            if (store === 'apps') {
                return [{
                    id: 'demo.app',
                    manifest: { id: 'demo.app', name: 'Demo' },
                    code: 'export default {};'
                }];
            }
            return [];
        }),
        get: vi.fn(async (store, key) => {
            if (store !== 'metadata') return null;
            if (key === 'terminal_history') {
                return { key: 'terminal_history', value: ['ls', 'pwd'] };
            }
            return null;
        }),
        put: vi.fn(async () => {})
    });

    beforeEach(() => {
        vi.useFakeTimers();

        originalStorage = window.EphemeraStorage;
        originalExportWorker = window.EphemeraExportWorker;
        originalCreateObjectURL = URL.createObjectURL;
        originalRevokeObjectURL = URL.revokeObjectURL;

        window.EphemeraStorage = createStorageMock();
        window.EphemeraExportWorker = undefined;
        window.EphemeraSession.getUser = vi.fn(() => ({ name: 'Test User', provider: 'password' }));

        URL.createObjectURL = vi.fn(() => 'blob:test-backup');
        URL.revokeObjectURL = vi.fn();
        anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        window.EphemeraNotifications.success.mockReset();
        window.EphemeraNotifications.error.mockReset();
        window.EphemeraTelemetry.addBreadcrumb.mockReset();
        window.EphemeraState.updateSetting.mockClear();
        localStorage.clear();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        anchorClickSpy?.mockRestore();

        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        window.EphemeraStorage = originalStorage;
        window.EphemeraExportWorker = originalExportWorker;
    });

    it('uses export worker and writes compressed backup when available', async () => {
        const workerBytes = new TextEncoder().encode('{"ok":true}');
        window.EphemeraExportWorker = {
            serializeExport: vi.fn(async () => ({
                bytes: workerBytes,
                compressed: true,
                mimeType: 'application/gzip',
                extension: 'json.gz'
            }))
        };

        const encryptSpy = vi.spyOn(window.EphemeraCrypto, 'encryptBytesWithPassword');
        try {
            const result = await EphemeraDataManagement.exportAll({ passphrase: 'correct horse battery staple' });

            expect(window.EphemeraExportWorker.serializeExport).toHaveBeenCalledWith(expect.any(Object), { compress: true });
            expect(encryptSpy.mock.calls.length).toBe(1);
            const [bytesArg, passphraseArg] = encryptSpy.mock.calls[0];
            expect(Object.prototype.toString.call(bytesArg)).toBe('[object Uint8Array]');
            expect(Array.from(bytesArg)).toEqual(Array.from(workerBytes));
            expect(passphraseArg).toBe('correct horse battery staple');

            expect(result.success).toBe(true);
            expect(result.filename).toMatch(/^ephemera-backup-.*\.ephx$/);
            expect(result.compressed).toBe(true);
            expect(result.encrypted).toBe(true);

            expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
            const blob = URL.createObjectURL.mock.calls[0][0];
            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe('application/json');
            expect(anchorClickSpy).toHaveBeenCalledTimes(1);
        } finally {
            encryptSpy.mockRestore();
        }
    });

    it('falls back to plain JSON export when worker serialization fails', async () => {
        window.EphemeraExportWorker = {
            serializeExport: vi.fn(async () => {
                throw new Error('worker unavailable');
            })
        };

        const encryptSpy = vi.spyOn(window.EphemeraCrypto, 'encryptBytesWithPassword');
        try {
            const result = await EphemeraDataManagement.exportAll({ passphrase: 'correct horse battery staple' });

            expect(window.EphemeraExportWorker.serializeExport).toHaveBeenCalledTimes(1);
            expect(encryptSpy.mock.calls.length).toBe(1);
            const [bytesArg, passphraseArg] = encryptSpy.mock.calls[0];
            expect(Object.prototype.toString.call(bytesArg)).toBe('[object Uint8Array]');
            expect(bytesArg.byteLength).toBeGreaterThan(0);
            expect(passphraseArg).toBe('correct horse battery staple');

            expect(result.success).toBe(true);
            expect(result.filename).toMatch(/^ephemera-backup-.*\.ephx$/);
            expect(result.compressed).toBe(false);
            expect(result.encrypted).toBe(true);

            const blob = URL.createObjectURL.mock.calls[0][0];
            expect(blob.type).toBe('application/json');
            expect(blob.size).toBeGreaterThan(0);
        } finally {
            encryptSpy.mockRestore();
        }
    });

    it('rejects legacy plaintext backup files', async () => {
        const legacyBackup = {
            version: '2.0.0',
            exportedAt: '2026-02-20T12:00:00.000Z',
            files: [],
            fileVersions: [],
            apps: [],
            settings: {},
            metadata: {}
        };

        const legacyFile = {
            name: 'ephemera-backup-2026-02-20.json',
            type: 'application/json',
            text: vi.fn(async () => JSON.stringify(legacyBackup))
        };

        const result = await EphemeraDataManagement.importBackup(legacyFile);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/encrypted/i);
    });

    it('imports secure backup envelopes after decryption', async () => {
        const imported = {
            version: '2.0.0',
            exportedAt: '2026-02-20T12:00:00.000Z',
            files: [
                { path: '/home/testuser/Documents/note.txt', content: 'hello world' }
            ],
            fileVersions: [
                { id: 'v1', path: '/home/testuser/Documents/note.txt', content: 'previous' }
            ],
            apps: [
                { id: 'demo.app', manifest: { id: 'demo.app' }, code: 'export default {};' }
            ],
            settings: {
                theme: 'light',
                openaiApiKey: 'should-not-import'
            },
            metadata: {
                terminal_history: { key: 'terminal_history', value: ['ls'] },
                flag: 'ok'
            }
        };

        const decryptSpy = vi
            .spyOn(EphemeraDataManagement, '_decryptSecureExportEnvelope')
            .mockResolvedValue(imported);

        const envelope = {
            type: 'ephemera-secure-export',
            version: 1,
            kind: 'backup',
            exportedAt: '2026-02-20T12:00:00.000Z',
            inner: { compressed: false, mimeType: 'application/json', extension: 'json' },
            payload: { ciphertext: 'encb:fake', salt: '00' }
        };

        const ephxFile = {
            name: 'ephemera-backup-2026-02-20.ephx',
            type: 'application/json',
            text: vi.fn(async () => JSON.stringify(envelope))
        };

        try {
            const result = await EphemeraDataManagement.importBackup(ephxFile, { passphrase: 'secret passphrase' });

            expect(result.success).toBe(true);
            expect(decryptSpy).toHaveBeenCalledTimes(1);
            expect(decryptSpy.mock.calls[0][0]).toEqual(envelope);
            expect(decryptSpy.mock.calls[0][1]).toEqual(expect.objectContaining({
                expectedKind: 'backup',
                passphrase: 'secret passphrase'
            }));

            expect(window.EphemeraStorage.put).toHaveBeenCalledWith('files', expect.objectContaining({
                path: '/home/testuser/Documents/note.txt'
            }));
            expect(window.EphemeraStorage.put).toHaveBeenCalledWith('metadata', expect.objectContaining({
                key: 'flag',
                value: 'ok'
            }));
            expect(window.EphemeraState.updateSetting).toHaveBeenCalledWith('theme', 'light');
            expect(window.EphemeraState.updateSetting).not.toHaveBeenCalledWith('openaiApiKey', expect.anything());
        } finally {
            decryptSpy.mockRestore();
        }
    });
});
