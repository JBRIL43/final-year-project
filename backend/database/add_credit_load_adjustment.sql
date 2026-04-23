-- Add credit-load tracking for tuition-share adjustment.
-- Safe to run multiple times.

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS credits_registered INTEGER CHECK (credits_registered >= 0),
ADD COLUMN IF NOT EXISTS tuition_share_percent NUMERIC(5,2) DEFAULT 15.00;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'credit_load'
  ) THEN
    EXECUTE '
      UPDATE public.students
      SET credits_registered = credit_load
      WHERE credits_registered IS NULL
        AND credit_load IS NOT NULL
    ';
  END IF;
END $$;

-- Keep tuition_share_percent in a valid range when manually updated.
ALTER TABLE public.students
DROP CONSTRAINT IF E👉 **Your turn**:  
After updating the Registrar Dashboard UI and adding the backend route, reply with:  
> `"✅ Credit load management implemented"`  

Then we’ll test by setting credits and verifying tuition share adjusts correctly.XISTS students_tuition_share_percent_check;

ALTER TABLE public.students
ADD CONSTRAINT students_tuition_share_percent_check CHECK (
  tuition_share_percent IS NULL OR (tuition_share_percent >= 0 AND tuition_share_percent <= 100)
);

CREATE INDEX IF NOT EXISTS idx_students_credits_registered
ON public.students (credits_registered);
