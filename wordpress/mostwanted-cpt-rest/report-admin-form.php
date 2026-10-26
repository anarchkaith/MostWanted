<?php
if (!defined('ABSPATH')) {
    exit;
}

function mw_report_form_catalog() {
    return [
        'GLITCHER' => ['name' => 'Glitcher', 'labels' => [
            'Abuso de bugs', 'Duplicación de objetos', 'Inmunidad a daños / Godmode por exploit',
            'Disparar a través de estructuras', 'Velocidad aumentada (speedhack)',
            'Salir de mapa / Explorar fuera de límites', 'Invencibilidad temporal (exploit)',
        ]],
        'GRIFFER' => ['name' => 'Griffer', 'labels' => [
            'Abusar de vehículos/objetos explotables', 'Spawnkill', 'Trolleo masivo (interrupción de partidas)',
            'Sabotaje de partidas', 'Raideo de servidor / invasión coordinada', 'Ataque DDoS / daño a infraestructura',
            'Spameo de bots / automatización maliciosa',
        ]],
        'MODDER' => ['name' => 'Modder', 'labels' => [
            'Godmode (hack)', 'Teleport (hack)', 'Wallhack / ESP', 'Aimbot',
            'Explosiones invisibles / efectos no autorizados', 'Spawnear objetos (manipulación de economía)',
            'Congelar jugadores (modding)', 'Kickear de la sesión (modding)', 'Flood de mensajes / spam técnico',
            'Manipulación de datos del juego (cheats avanzados)', 'Blackscreen', 'Crash',
        ]],
        'ACOSO-RAID' => ['name' => 'Acoso/Hostigamiento', 'labels' => [
            'Hostigamiento por chat', 'Mensajes de odio / discriminación', 'Acoso en redes sociales',
            'Acoso grupal / doxxing parcial', 'Amenazas fuera del juego', 'Extorsión / suplantación con fines de daño',
            'Divulgación de información privada (doxxing)', 'Phishing / ingeniería social', 'Difamación grave',
            'Multicuentas / evasión de sanciones',
        ]],
    ];
}

function mw_report_form_input($name, $label, $value = '', $type = 'text', $options = []) {
    $id = 'mw-' . preg_replace('/[^a-zA-Z0-9_-]/', '-', $name);
    echo '<div class="mw-field"><label for="' . esc_attr($id) . '">' . esc_html($label) . '</label>';
    if ($type === 'textarea') {
        echo '<textarea rows="4" id="' . esc_attr($id) . '" name="' . esc_attr($name) . '">' . esc_textarea($value) . '</textarea>';
    } elseif ($type === 'select') {
        if ($value !== '' && !array_key_exists($value, $options)) $options[$value] = $value . ' (actual)';
        echo '<select id="' . esc_attr($id) . '" name="' . esc_attr($name) . '">';
        foreach ($options as $key => $text) {
            echo '<option value="' . esc_attr($key) . '"' . (strval($key) === strval($value) ? ' selected' : '') . '>' . esc_html($text) . '</option>';
        }
        echo '</select>';
    } else {
        echo '<input id="' . esc_attr($id) . '" type="' . esc_attr($type) . '" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '"' . ($type === 'number' ? ' step="any"' : '') . '>';
    }
    echo '</div>';
}

function mw_render_report_form($post) {
    $values = mw_report_admin_values($post->ID);
    $extra = $values['extra'];
    wp_nonce_field('mw_save_report_metadata_' . $post->ID, 'mw_report_metadata_nonce');
    echo '<input type="hidden" name="mw_report_form_version" value="4"><div class="mw-report-editor">';
    echo '<p class="description">Corrige los datos del reporte y guarda con Actualizar. Las correcciones también se sincronizan con la ficha de WordPress; no modifican Social Club.</p>';
    echo '<section class="mw-section"><h3>Jugador</h3>';
    mw_report_form_input('mw_report_metadata[nickname]', 'Nombre del jugador', $values['nickname']);
    echo '</section><section class="mw-section"><h3>Datos adicionales</h3><div class="mw-grid">';
    echo '<div class="mw-field"><label for="mw-linked-rid">RID</label><input id="mw-linked-rid" value="' . esc_attr($values['rid']) . '" readonly><p class="description">Cuenta asociada al reporte.</p></div>';
    mw_report_form_input('mw_report_form[crews_text]', 'Crews', implode(', ', array_column(mw_normalize_crews_from_payload($extra), 'name')));
    echo '</div><p class="description">Separadas por coma. Vacía el campo para quitar las crews de este reporte.</p><div class="mw-field"><span class="mw-field-label">Otros nombres conocidos</span><p>' . esc_html(implode(', ', mw_aliases_from_mixed($extra['aliases'] ?? [])) ?: 'Sin otros nombres registrados.') . '</p></div></section>';
    echo '<section class="mw-section"><h3>Infracciones</h3><p class="description">Puedes elegir varias.</p><div class="mw-choices">';
    $catalog = mw_report_form_catalog();
    foreach ($catalog as $key => $group) {
        echo '<label class="mw-choice"><input type="checkbox" name="mw_report_form[types][]" value="' . esc_attr($key) . '"' . (in_array($key, $values['typesOfInfraction'], true) ? ' checked' : '') . '> ' . esc_html($group['name']) . '</label>';
    }
    foreach (array_diff($values['typesOfInfraction'], array_keys($catalog)) as $custom) {
        echo '<label class="mw-choice"><input type="checkbox" name="mw_report_form[types][]" value="' . esc_attr($custom) . '" checked> ' . esc_html($custom) . '</label>';
    }
    echo '</div></section><div class="mw-report-evidence-row"><section class="mw-section"><h3>Motivo</h3>';
    $max_length = max(500, mb_strlen($values['reason']));
    echo '<div class="mw-field"><label for="mw-reason">Motivo del reporte</label><textarea id="mw-reason" name="mw_report_metadata[reason]" rows="7" maxlength="' . $max_length . '" placeholder="Describe lo que viste: qué hizo, cuándo, en qué sesión...">' . esc_textarea($values['reason']) . '</textarea><span class="mw-reason-count" aria-live="polite">' . mb_strlen($values['reason']) . '/' . $max_length . '</span></div></section>';
    echo '<section class="mw-section"><h3>Evidencias <small>Opcional</small></h3><button type="button" class="button mw-select-media">Seleccionar o subir imágenes</button><p class="description">Máx. 5 imágenes · JPG, PNG, GIF, WEBP · 5 MB c/u. Los adjuntos históricos se conservan.</p><div class="mw-evidence-grid">';
    foreach ($values['evidence'] as $index => $item) {
        $name = mw_str($item['name'] ?? '') ?: 'Evidencia ' . ($index + 1);
        echo '<figure class="mw-evidence-card"><input type="hidden" name="mw_report_form[evidence][' . $index . '][_original]" value="' . $index . '">';
        $url = mw_str($item['url'] ?? '');
        if (preg_match('/^https?:\/\//i', $url) && strpos(mw_str($item['contentType'] ?? ''), 'image/') === 0) {
            echo '<img src="' . esc_attr($url) . '" alt="' . esc_attr($name) . '" loading="lazy" referrerpolicy="no-referrer">';
        }
        echo '<figcaption>' . esc_html($name) . '</figcaption><button type="button" class="button-link-delete mw-remove-evidence" aria-label="' . esc_attr('Quitar ' . $name) . '">Quitar</button></figure>';
    }
    echo '</div><p class="mw-media-status" role="status" aria-live="polite"></p></section></div>';
    echo '<section class="mw-section mw-behaviors"><h3>Conductas</h3>';
    $selected = array_column($values['labels'], 'label');
    $known = [];
    $id = 0;
    foreach ($catalog as $key => $group) {
        echo '<fieldset data-category="' . esc_attr($key) . '"><legend>' . esc_html($group['name']) . '</legend><div class="mw-choices">';
        foreach ($group['labels'] as $label) {
            $active_category = in_array($key, $values['typesOfInfraction'], true);
            if ($active_category) $known[] = $label;
            echo '<label class="mw-choice"><input type="checkbox" name="mw_report_form[conducts][]" value="catalog-' . ++$id . '"' . ($active_category && in_array($label, $selected, true) ? ' checked' : '') . '> ' . esc_html($label) . '</label>';
        }
        echo '</div></fieldset>';
    }
    foreach ($values['labels'] as $index => $label) {
        if (in_array($label['label'], $known, true)) continue;
        echo '<label class="mw-choice"><input type="checkbox" name="mw_report_form[conducts][]" value="legacy-' . $index . '" checked> ' . esc_html($label['label']) . ' (registrada anteriormente)</label>';
    }
    echo '<p class="mw-conduct-count" aria-live="polite"></p></section></div><input type="hidden" name="mw_report_form_complete" value="1">';
}

function mw_render_report_moderation($post) {
    echo '<div class="mw-report-editor"><p class="description">Herramientas de moderación; no forman parte del formulario de denuncia.</p>';
    mw_render_report_votes($post->ID);
    echo '</div><input type="hidden" name="mw_report_moderation_complete" value="1">';
}

function mw_prepare_web_report_form($post_id, $input, $form) {
    if (!is_array($input) || !is_array($form) || !is_string($form['crews_text'] ?? null)) {
        return new WP_Error('mw_report_metadata', 'Formulario de reporte incompleto.');
    }
    $stored = mw_report_admin_values($post_id);
    $input['rid'] = $stored['rid'];
    $input['investigation_status'] = $stored['investigation_status'];
    $input['analysis'] = wp_json_encode($stored['analysis']);
    $types = $form['types'] ?? [];
    $conducts = $form['conducts'] ?? [];
    $evidence = $form['evidence'] ?? [];
    if (!is_array($types) || !is_array($conducts) || !is_array($evidence)) {
        return new WP_Error('mw_report_metadata', 'Listas del reporte invalidas.');
    }
    $catalog = mw_report_form_catalog();
    foreach ($types as $type) {
        if (!is_string($type) || (!isset($catalog[$type]) && !in_array($type, $stored['typesOfInfraction'], true))) {
            return new WP_Error('mw_report_metadata', 'Selecciona una infraccion del formulario.');
        }
    }
    if (!$types && $stored['typesOfInfraction']) {
        return new WP_Error('mw_report_metadata', 'Selecciona al menos una infraccion.');
    }
    $input['typesOfInfraction'] = wp_json_encode(array_values(array_unique($types)));
    $labels_by_id = [];
    $id = 0;
    foreach ($catalog as $category => $group) {
        foreach ($group['labels'] as $label) {
            $entry = ['id' => ++$id, 'label' => $label, 'detail' => ''];
            foreach ($stored['labels'] as $previous) {
                if ($previous['label'] === $label) {
                    $entry = array_merge($previous, ['id' => $id]);
                    break;
                }
            }
            $labels_by_id['catalog-' . $id] = ['category' => $category, 'entry' => $entry];
        }
    }
    $labels = [];
    foreach (array_unique($conducts, SORT_REGULAR) as $selection) {
        if (!is_string($selection)) return new WP_Error('mw_report_metadata', 'Conducta invalida.');
        if (isset($labels_by_id[$selection])) {
            if (!in_array($labels_by_id[$selection]['category'], $types, true)) {
                return new WP_Error('mw_report_metadata', 'La conducta no corresponde a las infracciones seleccionadas.');
            }
            $labels[] = $labels_by_id[$selection]['entry'];
        } elseif (preg_match('/^legacy-([0-9]+)$/D', $selection, $match) && isset($stored['labels'][intval($match[1])])) {
            $labels[] = $stored['labels'][intval($match[1])];
        } else return new WP_Error('mw_report_metadata', 'Selecciona una conducta registrada.');
    }
    $input['labels'] = wp_json_encode($labels);
    $extra = $stored['extra'];
    $existing_crews = mw_normalize_crews_from_payload($extra);
    $crews = [];
    foreach (preg_split('/[,;|\r\n]+/', $form['crews_text'], -1, PREG_SPLIT_NO_EMPTY) as $name) {
        $name = sanitize_text_field($name);
        if ($name === '') continue;
        $match = null;
        foreach ($existing_crews as $crew) {
            if (mb_strtolower($crew['name']) === mb_strtolower($name)) { $match = $crew; break; }
        }
        $crews[] = $match !== null ? array_merge($match, ['name' => $name]) : ['name' => $name, 'url' => ''];
    }
    $extra['crews'] = mw_normalize_crews_from_payload(['crews' => $crews]);
    if (isset($extra['username'])) $extra['username'] = $input['nickname'] ?? $extra['username'];
    $input['extra'] = wp_json_encode((object) $extra);
    $items = [];
    $seen = [];
    foreach ($evidence as $row) {
        if (!is_array($row)) return new WP_Error('mw_report_metadata', 'Evidencia invalida.');
        if (isset($row['_original']) && is_string($row['_original']) && ctype_digit($row['_original'])) {
            $original = intval($row['_original']);
            if (!isset($stored['evidence'][$original]) || isset($seen['old-' . $original])) {
                return new WP_Error('mw_report_metadata', 'Referencia de evidencia invalida o duplicada.');
            }
            $items[] = $stored['evidence'][$original];
            $seen['old-' . $original] = true;
        } elseif (isset($row['attachment_id']) && is_string($row['attachment_id']) && ctype_digit($row['attachment_id'])) {
            $attachment_id = intval($row['attachment_id']);
            if (!current_user_can('upload_files') || !current_user_can('read_post', $attachment_id)) {
                return new WP_Error('mw_report_metadata', 'No tienes permiso para usar el archivo seleccionado.');
            }
            $mime = get_post_mime_type($attachment_id);
            $path = get_attached_file($attachment_id);
            $size = $path && is_file($path) ? filesize($path) : false;
            if (!in_array($mime, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true) || $size === false || $size > 5 * 1024 * 1024) {
                return new WP_Error('mw_report_metadata', 'Selecciona imagenes JPG, PNG, GIF o WEBP de hasta 5 MB.');
            }
            if (isset($seen['media-' . $attachment_id])) return new WP_Error('mw_report_metadata', 'Imagen duplicada.');
            $seen['media-' . $attachment_id] = true;
            $items[] = ['url' => wp_get_attachment_url($attachment_id), 'name' => get_the_title($attachment_id), 'contentType' => $mime, 'size' => $size];
        } else return new WP_Error('mw_report_metadata', 'Selecciona una imagen valida de la biblioteca.');
    }
    if (count($items) > max(5, count($stored['evidence']))) {
        return new WP_Error('mw_report_metadata', 'Maximo 5 imagenes; no se pueden agregar mas a un reporte historico que ya supera el limite.');
    }
    $input['evidence'] = wp_json_encode($items);
    $reason = $input['reason'] ?? null;
    if (!is_string($reason) || mb_strlen($reason) > max(500, mb_strlen($stored['reason']))) {
        return new WP_Error('mw_report_metadata', 'El motivo supera el limite de 500 caracteres o el largo historico del reporte.');
    }
    if ($reason !== $stored['reason'] && mb_strlen(trim($reason)) < 10) {
        return new WP_Error('mw_report_metadata', 'El motivo debe tener al menos 10 caracteres.');
    }
    return $input;
}

function mw_report_analysis_fields() {
    return [
        'summary' => 'Resumen', 'recommendation' => 'Recomendación', 'reason' => 'Fundamento',
        'operationalRecommendation' => 'Recomendación operativa', 'tacticalDirective' => 'Directiva táctica',
        'threatLevel' => 'Nivel de amenaza', 'corruptionReason' => 'Motivo de corrupción',
        'confidence' => 'Confianza', 'corruptionPercent' => 'Porcentaje de corrupción',
    ];
}

function mw_prepare_report_form($post_id, $input, $form) {
    if (!is_array($input) || !is_array($form)) return new WP_Error('mw_report_metadata', 'Formulario de reporte invalido.');
    $stored = mw_report_admin_values($post_id);
    $extra = $stored['extra'];
    foreach (['aliases', 'custom_type', 'anonymous'] as $key) {
        if (!is_string($form[$key] ?? null)) return new WP_Error('mw_report_metadata', 'Falta un campo del formulario: ' . $key);
    }
    $types = $form['types'] ?? [];
    if (!is_array($types)) return new WP_Error('mw_report_metadata', 'Infracciones invalidas.');
    if (trim($form['custom_type']) !== '') $types[] = sanitize_text_field($form['custom_type']);
    $input['typesOfInfraction'] = wp_json_encode(array_values(array_unique($types, SORT_REGULAR)));
    $extra['aliases'] = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $form['aliases']))));
    foreach (['labels', 'evidence', 'crews'] as $kind) {
        $rows = $form[$kind] ?? [];
        if (!is_array($rows)) return new WP_Error('mw_report_metadata', 'Lista de reporte invalida.');
        $originals = $kind === 'crews' ? ($extra['crews'] ?? []) : $stored[$kind];
        $next = [];
        foreach ($rows as $row) {
            if (!is_array($row)) return new WP_Error('mw_report_metadata', 'Fila de reporte invalida.');
            $original = $row['_original'] ?? '';
            if (!is_string($original) || ($original !== '' && !ctype_digit($original))) return new WP_Error('mw_report_metadata', 'Referencia de fila invalida.');
            $value = $original !== '' && is_array($originals) && is_array($originals[intval($original)] ?? null) ? $originals[intval($original)] : [];
            $keys = $kind === 'labels' ? ['label', 'detail', 'id'] : ($kind === 'evidence' ? ['url', 'name', 'contentType'] : ['name', 'url']);
            foreach ($keys as $key) {
                if (!is_string($row[$key] ?? null)) return new WP_Error('mw_report_metadata', 'Falta un dato en ' . $kind . '.');
                $value[$key] = $key === 'detail' ? sanitize_textarea_field($row[$key]) : sanitize_text_field($row[$key]);
            }
            if ($kind === 'labels') {
                if ($value['id'] !== '' && (!ctype_digit($value['id']) || intval($value['id']) <= 0)) return new WP_Error('mw_report_metadata', 'Identificador de conducta invalido.');
                $value['id'] = $value['id'] === '' ? null : intval($value['id']);
                if (!isset($originals[intval($original)]['label']) || $original === '' || $value['label'] !== $originals[intval($original)]['label']) {
                    $value['id'] = null;
                    $catalog_id = 0;
                    foreach (mw_report_form_catalog() as $group) {
                        foreach ($group['labels'] as $catalog_label) {
                            $catalog_id++;
                            if (mb_strtolower($catalog_label) === mb_strtolower($value['label'])) $value['id'] = $catalog_id;
                        }
                    }
                }
            }
            if ($kind === 'evidence' && $value['contentType'] === '') {
                $file = wp_check_filetype(parse_url($value['url'], PHP_URL_PATH) ?? '');
                $value['contentType'] = $file['type'] ?: '';
            }
            if ($kind === 'crews' && ($value['name'] === '' || ($value['url'] !== '' && !wp_http_validate_url($value['url'])))) return new WP_Error('mw_report_metadata', 'Cada crew necesita un nombre y un enlace valido (opcional).');
            $next[] = $value;
        }
        if ($kind === 'crews') $extra[$kind] = $next;
        else $input[$kind] = wp_json_encode($next);
    }
    foreach (['avatar1', 'avatar2', 'time', 'source', 'severity', 'validation'] as $key) {
        $value = $form['extra'][$key] ?? null;
        if (!is_string($value)) return new WP_Error('mw_report_metadata', 'Falta un dato adicional.');
        $value = sanitize_text_field($value);
        if (strpos($key, 'avatar') === 0 && $value !== '' && !wp_http_validate_url($value)) return new WP_Error('mw_report_metadata', 'El avatar debe ser una URL HTTP/HTTPS valida.');
        if ($key === 'time' && strval($extra[$key] ?? '') === $value) continue;
        if ($value === '') unset($extra[$key]);
        else $extra[$key] = $value;
        $legacy = $key === 'severity' ? 'severidad' : ($key === 'validation' ? 'validacion' : '');
        if ($legacy !== '' && array_key_exists($legacy, $extra)) {
            if ($value === '') unset($extra[$legacy]);
            else $extra[$legacy] = $value;
        }
    }
    if (!in_array($form['anonymous'], ['0', '1'], true)) return new WP_Error('mw_report_metadata', 'Valor de anonimato invalido.');
    if (array_key_exists('anonymous', $extra) || $form['anonymous'] === '1') $extra['anonymous'] = $form['anonymous'] === '1';
    if (isset($extra['username'])) $extra['username'] = $input['nickname'] ?? $extra['username'];
    $input['extra'] = wp_json_encode((object) $extra);
    $analysis = $stored['analysis'];
    foreach (mw_report_analysis_fields() as $key => $label) {
        $value = $form['analysis'][$key] ?? null;
        if (!is_string($value)) return new WP_Error('mw_report_metadata', 'Falta un campo de analisis.');
        // Preserve historical values not representable by these scalar controls.
        if (isset($analysis[$key]) && !is_scalar($analysis[$key]) && $value === '') continue;
        if (trim($value) === '') unset($analysis[$key]);
        elseif (in_array($key, ['confidence', 'corruptionPercent'], true)) {
            if (!is_numeric($value) || !is_finite(floatval($value))) return new WP_Error('mw_report_metadata', 'El analisis necesita un valor numerico en ' . $label . '.');
            $analysis[$key] = $value + 0;
        } else $analysis[$key] = sanitize_textarea_field($value);
    }
    $input['analysis'] = wp_json_encode($analysis);
    return $input;
}
