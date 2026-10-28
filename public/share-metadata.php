<?php

require_once __DIR__ . DIRECTORY_SEPARATOR . 'share-card.php';

const MW_SHARE_ORIGIN = 'https://mostwanted.kaithsrebels.com';

function mw_share_text($value, $limit = null) {
    if (!is_string($value) && !is_numeric($value)) return '';
    $text = preg_replace('/\s+/u', ' ', strip_tags(html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8')));
    $characters = preg_split('//u', trim($text ?? ''), -1, PREG_SPLIT_NO_EMPTY);
    if ($characters === false) throw new RuntimeException('Invalid metadata text.', 502);
    return $limit !== null && count($characters) > $limit
        ? implode('', array_slice($characters, 0, $limit - 3)) . '...'
        : implode('', $characters);
}

function mw_share_names($values) {
    if (!is_array($values)) return '';
    return implode(', ', array_filter(array_map(static function ($value) {
        return mw_share_text(is_array($value) ? ($value['name'] ?? $value['nombre'] ?? $value['label'] ?? '') : $value);
    }, $values)));
}

function mw_share_identity_names($sources, $keys) {
    $names = [];
    foreach ($sources as $values) {
        if (!is_array($values)) continue;
        foreach ($values as $value) {
            if (is_array($value)) {
                foreach ($keys as $key) {
                    if (!empty($value[$key])) { $value = $value[$key]; break; }
                }
            }
            $name = mw_share_text($value);
            if ($name !== '' && !in_array(strtolower($name), array_map('strtolower', $names), true)) $names[] = $name;
        }
    }
    return $names;
}

function mw_share_report_summary($report) {
    $reason = mw_share_text($report['reason'] ?? $report['content'] ?? '');
    $categories = mw_share_names($report['typesOfInfraction'] ?? $report['categories'] ?? []);
    $votes = $report['communityVerification'] ?? [];
    $up = max(0, (int) ($votes['up'] ?? 0));
    $down = max(0, (int) ($votes['down'] ?? 0));
    $evidenceCount = count(is_array($report['evidence'] ?? null) ? $report['evidence'] : []);
    return [
        'reason' => $reason,
        'categories' => $categories,
        'verification' => isset($votes['up'], $votes['down']) ? $up . ($up === 1 ? ' voto a favor' : ' votos a favor') . " / $down en contra" : '',
        'evidence' => $evidenceCount > 0 ? $evidenceCount . ($evidenceCount === 1 ? ' evidencia adjunta' : ' evidencias adjuntas') : '',
    ];
}

function mw_share_risk_key($value) {
    $value = strtr(mw_share_text($value), [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'ü' => 'u',
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ñ' => 'N', 'Ü' => 'U',
    ]);
    $text = iconv('UTF-8', 'ASCII//TRANSLIT', $value);
    if ($text === false) throw new RuntimeException('Cannot normalize preview severity.', 502);
    return strtolower($text);
}

function mw_share_risk($reports) {
    $scores = json_decode(file_get_contents(__DIR__ . DIRECTORY_SEPARATOR . 'share-conduct-scores.json'), true, 512, JSON_THROW_ON_ERROR);
    $normalized = [];
    foreach ($scores as $label => $score) $normalized[mw_share_risk_key($label)] = $score;
    $levels = ['baja' => 1, 'low' => 1, 'media' => 2, 'medium' => 2, 'normal' => 2,
        'alta' => 3, 'high' => 3, 'critica' => 4, 'critical' => 4];
    $risk = 0;
    foreach ($reports as $report) {
        $severity = $report['severity'] ?? $report['severidad'] ?? $report['analysis']['severity'] ?? $report['analysis']['severidad'] ?? '';
        $level = $levels[mw_share_risk_key($severity)] ?? 0;
        if ($level === 0) {
            foreach (($report['labels'] ?? []) as $label) {
                $name = is_array($label) ? ($label['label'] ?? $label['name'] ?? '') : $label;
                $score = $normalized[mw_share_risk_key($name)] ?? 0;
                $level = max($level, $score >= 3 ? $score - 1 : ($score > 0 ? 1 : 0));
            }
        }
        $risk = max($risk, $level);
    }
    return ['neutral', 'low', 'medium', 'high', 'critical'][$risk];
}

function mw_share_ai_text($summary) {
    if (!is_array($summary) || ($summary['stale'] ?? true) !== false || !is_string($summary['text'] ?? null)) return '';
    $text = preg_replace('/!?\[([^\]]*)\]\([^)]*\)/u', '$1', $summary['text']);
    $text = preg_replace('/[*_`#~]+/u', '', $text);
    return mw_share_text($text);
}

function mw_share_join($values, $separator = ' ') {
    return implode($separator, array_filter($values, static fn($value) => $value !== ''));
}

function mw_share_report_description($summary) {
    return mw_share_join([
        $summary['reason'] !== '' ? 'Motivo reportado: ' . $summary['reason'] : '',
        $summary['categories'] !== '' ? 'Infracciones reportadas: ' . $summary['categories'] . '.' : '',
        $summary['evidence'] !== '' ? $summary['evidence'] . '.' : '',
        $summary['verification'] !== '' ? 'Comunidad: ' . $summary['verification'] . '.' : '',
    ]);
}

function mw_share_avatars($data) {
    $avatars = [];
    foreach (['avatar1', 'avatar2'] as $field) {
        $url = mw_share_text($data[$field] ?? '');
        if ($url !== '' && filter_var($url, FILTER_VALIDATE_URL) && parse_url($url, PHP_URL_SCHEME) === 'https'
            && !in_array($url, $avatars, true)) $avatars[] = $url;
    }
    return $avatars;
}

function mw_share_evidence_images($report) {
    $images = [];
    foreach (($report['evidence'] ?? []) as $item) {
        if (!is_array($item)) continue;
        $url = mw_share_text($item['url'] ?? '');
        $type = strtolower(mw_share_text($item['contentType'] ?? ''));
        if (!filter_var($url, FILTER_VALIDATE_URL) || parse_url($url, PHP_URL_SCHEME) !== 'https') continue;
        if (!in_array($type, ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], true)
            && !($type === '' && preg_match('/\.(png|jpe?g|webp|gif)$/i', parse_url($url, PHP_URL_PATH) ?? ''))) continue;
        if (!in_array($url, $images, true)) $images[] = $url;
        if (count($images) === 3) break;
    }
    return $images;
}

function mw_share_card_metadata($metadata, $card) {
    $metadata['fullDescription'] = $metadata['description'];
    $metadata['description'] = mw_share_text($metadata['description']);
    $metadata['card'] = $card;
    $metadata['image'] = MW_SHARE_ORIGIN . '/share-image.php?' . http_build_query([
        'path' => substr($metadata['url'], strlen(MW_SHARE_ORIGIN)),
        'v' => substr(hash('sha256', json_encode($card)), 0, 16),
    ], '', '&', PHP_QUERY_RFC3986);
    $metadata['imageWidth'] = 1200;
    $metadata['imageHeight'] = !empty($card['responsive'])
        ? mw_share_card_layout($card)['height']
        : 675;
    $metadata['imageType'] = 'image/png';
    return $metadata;
}

function mw_share_social_cache_player($identity, callable $fetch) {
    $resolved = ctype_digit($identity)
        ? ['ok' => true, 'id' => $identity]
        : $fetch('/social-cache/n/' . rawurlencode($identity));
    $rid = mw_share_text($resolved['id'] ?? '');
    if (($resolved['ok'] ?? null) !== true || !ctype_digit($rid)) {
        throw new RuntimeException('Invalid Social Club player response.', 502);
    }

    $history = $fetch('/social-cache/r/' . rawurlencode($rid));
    if (($history['ok'] ?? null) !== true || !is_array($history['names'] ?? null)) {
        throw new RuntimeException('Invalid Social Club name history response.', 502);
    }
    $names = array_values(array_filter(array_map(static function ($entry) {
        if (!is_array($entry)) return null;
        $name = mw_share_text($entry['name'] ?? '');
        return $name === '' ? null : ['name' => $name, 'time' => max(0, (int) ($entry['time'] ?? 0))];
    }, $history['names'])));
    usort($names, static fn($a, $b) => $b['time'] <=> $a['time']);
    $nickname = mw_share_text($resolved['name'] ?? $resolved['nickname'] ?? $names[0]['name'] ?? $identity);

    return [
        'nickname' => $nickname,
        'rid' => $rid,
        'aliases' => array_map(static fn($entry) => ['alias' => $entry['name']], $names),
        'crews' => [],
        'avatar1' => 'https://prod.cloud.rockstargames.com/members/sc/6266/' . rawurlencode($rid) . '/publish/gta5/mpchars/0.png',
        'avatar2' => 'https://prod.cloud.rockstargames.com/members/sc/6266/' . rawurlencode($rid) . '/publish/gta5/mpchars/1.png',
        'totalReports' => 0,
        'reports' => [],
        'socialClubOnly' => true,
    ];
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
        $nickname = mw_share_text($report['nickname'] ?? '');
        $summary = mw_share_report_summary($report);
        return mw_share_card_metadata([
            'url' => MW_SHARE_ORIGIN . '/reporte/' . $id,
            'playerUrl' => $nickname !== '' ? MW_SHARE_ORIGIN . '/jugador/' . rawurlencode($nickname) : null,
            'reportUrl' => MW_SHARE_ORIGIN . '/reporte/' . $id,
            'title' => 'Reporte #' . $id . ($nickname !== '' ? ' de ' . $nickname : '')
                . ($summary['categories'] !== '' ? ' | ' . $summary['categories'] : ''),
            'description' => mw_share_report_description($summary),
            'imageAlt' => 'Reporte #' . $id . ($nickname !== '' ? ' de ' . $nickname : ''),
            'type' => 'article',
        ], [
            'heading' => 'REPORTE #' . $id, 'name' => $nickname,
            'risk' => mw_share_risk([$report]),
            'discordReason' => $summary['reason'],
            'discordCategories' => $summary['categories'],
            'context' => $summary['categories'] !== '' ? 'Infracciones reportadas: ' . $summary['categories'] : '',
            'reason' => $summary['reason'],
            'stats' => mw_share_join([$summary['evidence'], $summary['verification']], ' | '),
            'avatars' => mw_share_avatars($report),
            'evidenceImages' => mw_share_evidence_images($report),
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
        $socialClubOnly = ($data['found'] ?? null) === false;
        if ($socialClubOnly) {
            $player = mw_share_social_cache_player($identity, $fetch);
        } else {
            if (!is_array($data['player'] ?? null)) throw new RuntimeException('Invalid player metadata response.', 502);
            $player = $data['player'];
        }
        $nickname = mw_share_text($player['nickname'] ?? '');
        if ($nickname === '') throw new RuntimeException('Missing player name.', 502);
        $count = isset($player['totalReports']) ? max(0, (int) $player['totalReports']) : null;
        if (!is_array($player['reports'] ?? null)) throw new RuntimeException('Missing player reports for preview.', 502);
        $reports = array_values(array_filter($player['reports'], 'is_array'));
        usort($reports, static fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? '') ?: ((int) ($b['id'] ?? 0) <=> (int) ($a['id'] ?? 0)));
        $latest = $reports[0] ?? null;
        $aliases = mw_share_identity_names(array_merge([$player['aliases'] ?? []], array_column($reports, 'aliases')), ['alias', 'name']);
        $aliases = array_values(array_filter($aliases, static fn($alias) => strcasecmp($alias, $nickname) !== 0));
        $crews = mw_share_identity_names(array_merge([$player['crews'] ?? []], array_column($reports, 'crews')), ['name', 'nombre']);
        $tags = mw_share_identity_names(array_column($reports, 'labels'), ['label', 'name']);
        $summary = $latest !== null ? mw_share_report_summary($latest) : null;
        $aiText = mw_share_ai_text($player['aiSummary'] ?? null);
        $countText = $count !== null ? $count . ($count === 1 ? ' reporte registrado' : ' reportes registrados') : '';
        $description = $aiText !== '' ? $aiText : ($summary['reason'] ?? '');
        if ($description === '' && $countText !== '') $description = $countText . '.';
        if ($socialClubOnly) $description = 'Perfil de Social Club. Sin reportes publicados.';
        $details = [];
        foreach ([
            'RID' => mw_share_text($player['rid'] ?? ''),
            'Otros nombres' => implode(', ', $aliases),
            'Crews' => implode(', ', $crews),
        ] as $label => $value) {
            if ($value !== '') $details[] = $label . ': ' . $value;
        }
        return mw_share_card_metadata([
            'url' => MW_SHARE_ORIGIN . '/jugador/' . rawurlencode($identity),
            'playerUrl' => MW_SHARE_ORIGIN . '/jugador/' . rawurlencode($identity),
            'reportUrl' => isset($latest['id']) && ctype_digit((string) $latest['id'])
                ? MW_SHARE_ORIGIN . '/reporte/' . $latest['id'] : null,
            'title' => 'Perfil de ' . $nickname . (!empty($summary['categories']) ? ' | ' . $summary['categories'] : ''),
            'description' => $description,
            'imageAlt' => 'Perfil de ' . $nickname,
            'type' => 'profile',
        ], [
            'heading' => '', 'name' => $nickname,
            'risk' => mw_share_risk($reports),
            'context' => mw_share_join([
                isset($latest['id']) ? 'Ultimo reporte #' . $latest['id'] : '',
                $summary['categories'] ?? '',
            ], ' | '),
            'reasonLabel' => '',
            'reason' => implode("\n", $details),
            'tags' => $tags,
            'stats' => $summary !== null ? mw_share_join([$summary['evidence'], $summary['verification']], ' | ') : '',
            'avatars' => mw_share_avatars($player),
            'evidenceImages' => mw_share_evidence_images($latest ?? []),
            'notice' => $socialClubOnly ? 'Datos de Social Club. Sin reportes publicados.' : '',
            'responsive' => true,
        ]);
    }

    throw new RuntimeException('Unsupported share URL.', 404);
}

function mw_share_discord_json($metadata) {
    $markdown = static fn($text) => preg_replace('/([\\\\`*_{}\[\]()<>#+.!|~>])/u', '\\\\$1', $text);
    $buttons = [['type' => 2, 'style' => 5, 'url' => MW_SHARE_ORIGIN . '/denunciar', 'label' => 'Aportar información']];
    if (!empty($metadata['reportUrl'])) $buttons[] = [
        'type' => 2, 'style' => 5, 'url' => $metadata['reportUrl'], 'label' => 'Votar reporte',
    ];
    if (!empty($metadata['playerUrl'])) $buttons[] = [
        'type' => 2, 'style' => 5, 'url' => $metadata['playerUrl'], 'label' => 'Ver información del jugador',
    ];
    [$r, $g, $b] = mw_share_card_palette($metadata['card']['risk'] ?? 'neutral');
    $card = $metadata['card'];
    $body = $metadata['type'] === 'article'
        ? mw_share_join([
            !empty($card['discordCategories']) ? '**Infracciones reportadas** · ' . $markdown($card['discordCategories']) : '',
            !empty($card['discordReason']) ? "### Descripción del reporte\n" . $markdown($card['discordReason']) : '',
            $card['stats'] !== '' ? '**Evidencias y comunidad**' . "\n" . $markdown($card['stats']) : '',
        ], "\n\n")
        : ($metadata['description'] !== '' ? "### Resumen del jugador\n" . $markdown($metadata['description']) : '');
    $components = [['type' => 10, 'content' => '## ' . $markdown($metadata['title']) . ($body !== '' ? "\n\n" . $body : '')]];
    $components[] = ['type' => 12, 'items' => [['media' => ['url' => $metadata['image']]]]];
    $components[] = ['type' => 14, 'divider' => true, 'spacing' => 1];
    $components[] = ['type' => 1, 'components' => $buttons];
    $encode = static fn($items) => json_encode(['component' => [
        'type' => 17, 'accent_color' => ($r << 16) | ($g << 8) | $b, 'components' => $items,
    ]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_THROW_ON_ERROR);
    $json = $encode($components);
    if (strlen($json) <= 3000) return $json;
    // Keep the full summary and actions if only the optional image exceeds Discord's budget.
    array_splice($components, 1, 1);
    $json = $encode($components);
    if (strlen($json) <= 3000) return $json;
    error_log('[share-discord] Component embed exceeds 3000 bytes; using complete Open Graph metadata.');
    return null;
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
    $twitterSite = trim(getenv('MOSTWANTED_TWITTER_SITE') ?: '');
    if ($twitterSite !== '') {
        if (!preg_match('/^@[A-Za-z0-9_]{1,15}$/D', $twitterSite)) throw new RuntimeException('Invalid MOSTWANTED_TWITTER_SITE.', 503);
        $values['twitter:site'] = $twitterSite;
    }
    foreach ($values as $name => $value) {
        $tags[] = '<meta ' . (str_starts_with($name, 'og:') ? 'property' : 'name') . '="' . $name . '" content="' . $escape($value) . '" />';
    }
    if ($indexable) {
        $discord = mw_share_discord_json($metadata);
        if ($discord !== null) $tags[] = '<script id="discord:component-embed" type="application/json">' . $discord . '</script>';
        $schema = [
            '@context' => 'https://schema.org',
            '@type' => $metadata['type'] === 'profile' ? 'ProfilePage' : 'WebPage',
            '@id' => $metadata['url'] . '#webpage', 'url' => $metadata['url'],
            'name' => $metadata['title'], 'description' => $metadata['description'],
            'inLanguage' => 'es', 'image' => $metadata['image'],
            'isPartOf' => ['@type' => 'WebSite', 'name' => 'MostWanted', 'url' => MW_SHARE_ORIGIN . '/'],
        ];
        if ($metadata['type'] === 'profile') $schema['mainEntity'] = ['@type' => 'Person', 'name' => $metadata['card']['name']];
        $tags[] = '<script id="share-structured-data" type="application/ld+json">'
            . json_encode($schema, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) . '</script>';
    }
    if (!str_contains($template, '</head>')) throw new RuntimeException('Missing HTML head.', 503);
    $template = str_replace('</head>', implode("\n    ", $tags) . "\n  </head>", $template);
    $content = '<main><h1>' . $escape(str_replace(' | MostWanted', '', $metadata['title'])) . '</h1><p>'
        . $escape($metadata['fullDescription'] ?? $metadata['description']) . '</p></main>';
    return str_replace('<div id="root"></div>', '<div id="root">' . $content . '</div>', $template);
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
    if (preg_match('~^/social-cache/(n|r)/([^/?#]+)$~D', $endpoint, $match)) {
        $kind = $match[1];
        $identifier = rawurldecode($match[2]);
        if (preg_match('//u', $identifier) !== 1 || trim($identifier) === ''
            || preg_match('~[/\\\\\x00-\x1f]~', $identifier)
            || ($kind === 'r' && !ctype_digit($identifier))) {
            throw new RuntimeException('Invalid Social Club lookup.', 400);
        }
        $handle = curl_init('https://sc-cache.com/' . $kind . '/' . rawurlencode($identifier));
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $body = curl_exec($handle);
        $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);
        if ($body === false) throw new RuntimeException('Social Club lookup failed: ' . $error, 502);
        $payload = mw_share_decode_response($body, $status);
        if ($kind === 'n') {
            if (!is_array($payload) || !ctype_digit(mw_share_text($payload['id'] ?? ''))) {
                throw new RuntimeException('Invalid Social Club player response.', 502);
            }
            return ['ok' => true] + $payload;
        }
        $entries = is_array($payload) ? $payload : ($payload['value'] ?? null);
        if (!is_array($entries)) throw new RuntimeException('Invalid Social Club name history response.', 502);
        return ['ok' => true, 'names' => $entries];
    }
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
