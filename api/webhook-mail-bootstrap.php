<?php

if (!function_exists('get_env_value')) {
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
}

if (!function_exists('get_app_url')) {
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
}

require_once __DIR__ . '/email-smtp.php';
require_once __DIR__ . '/provider-stripe-submitted-email.php';
