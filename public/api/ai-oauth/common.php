<?php
declare(strict_types=1);

const AI_CHATGPT_AUTH_SESSION_KEY = 'ephemera_ai_chatgpt_auth';
const AI_CHATGPT_DEVICE_SESSION_KEY = 'ephemera_ai_chatgpt_device';
const AI_CHATGPT_DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const AI_CHATGPT_ISSUER = 'https://auth.openai.com';
const AI_CHATGPT_DEVICE_USERCODE_URL = AI_CHATGPT_ISSUER . '/api/accounts/deviceauth/usercode';
const AI_CHATGPT_DEVICE_TOKEN_URL = AI_CHATGPT_ISSUER . '/api/accounts/deviceauth/token';
const AI_CHATGPT_OAUTH_TOKEN_URL = AI_CHATGPT_ISSUER . '/oauth/token';
const AI_CHATGPT_DEVICE_REDIRECT_URI = AI_CHATGPT_ISSUER . '/deviceauth/callback';
const AI_CHATGPT_RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses';
const AI_CHATGPT_DEFAULT_DEVICE_TIMEOUT_SECONDS = 900;
const AI_CHATGPT_REFRESH_SKEW_SECONDS = 30;
const AI_OAUTH_HTTP_DEFAULT_TIMEOUT_SECONDS = 25;
const AI_OAUTH_HTTP_CONNECT_TIMEOUT_SECONDS = 10;
const AI_CHATGPT_RESPONSES_TIMEOUT_SECONDS = 120;

function aiOAuthGetConfigValue(string $key): string
{
    static $fileConfig = null;
    if ($fileConfig === null) {
        $fileConfig = [];
        $configPath = __DIR__ . '/config.php';
        if (is_file($configPath)) {
            $loaded = include $configPath;
            if (is_array($loaded)) {
                $fileConfig = $loaded;
            }
        }
    }

    $envValue = getenv($key);
    if ($envValue !== false && $envValue !== '') {
        return trim((string)$envValue);
    }

    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
        return trim((string)$_SERVER[$key]);
    }

    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return trim((string)$_ENV[$key]);
    }

    if (array_key_exists($key, $fileConfig) && $fileConfig[$key] !== null) {
        return trim((string)$fileConfig[$key]);
    }

    return '';
}

function aiOAuthGetRequestMethod(): string
{
    return strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
}

function aiOAuthGetHeader(string $name): string
{
    $normalized = strtoupper(str_replace('-', '_', $name));
    $serverKey = 'HTTP_' . $normalized;
    if (isset($_SERVER[$serverKey]) && $_SERVER[$serverKey] !== '') {
        return trim((string)$_SERVER[$serverKey]);
    }

    if ($normalized === 'CONTENT_TYPE' && isset($_SERVER['CONTENT_TYPE'])) {
        return trim((string)$_SERVER['CONTENT_TYPE']);
    }

    return '';
}

function aiOAuthFirstCsvValue(string $value): string
{
    if ($value === '') return '';
    $parts = explode(',', $value);
    return trim((string)($parts[0] ?? ''));
}

function aiOAuthNormalizeOrigin(string $value): string
{
    $origin = trim($value);
    if ($origin === '') return '';
    $origin = rtrim($origin, '/');
    $parsed = parse_url($origin);
    if (!is_array($parsed) || empty($parsed['scheme']) || empty($parsed['host'])) {
        return '';
    }
    $scheme = strtolower((string)$parsed['scheme']);
    if ($scheme !== 'https' && $scheme !== 'http') {
        return '';
    }

    $host = (string)$parsed['host'];
    $port = isset($parsed['port']) ? ':' . (int)$parsed['port'] : '';
    return $scheme . '://' . $host . $port;
}

function aiOAuthGetAllowedOrigin(): string
{
    return aiOAuthNormalizeOrigin(aiOAuthGetConfigValue('VITE_APP_URL'));
}

function aiOAuthIsHttpsRequest(): bool
{
    $forwardedProto = strtolower(aiOAuthFirstCsvValue(aiOAuthGetHeader('X-Forwarded-Proto')));
    if ($forwardedProto !== '') {
        return $forwardedProto === 'https';
    }

    $https = strtolower((string)($_SERVER['HTTPS'] ?? ''));
    if ($https !== '' && $https !== 'off') {
        return true;
    }

    return (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
}

function aiOAuthGetSessionCookiePath(): string
{
    $requestUri = (string)($_SERVER['REQUEST_URI'] ?? '/');
    $requestPath = parse_url($requestUri, PHP_URL_PATH);
    if (!is_string($requestPath) || $requestPath === '') {
        return '/';
    }

    $normalized = preg_replace('#/+#', '/', $requestPath);
    if (!is_string($normalized) || $normalized === '') {
        return '/';
    }

    $markers = ['/api/ai-oauth/', '/api/ai-oauth'];
    foreach ($markers as $marker) {
        $pos = strpos($normalized, $marker);
        if ($pos === false) continue;
        $base = substr($normalized, 0, $pos);
        if ($base === '' || $base === false) return '/';
        return rtrim($base, '/') . '/';
    }

    return '/';
}

function aiOAuthStartSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = aiOAuthIsHttpsRequest();
    $path = aiOAuthGetSessionCookiePath();

    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => $path,
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
    } else {
        session_set_cookie_params(0, $path . '; samesite=Lax', '', $secure, true);
    }

    session_name('EPHEMERA_SID');
    session_start();

    if (!isset($_SESSION['__ephemera_init'])) {
        $_SESSION['__ephemera_init'] = time();
        session_regenerate_id(true);
    }
}

function aiOAuthSendText(int $statusCode, string $body): void
{
    http_response_code($statusCode);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('Pragma: no-cache');
    echo $body;
    exit;
}

function aiOAuthSendJson(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('Pragma: no-cache');

    $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        $json = '{"error":"serialization_failed","error_description":"Failed to serialize response."}';
    }

    echo $json;
    exit;
}

function aiOAuthReadJsonBody(): array
{
    $rawBody = file_get_contents('php://input');
    if (!is_string($rawBody) || trim($rawBody) === '') {
        return [];
    }

    $decoded = json_decode($rawBody, true);
    return is_array($decoded) ? $decoded : [];
}

function aiOAuthApplyCorsHeaders(string $allowedOrigin): void
{
    if ($allowedOrigin === '') return;
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}

function aiOAuthDecodeJsonObject(string $payload): array
{
    $decoded = json_decode($payload, true);
    return is_array($decoded) ? $decoded : [];
}

function aiOAuthHttpRequest(string $method, string $url, array $headers = [], string $body = '', int $timeoutSeconds = AI_OAUTH_HTTP_DEFAULT_TIMEOUT_SECONDS): array
{
    $method = strtoupper(trim($method));
    $headers = array_values(array_filter($headers, static fn ($row) => is_string($row) && $row !== ''));
    $requestTimeout = max(1, $timeoutSeconds);
    $connectTimeout = max(1, min(AI_OAUTH_HTTP_CONNECT_TIMEOUT_SECONDS, $requestTimeout));

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch === false) {
            return ['status' => 0, 'body' => '', 'error' => 'Unable to initialize cURL.'];
        }

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $connectTimeout);
        curl_setopt($ch, CURLOPT_TIMEOUT, $requestTimeout);

        if (!empty($headers)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }

        if ($body !== '') {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }

        $responseBody = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($responseBody === false) {
            return ['status' => $statusCode, 'body' => '', 'error' => $curlError !== '' ? $curlError : 'Network request failed.'];
        }

        return ['status' => $statusCode, 'body' => (string)$responseBody, 'error' => ''];
    }

    $contextHeaders = implode("\r\n", $headers);
    if ($contextHeaders !== '') {
        $contextHeaders .= "\r\n";
    }

    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => $contextHeaders,
            'content' => $body,
            'ignore_errors' => true,
            'timeout' => $requestTimeout
        ]
    ]);

    $responseBody = @file_get_contents($url, false, $context);
    $statusCode = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', (string)$http_response_header[0], $matches)) {
        $statusCode = (int)$matches[1];
    }

    if ($responseBody === false) {
        return ['status' => $statusCode, 'body' => '', 'error' => 'Network request failed.'];
    }

    return ['status' => $statusCode, 'body' => (string)$responseBody, 'error' => ''];
}

function aiOAuthPostForm(string $url, array $fields, array $extraHeaders = []): array
{
    $headers = array_merge(['Content-Type: application/x-www-form-urlencoded'], $extraHeaders);
    $body = http_build_query($fields, '', '&', PHP_QUERY_RFC3986);
    return aiOAuthHttpRequest('POST', $url, $headers, $body);
}

function aiOAuthPostJson(string $url, array $payload, array $extraHeaders = []): array
{
    $headers = array_merge(['Content-Type: application/json', 'Accept: application/json'], $extraHeaders);
    $body = json_encode($payload, JSON_UNESCAPED_SLASHES);
    if (!is_string($body)) {
        return ['status' => 0, 'body' => '', 'error' => 'Failed to serialize JSON payload.'];
    }

    return aiOAuthHttpRequest('POST', $url, $headers, $body);
}

function aiOAuthGetClientId(): string
{
    $configured = aiOAuthGetConfigValue('OPENAI_CODEX_CLIENT_ID');
    if ($configured !== '') {
        return $configured;
    }
    return AI_CHATGPT_DEFAULT_CLIENT_ID;
}

function aiOAuthGetUserAgent(): string
{
    $appVersion = aiOAuthGetConfigValue('EPHEMERA_VERSION');
    if ($appVersion === '') $appVersion = '2.0';
    return 'ephemera/' . $appVersion;
}

function aiOAuthBase64UrlDecode(string $input): string
{
    $padded = strtr($input, '-_', '+/');
    $padLength = strlen($padded) % 4;
    if ($padLength > 0) {
        $padded .= str_repeat('=', 4 - $padLength);
    }
    $decoded = base64_decode($padded, true);
    return is_string($decoded) ? $decoded : '';
}

function aiOAuthDecodeJwtClaims(string $token): array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) return [];

    $payloadRaw = aiOAuthBase64UrlDecode((string)$parts[1]);
    if ($payloadRaw === '') return [];

    $decoded = json_decode($payloadRaw, true);
    return is_array($decoded) ? $decoded : [];
}

function aiOAuthExtractAccountId(array $claims): string
{
    if (!empty($claims['chatgpt_account_id']) && is_string($claims['chatgpt_account_id'])) {
        return trim($claims['chatgpt_account_id']);
    }

    $authClaims = $claims['https://api.openai.com/auth'] ?? null;
    if (is_array($authClaims) && !empty($authClaims['chatgpt_account_id']) && is_string($authClaims['chatgpt_account_id'])) {
        return trim($authClaims['chatgpt_account_id']);
    }

    if (isset($claims['organizations']) && is_array($claims['organizations']) && isset($claims['organizations'][0]['id'])) {
        return trim((string)$claims['organizations'][0]['id']);
    }

    return '';
}

function aiOAuthExtractUser(array $claims): array
{
    return [
        'email' => trim((string)($claims['email'] ?? '')),
        'name' => trim((string)($claims['name'] ?? $claims['preferred_username'] ?? ''))
    ];
}

function aiOAuthGetAuthRecord(): ?array
{
    $record = $_SESSION[AI_CHATGPT_AUTH_SESSION_KEY] ?? null;
    if (!is_array($record)) return null;

    $accessToken = trim((string)($record['access_token'] ?? ''));
    $refreshToken = trim((string)($record['refresh_token'] ?? ''));
    if ($accessToken === '' || $refreshToken === '') {
        return null;
    }

    return [
        'access_token' => $accessToken,
        'refresh_token' => $refreshToken,
        'expires_at' => (int)($record['expires_at'] ?? 0),
        'account_id' => trim((string)($record['account_id'] ?? '')),
        'user' => is_array($record['user'] ?? null) ? $record['user'] : ['email' => '', 'name' => '']
    ];
}

function aiOAuthSaveAuthRecord(array $record): void
{
    $_SESSION[AI_CHATGPT_AUTH_SESSION_KEY] = [
        'access_token' => trim((string)($record['access_token'] ?? '')),
        'refresh_token' => trim((string)($record['refresh_token'] ?? '')),
        'expires_at' => (int)($record['expires_at'] ?? 0),
        'account_id' => trim((string)($record['account_id'] ?? '')),
        'user' => is_array($record['user'] ?? null) ? $record['user'] : ['email' => '', 'name' => '']
    ];
}

function aiOAuthClearAuthRecord(): void
{
    unset($_SESSION[AI_CHATGPT_AUTH_SESSION_KEY]);
    unset($_SESSION[AI_CHATGPT_DEVICE_SESSION_KEY]);
}

function aiOAuthNormalizeErrorString($value): string
{
    if (is_string($value)) {
        return trim($value);
    }

    if (is_int($value) || is_float($value)) {
        return trim((string)$value);
    }

    return '';
}

function aiOAuthTokenErrorType(array $tokenData): string
{
    $error = $tokenData['error'] ?? null;
    if (is_string($error)) {
        return strtolower(trim($error));
    }

    if (is_array($error)) {
        $nestedType = aiOAuthNormalizeErrorString($error['error'] ?? $error['type'] ?? '');
        if ($nestedType !== '') {
            return strtolower($nestedType);
        }
    }

    return '';
}

function aiOAuthTokenErrorCode(array $tokenData): string
{
    $candidates = [
        $tokenData['error_code'] ?? null,
        $tokenData['code'] ?? null
    ];

    if (is_array($tokenData['error'] ?? null)) {
        $candidates[] = $tokenData['error']['error_code'] ?? null;
        $candidates[] = $tokenData['error']['code'] ?? null;
    }

    foreach ($candidates as $candidate) {
        $normalized = aiOAuthNormalizeErrorString($candidate);
        if ($normalized !== '') {
            return strtolower($normalized);
        }
    }

    return '';
}

function aiOAuthTokenErrorDescription(array $tokenData, string $fallback = ''): string
{
    $candidates = [
        $tokenData['error_description'] ?? null,
        $tokenData['message'] ?? null
    ];

    $error = $tokenData['error'] ?? null;
    if (is_array($error)) {
        $candidates[] = $error['error_description'] ?? null;
        $candidates[] = $error['message'] ?? null;
    } elseif (is_string($error)) {
        $candidates[] = $error;
    }

    foreach ($candidates as $candidate) {
        $normalized = aiOAuthNormalizeErrorString($candidate);
        if ($normalized !== '') {
            return $normalized;
        }
    }

    return $fallback;
}

function aiOAuthIsPermanentRefreshError(array $tokenData): bool
{
    $error = aiOAuthTokenErrorType($tokenData);
    if ($error === 'invalid_grant' || $error === 'token_expired') {
        return true;
    }

    $errorCode = aiOAuthTokenErrorCode($tokenData);
    $knownCodes = [
        'token_expired',
        'refresh_token_expired',
        'refresh_token_reused',
        'refresh_token_invalidated',
        'invalid_refresh_token'
    ];

    if ($errorCode !== '' && in_array($errorCode, $knownCodes, true)) {
        return true;
    }

    $description = strtolower(aiOAuthTokenErrorDescription($tokenData, ''));
    if ($description !== '') {
        foreach ($knownCodes as $knownCode) {
            if (strpos($description, $knownCode) !== false) {
                return true;
            }
        }
    }

    return false;
}

function aiOAuthRefreshAccessTokenIfNeeded(bool $force = false): array
{
    $record = aiOAuthGetAuthRecord();
    if ($record === null) {
        return ['connected' => false, 'error' => 'not_connected'];
    }

    $expiresAt = (int)($record['expires_at'] ?? 0);
    $shouldRefresh = $force || $expiresAt <= 0 || (time() + AI_CHATGPT_REFRESH_SKEW_SECONDS) >= $expiresAt;
    if (!$shouldRefresh) {
        return ['connected' => true, 'record' => $record];
    }

    $tokenResponse = aiOAuthPostJson(AI_CHATGPT_OAUTH_TOKEN_URL, [
        'grant_type' => 'refresh_token',
        'client_id' => aiOAuthGetClientId(),
        'refresh_token' => $record['refresh_token'],
        'scope' => 'openid profile email'
    ], ['User-Agent: ' . aiOAuthGetUserAgent()]);

    if ($tokenResponse['error'] !== '') {
        return ['connected' => false, 'error' => $tokenResponse['error']];
    }

    $tokenData = aiOAuthDecodeJsonObject($tokenResponse['body']);
    if ($tokenResponse['status'] < 200 || $tokenResponse['status'] >= 300 || !empty($tokenData['error'])) {
        $errorDescription = aiOAuthTokenErrorDescription($tokenData, 'refresh_failed');
        if (aiOAuthIsPermanentRefreshError($tokenData)) {
            aiOAuthClearAuthRecord();
        }
        return ['connected' => false, 'error' => $errorDescription];
    }

    $accessToken = trim((string)($tokenData['access_token'] ?? ''));
    $refreshToken = trim((string)($tokenData['refresh_token'] ?? $record['refresh_token']));
    if ($accessToken === '' || $refreshToken === '') {
        aiOAuthClearAuthRecord();
        return ['connected' => false, 'error' => 'refresh_failed'];
    }

    $idClaims = aiOAuthDecodeJwtClaims((string)($tokenData['id_token'] ?? ''));
    $accessClaims = aiOAuthDecodeJwtClaims($accessToken);
    $claimsForIdentity = !empty($idClaims) ? $idClaims : $accessClaims;
    $user = aiOAuthExtractUser($claimsForIdentity);
    if ((string)($user['email'] ?? '') === '' && (string)($user['name'] ?? '') === '') {
        $user = is_array($record['user'] ?? null) ? $record['user'] : ['email' => '', 'name' => ''];
    }

    $updated = [
        'access_token' => $accessToken,
        'refresh_token' => $refreshToken,
        'expires_at' => time() + max(60, (int)($tokenData['expires_in'] ?? 3600)),
        'account_id' => aiOAuthExtractAccountId($claimsForIdentity) ?: $record['account_id'],
        'user' => $user
    ];

    aiOAuthSaveAuthRecord($updated);
    return ['connected' => true, 'record' => $updated];
}

function aiOAuthGetStatusPayload(): array
{
    $result = aiOAuthRefreshAccessTokenIfNeeded(false);
    if (empty($result['connected']) || !is_array($result['record'] ?? null)) {
        return ['connected' => false, 'user' => null, 'expiresAt' => null, 'accountId' => ''];
    }

    $record = $result['record'];
    return [
        'connected' => true,
        'user' => $record['user'] ?? ['email' => '', 'name' => ''],
        'expiresAt' => ((int)($record['expires_at'] ?? 0)) * 1000,
        'accountId' => (string)($record['account_id'] ?? '')
    ];
}

function aiOAuthExtractContentFromResponses(array $payload): string
{
    $outputText = trim((string)($payload['output_text'] ?? ''));
    if ($outputText !== '') {
        return $outputText;
    }

    $chunks = [];
    $output = $payload['output'] ?? null;
    if (is_array($output)) {
        foreach ($output as $item) {
            if (!is_array($item)) continue;
            $content = $item['content'] ?? null;
            if (is_string($content) && trim($content) !== '') {
                $chunks[] = trim($content);
                continue;
            }

            if (!is_array($content)) continue;
            foreach ($content as $part) {
                if (!is_array($part)) continue;
                $text = trim((string)($part['text'] ?? ''));
                if ($text !== '') {
                    $chunks[] = $text;
                }
            }
        }
    }

    if (!empty($chunks)) {
        return trim(implode('', $chunks));
    }

    $fallbackContent = $payload['choices'][0]['message']['content'] ?? '';
    return trim((string)$fallbackContent);
}

function aiOAuthExtractUsageFromResponses(array $payload): array
{
    $usage = is_array($payload['usage'] ?? null) ? $payload['usage'] : [];
    return [
        'prompt_tokens' => (int)($usage['prompt_tokens'] ?? $usage['input_tokens'] ?? 0),
        'completion_tokens' => (int)($usage['completion_tokens'] ?? $usage['output_tokens'] ?? 0),
        'total_tokens' => (int)($usage['total_tokens'] ?? 0)
    ];
}
