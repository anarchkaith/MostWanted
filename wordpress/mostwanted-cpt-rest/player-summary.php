<?php
if (!defined('ABSPATH')) exit;

function mw_player_summary_source($player_id) {
    $nickname = mw_str(get_post_meta($player_id, '_mw_nickname', true));
    $rid = mw_str(get_post_meta($player_id, '_mw_rid', true));
    $filters = [['key' => '_mw_nickname', 'value' => $nickname]];
    if ($rid !== '') $filters[] = ['key' => '_mw_rid', 'value' => $rid];
    $ids = get_posts([
        'post_type' => 'mw_report', 'post_status' => 'publish', 'numberposts' => -1,
        'fields' => 'ids', 'meta_query' => array_merge(['relation' => 'OR'], $filters),
    ]);
    $reports = [];
    foreach ($ids as $id) {
        $report = mw_map_report_item(intval($id));
        $report_rid = mw_str($report['rid'] ?? '');
        if ($rid !== '' ? ($report_rid !== '' && $report_rid !== $rid) : $report_rid !== '') continue;
        $reports[] = $report;
    }
    usort($reports, static fn($a, $b) => intval($a['id']) <=> intval($b['id']));
    $inputs = array_map(static function ($report) {
        return [
            'id' => $report['id'], 'nickname' => $report['nickname'], 'rid' => $report['rid'],
            'reason' => $report['reason'] ?? $report['content'] ?? '',
            'categories' => $report['typesOfInfraction'] ?? $report['categories'] ?? [],
            'severity' => $report['severity'] ?? $report['severidad'] ?? $report['analysis']['severity'] ?? $report['analysis']['severidad'] ?? null,
            'validation' => $report['validation'] ?? $report['validacion'] ?? null,
            'createdAt' => $report['createdAt'] ?? null,
            'time' => empty($report['createdAt']) ? ($report['time'] ?? null) : null,
            'evidenceCount' => count($report['evidence'] ?? []),
        ];
    }, $reports);
    return ['reports' => $reports, 'revision' => hash('sha256', json_encode($inputs))];
}

function mw_player_public_summary($player_id) {
    $summary = get_post_meta($player_id, '_mw_ai_summary', true);
    if (!is_array($summary) || !is_string($summary['text'] ?? null) || trim($summary['text']) === '') return null;
    $source = mw_player_summary_source($player_id);
    return [
        'text' => $summary['text'], 'updatedAt' => $summary['updatedAt'],
        'reportCount' => $summary['reportCount'],
        'stale' => $summary['sourceRevision'] !== $source['revision'],
    ];
}

function mw_rest_player_summary($request) {
    $rid = mw_str($request->get_param('rid'));
    $nickname = mw_str($request->get_param('nickname'));
    if ($rid === '' && $nickname === '') {
        return new WP_REST_Response(['ok' => false, 'error' => 'invalid_player_identity'], 400);
    }
    $player_id = mw_find_player_post($nickname, mw_int_or_null($rid), '');
    if ($player_id <= 0) return new WP_REST_Response(['ok' => false, 'error' => 'player_not_found'], 404);
    $source = mw_player_summary_source($player_id);
    if ($request->get_method() === 'GET') {
        $response = new WP_REST_Response(['ok' => true] + $source, 200);
        $response->header('Cache-Control', 'private, no-store');
        return $response;
    }
    $text = $request->get_param('text');
    $revision = $request->get_param('sourceRevision');
    if (!is_string($text) || trim($text) === '' || strlen($text) > 40000 || !is_string($revision)) {
        return new WP_REST_Response(['ok' => false, 'error' => 'invalid_ai_summary'], 400);
    }
    if (!$source['reports'] || !hash_equals($source['revision'], $revision)) {
        return new WP_REST_Response(['ok' => false, 'error' => 'ai_summary_source_changed'], 409);
    }
    $summary = [
        'text' => wp_strip_all_tags(trim($text)), 'sourceRevision' => $revision,
        'updatedAt' => gmdate('c'), 'reportCount' => count($source['reports']),
    ];
    if (trim($summary['text']) === '') return new WP_REST_Response(['ok' => false, 'error' => 'invalid_ai_summary'], 400);
    $stored = update_post_meta($player_id, '_mw_ai_summary', wp_slash($summary));
    if ($stored === false && get_post_meta($player_id, '_mw_ai_summary', true) !== $summary) {
        return new WP_REST_Response(['ok' => false, 'error' => 'ai_summary_storage_failed'], 500);
    }
    return new WP_REST_Response(['ok' => true], 200);
}
