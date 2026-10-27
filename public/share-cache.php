<?php

function mw_share_cached($key, callable $generate, $revision = null) {
    $directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'mostwanted-previews-' . substr(hash('sha256', __DIR__), 0, 16);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Cannot create preview cache directory.', 503);
    }
    $file = $directory . DIRECTORY_SEPARATOR . hash('sha256', $key) . '.cache';
    $handle = fopen($file, 'c+b');
    if ($handle === false) throw new RuntimeException('Cannot open preview cache.', 503);
    try {
        if (!flock($handle, LOCK_EX)) throw new RuntimeException('Cannot lock preview cache.', 503);
        $cached = stream_get_contents($handle);
        if ($cached !== '') {
            $entry = json_decode($cached, true);
            if (!is_array($entry) || !isset($entry['expires'], $entry['value'])) {
                throw new RuntimeException('Invalid preview cache entry.', 503);
            }
            if ($entry['expires'] > time() && ($entry['revision'] ?? null) === $revision) return $entry['value'];
        }
        $value = $generate();
        $encoded = json_encode(['expires' => time() + 300, 'revision' => $revision, 'value' => $value], JSON_THROW_ON_ERROR);
        if (!ftruncate($handle, 0) || !rewind($handle) || fwrite($handle, $encoded) !== strlen($encoded) || !fflush($handle)) {
            throw new RuntimeException('Cannot persist preview cache.', 503);
        }
        return $value;
    } finally {
        fclose($handle);
    }
}

function mw_share_cached_fetch($endpoint) {
    $namespace = (getenv('WORDPRESS_API_BASE_URL') ?: 'https://kaithsrebels.com') . ':' . filemtime(__DIR__ . DIRECTORY_SEPARATOR . 'share-metadata.php');
    return mw_share_cached('source:' . $namespace . ':' . $endpoint, static function () use ($endpoint) {
        $data = mw_share_fetch($endpoint);
        if (($data['ok'] ?? null) !== true) throw new RuntimeException('Invalid WordPress cache source.', 502);
        if (($data['found'] ?? null) === false) throw new RuntimeException('Shared player not found.', 404);
        return $data;
    });
}
