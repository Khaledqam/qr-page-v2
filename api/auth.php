<?php
// =============================================================
// AtoZ Store — Auth API  (v3)
// Actions: login | logout | check | csrf
//          users_list | users_create | users_update | users_delete
// =============================================================
declare(strict_types=1);
require_once __DIR__ . '/helpers.php';

secureSessionStart();

$input  = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? $_GET['action'] ?? '';

// ---- CSRF token delivery (GET only — safe method) ----
if ($action === 'csrf') {
    jsonResponse(['csrf_token' => $_SESSION['csrf_token'] ?? '']);
}

// ---- Login ----
if ($action === 'login') {
    $username   = trim((string)($input['username'] ?? ''));
    $password   = (string)($input['password'] ?? '');
    $rememberMe = (bool)($input['remember_me'] ?? false);

    // Rate limiting via session AND IP address
    $_SESSION['login_attempts'] ??= 0;
    $_SESSION['locked_until']   ??= 0;
    
    // IP-based rate limiting
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ipAttemptsFile = DATA_DIR . '/.rate_limit_' . md5($ip);
    $ipData = file_exists($ipAttemptsFile) ? json_decode(file_get_contents($ipAttemptsFile), true) : ['attempts' => 0, 'locked_until' => 0];
    
    // Check IP lock first
    if (time() < ($ipData['locked_until'] ?? 0)) {
        $remaining = ($ipData['locked_until'] ?? time()) - time();
        jsonResponse(['error' => "محاولات كثيرة من هذا العنوان، انتظر $remaining ثانية"], 429);
    }
    
    // Check session lock
    if (time() < (int)$_SESSION['locked_until']) {
        $remaining = (int)$_SESSION['locked_until'] - time();
        jsonResponse(['error' => "محاولات كثيرة، انتظر $remaining ثانية"], 429);
    }

    if (empty($username) || empty($password)) {
        jsonResponse(['error' => 'يرجى إدخال اسم المستخدم وكلمة المرور'], 400);
    }

    $users = readJson('users.json') ?? [];
    $match = null;
    foreach ($users as $u) {
        if (hash_equals($u['username'], $username)) {
            $match = $u;
            break;
        }
    }

    if ($match && password_verify($password, $match['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['admin_user']     = $username;
        $_SESSION['login_attempts'] = 0;
        // Refresh CSRF token on login
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        // Reset IP attempts on successful login
        if (file_exists($ipAttemptsFile)) @unlink($ipAttemptsFile);

        if ($rememberMe) {
            $rawToken   = bin2hex(random_bytes(32));
            $tokenHash  = hash('sha256', $rawToken);
            $expires    = time() + 30 * 24 * 3600; // 30 days

            // Store hash in users.json
            $users = readJson('users.json') ?? [];
            foreach ($users as &$u) {
                if ($u['username'] === $username) {
                    $u['remember_tokens']   ??= [];
                    // Prune expired tokens
                    $u['remember_tokens'] = array_values(array_filter(
                        $u['remember_tokens'],
                        fn($t) => ($t['expires'] ?? 0) > time()
                    ));
                    $u['remember_tokens'][] = [
                        'token_hash' => $tokenHash,
                        'expires'    => $expires,
                        'issued_at'  => date('c'),
                    ];
                    break;
                }
            }
            unset($u);
            writeJson('users.json', $users);

            // Set HttpOnly Secure cookie
            setcookie('atoz_rm', $rawToken, [
                'expires'  => $expires,
                'path'     => '/',
                'secure'   => isset($_SERVER['HTTPS']),
                'httponly' => true,
                'samesite' => 'Strict',
            ]);
        }

        jsonResponse([
            'ok'          => true,
            'username'    => $username,
            'role'        => $match['role'] ?? 'viewer',
            'csrf_token'  => $_SESSION['csrf_token'],
        ]);
    }

    // Increment both session and IP attempts
    $_SESSION['login_attempts']++;
    $ipData['attempts'] = ($ipData['attempts'] ?? 0) + 1;
    
    if ($_SESSION['login_attempts'] >= 5 || $ipData['attempts'] >= 5) {
        $_SESSION['locked_until'] = time() + 900; // 15 min
        $ipData['locked_until'] = time() + 900;
        file_put_contents($ipAttemptsFile, json_encode($ipData));
    } else {
        file_put_contents($ipAttemptsFile, json_encode($ipData));
    }
    
    jsonResponse(['error' => 'اسم المستخدم أو كلمة المرور غير صحيحة'], 401);
}

// ---- Logout ----
if ($action === 'logout') {
    // Revoke remember-me token if present
    $rmToken = $_COOKIE['atoz_rm'] ?? '';
    if ($rmToken) {
        $tokenHash = hash('sha256', $rmToken);
        $users = readJson('users.json') ?? [];
        foreach ($users as &$u) {
            $u['remember_tokens'] = array_values(array_filter(
                $u['remember_tokens'] ?? [],
                fn($t) => $t['token_hash'] !== $tokenHash
            ));
        }
        unset($u);
        writeJson('users.json', $users);
        setcookie('atoz_rm', '', ['expires' => 1, 'path' => '/', 'secure' => isset($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Strict']);
    }
    $_SESSION = [];
    session_destroy();
    jsonResponse(['ok' => true]);
}

// ---- Check auth status ----
if ($action === 'check') {
    $authenticated = !empty($_SESSION['admin_user']);
    $role = '';
    $displayName = '';
    if ($authenticated) {
        $users = readJson('users.json') ?? [];
        foreach ($users as $u) {
            if ($u['username'] === $_SESSION['admin_user']) {
                $role        = $u['role'] ?? 'viewer';
                $displayName = $u['display_name'] ?? $u['username'];
                break;
            }
        }
    }
    jsonResponse([
        'authenticated' => $authenticated,
        'role'          => $role,
        'display_name'  => $displayName,
        'csrf_token'    => $_SESSION['csrf_token'] ?? '',
    ]);
}

// ======================================================
// User management — Superadmin only beyond this point
// ======================================================

$currentUser = requireAuth();
verifyCsrf();

if ($action === 'users_list') {
    requirePermission($currentUser, '*');
    $users = readJson('users.json') ?? [];
    // Strip hashes and tokens from response
    $safe = array_map(fn($u) => [
        'id'           => $u['id'] ?? '',
        'username'     => $u['username'],
        'role'         => $u['role'] ?? 'viewer',
        'display_name' => $u['display_name'] ?? $u['username'],
        'created_at'   => $u['created_at'] ?? '',
    ], $users);
    jsonResponse(['users' => $safe]);
}

// Profile update - change own password and display name (available to all users)
if ($action === 'profile_update') {
    $newDisplay = $input['display_name'] ?? null;
    $currentPassword = $input['current_password'] ?? null;
    $newPassword = $input['new_password'] ?? null;
    
    $users = readJson('users.json') ?? [];
    $found = false;
    foreach ($users as &$u) {
        if ($u['username'] === $currentUser['username']) {
            if ($newDisplay) {
                $u['display_name'] = trim($newDisplay);
            }
            if ($newPassword && $currentPassword) {
                // Verify current password first
                if (!password_verify($currentPassword, $u['password_hash'])) {
                    jsonResponse(['error' => 'كلمة المرور الحالية غير صحيحة'], 401);
                }
                if (strlen($newPassword) < 8) {
                    jsonResponse(['error' => 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'], 400);
                }
                $u['password_hash'] = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
            } elseif ($newPassword && !$currentPassword) {
                jsonResponse(['error' => 'يجب إدخال كلمة المرور الحالية لتغييرها'], 400);
            }
            $found = true;
            break;
        }
    }
    unset($u);
    if (!$found) jsonResponse(['error' => 'المستخدم غير موجود'], 404);
    backupBeforeWrite('users.json');
    writeJson('users.json', $users);
    jsonResponse(['ok' => true, 'message' => 'تم تحديث الملف الشخصي']);
}

if ($action === 'users_create') {
    requirePermission($currentUser, '*');
    $newUsername    = trim((string)($input['username'] ?? ''));
    $newPassword    = (string)($input['password'] ?? '');
    $newRole        = $input['role'] ?? 'editor';
    $newDisplayName = trim((string)($input['display_name'] ?? $newUsername));

    if (!preg_match('/^[a-z0-9_]{3,32}$/i', $newUsername)) {
        jsonResponse(['error' => 'اسم المستخدم غير صالح (أحرف وأرقام وشرطة سفلية فقط، 3-32 حرف)'], 400);
    }
    if (strlen($newPassword) < 8) {
        jsonResponse(['error' => 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'], 400);
    }
    if (!array_key_exists($newRole, ROLE_PERMISSIONS)) {
        jsonResponse(['error' => 'الدور غير صالح'], 400);
    }
    if ($newRole === 'superadmin') {
        jsonResponse(['error' => 'لا يمكن إنشاء superadmin إضافي'], 403);
    }

    $users = readJson('users.json') ?? [];
    foreach ($users as $u) {
        if (hash_equals($u['username'], $newUsername)) {
            jsonResponse(['error' => 'اسم المستخدم مستخدم بالفعل'], 409);
        }
    }

    $newUser = [
        'id'              => 'usr_' . bin2hex(random_bytes(8)),
        'username'        => $newUsername,
        'password_hash'   => password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]),
        'role'            => $newRole,
        'display_name'    => $newDisplayName,
        'created_at'      => date('c'),
        'remember_tokens' => [],
    ];
    $users[] = $newUser;
    backupBeforeWrite('users.json');
    writeJson('users.json', $users);
    jsonResponse(['ok' => true, 'user' => ['id' => $newUser['id'], 'username' => $newUser['username'], 'role' => $newUser['role']]]);
}

if ($action === 'users_update') {
    requirePermission($currentUser, '*');
    $targetId    = (string)($input['id'] ?? '');
    $newRole     = $input['role'] ?? null;
    $newPassword = $input['password'] ?? null;
    $newDisplay  = $input['display_name'] ?? null;

    if (!$targetId) jsonResponse(['error' => 'id مطلوب'], 400);

    $users = readJson('users.json') ?? [];
    $found = false;
    foreach ($users as &$u) {
        if ($u['id'] === $targetId) {
            // Prevent users from modifying their own role or password via this endpoint
            if ($u['username'] === $currentUser['username']) {
                jsonResponse(['error' => 'لا يمكنك تعديل حسابك الخاص من هنا، استخدم صفحة الملف الشخصي'], 403);
            }
            // Protect the superadmin row from role demotion
            if ($u['role'] === 'superadmin' && $newRole && $newRole !== 'superadmin') {
                jsonResponse(['error' => 'لا يمكن تغيير دور حساب super admin'], 403);
            }
            if ($newRole && array_key_exists($newRole, ROLE_PERMISSIONS)) {
                $u['role'] = $newRole;
            }
            if ($newPassword && strlen($newPassword) >= 8) {
                $u['password_hash'] = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
            }
            if ($newDisplay) $u['display_name'] = trim($newDisplay);
            $found = true;
            break;
        }
    }
    unset($u);
    if (!$found) jsonResponse(['error' => 'المستخدم غير موجود'], 404);
    backupBeforeWrite('users.json');
    writeJson('users.json', $users);
    jsonResponse(['ok' => true]);
}

if ($action === 'users_delete') {
    requirePermission($currentUser, '*');
    $targetId = (string)($input['id'] ?? '');
    if (!$targetId) jsonResponse(['error' => 'id مطلوب'], 400);

    $users = readJson('users.json') ?? [];
    $target = null;
    foreach ($users as $u) { if ($u['id'] === $targetId) { $target = $u; break; } }
    if (!$target) jsonResponse(['error' => 'المستخدم غير موجود'], 404);
    if ($target['role'] === 'superadmin') jsonResponse(['error' => 'لا يمكن حذف حساب super admin'], 403);
    if ($target['username'] === $currentUser['username']) jsonResponse(['error' => 'لا يمكنك حذف حسابك الخاص'], 403);

    $users = array_values(array_filter($users, fn($u) => $u['id'] !== $targetId));
    backupBeforeWrite('users.json');
    writeJson('users.json', $users);
    jsonResponse(['ok' => true]);
}

jsonResponse(['error' => 'إجراء غير معروف'], 400);
