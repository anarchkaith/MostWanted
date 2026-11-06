<?php
if (!defined('ABSPATH')) exit;

function mw_report_edit_revision($post_id) {
    $snapshot = [get_post_meta($post_id, '_mw_report_payload', true)];
    foreach (mw_report_admin_fields() as $field) {
        $snapshot[] = get_post_meta($post_id, $field['meta'], true);
    }
    return hash('sha256', serialize($snapshot));
}

function mw_report_edit_response($data, $status = 200) {
    $response = new WP_REST_Response($data, $status);
    $response->header('Cache-Control', 'private, no-store');
    return $response;
}

function mw_can_edit_report_actor($post_id, $actor) {
    if (!is_array($actor) || !is_string($actor['id'] ?? null) || !preg_match('/^\d+$/D', $actor['id'])) return false;
    return ($actor['isAdmin'] ?? false) === true
        || $actor['id'] === get_post_meta($post_id, '_mw_owner_discord_id', true);
}

function mw_prepare_report_edit($post_id, $input) {
    if (!is_array($input) || array_diff(array_keys($input), ['nickname', 'reason', 'crews', 'typesOfInfraction', 'labels', 'evidence'])
        || !is_string($input['nickname'] ?? null) || !is_string($input['reason'] ?? null)
        || !is_string($input['crews'] ?? null) || !is_array($input['typesOfInfraction'] ?? null)
        || !is_array($input['labels'] ?? null) || !is_array($input['evidence'] ?? null)) {
        return new WP_Error('mw_report_metadata', 'Campos de edicion invalidos o incompletos.', ['status' => 400]);
    }
    $stored = mw_report_admin_values($post_id);
    $conducts = [];
    $catalog = [];
    $id = 0;
    foreach (mw_report_form_catalog() as $category => $group) {
        foreach ($group['labels'] as $label) {
            $id++;
            if (in_array($category, $input['typesOfInfraction'], true)) $catalog[$label] = 'catalog-' . $id;
        }
    }
    foreach ($input['labels'] as $label) {
        if (!is_string($label)) return new WP_Error('mw_report_metadata', 'Conducta invalida.', ['status' => 400]);
        if (isset($catalog[$label])) $conducts[] = $catalog[$label];
        else {
            $index = array_search($label, array_column($stored['labels'], 'label'), true);
            if ($index === false) return new WP_Error('mw_report_metadata', 'Conducta desconocida.', ['status' => 400]);
            $conducts[] = 'legacy-' . $index;
        }
    }
    // Reuse form validation and preservation of historical data. Existing evidence
    // travels by index; only new uploads carry URLs.
    $originals = [];
    $new_items = [];
    foreach ($input['evidence'] as $item) {
        if (!is_array($item)) return new WP_Error('mw_report_metadata', 'Evidencia invalida.', ['status' => 400]);
        if (array_key_exists('_original', $item)) {
            if (!is_int($item['_original']) || $item['_original'] < 0) return new WP_Error('mw_report_metadata', 'Referencia de evidencia invalida.', ['status' => 400]);
            $originals[] = ['_original' => strval($item['_original'])];
        } else {
            if (!is_string($item['url'] ?? null) || !wp_http_validate_url($item['url'])
                || !is_string($item['name'] ?? null)
                || !in_array($item['contentType'] ?? '', ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true)) {
                return new WP_Error('mw_report_metadata', 'La nueva evidencia debe ser una imagen con URL HTTP/HTTPS valida.', ['status' => 400]);
            }
            $new_items[] = ['url' => $item['url'], 'name' => sanitize_text_field($item['name']), 'contentType' => $item['contentType']];
        }
    }
    if (count($input['evidence']) > max(5, count($stored['evidence']))) return new WP_Error('mw_report_metadata', 'Maximo 5 evidencias o el limite historico.', ['status' => 400]);
    $prepared = mw_prepare_web_report_form($post_id, ['nickname' => $input['nickname'], 'reason' => $input['reason']], [
        'crews_text' => $input['crews'], 'types' => $input['typesOfInfraction'], 'conducts' => $conducts, 'evidence' => $originals,
    ]);
    if (is_wp_error($prepared)) return $prepared;
    $prepared['evidence'] = wp_json_encode(array_merge(json_decode($prepared['evidence'], true), $new_items));
    return mw_validate_report_admin_data($prepared);
}

function mw_rest_report_edit($request) {
    $post_id = intval($request->get_param('id'));
    $post = get_post($post_id);
    if (!$post || $post->post_type !== 'mw_report' || $post->post_status !== 'publish') {
        return mw_report_edit_response(['ok' => false, 'code' => 'report_not_found', 'error' => 'Reporte no disponible.'], 404);
    }
    $can_edit = mw_can_edit_report_actor($post_id, $request->get_param('actor'));
    if ($request->get_param('inspect') === true) {
        if (!$can_edit) return mw_report_edit_response(['ok' => true, 'canEdit' => false]);
        return mw_report_edit_response(['ok' => true, 'canEdit' => true, 'report' => mw_map_report_item($post_id), 'revision' => mw_report_edit_revision($post_id)]);
    }
    if (!$can_edit) return mw_report_edit_response(['ok' => false, 'error' => 'Solo la administradora o el autor pueden editar este reporte.'], 403);
    global $wpdb;
    $lock = 'mw_edit_' . hash('sha256', $wpdb->prefix . ':' . get_post_meta($post_id, '_mw_player_post_id', true));
    $lock = substr($lock, 0, 64);
    if (strval($wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 0)', $lock))) !== '1') {
        return mw_report_edit_response(['ok' => false, 'error' => 'Hay otra edicion en curso o no se pudo bloquear la ficha. Reintenta.'], 409);
    }
    try {
        wp_cache_delete($post_id, 'post_meta');
        wp_cache_delete(intval(get_post_meta($post_id, '_mw_player_post_id', true)), 'post_meta');
        $revision = $request->get_param('revision');
        if (!is_string($revision) || !hash_equals(mw_report_edit_revision($post_id), $revision)) {
            return mw_report_edit_response(['ok' => false, 'error' => 'El reporte cambio. Recarga antes de editar.'], 409);
        }
        $values = mw_prepare_report_edit($post_id, $request->get_param('changes'));
        if (is_wp_error($values)) return mw_report_edit_response(['ok' => false, 'error' => $values->get_error_message()], 400);
        $result = mw_write_report_values($post_id, $values, true, true);
        if (is_wp_error($result)) {
            $data = $result->get_error_data();
            return mw_report_edit_response(['ok' => false, 'error' => $result->get_error_message()], $data['status'] ?? 400);
        }
        return mw_report_edit_response(['ok' => true, 'canEdit' => true, 'report' => mw_map_report_item($post_id), 'revision' => mw_report_edit_revision($post_id)]);
    } finally {
        if (strval($wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock))) !== '1') {
            error_log('[mostwanted-report] No se pudo liberar el bloqueo de edicion.');
        }
    }
}

add_action('rest_api_init', static function () {
    register_rest_route(MW_NAMESPACE, '/reports/(?P<id>\d+)/edit', [
        'methods' => 'POST', 'callback' => 'mw_rest_report_edit', 'permission_callback' => 'mw_can_ingest_reports',
    ]);
});
