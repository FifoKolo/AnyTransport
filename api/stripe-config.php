<?php
return array(
  'STRIPE_SECRET_KEY' => 'sk_test_your_secret_key_here',
  'STRIPE_CONNECT_COUNTRY' => 'IE',
  'SMTP_HOST' => 'smtp.sendgrid.net',
  'SMTP_PORT' => 587,
  'SMTP_USER' => 'apikey',
    'SMTP_PASS' => '',           // <-- paste your SendGrid API key here (keep secret)
    'SMTP_SECURE' => 'ssl',      // 'ssl' for port 465, 'tls' for 587, or '' to disable
  'INBOUND_EMAIL_DOMAIN' => 'reply.yourdomain.com'
);
