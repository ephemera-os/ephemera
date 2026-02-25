import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../js/system/ai-assistant.js';

const EphemeraAIAssistant = window.EphemeraAIAssistant;

async function flushAsync(iterations = 4) {
    for (let i = 0; i < iterations; i++) {
        await Promise.resolve();
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

describe('EphemeraAIAssistant', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();

        window.EphemeraState.activeWindowId = 42;
        window.EphemeraState.windows = [
            { id: 42, appId: 'code', app: { name: 'Code Editor' } }
        ];

        window.EphemeraWM = {
            getWindow: vi.fn((id) => window.EphemeraState.windows.find(w => w.id === id)),
            open: vi.fn()
        };

        window.EphemeraFS = {
            homeDir: '/home/testuser',
            ensureDir: vi.fn(async () => {}),
            writeFile: vi.fn(async () => {})
        };

        window.EphemeraAI = {
            isConfigured: vi.fn(async () => true),
            getDefaultModel: vi.fn(() => 'openrouter/free'),
            chat: vi.fn(async () => 'AI result')
        };

        Object.defineProperty(window.navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn(async () => {}) }
        });

        EphemeraAIAssistant._resetForTests();
        EphemeraAIAssistant.init();
    });

    afterEach(() => {
        EphemeraAIAssistant._resetForTests();
    });

    it('includes active window context from provider in AI request', async () => {
        EphemeraAIAssistant.registerContextProvider(42, () => ({
            appId: 'code',
            appName: 'Code Editor',
            filePath: '/home/testuser/Documents/demo.js',
            fileContent: 'const answer = 42;',
            selectedText: 'answer'
        }));

        EphemeraAIAssistant.open();
        document.getElementById('ea-input').value = 'Summarize this file';
        document.getElementById('ea-send').click();
        await flushAsync();

        expect(window.EphemeraAI.chat).toHaveBeenCalledTimes(1);
        const [messages, model] = window.EphemeraAI.chat.mock.calls[0];
        const userMessage = messages.find(m => m.role === 'user')?.content || '';
        expect(userMessage).toContain('/home/testuser/Documents/demo.js');
        expect(userMessage).toContain('const answer = 42;');
        expect(userMessage).toContain('Selected text');
        expect(model).toBe('openrouter/free');
        expect(document.getElementById('ea-result').textContent).toContain('AI result');
    });

    it('inserts AI output through active context insert handler', async () => {
        const insertSpy = vi.fn(() => true);
        window.EphemeraAI.chat = vi.fn(async () => 'Patched code');
        EphemeraAIAssistant.registerContextProvider(42, () => ({
            appId: 'code',
            appName: 'Code Editor',
            filePath: '/home/testuser/Documents/demo.js',
            fileContent: 'const broken = true;',
            selectedText: '',
            insert: insertSpy
        }));

        EphemeraAIAssistant.open();
        document.getElementById('ea-input').value = 'Fix this code';
        document.getElementById('ea-send').click();
        await flushAsync();

        document.getElementById('ea-insert').click();
        await flushAsync();

        expect(insertSpy).toHaveBeenCalledTimes(1);
        expect(insertSpy).toHaveBeenCalledWith('Patched code');
    });

    it('saves AI output to a new file and opens it in Notepad', async () => {
        window.EphemeraAI.chat = vi.fn(async () => 'Checklist:\n- item one');

        EphemeraAIAssistant.open();
        document.getElementById('ea-input').value = 'Create a to-do from this email';
        document.getElementById('ea-send').click();
        await flushAsync();

        document.getElementById('ea-save').click();
        await flushAsync();

        expect(window.EphemeraFS.ensureDir).toHaveBeenCalledWith('/home/testuser/Documents');
        expect(window.EphemeraFS.writeFile).toHaveBeenCalledTimes(1);
        const [savedPath, savedContent] = window.EphemeraFS.writeFile.mock.calls[0];
        expect(savedPath).toMatch(/^\/home\/testuser\/Documents\/ai-quick-action-\d+\.md$/);
        expect(savedContent).toContain('Checklist');
        expect(window.EphemeraWM.open).toHaveBeenCalledWith('notepad', { filePath: savedPath });
    });

    it('supports file query with recency filter and renders AI preview summary', async () => {
        const now = Date.now();
        const weekStart = (() => {
            const d = new Date(now);
            const weekday = (d.getDay() + 6) % 7;
            d.setDate(d.getDate() - weekday);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        })();
        const recentModifiedAt = Math.min(now - 1000, weekStart + (2 * 60 * 60 * 1000));
        const oldModifiedAt = weekStart - (2 * 24 * 60 * 60 * 1000);

        window.EphemeraFS = {
            homeDir: '/home/testuser',
            normalizePath: (path) => String(path || '').replace(/\/{2,}/g, '/'),
            readdir: vi.fn(async (path) => {
                if (path === '/home/testuser') {
                    return [
                        { type: 'directory', path: '/home/testuser/Documents', name: 'Documents' }
                    ];
                }
                if (path === '/home/testuser/Documents') {
                    return [
                        {
                            type: 'file',
                            path: '/home/testuser/Documents/auth-service.js',
                            name: 'auth-service.js',
                            extension: 'js',
                            modifiedAt: recentModifiedAt,
                            size: 1250
                        },
                        {
                            type: 'file',
                            path: '/home/testuser/Documents/auth-legacy.js',
                            name: 'auth-legacy.js',
                            extension: 'js',
                            modifiedAt: oldModifiedAt,
                            size: 980
                        }
                    ];
                }
                return [];
            }),
            readFile: vi.fn(async (path) => {
                if (path.endsWith('auth-service.js')) {
                    return 'const token = createJwt(); // authentication flow';
                }
                if (path.endsWith('auth-legacy.js')) {
                    return 'legacy auth adapter';
                }
                return '';
            }),
            isTextFile: vi.fn(() => true),
            getExtension: vi.fn((path) => String(path).split('.').pop() || ''),
            getBasename: vi.fn((path) => String(path).split('/').pop() || ''),
            getParentDir: vi.fn(() => '/home/testuser/Documents'),
            ensureDir: vi.fn(async () => {}),
            writeFile: vi.fn(async () => {})
        };

        window.EphemeraAI.rankFileSearchCandidates = vi.fn(async (query, candidates) => {
            expect(query).toContain('authentication');
            return candidates;
        });
        window.EphemeraAI.summarizeFilePreview = vi.fn(async () =>
            '- Contains authentication token handling\n- Matches query via JWT/session logic\n- Next: open and validate middleware'
        );

        EphemeraAIAssistant.open();
        document.getElementById('ea-input').value = 'Find files I edited this week about authentication';
        document.getElementById('ea-send').click();
        await flushAsync(8);

        expect(document.getElementById('ea-result').textContent).toContain('Found 1 file');
        expect(document.getElementById('ea-file-results').textContent).toContain('auth-service.js');
        expect(document.getElementById('ea-file-results').textContent).not.toContain('auth-legacy.js');
        expect(window.EphemeraAI.summarizeFilePreview).toHaveBeenCalledTimes(1);
        expect(document.getElementById('ea-file-preview-summary').textContent).toContain('token handling');
    });

    it('opens selected file from file query preview pane', async () => {
        window.EphemeraFS = {
            homeDir: '/home/testuser',
            normalizePath: (path) => String(path || '').replace(/\/{2,}/g, '/'),
            readdir: vi.fn(async (path) => {
                if (path === '/home/testuser') {
                    return [{ type: 'directory', path: '/home/testuser/Documents', name: 'Documents' }];
                }
                if (path === '/home/testuser/Documents') {
                    return [{
                        type: 'file',
                        path: '/home/testuser/Documents/auth.md',
                        name: 'auth.md',
                        extension: 'md',
                        modifiedAt: Date.now(),
                        size: 320
                    }];
                }
                return [];
            }),
            readFile: vi.fn(async () => 'Authentication notes'),
            isTextFile: vi.fn(() => true),
            getExtension: vi.fn(() => 'md'),
            getBasename: vi.fn(() => 'auth.md'),
            getParentDir: vi.fn(() => '/home/testuser/Documents'),
            ensureDir: vi.fn(async () => {}),
            writeFile: vi.fn(async () => {})
        };
        window.EphemeraFileAssoc = { openFile: vi.fn() };
        window.EphemeraAI.summarizeFilePreview = vi.fn(async () => '- summary');

        EphemeraAIAssistant.open();
        document.getElementById('ea-input').value = 'Find files about authentication';
        document.getElementById('ea-send').click();
        await flushAsync(8);

        document.getElementById('ea-file-open').click();
        await flushAsync();

        expect(window.EphemeraFileAssoc.openFile).toHaveBeenCalledWith('/home/testuser/Documents/auth.md');
    });

    it('builds, installs, scaffolds, and opens an app from natural language', async () => {
        window.EphemeraBoot = { updateStartMenu: vi.fn() };
        window.EphemeraApps = {
            VALID_PERMISSIONS: ['fs', 'network', 'events', 'windows', 'notifications', 'dialogs', 'storage'],
            createManifestTemplate: vi.fn(() => ({
                id: 'com.user.myapp',
                name: 'My App',
                version: '1.0.0',
                description: '',
                icon: '',
                category: 'user',
                permissions: [],
                window: { width: 600, height: 420, resizable: true, minWidth: 320, minHeight: 240 },
                singleton: false
            })),
            installApp: vi.fn(async (manifest, code) => ({ ...manifest, code }))
        };
        window.EphemeraValidate = {
            isValidAppManifest: vi.fn(() => ({ valid: true, errors: [] })),
            isValidAppCode: vi.fn(() => ({ valid: true }))
        };
        window.EphemeraAI.buildAppFromPrompt = vi.fn(async () => ({
            manifest: {
                id: 'habit tracker',
                name: 'Habit Tracker',
                description: 'Track habits and streaks',
                category: 'productivity',
                permissions: ['storage'],
                window: { width: 760, height: 560 }
            },
            code: 'container.innerHTML = "<div>Habit tracker app</div>";'
        }));

        EphemeraAIAssistant.open();
        document.getElementById('ea-input').value = 'Build me a habit tracker with a streak counter';
        document.getElementById('ea-send').click();
        await flushAsync(8);

        expect(window.EphemeraAI.buildAppFromPrompt).toHaveBeenCalledTimes(1);
        expect(window.EphemeraApps.installApp).toHaveBeenCalledTimes(1);
        const [manifestArg, codeArg] = window.EphemeraApps.installApp.mock.calls[0];
        expect(manifestArg.id).toBe('com.user.habit-tracker');
        expect(manifestArg.name).toBe('Habit Tracker');
        expect(manifestArg.permissions).toEqual(['storage']);
        expect(codeArg).toContain('Habit tracker app');
        expect(window.EphemeraFS.writeFile).toHaveBeenCalledWith('/home/testuser/apps/habit-tracker/app.json', expect.any(String));
        expect(window.EphemeraFS.writeFile).toHaveBeenCalledWith('/home/testuser/apps/habit-tracker/app.js', expect.any(String));
        expect(window.EphemeraWM.open).toHaveBeenCalledWith('com.user.habit-tracker');
        expect(document.getElementById('ea-result').textContent).toContain('Built and installed');
    });

    it('replaces unsafe generated wrapper code with safe fallback scaffold', async () => {
        window.EphemeraApps = {
            VALID_PERMISSIONS: ['fs', 'network', 'events', 'windows', 'notifications', 'dialogs', 'storage'],
            createManifestTemplate: vi.fn(() => ({
                id: 'com.user.myapp',
                name: 'My App',
                version: '1.0.0',
                description: '',
                icon: '',
                category: 'user',
                permissions: [],
                window: { width: 600, height: 420, resizable: true, minWidth: 320, minHeight: 240 },
                singleton: false
            })),
            installApp: vi.fn(async (manifest, code) => ({ ...manifest, code }))
        };
        window.EphemeraValidate = {
            isValidAppManifest: vi.fn(() => ({ valid: true, errors: [] })),
            isValidAppCode: vi.fn(() => ({ valid: true }))
        };
        window.EphemeraAI.buildAppFromPrompt = vi.fn(async () => ({
            manifest: {
                id: 'unsafe app',
                name: 'Unsafe App',
                category: 'user'
            },
            code: `
EphemeraApps.register({
  id: 'x',
  name: 'x'
});
`
        }));

        EphemeraAIAssistant.open();
        document.getElementById('ea-input').value = 'Build me an app that says hello';
        document.getElementById('ea-send').click();
        await flushAsync(8);

        expect(window.EphemeraApps.installApp).toHaveBeenCalledTimes(1);
        const [, codeArg] = window.EphemeraApps.installApp.mock.calls[0];
        expect(codeArg).not.toContain('EphemeraApps.register');
        expect(codeArg).toContain('ai-built-app');
    });
});
