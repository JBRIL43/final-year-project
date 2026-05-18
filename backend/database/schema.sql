-- HU Student Debt Management - General Schema
-- Consolidated baseline schema for fresh deployments.
-- Includes core debt-management tables plus cost-sharing compliance tables.

BEGIN;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
	user_id SERIAL PRIMARY KEY,
	firebase_uid VARCHAR(255) UNIQUE,
	email VARCHAR(255) NOT NULL UNIQUE,
	full_name VARCHAR(255),
	role VARCHAR(50) NOT NULL DEFAULT 'student',
	department VARCHAR(100),
	fcm_token TEXT,
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT users_role_check CHECK (
		UPPER(role) = ANY (
			ARRAY[
				'STUDENT',
				'FINANCE',
				'FINANCE_OFFICER',
				'REGISTRAR',
				'REGISTRAR_ADMIN',
				'DEPARTMENT_HEAD',
				'DEPT_HEAD',
				'ADMIN',
				'ADMINISTRATOR',
				'SUPER_ADMIN'
			]
		)
	)
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_department ON public.users (department);

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
	student_id SERIAL PRIMARY KEY,
	user_id INTEGER REFERENCES public.users(user_id) ON DELETE SET NULL,
	student_number VARCHAR(50) UNIQUE,
	full_name VARCHAR(255),
	email VARCHAR(255),
	phone VARCHAR(20),
	tin VARCHAR(50),
	department VARCHAR(100),
	campus VARCHAR(100) NOT NULL DEFAULT 'Main Campus',
	living_arrangement VARCHAR(50),
	enrollment_year INTEGER,
	batch_year INTEGER,
	enrollment_date TIMESTAMP WITHOUT TIME ZONE,
	enrollment_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
	clearance_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
	department_clearance VARCHAR(20) NOT NULL DEFAULT 'PENDING',
	credit_load NUMERIC(6,2),
	credits_registered INTEGER,
	tuition_share_percent NUMERIC(5,2) DEFAULT 15.00,
	payment_model VARCHAR(20) DEFAULT 'post_graduation',
	pre_payment_amount DECIMAL(10,2) DEFAULT 0.00,
	pre_payment_date TIMESTAMP WITHOUT TIME ZONE,
	pre_payment_clearance BOOLEAN DEFAULT FALSE,
	graduation_date DATE,
	repayment_start_date TIMESTAMP WITHOUT TIME ZONE,
	withdrawal_requested_at TIMESTAMP WITHOUT TIME ZONE,
	department_withdrawal_approved BOOLEAN DEFAULT NULL,
	finance_withdrawal_approved BOOLEAN DEFAULT NULL,
	registrar_withdrawal_processed BOOLEAN DEFAULT FALSE,
	withdrawal_status VARCHAR(50) DEFAULT NULL,
	preparatory_school VARCHAR(150),
	cost_sharing_statement_accepted BOOLEAN DEFAULT FALSE,
	cost_sharing_accepted_date TIMESTAMP WITHOUT TIME ZONE,
	cost_sharing_statement_generated_date TIMESTAMP WITHOUT TIME ZONE,
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT students_clearance_status_check CHECK (
		UPPER(clearance_status) = ANY (ARRAY['PENDING', 'CLEARED', 'WAIVED'])
	),
	CONSTRAINT students_department_clearance_check CHECK (
		UPPER(department_clearance) = ANY (ARRAY['PENDING', 'APPROVED', 'REJECTED'])
	),
	CONSTRAINT students_tuition_share_percent_check CHECK (
		tuition_share_percent IS NULL OR (tuition_share_percent >= 0 AND tuition_share_percent <= 100)
	),
	CONSTRAINT students_payment_model_check CHECK (
		payment_model IN ('pre_payment', 'post_graduation', 'hybrid')
	)
);

CREATE INDEX IF NOT EXISTS idx_students_department ON public.students (department);
CREATE INDEX IF NOT EXISTS idx_students_campus ON public.students (campus);
CREATE INDEX IF NOT EXISTS idx_students_clearance_status ON public.students (clearance_status);
CREATE INDEX IF NOT EXISTS idx_students_department_clearance ON public.students (department_clearance);
CREATE INDEX IF NOT EXISTS idx_students_repayment_start_date ON public.students (repayment_start_date);
CREATE INDEX IF NOT EXISTS idx_students_credits_registered ON public.students (credits_registered);
CREATE INDEX IF NOT EXISTS idx_students_withdrawal_requested_at ON public.students (withdrawal_requested_at);
CREATE INDEX IF NOT EXISTS idx_students_registrar_withdrawal_processed ON public.students (registrar_withdrawal_processed);

-- ---------------------------------------------------------------------------
-- debt_records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debt_records (
	debt_id SERIAL PRIMARY KEY,
	student_id INTEGER NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
	initial_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
	current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
	academic_year VARCHAR(20),
	is_final_settlement BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
	last_updated TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_records_student_id ON public.debt_records (student_id);
CREATE INDEX IF NOT EXISTS idx_debt_records_current_balance ON public.debt_records (current_balance);

-- ---------------------------------------------------------------------------
-- payment_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_history (
	payment_id SERIAL PRIMARY KEY,
	debt_id INTEGER NOT NULL REFERENCES public.debt_records(debt_id) ON DELETE CASCADE,
	student_id INTEGER REFERENCES public.students(student_id) ON DELETE SET NULL,
	amount NUMERIC(12,2) NOT NULL,
	payment_method VARCHAR(50),
	transaction_ref VARCHAR(255),
	status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
	verified_by INTEGER REFERENCES public.users(user_id) ON DELETE SET NULL,
	notes TEXT,
	proof_url TEXT,
	payment_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
	submitted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
	reviewed_at TIMESTAMP WITHOUT TIME ZONE,
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_debt_id ON public.payment_history (debt_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_student_id ON public.payment_history (student_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON public.payment_history (status);
CREATE INDEX IF NOT EXISTS idx_payment_history_transaction_ref ON public.payment_history (transaction_ref);

-- ---------------------------------------------------------------------------
-- contracts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contracts (
	contract_id SERIAL PRIMARY KEY,
	student_id INTEGER NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
	CONSTRAINT contracts_student_id_key UNIQUE (student_id),
	university_name VARCHAR(100) NOT NULL DEFAULT 'Hawassa University',
	program VARCHAR(100) NOT NULL,
	academic_year VARCHAR(9) NOT NULL,
	tuition_share_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
	boarding_full_cost BOOLEAN NOT NULL DEFAULT TRUE,
	signed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_student_id ON public.contracts(student_id);

-- ---------------------------------------------------------------------------
-- cost_shares
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cost_shares (
	cost_share_id SERIAL PRIMARY KEY,
	program VARCHAR(100) NOT NULL,
	academic_year VARCHAR(9) NOT NULL,
	campus VARCHAR(100) NOT NULL DEFAULT 'Main Campus',
	tuition_cost_per_year NUMERIC(12,2) NOT NULL,
	boarding_cost_per_year NUMERIC(12,2) NOT NULL,
	food_cost_per_month NUMERIC(10,2) NOT NULL DEFAULT 3000.00,
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
	CONSTRAINT uq_cost_shares_program_year UNIQUE (program, academic_year)
);

-- ---------------------------------------------------------------------------
-- semester_amounts
-- ---------------------------------------------------------------------------
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
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
	UNIQUE (academic_year, campus, program_type)
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
	notification_id BIGSERIAL PRIMARY KEY,
	firebase_uid VARCHAR(255) NOT NULL,
	title TEXT NOT NULL,
	body TEXT NOT NULL,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	is_read BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_firebase_uid
	ON public.notifications (firebase_uid, is_read, created_at DESC);

-- ---------------------------------------------------------------------------
-- fayda_config
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fayda_config (
	id SERIAL PRIMARY KEY,
	api_endpoint VARCHAR(255) NOT NULL,
	api_key VARCHAR(255) NOT NULL,
	institution_code VARCHAR(50) NOT NULL,
	last_sync TIMESTAMP WITHOUT TIME ZONE,
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
	CONSTRAINT uq_fayda_config_institution_code UNIQUE (institution_code)
);

-- ---------------------------------------------------------------------------
-- Cost-sharing compliance (Regulation No. 447/2024)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historical_payments (
	id SERIAL PRIMARY KEY,
	student_id INTEGER NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
	academic_year VARCHAR(20) NOT NULL,
	amount_in_birr DECIMAL(12,2) NOT NULL,
	receipt_no VARCHAR(100),
	payment_date TIMESTAMP WITHOUT TIME ZONE,
	payment_method VARCHAR(50),
	recorded_by INTEGER REFERENCES public.users(user_id) ON DELETE SET NULL,
	notes TEXT,
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
	UNIQUE(student_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_historical_payments_student_id
	ON public.historical_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_historical_payments_academic_year
	ON public.historical_payments(academic_year);

CREATE TABLE IF NOT EXISTS public.cost_sharing_statement_audit (
	id SERIAL PRIMARY KEY,
	student_id INTEGER NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
	download_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
	format VARCHAR(20),
	ip_address INET,
	device_info TEXT,
	downloaded_by_role VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_cost_sharing_statement_audit_student_id
	ON public.cost_sharing_statement_audit(student_id);

-- ---------------------------------------------------------------------------
-- Auto-create contract for new students
-- ---------------------------------------------------------------------------
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
		TRUE,
		NOW(),
		TRUE,
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

COMMIT;

