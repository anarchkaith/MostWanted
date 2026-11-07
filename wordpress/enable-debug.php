<?php
/**
 * Habilita debug logging temporal para diagnosticar problemas con búsqueda de reportes
 * Coloca este archivo en el raíz de WordPress, accede a /enable-debug.php
 * Revisa /wp-content/debug.log para ver los logs
 */

define('MW_DEBUG_LOG_SEARCHES', true);
echo "MW_DEBUG_LOG_SEARCHES habilitado. Revisa /wp-content/debug.log después de ejecutar búsquedas.\n";
?>