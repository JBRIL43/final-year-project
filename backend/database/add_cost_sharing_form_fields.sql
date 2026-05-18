-- Add cost-sharing form fields to students table
-- This supports Ethiopian cost-sharing compliance (Regulation No. 447/2024)

ALTER TABLE students 
ADD COLUMN IF NOT EXISTS preparatory_school VARCHAR(150),
ADD COLUMN IF NOT EXISTS cost_sharing_statement_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cost_sharing_accepted_date TIMESTAMP;

-- Create table for historical payment tracking (required for cost-sharing records)
CREATE TABLE IF NOT EXISTS historical_payments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  academic_year VARCHAR(20) NOT NULL, -- "2015/2016", "2016/2017", etc.
  amount_in_birr DECIMAL(12,2) NOT NULL,
  receipt_no VARCHAR(100),
  payment_date TIMESTAMP,
  payment_method VARCHAR(50), -- BANK_TRANSFER, CASH, CHEQUE, ONLINE
  recorded_by INTEGER REFERENCES users(user_id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, academic_year) -- One payment record per student per year
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_historical_payments_student_id 
ON historical_payments(student_id);

CREATE INDEX IF NOT EXISTS idx_historical_payments_academic_year 
ON historical_payments(academic_year);

-- Add column to track cost-sharing statement generation date
ALTER TABLE students
ADD COLUMN IF NOT EXISTS cost_sharing_statement_generated_date TIMESTAMP;

-- Add audit log for cost-sharing statement downloads
CREATE TABLE IF NOT EXISTS cost_sharing_statement_audit (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  download_date TIMESTAMP DEFAULT NOW(),
  format VARCHAR(20), -- PDF, PRINT, EMAIL
  ip_address INET,
  device_info TEXT,
  downloaded_by_role VARCHAR(50) -- STUDENT, FINANCE, REGISTRAR, ADMIN
);

CREATE INDEX IF NOT EXISTS idx_cost_sharing_statement_audit_student_id 
ON cost_sharing_statement_audit(student_id);
