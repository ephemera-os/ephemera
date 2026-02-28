<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';

$allowedOrigin = aiOAuthGetAllowedOrigin();
aiOAuthApplyCorsHeaders($allowedOrigin);

$method = aiOAuthGetRequestMethod();
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($method !== 'POST') {
    aiOAuthSendJson(405, ['error' => 'Method Not Allowed']);
}

aiOAuthStartSession();

$device = $_SESSION[AI_CHATGPT_DEVICE_SESSION_KEY] ?? null;
if (!is_array($device)) {
    aiOAuthSendJson(400, [
        'status' => 'failed',
        'error' => 'missing_device_session',
        'error_description' => 'No pending ChatGPT device authorization was found.'
    ]);
}

$createdAt = (int)($device['created_at'] ?? 0);
if ($createdAt <= 0 || (time() - $createdAt) > AI_CHATGPT_DEFAULT_DEVICE_TIMEOUT_SECONDS) {
    unset($_SESSION[AI_CHATGPT_DEVICE_SESSION_KEY]);
    aiOAuthSendJson(400, [
        'status' => 'failed',
        'error' => 'device_session_expired',
        'error_description' => 'Device authorization expired. Start sign-in again.'
    ]);
}

$deviceTokenResponse = aiOAuthPostJson(
    AI_CHATGPT_DEVICE_TOKEN_URL,
    [
        'device_auth_id' => (string)($device['device_auth_id'] ?? ''),
        'user_code' => (string)($device['user_code'] ?? '')
    ],
    ['User-Agent: ' . aiOAuthGetUserAgent()]
);

if ($deviceTokenResponse['error'] !== '') {
    aiOAuthSendJson(500, [
        'status' => 'failed',
        'error' => 'network_error',
        'error_description' => $deviceTokenResponse['error']
    ]);
}

$deviceStatusCode = (int)($deviceTokenResponse['status'] ?? 0);
$deviceData = aiOAuthDecodeJsonObject($deviceTokenResponse['body']);
$normalizeUpstreamFailure = static function (array $payload, string $fallbackError, string $fallbackDescription): array {
    $upstreamError = $payload['error'] ?? null;
    if (is_string($upstreamError)) {
        $upstreamError = trim($upstreamError);
    }
    if (
        (!is_string($upstreamError) && !is_array($upstreamError))
        || $upstreamError === ''
        || (is_array($upstreamError) && count($upstreamError) === 0)
    ) {
        $upstreamError = $fallbackError;
    }

    $errorDescription = $fallbackDescription;
    $upstreamDescription = $payload['error_description'] ?? null;
    if (is_string($upstreamDescription) && trim($upstreamDescription) !== '') {
        $errorDescription = trim($upstreamDescription);
    } elseif (is_array($upstreamDescription)) {
        $candidate = trim((string)($upstreamDescription['message'] ?? ''));
        if ($candidate !== '') {
            $errorDescription = $candidate;
        }
    }

    if ($errorDescription === $fallbackDescription && is_array($upstreamError)) {
        $candidate = trim((string)($upstreamError['message'] ?? ''));
        if ($candidate !== '') {
            $errorDescription = $candidate;
        }
    }

    return [
        'error' => $upstreamError,
        'error_description' => $errorDescription
    ];
};

if ($deviceStatusCode === 403 || $deviceStatusCode === 404) {
    aiOAuthSendJson(200, [
        'status' => 'pending',
        'interval_ms' => (int)($device['interval_ms'] ?? 5000)
    ]);
}

if ($deviceStatusCode < 200 || $deviceStatusCode >= 300) {
    $deviceFailure = $normalizeUpstreamFailure(
        $deviceData,
        'device_poll_failed',
        'Failed to verify ChatGPT device code.'
    );
    aiOAuthSendJson($deviceStatusCode > 0 ? $deviceStatusCode : 500, [
        'status' => 'failed',
        'error' => $deviceFailure['error'],
        'error_description' => $deviceFailure['error_description']
    ]);
}

$authorizationCode = trim((string)($deviceData['authorization_code'] ?? ''));
$codeVerifier = trim((string)($deviceData['code_verifier'] ?? ''));

if ($authorizationCode === '' || $codeVerifier === '') {
    aiOAuthSendJson(500, [
        'status' => 'failed',
        'error' => 'invalid_device_token_response',
        'error_description' => 'Device token response was incomplete.'
    ]);
}

$tokenResponse = aiOAuthPostForm(
    AI_CHATGPT_OAUTH_TOKEN_URL,
    [
        'grant_type' => 'authorization_code',
        'code' => $authorizationCode,
        'redirect_uri' => AI_CHATGPT_DEVICE_REDIRECT_URI,
        'client_id' => aiOAuthGetClientId(),
        'code_verifier' => $codeVerifier
    ],
    ['User-Agent: ' . aiOAuthGetUserAgent()]
);

if ($tokenResponse['error'] !== '') {
    aiOAuthSendJson(500, [
        'status' => 'failed',
        'error' => 'network_error',
        'error_description' => $tokenResponse['error']
    ]);
}

$tokenStatusCode = (int)($tokenResponse['status'] ?? 0);
$tokenData = aiOAuthDecodeJsonObject($tokenResponse['body']);
if ($tokenStatusCode < 200 || $tokenStatusCode >= 300 || !empty($tokenData['error'])) {
    $tokenFailure = $normalizeUpstreamFailure(
        $tokenData,
        'token_exchange_failed',
        'Failed to complete ChatGPT sign-in.'
    );
    aiOAuthSendJson($tokenStatusCode > 0 ? $tokenStatusCode : 500, [
        'status' => 'failed',
        'error' => $tokenFailure['error'],
        'error_description' => $tokenFailure['error_description']
    ]);
}

$accessToken = trim((string)($tokenData['access_token'] ?? ''));
$refreshToken = trim((string)($tokenData['refresh_token'] ?? ''));
if ($accessToken === '' || $refreshToken === '') {
    aiOAuthSendJson(500, [
        'status' => 'failed',
        'error' => 'invalid_token_response',
        'error_description' => 'OAuth token response was incomplete.'
    ]);
}

$idClaims = aiOAuthDecodeJwtClaims((string)($tokenData['id_token'] ?? ''));
$accessClaims = aiOAuthDecodeJwtClaims($accessToken);
$claimsForIdentity = !empty($idClaims) ? $idClaims : $accessClaims;

aiOAuthSaveAuthRecord([
    'access_token' => $accessToken,
    'refresh_token' => $refreshToken,
    'expires_at' => time() + max(60, (int)($tokenData['expires_in'] ?? 3600)),
    'account_id' => aiOAuthExtractAccountId($claimsForIdentity),
    'user' => aiOAuthExtractUser($claimsForIdentity)
]);

unset($_SESSION[AI_CHATGPT_DEVICE_SESSION_KEY]);

$statusPayload = aiOAuthGetStatusPayload();
aiOAuthSendJson(200, array_merge($statusPayload, ['status' => 'authorized']));
