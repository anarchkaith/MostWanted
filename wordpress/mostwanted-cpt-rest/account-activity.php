<?php
if (!defined('ABSPATH')) exit;

add_action('init', static function () {
    register_post_type('mw_account', [
        'label' => 'Usuarios MostWanted', 'public' => false, 'publicly_queryable' => false,
        'show_ui' => true, 'show_in_rest' => false, 'show_in_menu' => 'edit.php?post_type=mw_report',
        'supports' => ['title'], 'map_meta_cap' => false,
        'capabilities' => array_fill_keys(['edit_post', 'read_post', 'delete_post', 'edit_posts', 'edit_others_posts',
            'publish_posts', 'read_private_posts', 'delete_posts', 'delete_private_posts', 'delete_published_posts',
            'delete_others_posts', 'edit_private_posts', 'edit_published_posts'], 'manage_options') + ['create_posts' => 'do_not_allow'],
    ]);
});

function mw_private_identity($value) {
    if (!is_array($value) || !preg_match('/^\d+$/D', $value['id'] ?? '')) return null;
    $result = [];
    foreach (['id', 'username', 'globalName', 'avatar', 'email'] as $key) {
        $result[$key] = sanitize_text_field(is_string($value[$key] ?? null) ? $value[$key] : '');
    }
    return $result;
}

function mw_record_account($identity, $event) {
    $identity = mw_private_identity($identity);
    if (!$identity) return new WP_Error('invalid_identity', 'Identidad invalida.', ['status' => 400]);
    $ids = get_posts(['post_type' => 'mw_account', 'post_status' => 'private', 'numberposts' => 1,
        'fields' => 'ids', 'meta_key' => '_mw_discord_id', 'meta_value' => $identity['id']]);
    $id = $ids[0] ?? 0;
    if (!$id) {
        $id = wp_insert_post(['post_type' => 'mw_account', 'post_status' => 'private',
            'post_title' => $identity['username'] . ' [' . $identity['id'] . ']'], true);
        if (is_wp_error($id)) return $id;
        update_post_meta($id, '_mw_discord_id', $identity['id']);
        update_post_meta($id, '_mw_first_access', gmdate('c'));
    }
    $previous = get_post_meta($id, '_mw_identity', true);
    if (is_array($previous) && $identity['email'] === '') $identity['email'] = $previous['email'] ?? '';
    $values = ['_mw_identity' => $identity, '_mw_last_access' => gmdate('c'), '_mw_last_event' => $event];
    if ($event === 'login') $values['_mw_last_login'] = gmdate('c');
    foreach ($values as $key => $value) {
        if (update_post_meta($id, $key, wp_slash($value)) === false && get_post_meta($id, $key, true) !== $value) {
            return new WP_Error('account_storage_failed', 'No se pudo guardar la actividad.', ['status' => 500]);
        }
    }
    return $id;
}

add_action('rest_api_init', static function () {
    register_rest_route(MW_NAMESPACE, '/accounts/activity', [
        'methods' => 'POST', 'permission_callback' => 'mw_can_ingest_reports',
        'callback' => static function ($request) {
            $event = $request->get_param('event');
            if (!in_array($event, ['login', 'active'], true)) return new WP_Error('invalid_event', 'Evento invalido.', ['status' => 400]);
            $id = mw_record_account($request->get_param('identity'), $event);
            return is_wp_error($id) ? $id : new WP_REST_Response(['ok' => true], 200);
        },
    ]);
});

function mw_render_private_identity($post) {
    if (!current_user_can('manage_options')) return;
    $identity = get_post_meta($post->ID, $post->post_type === 'mw_report' ? '_mw_private_identity' : '_mw_identity', true);
    echo '<p>Datos privados. Solo administradores. No se publican en enlaces ni en Discord.</p><dl>';
    foreach (['id' => 'ID de Discord', 'username' => 'Usuario', 'globalName' => 'Nombre visible', 'email' => 'Correo'] as $key => $label) {
        if (!empty($identity[$key])) echo '<dt>' . esc_html($label) . '</dt><dd>' . esc_html($identity[$key]) . '</dd>';
    }
    $owner = get_post_meta($post->ID, '_mw_owner_discord_id', true);
    if (empty($identity['id']) && $owner) echo '<dt>ID de Discord</dt><dd>' . esc_html($owner) . '</dd>';
    if (!empty($identity['avatar']) && preg_match('/^[a-zA-Z0-9_]+$/D', $identity['avatar'])) {
        $url = 'https://cdn.discordapp.com/avatars/' . rawurlencode($identity['id']) . '/' . rawurlencode($identity['avatar']) . '.png?size=128';
        echo '<dt>Avatar</dt><dd><img width="80" height="80" src="' . esc_url($url) . '" alt="" /></dd>';
    }
    foreach (['_mw_created_at' => 'Fecha de envio', '_mw_first_access' => 'Primer acceso registrado',
        '_mw_last_login' => 'Ultimo inicio de sesion', '_mw_last_access' => 'Ultima actividad registrada',
        '_mw_last_event' => 'Ultimo evento'] as $key => $label) {
        $value = get_post_meta($post->ID, $key, true);
        if ($value) echo '<dt>' . esc_html($label) . '</dt><dd>' . esc_html($value) . '</dd>';
    }
    echo '</dl>';
    if ($post->post_type === 'mw_account' && !empty($identity['id'])) {
        $reports = get_posts(['post_type' => 'mw_report', 'post_status' => 'any', 'numberposts' => 50,
            'fields' => 'ids', 'meta_key' => '_mw_owner_discord_id', 'meta_value' => $identity['id']]);
        echo '<h4>Ultimos reportes enviados (hasta 50)</h4><ul>';
        foreach ($reports as $id) echo '<li><a href="' . esc_url(get_edit_post_link($id)) . '">Reporte #' . intval($id) . '</a></li>';
        echo '</ul>';
    }
}

add_action('add_meta_boxes', static function () {
    if (!current_user_can('manage_options')) return;
    foreach (['mw_report', 'mw_account'] as $type) {
        add_meta_box('mw-private-identity', 'Identidad y actividad privada', 'mw_render_private_identity', $type);
    }
});
