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
    aiOAuthSendJson(405, [
        'error' => 'Method Not Allowed',
        'message' => 'Method Not Allowed'
    ]);
}

aiOAuthStartSession();
$authResult = aiOAuthRefreshAccessTokenIfNeeded(false);
if (empty($authResult['connected']) || !is_array($authResult['record'] ?? null)) {
    $message = 'ChatGPT is not connected for this session.';
    aiOAuthSendJson(401, [
        'error' => 'not_connected',
        'error_description' => $message,
        'message' => $message
    ]);
}

$record = $authResult['record'];
$payload = aiOAuthReadJsonBody();

$model = trim((string)($payload['model'] ?? 'gpt-5.2-codex'));
if ($model === '') {
    $model = 'gpt-5.2-codex';
}

$rawMessages = $payload['messages'] ?? null;
if (!is_array($rawMessages) || count($rawMessages) === 0) {
    $message = 'messages must be a non-empty array.';
    aiOAuthSendJson(400, [
        'error' => 'invalid_request',
        'error_description' => $message,
        'message' => $message
    ]);
}

$instructions = [];
$input = [];
foreach ($rawMessages as $row) {
    if (!is_array($row)) continue;

    $role = strtolower(trim((string)($row['role'] ?? 'user')));
    if ($role !== 'system' && $role !== 'assistant' && $role !== 'user') {
        $role = 'user';
    }

    $contentValue = $row['content'] ?? '';
    if (is_array($contentValue)) {
        $parts = [];
        foreach ($contentValue as $part) {
            if (is_string($part)) {
                $parts[] = $part;
            } elseif (is_array($part) && is_string($part['text'] ?? null)) {
                $parts[] = (string)$part['text'];
            }
        }
        $content = trim(implode("\n", $parts));
    } else {
        $content = trim((string)$contentValue);
    }

    if ($content === '') continue;

    if ($role === 'system') {
        $instructions[] = $content;
        continue;
    }

    $input[] = [
        'role' => $role,
        'content' => $content
    ];
}

if (count($input) === 0) {
    $message = 'No non-system messages were provided.';
    aiOAuthSendJson(400, [
        'error' => 'invalid_request',
        'error_description' => $message,
        'message' => $message
    ]);
}

$requestBody = [
    'model' => $model,
    'input' => $input,
    'stream' => false,
    'max_output_tokens' => max(1, (int)($payload['max_tokens'] ?? 8192))
];

$temperature = $payload['temperature'] ?? null;
if (is_numeric($temperature)) {
    $requestBody['temperature'] = (float)$temperature;
}

if (!empty($instructions)) {
    $requestBody['instructions'] = implode("\n\n", $instructions);
}

$encodedBody = json_encode($requestBody, JSON_UNESCAPED_SLASHES);
if (!is_string($encodedBody)) {
    $message = 'Failed to encode upstream request.';
    aiOAuthSendJson(500, [
        'error' => 'serialization_failed',
        'error_description' => $message,
        'message' => $message
    ]);
}

$headers = [
    'Authorization: Bearer ' . $record['access_token'],
    'Content-Type: application/json',
    'Accept: application/json',
    'originator: ephemera',
    'User-Agent: ' . aiOAuthGetUserAgent()
];

$accountId = trim((string)($record['account_id'] ?? ''));
if ($accountId !== '') {
    $headers[] = 'ChatGPT-Account-Id: ' . $accountId;
}

$upstreamResponse = aiOAuthHttpRequest('POST', AI_CHATGPT_RESPONSES_URL, $headers, $encodedBody, AI_CHATGPT_RESPONSES_TIMEOUT_SECONDS);
if ($upstreamResponse['error'] !== '') {
    $message = $upstreamResponse['error'];
    aiOAuthSendJson(500, [
        'error' => 'network_error',
        'error_description' => $message,
        'message' => $message
    ]);
}

$upstreamStatus = (int)($upstreamResponse['status'] ?? 0);
$upstreamData = aiOAuthDecodeJsonObject($upstreamResponse['body']);

if ($upstreamStatus < 200 || $upstreamStatus >= 300) {
    if ($upstreamStatus === 401 || $upstreamStatus === 403) {
        aiOAuthClearAuthRecord();
    }

    $errorMessage = (string)($upstreamData['error']['message'] ?? $upstreamData['error_description'] ?? $upstreamData['error'] ?? 'ChatGPT request failed.');
    aiOAuthSendJson($upstreamStatus > 0 ? $upstreamStatus : 502, [
        'error' => 'upstream_error',
        'error_description' => $errorMessage,
        'message' => $errorMessage
    ]);
}

$content = aiOAuthExtractContentFromResponses($upstreamData);
$usage = aiOAuthExtractUsageFromResponses($upstreamData);

aiOAuthSendJson(200, [
    'content' => $content,
    'usage' => $usage,
    'model' => $model
]);
