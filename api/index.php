<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$storeDir = __DIR__ . '/data';
$storeFile = $storeDir . '/anytransport-store.json';
$action = isset($_GET['action']) ? trim((string) $_GET['action']) : '';
$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';

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

    return $normalized;
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
            'role' => $role
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
        $normalized = normalize_user($user);
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
        $messages = array_values($store['messages']);
        if ($userId !== '') {
            $messages = array_values(array_filter($messages, function ($message) use ($userId) {
                return trim((string) ($message['userId'] ?? '')) === $userId;
            }));
        }
        send_json(array('ok' => true, 'messages' => $messages));

    case 'messages.save':
        $userId = trim((string) ($input['userId'] ?? ''));
        $message = is_array($input['message'] ?? null) ? $input['message'] : array();
        $text = trim((string) ($message['text'] ?? ''));
        if ($userId === '' || $text === '') {
            send_json(array('ok' => false, 'error' => 'Message text is required.'), 400);
        }

        $messages = array_values(array_filter($store['messages'], function ($existing) use ($userId, $text) {
            return !(trim((string) ($existing['userId'] ?? '')) === $userId && trim((string) ($existing['text'] ?? '')) === $text);
        }));

        $savedMessage = array(
            'id' => !empty($message['id']) ? (string) $message['id'] : make_id('msg'),
            'userId' => $userId,
            'text' => $text,
            'title' => trim((string) ($message['title'] ?? '')) ?: mb_substr($text, 0, 50),
            'createdAt' => !empty($message['createdAt']) ? (string) $message['createdAt'] : gmdate('c')
        );

        array_unshift($messages, $savedMessage);
        $store['messages'] = array_slice($messages, 0, 20);
        write_store($storeFile, $store);
        send_json(array('ok' => true, 'message' => $savedMessage));

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

    default:
        send_json(array('ok' => false, 'error' => 'Unknown action.'), 404);
}
