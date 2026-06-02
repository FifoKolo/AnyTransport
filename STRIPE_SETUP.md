# Stripe Setup for AnyTransport

Provider verification uses **Stripe Identity** (hosted document + selfie flow). The site emails providers a secure Stripe link after signup; Stripe webhooks update verification status on the server.

**Do not commit real keys to Git.** Keep secrets only in server `api/stripe-config.php` (or environment variables). GitHub push protection will block commits containing `sk_test_` / `sk_live_`.

## Config file (recommended)

1. Copy `api/stripe-config.php.example` to `api/stripe-config.php` on the **server** (not in git).
2. Set your keys (test for dev, live for production).
3. Ensure PHP is served through the web server (`https://yoursite.com/api/index.php`), not `file://`.

Example:

```php
<?php

return array(
    'STRIPE_SECRET_KEY' => 'sk_test_your_secret_key_here',
    'STRIPE_CONNECT_COUNTRY' => 'IE',
    'STRIPE_IDENTITY_WEBHOOK_SECRET' => 'whsec_your_identity_webhook_secret_here',
);
```

## Environment variables (optional)

If your host supports env vars, these are read as fallbacks:

- `STRIPE_SECRET_KEY` (or `STRIPE_API_KEY`)
- `STRIPE_IDENTITY_WEBHOOK_SECRET` (or `STRIPE_WEBHOOK_SECRET`)
- `STRIPE_CONNECT_COUNTRY` (optional, default `IE`)

## Test vs live (do not mix)

| Item | Test (dev) | Live (production) |
|------|------------|-------------------|
| Secret key | `sk_test_...` | `sk_live_...` |
| Webhook signing secret | test `whsec_...` | live `whsec_...` |
| Identity sessions (`vs_...`) | created in test mode | created in live mode |

If you see:

`a similar object exists in test mode, but a live mode key was used`

your user record still has a **test** `stripeIdentitySessionId` while the server uses a **live** key (or the reverse). Clear old sessions (see below) and resend verification.

`dev.anytransport.ie` should normally use **test** keys unless you intentionally run live there.

## Stripe Dashboard setup

### Identity

1. Stripe Dashboard → **Identity** → enable the product.
2. Configure required checks (ID document, matching selfie, etc.).

### Webhook / event destination

1. Developers → **Webhooks** (or Workbench → add destination).
2. Endpoint URL must be the full path:

   `https://your-domain.com/api/stripe-webhook.php`

   (not just `https://your-domain.com`)

3. Subscribe to Identity events, for example:

   - `identity.verification_session.verified`
   - `identity.verification_session.requires_input`
   - `identity.verification_session.processing`
   - `identity.verification_session.canceled` (optional)

4. Copy the **signing secret** (`whsec_...`) into `STRIPE_IDENTITY_WEBHOOK_SECRET` on the server.

5. Send a test event and confirm HTTP **200** on the delivery log.

## Provider verification flow

1. Provider signs up (provider role).
2. API creates a Stripe Identity `verification_session` and stores `stripeIdentitySessionId` on the user.
3. API emails the session URL to the provider (`send_provider_stripe_verification_email`).
4. Provider completes verification on Stripe’s hosted page.
5. Stripe sends webhooks → `api/stripe-webhook.php` updates user status.
6. Admin may still review ID photos in the dashboard before full approval (depending on `identityReviewStatus`).

Providers can use **Resend verification email** on the dashboard (`stripe.provider.verification.email`).

## Reset Stripe Identity sessions (live cutover)

When switching from test keys to live keys (or after a test/live mismatch), clear old `vs_...` session IDs on the **server** store:

```bash
cd /var/www/dev.anytransport.ie   # adjust path to your deploy root
php api/reset-stripe-identity-for-live.php
sudo systemctl restart php8.3-fpm
sudo systemctl restart nginx
```

This script resets Stripe Identity / onboarding fields for all **provider** accounts in `api/data/anytransport-store.json`. Then:

1. Log out and log in again as the provider.
2. Click **Resend verification email** to create a new session with the current key mode.

## API health check

Open in the browser (should return JSON, not 404):

`https://your-domain.com/api/index.php?action=auth.me`

If the dashboard says **Verification email is not available**, the browser cannot reach the API. Fix nginx/PHP routing first (see `deploy/nginx-php-snippet.conf.example`).

## Nginx note

Without a `location ~ \.php$` block, `/api/index.php` may 404 or download as a file. Use the snippet in `deploy/nginx-php-snippet.conf.example` inside your `server { }` block.

## Security

- Never commit `api/stripe-config.php` with real keys.
- Rotate keys if they were exposed in chat, screenshots, or git history.
- Use test keys on dev; use live keys only on production with a live webhook secret.
