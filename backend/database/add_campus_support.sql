-- Add campus support for student and cost-share records.

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS campus VARCHAR(100) DEFAULT 'Main Campus';

ALTER TABLE public.cost_shares
ADD COLUMN IF NOT EXISTS campus VARCHAR(100) DEFAULT 'Main Campus';

-- Remove old uniqueness (program + academic_year) when present.
ALTER TABLE public.cost_shares
DROP CONSTRAINT IF EXISTS uq_cost_shares_program_year;

ALTER TABLE public.cost_shares
DROP CONSTRAINT IF EXISTS cost_shares_program_academic_year_key;

-- Enforce campus-aware uniqueness.
ALTER TABLE public.cost_shares
ADD CONSTRAINT uq_cost_shares_program_year_campus
UNIQUE (program, academic_year, campus);

-- Optional IoT/Main seed examples for 2026/2027.
INSERT INTO public.cost_shares (
  program,
  academic_year,
  campus,
  tuition_cost_per_year,
  boarding_cost_per_year
)
VALUES
  ('Computer Science', '2026/2027', 'IoT Campus', 12000.00, 9000.00),
  ('Information System', '2026/2027', 'IoT Campus', 11000.00, 8500.00),
  ('Medicine', '2026/2027', 'Main Campus', 25000.00, 10000.00),
  ('Education', '2026/2027', 'Main Campus', 7000.00, 6000.00)
ON CONFLICT (program, academic_year, campus) DO NOTHING;
