<?php
define('ABSPATH', __DIR__);
function check($value, $message) { if (!$value) throw new RuntimeException($message); }
function remove_accents($value) { return strtr($value, ['ó' => 'o', 'Ó' => 'O', 'é' => 'e', 'á' => 'a']); }
function mw_str($value) { return is_scalar($value) ? trim((string) $value) : ''; }
function get_post_meta($id, $key, $single) { return $GLOBALS['meta'][$id][$key] ?? ''; }
function mw_safe_meta_array($id, $key) { $value = get_post_meta($id, $key, true); return is_array($value) ? $value : []; }
function update_meta_cache($type, $ids) {}
function mw_map_report_item($id) { return $GLOBALS['reports'][$id]; }
function get_posts($query) {
    check($query['post_status'] === 'publish', 'Search published posts only');
    $ids = $query['post_type'] === 'mw_report' ? array_keys($GLOBALS['reports']) : array_keys($GLOBALS['meta']);
    return array_slice($ids, $query['offset'], $query['numberposts']);
}
class WP_REST_Response {
    public $headers = [];
    public function __construct(public $data, public $status) {}
    public function header($name, $value) { $this->headers[$name] = $value; }
}
class Request {
    public function __construct(private $values) {}
    public function get_param($key) { return $this->values[$key] ?? null; }
}
require __DIR__ . DIRECTORY_SEPARATOR . 'search.php';
$GLOBALS['reports'] = [];
for ($id = 1; $id <= 125; $id++) {
    $GLOBALS['reports'][$id] = [
        'nickname' => 'Player' . $id, 'rid' => (string) $id, 'reason' => 'Expulsión en carreras',
        'categories' => ['MODDER'], 'labels' => [['label' => 'Godmode']],
        'aliases' => ['Alias' . $id], 'crews' => [['name' => 'Rebels', 'url' => 'private-url']],
        'reporter' => ['name' => 'PrivateReporter'], 'ip' => 'private-ip',
        'analysis' => ['summary' => 'Resumen nocturno', 'internal' => 'private-analysis'],
    ];
}
$GLOBALS['meta'] = [200 => [
    '_mw_nickname' => 'Player1', '_mw_rid' => '1', '_mw_aliases' => ['OldName'],
    '_mw_ai_summary' => ['text' => str_repeat('Introducción ', 80) . 'teletransporte en sesión'],
]];
$first = mw_rest_search(new Request(['q' => 'MODDER expulsion']));
check($first->status === 200 && $first->data['total'] === 125 && $first->data['hasMore'], 'Search beyond initial 100 reports');
check(count($first->data['items']) === 50, 'Paginated results');
$third = mw_rest_search(new Request(['q' => 'carreras', 'page' => '3']));
check(count($third->data['items']) === 25 && !$third->data['hasMore'], 'Last page includes all remaining identities');
$summary = mw_rest_search(new Request(['q' => 'teletransporte']));
check($summary->data['total'] === 1 && $summary->data['items'][0]['rid'] === '1', 'Search persisted player summary');
check(str_contains($summary->data['items'][0]['searchMatches'][0]['text'], 'teletransporte'), 'Excerpt centers late keyword');
check(json_encode($summary->data) !== false, 'Excerpt preserves UTF-8 without mbstring');
foreach (['Alias125', 'OldName', 'Godmode', 'Rebels', 'nocturno'] as $query) {
    check(mw_rest_search(new Request(['q' => $query]))->data['total'] > 0, 'Search field: ' . $query);
}
foreach (['PrivateReporter', 'private-ip', 'private-url', 'private-analysis', 'missing'] as $query) {
    check(mw_rest_search(new Request(['q' => $query]))->data['total'] === 0, 'Exclude private or absent field: ' . $query);
}
foreach ([[], ['q' => []], ['q' => 'x', 'page' => '-1'], ['q' => 'x', 'per_page' => '101']] as $query) {
    check(mw_rest_search(new Request($query))->status === 400, 'Validate input');
}
echo "OK WordPress unified archive search, summaries, privacy, excerpts and pagination\n";
