<?php
if (!defined('ABSPATH')) exit;

function mw_readonly_value_html($value) {
    if (is_array($value)) {
        $html = '<dl>';
        foreach ($value as $key => $entry) {
            $html .= '<dt>' . esc_html(strval($key)) . '</dt><dd>' . mw_readonly_value_html($entry) . '</dd>';
        }
        return $html . '</dl>';
    }
    if (is_bool($value)) $value = $value ? 'true' : 'false';
    return '<span style="white-space:pre-wrap;overflow-wrap:anywhere">' . esc_html($value === null ? 'null' : strval($value)) . '</span>';
}

function mw_report_readonly_html($post_id) {
    $values = mw_report_template_values($post_id);
    $html = '<section class="mw-report-readonly"><h2>Datos del reporte</h2><table class="widefat striped"><tbody>';
    foreach (mw_report_template_fields() as $name => $field) {
        if ($values[$name] === '') continue;
        $html .= '<tr><th scope="row">' . esc_html($field['label']) . '</th><td>'
            . mw_readonly_value_html($values[$name]) . '</td></tr>';
    }
    return $html . '</tbody></table></section>';
}

function mw_report_readonly_boxes() {
    foreach (['submitdiv', 'slugdiv', 'authordiv', 'postcustom', 'revisionsdiv'] as $box) {
        remove_meta_box($box, 'mw_report', 'normal');
        remove_meta_box($box, 'mw_report', 'side');
    }
}
add_action('add_meta_boxes_mw_report', 'mw_report_readonly_boxes', 99);

function mw_report_readonly_admin() {
    $id = intval($_POST['post_ID'] ?? $_GET['post'] ?? 0);
    $post = $id ? get_post($id) : null;
    $type = $post ? $post->post_type : ($_REQUEST['post_type'] ?? '');
    if ($type === 'mw_report' && (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST'
        || in_array($_GET['action'] ?? '', ['trash', 'untrash', 'delete'], true))) {
        wp_die('Los reportes son de solo lectura en WordPress. Edita desde MostWanted.', 'MostWanted', ['response' => 403]);
    }
}
add_action('admin_init', 'mw_report_readonly_admin');

function mw_report_readonly_rest($prepared_post, $request) {
    return new WP_Error('mw_report_readonly', 'Edita los reportes desde MostWanted.', ['status' => 403]);
}
add_filter('rest_pre_insert_mw_report', 'mw_report_readonly_rest', 10, 2);

function mw_report_readonly_caps($caps, $cap, $user_id, $args) {
    if (in_array($cap, ['delete_post', 'add_post_meta', 'edit_post_meta', 'delete_post_meta'], true) && isset($args[0])) {
        $post = get_post($args[0]);
        if ($post && $post->post_type === 'mw_report') return ['do_not_allow'];
    }
    return $caps;
}
add_filter('map_meta_cap', 'mw_report_readonly_caps', 10, 4);

add_filter('post_row_actions', static function ($actions, $post) {
    if ($post->post_type === 'mw_report') {
        unset($actions['inline hide-if-no-js'], $actions['trash']);
    }
    return $actions;
}, 10, 2);
add_filter('bulk_actions-edit-mw_report', '__return_empty_array');
