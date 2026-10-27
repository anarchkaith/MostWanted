<?php

require dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'share-metadata.php';
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'share-card.php';
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'share-avatar.php';
require dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'share-cache.php';

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
check(meta_value($html, 'og:title') === 'Reporte #42 de Player "Uno" & Dos | Exploit | MostWanted', 'Report title includes the actual type');
check(str_contains(meta_value($html, 'og:description'), 'Motivo reportado: Motivo con "comillas" & detalles'), 'Report-specific plain text reason');
check(str_contains(meta_value($html, 'description'), 'Exploit'), 'Include reported categories');
check(meta_value($html, 'og:url') === MW_SHARE_ORIGIN . '/reporte/42', 'Report-specific URL');
check(str_starts_with(meta_value($html, 'og:image'), MW_SHARE_ORIGIN . '/share-image.php?path=%2Freporte%2F42&v='), 'Link to a data-driven report card');
check(meta_value($html, 'twitter:image') === meta_value($html, 'og:image'), 'Matching Twitter image');
check(meta_value($html, 'twitter:title') === meta_value($html, 'og:title'), 'Matching Twitter title');
check(str_contains(meta_value($html, 'description'), '2 evidencias adjuntas.'), 'Report preview includes real evidence count');
check(!str_contains($html, 'private-owner-id') && !str_contains($html, 'private-ip'), 'Never embed private data');
check(!str_contains($html, 'discord:component-embed'), 'Remove the generic Discord component metadata');
check(meta_value($html, 'og:image:width') === '1200' && (int) meta_value($html, 'og:image:height') >= 630
    && meta_value($html, 'og:image:type') === 'image/png', 'Declare actual PNG dimensions');
check(str_contains($html, '<div id="root"><main><h1>') && str_contains($html, '<script type="module"'), 'Preserve the application shell with visible initial content');
check(substr_count($html, '<h1>') === 1, 'Provide exactly one H1 in initial HTML');
$dom = new DOMDocument();
@$dom->loadHTML('<?xml encoding="UTF-8">' . $html);
$schemaNode = (new DOMXPath($dom))->query('//script[@type="application/ld+json"]')->item(0);
$schema = json_decode($schemaNode->textContent, true, 512, JSON_THROW_ON_ERROR);
check($schema['url'] === MW_SHARE_ORIGIN . '/reporte/42' && $schema['@type'] === 'WebPage', 'Structured data matches the actual route');
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
    check(meta_value($response['html'], 'og:title') === 'Perfil de Jugador con espacios | MODDER | MostWanted', 'Player title includes latest report types');
    check(meta_value($response['html'], 'og:url') === MW_SHARE_ORIGIN . '/jugador/Jugador%20con%20espacios', 'Canonical player route including legacy alias');
    check(meta_value($response['html'], 'og:type') === 'profile', 'Profile type');
    $description = html_entity_decode(strip_tags($response['html']), ENT_QUOTES | ENT_HTML5, 'UTF-8');
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
check(str_contains(meta_value($html, 'description'), trim(str_repeat('Texto largo ', 100))), 'Preserve the complete reason without truncation');
check($metadata['imageHeight'] > 630, 'Grow the report image instead of truncating the full reason');
$longLayout = mw_share_card_layout($metadata['card']);
check(!str_contains(json_encode($longLayout), '...') && str_contains(json_encode($longLayout), trim(str_repeat('Texto largo ', 100))),
    'Layout retains the entire report text without ellipses');
check(str_starts_with(meta_value($html, 'og:image'), MW_SHARE_ORIGIN . '/share-image.php?'), 'Generate a data card even without an avatar');
$playerMetadata = mw_share_metadata('/jugador/Test', static fn() => ['ok' => true, 'found' => true, 'player' => $player]);
check(str_contains($playerMetadata['card']['reason'], 'Crews: Crew Uno'), 'Image contains registered profile details');
check(str_contains($playerMetadata['card']['context'], '#42'), 'Image identifies the report summarized');
$png = mw_share_card_png($playerMetadata['card']);
$dimensions = getimagesizefromstring($png);
check($dimensions[0] === 1200 && $dimensions[1] === $playerMetadata['imageHeight'] && $dimensions[1] >= 630
    && $dimensions['mime'] === 'image/png', 'Render a PNG with the declared full-content dimensions');
$changedPlayer = $player;
$changedPlayer['crews'] = [['name' => 'Crew corregida']];
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
check($aiCalls === 1 && str_starts_with($aiMetadata['description'], 'Resumen guardado: patrones'), 'Lead metadata with saved AI text, not counters or labels');
check(!str_contains($aiMetadata['description'], '**'), 'Convert saved Markdown to plain metadata text');
check(!str_contains(json_encode($aiMetadata['card']), 'Resumen guardado'), 'Keep AI summary out of the image');
check($aiMetadata['card']['reasonLabel'] === '', 'Do not spend image space on a redundant details heading');
check(str_contains($aiMetadata['card']['context'], '#42'), 'Keep latest report identity in the image');
$changedAi = $withAi;
$changedAi['aiSummary']['text'] = 'Nuevo resumen actualizado del jugador.';
$changedAiMetadata = mw_share_metadata('/jugador/Test', static fn() => ['ok' => true, 'found' => true, 'player' => $changedAi]);
check($changedAiMetadata['description'] !== $aiMetadata['description'], 'AI updates change metadata text');
check($changedAiMetadata['image'] === $aiMetadata['image'], 'AI text changes do not needlessly regenerate complementary image');
$withAi['aiSummary']['stale'] = true;
$staleAi = mw_share_metadata('/jugador/Test', static fn() => ['ok' => true, 'found' => true, 'player' => $withAi]);
check(!str_contains($staleAi['description'], 'Resumen guardado'), 'Never publish an outdated AI summary as current');
check($staleAi['card']['notice'] === '', 'Do not display technical AI status footers in the image');
check(str_contains($staleAi['description'], 'Expulsa y crashea'), 'Keep real report reason in metadata while AI is pending');
$noReports = mw_share_metadata('/jugador/Test', static fn() => ['ok' => true, 'found' => true,
    'player' => ['nickname' => 'Test', 'totalReports' => 0, 'reports' => []]]);
check($noReports['description'] === '0 reportes registrados.', 'Include the known zero count but no empty reason placeholders');
check(!str_contains($noReports['description'], 'votos'), 'Do not invent vote totals for an absent report');
foreach ([$playerMetadata, $aiMetadata, $staleAi, $noReports, $metadata] as $entry) {
    $rendered = mw_share_html($template, $entry);
    check(meta_value($rendered, 'description') === meta_value($rendered, 'og:description')
        && meta_value($rendered, 'description') === meta_value($rendered, 'twitter:description'), 'Use the same complete summary across platforms');
}
$previousSite = getenv('MOSTWANTED_TWITTER_SITE');
putenv('MOSTWANTED_TWITTER_SITE=@ExampleBrand');
check(meta_value(mw_share_html($template, $playerMetadata), 'twitter:site') === '@ExampleBrand', 'Use configured account only');
if ($previousSite === false) putenv('MOSTWANTED_TWITTER_SITE');
else putenv('MOSTWANTED_TWITTER_SITE=' . $previousSite);
check(mw_share_report_summary(['communityVerification' => ['up' => 1, 'down' => 0]])['verification'] === '1 voto a favor / 0 en contra', 'Use singular vote count');
$emptyCard = $noReports['card'];
check($emptyCard['reason'] === '' && $emptyCard['reasonLabel'] === '' && $emptyCard['context'] === ''
    && $emptyCard['stats'] === '' && $emptyCard['avatars'] === [], 'Omit absent RID, crews, categories, labels, dates, votes, evidence and avatar');
$longAi = $withAi;
$longText = str_repeat('Resumen completo con datos reales. ', 60);
$longAi['aiSummary'] = ['text' => $longText, 'stale' => false, 'reportCount' => 3];
$longMetadata = mw_share_metadata('/jugador/Test', static fn() => ['ok' => true, 'found' => true, 'player' => $longAi]);
check(str_starts_with($longMetadata['description'], trim($longText)) && !str_contains($longMetadata['description'], '...'), 'Publish the full saved AI summary');
$avatarCard = $playerMetadata['card'];
$avatarCard['evidenceImages'] = [];
$avatarCard['avatars'] = ['https://i.ibb.co/example/avatar.png'];
$avatarCalls = 0;
$withAvatarPng = mw_share_card_png($avatarCard, static function ($url) use (&$avatarCalls) {
    check($url === 'https://i.ibb.co/example/avatar.png', 'Load only the recorded avatar URL');
    $avatarCalls++;
    $image = imagecreatetruecolor(20, 20);
    imagefill($image, 0, 0, imagecolorallocate($image, 0, 255, 0));
    return $image;
});
check($avatarCalls === 1, 'Include available avatar');
$renderedAvatar = imagecreatefromstring($withAvatarPng);
check((imagecolorat($renderedAvatar, 1060, 150) & 0xFFFFFF) === 0x00FF00, 'Avatar pixels appear beside the player identity');
imagedestroy($renderedAvatar);
foreach (['http://i.ibb.co/a.png', 'https://127.0.0.1/a.png', 'https://example.com/a.png', 'https://i.ibb.co@localhost/a.png'] as $url) {
    try {
        mw_share_avatar_bytes($url);
        throw new LogicException('Expected unsafe avatar URL rejection');
    } catch (RuntimeException $error) {
        check(str_contains($error->getMessage(), 'not supported'), 'Reject unapproved avatar downloads before network access');
    }
}
$noAvatarCalls = 0;
mw_share_card_png($emptyCard, static function () use (&$noAvatarCalls) { $noAvatarCalls++; throw new LogicException('No avatar should be loaded'); });
check($noAvatarCalls === 0, 'No invented avatar when no URL exists');
$galleryReport = $report;
$galleryReport['avatar1'] = '';
$galleryReport['evidence'] = [
    ['url' => 'https://i.ibb.co/example/a.png', 'contentType' => 'image/png'],
    ['url' => 'https://i.ibb.co/example/movie.mp4', 'contentType' => 'video/mp4'],
    ['url' => 'https://i.ibb.co/example/a.png', 'contentType' => 'image/png'],
    ['url' => 'https://i.ibb.co/example/b.jpg'],
    ['url' => 'https://i.ibb.co/example/c.webp', 'contentType' => 'image/webp'],
    ['url' => 'https://i.ibb.co/example/d.gif', 'contentType' => 'image/gif'],
    ['url' => 'http://i.ibb.co/example/e.png', 'contentType' => 'image/png'],
];
$gallery = mw_share_metadata('/reporte/42', static fn() => ['ok' => true, 'report' => $galleryReport]);
check(count($gallery['card']['evidenceImages']) === 3, 'Select at most three distinct HTTPS image evidences, not videos');
$galleryLayout = mw_share_card_layout($gallery['card']);
$lastBlock = end($galleryLayout['blocks']);
$lastBottom = $lastBlock['y'] + count(mw_share_card_lines($lastBlock['text'], $lastBlock['width'], $lastBlock['scale'])) * 19 * $lastBlock['scale'];
check($galleryLayout['evidence'][0]['y'] > $lastBottom, 'Evidence never covers the full report text');
check($galleryLayout['evidence'][0]['height'] >= 300, 'Give evidence at least 300 pixels of height for larger thumbnails');
$galleryCalls = [];
$galleryPng = mw_share_card_png($gallery['card'], static function ($url, $kind) use (&$galleryCalls) {
    check($kind === 'evidence', 'Use evidence-specific image download limits');
    $galleryCalls[] = $url;
    $photo = imagecreatetruecolor(400, 100);
    imagefill($photo, 0, 0, imagecolorallocate($photo, 0, 255, 0));
    return $photo;
});
check($galleryCalls === $gallery['card']['evidenceImages'], 'Load the actual evidence URLs');
$galleryImage = imagecreatefromstring($galleryPng);
foreach ($galleryLayout['evidence'] as $slot) {
    check((imagecolorat($galleryImage, $slot['x'] + (int) ($slot['width'] / 2), $slot['y'] + (int) ($slot['height'] / 2)) & 0xFFFFFF) === 0x00FF00,
        'Each evidence thumbnail is visible');
    check((imagecolorat($galleryImage, $slot['x'] + 1, $slot['y'] + 1) & 0xFFFFFF) === 0x111827, 'Fit without cropping or stretching the evidence');
    $photoWidth = $slot['width'];
    $photoHeight = (int) round($photoWidth / 4);
    $photoTop = $slot['y'] + (int) (($slot['height'] - $photoHeight) / 2);
    check((imagecolorat($galleryImage, $slot['x'] - 4, $photoTop - 4) & 0xFFFFFF) === 0xA4404D,
        'HUD corners frame the actual photograph without covering it');
}
check((imagecolorat($galleryImage, 1155, 20) & 0xFFFFFF) === 0x172030, 'Use a subtle dotted background');
check((imagecolorat($galleryImage, 60, $galleryLayout['evidence'][0]['y'] - 12) & 0xFFFFFF) === 0xFF4B55,
    'Separate evidence from text with a compact red accent');
check(imagesy($galleryImage) === $gallery['imageHeight'], 'Metadata declares the gallery height accurately');
imagedestroy($galleryImage);
$tallPhoto = imagecreatetruecolor(1440, 3200);
ob_start();
imagepng($tallPhoto);
$tallBytes = ob_get_clean();
imagedestroy($tallPhoto);
$decodedEvidence = mw_share_avatar_image($tallBytes, 4096, 8 * 1024 * 1024);
check(imagesy($decodedEvidence) === 3200, 'Support actual tall evidence screenshots within bounded limits');
imagedestroy($decodedEvidence);
try {
    mw_share_avatar_image($tallBytes);
    throw new LogicException('Avatar limits must remain unchanged');
} catch (RuntimeException $error) {
    check(str_contains($error->getMessage(), 'dimensions'), 'Keep stricter avatar dimensions');
}
$galleryPlayer = $player;
$galleryPlayer['reports'][1]['evidence'] = $galleryReport['evidence'];
check(mw_share_metadata('/jugador/Test', static fn() => ['ok' => true, 'found' => true, 'player' => $galleryPlayer])['card']['evidenceImages']
    === $gallery['card']['evidenceImages'], 'Player previews use images from the most recent report');
$changedEvidence = $galleryReport;
$changedEvidence['evidence'][0]['url'] = 'https://i.ibb.co/example/replaced.png';
check(mw_share_metadata('/reporte/42', static fn() => ['ok' => true, 'report' => $changedEvidence])['image'] !== $gallery['image'],
    'Replacing evidence invalidates the image revision');
$failedLog = tempnam(sys_get_temp_dir(), 'mw-evidence-');
$previousLog = ini_set('error_log', $failedLog);
try {
    check(getimagesizefromstring(mw_share_card_png($gallery['card'], static function () {
        throw new RuntimeException('Download unavailable');
    }))['mime'] === 'image/png', 'Unavailable evidence preserves the rest of the card');
    check(str_contains(file_get_contents($failedLog), '[share-evidence]'), 'Log unavailable evidence explicitly');
} finally {
    ini_set('error_log', $previousLog);
    unlink($failedLog);
}
$profileLayout = mw_share_card_layout($playerMetadata['card']);
$profileText = implode("\n", array_column($profileLayout['blocks'], 'text'));
foreach (["KAITH'S REBELS", 'PERFIL DEL JUGADOR', 'DATOS REGISTRADOS DEL JUGADOR', 'Fecha del ultimo reporte', 'Resumen HEX'] as $removed) {
    check(!str_contains($profileText, $removed), 'Remove nonessential image text: ' . $removed);
}
check($profileLayout['blocks'][0]['text'] === 'MOSTWANTED'
    && $profileLayout['blocks'][1]['text'] === $player['nickname'], 'Prioritize player identity directly after the compact brand');
check(str_contains($profileText, 'MODDER') && str_contains($profileText, '2 votos a favor / 1 en contra'), 'Keep report categories and community evidence visible');
check(mw_share_avatars(['avatar1' => '', 'avatar2' => 'https://i.ibb.co/example/second.png']) === ['https://i.ibb.co/example/second.png'], 'Use the secondary recorded avatar when primary is absent');
check(mw_share_avatars(['avatar1' => 'https://i.ibb.co/a.png', 'avatar2' => 'https://i.ibb.co/a.png']) === ['https://i.ibb.co/a.png'], 'Do not repeat identical avatars');
$twoAvatarPlayer = $player;
$twoAvatarPlayer['avatar1'] = 'https://i.ibb.co/first.png';
$twoAvatarPlayer['avatar2'] = 'https://i.ibb.co/second.png';
$twoAvatarMetadata = mw_share_metadata('/jugador/Test', static fn() => ['ok' => true, 'found' => true, 'player' => $twoAvatarPlayer]);
$twoAvatarCard = $twoAvatarMetadata['card'];
$twoAvatarCard['evidenceImages'] = [];
$twoAvatarLayout = mw_share_card_layout($twoAvatarCard);
$loadedAvatars = [];
$twoAvatarPng = mw_share_card_png($twoAvatarCard, static function ($url, $kind) use (&$loadedAvatars) {
    check($kind === 'avatar', 'Load both avatars using avatar limits');
    $loadedAvatars[] = $url;
    $photo = imagecreatetruecolor(20, 20);
    imagefill($photo, 0, 0, imagecolorallocate($photo, 0, count($loadedAvatars) === 1 ? 255 : 0, 255));
    return $photo;
});
check($loadedAvatars === $twoAvatarCard['avatars'], 'Load both recorded player avatars');
$twoAvatarImage = imagecreatefromstring($twoAvatarPng);
foreach ($twoAvatarLayout['avatars'] as $index => $slot) {
    check($slot['y'] === 30 && $slot['x'] >= 789, 'Position avatars side by side in the top-right corner');
    check((imagecolorat($twoAvatarImage, $slot['x'] + 85, $slot['y'] + 85) & 0xFFFFFF) === ($index === 0 ? 0x00FFFF : 0x0000FF),
        'Both avatars remain visible');
}
foreach ($twoAvatarLayout['blocks'] as $block) {
    check($block['y'] >= 218 || 55 + $block['width'] < $twoAvatarLayout['avatars'][0]['x'], 'Text does not overlap avatars');
}
imagedestroy($twoAvatarImage);
$emptyReport = mw_share_metadata('/reporte/42', static fn() => ['ok' => true, 'report' => ['id' => 42, 'nickname' => 'Player']]);
check($emptyReport['description'] === '' && $emptyReport['card']['reason'] === '' && $emptyReport['card']['stats'] === ''
    && $emptyReport['card']['context'] === '', 'Do not invent empty report field values');
$cacheKey = 'test:' . bin2hex(random_bytes(16));
$cacheDirectory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'mostwanted-previews-'
    . substr(hash('sha256', dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'public'), 0, 16);
$cacheFile = $cacheDirectory . DIRECTORY_SEPARATOR . hash('sha256', $cacheKey) . '.cache';
$cacheCalls = 0;
try {
    $generate = static function () use (&$cacheCalls) { return ['generation' => ++$cacheCalls]; };
    check(mw_share_cached($cacheKey, $generate, 'one')['generation'] === 1, 'Generate first cached value');
    check(mw_share_cached($cacheKey, $generate, 'one')['generation'] === 1, 'Warm requests reuse cached value');
    check(mw_share_cached($cacheKey, $generate, 'two')['generation'] === 2, 'Content revision invalidates cache');
    $entry = json_decode(file_get_contents($cacheFile), true);
    $entry['expires'] = time() - 1;
    file_put_contents($cacheFile, json_encode($entry));
    check(mw_share_cached($cacheKey, $generate, 'two')['generation'] === 3, 'Expired cache refreshes source');
    try {
        mw_share_cached($cacheKey, static function () { throw new RuntimeException('upstream failure'); }, 'failure');
        throw new LogicException('Expected upstream failure');
    } catch (RuntimeException $error) {
        check($error->getMessage() === 'upstream failure', 'Never cache a success-shaped fallback');
    }
    check(mw_share_cached($cacheKey, $generate, 'failure')['generation'] === 4, 'Failed generation remains retryable');
} finally {
    if (is_file($cacheFile)) unlink($cacheFile);
}
echo "OK route-specific report/player HTML, canonical, images, escaping, errors and application shell\n";
