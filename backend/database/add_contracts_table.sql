-- Create contracts table for legally binding cost-sharing agreements
CREATE TABLE IF NOT EXISTS public.contracts (
  contract_id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  university_name VARCHAR(100) NOT NULL DEFAULT 'Hawassa University',
  program VARCHAR(100) NOT NULL,
  academic_year VARCHAR(9) NOT NULL,
  tuition_share_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  boarding_full_cost BOOLEAN NOT NULL DEFAULT true,
  signed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for contract lookup by student
CREATE INDEX IF NOT EXISTS idx_contracts_student_id ON public.contracts(student_id);