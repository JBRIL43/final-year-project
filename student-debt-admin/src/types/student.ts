export interface Student {
  student_id: number;
  user_id: number;
  student_number: string;
  full_name: string;
  email: string;
  department: string;
  enrollment_year: number;
  campus?: string;
  living_arrangement: string;
  enrollment_status: string;
  payment_model?: 'pre_payment' | 'post_graduation' | 'hybrid';
  pre_payment_amount?: number | null;
  pre_payment_date?: string | null;
  pre_payment_clearance?: boolean | null;
  created_at: string;
  updated_at?: string;
}
