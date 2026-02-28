import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler from '../api/ai-oauth/callback.js';

function createResponseMock() {
    return {
        headers: {},
        statusCode: null,
        body: '',
        setHeader(name, value) {
            this.headers[name] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(payload) {
            this.body = payload;
            return this;
        },
        end(payload = '') {
            this.body = payload;
            return this;
        }
    };
}

function createPendingCookie({ state = 'state-1', verifier = 'verifier-1', createdAt = Date.now() } = {}) {
    const value = encodeURIComponent(JSON.stringify({
        provider: 'chatgpt',
        state,
        codeVerifier: verifier,
        createdAt
    }));
    return `ephemera_ai_oauth_pending_pkce=${value}`;
}

function extractCallbackPayload(html) {
    const source = String(html || '');
    const match = source.match(/decodeURIComponent\((\"(?:[^\"\\]|\\.)*\")\)/);
    if (!match) {
        throw new Error('Callback payload marker not found in HTML');
    }
    const encoded = JSON.parse(match[1]);
    return JSON.parse(decodeURIComponent(encoded));
}

describe('/api/ai-oauth/callback', () => {
    let prevAppUrl;
    let prevClientId;
    let prevClientSecret;

    beforeEach(() => {
        fetch.mockReset();

        prevAppUrl = process.env.VITE_APP_URL;
        prevClientId = process.env.OPENAI_OAUTH_CLIENT_ID;
        prevClientSecret = process.env.OPENAI_OAUTH_CLIENT_SECRET;

        process.env.VITE_APP_URL = 'https://app.example.com';
        process.env.OPENAI_OAUTH_CLIENT_ID = 'test-client-id';
        process.env.OPENAI_OAUTH_CLIENT_SECRET = 'test-client-secret';
    });

    afterEach(() => {
        if (prevAppUrl === undefined) delete process.env.VITE_APP_URL;
        else process.env.VITE_APP_URL = prevAppUrl;

        if (prevClientId === undefined) delete process.env.OPENAI_OAUTH_CLIENT_ID;
        else process.env.OPENAI_OAUTH_CLIENT_ID = prevClientId;

        if (prevClientSecret === undefined) delete process.env.OPENAI_OAUTH_CLIENT_SECRET;
        else process.env.OPENAI_OAUTH_CLIENT_SECRET = prevClientSecret;
    });

    it('includes PKCE code_verifier in token exchange request', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                access_token: 'access-token',
                refresh_token: 'refresh-token',
                expires_in: 3600
            })
        });

        const req = {
            method: 'GET',
            query: { code: 'auth-code-123', state: 'state-abc' },
            headers: {
                cookie: createPendingCookie({ state: 'state-abc', verifier: 'pkce-verifier-xyz' }),
                'x-forwarded-proto': 'https'
            }
        };
        const res = createResponseMock();

        await handler(req, res);

        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, options] = fetch.mock.calls[0];
        expect(url).toBe('https://auth0.openai.com/oauth/token');
        expect(options.method).toBe('POST');
        expect(options.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });

        const body = new URLSearchParams(options.body);
        expect(body.get('grant_type')).toBe('authorization_code');
        expect(body.get('code')).toBe('auth-code-123');
        expect(body.get('code_verifier')).toBe('pkce-verifier-xyz');
        expect(body.get('redirect_uri')).toBe('https://app.example.com/api/ai-oauth/callback');

        expect(res.statusCode).toBe(200);
        expect(res.headers['Set-Cookie']).toContain('ephemera_ai_oauth_pending_pkce=');
        expect(res.headers['Set-Cookie']).toContain('Max-Age=0');

        const payload = extractCallbackPayload(res.body);
        expect(payload.access_token).toBe('access-token');
        expect(payload.refresh_token).toBe('refresh-token');
    });

    it('rejects callback when state does not match pending PKCE state', async () => {
        const req = {
            method: 'GET',
            query: { code: 'auth-code-123', state: 'unexpected-state' },
            headers: {
                cookie: createPendingCookie({ state: 'expected-state', verifier: 'pkce-verifier-xyz' }),
                'x-forwarded-proto': 'https'
            }
        };
        const res = createResponseMock();

        await handler(req, res);

        expect(fetch).not.toHaveBeenCalled();
        const payload = extractCallbackPayload(res.body);
        expect(payload.error).toBe('invalid_state');
        expect(payload.error_description).toContain('state mismatch');
    });

    it('does not inject raw callback data into inline script', async () => {
        const attackerInput = '</script><script>window.__xss = true</script>';
        const req = {
            method: 'GET',
            query: {
                error: 'access_denied',
                error_description: attackerInput,
                state: 'state-abc'
            },
            headers: {
                cookie: '',
                'x-forwarded-proto': 'https'
            }
        };
        const res = createResponseMock();

        await handler(req, res);

        const html = String(res.body || '');
        expect(html).toContain('decodeURIComponent(');
        expect(html).not.toContain(attackerInput);

        const payload = extractCallbackPayload(html);
        expect(payload.error).toBe('access_denied');
        expect(payload.error_description).toBe(attackerInput);
    });
});
