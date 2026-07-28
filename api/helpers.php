<?php
// =============================================================
// AtoZ Store — Shared API Helpers  (v3)
// =============================================================
declare(strict_types=1);

define('DATA_DIR', __DIR__ . '/../data');

// ---- RBAC permission map ----
// Roles: superadmin  →  all permissions
//        admin       →  manage links, content, branches, appearance
//        editor      →  edit links + content only (changes enter approval queue)
//        viewer      →  read-only (analytics tab only)
const ROLE_PERMISSIONS = [
    'superadmin' => ['*'],
    'admin'      => ['links', 'content', 'branches', 'appearance', 'import_export'],
    'editor'     => ['links', 'content'],
    'viewer'     => [],
];

// ---- JSON file helpers ----

/** Read a JSON file from /data safely. Returns null on failure. */
function readJson(string $filename): mixed
{
    $path = DATA_DIR . '/' . basename($filename);
    if (!file_exists($path)) return null;
    $fp = fopen($path, 'r');
    if (!$fp) return null;
    flock($fp, LOCK_SH);
    $contents = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $data = json_decode($contents, true);
    return json_last_error() === JSON_ERROR_NONE ? $data : null;
}

/** Write data to a JSON file atomically (tmp → rename). */
function writeJson(string $filename, mixed $data): bool
{
    $path    = DATA_DIR . '/' . basename($filename);
    $tmpPath = $path . '.tmp.' . bin2hex(random_bytes(4));
    $json    = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) return false;
    $fp = fopen($tmpPath, 'w');
    if (!$fp) return false;
    flock($fp, LOCK_EX);
    fwrite($fp, $json);
    flock($fp, LOCK_UN);
    fclose($fp);
    return rename($tmpPath, $path);
}

/** Keep last N backups per file. */
function backupBeforeWrite(string $filename, int $keep = 5): void
{
    $path = DATA_DIR . '/' . basename($filename);
    if (!file_exists($path)) return;
    $backupDir = DATA_DIR . '/backups';
    if (!is_dir($backupDir)) mkdir($backupDir, 0750, true);
    $stamp = date('Ymd_His');
    copy($path, "$backupDir/" . basename($filename) . ".$stamp.bak");
    $files = glob("$backupDir/" . basename($filename) . '.*.bak') ?: [];
    if (count($files) > $keep) {
        usort($files, fn($a, $b) => filemtime($a) <=> filemtime($b));
        foreach (array_slice($files, 0, count($files) - $keep) as $f) {
            unlink($f);
        }
    }
}

// ---- HTTP helpers ----

/** Send a JSON response and halt. */
function jsonResponse(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    // CSRF: prevent CORB leaking
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Verify CSRF token in POST/PUT/DELETE. Token generated in session and sent as header X-CSRF-Token. */
function verifyCsrf(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'], true)) {
        $headerToken  = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        $sessionToken = $_SESSION['csrf_token'] ?? '';
        if (!$sessionToken || !hash_equals($sessionToken, $headerToken)) {
            jsonResponse(['error' => 'CSRF token غير صالح'], 403);
        }
    }
}

// ---- Auth & session ----

/** Start session with secure cookie params. */
function secureSessionStart(): void
{
    if (session_status() !== PHP_SESSION_NONE) return;
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => isset($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
    // Issue CSRF token if not yet set
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
}

/**
 * Require an active authenticated session.
 * Returns the current user array.
 */
function requireAuth(): array
{
    secureSessionStart();
    // Check standard session login
    if (!empty($_SESSION['admin_user'])) {
        $users = readJson('users.json') ?? [];
        foreach ($users as $u) {
            if ($u['username'] === $_SESSION['admin_user']) {
                return $u;
            }
        }
    }
    // Check remember-me token from cookie
    $rmToken = $_COOKIE['atoz_rm'] ?? '';
    if ($rmToken) {
        $users = readJson('users.json') ?? [];
        foreach ($users as $u) {
            foreach ($u['remember_tokens'] ?? [] as $rt) {
                if (isset($rt['expires']) && time() > $rt['expires']) continue;
                if (hash_equals($rt['token_hash'], hash('sha256', $rmToken))) {
                    // Restore session
                    $_SESSION['admin_user'] = $u['username'];
                    return $u;
                }
            }
        }
    }
    jsonResponse(['error' => 'غير مصرح لك بالدخول'], 401);
}

/**
 * Check if the current user has a specific permission.
 * Superadmin has wildcard '*'.
 */
function userCan(array $user, string $permission): bool
{
    $role  = $user['role'] ?? 'viewer';
    $perms = ROLE_PERMISSIONS[$role] ?? [];
    return in_array('*', $perms, true) || in_array($permission, $perms, true);
}

/**
 * Require a specific permission or return 403.
 */
function requirePermission(array $user, string $permission): void
{
    if (!userCan($user, $permission)) {
        jsonResponse(['error' => 'لا تملك صلاحية هذا الإجراء'], 403);
    }
}

// ---- Approval queue helpers ----

/**
 * Push a change to the approval queue instead of applying it directly.
 * Used when an 'editor' role tries to modify data.
 */
function queueForApproval(array $user, string $resource, mixed $payload): void
{
    $queue = readJson('approval_queue.json') ?? [];
    $queue[] = [
        'id'         => 'apv_' . bin2hex(random_bytes(8)),
        'submitted_by' => $user['username'],
        'resource'   => $resource,
        'payload'    => $payload,
        'status'     => 'pending',
        'created_at' => date('c'),
    ];
    writeJson('approval_queue.json', $queue);
    jsonResponse(['ok' => true, 'queued' => true, 'message' => 'تم إرسال تعديلاتك للمراجعة من قِبَل المدير الرئيسي']);
}

// ---- Sanitisation helpers ----

/** Strip all HTML except safe formatting tags. */
function sanitiseBioHtml(string $html): string
{
    return strip_tags($html, '<p><br><b><strong><i><em><u><ul><ol><li><a><span>');
}

/** Sanitise a URL — returns empty string on failure. */
function sanitiseUrl(string $url): string
{
    $url = trim($url);
    $clean = filter_var($url, FILTER_SANITIZE_URL);
    // Allow https, http, tel, mailto, wa.me shortlinks
    if (preg_match('/^(https?:\/\/|tel:|mailto:|waze:\/\/)/i', $clean ?? '')) {
        return $clean;
    }
    return '';
}
