# 🔄 Reajuste de IDs de Reportes en WordPress

**Problema:** Los IDs de reportes muestran números altos (#7128) aunque hay pocos reportes. Esto ocurre porque WordPress usa `AUTO_INCREMENT` en la tabla de posts, y cuando se eliminan registros, los IDs dejan "huecos".

**Solución:** Reajustar los IDs para que sean secuenciales desde 1.

## ⚠️ Requisitos Previos

- ✅ **BACKUP DE LA BD** (CRÍTICO - hacer primero)
- Acceso a WordPress Admin (`/wp-admin/`)
- Acceso a phpMyAdmin o línea de comandos MySQL
- Los reportes deben estar editables (sin restricciones de permisos)

## 🛠️ Opción 1: Mediante WordPress (RECOMENDADO - Más Seguro)

### Paso 1: Exportar reportes
1. Ir a **WordPress Admin** → **Herramientas** → **Exportar**
2. Seleccionar **Tipo de contenido:** `mw_report` (custom post type de reportes)
3. Hacer clic en **Descargar archivo de exportación**
   - Se descargará un archivo XML con todos los reportes

### Paso 2: Limpiar BD (eliminar reportes antiguos)
1. Ir a **phpMyAdmin** o **MySQL CLI**
2. Seleccionar la BD de WordPress (ej: `mostwanted`)
3. Ejecutar este comando SQL:

```sql
-- Verificar cuántos reportes hay
SELECT COUNT(*) as total_reportes 
FROM wp_posts 
WHERE post_type = 'mw_report' AND post_status = 'publish';

-- Eliminar todos los reportes (BACKUP PRIMERO)
DELETE FROM wp_posts 
WHERE post_type = 'mw_report' AND post_status = 'publish';

-- Resetear contador de AUTO_INCREMENT
ALTER TABLE wp_posts AUTO_INCREMENT = 1;
```

**⚠️ IMPORTANTE:** Ejecutar primero el SELECT para verificar cuántos reportes se eliminarán.

### Paso 3: Re-importar reportes con nuevos IDs
1. Ir a **WordPress Admin** → **Herramientas** → **Importar**
2. Si pide instalar plugin "WordPress Importer", instalarlo
3. Seleccionar el archivo XML descargado en **Paso 1**
4. Hacer clic en **Subir archivo e importar**
5. Seleccionar usuario propietario (ej: Admin)
6. Los reportes se re-crearán con IDs secuenciales (1, 2, 3...)

### Paso 4: Verificar
1. Ir a WordPress Admin → Posts (o custom post type de reportes)
2. Ver que los IDs sean 1, 2, 3, etc.
3. En la plataforma web, verificar que los reportes muestren `#1`, `#2`, `#3`

---

## 🔧 Opción 2: Mediante SQL Directo (MÁS RÁPIDO - Requiere Cuidado)

### Paso 1: Backup
```bash
# En línea de comandos del servidor
mysqldump -u root -p mostwanted > mostwanted_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Paso 2: Crear tabla auxiliar con reportes renumerados
```sql
-- Conectarse a la BD
USE mostwanted;

-- 1. Ver estructura actual
SELECT ID, post_title, post_date 
FROM wp_posts 
WHERE post_type = 'mw_report' AND post_status = 'publish' 
ORDER BY post_date ASC 
LIMIT 5;

-- 2. Crear tabla temporal con nuevo mapeo
CREATE TEMPORARY TABLE report_renumber AS
SELECT 
  @row:=@row+1 as new_id,
  ID as old_id,
  post_title,
  post_date
FROM wp_posts, (SELECT @row:=0) r
WHERE post_type = 'mw_report' AND post_status = 'publish'
ORDER BY post_date ASC;

-- 3. Verificar mapeo
SELECT * FROM report_renumber LIMIT 5;

-- 4. Actualizar tabla wp_posts (PUNTO DE NO RETORNO)
-- DESACTIVAR RESTRICCIONES DE CLAVES FORÁNEAS
SET FOREIGN_KEY_CHECKS = 0;

-- Crear tabla nueva con datos renumerados
CREATE TABLE wp_posts_new LIKE wp_posts;

-- Copiar todos los posts NO-reportes
INSERT INTO wp_posts_new 
SELECT * FROM wp_posts 
WHERE post_type != 'mw_report';

-- Copiar reportes renumerados
INSERT INTO wp_posts_new (ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered, post_parent, guid, menu_order, post_type, post_mime_type, comment_count)
SELECT 
  r.new_id,
  p.post_author,
  p.post_date,
  p.post_date_gmt,
  p.post_content,
  p.post_title,
  p.post_excerpt,
  p.post_status,
  p.comment_status,
  p.ping_status,
  p.post_password,
  p.post_name,
  p.to_ping,
  p.pinged,
  p.post_modified,
  p.post_modified_gmt,
  p.post_content_filtered,
  p.post_parent,
  p.guid,
  p.menu_order,
  p.post_type,
  p.post_mime_type,
  p.comment_count
FROM wp_posts p
JOIN report_renumber r ON p.ID = r.old_id;

-- Renombrar tablas
RENAME TABLE wp_posts TO wp_posts_old;
RENAME TABLE wp_posts_new TO wp_posts;

-- REACTIVAR RESTRICCIONES
SET FOREIGN_KEY_CHECKS = 1;

-- 5. Verificar
SELECT COUNT(*) FROM wp_posts WHERE post_type = 'mw_report';
SELECT ID, post_title FROM wp_posts WHERE post_type = 'mw_report' ORDER BY ID LIMIT 5;
```

**⚠️ Nota:** Si algo sale mal, puedes restaurar:
```sql
RENAME TABLE wp_posts TO wp_posts_broken;
RENAME TABLE wp_posts_old TO wp_posts;
DROP TABLE wp_posts_broken;
```

---

## ✅ Verificación Final

Después de ejecutar el reajuste:

### En WordPress Admin
```
Consultar: custom post type de reportes
Verificar que los IDs sean: 1, 2, 3, 4, etc. (sin saltos)
```

### En la plataforma web
```
Ir a: Mi cuenta → Mis reportes
Verificar que muestren: #1, #2, #3, etc.
```

### En BD (consulta SQL)
```sql
SELECT ID, post_title, post_date 
FROM wp_posts 
WHERE post_type = 'mw_report' 
ORDER BY ID;
```

---

## 🚀 Después del Reajuste

### Actualizar el frontend (opcional)
Si quieres una visualización más clara, puedes hacer que muestre:
- **Opción A:** `Reporte 1`, `Reporte 2` (número secuencial)
- **Opción B:** `Reporte 1 · ID #1` (ambos datos)

Ejemplo en `components/screens/ProfileScreen.jsx`:
```jsx
// Actual
<span>#{report.id}</span>

// Propuesta 1 (secuencial)
<span>Reporte {index + 1}</span>

// Propuesta 2 (ambos)
<span>Reporte {index + 1} · ID #{report.id}</span>
```

---

## 📋 Checklist

- [ ] Hacer BACKUP de la BD
- [ ] Exportar reportes (Opción 1) O hacer dump SQL (Opción 2)
- [ ] Ejecutar comandos SQL para limpiar/reajustar
- [ ] Verificar que los IDs son secuenciales (1, 2, 3...)
- [ ] Probar en la plataforma web
- [ ] Confirmar que el frontend muestra los nuevos IDs
- [ ] Eliminar backup si todo funciona ✅

---

## 🆘 Troubleshooting

### Problema: "Acceso denegado" en phpMyAdmin
**Solución:** Usar credenciales root o contactar al administrador del servidor.

### Problema: Los IDs vuelven a tener saltos después
**Causa:** WordPress sigue usando el auto_increment anterior.  
**Solución:** Ejecutar `ALTER TABLE wp_posts AUTO_INCREMENT = <siguiente_id>;` después de cada importación.

### Problema: Los reportes pierden metadatos
**Causa:** Si usas Opción 2 y omites metadatos en el INSERT.  
**Solución:** Usar Opción 1 (Export/Import de WordPress) que preserva todo automáticamente.

---

## 📞 Preguntas

Si algo no funciona:
1. Verificar que el backup se completó ✅
2. Comprobar que la BD está en estado consistente
3. Revisar logs de WordPress en `/wp-content/debug.log`

**¡Éxito!** 🎉
