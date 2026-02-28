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

$deviceResponse = aiOAuthPostJson(
    AI_CHATGPT_DEVICE_USERCODE_URL,
    ['client_id' => aiOAuthGetClientId()],
    ['User-Agent: ' . aiOAuthGetUserAgent()]
);

if ($deviceResponse['error'] !== '') {
    aiOAuthSendJson(500, [
        'error' => 'network_error',
        'error_description' => $deviceResponse['error']
    ]);
}

$data = aiOAuthDecodeJsonObject($deviceResponse['body']);
$statusCode = (int)($deviceResponse['status'] ?? 0);
if ($statusCode < 200 || $statusCode >= 300) {
    $upstreamError = $data['error'] ?? null;
    if (is_string($upstreamError)) {
        $upstreamError = trim($upstreamError);
    }
    if (
        (!is_string($upstreamError) && !is_array($upstreamError))
        || $upstreamError === ''
        || (is_array($upstreamError) && count($upstreamError) === 0)
    ) {
        $upstreamError = 'device_start_failed';
    }

    $defaultErrorDescription = 'Failed to start ChatGPT device authorization.';
    $errorDescription = $defaultErrorDescription;
    $upstreamDescription = $data['error_description'] ?? null;
    if (is_string($upstreamDescription) && trim($upstreamDescription) !== '') {
        $errorDescription = trim($upstreamDescription);
    } elseif (is_array($upstreamDescription)) {
        $candidate = trim((string)($upstreamDescription['message'] ?? ''));
        if ($candidate !== '') {
            $errorDescription = $candidate;
        }
    }

    if ($errorDescription === $defaultErrorDescription && is_array($upstreamError)) {
        $candidate = trim((string)($upstreamError['message'] ?? ''));
        if ($candidate !== '') {
            $errorDescription = $candidate;
        }
    }

    aiOAuthSendJson($statusCode > 0 ? $statusCode : 500, [
        'error' => $upstreamError,
        'error_description' => $errorDescription
    ]);
}

$deviceAuthId = trim((string)($data['device_auth_id'] ?? ''));
$userCode = trim((string)($data['user_code'] ?? ''));
$intervalRaw = trim((string)($data['interval'] ?? ''));
$intervalSeconds = max(1, (int)$intervalRaw);

if ($deviceAuthId === '' || $userCode === '') {
    aiOAuthSendJson(500, [
        'error' => 'invalid_device_response',
        'error_description' => 'Device authorization response was incomplete.'
    ]);
}

$_SESSION[AI_CHATGPT_DEVICE_SESSION_KEY] = [
    'device_auth_id' => $deviceAuthId,
    'user_code' => $userCode,
    'interval_ms' => ($intervalSeconds * 1000),
    'created_at' => time()
];

aiOAuthSendJson(200, [
    'verification_url' => AI_CHATGPT_ISSUER . '/codex/device',
    'user_code' => $userCode,
    'interval_ms' => ($intervalSeconds * 1000),
    'expires_in' => AI_CHATGPT_DEFAULT_DEVICE_TIMEOUT_SECONDS
]);
