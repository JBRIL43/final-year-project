-- Add proof_url column to payment_history for storing payment receipts/proof links
ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS proof_url TEXT;
