# Stripe Setup for AnyTransport

The provider signup/login flow now supports Stripe Connect onboarding, but the API needs a Stripe secret key before it can create onboarding links.

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

## What happens after setup

- Provider signup/login calls `stripe.provider.onboarding`
- The API creates or reuses a Stripe Connect Express account
- The provider is redirected to Stripe for identity verification
- After verification, Stripe returns them to the dashboard

## Important notes

- This is a Connect onboarding flow, not a standard payment checkout key.
- The secret key must stay on the server. Do not put it in frontend JavaScript.
- If you are still opening the site as a local file, the Stripe flow will not work because the PHP API cannot run there.