<?php

function mw_share_card_text($image, $text, $x, $y, $width, $maxLines, $scale, $color) {
    $encoded = iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $text);
    if ($encoded === false) throw new RuntimeException('Cannot encode preview card text.', 502);
    $columns = max(1, (int) floor($width / (imagefontwidth(5) * $scale)));
    $lines = explode("\n", wordwrap($encoded, $columns, "\n", true));
    $clipped = count($lines) > $maxLines;
    $lines = array_slice($lines, 0, $maxLines);
    if ($clipped) $lines[count($lines) - 1] = substr($lines[count($lines) - 1], 0, $columns - 3) . '...';
    foreach ($lines as $index => $line) {
        $layer = imagecreatetruecolor(max(1, strlen($line) * imagefontwidth(5)), imagefontheight(5));
        $background = imagecolorallocate($layer, 17, 24, 39);
        imagefill($layer, 0, 0, $background);
        imagestring($layer, 5, 0, 0, $line, $color);
        imagecopyresized($image, $layer, $x, $y + $index * 19 * $scale, 0, 0, imagesx($layer) * $scale, imagesy($layer) * $scale, imagesx($layer), imagesy($layer));
        imagedestroy($layer);
    }
}

function mw_share_card_png($card) {
    if (!function_exists('imagecreatetruecolor') || !function_exists('iconv')) {
        throw new RuntimeException('PHP GD and iconv are required for preview images.', 503);
    }
    $image = imagecreatetruecolor(1200, 630);
    if ($image === false) throw new RuntimeException('Cannot create preview image.', 503);
    try {
        $background = imagecolorallocate($image, 17, 24, 39);
        $red = imagecolorallocate($image, 255, 75, 85);
        $white = imagecolorallocate($image, 241, 245, 249);
        $muted = imagecolorallocate($image, 170, 185, 204);
        imagefill($image, 0, 0, $background);
        imagefilledrectangle($image, 0, 0, 15, 629, $red);
        mw_share_card_text($image, 'MOSTWANTED / KAITH\'S REBELS', 55, 30, 1090, 1, 2, $red);
        mw_share_card_text($image, $card['heading'], 55, 86, 1090, 1, 2, $muted);
        mw_share_card_text($image, $card['name'], 55, 135, 1090, 1, 4, $white);
        mw_share_card_text($image, $card['context'], 55, 220, 1090, 2, 2, $red);
        mw_share_card_text($image, $card['reasonLabel'] ?? 'MOTIVO REPORTADO', 55, 300, 1090, 1, 2, $muted);
        mw_share_card_text($image, $card['reason'], 55, 343, 1090, 4, 2, $white);
        mw_share_card_text($image, $card['stats'], 55, 510, 1090, 1, 2, $white);
        mw_share_card_text($image, $card['notice'], 55, 570, 1090, 2, 1, $muted);
        ob_start();
        try {
            if (!imagepng($image)) throw new RuntimeException('Cannot encode preview PNG.', 503);
            return ob_get_contents();
        } finally {
            ob_end_clean();
        }
    } finally {
        imagedestroy($image);
    }
}
