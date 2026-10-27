<?php

require_once __DIR__ . DIRECTORY_SEPARATOR . 'share-metadata.php';

$template = file_get_contents(__DIR__ . DIRECTORY_SEPARATOR . 'index.html');
if ($template === false) {
    error_log('[share-metadata] Built index.html is missing.');
    http_response_code(503);
    header('Cache-Control: no-store');
    exit('MostWanted no esta disponible temporalmente.');
}
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$response = mw_share_response(is_string($path) ? $path : '', $template, 'mw_share_fetch');
http_response_code($response['status']);
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: ' . ($response['status'] === 200 ? 'public, max-age=300' : 'no-store'));
echo $response['html'];
