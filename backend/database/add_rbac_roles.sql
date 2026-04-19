-- Add RBAC role and department fields for multi-office workflows
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- Optional role values to use in app logic:
-- 'student', 'finance', 'registrar', 'department_head', 'admin'
