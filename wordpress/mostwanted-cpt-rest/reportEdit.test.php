<?php
require __DIR__ . DIRECTORY_SEPARATOR . 'reportAdmin.test.php';

class WP_REST_Response {
    public $headers = [];
    public function __construct(public $data, public $status = 200) {}
    public function header($name, $value) { $this->headers[$name] = $value; }
}
class EditRequest {
    public function __construct(public $params, public $secret = 'fixture-secret') {}
    public function get_param($key) { return $this->params[$key] ?? null; }
    public function get_header($key) { return $key === 'authorization' ? 'Bearer ' . $this->secret : ''; }
}
class EditDatabase {
    public $prefix = 'wp_';
    public $available = true;
    public $released = 0;
    public function prepare($sql, $name) { return $sql . ' ' . $name; }
    public function get_var($sql) {
        if (strpos($sql, 'RELEASE_LOCK') !== false) { $this->released++; return '1'; }
        return $this->available ? '1' : '0';
    }
}
function get_option($key, $default = '') { return $key === MW_SECRET_OPTION_KEY ? 'fixture-secret' : $default; }
function wp_cache_delete(...$args) {}
function is_admin() { return $GLOBALS['front_admin'] ?? false; }
function is_singular($type) { return ($GLOBALS['front_type'] ?? '') === $type; }
function is_user_logged_in() { return $GLOBALS['front_logged_in'] ?? false; }
function get_the_ID() { return 1; }

$wpdb = new EditDatabase();
$GLOBALS['meta'] = [
    1 => [
        '_mw_player_post_id' => 9, '_mw_nickname' => 'Player', '_mw_rid' => '123',
        '_mw_created_at' => '2026-10-01', '_mw_owner_discord_id' => '12345',
        '_mw_reporter' => ['name' => 'PRIVATE_AUTHOR'],
        '_mw_private_identity' => ['id' => '12345', 'email' => 'PRIVATE_EMAIL'],
        '_mw_community_verification' => [
            'up' => 2, 'down' => 1,
            'votesByVoter' => ['PRIVATE_VOTER' => ['voteType' => 'up']],
            'feedback' => [['reason' => 'Public reason', 'ip' => 'PRIVATE_VOTER_IP']],
        ],
        '_mw_report_payload' => [
            'nickname' => 'Player', 'username' => 'Player', 'rid' => 123, 'playerId' => 'RID-123',
            'reason' => 'Original reason', 'typesOfInfraction' => ['MODDER'],
            'labels' => [['id' => 18, 'label' => 'Aimbot', 'detail' => 'Original detail']],
            'crews' => [['name' => 'Crew', 'url' => 'https://crew.test/original']],
            'aliases' => ['Earlier'], 'avatar1' => 'https://images.test/avatar.png',
            'evidence' => [['url' => 'https://images.test/old.mp4', 'name' => 'Historical video', 'contentType' => 'video/mp4', 'extra' => 'keep']],
            'analysis' => ['summary' => 'Stored analysis', 'severity' => 'alta'], 'severity' => 'alta',
            'investigation_status' => 'resolved', 'time' => 1234567890,
            'ownerDiscordId' => '12345', 'reporter' => ['name' => 'PRIVATE_AUTHOR'],
            'ip' => 'PRIVATE_IP', 'customInternal' => ['keep' => true],
            'report' => ['reportedby' => 'PRIVATE_AUTHOR'],
        ],
    ],
    9 => ['_mw_nickname' => 'Player', '_mw_rid' => '123'],
];
$GLOBALS['linked_reports'] = [1];
$owner = ['id' => '12345', 'isAdmin' => false];
$other = ['id' => '98765', 'isAdmin' => false];
$admin = ['id' => '98765', 'isAdmin' => true];

function edit_request($actor, $params = []) {
    $result = mw_rest_report_edit(new EditRequest(array_merge(['id' => 1, 'actor' => $actor], $params)));
    check($result->headers['Cache-Control'] === 'private, no-store', 'All private editing responses must disable caching');
    return $result;
}
function inspect_edit($actor) { return edit_request($actor, ['inspect' => true]); }
function reject_edit($actor, $changes, $status, $revision = null) {
    $before = $GLOBALS['meta'];
    $result = edit_request($actor, ['changes' => $changes, 'revision' => $revision ?? mw_report_edit_revision(1)]);
    check($result->status === $status, 'Unexpected edit rejection status: ' . $result->status);
    check($before === $GLOBALS['meta'], 'Rejected edits must not mutate any report or player metadata');
}
check(is_wp_error(mw_can_ingest_reports(new EditRequest([], 'wrong'))), 'No WordPress login substitutes for the backend secret');
check(mw_can_ingest_reports(new EditRequest([])) === true, 'Valid backend secret is required');
check(inspect_edit($owner)->data['canEdit'] === true && inspect_edit($admin)->data['canEdit'] === true, 'Owner and server-authorized administrator can edit');
check(inspect_edit($other)->data === ['ok' => true, 'canEdit' => false], 'Other users receive neither edit data nor ownership');
check(strpos(json_encode(inspect_edit($owner)->data), 'PRIVATE') === false, 'Editing never exposes private identity, IPs or voter records');
check(inspect_edit(['id' => '98765', 'isAdmin' => 'true'])->data['canEdit'] === false, 'Admin flag must be a strict server boolean');
check(inspect_edit(['id' => 'Player'])->data['canEdit'] === false, 'Never attribute report ownership by display name');
unset($GLOBALS['meta'][1]['_mw_owner_discord_id']);
check(inspect_edit($owner)->data['canEdit'] === false && inspect_edit($admin)->data['canEdit'] === true, 'Legacy reports without stored ownership are admin-only');
$GLOBALS['meta'][1]['_mw_owner_discord_id'] = '12345';

$changes = [
    'nickname' => 'Corrected', 'reason' => "Corrected \"reason\"\nPath C:\\evidence",
    'crews' => 'Crew', 'typesOfInfraction' => ['MODDER'], 'labels' => ['Aimbot'],
    'evidence' => [['_original' => 0], ['url' => 'https://images.test/new.png', 'name' => 'New evidence', 'contentType' => 'image/png']],
];
reject_edit($other, $changes, 403);
foreach ([
    ['ownerDiscordId' => '98765'], ['actor' => $admin], ['rid' => '999'],
    ['analysis' => ['summary' => 'Injected']], ['reason' => 'short'],
    ['labels' => ['Spawnkill']], ['labels' => ['Invented']],
    ['typesOfInfraction' => []], ['evidence' => [['_original' => 9]]],
    ['evidence' => [['_original' => 0], ['_original' => 0]]],
    ['evidence' => [['url' => 'javascript:alert(1)', 'name' => 'Bad', 'contentType' => 'image/png']]],
] as $patch) reject_edit($owner, array_merge($changes, $patch), 400);
reject_edit($owner, $changes, 409, 'obsolete');
$wpdb->available = false;
reject_edit($owner, $changes, 409);
$wpdb->available = true;
$before = $GLOBALS['meta'][1];
$old_revision = mw_report_edit_revision(1);
$GLOBALS['meta'][1]['_mw_community_verification']['up']++;
check(mw_report_edit_revision(1) === $old_revision, 'Voting does not invalidate a content edit');
$votes = $GLOBALS['meta'][1]['_mw_community_verification'];
$result = edit_request($owner, ['changes' => $changes, 'revision' => $old_revision]);
check($result->status === 200 && $result->data['report']['id'] === 1, 'Editing updates the same report, never creates a new one');
check($result->data['report']['content'] === $changes['reason'], 'Preserve quotes, newlines and backslashes');
check($result->data['report']['labels'][0]['detail'] === 'Original detail', 'Retain label details when keeping a selected conduct');
check($result->data['report']['evidence'][0]['extra'] === 'keep', 'Retain historical evidence fields and videos');
check($result->data['report']['crews'][0]['url'] === 'https://crew.test/original', 'Keep unchanged crew URLs');
check($GLOBALS['titles'][1] === 'Corrected [RID 123]' && $GLOBALS['titles'][9] === 'Corrected [RID 123]', 'Synchronize titles and profile');
foreach (['_mw_owner_discord_id', '_mw_reporter', '_mw_private_identity', '_mw_created_at', '_mw_player_post_id'] as $key) {
    check($GLOBALS['meta'][1][$key] === $before[$key], 'Preserve immutable field: ' . $key);
}
check($GLOBALS['meta'][1]['_mw_community_verification'] === $votes, 'Never overwrite concurrent votes');
foreach (['rid', 'playerId', 'aliases', 'avatar1', 'analysis', 'severity', 'time', 'customInternal', 'reporter', 'ip'] as $key) {
    check($GLOBALS['meta'][1]['_mw_report_payload'][$key] === $before['_mw_report_payload'][$key], 'Preserve non-editable payload field: ' . $key);
}
check($GLOBALS['meta'][9]['_mw_total_reports'] === 1, 'Editing does not increment report counts');
check(!isset($result->data['report']['severity']) && !isset($result->data['report']['analysis']['severity']), 'Editing must not republish retired severity');
reject_edit($owner, $changes, 409, $old_revision);
$changes['crews'] = '';
$changes['evidence'] = [];
$changes['labels'] = [];
$result = edit_request($admin, ['changes' => $changes, 'revision' => mw_report_edit_revision(1)]);
check($result->status === 200 && $result->data['report']['crews'] === [] && $result->data['report']['evidence'] === [], 'Admins can remove crews and evidence');
check($GLOBALS['meta'][9]['_mw_crews_data'] === [], 'Clearing the only crew clears the shared profile');
$GLOBALS['fail_meta_key'] = '_mw_crews_data';
$changes['crews'] = 'Another crew';
$released = $wpdb->released;
$result = edit_request($owner, ['changes' => $changes, 'revision' => mw_report_edit_revision(1)]);
check($result->status === 500 && strpos($result->data['error'], 'se guardo') !== false, 'Partial storage failures never report success');
check($wpdb->released === $released + 1, 'Always release the lock on storage errors');
unset($GLOBALS['fail_meta_key']);
$result = edit_request($owner, ['changes' => $changes, 'revision' => mw_report_edit_revision(1)]);
check($result->status === 200 && $GLOBALS['meta'][9]['_mw_crews_data'][0]['name'] === 'Another crew', 'Reload and retry repairs profile storage failures');
foreach (['draft', 'private', 'trash'] as $status) {
    $GLOBALS['post_status'][1] = $status;
    check(inspect_edit($admin)->status === 404, 'Do not expose unpublished reports to the editing surface');
}
unset($GLOBALS['post_status'][1]);
$before = $GLOBALS['meta'];
$_POST = ['post_ID' => 1];
$_SERVER['REQUEST_METHOD'] = 'POST';
try { mw_report_readonly_admin(); throw new RuntimeException('Expected native editing rejection'); }
catch (RuntimeException $error) { check($error->getCode() === 403, 'Reject native WordPress POST edits'); }
check($GLOBALS['meta'] === $before, 'Native editing cannot change the data');
$_POST = [];
$_SERVER['REQUEST_METHOD'] = 'GET';
check(mw_report_readonly_rest(null, null)->get_error_data()['status'] === 403, 'Reject generic WordPress REST editing');
check(mw_report_readonly_caps(['delete_posts'], 'delete_post', 1, [1]) === ['do_not_allow'], 'Prevent native deletion');
check(mw_report_readonly_caps(['edit_posts'], 'edit_post_meta', 1, [1, '_mw_report_payload']) === ['do_not_allow'], 'Prevent native metadata editing through admin AJAX');
check(mw_report_readonly_caps(['edit_posts'], 'edit_post', 1, [1]) === ['edit_posts'], 'Keep the viewer accessible');
check(empty($GLOBALS['filters']['the_content']), 'The plugin must not inject report HTML or raw data into frontend content; Elementor owns rendering');
$GLOBALS['is_admin_user'] = true;
ob_start();
mw_render_report_meta_box((object) ['ID' => 1]);
$html = ob_get_clean();
check(strpos($html, 'PRIVATE_IP') !== false && strpos($html, '<input') === false && strpos($html, '<textarea') === false, 'Administrators see the complete stored payload without editing controls');
check(strpos($html, '<dt>severity</dt>') === false && strpos($html, '<dt>severidad</dt>') === false, 'The WordPress viewer does not display retired severity, even in nested historical data');
echo "OK web report editing: verified ownership, administrator access, revisions, locks, preservation, validation, profile sync, failure recovery and WordPress read-only views\n";
