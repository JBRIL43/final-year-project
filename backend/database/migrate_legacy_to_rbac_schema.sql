-- Single upgrade migration for legacy dumps -> current RBAC/registrar/department flows.
-- Safe to run multiple times.

BEGIN;

-- -----------------------------------------------------------------------------
-- USERS: RBAC columns and constraints
-- -----------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- If role is missing on some legacy tables, add it; otherwise normalize existing values.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'STUDENT';

UPDATE public.users
SET role = CASE
  WHEN role IS NULL OR BTRIM(role) = '' THEN 'STUDENT'
  WHEN UPPER(BTRIM(role)) = 'REGISTRAR_ADMIN' THEN 'ADMIN'
  WHEN UPPER(BTRIM(role)) = 'DEPT_HEAD' THEN 'DEPARTMENT_HEAD'
  WHEN UPPER(BTRIM(role)) = 'FINANCE' THEN 'FINANCE_OFFICER'
  WHEN UPPER(BTRIM(role)) IN ('ADMIN', 'FINANCE_OFFICER', 'REGISTRAR', 'DEPARTMENT_HEAD', 'STUDENT') THEN UPPER(BTRIM(role))
  ELSE UPPER(BTRIM(role))
END;

ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'STUDENT';

-- Replace legacy role check with one compatible with old and new role literals.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (
    UPPER(role) = ANY (
      ARRAY[
        'STUDENT',
        'FINANCE',
        'FINANCE_OFFICER',
        'REGISTRAR',
        'REGISTRAR_ADMIN',
        'DEPARTMENT_HEAD',
        'DEPT_HEAD',
        'ADMIN',
        'ADMINISTRATOR',
        'SUPER_ADMIN'
      ]
    )
  );

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_department ON public.users (department);

-- -----------------------------------------------------------------------------
-- STUDENTS: columns required by registrar/department/graduate/ERCA routes
-- -----------------------------------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS campus VARCHAR(100) NOT NULL DEFAULT 'Main Campus',
  ADD COLUMN IF NOT EXISTS credit_load NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS clearance_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS graduation_date DATE,
  ADD COLUMN IF NOT EXISTS repayment_start_date TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tin VARCHAR(50),
  ADD COLUMN IF NOT EXISTS enrollment_year INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW();

-- Backfill from users when student-level identity fields are missing.
UPDATE public.students s
SET
  full_name = COALESCE(NULLIF(BTRIM(s.full_name), ''), u.full_name),
  email = COALESCE(NULLIF(BTRIM(s.email), ''), u.email)
FROM public.users u
WHERE s.user_id = u.user_id
  AND (
    s.full_name IS NULL OR BTRIM(s.full_name) = ''
    OR s.email IS NULL OR BTRIM(s.email) = ''
  );

-- Sensible defaults for legacy rows.
UPDATE public.students
SET
  clearance_status = COALESCE(NULLIF(UPPER(BTRIM(clearance_status)), ''), 'PENDING'),
  campus = COALESCE(NULLIF(BTRIM(campus), ''), 'Main Campus'),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  clearance_status IS NULL
  OR BTRIM(clearance_status) = ''
  OR campus IS NULL
  OR BTRIM(campus) = ''
  OR updated_at IS NULL;

-- Keep enrollment_year in sync when only batch_year exists.
UPDATE public.students
SET enrollment_year = batch_year
WHERE enrollment_year IS NULL
  AND batch_year IS NOT NULL;

-- Enforce clearance values expected by registrar/admin endpoints.
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_clearance_status_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_clearance_status_check CHECK (
    UPPER(clearance_status) = ANY (ARRAY['PENDING', 'CLEARED', 'WAIVED'])
  );

CREATE INDEX IF NOT EXISTS idx_students_department ON public.students (department);
CREATE INDEX IF NOT EXISTS idx_students_clearance_status ON public.students (clearance_status);
CREATE INDEX IF NOT EXISTS idx_students_repayment_start_date ON public.students (repayment_start_date);

COMMIT;
