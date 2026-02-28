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
aiOAuthClearAuthRecord();
session_regenerate_id(true);

aiOAuthSendJson(200, [
    'ok' => true,
    'connected' => false,
    'user' => null,
    'expiresAt' => null,
    'accountId' => ''
]);
