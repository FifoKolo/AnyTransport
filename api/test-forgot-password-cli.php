<?php
// CLI: php api/test-forgot-password-cli.php user@example.com
// Simulates auth.password.forgot against the local store (no HTTP).

$email = isset($argv[1]) ? trim((string) $argv[1]) : '';
if ($email === '') {
    fwrite(STDERR, "Usage: php api/test-forgot-password-cli.php <email>\n");
    exit(1);
}

$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['HTTPS'] = 'off';

$localStripeConfigFile = __DIR__ . '/stripe-config.php';
$localStripeConfig = array();
if (file_exists($localStripeConfigFile)) {
    $loaded = include $localStripeConfigFile;
    if (is_array($loaded)) {
        $localStripeConfig = $loaded;
    }
}

require_once __DIR__ . '/email-smtp.php';

function cli_get_env_value($names, $default = '') {
    global $localStripeConfig;
    $keys = is_array($names) ? $names : array($names);
    foreach ($keys as $name) {
        if (isset($localStripeConfig[$name]) && trim((string) $localStripeConfig[$name]) !== '') {
            return trim((string) $localStripeConfig[$name]);
        }
    }
    return $default;
}

if (!function_exists('get_env_value')) {
    function get_env_value($names, $default = '') {
        return cli_get_env_value($names, $default);
    }
}

function cli_get_app_url($path) {
    $origin = cli_get_env_value(array('APP_BASE_URL', 'APP_URL'), '');
    if ($origin === '') {
        $origin = 'http://localhost';
    }
    return rtrim($origin, '/') . '/' . ltrim((string) $path, '/');
}

$storeFile = __DIR__ . '/data/anytransport-store.json';
if (!file_exists($storeFile)) {
    fwrite(STDERR, "Store not found: {$storeFile}\n");
    exit(1);
}

$store = json_decode(file_get_contents($storeFile), true);
if (!is_array($store) || !isset($store['users'])) {
    fwrite(STDERR, "Invalid store\n");
    exit(1);
}

$norm = strtolower($email);
$index = -1;
foreach ($store['users'] as $i => $u) {
    if (is_array($u) && strtolower(trim((string) ($u['email'] ?? ''))) === $norm) {
        $index = (int) $i;
        break;
    }
}

if ($index < 0) {
    echo "No user with email {$email} in store.\n";
    exit(2);
}

try {
    $token = bin2hex(random_bytes(32));
} catch (Exception $e) {
    $token = 'pwreset-' . uniqid('', true);
}

$store['users'][$index]['passwordResetToken'] = $token;
$store['users'][$index]['passwordResetExpiresAt'] = gmdate('c', time() + 3600);
file_put_contents($storeFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

$resetUrl = cli_get_app_url('reset-password.html?token=' . rawurlencode($token));
$user = $store['users'][$index];

$subject = 'Reset your AnyTransport password';
$body = "Test reset link:\n\n" . $resetUrl . "\n";
$sent = send_email_simple(trim((string) ($user['email'] ?? '')), $subject, $body);

echo "User found: " . ($user['email'] ?? '') . "\n";
echo "Reset URL: {$resetUrl}\n";
echo "Email sent: " . ($sent ? 'yes' : 'no') . "\n";
echo "See api/email.log for SMTP/mail details.\n";
