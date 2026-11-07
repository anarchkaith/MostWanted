<?php

require_once __DIR__ . DIRECTORY_SEPARATOR . 'share-metadata.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'share-cache.php';

function mw_sitemap_entries(callable $fetch, $maxPages = 200) {
    $players = [];
    $reports = [];
    for ($page = 1; $page <= $maxPages; $page++) {
        $data = $fetch('/reports?' . http_build_query(['page' => $page, 'per_page' => 100], '', '&', PHP_QUERY_RFC3986));
        if (($data['ok'] ?? null) !== true || !is_array($data['items'] ?? null)) {
            throw new RuntimeException('Invalid report list for sitemap.', 502);
        }
        foreach ($data['items'] as $item) {
            if (!is_array($item)) continue;
            $date = mw_share_date($item['createdAt'] ?? '');
            $id = (string) ($item['id'] ?? '');
            if (ctype_digit($id) && ltrim($id, '0') !== '') $reports[ltrim($id, '0')] = $date;
            $nickname = mw_share_text($item['nickname'] ?? $item['username'] ?? '');
            if ($nickname === '' || preg_match('~[/\\\\\x00-\x1f]~', $nickname)) continue;
            $key = function_exists('mb_strtolower') ? mb_strtolower($nickname, 'UTF-8') : strtolower($nickname);
            if (!isset($players[$key]) || strcmp($date, $players[$key]['date']) > 0) {
                $players[$key] = ['name' => $players[$key]['name'] ?? $nickname, 'date' => $date];
            }
        }
        if (count($data['items']) < 100) break;
    }
    $entries = [['loc' => MW_SHARE_ORIGIN . '/', 'lastmod' => max(array_merge([''], array_values($reports))), 'priority' => '1.0']];
    foreach ($players as $player) {
        $entries[] = ['loc' => MW_SHARE_ORIGIN . '/jugador/' . rawurlencode($player['name']), 'lastmod' => $player['date'], 'priority' => '0.8'];
    }
    krsort($reports, SORT_NUMERIC);
    foreach ($reports as $id => $date) {
        $entries[] = ['loc' => MW_SHARE_ORIGIN . '/reporte/' . $id, 'lastmod' => $date, 'priority' => '0.6'];
    }
    return $entries;
}

function mw_sitemap_xml($entries) {
    $escape = static fn($value) => htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($entries as $entry) {
        $xml .= '  <url><loc>' . $escape($entry['loc']) . '</loc>'
            . ($entry['lastmod'] !== '' ? '<lastmod>' . $escape($entry['lastmod']) . '</lastmod>' : '')
            . '<priority>' . $entry['priority'] . '</priority></url>' . "\n";
    }
    return $xml . '</urlset>' . "\n";
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    try {
        $xml = mw_share_cached('sitemap:' . filemtime(__FILE__), static fn() => mw_sitemap_xml(mw_sitemap_entries('mw_share_cached_fetch')));
        header('Content-Type: application/xml; charset=UTF-8');
        header('Cache-Control: public, max-age=1800');
        echo $xml;
    } catch (RuntimeException $error) {
        error_log('[sitemap] ' . $error->getMessage());
        http_response_code(503);
        header('Retry-After: 600');
        header('Cache-Control: no-store');
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Sitemap no disponible temporalmente.';
    }
}
