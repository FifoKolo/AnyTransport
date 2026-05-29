# Stripe Setup for AnyTransport

Provider verification uses **Stripe Connect Express** onboarding. The site emails providers a secure Stripe link after signup; when Stripe confirms identity, the provider account on AnyTransport is approved automatically.

## Option 1: Local config file

1. Copy `api/stripe-config.php.example` to `api/stripe-config.php`.
2. Replace `sk_test_your_secret_key_here` with your real Stripe secret key.
3. Keep `STRIPE_CONNECT_COUNTRY` set to the country you want to onboard providers in. The default is `IE`.
4. Make sure the PHP API is served through a web server, not opened directly with `file://`.

Example:

```php
<?php

return array(
    'STRIPE_SECRET_KEY' => 'sk_test_your_secret_key_here',
    'STRIPE_CONNECT_COUNTRY' => 'IE'
);
```

## Option 2: Environment variables

If your host supports environment variables, set:

- `STRIPE_SECRET_KEY`
- `STRIPE_CONNECT_COUNTRY` (optional)

## Provider verification flow

1. Provider signs up on the site with their email (provider role).
2. The API creates a Stripe Connect Express account and an onboarding link.
3. The API emails that link to the **same address** the provider used to register (`send_provider_stripe_verification_email`).
4. The provider completes identity verification in Stripe.
5. When they return to the site (or on next login via `auth.me`), the API syncs Stripe account status (`stripeOnboardingStatus: complete`) and pulls identity document file IDs from Stripe into the provider record.
6. An **admin** reviews photos in the dashboard (images are loaded from Stripe via `stripe.file.get`) and clicks **Approve**, or **Reject & redo verification** (sends a new Stripe link by email).

Providers can use **Resend verification email** on the dashboard (`stripe.provider.verification.email`) if the email was missed.

The legacy redirect-only endpoint `stripe.provider.onboarding` still works for opening Stripe in the browser without emailing.

## Important notes

- This is a Connect onboarding flow, not a standard payment checkout key.
- The secret key must stay on the server. Do not put it in frontend JavaScript.
- Outbound email must be configured in the API (same mail settings used for other site emails) or verification links will only be returned in API responses.
- If you are still opening the site as a local file, the Stripe flow will not work because the PHP API cannot run there.
