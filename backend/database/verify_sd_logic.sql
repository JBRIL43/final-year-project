-- Verify Soft Delete Logic using a temporary table
BEGIN;

-- 1. Create dummy table
CREATE TABLE public.test_sd_table (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

INSERT INTO public.test_sd_table (name) VALUES ('Active Record'), ('To Be Deleted');

-- 2. Apply Soft Delete Pattern
ALTER TABLE public.test_sd_table ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.test_sd_table RENAME TO _test_sd_table_data;
CREATE VIEW public.test_sd_table AS SELECT * FROM public._test_sd_table_data WHERE deleted_at IS NULL;

-- 3. Verify SELECT through view
SELECT 'SELECT view' as step, * FROM public.test_sd_table;

-- 4. Verify UPDATE (Soft Delete) through view
UPDATE public.test_sd_table SET deleted_at = NOW() WHERE name = 'To Be Deleted';

-- 5. Verify Hidden from view
SELECT 'After Soft Delete' as step, * FROM public.test_sd_table;

-- 6. Verify Visible in raw
SELECT 'Raw data' as step, * FROM public._test_sd_table_data;

-- 7. Verify INSERT through view
INSERT INTO public.test_sd_table (name) VALUES ('New Record');
SELECT 'After Insert' as step, * FROM public.test_sd_table;

-- 8. Verify Restore
UPDATE public._test_sd_table_data SET deleted_at = NULL WHERE name = 'To Be Deleted';
SELECT 'After Restore' as step, * FROM public.test_sd_table;

-- 9. Verify Permanent Delete
DELETE FROM public._test_sd_table_data WHERE name = 'New Record';
SELECT 'After Permanent Delete' as step, * FROM public.test_sd_table;

ROLLBACK; -- Clean up
