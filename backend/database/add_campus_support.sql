-- Add campus support for student and cost-share records.

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS campus VARCHAR(100) DEFAULT 'Main Campus';

ALTER TABLE public.cost_shares
ADD COLUMN IF NOT EXISTS campus VARCHAR(100) DEFAULT 'Main Campus';

ALTER TABLE public.cost_shares
ADD COLUMN IF NOT EXISTS food_cost_per_month NUMERIC(10,2) DEFAULT 3000.00;

UPDATE public.cost_shares
SET food_cost_per_month = 3000.00;

-- Remove old uniqueness (program + academic_year) when present.
ALTER TABLE public.cost_shares
DROP CONSTRAINT IF EXISTS uq_cost_shares_program_year;

ALTER TABLE public.cost_shares
DROP CONSTRAINT IF EXISTS cost_shares_program_academic_year_key;

ALTER TABLE public.cost_shares
DROP CONSTRAINT IF EXISTS uq_cost_shares_program_year_campus;

-- Keep one row per (program, academic_year), preferring the newest row.
WITH ranked AS (
  SELECT
    cost_share_id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(program)), academic_year
      ORDER BY cost_share_id DESC
    ) AS rn
  FROM public.cost_shares
)
DELETE FROM public.cost_shares cs
USING ranked r
WHERE cs.cost_share_id = r.cost_share_id
  AND r.rn > 1;

UPDATE public.cost_shares
SET campus = 'Main Campus'
WHERE campus IS DISTINCT FROM 'Main Campus';

-- Enforce one row per department and academic year.
ALTER TABLE public.cost_shares
ADD CONSTRAINT uq_cost_shares_program_year
UNIQUE (program, academic_year);

-- Optional IoT/Main seed examples for 2026/2027.
INSERT INTO public.cost_shares (
  program,
  academic_year,
  campus,
  tuition_cost_per_year,
  boarding_cost_per_year,
  food_cost_per_month
)
VALUES
  ('Computer Science', '2026/2027', 'Main Campus', 10000.00, 8000.00, 3000.00),
  ('Information System', '2026/2027', 'Main Campus', 9000.00, 7500.00, 3000.00),
  ('Medicine', '2026/2027', 'Main Campus', 25000.00, 10000.00, 3000.00),
  ('Education', '2026/2027', 'Main Campus', 7000.00, 6000.00, 3000.00)
ON CONFLICT (program, academic_year) DO NOTHING;
