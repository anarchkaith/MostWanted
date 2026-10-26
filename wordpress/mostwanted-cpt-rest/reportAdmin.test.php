<?php
define('ABSPATH', __DIR__);
function add_action($hook, $callback) { $GLOBALS['hooks'][$hook] = $callback; }
function add_filter(...$args) {}
function register_activation_hook(...$args) {}
function register_deactivation_hook(...$args) {}
function add_meta_box(...$args) { $GLOBALS['box'] = $args; }
function register_post_type($type, $args) { $GLOBALS['post_types'][$type] = $args; }
function get_current_screen() { return (object) ['post_type' => $GLOBALS['screen_type'] ?? 'mw_report']; }
function wp_enqueue_media() { $GLOBALS['assets'][] = 'media'; }
function plugins_url($file, $base) { return 'https://wordpress.test/plugins/mostwanted-cpt-rest/' . $file; }
function wp_enqueue_style(...$args) { $GLOBALS['assets'][] = $args; }
function wp_enqueue_script(...$args) { $GLOBALS['assets'][] = $args; }
function wp_is_post_revision($id) { return $GLOBALS['revision'] ?? false; }
function wp_is_post_autosave($id) { return $GLOBALS['autosave'] ?? false; }
function current_user_can($cap, $id = 0) {
    if ($cap === 'upload_files') return $GLOBALS['can_upload'] ?? true;
    if ($cap === 'read_post') return $GLOBALS['can_read_attachment'] ?? true;
    if ($id === 9 && isset($GLOBALS['can_edit_player'])) return $GLOBALS['can_edit_player'];
    return $GLOBALS['can_edit'] ?? true;
}
function wp_verify_nonce($nonce, $action) { return $nonce === 'valid' && $action === 'mw_save_report_metadata_1'; }
function wp_nonce_field($action, $name) { echo '<input name="' . $name . '" value="valid">'; }
function wp_die($message, $title, $args) { throw new RuntimeException($message, $args['response']); }
function wp_slash($value) { return is_array($value) ? array_map('wp_slash', $value) : (is_string($value) ? addslashes($value) : $value); }
function wp_unslash($value) { return is_array($value) ? array_map('wp_unslash', $value) : (is_string($value) ? stripslashes($value) : $value); }
function sanitize_text_field($value) { return trim(strip_tags($value)); }
function sanitize_textarea_field($value) { return trim(strip_tags($value)); }
function wp_strip_all_tags($value) { return strip_tags($value); }
function esc_html($value) { return htmlspecialchars($value, ENT_QUOTES, 'UTF-8'); }
function esc_attr($value) { return esc_html($value); }
function esc_textarea($value) { return esc_html($value); }
function wp_json_encode($value, $flags = 0) { return json_encode($value, $flags); }
function wp_http_validate_url($value) { return filter_var($value, FILTER_VALIDATE_URL) && in_array(parse_url($value, PHP_URL_SCHEME), ['http', 'https'], true); }
function wp_check_filetype($path) { return ['type' => pathinfo($path, PATHINFO_EXTENSION) === 'png' ? 'image/png' : false]; }
function get_post_mime_type($id) { return $GLOBALS['attachment_mime'] ?? 'image/png'; }
function get_attached_file($id) { return $GLOBALS['attachment_path'] ?? __FILE__; }
function wp_get_attachment_url($id) { return 'https://wordpress.test/uploads/' . $id . '.png'; }
function get_the_title($id) { return 'Original title'; }
function get_post($id) { return isset($GLOBALS['meta'][$id]) ? (object) ['ID' => $id, 'post_type' => $id === 9 ? 'mw_player' : 'mw_report'] : null; }
function get_gmt_from_date($value) { return $value; }
function mysql2date($format, $value) { return date($format, strtotime($value . ' UTC')); }
function get_children($args) { return $GLOBALS['linked_reports'] ?? [1]; }
function get_posts($args) {
    check($args['meta_key'] === '_mw_player_post_id' && intval($args['meta_value']) === 9, 'Only query reports associated with the edited player');
    return $GLOBALS['linked_reports'] ?? [1];
}
function wp_update_post($args, $error = false) { $GLOBALS['titles'][$args['ID']] = $args['post_title']; return $args['ID']; }
function get_post_meta($id, $key, $single) {
    $value = $GLOBALS['meta'][$id][$key] ?? '';
    return is_scalar($value) ? strval($value) : $value;
}
function update_post_meta($id, $key, $value, $previous = null) {
    if (($GLOBALS['fail_meta_key'] ?? '') === $key) return false;
    if ($key === '_mw_community_verification' && ($GLOBALS['concurrent_vote'] ?? false)) {
        $GLOBALS['meta'][$id][$key]['up']++;
        $GLOBALS['concurrent_vote'] = false;
    }
    if ($previous !== null && get_post_meta($id, $key, true) !== $previous) return false;
    $unslashed = wp_unslash($value);
    if (array_key_exists($key, $GLOBALS['meta'][$id] ?? []) && get_post_meta($id, $key, true) === (is_scalar($unslashed) ? strval($unslashed) : $unslashed)) return false;
    $GLOBALS['meta'][$id][$key] = wp_unslash($value);
    return true;
}
function is_wp_error($value) { return $value instanceof WP_Error; }
class WP_Error {
    public function __construct(public $code, public $message) {}
    public function get_error_message() { return $this->message; }
}
require __DIR__ . DIRECTORY_SEPARATOR . 'mostwanted-cpt-rest.php';
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
function submit($input, $nonce = 'valid') {
    $_POST = wp_slash(['mw_report_metadata_nonce' => $nonce, 'mw_report_metadata' => $input]);
    mw_save_report_metadata(1);
}
function reject($input, $code = 400, $nonce = 'valid') {
    $before = $GLOBALS['meta'];
    try {
        submit($input, $nonce);
    } catch (RuntimeException $error) {
        check($error->getCode() === $code, 'Expected rejection status');
        check($GLOBALS['meta'] === $before, 'Rejected edits must not write any metadata');
        return;
    }
    throw new RuntimeException('Expected edit to be rejected');
}
$GLOBALS['meta'] = [
    1 => [
        '_mw_player_post_id' => 9, '_mw_nickname' => 'Old', '_mw_rid' => '123',
        '_mw_created_at' => '2026-10-01',
        '_mw_owner_discord_id' => 'PRIVATE_OWNER',
        '_mw_reporter' => ['name' => 'PRIVATE_NAME'],
        '_mw_community_verification' => ['up' => 2, 'down' => 1, 'votesByVoter' => ['PRIVATE_VOTER' => 'up']],
        '_mw_report_payload' => [
            'nickname' => 'Old', 'rid' => 123, 'playerId' => 'RID-123', 'reason' => 'Old reason',
            'categories' => ['Old'], 'tagIds' => [9], 'labels' => ['Spawnkill'], 'labelIds' => [9],
            'avatar1' => 'https://images.test/old.png',
            'reporter' => ['name' => 'PRIVATE_NAME'], 'ownerDiscordId' => 'PRIVATE_OWNER',
            'ip' => 'PRIVATE_IP', 'reportedby' => 'PRIVATE_NAME', 'customInternal' => ['keep' => true],
            'report' => ['categories' => ['Old'], 'reportedby' => 'PRIVATE_NAME', 'analysis' => ['summary' => 'Nested'], 'investigation_status' => 'manual'],
        ],
    ],
    9 => ['_mw_nickname' => 'Old', '_mw_rid' => '123', '_mw_aliases_history' => [['alias' => 'Old', 'time' => 100]]],
];
check($GLOBALS['hooks']['save_post_mw_report'] === 'mw_save_report_metadata', 'Wire report saves');
mw_register_post_types();
check($GLOBALS['post_types']['mw_report']['supports'] === ['title'], 'Hide irrelevant content and generic custom fields only for reports');
check(in_array('custom-fields', $GLOBALS['post_types']['mw_player']['supports'], true), 'Keep player editing unchanged');
$GLOBALS['assets'] = [];
mw_report_admin_assets('edit.php');
check($GLOBALS['assets'] === [], 'Do not load assets on listing screens');
$GLOBALS['screen_type'] = 'post';
mw_report_admin_assets('post.php');
check($GLOBALS['assets'] === [], 'Do not load assets for unrelated post types');
$GLOBALS['screen_type'] = 'mw_report';
mw_report_admin_assets('post.php');
check(count($GLOBALS['assets']) === 3 && $GLOBALS['assets'][2][2] === ['media-views'], 'Load native media picker, CSS and script only on report editors');
mw_add_report_meta_box();
check($GLOBALS['box'][3] === 'mw_report', 'Use the existing report CPT');
$initial = mw_report_admin_values(1);
check($initial['labels'][0]['id'] === 9, 'Load existing normalized labels');
check($initial['analysis']['summary'] === 'Nested', 'Load historical nested analysis');
check($initial['investigation_status'] === 'manual', 'Load historical nested status');
check(!isset($initial['extra']['reporter']), 'Do not put private data in the editable extras');
$private_before = $GLOBALS['meta'][1];
$player_before = $GLOBALS['meta'][9];
$input = [
    'nickname' => 'Edited', 'rid' => '456', 'reason' => "Reason \"quoted\"\nPath C:\\evidence",
    'investigation_status' => 'reviewed',
    'typesOfInfraction' => '["Modder"]',
    'labels' => '[{"id":1,"label":"Abuso de bugs","detail":"Updated"}]',
    'evidence' => '[{"url":"https://images.test/new.png","name":"Evidence","contentType":"image/png"}]',
    'analysis' => '{"summary":"Manual review","path":"C:\\\\evidence"}',
    'extra' => '{"aliases":["Old"],"crews":[{"name":"Crew","url":""}],"severity":"alta","anonymous":false}',
];
submit($input);
$saved = $GLOBALS['meta'][1];
$public = mw_map_report_item(1);
check($public['nickname'] === 'Edited' && $public['rid'] === '456', 'API reflects edited identity');
check($public['content'] === $input['reason'], 'Preserve quotes, newlines and backslashes');
check($public['categories'] === ['Modder'] && $public['labels'][0]['id'] === 1, 'API reflects labels and categories');
check($public['evidence'][0]['url'] === 'https://images.test/new.png', 'API reflects evidence');
check($public['analysis']['path'] === 'C:\\evidence', 'Preserve JSON backslashes through WordPress slashing');
check($public['severity'] === 'alta' && !isset($public['avatar1']), 'Apply extra metadata additions and removals');
check($saved['_mw_report_payload']['report']['analysis'] === $saved['_mw_analysis'], 'Synchronize nested analysis');
check($saved['_mw_report_payload']['report']['tags'] === ['Abuso de bugs'], 'Synchronize nested tags');
check($saved['_mw_report_payload']['categories'] === $saved['_mw_types'], 'Synchronize legacy categories');
check($saved['_mw_report_payload']['tagIds'] === [1] && $saved['_mw_report_payload']['playerId'] === 'RID-456', 'Synchronize IDs');
foreach (['_mw_reporter', '_mw_owner_discord_id', '_mw_community_verification', '_mw_created_at', '_mw_player_post_id'] as $key) {
    check($saved[$key] === $private_before[$key], 'Preserve ' . $key);
}
check($saved['_mw_report_payload']['customInternal'] === ['keep' => true], 'Preserve unknown original metadata');
check($GLOBALS['meta'][9] === $player_before, 'Do not rewrite shared player histories or counts');
check(strpos(json_encode($public), 'PRIVATE') === false, 'Edited public responses must not expose private data');
$input['rid'] = '';
$input['labels'] = '[]';
$input['evidence'] = '[]';
$input['analysis'] = '{}';
$input['typesOfInfraction'] = '[]';
$input['extra'] = '{}';
submit($input);
$public = mw_map_report_item(1);
check($public['rid'] === '' && $GLOBALS['meta'][1]['_mw_rid'] === '', 'Clearing RID must not recover the old RID from playerId');
check($public['labels'] === [] && $public['evidence'] === [] && $public['categories'] === [], 'Allow explicit clearing of lists');
check($public['analysis'] === [], 'Allow clearing analysis');
foreach ([
    ['labels', '{broken'], ['labels', '{}'], ['labels', '["not an object"]'],
    ['labels', '[{"id":"bad","label":"Bad"}]'], ['analysis', '"not an object"'],
    ['evidence', '[{"url":"javascript:alert(1)"}]'], ['typesOfInfraction', '[{}]'],
    ['rid', '-1'], ['rid', '1.5'], ['rid', '9999999999999999999999999'], ['reason', ''], ['nickname', ''],
    ['extra', '{"ownerDiscordId":"999"}'], ['extra', '{"anonymous":"false"}'],
    ['extra', '{"aliases":[{}]}'], ['extra', '{"crews":[{"name":123}]}'],
    ['reason', ['array injection']],
] as [$key, $value]) {
    reject(array_replace($input, [$key => $value]));
}
$incomplete = $input;
unset($incomplete['analysis']);
reject($incomplete);
reject($input, 403, 'invalid');
reject($input, 403, ['invalid']);
$GLOBALS['can_edit'] = false;
reject($input, 403);
$GLOBALS['can_edit'] = true;
$before = $GLOBALS['meta'];
$_POST = [];
mw_save_report_metadata(1);
check($GLOBALS['meta'] === $before, 'REST ingestion and quick edit without the panel must not erase metadata');
foreach (['revision', 'autosave'] as $flag) {
    $GLOBALS[$flag] = true;
    submit($input);
    check($GLOBALS['meta'] === $before, 'Ignore ' . $flag);
    $GLOBALS[$flag] = false;
}
$GLOBALS['meta'][1]['_mw_report_payload']['nickname'] = '"><script>alert(1)</script>';
ob_start();
mw_render_report_meta_box((object) ['ID' => 1]);
mw_render_report_moderation((object) ['ID' => 1]);
$html = ob_get_clean();
check(strpos($html, '<script>') === false && strpos($html, '&lt;script&gt;') !== false, 'Escape stored metadata in admin fields');
check(strpos($html, 'PRIVATE') === false, 'Do not render private reporter data');
$GLOBALS['fail_meta_key'] = '_mw_report_payload';
reject($input, 500);
unset($GLOBALS['fail_meta_key']);

function value_node($value) {
    if (is_array($value) || is_object($value)) {
        $children = [];
        foreach ($value as $key => $item) $children[] = ['key' => strval($key), 'node' => value_node($item)];
        return ['type' => is_object($value) ? 'object' : 'list', 'children' => $children];
    }
    if ($value === null) return ['type' => 'null'];
    if (is_bool($value)) return ['type' => 'boolean', 'boolean' => $value ? 'true' : 'false'];
    return ['type' => is_string($value) ? 'text' : 'number', 'value' => strval($value)];
}
check(mw_decode_report_value(value_node(['text', 2, false, null])) === ['text', 2, false, null], 'Typed controls preserve values without JSON');
foreach ([
    ['type' => 'number', 'value' => 'oops'], ['type' => 'boolean', 'boolean' => 'oops'],
    ['type' => 'object', 'children' => [['key' => '', 'node' => value_node('text')]]],
    ['type' => 'object', 'children' => [['key' => 'same', 'node' => value_node('1')], ['key' => 'same', 'node' => value_node('2')]]],
] as $bad_node) {
    check(is_wp_error(mw_decode_report_value($bad_node)), 'Reject malformed typed controls');
}
$GLOBALS['meta'][1]['_mw_community_verification'] = [
    'up' => 4, 'down' => 6,
    'votesByVoter' => [
        'PRIVATE_A' => ['voteType' => 'down', 'reason' => 'First', 'ip' => 'PRIVATE_IP'],
        'PRIVATE_B' => ['voteType' => 'down', 'reason' => 'Second'],
        'PRIVATE_C' => ['voteType' => 'up'],
        'PRIVATE_D' => ['voteType' => 'down', 'reason' => 'Only in voter map'],
    ],
    'feedback' => [
        ['voterId' => 'PRIVATE_A', 'reason' => 'First'],
        ['voterId' => 'PRIVATE_A', 'reason' => 'Duplicate'],
        ['voterId' => 'PRIVATE_B', 'reason' => 'Second'],
        ['reason' => 'Legacy same'],
        ['reason' => 'Legacy same'],
    ],
];
function typed_post($input) {
    $post = ['mw_report_metadata_nonce' => 'valid', 'mw_report_form_version' => '2', 'mw_report_form_complete' => '1', 'mw_report_metadata' => $input];
    foreach (['typesOfInfraction', 'labels', 'evidence', 'analysis', 'extra'] as $key) {
        $post['mw_report_tree'][$key] = value_node(json_decode($input[$key]));
        unset($post['mw_report_metadata'][$key]);
    }
    $community = mw_get_community_verification(1);
    $post['mw_votes_snapshot'] = hash('sha256', serialize($community));
    foreach (mw_report_vote_rows($community) as $index => $row) $post['mw_report_votes'][$index] = ['reason' => $row['reason']];
    return $post;
}
$input['nickname'] = 'Edited through controls';
$post = typed_post($input);
check(count($post['mw_report_votes']) === 5, 'Deduplicate linked reasons and include votes without feedback');
$post['mw_report_votes'][0]['reason'] = 'Corrected';
$post['mw_report_votes'][1]['delete'] = '1';
$post['mw_report_votes'][2]['reason'] = 'Changed legacy';
$post['mw_report_votes'][3]['delete'] = '1';
$post['mw_report_votes'][4]['delete'] = '1';
$_POST = wp_slash($post);
mw_save_report_metadata(1);
$community = mw_get_community_verification(1);
check($community['up'] === 4 && $community['down'] === 3, 'Remove exactly one false vote per deleted row, retaining historical untracked counters');
check(!isset($community['votesByVoter']['PRIVATE_B'], $community['votesByVoter']['PRIVATE_D']), 'Delete voter records so a later vote is not decremented twice');
check($community['votesByVoter']['PRIVATE_A']['reason'] === 'Corrected', 'Edit voter reason');
check(array_column($community['feedback'], 'reason') === ['Corrected', 'Corrected', 'Changed legacy'], 'Synchronize duplicate feedback and handle unlinked identical reasons independently');
check($community['votesByVoter']['PRIVATE_A']['ip'] === 'PRIVATE_IP', 'Preserve private vote metadata');
check(strpos(json_encode(mw_map_report_item(1)), 'PRIVATE') === false, 'Moderation keeps voter identity private');
check(mw_map_report_item(1)['nickname'] === $input['nickname'], 'Typed form persists report metadata');
function reject_post($post) {
    $before = $GLOBALS['meta'];
    $_POST = wp_slash($post);
    try {
        mw_save_report_metadata(1);
    } catch (RuntimeException $error) {
        check($error->getCode() === 400 && $GLOBALS['meta'] === $before, 'Invalid or stale form must not change metadata or votes');
        return;
    }
    throw new RuntimeException('Expected invalid form rejection');
}
reject_post($post);
$post = typed_post($input);
$post['mw_report_votes'][0]['reason'] = '';
reject_post($post);
$post = typed_post($input);
unset($post['mw_report_form_complete']);
reject_post($post);
$post = typed_post($input);
$post['mw_report_tree']['extra'] = value_node((object) ['ownerDiscordId' => 'attacker']);
reject_post($post);
$post = typed_post($input);
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check(mw_get_community_verification(1) === $community, 'Saving an unchanged form must not alter vote counts');
ob_start();
mw_render_report_meta_box((object) ['ID' => 1]);
mw_render_report_moderation((object) ['ID' => 1]);
$html = ob_get_clean();
check(strpos($html, 'PRIVATE') === false && strpos($html, 'mw_report_votes[0][reason]') !== false, 'Render editable reasons without private voter identities');
check(strpos($html, 'mw-value-type') === false && strpos($html, 'mw_report_form[analysis][summary]') === false, 'Do not render generic or analysis fields absent from the web form');
$post = typed_post($input);
$post['mw_report_votes'][0]['reason'] = 'Concurrent edit';
$GLOBALS['concurrent_vote'] = true;
$_POST = wp_slash($post);
try {
    mw_save_report_metadata(1);
    throw new RuntimeException('Expected concurrent vote conflict');
} catch (RuntimeException $error) {
    check($error->getCode() === 500, 'Surface concurrent writes explicitly');
    check(mw_get_community_verification(1)['up'] === 5, 'Never overwrite a vote arriving during persistence');
    check(mw_get_community_verification(1)['votesByVoter']['PRIVATE_A']['reason'] === 'Corrected', 'Do not overwrite concurrently changed vote data');
}
function native_post() {
    $stored = mw_report_admin_values(1);
    $post = typed_post([
        'nickname' => $stored['nickname'], 'rid' => $stored['rid'], 'reason' => $stored['reason'],
        'investigation_status' => $stored['investigation_status'],
        'typesOfInfraction' => '[]', 'labels' => '[]', 'evidence' => '[]', 'analysis' => '{}', 'extra' => '{}',
    ]);
    $post['mw_report_form_version'] = '3';
    unset($post['mw_report_tree']);
    $post['mw_report_form'] = [
        'aliases' => "Old\nOther", 'anonymous' => '0', 'types' => ['MODDER'], 'custom_type' => '',
        'labels' => [['label' => 'Aimbot', 'detail' => 'Observed', 'id' => '18', '_original' => '']],
        'evidence' => [['url' => 'https://images.test/file.png', 'name' => 'Screenshot', 'contentType' => '', '_original' => '']],
        'crews' => [['name' => 'Crew', 'url' => 'https://crew.test', '_original' => '']],
        'extra' => ['avatar1' => 'https://images.test/avatar.png', 'avatar2' => '', 'time' => '123456', 'source' => 'wordpress', 'severity' => 'alta', 'validation' => 'verificado'],
        'analysis' => array_fill_keys(array_keys(mw_report_analysis_fields()), ''),
    ];
    $post['mw_report_form']['analysis']['summary'] = 'Edited summary';
    $post['mw_report_form']['analysis']['confidence'] = '85';
    return $post;
}
$GLOBALS['meta'][9]['_mw_rid'] = '';
$GLOBALS['meta'][1]['_mw_report_payload']['analysis'] = ['historical' => ['unknown' => 'preserved']];
$GLOBALS['meta'][1]['_mw_report_payload']['severidad'] = 'baja';
$GLOBALS['meta'][1]['_mw_report_payload']['validacion'] = 'pendiente';
$post = native_post();
$post['mw_report_votes'][0]['reason'] = 'Native moderation';
$_POST = wp_slash($post);
mw_save_report_metadata(1);
$public = mw_map_report_item(1);
check($public['labels'][0]['id'] === 18 && $public['categories'] === ['MODDER'], 'Native choices persist categories and conduct IDs');
check($public['aliases'] === ['Old', 'Other'] && $public['crews'][0]['name'] === 'Crew', 'Native player fields persist aliases and crews');
check($public['analysis']['historical'] === ['unknown' => 'preserved'] && $public['analysis']['confidence'] === 85, 'Analysis keeps unknown fields and typed numbers');
check($public['evidence'][0]['contentType'] === 'image/png', 'Detect media MIME type');
check($public['severidad'] === 'alta' && $public['validacion'] === 'verificado', 'Synchronize legacy severity and validation consumed by MostWanted');
check($public['communityVerification']['confirmations'][0]['reason'] === 'Native moderation', 'Native editor moderates false reasons');
check(strpos(json_encode($public), 'PRIVATE') === false, 'Native editor preserves privacy');
foreach ([
    ['labels', [['label' => '', 'detail' => '', 'id' => '', '_original' => '']]],
    ['evidence', [['url' => 'javascript:bad', 'name' => '', 'contentType' => '', '_original' => '']]],
    ['crews', [['name' => '', 'url' => '', '_original' => '']]],
    ['analysis', ['confidence' => 'bad']],
    ['aliases', []],
] as [$key, $bad_value]) {
    $bad = native_post();
    $bad['mw_report_form'][$key] = $bad_value;
    reject_post($bad);
}
$bad = native_post();
unset($bad['mw_report_form_complete']);
reject_post($bad);
$GLOBALS['meta'][1]['_mw_report_payload']['evidence'][0]['size'] = 100;
$post = native_post();
$post['mw_report_form']['evidence'][0]['_original'] = '0';
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check(mw_map_report_item(1)['evidence'][0]['size'] === 100, 'Preserve original evidence extension fields');
$post = native_post();
unset($post['mw_report_form']['types'], $post['mw_report_form']['labels'], $post['mw_report_form']['evidence'], $post['mw_report_form']['crews']);
$_POST = wp_slash($post);
mw_save_report_metadata(1);
$public = mw_map_report_item(1);
check($public['labels'] === [] && $public['evidence'] === [] && $public['crews'] === [] && $public['categories'] === [], 'Native form explicitly clears removed rows and categories');
check($GLOBALS['meta'][9]['_mw_crews_data'] === [] && $GLOBALS['meta'][9]['_mw_total_reports'] === 1, 'Deleting the final crew clears the shared profile without incrementing counts');
$GLOBALS['meta'][1]['_mw_report_payload']['crews'] = [['name' => 'Wrong crew', 'url' => 'https://crew.test/wrong']];
$GLOBALS['meta'][1]['_mw_report_payload']['nickname'] = 'Typo';
$GLOBALS['meta'][1]['_mw_report_payload']['aliases'] = ['Mistyped alias'];
$GLOBALS['meta'][1]['_mw_report_payload']['avatar1'] = 'https://images.test/wrong.png';
$GLOBALS['meta'][9]['_mw_crews_data'] = [['name' => 'Wrong crew', 'url' => 'https://crew.test/wrong'], ['name' => 'Old orphan', 'url' => '']];
$GLOBALS['meta'][9]['_mw_aliases'] = ['Typo', 'Mistyped alias'];
$GLOBALS['meta'][9]['_mw_avatar_history'] = [['url' => 'https://images.test/wrong.png']];
$post = native_post();
$post['mw_report_metadata']['nickname'] = 'Correct name';
$post['mw_report_form']['aliases'] = 'Correct alias';
$post['mw_report_form']['crews'] = [['name' => 'Correct crew', 'url' => 'https://crew.test/correct', '_original' => '0']];
$post['mw_report_form']['extra']['avatar1'] = 'https://images.test/correct.png';
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check(array_column($GLOBALS['meta'][9]['_mw_crews_data'], 'name') === ['Correct crew'], 'A crew correction replaces accumulated wrong and orphan crews instead of appending');
check($GLOBALS['meta'][9]['_mw_nickname'] === 'Correct name' && $GLOBALS['meta'][9]['_mw_aliases'] === ['Correct name', 'Correct alias'], 'Name corrections reach the shared identity and history');
check(array_column($GLOBALS['meta'][9]['_mw_avatar_history'], 'url') === ['https://images.test/correct.png'], 'Avatar correction removes the erroneous URL from history');
check($GLOBALS['meta'][9]['_mw_last_seen_at'] === '2026-10-01', 'Editing must not pretend a new report has arrived');
check($GLOBALS['titles'][9] === 'Correct name', 'Shared player title follows corrected identity');
$GLOBALS['meta'][2] = [
    '_mw_player_post_id' => 9, '_mw_created_at' => '2026-09-01',
    '_mw_report_payload' => [
        'nickname' => 'Earlier name', 'aliases' => ['Historical alias'], 'rid' => null,
        'crews' => [['name' => 'Correct crew', 'url' => 'https://crew.test/old-link'], ['name' => 'Another crew', 'url' => '']],
        'avatar1' => 'https://images.test/historical.png',
    ],
];
$GLOBALS['linked_reports'] = [2, 1, 2];
$post = native_post();
$post['mw_report_form']['crews'] = [['name' => 'Renamed crew', 'url' => 'https://crew.test/renamed', '_original' => '0']];
$post['mw_report_form']['extra']['avatar1'] = '';
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check(array_column($GLOBALS['meta'][9]['_mw_crews_data'], 'name') === ['Renamed crew', 'Correct crew', 'Another crew'], 'Other reports retain valid historical crews without duplicating the edited report');
check($GLOBALS['meta'][9]['_mw_total_reports'] === 2, 'Count linked reports exactly once');
check(in_array('Earlier name', $GLOBALS['meta'][9]['_mw_aliases'], true), 'Preserve names recorded by another report');
check(array_column($GLOBALS['meta'][9]['_mw_avatar_history'], 'url') === ['https://images.test/historical.png'], 'Clearing an avatar retains only avatars backed by another report');
$GLOBALS['meta'][2]['_mw_report_payload']['crews'] = [['name' => 'Renamed crew', 'url' => 'https://crew.test/old-link']];
$post = native_post();
$post['mw_report_form']['crews'] = [['name' => 'Renamed crew', 'url' => 'https://crew.test/corrected-link', '_original' => '0']];
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check(count($GLOBALS['meta'][9]['_mw_crews_data']) === 1 && $GLOBALS['meta'][9]['_mw_crews_data'][0]['url'] === 'https://crew.test/corrected-link', 'Correcting a URL replaces the previous URL rather than keeping the first accumulated link');
$before = $GLOBALS['meta'][9];
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check($GLOBALS['meta'][9] === $before, 'Saving twice must not add histories, counts or new timestamps');
$bad = native_post();
$bad['mw_report_metadata']['rid'] = '456';
reject_post($bad);
$GLOBALS['can_edit_player'] = false;
reject_post(native_post());
unset($GLOBALS['can_edit_player']);
$GLOBALS['meta'][2]['_mw_report_payload']['rid'] = 999;
reject_post(native_post());
$GLOBALS['meta'][2]['_mw_report_payload']['rid'] = null;
$GLOBALS['meta'][3] = ['_mw_player_post_id' => 88, '_mw_report_payload' => ['nickname' => 'Other player', 'crews' => [['name' => 'Private other crew']]]];
$GLOBALS['linked_reports'][] = 3;
$_POST = wp_slash(native_post());
mw_save_report_metadata(1);
check(!in_array('Private other crew', array_column($GLOBALS['meta'][9]['_mw_crews_data'], 'name'), true), 'Never merge a report assigned to a different player');
$GLOBALS['fail_meta_key'] = '_mw_crews_data';
$post = native_post();
$post['mw_report_form']['crews'] = [['name' => 'Write failure test', 'url' => '', '_original' => '0']];
$_POST = wp_slash($post);
try {
    mw_save_report_metadata(1);
    throw new RuntimeException('Expected profile sync write error');
} catch (RuntimeException $error) {
    check($error->getCode() === 500, 'Surface failed profile writes instead of reporting success');
}
unset($GLOBALS['fail_meta_key']);
mw_save_report_metadata(1);
check($GLOBALS['meta'][9]['_mw_crews_data'][0]['name'] === 'Write failure test', 'Retry repairs a failed profile sync from the persisted reports');
$sync = mw_prepare_report_profile_sync(1, $GLOBALS['meta'][1]['_mw_report_payload']);
$GLOBALS['meta'][9]['_mw_crews_data'][] = ['name' => 'Concurrent observation', 'url' => ''];
try {
    mw_apply_report_profile_sync($sync);
    throw new RuntimeException('Expected concurrent profile conflict');
} catch (RuntimeException $error) {
    check($error->getCode() === 409, 'Do not silently overwrite concurrent profile changes');
    check(in_array('Concurrent observation', array_column($GLOBALS['meta'][9]['_mw_crews_data'], 'name'), true), 'Keep the concurrent profile data on conflict');
}
mw_save_report_metadata(1);
$insights = mw_build_player_insights(9);
check($insights['crews'] === ['Write failure test', 'Renamed crew'], 'Player insights expose the corrected and independently backed crews only');
check(!in_array('Wrong crew', $insights['crews'], true) && !in_array('Old orphan', $insights['crews'], true), 'Old accumulated crews cannot leak back through player-insights');
check(strpos(json_encode($insights), 'PRIVATE') === false, 'Shared profile output stays public-safe');
$legacy_payload = $GLOBALS['meta'][2]['_mw_report_payload'];
unset($GLOBALS['meta'][2]['_mw_report_payload']['crews']);
check(mw_map_report_item(2)['crews'] === [], 'A legacy report without crews cannot inherit aggregate crews as its own observations');
$GLOBALS['meta'][2]['_mw_report_payload']['crews'] = 'Text crew; Another text crew';
check(array_column(mw_map_report_item(2)['crews'], 'name') === ['Text crew', 'Another text crew'], 'Normalize legacy text crews consistently in report API responses');
$GLOBALS['meta'][2]['_mw_report_payload'] = $legacy_payload;
if (($argv[1] ?? '') === '--profile-json') {
    echo json_encode(['reportInsights' => $insights, 'reports' => [mw_map_report_item(1), mw_map_report_item(2)]]);
    exit;
}
$post = native_post();
$post['mw_report_form']['labels'] = [['label' => 'Spawnkill', 'detail' => 'Corrected', 'id' => '18', '_original' => '0']];
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check(mw_map_report_item(1)['labels'][0]['id'] === 9, 'Renaming a conduct updates its internal catalog ID');
$post = native_post();
$post['mw_report_form']['labels'] = [['label' => 'Custom corrected conduct', 'detail' => '', 'id' => '9', '_original' => '0']];
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check(mw_map_report_item(1)['labels'][0]['id'] === null, 'A custom conduct cannot retain the previous catalog ID');
$older = $GLOBALS['meta'][2]['_mw_report_payload'];
$older['nickname'] = 'Corrected older alias';
$sync = mw_prepare_report_profile_sync(2, $older);
check($sync['updates']['_mw_nickname'] === mw_map_report_item(1)['nickname'], 'Correcting an older report cannot replace the newer primary identity');
check(in_array('Corrected older alias', $sync['updates']['_mw_aliases'], true), 'Corrected historical identity remains an alias');
function web_post() {
    $stored = mw_report_admin_values(1);
    $post = native_post();
    $post['mw_report_form_version'] = '4';
    $post['mw_report_moderation_complete'] = '1';
    $post['mw_report_metadata'] = ['nickname' => $stored['nickname'], 'reason' => $stored['reason']];
    $post['mw_report_form'] = [
        'types' => ['MODDER'], 'conducts' => ['catalog-18'],
        'crews_text' => 'Corrected web crew, Another crew',
        'evidence' => [['attachment_id' => '700']],
    ];
    return $post;
}
$GLOBALS['meta'][1]['_mw_report_payload']['analysis'] = ['summary' => 'Internal summary', 'confidence' => 85, 'unknown' => ['preserve' => true]];
$GLOBALS['meta'][1]['_mw_report_payload']['anonymous'] = true;
$GLOBALS['meta'][1]['_mw_report_payload']['avatar1'] = 'https://images.test/preserved.png';
$GLOBALS['meta'][1]['_mw_report_payload']['time'] = 123456;
$before_payload = $GLOBALS['meta'][1]['_mw_report_payload'];
$post = web_post();
$_POST = wp_slash($post);
mw_save_report_metadata(1);
$after_payload = $GLOBALS['meta'][1]['_mw_report_payload'];
foreach (['analysis', 'anonymous', 'avatar1', 'avatar2', 'time', 'source', 'severity', 'severidad', 'validation', 'validacion', 'aliases', 'investigation_status', 'reporter', 'ownerDiscordId', 'ip'] as $key) {
    check(($after_payload[$key] ?? null) === ($before_payload[$key] ?? null), 'The web-faithful form must preserve hidden field: ' . $key);
}
check($after_payload['labels'][0]['label'] === 'Aimbot' && $after_payload['labelIds'] === [18], 'Checkbox selections produce canonical conduct and ID output');
check(array_column($after_payload['crews'], 'name') === ['Corrected web crew', 'Another crew'], 'Comma-separated crews replace the report crews');
check($after_payload['evidence'][0]['url'] === 'https://wordpress.test/uploads/700.png' && $after_payload['evidence'][0]['contentType'] === 'image/png', 'Native media resolves image metadata server-side without editable MIME fields');
check(in_array('Corrected web crew', array_column($GLOBALS['meta'][9]['_mw_crews_data'], 'name'), true), 'Web-faithful crew corrections synchronize shared history');
$post = web_post();
$post['mw_report_form']['evidence'] = [['_original' => '0']];
$post['mw_report_form']['crews_text'] = '';
$post['mw_report_form']['conducts'] = [];
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check(mw_map_report_item(1)['crews'] === [] && mw_map_report_item(1)['labels'] === [], 'Empty crews and unchecked conducts explicitly clear data');
check($GLOBALS['meta'][1]['_mw_report_payload']['evidence'][0] === $after_payload['evidence'][0], 'Original evidence metadata is preserved exactly');
foreach ([
    ['conducts', ['catalog-1']], ['conducts', ['catalog-999']], ['types', ['invented']],
    ['types', []],
    ['crews_text', []], ['evidence', [['url' => 'https://attacker.test/image.png']]],
    ['evidence', [['_original' => '99']]], ['evidence', [['_original' => '0'], ['_original' => '0']]],
] as [$key, $value]) {
    $bad = web_post();
    $bad['mw_report_form'][$key] = $value;
    reject_post($bad);
}
$bad = web_post();
unset($bad['mw_report_moderation_complete']);
reject_post($bad);
$bad = web_post();
$bad['mw_report_form']['evidence'] = array_map(static function ($id) { return ['attachment_id' => strval($id)]; }, range(700, 705));
reject_post($bad);
$GLOBALS['attachment_mime'] = 'video/mp4';
reject_post(web_post());
unset($GLOBALS['attachment_mime']);
$GLOBALS['can_upload'] = false;
reject_post(web_post());
unset($GLOBALS['can_upload']);
$GLOBALS['can_read_attachment'] = false;
reject_post(web_post());
unset($GLOBALS['can_read_attachment']);
$GLOBALS['attachment_path'] = __DIR__ . DIRECTORY_SEPARATOR . 'missing-image.png';
reject_post(web_post());
unset($GLOBALS['attachment_path']);
$size_fixture = tmpfile();
check($size_fixture !== false, 'Create temporary file for the exact upload-size boundary');
$GLOBALS['attachment_path'] = stream_get_meta_data($size_fixture)['uri'];
ftruncate($size_fixture, 5 * 1024 * 1024);
clearstatcache();
$post = web_post();
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check(mw_map_report_item(1)['evidence'][0]['size'] === 5 * 1024 * 1024, 'Accept an image exactly at the 5 MB boundary');
ftruncate($size_fixture, 5 * 1024 * 1024 + 1);
clearstatcache();
reject_post(web_post());
fclose($size_fixture);
unset($GLOBALS['attachment_path']);
$bad = web_post();
$bad['mw_report_form']['types'] = [];
$bad['mw_report_form']['conducts'] = [];
reject_post($bad);
$bad = web_post();
$bad['mw_report_metadata']['reason'] = 'Too short';
reject_post($bad);
$bad = web_post();
$bad['mw_report_metadata']['reason'] = str_repeat('x', 501);
reject_post($bad);
ob_start();
mw_render_report_meta_box((object) ['ID' => 1]);
$web_html = ob_get_clean();
foreach (['[extra]', '[analysis]', '[anonymous]', '[aliases]', '[custom_type]', '[contentType]', '[detail]', '[url]', '[investigation_status]', 'mw-conduct-picker', 'mw-report-moderation'] as $unwanted) {
    check(strpos($web_html, $unwanted) === false, 'Web report form must not expose: ' . $unwanted);
}
check(strpos($web_html, 'mw_report_votes') === false, 'Moderation is not mixed into the report form');
check(strpos($web_html, 'mw_report_form[crews_text]') !== false && strpos($web_html, 'mw_report_form[conducts][]') !== false, 'Render crews text and conduct choices like MostWanted');
check(preg_match('/id="mw-linked-rid"[^>]*readonly/', $web_html) === 1, 'RID is read-only like a resolved account in the web form');
$post = web_post();
$post['mw_report_form']['crews_text'] = 'Existing crew';
$GLOBALS['meta'][1]['_mw_report_payload']['crews'] = [['name' => 'Existing crew', 'url' => 'https://socialclub.rockstargames.com/crew/custom_link']];
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check(mw_map_report_item(1)['crews'][0]['url'] === 'https://socialclub.rockstargames.com/crew/custom_link', 'Unchanged crew names retain registered URLs without exposing another field');
$post = web_post();
$post['mw_report_metadata']['rid'] = '999';
$post['mw_report_metadata']['investigation_status'] = 'attacker-value';
$post['mw_report_form']['extra'] = ['severity' => 'attacker-value'];
$post['mw_report_form']['analysis'] = ['summary' => 'attacker-value'];
$stored_before = mw_report_admin_values(1);
$_POST = wp_slash($post);
mw_save_report_metadata(1);
$stored_after = mw_report_admin_values(1);
check($stored_after['rid'] === $stored_before['rid'] && $stored_after['investigation_status'] === $stored_before['investigation_status'] && $stored_after['analysis'] === $stored_before['analysis'] && $stored_after['extra']['severity'] === $stored_before['extra']['severity'], 'Hidden metadata cannot be overwritten by submitted fields absent from the web editor');
$old_evidence = $GLOBALS['meta'][1]['_mw_report_payload']['evidence'];
$old_reason = $GLOBALS['meta'][1]['_mw_report_payload']['reason'];
$GLOBALS['meta'][1]['_mw_report_payload']['evidence'] = array_fill(0, 6, ['url' => 'https://images.test/legacy.mp4', 'contentType' => 'video/mp4', 'name' => 'Historical video']);
$GLOBALS['meta'][1]['_mw_report_payload']['reason'] = str_repeat('L', 550);
$post = web_post();
$post['mw_report_form']['evidence'] = array_map(static function ($index) { return ['_original' => strval($index)]; }, range(0, 5));
$_POST = wp_slash($post);
mw_save_report_metadata(1);
check(count(mw_map_report_item(1)['evidence']) === 6 && strlen(mw_map_report_item(1)['content']) === 550, 'Simplifying controls must not truncate historical evidence or longer reasons');
$GLOBALS['meta'][1]['_mw_report_payload']['evidence'] = $old_evidence;
$GLOBALS['meta'][1]['_mw_report_payload']['reason'] = $old_reason;
$post = web_post();
$_POST = wp_slash($post);
mw_save_report_metadata(1);
if (in_array($argv[1] ?? '', ['--render', '--render-filled'], true)) {
    $post = web_post();
    $_POST = wp_slash($post);
    mw_save_report_metadata(1);
    ob_start();
    mw_render_report_meta_box((object) ['ID' => 1]);
    mw_render_report_moderation((object) ['ID' => 1]);
    $html = ob_get_clean();
    echo '<!doctype html><html lang="es"><meta charset="utf-8"><title>MostWanted editor fixture</title><style>body{background:#f0f0f1;font:13px/1.5 sans-serif;margin:24px}form{padding:20px;background:white;max-width:1100px;margin:auto}input,select,textarea,button{padding:6px;border:1px solid #8c8f94;border-radius:3px}.button{color:#2271b1;background:#f6f7f7;cursor:pointer}.button-link-delete{color:#b32d2e;border:0;background:none;cursor:pointer}' . file_get_contents(__DIR__ . DIRECTORY_SEPARATOR . 'report-admin.css') . '</style><form>' . $html . '</form><script>' . file_get_contents(__DIR__ . DIRECTORY_SEPARATOR . 'report-admin.js') . '</script></html>';
    exit;
}
echo "OK report metadata editor: registration, loading, persistence, API sync, validation, permissions, escaping and privacy\n";
echo "OK typed fields and false vote moderation: edits, deletion, counters, legacy data, stale forms and privacy\n";
echo "OK native report form: player, classifications, media, analysis, legacy fields, validation, removals and privacy\n";
echo "OK report-to-profile corrections: replacement, removal, other-report history, URLs, identity guards, counts, isolation and retries\n";
echo "OK web-faithful fields, hidden metadata preservation, conduct choices, crew corrections, image validation and separate moderation\n";
