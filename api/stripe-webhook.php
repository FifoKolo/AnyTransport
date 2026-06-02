<?php
header('Content-Type: application/json; charset=utf-8');

$configFile = __DIR__ . '/stripe-config.php';
$localConfig = array();
if (file_exists($configFile)) {
    $loaded = include $configFile;
    if (is_array($loaded)) {
        $localConfig = $loaded;
    }
}

function config_value($name, $default = '') {
    global $localConfig;
    if (is_array($localConfig) && isset($localConfig[$name]) && trim((string) $localConfig[$name]) !== '') {
        return trim((string) $localConfig[$name]);
    }
    $env = getenv($name);
    if ($env !== false && trim((string) $env) !== '') {
        return trim((string) $env);
    }
    if (isset($_SERVER[$name]) && trim((string) $_SERVER[$name]) !== '') {
        return trim((string) $_SERVER[$name]);
    }
    return $default;
}

function send($payload, $status = 200) {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function get_signature_header() {
    if (!empty($_SERVER['HTTP_STRIPE_SIGNATURE'])) {
        return (string) $_SERVER['HTTP_STRIPE_SIGNATURE'];
    }
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) {
            if (strtolower((string) $k) === 'stripe-signature') {
                return (string) $v;
            }
        }
    }
    return '';
}

function verify_stripe_signature($payload, $signatureHeader, $secret, $tolerance = 300) {
    $parts = explode(',', (string) $signatureHeader);
    $timestamp = '';
    $signatures = array();
    foreach ($parts as $part) {
        $item = explode('=', trim((string) $part), 2);
        if (count($item) !== 2) {
            continue;
        }
        if ($item[0] === 't') {
            $timestamp = $item[1];
        } elseif ($item[0] === 'v1') {
            $signatures[] = $item[1];
        }
    }
    if ($timestamp === '' || empty($signatures)) {
        return false;
    }
    if (abs(time() - (int) $timestamp) > $tolerance) {
        return false;
    }
    $signedPayload = $timestamp . '.' . $payload;
    $expected = hash_hmac('sha256', $signedPayload, $secret);
    foreach ($signatures as $sig) {
        if (hash_equals($expected, (string) $sig)) {
            return true;
        }
    }
    return false;
}

function map_identity_status($status) {
    $status = strtolower(trim((string) $status));
    if ($status === 'verified') {
        return array('onboarding' => 'complete', 'identity' => 'verified', 'complete' => true);
    }
    if ($status === 'requires_input' || $status === 'canceled') {
        return array('onboarding' => 'requires_input', 'identity' => $status, 'complete' => false);
    }
    if ($status === 'processing' || $status === 'unverified') {
        return array('onboarding' => 'pending', 'identity' => $status, 'complete' => false);
    }
    return array('onboarding' => 'not_started', 'identity' => 'not_started', 'complete' => false);
}

$webhookSecret = config_value('STRIPE_IDENTITY_WEBHOOK_SECRET', config_value('STRIPE_WEBHOOK_SECRET', ''));
if ($webhookSecret === '') {
    send(array('ok' => false, 'error' => 'Stripe webhook secret is not configured.'), 500);
}

$rawPayload = file_get_contents('php://input');
if ($rawPayload === false || $rawPayload === '') {
    send(array('ok' => false, 'error' => 'Missing webhook payload.'), 400);
}

$signatureHeader = get_signature_header();
if (!verify_stripe_signature($rawPayload, $signatureHeader, $webhookSecret)) {
    send(array('ok' => false, 'error' => 'Invalid Stripe signature.'), 400);
}

$event = json_decode($rawPayload, true);
if (!is_array($event)) {
    send(array('ok' => false, 'error' => 'Invalid JSON payload.'), 400);
}

$eventType = trim((string) ($event['type'] ?? ''));
$obj = is_array($event['data']['object'] ?? null) ? $event['data']['object'] : array();

if (strpos($eventType, 'identity.verification_session.') !== 0) {
    send(array('ok' => true, 'ignored' => true));
}

$sessionId = trim((string) ($obj['id'] ?? ''));
$sessionStatus = trim((string) ($obj['status'] ?? ''));
$metadata = is_array($obj['metadata'] ?? null) ? $obj['metadata'] : array();
$userId = trim((string) ($metadata['anytransport_user_id'] ?? ''));
$mapped = map_identity_status($sessionStatus);

$storeDir = __DIR__ . '/data';
$storeFile = $storeDir . '/anytransport-store.json';
if (!is_dir($storeDir)) {
    @mkdir($storeDir, 0775, true);
}
if (!file_exists($storeFile)) {
    send(array('ok' => false, 'error' => 'Store file not found.'), 500);
}

$rawStore = @file_get_contents($storeFile);
$store = json_decode((string) $rawStore, true);
if (!is_array($store)) {
    send(array('ok' => false, 'error' => 'Store is invalid.'), 500);
}
if (!isset($store['users']) || !is_array($store['users'])) {
    $store['users'] = array();
}

$updated = false;
foreach ($store['users'] as $idx => $u) {
    if (!is_array($u)) {
        continue;
    }
    $matchesUser = ($userId !== '' && trim((string) ($u['id'] ?? '')) === $userId);
    $matchesSession = ($sessionId !== '' && trim((string) ($u['stripeIdentitySessionId'] ?? '')) === $sessionId);
    if (!$matchesUser && !$matchesSession) {
        continue;
    }

    $store['users'][$idx]['stripeIdentitySessionId'] = $sessionId;
    $store['users'][$idx]['stripeIdentityStatus'] = $mapped['identity'];
    $store['users'][$idx]['stripeOnboardingStatus'] = $mapped['onboarding'];
    $store['users'][$idx]['stripeOnboardingUpdatedAt'] = gmdate('c');
    $store['users'][$idx]['stripeIdentityLastError'] = trim((string) ($obj['last_error']['code'] ?? $obj['last_error']['reason'] ?? ''));
    if (!empty($mapped['complete'])) {
        $store['users'][$idx]['stripeOnboardingCompletedAt'] = gmdate('c');
        $store['users'][$idx]['stripeIdentityVerifiedAt'] = gmdate('c');
        if (!isset($store['users'][$idx]['identityReviewStatus']) || trim((string) $store['users'][$idx]['identityReviewStatus']) !== 'approved') {
            $store['users'][$idx]['identityReviewStatus'] = 'pending_review';
        }
    }
    $updated = true;
    break;
}

if ($updated) {
    @file_put_contents($storeFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

send(array('ok' => true, 'updated' => $updated));
