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

if ($method !== 'GET') {
    aiOAuthSendJson(405, ['error' => 'Method Not Allowed']);
}

aiOAuthStartSession();
$authResult = aiOAuthRefreshAccessTokenIfNeeded(false);
if (empty($authResult['connected']) || !is_array($authResult['record'] ?? null)) {
    aiOAuthSendJson(401, [
        'error' => 'not_connected',
        'error_description' => 'ChatGPT is not connected for this session.'
    ]);
}

$record = $authResult['record'];
$catalog = aiOAuthGetAvailableModels($record);
$models = is_array($catalog['models'] ?? null) ? $catalog['models'] : [];

aiOAuthSendJson(200, [
    'models' => $models,
    'connected' => true,
    'expiresAt' => ((int)($record['expires_at'] ?? 0)) * 1000,
    'catalogSource' => (string)($catalog['source'] ?? 'remote'),
    'catalogError' => (string)($catalog['error'] ?? '')
]);
