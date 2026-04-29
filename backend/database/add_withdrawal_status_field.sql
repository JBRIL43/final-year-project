-- Add withdrawal_status field for digital withdrawal workflow
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS withdrawal_status VARCHAR(50) DEFAULT NULL;
