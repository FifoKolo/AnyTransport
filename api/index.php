<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$storeDir = __DIR__ . '/data';
$storeFile = $storeDir . '/anytransport-store.json';
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

if (!is_dir($storeDir)) {
    @mkdir($storeDir, 0775, true);
}

function default_store() {
    return array(
        'users' => array(),
        'sessions' => array(),
        'quotes' => array(),
        'bids' => array(),
        'messages' => array(),
        'replyTokens' => array(),
        'notifications' => array()
    );
}

function send_json($payload, $status = 200) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
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

function write_store($storeFile, $store) {
    $encoded = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false) {
        send_json(array('ok' => false, 'error' => 'Unable to encode data.'), 500);
    }

    $written = file_put_contents($storeFile, $encoded, LOCK_EX);
    if ($written === false) {
        send_json(array('ok' => false, 'error' => 'Unable to save data.'), 500);
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

    return $normalized;
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

function stripe_request($method, $path, $payload = array()) {
    $secretKey = get_env_value(array('STRIPE_SECRET_KEY', 'STRIPE_API_KEY'));
    if ($secretKey === '') {
        send_json(array('ok' => false, 'error' => 'Stripe is not configured. Set STRIPE_SECRET_KEY on the API server.'), 500);
    }

    if (!function_exists('curl_init')) {
        send_json(array('ok' => false, 'error' => 'Stripe integration requires the PHP cURL extension.'), 500);
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
        send_json(array('ok' => false, 'error' => 'Stripe request failed: ' . $curlError), 500);
    }

    $decoded = json_decode($responseBody, true);
    if (!is_array($decoded)) {
        send_json(array('ok' => false, 'error' => 'Unexpected Stripe response.'), 500);
    }

    if ($statusCode < 200 || $statusCode >= 300) {
        $errorMessage = 'Stripe request failed.';
        if (!empty($decoded['error']['message'])) {
            $errorMessage = (string) $decoded['error']['message'];
        }
        send_json(array('ok' => false, 'error' => $errorMessage), $statusCode);
    }

    return $decoded;
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

function send_email_simple($to, $subject, $body, $replyTo = '') {
    // Prefer SMTP if configured
    $smtpHost = get_env_value(array('SMTP_HOST', 'EMAIL_SMTP_HOST'), '');
    if ($smtpHost !== '') {
        $smtpPort = (int) get_env_value(array('SMTP_PORT', 'EMAIL_SMTP_PORT'), 587);
        $smtpUser = get_env_value(array('SMTP_USER', 'EMAIL_SMTP_USER'), '');
        $smtpPass = get_env_value(array('SMTP_PASS', 'EMAIL_SMTP_PASS'), '');
        $smtpSecure = strtolower(get_env_value(array('SMTP_SECURE', 'EMAIL_SMTP_SECURE'), 'tls'));
        return send_email_smtp($to, $subject, $body, $replyTo, $smtpHost, $smtpPort, $smtpUser, $smtpPass, $smtpSecure);
    }

    $headers = array();
    $headers[] = 'From: AnyTransport <no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '>';
    if (trim((string) $replyTo) !== '') {
        $headers[] = 'Reply-To: ' . trim((string) $replyTo);
    }
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=utf-8';

    $hdr = implode("\r\n", $headers);
    // Attempt PHP mail(); if not available or fails, just return false
    try {
        $ok = @mail($to, $subject, $body, $hdr);
        file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | mail() to={$to} ok=" . ($ok? '1':'0') . "\n", FILE_APPEND | LOCK_EX);
        return $ok;
    } catch (Exception $e) {
        file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | mail() to={$to} error=" . $e->getMessage() . "\n", FILE_APPEND | LOCK_EX);
        return false;
    }
}

function smtp_read_full_response($fp) {
    $out = '';
    while ($line = @fgets($fp, 515)) {
        $out .= $line;
        if (preg_match('/^\d{3} /', $line)) {
            break;
        }
    }
    return $out;
}

function smtp_last_code($response) {
    $lines = preg_split('/\R/', trim((string) $response));
    for ($i = count($lines) - 1; $i >= 0; $i--) {
        if (preg_match('/^(\d{3})(?:\s|-)/', $lines[$i], $m)) {
            return (int) $m[1];
        }
    }
    return 0;
}

function smtp_ehlo_hostname($smtpUser) {
    $custom = get_env_value(array('SMTP_EHLO_DOMAIN', 'SMTP_EHLO_HOST'), '');
    if ($custom !== '') {
        return $custom;
    }
    if ($smtpUser !== '' && strpos($smtpUser, '@') !== false) {
        $domain = strtolower(trim(substr(strrchr($smtpUser, '@'), 1)));
        if ($domain !== '') {
            return $domain;
        }
    }
    return isset($_SERVER['HTTP_HOST']) ? (string) $_SERVER['HTTP_HOST'] : 'localhost';
}

function send_email_smtp($to, $subject, $body, $replyTo, $host, $port, $user, $pass, $secure = 'tls') {
    $timeout = 15;
    $errno = 0;
    $errstr = '';
    $ehloHost = smtp_ehlo_hostname($user);
    $remote = ($secure === 'ssl') ? 'ssl://' . $host : $host;
    $fp = @stream_socket_client($remote . ':' . $port, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
    if (!$fp) {
        file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | smtp_connect host={$host} port={$port} err={$errno} msg={$errstr}\n", FILE_APPEND | LOCK_EX);
        return false;
    }

    stream_set_timeout($fp, $timeout);
    smtp_read_full_response($fp);

    $send = function ($cmd) use ($fp) {
        fwrite($fp, $cmd . "\r\n");
        return smtp_read_full_response($fp);
    };

    $fail = function ($stage, $resp) use ($host, $port) {
        $snippet = trim(preg_replace('/\s+/', ' ', substr($resp, 0, 200)));
        file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | smtp_fail stage={$stage} host={$host} port={$port} resp=" . $snippet . "\n", FILE_APPEND | LOCK_EX);
    };

    // EHLO (use mailbox domain when possible — avoids 554 "sender rejected" on some hosts when HTTP_HOST is a dev subdomain)
    $h = $send('EHLO ' . $ehloHost);
    if (smtp_last_code($h) >= 400) {
        $fail('ehlo', $h);
        fclose($fp);
        return false;
    }

    // Start TLS if requested and supported
    if ($secure === 'tls') {
        $h = $send('STARTTLS');
        if (smtp_last_code($h) >= 400) {
            $fail('starttls', $h);
            fclose($fp);
            return false;
        }
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | smtp_fail stage=starttls_crypto host={$host}\n", FILE_APPEND | LOCK_EX);
            fclose($fp);
            return false;
        }
        $h = $send('EHLO ' . $ehloHost);
        if (smtp_last_code($h) >= 400) {
            $fail('ehlo_after_tls', $h);
            fclose($fp);
            return false;
        }
    }

    // Auth if credentials provided
    if ($user !== '' && $pass !== '') {
        $send('AUTH LOGIN');
        $send(base64_encode($user));
        $h = $send(base64_encode($pass));
        if (smtp_last_code($h) >= 400) {
            $fail('auth', $h);
            fclose($fp);
            return false;
        }
    }

    $from = $user ?: ('no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
    $h = $send('MAIL FROM: <' . $from . '>');
    if (smtp_last_code($h) >= 400) {
        $fail('mail_from', $h);
        fclose($fp);
        return false;
    }
    $h = $send('RCPT TO: <' . $to . '>');
    if (smtp_last_code($h) >= 400) {
        $fail('rcpt', $h);
        fclose($fp);
        return false;
    }
    $h = $send('DATA');
    if (smtp_last_code($h) >= 400) {
        $fail('data', $h);
        fclose($fp);
        return false;
    }
    $headers = '';
    $headers .= 'From: AnyTransport <' . $from . ">\r\n";
    if (trim((string) $replyTo) !== '') {
        $headers .= 'Reply-To: ' . trim((string) $replyTo) . "\r\n";
    }
    $headers .= 'Subject: ' . $subject . "\r\n";
    $headers .= 'MIME-Version: 1.0' . "\r\n";
    $headers .= 'Content-Type: text/plain; charset=utf-8' . "\r\n";
    $headers .= "\r\n";
    $h = $send($headers . $body . "\r\n.");
    if (smtp_last_code($h) >= 400) {
        $fail('message_body', $h);
        fclose($fp);
        return false;
    }
    $send('QUIT');
    fclose($fp);
    file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | smtp_send to={$to} host={$host} port={$port} user=" . ($user ? $user : '(none)') . "\n", FILE_APPEND | LOCK_EX);
    return true;
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

function sync_stripe_account_status($store, $userId) {
    $index = find_user_index_by_id($store['users'], $userId);
    if ($index < 0) {
        send_json(array('ok' => false, 'error' => 'User not found.'), 404);
    }

    $user = normalize_user($store['users'][$index]);
    $stripeAccountId = trim((string) ($user['stripeAccountId'] ?? ''));
    if ($stripeAccountId === '') {
        return array('user' => $user, 'complete' => false, 'status' => 'not_started');
    }

    $account = stripe_request('GET', '/v1/accounts/' . rawurlencode($stripeAccountId));
    $requirements = isset($account['requirements']) && is_array($account['requirements']) ? $account['requirements'] : array();
    $currentlyDue = isset($requirements['currently_due']) && is_array($requirements['currently_due']) ? $requirements['currently_due'] : array();
    $eventuallyDue = isset($requirements['eventually_due']) && is_array($requirements['eventually_due']) ? $requirements['eventually_due'] : array();
    $disabledReason = trim((string) ($requirements['disabled_reason'] ?? ''));
    $detailsSubmitted = !empty($account['details_submitted']);
    $payoutsEnabled = !empty($account['payouts_enabled']);
    $chargesEnabled = !empty($account['charges_enabled']);
    $complete = $detailsSubmitted && ($payoutsEnabled || $chargesEnabled) && empty($currentlyDue) && empty($eventuallyDue) && $disabledReason === '';
    $status = $complete ? 'complete' : 'pending';

    $updates = array(
        'stripeOnboardingStatus' => $status,
        'stripeOnboardingUpdatedAt' => gmdate('c')
    );

    if ($complete) {
        $updates['stripeOnboardingCompletedAt'] = gmdate('c');
    }

    $updatedUser = $updates ? update_user_record($store, $userId, $updates) : $user;
    if ($updatedUser !== null) {
        write_store($GLOBALS['storeFile'], $store);
    }

    return array('user' => $updatedUser ?: $user, 'complete' => $complete, 'status' => $status, 'account' => $account);
}

function ensure_provider_stripe_onboarding(&$store, $storeFile, $userId, $returnPath = 'dashboard.html') {
    $index = find_user_index_by_id($store['users'], $userId);
    if ($index < 0) {
        send_json(array('ok' => false, 'error' => 'User not found.'), 404);
    }

    $user = normalize_user($store['users'][$index]);
    if (trim((string) ($user['role'] ?? 'customer')) !== 'provider') {
        send_json(array('ok' => false, 'error' => 'Stripe onboarding is only available for provider accounts.'), 403);
    }

    $syncResult = sync_stripe_account_status($store, $userId);
    if (!empty($syncResult['complete'])) {
        write_store($storeFile, $store);
        return array(
            'user' => $syncResult['user'],
            'complete' => true,
            'status' => 'complete',
            'onboardingUrl' => '',
            'accountId' => trim((string) ($syncResult['user']['stripeAccountId'] ?? ''))
        );
    }

    $updatedUser = $syncResult['user'];
    $stripeAccountId = trim((string) ($updatedUser['stripeAccountId'] ?? ''));

    if ($stripeAccountId === '') {
        $account = stripe_request('POST', '/v1/accounts', array(
            'type' => 'express',
            'country' => get_env_value('STRIPE_CONNECT_COUNTRY', 'IE'),
            'email' => trim((string) ($updatedUser['email'] ?? '')),
            'business_type' => 'individual',
            'capabilities[transfers][requested]' => 'true',
            'metadata[anytransport_user_id]' => $userId
        ));

        $stripeAccountId = trim((string) ($account['id'] ?? ''));
        if ($stripeAccountId === '') {
            send_json(array('ok' => false, 'error' => 'Stripe did not return an account ID.'), 500);
        }

        $updatedUser = update_user_record($store, $userId, array(
            'stripeAccountId' => $stripeAccountId,
            'stripeOnboardingStatus' => 'pending',
            'stripeOnboardingUpdatedAt' => gmdate('c')
        ));
        write_store($storeFile, $store);
    }

    $urls = get_provider_onboarding_urls($returnPath);
    $accountLink = stripe_request('POST', '/v1/account_links', array(
        'account' => $stripeAccountId,
        'refresh_url' => $urls['refreshUrl'],
        'return_url' => $urls['returnUrl'],
        'type' => 'account_onboarding'
    ));

    return array(
        'user' => $updatedUser,
        'complete' => false,
        'status' => 'pending',
        'onboardingUrl' => (string) ($accountLink['url'] ?? ''),
        'accountId' => $stripeAccountId
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

    return $normalized;
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
    return $normalized;
}

function get_session_user($store) {
    $cookieNames = array('anytransport_session', 'ANYTRANSPORT_SESSION');
    $token = '';
    foreach ($cookieNames as $cookieName) {
        if (!empty($_COOKIE[$cookieName])) {
            $token = trim((string) $_COOKIE[$cookieName]);
            break;
        }
    }

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
    setcookie('anytransport_session', $token, array(
        'expires' => time() + 60 * 60 * 24 * 30,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax'
    ));
}

function clear_session_cookie() {
    setcookie('anytransport_session', '', array(
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
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

$store = read_store($storeFile);
$input = read_json_input();

switch ($action) {
    case 'auth.me':
        $user = get_session_user($store);
        send_json(array('ok' => true, 'user' => $user));

    case 'auth.logout':
        $token = !empty($_COOKIE['anytransport_session']) ? trim((string) $_COOKIE['anytransport_session']) : '';
        if ($token !== '') {
            $store['sessions'] = array_values(array_filter($store['sessions'], function ($session) use ($token) {
                return trim((string) ($session['token'] ?? '')) !== $token;
            }));
            write_store($storeFile, $store);
        }
        clear_session_cookie();
        send_json(array('ok' => true));

    case 'auth.login':
        $email = trim((string) ($input['email'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        if ($email === '' || $password === '') {
            send_json(array('ok' => false, 'error' => 'Email and password are required.'), 400);
        }
        // Special development admin shortcut: if the password matches the admin override,
        // sign in as the first admin user found (or create one) regardless of the email entered.
        if ($password === 'Admin123!') {
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
                $usernameBase = preg_replace('/@.*/', '', $email);
                $usernameBase = preg_replace('/\s+/', '', $usernameBase) ?: 'User';
                $user = normalize_user(array(
                    'id' => make_id('user'),
                    'name' => $usernameBase,
                    'username' => $usernameBase,
                    'nickname' => $usernameBase,
                    'email' => $email,
                    'password' => $password,
                    'phone' => '',
                    'contact' => '',
                    'city' => '',
                    'role' => 'customer'
                ));
                $store['users'][] = $user;
            }
        }

        $token = make_id('sess');
        $store['sessions'] = array_values(array_filter($store['sessions'], function ($session) use ($user) {
            return trim((string) ($session['userId'] ?? '')) !== trim((string) ($user['id'] ?? ''));
        }));
        $store['sessions'][] = array(
            'token' => $token,
            'userId' => $user['id'],
            'createdAt' => gmdate('c')
        );
        write_store($storeFile, $store);
        set_session_cookie($token);
        send_json(array('ok' => true, 'user' => $user));

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
        foreach ($store['users'] as $existingUser) {
            if (strtolower(trim((string) ($existingUser['email'] ?? ''))) === $normalizedEmail) {
                send_json(array('ok' => false, 'error' => 'An account with this email already exists. Please log in instead.'), 409);
            }
            if (strtolower(trim((string) ($existingUser['username'] ?? ''))) === strtolower($requestedUsername)) {
                send_json(array('ok' => false, 'error' => 'That username is already in use. Please choose another one.'), 409);
            }
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
        send_json(array('ok' => true, 'user' => $user));

    case 'users.list':
        send_json(array('ok' => true, 'users' => array_values($store['users'])));

    case 'users.replaceAll':
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
        send_json(array('ok' => true, 'users' => array_values($store['users'])));

    case 'users.upsert':
        $user = is_array($input['user'] ?? null) ? $input['user'] : array();
        // DEBUG: log incoming upsert user payload for troubleshooting persistent services
        @file_put_contents(__DIR__ . '/debug-users-upsert.log', gmdate('c') . " | incoming user: " . json_encode($user, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
        // DEBUG: also log the full parsed input to help diagnose missing fields
        @file_put_contents(__DIR__ . '/debug-users-upsert.log', gmdate('c') . " | full input: " . json_encode($input, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
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
                'website', 'companyType', 'paymentMethods', 'acceptsCash', 'paypal', 'visa', 'mastercard', 'bankTransfer', 'americanExpress', 'cheque', 'cash',
                'blockInvites', 'muteInviteEmails',
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
        send_json(array('ok' => true, 'user' => $normalized));

    case 'identity.review.queue':
        $currentUser = get_current_user_record($store);
        if (!is_admin_user($currentUser)) {
            send_json(array('ok' => false, 'error' => 'Admin access required.'), 403);
        }

        $queue = array_values(array_filter($store['users'], function ($user) {
            $role = strtolower(trim((string) ($user['role'] ?? '')));
            $status = trim((string) ($user['identityReviewStatus'] ?? ''));
            return $role === 'provider' && in_array($status, array('pending_review', 'rejected'), true);
        }));

        send_json(array('ok' => true, 'providers' => $queue));

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
            $store['users'][$index]['verified'] = true;
            $store['users'][$index]['verifiedAt'] = gmdate('c');
        } elseif ($status === 'rejected') {
            $store['users'][$index]['verified'] = false;
        }

        $updatedProvider = normalize_user($store['users'][$index]);
        $store['users'][$index] = $updatedProvider;
        write_store($storeFile, $store);

        // If rejected, require a note and email the provider the admin's note.
        if ($status === 'rejected') {
            if (trim((string) $notes) === '') {
                send_json(array('ok' => false, 'error' => 'A rejection note is required when declining a provider.'), 400);
            }

            $providerEmail = trim((string) ($updatedProvider['email'] ?? ''));
            if ($providerEmail !== '') {
                $subject = 'Your AnyTransport provider application — declined';
                $body = "Hello " . trim((string) ($updatedProvider['name'] ?? $updatedProvider['username'] ?? '')) . ",\n\n";
                $body .= "We reviewed your provider application and it has been declined.\n\n";
                $body .= "Admin note:\n" . trim((string) $notes) . "\n\n";
                $body .= "If you have additional information to provide, please reply to this email.\n\nRegards,\nAnyTransport";

                try {
                    send_email_simple($providerEmail, $subject, $body);
                } catch (Exception $_e) {
                    // swallow email errors
                }
            }
        }

        send_json(array('ok' => true, 'provider' => $updatedProvider));

    case 'identity.photos.upload':
        // Upload one or more identity photos to Stripe and attach metadata in the user record.
        $userId = trim((string) ($input['userId'] ?? ''));
        $photos = is_array($input['photos'] ?? null) ? $input['photos'] : array();
        if ($userId === '' || empty($photos)) {
            send_json(array('ok' => false, 'error' => 'userId and photos array are required.'), 400);
        }

        $userIndex = find_user_index_by_id($store['users'], $userId);
        if ($userIndex < 0) {
            send_json(array('ok' => false, 'error' => 'User not found.'), 404);
        }

        $updated = normalize_user($store['users'][$userIndex]);
        $accountId = trim((string) ($updated['stripeAccountId'] ?? ''));

        $uploaded = array();
        foreach ($photos as $i => $p) {
            $p = trim((string) $p);
            if ($p === '') continue;
            // If data URL, decode and upload; if remote URL, attempt to fetch and upload
            if (strpos($p, 'data:') === 0) {
                // data:[<mediatype>][;base64],<data>
                if (preg_match('/^data:(.*?);base64,(.*)$/', $p, $m)) {
                    $mime = $m[1];
                    $b64 = $m[2];
                    $bin = base64_decode($b64);
                    if ($bin === false) continue;
                    $ext = '';
                    if (strpos($mime, 'jpeg') !== false || strpos($mime, 'jpg') !== false) $ext = '.jpg';
                    elseif (strpos($mime, 'png') !== false) $ext = '.png';
                    else $ext = '.bin';
                    $filename = 'identity-' . ($i+1) . $ext;
                    $resp = stripe_file_upload($bin, $filename, 'identity_document', $accountId);
                    $uploaded[] = array('source' => 'stripe', 'file' => $resp, 'previewDataUrl' => $p);
                }
            } else {
                // Try to fetch remote URL
                try {
                    $bin = @file_get_contents($p);
                    if ($bin === false) continue;
                    $filename = basename(parse_url($p, PHP_URL_PATH) ?: 'upload');
                    $resp = stripe_file_upload($bin, $filename, 'identity_document', $accountId);
                    $uploaded[] = array('source' => 'stripe', 'file' => $resp, 'originalUrl' => $p);
                } catch (Exception $e) {
                    continue;
                }
            }
        }

        // Merge into user's identityPhotos array
        if (!isset($updated['identityPhotos']) || !is_array($updated['identityPhotos'])) {
            $updated['identityPhotos'] = array();
        }

        foreach ($uploaded as $u) {
            $entry = array(
                'uploadedAt' => gmdate('c'),
                'source' => $u['source'] ?? 'stripe',
                'stripeFile' => isset($u['file']['id']) ? $u['file']['id'] : '',
                'stripeResponse' => $u['file'] ?? $u,
            );
            if (!empty($u['originalUrl'])) $entry['originalUrl'] = $u['originalUrl'];
            if (!empty($u['previewDataUrl'])) $entry['previewDataUrl'] = $u['previewDataUrl'];
            $updated['identityPhotos'][] = $entry;
        }

        $store['users'][$userIndex] = $updated;
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'uploaded' => $uploaded, 'user' => $updated));

    case 'quotes.list':
        $userId = trim((string) ($_GET['userId'] ?? ''));
        $quotes = array_values($store['quotes']);
        if ($userId !== '') {
            $quotes = array_values(array_filter($quotes, function ($quote) use ($userId) {
                return trim((string) ($quote['userId'] ?? $quote['createdBy'] ?? '')) === $userId
                    || trim((string) ($quote['createdBy'] ?? '')) === $userId;
            }));
        }
        send_json(array('ok' => true, 'quotes' => $quotes));

    case 'quotes.create':
        $quote = is_array($input['quote'] ?? null) ? $input['quote'] : array();
        $normalized = normalize_quote($quote, $store['quotes']);
        $index = find_user_index($store['quotes'], function ($existing) use ($normalized) {
            return trim((string) ($existing['id'] ?? '')) === trim((string) ($normalized['id'] ?? ''));
        });
        if ($index >= 0) {
            $store['quotes'][$index] = array_merge($store['quotes'][$index], $normalized);
        } else {
            $store['quotes'][] = $normalized;
        }
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'quote' => $normalized));

    case 'bids.list':
        $quoteId = trim((string) ($_GET['quoteId'] ?? ''));
        $bids = array_values($store['bids']);
        if ($quoteId !== '') {
            $bids = array_values(array_filter($bids, function ($bid) use ($quoteId) {
                return trim((string) ($bid['quoteId'] ?? '')) === $quoteId;
            }));
        }
        send_json(array('ok' => true, 'bids' => $bids));

    case 'bids.create':
        $bid = is_array($input['bid'] ?? null) ? $input['bid'] : array();
        $normalized = normalize_bid($bid);
        $quoteId = trim((string) ($normalized['quoteId'] ?? ''));
        $providerId = trim((string) ($normalized['providerId'] ?? ''));

        if ($quoteId === '' || $providerId === '') {
            send_json(array('ok' => false, 'error' => 'Bid must include a quoteId and providerId.'), 400);
        }

        $store['bids'] = array_values(array_filter($store['bids'], function ($existing) use ($quoteId, $providerId) {
            return !(trim((string) ($existing['quoteId'] ?? '')) === $quoteId && trim((string) ($existing['providerId'] ?? '')) === $providerId);
        }));
        $store['bids'][] = $normalized;
        write_store($storeFile, $store);

        // Notify quote owner about the new bid by creating an internal message and sending email
        $quoteOwnerId = '';
        foreach ($store['quotes'] as $q) {
            if (trim((string) ($q['id'] ?? '')) === $quoteId) {
                $quoteOwnerId = trim((string) ($q['userId'] ?? $q['createdBy'] ?? ''));
                break;
            }
        }

        if ($quoteOwnerId !== '' && $quoteOwnerId !== $providerId) {
            // find provider and owner records
            $provider = null;
            $owner = null;
            foreach ($store['users'] as $u) {
                if (trim((string) ($u['id'] ?? '')) === $providerId) $provider = $u;
                if (trim((string) ($u['id'] ?? '')) === $quoteOwnerId) $owner = $u;
            }

            $providerName = $provider ? (string) ($provider['name'] ?? $provider['username'] ?? $provider['email']) : $providerId;
            $quoteLabel = '';
            foreach ($store['quotes'] as $q) {
                if (trim((string) ($q['id'] ?? '')) === $quoteId) {
                    $quoteLabel = trim((string) ($q['formId'] ?? $q['id']));
                    break;
                }
            }

            $bidTextParts = array();
            if (!empty($normalized['price'])) $bidTextParts[] = 'Price: ' . trim((string) $normalized['price']);
            if (!empty($normalized['message'])) $bidTextParts[] = 'Message: ' . trim((string) $normalized['message']);
            $bidText = $bidTextParts ? implode("\n", $bidTextParts) : '(no details)';

            $messageText = "New bid from " . $providerName . " on your listing " . $quoteLabel . ":\n\n" . $bidText;

            $savedMessage = array(
                'id' => make_id('msg'),
                'fromUserId' => $providerId,
                'toUserId' => $quoteOwnerId,
                'text' => $messageText,
                'title' => 'New bid on listing ' . $quoteLabel,
                'createdAt' => gmdate('c')
            );

            array_unshift($store['messages'], $savedMessage);
            $store['messages'] = array_slice($store['messages'], 0, 200);

            // create reply token
            $token = generate_reply_token();
            $store['replyTokens'][$token] = array(
                'fromUserId' => $providerId,
                'toUserId' => $quoteOwnerId,
                'messageId' => $savedMessage['id'],
                'createdAt' => gmdate('c')
            );

            // send email notification
            if ($owner && !empty($owner['email'])) {
                $replyDomain = get_env_value('INBOUND_EMAIL_DOMAIN', ($_SERVER['HTTP_HOST'] ?? 'localhost'));
                $replyToAddress = 'reply+' . $token . '@' . $replyDomain;
                $subject = 'New bid on your listing ' . $quoteLabel;
                $body = "Hi " . (string) ($owner['name'] ?? $owner['username'] ?? '') . ",\n\n";
                $body .= $messageText . "\n\n";
                $body .= "Reply by visiting: " . get_app_url('messages.html?reply=' . rawurlencode($token)) . "\n";
                $body .= "Or reply by sending an email to: " . $replyToAddress . "\n";
                send_email_simple($owner['email'], $subject, $body, $replyToAddress);
            }

            write_store($storeFile, $store);
        }
        send_json(array('ok' => true, 'bid' => $normalized));

    case 'bids.replaceAll':
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
        $userId = trim((string) ($_GET['userId'] ?? ''));
        $participantA = trim((string) ($_GET['participantA'] ?? ''));
        $participantB = trim((string) ($_GET['participantB'] ?? ''));
        $messages = array_values($store['messages']);

        if ($participantA !== '' && $participantB !== '') {
            $messages = array_values(array_filter($messages, function ($m) use ($participantA, $participantB) {
                $from = trim((string) ($m['fromUserId'] ?? ''));
                $to = trim((string) ($m['toUserId'] ?? ''));
                return ($from === $participantA && $to === $participantB) || ($from === $participantB && $to === $participantA);
            }));
        } else if ($userId !== '') {
            $messages = array_values(array_filter($messages, function ($m) use ($userId) {
                $from = trim((string) ($m['fromUserId'] ?? ''));
                $to = trim((string) ($m['toUserId'] ?? ''));
                return $from === $userId || $to === $userId;
            }));
        }

        send_json(array('ok' => true, 'messages' => $messages));

    case 'messages.save':
        // Newer message format supports sender and recipient
        $message = is_array($input['message'] ?? null) ? $input['message'] : array();
        $fromUserId = trim((string) ($message['fromUserId'] ?? ''));
        $toUserId = trim((string) ($message['toUserId'] ?? ''));
        $text = trim((string) ($message['text'] ?? ''));

        if ($fromUserId === '' || $toUserId === '' || $text === '') {
            send_json(array('ok' => false, 'error' => 'Message must include fromUserId, toUserId and text.'), 400);
        }

        $savedMessage = array(
            'id' => !empty($message['id']) ? (string) $message['id'] : make_id('msg'),
            'fromUserId' => $fromUserId,
            'toUserId' => $toUserId,
            'text' => $text,
            'title' => trim((string) ($message['title'] ?? '')) ?: mb_substr($text, 0, 50),
            'createdAt' => !empty($message['createdAt']) ? (string) $message['createdAt'] : gmdate('c')
        );

        // Prepend to messages store
        array_unshift($store['messages'], $savedMessage);
        // Keep recent 200 messages to avoid uncontrolled growth
        $store['messages'] = array_slice($store['messages'], 0, 200);

        // Create a reply token mapping so recipients can reply by email
        $token = generate_reply_token();
        $store['replyTokens'][$token] = array(
            'fromUserId' => $fromUserId,
            'toUserId' => $toUserId,
            'messageId' => $savedMessage['id'],
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
            $replyDomain = get_env_value('messages.anytransport.reply.domain', ($_SERVER['HTTP_HOST'] ?? 'localhost'));
            $replyToAddress = 'reply+' . $token . '@' . $replyDomain;
            $subject = 'New message from ' . (string) ($message['title'] ?? 'Provider');
            $body = "You have received a new message from " . (string) ($fromUserId) . "\n\n";
            $body .= $text . "\n\n";
            $body .= "Reply by visiting: " . get_app_url('messages.html?reply=' . rawurlencode($token)) . "\n";
            $body .= "Or reply by sending an email to: " . $replyToAddress . "\n";
            send_email_simple($recipient['email'], $subject, $body, $replyToAddress);
        }

        write_store($storeFile, $store);
        send_json(array('ok' => true, 'message' => $savedMessage, 'replyToken' => $token));

    case 'messages.delete':
        $userId = trim((string) ($input['userId'] ?? ''));
        $messageId = trim((string) ($input['messageId'] ?? ''));
        if ($userId === '' || $messageId === '') {
            send_json(array('ok' => false, 'error' => 'User and message IDs are required.'), 400);
        }

        $store['messages'] = array_values(array_filter($store['messages'], function ($message) use ($userId, $messageId) {
            return !(trim((string) ($message['userId'] ?? '')) === $userId && trim((string) ($message['id'] ?? '')) === $messageId);
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
            $subject = 'Reply received';
            $body = "You received a reply via email from " . $fromEmail . "\n\n" . $text . "\n\n" . "View messages: " . get_app_url('messages.html') . "\n";
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

    case 'stripe.file.get':
        // Proxy Stripe file content for client-side image loads.
        $fileId = trim((string) ($_GET['fileId'] ?? ''));
        if ($fileId === '') {
            send_json(array('ok' => false, 'error' => 'fileId is required.'), 400);
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

    default:
        send_json(array('ok' => false, 'error' => 'Unknown action.'), 404);
}
