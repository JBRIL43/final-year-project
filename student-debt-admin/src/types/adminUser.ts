export interface AdminUser {
  user_id: number;
  email: string;
  full_name: string;
  role: string;
  department: string | null;
  created_at: string;
  updated_at?: string;
}
