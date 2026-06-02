<?php
/**
 * One-time maintenance: clear test-mode Stripe Identity session IDs so live keys can create new sessions.
 * Run on server: php api/reset-stripe-identity-for-live.php
 */

$storeFile = __DIR__ . '/data/anytransport-store.json';
if (!file_exists($storeFile)) {
    fwrite(STDERR, "Store not found: {$storeFile}\n");
    exit(1);
}

$raw = file_get_contents($storeFile);
$store = json_decode($raw, true);
if (!is_array($store) || !isset($store['users']) || !is_array($store['users'])) {
    fwrite(STDERR, "Invalid store JSON.\n");
    exit(1);
}

$resetFields = array(
    'stripeIdentitySessionId' => '',
    'stripeIdentityStatus' => 'not_started',
    'stripeIdentityLastError' => '',
    'stripeIdentityVerifiedAt' => '',
    'stripeAccountId' => '',
    'stripeOnboardingStatus' => 'not_started',
    'stripeOnboardingUpdatedAt' => gmdate('c'),
    'stripeOnboardingCompletedAt' => '',
);

$count = 0;
foreach ($store['users'] as $index => $user) {
    if (!is_array($user)) {
        continue;
    }
    $role = strtolower(trim((string) ($user['role'] ?? '')));
    if ($role !== 'provider') {
        continue;
    }
    foreach ($resetFields as $key => $value) {
        $store['users'][$index][$key] = $value;
    }
    $count++;
    $email = trim((string) ($user['email'] ?? ''));
    $id = trim((string) ($user['id'] ?? ''));
    echo "Reset provider: {$id} ({$email})\n";
}

if ($count === 0) {
    echo "No provider accounts found.\n";
    exit(0);
}

$encoded = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
if ($encoded === false) {
    fwrite(STDERR, "Failed to encode store JSON.\n");
    exit(1);
}

if (file_put_contents($storeFile, $encoded) === false) {
    fwrite(STDERR, "Failed to write store file.\n");
    exit(1);
}

echo "Done. Reset {$count} provider account(s). Log out, log in, then use Resend verification email.\n";
