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
  created_at: string;
  updated_at?: string;
}
