<?php
if (!defined('ABSPATH')) exit;

// Ediciones manuales de administración. Se guardan aparte de `_mw_aliases` y
// `_mw_crews_data` porque `mw_report_profile_updates` las recalcula en cada reporte.
const MW_PLAYER_MANUAL_ALIAS_LIMIT = 30;
const MW_PLAYER_ALIAS_MAX_LENGTH = 64;

function mw_player_edit_response($data, $status = 200) {
    $response = new WP_REST_Response($data, $status);
    $response->header('Cache-Control', 'private, no-store');
    return $response;
}

function mw_player_overrides($player_post_id) {
    $overrides = get_post_meta($player_post_id, '_mw_player_overrides', true);
    return is_array($overrides) ? $overrides : [];
}

function mw_player_manual_aliases($player_post_id) {
    $aliases = mw_player_overrides($player_post_id)['aliases'] ?? [];
    if (!is_array($aliases)) return [];
    return array_values(array_filter(array_map('mw_str', $aliases), static function ($alias) {
        return $alias !== '';
    }));
}

function mw_player_active_crew_override($player_post_id) {
    $overrides = mw_player_overrides($player_post_id);
    return array_key_exists('activeCrew', $overrides) ? mw_str($overrides['activeCrew']) : null;
}

function mw_player_crew_names($player_post_id) {
    $names = [];
    foreach (mw_safe_meta_array($player_post_id, '_mw_crews_data') as $crew) {
        if (!is_array($crew)) continue;
        $name = mw_str($crew['name'] ?? '') ?: mw_str($crew['raw'] ?? '');
        if ($name !== '') $names[] = $name;
    }
    return $names;
}

function mw_can_edit_player_actor($actor) {
    if (!is_array($actor) || !is_string($actor['id'] ?? null) || !preg_match('/^\d+$/D', $actor['id'])) return false;
    return ($actor['isAdmin'] ?? false) === true;
}

function mw_prepare_player_edit($player_post_id, $input) {
    if (!is_array($input) || array_diff(array_keys($input), ['aliases', 'activeCrew'])) {
        return new WP_Error('mw_player_edit', 'Campos de edicion invalidos.', ['status' => 400]);
    }
    $overrides = mw_player_overrides($player_post_id);

    if (array_key_exists('aliases', $input)) {
        if (!is_array($input['aliases']) || count($input['aliases']) > MW_PLAYER_MANUAL_ALIAS_LIMIT) {
            return new WP_Error('mw_player_edit', 'Lista de alias invalida.', ['status' => 400]);
        }
        $aliases = [];
        $seen = [];
        foreach ($input['aliases'] as $alias) {
            $alias = is_string($alias) ? mw_str($alias) : '';
            if ($alias === '' || mb_strlen($alias) > MW_PLAYER_ALIAS_MAX_LENGTH) {
                return new WP_Error('mw_player_edit', 'Alias invalido.', ['status' => 400]);
            }
            $key = mb_strtolower($alias);
            if (isset($seen[$key])) continue;
            $seen[$key] = true;
            $aliases[] = $alias;
        }
        $overrides['aliases'] = $aliases;
    }

    if (array_key_exists('activeCrew', $input)) {
        if (!is_string($input['activeCrew'])) {
            return new WP_Error('mw_player_edit', 'Crew activo invalido.', ['status' => 400]);
        }
        $wanted = mb_strtolower(mw_str($input['activeCrew']));
        $active = '';
        if ($wanted !== '') {
            foreach (mw_player_crew_names($player_post_id) as $crew_name) {
                if (mb_strtolower($crew_name) === $wanted) {
                    $active = $crew_name;
                    break;
                }
            }
            if ($active === '') {
                return new WP_Error('mw_player_edit', 'El crew no figura en el historial del jugador.', ['status' => 400]);
            }
        }
        $overrides['activeCrew'] = $active;
    }

    return $overrides;
}

function mw_rest_player_edit($request) {
    $payload = $request->get_json_params();
    $payload = is_array($payload) ? $payload : [];
    if (!mw_can_edit_player_actor($payload['actor'] ?? null)) {
        return mw_player_edit_response(['ok' => false, 'error' => 'Solo la administradora puede editar jugadores.'], 403);
    }

    $identity = is_array($payload['identity'] ?? null) ? $payload['identity'] : [];
    $username = mw_str($identity['username'] ?? '');
    $rid = mw_int_or_null($identity['rid'] ?? '');
    if ($username === '' && $rid === null) {
        return mw_player_edit_response(['ok' => false, 'error' => 'Debes enviar username o rid.'], 400);
    }

    $player_post_id = mw_find_player_post($username, $rid, '');
    if ($player_post_id <= 0) {
        return mw_player_edit_response(['ok' => false, 'error' => 'Jugador no disponible.'], 404);
    }

    $overrides = mw_prepare_player_edit($player_post_id, $payload['changes'] ?? null);
    if (is_wp_error($overrides)) {
        return mw_player_edit_response(['ok' => false, 'error' => $overrides->get_error_message()], 400);
    }
    update_post_meta($player_post_id, '_mw_player_overrides', $overrides);

    return mw_player_edit_response([
        'ok' => true,
        'found' => true,
        'player' => mw_build_player_insights($player_post_id),
    ]);
}

add_action('rest_api_init', static function () {
    register_rest_route(MW_NAMESPACE, '/players/edit', [
        'methods' => 'POST', 'callback' => 'mw_rest_player_edit', 'permission_callback' => 'mw_can_ingest_reports',
    ]);
});
