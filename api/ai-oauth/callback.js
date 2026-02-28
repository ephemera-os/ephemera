const AI_OAUTH_PENDING_COOKIE_KEY = 'ephemera_ai_oauth_pending_pkce';
const AI_OAUTH_PENDING_MAX_AGE_MS = 15 * 60 * 1000;

export default async function handler(req, res) {
    const allowedOrigin = process.env.VITE_APP_URL || '';

    if (req.method !== 'GET') {
        res.status(405).end('Method Not Allowed');
        return;
    }

    const { code, state, error, error_description } = req.query;
    const normalizedState = String(state || '');

    if (error) {
        return sendHtml(req, res, allowedOrigin, {
            error: error,
            error_description: error_description || error,
            state: normalizedState
        });
    }

    const normalizedCode = String(code || '').trim();
    if (!normalizedCode) {
        return sendHtml(req, res, allowedOrigin, {
            error: 'missing_code',
            error_description: 'No authorization code was provided.',
            state: normalizedState
        });
    }

    const pending = readPendingFromCookie(req);
    if (!pending || (pending.provider && pending.provider !== 'chatgpt')) {
        return sendHtml(req, res, allowedOrigin, {
            error: 'missing_pkce',
            error_description: 'OAuth PKCE session was not found. Start sign-in again.',
            state: normalizedState
        });
    }

    if (!normalizedState || pending.state !== normalizedState) {
        return sendHtml(req, res, allowedOrigin, {
            error: 'invalid_state',
            error_description: 'OAuth state mismatch. Please start sign-in again.',
            state: normalizedState
        });
    }

    if (!pending.createdAt || Date.now() - pending.createdAt > AI_OAUTH_PENDING_MAX_AGE_MS) {
        return sendHtml(req, res, allowedOrigin, {
            error: 'expired_state',
            error_description: 'OAuth session expired. Please start sign-in again.',
            state: normalizedState
        });
    }

    if (!pending.codeVerifier) {
        return sendHtml(req, res, allowedOrigin, {
            error: 'missing_pkce_verifier',
            error_description: 'OAuth PKCE verifier is missing. Start sign-in again.',
            state: normalizedState
        });
    }

    const clientId = process.env.OPENAI_OAUTH_CLIENT_ID;
    const clientSecret = process.env.OPENAI_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return sendHtml(req, res, allowedOrigin, {
            error: 'server_config',
            error_description: 'OAuth credentials are not configured on the server.',
            state: normalizedState
        });
    }

    const callbackOrigin = allowedOrigin || getRequestOrigin(req);
    if (!callbackOrigin) {
        return sendHtml(req, res, allowedOrigin, {
            error: 'server_config',
            error_description: 'OAuth callback origin is not configured on the server.',
            state: normalizedState
        });
    }

    const redirectUri = `${callbackOrigin}/api/ai-oauth/callback`;

    try {
        const tokenBody = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: normalizedCode,
            redirect_uri: redirectUri,
            code_verifier: pending.codeVerifier
        });

        const tokenRes = await fetch('https://auth0.openai.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenBody.toString()
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || tokenData.error) {
            return sendHtml(req, res, allowedOrigin, {
                error: tokenData.error || 'token_exchange_failed',
                error_description: tokenData.error_description || `Token exchange failed (${tokenRes.status})`,
                state: normalizedState
            });
        }

        return sendHtml(req, res, allowedOrigin, {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || '',
            expires_in: tokenData.expires_in || 0,
            state: normalizedState,
            user: tokenData.user || null
        });
    } catch (err) {
        return sendHtml(req, res, allowedOrigin, {
            error: 'network_error',
            error_description: err.message || 'Failed to exchange authorization code.',
            state: normalizedState
        });
    }
}

function sendHtml(req, res, allowedOrigin, data) {
    const payload = JSON.stringify({ type: 'ai-oauth-callback', ...data });
    const encodedPayload = JSON.stringify(encodeURIComponent(payload));
    const escapedOrigin = allowedOrigin
        ? JSON.stringify(allowedOrigin)
        : 'window.location.origin';

    const html = `<!DOCTYPE html>
<html>
<head><title>Authenticating...</title></head>
<body>
<p>Authenticating... you can close this window.</p>
<script>
(function() {
    var data = null;
    try {
        data = JSON.parse(decodeURIComponent(${encodedPayload}));
    } catch (_err) {
        data = {
            type: 'ai-oauth-callback',
            error: 'callback_payload_error',
            error_description: 'Failed to parse callback payload.'
        };
    }
    var origin = ${escapedOrigin};
    if (window.opener) {
        window.opener.postMessage(data, origin);
    }
    setTimeout(function() { window.close(); }, 1000);
})();
</script>
</body>
</html>`;

    res.setHeader('Set-Cookie', createPendingCookieClearHeader(req));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
}

function createPendingCookieClearHeader(req) {
    const secure = isHttpsRequest(req) ? '; Secure' : '';
    return `${AI_OAUTH_PENDING_COOKIE_KEY}=; Path=/api/ai-oauth/callback; Max-Age=0; SameSite=Lax${secure}`;
}

function isHttpsRequest(req) {
    const protoHeader = String(req?.headers?.['x-forwarded-proto'] || '');
    if (!protoHeader) return false;
    return protoHeader
        .split(',')
        .map(value => String(value || '').trim().toLowerCase())
        .includes('https');
}

function readPendingFromCookie(req) {
    const cookies = parseCookies(req?.headers?.cookie || '');
    const raw = cookies[AI_OAUTH_PENDING_COOKIE_KEY];
    if (!raw) return null;

    try {
        const payload = JSON.parse(decodeURIComponent(raw));
        return {
            provider: String(payload?.provider || ''),
            state: String(payload?.state || ''),
            codeVerifier: String(payload?.codeVerifier || ''),
            createdAt: Number(payload?.createdAt || 0)
        };
    } catch {
        return null;
    }
}

function parseCookies(rawCookie) {
    const source = String(rawCookie || '');
    if (!source) return {};

    return source.split(';').reduce((acc, part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return acc;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (key) {
            acc[key] = value;
        }
        return acc;
    }, {});
}

function getRequestOrigin(req) {
    const headers = req?.headers || {};
    const forwardedProto = String(headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const forwardedHost = String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim();
    if (!forwardedHost) return '';
    return `${forwardedProto || 'https'}://${forwardedHost}`;
}
