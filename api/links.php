<?php
// =============================================================
// AtoZ Store — Links API  (v3)
// GET  → public (active only) / admin (all)
// POST → save full link array (auth required; editor → queue)
// =============================================================
declare(strict_types=1);
require_once __DIR__ . '/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];

// ---- GET: public or admin ----
if ($method === 'GET') {
    secureSessionStart();
    $isAdmin = !empty($_SESSION['admin_user']);

    $links = readJson('links.json') ?? [];
    if (!$isAdmin) {
        $links = array_values(array_filter($links, fn($l) => !empty($l['active'])));
    }
    usort($links, fn($a, $b) => ($a['order'] ?? 0) <=> ($b['order'] ?? 0));
    jsonResponse(['links' => $links]);
}

// ---- POST: save ----
if ($method === 'POST') {
    secureSessionStart();
    $user = requireAuth();
    requirePermission($user, 'links');
    verifyCsrf();

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input) || !isset($input['links']) || !is_array($input['links'])) {
        jsonResponse(['error' => 'بيانات غير صالحة'], 400);
    }

    $links = [];
    foreach ($input['links'] as $i => $link) {
        if (empty($link['title']) || empty($link['url'])) continue;

        $url = sanitiseUrl((string)($link['url'] ?? ''));
        if (!$url) continue;

        $links[] = [
            'id'          => preg_match('/^lnk_[a-zA-Z0-9_]+$/', $link['id'] ?? '') ? $link['id'] : ('lnk_' . bin2hex(random_bytes(6))),
            'title'       => strip_tags((string)$link['title']),
            'url'         => $url,
            'icon'        => isset($link['icon']) ? basename((string)$link['icon']) : '',
            'icon_source' => in_array($link['icon_source'] ?? 'auto', ['auto', 'upload'], true) ? $link['icon_source'] : 'auto',
            'type'        => preg_replace('/[^a-z0-9_]/', '', strtolower((string)($link['type'] ?? 'custom'))),
            'active'      => (bool)($link['active'] ?? true),
            'order'       => $i + 1,
        ];
    }

    // Editors → approval queue
    if (($user['role'] ?? '') === 'editor') {
        queueForApproval($user, 'links', $links);
    }

    backupBeforeWrite('links.json');
    if (!writeJson('links.json', $links)) {
        jsonResponse(['error' => 'فشل حفظ البيانات على الخادم'], 500);
    }

    jsonResponse(['ok' => true, 'links' => $links]);
}

jsonResponse(['error' => 'طريقة غير مدعومة'], 405);
