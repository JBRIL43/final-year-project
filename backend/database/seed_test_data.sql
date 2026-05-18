-- ============================================================
-- HU Student Debt System — Test Data Seed
-- Run this in Supabase SQL Editor AFTER applying complete_schema.sql
-- ============================================================

BEGIN;

-- ── 1. Admin user (login: admin@hu.edu.et / 12345678) ────────────────────────
-- firebase_uid will be updated automatically when the user first logs in
INSERT INTO public.users (firebase_uid, email, full_name, role, department, created_at, updated_at)
VALUES (
  'local-admin-seed',
  'admin@hu.edu.et',
  'System Administrator',
  'admin',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role      = EXCLUDED.role,
      updated_at = NOW();

-- ── 2. Finance officer ────────────────────────────────────────────────────────
INSERT INTO public.users (firebase_uid, email, full_name, role, department, created_at, updated_at)
VALUES (
  'local-finance-seed',
  'finance@hu.edu.et',
  'Finance Officer',
  'finance',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role      = EXCLUDED.role,
      updated_at = NOW();

-- ── 3. Registrar ──────────────────────────────────────────────────────────────
INSERT INTO public.users (firebase_uid, email, full_name, role, department, created_at, updated_at)
VALUES (
  'local-registrar-seed',
  'registrar@hu.edu.et',
  'Registrar Office',
  'registrar',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role      = EXCLUDED.role,
      updated_at = NOW();

-- ── 4. Department head ────────────────────────────────────────────────────────
INSERT INTO public.users (firebase_uid, email, full_name, role, department, created_at, updated_at)
VALUES (
  'local-depthead-seed',
  'depthead@hu.edu.et',
  'Department Head - CS',
  'department_head',
  'Computer Science',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
  SET full_name  = EXCLUDED.full_name,
      role       = EXCLUDED.role,
      department = EXCLUDED.department,
      updated_at = NOW();

-- ── 5. Test student user ──────────────────────────────────────────────────────
INSERT INTO public.users (firebase_uid, email, full_name, role, created_at, updated_at)
VALUES (
  'local-student-seed',
  'student@hu.edu.et',
  'Test Student',
  'student',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
  SET full_name  = EXCLUDED.full_name,
      role       = EXCLUDED.role,
      updated_at = NOW();

-- ── 6. Student record ─────────────────────────────────────────────────────────
WITH student_user AS (
  SELECT user_id FROM public.users WHERE email = 'student@hu.edu.et' LIMIT 1
)
INSERT INTO public.students (
  user_id, student_number, full_name, email, department, campus,
  enrollment_year, enrollment_status, clearance_status,
  payment_model, tuition_share_percent,
  created_at, updated_at
)
SELECT
  su.user_id,
  'HU/2021/001',
  'Test Student',
  'student@hu.edu.et',
  'Computer Science',
  'Main Campus',
  2021,
  'ACTIVE',
  'PENDING',
  'post_graduation',
  15.00,
  NOW(),
  NOW()
FROM student_user su
ON CONFLICT (student_number) DO NOTHING;

-- ── 7. Debt record for the test student ──────────────────────────────────────
WITH s AS (
  SELECT student_id FROM public.students WHERE student_number = 'HU/2021/001' LIMIT 1
)
INSERT INTO public.debt_records (
  student_id, initial_amount, current_balance, academic_year,
  created_at, updated_at, last_updated
)
SELECT
  s.student_id,
  45000.00,
  45000.00,
  '2024/2025',
  NOW(),
  NOW(),
  NOW()
FROM s
WHERE NOT EXISTS (
  SELECT 1 FROM public.debt_records dr WHERE dr.student_id = s.student_id
);

-- ── 8. Semester amounts (2024/2025) ──────────────────────────────────────────
INSERT INTO public.semester_amounts (
  academic_year, campus, program_type,
  tuition_cost_per_year, boarding_cost_per_year, food_cost_per_month,
  health_insurance_fee, other_fees, effective_from
) VALUES
  ('2024/2025', 'Main Campus', 'Computer Science',  20000.00, 8000.00, 3000.00, 200.00, 300.00, '2024-09-01'),
  ('2024/2025', 'Main Campus', 'Engineering',       25000.00, 8000.00, 3000.00, 200.00, 300.00, '2024-09-01'),
  ('2024/2025', 'Main Campus', 'Social Sciences',   15000.00, 8000.00, 3000.00, 200.00, 200.00, '2024-09-01'),
  ('2024/2025', 'Main Campus', 'Health Sciences',   30000.00, 8000.00, 3000.00, 200.00, 400.00, '2024-09-01'),
  ('2024/2025', 'IoT Campus',  'Computer Science',  22000.00, 9000.00, 3000.00, 200.00, 350.00, '2024-09-01'),
  ('2024/2025', 'IoT Campus',  'Engineering',       28000.00, 9000.00, 3000.00, 200.00, 400.00, '2024-09-01')
ON CONFLICT (academic_year, campus, program_type) DO NOTHING;

-- ── 9. Cost shares (2024/2025) ────────────────────────────────────────────────
INSERT INTO public.cost_shares (
  program, academic_year, campus,
  tuition_cost_per_year, boarding_cost_per_year, food_cost_per_month
) VALUES
  ('Computer Science',  '2024/2025', 'Main Campus', 20000.00, 8000.00, 3000.00),
  ('Engineering',       '2024/2025', 'Main Campus', 25000.00, 8000.00, 3000.00),
  ('Social Sciences',   '2024/2025', 'Main Campus', 15000.00, 8000.00, 3000.00),
  ('Health Sciences',   '2024/2025', 'Main Campus', 30000.00, 8000.00, 3000.00),
  ('Information System','2024/2025', 'Main Campus', 18000.00, 8000.00, 3000.00)
ON CONFLICT (program, academic_year) DO NOTHING;

COMMIT;

-- ── Verification queries ──────────────────────────────────────────────────────
SELECT 'users' AS table_name, COUNT(*) AS rows FROM public.users
UNION ALL
SELECT 'students', COUNT(*) FROM public.students
UNION ALL
SELECT 'debt_records', COUNT(*) FROM public.debt_records
UNION ALL
SELECT 'semester_amounts', COUNT(*) FROM public.semester_amounts
UNION ALL
SELECT 'cost_shares', COUNT(*) FROM public.cost_shares;
