<?php
define('ABSPATH', __DIR__);
define('MOSTWANTED_API_SECRET', 'test-secret');
function add_action(...$args) {}
function add_filter(...$args) {}
function register_activation_hook(...$args) {}
function register_deactivation_hook(...$args) {}
function register_rest_route($namespace, $path, $args) {}
function get_the_title($id) { return 'Player'; }
function get_post($id) { return null; }
function wp_strip_all_tags($text) { return strip_tags($text); }
function current_time($format) { return '2026-10-21 12:00:00'; }
function get_post_meta($id, $key, $single) { return $GLOBALS['meta'][$id][$key] ?? ''; }
function update_post_meta($id, $key, $value) { $GLOBALS['meta'][$id][$key] = $value; }
function update_meta_cache($type, $ids) {}
function remove_accents($value) { return strtr($value, ['ó' => 'o', 'Ó' => 'O', 'é' => 'e', 'á' => 'a']); }
function wp_insert_post($post, $error) { return ++$GLOBALS['last_id']; }
function is_wp_error($value) { return $value instanceof WP_Error; }
function get_posts($query) {
    if ($query['post_type'] !== 'mw_report' || $query['post_status'] !== 'publish') throw new RuntimeException('Published reports only');
    $ids = [];
    foreach (array_reverse($GLOBALS['meta'], true) as $id => $meta) {
        if (isset($meta['_mw_nickname'])) $ids[] = $id;
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
    public function __construct(private $params = []) {}
    public function get_param($name) { return $this->params[$name] ?? null; }
}
require __DIR__ . DIRECTORY_SEPARATOR . 'mostwanted-cpt-rest.php';
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }

$GLOBALS['meta'] = [];
$GLOBALS['last_id'] = 0;
$new_with_rid = mw_store_report(1, ['nickname' => 'Biancaa_17', 'rid' => '555', 'reason' => 'Nuevo']);
$legacy_no_rid = mw_store_report(1, ['nickname' => 'biancaa_17', 'reason' => 'Antiguo sin RID']);
$other_rid = mw_store_report(1, ['nickname' => 'Biancaa_17', 'rid' => '999', 'reason' => 'Otro jugador']);
$other_name = mw_store_report(1, ['nickname' => 'Someone', 'reason' => 'Otro nombre']);
$old_with_rid = mw_store_report(1, ['nickname' => 'Biancaa_17', 'rid' => '555', 'reason' => 'Mismo RID antiguo']);

$combined = mw_rest_reports_list(new Request(['nickname' => 'Biancaa_17', 'rid' => '555', 'per_page' => 100]));
check($combined->status === 200, 'Combined lookup succeeds');
$ids = array_column($combined->data['items'], 'id');
check(in_array($new_with_rid, $ids, true) && in_array($old_with_rid, $ids, true), 'RID matches current and older reports');
check(in_array($legacy_no_rid, $ids, true), 'Name matches RID-less legacy report in the same query');
check(!in_array($other_rid, $ids, true), 'Name does not pull reports of another RID');
check(!in_array($other_name, $ids, true), 'Unrelated names are excluded');
check($combined->data['total'] === 3 && !$combined->data['hasMore'], 'Total counts the full match list');

$paged = mw_rest_reports_list(new Request(['nickname' => 'Biancaa_17', 'rid' => '555', 'per_page' => 2, 'page' => 2]));
check(count($paged->data['items']) === 1 && !$paged->data['hasMore'], 'Pagination runs over the full match list');

$rid_only = mw_rest_reports_list(new Request(['rid' => '999']));
check(array_column($rid_only->data['items'], 'id') === [$other_rid], 'RID-only query keeps single-filter behavior');

$name_only = mw_rest_reports_list(new Request(['nickname' => 'someone']));
check(array_column($name_only->data['items'], 'id') === [$other_name], 'Name-only query matches normalized name');

echo "OK reports list matches RID and RID-less names in one query with full pagination\n";
