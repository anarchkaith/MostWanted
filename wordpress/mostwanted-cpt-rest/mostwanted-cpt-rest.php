<?php
/**
 * Plugin Name: MostWanted CPT + REST
 * Description: CPT de jugadores/reportes y API REST para ingesta y consulta desde MostWanted.
 * Version: 0.6.0
 * Author: KaithHacks
 */

if (!defined('ABSPATH')) {
    exit;
}

const MW_NAMESPACE = 'mostwanted/v1';
const MW_SECRET_OPTION_KEY = 'mostwanted_api_secret';

function mw_register_post_types() {
    register_post_type('mw_player', [
        'label' => 'MostWanted Players',
        'public' => false,
        'show_ui' => true,
        'show_in_rest' => true,
        'supports' => ['title', 'custom-fields'],
        'menu_icon' => 'dashicons-groups',
    ]);

    register_post_type('mw_report', [
        'label' => 'MostWanted Reports',
        'public' => true,
        'publicly_queryable' => true,
        'exclude_from_search' => true,
        'has_archive' => 'reportes',
        'rewrite' => ['slug' => 'reportes', 'with_front' => false],
        'show_ui' => true,
        'show_in_rest' => true,
        'supports' => ['title', 'editor', 'custom-fields'],
        'menu_icon' => 'dashicons-warning',
    ]);
}
add_action('init', 'mw_register_post_types');

function mw_is_report_front_request() {
    if (is_admin()) {
        return false;
    }

    return is_post_type_archive('mw_report') || is_singular('mw_report');
}

function mw_protect_reports_frontend() {
    if (!mw_is_report_front_request()) {
        return;
    }

    if (is_user_logged_in()) {
        return;
    }

    wp_safe_redirect(wp_login_url($_SERVER['REQUEST_URI'] ?? home_url('/reportes/')));
    exit;
}
add_action('template_redirect', 'mw_protect_reports_frontend');

function mw_report_robots_directives($robots) {
    if (!mw_is_report_front_request()) {
        return $robots;
    }

    $safe = is_array($robots) ? $robots : [];
    $safe['noindex'] = true;
    $safe['noarchive'] = true;
    $safe['nofollow'] = true;

    return $safe;
}
add_filter('wp_robots', 'mw_report_robots_directives');

function mw_activate_plugin() {
    mw_register_post_types();
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'mw_activate_plugin');

function mw_deactivate_plugin() {
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'mw_deactivate_plugin');

function mw_str($value) {
    return is_string($value) ? trim($value) : '';
}

function mw_int_or_null($value) {
    if (is_numeric($value)) {
        $parsed = intval($value);
        return $parsed > 0 ? $parsed : null;
    }
    return null;
}

function mw_as_array($value) {
    return is_array($value) ? $value : [];
}

function mw_unique_strings($values, $limit = 50) {
    $out = [];
    $seen = [];

    foreach (mw_as_array($values) as $value) {
        $text = mw_str(is_scalar($value) ? strval($value) : '');
        if ($text === '') {
            continue;
        }
        $key = mb_strtolower($text);
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $out[] = $text;
        if (count($out) >= $limit) {
            break;
        }
    }

    return $out;
}

function mw_payload_object($payload, $key) {
    $direct = $payload[$key] ?? null;
    if (is_array($direct)) {
        return $direct;
    }

    $report = $payload['report'] ?? null;
    if (is_array($report) && is_array($report[$key] ?? null)) {
        return $report[$key];
    }

    return [];
}

function mw_payload_str($payload, $key) {
    $direct = mw_str($payload[$key] ?? '');
    if ($direct !== '') {
        return $direct;
    }

    $report = $payload['report'] ?? null;
    if (is_array($report)) {
        return mw_str($report[$key] ?? '');
    }

    return '';
}

function mw_payload_int_or_null($payload, $key) {
    if (array_key_exists($key, $payload)) {
        return mw_int_or_null($payload[$key]);
    }

    $report = $payload['report'] ?? null;
    if (is_array($report) && array_key_exists($key, $report)) {
        return mw_int_or_null($report[$key]);
    }

    return null;
}

function mw_payload_array($payload, $key) {
    $direct = $payload[$key] ?? null;
    if (is_array($direct)) {
        return $direct;
    }

    $report = $payload['report'] ?? null;
    if (is_array($report) && is_array($report[$key] ?? null)) {
        return $report[$key];
    }

    return [];
}

function mw_aliases_from_mixed($value) {
    if (is_array($value)) {
        return mw_unique_strings($value);
    }

    $raw = mw_str($value);
    if ($raw === '') {
        return [];
    }

    $parts = preg_split('/[;,|]/', $raw) ?: [];
    return mw_unique_strings($parts);
}

function mw_payload_aliases($payload, $key = 'aliases') {
    if (array_key_exists($key, $payload)) {
        return mw_aliases_from_mixed($payload[$key]);
    }

    $report = $payload['report'] ?? null;
    if (is_array($report) && array_key_exists($key, $report)) {
        return mw_aliases_from_mixed($report[$key]);
    }

    return [];
}

function mw_resolve_nickname_from_payload($payload) {
    $nickname = mw_payload_str($payload, 'nickname');
    $username = mw_payload_str($payload, 'username');
    $aliases = mw_payload_aliases($payload, 'aliases');

    if ($username !== '' && !empty($aliases)) {
        foreach ($aliases as $alias) {
            if (mb_strtolower($alias) === mb_strtolower($username)) {
                return $username;
            }
        }
    }

    if ($nickname !== '') {
        return $nickname;
    }

    if ($username !== '') {
        return $username;
    }

    if (!empty($aliases)) {
        return $aliases[0];
    }

    return '';
}

function mw_get_request_ip($request) {
    $candidates = [
        mw_str($request->get_header('cf-connecting-ip')),
        mw_str($request->get_header('x-real-ip')),
        mw_str($request->get_header('x-forwarded-for')),
        mw_str($_SERVER['REMOTE_ADDR'] ?? ''),
    ];

    foreach ($candidates as $candidate) {
        if ($candidate === '') {
            continue;
        }

        // x-forwarded-for puede traer una lista: usamos la primera IP.
        $first = mw_str(explode(',', $candidate)[0] ?? '');
        if ($first !== '') {
            return $first;
        }
    }

    return '';
}

function mw_label_catalog() {
    // Base de detalle extensible para futuras etiquetas.
    return [
        1 => ['label' => 'Abuso de bugs', 'detail' => 'Uso intencional de fallos del juego para ventaja indebida.'],
        9 => ['label' => 'Spawnkill', 'detail' => 'Ataque reiterado en zonas de aparicion para impedir juego normal.'],
        10 => ['label' => 'Trolleo masivo (interrupción de partidas)', 'detail' => 'Acciones coordinadas para romper partidas de terceros.'],
        11 => ['label' => 'Sabotaje de partidas', 'detail' => 'Interferencia directa en misiones o actividades del servidor.'],
        12 => ['label' => 'Raideo de servidor / invasión coordinada', 'detail' => 'Ingreso coordinado para hostigar o desestabilizar el servidor.'],
    ];
}

function mw_build_labels_table($labels, $label_ids) {
    $safe_labels = mw_as_array($labels);
    $safe_ids = mw_as_array($label_ids);
    $catalog = mw_label_catalog();

    $table = [];
    $seen = [];

    // Si ya viene como tabla [{id,label,detail}], la normalizamos y devolvemos.
    $already_table = !empty($safe_labels) && is_array($safe_labels[0] ?? null) && array_key_exists('label', $safe_labels[0]);
    if ($already_table) {
        foreach ($safe_labels as $item) {
            if (!is_array($item)) {
                continue;
            }
            $id = mw_int_or_null($item['id'] ?? null);
            $label = mw_str($item['label'] ?? '');
            $detail = mw_str($item['detail'] ?? '');
            if ($id === null && $label === '') {
                continue;
            }

            if ($detail === '' && $id !== null && isset($catalog[$id])) {
                $detail = mw_str($catalog[$id]['detail'] ?? '');
            }

            $key = ($id !== null ? 'id:' . strval($id) : 'label:' . mb_strtolower($label));
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            $table[] = [
                'id' => $id,
                'label' => $label,
                'detail' => $detail,
            ];
        }

        return $table;
    }

    // Alinear por posicion cuando existan labels e ids separados.
    $max = max(count($safe_labels), count($safe_ids));
    for ($i = 0; $i < $max; $i += 1) {
        $id = mw_int_or_null($safe_ids[$i] ?? null);
        $label = mw_str($safe_labels[$i] ?? '');

        if ($id !== null && $label === '' && isset($catalog[$id])) {
            $label = mw_str($catalog[$id]['label'] ?? '');
        }

        if ($id === null && $label === '') {
            continue;
        }

        $detail = '';
        if ($id !== null && isset($catalog[$id])) {
            $detail = mw_str($catalog[$id]['detail'] ?? '');
            if ($label === '') {
                $label = mw_str($catalog[$id]['label'] ?? '');
            }
        }

        $key = ($id !== null ? 'id:' . strval($id) : 'label:' . mb_strtolower($label));
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;

        $table[] = [
            'id' => $id,
            'label' => $label,
            'detail' => $detail,
        ];
    }

    return $table;
}

function mw_normalize_reporter($payload, $reportedby = '') {
    $reporter = mw_payload_object($payload, 'reporter');
    $name = mw_str($reporter['name'] ?? '');
    if ($name === '') {
        $name = mw_str($reportedby);
    }

    if ($name === '') {
        $name = 'Anónimo';
    }

    return [
        'name' => $name,
        'ip' => mw_str($payload['ip'] ?? ''),
    ];
}

function mw_normalize_text_for_title($value) {
    $text = mw_str($value);
    if ($text === '') {
        return '';
    }

    $decoded = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(wp_strip_all_tags($decoded));
}

function mw_build_player_display_title($nickname, $rid) {
    $safe_nickname = mw_normalize_text_for_title($nickname);
    $safe_rid = mw_int_or_null($rid);

    if ($safe_nickname === '') {
        $safe_nickname = 'UNKNOWN';
    }

    if ($safe_rid !== null) {
        return sprintf('%s [RID %s]', $safe_nickname, strval($safe_rid));
    }

    return $safe_nickname;
}

function mw_build_report_content($payload, $created_at) {
    $nickname = mw_resolve_nickname_from_payload($payload);
    $rid = mw_payload_int_or_null($payload, 'rid');
    $reason = mw_payload_str($payload, 'reason');
    $reportedby = mw_payload_str($payload, 'reportedby');
    $investigation_status = mw_payload_str($payload, 'investigation_status');
    $types = mw_payload_array($payload, 'typesOfInfraction');
    $labels = mw_payload_array($payload, 'labels');
    $label_ids = mw_payload_array($payload, 'labelIds');
    $evidence = mw_payload_array($payload, 'evidence');
    $source = mw_payload_str($payload, 'source');

    $evidence_lines = [];
    foreach ($evidence as $item) {
        if (!is_array($item)) {
            continue;
        }
        $url = mw_str($item['url'] ?? '');
        if ($url === '') {
            continue;
        }
        $name = mw_str($item['name'] ?? 'evidence');
        $content_type = mw_str($item['contentType'] ?? '');
        $evidence_lines[] = trim(sprintf('- %s %s %s', $name, $content_type !== '' ? "($content_type)" : '', $url));
    }

    $lines = [
        'Jugador: ' . mw_build_player_display_title($nickname, $rid),
        'Fecha: ' . $created_at,
        'Motivo: ' . ($reason !== '' ? $reason : 'N/A'),
        'Reportado por: ' . ($reportedby !== '' ? $reportedby : 'N/A'),
        'Estado investigacion: ' . ($investigation_status !== '' ? $investigation_status : 'N/A'),
        'Categorias: ' . (!empty($types) ? implode(', ', array_map('strval', $types)) : 'N/A'),
        'Etiquetas: ' . (!empty($labels) ? implode(', ', array_map('strval', $labels)) : 'N/A'),
        'Label IDs: ' . (!empty($label_ids) ? implode(', ', array_map('strval', $label_ids)) : 'N/A'),
        'Origen: ' . ($source !== '' ? $source : 'N/A'),
        'Evidencias:',
    ];

    if (!empty($evidence_lines)) {
        $lines = array_merge($lines, $evidence_lines);
    } else {
        $lines[] = '- N/A';
    }

    return implode("\n", $lines);
}

function mw_deep_merge_arrays($base, $overrides) {
    if (!is_array($base) || !is_array($overrides)) {
        return $base;
    }

    $merged = $base;

    foreach ($overrides as $key => $value) {
        if (is_array($value) && isset($merged[$key]) && is_array($merged[$key]) && array_keys($value) !== range(0, count($value) - 1)) {
            $merged[$key] = mw_deep_merge_arrays($merged[$key], $value);
            continue;
        }

        $merged[$key] = $value;
    }

    return $merged;
}

function mw_default_player_seed_payload($nickname = '1R0N_STR1K3R') {
    $safe_nickname = mw_str($nickname);
    if ($safe_nickname === '') {
        $safe_nickname = '1R0N_STR1K3R';
    }

    $rid = 13371337;

    return [
        'nickname' => $safe_nickname,
        'playerId' => 'RID-' . strval($rid),
        'rid' => $rid,
        'reason' => 'Carga completa de jugador de prueba para validacion de historial MostWanted.',
        'reportedby' => 'MostWanted Seed Runner',
        'investigation_status' => 'resolved',
        'typesOfInfraction' => ['Toxicidad', 'Abuso de chat', 'Conducta hostil'],
        'labels' => ['Hostil', 'Reincidente', 'Alto riesgo'],
        'labelIds' => [1, 5, 11],
        'crewCurrent' => '[IRON] Iron Legion https://socialclub.rockstargames.com/crew/iron_legion',
        'crew1' => '[VOID] Void Syndicate https://socialclub.rockstargames.com/crew/void_syndicate',
        'crew2' => '[NOVA] Nova Prime https://socialclub.rockstargames.com/crew/nova_prime',
        'crew3' => 'Ghost Wolves',
        'crew4' => 'Black Dawn',
        'crews' => 'IRON | VOID | NOVA | Ghost Wolves | Black Dawn',
        'crewsData' => [
            [
                'raw' => '[IRON] Iron Legion https://socialclub.rockstargames.com/crew/iron_legion',
                'name' => 'Iron Legion',
                'tag' => 'IRON',
                'url' => 'https://socialclub.rockstargames.com/crew/iron_legion',
                'isActive' => true,
            ],
            [
                'raw' => '[VOID] Void Syndicate https://socialclub.rockstargames.com/crew/void_syndicate',
                'name' => 'Void Syndicate',
                'tag' => 'VOID',
                'url' => 'https://socialclub.rockstargames.com/crew/void_syndicate',
                'slot' => 1,
                'isActive' => false,
            ],
        ],
        'avatar1' => 'https://i.ibb.co/2kYFQ4V/player-avatar-1.png',
        'avatar2' => 'https://i.ibb.co/wBr2R3F/player-avatar-2.png',
        'ip' => '192.0.2.55',
        'aliases' => 'IRON, 1RON, STR1KER',
        'time' => time(),
        'source' => 'mostwanted-seed',
        'reporter' => [
            'id' => 'mw-seed',
            'name' => 'MostWanted Seed Bot',
            'tag' => 'seed@mostwanted.local',
            'email' => 'seed@mostwanted.local',
        ],
        'evidence' => [
            [
                'url' => 'https://i.ibb.co/8Xw8Z7m/evidence-1.png',
                'name' => 'chat-log-1.png',
                'contentType' => 'image/png',
            ],
            [
                'url' => 'https://i.ibb.co/N2xjQ2M/evidence-2.jpg',
                'name' => 'scene-capture-2.jpg',
                'contentType' => 'image/jpeg',
            ],
        ],
        'analysis' => [
            'summary' => 'Jugador con historial reiterado de comportamiento hostil y riesgo alto para convivencia en servidor.',
            'recommendation' => 'Seguimiento estricto y medidas disciplinarias progresivas.',
            'threatLevel' => 'high',
            'confidence' => 0.92,
            'corruptionPercent' => 74,
            'corruptionReason' => 'Patron de reincidencia y escalamiento en interacciones conflictivas.',
        ],
        'report' => [
            'investigation_status' => 'resolved',
            'analysis' => [
                'summary' => 'Analisis interno completo del historial y evidencias del jugador.',
                'recommendation' => 'Mantener en observacion activa y registrar nuevos incidentes.',
                'threatLevel' => 'high',
                'confidence' => 0.92,
            ],
        ],
    ];
}

function mw_safe_meta_array($post_id, $key) {
    $value = get_post_meta($post_id, $key, true);
    return is_array($value) ? $value : [];
}

function mw_extract_token($request) {
    $auth = mw_str($request->get_header('authorization'));
    if ($auth !== '' && stripos($auth, 'Bearer ') === 0) {
        return trim(substr($auth, 7));
    }

    $fallback = mw_str($request->get_header('x-mostwanted-secret'));
    if ($fallback !== '') {
        return $fallback;
    }

    return '';
}

function mw_get_expected_secret() {
    $from_constant = defined('MOSTWANTED_API_SECRET') ? mw_str(constant('MOSTWANTED_API_SECRET')) : '';
    if ($from_constant !== '') {
        return $from_constant;
    }

    return mw_str(get_option(MW_SECRET_OPTION_KEY, ''));
}

function mw_can_ingest_reports($request) {
    $expected = mw_get_expected_secret();
    if ($expected === '') {
        return new WP_Error('mw_secret_missing', 'No hay secreto configurado. Define MOSTWANTED_API_SECRET o usa Ajustes > MostWanted CPT + REST.', ['status' => 500]);
    }

    $provided = mw_extract_token($request);
    if ($provided === '' || !hash_equals($expected, $provided)) {
        return new WP_Error('mw_unauthorized', 'Token invalido para ingesta de reportes.', ['status' => 401]);
    }

    return true;
}

function mw_find_player_post($nickname, $rid, $player_id) {
    $nickname_normalized = mb_strtolower(mw_str($nickname));

    if ($rid !== null) {
        $posts = get_posts([
            'post_type' => 'mw_player',
            'post_status' => 'any',
            'numberposts' => 1,
            'meta_key' => '_mw_rid',
            'meta_value' => strval($rid),
            'fields' => 'ids',
        ]);
        if (!empty($posts)) {
            return intval($posts[0]);
        }
    }

    if ($player_id !== '') {
        $posts = get_posts([
            'post_type' => 'mw_player',
            'post_status' => 'any',
            'numberposts' => 1,
            'meta_key' => '_mw_player_id',
            'meta_value' => $player_id,
            'fields' => 'ids',
        ]);
        if (!empty($posts)) {
            return intval($posts[0]);
        }
    }

    if ($nickname_normalized !== '') {
        $posts = get_posts([
            'post_type' => 'mw_player',
            'post_status' => 'any',
            'numberposts' => 1,
            'meta_key' => '_mw_nickname_normalized',
            'meta_value' => $nickname_normalized,
            'fields' => 'ids',
        ]);
        if (!empty($posts)) {
            return intval($posts[0]);
        }
    }

    return 0;
}

function mw_normalize_crews_from_payload($payload) {
    $crews_data = mw_as_array($payload['crewsData'] ?? []);
    if (!empty($crews_data)) {
        $normalized = [];
        foreach ($crews_data as $item) {
            if (!is_array($item)) {
                continue;
            }
            $entry = [
                'raw' => mw_str($item['raw'] ?? ''),
                'name' => mw_str($item['name'] ?? ''),
                'tag' => mw_str($item['tag'] ?? ''),
                'url' => mw_str($item['url'] ?? ''),
                'slot' => isset($item['slot']) ? intval($item['slot']) : null,
                'isActive' => !empty($item['isActive']),
            ];
            if ($entry['raw'] === '' && $entry['name'] === '') {
                continue;
            }
            $normalized[] = $entry;
        }
        if (!empty($normalized)) {
            return $normalized;
        }
    }

    $crews = [];
    $current = mw_str($payload['crewCurrent'] ?? '');
    if ($current !== '') {
        $crews[] = [
            'raw' => $current,
            'name' => $current,
            'tag' => '',
            'url' => '',
            'slot' => null,
            'isActive' => true,
        ];
    }

    for ($i = 1; $i <= 4; $i += 1) {
        $slot = mw_str($payload['crew' . $i] ?? '');
        if ($slot === '') {
            continue;
        }
        $crews[] = [
            'raw' => $slot,
            'name' => $slot,
            'tag' => '',
            'url' => '',
            'slot' => $i,
            'isActive' => false,
        ];
    }

    return $crews;
}

function mw_merge_player_profile($player_post_id, $payload) {
    $nickname = mw_resolve_nickname_from_payload($payload);
    $rid = mw_payload_int_or_null($payload, 'rid');
    $player_id = mw_payload_str($payload, 'playerId');
    $aliases_incoming = mw_payload_aliases($payload, 'aliases');
    $crew_current = mw_payload_str($payload, 'crewCurrent');
    $investigation_status = mw_payload_str($payload, 'investigation_status');

    if ($nickname !== '') {
        array_unshift($aliases_incoming, $nickname);
    }

    $aliases_existing = mw_safe_meta_array($player_post_id, '_mw_aliases');
    $aliases_merged = mw_unique_strings(array_merge($aliases_existing, $aliases_incoming));

    $alias_time = mw_payload_int_or_null($payload, 'time');
    if ($alias_time === null) {
        $alias_time = time();
    }

    $aliases_history_existing = mw_safe_meta_array($player_post_id, '_mw_aliases_history');
    $aliases_history_map = [];

    foreach ($aliases_history_existing as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $alias_name = mw_str($entry['alias'] ?? '');
        if ($alias_name === '') {
            continue;
        }
        $key = mb_strtolower($alias_name);
        $aliases_history_map[$key] = [
            'alias' => $alias_name,
            'time' => mw_int_or_null($entry['time'] ?? null) ?? $alias_time,
        ];
    }

    foreach ($aliases_merged as $alias_name) {
        $key = mb_strtolower($alias_name);
        $existing_time = mw_int_or_null($aliases_history_map[$key]['time'] ?? null);
        $aliases_history_map[$key] = [
            'alias' => $alias_name,
            'time' => $existing_time !== null ? max($existing_time, $alias_time) : $alias_time,
        ];
    }

    $aliases_history = array_values($aliases_history_map);
    usort($aliases_history, function ($a, $b) {
        return intval($b['time'] ?? 0) - intval($a['time'] ?? 0);
    });

    $crews_existing = mw_safe_meta_array($player_post_id, '_mw_crews_data');
    $crews_incoming = mw_normalize_crews_from_payload($payload);
    $crews_merged = [];
    $seen = [];

    foreach (array_merge($crews_existing, $crews_incoming) as $crew) {
        if (!is_array($crew)) {
            continue;
        }
        $raw = mw_str($crew['raw'] ?? '');
        $name = mw_str($crew['name'] ?? '');
        $key = mb_strtolower($raw !== '' ? $raw : $name);
        if ($key === '' || isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $crews_merged[] = [
            'raw' => $raw,
            'name' => $name,
            'tag' => mw_str($crew['tag'] ?? ''),
            'url' => mw_str($crew['url'] ?? ''),
            'slot' => isset($crew['slot']) ? intval($crew['slot']) : null,
            'isActive' => !empty($crew['isActive']),
        ];
    }

    $total_reports = intval(get_post_meta($player_post_id, '_mw_total_reports', true));
    $total_reports += 1;

    wp_update_post([
        'ID' => $player_post_id,
        'post_title' => mw_build_player_display_title($nickname, $rid),
    ]);

    update_post_meta($player_post_id, '_mw_player_id', $player_id);
    update_post_meta($player_post_id, '_mw_nickname', $nickname);
    update_post_meta($player_post_id, '_mw_nickname_normalized', mb_strtolower($nickname));
    update_post_meta($player_post_id, '_mw_rid', $rid !== null ? strval($rid) : '');
    update_post_meta($player_post_id, '_mw_aliases', $aliases_merged);
    update_post_meta($player_post_id, '_mw_aliases_history', $aliases_history);
    update_post_meta($player_post_id, '_mw_crew_current', $crew_current);
    update_post_meta($player_post_id, '_mw_crews_data', $crews_merged);
    update_post_meta($player_post_id, '_mw_avatar_1', mw_payload_str($payload, 'avatar1'));
    update_post_meta($player_post_id, '_mw_avatar_2', mw_payload_str($payload, 'avatar2'));
    update_post_meta($player_post_id, '_mw_investigation_status', $investigation_status);
    update_post_meta($player_post_id, '_mw_last_seen_at', current_time('mysql'));
    update_post_meta($player_post_id, '_mw_total_reports', $total_reports);
}

function mw_store_report($player_post_id, $payload) {
    $reason = mw_payload_str($payload, 'reason');
    $nickname = mw_resolve_nickname_from_payload($payload);
    $rid = mw_payload_int_or_null($payload, 'rid');
    $created_at = current_time('mysql');
    $title = mw_build_player_display_title($nickname, $rid);
    $investigation_status = mw_payload_str($payload, 'investigation_status');
    $reportedby = mw_payload_str($payload, 'reportedby');
    $types = mw_payload_array($payload, 'categories');
    if (empty($types)) {
        $types = mw_payload_array($payload, 'typesOfInfraction');
    }
    $labels = mw_payload_array($payload, 'labels');
    $label_ids = mw_payload_array($payload, 'labelIds');
    $labels_table = mw_build_labels_table($labels, $label_ids);
    $reporter = mw_normalize_reporter($payload, $reportedby);
    $evidence = mw_payload_array($payload, 'evidence');
    $analysis = mw_payload_object($payload, 'analysis');

    $report_post_id = wp_insert_post([
        'post_type' => 'mw_report',
        'post_status' => 'publish',
        'post_parent' => $player_post_id,
        'post_title' => $title,
        // El detalle del reporte se persiste completamente en post meta.
        'post_content' => '',
    ], true);

    if (is_wp_error($report_post_id)) {
        return $report_post_id;
    }

    update_post_meta($report_post_id, '_mw_player_post_id', $player_post_id);
    update_post_meta($report_post_id, '_mw_nickname', $nickname);
    update_post_meta($report_post_id, '_mw_rid', $rid !== null ? strval($rid) : '');
    update_post_meta($report_post_id, '_mw_reason', $reason);
    update_post_meta($report_post_id, '_mw_investigation_status', $investigation_status);
    update_post_meta($report_post_id, '_mw_types', mw_as_array($types));
    update_post_meta($report_post_id, '_mw_labels', mw_as_array($labels_table));
    update_post_meta($report_post_id, '_mw_reporter', $reporter);
    update_post_meta($report_post_id, '_mw_evidence', $evidence);
    update_post_meta($report_post_id, '_mw_analysis', $analysis);
    update_post_meta($report_post_id, '_mw_report_payload', $payload);
    update_post_meta($report_post_id, '_mw_created_at', $created_at);
    update_post_meta($report_post_id, '_mw_community_verification', [
        'up' => 0,
        'down' => 0,
        'feedback' => [],
        'votesByVoter' => [],
    ]);

    return intval($report_post_id);
}

function mw_get_community_verification($report_post_id) {
    $stored = get_post_meta($report_post_id, '_mw_community_verification', true);
    $safe = is_array($stored) ? $stored : [];

    $up = intval($safe['up'] ?? 0);
    $down = intval($safe['down'] ?? 0);
    $feedback = is_array($safe['feedback'] ?? null) ? array_values($safe['feedback']) : [];
    $votes_by_voter = is_array($safe['votesByVoter'] ?? null) ? $safe['votesByVoter'] : [];

    return [
        'up' => max(0, $up),
        'down' => max(0, $down),
        'feedback' => $feedback,
        'votesByVoter' => $votes_by_voter,
    ];
}

function mw_community_verification_public($community_data, $voter_id = '') {
    $safe = is_array($community_data) ? $community_data : [];
    $feedback = is_array($safe['feedback'] ?? null) ? array_values($safe['feedback']) : [];

    $confirmations = [];
    foreach ($feedback as $item) {
        if (!is_array($item)) {
            continue;
        }

        $reason = mw_str($item['reason'] ?? '');
        if ($reason === '') {
            continue;
        }

        $confirmations[] = [
            'reporterName' => mw_str($item['author'] ?? ''),
            'reason' => $reason,
            'voterIp' => mw_str($item['ip'] ?? ''),
        ];
    }

    $up = max(0, intval($safe['up'] ?? 0));
    $down = max(0, intval($safe['down'] ?? 0));
    $score = $up - $down;

    return [
        'up' => $up,
        'down' => $down,
        'score' => $score,
        'confirmations' => $confirmations,
    ];
}

function mw_map_report_item($report_post_id) {
    $payload = get_post_meta($report_post_id, '_mw_report_payload', true);
    $safe_payload = is_array($payload) ? $payload : [];

    $nickname = mw_str(get_post_meta($report_post_id, '_mw_nickname', true));
    $rid = mw_str(get_post_meta($report_post_id, '_mw_rid', true));
    $reason = mw_str(get_post_meta($report_post_id, '_mw_reason', true));
    $types = mw_safe_meta_array($report_post_id, '_mw_types');
    $labels = mw_safe_meta_array($report_post_id, '_mw_labels');
    $label_ids = mw_safe_meta_array($report_post_id, '_mw_label_ids');
    $labels_table = mw_build_labels_table($labels, $label_ids);
    $reporter = mw_safe_meta_array($report_post_id, '_mw_reporter');
    $evidence = mw_safe_meta_array($report_post_id, '_mw_evidence');
    $analysis = mw_safe_meta_array($report_post_id, '_mw_analysis');
    $created_at = mw_str(get_post_meta($report_post_id, '_mw_created_at', true));
    $community_verification = mw_get_community_verification($report_post_id);
    $player_post_id = intval(get_post_meta($report_post_id, '_mw_player_post_id', true));

    $crews_data = $safe_payload['crewsData'] ?? null;
    if (!is_array($crews_data)) {
        $crews_data = mw_safe_meta_array($player_post_id, '_mw_crews_data');
    }

    $raw_report = is_array($safe_payload['report'] ?? null) ? $safe_payload['report'] : [];
    unset($safe_payload['report']);
    unset($safe_payload['playerId']);
    unset($safe_payload['source']);
    unset($safe_payload['tags']);
    unset($safe_payload['tagIds']);
    unset($safe_payload['labelIds']);
    unset($safe_payload['reportedby']);
    unset($safe_payload['reason']);
    unset($safe_payload['username']);
    unset($safe_payload['ip']);
    unset($safe_payload['crewCurrent']);
    unset($safe_payload['crewCurrentData']);
    unset($safe_payload['crews']);
    unset($safe_payload['types']);
    unset($safe_payload['typesOfInfraction']);
    unset($safe_payload['crew1']);
    unset($safe_payload['crew2']);
    unset($safe_payload['crew3']);
    unset($safe_payload['crew4']);

    unset($raw_report['tags']);
    unset($raw_report['tagIds']);
    unset($raw_report['labelIds']);
    unset($raw_report['reportedby']);
    unset($raw_report['reason']);
    unset($raw_report['username']);
    unset($raw_report['ip']);
    unset($raw_report['playerId']);
    unset($raw_report['source']);
    unset($raw_report['crewCurrent']);
    unset($raw_report['crewCurrentData']);
    unset($raw_report['crews']);
    unset($raw_report['types']);
    unset($raw_report['typesOfInfraction']);

    $aliases_raw = null;
    if (array_key_exists('aliases', $safe_payload)) {
        $aliases_raw = $safe_payload['aliases'];
    } elseif (array_key_exists('aliases', $raw_report)) {
        $aliases_raw = $raw_report['aliases'];
    }
    $aliases = mw_aliases_from_mixed($aliases_raw);

    $reporter_name = mw_str($reporter['name'] ?? '');
    if (mb_strtolower($reporter_name) === 'formulario web') {
        $reporter['name'] = 'Anónimo';
    }

    $flattened_payload = array_merge($safe_payload, $raw_report, [
        'nickname' => $nickname,
        'aliases' => $aliases,
        'rid' => $rid,
        'content' => $reason,
        'categories' => $types,
        'labels' => $labels_table,
        'reporter' => $reporter,
        'crewsData' => $crews_data,
        'evidence' => $evidence,
        'analysis' => $analysis,
        'createdAt' => $created_at,
    ]);

    $base_report = [
        'id' => $report_post_id,
        'title' => get_the_title($report_post_id),
        'nickname' => $nickname,
        'aliases' => $aliases,
        'rid' => $rid,
        'content' => $reason,
        'categories' => $types,
        'labels' => $labels_table,
        'reporter' => $reporter,
        'crewsData' => $crews_data,
        'evidence' => $evidence,
        'analysis' => $analysis,
        'createdAt' => $created_at,
        'communityVerification' => mw_community_verification_public($community_verification),
    ];

    // El payload queda unificado directamente en el objeto report, sin anidarlo.
    return array_merge($base_report, $flattened_payload);
}

function mw_rest_report_community_verification($request) {
    $requested_id = intval($request->get_param('id'));
    if ($requested_id <= 0) {
        return new WP_REST_Response(['ok' => false, 'error' => 'ID de reporte invalido.'], 400);
    }

    $report_post_id = $requested_id;
    $post = get_post($report_post_id);
    if (!$post || $post->post_type !== 'mw_report' || $post->post_status !== 'publish') {
        $posts = get_posts([
            'post_type' => 'mw_report',
            'post_status' => 'publish',
            'numberposts' => 1,
            'offset' => $requested_id - 1,
            'orderby' => 'date',
            'order' => 'DESC',
            'fields' => 'ids',
        ]);
        if (!empty($posts)) {
            $report_post_id = intval($posts[0]);
            $post = get_post($report_post_id);
        }
    }

    if (!$post || $post->post_type !== 'mw_report' || $post->post_status !== 'publish') {
        return new WP_REST_Response(['ok' => false, 'error' => 'Reporte no encontrado.'], 404);
    }

    $payload = $request->get_json_params();
    if (!is_array($payload)) {
        $payload = [];
    }

    $vote_type = mw_str($payload['voteType'] ?? '');
    if (!in_array($vote_type, ['up', 'down'], true)) {
        return new WP_REST_Response(['ok' => false, 'error' => 'voteType debe ser up o down.'], 400);
    }

    $reason = mw_str($payload['reason'] ?? '');
    if ($vote_type === 'down' && $reason === '') {
        return new WP_REST_Response(['ok' => false, 'error' => 'Debes indicar el motivo cuando marcas un reporte como falso.'], 400);
    }

    $ip = mw_get_request_ip($request);
    $voter_id = $ip !== '' ? md5($ip) : md5(mw_str($_SERVER['HTTP_USER_AGENT'] ?? ''));

    $author = mw_str($payload['voterName'] ?? 'Comunidad');
    if ($author === '') {
        $author = 'Comunidad';
    }

    $community = mw_get_community_verification($report_post_id);
    $votes_by_voter = is_array($community['votesByVoter'] ?? null) ? $community['votesByVoter'] : [];

    $previous_vote = $votes_by_voter[$voter_id] ?? null;
    if (is_array($previous_vote)) {
        $previous_type = mw_str($previous_vote['voteType'] ?? '');
        if ($previous_type === 'up') {
            $community['up'] = max(0, intval($community['up']) - 1);
        } elseif ($previous_type === 'down') {
            $community['down'] = max(0, intval($community['down']) - 1);
        }
    }

    if ($vote_type === 'up') {
        $community['up'] = intval($community['up']) + 1;
    } else {
        $community['down'] = intval($community['down']) + 1;
    }

    $votes_by_voter[$voter_id] = [
        'voteType' => $vote_type,
        'reason' => $reason,
        'author' => $author,
        'ip' => $ip,
        'updatedAt' => current_time('mysql'),
    ];
    $community['votesByVoter'] = $votes_by_voter;

    $feedback = is_array($community['feedback'] ?? null) ? $community['feedback'] : [];
    $feedback_next = [];

    foreach ($feedback as $item) {
        if (!is_array($item)) {
            continue;
        }
        $item_voter_id = mw_str($item['voterId'] ?? '');
        if ($item_voter_id !== '' && $item_voter_id === $voter_id) {
            continue;
        }
        $feedback_next[] = $item;
    }

    if ($vote_type === 'down' && $reason !== '') {
        $feedback_next[] = [
            'voteType' => 'down',
            'reason' => $reason,
            'author' => $author,
            'ip' => $ip,
            'voterId' => $voter_id,
            'createdAt' => current_time('mysql'),
        ];
    }

    if (count($feedback_next) > 200) {
        $feedback_next = array_slice($feedback_next, -200);
    }

    $community['feedback'] = array_values($feedback_next);

    update_post_meta($report_post_id, '_mw_community_verification', $community);

    return new WP_REST_Response([
        'ok' => true,
        'reportId' => $report_post_id,
        'communityVerification' => mw_community_verification_public($community, $voter_id),
    ], 200);
}

function mw_map_player_item($player_post_id, $with_reports = true, $reports_limit = 20) {
    $aliases_history = mw_safe_meta_array($player_post_id, '_mw_aliases_history');
    $aliases_output = [];

    if (!empty($aliases_history)) {
        foreach ($aliases_history as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $alias_name = mw_str($entry['alias'] ?? '');
            if ($alias_name === '') {
                continue;
            }
            $aliases_output[] = [
                'alias' => $alias_name,
                'time' => mw_int_or_null($entry['time'] ?? null),
            ];
        }
    }

    if (empty($aliases_output)) {
        foreach (mw_safe_meta_array($player_post_id, '_mw_aliases') as $alias_name) {
            $alias = mw_str($alias_name);
            if ($alias === '') {
                continue;
            }
            $aliases_output[] = [
                'alias' => $alias,
                'time' => null,
            ];
        }
    }

    $item = [
        'id' => $player_post_id,
        'title' => get_the_title($player_post_id),
        'rid' => mw_str(get_post_meta($player_post_id, '_mw_rid', true)),
        'nickname' => mw_str(get_post_meta($player_post_id, '_mw_nickname', true)),
        'aliases' => $aliases_output,
        'crewsData' => mw_safe_meta_array($player_post_id, '_mw_crews_data'),
        'avatar1' => mw_str(get_post_meta($player_post_id, '_mw_avatar_1', true)),
        'avatar2' => mw_str(get_post_meta($player_post_id, '_mw_avatar_2', true)),
        'investigationStatus' => mw_str(get_post_meta($player_post_id, '_mw_investigation_status', true)),
        'totalReports' => intval(get_post_meta($player_post_id, '_mw_total_reports', true)),
        'lastSeenAt' => mw_str(get_post_meta($player_post_id, '_mw_last_seen_at', true)),
    ];

    if (!$with_reports) {
        return $item;
    }

    $report_posts = get_children([
        'post_parent' => $player_post_id,
        'post_type' => 'mw_report',
        'post_status' => 'publish',
        'numberposts' => $reports_limit,
        'orderby' => 'date',
        'order' => 'DESC',
        'fields' => 'ids',
    ]);

    $reports = [];
    foreach ($report_posts as $idx => $report_post_id) {
        $mapped = mw_map_report_item(intval($report_post_id));
        $mapped['id'] = $idx + 1;
        $reports[] = $mapped;
    }

    $item['reports'] = $reports;

    return $item;
}

function mw_rest_health() {
    $secret_configured = mw_get_expected_secret() !== '';

    return new WP_REST_Response([
        'ok' => true,
        'service' => 'mostwanted-cpt-rest',
        'secretConfigured' => $secret_configured,
        'time' => current_time('mysql'),
    ], 200);
}

function mw_sanitize_secret_option($value) {
    return mw_str($value);
}

function mw_register_admin_settings() {
    register_setting(
        'mw_settings_group',
        MW_SECRET_OPTION_KEY,
        [
            'type' => 'string',
            'sanitize_callback' => 'mw_sanitize_secret_option',
            'default' => '',
        ]
    );
}
add_action('admin_init', 'mw_register_admin_settings');

function mw_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $option_secret = mw_str(get_option(MW_SECRET_OPTION_KEY, ''));
    $using_constant = defined('MOSTWANTED_API_SECRET') && mw_str(constant('MOSTWANTED_API_SECRET')) !== '';
    ?>
    <div class="wrap">
        <h1>MostWanted CPT + REST</h1>
        <p>Configura el secreto API para habilitar la ruta <code>/wp-json/mostwanted/v1/reports</code>.</p>
        <?php if ($using_constant) : ?>
            <div class="notice notice-info"><p>El plugin esta usando el secreto definido en <code>wp-config.php</code> (MOSTWANTED_API_SECRET).</p></div>
        <?php endif; ?>
        <form method="post" action="options.php">
            <?php settings_fields('mw_settings_group'); ?>
            <table class="form-table" role="presentation">
                <tbody>
                    <tr>
                        <th scope="row"><label for="mw_secret">API Secret</label></th>
                        <td>
                            <input
                                type="text"
                                id="mw_secret"
                                name="<?php echo esc_attr(MW_SECRET_OPTION_KEY); ?>"
                                value="<?php echo esc_attr($option_secret); ?>"
                                class="regular-text"
                                autocomplete="off"
                            />
                            <p class="description">Si existe MOSTWANTED_API_SECRET en wp-config.php, ese valor tiene prioridad.</p>
                        </td>
                    </tr>
                </tbody>
            </table>
            <?php submit_button('Guardar Secret'); ?>
        </form>
    </div>
    <?php
}

function mw_register_admin_menu() {
    add_options_page(
        'MostWanted CPT + REST',
        'MostWanted CPT + REST',
        'manage_options',
        'mostwanted-cpt-rest',
        'mw_render_settings_page'
    );
}
add_action('admin_menu', 'mw_register_admin_menu');

function mw_admin_secret_notice() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $secret = mw_get_expected_secret();
    if ($secret !== '') {
        return;
    }

    $settings_url = admin_url('options-general.php?page=mostwanted-cpt-rest');
    echo '<div class="notice notice-warning"><p><strong>MostWanted CPT + REST:</strong> No hay API secret configurado. Define MOSTWANTED_API_SECRET en wp-config.php o configurarlo en <a href="' . esc_url($settings_url) . '">Ajustes</a>.</p></div>';
}
add_action('admin_notices', 'mw_admin_secret_notice');

function mw_ingest_payload_array($payload) {
    if (!is_array($payload)) {
        return new WP_REST_Response(['ok' => false, 'error' => 'Payload JSON invalido.'], 400);
    }

    $nickname = mw_resolve_nickname_from_payload($payload);
    $reason = mw_payload_str($payload, 'reason');
    $rid = mw_payload_int_or_null($payload, 'rid');
    $player_id = mw_payload_str($payload, 'playerId');

    if ($nickname === '' || $reason === '') {
        return new WP_REST_Response(['ok' => false, 'error' => 'nickname y reason son obligatorios.'], 400);
    }

    $player_post_id = mw_find_player_post($nickname, $rid, $player_id);
    if ($player_post_id <= 0) {
        $player_post_id = wp_insert_post([
            'post_type' => 'mw_player',
            'post_status' => 'publish',
            'post_title' => mw_build_player_display_title($nickname, $rid),
        ], true);

        if (is_wp_error($player_post_id)) {
            return new WP_REST_Response([
                'ok' => false,
                'error' => 'No se pudo crear el jugador en WordPress.',
                'details' => $player_post_id->get_error_message(),
            ], 500);
        }

        $player_post_id = intval($player_post_id);
    }

    mw_merge_player_profile($player_post_id, $payload);

    $report_post_id = mw_store_report($player_post_id, $payload);
    if (is_wp_error($report_post_id)) {
        return new WP_REST_Response([
            'ok' => false,
            'error' => 'No se pudo crear el reporte en WordPress.',
            'details' => $report_post_id->get_error_message(),
        ], 500);
    }

    return new WP_REST_Response([
        'ok' => true,
        'playerPostId' => $player_post_id,
        'reportId' => intval($report_post_id),
        'player' => mw_map_player_item($player_post_id, true, 25),
    ], 201);
}

function mw_rest_ingest_report($request) {
    $payload = $request->get_json_params();

    if (!is_array($payload)) {
        $payload = [];
    }

    // IP del reportante, priorizando headers de proxy/CDN.
    $payload['ip'] = mw_get_request_ip($request);

    if (!is_array($payload['reporter'] ?? null)) {
        $payload['reporter'] = [];
    }
    $payload['reporter']['ip'] = mw_str($payload['ip'] ?? '');

    return mw_ingest_payload_array($payload);
}

function mw_rest_seed_default_player($request) {
    $body = $request->get_json_params();
    if (!is_array($body)) {
        $body = [];
    }

    $requested_nickname = mw_str($body['nickname'] ?? '1R0N_STR1K3R');
    $defaults = mw_default_player_seed_payload($requested_nickname);
    $payload = mw_deep_merge_arrays($defaults, $body);

    $ingest_response = mw_ingest_payload_array($payload);
    $status = $ingest_response->get_status();
    $data = $ingest_response->get_data();

    if (!is_array($data)) {
        return $ingest_response;
    }

    if (!empty($data['ok'])) {
        $data['seed'] = [
            'loaded' => true,
            'nickname' => $requested_nickname,
            'message' => 'Jugador de prueba cargado con datos completos.',
        ];
    }

    return new WP_REST_Response($data, $status);
}

function mw_rest_players_list($request) {
    $page = max(1, intval($request->get_param('page') ?: 1));
    $per_page = max(1, min(100, intval($request->get_param('per_page') ?: 25)));
    $offset = ($page - 1) * $per_page;

    $with_reports = !in_array(mw_str($request->get_param('with_reports')), ['0', 'false', 'no'], true);
    $include_empty = in_array(mw_str($request->get_param('include_empty')), ['1', 'true', 'yes'], true);
    $reports_limit = max(1, min(100, intval($request->get_param('reports_limit') ?: 20)));

    $posts = get_posts([
        'post_type' => 'mw_player',
        'post_status' => 'publish',
        'numberposts' => $per_page,
        'offset' => $offset,
        'orderby' => 'modified',
        'order' => 'DESC',
        'fields' => 'ids',
    ]);

    $items = [];
    foreach ($posts as $idx => $post_id) {
        $item = mw_map_player_item(intval($post_id), $with_reports, $reports_limit);

        // Por defecto oculta jugadores huerfanos cuando se solicitan reportes.
        if ($with_reports && !$include_empty && empty($item['reports'])) {
            continue;
        }

        $item['id'] = $offset + $idx + 1;
        $items[] = $item;
    }

    return new WP_REST_Response([
        'ok' => true,
        'page' => $page,
        'perPage' => $per_page,
        'withReports' => $with_reports,
        'includeEmpty' => $include_empty,
        'reportsLimit' => $reports_limit,
        'items' => $items,
    ], 200);
}

function mw_rest_player_lookup($request) {
    $rid = mw_str($request->get_param('rid'));
    $player_id = mw_str($request->get_param('playerId'));
    $nickname = mw_str($request->get_param('nickname'));

    if ($rid === '' && $player_id === '' && $nickname === '') {
        return new WP_REST_Response(['ok' => false, 'error' => 'Debes enviar rid, playerId o nickname.'], 400);
    }

    $with_reports = !in_array(mw_str($request->get_param('with_reports')), ['0', 'false', 'no'], true);
    $reports_limit = max(1, min(100, intval($request->get_param('reports_limit') ?: 50)));

    $player_post_id = mw_find_player_post($nickname, mw_int_or_null($rid), $player_id);
    if ($player_post_id <= 0) {
        return new WP_REST_Response(['ok' => true, 'found' => false, 'player' => null], 200);
    }

    return new WP_REST_Response([
        'ok' => true,
        'found' => true,
        'player' => mw_map_player_item($player_post_id, $with_reports, $reports_limit),
    ], 200);
}

function mw_rest_reports_list($request) {
    $page = max(1, intval($request->get_param('page') ?: 1));
    $per_page = max(1, min(100, intval($request->get_param('per_page') ?: 25)));
    $offset = ($page - 1) * $per_page;

    $rid = mw_str($request->get_param('rid'));
    $nickname = mw_str($request->get_param('nickname'));

    $query_args = [
        'post_type' => 'mw_report',
        'post_status' => 'publish',
        'numberposts' => $per_page,
        'offset' => $offset,
        'orderby' => 'date',
        'order' => 'DESC',
        'fields' => 'ids',
    ];

    if ($rid !== '') {
        $query_args['meta_key'] = '_mw_rid';
        $query_args['meta_value'] = $rid;
    } elseif ($nickname !== '') {
        $query_args['meta_key'] = '_mw_nickname';
        $query_args['meta_value'] = $nickname;
    }

    $posts = get_posts($query_args);

    $items = [];
    foreach ($posts as $idx => $post_id) {
        $item = mw_map_report_item(intval($post_id));
        $item['id'] = $offset + $idx + 1;
        $items[] = $item;
    }

    return new WP_REST_Response([
        'ok' => true,
        'page' => $page,
        'perPage' => $per_page,
        'items' => $items,
    ], 200);
}

function mw_register_rest_routes() {
    register_rest_route(MW_NAMESPACE, '/health', [
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'mw_rest_health',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route(MW_NAMESPACE, '/reports', [
        [
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'mw_rest_reports_list',
            'permission_callback' => '__return_true',
        ],
        [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'mw_rest_ingest_report',
            'permission_callback' => 'mw_can_ingest_reports',
        ],
    ]);

    register_rest_route(MW_NAMESPACE, '/reports/(?P<id>\d+)/community-verification', [
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'mw_rest_report_community_verification',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route(MW_NAMESPACE, '/players', [
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'mw_rest_players_list',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route(MW_NAMESPACE, '/players/lookup', [
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'mw_rest_player_lookup',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route(MW_NAMESPACE, '/players/load-default', [
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'mw_rest_seed_default_player',
        'permission_callback' => 'mw_can_ingest_reports',
    ]);
}
add_action('rest_api_init', 'mw_register_rest_routes');
