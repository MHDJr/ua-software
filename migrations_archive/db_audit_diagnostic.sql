/*
  ==================================================================================
  SUPABASE DATABASE & STORAGE SIZE AUDIT
  ==================================================================================
  Description: Generates a Markdown report of table sizes, row counts, and storage
               bucket metrics. Execute this in the Supabase SQL Editor.
  ==================================================================================
*/

SELECT * FROM (
    WITH table_data AS (
        SELECT 
            t.relname AS name,
            -- Exact count via XML trick to avoid PL/pgSQL loops
            (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', t.relname), false, true, '')))[1]::text::bigint AS rows,
            pg_table_size(t.relid) AS data_bytes,
            pg_indexes_size(t.relid) AS index_bytes,
            'Active (Daily Snapshot)' AS status
        FROM pg_stat_user_tables t
        WHERE t.relname IN ('tasks', 'activity_feed', 'tutor_notifications', 'profiles', 'requests')
    ),
    storage_data AS (
        SELECT 
            'Bucket: ' || bucket_id AS name,
            count(*) AS rows,
            COALESCE(sum((metadata->>'size')::bigint), 0) AS data_bytes,
            0 AS index_bytes,
            'Cloud Storage' AS status
        FROM storage.objects
        GROUP BY bucket_id
    ),
    combined AS (
        SELECT * FROM table_data
        UNION ALL
        SELECT * FROM storage_data
    )
    SELECT '| Table Name | Total Rows | Data Size | Index Size | Present Backup Status |' AS markdown_report
    UNION ALL
    SELECT '|------------|------------|-----------|------------|-----------------------|'
    UNION ALL
    SELECT 
        '| ' || rpad(name, 10) || 
        ' | ' || lpad(rows::text, 10) || 
        ' | ' || lpad(pg_size_pretty(data_bytes), 9) || 
        ' | ' || lpad(pg_size_pretty(index_bytes), 10) || 
        ' | ' || status || ' |'
    FROM combined
) final_report;
