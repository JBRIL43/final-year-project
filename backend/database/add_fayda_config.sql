-- Add Fayda integration configuration table.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.fayda_config (
  id SERIAL PRIMARY KEY,
  api_endpoint VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  institution_code VARCHAR(50) NOT NULL,
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_fayda_config_institution_code'
  ) THEN
    ALTER TABLE public.fayda_config
    ADD CONSTRAINT uq_fayda_config_institution_code UNIQUE (institution_code);
  END IF;
END $$;

INSERT INTO public.fayda_config (api_endpoint, api_key, institution_code)
VALUES ('https://fayda.moe.gov.et/api/v1', 'YOUR_FAYDA_API_KEY', 'HU001')
ON CONFLICT (institution_code) DO NOTHING;
