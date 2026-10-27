<?php

require dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'share-metadata.php';

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
check(meta_value($html, 'og:image') === 'https://example.com/evidence.png?x=1&y=2', 'Prefer image evidence over video and avatars');
check(meta_value($html, 'twitter:image') === meta_value($html, 'og:image'), 'Matching Twitter image');
check(meta_value($html, 'twitter:title') === meta_value($html, 'og:title'), 'Matching Twitter title');
check(!str_contains($html, 'private-owner-id') && !str_contains($html, 'private-ip'), 'Never embed private data');
check(!str_contains($html, 'discord:component-embed'), 'Remove the generic Discord component metadata');
check(!str_contains($html, 'og:image:width') && !str_contains($html, 'og:image:type'), 'Do not reuse generic image dimensions or format');
check(str_contains($html, '<div id="root"></div>') && str_contains($html, '<script type="module"'), 'Preserve the application shell');
check(substr_count($html, 'rel="canonical"') === 1 && str_contains($html, 'href="' . MW_SHARE_ORIGIN . '/reporte/42"'), 'Replace the canonical');
check(substr_count($html, '<title>') === 1, 'Replace the document title');
$normalized = mw_share_metadata('/reporte/00042/', static fn() => ['ok' => true, 'report' => $report]);
check($normalized['url'] === MW_SHARE_ORIGIN . '/reporte/42', 'Normalize leading zeros and trailing slash');

$player = ['nickname' => 'Jugador con espacios', 'totalReports' => 3, 'avatar1' => 'https://example.com/profile.jpg', 'crews' => [['name' => 'Crew Uno']]];
foreach (['/jugador/Jugador%20con%20espacios', '/usuario/Jugador%20con%20espacios/'] as $path) {
    $response = mw_share_response($path, $template, static function ($endpoint) use ($player) {
        check($endpoint === '/players/lookup?nickname=Jugador%20con%20espacios&with_reports=0', 'Decode and encode the exact player identity');
        return ['ok' => true, 'found' => true, 'player' => $player];
    });
    check($response['status'] === 200, 'Player response succeeds');
    check(meta_value($response['html'], 'og:title') === 'Perfil de Jugador con espacios | MostWanted', 'Player-specific title');
    check(meta_value($response['html'], 'og:url') === MW_SHARE_ORIGIN . '/jugador/Jugador%20con%20espacios', 'Canonical player route including legacy alias');
    check(meta_value($response['html'], 'og:type') === 'profile', 'Profile type');
    check(str_contains(meta_value($response['html'], 'description'), '3 reportes registrados. Crews: Crew Uno.'), 'Player report count and crews');
    check(meta_value($response['html'], 'og:image') === $player['avatar1'], 'Use player avatar, not report evidence');
}
$response = mw_share_response('/jugador/123', $template, static function ($endpoint) use ($player) {
    check($endpoint === '/players/lookup?rid=123&with_reports=0', 'Numeric player route uses RID');
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
check(mb_strlen(meta_value($html, 'description')) <= 300, 'Bound the description length');
check(meta_value($html, 'og:image') === MW_SHARE_ORIGIN . '/og-image.png', 'Safe default when images are absent or invalid');
check(mw_share_image(['', 'https://example.com/avatar.jpg']) === 'https://example.com/avatar.jpg', 'Use secondary avatar when needed');
echo "OK route-specific report/player HTML, canonical, images, escaping, errors and application shell\n";
