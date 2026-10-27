<?php

const MW_SHARE_ORIGIN = 'https://mostwanted.kaithsrebels.com';

function mw_share_text($value, $limit = 300) {
    if (!is_string($value) && !is_numeric($value)) return '';
    $text = preg_replace('/\s+/u', ' ', strip_tags(html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8')));
    $characters = preg_split('//u', trim($text ?? ''), -1, PREG_SPLIT_NO_EMPTY);
    if ($characters === false) throw new RuntimeException('Invalid metadata text.', 502);
    return count($characters) > $limit
        ? implode('', array_slice($characters, 0, $limit - 3)) . '...'
        : implode('', $characters);
}

function mw_share_names($values) {
    if (!is_array($values)) return '';
    return implode(', ', array_filter(array_map(static function ($value) {
        return mw_share_text(is_array($value) ? ($value['name'] ?? $value['nombre'] ?? $value['label'] ?? '') : $value, 80);
    }, $values)));
}

function mw_share_report_summary($report) {
    $reason = mw_share_text($report['reason'] ?? $report['content'] ?? '', 240);
    $categories = mw_share_names($report['typesOfInfraction'] ?? $report['categories'] ?? []);
    $votes = $report['communityVerification'] ?? [];
    $up = max(0, (int) ($votes['up'] ?? 0));
    $down = max(0, (int) ($votes['down'] ?? 0));
    $evidenceCount = count(is_array($report['evidence'] ?? null) ? $report['evidence'] : []);
    return [
        'reason' => $reason !== '' ? $reason : 'Sin motivo publicado.',
        'categories' => $categories !== '' ? $categories : 'Sin infracciones especificadas',
        'verification' => $up . ($up === 1 ? ' voto a favor' : ' votos a favor') . " / $down en contra",
        'evidence' => $evidenceCount . ($evidenceCount === 1 ? ' evidencia adjunta' : ' evidencias adjuntas'),
    ];
}

function mw_share_ai_text($summary) {
    if (!is_array($summary) || ($summary['stale'] ?? true) !== false || !is_string($summary['text'] ?? null)) return '';
    $text = preg_replace('/!?\[([^\]]*)\]\([^)]*\)/u', '$1', $summary['text']);
    $text = preg_replace('/[*_`#~]+/u', '', $text);
    return mw_share_text($text, 600);
}

function mw_share_card_metadata($metadata, $card) {
    $metadata['card'] = $card;
    $metadata['image'] = MW_SHARE_ORIGIN . '/share-image.php?' . http_build_query([
        'path' => substr($metadata['url'], strlen(MW_SHARE_ORIGIN)),
        'v' => substr(hash('sha256', json_encode($card)), 0, 16),
    ], '', '&', PHP_QUERY_RFC3986);
    $metadata['imageWidth'] = 1200;
    $metadata['imageHeight'] = 630;
    $metadata['imageType'] = 'image/png';
    return $metadata;
}

function mw_share_metadata($path, callable $fetch) {
    if (preg_match('~^/reporte/(\d+)/?$~D', $path, $match)) {
        $id = ltrim($match[1], '0');
        if ($id === '') throw new RuntimeException('Invalid report ID.', 404);
        $data = $fetch('/reports/' . $id);
        if (($data['ok'] ?? null) !== true || !is_array($data['report'] ?? null)
            || (string) ($data['report']['id'] ?? '') !== $id) {
            throw new RuntimeException('Invalid report metadata response.', 502);
        }
        $report = $data['report'];
        $nickname = mw_share_text($report['nickname'] ?? '', 100);
        $summary = mw_share_report_summary($report);
        return mw_share_card_metadata([
            'url' => MW_SHARE_ORIGIN . '/reporte/' . $id,
            'title' => mw_share_text('Reporte #' . $id . ($nickname !== '' ? ' de ' . $nickname : '') . ' | MostWanted', 180),
            'description' => mw_share_text('Motivo reportado: ' . $summary['reason'] . ' Infracciones reportadas: '
                . $summary['categories'] . '. ' . $summary['evidence'] . '. Comunidad: ' . $summary['verification'] . '.', 600),
            'imageAlt' => 'Reporte #' . $id . ($nickname !== '' ? ' de ' . $nickname : ''),
            'type' => 'article',
        ], [
            'heading' => 'REPORTE #' . $id, 'name' => $nickname,
            'context' => 'Infracciones reportadas: ' . $summary['categories'],
            'reason' => $summary['reason'],
            'stats' => $summary['evidence'] . ' | ' . $summary['verification'],
            'notice' => 'Contenido reportado por la comunidad. No implica una confirmacion oficial.',
        ]);
    }

    if (preg_match('~^/(jugador|usuario)/([^/]+)/?$~D', $path, $match)) {
        if (preg_match('/%(?![0-9a-f]{2})/i', $match[2])) throw new RuntimeException('Invalid player URL.', 400);
        $identity = rawurldecode($match[2]);
        if (trim($identity) === '' || preg_match('//u', $identity) !== 1 || preg_match('~[/\\\\\x00-\x1f]~', $identity)) {
            throw new RuntimeException('Invalid player URL.', 400);
        }
        $key = ctype_digit($identity) ? 'rid' : 'nickname';
        $data = $fetch('/players/lookup?' . http_build_query([$key => $identity, 'with_reports' => '1', 'reports_limit' => '5'], '', '&', PHP_QUERY_RFC3986));
        if (($data['ok'] ?? null) !== true) throw new RuntimeException('Invalid player metadata response.', 502);
        if (($data['found'] ?? null) === false) throw new RuntimeException('Player not found.', 404);
        if (!is_array($data['player'] ?? null)) throw new RuntimeException('Invalid player metadata response.', 502);
        $player = $data['player'];
        $nickname = mw_share_text($player['nickname'] ?? '', 100);
        if ($nickname === '') throw new RuntimeException('Missing player name.', 502);
        $count = max(0, (int) ($player['totalReports'] ?? 0));
        $crews = mw_share_names($player['crews'] ?? []);
        if (!is_array($player['reports'] ?? null)) throw new RuntimeException('Missing player reports for preview.', 502);
        $reports = array_values(array_filter($player['reports'], 'is_array'));
        usort($reports, static fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? '') ?: ((int) ($b['id'] ?? 0) <=> (int) ($a['id'] ?? 0)));
        $latest = $reports[0] ?? null;
        $summary = $latest !== null ? mw_share_report_summary($latest) : null;
        $aiText = mw_share_ai_text($player['aiSummary'] ?? null);
        $aiCount = max(0, (int) ($player['aiSummary']['reportCount'] ?? 0));
        $countText = $count . ($count === 1 ? ' reporte registrado' : ' reportes registrados');
        $description = $countText . '. ' . ($aiText !== '' ? 'Resumen HEX: ' . $aiText : ($summary !== null
            ? 'Ultimo motivo reportado: ' . $summary['reason'] . ' Infracciones reportadas: ' . $summary['categories']
                . '. ' . $summary['evidence'] . '. Comunidad del ultimo reporte: ' . $summary['verification'] . '.'
            : 'No hay motivos de reportes publicados disponibles.'));
        return mw_share_card_metadata([
            'url' => MW_SHARE_ORIGIN . '/jugador/' . rawurlencode($identity),
            'title' => 'Perfil de ' . $nickname . ' | MostWanted',
            'description' => mw_share_text($description . ($crews !== '' ? ' Crews: ' . $crews . '.' : ''), 650),
            'imageAlt' => 'Perfil de ' . $nickname,
            'type' => 'profile',
        ], [
            'heading' => 'PERFIL DEL JUGADOR | ' . $countText, 'name' => $nickname,
            'context' => $aiText !== '' ? 'Resumen HEX de ' . $aiCount . ' reporte(s)'
                : ($summary !== null ? 'Ultimo reporte #' . ($latest['id'] ?? '') . ' | ' . $summary['categories'] : 'Sin reportes publicados disponibles'),
            'reasonLabel' => $aiText !== '' ? 'RESUMEN IA GUARDADO / HEX' : 'MOTIVO REPORTADO',
            'reason' => $aiText !== '' ? $aiText : ($summary['reason'] ?? 'No hay motivos de reportes publicados disponibles.'),
            'stats' => $summary !== null ? $summary['evidence'] . ' | ' . $summary['verification'] : $countText,
            'notice' => $aiText !== '' ? 'Resumen IA persistido. Votos y evidencias del ultimo reporte. No confirma culpabilidad.'
                : 'Resumen HEX no disponible o pendiente de actualizar. Se muestra el ultimo motivo reportado.',
        ]);
    }

    throw new RuntimeException('Unsupported share URL.', 404);
}

function mw_share_html($template, $metadata, $indexable = true) {
    $escape = static fn($value) => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $template = preg_replace('~<title\b[^>]*>.*?</title>\s*|<link\b(?=[^>]*\brel=["\']canonical["\'])[^>]*>\s*|<meta\b(?=[^>]*\b(?:name|property)=["\'](?:title|description|robots|og:[^"\']+|twitter:[^"\']+)["\'])[^>]*>\s*|<script\b(?=[^>]*\bid=["\']discord:component-embed["\'])[^>]*>.*?</script>\s*~is', '', $template);
    $tags = [
        '<title>' . $escape($metadata['title']) . '</title>',
        '<link rel="canonical" href="' . $escape($metadata['url']) . '" />',
    ];
    $values = [
        'title' => $metadata['title'], 'description' => $metadata['description'],
        'robots' => $indexable ? 'index, follow' : 'noindex, nofollow',
        'og:type' => $metadata['type'], 'og:url' => $metadata['url'],
        'og:title' => $metadata['title'], 'og:description' => $metadata['description'],
        'og:image' => $metadata['image'], 'og:image:alt' => $metadata['imageAlt'],
        'og:site_name' => 'MostWanted', 'og:locale' => 'es_LA',
        'twitter:card' => 'summary_large_image', 'twitter:url' => $metadata['url'],
        'twitter:title' => $metadata['title'], 'twitter:description' => $metadata['description'],
        'twitter:image' => $metadata['image'], 'twitter:image:alt' => $metadata['imageAlt'],
    ];
    if (isset($metadata['imageWidth'], $metadata['imageHeight'], $metadata['imageType'])) {
        $values['og:image:width'] = (string) $metadata['imageWidth'];
        $values['og:image:height'] = (string) $metadata['imageHeight'];
        $values['og:image:type'] = $metadata['imageType'];
    }
    foreach ($values as $name => $value) {
        $tags[] = '<meta ' . (str_starts_with($name, 'og:') ? 'property' : 'name') . '="' . $name . '" content="' . $escape($value) . '" />';
    }
    if (!str_contains($template, '</head>')) throw new RuntimeException('Missing HTML head.', 503);
    return str_replace('</head>', implode("\n    ", $tags) . "\n  </head>", $template);
}

function mw_share_decode_response($body, $status) {
    // Older plugin versions emitted a UTF-8 BOM before every REST response.
    if (str_starts_with($body, "\xEF\xBB\xBF")) $body = substr($body, 3);
    $data = json_decode($body, true);
    if ($status === 404 && is_array($data) && ($data['code'] ?? '') === 'rest_no_route') {
        throw new RuntimeException('WordPress preview endpoint is not installed. Update the MostWanted plugin.', 503);
    }
    if ($status === 404) throw new RuntimeException('Shared resource not found.', 404);
    if ($status !== 200) throw new RuntimeException('WordPress preview request failed: ' . $status, 502);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        throw new RuntimeException('Invalid WordPress preview JSON: ' . json_last_error_msg(), 502);
    }
    return $data;
}

function mw_share_fetch($endpoint) {
    if (!function_exists('curl_init')) throw new RuntimeException('PHP cURL is required for link previews.', 503);
    $base = rtrim(getenv('WORDPRESS_API_BASE_URL') ?: 'https://kaithsrebels.com', '/');
    $handle = curl_init($base . '/wp-json/mostwanted/v1' . $endpoint);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 9,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | CURLPROTO_HTTP,
    ]);
    $body = curl_exec($handle);
    $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $error = curl_error($handle);
    curl_close($handle);
    if ($body === false) throw new RuntimeException('WordPress preview connection failed: ' . $error, 502);
    return mw_share_decode_response($body, $status);
}

function mw_share_response($path, $template, callable $fetch) {
    try {
        $metadata = mw_share_metadata($path, $fetch);
        return ['status' => 200, 'html' => mw_share_html($template, $metadata)];
    } catch (RuntimeException $error) {
        $status = in_array($error->getCode(), [400, 404, 502, 503], true) ? $error->getCode() : 502;
        error_log('[share-metadata] ' . $error->getMessage());
        $metadata = [
            'url' => MW_SHARE_ORIGIN . '/', 'type' => 'website',
            'title' => $status === 404 ? 'Contenido no encontrado | MostWanted' : 'Vista previa no disponible | MostWanted',
            'description' => $status === 404 ? 'No se encontro el reporte o jugador solicitado.' : 'No se pudieron consultar los datos. Intenta nuevamente mas tarde.',
            'image' => MW_SHARE_ORIGIN . '/og-image.png', 'imageAlt' => 'MostWanted',
        ];
        return ['status' => $status, 'html' => mw_share_html($template, $metadata, false)];
    }
}
