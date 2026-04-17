-- Create contracts table for legally binding cost-sharing agreements
CREATE TABLE IF NOT EXISTS public.contracts (
  contract_id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  CONSTRAINT contracts_student_id_key UNIQUE (student_id),
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

-- Auto-create a contract whenever a student is created
CREATE OR REPLACE FUNCTION public.create_contract_for_new_student()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_year integer;
  academic_year_text varchar(9);
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  academic_year_text := current_year::text || '/' || (current_year + 1)::text;

  INSERT INTO public.contracts (
    student_id,
    university_name,
    program,
    academic_year,
    tuition_share_percent,
    boarding_full_cost,
    signed_at,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.student_id,
    'Hawassa University',
    COALESCE(NEW.department, 'Unknown Program'),
    academic_year_text,
    15.00,
    true,
    NOW(),
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (student_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_contract_for_new_student ON public.students;

CREATE TRIGGER trg_create_contract_for_new_student
AFTER INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.create_contract_for_new_student();