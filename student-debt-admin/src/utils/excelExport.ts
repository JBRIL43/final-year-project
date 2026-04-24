import * as XLSX from 'xlsx';

export function exportToExcel(
  data: Array<Record<string, unknown>>,
  fileName: string,
  sheetName = 'Data'
) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function formatStudentDataForExport(students: Array<Record<string, unknown>>) {
  return students.map((student) => ({
    'Student ID': String(student.student_number || ''),
    'Full Name': String(student.full_name || ''),
    Email: String(student.email || ''),
    Phone: String(student.phone || ''),
    Program: String(student.department || ''),
    Campus: String(student.campus || ''),
    'Enrollment Status': String(student.enrollment_status || ''),
    'Clearance Status': String(student.clearance_status || ''),
    'Credits Registered': student.credits_registered ?? '',
    'Tuition Share %': student.tuition_share_percent ?? '15.00',
    'Current Balance': student.current_balance ?? '0.00',
    'Graduation Date': student.graduation_date
      ? new Date(String(student.graduation_date)).toLocaleDateString('en-ET')
      : '',
    'Repayment Start Date': student.repayment_start_date
      ? new Date(String(student.repayment_start_date)).toLocaleDateString('en-ET')
      : '',
    'Withdrawal Requested': student.withdrawal_requested_at ? 'Yes' : 'No',
  }));
}
