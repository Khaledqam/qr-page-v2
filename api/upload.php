<?php
// =============================================================
// AtoZ Store — Upload API  (v3)
// Accepts: icon (image/png|jpeg|webp)  ≤ 2 MB
// Returns: { ok, filename, url }
// =============================================================
declare(strict_types=1);
require_once __DIR__ . '/helpers.php';

secureSessionStart();
$user = requireAuth();
requirePermission($user, 'content');
verifyCsrf();

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_FILES['icon'])) {
    jsonResponse(['error' => 'لم يتم إرسال أي صورة'], 400);
}

$file = $_FILES['icon'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    jsonResponse(['error' => 'فشل رفع الملف (كود ' . $file['error'] . ')'], 400);
}

// Size limit: 2 MB
if ($file['size'] > 2 * 1024 * 1024) {
    jsonResponse(['error' => 'حجم الصورة أكبر من 2 ميجابايت'], 400);
}

// Real MIME check (not extension)
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$allowedMimes = [
    'image/png'     => 'png',
    'image/jpeg'    => 'jpg',
    'image/webp'    => 'webp',
];

if (!isset($allowedMimes[$mime])) {
    jsonResponse(['error' => 'نوع الملف غير مدعوم (png, jpg, webp فقط)'], 400);
}

// Generate safe random filename
$ext     = $allowedMimes[$mime];
$newName = 'icon_' . bin2hex(random_bytes(8)) . '.' . $ext;
$destDir = __DIR__ . '/../assets/img/icons';

if (!is_dir($destDir)) mkdir($destDir, 0750, true);

if (!move_uploaded_file($file['tmp_name'], "$destDir/$newName")) {
    jsonResponse(['error' => 'تعذر حفظ الملف على الخادم'], 500);
}

jsonResponse(['ok' => true, 'filename' => $newName, 'url' => "assets/img/icons/$newName"]);
