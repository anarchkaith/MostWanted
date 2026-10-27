<?php

require dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'share-metadata.php';
require dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'share-card.php';

function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}

function meta_value($html, $name) {
    $document = new DOMDocument();
    @$document->loadHTML('<?xml encoding="UTF-8">' . $html);
    $xpath = new DOMXPath($document);
    $matches = $xpath->query('//meta[@name="' . $name . '" or @property="' . $name . '"]');
    check($matches->length === 1, 'Expected one metadata tag: ' . $name);
    return $matches->item(0)->getAttribute('content');
}

$template = file_get_contents($argv[1] ?? dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'index.html');
$json = '{"ok":true,"found":true,"player":{"nickname":"Pol4ar24","totalReports":1,"reports":[]}}';
foreach ([$json, "\xEF\xBB\xBF" . $json] as $body) {
    $response = mw_share_response('/jugador/Pol4ar24', $template, static fn() => mw_share_decode_response($body, 200));
    check($response['status'] === 200, 'Accept WordPress JSON with or without a leading BOM');
    check(meta_value($response['html'], 'og:title') === 'Perfil de Pol4ar24 | MostWanted', 'Render player data from the actual REST response format');
    check(str_contains(meta_value($response['html'], 'og:description'), '1 reporte registrado.'), 'Preserve the player summary');
}
foreach ([
    ["\xEF\xBB\xBF" . '{"code":"rest_no_route","data":{"status":404}}', 404, 503],
    ['{"ok":false,"error":"report_not_found"}', 404, 404],
    ['{"code":"rest_post_invalid_id"}', 404, 404],
    ['<html>Bad gateway</html>', 502, 502],
    ["\xEF\xBB\xBF" . 'invalid', 200, 502],
    ['null', 200, 502],
] as [$body, $upstreamStatus, $expectedStatus]) {
    $response = mw_share_response('/reporte/6816', $template, static fn() => mw_share_decode_response($body, $upstreamStatus));
    check($response['status'] === $expectedStatus, 'Distinguish missing endpoint from missing report and invalid JSON');
    check(meta_value($response['html'], 'robots') === 'noindex, nofollow', 'Do not index upstream errors');
}
$pluginPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'wordpress' . DIRECTORY_SEPARATOR . 'mostwanted-cpt-rest' . DIRECTORY_SEPARATOR . 'mostwanted-cpt-rest.php';
check(str_starts_with(file_get_contents($pluginPath), '<?php'), 'The plugin must not emit a BOM before REST JSON');
$report = [
    'id' => 42, 'nickname' => 'Player "Uno" & Dos',
    'reason' => '<b>Motivo</b> con "comillas" & detalles',
    'categories' => ['Exploit'], 'avatar1' => 'https://example.com/avatar.png',
    'evidence' => [
        ['url' => 'https://example.com/video.mp4', 'contentType' => 'video/mp4'],
        ['url' => 'https://example.com/evidence.png?x=1&y=2', 'contentType' => 'image/png'],
    ],
    'reporter' => ['id' => 'private-owner-id'], 'ip' => 'private-ip',
];
$calls = [];
$response = mw_share_response('/reporte/42', $template, static function ($endpoint) use (&$calls, $report) {
    $calls[] = $endpoint;
    return ['ok' => true, 'report' => $report];
});
check($response['status'] === 200 && $calls === ['/reports/42'], 'Fetch the requested report only');
$html = $response['html'];
check(meta_value($html, 'og:title') === 'Reporte #42 de Player "Uno" & Dos | MostWanted', 'Report-specific title');
check(str_contains(meta_value($html, 'og:description'), 'Motivo reportado: Motivo con "comillas" & detalles'), 'Report-specific plain text reason');
check(str_contains(meta_value($html, 'description'), 'Exploit'), 'Include reported categories');
check(meta_value($html, 'og:url') === MW_SHARE_ORIGIN . '/reporte/42', 'Report-specific URL');
check(str_starts_with(meta_value($html, 'og:image'), MW_SHARE_ORIGIN . '/share-image.php?path=%2Freporte%2F42&v='), 'Link to a data-driven report card');
check(meta_value($html, 'twitter:image') === meta_value($html, 'og:image'), 'Matching Twitter image');
check(meta_value($html, 'twitter:title') === meta_value($html, 'og:title'), 'Matching Twitter title');
check(str_contains(meta_value($html, 'description'), '2 evidencias adjuntas.'), 'Report preview includes real evidence count');
check(!str_contains($html, 'private-owner-id') && !str_contains($html, 'private-ip'), 'Never embed private data');
check(!str_contains($html, 'discord:component-embed'), 'Remove the generic Discord component metadata');
check(meta_value($html, 'og:image:width') === '1200' && meta_value($html, 'og:image:height') === '630'
    && meta_value($html, 'og:image:type') === 'image/png', 'Declare actual PNG dimensions');
check(str_contains($html, '<div id="root"></div>') && str_contains($html, '<script type="module"'), 'Preserve the application shell');
check(substr_count($html, 'rel="canonical"') === 1 && str_contains($html, 'href="' . MW_SHARE_ORIGIN . '/reporte/42"'), 'Replace the canonical');
check(substr_count($html, '<title>') === 1, 'Replace the document title');
$normalized = mw_share_metadata('/reporte/00042/', static fn() => ['ok' => true, 'report' => $report]);
check($normalized['url'] === MW_SHARE_ORIGIN . '/reporte/42', 'Normalize leading zeros and trailing slash');

$player = ['nickname' => 'Jugador con espacios', 'totalReports' => 3, 'avatar1' => 'https://example.com/profile.jpg', 'crews' => [['name' => 'Crew Uno']],
    'reports' => [
        ['id' => 1, 'createdAt' => '2025-01-01', 'reason' => 'Motivo antiguo'],
        ['id' => 42, 'createdAt' => '2026-10-27', 'reason' => 'Expulsa y crashea a otros jugadores segun el reporte.',
            'categories' => ['MODDER'], 'evidence' => [['url' => 'https://example.com/a.png']],
            'communityVerification' => ['up' => 2, 'down' => 1]],
    ]];
foreach (['/jugador/Jugador%20con%20espacios', '/usuario/Jugador%20con%20espacios/'] as $path) {
    $response = mw_share_response($path, $template, static function ($endpoint) use ($player) {
        check($endpoint === '/players/lookup?nickname=Jugador%20con%20espacios&with_reports=1&reports_limit=5', 'Request recent reports for the exact player identity');
        return ['ok' => true, 'found' => true, 'player' => $player];
    });
    check($response['status'] === 200, 'Player response succeeds');
    check(meta_value($response['html'], 'og:title') === 'Perfil de Jugador con espacios | MostWanted', 'Player-specific title');
    check(meta_value($response['html'], 'og:url') === MW_SHARE_ORIGIN . '/jugador/Jugador%20con%20espacios', 'Canonical player route including legacy alias');
    check(meta_value($response['html'], 'og:type') === 'profile', 'Profile type');
    $description = meta_value($response['html'], 'description');
    check(str_contains($description, '3 reportes registrados.') && str_contains($description, 'Crews: Crew Uno.'), 'Player report count and crews');
    check(str_contains($description, 'Expulsa y crashea') && !str_contains($description, 'Motivo antiguo'), 'Summarize the most recent report, not just labels');
    check(str_contains($description, '2 votos a favor / 1 en contra') && str_contains($description, '1 evidencia adjunta'), 'Describe real votes and evidence');
    check(str_starts_with(meta_value($response['html'], 'og:image'), MW_SHARE_ORIGIN . '/share-image.php?path=%2Fjugador%2F'), 'Generate a player-specific image');
}
$response = mw_share_response('/jugador/123', $template, static function ($endpoint) use ($player) {
    check($endpoint === '/players/lookup?rid=123&with_reports=1&reports_limit=5', 'Numeric player route uses RID');
    return ['ok' => true, 'found' => true, 'player' => $player];
});
check($response['status'] === 200, 'RID lookup succeeds');

foreach ([
    ['/reporte/42', static fn() => ['ok' => true, 'report' => ['id' => 99]], 502],
    ['/reporte/42', static fn() => ['ok' => false], 502],
    ['/reporte/42', static function () { throw new RuntimeException('WordPress unavailable', 502); }, 502],
    ['/reporte/42', static function () { throw new RuntimeException('Not found', 404); }, 404],
    ['/jugador/Missing', static fn() => ['ok' => true, 'found' => false], 404],
    ['/jugador/Missing', static fn() => ['ok' => true, 'found' => true, 'player' => null], 502],
    ['/jugador/Missing', static fn() => ['ok' => true, 'found' => true, 'player' => ['nickname' => 'Missing']], 502],
    ['/reporte/0', static function () { throw new LogicException('Invalid ID must not fetch'); }, 404],
    ['/jugador/%ZZ', static function () { throw new LogicException('Invalid URL must not fetch'); }, 400],
    ['/jugador/%E0', static function () { throw new LogicException('Invalid UTF-8 must not fetch'); }, 400],
    ['/jugador/%2F', static function () { throw new LogicException('Invalid URL must not fetch'); }, 400],
    ['/perfil', static function () { throw new LogicException('Private profile must not fetch'); }, 404],
] as [$path, $fetch, $status]) {
    $response = mw_share_response($path, $template, $fetch);
    check($response['status'] === $status, 'Explicit failure status for ' . $path);
    check(meta_value($response['html'], 'robots') === 'noindex, nofollow', 'Do not index errors');
    check(!str_contains($response['html'], 'Ver reporte y votar'), 'No invented report details on failure');
}

$metadata = mw_share_metadata('/reporte/42', static fn() => ['ok' => true, 'report' => [
    'id' => 42, 'nickname' => '"><script>alert("x")</script>',
    'reason' => str_repeat('Texto largo ', 100),
    'avatar1' => 'javascript:alert(1)', 'avatar2' => 'data:image/png;base64,abc',
]]);
$html = mw_share_html($template, $metadata);
check(!str_contains($html, '<script>alert'), 'Escape untrusted HTML');
check(mb_strlen(meta_value($html, 'description')) <= 600, 'Bound the description length');
check(str_starts_with(meta_value($html, 'og:image'), MW_SHARE_ORIGIN . '/share-image.php?'), 'Generate a data card even without an avatar');
$playerMetadata = mw_share_metadata('/jugador/Test', static fn() => ['ok' => true, 'found' => true, 'player' => $player]);
check(str_contains($playerMetadata['card']['reason'], 'Expulsa y crashea'), 'Image contains the real report reason');
check(str_contains($playerMetadata['card']['context'], '#42'), 'Image identifies the report summarized');
$png = mw_share_card_png($playerMetadata['card']);
$dimensions = getimagesizefromstring($png);
check($dimensions[0] === 1200 && $dimensions[1] === 630 && $dimensions['mime'] === 'image/png', 'Render a real 1200x630 PNG');
$changedPlayer = $player;
$changedPlayer['reports'][1]['reason'] = 'Motivo corregido por el administrador';
$changed = mw_share_metadata('/jugador/Test', static fn() => ['ok' => true, 'found' => true, 'player' => $changedPlayer]);
check($changed['image'] !== $playerMetadata['image'], 'Change the image URL when public data changes');
check(mw_share_card_png($changed['card']) !== $png, 'Image pixels reflect the changed report');
$withAi = $player;
$withAi['aiSummary'] = ['text' => '**Resumen guardado**: patrones registrados en varios reportes; no implica culpabilidad.',
    'reportCount' => 3, 'stale' => false, 'updatedAt' => '2026-10-27T18:00:00Z'];
$aiCalls = 0;
$aiMetadata = mw_share_metadata('/jugador/Test', static function ($endpoint) use ($withAi, &$aiCalls) {
    $aiCalls++;
    check(str_starts_with($endpoint, '/players/lookup?'), 'Previews only read player metadata, never call AI');
    return ['ok' => true, 'found' => true, 'player' => $withAi];
});
check($aiCalls === 1 && str_contains($aiMetadata['description'], 'Resumen HEX: Resumen guardado'), 'Prefer saved AI summary over latest report reason');
check(str_starts_with($aiMetadata['card']['reason'], 'Resumen guardado') && !str_contains($aiMetadata['card']['reason'], '**'), 'Render stored Markdown as plain text in card');
check($aiMetadata['card']['reasonLabel'] === 'RESUMEN IA GUARDADO / HEX', 'Explicitly label AI source');
check(str_contains($aiMetadata['card']['context'], '3 reporte(s)'), 'AI summary covers all persisted reports, not only latest');
check($aiMetadata['image'] !== $playerMetadata['image'], 'Image revision includes saved AI text');
$withAi['aiSummary']['stale'] = true;
$staleAi = mw_share_metadata('/jugador/Test', static fn() => ['ok' => true, 'found' => true, 'player' => $withAi]);
check(!str_contains($staleAi['description'], 'Resumen guardado'), 'Never publish an outdated AI summary as current');
check(str_contains($staleAi['card']['notice'], 'pendiente de actualizar'), 'Explicit fallback when AI is stale');
check(str_contains($staleAi['card']['reason'], 'Expulsa y crashea'), 'Keep real report facts available while AI is pending');
$noReports = mw_share_metadata('/jugador/Test', static fn() => ['ok' => true, 'found' => true,
    'player' => ['nickname' => 'Test', 'totalReports' => 0, 'reports' => []]]);
check(str_contains($noReports['description'], '0 reportes registrados.') && str_contains($noReports['description'], 'No hay motivos'), 'Do not invent a reason when no reports are public');
check(!str_contains($noReports['description'], 'votos'), 'Do not invent vote totals for an absent report');
check(mw_share_report_summary(['communityVerification' => ['up' => 1]])['verification'] === '1 voto a favor / 0 en contra', 'Use singular vote count');
echo "OK route-specific report/player HTML, canonical, images, escaping, errors and application shell\n";
