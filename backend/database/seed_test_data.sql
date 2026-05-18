-- ============================================================
-- HU Student Debt System — Seed Data
-- Run AFTER complete_schema.sql
-- Firebase UIDs will be updated automatically when users log in
-- ============================================================

BEGIN;

-- ── Semester amounts ──────────────────────────────────────────────────────────
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
  ('2024/2025', 'IoT Campus',  'Engineering',       28000.00, 9000.00, 3000.00, 200.00, 400.00, '2024-09-01'),
  ('2025/2026', 'Main Campus', 'Computer Science',  21000.00, 8500.00, 3000.00, 200.00, 300.00, '2025-09-01'),
  ('2025/2026', 'Main Campus', 'Engineering',       26000.00, 8500.00, 3000.00, 200.00, 300.00, '2025-09-01'),
  ('2025/2026', 'Main Campus', 'Social Sciences',   16000.00, 8500.00, 3000.00, 200.00, 200.00, '2025-09-01'),
  ('2025/2026', 'Main Campus', 'Health Sciences',   32000.00, 8500.00, 3000.00, 200.00, 400.00, '2025-09-01'),
  ('2025/2026', 'IoT Campus',  'Computer Science',  23000.00, 9500.00, 3000.00, 200.00, 350.00, '2025-09-01'),
  ('2025/2026', 'IoT Campus',  'Engineering',       29000.00, 9500.00, 3000.00, 200.00, 400.00, '2025-09-01')
ON CONFLICT (academic_year, campus, program_type) DO NOTHING;

-- ── Cost shares ───────────────────────────────────────────────────────────────
INSERT INTO public.cost_shares (
  program, academic_year, campus,
  tuition_cost_per_year, boarding_cost_per_year, food_cost_per_month
) VALUES
  ('Computer Science',   '2024/2025', 'Main Campus', 20000.00, 8000.00, 3000.00),
  ('Engineering',        '2024/2025', 'Main Campus', 25000.00, 8000.00, 3000.00),
  ('Social Sciences',    '2024/2025', 'Main Campus', 15000.00, 8000.00, 3000.00),
  ('Health Sciences',    '2024/2025', 'Main Campus', 30000.00, 8000.00, 3000.00),
  ('Information System', '2024/2025', 'Main Campus', 18000.00, 8000.00, 3000.00),
  ('Computer Science',   '2025/2026', 'Main Campus', 21000.00, 8500.00, 3000.00),
  ('Engineering',        '2025/2026', 'Main Campus', 26000.00, 8500.00, 3000.00),
  ('Social Sciences',    '2025/2026', 'Main Campus', 16000.00, 8500.00, 3000.00),
  ('Health Sciences',    '2025/2026', 'Main Campus', 32000.00, 8500.00, 3000.00),
  ('Information System', '2025/2026', 'Main Campus', 19000.00, 8500.00, 3000.00)
ON CONFLICT (program, academic_year) DO NOTHING;

COMMIT;

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT 'semester_amounts' AS tbl, COUNT(*) FROM public.semester_amounts
UNION ALL
SELECT 'cost_shares',            COUNT(*) FROM public.cost_shares
UNION ALL
SELECT 'users',                  COUNT(*) FROM public.users
UNION ALL
SELECT 'students',               COUNT(*) FROM public.students;
