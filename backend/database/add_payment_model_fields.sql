ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS payment_model VARCHAR(20) DEFAULT 'post_graduation'
CHECK (payment_model IN ('pre_payment', 'post_graduation', 'hybrid'));

UPDATE public.students
SET payment_model = 'post_graduation'
WHERE payment_model IS NULL;

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS pre_payment_amount DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS pre_payment_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS pre_payment_clearance BOOLEAN DEFAULT FALSE;

UPDATE public.students
SET pre_payment_amount = COALESCE(pre_payment_amount, 0.00),
    pre_payment_clearance = COALESCE(pre_payment_clearance, FALSE)
WHERE pre_payment_amount IS NULL
   OR pre_payment_clearance IS NULL;