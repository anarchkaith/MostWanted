<?php
if (!defined('ABSPATH')) {
    exit;
}

function mw_report_profile_snapshot($post_id, $override_id = 0, $override = []) {
    $payload = $post_id === $override_id ? $override : get_post_meta($post_id, '_mw_report_payload', true);
    $payload = is_array($payload) ? $payload : [];
    foreach (mw_report_admin_fields() as $key => $field) {
        if (!array_key_exists($key, $payload)) {
            $payload[$key] = get_post_meta($post_id, $field['meta'], true);
        }
    }
    $payload['_created_at'] = mw_str(get_post_meta($post_id, '_mw_created_at', true));
    return $payload;
}

function mw_report_profile_updates($reports) {
    $names = [];
    $crews = [];
    $avatars = [];
    $current_avatars = ['avatar1' => '', 'avatar2' => ''];
    $latest = [];
    $last_created = '';
    foreach ($reports as $report) {
        $created = mw_str($report['_created_at'] ?? '');
        $observed = mw_int_or_null($report['time'] ?? null);
        if ($observed === null) {
            $observed = $created !== '' ? intval(strtotime(get_gmt_from_date($created) . ' UTC')) : 0;
        }
        if (!$latest || strcmp($created, $last_created) > 0) {
            $latest = $report;
            $last_created = $created;
        }
        foreach (mw_unique_strings(array_merge([mw_str($report['nickname'] ?? '')], mw_aliases_from_mixed($report['aliases'] ?? []))) as $name) {
            $key = mb_strtolower($name);
            if (!isset($names[$key]) || $observed > $names[$key]['time']) {
                $names[$key] = ['alias' => $name, 'time' => $observed];
            }
        }
        foreach (mw_normalize_crews_from_payload($report) as $crew) {
            $key = mb_strtolower($crew['name']);
            $previous = $crews[$key] ?? null;
            if ($previous === null) {
                $crews[$key] = $crew + ['firstSeen' => $observed, 'lastSeen' => $observed];
            } else {
                // Newest reports are visited first; their corrected URL has priority.
                if ($crews[$key]['url'] === '' && $crew['url'] !== '') $crews[$key]['url'] = $crew['url'];
                $crews[$key]['firstSeen'] = min($previous['firstSeen'], $observed);
                $crews[$key]['lastSeen'] = max($previous['lastSeen'], $observed);
            }
        }
        foreach ($current_avatars as $field => $unused) {
            $url = mw_str($report[$field] ?? '');
            if ($url === '') continue;
            if ($current_avatars[$field] === '') $current_avatars[$field] = $url;
            if (!isset($avatars[$url])) {
                $avatars[$url] = ['url' => $url, 'firstSeen' => $observed, 'lastSeen' => $observed];
            } else {
                $avatars[$url]['firstSeen'] = min($avatars[$url]['firstSeen'], $observed);
                $avatars[$url]['lastSeen'] = max($avatars[$url]['lastSeen'], $observed);
            }
        }
    }
    $names = array_values($names);
    usort($names, static function ($a, $b) { return $b['time'] <=> $a['time']; });
    $nickname = mw_str($latest['nickname'] ?? '');
    return [
        '_mw_nickname' => $nickname,
        '_mw_nickname_normalized' => mb_strtolower($nickname),
        '_mw_aliases' => array_column($names, 'alias'),
        '_mw_aliases_history' => $names,
        '_mw_crews_data' => array_values($crews),
        '_mw_crew_current' => mw_str($latest['crewCurrent'] ?? ''),
        '_mw_avatar_history' => array_values($avatars),
        '_mw_avatar_1' => $current_avatars['avatar1'],
        '_mw_avatar_2' => $current_avatars['avatar2'],
        '_mw_investigation_status' => mw_str($latest['investigation_status'] ?? ''),
        '_mw_total_reports' => count($reports),
        '_mw_last_seen_at' => $last_created,
    ];
}

function mw_prepare_report_profile_sync($post_id, $payload) {
    $player_id = intval(get_post_meta($post_id, '_mw_player_post_id', true));
    if ($player_id <= 0) {
        return new WP_Error('mw_report_metadata', 'El reporte no tiene una ficha de jugador asociada. Revisa su vinculacion antes de sincronizar.');
    }
    if (!current_user_can('edit_post', $player_id)) {
        return new WP_Error('mw_report_metadata', 'Necesitas permiso para editar el jugador asociado y sincronizar su ficha.');
    }
    $player = get_post($player_id);
    if (!$player || $player->post_type !== 'mw_player') {
        return new WP_Error('mw_report_metadata', 'El jugador asociado no existe. No se puede sincronizar una ficha invalida.');
    }
    $stored_rid = mw_resolve_player_rid(['rid' => get_post_meta($player_id, '_mw_rid', true)]);
    $rid = mw_resolve_player_rid($payload);
    if ($rid !== $stored_rid) {
        return new WP_Error('mw_report_metadata', 'El RID no coincide con la ficha asociada. Este editor corrige datos del mismo jugador; no mueve reportes entre cuentas. No se guardaron los cambios.');
    }
    $previous = [];
    foreach (array_keys(mw_report_profile_updates([])) as $key) {
        $previous[$key] = get_post_meta($player_id, $key, true);
    }
    $statuses = ['publish', 'private', 'draft', 'pending', 'future'];
    $ids = array_unique(array_merge(
        array_map('intval', get_children([
            'post_parent' => $player_id, 'post_type' => 'mw_report', 'post_status' => $statuses,
            'numberposts' => -1, 'fields' => 'ids',
        ])),
        array_map('intval', get_posts([
            'post_type' => 'mw_report', 'post_status' => $statuses, 'numberposts' => -1,
            'meta_key' => '_mw_player_post_id', 'meta_value' => $player_id, 'fields' => 'ids',
        ])),
        [$post_id]
    ));
    $reports = [];
    foreach ($ids as $id) {
        $linked = intval(get_post_meta($id, '_mw_player_post_id', true));
        if ($linked > 0 && $linked !== $player_id) continue;
        $snapshot = mw_report_profile_snapshot($id, $post_id, $payload);
        $report_rid = mw_resolve_player_rid($snapshot);
        if ($report_rid !== null && $report_rid !== $stored_rid) {
            return new WP_Error('mw_report_metadata', 'La ficha contiene reportes con RIDs diferentes. Corrige la asociacion antes de sincronizar.');
        }
        $reports[$id] = $snapshot;
    }
    uksort($reports, static function ($a, $b) use ($reports) {
        return strcmp($reports[$b]['_created_at'], $reports[$a]['_created_at']) ?: ($b <=> $a);
    });
    return ['player_id' => $player_id, 'previous' => $previous, 'updates' => mw_report_profile_updates(array_values($reports))];
}

function mw_report_profile_meta_matches($stored, $value) {
    if (is_array($stored) || is_array($value)) return $stored === $value;
    return strval($stored) === strval($value);
}

function mw_apply_report_profile_sync($sync) {
    if (!$sync['player_id']) return;
    $id = $sync['player_id'];
    foreach ($sync['previous'] as $key => $value) {
        if (!mw_report_profile_meta_matches(get_post_meta($id, $key, true), $value)) {
            wp_die('El reporte se guardo, pero la ficha cambio durante la sincronizacion. Vuelve a guardar para incluir los datos nuevos sin sobrescribirlos.', 'MostWanted', ['response' => 409, 'back_link' => true]);
        }
    }
    foreach ($sync['updates'] as $key => $value) {
        if (mw_report_profile_meta_matches(get_post_meta($id, $key, true), $value)) continue;
        if (update_post_meta($id, $key, wp_slash($value), $sync['previous'][$key]) === false && !mw_report_profile_meta_matches(get_post_meta($id, $key, true), $value)) {
            wp_die('El reporte se guardo, pero no se pudo actualizar toda la ficha del jugador. Reintenta guardar para completar la sincronizacion.', 'MostWanted', ['response' => 500, 'back_link' => true]);
        }
    }
    $title = mw_build_player_display_title($sync['updates']['_mw_nickname'], mw_int_or_null(get_post_meta($id, '_mw_rid', true)));
    $result = wp_update_post(['ID' => $id, 'post_title' => $title], true);
    if (is_wp_error($result) || !$result) {
        wp_die('El reporte se guardo, pero no se pudo actualizar el titulo de la ficha. Reintenta guardar.', 'MostWanted', ['response' => 500, 'back_link' => true]);
    }
}
