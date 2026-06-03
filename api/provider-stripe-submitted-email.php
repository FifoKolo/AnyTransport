<?php

if (!function_exists('send_provider_stripe_verification_submitted_email')) {

function send_provider_stripe_verification_submitted_email($provider) {
    $providerEmail = trim((string) ($provider['email'] ?? ''));
    if ($providerEmail === '') {
        return false;
    }

    $providerName = trim((string) ($provider['name'] ?? $provider['username'] ?? 'there'));
    $dashboardUrl = get_app_url('dashboard.html');

    $subject = 'Your AnyTransport identity verification was submitted';
    $body = "Hello " . $providerName . ",\n\n";
    $body .= "Thank you for completing Stripe identity verification.\n\n";
    $body .= "We have received your verification details and an AnyTransport admin will review them shortly. ";
    $body .= "You will receive another email once your provider account has been approved, or if we need anything else from you.\n\n";
    if ($dashboardUrl !== '' && $dashboardUrl !== '/') {
        $body .= "You can check your status anytime by signing in to your provider dashboard:\n";
        $body .= $dashboardUrl . "\n\n";
    }
    $body .= "Please do not reply to this email address.\n\n";
    $body .= "Regards,\nAnyTransport";

    return send_email_simple($providerEmail, $subject, $body);
}

function maybe_send_provider_stripe_verification_submitted_email(&$store, $storeFile, $userIndex) {
    if (!isset($store['users'][$userIndex]) || !is_array($store['users'][$userIndex])) {
        return false;
    }

    $user = $store['users'][$userIndex];
    if (strtolower(trim((string) ($user['role'] ?? ''))) !== 'provider') {
        return false;
    }
    if (strtolower(trim((string) ($user['stripeOnboardingStatus'] ?? ''))) !== 'complete') {
        return false;
    }
    if (trim((string) ($user['stripeVerificationSubmittedNotifiedAt'] ?? '')) !== '') {
        return false;
    }
    if (strtolower(trim((string) ($user['identityReviewStatus'] ?? ''))) === 'approved') {
        return false;
    }

    $sent = send_provider_stripe_verification_submitted_email($user);
    if (!$sent) {
        return false;
    }

    $store['users'][$userIndex]['stripeVerificationSubmittedNotifiedAt'] = gmdate('c');
    if ($storeFile !== '') {
        if (function_exists('write_store')) {
            write_store($storeFile, $store);
        } else {
            @file_put_contents($storeFile, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
    }

    return true;
}

}
