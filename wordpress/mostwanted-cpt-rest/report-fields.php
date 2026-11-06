<?php
if (!defined('ABSPATH')) exit;

function mw_report_template_fields() {
    $fields = [
        'id' => ['label' => 'ID del reporte', 'type' => 'number'],
        'nickname' => ['label' => 'Nombre del jugador', 'type' => 'text'],
        'rid' => ['label' => 'RID (Rockstar ID)', 'type' => 'text'],
        'aliases' => ['label' => 'Otros nombres registrados', 'type' => 'textarea'],
        'created_at' => ['label' => 'Fecha del reporte', 'type' => 'text'],
        'reason' => ['label' => 'Motivo del reporte', 'type' => 'textarea'],
        'infractions' => ['label' => 'Infracciones', 'type' => 'textarea'],
        'labels' => ['label' => 'Etiquetas', 'type' => 'textarea'],
        'label_details' => ['label' => 'Etiquetas con detalles', 'type' => 'textarea'],
        'crews' => ['label' => 'Crews registradas', 'type' => 'textarea'],
        'crew_urls' => ['label' => 'Enlaces de crews', 'type' => 'textarea'],
        'avatar_1' => ['label' => 'Avatar 1 (URL externa)', 'type' => 'url', 'image' => true],
        'avatar_2' => ['label' => 'Avatar 2 (URL externa)', 'type' => 'url', 'image' => true],
        'evidence_count' => ['label' => 'Cantidad de evidencias', 'type' => 'number'],
        'evidence_urls' => ['label' => 'Todas las evidencias (URLs)', 'type' => 'textarea'],
        'evidence_details' => ['label' => 'Evidencias con nombres y tipos', 'type' => 'textarea'],
        'analysis' => ['label' => 'Resumen del analisis guardado', 'type' => 'textarea'],
        'votes_up' => ['label' => 'Votos verdadero', 'type' => 'number'],
        'votes_down' => ['label' => 'Votos falso', 'type' => 'number'],
        'vote_feedback' => ['label' => 'Motivos publicos de votos falso', 'type' => 'textarea'],
    ];
    for ($index = 1; $index <= 5; $index++) {
        $fields['evidence_' . $index] = ['label' => 'Evidencia ' . $index . ' (URL externa)', 'type' => 'url', 'image' => true];
    }
    return $fields;
}

function mw_report_template_values($post_id) {
    $report = mw_map_report_item($post_id);
    $analysis = mw_report_admin_values($post_id)['analysis'];
    $labels = [];
    $details = [];
    foreach ($report['labels'] as $label) {
        $name = mw_str($label['label'] ?? '');
        if ($name === '') continue;
        $labels[] = $name;
        $detail = mw_str($label['detail'] ?? '');
        $details[] = $name . ($detail !== '' ? ': ' . $detail : '');
    }
    $evidence_urls = [];
    $evidence_details = [];
    foreach ($report['evidence'] as $item) {
        $url = mw_str($item['url'] ?? '');
        if ($url === '') continue;
        $evidence_urls[] = $url;
        $evidence_details[] = implode(' | ', array_filter([
            mw_str($item['name'] ?? ''), mw_str($item['contentType'] ?? ''), $url,
        ], static function ($value) { return $value !== ''; }));
    }
    $values = [
        'id' => intval($report['id']),
        'nickname' => $report['nickname'],
        'rid' => $report['rid'],
        'aliases' => implode("\n", $report['aliases']),
        'created_at' => $report['createdAt'],
        'reason' => $report['content'],
        'infractions' => implode("\n", mw_unique_strings($report['categories'])),
        'labels' => implode("\n", $labels),
        'label_details' => implode("\n", $details),
        'crews' => implode("\n", array_column($report['crews'], 'name')),
        'crew_urls' => implode("\n", array_filter(array_column($report['crews'], 'url'))),
        'avatar_1' => mw_str($report['avatar1'] ?? ''),
        'avatar_2' => mw_str($report['avatar2'] ?? ''),
        'evidence_count' => count($report['evidence']),
        'evidence_urls' => implode("\n", $evidence_urls),
        'evidence_details' => implode("\n", $evidence_details),
        'analysis' => mw_str($analysis['summary'] ?? ''),
        'votes_up' => intval($report['communityVerification']['up']),
        'votes_down' => intval($report['communityVerification']['down']),
        'vote_feedback' => implode("\n", array_column($report['communityVerification']['confirmations'], 'reason')),
    ];
    for ($index = 1; $index <= 5; $index++) {
        $values['evidence_' . $index] = mw_str($report['evidence'][$index - 1]['url'] ?? '');
    }
    return $values;
}

function mw_register_report_acf_fields() {
    if (!function_exists('acf_add_local_field_group')) return;
    $fields = [];
    foreach (mw_report_template_fields() as $name => $definition) {
        $fields[] = [
            'key' => 'field_mw_report_' . $name,
            'name' => 'mw_report_' . $name,
            'label' => $definition['label'],
            'type' => $definition['type'],
            'instructions' => 'Solo lectura. Se actualiza desde MostWanted, tambien en reportes historicos.',
            'readonly' => 1,
            'disabled' => 1,
            'required' => 0,
            'new_lines' => '',
        ];
    }
    acf_add_local_field_group([
        'key' => 'group_mw_report_readonly',
        'title' => 'MostWanted - Campos del reporte (solo lectura)',
        'fields' => $fields,
        'location' => [[['param' => 'post_type', 'operator' => '==', 'value' => 'mw_report']]],
        'position' => 'normal',
        'active' => true,
        'show_in_rest' => 0,
    ]);
}
add_action('acf/init', 'mw_register_report_acf_fields');

function mw_report_acf_field_name($field) {
    foreach (mw_report_template_fields() as $name => $definition) {
        if (($field['key'] ?? '') === 'field_mw_report_' . $name) return $name;
    }
    return null;
}

function mw_report_acf_post_id($post_id) {
    if (!is_numeric($post_id) || intval($post_id) <= 0) return 0;
    $post = get_post(intval($post_id));
    return $post && $post->post_type === 'mw_report' ? intval($post_id) : 0;
}

function mw_report_acf_reference($reference, $name, $post_id) {
    if (mw_report_acf_post_id($post_id)) {
        foreach (mw_report_template_fields() as $suffix => $definition) {
            if ($name === 'mw_report_' . $suffix) return 'field_' . $name;
        }
    }
    return $reference;
}
add_filter('acf/pre_load_reference', 'mw_report_acf_reference', 10, 3);

function mw_report_acf_value($value, $post_id, $field) {
    $name = mw_report_acf_field_name($field);
    if ($name === null) return $value;
    $id = mw_report_acf_post_id($post_id);
    if (!$id || !is_user_logged_in()) return '';
    // Read before ACF's value cache: edits and session changes must be visible immediately.
    return mw_report_template_values($id)[$name];
}
add_filter('acf/pre_load_value', 'mw_report_acf_value', 10, 3);

function mw_report_acf_prepare($field) {
    if (mw_report_acf_field_name($field) !== null) {
        $field['readonly'] = 1;
        $field['disabled'] = 1;
    }
    return $field;
}
add_filter('acf/prepare_field', 'mw_report_acf_prepare');

function mw_report_acf_prevent_update($check, $value, $post_id, $field) {
    if (mw_report_acf_field_name($field) !== null) return false;
    return $check;
}
add_filter('acf/pre_update_value', 'mw_report_acf_prevent_update', 10, 4);

function mw_report_elementor_image($post_id, $name) {
    $fields = mw_report_template_fields();
    if (!mw_report_acf_post_id($post_id) || !is_user_logged_in() || empty($fields[$name]['image'])) return [];
    $url = mw_report_template_values($post_id)[$name];
    if (!wp_http_validate_url($url)) return [];
    if (preg_match('/^evidence_([1-5])$/D', $name, $matches)) {
        $report = mw_map_report_item($post_id);
        $item = $report['evidence'][intval($matches[1]) - 1] ?? [];
        $mime = mw_str($item['contentType'] ?? '');
        if ($mime !== '' ? strpos($mime, 'image/') !== 0 : !preg_match('/\.(png|jpe?g|gif|webp|avif)$/i', parse_url($url, PHP_URL_PATH) ?? '')) return [];
    }
    return ['id' => 0, 'url' => $url];
}

add_action('elementor/dynamic_tags/register', static function ($manager) {
    $manager->register_group('mostwanted', ['title' => 'MostWanted']);
    $manager->register(new class extends \Elementor\Core\DynamicTags\Data_Tag {
        public function get_name() { return 'mostwanted-report-image'; }
        public function get_title() { return 'MostWanted - Imagen del reporte'; }
        public function get_group() { return ['mostwanted']; }
        public function get_categories() { return [\Elementor\Modules\DynamicTags\Module::IMAGE_CATEGORY]; }
        protected function register_controls() {
            $options = [];
            foreach (mw_report_template_fields() as $name => $field) {
                if (!empty($field['image'])) $options[$name] = $field['label'];
            }
            $this->add_control('field', [
                'label' => 'Campo del reporte', 'type' => \Elementor\Controls_Manager::SELECT,
                'options' => $options, 'default' => 'avatar_1',
            ]);
        }
        public function get_value(array $options = []) {
            return mw_report_elementor_image(get_the_ID(), $this->get_settings('field'));
        }
    });
});
