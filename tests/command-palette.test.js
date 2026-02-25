import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventsMock, localStorageMock, stateMock } from './setup.js';

import '../js/system/command-palette.js';

const EphemeraCommandPalette = window.EphemeraCommandPalette;

async function flushAsync(iterations = 3) {
    for (let i = 0; i < iterations; i++) {
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

describe('EphemeraCommandPalette', () => {
    beforeEach(() => {
        eventsMock._reset();
        localStorageMock._reset();
        stateMock._reset();
        document.body.innerHTML = '';

        window.EphemeraApps = {
            getAll: vi.fn(() => ([
                { id: 'files', name: 'Files', icon: '<svg></svg>', category: 'system' },
                { id: 'terminal', name: 'Terminal', icon: '<svg></svg>', category: 'development' },
                { id: 'settings', name: 'Settings', icon: '<svg></svg>', category: 'system' }
            ])),
            get: vi.fn((appId) => {
                return {
                    id: appId,
                    icon: '<svg></svg>'
                };
            })
        };

        window.EphemeraWM = {
            open: vi.fn(),
            focusWindow: vi.fn(),
            getWindowsByApp: vi.fn(() => [])
        };
        window.EphemeraSession = {
            lock: vi.fn(),
            logout: vi.fn()
        };
        window.EphemeraBoot = {
            switchWorkspace: vi.fn()
        };
        window.EphemeraSyncManager = {
            syncAll: vi.fn(async () => {})
        };
        window.EphemeraFileAssoc = {
            openFile: vi.fn()
        };
        window.EphemeraFS = {
            search: vi.fn(async () => ([
                {
                    name: 'notes.md',
                    path: '/home/testuser/Documents/notes.md',
                    type: 'file'
                },
                {
                    name: 'Projects',
                    path: '/home/testuser/Documents/Projects',
                    type: 'directory'
                }
            ])),
            isTextFile: vi.fn((path) => String(path).endsWith('.md')),
            getParentDir: vi.fn(() => '/home/testuser/Documents'),
            getIcon: vi.fn(() => '<svg></svg>')
        };

        EphemeraCommandPalette._resetForTests();
    });

    it('opens actions mode and executes selected command', async () => {
        EphemeraCommandPalette.open('actions');
        const input = document.getElementById('command-palette-input');

        input.value = 'terminal';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flushAsync();

        const row = Array.from(document.querySelectorAll('.command-palette-item'))
            .find((node) => node.textContent.includes('Open Terminal'));
        expect(row).toBeTruthy();

        row.click();
        expect(window.EphemeraWM.open).toHaveBeenCalledWith('terminal', {});
    });

    it('opens files mode, searches files, and opens selected file', async () => {
        EphemeraCommandPalette.open('files');
        const input = document.getElementById('command-palette-input');

        input.value = 'notes';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flushAsync(6);

        const row = Array.from(document.querySelectorAll('.command-palette-item'))
            .find((node) => node.textContent.includes('notes.md'));
        expect(row).toBeTruthy();

        row.click();
        expect(window.EphemeraFileAssoc.openFile).toHaveBeenCalledWith('/home/testuser/Documents/notes.md');
    });

    it('registers custom commands through legacy hook', async () => {
        const customAction = vi.fn();
        window.EphemerapalettRegister([{
            id: 'custom:hello',
            title: 'Run Hello Command',
            subtitle: 'custom',
            action: customAction
        }], { source: 'test-suite' });

        EphemeraCommandPalette.open('actions');
        const input = document.getElementById('command-palette-input');
        input.value = 'hello';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flushAsync();

        const row = Array.from(document.querySelectorAll('.command-palette-item'))
            .find((node) => node.textContent.includes('Run Hello Command'));
        expect(row).toBeTruthy();

        row.click();
        expect(customAction).toHaveBeenCalledTimes(1);
    });
});
