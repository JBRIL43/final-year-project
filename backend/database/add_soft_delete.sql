-- HU Student Debt Management - Soft Delete Migration
-- Implements production-ready soft delete mechanism for critical tables.
-- Uses updatable views to automatically filter deleted records.

BEGIN;

-- 1. Helper Function to convert table to soft-delete capable
CREATE OR REPLACE FUNCTION public.implement_soft_delete(table_name_text TEXT)
RETURNS VOID AS $$
DECLARE
    raw_table_name TEXT := '_' || table_name_text || '_data';
BEGIN
    -- a. Add deleted_at if not exists
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL', table_name_text);

    -- b. Rename original table
    EXECUTE format('ALTER TABLE public.%I RENAME TO %I', table_name_text, raw_table_name);

    -- c. Create updatable view with original name
    EXECUTE format('CREATE VIEW public.%I AS SELECT * FROM public.%I WHERE deleted_at IS NULL', table_name_text, raw_table_name);

    -- d. Create index on raw table
    EXECUTE format('CREATE INDEX %I ON public.%I (deleted_at) WHERE deleted_at IS NULL', 'idx_' || raw_table_name || '_deleted_at', raw_table_name);
END;
$$ LANGUAGE plpgsql;

-- 2. Apply to critical tables
SELECT public.implement_soft_delete('users');
SELECT public.implement_soft_delete('students');
SELECT public.implement_soft_delete('debt_records');
SELECT public.implement_soft_delete('notifications');
SELECT public.implement_soft_delete('semester_amounts');
SELECT public.implement_soft_delete('fayda_config');

DROP FUNCTION public.implement_soft_delete(TEXT);

COMMIT;
