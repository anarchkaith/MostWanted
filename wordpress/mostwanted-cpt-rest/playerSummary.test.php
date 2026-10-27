<?php
define('ABSPATH', __DIR__);
function mw_str($value) { return is_scalar($value) ? trim((string) $value) : ''; }
function mw_int_or_null($value) { return ctype_digit((string) $value) ? (int) $value : null; }
function get_post_meta($id, $key, $single) { return $GLOBALS['meta'][$id][$key] ?? ''; }
function update_post_meta($id, $key, $value) { $GLOBALS['meta'][$id][$key] = $value; return true; }
function wp_slash($value) { return $value; }
function wp_strip_all_tags($value) { return strip_tags($value); }
function mw_find_player_post($nickname, $rid, $player_id) { return $rid === 123 || $nickname === 'Player' ? 10 : 0; }
function get_posts($query) {
    check($query['post_status'] === 'publish' && $query['post_type'] === 'mw_report', 'Only use published reports');
    return array_keys($GLOBALS['reports']);
}
function mw_map_report_item($id) { return $GLOBALS['reports'][$id]; }
class WP_REST_Response {
    public $headers = [];
    public function __construct(public $data, public $status) {}
    public function header($name, $value) { $this->headers[$name] = $value; }
}
class Request {
    public function __construct(private $values, private $method = 'GET') {}
    public function get_param($key) { return $this->values[$key] ?? null; }
    public function get_method() { return $this->method; }
}
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
require __DIR__ . DIRECTORY_SEPARATOR . 'player-summary.php';
$GLOBALS['meta'][10] = ['_mw_rid' => '123', '_mw_nickname' => 'Player'];
$GLOBALS['reports'] = [
    1 => ['id' => 1, 'nickname' => 'Player', 'rid' => '123', 'reason' => 'Motivo', 'categories' => ['MODDER'], 'createdAt' => '2026-10-27', 'evidence' => []],
    2 => ['id' => 2, 'nickname' => 'Another', 'rid' => '456', 'reason' => 'No mezclar identidades'],
];
check(mw_player_public_summary(10) === null, 'Absent summary is explicitly null');
$source = mw_rest_player_summary(new Request(['rid' => '123']));
check($source->status === 200 && count($source->data['reports']) === 1, 'Source excludes conflicting RIDs');
$revision = $source->data['revision'];
$body = ['rid' => '123', 'text' => '**Resumen HEX** basado en denuncias.', 'sourceRevision' => $revision];
$stored = mw_rest_player_summary(new Request($body, 'POST'));
check($stored->status === 200, 'Persist generated summary');
$summary = mw_player_public_summary(10);
check($summary['text'] === $body['text'] && $summary['reportCount'] === 1 && !$summary['stale'], 'Expose persisted text, date, count and freshness');
check(!isset($summary['sourceRevision']), 'Do not expose internal synchronization state');
$GLOBALS['reports'][1]['communityVerification'] = ['up' => 42];
$GLOBALS['reports'][1]['crews'] = [['name' => 'Crew']];
check(!mw_player_public_summary(10)['stale'], 'Votes and crews do not invalidate AI');
$GLOBALS['reports'][1]['reason'] = 'Motivo corregido';
check(mw_player_public_summary(10)['stale'], 'Relevant changes invalidate published summary without generating AI');
check(mw_rest_player_summary(new Request($body, 'POST'))->status === 409, 'Reject a summary for an outdated source revision');
$body['sourceRevision'] = mw_player_summary_source(10)['revision'];
check(mw_rest_player_summary(new Request($body, 'POST'))->status === 200, 'Allow corrected source');
unset($GLOBALS['reports'][1]);
check(mw_player_public_summary(10)['stale'], 'Removed reports invalidate cached summary');
check(mw_rest_player_summary(new Request($body, 'POST'))->status === 409, 'Never publish summaries for an empty source');
check(mw_rest_player_summary(new Request([]))->status === 400, 'Require identity');
check(mw_rest_player_summary(new Request(['rid' => '999']))->status === 404, 'Require an existing player');
echo "OK WordPress player aiSummary metadata, publication revision checks and read-only invalidation\n";
