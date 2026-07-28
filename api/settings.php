<?php
// =============================================================
// AtoZ Store — Settings API  (v3)
// GET  → public (strips admin-only fields like tracking scripts)
// POST → update (auth required, field-allowlisted)
// =============================================================
declare(strict_types=1);
require_once __DIR__ . '/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];

// ---- GET ----
if ($method === 'GET') {
    $settings = readJson('settings.json') ?? [];

    // Determine if requester is admin
    secureSessionStart();
    $isAdmin = !empty($_SESSION['admin_user']);

    if (!$isAdmin) {
        // Never expose tracking scripts or admin-only metadata to the public page
        unset($settings['tracking_scripts_head'], $settings['tracking_scripts_body']);
    }

    jsonResponse($settings);
}

// ---- POST ----
if ($method === 'POST') {
    secureSessionStart();
    $user = requireAuth();
    verifyCsrf();

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        jsonResponse(['error' => 'بيانات غير صالحة'], 400);
    }

    $current = readJson('settings.json') ?? [];

    // --- Merge only allowed fields per permission ---

    // Content fields
    if (userCan($user, 'content')) {
        if (isset($input['store_name'])) {
            $current['store_name'] = strip_tags((string)$input['store_name']);
        }
        if (isset($input['tagline'])) {
            $current['tagline'] = strip_tags((string)$input['tagline']);
        }
        if (isset($input['bio_html'])) {
            $current['bio_html'] = sanitiseBioHtml((string)$input['bio_html']);
        }
        if (isset($input['footer_text'])) {
            $current['footer_text'] = strip_tags((string)$input['footer_text']);
        }
        if (isset($input['website_url'])) {
            $current['website_url'] = sanitiseUrl((string)$input['website_url']);
        }
        if (isset($input['phone'])) {
            // Digits and spaces only
            $current['phone'] = preg_replace('/[^0-9\s\+\-]/', '', (string)$input['phone']);
        }
        if (isset($input['logo_url'])) {
            // Only allow filenames from our own icon folder
            $current['logo_url'] = 'assets/img/icons/' . basename((string)$input['logo_url']);
        }
        if (isset($input['logo_shape'])) {
            $current['logo_shape'] = in_array($input['logo_shape'], ['circle', 'rounded', 'original'], true)
                ? $input['logo_shape'] : 'circle';
        }
        if (isset($input['logo_glow'])) {
            $current['logo_glow'] = (bool)$input['logo_glow'];
        }
    }

    // Branches
    if (userCan($user, 'branches') && isset($input['branches']) && is_array($input['branches'])) {
        $branches = [];
        foreach ($input['branches'] as $i => $b) {
            if (empty($b['name'])) continue;
            $mapsUrl = sanitiseUrl((string)($b['maps_url'] ?? ''));
            $branches[] = [
                'id'       => preg_match('/^br_[0-9]+$/', $b['id'] ?? '') ? $b['id'] : ('br_' . time() . '_' . $i),
                'name'     => strip_tags((string)$b['name']),
                'maps_url' => $mapsUrl,
                'whatsapp' => preg_replace('/[^0-9]/', '', (string)($b['whatsapp'] ?? '')),
                'order'    => (int)($b['order'] ?? ($i + 1)),
            ];
        }
        // Sort by explicit order field
        usort($branches, fn($a, $b) => $a['order'] <=> $b['order']);
        $current['branches'] = $branches;
    }

    // App links
    if (userCan($user, 'links') && isset($input['app_links']) && is_array($input['app_links'])) {
        $current['app_links'] = [
            'android'            => sanitiseUrl((string)($input['app_links']['android'] ?? '')),
            'ios'                => sanitiseUrl((string)($input['app_links']['ios'] ?? '')),
            'app_block_position' => in_array($input['app_links']['app_block_position'] ?? 'bottom', ['top', 'bottom'], true)
                ? $input['app_links']['app_block_position'] : 'bottom',
        ];
    }

    // Appearance
    if (userCan($user, 'appearance') && isset($input['appearance']) && is_array($input['appearance'])) {
        $a = $input['appearance'];
        $current['appearance'] = [
            'background_color' => preg_match('/^#[0-9a-fA-F]{6}$/', $a['background_color'] ?? '') ? $a['background_color'] : '#0c1727',
            'primary_color'    => preg_match('/^#[0-9a-fA-F]{6}$/', $a['primary_color'] ?? '')    ? $a['primary_color']    : '#00bed9',
            'secondary_color'  => preg_match('/^#[0-9a-fA-F]{6}$/', $a['secondary_color'] ?? '')  ? $a['secondary_color']  : '#ffffff',
            'layout_style'     => in_array($a['layout_style'] ?? 'list', ['list', 'grid'], true)   ? $a['layout_style']     : 'list',
            'card_style'       => in_array($a['card_style'] ?? 'glass', ['glass', 'elevated', 'outline', 'flat'], true) ? $a['card_style'] : 'glass',
        ];
    }

    // Tracking scripts — superadmin / admin only
    if (userCan($user, '*') || userCan($user, 'appearance')) {
        if (isset($input['tracking_scripts_head'])) {
            // Sanitize tracking scripts: strip PHP tags, allow only safe script patterns
            $script = (string)$input['tracking_scripts_head'];
            // Remove any PHP code
            $script = preg_replace('/<\?php.*?\?>/', '', $script);
            $script = preg_replace('/<\?.*?\?>/', '', $script);
            // Remove dangerous patterns like event handlers in inline scripts
            $script = preg_replace('/on\w+\s*=/i', '', $script);
            $current['tracking_scripts_head'] = $script;
        }
        if (isset($input['tracking_scripts_body'])) {
            $script = (string)$input['tracking_scripts_body'];
            // Remove any PHP code
            $script = preg_replace('/<\?php.*?\?>/', '', $script);
            $script = preg_replace('/<\?.*?\?>/', '', $script);
            // Remove dangerous patterns like event handlers in inline scripts
            $script = preg_replace('/on\w+\s*=/i', '', $script);
            $current['tracking_scripts_body'] = $script;
        }
    }

    // Editors go to approval queue for settings changes too
    if (($user['role'] ?? '') === 'editor') {
        queueForApproval($user, 'settings', $input);
    }

    backupBeforeWrite('settings.json');
    if (!writeJson('settings.json', $current)) {
        jsonResponse(['error' => 'فشل حفظ الإعدادات'], 500);
    }

    jsonResponse(['ok' => true, 'settings' => $current]);
}

jsonResponse(['error' => 'طريقة غير مدعومة'], 405);
