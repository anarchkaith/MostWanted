<?php
/**
 * Direct test endpoint for reports - bypasses plugin loading issues
 */

// Simulate WordPress environment
define('ABSPATH', __DIR__ . '/wordpress/');

// Load WordPress minimally
if (file_exists(ABSPATH . 'wp-load.php')) {
    require_once(ABSPATH . 'wp-load.php');
} else {
    die('WordPress not found');
}

// Get parameters
$nickname = isset($_GET['nickname']) ? sanitize_text_field($_GET['nickname']) : '';
$rid = isset($_GET['rid']) ? sanitize_text_field($_GET['rid']) : '';
$page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;

header('Content-Type: application/json');

if (!$nickname && !$rid) {
    echo json_encode(['ok' => false, 'error' => 'Missing nickname or rid']);
    exit;
}

// Get all reports
$args = [
    'post_type' => 'mw_report',
    'post_status' => 'publish',
    'numberposts' => -1,
    'fields' => 'ids',
];

$all_post_ids = get_posts($args);
$matches = [];

foreach ($all_post_ids as $post_id) {
    $post = get_post($post_id);
    $title = $post->post_title;
    
    // Parse title: "Nickname [RID 123456]"
    $parsed_rid = null;
    if (preg_match('/\[RID\s+(\d+)\]/i', $title, $m)) {
        $parsed_rid = $m[1];
    }
    $parsed_nickname = preg_replace('/\s*\[RID\s+\d+\]\s*$/i', '', $title);
    
    // Match criteria
    $match = false;
    if ($rid) {
        $match = ($parsed_rid === $rid);
    } elseif ($nickname) {
        // Case-insensitive, accent-insensitive
        $search_norm = preg_replace('/\s+/', ' ', strtolower(remove_accents($nickname)));
        $title_norm = preg_replace('/\s+/', ' ', strtolower(remove_accents($parsed_nickname)));
        $match = ($title_norm === $search_norm);
    }
    
    if ($match) {
        $matches[] = $post_id;
    }
}

echo json_encode([
    'ok' => true,
    'page' => $page,
    'perPage' => 25,
    'total' => count($matches),
    'items' => array_slice($matches, 0, 5),
    'debug' => [
        'searched_nickname' => $nickname,
        'searched_rid' => $rid,
    ]
]);
?>
