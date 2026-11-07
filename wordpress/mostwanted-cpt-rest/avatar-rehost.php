<?php
// Los avatares de Social Club se descargan en el servidor y se guardan en uploads.
// El navegador nunca consulta prod.cloud.rockstargames.com.

const MW_AVATAR_MAX_BYTES = 2097152;
const MW_AVATAR_MIGRATION_ACTION = 'mw_migrate_avatars';

function mw_parse_rockstar_avatar_url($url) {
    $url = mw_str($url);
    if (!preg_match('#^https://prod\.cloud\.rockstargames\.com/members/sc/6266/(\d+)/publish/gta5/mpchars/([01])\.png(?:\?.*)?$#', $url, $matches)) {
        return null;
    }
    return ['rid' => $matches[1], 'index' => intval($matches[2])];
}

function mw_fetch_rockstar_avatar($rid, $index) {
    if (!preg_match('/^\d+$/', (string) $rid) || !in_array($index, [0, 1], true)) {
        return '';
    }

    $source = sprintf('https://prod.cloud.rockstargames.com/members/sc/6266/%s/publish/gta5/mpchars/%d.png', $rid, $index);
    $response = wp_remote_get($source, ['timeout' => 12, 'redirection' => 0]);
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
        return '';
    }

    $content_type = strtolower((string) wp_remote_retrieve_header($response, 'content-type'));
    $body = wp_remote_retrieve_body($response);
    if (strpos($content_type, 'image/png') !== 0 || $body === '' || strlen($body) > MW_AVATAR_MAX_BYTES) {
        return '';
    }

    $upload = wp_upload_bits(sprintf('mw-avatar-%s-%d-%s.png', $rid, $index, wp_generate_password(8, false, false)), null, $body);
    if (!empty($upload['error']) || empty($upload['url'])) {
        return '';
    }
    return esc_url_raw($upload['url']);
}

// Con RID se usa el avatar actual de Social Club. Sin RID, las URLs de Social Club se descartan.
function mw_localize_avatar($current, $rid, $index) {
    $current = mw_str($current);
    $legacy = mw_parse_rockstar_avatar_url($current);
    if ($legacy !== null) {
        $rid = $legacy['rid'];
        $index = $legacy['index'];
    }

    if (preg_match('/^\d+$/', (string) $rid)) {
        $local = mw_fetch_rockstar_avatar($rid, $index);
        if ($local !== '' || $legacy !== null) {
            return $local;
        }
    }

    return $legacy !== null ? '' : $current;
}

function mw_localize_report_avatars($payload, $rid) {
    foreach ([0 => 'avatar1', 1 => 'avatar2'] as $index => $field) {
        $payload[$field] = mw_localize_avatar($payload[$field] ?? '', $rid, $index);
    }
    return $payload;
}

// Migra avatares ya guardados como URLs de Social Club. Usa cache por RID para no descargar dos veces.
function mw_migrate_rockstar_avatars() {
    @set_time_limit(300);
    $stats = ['reports' => 0, 'players' => 0, 'downloaded' => 0, 'failed' => 0];
    $cache = [];

    $localize_url = function ($url) use (&$cache, &$stats) {
        $parsed = mw_parse_rockstar_avatar_url($url);
        if ($parsed === null) {
            return $url;
        }
        $key = $parsed['rid'] . '-' . $parsed['index'];
        if (!array_key_exists($key, $cache)) {
            $cache[$key] = mw_fetch_rockstar_avatar($parsed['rid'], $parsed['index']);
            if ($cache[$key] !== '') {
                $stats['downloaded']++;
            } else {
                $stats['failed']++;
            }
        }
        return $cache[$key];
    };

    $report_ids = get_posts([
        'post_type' => 'mw_report', 'post_status' => 'any', 'posts_per_page' => -1, 'fields' => 'ids',
    ]);
    foreach ($report_ids as $report_id) {
        $payload = get_post_meta($report_id, '_mw_report_payload', true);
        if (!is_array($payload)) continue;
        $changed = false;
        foreach (['avatar1', 'avatar2'] as $field) {
            $url = mw_str($payload[$field] ?? '');
            if (mw_parse_rockstar_avatar_url($url) === null) continue;
            $payload[$field] = $localize_url($url);
            $changed = true;
        }
        if ($changed) {
            update_post_meta($report_id, '_mw_report_payload', wp_slash($payload));
            $stats['reports']++;
        }
    }

    $player_ids = get_posts([
        'post_type' => 'mw_player', 'post_status' => 'any', 'posts_per_page' => -1, 'fields' => 'ids',
    ]);
    foreach ($player_ids as $player_id) {
        $changed = false;
        foreach (['_mw_avatar_1', '_mw_avatar_2'] as $meta_key) {
            $url = mw_str(get_post_meta($player_id, $meta_key, true));
            if (mw_parse_rockstar_avatar_url($url) === null) continue;
            update_post_meta($player_id, $meta_key, $localize_url($url));
            $changed = true;
        }

        $history = mw_safe_meta_array($player_id, '_mw_avatar_history');
        $history_changed = false;
        foreach ($history as $index => $entry) {
            if (!is_array($entry)) continue;
            $url = mw_str($entry['url'] ?? '');
            if (mw_parse_rockstar_avatar_url($url) === null) continue;
            $history[$index]['url'] = $localize_url($url);
            $history_changed = true;
        }
        if ($history_changed) {
            update_post_meta($player_id, '_mw_avatar_history', $history);
            $changed = true;
        }
        if ($changed) $stats['players']++;
    }

    return $stats;
}

function mw_render_avatar_migration_panel() {
    $url = admin_url('admin-post.php');
    ?>
    <h2>Migrar avatares a la biblioteca</h2>
    <p>Descarga los avatares de Social Club guardados en reportes y jugadores y los guarda en tu biblioteca de medios. Úsalo una vez.</p>
    <form method="post" action="<?php echo esc_url($url); ?>">
        <input type="hidden" name="action" value="<?php echo esc_attr(MW_AVATAR_MIGRATION_ACTION); ?>">
        <?php wp_nonce_field(MW_AVATAR_MIGRATION_ACTION); ?>
        <?php submit_button('Migrar avatares', 'secondary', 'submit', false); ?>
    </form>
    <?php
}

function mw_handle_avatar_migration() {
    if (!current_user_can('manage_options')) {
        wp_die('No autorizado', 403);
    }
    check_admin_referer(MW_AVATAR_MIGRATION_ACTION);

    $stats = mw_migrate_rockstar_avatars();
    $redirect = add_query_arg([
        'page' => 'mostwanted-cpt-rest',
        'mw_avatars_migrated' => '1',
        'reports' => $stats['reports'],
        'players' => $stats['players'],
        'downloaded' => $stats['downloaded'],
        'failed' => $stats['failed'],
    ], admin_url('options-general.php'));
    wp_safe_redirect($redirect);
    exit;
}
add_action('admin_post_' . MW_AVATAR_MIGRATION_ACTION, 'mw_handle_avatar_migration');

function mw_avatar_migration_notice() {
    if (!current_user_can('manage_options') || !isset($_GET['mw_avatars_migrated'])) {
        return;
    }
    printf(
        '<div class="notice notice-success"><p>Migración de avatares: %d reportes y %d jugadores actualizados. Descargados: %d. Fallidos: %d.</p></div>',
        intval($_GET['reports'] ?? 0),
        intval($_GET['players'] ?? 0),
        intval($_GET['downloaded'] ?? 0),
        intval($_GET['failed'] ?? 0)
    );
}
add_action('admin_notices', 'mw_avatar_migration_notice');
