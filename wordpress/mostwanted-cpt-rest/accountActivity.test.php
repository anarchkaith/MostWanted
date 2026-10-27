<?php
define('ABSPATH', __DIR__);
const MW_NAMESPACE = 'mostwanted/v1';
$GLOBALS['actions'] = [];
$GLOBALS['meta'] = [];
$GLOBALS['admin'] = false;
function add_action($name, $callback) { $GLOBALS['actions'][$name] = $callback; }
function register_post_type($name, $args) { $GLOBALS['type'] = $args; }
function sanitize_text_field($value) { return strip_tags($value); }
function current_user_can($cap) { return $cap === 'manage_options' && $GLOBALS['admin']; }
function get_posts($args) { return isset($GLOBALS['meta'][1]) ? [1] : []; }
function wp_insert_post($post, $error) { $GLOBALS['post'] = $post; return 1; }
function is_wp_error($value) { return $value instanceof WP_Error; }
function wp_slash($value) { return $value; }
function update_post_meta($id, $key, $value) { $GLOBALS['meta'][$id][$key] = $value; return true; }
function get_post_meta($id, $key, $single) { return $GLOBALS['meta'][$id][$key] ?? ''; }
function esc_html($value) { return htmlspecialchars($value, ENT_QUOTES); }
function esc_url($value) { return esc_html($value); }
function get_edit_post_link($id) { return 'https://wp.test/edit/' . $id; }
class WP_Error { function __construct(...$args) {} }
require __DIR__ . DIRECTORY_SEPARATOR . 'account-activity.php';
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
($GLOBALS['actions']['init'])();
check($GLOBALS['type']['show_in_rest'] === false && $GLOBALS['type']['public'] === false, 'Accounts are never public REST resources');
check($GLOBALS['type']['capabilities']['edit_posts'] === 'manage_options', 'Only administrators can list accounts');
$identity = ['id' => '123', 'username' => '<b>Name</b>', 'email' => 'private@test', 'avatar' => 'hash', 'token' => 'SECRET'];
check(mw_record_account($identity, 'login') === 1, 'Persist verified account');
check($GLOBALS['post']['post_status'] === 'private', 'Private post status');
check(!empty($GLOBALS['meta'][1]['_mw_last_login']), 'Persist login separately from general activity');
check(!isset($GLOBALS['meta'][1]['_mw_identity']['token']), 'Never store tokens');
check($GLOBALS['meta'][1]['_mw_identity']['username'] === 'Name', 'Sanitize profile fields');
$identity['email'] = '';
mw_record_account($identity, 'active');
check($GLOBALS['meta'][1]['_mw_identity']['email'] === 'private@test', 'Do not erase a previously available email');
$post = (object) ['ID' => 1, 'post_type' => 'mw_account'];
ob_start(); mw_render_private_identity($post); $hidden = ob_get_clean();
check($hidden === '', 'Deny direct renderer access to non-administrators');
$GLOBALS['admin'] = true;
ob_start(); mw_render_private_identity($post); $visible = ob_get_clean();
check(str_contains($visible, 'private@test') && !str_contains($visible, 'SECRET'), 'Admin sees only private allowlisted identity');
echo "OK private account persistence, administrative access and token exclusion\n";
