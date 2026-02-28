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
aiOAuthSendJson(200, aiOAuthGetStatusPayload());
