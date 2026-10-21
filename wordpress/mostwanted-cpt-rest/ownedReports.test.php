<?php
define('ABSPATH', __DIR__);
define('MOSTWANTED_API_SECRET', 'test-secret');
function add_action(...$args) {}
function add_filter(...$args) {}
function register_activation_hook(...$args) {}
function register_deactivation_hook(...$args) {}
function register_rest_route($namespace, $path, $args) { $GLOBALS['routes'][$path] = $args; }
function get_the_title($id) { return 'Player'; }
function wp_strip_all_tags($text) { return strip_tags($text); }
function current_time($format) { return '2026-10-21 12:00:00'; }
function get_post_meta($id, $key, $single) { return $GLOBALS['meta'][$id][$key] ?? ''; }
function update_post_meta($id, $key, $value) { $GLOBALS['meta'][$id][$key] = $value; }
function wp_insert_post($post, $error) { return ++$GLOBALS['last_id']; }
function is_wp_error($value) { return $value instanceof WP_Error; }
function get_posts($query) {
    if ($query['meta_key'] !== '_mw_owner_discord_id') throw new RuntimeException('Ownership filter required');
    $ids = [];
    foreach (array_reverse($GLOBALS['meta'], true) as $id => $meta) {
        if (($meta['_mw_owner_discord_id'] ?? '') === $query['meta_value']) $ids[] = $id;
    }
    return array_slice($ids, $query['offset'], $query['numberposts']);
}
class WP_Error {
    public function __construct(public $code, public $message, public $data) {}
}
class WP_REST_Server {
    const READABLE = 'GET';
    const CREATABLE = 'POST';
}
class WP_REST_Response {
    public $headers = [];
    public function __construct(public $data, public $status) {}
    public function header($name, $value) { $this->headers[$name] = $value; }
}
class Request {
    public function __construct(private $params = [], private $token = '') {}
    public function get_param($name) { return $this->params[$name] ?? null; }
    public function get_header($name) { return $name === 'authorization' ? $this->token : ''; }
}
require __DIR__ . DIRECTORY_SEPARATOR . 'mostwanted-cpt-rest.php';
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
$GLOBALS['meta'] = [];
$GLOBALS['last_id'] = 0;
$base = ['nickname' => 'Player', 'rid' => '123', 'reason' => 'Denuncia'];
$first = mw_store_report(1, $base + ['ownerDiscordId' => '111']);
$other = mw_store_report(1, $base + ['ownerDiscordId' => '222']);
$second = mw_store_report(1, $base + ['ownerDiscordId' => '111']);
$legacy = mw_store_report(1, $base + ['reporter' => ['name' => '111']]);
check(get_post_meta($first, '_mw_owner_discord_id', true) === '111', 'Persist private stable owner');
check(!isset($GLOBALS['meta'][$legacy]['_mw_owner_discord_id']), 'Never infer ownership from names');
mw_register_rest_routes();
check($GLOBALS['routes']['/reports/owned']['permission_callback'] === 'mw_can_ingest_reports', 'Protect private route with backend secret');
check(mw_can_ingest_reports(new Request()) instanceof WP_Error, 'Reject anonymous private queries');
check(mw_can_ingest_reports(new Request([], 'Bearer wrong')) instanceof WP_Error, 'Reject wrong token');
check(mw_can_ingest_reports(new Request([], 'Bearer test-secret')) === true, 'Accept backend secret');
$response = mw_rest_owned_reports(new Request(['ownerDiscordId' => '111', 'per_page' => 1]));
check(array_column($response->data['items'], 'id') === [$second], 'Only return owner reports with newest first');
check($response->data['hasMore'] === true, 'Return accurate next page flag');
check($response->headers['Cache-Control'] === 'private, no-store', 'Never cache private responses');
check(!isset($response->data['items'][0]['ownerDiscordId']), 'Ownership stays private even in owned report data');
$next = mw_rest_owned_reports(new Request(['ownerDiscordId' => '111', 'per_page' => 1, 'page' => 2]));
check(array_column($next->data['items'], 'id') === [$first] && !$next->data['hasMore'], 'Paginate without leaking another owner');
check(mw_rest_owned_reports(new Request(['ownerDiscordId' => 'invalid']))->status === 400, 'Reject invalid owner');
echo "OK private ownership storage, permission, isolation, pagination and privacy\n";
