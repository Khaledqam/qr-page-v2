<?php
// =============================================================
// AtoZ Store — Approval Queue API  (v3)
// Actions (POST body):
//   list    → return pending items
//   approve → apply change live
//   reject  → discard with optional note
// =============================================================
declare(strict_types=1);
require_once __DIR__ . '/helpers.php';

secureSessionStart();
$user = requireAuth();
// Only admin+ can act on the queue
if (!userCan($user, '*') && !userCan($user, 'links')) {
    jsonResponse(['error' => 'غير مصرح'], 403);
}

$input  = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? $_GET['action'] ?? 'list';
verifyCsrf();

if ($action === 'list') {
    $queue = readJson('approval_queue.json') ?? [];
    jsonResponse(['queue' => $queue]);
}

if ($action === 'approve') {
    $id    = (string)($input['id'] ?? '');
    $queue = readJson('approval_queue.json') ?? [];
    $item  = null;
    foreach ($queue as $q) { if ($q['id'] === $id) { $item = $q; break; } }
    if (!$item) jsonResponse(['error' => 'العنصر غير موجود'], 404);
    if ($item['status'] !== 'pending') jsonResponse(['error' => 'العنصر ليس في حالة انتظار'], 400);

    // Apply the change
    $resource = $item['resource'];
    $payload  = $item['payload'];

    if ($resource === 'links') {
        backupBeforeWrite('links.json');
        writeJson('links.json', $payload);
    } elseif ($resource === 'settings') {
        // Delegate to settings logic by merging
        $current = readJson('settings.json') ?? [];
        foreach (['store_name','tagline','bio_html','footer_text','website_url','phone','logo_url','logo_shape','logo_glow','branches','app_links','appearance'] as $f) {
            if (isset($payload[$f])) $current[$f] = $payload[$f];
        }
        backupBeforeWrite('settings.json');
        writeJson('settings.json', $current);
    }

    // Mark as approved
    $queue = array_map(function ($q) use ($id, $user) {
        if ($q['id'] === $id) {
            $q['status']      = 'approved';
            $q['reviewed_by'] = $user['username'];
            $q['reviewed_at'] = date('c');
        }
        return $q;
    }, $queue);
    writeJson('approval_queue.json', $queue);
    jsonResponse(['ok' => true]);
}

if ($action === 'reject') {
    $id   = (string)($input['id'] ?? '');
    $note = strip_tags((string)($input['note'] ?? ''));
    $queue = readJson('approval_queue.json') ?? [];
    $found = false;
    foreach ($queue as &$q) {
        if ($q['id'] === $id) {
            $q['status']      = 'rejected';
            $q['reviewed_by'] = $user['username'];
            $q['reviewed_at'] = date('c');
            $q['reject_note'] = $note;
            $found = true;
            break;
        }
    }
    unset($q);
    if (!$found) jsonResponse(['error' => 'العنصر غير موجود'], 404);
    writeJson('approval_queue.json', $queue);
    jsonResponse(['ok' => true]);
}

jsonResponse(['error' => 'إجراء غير معروف'], 400);
