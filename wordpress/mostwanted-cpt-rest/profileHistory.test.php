<?php
define('ABSPATH', __DIR__);
function add_action(...$args) {}
function add_filter(...$args) {}
function register_activation_hook(...$args) {}
function register_deactivation_hook(...$args) {}
function wp_update_post($data) { return $data['ID']; }
function current_time($format) { return '2026-10-20 12:00:00'; }
function wp_strip_all_tags($text) { return strip_tags($text); }
function get_post_meta($id, $key, $single) { return $GLOBALS['profiles'][$id][$key] ?? ''; }
function update_post_meta($id, $key, $value) { $GLOBALS['profiles'][$id][$key] = $value; }
function get_posts($query) {
    $ids = [];
    foreach ($GLOBALS['profiles'] as $id => $meta) {
        $value = $meta[$query['meta_key']] ?? '';
        $matches = ($query['meta_compare'] ?? '') === 'LIKE'
            ? stripos(serialize($value), $query['meta_value']) !== false
            : $value === $query['meta_value'];
        if ($matches) {
            $ids[] = $id;
        }
    }
    return $query['numberposts'] === 1 ? array_slice($ids, 0, 1) : $ids;
}
require __DIR__ . DIRECTORY_SEPARATOR . 'mostwanted-cpt-rest.php';
function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}
$GLOBALS['profiles'] = [
    1 => [
        '_mw_rid' => '123', '_mw_player_id' => 'RID-123', '_mw_nickname' => 'Before',
        '_mw_nickname_normalized' => 'before',
        '_mw_aliases_history' => [['alias' => 'Before', 'time' => 100]],
        '_mw_avatar_1' => 'https://images.test/old.png', '_mw_avatar_2' => 'https://images.test/second.png',
        '_mw_crews_data' => [['name' => 'OldCrew', 'url' => '']],
    ],
];
mw_merge_player_profile(1, [
    'nickname' => 'After', 'rid' => 123, 'playerId' => 'RID-123', 'time' => 200,
    'aliases' => ['OtherName'], 'avatar1' => 'https://images.test/new.png',
    'crews' => [['name' => 'NewCrew', 'url' => 'https://crew.test/']],
]);
$profile = $GLOBALS['profiles'][1];
check($profile['_mw_nickname'] === 'After', 'Newly reported name updates the profile');
$names = array_column($profile['_mw_aliases_history'], 'time', 'alias');
check($names['Before'] === 100, 'Do not move old names to the new report date');
check($names['After'] === 200 && $names['OtherName'] === 200, 'Record newly reported names');
check($profile['_mw_avatar_1'] === 'https://images.test/new.png', 'Record the new avatar');
check($profile['_mw_avatar_2'] === 'https://images.test/second.png', 'Missing avatars must not erase known values');
check(count($profile['_mw_avatar_history']) === 3, 'Preserve both previous avatars and the new avatar');
check(count($profile['_mw_crews_data']) === 2, 'Retain previous crew affiliations');
mw_merge_player_profile(1, ['nickname' => 'After', 'rid' => 123, 'playerId' => 'RID-123', 'time' => 300]);
check(count($GLOBALS['profiles'][1]['_mw_avatar_history']) === 3, 'Do not duplicate avatar history on subsequent reports');
$names = array_column($GLOBALS['profiles'][1]['_mw_aliases_history'], 'time', 'alias');
check($names['Before'] === 100 && $names['OtherName'] === 200, 'Only refresh names present in the new report');
check($GLOBALS['profiles'][1]['_mw_avatar_1'] === 'https://images.test/new.png', 'Empty reports preserve known avatar URLs');
check(mw_find_player_post('After', 999, 'RID-999') === 0, 'Never merge homonyms with different RIDs');
check(mw_find_player_post('AnotherName', 123, 'RID-123') === 1, 'A name change with the same RID uses the same profile');
check(mw_find_player_post('Before', null, '') === 1, 'Find players by their previously reported names');
check(mw_find_player_post('Before', 999, '') === 0, 'Historical names cannot merge conflicting RIDs');
echo "OK WordPress profile history, partial updates and RID identity\n";
