-- ============================================================================
-- RESET DE IDs DE REPORTES EN WORDPRESS
-- ============================================================================
-- Este script reajusta los IDs de los reportes custom post type (mw_report)
-- para que sean secuenciales desde 1.
--
-- IMPORTANTE: 
-- 1. Hacer un BACKUP de la BD antes de ejecutar
-- 2. Este script solo funciona si es la ÚNICA vez que se ejecuta
-- 3. Ejecutar en phpMyAdmin o línea de comandos MySQL
-- 4. Reemplazar "mostwanted" con el nombre real de la BD si es diferente
-- ============================================================================

-- Paso 1: Ver cuántos reportes existen
SELECT COUNT(*) as total_reportes FROM wp_posts WHERE post_type = 'mw_report' AND post_status = 'publish';

-- Paso 2: Crear tabla temporal con los reportes ordenados
CREATE TEMPORARY TABLE temp_reports AS
SELECT ID, ROW_NUMBER() OVER (ORDER BY post_date ASC) as new_id
FROM wp_posts
WHERE post_type = 'mw_report' AND post_status = 'publish'
ORDER BY post_date ASC;

-- Paso 3: Desactivar restricciones de integridad referencial
SET FOREIGN_KEY_CHECKS = 0;

-- Paso 4: Crear tabla de mapeo de IDs antiguos a nuevos
CREATE TEMPORARY TABLE id_mapping AS
SELECT old_id, new_id FROM (
  SELECT ID as old_id, ROW_NUMBER() OVER (ORDER BY post_date ASC) as new_id
  FROM wp_posts
  WHERE post_type = 'mw_report' AND post_status = 'publish'
) mapping;

-- Paso 5: Reaj ustar auto_increment (start from next available ID)
-- Primero reducir a 1 temporalmente
ALTER TABLE wp_posts AUTO_INCREMENT = 1;

-- Paso 6: Actualizar IDs en wp_posts
-- NOTA: Este es el paso crítico. WordPress asigna IDs automáticamente,
-- así que usamos UPDATE con INNER JOIN para mapear cada post al nuevo ID

-- Crear lista de cambios que necesitamos hacer (veremos en el SELECT)
SELECT 
  p.ID as old_id,
  ROW_NUMBER() OVER (ORDER BY p.post_date ASC) as new_id,
  p.post_title
FROM wp_posts p
WHERE p.post_type = 'mw_report' AND p.post_status = 'publish'
ORDER BY p.post_date ASC;

-- Paso 7: (ALTERNATIVA) Si usamos un enfoque más seguro con nueva tabla:
-- Crear tabla auxiliar con datos completos
CREATE TEMPORARY TABLE posts_backup AS
SELECT * FROM wp_posts WHERE post_type = 'mw_report';

-- Paso 8: Eliminar los reportes actuales (pero guardar en backup)
-- DELETE FROM wp_posts WHERE post_type = 'mw_report' AND post_status = 'publish';

-- Paso 9: Recrear con IDs secuenciales
-- INSERT INTO wp_posts (...) SELECT (...) FROM posts_backup ORDER BY post_date ASC;

-- APPROACH RECOMENDADO (más seguro):
-- 1. Exportar reportes a CSV con plugin "WP All Export"
-- 2. Eliminar todos los posts mw_report
-- 3. Re-importar con "WP All Import" que asignará nuevos IDs
-- 4. Verificar que los metadatos se mantienen

-- Reactivar restricciones
SET FOREIGN_KEY_CHECKS = 1;

-- Verificar resultado
SELECT COUNT(*) as total_after FROM wp_posts WHERE post_type = 'mw_report' AND post_status = 'publish';
SELECT ID, post_title, post_date FROM wp_posts WHERE post_type = 'mw_report' ORDER BY ID LIMIT 10;

-- ============================================================================
-- RESUMEN DE PASOS RECOMENDADOS (MÁS SEGURO):
-- ============================================================================
-- 1. En WordPress admin → Herramientas → Exportar
--    Exportar solo posts de tipo "mw_report" a XML
--
-- 2. BD → Tabla wp_posts → Filtrar post_type = 'mw_report'
--    DELETE FROM wp_posts WHERE post_type = 'mw_report';
--
-- 3. BD → Resetear auto_increment:
--    ALTER TABLE wp_posts AUTO_INCREMENT = 1;
--
-- 4. WordPress admin → Herramientas → Importar
--    Re-importar el XML. WordPress asignará nuevos IDs secuencialmente
--
-- 5. Verificar en wp-admin que los reportes aparezcan con IDs 1, 2, 3...
-- ============================================================================
