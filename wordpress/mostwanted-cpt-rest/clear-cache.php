<?php
// Emergency cache clear - call this to force PHP to reload the plugin

// Clear OPcache if available
if (function_exists('opcache_reset')) {
    opcache_reset();
    echo "✓ OPcache cleared\n";
} else {
    echo "✗ OPcache not available\n";
}

// Disable OPcache for this file
if (!ini_get('opcache.enable')) {
    echo "✓ OPcache already disabled\n";
} else {
    echo "! OPcache is enabled, consider disabling or clearing from panel\n";
}

// Invalidate object cache if using persistent cache
if (function_exists('wp_cache_flush')) {
    wp_cache_flush();
    echo "✓ WordPress object cache cleared\n";
}

echo "\nCache clear attempted. Redeploy or restart PHP-FPM to apply changes.\n";
?>
