#!/bin/bash

# ============================================================================
# EXPORT ALL REPORTS TO JSON (SAFE BACKUP BEFORE RENUMBERING)
# ============================================================================

DB_HOST="127.0.0.1"
DB_USER="u950660407_8zuLe"
DB_PASSWORD="6jmIYuDuLV"
DB_NAME="u950660407_jH9bt"
OUTPUT_FILE="reports_backup_$(date +%Y%m%d_%H%M%S).json"

echo "Exporting all mw_report posts to JSON..."

# Export posts
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
SELECT JSON_OBJECT(
  'id', p.ID,
  'title', p.post_title,
  'content', p.post_content,
  'excerpt', p.post_excerpt,
  'author_id', p.post_author,
  'created_at', p.post_date,
  'modified_at', p.post_modified,
  'status', p.post_status,
  'slug', p.post_name,
  'guid', p.guid
)
FROM wp_posts p
WHERE p.post_type = 'mw_report'
ORDER BY p.post_date ASC;
" | sed 's/JSON_OBJECT//' > "$OUTPUT_FILE"

echo "✓ Exported to $OUTPUT_FILE"

# Also create SQL backup
echo "Creating SQL backup..."
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
  --tables wp_posts wp_postmeta \
  --where="post_type='mw_report' OR post_id IN (SELECT ID FROM wp_posts WHERE post_type='mw_report')" \
  > "reports_backup_$(date +%Y%m%d_%H%M%S).sql"

echo "✓ All backups completed!"
