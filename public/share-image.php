<?php

require_once __DIR__ . DIRECTORY_SEPARATOR . 'share-metadata.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'share-card.php';

try {
    $path = $_GET['path'] ?? '';
    if (!is_string($path) || strlen($path) > 1024) throw new RuntimeException('Invalid preview image path.', 400);
    $metadata = mw_share_metadata($path, 'mw_share_fetch');
    $png = mw_share_card_png($metadata['card']);
    header('Content-Type: image/png');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: public, max-age=300');
    echo $png;
} catch (RuntimeException $error) {
    error_log('[share-image] ' . $error->getMessage());
    http_response_code(in_array($error->getCode(), [400, 404, 502, 503], true) ? $error->getCode() : 502);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: no-store');
    echo 'No se pudo generar la imagen del reporte o jugador.';
}
