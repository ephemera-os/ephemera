import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../js/system/ai.js';

const EphemeraAI = window.EphemeraAI;

function setProviderKey(provider, key) {
    const meta = EphemeraAI.PROVIDERS?.[provider];
    if (!meta) return;
    window.EphemeraState.updateSetting(meta.apiKeySetting, key);
}

function createStreamResponse(chunks = []) {
    const encoder = new TextEncoder();
    let index = 0;
    return {
        body: {
            getReader() {
                return {
                    read: async () => {
                        if (index >= chunks.length) {
                            return { done: true, value: undefined };
                        }
                        const chunk = encoder.encode(String(chunks[index++] || ''));
                        return { done: false, value: chunk };
                    }
                };
            }
        }
    };
}

describe('EphemeraAI provider routing and usage tracking', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.EphemeraState._reset();
        EphemeraAI.resetSessionUsage();
        EphemeraAI.clearModelCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.EphemeraAIStreamWorker = undefined;
        delete window.EphemeraAIOAuth;
    });

    it('routes chat requests to OpenAI endpoint when provider is openai', async () => {
        window.EphemeraState.updateSetting('aiProvider', 'openai');
        setProviderKey('openai', 'openai-test-key');

        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'OpenAI OK' } }],
                usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 }
            })
        }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await EphemeraAI.chat(
            [{ role: 'user', content: 'ping' }],
            'gpt-4o-mini',
            null,
            { provider: 'openai', bypassRateLimit: true }
        );

        expect(response).toBe('OpenAI OK');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.openai.com/v1/chat/completions');
        expect(options.headers.Authorization).toBe('Bearer openai-test-key');
        expect(options.method).toBe('POST');
    });

    it('routes chatgpt requests through same-origin proxy when session is connected', async () => {
        window.EphemeraState.updateSetting('aiProvider', 'chatgpt');
        window.EphemeraAIOAuth = {
            refreshStatus: vi.fn(async () => ({ connected: true })),
            isConnected: vi.fn(() => true)
        };

        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                content: 'ChatGPT OK',
                usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 }
            })
        }));
        vi.stubGlobal('fetch', fetchMock);

        const response = await EphemeraAI.chat(
            [{ role: 'user', content: 'ping' }],
            'gpt-5.2-codex',
            null,
            { provider: 'chatgpt', bypassRateLimit: true }
        );

        expect(response).toBe('ChatGPT OK');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/ai-oauth/chat');
        expect(options.credentials).toBe('same-origin');
        expect(options.method).toBe('POST');
        expect(String(options.headers.Authorization || '')).toBe('');
    });

    it('returns per-use-case model and falls back safely when default model mismatches provider', () => {
        window.EphemeraState.updateSetting('aiProvider', 'openai');
        window.EphemeraState.updateSetting('aiModel', 'openrouter/free');
        window.EphemeraState.updateSetting('aiModelCode', 'gpt-4o-mini');

        expect(EphemeraAI.getModelForUseCase('code')).toBe('gpt-4o-mini');
        expect(EphemeraAI.getModelForUseCase('chat')).toBe('gpt-4o-mini');
    });

    it('treats connected server auth sessions as configured', async () => {
        window.EphemeraState.updateSetting('aiProvider', 'chatgpt');
        window.EphemeraAIOAuth = {
            refreshStatus: vi.fn(async () => ({ connected: true })),
            isConnected: vi.fn(() => false)
        };

        const configured = await EphemeraAI.isConfigured();

        expect(configured).toBe(true);
        expect(window.EphemeraAIOAuth.refreshStatus).toHaveBeenCalledWith('chatgpt');
        expect(window.EphemeraAIOAuth.isConnected).not.toHaveBeenCalled();
    });

    it('treats status refresh failures as disconnected', async () => {
        window.EphemeraState.updateSetting('aiProvider', 'chatgpt');
        window.EphemeraAIOAuth = {
            refreshStatus: vi.fn(async () => {
                throw new Error('status endpoint unavailable');
            }),
            isConnected: vi.fn(() => true)
        };

        const configured = await EphemeraAI.isConfigured();

        expect(configured).toBe(false);
        expect(window.EphemeraAIOAuth.refreshStatus).toHaveBeenCalledWith('chatgpt');
        expect(window.EphemeraAIOAuth.isConnected).not.toHaveBeenCalled();
    });

    it('caches disconnected chatgpt model lookups to avoid repeated status checks', async () => {
        window.EphemeraState.updateSetting('aiProvider', 'chatgpt');
        const refreshStatus = vi.fn(async () => ({ connected: false }));
        window.EphemeraAIOAuth = {
            refreshStatus,
            isConnected: vi.fn(() => false)
        };
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const firstModels = await EphemeraAI.getModels(false, 'chatgpt');
        const secondModels = await EphemeraAI.getModels(false, 'chatgpt');

        expect(firstModels).toEqual([]);
        expect(secondModels).toEqual([]);
        expect(refreshStatus).toHaveBeenCalledTimes(1);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('tracks and resets session usage counters', async () => {
        window.EphemeraState.updateSetting('aiProvider', 'openrouter');
        setProviderKey('openrouter', 'or-key');

        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'ok' } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
            })
        }));
        vi.stubGlobal('fetch', fetchMock);

        await EphemeraAI.chat([{ role: 'user', content: 'one' }], 'openrouter/free', null, { bypassRateLimit: true });
        await EphemeraAI.chat([{ role: 'user', content: 'two' }], 'openrouter/free', null, { bypassRateLimit: true });

        const usage = EphemeraAI.getSessionUsage();
        expect(usage.requests).toBe(2);
        expect(usage.promptTokens).toBe(20);
        expect(usage.completionTokens).toBe(10);
        expect(usage.totalTokens).toBe(30);

        const reset = EphemeraAI.resetSessionUsage();
        expect(reset.requests).toBe(0);
        expect(reset.totalTokens).toBe(0);
    });

    it('supports non-stream providers and emits single chunk callback fallback', async () => {
        window.EphemeraState.updateSetting('aiProvider', 'google');
        setProviderKey('google', 'google-key');

        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [{ text: 'Google OK' }]
                        }
                    }
                ],
                usageMetadata: {
                    promptTokenCount: 4,
                    candidatesTokenCount: 2,
                    totalTokenCount: 6
                }
            })
        }));
        vi.stubGlobal('fetch', fetchMock);

        const onStream = vi.fn();
        const response = await EphemeraAI.chat(
            [{ role: 'user', content: 'hello' }],
            'gemini-2.0-flash',
            onStream,
            { provider: 'google', bypassRateLimit: true }
        );

        expect(response).toBe('Google OK');
        expect(onStream).toHaveBeenCalledTimes(1);
        expect(onStream).toHaveBeenCalledWith('Google OK', 'Google OK');
        const [url] = fetchMock.mock.calls[0];
        expect(url).toContain('generativelanguage.googleapis.com');
        expect(url).toContain(':generateContent?key=');
    });

    it('uses AI stream worker when available for streamed responses', async () => {
        const streamWorker = {
            createSession: vi.fn(() => 'ai-stream-1'),
            parseChunk: vi.fn()
                .mockResolvedValueOnce([{ type: 'content', content: 'Hello' }])
                .mockResolvedValueOnce([{ type: 'content', content: ' world' }]),
            flushSession: vi.fn(async () => [{ type: 'usage', usage: { total_tokens: 2 } }]),
            closeSession: vi.fn(async () => true)
        };
        window.EphemeraAIStreamWorker = streamWorker;

        const onStream = vi.fn();
        const onUsage = vi.fn();
        const response = createStreamResponse(['chunk-a', 'chunk-b']);

        const full = await EphemeraAI.handleStream(response, onStream, null, onUsage);

        expect(full).toBe('Hello world');
        expect(onStream).toHaveBeenCalledTimes(2);
        expect(onStream).toHaveBeenNthCalledWith(1, 'Hello', 'Hello');
        expect(onStream).toHaveBeenNthCalledWith(2, ' world', 'Hello world');
        expect(onUsage).toHaveBeenCalledWith({ total_tokens: 2 });
        expect(streamWorker.createSession).toHaveBeenCalledTimes(1);
        expect(streamWorker.parseChunk).toHaveBeenCalledTimes(2);
        expect(streamWorker.flushSession).toHaveBeenCalledTimes(1);
        expect(streamWorker.closeSession).toHaveBeenCalledTimes(1);
    });

    it('falls back to main-thread stream parsing when AI stream worker is unavailable', async () => {
        window.EphemeraAIStreamWorker = undefined;

        const onStream = vi.fn();
        const onUsage = vi.fn();
        const response = createStreamResponse([
            'data: {"choices":[{"delta":{"content":"Hel',
            'lo"}}]}\n',
            'data: {"choices":[{"delta":{"content":" world"}}]}\n',
            'data: {"usage":{"total_tokens":2}}\n',
            'data: [DONE]\n'
        ]);

        const full = await EphemeraAI.handleStream(response, onStream, null, onUsage);

        expect(full).toBe('Hello world');
        expect(onStream).toHaveBeenCalledTimes(2);
        expect(onStream).toHaveBeenNthCalledWith(1, 'Hello', 'Hello');
        expect(onStream).toHaveBeenNthCalledWith(2, ' world', 'Hello world');
        expect(onUsage).toHaveBeenCalledWith({ total_tokens: 2 });
    });
});
