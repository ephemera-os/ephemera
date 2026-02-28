export default async function handler(req, res) {
    const allowedOrigin = process.env.VITE_APP_URL || '';

    if (req.method !== 'GET') {
        res.status(405).end('Method Not Allowed');
        return;
    }

    const { code, state, error, error_description } = req.query;

    if (error) {
        return sendHtml(res, allowedOrigin, {
            error: error,
            error_description: error_description || error,
            state: state || ''
        });
    }

    if (!code) {
        return sendHtml(res, allowedOrigin, {
            error: 'missing_code',
            error_description: 'No authorization code was provided.',
            state: state || ''
        });
    }

    const clientId = process.env.OPENAI_OAUTH_CLIENT_ID;
    const clientSecret = process.env.OPENAI_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return sendHtml(res, allowedOrigin, {
            error: 'server_config',
            error_description: 'OAuth credentials are not configured on the server.',
            state: state || ''
        });
    }

    const redirectUri = `${allowedOrigin}/api/ai-oauth/callback`;

    try {
        const tokenRes = await fetch('https://auth0.openai.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri
            })
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || tokenData.error) {
            return sendHtml(res, allowedOrigin, {
                error: tokenData.error || 'token_exchange_failed',
                error_description: tokenData.error_description || `Token exchange failed (${tokenRes.status})`,
                state: state || ''
            });
        }

        return sendHtml(res, allowedOrigin, {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || '',
            expires_in: tokenData.expires_in || 0,
            state: state || '',
            user: tokenData.user || null
        });
    } catch (err) {
        return sendHtml(res, allowedOrigin, {
            error: 'network_error',
            error_description: err.message || 'Failed to exchange authorization code.',
            state: state || ''
        });
    }
}

function sendHtml(res, allowedOrigin, data) {
    const payload = JSON.stringify({ type: 'ai-oauth-callback', ...data });
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
    var data = ${payload};
    var origin = ${escapedOrigin};
    if (window.opener) {
        window.opener.postMessage(data, origin);
    }
    setTimeout(function() { window.close(); }, 1000);
})();
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
}
