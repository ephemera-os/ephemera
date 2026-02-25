import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../js/system/dialogs.js';

const EphemeraDialog = window.EphemeraDialog;

describe('EphemeraDialog accessibility behavior', () => {
    beforeEach(() => {
        if (EphemeraDialog.overlay) {
            EphemeraDialog.overlay.remove();
        }
        EphemeraDialog.overlay = null;
        EphemeraDialog.container = null;
        EphemeraDialog._activeDialogCleanup = null;
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    afterEach(() => {
        EphemeraDialog.close();
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('traps tab focus inside dialog and restores focus to trigger on close', async () => {
        const trigger = document.createElement('button');
        trigger.textContent = 'Open Dialog';
        document.body.appendChild(trigger);
        trigger.focus();

        const confirmPromise = EphemeraDialog.confirm('Proceed with operation?', 'Confirm');

        await vi.advanceTimersByTimeAsync(60);
        const buttons = Array.from(EphemeraDialog.container.querySelectorAll('.dialog-btn'));
        expect(buttons.length).toBe(2);
        expect(document.activeElement).toBe(buttons[1]);

        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true
        }));
        expect(document.activeElement).toBe(buttons[0]);

        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: true,
            bubbles: true
        }));
        expect(document.activeElement).toBe(buttons[1]);

        buttons[0].click();
        await expect(confirmPromise).resolves.toBe(false);
        expect(document.activeElement).toBe(trigger);
    });

    it('focuses prompt input and supports Escape cancellation', async () => {
        const trigger = document.createElement('button');
        trigger.textContent = 'Open Prompt';
        document.body.appendChild(trigger);
        trigger.focus();

        const promptPromise = EphemeraDialog.prompt('Your name?', '', 'Input', 'Type here');

        await vi.advanceTimersByTimeAsync(60);
        const input = document.getElementById('dialog-input');
        expect(document.activeElement).toBe(input);

        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true
        }));

        await expect(promptPromise).resolves.toBe(false);
        expect(document.activeElement).toBe(trigger);
    });

    it('submits prompt on Enter without bubbling to document handlers and restores focus after key cycle', async () => {
        const trigger = document.createElement('button');
        trigger.textContent = 'New File';
        document.body.appendChild(trigger);
        trigger.focus();

        let enterBubbles = 0;
        const onDocKeydown = (event) => {
            if (event.key === 'Enter') enterBubbles++;
        };
        document.addEventListener('keydown', onDocKeydown);

        const promptPromise = EphemeraDialog.prompt('File name?', 'notes.txt', 'New File', 'e.g., script.js');

        await vi.advanceTimersByTimeAsync(60);
        const input = document.getElementById('dialog-input');
        expect(document.activeElement).toBe(input);

        input.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true
        }));

        await expect(promptPromise).resolves.toBe('notes.txt');
        expect(enterBubbles).toBe(0);

        // Focus restoration is deferred for Enter-submit to avoid accidental retrigger on keyup.
        expect(document.activeElement).not.toBe(trigger);
        await vi.advanceTimersByTimeAsync(0);
        expect(document.activeElement).toBe(trigger);

        document.removeEventListener('keydown', onDocKeydown);
    });
});
