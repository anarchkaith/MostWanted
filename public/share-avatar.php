<?php

function mw_share_avatar_bytes($url, $maxBytes = 2 * 1024 * 1024) {
    $parts = parse_url($url);
    $host = strtolower($parts['host'] ?? '');
    $allowed = ['prod.cloud.rockstargames.com', 'i.ibb.co', 'mostwanted.kaithsrebels.com', 'kaithsrebels.com'];
    if (($parts['scheme'] ?? '') !== 'https' || !in_array($host, $allowed, true)
        || isset($parts['user']) || isset($parts['pass']) || (isset($parts['port']) && $parts['port'] !== 443)) {
        throw new RuntimeException('Avatar host is not supported.', 502);
    }
    if (!function_exists('curl_init')) throw new RuntimeException('PHP cURL is required for avatars.', 503);
    $addresses = dns_get_record($host, DNS_A);
    if (!$addresses) throw new RuntimeException('Cannot resolve avatar host.', 502);
    foreach ($addresses as $address) {
        if (!filter_var($address['ip'] ?? '', FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            throw new RuntimeException('Avatar host resolved to a non-public address.', 502);
        }
    }
    $handle = curl_init($url);
    $bytes = '';
    curl_setopt_array($handle, [
        CURLOPT_RESOLVE => [$host . ':443:' . $addresses[0]['ip']],
        CURLOPT_PROXY => '',
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 4,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_WRITEFUNCTION => static function ($handle, $chunk) use (&$bytes, $maxBytes) {
            if (strlen($bytes) + strlen($chunk) > $maxBytes) return 0;
            $bytes .= $chunk;
            return strlen($chunk);
        },
    ]);
    $ok = curl_exec($handle);
    $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $error = curl_error($handle);
    curl_close($handle);
    if ($ok === false || $status !== 200) throw new RuntimeException('Avatar download failed: ' . $status . ' ' . $error, 502);
    return $bytes;
}

function mw_share_avatar_image($bytes, $maxDimension = 2048, $maxPixels = 4 * 1024 * 1024) {
    $size = @getimagesizefromstring($bytes);
    if (!$size || !in_array($size['mime'], ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], true)
        || $size[0] > $maxDimension || $size[1] > $maxDimension || $size[0] * $size[1] > $maxPixels) {
        throw new RuntimeException('Unsupported preview image or dimensions.', 502);
    }
    $image = @imagecreatefromstring($bytes);
    if ($image === false) throw new RuntimeException('Cannot decode avatar image.', 502);
    return $image;
}
