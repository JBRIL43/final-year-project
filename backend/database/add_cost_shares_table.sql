-- Annual cost definitions per program and academic year.
-- Used to compute student debt as:
--   (tuition_cost_per_year * tuition_share_percent / 100)
--   + boarding_cost_per_year
--   + (food_cost_per_month * 10)

CREATE TABLE IF NOT EXISTS public.cost_shares (
  cost_share_id SERIAL PRIMARY KEY,
  program VARCHAR(100) NOT NULL,
  academic_year VARCHAR(9) NOT NULL,
  campus VARCHAR(100) NOT NULL DEFAULT 'Main Campus',
  tuition_cost_per_year NUMERIC(12,2) NOT NULL,
  boarding_cost_per_year NUMERIC(12,2) NOT NULL,
  food_cost_per_month NUMERIC(10,2) NOT NULL DEFAULT 3000.00,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_cost_shares_program_year_campus UNIQUE (program, academic_year, campus)
);

-- Example seed values (replace with official MOE / university values as needed).
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
  ('Medicine', '2026/2027', 'Main Campus', 25000.00, 10000.00, 3000.00),
  ('Education', '2026/2027', 'Main Campus', 7000.00, 6000.00, 3000.00),
  ('Computer Science', '2026/2027', 'IoT Campus', 12000.00, 9000.00, 3000.00),
  ('Information System', '2026/2027', 'IoT Campus', 11000.00, 8500.00, 3000.00)
ON CONFLICT (program, academic_year, campus) DO NOTHING;
