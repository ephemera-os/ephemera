import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../js/system/ai-oauth.js';

const EphemeraAIOAuth = window.EphemeraAIOAuth;

describe('EphemeraAIOAuth device-session flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        EphemeraAIOAuth._resetForTests();
        window.EphemeraEvents = { emit: vi.fn() };
        window.EphemeraNotifications = {
            info: vi.fn(),
            success: vi.fn(),
            error: vi.fn()
        };
    });

    it('connects using device start + poll and stores connected status', async () => {
        const fetchMock = vi.fn(async (url, init = {}) => {
            if (String(url).endsWith('/api/ai-oauth/status')) {
                return {
                    ok: true,
                    json: async () => ({ connected: false, user: null, expiresAt: null, accountId: '' })
                };
            }

            if (String(url).endsWith('/api/ai-oauth/device-start')) {
                expect(init.method).toBe('POST');
                return {
                    ok: true,
                    json: async () => ({
                        verification_url: 'https://auth.openai.com/codex/device',
                        user_code: 'ABCD-EFGH',
                        interval_ms: 1
                    })
                };
            }

            if (String(url).endsWith('/api/ai-oauth/device-poll')) {
                const calls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/api/ai-oauth/device-poll')).length;
                if (calls === 1) {
                    return {
                        ok: true,
                        json: async () => ({ status: 'pending', interval_ms: 1 })
                    };
                }

                return {
                    ok: true,
                    json: async () => ({
                        status: 'authorized',
                        connected: true,
                        user: { name: 'Test User', email: 'user@example.com' },
                        expiresAt: 1234567890000,
                        accountId: 'acct_123'
                    })
                };
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(EphemeraAIOAuth, '_sleep').mockResolvedValue();
        const popupMock = {
            closed: false,
            focus: vi.fn(),
            location: { href: '' }
        };
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(popupMock);

        const status = await EphemeraAIOAuth.connect('chatgpt');

        expect(status.connected).toBe(true);
        expect(status.accountId).toBe('acct_123');
        expect(EphemeraAIOAuth.isConnected('chatgpt')).toBe(true);
        expect(window.EphemeraEvents.emit).toHaveBeenCalledWith('ai:oauth:updated', expect.objectContaining({ connected: true }));
        expect(window.EphemeraNotifications.success).toHaveBeenCalled();
        expect(openSpy).toHaveBeenCalledTimes(1);
        expect(openSpy).toHaveBeenCalledWith('', 'ephemera_ai_device_auth', expect.any(String));
        expect(openSpy.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
        expect(popupMock.location.href).toBe('https://auth.openai.com/codex/device');
    });

    it('fails fast when device poll returns terminal HTTP errors', async () => {
        const fetchMock = vi.fn(async (url) => {
            if (String(url).endsWith('/api/ai-oauth/status')) {
                return {
                    ok: true,
                    json: async () => ({ connected: false, user: null, expiresAt: null, accountId: '' })
                };
            }

            if (String(url).endsWith('/api/ai-oauth/device-start')) {
                return {
                    ok: true,
                    json: async () => ({
                        verification_url: 'https://auth.openai.com/codex/device',
                        user_code: 'ABCD-EFGH',
                        interval_ms: 1
                    })
                };
            }

            if (String(url).endsWith('/api/ai-oauth/device-poll')) {
                return {
                    ok: false,
                    status: 400,
                    json: async () => ({
                        status: 'failed',
                        error: 'missing_device_session',
                        error_description: 'No pending ChatGPT device authorization was found.'
                    })
                };
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        vi.stubGlobal('fetch', fetchMock);
        const sleepSpy = vi.spyOn(EphemeraAIOAuth, '_sleep').mockResolvedValue();
        vi.spyOn(window, 'open').mockReturnValue({ closed: false });

        await expect(EphemeraAIOAuth.connect('chatgpt')).rejects.toThrow('No pending ChatGPT device authorization was found.');

        const pollCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/ai-oauth/device-poll'));
        expect(pollCalls).toHaveLength(1);
        expect(sleepSpy).not.toHaveBeenCalled();
    });

    it('disconnect clears connected status', async () => {
        EphemeraAIOAuth._status.chatgpt = {
            connected: true,
            user: { name: 'Connected User', email: 'user@example.com' },
            expiresAt: Date.now() + 60000,
            accountId: 'acct_live'
        };

        const fetchMock = vi.fn(async (url) => {
            if (String(url).endsWith('/api/ai-oauth/logout')) {
                return {
                    ok: true,
                    json: async () => ({ ok: true, connected: false })
                };
            }

            if (String(url).endsWith('/api/ai-oauth/status')) {
                return {
                    ok: true,
                    json: async () => ({ connected: false, user: null, expiresAt: null, accountId: '' })
                };
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        vi.stubGlobal('fetch', fetchMock);

        await EphemeraAIOAuth.disconnect('chatgpt');

        expect(EphemeraAIOAuth.isConnected('chatgpt')).toBe(false);
        expect(window.EphemeraEvents.emit).toHaveBeenCalledWith('ai:oauth:updated', expect.objectContaining({ connected: false }));
    });
});
