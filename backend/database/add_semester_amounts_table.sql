CREATE TABLE IF NOT EXISTS public.semester_amounts (
  id SERIAL PRIMARY KEY,
  academic_year VARCHAR(9) NOT NULL,
  campus VARCHAR(100) NOT NULL,
  program_type VARCHAR(50) NOT NULL,
  tuition_cost_per_year DECIMAL(10,2) NOT NULL,
  boarding_cost_per_year DECIMAL(10,2) NOT NULL,
  food_cost_per_month DECIMAL(10,2) NOT NULL,
  health_insurance_fee DECIMAL(10,2) DEFAULT 0.00,
  other_fees DECIMAL(10,2) DEFAULT 0.00,
  effective_from DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (academic_year, campus, program_type)
);

INSERT INTO public.semester_amounts (
  academic_year,
  campus,
  program_type,
  tuition_cost_per_year,
  boarding_cost_per_year,
  food_cost_per_month,
  health_insurance_fee,
  other_fees,
  effective_from
) VALUES
  ('2025/2026', 'Main Campus', 'Engineering', 25000.00, 8000.00, 800.00, 200.00, 300.00, '2025-09-01'),
  ('2025/2026', 'Main Campus', 'Social Sciences', 18000.00, 8000.00, 800.00, 200.00, 200.00, '2025-09-01'),
  ('2025/2026', 'IoT Campus', 'Engineering', 28000.00, 9000.00, 850.00, 200.00, 400.00, '2025-09-01'),
  ('2025/2026', 'IoT Campus', 'Computer Science', 30000.00, 9000.00, 850.00, 200.00, 500.00, '2025-09-01')
ON CONFLICT (academic_year, campus, program_type) DO NOTHING;