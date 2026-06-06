<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$preferredStoreDir = __DIR__ . '/data';
$preferredStoreFile = $preferredStoreDir . '/anytransport-store.json';
$storeDir = '';
$storeFile = '';
$action = isset($_GET['action']) ? trim((string) $_GET['action']) : '';
$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';
$localStripeConfig = array();
$localStripeConfigFile = __DIR__ . '/stripe-config.php';

if (file_exists($localStripeConfigFile)) {
    $loadedStripeConfig = include $localStripeConfigFile;
    if (is_array($loadedStripeConfig)) {
        $localStripeConfig = $loadedStripeConfig;
    }
}

require_once __DIR__ . '/site-content.php';

function resolve_store_dir($preferredDir) {
    $candidates = array();
    $envDir = trim((string) getenv('ANYTRANSPORT_STORE_DIR'));
    if ($envDir !== '') {
        $candidates[] = $envDir;
    }
    $candidates[] = $preferredDir;
    $candidates[] = __DIR__ . '/tmp';
    $sysTmp = function_exists('sys_get_temp_dir') ? trim((string) sys_get_temp_dir()) : '';
    if ($sysTmp !== '') {
        $candidates[] = rtrim($sysTmp, '/\\') . '/anytransport-data';
    }

    foreach ($candidates as $dir) {
        $dir = rtrim((string) $dir, '/\\');
        if ($dir === '') {
            continue;
        }
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        if (is_dir($dir) && is_writable($dir)) {
            return $dir;
        }
    }

    return rtrim((string) $preferredDir, '/\\');
}

$storeDir = resolve_store_dir($preferredStoreDir);
$storeFile = $storeDir . '/anytransport-store.json';

function bootstrap_store_from_fallback($targetStoreFile, $fallbackStoreFile) {
    $target = trim((string) $targetStoreFile);
    $fallback = trim((string) $fallbackStoreFile);
    if ($target === '' || $fallback === '' || $target === $fallback) {
        return;
    }
    if (!file_exists($fallback) || !is_readable($fallback)) {
        return;
    }
    $fallbackRaw = @file_get_contents($fallback);
    if ($fallbackRaw === false || trim((string) $fallbackRaw) === '') {
        return;
    }
    $fallbackParsed = json_decode($fallbackRaw, true);
    if (!is_array($fallbackParsed)) {
        return;
    }

    $targetExists = file_exists($target);
    $targetParsed = array();
    if ($targetExists) {
        $targetRaw = @file_get_contents($target);
        $decoded = json_decode((string) $targetRaw, true);
        if (is_array($decoded)) {
            $targetParsed = $decoded;
        }
    }

    $targetUsers = isset($targetParsed['users']) && is_array($targetParsed['users']) ? count($targetParsed['users']) : 0;
    $targetQuotes = isset($targetParsed['quotes']) && is_array($targetParsed['quotes']) ? count($targetParsed['quotes']) : 0;
    $targetBids = isset($targetParsed['bids']) && is_array($targetParsed['bids']) ? count($targetParsed['bids']) : 0;
    $fallbackUsers = isset($fallbackParsed['users']) && is_array($fallbackParsed['users']) ? count($fallbackParsed['users']) : 0;
    $fallbackQuotes = isset($fallbackParsed['quotes']) && is_array($fallbackParsed['quotes']) ? count($fallbackParsed['quotes']) : 0;
    $fallbackBids = isset($fallbackParsed['bids']) && is_array($fallbackParsed['bids']) ? count($fallbackParsed['bids']) : 0;

    $shouldBootstrap = !$targetExists;
    if ($targetExists) {
        $targetLooksEmpty = ($targetUsers + $targetQuotes + $targetBids) <= 1;
        $fallbackHasData = ($fallbackUsers + $fallbackQuotes + $fallbackBids) > ($targetUsers + $targetQuotes + $targetBids);
        $shouldBootstrap = $targetLooksEmpty && $fallbackHasData;
    }
    if (!$shouldBootstrap) {
        return;
    }

    $dir = dirname($target);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    if (!is_dir($dir) || !is_writable($dir)) {
        return;
    }
    if (@file_put_contents($target, $fallbackRaw, LOCK_EX) !== false) {
        @file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | store_bootstrap_copied from={$fallback} to={$target} fallback_users={$fallbackUsers} target_users={$targetUsers}\n", FILE_APPEND | LOCK_EX);
    }
}

bootstrap_store_from_fallback($storeFile, $preferredStoreFile);

function default_store() {
    return array(
        'users' => array(),
        'sessions' => array(),
        'quotes' => array(),
        'bids' => array(),
        'messages' => array(),
        'replyTokens' => array(),
        'notifications' => array(),
        'quoteMedia' => array(),
        'formReports' => array(),
        'autoBidEvents' => array(),
        'customerBidEmailQueue' => array(),
        'autoBidWarQueue' => array(),
        'providerInvites' => array(),
        'providerReviews' => array()
    );
}

function send_json($payload, $status = 200) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function send_json_and_continue($payload, $status = 200) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (function_exists('fastcgi_finish_request')) {
        @fastcgi_finish_request();
    } else {
        if (function_exists('ignore_user_abort')) {
            @ignore_user_abort(true);
        }
        @ob_flush();
        @flush();
    }
}

function read_store($storeFile) {
    if (!file_exists($storeFile)) {
        return default_store();
    }

    $raw = file_get_contents($storeFile);
    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) {
        return default_store();
    }

    return array_merge(default_store(), $parsed);
}

function build_store_candidates($preferredStoreFile, $activeStoreFile) {
    $candidates = array();
    $candidates[] = trim((string) $activeStoreFile);
    $candidates[] = trim((string) $preferredStoreFile);
    $candidates[] = rtrim(__DIR__, '/\\') . '/tmp/anytransport-store.json';
    $sysTmp = function_exists('sys_get_temp_dir') ? trim((string) sys_get_temp_dir()) : '';
    if ($sysTmp !== '') {
        $candidates[] = rtrim($sysTmp, '/\\') . '/anytransport-data/anytransport-store.json';
    }
    $out = array();
    foreach ($candidates as $file) {
        if ($file === '') continue;
        if (!in_array($file, $out, true)) {
            $out[] = $file;
        }
    }
    return $out;
}

function store_signal_score($store) {
    if (!is_array($store)) return 0;
    $users = isset($store['users']) && is_array($store['users']) ? count($store['users']) : 0;
    $quotes = isset($store['quotes']) && is_array($store['quotes']) ? count($store['quotes']) : 0;
    $bids = isset($store['bids']) && is_array($store['bids']) ? count($store['bids']) : 0;
    $messages = isset($store['messages']) && is_array($store['messages']) ? count($store['messages']) : 0;
    return ($users * 1000) + ($quotes * 100) + ($bids * 10) + $messages;
}

function choose_richest_store($preferredStoreFile, $activeStoreFile) {
    $bestStore = default_store();
    $bestScore = -1;
    $bestFile = '';
    $candidates = build_store_candidates($preferredStoreFile, $activeStoreFile);
    foreach ($candidates as $candidate) {
        if (!file_exists($candidate) || !is_readable($candidate)) {
            continue;
        }
        $store = read_store($candidate);
        $score = store_signal_score($store);
        if ($score > $bestScore) {
            $bestScore = $score;
            $bestStore = $store;
            $bestFile = $candidate;
        }
    }
    return array('store' => $bestStore, 'score' => $bestScore, 'file' => $bestFile);
}

function write_store($storeFile, $store) {
    $encoded = json_encode($store, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false) {
        send_json(array('ok' => false, 'error' => 'Unable to encode data.'), 500);
    }

    $storeDir = dirname($storeFile);
    if (!is_dir($storeDir)) {
        @mkdir($storeDir, 0775, true);
    }
    if (!is_dir($storeDir) || !is_writable($storeDir)) {
        @file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | store_write_failed reason=dir_not_writable dir={$storeDir}\n", FILE_APPEND | LOCK_EX);
        send_json(array('ok' => false, 'error' => 'Unable to save data: storage directory is not writable.'), 500);
    }

    $tmpFile = $storeFile . '.tmp';
    $written = @file_put_contents($tmpFile, $encoded, LOCK_EX);
    if ($written === false) {
        $err = error_get_last();
        $detail = is_array($err) && !empty($err['message']) ? (string) $err['message'] : 'unknown';
        @file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | store_write_failed reason=tmp_write_failed file={$tmpFile} detail={$detail}\n", FILE_APPEND | LOCK_EX);
        send_json(array('ok' => false, 'error' => 'Unable to save data: temporary write failed.'), 500);
    }

    if (!@rename($tmpFile, $storeFile)) {
        $err = error_get_last();
        $detail = is_array($err) && !empty($err['message']) ? (string) $err['message'] : 'unknown';
        @unlink($tmpFile);
        @file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | store_write_failed reason=rename_failed file={$storeFile} detail={$detail}\n", FILE_APPEND | LOCK_EX);
        send_json(array('ok' => false, 'error' => 'Unable to save data: replace failed.'), 500);
    }
}

function read_json_input() {
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return array();
    }

    $parsed = json_decode($raw, true);
    return is_array($parsed) ? $parsed : array();
}

function make_id($prefix) {
    try {
        $bytes = random_bytes(8);
        return $prefix . '-' . bin2hex($bytes);
    } catch (Exception $error) {
        return $prefix . '-' . str_replace('.', '', uniqid('', true));
    }
}

function make_form_id($quotes) {
    $used = array();
    foreach ($quotes as $quote) {
        $formId = isset($quote['formId']) ? trim((string) $quote['formId']) : '';
        if (preg_match('/^\d{5}$/', $formId)) {
            $used[$formId] = true;
        }
    }

    for ($attempt = 0; $attempt < 5000; $attempt++) {
        $candidate = str_pad((string) random_int(10000, 99999), 5, '0', STR_PAD_LEFT);
        if (!isset($used[$candidate])) {
            return $candidate;
        }
    }

    return (string) random_int(10000, 99999);
}

function normalize_user($user) {
    if (!is_array($user)) {
        return array();
    }

    $normalized = $user;
    if (!isset($normalized['id']) || trim((string) $normalized['id']) === '') {
        $normalized['id'] = make_id('user');
    }

    $candidate = '';
    foreach (array('username', 'nickname', 'displayName', 'handle', 'name', 'email') as $field) {
        if (isset($normalized[$field]) && trim((string) $normalized[$field]) !== '') {
            $candidate = trim((string) $normalized[$field]);
            break;
        }
    }

    if (!isset($normalized['username']) || trim((string) $normalized['username']) === '') {
        $normalized['username'] = preg_replace('/[^a-zA-Z0-9._-]/', '', preg_replace('/\s+/', '', $candidate)) ?: 'User';
    }

    if (!isset($normalized['nickname']) || trim((string) $normalized['nickname']) === '') {
        $normalized['nickname'] = $normalized['username'];
    }

    if (!isset($normalized['createdAt'])) {
        $normalized['createdAt'] = gmdate('c');
    }

    if (!isset($normalized['stripeAccountId'])) {
        $normalized['stripeAccountId'] = '';
    }

    if (!isset($normalized['stripeOnboardingStatus'])) {
        $normalized['stripeOnboardingStatus'] = 'not_started';
    }

    if (!isset($normalized['stripeOnboardingUpdatedAt'])) {
        $normalized['stripeOnboardingUpdatedAt'] = '';
    }

    if (!isset($normalized['stripeIdentitySessionId'])) {
        $normalized['stripeIdentitySessionId'] = '';
    }

    if (!isset($normalized['stripeIdentityStatus'])) {
        $normalized['stripeIdentityStatus'] = trim((string) ($normalized['stripeOnboardingStatus'] ?? '')) === 'complete' ? 'verified' : 'not_started';
    }

    if (!isset($normalized['stripeIdentityVerifiedAt'])) {
        $normalized['stripeIdentityVerifiedAt'] = '';
    }

    if (!isset($normalized['stripeIdentityLastError'])) {
        $normalized['stripeIdentityLastError'] = '';
    }

    if (!isset($normalized['identityReviewStatus']) || trim((string) $normalized['identityReviewStatus']) === '') {
        $normalized['identityReviewStatus'] = strtolower(trim((string) ($normalized['role'] ?? 'customer'))) === 'provider' ? 'pending_review' : 'not_required';
    }

    if (!isset($normalized['identityPhotos']) || !is_array($normalized['identityPhotos'])) {
        $normalized['identityPhotos'] = array();
    }

    if (!isset($normalized['identityReviewSubmittedAt'])) {
        $normalized['identityReviewSubmittedAt'] = '';
    }

    if (!isset($normalized['identityReviewedAt'])) {
        $normalized['identityReviewedAt'] = '';
    }

    if (!isset($normalized['identityReviewedBy'])) {
        $normalized['identityReviewedBy'] = '';
    }

    if (!isset($normalized['identityReviewNotes'])) {
        $normalized['identityReviewNotes'] = '';
    }

    if (!isset($normalized['passwordResetToken'])) {
        $normalized['passwordResetToken'] = '';
    }

    if (!isset($normalized['passwordResetExpiresAt'])) {
        $normalized['passwordResetExpiresAt'] = '';
    }

    if (!isset($normalized['profileChangeStatus']) || trim((string) $normalized['profileChangeStatus']) === '') {
        $normalized['profileChangeStatus'] = 'none';
    }

    if (!isset($normalized['profileChangePending']) || !is_array($normalized['profileChangePending'])) {
        $normalized['profileChangePending'] = array();
    }

    if (!isset($normalized['profileChangeSubmittedAt'])) {
        $normalized['profileChangeSubmittedAt'] = '';
    }

    if (!isset($normalized['profileChangeReviewedAt'])) {
        $normalized['profileChangeReviewedAt'] = '';
    }

    if (!isset($normalized['profileChangeReviewedBy'])) {
        $normalized['profileChangeReviewedBy'] = '';
    }

    if (!isset($normalized['profileChangeReviewNotes'])) {
        $normalized['profileChangeReviewNotes'] = '';
    }

    if (!isset($normalized['paymentMethods']) || !is_array($normalized['paymentMethods'])) {
        $normalized['paymentMethods'] = array();
    }

    if (!isset($normalized['categories']) || !is_array($normalized['categories'])) {
        $normalized['categories'] = array();
    }

    if (!isset($normalized['skills']) || !is_array($normalized['skills'])) {
        $normalized['skills'] = array();
    }

    if (!isset($normalized['companyType'])) {
        $normalized['companyType'] = '';
    }

    if (!isset($normalized['website'])) {
        $normalized['website'] = '';
    }

    if (!isset($normalized['blockInvites'])) {
        $normalized['blockInvites'] = false;
    }

    if (!isset($normalized['muteInviteEmails'])) {
        $normalized['muteInviteEmails'] = false;
    }

    unset($normalized['autoBidCooldownSeconds'], $normalized['autoBidWarQuietMinutes'], $normalized['autoBidWarQuietSeconds']);

    if (!array_key_exists('vehicleCount', $normalized) || $normalized['vehicleCount'] === '' || $normalized['vehicleCount'] === null) {
        $normalized['vehicleCount'] = null;
    } else {
        $normalized['vehicleCount'] = max(0, min(9999, (int) $normalized['vehicleCount']));
    }

    $cityValue = trim((string) ($normalized['serviceAreaCity'] ?? $normalized['city'] ?? $normalized['town'] ?? $normalized['location'] ?? ''));
    if ($cityValue !== '') {
        $normalized['serviceAreaCity'] = $cityValue;
        if (!isset($normalized['city']) || trim((string) $normalized['city']) === '') {
            $normalized['city'] = $cityValue;
        }
        if (!isset($normalized['location']) || trim((string) $normalized['location']) === '') {
            $normalized['location'] = $cityValue;
        }
    } elseif (!isset($normalized['serviceAreaCity'])) {
        $normalized['serviceAreaCity'] = '';
    }

    if (!isset($normalized['serviceAreaAddress'])) {
        $normalized['serviceAreaAddress'] = '';
    }

    $normalized['serviceAreaLat'] = isset($normalized['serviceAreaLat']) ? (float) $normalized['serviceAreaLat'] : 0.0;
    $normalized['serviceAreaLng'] = isset($normalized['serviceAreaLng']) ? (float) $normalized['serviceAreaLng'] : 0.0;

    if (!isset($normalized['showExactAddressOnMap'])) {
        $normalized['showExactAddressOnMap'] = false;
    } else {
        $normalized['showExactAddressOnMap'] = !empty($normalized['showExactAddressOnMap']);
    }

    if (!isset($normalized['autoBidSubscriptionEnabled'])) {
        $role = strtolower(trim((string) ($normalized['role'] ?? 'customer')));
        $normalized['autoBidSubscriptionEnabled'] = ($role === 'provider');
    } else {
        $normalized['autoBidSubscriptionEnabled'] = !empty($normalized['autoBidSubscriptionEnabled']);
    }

    // Keep paymentMethods and legacy flat flags aligned so the provider profile UI persists reliably.
    $pm = isset($normalized['paymentMethods']) && is_array($normalized['paymentMethods']) ? $normalized['paymentMethods'] : array();
    foreach (array('cash', 'cheque', 'visa', 'mastercard', 'paypal', 'americanExpress', 'bankTransfer', 'revolut') as $pmKey) {
        if (!array_key_exists($pmKey, $pm)) {
            $pm[$pmKey] = false;
        } else {
            $pm[$pmKey] = !empty($pm[$pmKey]);
        }
    }
    if (!empty($normalized['acceptsCash']) || !empty($normalized['cash'])) {
        $pm['cash'] = true;
    }
    if (!empty($normalized['cheque'])) {
        $pm['cheque'] = true;
    }
    if (!empty($normalized['visa'])) {
        $pm['visa'] = true;
    }
    if (!empty($normalized['mastercard'])) {
        $pm['mastercard'] = true;
    }
    if (!empty($normalized['paypal'])) {
        $pm['paypal'] = true;
    }
    if (!empty($normalized['americanExpress'])) {
        $pm['americanExpress'] = true;
    }
    if (!empty($normalized['bankTransfer'])) {
        $pm['bankTransfer'] = true;
    }
    $normalized['paymentMethods'] = $pm;
    if (!isset($normalized['paymentMethodsCustom']) || !is_array($normalized['paymentMethodsCustom'])) {
        $normalized['paymentMethodsCustom'] = array();
    } else {
        $seenCustom = array();
        $cleanCustom = array();
        foreach ($normalized['paymentMethodsCustom'] as $item) {
            $label = trim((string) $item);
            if ($label === '') {
                continue;
            }
            $customKey = strtolower(preg_replace('/[^a-z0-9]+/', ' ', $label));
            if ($customKey === '' || isset($seenCustom[$customKey])) {
                continue;
            }
            $seenCustom[$customKey] = true;
            $cleanCustom[] = $label;
        }
        $normalized['paymentMethodsCustom'] = $cleanCustom;
    }
    $normalized['acceptsCash'] = !empty($pm['cash']);
    $normalized['cash'] = !empty($pm['cash']);
    $normalized['cheque'] = !empty($pm['cheque']);
    $normalized['visa'] = !empty($pm['visa']);
    $normalized['mastercard'] = !empty($pm['mastercard']);
    $normalized['paypal'] = !empty($pm['paypal']);
    $normalized['americanExpress'] = !empty($pm['americanExpress']);
    $normalized['bankTransfer'] = !empty($pm['bankTransfer']);

    return $normalized;
}

function sanitize_user_for_client($user) {
    if (!is_array($user)) {
        return $user;
    }
    $out = $user;
    unset($out['password']);
    return $out;
}

function sanitize_users_for_client($users) {
    $out = array();
    foreach ($users as $u) {
        if (is_array($u)) {
            $out[] = sanitize_user_for_client($u);
        }
    }
    return $out;
}

function get_env_value($names, $default = '') {
    global $localStripeConfig;

    $keys = is_array($names) ? $names : array($names);
    foreach ($keys as $name) {
        if (is_array($localStripeConfig) && isset($localStripeConfig[$name]) && trim((string) $localStripeConfig[$name]) !== '') {
            return trim((string) $localStripeConfig[$name]);
        }

        $value = getenv($name);
        if ($value !== false && trim((string) $value) !== '') {
            return trim((string) $value);
        }

        if (isset($_SERVER[$name]) && trim((string) $_SERVER[$name]) !== '') {
            return trim((string) $_SERVER[$name]);
        }
    }

    return $default;
}

function get_app_origin() {
    $configured = get_env_value(array('APP_BASE_URL', 'APP_URL', 'SITE_URL'), '');
    if ($configured !== '') {
        return rtrim($configured, '/');
    }

    if (!empty($_SERVER['HTTP_ORIGIN'])) {
        return rtrim((string) $_SERVER['HTTP_ORIGIN'], '/');
    }

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = !empty($_SERVER['HTTP_HOST']) ? (string) $_SERVER['HTTP_HOST'] : '';
    if ($host === '') {
        return '';
    }

    return $scheme . '://' . $host;
}

function get_app_url($path) {
    $origin = get_app_origin();
    $cleanPath = '/' . ltrim((string) $path, '/');
    if ($origin === '') {
        return $cleanPath;
    }

    return $origin . $cleanPath;
}

function find_user_index_by_id($users, $userId) {
    return find_user_index($users, function ($user) use ($userId) {
        return trim((string) ($user['id'] ?? '')) === $userId;
    });
}

function stripe_request_internal($method, $path, $payload = array()) {
    $secretKey = get_env_value(array('STRIPE_SECRET_KEY', 'STRIPE_API_KEY'));
    if ($secretKey === '') {
        return array('ok' => false, 'error' => 'Stripe is not configured. Set STRIPE_SECRET_KEY on the API server.', 'status' => 500);
    }

    if (!function_exists('curl_init')) {
        return array('ok' => false, 'error' => 'Stripe integration requires the PHP cURL extension.', 'status' => 500);
    }

    $method = strtoupper((string) $method);
    $url = 'https://api.stripe.com' . $path;
    $headers = array(
        'Authorization: Bearer ' . $secretKey,
        'Content-Type: application/x-www-form-urlencoded'
    );

    $body = http_build_query($payload, '', '&', PHP_QUERY_RFC3986);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

    if ($method !== 'GET') {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }

    $responseBody = curl_exec($ch);
    $curlError = curl_error($ch);
    $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($responseBody === false || $curlError !== '') {
        return array('ok' => false, 'error' => 'Stripe request failed: ' . $curlError, 'status' => 500);
    }

    $decoded = json_decode($responseBody, true);
    if (!is_array($decoded)) {
        return array('ok' => false, 'error' => 'Unexpected Stripe response.', 'status' => 500);
    }

    if ($statusCode < 200 || $statusCode >= 300) {
        $errorMessage = 'Stripe request failed.';
        if (!empty($decoded['error']['message'])) {
            $errorMessage = (string) $decoded['error']['message'];
        }
        return array('ok' => false, 'error' => $errorMessage, 'status' => $statusCode);
    }

    return array('ok' => true, 'data' => $decoded);
}

function stripe_request($method, $path, $payload = array()) {
    $result = stripe_request_internal($method, $path, $payload);
    if (empty($result['ok'])) {
        send_json(array('ok' => false, 'error' => (string) ($result['error'] ?? 'Stripe request failed.')), (int) ($result['status'] ?? 500));
    }
    return is_array($result['data'] ?? null) ? $result['data'] : array();
}

function stripe_file_upload($fileContents, $filename = 'upload.jpg', $purpose = 'identity_document', $accountId = '') {
    $secretKey = get_env_value(array('STRIPE_SECRET_KEY', 'STRIPE_API_KEY'));
    if ($secretKey === '') {
        send_json(array('ok' => false, 'error' => 'Stripe is not configured. Set STRIPE_SECRET_KEY on the API server.'), 500);
    }

    if (!function_exists('curl_init')) {
        send_json(array('ok' => false, 'error' => 'Stripe integration requires the PHP cURL extension.'), 500);
    }

    $url = 'https://files.stripe.com/v1/files';

    $ch = curl_init();
    $headers = array('Authorization: Bearer ' . $secretKey);
    if ($accountId !== '') {
        $headers[] = 'Stripe-Account: ' . $accountId;
    }

    // Prepare a temporary file
    $tmp = tmpfile();
    if ($tmp === false) {
        send_json(array('ok' => false, 'error' => 'Unable to create temp file for upload.'), 500);
    }
    $meta = stream_get_meta_data($tmp);
    $tmpName = $meta['uri'];
    file_put_contents($tmpName, $fileContents);

    $cfile = new CURLFile($tmpName, mime_content_type($tmpName), $filename);

    $post = array(
        'purpose' => $purpose,
        'file' => $cfile
    );

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);

    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    @fclose($tmp);

    if ($response === false || $curlError !== '') {
        send_json(array('ok' => false, 'error' => 'Stripe file upload failed: ' . $curlError), 500);
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
        send_json(array('ok' => false, 'error' => 'Unexpected Stripe response during file upload.'), 500);
    }

    if ($status < 200 || $status >= 300) {
        $err = !empty($decoded['error']['message']) ? $decoded['error']['message'] : 'Stripe file upload failed.';
        send_json(array('ok' => false, 'error' => $err), $status);
    }

    return $decoded;
}

function stripe_file_upload_internal($fileContents, $filename = 'upload.jpg', $purpose = 'identity_document', $accountId = '') {
    $secretKey = get_env_value(array('STRIPE_SECRET_KEY', 'STRIPE_API_KEY'));
    if ($secretKey === '') {
        return array('ok' => false, 'error' => 'Stripe is not configured.');
    }
    if (!function_exists('curl_init')) {
        return array('ok' => false, 'error' => 'Stripe integration requires the PHP cURL extension.');
    }

    $url = 'https://files.stripe.com/v1/files';
    $ch = curl_init();
    $headers = array('Authorization: Bearer ' . $secretKey);
    if ($accountId !== '') {
        $headers[] = 'Stripe-Account: ' . $accountId;
    }

    $tmp = tmpfile();
    if ($tmp === false) {
        return array('ok' => false, 'error' => 'Unable to create temp file for upload.');
    }
    $meta = stream_get_meta_data($tmp);
    $tmpName = $meta['uri'];
    file_put_contents($tmpName, $fileContents);
    $cfile = new CURLFile($tmpName, mime_content_type($tmpName) ?: 'image/jpeg', $filename);
    $post = array('purpose' => $purpose, 'file' => $cfile);

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);

    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    @fclose($tmp);

    if ($response === false || $curlError !== '') {
        return array('ok' => false, 'error' => 'Stripe file upload failed: ' . $curlError);
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
        return array('ok' => false, 'error' => 'Unexpected Stripe response during file upload.');
    }
    if ($status < 200 || $status >= 300) {
        $err = !empty($decoded['error']['message']) ? $decoded['error']['message'] : 'Stripe file upload failed.';
        return array('ok' => false, 'error' => $err);
    }

    return array('ok' => true, 'data' => $decoded);
}

function attach_stripe_identity_file_to_account($stripeAccountId, $fileId, $side = 'front') {
    $stripeAccountId = trim((string) $stripeAccountId);
    $fileId = trim((string) $fileId);
    if ($stripeAccountId === '' || $fileId === '') {
        return array('ok' => false, 'error' => 'Stripe account and file id are required.');
    }
    $side = strtolower(trim((string) $side)) === 'back' ? 'back' : 'front';
    $field = 'individual[verification][document][' . $side . ']';
    return stripe_request_internal('POST', '/v1/accounts/' . rawurlencode($stripeAccountId), array(
        $field => $fileId
    ));
}

function identity_photo_entry_exists($photos, $stripeFileId) {
    $stripeFileId = trim((string) $stripeFileId);
    if ($stripeFileId === '' || !is_array($photos)) {
        return false;
    }
    foreach ($photos as $photo) {
        if (!is_array($photo)) {
            continue;
        }
        if (trim((string) ($photo['stripeFile'] ?? '')) === $stripeFileId) {
            return true;
        }
    }
    return false;
}

function merge_stripe_verification_documents_into_user($user, $account) {
    if (!is_array($user) || !is_array($account)) {
        return $user;
    }
    $individual = isset($account['individual']) && is_array($account['individual']) ? $account['individual'] : array();
    $verification = isset($individual['verification']) && is_array($individual['verification']) ? $individual['verification'] : array();
    $document = isset($verification['document']) && is_array($verification['document']) ? $verification['document'] : array();
    $additional = isset($verification['additional_document']) && is_array($verification['additional_document']) ? $verification['additional_document'] : array();

    $candidates = array(
        array('id' => trim((string) ($document['front'] ?? '')), 'label' => 'ID document (front)', 'side' => 'front', 'source' => 'stripe_onboarding'),
        array('id' => trim((string) ($document['back'] ?? '')), 'label' => 'ID document (back)', 'side' => 'back', 'source' => 'stripe_onboarding'),
        array('id' => trim((string) ($additional['front'] ?? '')), 'label' => 'Additional document', 'side' => 'additional', 'source' => 'stripe_onboarding')
    );

    if (!isset($user['identityPhotos']) || !is_array($user['identityPhotos'])) {
        $user['identityPhotos'] = array();
    }

    foreach ($candidates as $candidate) {
        $fileId = trim((string) ($candidate['id'] ?? ''));
        if ($fileId === '' || identity_photo_entry_exists($user['identityPhotos'], $fileId)) {
            continue;
        }
        $user['identityPhotos'][] = array(
            'label' => (string) ($candidate['label'] ?? 'Stripe identity document'),
            'name' => (string) ($candidate['label'] ?? 'Stripe identity document'),
            'stripeFile' => $fileId,
            'source' => (string) ($candidate['source'] ?? 'stripe_onboarding'),
            'stripeSide' => (string) ($candidate['side'] ?? ''),
            'uploadedAt' => gmdate('c')
        );
    }

    return $user;
}

function decode_identity_photo_binary($payload) {
    $payload = trim((string) $payload);
    if ($payload === '') {
        return null;
    }
    if (strpos($payload, 'data:') === 0 && preg_match('/^data:(.*?);base64,(.*)$/', $payload, $matches)) {
        $mime = (string) ($matches[1] ?? 'image/jpeg');
        $bin = base64_decode((string) ($matches[2] ?? ''));
        if ($bin === false) {
            return null;
        }
        $ext = '.jpg';
        if (strpos($mime, 'png') !== false) {
            $ext = '.png';
        }
        return array('binary' => $bin, 'filename' => 'identity' . $ext, 'previewDataUrl' => $payload);
    }

    try {
        $bin = @file_get_contents($payload);
        if ($bin === false) {
            return null;
        }
        $filename = basename(parse_url($payload, PHP_URL_PATH) ?: 'upload.jpg');
        return array('binary' => $bin, 'filename' => $filename, 'previewDataUrl' => '');
    } catch (Exception $e) {
        return null;
    }
}

function process_provider_identity_photo_payloads(&$store, $storeFile, $userId, $photos, $labels = array()) {
    $userId = trim((string) $userId);
    if ($userId === '' || !is_array($photos) || empty($photos)) {
        return array('uploaded' => array(), 'user' => null);
    }

    $userIndex = find_user_index_by_id($store['users'], $userId);
    if ($userIndex < 0) {
        return array('uploaded' => array(), 'user' => null, 'error' => 'User not found.');
    }

    $updated = normalize_user($store['users'][$userIndex]);
    $accountId = trim((string) ($updated['stripeAccountId'] ?? ''));
    if ($accountId === '') {
        $verification = begin_provider_stripe_verification($store, $storeFile, $userId, 'dashboard.html', false);
        if (!empty($verification['user']) && is_array($verification['user'])) {
            $updated = $verification['user'];
            $accountId = trim((string) ($updated['stripeAccountId'] ?? ''));
        }
    }
    if ($accountId === '') {
        return array('uploaded' => array(), 'user' => $updated, 'error' => 'Stripe account is not ready for photo upload.');
    }

    if (!isset($updated['identityPhotos']) || !is_array($updated['identityPhotos'])) {
        $updated['identityPhotos'] = array();
    }

    $uploaded = array();
    $attachSides = array('front', 'back');
    $attachIndex = 0;

    foreach ($photos as $i => $photo) {
        $binary = null;
        $filename = 'identity-' . ($i + 1) . '.jpg';
        $previewDataUrl = '';
        $label = isset($labels[$i]) ? (string) $labels[$i] : '';

        if (is_array($photo)) {
            $label = $label !== '' ? $label : trim((string) ($photo['label'] ?? $photo['name'] ?? ''));
            $payload = trim((string) ($photo['dataUrl'] ?? $photo['previewDataUrl'] ?? ''));
            if ($payload !== '') {
                $decoded = decode_identity_photo_binary($payload);
                if ($decoded !== null) {
                    $binary = $decoded['binary'];
                    $filename = (string) ($decoded['filename'] ?? $filename);
                    $previewDataUrl = (string) ($decoded['previewDataUrl'] ?? $payload);
                }
            }
        } else {
            $decoded = decode_identity_photo_binary($photo);
            if ($decoded !== null) {
                $binary = $decoded['binary'];
                $filename = (string) ($decoded['filename'] ?? $filename);
                $previewDataUrl = (string) ($decoded['previewDataUrl'] ?? '');
            }
        }

        if ($binary === null || $binary === '') {
            continue;
        }

        $uploadResp = stripe_file_upload_internal($binary, $filename, 'identity_document', $accountId);
        if (empty($uploadResp['ok']) || !is_array($uploadResp['data'] ?? null)) {
            continue;
        }

        $file = $uploadResp['data'];
        $fileId = trim((string) ($file['id'] ?? ''));
        if ($fileId === '') {
            continue;
        }

        $side = isset($attachSides[$attachIndex]) ? $attachSides[$attachIndex] : 'additional';
        $attachIndex += 1;
        attach_stripe_identity_file_to_account($accountId, $fileId, $side);

        $entry = array(
            'uploadedAt' => gmdate('c'),
            'source' => 'stripe',
            'stripeFile' => $fileId,
            'stripeSide' => $side,
            'label' => $label !== '' ? $label : ('Identity photo ' . ($i + 1)),
            'name' => $label !== '' ? $label : ('Identity photo ' . ($i + 1))
        );
        if ($previewDataUrl !== '') {
            $entry['previewDataUrl'] = $previewDataUrl;
        }
        $updated['identityPhotos'][] = $entry;
        $uploaded[] = $entry;
    }

    if (!empty($uploaded)) {
        $updated['identityReviewStatus'] = 'pending_review';
        $updated['identityReviewSubmittedAt'] = gmdate('c');
        $store['users'][$userIndex] = normalize_user($updated);
        write_store($storeFile, $store);
        $updated = normalize_user($store['users'][$userIndex]);
        try {
            send_admin_provider_verification_queue_email(
                $store,
                $updated,
                'Provider uploaded identity photos',
                array('Photos uploaded: ' . count($uploaded))
            );
        } catch (Exception $_e) {
            // swallow email errors
        }
    }

    return array('uploaded' => $uploaded, 'user' => $updated);
}

function mark_provider_stripe_complete_pending_admin(&$store, $userId, $storeFile = '') {
    $userId = trim((string) $userId);
    $index = find_user_index_by_id($store['users'], $userId);
    if ($index < 0) {
        return null;
    }

    $user = normalize_user($store['users'][$index]);
    if (strtolower(trim((string) ($user['role'] ?? ''))) !== 'provider') {
        return $user;
    }
    if (!provider_stripe_onboarding_is_complete($user)) {
        return $user;
    }

    $status = strtolower(trim((string) ($user['identityReviewStatus'] ?? '')));
    if ($status === 'approved') {
        return $user;
    }

    $alreadyNotifiedProvider = trim((string) ($user['stripeVerificationSubmittedNotifiedAt'] ?? '')) !== '';

    $store['users'][$index] = normalize_user(array_merge($store['users'][$index], array(
        'identityReviewStatus' => 'pending_review',
        'verified' => false,
        'stripeIdentityVerifiedAt' => gmdate('c')
    )));

    if ($storeFile !== '') {
        maybe_send_provider_stripe_verification_submitted_email($store, $storeFile, $index);
    }

    $updatedUser = normalize_user($store['users'][$index]);
    if (
        !$alreadyNotifiedProvider
        && trim((string) ($updatedUser['stripeVerificationSubmittedNotifiedAt'] ?? '')) !== ''
    ) {
        try {
            send_admin_provider_verification_queue_email(
                $store,
                $updatedUser,
                'Provider completed Stripe identity verification',
                array('The provider is ready for admin identity review in the dashboard.')
            );
        } catch (Exception $_e) {
            // swallow email errors
        }
    }

    return $updatedUser;
}

function require_provider_identity_reverification(&$store, $storeFile, $providerId, $notes = '', $adminId = '') {
    $providerId = trim((string) $providerId);
    $index = find_user_index_by_id($store['users'], $providerId);
    if ($index < 0) {
        return array('ok' => false, 'error' => 'Provider not found.');
    }

    $provider = normalize_user($store['users'][$index]);
    $store['users'][$index] = normalize_user(array_merge($store['users'][$index], array(
        'identityReviewStatus' => 'rejected',
        'identityReviewedAt' => gmdate('c'),
        'identityReviewedBy' => trim((string) $adminId),
        'identityReviewNotes' => trim((string) $notes),
        'verified' => false,
        'stripeOnboardingStatus' => 'pending',
        'stripeOnboardingCompletedAt' => '',
        'stripeIdentityVerifiedAt' => '',
        'stripeVerificationSubmittedNotifiedAt' => ''
    )));
    write_store($storeFile, $store);

    $verification = array('ok' => false, 'emailed' => false);
    try {
        $verification = begin_provider_stripe_verification($store, $storeFile, $providerId, 'dashboard.html', true);
    } catch (Exception $_e) {
        $verification = array('ok' => false, 'emailed' => false, 'error' => 'Could not send Stripe verification email.');
    }

    $updated = normalize_user($store['users'][$index]);
    return array('ok' => true, 'provider' => $updated, 'stripeVerification' => $verification);
}

function user_can_access_stripe_file($store, $currentUser, $fileId) {
    $fileId = trim((string) $fileId);
    if ($fileId === '') {
        return false;
    }

    foreach ($store['users'] as $user) {
        $photos = isset($user['identityPhotos']) && is_array($user['identityPhotos']) ? $user['identityPhotos'] : array();
        if (!identity_photo_entry_exists($photos, $fileId)) {
            continue;
        }
        if (is_admin_user($currentUser)) {
            return true;
        }
        $currentUserId = is_array($currentUser) ? trim((string) ($currentUser['id'] ?? '')) : '';
        if ($currentUserId !== '' && trim((string) ($user['id'] ?? '')) === $currentUserId) {
            return true;
        }
    }

    return false;
}

require_once __DIR__ . '/email-smtp.php';
require_once __DIR__ . '/provider-stripe-submitted-email.php';

function provider_profile_review_field_names() {
    return array(
        'businessName', 'name', 'nickname', 'username',
        'city', 'town', 'location', 'phone', 'contact',
        'description', 'businessDescription', 'about', 'bio', 'summary',
        'services', 'categories', 'skills', 'photos', 'avatar', 'coverImage',
        'transportModes', 'vehicleCount',
        'website', 'companyType', 'paymentMethods', 'paymentMethodsCustom', 'acceptsCash', 'paypal', 'visa', 'mastercard', 'bankTransfer', 'americanExpress', 'cheque', 'cash',
        'blockInvites', 'muteInviteEmails',
        'serviceAreaCity', 'serviceAreaAddress', 'serviceAreaLat', 'serviceAreaLng',
        'showExactAddressOnMap',
        'autoBidSubscriptionEnabled',
        'instagram', 'facebook', 'x', 'twitter', 'tiktok', 'linkedin'
    );
}

function is_provider_account($user) {
    if (!is_array($user)) {
        return false;
    }
    $role = strtolower(trim((string) ($user['role'] ?? '')));
    if ($role === 'provider') {
        return true;
    }
    $roles = isset($user['roles']) && is_array($user['roles']) ? $user['roles'] : array();
    foreach ($roles as $entry) {
        if (strtolower(trim((string) $entry)) === 'provider') {
            return true;
        }
    }
    return false;
}

function is_verified_provider_account($user) {
    if (!is_provider_account($user)) {
        return false;
    }
    $status = strtolower(trim((string) ($user['identityReviewStatus'] ?? '')));
    if ($status === 'approved') {
        return true;
    }
    return !empty($user['verified']);
}

function extract_provider_profile_slice($user) {
    if (!is_array($user)) {
        return array();
    }
    $slice = array();
    foreach (provider_profile_review_field_names() as $field) {
        if (array_key_exists($field, $user)) {
            $slice[$field] = $user[$field];
        }
    }
    return $slice;
}

function provider_profile_slices_equal($left, $right) {
    return json_encode(extract_provider_profile_slice($left)) === json_encode(extract_provider_profile_slice($right));
}

function provider_profile_field_labels() {
    return array(
        'businessName' => 'Business name',
        'name' => 'Display name',
        'nickname' => 'Nickname',
        'username' => 'Username',
        'city' => 'City',
        'town' => 'Town',
        'location' => 'Location',
        'phone' => 'Phone',
        'contact' => 'Contact',
        'description' => 'Description',
        'businessDescription' => 'Business description',
        'about' => 'About',
        'bio' => 'Bio',
        'summary' => 'Summary',
        'services' => 'Services',
        'categories' => 'Categories',
        'skills' => 'Skills',
        'photos' => 'Photos',
        'avatar' => 'Avatar',
        'coverImage' => 'Cover image',
        'transportModes' => 'Transport modes',
        'vehicleCount' => 'Vehicle count',
        'website' => 'Website',
        'companyType' => 'Company type',
        'paymentMethods' => 'Payment methods',
        'paymentMethodsCustom' => 'Custom payment methods',
        'blockInvites' => 'Block invites',
        'muteInviteEmails' => 'Mute invite emails',
        'serviceAreaCity' => 'Service area city',
        'serviceAreaAddress' => 'Service area address',
        'serviceAreaLat' => 'Service area latitude',
        'serviceAreaLng' => 'Service area longitude',
        'showExactAddressOnMap' => 'Show exact address on map',
        'autoBidSubscriptionEnabled' => 'Auto-bid subscription',
        'instagram' => 'Instagram',
        'facebook' => 'Facebook',
        'x' => 'X',
        'twitter' => 'Twitter',
        'tiktok' => 'TikTok',
        'linkedin' => 'LinkedIn'
    );
}

function format_provider_profile_value_for_email($value) {
    if (is_array($value)) {
        $parts = array();
        foreach ($value as $entry) {
            if (is_scalar($entry) && trim((string) $entry) !== '') {
                $parts[] = trim((string) $entry);
            }
        }
        if (!$parts) {
            return '(empty)';
        }
        $text = implode(', ', $parts);
        if (strlen($text) > 180) {
            return substr($text, 0, 177) . '...';
        }
        return $text;
    }
    if (is_bool($value)) {
        return $value ? 'yes' : 'no';
    }
    $text = trim((string) $value);
    if ($text === '') {
        return '(empty)';
    }
    if (strlen($text) > 180) {
        return substr($text, 0, 177) . '...';
    }
    return $text;
}

function build_provider_profile_change_summary($before, $after) {
    $labels = provider_profile_field_labels();
    $lines = array();
    foreach (provider_profile_review_field_names() as $field) {
        $old = array_key_exists($field, $before) ? $before[$field] : null;
        $new = array_key_exists($field, $after) ? $after[$field] : null;
        if (json_encode($old) === json_encode($new)) {
            continue;
        }
        $label = isset($labels[$field]) ? $labels[$field] : $field;
        $lines[] = $label . ': ' . format_provider_profile_value_for_email($new);
    }
    return $lines;
}

function get_admin_notification_emails($store) {
    $emails = array();
    $configured = get_env_value(array('ADMIN_EMAIL', 'ADMIN_NOTIFY_EMAIL'), '');
    if ($configured !== '') {
        foreach (preg_split('/[,;]+/', $configured) as $part) {
            $candidate = trim((string) $part);
            if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
                $emails[strtolower($candidate)] = $candidate;
            }
        }
    }
    if (!$emails) {
        $emails['admin@anytransport.ie'] = 'admin@anytransport.ie';
    }
    return array_values($emails);
}

function get_admin_dashboard_review_url($section = 'verification-review') {
    $section = trim((string) $section, '#/');
    if ($section === '') {
        $section = 'verification-review';
    }
    return get_app_url('dashboard.html#' . $section);
}

function send_admin_panel_notification_email($store, $subject, $body, $logTag = 'admin_panel') {
    $recipients = get_admin_notification_emails($store);
    if (!$recipients) {
        file_put_contents(__DIR__ . '/email.log', gmdate('c') . ' | ' . $logTag . '_skip reason=no_admin_email' . "\n", FILE_APPEND | LOCK_EX);
        return false;
    }

    $sentAny = false;
    foreach ($recipients as $to) {
        if (send_email_simple($to, $subject, $body)) {
            $sentAny = true;
        }
    }
    file_put_contents(
        __DIR__ . '/email.log',
        gmdate('c') . ' | ' . $logTag . ' ok=' . ($sentAny ? '1' : '0') . ' recipients=' . count($recipients) . "\n",
        FILE_APPEND | LOCK_EX
    );
    return $sentAny;
}

function format_provider_admin_summary_line($provider) {
    if (!is_array($provider)) {
        return '';
    }
    $name = trim((string) ($provider['businessName'] ?? $provider['name'] ?? $provider['username'] ?? 'Provider'));
    $email = trim((string) ($provider['email'] ?? ''));
    $line = $name;
    if ($email !== '') {
        $line .= ' <' . $email . '>';
    }
    return $line;
}

function send_admin_provider_verification_queue_email($store, $provider, $eventLabel, $extraLines = array()) {
    if (!is_array($provider) || !is_provider_account($provider)) {
        return false;
    }

    $summary = format_provider_admin_summary_line($provider);
    $stripeStatus = strtolower(trim((string) ($provider['stripeOnboardingStatus'] ?? 'not_started')));
    $reviewStatus = strtolower(trim((string) ($provider['identityReviewStatus'] ?? 'pending_review')));
    $dashboardUrl = get_admin_dashboard_review_url('verification-review');

    $subject = 'Admin review needed — ' . trim((string) $eventLabel);
    $body = "An AnyTransport admin action is required.\n\n";
    $body .= "Event: " . trim((string) $eventLabel) . "\n";
    if ($summary !== '') {
        $body .= "Provider: " . $summary . "\n";
    }
    $body .= "Identity review status: " . str_replace('_', ' ', $reviewStatus) . "\n";
    $body .= "Stripe status: " . str_replace('_', ' ', $stripeStatus) . "\n";
    $body .= "Time: " . gmdate('c') . "\n";
    if (is_array($extraLines)) {
        foreach ($extraLines as $line) {
            $line = trim((string) $line);
            if ($line !== '') {
                $body .= $line . "\n";
            }
        }
    }
    $body .= "\nOpen the admin dashboard to review:\n" . $dashboardUrl . "\n\n";
    $body .= "Regards,\nAnyTransport";

    return send_admin_panel_notification_email($store, $subject, $body, 'admin_provider_verification');
}

function send_admin_provider_profile_change_email($store, $provider, $summaryLines) {
    $name = trim((string) ($provider['businessName'] ?? $provider['name'] ?? $provider['username'] ?? 'Provider'));
    $providerEmail = trim((string) ($provider['email'] ?? ''));
    $dashboardUrl = get_admin_dashboard_review_url('verification-review');
    $subject = 'Provider profile changes awaiting review — ' . $name;
    $body = "A transport provider submitted profile changes for admin review.\n\n";
    $body .= "Provider: " . $name . "\n";
    if ($providerEmail !== '') {
        $body .= "Email: " . $providerEmail . "\n";
    }
    $body .= "Submitted: " . gmdate('c') . "\n\n";
    $body .= "Summary of requested changes:\n";
    if ($summaryLines) {
        foreach ($summaryLines as $line) {
            $body .= '- ' . $line . "\n";
        }
    } else {
        $body .= "(Open the dashboard to review the full details.)\n";
    }
    $body .= "\nReview and approve or decline in the admin dashboard:\n" . $dashboardUrl . "\n\n";
    $body .= "Regards,\nAnyTransport";

    return send_admin_panel_notification_email(
        $store,
        $subject,
        $body,
        'provider_profile_change_admin provider=' . trim((string) ($provider['id'] ?? ''))
    );
}

function send_admin_listing_report_email($store, $report, $quote, $reporter) {
    if (!is_array($report)) {
        return false;
    }

    $formId = trim((string) ($report['formId'] ?? ($quote['formId'] ?? '')));
    $quoteId = trim((string) ($report['quoteId'] ?? ''));
    $reason = trim((string) ($report['reason'] ?? ''));
    $details = trim((string) ($report['details'] ?? ''));
    $reporterLine = format_provider_admin_summary_line(is_array($reporter) ? $reporter : array());
    $dashboardUrl = get_admin_dashboard_review_url('verification-review');

    $subject = 'Provider reported a listing' . ($formId !== '' ? ' #' . $formId : '');
    $body = "A provider submitted a listing report that needs admin attention.\n\n";
    if ($reporterLine !== '') {
        $body .= "Reported by: " . $reporterLine . "\n";
    }
    if ($formId !== '') {
        $body .= "Listing ID: " . $formId . "\n";
    }
    if ($quoteId !== '') {
        $body .= "Quote ID: " . $quoteId . "\n";
    }
    $body .= "Reason: " . ($reason !== '' ? str_replace('_', ' ', $reason) : '(not provided)') . "\n";
    if ($details !== '') {
        $body .= "Details:\n" . $details . "\n";
    }
    $body .= "Submitted: " . gmdate('c') . "\n\n";
    $body .= "Review provider reports in the admin dashboard:\n" . $dashboardUrl . "\n\n";
    $body .= "Regards,\nAnyTransport";

    return send_admin_panel_notification_email($store, $subject, $body, 'admin_listing_report report=' . trim((string) ($report['id'] ?? '')));
}

function send_provider_profile_change_decision_email($provider, $status, $notes = '') {
    $providerEmail = trim((string) ($provider['email'] ?? ''));
    if ($providerEmail === '') {
        return false;
    }

    $providerName = trim((string) ($provider['businessName'] ?? $provider['name'] ?? $provider['username'] ?? 'there'));
    $status = strtolower(trim((string) $status));
    $notes = trim((string) $notes);
    $profileUrl = get_app_url('provider-profile.html?userId=' . rawurlencode(trim((string) ($provider['id'] ?? ''))));

    if ($status === 'approved') {
        $subject = 'Your AnyTransport profile changes were approved';
        $body = "Hello " . $providerName . ",\n\n";
        $body .= "Your recent profile changes have been approved and are now live on AnyTransport.\n\n";
        if ($profileUrl !== '' && $profileUrl !== '/') {
            $body .= "View your profile:\n" . $profileUrl . "\n\n";
        }
        $body .= "Regards,\nAnyTransport";
    } elseif ($status === 'rejected') {
        $subject = 'Your AnyTransport profile changes were not approved';
        $body = "Hello " . $providerName . ",\n\n";
        $body .= "An admin reviewed your recent profile changes and did not approve them.\n\n";
        $body .= "Reason from admin:\n" . $notes . "\n\n";
        $body .= "Your public profile still shows your previous approved details. You can update your profile and submit again for review.\n\n";
        if ($profileUrl !== '' && $profileUrl !== '/') {
            $body .= "Open your profile:\n" . $profileUrl . "\n\n";
        }
        $body .= "Please do not reply to this email address.\n\n";
        $body .= "Regards,\nAnyTransport";
    } else {
        return false;
    }

    $sent = send_email_simple($providerEmail, $subject, $body);
    file_put_contents(
        __DIR__ . '/email.log',
        gmdate('c') . ' | provider_profile_change_provider provider=' . trim((string) ($provider['id'] ?? '')) . ' status=' . $status . ' ok=' . ($sent ? '1' : '0') . "\n",
        FILE_APPEND | LOCK_EX
    );
    return $sent;
}

function send_provider_review_email($provider, $status, $notes = '') {
    $providerEmail = trim((string) ($provider['email'] ?? ''));
    if ($providerEmail === '') {
        return false;
    }

    $providerName = trim((string) ($provider['name'] ?? $provider['username'] ?? 'there'));
    $status = strtolower(trim((string) $status));
    $notes = trim((string) $notes);
    $appUrl = get_app_url('');
    if ($appUrl === '' || $appUrl === '/') {
        $appUrl = 'AnyTransport';
    }

    $subject = '';
    $body = "Hello " . $providerName . ",\n\n";

    if ($status === 'pending_review') {
        $subject = 'AnyTransport provider application received';
        $body .= "Thank you for registering as a transport provider on AnyTransport.\n";
        $body .= "If you have not already done so, please complete identity verification using the Stripe link we sent you.\n\n";
        $body .= "You can sign in to your dashboard while verification is in progress.\n\n";
        $body .= "Regards,\nAnyTransport";
    } elseif ($status === 'approved') {
        $subject = 'Your AnyTransport provider application was approved';
        $body .= "Great news - your provider application has been approved.\n\n";
        $body .= "Your provider account is now active. You can sign in and start using the provider dashboard:\n";
        $body .= $appUrl . "\n\n";
        $body .= "Regards,\nAnyTransport";
    } elseif ($status === 'rejected') {
        $subject = 'Your AnyTransport provider application was not approved';
        $body .= "We reviewed your provider application and, at this time, it was not approved.\n\n";
        $body .= "Reason from admin:\n" . $notes . "\n\n";
        $body .= "Please do not reply to this email address.\n";
        $body .= "We have sent you a new Stripe identity verification link by email. Complete that process and upload clear identity photos if prompted.\n\n";
        $body .= "Regards,\nAnyTransport";
    } else {
        return false;
    }

    return send_email_simple($providerEmail, $subject, $body);
}

function send_provider_stripe_verification_email($provider, $onboardingUrl) {
    $providerEmail = trim((string) ($provider['email'] ?? ''));
    $onboardingUrl = trim((string) $onboardingUrl);
    if ($providerEmail === '' || $onboardingUrl === '') {
        return false;
    }

    $providerName = trim((string) ($provider['name'] ?? $provider['username'] ?? 'there'));
    $subject = 'Complete your AnyTransport provider verification';
    $body = "Hello " . $providerName . ",\n\n";
    $body .= "Thank you for registering as a transport provider on AnyTransport.\n\n";
    $body .= "To verify your identity and connect your account, open this secure Stripe link:\n\n";
    $body .= $onboardingUrl . "\n\n";
    $body .= "Stripe handles identity checks on our behalf. After you finish, an AnyTransport admin will review your documents before your account is fully activated.\n\n";
    $body .= "If the link has expired, sign in to your provider dashboard and request a new verification email.\n\n";
    $body .= "Regards,\nAnyTransport";

    return send_email_simple($providerEmail, $subject, $body);
}

function provider_stripe_onboarding_is_complete($user) {
    if (!is_array($user)) {
        return false;
    }
    return strtolower(trim((string) ($user['stripeOnboardingStatus'] ?? ''))) === 'complete';
}

function provider_can_access_marketplace($user) {
    if (!is_array($user)) {
        return false;
    }
    if (strtolower(trim((string) ($user['role'] ?? ''))) !== 'provider') {
        return false;
    }
    if (!provider_stripe_onboarding_is_complete($user)) {
        return false;
    }
    return strtolower(trim((string) ($user['identityReviewStatus'] ?? ''))) === 'approved';
}

function provider_marketplace_access_error() {
    return 'Complete Stripe verification and wait for admin approval before accessing listings or placing bids.';
}

function apply_provider_approval_from_stripe(&$store, $userId, $storeFile = '') {
    return mark_provider_stripe_complete_pending_admin($store, $userId, $storeFile);
}

function send_provider_customer_rating_email($provider, $review, $isUpdate = false) {
    if (!is_array($provider) || empty($provider['email']) || !is_array($review)) {
        return false;
    }

    $providerName = provider_public_name($provider, 'there');
    $customerName = trim((string) ($review['customerName'] ?? 'A customer'));
    if ($customerName === '') {
        $customerName = 'A customer';
    }
    $rating = (int) ($review['rating'] ?? 0);
    if ($rating < 1) {
        $rating = 1;
    } elseif ($rating > 5) {
        $rating = 5;
    }
    $comment = trim((string) ($review['text'] ?? ''));
    $formId = trim((string) ($review['formId'] ?? ''));
    $quoteId = trim((string) ($review['quoteId'] ?? ''));
    $listingLabel = $formId !== '' ? ('Listing #' . $formId) : ($quoteId !== '' ? $quoteId : 'your listing');

    $subject = $isUpdate
        ? 'Customer updated their review on ' . $listingLabel
        : 'New customer review on ' . $listingLabel;

    $body = "Hi " . $providerName . ",\n\n";
    if ($isUpdate) {
        $body .= $customerName . " updated their review for " . $listingLabel . ".\n\n";
    } else {
        $body .= $customerName . " left a new review for " . $listingLabel . ".\n\n";
    }
    $body .= "From: " . $customerName . "\n";
    $body .= "Rating: " . $rating . " out of 5 stars\n";
    if ($comment !== '') {
        $body .= "Comment:\n" . $comment . "\n\n";
    } else {
        $body .= "Comment: (no written comment)\n\n";
    }

    $providerId = trim((string) ($provider['id'] ?? ''));
    if ($providerId !== '') {
        $profileUrl = get_app_url('provider-profile.html?userId=' . rawurlencode($providerId));
        if ($profileUrl !== '' && $profileUrl !== '/') {
            $body .= "View this review on your public profile:\n" . $profileUrl . "\n\n";
        }
    }
    $dashboardUrl = get_app_url('dashboard.html');
    if ($dashboardUrl !== '' && $dashboardUrl !== '/') {
        $body .= "Open your provider dashboard:\n" . $dashboardUrl . "\n\n";
    }
    $body .= "This inbox is not monitored. Please use your provider dashboard for messages.\n\n";
    $body .= "Regards,\nAnyTransport";

    return send_email_simple($provider['email'], $subject, $body);
}

function send_customer_welcome_email($customer) {
    $customerEmail = trim((string) ($customer['email'] ?? ''));
    if ($customerEmail === '') {
        return false;
    }

    $customerName = trim((string) ($customer['name'] ?? $customer['username'] ?? ''));
    if ($customerName === '') {
        $customerName = 'there';
    }

    $dashboardUrl = get_app_url('customer-dashboard.html');
    $quoteUrl = get_app_url('index.html#services');

    $subject = 'Welcome to AnyTransport';
    $body = "Hi " . $customerName . ",\n\n";
    $body .= "Thank you for creating your AnyTransport account.\n\n";
    $body .= "You can request transport quotes, track your listings, and message providers from your profile:\n";
    $body .= $dashboardUrl . "\n\n";
    $body .= "To submit a new request, visit:\n";
    $body .= $quoteUrl . "\n\n";
    $body .= "This inbox is not monitored. Please use your dashboard and in-app messages for updates.\n\n";
    $body .= "Regards,\nAnyTransport";

    return send_email_simple($customerEmail, $subject, $body);
}

function send_password_reset_email($user, $resetUrl) {
    $email = trim((string) ($user['email'] ?? ''));
    $resetUrl = trim((string) $resetUrl);
    if ($email === '' || $resetUrl === '') {
        return false;
    }

    $name = trim((string) ($user['name'] ?? $user['username'] ?? 'there'));
    if ($name === '') {
        $name = 'there';
    }

    $subject = 'Reset your AnyTransport password';
    $body = "Hello " . $name . ",\n\n";
    $body .= "We received a request to reset the password for your AnyTransport account.\n\n";
    $body .= "Open this link to choose a new password (the link expires in 1 hour):\n\n";
    $body .= $resetUrl . "\n\n";
    $body .= "If you did not request this, you can ignore this email. Your password will not change.\n\n";
    $body .= "Please do not reply to this email address.\n\n";
    $body .= "Regards,\nAnyTransport";

    $sent = send_email_simple($email, $subject, $body);
    file_put_contents(
        __DIR__ . '/email.log',
        gmdate('c') . ' | password_reset to=' . $email . ' ok=' . ($sent ? '1' : '0') . "\n",
        FILE_APPEND | LOCK_EX
    );
    return $sent;
}

function get_password_reset_url($token) {
    $token = trim((string) $token);
    if ($token === '') {
        return '';
    }
    return get_app_url('reset-password.html?token=' . rawurlencode($token));
}

function find_user_index_by_email($users, $email) {
    $norm = strtolower(trim((string) $email));
    if ($norm === '') {
        return -1;
    }
    foreach ($users as $index => $user) {
        if (!is_array($user)) {
            continue;
        }
        if (strtolower(trim((string) ($user['email'] ?? ''))) === $norm) {
            return (int) $index;
        }
    }
    return -1;
}

function password_reset_token_is_valid($user) {
    if (!is_array($user)) {
        return false;
    }
    $token = trim((string) ($user['passwordResetToken'] ?? ''));
    $expiresAt = trim((string) ($user['passwordResetExpiresAt'] ?? ''));
    if ($token === '' || $expiresAt === '') {
        return false;
    }
    $expiresTs = strtotime($expiresAt);
    if ($expiresTs === false || $expiresTs <= time()) {
        return false;
    }
    return true;
}

function issue_password_reset_for_user(&$store, $userIndex) {
    if ($userIndex < 0 || !isset($store['users'][$userIndex]) || !is_array($store['users'][$userIndex])) {
        return '';
    }
    try {
        $token = bin2hex(random_bytes(32));
    } catch (Exception $e) {
        $token = make_id('pwreset');
    }
    $store['users'][$userIndex]['passwordResetToken'] = $token;
    $store['users'][$userIndex]['passwordResetExpiresAt'] = gmdate('c', time() + 3600);
    return $token;
}

function clear_password_reset_for_user(&$store, $userIndex) {
    if ($userIndex < 0 || !isset($store['users'][$userIndex])) {
        return;
    }
    $store['users'][$userIndex]['passwordResetToken'] = '';
    $store['users'][$userIndex]['passwordResetExpiresAt'] = '';
}

function find_user_index_by_password_reset_token($users, $token) {
    $token = trim((string) $token);
    if ($token === '') {
        return -1;
    }
    foreach ($users as $index => $user) {
        if (!is_array($user)) {
            continue;
        }
        if (trim((string) ($user['passwordResetToken'] ?? '')) === $token) {
            return (int) $index;
        }
    }
    return -1;
}

function revoke_sessions_for_user(&$store, $userId) {
    $userId = trim((string) $userId);
    if ($userId === '' || !isset($store['sessions']) || !is_array($store['sessions'])) {
        return;
    }
    $store['sessions'] = array_values(array_filter($store['sessions'], function ($session) use ($userId) {
        return trim((string) ($session['userId'] ?? '')) !== $userId;
    }));
}

function generate_reply_token() {
    try {
        return bin2hex(random_bytes(8));
    } catch (Exception $e) {
        return substr(md5(uniqid('', true)), 0, 16);
    }
}

function find_user_by_email($users, $email) {
    $norm = strtolower(trim((string) $email));
    foreach ($users as $u) {
        if (strtolower(trim((string) ($u['email'] ?? ''))) === $norm) {
            return $u;
        }
    }
    return null;
}

function message_contains_contact_details($text) {
    $value = trim((string) $text);
    if ($value === '') {
        return false;
    }

    $patterns = array(
        '/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i',
        '/\d{5,}/',
        '/(?:\+?\d[\d\s().\-–—_\/]{4,}\d)/',
        '/(?:https?:\/\/|www\.)\S+/i',
        '/\b(?:whatsapp|telegram|viber|wechat|snapchat|instagram|facebook|messenger|discord|skype|signal|tiktok|insta|snap|my contact|contact me|my number|your number|reach me|call me|text me|dm me|phone me|email me|message me on|add me on|hit me up|get in touch|reach out)\b/i',
        '/(?:(?:\b(?:zero|one|two|three|four|five|six|seven|eight|nine|oh|o)\b|\d)(?:\s*[,.\-–—\/]?\s*)?){5,}(?:\b(?:zero|one|two|three|four|five|six|seven|eight|nine|oh|o)\b|\d)/i'
    );

    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $value)) {
            return true;
        }
    }

    if (preg_match_all('/[\d][\d\s.\-_|\/\\\\()\x{2013}\x{2014}+]{2,}[\d]|[\d]{5,}/u', $value, $digitRuns)) {
        foreach ($digitRuns[0] as $run) {
            if (strlen(preg_replace('/\D/', '', $run)) >= 5) {
                return true;
            }
        }
    }

    return false;
}

function update_user_record(&$store, $userId, $updates) {
    $index = find_user_index_by_id($store['users'], $userId);
    if ($index < 0) {
        return null;
    }

    $store['users'][$index] = array_merge($store['users'][$index], $updates);
    return normalize_user($store['users'][$index]);
}

function get_provider_onboarding_urls($returnPath = 'dashboard.html') {
    $safeReturnPath = trim((string) $returnPath);
    if ($safeReturnPath === '' || strpos($safeReturnPath, '//') !== false) {
        $safeReturnPath = 'dashboard.html';
    }

    $returnUrl = get_app_url($safeReturnPath);
    $refreshUrl = get_app_url($safeReturnPath);

    return array(
        'returnUrl' => $returnUrl,
        'refreshUrl' => $refreshUrl
    );
}

function map_identity_status_to_local($status) {
    $normalized = strtolower(trim((string) $status));
    if ($normalized === 'verified') {
        return array('status' => 'complete', 'complete' => true);
    }
    if ($normalized === 'requires_input' || $normalized === 'canceled') {
        return array('status' => 'requires_input', 'complete' => false);
    }
    if ($normalized === 'processing' || $normalized === 'unverified') {
        return array('status' => 'pending', 'complete' => false);
    }
    return array('status' => 'not_started', 'complete' => false);
}

function sync_stripe_account_status($store, $userId) {
    $index = find_user_index_by_id($store['users'], $userId);
    if ($index < 0) {
        return array('user' => null, 'complete' => false, 'status' => 'not_started');
    }

    $user = normalize_user($store['users'][$index]);
    $identitySessionId = trim((string) ($user['stripeIdentitySessionId'] ?? ''));
    if ($identitySessionId === '') {
        return array('user' => $user, 'complete' => false, 'status' => 'not_started');
    }

    $sessionResp = stripe_request_internal('GET', '/v1/identity/verification_sessions/' . rawurlencode($identitySessionId));
    if (empty($sessionResp['ok'])) {
        $errorMessage = trim((string) ($sessionResp['error'] ?? 'Unable to sync Stripe Identity session.'));
        $updatedUser = update_user_record($store, $userId, array(
            'stripeIdentitySessionId' => '',
            'stripeIdentityStatus' => 'not_started',
            'stripeIdentityLastError' => $errorMessage,
            'stripeOnboardingStatus' => 'not_started',
            'stripeOnboardingUpdatedAt' => gmdate('c')
        ));
        return array(
            'user' => $updatedUser ?: $user,
            'complete' => false,
            'status' => 'not_started',
            'session' => null,
            'syncError' => $errorMessage
        );
    }

    $session = is_array($sessionResp['data'] ?? null) ? $sessionResp['data'] : array();
    $mapped = map_identity_status_to_local((string) ($session['status'] ?? ''));
    $complete = !empty($mapped['complete']);
    $status = (string) ($mapped['status'] ?? 'not_started');

    $updates = array(
        'stripeOnboardingStatus' => $status,
        'stripeOnboardingUpdatedAt' => gmdate('c'),
        'stripeIdentityStatus' => strtolower(trim((string) ($session['status'] ?? ''))),
        'stripeIdentityLastError' => trim((string) ($session['last_error']['code'] ?? $session['last_error']['reason'] ?? ''))
    );

    if ($complete) {
        $updates['stripeOnboardingCompletedAt'] = gmdate('c');
        $updates['stripeIdentityVerifiedAt'] = gmdate('c');
    }

    $updatedUser = $updates ? update_user_record($store, $userId, $updates) : $user;
    if ($updatedUser !== null && $complete) {
        $updatedUser = apply_provider_approval_from_stripe($store, $userId, $GLOBALS['storeFile']) ?: $updatedUser;
    }
    if ($updatedUser !== null) {
        write_store($GLOBALS['storeFile'], $store);
    }

    return array('user' => $updatedUser ?: $user, 'complete' => $complete, 'status' => $status, 'session' => $session);
}

function begin_provider_stripe_verification(&$store, $storeFile, $userId, $returnPath = 'dashboard.html', $sendEmail = true) {
    $userId = trim((string) $userId);
    $index = find_user_index_by_id($store['users'], $userId);
    if ($index < 0) {
        return array('ok' => false, 'error' => 'User not found.', 'onboardingUrl' => '', 'emailed' => false, 'complete' => false);
    }

    $user = normalize_user($store['users'][$index]);
    if (trim((string) ($user['role'] ?? 'customer')) !== 'provider') {
        return array('ok' => false, 'error' => 'Stripe verification is only available for provider accounts.', 'onboardingUrl' => '', 'emailed' => false, 'complete' => false);
    }

    $syncResult = sync_stripe_account_status($store, $userId);
    if (!empty($syncResult['complete'])) {
        write_store($storeFile, $store);
        return array(
            'ok' => true,
            'complete' => true,
            'status' => 'complete',
            'onboardingUrl' => '',
            'emailed' => false,
            'user' => $syncResult['user'],
            'accountId' => '',
            'verificationSessionId' => trim((string) ($syncResult['user']['stripeIdentitySessionId'] ?? ''))
        );
    }

    $updatedUser = $syncResult['user'];
    $urls = get_provider_onboarding_urls($returnPath);
    $sessionResp = stripe_request_internal('POST', '/v1/identity/verification_sessions', array(
        'type' => 'document',
        'metadata[anytransport_user_id]' => $userId,
        'metadata[anytransport_provider_email]' => trim((string) ($updatedUser['email'] ?? '')),
        'return_url' => $urls['returnUrl'],
        'options[document][require_matching_selfie]' => 'true'
    ));
    if (empty($sessionResp['ok'])) {
        return array(
            'ok' => false,
            'error' => (string) ($sessionResp['error'] ?? 'Unable to create Stripe Identity verification session.'),
            'onboardingUrl' => '',
            'emailed' => false,
            'complete' => false,
            'user' => $updatedUser
        );
    }

    $session = is_array($sessionResp['data'] ?? null) ? $sessionResp['data'] : array();
    $sessionId = trim((string) ($session['id'] ?? ''));
    $sessionStatus = strtolower(trim((string) ($session['status'] ?? 'unverified')));
    $onboardingUrl = trim((string) ($session['url'] ?? ''));
    if ($sessionId === '' || $onboardingUrl === '') {
        return array(
            'ok' => false,
            'error' => 'Stripe Identity did not return a valid verification link.',
            'onboardingUrl' => '',
            'emailed' => false,
            'complete' => false,
            'user' => $updatedUser
        );
    }

    $updatedUser = update_user_record($store, $userId, array(
        'stripeIdentitySessionId' => $sessionId,
        'stripeIdentityStatus' => $sessionStatus,
        'stripeIdentityLastError' => '',
        'stripeOnboardingStatus' => 'pending',
        'stripeOnboardingUpdatedAt' => gmdate('c'),
        'stripeVerificationSubmittedNotifiedAt' => ''
    ));
    if ($updatedUser !== null) {
        write_store($storeFile, $store);
    }

    $emailed = false;
    if ($sendEmail && $onboardingUrl !== '') {
        $emailed = send_provider_stripe_verification_email($updatedUser, $onboardingUrl);
    }

    return array(
        'ok' => true,
        'complete' => false,
        'status' => 'pending',
        'onboardingUrl' => $onboardingUrl,
        'emailed' => $emailed,
        'user' => $updatedUser,
        'accountId' => '',
        'verificationSessionId' => $sessionId
    );
}

function ensure_provider_stripe_onboarding(&$store, $storeFile, $userId, $returnPath = 'dashboard.html') {
    $result = begin_provider_stripe_verification($store, $storeFile, $userId, $returnPath, false);
    if (empty($result['ok'])) {
        send_json(array('ok' => false, 'error' => (string) ($result['error'] ?? 'Stripe verification failed.')), 500);
    }
    return $result;
}

function normalize_budget_amount($value) {
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_numeric($value)) {
        return null;
    }
    $amount = round((float) $value, 2);
    if ($amount < 0) {
        return null;
    }
    if ($amount > 9999999) {
        $amount = 9999999.0;
    }
    return $amount;
}

function normalize_customer_budget_fields(&$quote) {
    if (!is_array($quote)) {
        return;
    }
    $mode = trim((string) ($quote['customerBudgetMode'] ?? ''));
    if (!in_array($mode, array('flexible', 'up_to', 'range'), true)) {
        $mode = '';
    }
    $min = normalize_budget_amount($quote['customerBudgetMin'] ?? null);
    $max = normalize_budget_amount($quote['customerBudgetMax'] ?? null);
    if ($mode === 'up_to' && $max === null && $min !== null) {
        $max = $min;
        $min = null;
    }
    if ($mode === 'range' && $min !== null && $max !== null && $min > $max) {
        $swap = $min;
        $min = $max;
        $max = $swap;
    }
    $quote['customerBudgetMode'] = $mode;
    $quote['customerBudgetMin'] = $min;
    $quote['customerBudgetMax'] = $max;
}

function format_customer_budget_label($quote) {
    if (!is_array($quote)) {
        return '';
    }
    $mode = trim((string) ($quote['customerBudgetMode'] ?? ''));
    $min = normalize_budget_amount($quote['customerBudgetMin'] ?? null);
    $max = normalize_budget_amount($quote['customerBudgetMax'] ?? null);
    if ($mode === 'flexible') {
        return 'Flexible / open to quotes';
    }
    if ($mode === 'up_to' && $max !== null) {
        return 'Up to €' . number_format($max, 0, '.', ',');
    }
    if ($mode === 'range' && $min !== null && $max !== null) {
        if (abs($min - $max) < 0.01) {
            return '€' . number_format($min, 0, '.', ',');
        }
        return '€' . number_format($min, 0, '.', ',') . ' – €' . number_format($max, 0, '.', ',');
    }
    if ($min !== null && $max !== null) {
        if (abs($min - $max) < 0.01) {
            return '€' . number_format($min, 0, '.', ',');
        }
        return '€' . number_format($min, 0, '.', ',') . ' – €' . number_format($max, 0, '.', ',');
    }
    if ($max !== null) {
        return 'Up to €' . number_format($max, 0, '.', ',');
    }
    if ($min !== null) {
        return 'From €' . number_format($min, 0, '.', ',');
    }
    return '';
}

function find_quote_by_id($quotes, $quoteId) {
    $needle = trim((string) $quoteId);
    if ($needle === '' || !is_array($quotes)) {
        return null;
    }
    foreach ($quotes as $quote) {
        if (!is_array($quote)) {
            continue;
        }
        if (trim((string) ($quote['id'] ?? '')) === $needle) {
            return $quote;
        }
    }
    return null;
}

function remove_customer_reviews_for_quote(&$store, $customerId, $quoteId) {
    $customerId = trim((string) $customerId);
    $quoteId = trim((string) $quoteId);
    $removed = 0;
    if ($customerId === '' || $quoteId === '' || !isset($store['providerReviews']) || !is_array($store['providerReviews'])) {
        return $removed;
    }
    $formId = '';
    if (isset($store['quotes']) && is_array($store['quotes'])) {
        $quote = find_quote_by_id($store['quotes'], $quoteId);
        if (is_array($quote)) {
            $formId = trim((string) ($quote['formId'] ?? ''));
        }
    }
    $kept = array();
    foreach ($store['providerReviews'] as $review) {
        if (!is_array($review)) {
            continue;
        }
        if (trim((string) ($review['customerId'] ?? '')) !== $customerId) {
            $kept[] = $review;
            continue;
        }
        $reviewQuoteId = trim((string) ($review['quoteId'] ?? ''));
        $reviewFormId = trim((string) ($review['formId'] ?? ''));
        $matchesQuote = $reviewQuoteId !== '' && $reviewQuoteId === $quoteId;
        $matchesForm = $formId !== '' && $reviewFormId !== '' && $reviewFormId === $formId;
        if ($matchesQuote || $matchesForm) {
            $removed++;
            continue;
        }
        $kept[] = $review;
    }
    $store['providerReviews'] = $kept;
    return $removed;
}

function remove_review_notifications_for_quote(&$store, $quoteId) {
    $quoteId = trim((string) $quoteId);
    if ($quoteId === '' || !isset($store['notifications']) || !is_array($store['notifications'])) {
        return;
    }
    $store['notifications'] = array_values(array_filter($store['notifications'], function ($notification) use ($quoteId) {
        if (!is_array($notification)) {
            return true;
        }
        if (trim((string) ($notification['type'] ?? '')) !== 'provider_review') {
            return true;
        }
        $data = isset($notification['data']) && is_array($notification['data']) ? $notification['data'] : array();
        return trim((string) ($data['quoteId'] ?? '')) !== $quoteId;
    }));
}

function find_provider_review_index($store, $customerId, $providerId, $quoteId) {
    if (!isset($store['providerReviews']) || !is_array($store['providerReviews'])) {
        return -1;
    }
    $customerId = trim((string) $customerId);
    $providerId = trim((string) $providerId);
    $quoteId = trim((string) $quoteId);
    foreach ($store['providerReviews'] as $index => $review) {
        if (!is_array($review)) {
            continue;
        }
        if (trim((string) ($review['customerId'] ?? '')) !== $customerId) {
            continue;
        }
        if (trim((string) ($review['providerId'] ?? '')) !== $providerId) {
            continue;
        }
        if (trim((string) ($review['quoteId'] ?? '')) !== $quoteId) {
            continue;
        }
        return (int) $index;
    }
    return -1;
}

function get_provider_review_stats($store, $providerId) {
    $providerId = trim((string) $providerId);
    $count = 0;
    $sum = 0;
    if ($providerId === '' || !isset($store['providerReviews']) || !is_array($store['providerReviews'])) {
        return array('count' => 0, 'average' => 0);
    }
    foreach ($store['providerReviews'] as $review) {
        if (!is_array($review)) {
            continue;
        }
        if (trim((string) ($review['providerId'] ?? '')) !== $providerId) {
            continue;
        }
        $rating = (int) ($review['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) {
            continue;
        }
        $count += 1;
        $sum += $rating;
    }
    return array(
        'count' => $count,
        'average' => $count > 0 ? round($sum / $count, 1) : 0
    );
}

function normalize_quote($quote, $quotes) {
    $normalized = is_array($quote) ? $quote : array();
    if (!isset($normalized['id']) || trim((string) $normalized['id']) === '') {
        $normalized['id'] = make_id('quote');
    }

    if (!isset($normalized['formId']) || !preg_match('/^\d{5}$/', (string) $normalized['formId'])) {
        $normalized['formId'] = make_form_id($quotes);
    }

    if (!isset($normalized['createdAt'])) {
        $normalized['createdAt'] = gmdate('c');
    }

    $normalized['updatedAt'] = gmdate('c');
    if (!isset($normalized['status']) || trim((string) $normalized['status']) === '') {
        $normalized['status'] = 'pending';
    }

    normalize_customer_budget_fields($normalized);
    $normalized['customerFormComplete'] = !empty($normalized['customerFormComplete']);
    if ($normalized['customerFormComplete'] && trim((string) ($normalized['customerFormCompletedAt'] ?? '')) === '') {
        $normalized['customerFormCompletedAt'] = gmdate('c');
    }
    if (!$normalized['customerFormComplete']) {
        $normalized['customerFormCompletedAt'] = '';
    }

    return $normalized;
}

function apply_customer_details_from_owner($store, &$normalized, $ownerEmail, $previousQuote = null, $sessionUser = null) {
    $ownerEmail = strtolower(trim((string) $ownerEmail));
    if ($ownerEmail === '') {
        return;
    }

    $normalized['customerEmail'] = $ownerEmail;
    $sessionName = is_array($sessionUser)
        ? trim((string) ($sessionUser['name'] ?? $sessionUser['username'] ?? $sessionUser['nickname'] ?? ''))
        : '';
    $sessionPhone = is_array($sessionUser) ? trim((string) ($sessionUser['phone'] ?? '')) : '';

    $owner = find_user_by_email(isset($store['users']) && is_array($store['users']) ? $store['users'] : array(), $ownerEmail);
    if (is_array($owner)) {
        $name = trim((string) ($owner['name'] ?? $owner['username'] ?? $owner['nickname'] ?? $owner['businessName'] ?? ''));
        $phone = trim((string) ($owner['phone'] ?? ''));
        if ($name !== '') {
            $normalized['customerName'] = $name;
        }
        if ($phone !== '') {
            $normalized['customerPhone'] = $phone;
        }
        return;
    }

    $currentName = trim((string) ($normalized['customerName'] ?? ''));
    $currentPhone = trim((string) ($normalized['customerPhone'] ?? ''));
    if ($sessionName !== '' && strcasecmp($currentName, $sessionName) === 0) {
        $normalized['customerName'] = '';
    }
    if ($sessionPhone !== '' && $currentPhone === $sessionPhone) {
        $normalized['customerPhone'] = '';
    }

    if (is_array($previousQuote)) {
        $prevEmail = strtolower(trim((string) ($previousQuote['customerEmail'] ?? '')));
        if ($prevEmail === $ownerEmail) {
            $prevName = trim((string) ($previousQuote['customerName'] ?? ''));
            $prevPhone = trim((string) ($previousQuote['customerPhone'] ?? ''));
            if ($prevName !== '' && ($sessionName === '' || strcasecmp($prevName, $sessionName) !== 0)) {
                $normalized['customerName'] = $prevName;
            }
            if ($prevPhone !== '' && ($sessionPhone === '' || $prevPhone !== $sessionPhone)) {
                $normalized['customerPhone'] = $prevPhone;
            }
            if (trim((string) ($normalized['customerName'] ?? '')) !== '') {
                return;
            }
        }
    }

    if (trim((string) ($normalized['customerName'] ?? '')) === '') {
        $localPart = explode('@', $ownerEmail);
        $local = isset($localPart[0]) ? trim((string) $localPart[0]) : '';
        if ($local !== '') {
            $normalized['customerName'] = ucwords(str_replace(array('.', '_', '-'), ' ', $local));
        }
    }
}

function apply_quote_ownership_on_save(&$store, $sessionUser, &$normalized, $input, $isQuoteUpdate, $previousQuote) {
    if (!is_array($sessionUser)) {
        return;
    }

    $isAdmin = is_admin_user($sessionUser);
    $ownerUserId = trim((string) ($input['ownerUserId'] ?? $normalized['ownerUserId'] ?? ''));
    $ownerEmail = strtolower(trim((string) ($input['ownerEmail'] ?? $normalized['ownerEmail'] ?? '')));

    if (!$isAdmin) {
        $sid = trim((string) ($sessionUser['id'] ?? ''));
        if ($sid !== '') {
            $normalized['userId'] = $sid;
            $normalized['createdBy'] = $sid;
        }
        return;
    }

    $adminId = trim((string) ($sessionUser['id'] ?? ''));
    if ($adminId !== '') {
        $normalized['lastSavedByAdminId'] = $adminId;
        $normalized['lastSavedByAdminAt'] = gmdate('c');
    }

    if ($isQuoteUpdate && is_array($previousQuote)) {
        $prevUserId = trim((string) ($previousQuote['userId'] ?? $previousQuote['createdBy'] ?? ''));
        $prevEmail = strtolower(trim((string) ($previousQuote['customerEmail'] ?? '')));

        if ($ownerUserId !== '') {
            $normalized['userId'] = $ownerUserId;
            $normalized['createdBy'] = $ownerUserId;
        } elseif ($ownerEmail !== '') {
            $owner = find_user_by_email($store['users'], $ownerEmail);
            if (is_array($owner)) {
                $uid = trim((string) ($owner['id'] ?? ''));
                $normalized['userId'] = $uid;
                $normalized['createdBy'] = $uid;
            }
            apply_customer_details_from_owner($store, $normalized, $ownerEmail, $previousQuote, $sessionUser);
        } else {
            if ($prevUserId !== '') {
                $normalized['userId'] = $prevUserId;
                $normalized['createdBy'] = trim((string) ($previousQuote['createdBy'] ?? $prevUserId));
            }
            if ($prevEmail !== '') {
                apply_customer_details_from_owner($store, $normalized, $prevEmail, $previousQuote, $sessionUser);
            }
        }
        return;
    }

    if ($ownerUserId !== '') {
        $normalized['userId'] = $ownerUserId;
        $normalized['createdBy'] = $ownerUserId;
    } elseif ($ownerEmail !== '') {
        $owner = find_user_by_email($store['users'], $ownerEmail);
        if (is_array($owner)) {
            $uid = trim((string) ($owner['id'] ?? ''));
            $normalized['userId'] = $uid;
            $normalized['createdBy'] = $uid;
        }
        apply_customer_details_from_owner($store, $normalized, $ownerEmail, $previousQuote, $sessionUser);
    }

    if ($adminId !== '') {
        $normalized['adminCreated'] = true;
        $normalized['adminCreatedBy'] = $adminId;
        $normalized['adminCreatedAt'] = gmdate('c');
    }
}

function duplicate_quote_media_records(&$store, $storeDir, $sourceQuoteId, $newQuoteId, $ownerUserId) {
    $sourceQuoteId = trim((string) $sourceQuoteId);
    $newQuoteId = trim((string) $newQuoteId);
    $ownerUserId = trim((string) $ownerUserId);
    if ($sourceQuoteId === '' || $newQuoteId === '' || !isset($store['quoteMedia']) || !is_array($store['quoteMedia'])) {
        return;
    }

    foreach ($store['quoteMedia'] as $media) {
        if (!is_array($media) || trim((string) ($media['quoteId'] ?? '')) !== $sourceQuoteId) {
            continue;
        }
        $rel = trim((string) ($media['relativePath'] ?? ''));
        if ($rel === '') {
            continue;
        }
        $sourcePath = $storeDir . '/' . $rel;
        if (!is_file($sourcePath)) {
            continue;
        }

        $ext = pathinfo($rel, PATHINFO_EXTENSION);
        if ($ext === '') {
            $ext = 'bin';
        }
        $mediaId = make_id('media');
        $userFolder = $ownerUserId !== '' ? $ownerUserId : trim((string) ($media['userId'] ?? 'shared'));
        $relative = 'quote-media/' . $userFolder . '/' . $mediaId . '.' . $ext;
        $destPath = $storeDir . '/' . $relative;
        $dir = dirname($destPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        if (!@copy($sourcePath, $destPath)) {
            continue;
        }

        $store['quoteMedia'][] = array(
            'id' => $mediaId,
            'userId' => $ownerUserId !== '' ? $ownerUserId : trim((string) ($media['userId'] ?? '')),
            'quoteId' => $newQuoteId,
            'relativePath' => $relative,
            'mimeType' => trim((string) ($media['mimeType'] ?? 'application/octet-stream')),
            'createdAt' => gmdate('c'),
            'clonedFromMediaId' => trim((string) ($media['id'] ?? ''))
        );
    }
}

function duplicate_quote_for_admin(&$store, $storeFile, $storeDir, $sourceQuoteId, $ownerUserId = '', $ownerEmail = '', $adminUser = null) {
    $sourceQuoteId = trim((string) $sourceQuoteId);
    $source = find_store_quote_by_id($store, $sourceQuoteId);
    if (!is_array($source)) {
        return array('ok' => false, 'error' => 'Listing not found.');
    }

    $copy = $source;
    unset($copy['id'], $copy['formId']);
    $copy['clonedFromQuoteId'] = $sourceQuoteId;
    $copy['clonedFromFormId'] = trim((string) ($source['formId'] ?? ''));
    $copy['status'] = 'pending';
    $copy['createdAt'] = gmdate('c');
    $copy['updatedAt'] = gmdate('c');
    $copy['submittedAt'] = gmdate('c');
    $copy['customerFormComplete'] = !empty($source['customerFormComplete']);

    $normalized = normalize_quote($copy, $store['quotes']);
    $input = array(
        'ownerUserId' => trim((string) $ownerUserId),
        'ownerEmail' => trim((string) $ownerEmail)
    );
    if ($input['ownerEmail'] === '') {
        $input['ownerEmail'] = trim((string) ($source['customerEmail'] ?? ''));
    }
    apply_quote_ownership_on_save($store, $adminUser, $normalized, $input, false, null);

    $store['quotes'][] = $normalized;
    duplicate_quote_media_records(
        $store,
        $storeDir,
        $sourceQuoteId,
        trim((string) ($normalized['id'] ?? '')),
        trim((string) ($normalized['userId'] ?? ''))
    );
    write_store($storeFile, $store);

    return array('ok' => true, 'quote' => $normalized);
}

/** Stable JSON string for comparing quote field values. */
function quote_value_fingerprint($value) {
    if (is_array($value) || is_object($value)) {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    if (is_bool($value)) {
        return $value ? '1' : '0';
    }
    if ($value === null) {
        return '';
    }
    return trim((string) $value);
}

function quote_scalar_change_fields() {
    return array(
        'pickupAddress' => 'Pickup address',
        'pickupCity' => 'Pickup city',
        'pickupPostcode' => 'Pickup postcode',
        'propertyType' => 'Pickup property type',
        'pickupPropertyType' => 'Pickup property type',
        'deliveryAddress' => 'Delivery address',
        'deliveryCity' => 'Delivery city',
        'deliveryPostcode' => 'Delivery postcode',
        'deliveryPropertyType' => 'Delivery property type',
        'preferredDate' => 'Preferred date',
        'transportDate' => 'Transport date',
        'preferredTime' => 'Preferred time',
        'preferredPickupTime' => 'Pickup time',
        'preferredDeliveryTime' => 'Delivery time',
        'preferredPickupTimeFlexibility' => 'Pickup time flexibility',
        'preferredDeliveryTimeFlexibility' => 'Delivery time flexibility',
        'timeFlexibility' => 'Time flexibility',
        'servicePickupMovers' => 'Pickup movers',
        'servicePickupMoversMode' => 'Pickup movers (mode)',
        'servicePickupMoversConfirmed' => 'Pickup movers (confirmed)',
        'serviceDeliveryMovers' => 'Delivery movers',
        'serviceDeliveryMoversMode' => 'Delivery movers (mode)',
        'serviceDeliveryMoversConfirmed' => 'Delivery movers (confirmed)',
        'pickupLiftAvailable' => 'Pickup lift access',
        'deliveryLiftAvailable' => 'Delivery lift access',
        'itemType' => 'Service type',
        'transportSpace' => 'Transport space',
        'transportSpaceLabel' => 'Transport space type',
        'itemDescription' => 'Item description',
        'instructions' => 'Instructions',
        'serviceSpecialInstructions' => 'Special instructions',
        'servicePacking' => 'Packing service',
        'serviceDisassembly' => 'Disassembly service',
        'serviceAssembleAtArrival' => 'Assembly at arrival',
        'serviceStorage' => 'Storage service',
        'servicePickupLoadingMethod' => 'Pickup loading method',
        'serviceDeliveryLoadingMethod' => 'Delivery loading method',
        'routeDistanceKm' => 'Route distance (km)',
        'routeDurationText' => 'Route duration',
        'whatBeingTransported' => 'What is being transported',
        'customerBudgetMode' => 'Budget preference',
        'customerBudgetMin' => 'Budget (minimum)',
        'customerBudgetMax' => 'Budget (maximum)',
        'customerFormComplete' => 'Listing marked complete',
        'customerFormCompletedAt' => 'Listing completed at',
    );
}

function quote_json_blob_change_fields() {
    return array(
        'pianosJson' => 'Piano details',
        'freightJson' => 'Freight details',
        'clearanceSelectedItemsJson' => 'Clearance items',
        'clearanceJson' => 'Clearance details',
        'carVehiclesJson' => 'Vehicle details (car)',
        'motorbikeVehiclesJson' => 'Vehicle details (motorbike)',
        'trailerVehiclesJson' => 'Vehicle details (trailer)',
        'industrialJson' => 'Industrial load details',
        'manpowerJson' => 'Manpower details',
        'officeInventory' => 'Office inventory',
        'petDetails' => 'Pet transport details',
        'stops' => 'Multi-stop route',
    );
}

function quote_inventory_change_fields() {
    return array(
        'houseInventory' => 'House removal inventory',
        'itemQuantities' => 'Item quantities',
        'multiFloorInventory' => 'Multi-floor inventory',
        'itemFloorAssignments' => 'Item floor assignments',
        'floorBlocks' => 'Floor details',
        'floorMediaItems' => 'Floor photos/videos',
        'selectedPickupFloors' => 'Pickup floors',
        'selectedDeliveryFloors' => 'Delivery floors',
    );
}

function format_quote_change_value($value) {
    $fp = quote_value_fingerprint($value);
    if ($fp === '') {
        return '(empty)';
    }
    if (strlen($fp) > 120) {
        return substr($fp, 0, 117) . '...';
    }
    return $fp;
}

function quote_item_signature($item) {
    if (!is_array($item)) {
        return '';
    }
    $name = strtolower(trim((string) ($item['name'] ?? '')));
    $qty = (int) ($item['quantity'] ?? 1);
    if ($qty < 1) {
        $qty = 1;
    }
    $dims = array(
        (string) ($item['width'] ?? ''),
        (string) ($item['widthUnit'] ?? ''),
        (string) ($item['depth'] ?? ''),
        (string) ($item['depthUnit'] ?? ''),
        (string) ($item['height'] ?? ''),
        (string) ($item['heightUnit'] ?? ''),
        (string) ($item['weight'] ?? ''),
        (string) ($item['weightUnit'] ?? ''),
    );
    return $name . '|' . $qty . '|' . implode(',', $dims);
}

function summarize_quote_items_changes($beforeItems, $afterItems) {
    $lines = array();
    $before = is_array($beforeItems) ? $beforeItems : array();
    $after = is_array($afterItems) ? $afterItems : array();

    $beforeMap = array();
    foreach ($before as $item) {
        if (!is_array($item)) {
            continue;
        }
        $name = trim((string) ($item['name'] ?? ''));
        if ($name === '') {
            continue;
        }
        $sig = quote_item_signature($item);
        $beforeMap[$sig] = $item;
    }
    $afterMap = array();
    foreach ($after as $item) {
        if (!is_array($item)) {
            continue;
        }
        $name = trim((string) ($item['name'] ?? ''));
        if ($name === '') {
            continue;
        }
        $sig = quote_item_signature($item);
        $afterMap[$sig] = $item;
    }

    foreach ($afterMap as $sig => $item) {
        if (!isset($beforeMap[$sig])) {
            $label = trim((string) ($item['name'] ?? 'Item'));
            $qty = (int) ($item['quantity'] ?? 1);
            $lines[] = 'Added item: ' . $label . ($qty > 1 ? ' (×' . $qty . ')' : '');
        }
    }
    foreach ($beforeMap as $sig => $item) {
        if (!isset($afterMap[$sig])) {
            $label = trim((string) ($item['name'] ?? 'Item'));
            $qty = (int) ($item['quantity'] ?? 1);
            $lines[] = 'Removed item: ' . $label . ($qty > 1 ? ' (×' . $qty . ')' : '');
        }
    }

    $beforeNames = array();
    foreach ($before as $item) {
        if (!is_array($item)) {
            continue;
        }
        $n = strtolower(trim((string) ($item['name'] ?? '')));
        if ($n !== '') {
            $beforeNames[$n] = (int) ($item['quantity'] ?? 1);
        }
    }
    $afterNames = array();
    foreach ($after as $item) {
        if (!is_array($item)) {
            continue;
        }
        $n = strtolower(trim((string) ($item['name'] ?? '')));
        if ($n !== '') {
            $afterNames[$n] = (int) ($item['quantity'] ?? 1);
        }
    }
    foreach ($afterNames as $name => $qtyAfter) {
        if (!isset($beforeNames[$name])) {
            continue;
        }
        $qtyBefore = (int) $beforeNames[$name];
        if ($qtyBefore !== $qtyAfter) {
            $lines[] = 'Quantity changed for ' . $name . ': ' . $qtyBefore . ' → ' . $qtyAfter;
        }
    }

    return array_values(array_unique($lines));
}

function compare_quote_changes($before, $after) {
    if (!is_array($before) || !is_array($after)) {
        return array();
    }

    $changes = array();

    foreach (quote_scalar_change_fields() as $key => $label) {
        $b = quote_value_fingerprint($before[$key] ?? '');
        $a = quote_value_fingerprint($after[$key] ?? '');
        if ($b === $a) {
            continue;
        }
        $changes[] = $label . ': ' . format_quote_change_value($before[$key] ?? '') . ' → ' . format_quote_change_value($after[$key] ?? '');
    }

    foreach (quote_json_blob_change_fields() as $key => $label) {
        $b = quote_value_fingerprint($before[$key] ?? '');
        $a = quote_value_fingerprint($after[$key] ?? '');
        if ($b === $a) {
            continue;
        }
        $changes[] = $label . ' updated';
    }

    foreach (quote_inventory_change_fields() as $key => $label) {
        $b = quote_value_fingerprint($before[$key] ?? '');
        $a = quote_value_fingerprint($after[$key] ?? '');
        if ($b === $a) {
            continue;
        }
        $changes[] = $label . ' updated';
    }

    $itemLines = summarize_quote_items_changes($before['items'] ?? array(), $after['items'] ?? array());
    foreach ($itemLines as $line) {
        $changes[] = $line;
    }

    $mediaBefore = quote_value_fingerprint($before['mediaAttachments'] ?? array());
    $mediaAfter = quote_value_fingerprint($after['mediaAttachments'] ?? array());
    if ($mediaBefore !== $mediaAfter) {
        $changes[] = 'Photos/videos updated';
    }

    return array_values(array_unique($changes));
}

function session_user_owns_quote($sessionUser, $quote) {
    if (!is_array($sessionUser) || !is_array($quote)) {
        return false;
    }
    $sid = trim((string) ($sessionUser['id'] ?? ''));
    $ownerId = trim((string) ($quote['userId'] ?? $quote['createdBy'] ?? ''));
    if ($sid !== '' && $ownerId !== '' && $sid === $ownerId) {
        return true;
    }
    $sessionEmail = strtolower(trim((string) ($sessionUser['email'] ?? '')));
    $quoteEmail = strtolower(trim((string) ($quote['customerEmail'] ?? '')));
    return $sessionEmail !== '' && $quoteEmail !== '' && $sessionEmail === $quoteEmail;
}

function get_provider_ids_with_active_bids_on_quote($store, $quoteId) {
    $quoteId = trim((string) $quoteId);
    $ids = array();
    foreach (get_active_quote_bids($store, $quoteId) as $bid) {
        $pid = trim((string) ($bid['providerId'] ?? ''));
        if ($pid !== '') {
            $ids[$pid] = true;
        }
    }
    return array_keys($ids);
}

function send_provider_quote_updated_email($provider, $quoteLabel, $quoteId, $changes, $customerName) {
    if (!is_array($provider) || empty($provider['email'])) {
        return false;
    }
    $name = provider_public_name($provider, 'there');
    $subject = 'Customer updated listing ' . $quoteLabel;
    $body = "Hi " . $name . ",\n\n";
    $body .= "The customer";
    if ($customerName !== '') {
        $body .= " (" . $customerName . ")";
    }
    $body .= " updated their listing " . $quoteLabel . ".\n\n";
    $body .= "Changes:\n";
    foreach ($changes as $line) {
        $body .= "• " . $line . "\n";
    }
    $body .= "\nReview the updated listing and adjust your bid if needed:\n";
    $body .= listing_details_url_for_quote($quoteId) . "\n\n";
    $body .= "This inbox is not monitored. Please use your provider dashboard for messages.\n\n";
    $body .= "Regards,\nAnyTransport";
    return send_email_simple($provider['email'], $subject, $body);
}

function notify_providers_quote_updated(&$store, $before, $after) {
    $quoteId = trim((string) ($after['id'] ?? ''));
    if ($quoteId === '') {
        return;
    }
    $changes = compare_quote_changes($before, $after);
    if (empty($changes)) {
        return;
    }

    $quoteLabel = trim((string) ($after['formId'] ?? $quoteId));
    $customerName = trim((string) ($after['customerName'] ?? ''));
    $providerIds = get_provider_ids_with_active_bids_on_quote($store, $quoteId);
    if (empty($providerIds)) {
        return;
    }

    $summary = count($changes) > 3
        ? (count($changes) . ' updates including ' . $changes[0])
        : implode('; ', $changes);

    foreach ($providerIds as $providerId) {
        $provider = find_store_user_by_id($store, $providerId);
        if (!is_array($provider)) {
            continue;
        }
        send_provider_quote_updated_email($provider, $quoteLabel, $quoteId, $changes, $customerName);
        add_user_notification(
            $store,
            $providerId,
            'Listing updated by customer',
            'Form ' . $quoteLabel . ' was updated: ' . $summary,
            'quote_updated',
            array('quoteId' => $quoteId)
        );
    }
}

function build_quote_media_entries($store, $quoteId) {
    $qid = trim((string) $quoteId);
    if ($qid === '') return array();
    $entries = array();
    foreach ($store['quoteMedia'] ?? array() as $media) {
        if (!is_array($media)) continue;
        if (trim((string) ($media['quoteId'] ?? '')) !== $qid) continue;
        $mediaId = trim((string) ($media['id'] ?? ''));
        if ($mediaId === '') continue;
        $mime = strtolower(trim((string) ($media['mimeType'] ?? '')));
        $isVideo = strpos($mime, 'video/') === 0;
        $entries[] = array(
            'id' => $mediaId,
            'mediaType' => $isVideo ? 'video' : 'photo',
            'previewUrl' => build_quote_media_url($mediaId),
            'fileName' => basename(trim((string) ($media['relativePath'] ?? ''))),
            'mimeType' => $mime
        );
    }
    return $entries;
}

function attach_quote_media($store, $quote) {
    if (!is_array($quote)) return $quote;
    $qid = trim((string) ($quote['id'] ?? ''));
    if ($qid === '') return $quote;
    $attached = build_quote_media_entries($store, $qid);
    if (!empty($attached)) {
        $existing = isset($quote['mediaAttachments']) && is_array($quote['mediaAttachments']) ? $quote['mediaAttachments'] : array();
        $quote['mediaAttachments'] = array_values(array_merge($existing, $attached));
    }
    return $quote;
}

function normalize_bid($bid) {
    $normalized = is_array($bid) ? $bid : array();
    if (!isset($normalized['id']) || trim((string) $normalized['id']) === '') {
        $normalized['id'] = make_id('bid');
    }
    if (!isset($normalized['createdAt'])) {
        $normalized['createdAt'] = gmdate('c');
    }
    $normalized['updatedAt'] = gmdate('c');
    if (!isset($normalized['status']) || trim((string) $normalized['status']) === '') {
        $normalized['status'] = 'active';
    }
    $normalized['autoBidEnabled'] = !empty($normalized['autoBidEnabled']);
    $normalized['autoBidFloor'] = max(0, (float) ($normalized['autoBidFloor'] ?? 0));
    $increment = (float) ($normalized['autoBidIncrement'] ?? 0);
    $normalized['autoBidIncrement'] = $increment > 0 ? $increment : ($normalized['autoBidEnabled'] ? 1.0 : 0);
    $source = strtolower(trim((string) ($normalized['bidSource'] ?? 'manual')));
    $normalized['bidSource'] = $source === 'auto' ? 'auto' : 'manual';
    return $normalized;
}

function bid_amount_value($bid) {
    if (!is_array($bid)) {
        return 0.0;
    }
    $amount = (float) ($bid['amount'] ?? 0);
    if ($amount <= 0) {
        $amount = (float) ($bid['price'] ?? 0);
    }
    return $amount;
}

function is_active_bid_record($bid) {
    if (!is_array($bid)) {
        return false;
    }
    return strtolower(trim((string) ($bid['status'] ?? 'active'))) === 'active';
}

function ensure_store_auto_bid_collections(&$store) {
    if (!isset($store['autoBidEvents']) || !is_array($store['autoBidEvents'])) {
        $store['autoBidEvents'] = array();
    }
    if (!isset($store['customerBidEmailQueue']) || !is_array($store['customerBidEmailQueue'])) {
        $store['customerBidEmailQueue'] = array();
    }
    if (!isset($store['autoBidWarQueue']) || !is_array($store['autoBidWarQueue'])) {
        $store['autoBidWarQueue'] = array();
    }
}

function get_active_quote_bids($store, $quoteId) {
    $quoteId = trim((string) $quoteId);
    $bids = isset($store['bids']) && is_array($store['bids']) ? $store['bids'] : array();
    return array_values(array_filter($bids, function ($bid) use ($quoteId) {
        if (!is_array($bid) || !is_active_bid_record($bid)) {
            return false;
        }
        return trim((string) ($bid['quoteId'] ?? '')) === $quoteId;
    }));
}

function get_provider_bid_for_quote($store, $quoteId, $providerId) {
    $quoteId = trim((string) $quoteId);
    $providerId = trim((string) $providerId);
    foreach (get_active_quote_bids($store, $quoteId) as $bid) {
        if (trim((string) ($bid['providerId'] ?? '')) === $providerId) {
            return $bid;
        }
    }
    return null;
}

function get_lowest_competitor_bid_for_provider($bids, $providerId) {
    $providerId = trim((string) $providerId);
    $lowest = null;
    foreach ($bids as $bid) {
        if (!is_array($bid)) {
            continue;
        }
        if (trim((string) ($bid['providerId'] ?? '')) === $providerId) {
            continue;
        }
        $amount = bid_amount_value($bid);
        if ($amount <= 0) {
            continue;
        }
        if ($lowest === null || $amount < bid_amount_value($lowest)) {
            $lowest = $bid;
        }
    }
    return $lowest;
}

function provider_has_auto_bid_subscription($user) {
    if (!is_array($user)) {
        return false;
    }
    $role = strtolower(trim((string) ($user['role'] ?? '')));
    if ($role !== 'provider') {
        return false;
    }
    if (!array_key_exists('autoBidSubscriptionEnabled', $user)) {
        return true;
    }
    return !empty($user['autoBidSubscriptionEnabled']);
}

function auto_bid_war_quiet_seconds() {
    return 60;
}

function append_auto_bid_event(&$store, $event) {
    ensure_store_auto_bid_collections($store);
    if (!is_array($event)) {
        return;
    }
    if (!isset($event['id']) || trim((string) $event['id']) === '') {
        $event['id'] = make_id('abe');
    }
    if (!isset($event['createdAt'])) {
        $event['createdAt'] = gmdate('c');
    }
    array_unshift($store['autoBidEvents'], $event);
    $store['autoBidEvents'] = array_slice($store['autoBidEvents'], 0, 2000);
}

function find_store_user_by_id($store, $userId) {
    $userId = trim((string) $userId);
    if ($userId === '') {
        return null;
    }
    foreach ($store['users'] as $user) {
        if (!is_array($user)) {
            continue;
        }
        if (trim((string) ($user['id'] ?? '')) === $userId) {
            return normalize_user($user);
        }
    }
    return null;
}

function find_store_quote_by_id($store, $quoteId) {
    $quoteId = trim((string) $quoteId);
    foreach ($store['quotes'] as $quote) {
        if (!is_array($quote)) {
            continue;
        }
        if (trim((string) ($quote['id'] ?? '')) === $quoteId) {
            return $quote;
        }
    }
    return null;
}

function haversine_distance_km($lat1, $lng1, $lat2, $lng2) {
    $lat1 = (float) $lat1;
    $lng1 = (float) $lng1;
    $lat2 = (float) $lat2;
    $lng2 = (float) $lng2;
    if ($lat1 === 0.0 && $lng1 === 0.0) {
        return null;
    }
    if ($lat2 === 0.0 && $lng2 === 0.0) {
        return null;
    }
    $earthRadius = 6371.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) * sin($dLat / 2)
        + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) * sin($dLng / 2);
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    return $earthRadius * $c;
}

function is_discoverable_provider($user) {
    if (!is_array($user)) {
        return false;
    }
    $role = strtolower(trim((string) ($user['role'] ?? '')));
    if ($role !== 'provider') {
        return false;
    }
    $status = strtolower(trim((string) ($user['identityReviewStatus'] ?? '')));
    if ($status === 'approved' || !empty($user['verified'])) {
        return true;
    }
    return false;
}

function provider_has_map_location($user) {
    if (!is_array($user)) {
        return false;
    }
    $lat = (float) ($user['serviceAreaLat'] ?? 0);
    $lng = (float) ($user['serviceAreaLng'] ?? 0);
    if ($lat === 0.0 && $lng === 0.0) {
        return false;
    }
    $city = trim((string) ($user['serviceAreaCity'] ?? $user['city'] ?? ''));
    return $city !== '' || trim((string) ($user['serviceAreaAddress'] ?? '')) !== '';
}

function sanitize_provider_for_discovery($user, $distanceKm = null) {
    if (!is_array($user)) {
        return array();
    }
    $showExact = !empty($user['showExactAddressOnMap']);
    $city = trim((string) ($user['serviceAreaCity'] ?? $user['city'] ?? $user['location'] ?? ''));
    $address = $showExact ? trim((string) ($user['serviceAreaAddress'] ?? '')) : '';
    $services = array();
    if (isset($user['services']) && is_array($user['services'])) {
        $services = array_values(array_filter(array_map('strval', $user['services'])));
    } elseif (isset($user['categories']) && is_array($user['categories'])) {
        $services = array_values(array_filter(array_map('strval', $user['categories'])));
    }
    $out = array(
        'id' => trim((string) ($user['id'] ?? '')),
        'username' => trim((string) ($user['username'] ?? $user['nickname'] ?? '')),
        'businessName' => trim((string) ($user['businessName'] ?? $user['name'] ?? '')),
        'description' => trim((string) ($user['description'] ?? $user['about'] ?? $user['businessDescription'] ?? '')),
        'serviceAreaCity' => $city,
        'serviceAreaAddress' => $address,
        'showExactAddressOnMap' => $showExact,
        'blockInvites' => !empty($user['blockInvites']),
        'services' => $services,
        'avatar' => trim((string) ($user['avatar'] ?? '')),
        'photos' => isset($user['photos']) && is_array($user['photos']) ? array_values($user['photos']) : array(),
        'mapLat' => (float) ($user['serviceAreaLat'] ?? 0),
        'mapLng' => (float) ($user['serviceAreaLng'] ?? 0),
        'verified' => !empty($user['verified']),
    );
    if ($distanceKm !== null) {
        $out['distanceKm'] = round((float) $distanceKm, 1);
    }
    return $out;
}

function provider_ids_match($a, $b) {
    return trim((string) $a) !== '' && trim((string) $a) === trim((string) $b);
}

function provider_quote_ids_won($store, $providerId) {
    $wonIds = array();
    $providerId = trim((string) $providerId);
    if ($providerId === '') {
        return $wonIds;
    }
    $quotes = isset($store['quotes']) && is_array($store['quotes']) ? $store['quotes'] : array();
    $bids = isset($store['bids']) && is_array($store['bids']) ? $store['bids'] : array();

    foreach ($quotes as $quote) {
        if (!is_array($quote)) {
            continue;
        }
        $quoteId = trim((string) ($quote['id'] ?? ''));
        if ($quoteId === '') {
            continue;
        }

        $explicitWinner = trim((string) ($quote['winningProviderId'] ?? $quote['awardedProviderId'] ?? $quote['selectedProviderId'] ?? $quote['acceptedProviderId'] ?? ''));
        if ($explicitWinner !== '' && provider_ids_match($explicitWinner, $providerId)) {
            $wonIds[$quoteId] = true;
            continue;
        }

        $quoteBids = array();
        foreach ($bids as $bid) {
            if (!is_array($bid)) {
                continue;
            }
            if (trim((string) ($bid['quoteId'] ?? '')) === $quoteId) {
                $quoteBids[] = $bid;
            }
        }

        $hasAcceptedBid = false;
        foreach ($quoteBids as $bid) {
            if (!provider_ids_match($bid['providerId'] ?? '', $providerId)) {
                continue;
            }
            $status = strtolower(trim((string) ($bid['status'] ?? '')));
            if ($status === 'won' || $status === 'accepted' || !empty($bid['accepted'])) {
                $hasAcceptedBid = true;
                break;
            }
        }
        if ($hasAcceptedBid) {
            $wonIds[$quoteId] = true;
            continue;
        }

        if (strtolower(trim((string) ($quote['status'] ?? ''))) !== 'claimed') {
            continue;
        }
        $activeBids = array();
        foreach ($quoteBids as $bid) {
            if (!is_array($bid)) {
                continue;
            }
            if (strtolower(trim((string) ($bid['status'] ?? 'active'))) === 'active') {
                $activeBids[] = $bid;
            }
        }
        $lowest = null;
        foreach ($activeBids as $bid) {
            $amount = isset($bid['amount']) ? (float) $bid['amount'] : 0.0;
            if ($lowest === null || $amount < (float) ($lowest['amount'] ?? 0)) {
                $lowest = $bid;
            }
        }
        if (is_array($lowest) && provider_ids_match($lowest['providerId'] ?? '', $providerId)) {
            $wonIds[$quoteId] = true;
        }
    }

    return array_keys($wonIds);
}

function quote_route_summary_public($quote) {
    if (!is_array($quote)) {
        return '';
    }
    $pickup = trim(implode(', ', array_filter(array(
        trim((string) ($quote['pickupCity'] ?? '')),
        trim((string) ($quote['pickupPostcode'] ?? ''))
    ))));
    $delivery = trim(implode(', ', array_filter(array(
        trim((string) ($quote['deliveryCity'] ?? '')),
        trim((string) ($quote['deliveryPostcode'] ?? ''))
    ))));
    if ($pickup === '' && $delivery === '') {
        return '';
    }
    if ($pickup === '') {
        return $delivery;
    }
    if ($delivery === '') {
        return $pickup;
    }
    return $pickup . ' → ' . $delivery;
}

function sanitize_provider_job_history_entry($quote, $bid, $completed) {
    $quote = is_array($quote) ? $quote : array();
    $bid = is_array($bid) ? $bid : array();
    $service = trim((string) ($quote['itemDescription'] ?? $quote['itemType'] ?? $quote['title'] ?? 'Transport job'));
    $when = trim((string) ($bid['createdAt'] ?? $quote['updatedAt'] ?? $quote['submittedAt'] ?? $quote['createdAt'] ?? ''));
    $amount = isset($bid['amount']) ? (float) $bid['amount'] : null;
    $bidStatus = strtolower(trim((string) ($bid['status'] ?? 'active')));
    $statusLabel = $completed ? 'Completed' : ($bidStatus === 'won' || $bidStatus === 'accepted' ? 'Awarded' : 'Quoted');
    return array(
        'quoteId' => trim((string) ($quote['id'] ?? '')),
        'formId' => trim((string) ($quote['formId'] ?? '')),
        'service' => $service,
        'route' => quote_route_summary_public($quote),
        'status' => $statusLabel,
        'completed' => !empty($completed),
        'bidAmount' => $amount !== null && $amount > 0 ? round($amount, 2) : null,
        'date' => $when
    );
}

function build_provider_job_history($store, $providerId, $limit) {
    $providerId = trim((string) $providerId);
    $limit = max(1, min(100, (int) $limit));
    if ($providerId === '') {
        return array();
    }
    $wonSet = array();
    foreach (provider_quote_ids_won($store, $providerId) as $quoteId) {
        $wonSet[trim((string) $quoteId)] = true;
    }

    $entries = array();
    $seen = array();
    $bids = isset($store['bids']) && is_array($store['bids']) ? $store['bids'] : array();
    $quotes = isset($store['quotes']) && is_array($store['quotes']) ? $store['quotes'] : array();

    foreach ($bids as $bid) {
        if (!is_array($bid)) {
            continue;
        }
        if (!provider_ids_match($bid['providerId'] ?? '', $providerId)) {
            continue;
        }
        $quoteId = trim((string) ($bid['quoteId'] ?? ''));
        if ($quoteId === '' || isset($seen[$quoteId])) {
            continue;
        }
        $quote = find_quote_by_id($quotes, $quoteId);
        if (!is_array($quote)) {
            continue;
        }
        $seen[$quoteId] = true;
        $entries[] = sanitize_provider_job_history_entry($quote, $bid, !empty($wonSet[$quoteId]));
    }

    foreach (array_keys($wonSet) as $quoteId) {
        if (isset($seen[$quoteId])) {
            continue;
        }
        $quote = find_quote_by_id($quotes, $quoteId);
        if (!is_array($quote)) {
            continue;
        }
        $seen[$quoteId] = true;
        $entries[] = sanitize_provider_job_history_entry($quote, array(), true);
    }

    usort($entries, function ($a, $b) {
        $ta = strtotime((string) ($a['date'] ?? ''));
        $tb = strtotime((string) ($b['date'] ?? ''));
        return $tb <=> $ta;
    });

    return array_slice($entries, 0, $limit);
}

function sanitize_provider_public_profile($user) {
    if (!is_array($user)) {
        return array();
    }
    $services = array();
    if (isset($user['services']) && is_array($user['services'])) {
        $services = array_values(array_filter(array_map('strval', $user['services'])));
    } elseif (isset($user['categories']) && is_array($user['categories'])) {
        $services = array_values(array_filter(array_map('strval', $user['categories'])));
    }
    $photos = array();
    if (isset($user['photos']) && is_array($user['photos'])) {
        $photos = array_values(array_filter(array_map('strval', $user['photos'])));
    }
    $paymentMethods = array();
    if (isset($user['paymentMethods']) && is_array($user['paymentMethods'])) {
        foreach ($user['paymentMethods'] as $key => $enabled) {
            if ($enabled) {
                $paymentMethods[] = (string) $key;
            }
        }
    }
    $reviewStatus = strtolower(trim((string) ($user['identityReviewStatus'] ?? '')));
    return array(
        'id' => trim((string) ($user['id'] ?? '')),
        'username' => trim((string) ($user['username'] ?? $user['nickname'] ?? '')),
        'businessName' => trim((string) ($user['businessName'] ?? $user['name'] ?? '')),
        'description' => trim((string) ($user['description'] ?? $user['about'] ?? $user['businessDescription'] ?? '')),
        'bio' => trim((string) ($user['bio'] ?? $user['summary'] ?? '')),
        'city' => trim((string) ($user['serviceAreaCity'] ?? $user['city'] ?? $user['location'] ?? '')),
        'services' => $services,
        'vehicleCount' => isset($user['vehicleCount']) && $user['vehicleCount'] !== null && $user['vehicleCount'] !== ''
            ? max(0, min(9999, (int) $user['vehicleCount']))
            : null,
        'avatar' => trim((string) ($user['avatar'] ?? '')),
        'photos' => $photos,
        'paymentMethods' => $paymentMethods,
        'identityReviewStatus' => $reviewStatus,
        'verified' => $reviewStatus === 'approved' || !empty($user['verified']),
        'memberSince' => trim((string) ($user['createdAt'] ?? ''))
    );
}

function search_discoverable_providers($store, $lat, $lng, $customerMaxKm, $categoryFilter) {
    $lat = (float) $lat;
    $lng = (float) $lng;
    $customerMaxKm = max(5.0, min(500.0, (float) $customerMaxKm));
    $categoryFilter = strtolower(trim((string) $categoryFilter));
    $matches = array();

    foreach ($store['users'] as $user) {
        if (!is_discoverable_provider($user) || !provider_has_map_location($user)) {
            continue;
        }
        $providerLat = (float) ($user['serviceAreaLat'] ?? 0);
        $providerLng = (float) ($user['serviceAreaLng'] ?? 0);
        $distance = haversine_distance_km($lat, $lng, $providerLat, $providerLng);
        if ($distance === null) {
            continue;
        }
        if ($distance > $customerMaxKm) {
            continue;
        }
        if ($categoryFilter !== '') {
            $services = array();
            if (isset($user['services']) && is_array($user['services'])) {
                $services = $user['services'];
            } elseif (isset($user['categories']) && is_array($user['categories'])) {
                $services = $user['categories'];
            }
            $blob = strtolower(implode(' ', array_map('strval', $services)));
            if ($blob === '' || strpos($blob, $categoryFilter) === false) {
                continue;
            }
        }
        $entry = sanitize_provider_for_discovery($user, $distance);
        $entry['_sortDistance'] = $distance;
        $matches[] = $entry;
    }

    usort($matches, function ($a, $b) {
        return ($a['_sortDistance'] ?? 0) <=> ($b['_sortDistance'] ?? 0);
    });
    foreach ($matches as &$entry) {
        unset($entry['_sortDistance']);
    }
    unset($entry);

    return $matches;
}

function ensure_store_provider_invites(&$store) {
    if (!isset($store['providerInvites']) || !is_array($store['providerInvites'])) {
        $store['providerInvites'] = array();
    }
}

function find_provider_invite_index($store, $quoteId, $providerId) {
    ensure_store_provider_invites($store);
    $quoteId = trim((string) $quoteId);
    $providerId = trim((string) $providerId);
    foreach ($store['providerInvites'] as $index => $invite) {
        if (!is_array($invite)) {
            continue;
        }
        if (trim((string) ($invite['quoteId'] ?? '')) !== $quoteId) {
            continue;
        }
        if (trim((string) ($invite['providerId'] ?? '')) !== $providerId) {
            continue;
        }
        if (strtolower(trim((string) ($invite['status'] ?? 'active'))) === 'cancelled') {
            continue;
        }
        return (int) $index;
    }
    return -1;
}

function send_provider_job_invite_email($provider, $customerName, $quoteLabel, $quoteId) {
    if (!is_array($provider) || empty($provider['email']) || !empty($provider['muteInviteEmails'])) {
        return false;
    }
    $name = provider_public_name($provider, 'there');
    $subject = 'Invitation to quote on listing ' . $quoteLabel;
    $body = "Hi " . $name . ",\n\n";
    $body .= $customerName . " invited you to submit a quote on their listing " . $quoteLabel . ".\n\n";
    $body .= "View the listing and place your bid:\n";
    $body .= listing_details_url_for_quote($quoteId) . "\n\n";
    $body .= "This inbox is not monitored. Please use your provider dashboard.\n\n";
    $body .= "Regards,\nAnyTransport";
    return send_email_simple($provider['email'], $subject, $body);
}

function user_display_name($user, $fallback = 'Someone') {
    if (!is_array($user)) {
        return $fallback;
    }
    $role = strtolower(trim((string) ($user['role'] ?? '')));
    $fields = $role === 'provider'
        ? array('businessName', 'name', 'username', 'nickname', 'displayName')
        : array('username', 'nickname', 'name', 'displayName', 'businessName');
    foreach ($fields as $field) {
        $value = trim((string) ($user[$field] ?? ''));
        if ($value !== '') {
            return $value;
        }
    }
    $email = trim((string) ($user['email'] ?? ''));
    if ($email !== '') {
        $local = strstr($email, '@', true);
        if ($local !== false && $local !== '') {
            return $local;
        }
    }
    return $fallback;
}

function provider_public_name($user, $fallback = 'Provider') {
    return user_display_name($user, $fallback);
}

function listing_details_url_for_quote($quoteId) {
    return get_app_url('listing-details.html?quoteId=' . rawurlencode(trim((string) $quoteId)));
}

function resolve_quote_owner_context($store, $quote) {
    $quoteOwnerId = '';
    $quoteOwnerEmail = '';
    if (!is_array($quote)) {
        return array('ownerId' => '', 'owner' => null, 'quoteLabel' => '');
    }
    $quoteId = trim((string) ($quote['id'] ?? ''));
    $quoteOwnerId = trim((string) ($quote['userId'] ?? $quote['createdBy'] ?? ''));
    $quoteOwnerEmail = strtolower(trim((string) ($quote['customerEmail'] ?? '')));
    $quoteLabel = trim((string) ($quote['formId'] ?? $quoteId));

    if ($quoteOwnerEmail !== '') {
        $emailMatches = array_values(array_filter($store['users'], function ($u) use ($quoteOwnerEmail) {
            return strtolower(trim((string) ($u['email'] ?? ''))) === $quoteOwnerEmail;
        }));
        if (!empty($emailMatches)) {
            usort($emailMatches, function ($a, $b) {
                $aCreated = strtotime((string) ($a['createdAt'] ?? '')) ?: 0;
                $bCreated = strtotime((string) ($b['createdAt'] ?? '')) ?: 0;
                return $bCreated <=> $aCreated;
            });
            $preferred = null;
            foreach ($emailMatches as $candidate) {
                $role = strtolower(trim((string) ($candidate['role'] ?? 'customer')));
                if ($role === 'customer' || $role === '') {
                    $preferred = $candidate;
                    break;
                }
            }
            if ($preferred === null) {
                $preferred = $emailMatches[0];
            }
            $candidateId = trim((string) ($preferred['id'] ?? ''));
            if ($candidateId !== '') {
                $quoteOwnerId = $candidateId;
            }
        }
    }

    $owner = $quoteOwnerId !== '' ? find_store_user_by_id($store, $quoteOwnerId) : null;
    return array(
        'ownerId' => $quoteOwnerId,
        'owner' => $owner,
        'quoteLabel' => $quoteLabel !== '' ? $quoteLabel : $quoteId
    );
}

function resolve_listing_owner_recipient($store, $quote) {
    if (!is_array($quote)) {
        return array('email' => '', 'name' => 'there', 'ownerId' => '');
    }
    $ownerContext = resolve_quote_owner_context($store, $quote);
    $owner = $ownerContext['owner'];
    $to = '';
    if (is_array($owner)) {
        $to = trim((string) ($owner['email'] ?? ''));
    }
    if ($to === '') {
        $to = trim((string) ($quote['customerEmail'] ?? ''));
    }
    $name = trim((string) ($quote['customerName'] ?? ''));
    if (is_array($owner)) {
        $name = trim((string) ($owner['name'] ?? $owner['username'] ?? $name));
    }
    if ($name === '') {
        $name = 'there';
    }
    return array(
        'email' => $to,
        'name' => $name,
        'ownerId' => trim((string) ($ownerContext['ownerId'] ?? ''))
    );
}

function send_admin_listing_owner_email($store, $quote, $reason, $mode = 'notify') {
    if (!is_array($quote)) {
        return false;
    }
    $recipient = resolve_listing_owner_recipient($store, $quote);
    $to = trim((string) ($recipient['email'] ?? ''));
    if ($to === '') {
        return false;
    }

    $reason = trim((string) $reason);
    $formReference = trim((string) ($quote['formId'] ?? $quote['id'] ?? ''));
    $name = trim((string) ($recipient['name'] ?? 'there'));
    if ($name === '') {
        $name = 'there';
    }

    $mode = strtolower(trim((string) $mode));
    if ($mode === 'removed') {
        $subject = 'Your AnyTransport listing ' . $formReference . ' was removed';
        $body = "Hello " . $name . ",\n\n";
        $body .= "Your listing (" . $formReference . ") has been removed from AnyTransport by an admin.\n\n";
    } else {
        $subject = 'Update about your AnyTransport listing ' . $formReference;
        $body = "Hello " . $name . ",\n\n";
        $body .= "An admin reviewed your listing (" . $formReference . ") on AnyTransport.\n\n";
    }

    if ($reason !== '') {
        $body .= "Message from admin:\n" . $reason . "\n\n";
    }

    $body .= "You can view your dashboard:\n";
    $body .= get_app_url('customer-dashboard.html') . "\n\n";
    $body .= "This inbox is not monitored. Please use your dashboard for updates.\n\n";
    $body .= "Regards,\nAnyTransport";

    return send_email_simple($to, $subject, $body);
}

function add_user_notification(&$store, $userId, $title, $message, $type, $data = array()) {
    if (trim((string) $userId) === '') {
        return;
    }
    if (!isset($store['notifications']) || !is_array($store['notifications'])) {
        $store['notifications'] = array();
    }
    $store['notifications'][] = array(
        'id' => make_id('ntf'),
        'userId' => trim((string) $userId),
        'title' => trim((string) $title),
        'message' => trim((string) $message),
        'type' => trim((string) $type),
        'read' => false,
        'createdAt' => gmdate('c'),
        'data' => is_array($data) ? $data : array()
    );
    $store['notifications'] = array_slice($store['notifications'], 0, 500);
}

function send_customer_low_bid_email($owner, $providerName, $quoteLabel, $quoteId, $amount, $isFollowUp = false) {
    if (!is_array($owner) || empty($owner['email'])) {
        return false;
    }
    $amountText = number_format((float) $amount, 2, '.', '');
    $subject = $isFollowUp
        ? 'Updated low bid on listing ' . $quoteLabel
        : 'New low bid on listing ' . $quoteLabel;
    $body = "Hi " . (string) ($owner['name'] ?? $owner['username'] ?? '') . ",\n\n";
    if ($isFollowUp) {
        $body .= $providerName . " has updated their bid to €" . $amountText . " on your listing " . $quoteLabel . ".\n\n";
    } else {
        $body .= "You have a new low bid by " . $providerName . " — €" . $amountText . " on listing " . $quoteLabel . ".\n\n";
    }
    $body .= "View your listing: " . listing_details_url_for_quote($quoteId) . "\n\n";
    $body .= "This inbox is not monitored. Please use the link above to view bids.\n";
    return send_email_simple($owner['email'], $subject, $body);
}

function send_provider_auto_bid_used_email($provider, $quoteLabel, $quoteId, $amount, $competitorAmount) {
    if (!is_array($provider) || empty($provider['email'])) {
        return false;
    }
    $name = provider_public_name($provider, 'there');
    $subject = 'Auto-bid placed on listing ' . $quoteLabel;
    $body = "Hi " . $name . ",\n\n";
    $body .= "Your auto-bid placed a new quote of €" . number_format((float) $amount, 2, '.', '') . " on listing " . $quoteLabel . ".";
    if ($competitorAmount > 0) {
        $body .= " Another provider was at €" . number_format((float) $competitorAmount, 2, '.', '') . ".";
    }
    $body .= "\n\nOpen the listing: " . listing_details_url_for_quote($quoteId) . "\n";
    return send_email_simple($provider['email'], $subject, $body);
}

function send_provider_auto_bid_floor_email($provider, $quoteLabel, $quoteId, $floor, $competitorAmount) {
    if (!is_array($provider) || empty($provider['email'])) {
        return false;
    }
    $name = provider_public_name($provider, 'there');
    $subject = 'Auto-bid stopped — minimum reached on ' . $quoteLabel;
    $body = "Hi " . $name . ",\n\n";
    $body .= "Your auto-bid has reached your minimum of €" . number_format((float) $floor, 2, '.', '') . " on listing " . $quoteLabel . ".";
    if ($competitorAmount > 0) {
        $body .= " The current competing bid is €" . number_format((float) $competitorAmount, 2, '.', '') . ".";
    }
    $body .= " We will not place further automatic bids on this listing unless you update your quote or floor.\n\n";
    $body .= "Review the listing: " . listing_details_url_for_quote($quoteId) . "\n";
    return send_email_simple($provider['email'], $subject, $body);
}

function get_lowest_active_bid_for_quote($store, $quoteId) {
    $lowest = null;
    foreach (get_active_quote_bids($store, $quoteId) as $bid) {
        $amount = bid_amount_value($bid);
        if ($amount <= 0) {
            continue;
        }
        if ($lowest === null || $amount < bid_amount_value($lowest)) {
            $lowest = $bid;
        }
    }
    return $lowest;
}

function send_customer_bidding_war_ended_email($owner, $quoteLabel, $quoteId, $lowestAmount) {
    if (!is_array($owner) || empty($owner['email'])) {
        return false;
    }
    $subject = 'Bidding has settled on listing ' . $quoteLabel;
    $body = "Hi " . (string) ($owner['name'] ?? $owner['username'] ?? '') . ",\n\n";
    $body .= "Automatic bidding on your listing " . $quoteLabel . " has finished.";
    if ($lowestAmount > 0) {
        $body .= " The current lowest quote is €" . number_format((float) $lowestAmount, 2, '.', '') . ".";
    }
    $body .= "\n\nView your listing: " . listing_details_url_for_quote($quoteId) . "\n\n";
    $body .= "This inbox is not monitored. Please use the link above to view bids.\n";
    return send_email_simple($owner['email'], $subject, $body);
}

function send_provider_bidding_war_ended_email($provider, $quoteLabel, $quoteId, $myAmount, $lowestAmount) {
    if (!is_array($provider) || empty($provider['email'])) {
        return false;
    }
    $name = provider_public_name($provider, 'there');
    $subject = 'Auto-bidding settled on listing ' . $quoteLabel;
    $body = "Hi " . $name . ",\n\n";
    $body .= "Automatic bidding on listing " . $quoteLabel . " has finished.";
    if ($myAmount > 0) {
        $body .= " Your current quote is €" . number_format((float) $myAmount, 2, '.', '') . ".";
    }
    if ($lowestAmount > 0) {
        $body .= " The lowest quote on this listing is €" . number_format((float) $lowestAmount, 2, '.', '') . ".";
    }
    $body .= "\n\nOpen the listing: " . listing_details_url_for_quote($quoteId) . "\n";
    return send_email_simple($provider['email'], $subject, $body);
}

function customer_bid_queue_key($quoteId, $providerId) {
    return trim((string) $quoteId) . ':' . trim((string) $providerId);
}

function queue_auto_bid_war_activity(&$store, $quoteId, $providerId) {
    ensure_store_auto_bid_collections($store);
    $quoteId = trim((string) $quoteId);
    $providerId = trim((string) $providerId);
    if ($quoteId === '' || $providerId === '') {
        return;
    }

    if (!isset($store['autoBidWarQueue'][$quoteId]) || !is_array($store['autoBidWarQueue'][$quoteId])) {
        $store['autoBidWarQueue'][$quoteId] = array(
            'quoteId' => $quoteId,
            'lastAutoBidAt' => gmdate('c'),
            'providerIds' => array()
        );
    }

    $entry = &$store['autoBidWarQueue'][$quoteId];
    $entry['lastAutoBidAt'] = gmdate('c');
    $providerIds = isset($entry['providerIds']) && is_array($entry['providerIds']) ? $entry['providerIds'] : array();
    if (!in_array($providerId, $providerIds, true)) {
        $providerIds[] = $providerId;
    }
    $entry['providerIds'] = $providerIds;
}

function clear_auto_bid_war_queue(&$store, $quoteId) {
    ensure_store_auto_bid_collections($store);
    $quoteId = trim((string) $quoteId);
    if ($quoteId !== '' && isset($store['autoBidWarQueue'][$quoteId])) {
        unset($store['autoBidWarQueue'][$quoteId]);
    }
}

function queue_customer_bid_email_after_auto(&$store, $quoteId, $providerId, $amount) {
    queue_auto_bid_war_activity($store, $quoteId, $providerId);
}

function clear_customer_bid_email_queue(&$store, $quoteId, $providerId) {
    clear_auto_bid_war_queue($store, $quoteId);
    ensure_store_auto_bid_collections($store);
    $prefix = trim((string) $quoteId) . ':';
    foreach (array_keys($store['customerBidEmailQueue']) as $key) {
        if (strpos((string) $key, $prefix) === 0) {
            unset($store['customerBidEmailQueue'][$key]);
        }
    }
}

function process_legacy_customer_bid_email_queue(&$store) {
    ensure_store_auto_bid_collections($store);
    $now = time();
    foreach (array_keys($store['customerBidEmailQueue']) as $key) {
        $entry = $store['customerBidEmailQueue'][$key];
        if (!is_array($entry) || empty($entry['awaitingQuietPeriod'])) {
            continue;
        }
        $lastAt = strtotime((string) ($entry['lastAutoBidAt'] ?? ''));
        if ($lastAt <= 0 || ($now - $lastAt) < auto_bid_war_quiet_seconds()) {
            continue;
        }
        $quoteId = trim((string) ($entry['quoteId'] ?? ''));
        $providerId = trim((string) ($entry['providerId'] ?? ''));
        if ($quoteId !== '' && $providerId !== '') {
            queue_auto_bid_war_activity($store, $quoteId, $providerId);
        }
        unset($store['customerBidEmailQueue'][$key]);
    }
}

function notify_bidding_war_ended(&$store, $quoteId, $providerIds) {
    $quoteId = trim((string) $quoteId);
    if ($quoteId === '') {
        return;
    }
    $quote = find_store_quote_by_id($store, $quoteId);
    if (!is_array($quote)) {
        return;
    }

    $ownerContext = resolve_quote_owner_context($store, $quote);
    $owner = $ownerContext['owner'];
    $quoteLabel = $ownerContext['quoteLabel'];
    $lowestBid = get_lowest_active_bid_for_quote($store, $quoteId);
    $lowestAmount = is_array($lowestBid) ? bid_amount_value($lowestBid) : 0.0;

    if (is_array($owner)) {
        send_customer_bidding_war_ended_email($owner, $quoteLabel, $quoteId, $lowestAmount);
        add_user_notification(
            $store,
            $ownerContext['ownerId'],
            'Bidding settled',
            'Automatic bidding has finished on listing ' . $quoteLabel . ($lowestAmount > 0 ? '. Lowest quote: €' . number_format($lowestAmount, 2, '.', '') . '.' : '.'),
            'bid_received',
            array('quoteId' => $quoteId)
        );
    }

    $seenProviders = array();
    foreach ($providerIds as $providerId) {
        $providerId = trim((string) $providerId);
        if ($providerId === '' || isset($seenProviders[$providerId])) {
            continue;
        }
        $seenProviders[$providerId] = true;
        $provider = find_store_user_by_id($store, $providerId);
        if (!is_array($provider)) {
            continue;
        }
        $myBid = get_provider_bid_for_quote($store, $quoteId, $providerId);
        $myAmount = is_array($myBid) ? bid_amount_value($myBid) : 0.0;
        send_provider_bidding_war_ended_email($provider, $quoteLabel, $quoteId, $myAmount, $lowestAmount);
        add_user_notification(
            $store,
            $providerId,
            'Auto-bidding settled',
            'Automatic bidding has finished on listing ' . $quoteLabel . '.',
            'auto_bid_war_ended',
            array('quoteId' => $quoteId)
        );
    }

    append_auto_bid_event($store, array(
        'quoteId' => $quoteId,
        'type' => 'war_ended',
        'lowestAmount' => $lowestAmount,
        'providerIds' => array_values(array_keys($seenProviders))
    ));
}

function process_customer_bid_email_queue(&$store) {
    process_legacy_customer_bid_email_queue($store);

    ensure_store_auto_bid_collections($store);
    $now = time();
    foreach (array_keys($store['autoBidWarQueue']) as $quoteId) {
        $entry = $store['autoBidWarQueue'][$quoteId];
        if (!is_array($entry)) {
            unset($store['autoBidWarQueue'][$quoteId]);
            continue;
        }
        $providerIds = isset($entry['providerIds']) && is_array($entry['providerIds']) ? array_values(array_unique(array_filter(array_map('strval', $entry['providerIds'])))) : array();
        if (count($providerIds) < 2) {
            unset($store['autoBidWarQueue'][$quoteId]);
            continue;
        }
        $lastAt = strtotime((string) ($entry['lastAutoBidAt'] ?? ''));
        if ($lastAt <= 0 || ($now - $lastAt) < auto_bid_war_quiet_seconds()) {
            continue;
        }
        notify_bidding_war_ended($store, $quoteId, $providerIds);
        unset($store['autoBidWarQueue'][$quoteId]);
    }
}

function notify_customer_manual_bid(&$store, $quote, $provider, $amount) {
    $ownerContext = resolve_quote_owner_context($store, $quote);
    $ownerId = $ownerContext['ownerId'];
    $owner = $ownerContext['owner'];
    $providerId = trim((string) ($provider['id'] ?? ''));
    if ($ownerId === '' || $providerId === '' || $ownerId === $providerId || !is_array($owner)) {
        return;
    }
    $quoteId = trim((string) ($quote['id'] ?? ''));
    clear_customer_bid_email_queue($store, $quoteId, $providerId);
    $providerName = provider_public_name($provider);
    send_customer_low_bid_email($owner, $providerName, $ownerContext['quoteLabel'], $quoteId, $amount, false);
    add_user_notification(
        $store,
        $ownerId,
        'New low bid',
        'New low bid by ' . $providerName . ' — €' . number_format((float) $amount, 2, '.', '') . ' on listing ' . $ownerContext['quoteLabel'] . '.',
        'bid_received',
        array('quoteId' => $quoteId, 'fromUserId' => $providerId)
    );
}

function notify_provider_auto_bid_used(&$store, $provider, $quote, $bid, $newAmount, $competitorAmount, $deferEmail = false) {
    $providerId = trim((string) ($provider['id'] ?? ''));
    $quoteId = trim((string) ($quote['id'] ?? ''));
    $quoteLabel = trim((string) ($quote['formId'] ?? $quoteId));
    add_user_notification(
        $store,
        $providerId,
        'Auto-bid placed',
        'Your auto-bid placed €' . number_format((float) $newAmount, 2, '.', '') . ' on listing ' . $quoteLabel . '.',
        'auto_bid_used',
        array(
            'quoteId' => $quoteId,
            'bidId' => trim((string) ($bid['id'] ?? ''))
        )
    );
    if (!$deferEmail) {
        send_provider_auto_bid_used_email($provider, $quoteLabel, $quoteId, $newAmount, $competitorAmount);
    }
}

function notify_provider_auto_bid_floor(&$store, $provider, $quote, $floor, $competitorAmount, $bidId = '') {
    $providerId = trim((string) ($provider['id'] ?? ''));
    $quoteId = trim((string) ($quote['id'] ?? ''));
    $quoteLabel = trim((string) ($quote['formId'] ?? $quoteId));
    add_user_notification(
        $store,
        $providerId,
        'Auto-bid minimum reached',
        'Auto-bid stopped at your floor of €' . number_format((float) $floor, 2, '.', '') . ' on listing ' . $quoteLabel . '.',
        'auto_bid_floor',
        array(
            'quoteId' => $quoteId,
            'bidId' => $bidId
        )
    );
    send_provider_auto_bid_floor_email($provider, $quoteLabel, $quoteId, $floor, $competitorAmount);
    append_auto_bid_event($store, array(
        'quoteId' => $quoteId,
        'providerId' => $providerId,
        'type' => 'floor_reached',
        'amount' => (float) $floor,
        'competitorAmount' => (float) $competitorAmount
    ));
}

function upsert_bid_record(&$store, $normalized) {
    $quoteId = trim((string) ($normalized['quoteId'] ?? ''));
    $providerId = trim((string) ($normalized['providerId'] ?? ''));
    $previous = get_provider_bid_for_quote($store, $quoteId, $providerId);
    if (is_array($previous)) {
        if (trim((string) ($normalized['createdAt'] ?? '')) === '') {
            $normalized['createdAt'] = (string) ($previous['createdAt'] ?? gmdate('c'));
        }
        if (empty($normalized['message']) && !empty($previous['message'])) {
            $normalized['message'] = $previous['message'];
        }
    }

    $providerRecord = find_store_user_by_id($store, $providerId);
    if (is_array($providerRecord)) {
        $displayName = provider_public_name($providerRecord);
        $normalized['providerUsername'] = $displayName;
        $normalized['providerNickname'] = $displayName;
        $normalized['providerName'] = trim((string) ($providerRecord['name'] ?? $displayName));
        if (empty($normalized['providerEmail'])) {
            $normalized['providerEmail'] = trim((string) ($providerRecord['email'] ?? ''));
        }
    }

    if (!isset($store['bids']) || !is_array($store['bids'])) {
        $store['bids'] = array();
    }
    $store['bids'] = array_values(array_filter($store['bids'], function ($existing) use ($quoteId, $providerId) {
        return !(trim((string) ($existing['quoteId'] ?? '')) === $quoteId && trim((string) ($existing['providerId'] ?? '')) === $providerId);
    }));
    $store['bids'][] = $normalized;
    return $normalized;
}

function create_bid_in_store(&$store, $bidInput, $options = array()) {
    $options = is_array($options) ? $options : array();
    $skipAutoBid = !empty($options['skipAutoBid']);
    $skipCustomerNotify = !empty($options['skipCustomerNotify']);

    ensure_store_auto_bid_collections($store);
    process_customer_bid_email_queue($store);

    $normalized = normalize_bid($bidInput);
    $quoteId = trim((string) ($normalized['quoteId'] ?? ''));
    $providerId = trim((string) ($normalized['providerId'] ?? ''));
    if ($quoteId === '' || $providerId === '') {
        return array('ok' => false, 'error' => 'Bid must include a quoteId and providerId.');
    }

    $isAutoBid = ((string) ($normalized['bidSource'] ?? '')) === 'auto';
    $previous = get_provider_bid_for_quote($store, $quoteId, $providerId);
    $previousAmount = is_array($previous) ? bid_amount_value($previous) : 0.0;

    $providerRecord = find_store_user_by_id($store, $providerId);
    if (!is_array($providerRecord)) {
        return array('ok' => false, 'error' => 'Provider not found.');
    }

    if ($isAutoBid) {
        $normalized['autoBidEnabled'] = !empty($previous['autoBidEnabled']);
        $normalized['autoBidFloor'] = (float) ($previous['autoBidFloor'] ?? $normalized['autoBidFloor']);
        $normalized['autoBidIncrement'] = (float) ($previous['autoBidIncrement'] ?? $normalized['autoBidIncrement']);
    }

    upsert_bid_record($store, $normalized);

    $quote = find_store_quote_by_id($store, $quoteId);
    $newAmount = bid_amount_value($normalized);

    if (!$skipCustomerNotify && is_array($quote)) {
        if ($isAutoBid) {
            queue_auto_bid_war_activity($store, $quoteId, $providerId);
        } else {
            $shouldNotifyCustomer = ($previousAmount <= 0) || ($newAmount < $previousAmount);
            if ($shouldNotifyCustomer) {
                notify_customer_manual_bid($store, $quote, $providerRecord, $newAmount);
            }
        }
    }

    if (!$isAutoBid && is_array($quote)) {
        $ownerContext = resolve_quote_owner_context($store, $quote);
        $ownerId = $ownerContext['ownerId'];
        if ($ownerId !== '' && $ownerId !== $providerId) {
            $quoteLabel = $ownerContext['quoteLabel'];
            $providerName = provider_public_name($providerRecord);
            $bidTextParts = array();
            if ($newAmount > 0) {
                $bidTextParts[] = 'Price: €' . number_format($newAmount, 2, '.', '');
            }
            if (!empty($normalized['message'])) {
                $bidTextParts[] = 'Message: ' . trim((string) $normalized['message']);
            }
            $bidText = $bidTextParts ? implode("\n", $bidTextParts) : '(no details)';
            $messageText = "New bid from " . $providerName . " on your listing " . $quoteLabel . ":\n\n" . $bidText;
            $savedMessage = array(
                'id' => make_id('msg'),
                'fromUserId' => $providerId,
                'toUserId' => $ownerId,
                'text' => $messageText,
                'title' => 'New bid on listing ' . $quoteLabel,
                'createdAt' => gmdate('c')
            );
            if (!isset($store['messages']) || !is_array($store['messages'])) {
                $store['messages'] = array();
            }
            array_unshift($store['messages'], $savedMessage);
            $store['messages'] = array_slice($store['messages'], 0, 200);

            if (!isset($store['replyTokens']) || !is_array($store['replyTokens'])) {
                $store['replyTokens'] = array();
            }
            $token = generate_reply_token();
            $store['replyTokens'][$token] = array(
                'fromUserId' => $providerId,
                'toUserId' => $ownerId,
                'messageId' => $savedMessage['id'],
                'quoteId' => $quoteId,
                'bidId' => trim((string) ($normalized['id'] ?? '')),
                'createdAt' => gmdate('c')
            );
        }
    }

    if (!$skipAutoBid) {
        process_auto_bids_for_quote($store, $quoteId, $providerId);
    }

    process_customer_bid_email_queue($store);

    return array('ok' => true, 'bid' => $normalized);
}

function process_auto_bids_for_quote(&$store, $quoteId, $triggeringProviderId) {
    $quoteId = trim((string) $quoteId);
    $triggeringProviderId = trim((string) $triggeringProviderId);
    $quote = find_store_quote_by_id($store, $quoteId);
    if (!is_array($quote)) {
        return;
    }

    $maxRounds = 16;
    for ($round = 0; $round < $maxRounds; $round++) {
        $changed = false;
        $activeBids = get_active_quote_bids($store, $quoteId);
        foreach ($activeBids as $bid) {
            $providerId = trim((string) ($bid['providerId'] ?? ''));
            if ($providerId === '' || $providerId === $triggeringProviderId) {
                continue;
            }
            if (empty($bid['autoBidEnabled'])) {
                continue;
            }
            $provider = find_store_user_by_id($store, $providerId);
            if (!is_array($provider) || !provider_has_auto_bid_subscription($provider)) {
                continue;
            }

            $myAmount = bid_amount_value($bid);
            if ($myAmount <= 0) {
                continue;
            }

            $competitor = get_lowest_competitor_bid_for_provider($activeBids, $providerId);
            if (!is_array($competitor)) {
                continue;
            }
            $competitorAmount = bid_amount_value($competitor);
            if ($competitorAmount <= 0 || $myAmount <= $competitorAmount) {
                continue;
            }

            $increment = (float) ($bid['autoBidIncrement'] ?? 1);
            if ($increment <= 0) {
                $increment = 1;
            }
            $floor = (float) ($bid['autoBidFloor'] ?? 0);
            $targetAmount = round($competitorAmount - $increment, 2);
            if ($targetAmount >= $myAmount) {
                continue;
            }

            if ($targetAmount < $floor) {
                if (empty($bid['autoBidFloorNotified'])) {
                    notify_provider_auto_bid_floor($store, $provider, $quote, $floor, $competitorAmount, trim((string) ($bid['id'] ?? '')));
                    foreach ($store['bids'] as $idx => $storedBid) {
                        if (!is_array($storedBid)) {
                            continue;
                        }
                        if (trim((string) ($storedBid['id'] ?? '')) === trim((string) ($bid['id'] ?? ''))) {
                            $store['bids'][$idx]['autoBidFloorNotified'] = true;
                            break;
                        }
                    }
                }
                continue;
            }

            $autoBid = array_merge($bid, array(
                'amount' => $targetAmount,
                'bidSource' => 'auto',
                'updatedAt' => gmdate('c')
            ));
            $result = create_bid_in_store($store, $autoBid, array(
                'skipAutoBid' => true,
                'skipCustomerNotify' => false
            ));
            if (!empty($result['ok'])) {
                notify_provider_auto_bid_used($store, $provider, $quote, $result['bid'], $targetAmount, $competitorAmount, true);
                append_auto_bid_event($store, array(
                    'quoteId' => $quoteId,
                    'providerId' => $providerId,
                    'type' => 'auto_counter',
                    'amount' => $targetAmount,
                    'competitorAmount' => $competitorAmount,
                    'competitorProviderId' => trim((string) ($competitor['providerId'] ?? '')),
                    'bidId' => trim((string) ($result['bid']['id'] ?? ''))
                ));
                $changed = true;
                $triggeringProviderId = $providerId;
            }
        }
        if (!$changed) {
            break;
        }
        $activeBids = get_active_quote_bids($store, $quoteId);
    }
}

function is_https_request() {
    if (!empty($_SERVER['HTTPS']) && (string) $_SERVER['HTTPS'] !== 'off') {
        return true;
    }
    $xf = isset($_SERVER['HTTP_X_FORWARDED_PROTO']) ? strtolower(trim((string) $_SERVER['HTTP_X_FORWARDED_PROTO'])) : '';
    if ($xf === 'https') {
        return true;
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_SSL']) && (string) $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on') {
        return true;
    }
    return false;
}

function refresh_session_cookie() {
    $cookieNames = array('anytransport_session', 'ANYTRANSPORT_SESSION');
    $token = '';
    foreach ($cookieNames as $cookieName) {
        if (!empty($_COOKIE[$cookieName])) {
            $token = trim((string) $_COOKIE[$cookieName]);
            break;
        }
    }
    if ($token !== '') {
        set_session_cookie($token);
    }
}

function user_can_access_quote_media($store, $sessionUser, $record) {
    if (!is_array($record)) {
        return false;
    }
    $uid = is_array($sessionUser) ? trim((string) ($sessionUser['id'] ?? '')) : '';
    $mediaOwner = trim((string) ($record['userId'] ?? ''));
    if ($uid !== '' && $mediaOwner !== '' && $uid === $mediaOwner) {
        return true;
    }
    if (is_admin_user($sessionUser)) {
        return true;
    }
    if ($uid === '') {
        return false;
    }
    $quoteId = trim((string) ($record['quoteId'] ?? ''));
    if ($quoteId === '') {
        return false;
    }
    $quote = find_quote_by_id($store['quotes'], $quoteId);
    if ($quote === null) {
        return false;
    }
    $ownerId = trim((string) ($quote['userId'] ?? $quote['createdBy'] ?? ''));
    if ($ownerId !== '' && $ownerId === $uid) {
        return true;
    }
    $quoteEmail = strtolower(trim((string) ($quote['customerEmail'] ?? '')));
    $userEmail = strtolower(trim((string) ($sessionUser['email'] ?? '')));
    if ($quoteEmail !== '' && $userEmail !== '' && $quoteEmail === $userEmail) {
        return true;
    }
    foreach ($store['bids'] as $bid) {
        if (!is_array($bid)) {
            continue;
        }
        if (trim((string) ($bid['quoteId'] ?? '')) !== $quoteId) {
            continue;
        }
        if (trim((string) ($bid['providerId'] ?? '')) === $uid) {
            return true;
        }
    }
    return false;
}

function decode_data_url_binary($dataUrl) {
    $dataUrl = trim((string) $dataUrl);
    if ($dataUrl === '' || stripos($dataUrl, 'data:') !== 0) {
        return null;
    }
    $comma = strpos($dataUrl, ',');
    if ($comma === false) {
        return null;
    }
    $meta = substr($dataUrl, 5, $comma - 5);
    $payload = substr($dataUrl, $comma + 1);
    $isBase64 = preg_match('/;base64/i', $meta) === 1;
    $mime = 'application/octet-stream';
    if (preg_match('/^([^;]+)/', $meta, $m)) {
        $mime = trim($m[1]);
    }
    $binary = $isBase64 ? base64_decode($payload, true) : rawurldecode($payload);
    if ($binary === false || $binary === null || $binary === '') {
        return null;
    }
    return array('mime' => $mime, 'binary' => $binary);
}

function extension_from_mime($mime) {
    $mime = strtolower(trim((string) $mime));
    $map = array(
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
        'video/quicktime' => 'mov',
    );
    return isset($map[$mime]) ? $map[$mime] : 'bin';
}

function build_quote_media_url($mediaId) {
    $script = isset($_SERVER['SCRIPT_NAME']) ? (string) $_SERVER['SCRIPT_NAME'] : '/api/index.php';
    return $script . '?action=quotes.media&id=' . rawurlencode($mediaId);
}

function get_request_session_token() {
    $headerToken = trim((string) ($_SERVER['HTTP_X_ANYTRANSPORT_SESSION'] ?? ''));
    if ($headerToken !== '') {
        return $headerToken;
    }
    $queryToken = trim((string) ($_GET['session'] ?? ''));
    if ($queryToken !== '') {
        return $queryToken;
    }
    $cookieNames = array('anytransport_session', 'ANYTRANSPORT_SESSION');
    foreach ($cookieNames as $cookieName) {
        if (!empty($_COOKIE[$cookieName])) {
            return trim((string) $_COOKIE[$cookieName]);
        }
    }
    return '';
}

function get_session_user($store) {
    $token = get_request_session_token();
    if ($token === '') {
        return null;
    }

    foreach ($store['sessions'] as $session) {
        if (!is_array($session)) {
            continue;
        }
        if (trim((string) ($session['token'] ?? '')) !== $token) {
            continue;
        }
        $userId = trim((string) ($session['userId'] ?? ''));
        if ($userId === '') {
            continue;
        }

        foreach ($store['users'] as $user) {
            if (trim((string) ($user['id'] ?? '')) === $userId) {
                return $user;
            }
        }
    }

    return null;
}

function set_session_cookie($token) {
    $secure = is_https_request();
    setcookie('anytransport_session', $token, array(
        'expires' => time() + 60 * 60 * 24 * 30,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax'
    ));
}

function clear_session_cookie() {
    $secure = is_https_request();
    setcookie('anytransport_session', '', array(
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax'
    ));
}

function find_user_index($users, $predicate) {
    foreach ($users as $index => $user) {
        if ($predicate($user)) {
            return $index;
        }
    }
    return -1;
}

function get_current_user_record($store) {
    return get_session_user($store);
}

function is_admin_user($user) {
    if (!is_array($user)) {
        return false;
    }

    $roles = isset($user['roles']) && is_array($user['roles']) ? $user['roles'] : array($user['role'] ?? '');
    foreach ($roles as $role) {
        if (strtolower(trim((string) $role)) === 'admin') {
            return true;
        }
    }

    return false;
}

$selected = choose_richest_store($preferredStoreFile, $storeFile);
$store = $selected['store'];
if (!empty($selected['file']) && $selected['file'] !== $storeFile) {
    @file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | store_read_selected source={$selected['file']} active={$storeFile} score=" . (string) ($selected['score'] ?? -1) . "\n", FILE_APPEND | LOCK_EX);
    // Keep reads and writes on the same physical store file for this request.
    // Otherwise data can be read from one file but persisted to another.
    $storeFile = $selected['file'];
}
$input = read_json_input();

switch ($action) {
    case 'auth.me':
        ensure_store_auto_bid_collections($store);
        $queueBefore = json_encode($store['customerBidEmailQueue']);
        process_customer_bid_email_queue($store);
        if (json_encode($store['customerBidEmailQueue']) !== $queueBefore) {
            write_store($storeFile, $store);
        }
        $user = get_session_user($store);
        if (is_array($user)) {
            $userId = trim((string) ($user['id'] ?? ''));
            $role = strtolower(trim((string) ($user['role'] ?? '')));
            if ($userId !== '' && $role === 'provider') {
                $syncResult = sync_stripe_account_status($store, $userId);
                if (is_array($syncResult['user'])) {
                    $user = $syncResult['user'];
                }
                write_store($storeFile, $store);
            }
            refresh_session_cookie();
        }
        send_json(array('ok' => true, 'user' => is_array($user) ? sanitize_user_for_client($user) : null));

    case 'auth.logout':
        $headerToken = trim((string) ($_SERVER['HTTP_X_ANYTRANSPORT_SESSION'] ?? ''));
        $token = $headerToken !== '' ? $headerToken : get_request_session_token();
        if ($token !== '') {
            $store['sessions'] = array_values(array_filter($store['sessions'], function ($session) use ($token) {
                return trim((string) ($session['token'] ?? '')) !== $token;
            }));
            write_store($storeFile, $store);
        }
        // Only clear the shared cookie when logout itself was cookie-based.
        // If the request used a tab-scoped header token, keep cookie untouched
        // so other tabs are not forced out.
        if ($headerToken === '') {
            clear_session_cookie();
        }
        send_json(array('ok' => true));

    case 'auth.password.forgot':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $email = trim((string) ($input['email'] ?? ''));
        $resetContext = strtolower(trim((string) ($input['resetContext'] ?? 'customer')));
        if (!in_array($resetContext, array('customer', 'provider'), true)) {
            $resetContext = 'customer';
        }
        $isProviderReset = $resetContext === 'provider';
        $customerGeneric = array(
            'ok' => true,
            'message' => 'If that email is registered, we sent a password reset link.'
        );
        $providerNotRegisteredError = 'No verified transport provider account was found with this email. Password reset is only available for verified, registered providers.';
        $providerWrongRoleError = 'This email is not registered as a transport provider. Use the main forgot password for customer accounts.';
        $providerNotVerifiedError = 'This provider account is not verified yet. Complete admin verification before you can reset your password.';

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            if ($isProviderReset) {
                send_json(array('ok' => false, 'error' => $providerNotRegisteredError), 400);
            }
            send_json($customerGeneric);
        }
        $userIndex = find_user_index_by_email($store['users'], $email);
        if ($userIndex < 0) {
            file_put_contents(__DIR__ . '/email.log', gmdate('c') . ' | password_reset_request email=' . $email . ' context=' . $resetContext . ' found=0' . "\n", FILE_APPEND | LOCK_EX);
            if ($isProviderReset) {
                send_json(array('ok' => false, 'error' => $providerNotRegisteredError), 404);
            }
            send_json($customerGeneric);
        }
        $resetUser = normalize_user($store['users'][$userIndex]);
        $resetUserIsProvider = is_provider_account($resetUser);
        $resetUserIsAdmin = is_admin_user($resetUser);
        if ($isProviderReset) {
            if (!$resetUserIsProvider) {
                file_put_contents(__DIR__ . '/email.log', gmdate('c') . ' | password_reset_request email=' . $email . ' context=provider found=1 role_mismatch=1' . "\n", FILE_APPEND | LOCK_EX);
                send_json(array('ok' => false, 'error' => $providerWrongRoleError), 403);
            }
            if (!is_verified_provider_account($resetUser)) {
                file_put_contents(__DIR__ . '/email.log', gmdate('c') . ' | password_reset_request email=' . $email . ' context=provider found=1 verified=0' . "\n", FILE_APPEND | LOCK_EX);
                send_json(array('ok' => false, 'error' => $providerNotVerifiedError), 403);
            }
        } elseif ($resetUserIsProvider && !$resetUserIsAdmin) {
            file_put_contents(__DIR__ . '/email.log', gmdate('c') . ' | password_reset_request email=' . $email . ' context=customer found=1 provider_only=1' . "\n", FILE_APPEND | LOCK_EX);
            send_json($customerGeneric);
        }
        $token = issue_password_reset_for_user($store, $userIndex);
        if ($token === '') {
            file_put_contents(__DIR__ . '/email.log', gmdate('c') . ' | password_reset_request email=' . $email . ' found=1 token=0' . "\n", FILE_APPEND | LOCK_EX);
            if ($isProviderReset) {
                send_json(array('ok' => false, 'error' => 'Unable to start a password reset right now. Please try again shortly.'), 500);
            }
            send_json($customerGeneric);
        }
        $store['users'][$userIndex] = normalize_user($store['users'][$userIndex]);
        write_store($storeFile, $store);
        $resetUrl = get_password_reset_url($token);
        $emailed = send_password_reset_email($store['users'][$userIndex], $resetUrl);
        file_put_contents(
            __DIR__ . '/email.log',
            gmdate('c') . ' | password_reset_request email=' . $email . ' context=' . $resetContext . ' found=1 emailed=' . ($emailed ? '1' : '0') . "\n",
            FILE_APPEND | LOCK_EX
        );
        if ($isProviderReset) {
            if (!$emailed) {
                send_json(array('ok' => false, 'error' => 'We could not send the reset email. Please try again shortly.'), 500);
            }
            send_json(array(
                'ok' => true,
                'message' => 'We sent a password reset link to your verified provider email.'
            ));
        }
        send_json($customerGeneric);

    case 'auth.password.reset.validate':
        $token = trim((string) ($_GET['token'] ?? ''));
        if ($token === '') {
            send_json(array('ok' => false, 'valid' => false, 'error' => 'Reset link is missing or invalid.'), 400);
        }
        $userIndex = find_user_index_by_password_reset_token($store['users'], $token);
        if ($userIndex < 0) {
            send_json(array('ok' => false, 'valid' => false, 'error' => 'This reset link is invalid or has already been used.'), 404);
        }
        $user = normalize_user($store['users'][$userIndex]);
        if (!password_reset_token_is_valid($user)) {
            send_json(array('ok' => false, 'valid' => false, 'error' => 'This reset link has expired. Request a new one from the login page.'), 410);
        }
        send_json(array('ok' => true, 'valid' => true));

    case 'auth.password.reset':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $token = trim((string) ($input['token'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        if ($token === '') {
            send_json(array('ok' => false, 'error' => 'Reset link is missing or invalid.'), 400);
        }
        if (strlen($password) < 6) {
            send_json(array('ok' => false, 'error' => 'Password must be at least 6 characters.'), 400);
        }
        $userIndex = find_user_index_by_password_reset_token($store['users'], $token);
        if ($userIndex < 0) {
            send_json(array('ok' => false, 'error' => 'This reset link is invalid or has already been used.'), 404);
        }
        $user = normalize_user($store['users'][$userIndex]);
        if (!password_reset_token_is_valid($user)) {
            send_json(array('ok' => false, 'error' => 'This reset link has expired. Request a new one from the login page.'), 410);
        }
        $userId = trim((string) ($user['id'] ?? ''));
        $store['users'][$userIndex]['password'] = $password;
        clear_password_reset_for_user($store, $userIndex);
        $store['users'][$userIndex] = normalize_user($store['users'][$userIndex]);
        revoke_sessions_for_user($store, $userId);
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'message' => 'Your password has been updated. You can log in now.'));

    case 'auth.login':
        $email = trim((string) ($input['email'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        if ($email === '' || $password === '') {
            send_json(array('ok' => false, 'error' => 'Email and password are required.'), 400);
        }
        // Development-only admin shortcut (enable with ANYTRANSPORT_ALLOW_DEV_ADMIN_LOGIN=1).
        $allowDevAdmin = get_env_value('ANYTRANSPORT_ALLOW_DEV_ADMIN_LOGIN', '') === '1';
        if ($allowDevAdmin && $password === 'Admin123!') {
            $adminIndex = -1;
            foreach ($store['users'] as $i => $u) {
                $role = strtolower(trim((string) ($u['role'] ?? '')));
                $roles = isset($u['roles']) && is_array($u['roles']) ? $u['roles'] : array();
                if ($role === 'admin' || in_array('admin', $roles, true)) {
                    $adminIndex = $i;
                    break;
                }
            }

            if ($adminIndex >= 0) {
                $user = normalize_user($store['users'][$adminIndex]);
                $store['users'][$adminIndex] = $user;
            } else {
                // create a default admin user
                $user = normalize_user(array(
                    'id' => make_id('user'),
                    'name' => 'Site Admin',
                    'username' => 'admin',
                    'nickname' => 'admin',
                    'email' => 'admin@example.com',
                    'password' => $password,
                    'role' => 'admin',
                    'roles' => array('admin')
                ));
                $store['users'][] = $user;
            }
        } else {
            $normalizedEmail = strtolower($email);
            $userIndex = find_user_index($store['users'], function ($user) use ($normalizedEmail, $password) {
                return strtolower(trim((string) ($user['email'] ?? ''))) === $normalizedEmail
                    && (string) ($user['password'] ?? '') === $password;
            });

            if ($userIndex >= 0) {
                $user = normalize_user($store['users'][$userIndex]);
                $store['users'][$userIndex] = $user;
            } else {
                send_json(array('ok' => false, 'error' => 'Invalid email or password.'), 401);
            }
        }

        $loginContext = strtolower(trim((string) ($input['loginContext'] ?? 'customer')));
        if (!in_array($loginContext, array('customer', 'provider'), true)) {
            $loginContext = 'customer';
        }
        $userIsProvider = is_provider_account($user);
        $userIsAdmin = is_admin_user($user);
        if ($loginContext === 'provider') {
            if (!$userIsProvider) {
                send_json(array('ok' => false, 'error' => 'This login is for transport providers only. Use the main login for customer accounts.'), 403);
            }
        } elseif ($userIsProvider && !$userIsAdmin) {
            send_json(array('ok' => false, 'error' => 'Transport providers must log in using Driver Login at the bottom of the page.'), 403);
        }

        $token = make_id('sess');
        $store['sessions'][] = array(
            'token' => $token,
            'userId' => $user['id'],
            'createdAt' => gmdate('c')
        );
        write_store($storeFile, $store);
        set_session_cookie($token);
        send_json(array('ok' => true, 'user' => sanitize_user_for_client($user), 'sessionToken' => $token));

    case 'auth.signup':
        $formData = is_array($input['formData'] ?? null) ? $input['formData'] : array();
        $email = trim((string) ($formData['email'] ?? ''));
        $password = (string) ($formData['password'] ?? '');
        $name = trim((string) ($formData['name'] ?? ''));
        $requestedUsername = trim((string) ($formData['username'] ?? ($formData['nickname'] ?? $name)));
        $role = trim((string) ($formData['role'] ?? 'customer')) ?: 'customer';

        if ($email === '' || $password === '' || $name === '' || $requestedUsername === '') {
            send_json(array('ok' => false, 'error' => 'Missing required account fields.'), 400);
        }

        $normalizedEmail = strtolower($email);
        $requestedRole = strtolower($role);
        $existingByEmailIndex = -1;
        foreach ($store['users'] as $existingIndex => $existingUser) {
            if (strtolower(trim((string) ($existingUser['email'] ?? ''))) === $normalizedEmail) {
                $existingByEmailIndex = $existingIndex;
                continue;
            }
            $existingUsername = strtolower(trim((string) ($existingUser['username'] ?? '')));
            $existingNickname = strtolower(trim((string) ($existingUser['nickname'] ?? '')));
            $wantedUsername = strtolower($requestedUsername);
            if ($existingUsername === $wantedUsername || $existingNickname === $wantedUsername) {
                send_json(array('ok' => false, 'error' => 'That username is already in use. Please choose another one.'), 409);
            }
        }

        if ($existingByEmailIndex >= 0) {
            $existingByEmail = normalize_user($store['users'][$existingByEmailIndex]);
            $existingRole = strtolower(trim((string) ($existingByEmail['role'] ?? '')));
            $existingStatus = strtolower(trim((string) ($existingByEmail['identityReviewStatus'] ?? '')));
            $isProviderReapply = ($requestedRole === 'provider' && $existingRole === 'provider' && $existingStatus === 'rejected');

            if (!$isProviderReapply) {
                send_json(array('ok' => false, 'error' => 'An account with this email already exists. Please log in instead.'), 409);
            }

            foreach ($store['users'] as $idx => $otherUser) {
                if (!is_array($otherUser) || $idx === $existingByEmailIndex) {
                    continue;
                }
                if (strtolower(trim((string) ($otherUser['username'] ?? ''))) === strtolower($requestedUsername)) {
                    send_json(array('ok' => false, 'error' => 'That username is already in use. Please choose another one.'), 409);
                }
            }

            $reappliedProvider = normalize_user(array_merge($existingByEmail, array(
                'name' => $name,
                'username' => $requestedUsername,
                'nickname' => $requestedUsername,
                'role' => 'provider',
                'roles' => array('provider'),
                'password' => $password,
                'phone' => (string) ($formData['phone'] ?? $formData['contact'] ?? $existingByEmail['phone'] ?? ''),
                'contact' => (string) ($formData['contact'] ?? $formData['phone'] ?? $existingByEmail['contact'] ?? ''),
                'city' => (string) ($formData['city'] ?? $existingByEmail['city'] ?? ''),
                'identityPhotos' => is_array($formData['identityPhotos'] ?? null) ? array_values($formData['identityPhotos']) : ($existingByEmail['identityPhotos'] ?? array()),
                'identityReviewStatus' => 'pending_review',
                'identityReviewSubmittedAt' => gmdate('c'),
                'identityReviewedAt' => '',
                'identityReviewedBy' => '',
                'identityReviewNotes' => '',
                'verified' => false
            )));
            $store['users'][$existingByEmailIndex] = $reappliedProvider;

            $token = make_id('sess');
            $store['sessions'][] = array(
                'token' => $token,
                'userId' => $reappliedProvider['id'],
                'createdAt' => gmdate('c')
            );
            write_store($storeFile, $store);
            set_session_cookie($token);

            try {
                send_provider_review_email($reappliedProvider, 'pending_review', '');
            } catch (Exception $_e) {
                // swallow email errors
            }
            try {
                send_admin_provider_verification_queue_email(
                    $store,
                    $reappliedProvider,
                    'Provider re-applied after rejection',
                    array('A previously rejected provider signed up again and needs verification review.')
                );
            } catch (Exception $_e) {
                // swallow email errors
            }

            $stripeVerification = array('ok' => false, 'emailed' => false, 'complete' => false);
            try {
                $stripeVerification = begin_provider_stripe_verification($store, $storeFile, trim((string) ($reappliedProvider['id'] ?? '')), 'dashboard.html', true);
                if (!empty($stripeVerification['user']) && is_array($stripeVerification['user'])) {
                    $reappliedProvider = $stripeVerification['user'];
                }
            } catch (Exception $_e) {
                $stripeVerification = array('ok' => false, 'error' => 'Stripe verification email could not be sent.', 'emailed' => false);
            }

            $signupPhotos = is_array($formData['identityPhotos'] ?? null) ? $formData['identityPhotos'] : array();
            if (!empty($signupPhotos)) {
                $photoResult = process_provider_identity_photo_payloads($store, $storeFile, trim((string) ($reappliedProvider['id'] ?? '')), $signupPhotos);
                if (!empty($photoResult['user']) && is_array($photoResult['user'])) {
                    $reappliedProvider = $photoResult['user'];
                }
            }

            send_json(array(
                'ok' => true,
                'user' => sanitize_user_for_client($reappliedProvider),
                'sessionToken' => $token,
                'stripeVerification' => $stripeVerification
            ));
        }

        $user = normalize_user(array(
            'id' => make_id('user'),
            'name' => $name,
            'username' => $requestedUsername,
            'nickname' => $requestedUsername,
            'email' => $email,
            'password' => $password,
            'phone' => (string) ($formData['phone'] ?? $formData['contact'] ?? ''),
            'contact' => (string) ($formData['contact'] ?? $formData['phone'] ?? ''),
            'city' => (string) ($formData['city'] ?? ''),
            'role' => $role,
            'roles' => array(strtolower($role) === 'provider' ? 'provider' : 'customer'),
            'identityPhotos' => is_array($formData['identityPhotos'] ?? null) ? array_values($formData['identityPhotos']) : array(),
            'identityReviewStatus' => strtolower($role) === 'provider' ? 'pending_review' : 'not_required',
            'identityReviewSubmittedAt' => strtolower($role) === 'provider' ? gmdate('c') : '',
            'identityReviewedAt' => '',
            'identityReviewedBy' => '',
            'identityReviewNotes' => ''
        ));

        $store['users'][] = $user;
        $token = make_id('sess');
        $store['sessions'][] = array(
            'token' => $token,
            'userId' => $user['id'],
            'createdAt' => gmdate('c')
        );
        write_store($storeFile, $store);
        set_session_cookie($token);

        $stripeVerification = array('ok' => false, 'emailed' => false, 'complete' => false);
        if (strtolower($role) === 'provider') {
            try {
                $stripeVerification = begin_provider_stripe_verification($store, $storeFile, trim((string) ($user['id'] ?? '')), 'dashboard.html', true);
                if (!empty($stripeVerification['user']) && is_array($stripeVerification['user'])) {
                    $user = $stripeVerification['user'];
                }
            } catch (Exception $_e) {
                $stripeVerification = array('ok' => false, 'error' => 'Stripe verification email could not be sent.', 'emailed' => false);
            }

            $signupPhotos = is_array($formData['identityPhotos'] ?? null) ? $formData['identityPhotos'] : array();
            if (!empty($signupPhotos)) {
                $photoResult = process_provider_identity_photo_payloads($store, $storeFile, trim((string) ($user['id'] ?? '')), $signupPhotos);
                if (!empty($photoResult['user']) && is_array($photoResult['user'])) {
                    $user = $photoResult['user'];
                }
            }

            if (empty($signupPhotos)) {
                try {
                    send_admin_provider_verification_queue_email(
                        $store,
                        $user,
                        'New provider registered',
                        array('A new transport provider account was created and may need identity verification review.')
                    );
                } catch (Exception $_e) {
                    // swallow email errors
                }
            }
        } else {
            try {
                send_customer_welcome_email($user);
            } catch (Exception $_e) {
                // swallow email errors
            }
        }

        send_json(array(
            'ok' => true,
            'user' => sanitize_user_for_client($user),
            'sessionToken' => $token,
            'stripeVerification' => $stripeVerification
        ));

    case 'users.get':
        $targetId = trim((string) ($_GET['id'] ?? ''));
        if ($targetId === '') {
            send_json(array('ok' => false, 'error' => 'User id is required.'), 400);
        }
        $found = null;
        foreach ($store['users'] as $u) {
            if (!is_array($u)) {
                continue;
            }
            if (trim((string) ($u['id'] ?? '')) === $targetId) {
                $found = $u;
                break;
            }
        }
        if ($found === null) {
            send_json(array('ok' => false, 'error' => 'User not found.'), 404);
        }
        $currentUser = get_current_user_record($store);
        $currentUserId = is_array($currentUser) ? trim((string) ($currentUser['id'] ?? '')) : '';
        $canViewProfileDraft = $currentUserId !== '' && ($currentUserId === $targetId || is_admin_user($currentUser));
        $userOut = sanitize_user_for_client(normalize_user($found));
        if (!$canViewProfileDraft) {
            unset($userOut['profileChangePending']);
            unset($userOut['profileChangeReviewNotes']);
        }
        send_json(array('ok' => true, 'user' => $userOut));

    case 'users.list':
        $currentUser = get_current_user_record($store);
        $currentUserId = is_array($currentUser) ? trim((string) ($currentUser['id'] ?? '')) : '';
        if ($currentUserId === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        if (is_admin_user($currentUser)) {
            send_json(array('ok' => true, 'users' => sanitize_users_for_client(array_values($store['users']))));
        }
        $self = null;
        foreach ($store['users'] as $u) {
            if (is_array($u) && trim((string) ($u['id'] ?? '')) === $currentUserId) {
                $self = $u;
                break;
            }
        }
        if ($self === null) {
            send_json(array('ok' => true, 'users' => array()));
        }
        send_json(array('ok' => true, 'users' => array(sanitize_user_for_client(normalize_user($self)))));

    case 'users.replaceAll':
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }
        $incoming = is_array($input['users'] ?? null) ? $input['users'] : array();
        $normalizedUsers = array();
        foreach ($incoming as $user) {
            if (!is_array($user)) {
                continue;
            }
            $normalizedUsers[] = normalize_user($user);
        }
        $store['users'] = $normalizedUsers;
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'users' => sanitize_users_for_client(array_values($store['users']))));

    case 'users.upsert':
        $user = is_array($input['user'] ?? null) ? $input['user'] : array();
        if (get_env_value('ANYTRANSPORT_DEBUG_UPSERT_LOG', '') === '1') {
            @file_put_contents(__DIR__ . '/debug-users-upsert.log', gmdate('c') . " | incoming user: " . json_encode($user, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
            @file_put_contents(__DIR__ . '/debug-users-upsert.log', gmdate('c') . " | full input: " . json_encode($input, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
        }
        $targetId = trim((string) ($user['id'] ?? ''));
        $targetIndex = $targetId !== '' ? find_user_index_by_id($store['users'], $targetId) : -1;
        $existingUser = $targetIndex >= 0 ? normalize_user($store['users'][$targetIndex]) : array();
        $currentUser = get_current_user_record($store);
        $isAdmin = is_admin_user($currentUser);
        $currentUserId = is_array($currentUser) ? trim((string) ($currentUser['id'] ?? '')) : '';

        if (!$isAdmin && $currentUserId !== '' && $targetId !== '' && $targetId !== $currentUserId) {
            send_json(array('ok' => false, 'error' => 'You can only edit your own profile.'), 403);
        }

        if (!$isAdmin && $currentUserId !== '' && $targetId === $currentUserId) {
            $allowedFields = array(
                'businessName', 'name', 'nickname', 'username',
                'city', 'town', 'location', 'phone', 'contact',
                'description', 'businessDescription', 'about', 'bio', 'summary',
                'services', 'categories', 'skills', 'photos', 'avatar', 'coverImage',
                'transportModes', 'vehicleCount',
                'website', 'companyType', 'paymentMethods', 'paymentMethodsCustom', 'acceptsCash', 'paypal', 'visa', 'mastercard', 'bankTransfer', 'americanExpress', 'cheque', 'cash',
                'blockInvites', 'muteInviteEmails',
                'serviceAreaCity', 'serviceAreaAddress', 'serviceAreaLat', 'serviceAreaLng',
                'showExactAddressOnMap',
                'autoBidSubscriptionEnabled',
                'instagram', 'facebook', 'x', 'twitter', 'tiktok', 'linkedin'
            );
            $sanitized = array();
            foreach ($allowedFields as $field) {
                if (array_key_exists($field, $user)) {
                    $sanitized[$field] = $user[$field];
                }
            }
            $sanitized['id'] = $currentUserId;
            $sanitized['email'] = $existingUser['email'] ?? ($currentUser['email'] ?? '');
            $sanitized['role'] = $existingUser['role'] ?? ($currentUser['role'] ?? 'provider');
            $sanitized['roles'] = $existingUser['roles'] ?? ($currentUser['roles'] ?? array());
            $sanitized['password'] = $existingUser['password'] ?? ($currentUser['password'] ?? '');
            $sanitized['verified'] = $existingUser['verified'] ?? ($currentUser['verified'] ?? false);
            $sanitized['identityReviewStatus'] = $existingUser['identityReviewStatus'] ?? ($currentUser['identityReviewStatus'] ?? 'pending_review');
            $sanitized['identityReviewSubmittedAt'] = $existingUser['identityReviewSubmittedAt'] ?? ($currentUser['identityReviewSubmittedAt'] ?? '');
            $sanitized['identityReviewedAt'] = $existingUser['identityReviewedAt'] ?? ($currentUser['identityReviewedAt'] ?? '');
            $sanitized['identityReviewedBy'] = $existingUser['identityReviewedBy'] ?? ($currentUser['identityReviewedBy'] ?? '');
            $sanitized['identityReviewNotes'] = $existingUser['identityReviewNotes'] ?? ($currentUser['identityReviewNotes'] ?? '');
            $normalized = normalize_user(array_merge($existingUser, $sanitized));
        } else {
            $normalized = normalize_user(array_merge($existingUser, $user));
        }

        if (
            !$isAdmin
            && $currentUserId !== ''
            && $targetIndex >= 0
            && $targetId === $currentUserId
            && is_provider_account($existingUser)
        ) {
            $proposedSlice = extract_provider_profile_slice($normalized);
            $liveSlice = extract_provider_profile_slice($existingUser);
            if (provider_profile_slices_equal($existingUser, $normalized)) {
                $queuedUser = normalize_user($store['users'][$targetIndex]);
                send_json(array(
                    'ok' => true,
                    'user' => sanitize_user_for_client($queuedUser),
                    'pendingReview' => strtolower(trim((string) ($queuedUser['profileChangeStatus'] ?? ''))) === 'pending_review',
                    'message' => strtolower(trim((string) ($queuedUser['profileChangeStatus'] ?? ''))) === 'pending_review'
                        ? 'Your changes are already awaiting admin review.'
                        : 'No profile changes to submit.'
                ));
            }

            $store['users'][$targetIndex]['profileChangePending'] = $proposedSlice;
            $store['users'][$targetIndex]['profileChangeStatus'] = 'pending_review';
            $store['users'][$targetIndex]['profileChangeSubmittedAt'] = gmdate('c');
            $store['users'][$targetIndex]['profileChangeReviewedAt'] = '';
            $store['users'][$targetIndex]['profileChangeReviewedBy'] = '';
            $store['users'][$targetIndex]['profileChangeReviewNotes'] = '';
            $queuedUser = normalize_user($store['users'][$targetIndex]);
            $store['users'][$targetIndex] = $queuedUser;
            write_store($storeFile, $store);

            $summaryLines = build_provider_profile_change_summary($liveSlice, $proposedSlice);
            send_admin_provider_profile_change_email($store, $queuedUser, $summaryLines);

            send_json(array(
                'ok' => true,
                'user' => sanitize_user_for_client($queuedUser),
                'pendingReview' => true,
                'message' => 'Your changes were submitted for admin review. You will receive an email once they are approved or declined.'
            ));
        }

        $targetId = trim((string) ($normalized['id'] ?? ''));
        $targetEmail = strtolower(trim((string) ($normalized['email'] ?? '')));
        $targetUsername = strtolower(trim((string) ($normalized['username'] ?? '')));

        $index = find_user_index($store['users'], function ($existing) use ($targetId, $targetEmail) {
            if ($targetId !== '' && trim((string) ($existing['id'] ?? '')) === $targetId) {
                return true;
            }
            return $targetEmail !== '' && strtolower(trim((string) ($existing['email'] ?? ''))) === $targetEmail;
        });

        foreach ($store['users'] as $existingIndex => $existingUser) {
            if ($existingIndex === $index) {
                continue;
            }
            if ($targetEmail !== '' && strtolower(trim((string) ($existingUser['email'] ?? ''))) === $targetEmail) {
                send_json(array('ok' => false, 'error' => 'An account with this email already exists.'), 409);
            }
            if ($targetUsername !== '' && strtolower(trim((string) ($existingUser['username'] ?? ''))) === $targetUsername) {
                send_json(array('ok' => false, 'error' => 'That username is already in use.'), 409);
            }
        }

        if ($index >= 0) {
            $store['users'][$index] = array_merge($store['users'][$index], $normalized);
        } else {
            $store['users'][] = $normalized;
        }
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'user' => sanitize_user_for_client($normalized)));

    case 'users.account.update':
        $currentUser = get_current_user_record($store);
        if (!is_array($currentUser) || trim((string) ($currentUser['id'] ?? '')) === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }

        $currentUserId = trim((string) ($currentUser['id'] ?? ''));
        $userIndex = find_user_index_by_id($store['users'], $currentUserId);
        if ($userIndex < 0) {
            send_json(array('ok' => false, 'error' => 'User not found.'), 404);
        }

        $existingUser = normalize_user($store['users'][$userIndex]);
        $name = trim((string) ($input['name'] ?? $existingUser['name'] ?? ''));
        $username = trim((string) ($input['username'] ?? $existingUser['username'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? $existingUser['email'] ?? '')));
        $currentPassword = (string) ($input['currentPassword'] ?? '');
        $newPassword = (string) ($input['newPassword'] ?? '');

        if ($name === '' || $username === '' || $email === '') {
            send_json(array('ok' => false, 'error' => 'Name, username, and email are required.'), 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            send_json(array('ok' => false, 'error' => 'Please provide a valid email address.'), 400);
        }

        $emailChanged = strtolower(trim((string) ($existingUser['email'] ?? ''))) !== $email;
        $passwordChanged = trim((string) $newPassword) !== '';

        if ($emailChanged || $passwordChanged) {
            $savedPassword = (string) ($existingUser['password'] ?? '');
            if ($savedPassword === '' || $currentPassword === '' || $savedPassword !== $currentPassword) {
                send_json(array('ok' => false, 'error' => 'Current password is required to change email or password.'), 403);
            }
        }

        foreach ($store['users'] as $idx => $u) {
            if (!is_array($u) || $idx === $userIndex) {
                continue;
            }
            if (strtolower(trim((string) ($u['email'] ?? ''))) === $email) {
                send_json(array('ok' => false, 'error' => 'An account with this email already exists.'), 409);
            }
            if (strtolower(trim((string) ($u['username'] ?? ''))) === strtolower($username)) {
                send_json(array('ok' => false, 'error' => 'That username is already in use.'), 409);
            }
        }

        $updates = array(
            'name' => $name,
            'username' => $username,
            'nickname' => $username,
            'email' => $email
        );
        if ($passwordChanged) {
            $updates['password'] = $newPassword;
        }

        $store['users'][$userIndex] = normalize_user(array_merge($existingUser, $updates));
        $updatedUser = $store['users'][$userIndex];
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'user' => sanitize_user_for_client($updatedUser)));

    case 'identity.review.queue':
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }

        $queue = array_values(array_filter($store['users'], function ($user) {
            $role = strtolower(trim((string) ($user['role'] ?? '')));
            if ($role !== 'provider') {
                return false;
            }
            $status = strtolower(trim((string) ($user['identityReviewStatus'] ?? '')));
            if ($status === 'approved') {
                return false;
            }
            return in_array($status, array('pending_review', 'pending', ''), true);
        }));

        send_json(array('ok' => true, 'providers' => sanitize_users_for_client($queue)));

    case 'identity.review.update':
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }

        $providerId = trim((string) ($input['providerId'] ?? ''));
        $status = trim((string) ($input['status'] ?? ''));
        $notes = trim((string) ($input['notes'] ?? ''));
        if ($providerId === '' || !in_array($status, array('approved', 'rejected', 'pending_review'), true)) {
            send_json(array('ok' => false, 'error' => 'Provider ID and a valid review status are required.'), 400);
        }
        if ($status === 'rejected' && trim((string) $notes) === '') {
            send_json(array('ok' => false, 'error' => 'A rejection note is required when declining a provider.'), 400);
        }

        $index = find_user_index_by_id($store['users'], $providerId);
        if ($index < 0) {
            send_json(array('ok' => false, 'error' => 'Provider not found.'), 404);
        }

        $provider = normalize_user($store['users'][$index]);
        if (trim((string) ($provider['role'] ?? '')) !== 'provider') {
            send_json(array('ok' => false, 'error' => 'This user is not a provider.'), 400);
        }

        $store['users'][$index] = array_merge($store['users'][$index], array(
            'identityReviewStatus' => $status,
            'identityReviewedAt' => gmdate('c'),
            'identityReviewedBy' => trim((string) ($currentUser['id'] ?? '')),
            'identityReviewNotes' => $notes
        ));

        if ($status === 'approved') {
            if (!provider_stripe_onboarding_is_complete($provider)) {
                send_json(array('ok' => false, 'error' => 'Provider must complete Stripe identity verification before admin approval.'), 400);
            }
            $store['users'][$index]['verified'] = true;
            $store['users'][$index]['verifiedAt'] = gmdate('c');
        } elseif ($status === 'rejected') {
            $store['users'][$index]['verified'] = false;
        }

        $updatedProvider = normalize_user($store['users'][$index]);
        $store['users'][$index] = $updatedProvider;
        write_store($storeFile, $store);

        $stripeVerification = null;
        if ($status === 'rejected') {
            $reverify = require_provider_identity_reverification($store, $storeFile, $providerId, $notes, trim((string) ($currentUser['id'] ?? '')));
            if (!empty($reverify['provider']) && is_array($reverify['provider'])) {
                $updatedProvider = $reverify['provider'];
            }
            $stripeVerification = isset($reverify['stripeVerification']) ? $reverify['stripeVerification'] : null;
        }

        send_json_and_continue(array(
            'ok' => true,
            'provider' => sanitize_user_for_client($updatedProvider),
            'stripeVerification' => $stripeVerification
        ));

        if (in_array($status, array('approved', 'rejected', 'pending_review'), true)) {
            try {
                send_provider_review_email($updatedProvider, $status, $notes);
            } catch (Exception $_e) {
                // swallow email errors
            }
        }

        exit;

    case 'provider.profile.review.queue':
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }

        $queue = array_values(array_filter($store['users'], function ($user) {
            if (!is_array($user) || !is_provider_account($user)) {
                return false;
            }
            return strtolower(trim((string) ($user['profileChangeStatus'] ?? ''))) === 'pending_review';
        }));

        send_json(array('ok' => true, 'providers' => sanitize_users_for_client($queue)));

    case 'provider.profile.review.update':
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }

        $providerId = trim((string) ($input['providerId'] ?? ''));
        $status = strtolower(trim((string) ($input['status'] ?? '')));
        $notes = trim((string) ($input['notes'] ?? ''));
        if ($providerId === '' || !in_array($status, array('approved', 'rejected'), true)) {
            send_json(array('ok' => false, 'error' => 'Provider ID and a valid review status are required.'), 400);
        }
        if ($status === 'rejected' && $notes === '') {
            send_json(array('ok' => false, 'error' => 'A reason is required when declining profile changes.'), 400);
        }

        $index = find_user_index_by_id($store['users'], $providerId);
        if ($index < 0) {
            send_json(array('ok' => false, 'error' => 'Provider not found.'), 404);
        }

        $provider = normalize_user($store['users'][$index]);
        if (!is_provider_account($provider)) {
            send_json(array('ok' => false, 'error' => 'This user is not a provider.'), 400);
        }
        if (strtolower(trim((string) ($provider['profileChangeStatus'] ?? ''))) !== 'pending_review') {
            send_json(array('ok' => false, 'error' => 'This provider has no profile changes awaiting review.'), 400);
        }

        $pending = isset($provider['profileChangePending']) && is_array($provider['profileChangePending'])
            ? $provider['profileChangePending']
            : array();
        if ($status === 'approved') {
            if (!$pending) {
                send_json(array('ok' => false, 'error' => 'No pending profile changes were found for this provider.'), 400);
            }
            $store['users'][$index] = array_merge($store['users'][$index], $pending);
            $store['users'][$index]['profileChangePending'] = array();
            $store['users'][$index]['profileChangeStatus'] = 'none';
        } else {
            $store['users'][$index]['profileChangePending'] = array();
            $store['users'][$index]['profileChangeStatus'] = 'rejected';
        }

        $store['users'][$index]['profileChangeReviewedAt'] = gmdate('c');
        $store['users'][$index]['profileChangeReviewedBy'] = trim((string) ($currentUser['id'] ?? ''));
        $store['users'][$index]['profileChangeReviewNotes'] = $notes;
        $updatedProvider = normalize_user($store['users'][$index]);
        $store['users'][$index] = $updatedProvider;
        write_store($storeFile, $store);

        send_json_and_continue(array(
            'ok' => true,
            'provider' => sanitize_user_for_client($updatedProvider)
        ));

        try {
            send_provider_profile_change_decision_email($updatedProvider, $status, $notes);
        } catch (Exception $_e) {
            // swallow email errors
        }

        exit;

    case 'identity.photos.upload':
        $userId = trim((string) ($input['userId'] ?? ''));
        $photos = is_array($input['photos'] ?? null) ? $input['photos'] : array();
        if ($userId === '' || empty($photos)) {
            send_json(array('ok' => false, 'error' => 'userId and photos array are required.'), 400);
        }

        $userIndex = find_user_index_by_id($store['users'], $userId);
        if ($userIndex < 0) {
            send_json(array('ok' => false, 'error' => 'User not found.'), 404);
        }

        $currentUser = get_current_user_record($store);
        $currentUserId = is_array($currentUser) ? trim((string) ($currentUser['id'] ?? '')) : '';
        $canEditIdentity = is_admin_user($currentUser) || ($currentUserId !== '' && $currentUserId === $userId);
        if (!$canEditIdentity) {
            send_json(array('ok' => false, 'error' => 'You can only upload identity photos for your own account.'), 403);
        }

        $result = process_provider_identity_photo_payloads($store, $storeFile, $userId, $photos);
        $updated = isset($result['user']) && is_array($result['user']) ? $result['user'] : null;
        if ($updated === null) {
            send_json(array('ok' => false, 'error' => (string) ($result['error'] ?? 'Unable to upload identity photos.')), 500);
        }

        $wasRejected = strtolower(trim((string) ($store['users'][$userIndex]['identityReviewStatus'] ?? ''))) === 'rejected';
        if ($wasRejected && !empty($result['uploaded'])) {
            try {
                send_provider_review_email($updated, 'pending_review', '');
            } catch (Exception $_e) {
                // swallow email errors
            }
        }

        send_json(array('ok' => true, 'uploaded' => $result['uploaded'], 'user' => sanitize_user_for_client($updated)));

    case 'quotes.list':
        $currentUser = get_current_user_record($store);
        $currentUserId = is_array($currentUser) ? trim((string) ($currentUser['id'] ?? '')) : '';
        $isAdmin = is_admin_user($currentUser);
        $isProvider = strtolower(trim((string) ($currentUser['role'] ?? ''))) === 'provider';
        if ($isProvider && !provider_can_access_marketplace($currentUser)) {
            send_json(array('ok' => true, 'quotes' => array(), 'marketplaceLocked' => true));
        }
        if (!$isAdmin) {
            if ($currentUserId === '') {
                send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
            }
            // Providers need visibility of open marketplace forms, not only self-owned forms.
            $userId = $isProvider ? '' : $currentUserId;
        } else {
            $userId = trim((string) ($_GET['userId'] ?? ''));
        }
        refresh_session_cookie();
        $quotes = array_values($store['quotes']);
        if ($userId !== '') {
            if ($isAdmin) {
                $quotes = array_values(array_filter($quotes, function ($quote) use ($userId) {
                    return trim((string) ($quote['userId'] ?? $quote['createdBy'] ?? '')) === $userId
                        || trim((string) ($quote['createdBy'] ?? '')) === $userId;
                }));
            } else {
                $userEmailNorm = strtolower(trim((string) ($currentUser['email'] ?? '')));
                $quotes = array_values(array_filter($quotes, function ($quote) use ($userId, $userEmailNorm) {
                    $ownerId = trim((string) ($quote['userId'] ?? $quote['createdBy'] ?? ''));
                    if ($ownerId === $userId) {
                        return true;
                    }
                    if ($userEmailNorm !== '') {
                        $quoteEmail = strtolower(trim((string) ($quote['customerEmail'] ?? '')));
                        if ($quoteEmail !== '' && $quoteEmail === $userEmailNorm) {
                            return true;
                        }
                    }
                    return false;
                }));
            }
        }
        $quotes = array_map(function ($quote) use ($store) {
            return attach_quote_media($store, $quote);
        }, $quotes);
        send_json(array('ok' => true, 'quotes' => $quotes));

    case 'quotes.get':
        $quoteId = trim((string) ($_GET['id'] ?? ''));
        $formId = trim((string) ($_GET['formId'] ?? ''));
        if ($quoteId === '' && $formId === '') {
            send_json(array('ok' => false, 'error' => 'Quote id or listing ID is required.'), 400);
        }
        $found = null;
        foreach ($store['quotes'] as $quote) {
            if (!is_array($quote)) {
                continue;
            }
            $idMatch = ($quoteId !== '' && trim((string) ($quote['id'] ?? '')) === $quoteId);
            $formMatch = ($formId !== '' && trim((string) ($quote['formId'] ?? '')) === $formId);
            if ($idMatch || $formMatch) {
                $found = $quote;
                break;
            }
        }
        if ($found === null) {
            send_json(array('ok' => false, 'error' => 'Quote not found.'), 404);
        }
        $currentUser = get_current_user_record($store);
        $currentUserId = is_array($currentUser) ? trim((string) ($currentUser['id'] ?? '')) : '';
        $ownerId = trim((string) ($found['userId'] ?? $found['createdBy'] ?? ''));
        $isProvider = strtolower(trim((string) ($currentUser['role'] ?? ''))) === 'provider';
        if ($isProvider && !provider_can_access_marketplace($currentUser)) {
            send_json(array('ok' => false, 'error' => provider_marketplace_access_error()), 403);
        }
        if (!is_admin_user($currentUser) && !$isProvider) {
            if ($currentUserId === '') {
                send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
            }
            $ownerMatch = ($ownerId !== '' && $ownerId === $currentUserId);
            $quoteEmail = strtolower(trim((string) ($found['customerEmail'] ?? '')));
            $userEmail = strtolower(trim((string) ($currentUser['email'] ?? '')));
            $emailMatch = !$ownerMatch && $ownerId === '' && $quoteEmail !== '' && $userEmail !== '' && $quoteEmail === $userEmail;
            if (!$ownerMatch && !$emailMatch) {
                send_json(array('ok' => false, 'error' => 'You do not have access to this quote.'), 403);
            }
        }
        $found = attach_quote_media($store, $found);
        refresh_session_cookie();
        send_json(array('ok' => true, 'quote' => $found));

    case 'quotes.delete':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $sessionUser = get_current_user_record($store);
        if (!is_array($sessionUser) || trim((string) ($sessionUser['id'] ?? '')) === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $quoteId = trim((string) ($input['quoteId'] ?? $input['id'] ?? ''));
        if ($quoteId === '') {
            send_json(array('ok' => false, 'error' => 'Quote id is required.'), 400);
        }

        $quoteIndex = find_user_index($store['quotes'], function ($quote) use ($quoteId) {
            return trim((string) ($quote['id'] ?? '')) === $quoteId;
        });
        if ($quoteIndex < 0) {
            send_json(array('ok' => false, 'error' => 'Quote not found.'), 404);
        }

        $quote = is_array($store['quotes'][$quoteIndex]) ? $store['quotes'][$quoteIndex] : array();
        $isAdmin = is_admin_user($sessionUser);
        $currentUserId = trim((string) ($sessionUser['id'] ?? ''));
        $ownerId = trim((string) ($quote['userId'] ?? $quote['createdBy'] ?? ''));
        $ownerMatch = ($ownerId !== '' && $ownerId === $currentUserId);
        $quoteEmail = strtolower(trim((string) ($quote['customerEmail'] ?? '')));
        $userEmail = strtolower(trim((string) ($sessionUser['email'] ?? '')));
        $emailMatch = !$ownerMatch && $ownerId === '' && $quoteEmail !== '' && $userEmail !== '' && $quoteEmail === $userEmail;
        if (!$isAdmin && !$ownerMatch && !$emailMatch) {
            send_json(array('ok' => false, 'error' => 'You can only delete your own quote.'), 403);
        }

        $adminDeleteReason = trim((string) ($input['reason'] ?? ''));
        if ($isAdmin && $adminDeleteReason !== '') {
            send_admin_listing_owner_email($store, $quote, $adminDeleteReason, 'removed');
        }

        array_splice($store['quotes'], $quoteIndex, 1);
        $store['bids'] = array_values(array_filter($store['bids'], function ($bid) use ($quoteId) {
            return trim((string) ($bid['quoteId'] ?? '')) !== $quoteId;
        }));

        if (!isset($store['quoteMedia']) || !is_array($store['quoteMedia'])) {
            $store['quoteMedia'] = array();
        }
        $remainingMedia = array();
        foreach ($store['quoteMedia'] as $media) {
            if (!is_array($media)) {
                continue;
            }
            if (trim((string) ($media['quoteId'] ?? '')) === $quoteId) {
                $rel = trim((string) ($media['relativePath'] ?? ''));
                if ($rel !== '') {
                    $full = $storeDir . '/' . $rel;
                    if (is_file($full)) {
                        @unlink($full);
                    }
                }
                continue;
            }
            $remainingMedia[] = $media;
        }
        $store['quoteMedia'] = array_values($remainingMedia);

        if (isset($store['formReports']) && is_array($store['formReports'])) {
            $store['formReports'] = array_values(array_filter($store['formReports'], function ($report) use ($quoteId) {
                return trim((string) ($report['quoteId'] ?? '')) !== $quoteId;
            }));
        }
        clear_auto_bid_war_queue($store, $quoteId);
        ensure_store_auto_bid_collections($store);
        foreach (array_keys($store['customerBidEmailQueue']) as $queueKey) {
            if (strpos((string) $queueKey, $quoteId . ':') === 0) {
                unset($store['customerBidEmailQueue'][$queueKey]);
            }
        }

        write_store($storeFile, $store);
        refresh_session_cookie();
        send_json(array('ok' => true, 'deletedQuoteId' => $quoteId));

    case 'quotes.uploadMedia':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $sessionUser = get_current_user_record($store);
        if (!is_array($sessionUser) || trim((string) ($sessionUser['id'] ?? '')) === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $userId = trim((string) $sessionUser['id']);
        $dataUrl = (string) ($input['dataUrl'] ?? '');
        $quoteId = trim((string) ($input['quoteId'] ?? ''));
        $decoded = decode_data_url_binary($dataUrl);
        if ($decoded === null) {
            send_json(array('ok' => false, 'error' => 'Invalid media data. Expected a data URL.'), 400);
        }
        $maxBytes = 15 * 1024 * 1024;
        if (strlen($decoded['binary']) > $maxBytes) {
            send_json(array('ok' => false, 'error' => 'File too large (max 15 MB).'), 413);
        }
        $ext = extension_from_mime($decoded['mime']);
        $mediaId = make_id('media');
        $relative = 'quote-media/' . $userId . '/' . $mediaId . '.' . $ext;
        $fullPath = $storeDir . '/' . $relative;
        $dir = dirname($fullPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        if (@file_put_contents($fullPath, $decoded['binary'], LOCK_EX) === false) {
            send_json(array('ok' => false, 'error' => 'Unable to save file.'), 500);
        }
        if (!isset($store['quoteMedia']) || !is_array($store['quoteMedia'])) {
            $store['quoteMedia'] = array();
        }
        $store['quoteMedia'][] = array(
            'id' => $mediaId,
            'userId' => $userId,
            'quoteId' => $quoteId,
            'relativePath' => $relative,
            'mimeType' => $decoded['mime'],
            'createdAt' => gmdate('c')
        );
        write_store($storeFile, $store);
        $mediaUrl = build_quote_media_url($mediaId);
        refresh_session_cookie();
        send_json(array(
            'ok' => true,
            'media' => array(
                'id' => $mediaId,
                'url' => $mediaUrl,
                'mimeType' => $decoded['mime']
            )
        ));

    case 'quotes.media':
        $mediaId = trim((string) ($_GET['id'] ?? ''));
        if ($mediaId === '') {
            send_json(array('ok' => false, 'error' => 'Missing media id.'), 400);
        }
        $record = null;
        foreach ($store['quoteMedia'] ?? array() as $m) {
            if (!is_array($m)) {
                continue;
            }
            if (trim((string) ($m['id'] ?? '')) === $mediaId) {
                $record = $m;
                break;
            }
        }
        if ($record === null) {
            send_json(array('ok' => false, 'error' => 'Not found.'), 404);
        }
        $sessionUser = get_current_user_record($store);
        if (!user_can_access_quote_media($store, $sessionUser, $record)) {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $rel = trim((string) ($record['relativePath'] ?? ''));
        $fullPath = $rel !== '' ? ($storeDir . '/' . $rel) : '';
        if ($fullPath === '' || !is_file($fullPath)) {
            send_json(array('ok' => false, 'error' => 'File missing.'), 404);
        }
        $mime = trim((string) ($record['mimeType'] ?? ''));
        if ($mime === '') {
            $mime = 'application/octet-stream';
        }
        header('Content-Type: ' . $mime, true);
        header('Cache-Control: private, max-age=3600', true);
        header('X-Content-Type-Options: nosniff', true);
        readfile($fullPath);
        exit;

    case 'quotes.create':
        $quote = is_array($input['quote'] ?? null) ? $input['quote'] : array();
        $normalized = normalize_quote($quote, $store['quotes']);
        $sessionUser = get_current_user_record($store);
        $index = find_user_index($store['quotes'], function ($existing) use ($normalized) {
            return trim((string) ($existing['id'] ?? '')) === trim((string) ($normalized['id'] ?? ''));
        });
        $isQuoteUpdate = $index >= 0;
        $previousQuote = $isQuoteUpdate ? $store['quotes'][$index] : null;
        if ($isQuoteUpdate) {
            $merged = array_merge($store['quotes'][$index], $normalized);
            if (isset($store['quotes'][$index]['createdAt'])) {
                $merged['createdAt'] = $store['quotes'][$index]['createdAt'];
            }
            $store['quotes'][$index] = $merged;
            $normalized = $store['quotes'][$index];
        } else {
            $store['quotes'][] = $normalized;
        }
        apply_quote_ownership_on_save($store, $sessionUser, $normalized, $input, $isQuoteUpdate, $previousQuote);
        if ($isQuoteUpdate) {
            $store['quotes'][$index] = $normalized;
        } else {
            $store['quotes'][count($store['quotes']) - 1] = $normalized;
        }

        if ($isQuoteUpdate && is_array($previousQuote) && session_user_owns_quote($sessionUser, $previousQuote)) {
            notify_providers_quote_updated($store, $previousQuote, $normalized);
        }

        write_store($storeFile, $store);

        // Send form submission / update confirmation email to the customer when possible.
        $customerEmail = strtolower(trim((string) ($normalized['customerEmail'] ?? '')));
        if ($customerEmail === '' && is_array($sessionUser)) {
            $customerEmail = strtolower(trim((string) ($sessionUser['email'] ?? '')));
        }
        if ($customerEmail !== '') {
            $customerName = trim((string) ($normalized['customerName'] ?? ''));
            if ($customerName === '' && is_array($sessionUser)) {
                $sessionEmail = strtolower(trim((string) ($sessionUser['email'] ?? '')));
                $quoteOwnerEmail = strtolower(trim((string) ($normalized['customerEmail'] ?? '')));
                $sessionOwnsQuote = ($sessionEmail !== '' && $quoteOwnerEmail !== '' && $sessionEmail === $quoteOwnerEmail)
                    || session_user_owns_quote($sessionUser, $normalized);
                if (!is_admin_user($sessionUser) || $sessionOwnsQuote) {
                    $customerName = trim((string) ($sessionUser['name'] ?? $sessionUser['username'] ?? ''));
                }
            }
            if ($customerName === '') {
                $customerName = 'there';
            }
            $formReference = trim((string) ($normalized['formId'] ?? $normalized['id'] ?? ''));
            if ($isQuoteUpdate) {
                $subject = 'Your request was updated';
                $body = "Hi " . $customerName . ",\n\n";
                $body .= "Your listing has been updated successfully.\n";
            } else {
                $subject = 'We received your request';
                $body = "Hi " . $customerName . ",\n\n";
                $body .= "Your listing has been submitted successfully.\n";
            }
            if ($formReference !== '') {
                $body .= "Reference: " . $formReference . "\n";
            }
            $body .= "\nYou can view updates in your dashboard:\n";
            $body .= get_app_url('customer-dashboard.html') . "\n\n";
            $body .= "This inbox is not monitored. Please use your dashboard/messages for updates.\n\n";
            $body .= "Regards,\nAnyTransport";
            send_email_simple($customerEmail, $subject, $body);
        }

        refresh_session_cookie();
        send_json(array('ok' => true, 'quote' => $normalized));

    case 'quotes.admin.duplicate':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }

        $sourceQuoteId = trim((string) ($input['sourceQuoteId'] ?? $input['quoteId'] ?? ''));
        if ($sourceQuoteId === '') {
            send_json(array('ok' => false, 'error' => 'Source listing id is required.'), 400);
        }

        $ownerUserId = trim((string) ($input['ownerUserId'] ?? ''));
        $ownerEmail = trim((string) ($input['ownerEmail'] ?? ''));
        $result = duplicate_quote_for_admin($store, $storeFile, $storeDir, $sourceQuoteId, $ownerUserId, $ownerEmail, $currentUser);
        if (empty($result['ok'])) {
            send_json(array('ok' => false, 'error' => (string) ($result['error'] ?? 'Unable to duplicate listing.')), 400);
        }

        refresh_session_cookie();
        send_json(array(
            'ok' => true,
            'quote' => attach_quote_media($store, $result['quote'])
        ));

    case 'quotes.admin.notify':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }

        $quoteId = trim((string) ($input['quoteId'] ?? ''));
        $reason = trim((string) ($input['reason'] ?? ''));
        if ($quoteId === '') {
            send_json(array('ok' => false, 'error' => 'Quote ID is required.'), 400);
        }

        $quote = find_store_quote_by_id($store, $quoteId);
        if (!is_array($quote)) {
            send_json(array('ok' => false, 'error' => 'Quote not found.'), 404);
        }

        $recipient = resolve_listing_owner_recipient($store, $quote);
        $to = trim((string) ($recipient['email'] ?? ''));
        if ($to === '') {
            send_json(array('ok' => false, 'error' => 'No email address found for this listing owner.'), 400);
        }

        $sent = false;
        try {
            $sent = send_admin_listing_owner_email($store, $quote, $reason, 'notify');
        } catch (Exception $_e) {
            $sent = false;
        }
        send_json(array('ok' => true, 'sent' => !!$sent, 'email' => $to, 'quoteId' => $quoteId));

    case 'reports.create':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $sessionUser = get_current_user_record($store);
        if (!is_array($sessionUser) || trim((string) ($sessionUser['id'] ?? '')) === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $role = strtolower(trim((string) ($sessionUser['role'] ?? '')));
        if ($role !== 'provider' && !is_admin_user($sessionUser)) {
            send_json(array('ok' => false, 'error' => 'Only providers can report listings.'), 403);
        }
        $quoteId = trim((string) ($input['quoteId'] ?? ''));
        $reason = trim((string) ($input['reason'] ?? ''));
        $details = trim((string) ($input['details'] ?? ''));
        if ($quoteId === '' || $reason === '') {
            send_json(array('ok' => false, 'error' => 'quoteId and reason are required.'), 400);
        }
        $quote = find_quote_by_id($store['quotes'], $quoteId);
        if (!is_array($quote)) {
            send_json(array('ok' => false, 'error' => 'Listing not found.'), 404);
        }
        if (!isset($store['formReports']) || !is_array($store['formReports'])) {
            $store['formReports'] = array();
        }
        $report = array(
            'id' => make_id('report'),
            'quoteId' => $quoteId,
            'formId' => trim((string) ($quote['formId'] ?? '')),
            'reportedByUserId' => trim((string) ($sessionUser['id'] ?? '')),
            'reportedByEmail' => trim((string) ($sessionUser['email'] ?? '')),
            'reason' => $reason,
            'details' => $details,
            'status' => 'open',
            'createdAt' => gmdate('c'),
            'updatedAt' => gmdate('c'),
            'resolvedAt' => '',
            'resolvedBy' => ''
        );
        array_unshift($store['formReports'], $report);
        $store['formReports'] = array_slice($store['formReports'], 0, 500);
        write_store($storeFile, $store);
        try {
            send_admin_listing_report_email($store, $report, $quote, $sessionUser);
        } catch (Exception $_e) {
            // swallow email errors
        }
        send_json(array('ok' => true, 'report' => $report));

    case 'reports.list':
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }
        $status = strtolower(trim((string) ($_GET['status'] ?? '')));
        $reports = array_values(isset($store['formReports']) && is_array($store['formReports']) ? $store['formReports'] : array());
        if ($status !== '') {
            $reports = array_values(array_filter($reports, function ($report) use ($status) {
                return strtolower(trim((string) ($report['status'] ?? 'open'))) === $status;
            }));
        }
        send_json(array('ok' => true, 'reports' => $reports));

    case 'reports.update':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }
        $reportId = trim((string) ($input['reportId'] ?? ''));
        $status = strtolower(trim((string) ($input['status'] ?? '')));
        if ($reportId === '' || !in_array($status, array('open', 'resolved'), true)) {
            send_json(array('ok' => false, 'error' => 'reportId and valid status are required.'), 400);
        }
        if (!isset($store['formReports']) || !is_array($store['formReports'])) {
            $store['formReports'] = array();
        }
        $updated = null;
        foreach ($store['formReports'] as $idx => $report) {
            if (!is_array($report)) continue;
            if (trim((string) ($report['id'] ?? '')) !== $reportId) continue;
            $store['formReports'][$idx]['status'] = $status;
            $store['formReports'][$idx]['updatedAt'] = gmdate('c');
            if ($status === 'resolved') {
                $store['formReports'][$idx]['resolvedAt'] = gmdate('c');
                $store['formReports'][$idx]['resolvedBy'] = trim((string) ($currentUser['id'] ?? ''));
            } else {
                $store['formReports'][$idx]['resolvedAt'] = '';
                $store['formReports'][$idx]['resolvedBy'] = '';
            }
            $updated = $store['formReports'][$idx];
            break;
        }
        if (!is_array($updated)) {
            send_json(array('ok' => false, 'error' => 'Report not found.'), 404);
        }
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'report' => $updated));

    case 'bids.list':
        process_customer_bid_email_queue($store);
        $quoteId = trim((string) ($_GET['quoteId'] ?? ''));
        $bids = array_values($store['bids']);
        if ($quoteId !== '') {
            $bids = array_values(array_filter($bids, function ($bid) use ($quoteId) {
                return trim((string) ($bid['quoteId'] ?? '')) === $quoteId;
            }));
        }
        send_json(array('ok' => true, 'bids' => $bids));

    case 'autobid.events.list':
        $currentUser = get_current_user_record($store);
        $currentUserId = is_array($currentUser) ? trim((string) ($currentUser['id'] ?? '')) : '';
        if ($currentUserId === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        ensure_store_auto_bid_collections($store);
        $quoteIdFilter = trim((string) ($_GET['quoteId'] ?? ''));
        $events = array_values(array_filter($store['autoBidEvents'], function ($event) use ($currentUserId, $quoteIdFilter) {
            if (!is_array($event)) {
                return false;
            }
            if (trim((string) ($event['providerId'] ?? '')) !== $currentUserId) {
                return false;
            }
            if ($quoteIdFilter !== '' && trim((string) ($event['quoteId'] ?? '')) !== $quoteIdFilter) {
                return false;
            }
            return true;
        }));
        usort($events, function ($a, $b) {
            $aTime = strtotime((string) ($a['createdAt'] ?? '')) ?: 0;
            $bTime = strtotime((string) ($b['createdAt'] ?? '')) ?: 0;
            return $bTime <=> $aTime;
        });
        send_json(array('ok' => true, 'events' => array_slice($events, 0, 200)));

    case 'bids.create':
        $bid = is_array($input['bid'] ?? null) ? $input['bid'] : array();
        $providerId = trim((string) ($bid['providerId'] ?? ''));
        $currentUser = get_current_user_record($store);
        if (is_array($currentUser) && strtolower(trim((string) ($currentUser['role'] ?? ''))) === 'provider') {
            if (!provider_can_access_marketplace($currentUser)) {
                send_json(array('ok' => false, 'error' => provider_marketplace_access_error()), 403);
            }
        }
        if (!empty($bid['autoBidEnabled'])) {
            $floor = (float) ($bid['autoBidFloor'] ?? 0);
            $increment = (float) ($bid['autoBidIncrement'] ?? 0);
            $amount = (float) ($bid['amount'] ?? 0);
            if ($floor <= 0) {
                send_json(array('ok' => false, 'error' => 'Auto-bid requires a minimum price (floor).'), 400);
            }
            if ($increment <= 0) {
                send_json(array('ok' => false, 'error' => 'Auto-bid requires a bid increment greater than zero.'), 400);
            }
            if ($amount > 0 && $floor >= $amount) {
                send_json(array('ok' => false, 'error' => 'Auto-bid floor must be lower than your quote amount.'), 400);
            }
        }
        $result = create_bid_in_store($store, $bid);
        if (empty($result['ok'])) {
            send_json(array('ok' => false, 'error' => (string) ($result['error'] ?? 'Unable to save bid.')), 400);
        }
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'bid' => $result['bid']));

    case 'bids.replaceAll':
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }
        $incoming = is_array($input['bids'] ?? null) ? $input['bids'] : array();
        $normalizedBids = array();
        foreach ($incoming as $bid) {
            if (!is_array($bid)) {
                continue;
            }
            $normalizedBids[] = normalize_bid($bid);
        }
        $store['bids'] = $normalizedBids;
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'bids' => array_values($store['bids'])));

    case 'messages.list':
        $currentUser = get_current_user_record($store);
        $currentUserId = is_array($currentUser) ? trim((string) ($currentUser['id'] ?? '')) : '';
        $userId = trim((string) ($_GET['userId'] ?? ''));
        $participantA = trim((string) ($_GET['participantA'] ?? ''));
        $participantB = trim((string) ($_GET['participantB'] ?? ''));
        $messages = array_values($store['messages']);

        if ($participantA !== '' && $participantB !== '') {
            if (!is_admin_user($currentUser)) {
                if ($currentUserId === '' || ($currentUserId !== $participantA && $currentUserId !== $participantB)) {
                    send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
                }
            }
            $messages = array_values(array_filter($messages, function ($m) use ($participantA, $participantB) {
                $from = trim((string) ($m['fromUserId'] ?? ''));
                $to = trim((string) ($m['toUserId'] ?? ''));
                return ($from === $participantA && $to === $participantB) || ($from === $participantB && $to === $participantA);
            }));
        } else if ($userId !== '') {
            if (!is_admin_user($currentUser)) {
                if ($currentUserId === '' || $currentUserId !== $userId) {
                    send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
                }
            }
            $messages = array_values(array_filter($messages, function ($m) use ($userId) {
                $from = trim((string) ($m['fromUserId'] ?? ''));
                $to = trim((string) ($m['toUserId'] ?? ''));
                return $from === $userId || $to === $userId;
            }));
        } else {
            send_json(array('ok' => false, 'error' => 'Specify userId or participantA and participantB.'), 400);
        }

        send_json(array('ok' => true, 'messages' => $messages));

    case 'messages.replyContext':
        $currentUser = get_current_user_record($store);
        $currentUserId = is_array($currentUser) ? trim((string) ($currentUser['id'] ?? '')) : '';
        if ($currentUserId === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $token = trim((string) ($_GET['token'] ?? ''));
        if ($token === '') {
            send_json(array('ok' => false, 'error' => 'Reply token is required.'), 400);
        }
        $mapping = isset($store['replyTokens'][$token]) && is_array($store['replyTokens'][$token]) ? $store['replyTokens'][$token] : null;
        if ($mapping === null) {
            send_json(array('ok' => false, 'error' => 'Reply token not found.'), 404);
        }
        $fromUserId = trim((string) ($mapping['fromUserId'] ?? ''));
        $toUserId = trim((string) ($mapping['toUserId'] ?? ''));
        $isParticipant = ($currentUserId !== '' && ($currentUserId === $fromUserId || $currentUserId === $toUserId));
        if (!$isParticipant && !is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'You do not have access to this message link.'), 403);
        }

        $conversationPeerId = $fromUserId;
        if ($currentUserId === $fromUserId && $toUserId !== '') {
            $conversationPeerId = $toUserId;
        }
        if ($conversationPeerId === '' || $conversationPeerId === $currentUserId) {
            send_json(array('ok' => false, 'error' => 'Could not resolve conversation participants.'), 422);
        }

        send_json(array(
            'ok' => true,
            'context' => array(
                'toUserId' => $conversationPeerId,
                'quoteId' => trim((string) ($mapping['quoteId'] ?? '')),
                'bidId' => trim((string) ($mapping['bidId'] ?? '')),
                'messageId' => trim((string) ($mapping['messageId'] ?? ''))
            )
        ));

    case 'messages.save':
        // Newer message format supports sender and recipient
        $sessionUser = get_current_user_record($store);
        if (!is_array($sessionUser) || trim((string) ($sessionUser['id'] ?? '')) === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $fromUserId = trim((string) $sessionUser['id']);
        $message = is_array($input['message'] ?? null) ? $input['message'] : array();
        $toUserId = trim((string) ($message['toUserId'] ?? ''));
        $text = trim((string) ($message['text'] ?? ''));

        if ($toUserId === '' || $text === '') {
            send_json(array('ok' => false, 'error' => 'Message must include toUserId and text.'), 400);
        }
        $messageTitle = trim((string) ($message['title'] ?? ''));
        if (message_contains_contact_details($text) || message_contains_contact_details($messageTitle)) {
            send_json(array('ok' => false, 'error' => 'Contact details are not allowed in customer/provider messages.'), 422);
        }

        $savedMessage = array(
            'id' => !empty($message['id']) ? (string) $message['id'] : make_id('msg'),
            'fromUserId' => $fromUserId,
            'toUserId' => $toUserId,
            'text' => $text,
            'title' => $messageTitle !== '' ? $messageTitle : mb_substr($text, 0, 50),
            'createdAt' => !empty($message['createdAt']) ? (string) $message['createdAt'] : gmdate('c')
        );

        // Prepend to messages store
        array_unshift($store['messages'], $savedMessage);
        // Keep recent 200 messages to avoid uncontrolled growth
        $store['messages'] = array_slice($store['messages'], 0, 200);

        $senderName = user_display_name($sessionUser, 'A user');
        $previewText = $text;
        if (function_exists('mb_strlen') && mb_strlen($previewText) > 120) {
            $previewText = mb_substr($previewText, 0, 117) . '...';
        } elseif (strlen($previewText) > 120) {
            $previewText = substr($previewText, 0, 117) . '...';
        }

        // Add in-app notification for recipient that deep-links to messages thread.
        $store['notifications'][] = array(
            'id' => make_id('ntf'),
            'userId' => $toUserId,
            'title' => 'Message from ' . $senderName,
            'message' => $previewText !== '' ? $previewText : 'New message',
            'type' => 'message_received',
            'read' => false,
            'createdAt' => gmdate('c'),
            'data' => array(
                'fromUserId' => $fromUserId,
                'fromUserName' => $senderName,
                'toUserId' => $toUserId,
                'quoteId' => trim((string) ($message['quoteId'] ?? '')),
                'bidId' => trim((string) ($message['bidId'] ?? ''))
            )
        );

        // Create a reply token mapping so recipients can reply by email
        $token = generate_reply_token();
        $store['replyTokens'][$token] = array(
            'fromUserId' => $fromUserId,
            'toUserId' => $toUserId,
            'messageId' => $savedMessage['id'],
            'quoteId' => trim((string) ($message['quoteId'] ?? '')),
            'bidId' => trim((string) ($message['bidId'] ?? '')),
            'createdAt' => gmdate('c')
        );

        // Send email notification to recipient if they have an email
        $recipient = null;
        foreach ($store['users'] as $u) {
            if (trim((string) ($u['id'] ?? '')) === $toUserId) {
                $recipient = $u;
                break;
            }
        }

        if ($recipient && !empty($recipient['email'])) {
            $subject = 'New message from ' . $senderName;
            $body = "You have received a new message from " . $senderName . " on AnyTransport.\n\n";
            if ($messageTitle !== '') {
                $body .= "Subject: " . $messageTitle . "\n\n";
            }
            $body .= $text . "\n\n";
            $body .= "View and respond in your dashboard: " . get_app_url('messages.html?reply=' . rawurlencode($token)) . "\n";
            $body .= "This inbox is not monitored. Please use the link above to reply.\n";
            send_email_simple($recipient['email'], $subject, $body);
        }

        write_store($storeFile, $store);
        send_json(array('ok' => true, 'message' => $savedMessage, 'replyToken' => $token));

    case 'messages.delete':
        $sessionUser = get_current_user_record($store);
        $sessionId = is_array($sessionUser) ? trim((string) ($sessionUser['id'] ?? '')) : '';
        if ($sessionId === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $messageId = trim((string) ($input['messageId'] ?? ''));
        if ($messageId === '') {
            send_json(array('ok' => false, 'error' => 'Message id is required.'), 400);
        }

        $found = null;
        foreach ($store['messages'] as $m) {
            if (is_array($m) && trim((string) ($m['id'] ?? '')) === $messageId) {
                $found = $m;
                break;
            }
        }
        if ($found === null) {
            send_json(array('ok' => false, 'error' => 'Message not found.'), 404);
        }
        $from = trim((string) ($found['fromUserId'] ?? ''));
        $to = trim((string) ($found['toUserId'] ?? ''));
        if (!is_admin_user($sessionUser) && $sessionId !== $from && $sessionId !== $to) {
            send_json(array('ok' => false, 'error' => 'Forbidden.'), 403);
        }

        $store['messages'] = array_values(array_filter($store['messages'], function ($message) use ($messageId) {
            return trim((string) ($message['id'] ?? '')) !== $messageId;
        }));
        write_store($storeFile, $store);
        send_json(array('ok' => true));

    case 'inbound.email':
        // Accepts webhook POST from an inbound email provider with fields: from, to, subject, text
        $fromEmail = trim((string) ($input['from'] ?? ''));
        $to = trim((string) ($input['to'] ?? ''));
        $subject = trim((string) ($input['subject'] ?? ''));
        $text = trim((string) ($input['text'] ?? ''));

        if ($fromEmail === '' || $to === '' || $text === '') {
            send_json(array('ok' => false, 'error' => 'Missing inbound email fields.'), 400);
        }
        if (message_contains_contact_details($text) || message_contains_contact_details($subject)) {
            send_json(array('ok' => false, 'error' => 'Contact details are not allowed in customer/provider messages.'), 422);
        }

        // extract token from to address (reply+TOKEN@domain)
        $token = '';
        if (preg_match('/reply\+([0-9a-fA-F]+)@/', $to, $m)) {
            $token = $m[1];
        }

        if ($token === '' || !isset($store['replyTokens'][$token])) {
            send_json(array('ok' => false, 'error' => 'Reply token not found.'), 404);
        }

        $mapping = $store['replyTokens'][$token];
        // Resolve sender user by email if possible, otherwise leave as external
        $fromUser = find_user_by_email($store['users'], $fromEmail);
        $fromUserId = $fromUser ? $fromUser['id'] : '';
        // The mapping indicates original fromUser -> toUser; invert for reply
        $toUserId = trim((string) ($mapping['fromUserId'] ?? ''));
        $savedMessage = array(
            'id' => make_id('msg'),
            'fromUserId' => $fromUserId ?: 'external:' . $fromEmail,
            'toUserId' => $toUserId,
            'text' => $text,
            'title' => $subject ?: mb_substr($text, 0, 50),
            'createdAt' => gmdate('c')
        );

        array_unshift($store['messages'], $savedMessage);
        $store['messages'] = array_slice($store['messages'], 0, 200);
        write_store($storeFile, $store);

        // Optionally notify recipient via email that a reply was received
        $recipient = null;
        foreach ($store['users'] as $u) {
            if (trim((string) ($u['id'] ?? '')) === $toUserId) {
                $recipient = $u;
                break;
            }
        }
        if ($recipient && !empty($recipient['email'])) {
            $replySenderName = is_array($fromUser)
                ? user_display_name($fromUser, $fromEmail)
                : $fromEmail;
            $subject = 'Reply from ' . $replySenderName;
            $body = "You received a reply from " . $replySenderName . " on AnyTransport.\n\n";
            $body .= $text . "\n\n";
            $body .= "View messages: " . get_app_url('messages.html') . "\n";
            send_email_simple($recipient['email'], $subject, $body);
        }

        send_json(array('ok' => true, 'message' => $savedMessage));

    case 'email.test':
        // POST: JSON body. GET: only if EMAIL_TEST_TOKEN is set in api/stripe-config.php (helps when Nginx returns 405 on POST during SMTP setup).
        $to = '';
        $subject = '';
        $body = '';
        if ($method === 'GET') {
            $expected = get_env_value('EMAIL_TEST_TOKEN', '');
            $given = trim((string) ($_GET['token'] ?? ''));
            if ($expected === '' || $given === '' || !hash_equals($expected, $given)) {
                send_json(array('ok' => false, 'error' => 'GET email test requires EMAIL_TEST_TOKEN in api/stripe-config.php and matching ?token= in the URL.'), 403);
            }
            $to = trim((string) ($_GET['to'] ?? ''));
            $subject = trim((string) ($_GET['subject'] ?? 'Test email from AnyTransport'));
            $body = trim((string) ($_GET['body'] ?? 'This is a test email.'));
        } else {
            $to = trim((string) ($input['to'] ?? ''));
            $subject = trim((string) ($input['subject'] ?? 'Test email from AnyTransport'));
            $body = trim((string) ($input['body'] ?? 'This is a test email.'));
        }
        if ($to === '') {
            send_json(array('ok' => false, 'error' => 'Recipient (to) is required.'), 400);
        }

        $sent = send_email_simple($to, $subject, $body);
        if ($sent) {
            send_json(array('ok' => true, 'sent' => true));
        }

        send_json(array('ok' => false, 'sent' => false, 'error' => 'Email send failed. Check api/email.log for details.'), 500);

    case 'notifications.list':
        $userId = trim((string) ($_GET['userId'] ?? ''));
        $notifications = array_values($store['notifications']);
        if ($userId !== '') {
            $notifications = array_values(array_filter($notifications, function ($notification) use ($userId) {
                return trim((string) ($notification['userId'] ?? '')) === $userId;
            }));
        }
        send_json(array('ok' => true, 'notifications' => $notifications));

    case 'notifications.add':
        $userId = trim((string) ($input['userId'] ?? ''));
        $notification = is_array($input['notification'] ?? null) ? $input['notification'] : array();
        if ($userId === '') {
            send_json(array('ok' => false, 'error' => 'User ID is required.'), 400);
        }

        $savedNotification = array(
            'id' => !empty($notification['id']) ? (string) $notification['id'] : make_id('notif'),
            'userId' => $userId,
            'type' => (string) ($notification['type'] ?? 'quote-added'),
            'title' => trim((string) ($notification['title'] ?? '')),
            'message' => trim((string) ($notification['message'] ?? '')),
            'data' => is_array($notification['data'] ?? null) ? $notification['data'] : array(),
            'read' => !empty($notification['read']),
            'createdAt' => !empty($notification['createdAt']) ? (string) $notification['createdAt'] : gmdate('c')
        );

        $notifications = array_values(array_filter($store['notifications'], function ($existing) use ($userId) {
            return trim((string) ($existing['userId'] ?? '')) !== $userId;
        }));
        array_unshift($notifications, $savedNotification);
        $store['notifications'] = array_slice($notifications, 0, 50);
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'notification' => $savedNotification));

    case 'notifications.read':
        $userId = trim((string) ($input['userId'] ?? ''));
        $notificationId = trim((string) ($input['notificationId'] ?? ''));
        if ($userId === '' || $notificationId === '') {
            send_json(array('ok' => false, 'error' => 'User and notification IDs are required.'), 400);
        }

        foreach ($store['notifications'] as $index => $notification) {
            if (trim((string) ($notification['userId'] ?? '')) === $userId && trim((string) ($notification['id'] ?? '')) === $notificationId) {
                $store['notifications'][$index]['read'] = true;
                break;
            }
        }
        write_store($storeFile, $store);
        send_json(array('ok' => true));

    case 'notifications.clear':
        $userId = trim((string) ($input['userId'] ?? ''));
        if ($userId === '') {
            send_json(array('ok' => false, 'error' => 'User ID is required.'), 400);
        }
        $store['notifications'] = array_values(array_filter($store['notifications'], function ($notification) use ($userId) {
            return trim((string) ($notification['userId'] ?? '')) !== $userId;
        }));
        write_store($storeFile, $store);
        send_json(array('ok' => true));

    case 'stripe.provider.onboarding':
        $user = get_session_user($store);
        if (!$user) {
            send_json(array('ok' => false, 'error' => 'You must be logged in to continue.'), 401);
        }

        if (trim((string) ($user['role'] ?? 'customer')) !== 'provider') {
            send_json(array('ok' => false, 'error' => 'Stripe onboarding is only available for provider accounts.'), 403);
        }

        $returnPath = trim((string) ($input['returnPath'] ?? 'dashboard.html')) ?: 'dashboard.html';
        if (strpos($returnPath, '..') !== false || strpos($returnPath, '://') !== false) {
            $returnPath = 'dashboard.html';
        }

        $result = ensure_provider_stripe_onboarding($store, $storeFile, trim((string) ($user['id'] ?? '')), $returnPath);
        write_store($storeFile, $store);
        send_json(array(
            'ok' => true,
            'user' => $result['user'],
            'complete' => !empty($result['complete']),
            'status' => $result['status'],
            'onboardingUrl' => $result['onboardingUrl'],
            'accountId' => $result['accountId']
        ));

    case 'stripe.provider.verification.email':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $user = get_session_user($store);
        if (!is_array($user)) {
            send_json(array('ok' => false, 'error' => 'You must be logged in to continue.'), 401);
        }
        if (trim((string) ($user['role'] ?? 'customer')) !== 'provider') {
            send_json(array('ok' => false, 'error' => 'Stripe verification is only available for provider accounts.'), 403);
        }

        $returnPath = trim((string) ($input['returnPath'] ?? 'dashboard.html')) ?: 'dashboard.html';
        if (strpos($returnPath, '..') !== false || strpos($returnPath, '://') !== false) {
            $returnPath = 'dashboard.html';
        }

        $result = begin_provider_stripe_verification($store, $storeFile, trim((string) ($user['id'] ?? '')), $returnPath, true);
        write_store($storeFile, $store);
        send_json(array(
            'ok' => !empty($result['ok']),
            'user' => isset($result['user']) ? sanitize_user_for_client($result['user']) : sanitize_user_for_client($user),
            'complete' => !empty($result['complete']),
            'status' => (string) ($result['status'] ?? ''),
            'onboardingUrl' => (string) ($result['onboardingUrl'] ?? ''),
            'emailed' => !empty($result['emailed']),
            'error' => (string) ($result['error'] ?? '')
        ));

    case 'stripe.file.get':
        $fileId = trim((string) ($_GET['fileId'] ?? ''));
        if ($fileId === '') {
            send_json(array('ok' => false, 'error' => 'fileId is required.'), 400);
        }

        $currentUser = get_current_user_record($store);
        if (!user_can_access_stripe_file($store, $currentUser, $fileId)) {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 403);
        }

        $secretKey = get_env_value(array('STRIPE_SECRET_KEY', 'STRIPE_API_KEY'));
        if ($secretKey === '') {
            send_json(array('ok' => false, 'error' => 'Stripe is not configured. Set STRIPE_SECRET_KEY on the API server.'), 500);
        }

        if (!function_exists('curl_init')) {
            send_json(array('ok' => false, 'error' => 'Stripe integration requires the PHP cURL extension.'), 500);
        }

        $ch = curl_init();
        $url = 'https://files.stripe.com/v1/files/' . urlencode($fileId) . '/content';
        $headers = array('Authorization: Bearer ' . $secretKey);
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'application/octet-stream';
        curl_close($ch);

        if ($response === false || $curlError !== '') {
            send_json(array('ok' => false, 'error' => 'Stripe file fetch failed: ' . $curlError), 500);
        }

        if ($status < 200 || $status >= 300) {
            // Try to decode a JSON error body
            $decoded = json_decode($response, true);
            $msg = is_array($decoded) && !empty($decoded['error']['message']) ? $decoded['error']['message'] : 'Unable to fetch file from Stripe.';
            send_json(array('ok' => false, 'error' => $msg), $status);
        }

        // Return raw file content with correct content-type
        http_response_code(200);
        header('Content-Type: ' . $contentType);
        echo $response;
        exit;

    case 'providers.search':
        $sessionUser = get_current_user_record($store);
        if (!is_array($sessionUser) || trim((string) ($sessionUser['id'] ?? '')) === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $lat = (float) ($input['lat'] ?? $_GET['lat'] ?? 0);
        $lng = (float) ($input['lng'] ?? $_GET['lng'] ?? 0);
        if ($lat === 0.0 && $lng === 0.0) {
            send_json(array('ok' => false, 'error' => 'Search location (lat and lng) is required. Geocode your town or address first.'), 400);
        }
        $maxKm = (float) ($input['maxKm'] ?? $_GET['maxKm'] ?? 100);
        $category = trim((string) ($input['category'] ?? $_GET['category'] ?? ''));
        $providers = search_discoverable_providers($store, $lat, $lng, $maxKm, $category);
        send_json(array(
            'ok' => true,
            'providers' => $providers,
            'count' => count($providers),
            'search' => array(
                'lat' => $lat,
                'lng' => $lng,
                'maxKm' => max(5.0, min(500.0, $maxKm)),
                'category' => $category
            )
        ));

    case 'invites.create':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $sessionUser = get_current_user_record($store);
        $customerId = is_array($sessionUser) ? trim((string) ($sessionUser['id'] ?? '')) : '';
        if ($customerId === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $quoteId = trim((string) ($input['quoteId'] ?? ''));
        $providerId = trim((string) ($input['providerId'] ?? ''));
        if ($quoteId === '' || $providerId === '') {
            send_json(array('ok' => false, 'error' => 'quoteId and providerId are required.'), 400);
        }
        $quote = find_quote_by_id($store['quotes'], $quoteId);
        if (!is_array($quote)) {
            send_json(array('ok' => false, 'error' => 'Listing not found.'), 404);
        }
        $ownerId = trim((string) ($quote['userId'] ?? $quote['createdBy'] ?? ''));
        if ($ownerId === '' || $ownerId !== $customerId) {
            if (!session_user_owns_quote($sessionUser, $quote)) {
                send_json(array('ok' => false, 'error' => 'You can only invite providers to your own listings.'), 403);
            }
        }
        $provider = find_store_user_by_id($store, $providerId);
        if (!is_discoverable_provider($provider)) {
            send_json(array('ok' => false, 'error' => 'Provider not found or not available.'), 404);
        }
        if (!empty($provider['blockInvites'])) {
            send_json(array('ok' => false, 'error' => 'This provider is not accepting job invitations.'), 403);
        }
        $searchLat = (float) ($input['lat'] ?? 0);
        $searchLng = (float) ($input['lng'] ?? 0);
        $maxKm = (float) ($input['maxKm'] ?? 100);
        if ($searchLat !== 0.0 || $searchLng !== 0.0) {
            $distance = haversine_distance_km($searchLat, $searchLng, (float) ($provider['serviceAreaLat'] ?? 0), (float) ($provider['serviceAreaLng'] ?? 0));
            if ($distance !== null && $distance > max(5.0, min(500.0, $maxKm))) {
                send_json(array('ok' => false, 'error' => 'This provider is outside your search radius.'), 400);
            }
        }
        ensure_store_provider_invites($store);
        if (find_provider_invite_index($store, $quoteId, $providerId) >= 0) {
            send_json(array('ok' => true, 'alreadyInvited' => true, 'message' => 'This provider was already invited to this listing.'));
        }
        $quoteLabel = trim((string) ($quote['formId'] ?? $quoteId));
        $customerName = trim((string) ($sessionUser['username'] ?? $sessionUser['nickname'] ?? $sessionUser['name'] ?? 'A customer'));
        $invite = array(
            'id' => make_id('invite'),
            'quoteId' => $quoteId,
            'formId' => $quoteLabel,
            'providerId' => $providerId,
            'customerId' => $customerId,
            'customerName' => $customerName,
            'status' => 'active',
            'createdAt' => gmdate('c')
        );
        array_unshift($store['providerInvites'], $invite);
        $store['providerInvites'] = array_slice($store['providerInvites'], 0, 2000);
        add_user_notification(
            $store,
            $providerId,
            'Invitation to quote',
            $customerName . ' invited you to quote on listing ' . $quoteLabel . '.',
            'job_invite',
            array('quoteId' => $quoteId, 'fromUserId' => $customerId, 'inviteId' => $invite['id'])
        );
        send_provider_job_invite_email($provider, $customerName, $quoteLabel, $quoteId);
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'invite' => $invite));

    case 'quotes.markComplete':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $sessionUser = get_current_user_record($store);
        if (!is_array($sessionUser)) {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $quoteId = trim((string) ($input['quoteId'] ?? ''));
        if ($quoteId === '') {
            send_json(array('ok' => false, 'error' => 'quoteId is required.'), 400);
        }
        $index = find_user_index($store['quotes'], function ($existing) use ($quoteId) {
            return is_array($existing) && trim((string) ($existing['id'] ?? '')) === $quoteId;
        });
        if ($index < 0) {
            send_json(array('ok' => false, 'error' => 'Listing not found.'), 404);
        }
        $quote = $store['quotes'][$index];
        if (!session_user_owns_quote($sessionUser, $quote)) {
            send_json(array('ok' => false, 'error' => 'You can only mark your own listings as complete.'), 403);
        }
        $quote['customerFormComplete'] = true;
        $quote['customerFormCompletedAt'] = gmdate('c');
        $quote['updatedAt'] = gmdate('c');
        $store['quotes'][$index] = $quote;
        write_store($storeFile, $store);
        refresh_session_cookie();
        send_json(array('ok' => true, 'quote' => attach_quote_media($store, $quote)));

    case 'quotes.revertComplete':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $sessionUser = get_current_user_record($store);
        if (!is_array($sessionUser)) {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $quoteId = trim((string) ($input['quoteId'] ?? ''));
        if ($quoteId === '') {
            send_json(array('ok' => false, 'error' => 'quoteId is required.'), 400);
        }
        $index = find_user_index($store['quotes'], function ($existing) use ($quoteId) {
            return is_array($existing) && trim((string) ($existing['id'] ?? '')) === $quoteId;
        });
        if ($index < 0) {
            send_json(array('ok' => false, 'error' => 'Listing not found.'), 404);
        }
        $quote = $store['quotes'][$index];
        if (!session_user_owns_quote($sessionUser, $quote)) {
            send_json(array('ok' => false, 'error' => 'You can only update your own listings.'), 403);
        }
        if (empty($quote['customerFormComplete'])) {
            send_json(array('ok' => false, 'error' => 'This listing is not marked complete.'), 400);
        }
        $customerId = trim((string) ($sessionUser['id'] ?? ''));
        $removedReviews = remove_customer_reviews_for_quote($store, $customerId, $quoteId);
        remove_review_notifications_for_quote($store, $quoteId);
        $quote['customerFormComplete'] = false;
        $quote['customerFormCompletedAt'] = '';
        $quote['updatedAt'] = gmdate('c');
        $store['quotes'][$index] = $quote;
        write_store($storeFile, $store);
        refresh_session_cookie();
        send_json(array(
            'ok' => true,
            'quote' => attach_quote_media($store, $quote),
            'removedReviews' => $removedReviews
        ));

    case 'reviews.create':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $sessionUser = get_current_user_record($store);
        if (!is_array($sessionUser)) {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $customerId = trim((string) ($sessionUser['id'] ?? ''));
        $providerId = trim((string) ($input['providerId'] ?? ''));
        $quoteId = trim((string) ($input['quoteId'] ?? ''));
        $rating = (int) ($input['rating'] ?? 0);
        $text = trim((string) ($input['text'] ?? ''));
        if ($providerId === '' || $quoteId === '') {
            send_json(array('ok' => false, 'error' => 'providerId and quoteId are required.'), 400);
        }
        if ($rating < 1 || $rating > 5) {
            send_json(array('ok' => false, 'error' => 'Rating must be between 1 and 5 stars.'), 400);
        }
        $quote = find_quote_by_id($store['quotes'], $quoteId);
        if (!is_array($quote)) {
            send_json(array('ok' => false, 'error' => 'Listing not found.'), 404);
        }
        if (!session_user_owns_quote($sessionUser, $quote)) {
            send_json(array('ok' => false, 'error' => 'You can only review providers for your own listings.'), 403);
        }
        if (empty($quote['customerFormComplete'])) {
            send_json(array('ok' => false, 'error' => 'Mark your listing as complete before leaving a review.'), 400);
        }
        $provider = find_store_user_by_id($store, $providerId);
        if (!is_discoverable_provider($provider)) {
            send_json(array('ok' => false, 'error' => 'Provider not found.'), 404);
        }
        $customerName = trim((string) ($sessionUser['username'] ?? $sessionUser['name'] ?? 'Customer'));
        if ($customerName === '') {
            $customerName = 'Customer';
        }
        if (!isset($store['providerReviews']) || !is_array($store['providerReviews'])) {
            $store['providerReviews'] = array();
        }
        $existingIndex = find_provider_review_index($store, $customerId, $providerId, $quoteId);
        $formId = trim((string) ($quote['formId'] ?? ''));
        if ($existingIndex < 0 && $formId !== '') {
            foreach ($store['providerReviews'] as $idx => $existingReview) {
                if (!is_array($existingReview)) {
                    continue;
                }
                if (trim((string) ($existingReview['customerId'] ?? '')) !== $customerId) {
                    continue;
                }
                if (trim((string) ($existingReview['providerId'] ?? '')) !== $providerId) {
                    continue;
                }
                if (trim((string) ($existingReview['formId'] ?? '')) === $formId) {
                    $existingIndex = (int) $idx;
                    break;
                }
            }
        }
        if ($existingIndex >= 0) {
            $store['providerReviews'][$existingIndex]['rating'] = $rating;
            $store['providerReviews'][$existingIndex]['text'] = $text;
            $store['providerReviews'][$existingIndex]['quoteId'] = $quoteId;
            $store['providerReviews'][$existingIndex]['formId'] = $formId;
            $store['providerReviews'][$existingIndex]['customerName'] = $customerName;
            $store['providerReviews'][$existingIndex]['updatedAt'] = gmdate('c');
            $review = $store['providerReviews'][$existingIndex];
            add_user_notification(
                $store,
                $providerId,
                'Customer updated their review',
                $customerName . ' updated their ' . $rating . '-star review on listing ' . trim((string) ($formId !== '' ? $formId : $quoteId)) . '.',
                'provider_review',
                array('quoteId' => $quoteId, 'reviewId' => trim((string) ($review['id'] ?? '')), 'fromUserId' => $customerId)
            );
            send_provider_customer_rating_email($provider, $review, true);
            write_store($storeFile, $store);
            refresh_session_cookie();
            send_json(array('ok' => true, 'review' => $review, 'stats' => get_provider_review_stats($store, $providerId), 'updated' => true));
        }
        $review = array(
            'id' => make_id('review'),
            'providerId' => $providerId,
            'customerId' => $customerId,
            'quoteId' => $quoteId,
            'formId' => $formId,
            'rating' => $rating,
            'text' => $text,
            'customerName' => $customerName,
            'createdAt' => gmdate('c')
        );
        array_unshift($store['providerReviews'], $review);
        $store['providerReviews'] = array_slice($store['providerReviews'], 0, 5000);
        add_user_notification(
            $store,
            $providerId,
            'New customer review',
            $customerName . ' left a ' . $rating . '-star review on listing ' . trim((string) ($formId !== '' ? $formId : $quoteId)) . '.',
            'provider_review',
            array('quoteId' => $quoteId, 'reviewId' => $review['id'], 'fromUserId' => $customerId)
        );
        send_provider_customer_rating_email($provider, $review, false);
        write_store($storeFile, $store);
        refresh_session_cookie();
        send_json(array('ok' => true, 'review' => $review, 'stats' => get_provider_review_stats($store, $providerId)));

    case 'reviews.list':
        $providerId = trim((string) ($_GET['providerId'] ?? ''));
        $quoteId = trim((string) ($_GET['quoteId'] ?? ''));
        if ($providerId === '') {
            send_json(array('ok' => false, 'error' => 'providerId is required.'), 400);
        }
        if (!isset($store['providerReviews']) || !is_array($store['providerReviews'])) {
            $store['providerReviews'] = array();
        }
        $sessionUser = get_current_user_record($store);
        $customerId = is_array($sessionUser) ? trim((string) ($sessionUser['id'] ?? '')) : '';
        $reviews = array();
        foreach ($store['providerReviews'] as $review) {
            if (!is_array($review)) {
                continue;
            }
            if (trim((string) ($review['providerId'] ?? '')) !== $providerId) {
                continue;
            }
            if ($quoteId !== '' && trim((string) ($review['quoteId'] ?? '')) !== $quoteId) {
                continue;
            }
            $reviews[] = $review;
        }
        $stats = get_provider_review_stats($store, $providerId);
        $existingForCustomer = null;
        if ($customerId !== '' && $quoteId !== '') {
            $idx = find_provider_review_index($store, $customerId, $providerId, $quoteId);
            if ($idx >= 0) {
                $existingForCustomer = $store['providerReviews'][$idx];
            }
        }
        send_json(array(
            'ok' => true,
            'reviews' => $reviews,
            'stats' => $stats,
            'existingReview' => $existingForCustomer
        ));

    case 'providers.publicProfile':
        $providerId = trim((string) ($_GET['providerId'] ?? $_GET['id'] ?? ''));
        if ($providerId === '') {
            send_json(array('ok' => false, 'error' => 'providerId is required.'), 400);
        }
        $sessionUser = get_current_user_record($store);
        if (!is_array($sessionUser) || trim((string) ($sessionUser['id'] ?? '')) === '') {
            send_json(array('ok' => false, 'error' => 'Authentication required.'), 401);
        }
        $provider = find_store_user_by_id($store, $providerId);
        if (!is_array($provider)) {
            send_json(array('ok' => false, 'error' => 'Provider not found.'), 404);
        }
        $role = strtolower(trim((string) ($provider['role'] ?? '')));
        if ($role !== 'provider') {
            send_json(array('ok' => false, 'error' => 'This profile is not a transport provider.'), 404);
        }
        $history = build_provider_job_history($store, $providerId, 80);
        $stats = get_provider_review_stats($store, $providerId);
        send_json(array(
            'ok' => true,
            'provider' => sanitize_provider_public_profile($provider),
            'jobHistory' => $history,
            'stats' => array(
                'completedJobs' => count(array_filter($history, function ($entry) {
                    return is_array($entry) && !empty($entry['completed']);
                })),
                'quotedJobs' => count($history),
                'reviews' => $stats
            )
        ));

    case 'site.content.get':
        $siteContent = get_site_content_from_store($store);
        send_json(array('ok' => true, 'siteContent' => $siteContent));

    case 'site.content.update':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }
        $incoming = $input['siteContent'] ?? null;
        if (!is_array($incoming)) {
            send_json(array('ok' => false, 'error' => 'Missing site content payload.'), 400);
        }
        $normalized = normalize_site_content($incoming);
        if (is_array($normalized['pages'] ?? null)) {
            foreach ($normalized['pages'] as $pageId => $page) {
                if (!is_array($page) || !isset($page['elements']) || !is_array($page['elements'])) {
                    continue;
                }
                foreach ($page['elements'] as $eidx => $element) {
                    if (!is_array($element)) {
                        continue;
                    }
                    if (($element['type'] ?? '') === 'text') {
                        $normalized['pages'][$pageId]['elements'][$eidx]['content'] = sanitize_site_content_html($element['content'] ?? '');
                    }
                }
            }
        }
        $normalized['updatedAt'] = gmdate('c');
        $store['siteContent'] = $normalized;
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'siteContent' => $normalized));

    case 'site.media.upload':
        if ($method !== 'POST') {
            send_json(array('ok' => false, 'error' => 'Method not allowed.'), 405);
        }
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }
        $dataUrl = (string) ($input['dataUrl'] ?? '');
        $decoded = decode_data_url_binary($dataUrl);
        if ($decoded === null) {
            send_json(array('ok' => false, 'error' => 'Invalid media data. Expected a data URL.'), 400);
        }
        $maxBytes = 8 * 1024 * 1024;
        if (strlen($decoded['binary']) > $maxBytes) {
            send_json(array('ok' => false, 'error' => 'File too large (max 8 MB).'), 413);
        }
        $ext = extension_from_mime($decoded['mime']);
        $mediaId = make_id('smedia');
        $relative = 'site-media/' . $mediaId . '.' . $ext;
        $fullPath = $storeDir . '/' . $relative;
        $dir = dirname($fullPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        if (@file_put_contents($fullPath, $decoded['binary'], LOCK_EX) === false) {
            send_json(array('ok' => false, 'error' => 'Unable to save file.'), 500);
        }
        if (!isset($store['siteMedia']) || !is_array($store['siteMedia'])) {
            $store['siteMedia'] = array();
        }
        $store['siteMedia'][] = array(
            'id' => $mediaId,
            'relativePath' => $relative,
            'mimeType' => $decoded['mime'],
            'createdAt' => gmdate('c'),
            'uploadedBy' => trim((string) ($currentUser['id'] ?? ''))
        );
        write_store($storeFile, $store);
        send_json(array(
            'ok' => true,
            'mediaId' => $mediaId,
            'url' => build_site_media_url($mediaId)
        ));

    case 'site.media':
        $mediaId = trim((string) ($_GET['id'] ?? ''));
        if ($mediaId === '') {
            send_json(array('ok' => false, 'error' => 'Missing media id.'), 400);
        }
        $record = null;
        foreach ($store['siteMedia'] ?? array() as $m) {
            if (!is_array($m)) {
                continue;
            }
            if (trim((string) ($m['id'] ?? '')) === $mediaId) {
                $record = $m;
                break;
            }
        }
        if ($record === null) {
            send_json(array('ok' => false, 'error' => 'Not found.'), 404);
        }
        $rel = trim((string) ($record['relativePath'] ?? ''));
        $fullPath = $rel !== '' ? ($storeDir . '/' . $rel) : '';
        if ($fullPath === '' || !is_file($fullPath)) {
            send_json(array('ok' => false, 'error' => 'File missing.'), 404);
        }
        $mime = trim((string) ($record['mimeType'] ?? ''));
        if ($mime === '') {
            $mime = 'application/octet-stream';
        }
        header('Content-Type: ' . $mime);
        header('Cache-Control: public, max-age=86400');
        readfile($fullPath);
        exit;

    default:
        send_json(array('ok' => false, 'error' => 'Unknown action.'), 404);
}
