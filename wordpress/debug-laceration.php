<?php
/**
 * Script temporal de diagnóstico para investigar reportes de Laceration_VI
 * Coloca este archivo en el raíz de WordPress, accede a /debug-laceration.php
 * Luego elimina el archivo.
 */

// Cargar WordPress
require_once __DIR__ . '/wp-load.php';

if (!function_exists('mw_map_report_item')) {
    require_once __DIR__ . '/wp-content/plugins/mostwanted-cpt-rest/mostwanted-cpt-rest.php';
}

echo "<h1>Diagnóstico de Reportes: Laceration_VI</h1>";

// Función auxiliar de normalización (copiada de mostwanted-cpt-rest.php)
function mw_search_normalize($text) {
    $text = remove_accents(trim((string) $text));
    return function_exists('mb_strtolower') ? mb_strtolower($text, 'UTF-8') : strtolower($text);
}

function mw_str($value) {
    return is_string($value) ? trim($value) : '';
}

// 1. Buscar todos los reportes con "Laceration" en el título
echo "<h2>Reportes en la base de datos con 'Laceration' en el título</h2>";
$posts = get_posts([
    'post_type' => 'mw_report',
    'post_status' => 'publish',
    'numberposts' => -1,
    'fields' => 'ids',
]);

$laceration_reports = [];
foreach ($posts as $post_id) {
    $post = get_post($post_id);
    if (stripos($post->post_title, 'Laceration') !== false) {
        $laceration_reports[] = [
            'id' => $post_id,
            'title' => $post->post_title,
        ];
    }
}

echo "<pre>";
echo "Total de reportes encontrados: " . count($laceration_reports) . "\n";
foreach ($laceration_reports as $report) {
    echo "ID: {$report['id']}, Título: {$report['title']}\n";
}
echo "</pre>";

// 2. Intentar procesar cada uno como lo hace mw_rest_reports_list
echo "<h2>Procesando reportes como mw_rest_reports_list</h2>";
$search_nickname = 'Laceration_VI';
$target_normalized = mw_search_normalize($search_nickname);

echo "<pre>";
echo "Buscando nickname: '{$search_nickname}' (normalizado: '{$target_normalized}')\n\n";

$filtered = [];
$query_args = [
    'post_type' => 'mw_report',
    'post_status' => 'publish',
    'numberposts' => -1,
    'offset' => 0,
    'orderby' => 'date',
    'order' => 'DESC',
    'fields' => 'ids',
];

$all_posts = get_posts($query_args);
echo "Total de reportes en la DB: " . count($all_posts) . "\n\n";

foreach ($all_posts as $post_id) {
    $item = mw_map_report_item(intval($post_id));
    $item_nickname = mw_str($item['nickname'] ?? '');
    $item_nickname_normalized = mw_search_normalize($item_nickname);
    
    if ($item_nickname_normalized === $target_normalized) {
        $filtered[] = $item;
        echo "✓ COINCIDIR: ID={$item['id']}, Nickname='{$item_nickname}' (normalizado: '{$item_nickname_normalized}')\n";
    }
}

echo "\nTotal encontrado: " . count($filtered) . "\n";

foreach ($filtered as $report) {
    echo "\nReporte ID {$report['id']}:\n";
    echo "  - Nickname: {$report['nickname']}\n";
    echo "  - RID: {$report['rid']}\n";
    echo "  - Categorías: " . implode(', ', $report['categories'] ?? []) . "\n";
    echo "  - Contenido: " . substr($report['content'] ?? '', 0, 100) . "...\n";
}

echo "</pre>";

// 3. Mostrar número total de reportes
echo "<h2>Resumen General</h2>";
echo "<pre>";
$total_reports = count(get_posts(['post_type' => 'mw_report', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids']));
echo "Total de reportes en la DB: {$total_reports}\n";
echo "Reportes de Laceration_VI encontrados: " . count($filtered) . "\n";
echo "</pre>";

// Verificación de salud de la base de datos
echo "<h2>Verificación de integridad</h2>";
echo "<pre>";
$sample_id = reset($all_posts);
if ($sample_id) {
    $sample = mw_map_report_item($sample_id);
    echo "Reporte de muestra (ID: {$sample_id}):\n";
    echo "  - Nickname: {$sample['nickname']}\n";
    echo "  - RID: {$sample['rid']}\n";
    echo "  - Título post: " . get_the_title($sample_id) . "\n";
}
echo "</pre>";
?>