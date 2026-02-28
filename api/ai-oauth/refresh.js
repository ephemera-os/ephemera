export default async function handler(req, res) {
    const allowedOrigin = process.env.VITE_APP_URL || '';

    if (allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const { refresh_token } = req.body || {};

    if (!refresh_token) {
        res.status(400).json({ error: 'refresh_token is required' });
        return;
    }

    const clientId = process.env.OPENAI_OAUTH_CLIENT_ID;
    const clientSecret = process.env.OPENAI_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        res.status(500).json({ error: 'OAuth credentials are not configured on the server.' });
        return;
    }

    try {
        const tokenBody = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: String(refresh_token)
        });

        const tokenRes = await fetch('https://auth0.openai.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenBody.toString()
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || tokenData.error) {
            res.status(tokenRes.status || 400).json({
                error: tokenData.error || 'refresh_failed',
                error_description: tokenData.error_description || 'Token refresh failed.'
            });
            return;
        }

        res.status(200).json({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || refresh_token,
            expires_in: tokenData.expires_in || 0
        });
    } catch (err) {
        res.status(500).json({
            error: 'network_error',
            error_description: err.message || 'Failed to refresh token.'
        });
    }
}
