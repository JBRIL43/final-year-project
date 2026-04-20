-- Add department-level academic clearance tracking for Department Head workflow.
-- Safe to run multiple times.

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS department_clearance VARCHAR(20) DEFAULT 'PENDING';

UPDATE public.students
SET department_clearance = 'PENDING'
WHERE department_clearance IS NULL OR TRIM(department_clearance) = '';

ALTER TABLE public.students
DROP CONSTRAINT IF EXISTS students_department_clearance_check;

ALTER TABLE public.students
ADD CONSTRAINT students_department_clearance_check CHECK (
  UPPER(department_clearance) = ANY (ARRAY['PENDING', 'APPROVED', 'REJECTED'])
);

CREATE INDEX IF NOT EXISTS idx_students_department_clearance
ON public.students (department_clearance);
