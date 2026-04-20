-- Add withdrawal workflow tracking fields for student -> department -> registrar flow.
-- Safe to run multiple times.

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS withdrawal_requested_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS department_withdrawal_approved BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS registrar_withdrawal_processed BOOLEAN DEFAULT FALSE;

-- Optional performance indexes for workflow queries.
CREATE INDEX IF NOT EXISTS idx_students_withdrawal_requested_at
ON public.students (withdrawal_requested_at);

CREATE INDEX IF NOT EXISTS idx_students_registrar_withdrawal_processed
ON public.students (registrar_withdrawal_processed);
