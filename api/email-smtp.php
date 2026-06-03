<?php

if (!function_exists('send_email_simple')) {

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

function smtp_mail_from_address($smtpUser) {
    $fromCfg = get_env_value(array('NO_REPLY_EMAIL', 'SMTP_FROM', 'EMAIL_FROM', 'MAIL_FROM'), '');
    if ($fromCfg !== '') {
        return $fromCfg;
    }
    return 'no-reply@' . smtp_ehlo_hostname($smtpUser);
}

function smtp_dns_a_records($host) {
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        return array();
    }
    $ips = array();
    $records = @dns_get_record($host, DNS_A);
    if (is_array($records)) {
        foreach ($records as $r) {
            if (!empty($r['ip'])) {
                $ips[] = $r['ip'];
            }
        }
    }
    return $ips;
}

function smtp_connect_with_ipv4_fallback($host, $port, $secure, $timeout, &$errno, &$errstr) {
    $errno = 0;
    $errstr = '';
    $sslCtx = array(
        'ssl' => array(
            'peer_name' => $host,
            'verify_peer' => true,
            'verify_peer_name' => true,
        ),
    );

    $try = array();
    foreach (smtp_dns_a_records($host) as $ip) {
        if ($secure === 'ssl') {
            $try[] = array('ssl_ip', $ip);
        } else {
            $try[] = array('tcp_ip', $ip);
        }
    }
    if ($secure === 'ssl') {
        $try[] = 'ssl://' . $host . ':' . $port;
    } else {
        $try[] = 'tcp://' . $host . ':' . $port;
    }

    foreach ($try as $item) {
        if (is_string($item)) {
            $fp = @stream_socket_client($item, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
            if ($fp) {
                return array($fp, null);
            }
            continue;
        }
        $ip = $item[1];
        if ($item[0] === 'tcp_ip') {
            $ctx = stream_context_create($sslCtx);
            $fp = @stream_socket_client('tcp://' . $ip . ':' . $port, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $ctx);
            if ($fp) {
                @stream_context_set_option($fp, 'ssl', 'peer_name', $host);
                return array($fp, $ip);
            }
        } else {
            $ctx = stream_context_create($sslCtx);
            $fp = @stream_socket_client('ssl://' . $ip . ':' . $port, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $ctx);
            if ($fp) {
                return array($fp, $ip);
            }
        }
    }
    return array(false, null);
}

function send_email_smtp($to, $subject, $body, $replyTo, $host, $port, $user, $pass, $secure = 'tls') {
    $timeout = 15;
    $errno = 0;
    $errstr = '';
    $ehloHost = smtp_ehlo_hostname($user);
    $from = smtp_mail_from_address($user);
    list($fp, $viaIp) = smtp_connect_with_ipv4_fallback($host, $port, $secure, $timeout, $errno, $errstr);
    if (!$fp) {
        $hint = '';
        if ($errno === 0 && $errstr === '') {
            $hint = ' hint=outbound port blocked, DNS, or IPv6; try telnet/nc from this host';
        } elseif ($errno === 110) {
            $hint = ' hint=connection timed out — try SMTP_PORT 587 + SMTP_SECURE tls, or check VPS firewall outbound to this host:port';
        }
        file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | smtp_tcp_failed host={$host} port={$port} err={$errno} msg={$errstr}{$hint}\n", FILE_APPEND | LOCK_EX);
        return false;
    }

    $viaNote = $viaIp !== null ? " via_ip={$viaIp}" : '';
    file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | smtp_tcp_ok host={$host} port={$port}{$viaNote}\n", FILE_APPEND | LOCK_EX);
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

    $h = $send('EHLO ' . $ehloHost);
    if (smtp_last_code($h) >= 400) {
        $fail('ehlo', $h);
        fclose($fp);
        return false;
    }

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

    file_put_contents(__DIR__ . '/email.log', gmdate('c') . ' | smtp_auth_ok auth_login=' . $user . ' envelope_from=' . $from . ' ehlo=' . $ehloHost . "\n", FILE_APPEND | LOCK_EX);

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

function send_email_simple($to, $subject, $body, $replyTo = '') {
    $smtpHost = get_env_value(array('SMTP_HOST', 'EMAIL_SMTP_HOST'), '');
    if ($smtpHost !== '') {
        $smtpPort = (int) get_env_value(array('SMTP_PORT', 'EMAIL_SMTP_PORT'), 587);
        $smtpUser = get_env_value(array('SMTP_USER', 'EMAIL_SMTP_USER'), '');
        $smtpPass = get_env_value(array('SMTP_PASS', 'EMAIL_SMTP_PASS'), '');
        $smtpSecure = strtolower(get_env_value(array('SMTP_SECURE', 'EMAIL_SMTP_SECURE'), 'tls'));
        return send_email_smtp($to, $subject, $body, $replyTo, $smtpHost, $smtpPort, $smtpUser, $smtpPass, $smtpSecure);
    }

    $headers = array();
    $headers[] = 'From: AnyTransport <' . smtp_mail_from_address('') . '>';
    if (trim((string) $replyTo) !== '') {
        $headers[] = 'Reply-To: ' . trim((string) $replyTo);
    }
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=utf-8';

    $hdr = implode("\r\n", $headers);
    try {
        $ok = @mail($to, $subject, $body, $hdr);
        file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | mail() to={$to} ok=" . ($ok ? '1' : '0') . "\n", FILE_APPEND | LOCK_EX);
        return $ok;
    } catch (Exception $e) {
        file_put_contents(__DIR__ . '/email.log', gmdate('c') . " | mail() to={$to} error=" . $e->getMessage() . "\n", FILE_APPEND | LOCK_EX);
        return false;
    }
}

}
