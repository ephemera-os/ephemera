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

$modelNames = [
    'gpt-5.3-codex' => 'GPT-5.3 Codex',
    'gpt-5.2-codex' => 'GPT-5.2 Codex',
    'gpt-5.2' => 'GPT-5.2',
    'gpt-5.1-codex' => 'GPT-5.1 Codex',
    'gpt-5.1-codex-mini' => 'GPT-5.1 Codex Mini'
];
$models = [];
foreach (AI_CHATGPT_ALLOWED_MODELS as $id) {
    $models[] = ['id' => $id, 'name' => $modelNames[$id] ?? $id];
}

aiOAuthSendJson(200, [
    'models' => $models,
    'connected' => true,
    'expiresAt' => $status['expiresAt'] ?? null
]);
