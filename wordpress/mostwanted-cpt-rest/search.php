<?php
if (!defined('ABSPATH')) exit;

function mw_search_normalize($text) {
    $text = remove_accents(trim((string) $text));
    return function_exists('mb_strtolower') ? mb_strtolower($text, 'UTF-8') : strtolower($text);
}

function mw_search_texts($value) {
    if (is_string($value)) return trim($value) !== '' ? [$value] : [];
    if (!is_array($value)) return [];
    $texts = [];
    foreach ($value as $key => $item) {
        if (is_int($key)) $texts = array_merge($texts, mw_search_texts($item));
        elseif (in_array($key, ['name', 'label', 'detail', 'text'], true) && is_string($item)) $texts[] = $item;
    }
    return $texts;
}

function mw_search_fields($item) {
    $values = [
        'Nombre' => $item['nickname'] ?? '',
        'Alias' => $item['aliases'] ?? [],
        'RID' => $item['rid'] ?? '',
        'Motivo' => $item['reason'] ?? $item['content'] ?? '',
        'Infracción' => $item['categories'] ?? [],
        'Etiqueta' => $item['labels'] ?? [],
        'Crew' => $item['crews'] ?? [],
        'Resumen' => [
            $item['aiSummary']['text'] ?? '',
            $item['analysis']['summary'] ?? '',
            $item['analysis']['recommendation'] ?? '',
        ],
    ];
    $fields = [];
    foreach ($values as $field => $value) {
        foreach (mw_search_texts($value) as $text) $fields[] = ['field' => $field, 'text' => $text];
    }
    return $fields;
}

function mw_search_matches($fields, $terms) {
    foreach ($terms as $term) {
        $found = false;
        foreach ($fields as $field) {
            if (strpos(mw_search_normalize($field['text']), $term) !== false) { $found = true; break; }
        }
        if (!$found) return [];
    }
    return array_values(array_filter($fields, static function ($field) use ($terms) {
        foreach ($terms as $term) if (strpos(mw_search_normalize($field['text']), $term) !== false) return true;
        return false;
    }));
}

function mw_rest_search($request) {
    $query = $request->get_param('q');
    $page = $request->get_param('page') ?? '1';
    $per_page = $request->get_param('per_page') ?? '50';
    if (!is_string($query) || trim($query) === '' || strlen($query) > 400
        || !ctype_digit((string) $page) || intval($page) < 1
        || !ctype_digit((string) $per_page) || intval($per_page) < 1 || intval($per_page) > 100) {
        return new WP_REST_Response(['ok' => false, 'error' => 'Consulta o paginacion de busqueda invalida.'], 400);
    }
    $terms = preg_split('/\s+/u', mw_search_normalize($query), -1, PREG_SPLIT_NO_EMPTY);
    $players = [];
    // Read public records in batches: no report-list limit and no private account search.
    foreach (['mw_report', 'mw_player'] as $type) {
        $offset = 0;
        do {
            $ids = get_posts([
                'post_type' => $type, 'post_status' => 'publish', 'numberposts' => 100,
                'offset' => $offset, 'orderby' => 'ID', 'order' => 'ASC', 'fields' => 'ids',
            ]);
            update_meta_cache('post', $ids);
            foreach ($ids as $id) {
                $id = intval($id);
                if ($type === 'mw_report') {
                    $item = mw_map_report_item($id);
                } else {
                    $item = [
                        'nickname' => mw_str(get_post_meta($id, '_mw_nickname', true)),
                        'rid' => mw_str(get_post_meta($id, '_mw_rid', true)),
                        'aliases' => mw_safe_meta_array($id, '_mw_aliases'),
                        'crews' => mw_safe_meta_array($id, '_mw_crews_data'),
                        'aiSummary' => mw_safe_meta_array($id, '_mw_ai_summary'),
                    ];
                }
                $matches = mw_search_matches(mw_search_fields($item), $terms);
                if (!$matches) continue;
                $nickname = mw_str($item['nickname'] ?? '');
                $rid = mw_str($item['rid'] ?? '');
                if ($nickname === '' && $rid === '') continue;
                $name_key = function_exists('mb_strtolower') ? mb_strtolower($nickname, 'UTF-8') : strtolower($nickname);
                $key = $rid !== '' ? 'rid:' . $rid : 'name:' . $name_key;
                if (!isset($players[$key])) {
                    $players[$key] = ['nickname' => $nickname, 'rid' => $rid, 'names' => [], 'count' => 0, 'searchMatches' => []];
                }
                $players[$key]['names'] = array_values(array_unique(array_merge(
                    $players[$key]['names'], [$nickname], mw_search_texts($item['aliases'] ?? [])
                )));
                if ($type === 'mw_report') {
                    $players[$key]['count']++;
                    foreach ($matches as &$match) $match['reportId'] = $id;
                    unset($match);
                }
                $players[$key]['searchMatches'] = array_merge($players[$key]['searchMatches'], $matches);
            }
            $offset += count($ids);
        } while (count($ids) === 100);
    }
    $items = array_values($players);
    $normalized = mw_search_normalize($query);
    usort($items, static function ($a, $b) use ($normalized) {
        $exact = static fn($item) => mw_search_normalize($item['nickname']) === $normalized || $item['rid'] === $normalized;
        return intval($exact($b)) <=> intval($exact($a))
            ?: $b['count'] <=> $a['count'] ?: strcmp($a['nickname'], $b['nickname']);
    });
    $page = intval($page);
    $per_page = intval($per_page);
    $total = count($items);
    $items = array_slice($items, ($page - 1) * $per_page, $per_page);
    foreach ($items as &$item) {
        $item['searchMatches'] = array_slice($item['searchMatches'], 0, 5);
        foreach ($item['searchMatches'] as &$match) {
            $text = $match['text'];
            $characters = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
            $normalized_characters = preg_split('//u', mw_search_normalize($text), -1, PREG_SPLIT_NO_EMPTY);
            $normalized_text = implode('', $normalized_characters);
            $byte_position = strpos($normalized_text, $terms[0]);
            $position = $byte_position === false ? 0 : count(preg_split('//u', substr($normalized_text, 0, $byte_position), -1, PREG_SPLIT_NO_EMPTY));
            $start = max(0, $position - 40);
            $match['text'] = ($start > 0 ? '…' : '') . implode('', array_slice($characters, $start, 180))
                . (count($characters) > $start + 180 ? '…' : '');
        }
        unset($match);
    }
    unset($item);
    $response = new WP_REST_Response([
        'ok' => true, 'items' => $items, 'page' => $page, 'perPage' => $per_page,
        'total' => $total, 'hasMore' => $page * $per_page < $total,
    ], 200);
    $response->header('Cache-Control', 'no-store');
    return $response;
}
