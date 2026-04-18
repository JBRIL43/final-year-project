-- Annual cost definitions per program and academic year.
-- Used to compute student debt as:
--   (tuition_cost_per_year * tuition_share_percent / 100) + boarding_cost_per_year

CREATE TABLE IF NOT EXISTS public.cost_shares (
  cost_share_id SERIAL PRIMARY KEY,
  program VARCHAR(100) NOT NULL,
  academic_year VARCHAR(9) NOT NULL,
  tuition_cost_per_year NUMERIC(12,2) NOT NULL,
  boarding_cost_per_year NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_cost_shares_program_year UNIQUE (program, academic_year)
);

-- Example seed values (replace with official MOE / university values as needed).
INSERT INTO public.cost_shares (
  program,
  academic_year,
  tuition_cost_per_year,
  boarding_cost_per_year
)
VALUES
  ('Computer Science', '2026/2027', 10000.00, 8000.00),
  ('Medicine', '2026/2027', 25000.00, 10000.00),
  ('Education', '2026/2027', 7000.00, 6000.00)
ON CONFLICT (program, academic_year) DO NOTHING;
