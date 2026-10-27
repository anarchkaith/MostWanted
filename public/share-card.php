<?php

function mw_share_card_lines($text, $width, $scale) {
    $encoded = iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $text);
    if ($encoded === false) throw new RuntimeException('Cannot encode preview card text.', 502);
    $columns = max(1, (int) floor($width / (9 * $scale)));
    return $text === '' ? [] : explode("\n", wordwrap($encoded, $columns, "\n", true));
}

function mw_share_card_layout($card) {
    $y = 30;
    $blocks = [];
    $avatars = [];
    $avatarUrls = array_slice($card['avatars'] ?? [], 0, 2);
    $avatarLeft = 1145 - count($avatarUrls) * 170 - max(0, count($avatarUrls) - 1) * 16;
    foreach ($avatarUrls as $index => $url) {
        $avatars[] = ['url' => $url, 'x' => $avatarLeft + $index * 186, 'y' => 30, 'width' => 170, 'height' => 170];
    }
    foreach ([
        ['MOSTWANTED', 2, 'red'],
        [$card['heading'], 2, 'muted'],
        [$card['name'], 4, 'white'],
        [$card['context'], 2, 'red'],
        [$card['reason'] !== '' ? ($card['reasonLabel'] ?? 'MOTIVO REPORTADO') : '', 2, 'muted'],
        [$card['reason'], 2, 'white'],
        [$card['stats'], 2, 'white'],
        [$card['notice'], 1, 'muted'],
    ] as $index => [$text, $scale, $color]) {
        if ($index === 4 && $avatars) $y = max($y, 218);
        $width = $avatars && $y < 218 ? $avatarLeft - 55 - 20 : 1090;
        $lines = mw_share_card_lines($text, $width, $scale);
        if (!$lines) continue;
        $blocks[] = ['text' => $text, 'y' => $y, 'width' => $width, 'scale' => $scale, 'color' => $color];
        $y += count($lines) * 19 * $scale + 18;
    }
    $evidence = [];
    $urls = array_slice($card['evidenceImages'] ?? [], 0, 3);
    if ($urls) {
        $height = max(180, min(260, 610 - $y));
        $width = (int) floor((1090 - (count($urls) - 1) * 16) / count($urls));
        foreach ($urls as $index => $url) {
            $evidence[] = ['url' => $url, 'x' => 55 + $index * ($width + 16), 'y' => $y, 'width' => $width, 'height' => $height];
        }
        $y += $height;
    }
    return ['height' => max(630, $y + 20), 'blocks' => $blocks, 'evidence' => $evidence, 'avatars' => $avatars];
}

function mw_share_card_photo($image, $photo, $x, $y, $boxWidth, $boxHeight) {
    $scale = min($boxWidth / imagesx($photo), $boxHeight / imagesy($photo));
    $width = max(1, (int) round(imagesx($photo) * $scale));
    $height = max(1, (int) round(imagesy($photo) * $scale));
    imagecopyresampled($image, $photo, $x + (int) (($boxWidth - $width) / 2), $y + (int) (($boxHeight - $height) / 2),
        0, 0, $width, $height, imagesx($photo), imagesy($photo));
}

function mw_share_card_text($image, $text, $x, $y, $width, $scale, $color) {
    $lines = mw_share_card_lines($text, $width, $scale);
    foreach ($lines as $index => $line) {
        $layer = imagecreatetruecolor(max(1, strlen($line) * imagefontwidth(5)), imagefontheight(5));
        $background = imagecolorallocate($layer, 17, 24, 39);
        imagefill($layer, 0, 0, $background);
        imagestring($layer, 5, 0, 0, $line, $color);
        imagecopyresized($image, $layer, $x, $y + $index * 19 * $scale, 0, 0, imagesx($layer) * $scale, imagesy($layer) * $scale, imagesx($layer), imagesy($layer));
        imagedestroy($layer);
    }
}

function mw_share_card_png($card, $loadImage = null) {
    if (!function_exists('imagecreatetruecolor') || !function_exists('iconv')) {
        throw new RuntimeException('PHP GD and iconv are required for preview images.', 503);
    }
    $layout = mw_share_card_layout($card);
    $image = imagecreatetruecolor(1200, $layout['height']);
    if ($image === false) throw new RuntimeException('Cannot create preview image.', 503);
    try {
        $background = imagecolorallocate($image, 17, 24, 39);
        $red = imagecolorallocate($image, 255, 75, 85);
        $white = imagecolorallocate($image, 241, 245, 249);
        $muted = imagecolorallocate($image, 170, 185, 204);
        imagefill($image, 0, 0, $background);
        imagefilledrectangle($image, 0, 0, 15, $layout['height'] - 1, $red);
        if ($loadImage !== null) {
            foreach ($layout['avatars'] as $slot) {
                try {
                    $avatar = $loadImage($slot['url'], 'avatar');
                    try {
                        mw_share_card_photo($image, $avatar, $slot['x'], $slot['y'], $slot['width'], $slot['height']);
                    } finally {
                        imagedestroy($avatar);
                    }
                } catch (RuntimeException $error) {
                    error_log('[share-avatar] Avatar omitted: ' . $error->getMessage());
                }
            }
        }
        $colors = ['red' => $red, 'white' => $white, 'muted' => $muted];
        foreach ($layout['blocks'] as $block) {
            mw_share_card_text($image, $block['text'], 55, $block['y'], $block['width'], $block['scale'], $colors[$block['color']]);
        }
        if ($loadImage !== null) {
            foreach ($layout['evidence'] as $slot) {
                try {
                    $photo = $loadImage($slot['url'], 'evidence');
                    try {
                        mw_share_card_photo($image, $photo, $slot['x'], $slot['y'], $slot['width'], $slot['height']);
                    } finally {
                        imagedestroy($photo);
                    }
                } catch (RuntimeException $error) {
                    error_log('[share-evidence] Evidence image omitted: ' . $error->getMessage());
                }
            }
        }
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
