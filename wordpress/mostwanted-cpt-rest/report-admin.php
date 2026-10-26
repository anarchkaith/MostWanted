<?php
if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . DIRECTORY_SEPARATOR . 'report-admin-form.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'report-profile-sync.php';

function mw_report_admin_fields() {
    return [
        'nickname' => ['label' => 'Nickname', 'type' => 'text', 'meta' => '_mw_nickname'],
        'rid' => ['label' => 'RID (opcional)', 'type' => 'text', 'meta' => '_mw_rid'],
        'reason' => ['label' => 'Motivo / descripcion', 'type' => 'textarea', 'meta' => '_mw_reason'],
        'investigation_status' => ['label' => 'Estado de investigacion', 'type' => 'text', 'meta' => '_mw_investigation_status'],
        'typesOfInfraction' => ['label' => 'Infracciones', 'type' => 'list', 'meta' => '_mw_types'],
        'labels' => ['label' => 'Etiquetas (label: nombre, id: identificador, detail: detalle)', 'type' => 'list', 'meta' => '_mw_labels'],
        'evidence' => ['label' => 'Evidencias (url: enlace, name: nombre, contentType: tipo de archivo)', 'type' => 'list', 'meta' => '_mw_evidence'],
        'analysis' => ['label' => 'Analisis', 'type' => 'json', 'meta' => '_mw_analysis'],
    ];
}

function mw_report_admin_extra_keys() {
    return [
        'username', 'avatar1', 'avatar2', 'aliases', 'crews', 'time',
        'severity', 'severidad', 'validation', 'validacion', 'anonymous', 'source',
    ];
}

function mw_add_report_meta_box() {
    add_meta_box('mw-report-metadata', 'Reporte MostWanted', 'mw_render_report_meta_box', 'mw_report', 'normal', 'high');
    add_meta_box('mw-report-moderation', 'Moderación de votos', 'mw_render_report_moderation', 'mw_report', 'normal', 'default');
}
add_action('add_meta_boxes_mw_report', 'mw_add_report_meta_box');

function mw_report_admin_values($post_id) {
    $public = mw_map_report_item($post_id);
    $payload = get_post_meta($post_id, '_mw_report_payload', true);
    $payload = is_array($payload) ? $payload : [];
    $values = [];
    foreach (mw_report_admin_fields() as $key => $field) {
        if ($key === 'reason') {
            $values[$key] = $public['content'];
        } elseif ($key === 'typesOfInfraction') {
            $values[$key] = $public['categories'];
        } elseif ($key === 'investigation_status') {
            $values[$key] = $payload[$key] ?? $payload['report'][$key] ?? get_post_meta($post_id, $field['meta'], true);
        } elseif ($key === 'analysis' && !isset($payload[$key]) && empty($public[$key])) {
            $values[$key] = $payload['report'][$key] ?? $public[$key];
        } elseif ($key === 'labels' && !array_key_exists('labels', $payload) && empty($public['labels'])) {
            $values[$key] = mw_safe_meta_array($post_id, $field['meta']);
        } else {
            $values[$key] = $public[$key] ?? '';
        }
    }
    $values['extra'] = array_intersect_key($payload, array_flip(mw_report_admin_extra_keys()));
    return $values;
}

function mw_render_report_meta_box($post) {
    mw_render_report_form($post);
}

function mw_report_admin_assets($hook) {
    $screen = get_current_screen();
    if ($screen && $screen->post_type === 'mw_report' && in_array($hook, ['post.php', 'post-new.php'], true)) {
        wp_enqueue_media();
        wp_enqueue_style('mw-report-admin', plugins_url('report-admin.css', __FILE__), [], '0.6.9');
        wp_enqueue_script('mw-report-admin', plugins_url('report-admin.js', __FILE__), ['media-views'], '0.6.9', true);
    }
}
add_action('admin_enqueue_scripts', 'mw_report_admin_assets');

function mw_decode_report_value($node, $depth = 0) {
    if ($depth > 20 || !is_array($node) || !is_string($node['type'] ?? null)) {
        return new WP_Error('mw_report_metadata', 'Estructura de campos invalida o demasiado profunda.');
    }
    $type = $node['type'];
    if (in_array($type, ['list', 'object'], true)) {
        $result = [];
        $children = $node['children'] ?? [];
        if (!is_array($children)) {
            return new WP_Error('mw_report_metadata', 'Lista de campos invalida.');
        }
        foreach ($children as $child) {
            if (!is_array($child)) {
                return new WP_Error('mw_report_metadata', 'Campo invalido.');
            }
            $value = mw_decode_report_value($child['node'] ?? null, $depth + 1);
            if (is_wp_error($value)) {
                return $value;
            }
            if ($type === 'list') {
                $result[] = $value;
            } else {
                $key = $child['key'] ?? null;
                if (!is_string($key) || trim($key) === '' || array_key_exists($key, $result)) {
                    return new WP_Error('mw_report_metadata', 'Cada propiedad necesita un nombre unico no vacio.');
                }
                $result[$key] = $value;
            }
        }
        return $type === 'object' ? (object) $result : $result;
    }
    $value = $node['value'] ?? '';
    if (!is_string($value)) {
        return new WP_Error('mw_report_metadata', 'Valor de campo invalido.');
    }
    if ($type === 'text') return $value;
    if ($type === 'null') return null;
    if ($type === 'boolean' && in_array($node['boolean'] ?? null, ['true', 'false'], true)) return $node['boolean'] === 'true';
    if ($type === 'number' && is_numeric($value) && is_finite(floatval($value))) return $value + 0;
    return new WP_Error('mw_report_metadata', 'Numero o booleano invalido. Usa true o false para Si / No.');
}

function mw_report_vote_rows($community) {
    $rows = [];
    $seen = [];
    foreach ($community['feedback'] as $feedback_index => $item) {
        if (!is_array($item)) continue;
        $voter = mw_str($item['voterId'] ?? '');
        if ($voter !== '' && isset($seen[$voter])) continue;
        if ($voter !== '') $seen[$voter] = true;
        $rows[] = ['voter' => $voter, 'reason' => mw_str($item['reason'] ?? ''), 'feedback_index' => $feedback_index];
    }
    foreach ($community['votesByVoter'] as $voter => $vote) {
        if (is_array($vote) && ($vote['voteType'] ?? '') === 'down' && !isset($seen[$voter])) {
            $rows[] = ['voter' => strval($voter), 'reason' => mw_str($vote['reason'] ?? '')];
        }
    }
    return $rows;
}

function mw_render_report_votes($post_id) {
    $community = mw_get_community_verification($post_id);
    echo '<h3>Votos de la comunidad</h3><div class="mw-vote-counts"><span>Verdadero <strong>' . intval($community['up']) . '</strong></span><span>Falso <strong>' . intval($community['down']) . '</strong></span></div><p class="description">Puedes corregir los motivos de Falso. Al eliminar un voto se borra su motivo y se descuenta del contador. Las identidades e IPs permanecen privadas.</p>';
    echo '<input type="hidden" name="mw_votes_snapshot" value="' . esc_attr(hash('sha256', serialize($community))) . '">';
    $rows = mw_report_vote_rows($community);
    if (!$rows) echo '<p>No hay motivos de votos Falso para moderar.</p>';
    foreach ($rows as $index => $row) {
        echo '<div class="mw-vote"><label>Motivo ' . ($index + 1) . '<textarea rows="3" name="mw_report_votes[' . $index . '][reason]">' . esc_textarea($row['reason']) . '</textarea></label>';
        echo '<label class="mw-vote-delete"><input type="checkbox" name="mw_report_votes[' . $index . '][delete]" value="1"> Eliminar voto completo al guardar</label></div>';
    }
}

function mw_prepare_report_votes($post_id, $input, $snapshot) {
    $community = mw_get_community_verification($post_id);
    if (!is_string($snapshot) || !hash_equals(hash('sha256', serialize($community)), $snapshot)) {
        return new WP_Error('mw_report_metadata', 'Los votos cambiaron mientras editabas. Recarga el reporte antes de guardar para no sobrescribir votos nuevos.');
    }
    if (!is_array($input)) return new WP_Error('mw_report_metadata', 'Votos invalidos.');
    $rows = mw_report_vote_rows($community);
    if (count($input) !== count($rows)) return new WP_Error('mw_report_metadata', 'Faltan campos de votos. Recarga el reporte.');
    foreach ($rows as $index => $row) {
        $edit = $input[$index] ?? null;
        if (!is_array($edit) || !is_string($edit['reason'] ?? null)) return new WP_Error('mw_report_metadata', 'Motivo de voto invalido.');
        $delete = ($edit['delete'] ?? '') === '1';
        $reason = sanitize_textarea_field($edit['reason']);
        if (!$delete && trim($reason) === '') return new WP_Error('mw_report_metadata', 'Los votos Falso necesitan un motivo; para quitarlo elimina el voto completo.');
        $voter = $row['voter'];
        $vote = $community['votesByVoter'][$voter] ?? null;
        if ($delete) {
            if ($voter === '' || $vote === null || $vote === 'down' || (is_array($vote) && ($vote['voteType'] ?? '') === 'down')) {
                $community['down'] = max(0, $community['down'] - 1);
            }
            if ($voter !== '' && ($vote === 'down' || (is_array($vote) && ($vote['voteType'] ?? '') === 'down'))) unset($community['votesByVoter'][$voter]);
        } elseif (is_array($vote) && ($vote['voteType'] ?? '') === 'down') {
            $community['votesByVoter'][$voter]['reason'] = $reason;
        }
        $matched_legacy = false;
        foreach ($community['feedback'] as $key => $item) {
            if (!is_array($item)) continue;
            $matches = $voter !== '' ? mw_str($item['voterId'] ?? '') === $voter : $key === $row['feedback_index'];
            if (!$matches) continue;
            $matched_legacy = true;
            if ($delete) unset($community['feedback'][$key]);
            else $community['feedback'][$key]['reason'] = $reason;
        }
        if (!$delete && $voter !== '' && !$matched_legacy) {
            $community['feedback'][] = ['voterId' => $voter, 'voteType' => 'down', 'reason' => $reason];
        }
    }
    $community['feedback'] = array_values($community['feedback']);
    return $community;
}

function mw_validate_report_admin_data($input) {
    if (!is_array($input)) {
        return new WP_Error('mw_report_metadata', 'Metadata del reporte invalida.');
    }
    $values = [];
    foreach (mw_report_admin_fields() + ['extra' => ['label' => 'Otros datos', 'type' => 'object']] as $key => $field) {
        if (!isset($input[$key]) || !is_string($input[$key])) {
            return new WP_Error('mw_report_metadata', 'Falta el campo: ' . $field['label']);
        }
        $raw = trim($input[$key]);
        if (in_array($field['type'], ['text', 'textarea'], true)) {
            $values[$key] = $field['type'] === 'textarea' ? sanitize_textarea_field($raw) : sanitize_text_field($raw);
            continue;
        }
        $decoded = json_decode($raw);
        if (json_last_error() !== JSON_ERROR_NONE
            || ($field['type'] === 'list' && !is_array($decoded))
            || ($field['type'] === 'object' && !is_object($decoded))
            || ($field['type'] === 'json' && !is_array($decoded) && !is_object($decoded))) {
            return new WP_Error('mw_report_metadata', 'JSON invalido o estructura incorrecta en: ' . $field['label']);
        }
        $values[$key] = json_decode($raw, true);
    }
    if ($values['nickname'] === '' || $values['reason'] === '') {
        return new WP_Error('mw_report_metadata', 'Nickname y motivo son obligatorios.');
    }
    if ($values['rid'] !== '' && (!preg_match('/^[0-9]+$/D', $values['rid'])
        || mw_int_or_null($values['rid']) === null
        || strval(mw_int_or_null($values['rid'])) !== ltrim($values['rid'], '0'))) {
        return new WP_Error('mw_report_metadata', 'El RID debe ser un entero positivo o quedar vacio.');
    }
    foreach ($values['typesOfInfraction'] as $type) {
        if (!is_string($type) || trim($type) === '') {
            return new WP_Error('mw_report_metadata', 'Las infracciones deben ser una lista de textos no vacios.');
        }
    }
    foreach ($values['labels'] as $label) {
        if (!is_array($label) || !is_string($label['label'] ?? null) || trim($label['label']) === ''
            || (isset($label['id']) && (!is_int($label['id']) || $label['id'] <= 0))
            || (isset($label['detail']) && !is_string($label['detail']))) {
            return new WP_Error('mw_report_metadata', 'Cada etiqueta debe tener label (texto), id (entero positivo o null) y detail (texto opcional).');
        }
    }
    foreach ($values['evidence'] as $item) {
        if (!is_array($item) || !is_string($item['url'] ?? null) || !wp_http_validate_url($item['url'])) {
            return new WP_Error('mw_report_metadata', 'Cada evidencia debe tener una URL HTTP/HTTPS valida.');
        }
    }
    if (array_diff(array_keys($values['extra']), mw_report_admin_extra_keys())) {
        return new WP_Error('mw_report_metadata', 'Otros datos contiene campos no admitidos. No se pueden editar datos privados desde este panel.');
    }
    foreach ($values['extra'] as $key => $value) {
        if (in_array($key, ['aliases', 'crews'], true)) {
            $valid = is_string($value) || is_array($value);
            if (is_array($value)) {
                foreach ($value as $entry) {
                    if (($key === 'aliases' && !is_string($entry))
                        || ($key === 'crews' && (!is_array($entry) || !is_string($entry['name'] ?? null) || (isset($entry['url']) && !is_string($entry['url']))))) {
                        $valid = false;
                        break;
                    }
                }
            }
        } elseif ($key === 'anonymous') {
            $valid = is_bool($value);
        } elseif ($key === 'time') {
            $valid = $value === null || is_string($value) || is_int($value) || is_float($value);
        } else {
            $valid = is_string($value);
        }
        if (!$valid) {
            return new WP_Error('mw_report_metadata', 'Tipo de dato incorrecto en: ' . $key);
        }
    }
    return $values;
}

function mw_save_report_metadata($post_id) {
    if ((defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
        return;
    }
    if (!isset($_POST['mw_report_metadata_nonce'])) {
        return;
    }
    if (!is_string($_POST['mw_report_metadata_nonce'])
        || !wp_verify_nonce(wp_unslash($_POST['mw_report_metadata_nonce']), 'mw_save_report_metadata_' . $post_id)
        || !current_user_can('edit_post', $post_id)) {
        wp_die('No tienes permiso para editar la metadata de este reporte.', 'MostWanted', ['response' => 403, 'back_link' => true]);
    }
    $input = wp_unslash($_POST['mw_report_metadata'] ?? []);
    $community = null;
    $community_previous = null;
    $form_version = $_POST['mw_report_form_version'] ?? '';
    if (in_array($form_version, ['2', '3', '4'], true)) {
        if (($_POST['mw_report_form_complete'] ?? '') !== '1' || !is_array($input)) {
            wp_die('El formulario esta incompleto. Revisa el limite max_input_vars del servidor y recarga el reporte.', 'MostWanted', ['response' => 400, 'back_link' => true]);
        }
        if ($form_version === '4') {
            if (($_POST['mw_report_moderation_complete'] ?? '') !== '1') {
                wp_die('Falta la seccion de moderacion. Recarga el formulario antes de guardar.', 'MostWanted', ['response' => 400, 'back_link' => true]);
            }
            $input = mw_prepare_web_report_form($post_id, $input, wp_unslash($_POST['mw_report_form'] ?? []));
            if (is_wp_error($input)) {
                wp_die(esc_html($input->get_error_message()), 'MostWanted', ['response' => 400, 'back_link' => true]);
            }
        } elseif ($form_version === '3') {
            $input = mw_prepare_report_form($post_id, $input, wp_unslash($_POST['mw_report_form'] ?? []));
            if (is_wp_error($input)) {
                wp_die(esc_html($input->get_error_message()), 'MostWanted', ['response' => 400, 'back_link' => true]);
            }
        } else {
            $tree = wp_unslash($_POST['mw_report_tree'] ?? []);
            foreach (['typesOfInfraction', 'labels', 'evidence', 'analysis', 'extra'] as $key) {
                $decoded = mw_decode_report_value(is_array($tree) ? ($tree[$key] ?? null) : null);
                if (is_wp_error($decoded)) {
                    wp_die(esc_html($decoded->get_error_message()), 'MostWanted', ['response' => 400, 'back_link' => true]);
                }
                $input[$key] = wp_json_encode($decoded);
            }
        }
        $community_previous = get_post_meta($post_id, '_mw_community_verification', true);
        $community = mw_prepare_report_votes($post_id, wp_unslash($_POST['mw_report_votes'] ?? []), wp_unslash($_POST['mw_votes_snapshot'] ?? ''));
        if (is_wp_error($community)) {
            wp_die(esc_html($community->get_error_message()), 'MostWanted', ['response' => 400, 'back_link' => true]);
        }
    }
    $values = mw_validate_report_admin_data($input);
    if (is_wp_error($values)) {
        wp_die(esc_html($values->get_error_message()) . ' No se guardo la metadata; vuelve atras para corregirla.', 'MostWanted', ['response' => 400, 'back_link' => true]);
    }
    $payload = get_post_meta($post_id, '_mw_report_payload', true);
    $payload = is_array($payload) ? $payload : [];
    $old_rid = mw_resolve_player_rid($payload, get_post_meta($post_id, '_mw_rid', true));
    $rid = mw_int_or_null($values['rid']);
    if ($rid !== $old_rid) {
        $payload['playerId'] = $rid !== null ? 'RID-' . $rid : $values['nickname'] . '::no-rid';
    }
    foreach (mw_report_admin_extra_keys() as $key) {
        unset($payload[$key]);
    }
    $payload = array_merge($payload, $values['extra']);
    foreach (mw_report_admin_fields() as $key => $field) {
        $payload[$key] = $key === 'rid' ? $rid : $values[$key];
    }
    $payload['labelIds'] = array_values(array_filter(array_column($values['labels'], 'id'), 'is_int'));
    foreach (['categories' => 'typesOfInfraction', 'tagIds' => 'labelIds'] as $legacy => $canonical) {
        if (array_key_exists($legacy, $payload)) {
            $payload[$legacy] = $payload[$canonical];
        }
    }
    if (is_array($payload['report'] ?? null)) {
        $payload['report'] = array_merge($payload['report'], [
            'categories' => $payload['typesOfInfraction'],
            'tags' => array_column($payload['labels'], 'label'),
            'tagIds' => $payload['labelIds'],
            'investigation_status' => $payload['investigation_status'],
            'analysis' => $payload['analysis'],
        ]);
    }
    $profile_sync = in_array($form_version, ['3', '4'], true) ? mw_prepare_report_profile_sync($post_id, $payload) : ['player_id' => 0, 'updates' => []];
    if (is_wp_error($profile_sync)) {
        wp_die(esc_html($profile_sync->get_error_message()), 'MostWanted', ['response' => 400, 'back_link' => true]);
    }
    $updates = ['_mw_report_payload' => $payload];
    if ($community !== null && $community !== $community_previous) {
        $updates['_mw_community_verification'] = $community;
    }
    foreach (mw_report_admin_fields() as $key => $field) {
        $updates[$field['meta']] = $key === 'rid' ? ($rid !== null ? strval($rid) : '') : $values[$key];
    }
    foreach ($updates as $meta_key => $value) {
        $saved = $meta_key === '_mw_community_verification'
            ? update_post_meta($post_id, $meta_key, wp_slash($value), $community_previous)
            : update_post_meta($post_id, $meta_key, wp_slash($value));
        if ($saved === false && get_post_meta($post_id, $meta_key, true) !== $value) {
            wp_die('No se pudo guardar toda la metadata del reporte. Revisa los datos antes de reintentar.', 'MostWanted', ['response' => 500, 'back_link' => true]);
        }
    }
    mw_apply_report_profile_sync($profile_sync);
}
add_action('save_post_mw_report', 'mw_save_report_metadata');
