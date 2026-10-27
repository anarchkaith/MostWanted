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
    $tags = [];
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
        if ($index === 6 && !empty($card['tags'])) {
            $x = 55;
            $rowHeight = 0;
            foreach ($card['tags'] as $tag) {
                $lines = mw_share_card_lines($tag, 1058, 2);
                $width = min(1090, max(array_map('strlen', $lines)) * 18 + 32);
                $height = count($lines) * 38 + 16;
                if ($x + $width > 1145) { $x = 55; $y += $rowHeight + 10; $rowHeight = 0; }
                $tags[] = ['text' => $tag, 'x' => $x, 'y' => $y, 'width' => $width, 'height' => $height];
                $x += $width + 12;
                $rowHeight = max($rowHeight, $height);
            }
            $y += $rowHeight + 18;
        }
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
        $y += 12;
        $height = max(300, min(360, 610 - $y));
        $width = (int) floor((1090 - (count($urls) - 1) * 16) / count($urls));
        foreach ($urls as $index => $url) {
            $evidence[] = ['url' => $url, 'x' => 55 + $index * ($width + 16), 'y' => $y, 'width' => $width, 'height' => $height];
        }
        $y += $height;
    }
    return ['height' => max(630, $y + 20), 'blocks' => $blocks, 'evidence' => $evidence, 'avatars' => $avatars, 'tags' => $tags];
}

function mw_share_card_photo($image, $photo, $x, $y, $boxWidth, $boxHeight, $accent) {
    $scale = min($boxWidth / imagesx($photo), $boxHeight / imagesy($photo));
    $width = max(1, (int) round(imagesx($photo) * $scale));
    $height = max(1, (int) round(imagesy($photo) * $scale));
    $left = $x + (int) (($boxWidth - $width) / 2);
    $top = $y + (int) (($boxHeight - $height) / 2);
    imagecopyresampled($image, $photo, $left, $top, 0, 0, $width, $height, imagesx($photo), imagesy($photo));
    mw_share_card_corners($image, $left - 4, $top - 4, $width + 8, $height + 8, $accent);
}

function mw_share_card_palette($risk) {
    return [
        'neutral' => [170, 185, 204],
        'low' => [74, 222, 128],
        'medium' => [241, 239, 79],
        'high' => [255, 164, 64],
        'critical' => [255, 75, 85],
    ][$risk] ?? [170, 185, 204];
}

function mw_share_card_corners($image, $x, $y, $width, $height, $color) {
    $length = min(16, (int) floor(min($width, $height) / 3));
    foreach ([[$x, $y, 1, 1], [$x + $width - 1, $y, -1, 1],
        [$x, $y + $height - 1, 1, -1], [$x + $width - 1, $y + $height - 1, -1, -1]] as [$left, $top, $dx, $dy]) {
        imageline($image, $left, $top, $left + $dx * $length, $top, $color);
        imageline($image, $left, $top, $left, $top + $dy * $length, $color);
    }
}

function mw_share_card_text($image, $text, $x, $y, $width, $scale, $color) {
    $lines = mw_share_card_lines($text, $width, $scale);
    foreach ($lines as $index => $line) {
        $layer = imagecreatetruecolor(max(1, strlen($line) * imagefontwidth(5)), imagefontheight(5));
        $background = imagecolorallocate($layer, 255, 0, 255);
        imagefill($layer, 0, 0, $background);
        imagecolortransparent($layer, $background);
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
        $background = imagecolorallocate($image, 8, 10, 12);
        $red = imagecolorallocate($image, ...mw_share_card_palette($card['risk'] ?? 'neutral'));
        $white = imagecolorallocate($image, 241, 245, 249);
        $muted = imagecolorallocate($image, 170, 185, 204);
        imagefill($image, 0, 0, $background);
        $grid = imagecolorallocate($image, 18, 22, 24);
        $detail = imagecolorallocate($image, 53, 61, 64);
        for ($x = 35; $x < 1180; $x += 40) {
            for ($y = 20; $y < $layout['height'] - 15; $y += 40) {
                imagesetpixel($image, $x, $y, $grid);
            }
        }
        mw_share_card_corners($image, 30, 15, 1140, $layout['height'] - 30, $detail);
        if ($layout['evidence']) {
            $separatorY = $layout['evidence'][0]['y'] - 12;
            imageline($image, 55, $separatorY, 1145, $separatorY, $detail);
            imageline($image, 55, $separatorY, 135, $separatorY, $red);
        }
        imagefilledpolygon($image, [30, 20, 365, 20, 390, 45, 365, 72, 30, 72], $red);
        for ($x = 405; $x < 480; $x += 25) {
            imageline($image, $x, 65, $x + 20, 35, $red);
        }
        imageline($image, 30, 90, 530, 90, $detail);
        imageline($image, 530, 90, 550, 70, $detail);
        imageline($image, 30, $layout['height'] - 25, 180, $layout['height'] - 25, $red);
        imageline($image, 180, $layout['height'] - 25, 195, $layout['height'] - 10, $red);
        if ($loadImage !== null) {
            foreach ($layout['avatars'] as $slot) {
                try {
                    $avatar = $loadImage($slot['url'], 'avatar');
                    try {
                        mw_share_card_photo($image, $avatar, $slot['x'], $slot['y'], $slot['width'], $slot['height'], $red);
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
            mw_share_card_text($image, $block['text'], 55, $block['y'], $block['width'], $block['scale'],
                $block['text'] === 'MOSTWANTED' ? $background : $colors[$block['color']]);
        }
        foreach ($layout['tags'] as $tag) {
            $x = $tag['x']; $y = $tag['y']; $right = $x + $tag['width'] - 1; $bottom = $y + $tag['height'] - 1;
            imagepolygon($image, [$x + 8, $y, $right, $y, $right, $bottom - 8, $right - 8, $bottom, $x, $bottom, $x, $y + 8], $red);
            mw_share_card_text($image, $tag['text'], $x + 16, $y + 8, $tag['width'] - 32, 2, $red);
        }
        if ($loadImage !== null) {
            foreach ($layout['evidence'] as $slot) {
                try {
                    $photo = $loadImage($slot['url'], 'evidence');
                    try {
                        mw_share_card_photo($image, $photo, $slot['x'], $slot['y'], $slot['width'], $slot['height'], $red);
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
