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
$status = aiOAuthGetStatusPayload();
if (empty($status['connected'])) {
    aiOAuthSendJson(401, [
        'error' => 'not_connected',
        'error_description' => 'ChatGPT is not connected for this session.'
    ]);
}

$models = [
    ['id' => 'gpt-5.3-codex', 'name' => 'GPT-5.3 Codex'],
    ['id' => 'gpt-5.2-codex', 'name' => 'GPT-5.2 Codex'],
    ['id' => 'gpt-5.2', 'name' => 'GPT-5.2'],
    ['id' => 'gpt-5.1-codex', 'name' => 'GPT-5.1 Codex'],
    ['id' => 'gpt-5.1-codex-mini', 'name' => 'GPT-5.1 Codex Mini']
];

aiOAuthSendJson(200, [
    'models' => $models,
    'connected' => true,
    'expiresAt' => $status['expiresAt'] ?? null
]);
