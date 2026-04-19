-- Add missing fields for ERCA compliance
ALTER TABLE students
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS tin VARCHAR(50);
