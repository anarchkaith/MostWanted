<?php
define('ABSPATH', __DIR__);
function add_action(...$args) {}
function add_filter(...$args) {}
function register_activation_hook(...$args) {}
function register_deactivation_hook(...$args) {}
function get_the_title($id) { return 'Player'; }
function get_post_meta($id, $key, $single) { return ''; }
function wp_remote_get($url, $args = []) {
    $GLOBALS['fetched'][] = $url;
    return $GLOBALS['remote_responses'][$url] ?? new WP_Error('missing');
}
function wp_remote_retrieve_response_code($response) { return $response['response']['code'] ?? 0; }
function wp_remote_retrieve_header($response, $name) { return $response['headers'][$name] ?? ''; }
function wp_remote_retrieve_body($response) { return $response['body'] ?? ''; }
function wp_upload_bits($name, $deprecated, $bits) {
    $GLOBALS['uploads'][] = $name;
    return ['url' => 'https://sitio.test/uploads/' . $name];
}
function wp_generate_password($length, $special, $extra) { return str_repeat('a', $length); }
function esc_url_raw($url) { return $url; }
class WP_Error { public function __construct(public $code = '') {} }
function is_wp_error($value) { return $value instanceof WP_Error; }
require __DIR__ . DIRECTORY_SEPARATOR . 'mostwanted-cpt-rest.php';

function check($condition, $message) {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$png = ['response' => ['code' => 200], 'headers' => ['content-type' => 'image/png'], 'body' => 'PNGDATA'];
$GLOBALS['remote_responses'] = [
    'https://prod.cloud.rockstargames.com/members/sc/6266/123/publish/gta5/mpchars/0.png' => $png,
    'https://prod.cloud.rockstargames.com/members/sc/6266/123/publish/gta5/mpchars/1.png' => ['response' => ['code' => 404]],
];
$GLOBALS['fetched'] = [];
$GLOBALS['uploads'] = [];

check(mw_parse_rockstar_avatar_url('https://prod.cloud.rockstargames.com/members/sc/6266/123/publish/gta5/mpchars/1.png?v=9')['index'] === 1, 'Parse Rockstar avatar with version');
check(mw_parse_rockstar_avatar_url('https://evil.test/prod.cloud.rockstargames.com/members/sc/6266/123/publish/gta5/mpchars/0.png') === null, 'Reject lookalike host');

$local = mw_localize_avatar('', '123', 0);
check($local === 'https://sitio.test/uploads/mw-avatar-123-0-aaaaaaaa.png', 'Rehost current avatar from RID');
check(mw_localize_avatar('', '123', 1) === '', 'Failed avatar returns empty instead of Rockstar URL');
check(mw_localize_avatar('https://prod.cloud.rockstargames.com/members/sc/6266/123/publish/gta5/mpchars/0.png', '', 0) === $local, 'Legacy Rockstar URL without RID is rehosted');
check(mw_localize_avatar('https://images.test/manual.png', '', 0) === 'https://images.test/manual.png', 'Keep non-Rockstar manual URL without RID');
check(mw_localize_avatar('https://images.test/manual.png', '123', 0) === $local, 'Rockstar current avatar wins over manual URL when RID exists');

$payload = mw_localize_report_avatars(['avatar1' => '', 'avatar2' => ''], '123');
check($payload['avatar1'] === $local && $payload['avatar2'] === '', 'Localize both report avatar slots');
check(count(array_filter($GLOBALS['fetched'], static fn($url) => str_contains($url, 'mpchars/0.png'))) >= 1, 'Downloads happen server-side');

echo "avatarRehost.test.php passed\n";
