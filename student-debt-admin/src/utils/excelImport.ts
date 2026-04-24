import * as XLSX from 'xlsx';

export type ImportedRow = Record<string, string>;

export function importFromExcel(
  file: File,
  onImport: (data: ImportedRow[], headers: string[]) => Promise<void> | void
) {
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const arrayBuffer = e.target?.result;
      if (!arrayBuffer) {
        throw new Error('Unable to read selected file');
      }

      const data = new Uint8Array(arrayBuffer as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('Empty file or missing headers');
      }

      const headers = jsonData[0].map((h) => String(h || '').trim());
      const rows = jsonData.slice(1);

      const importedData: ImportedRow[] = rows
        .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
        .map((row) => {
          const obj: ImportedRow = {};
          headers.forEach((header, index) => {
            obj[header] = String(row[index] ?? '').trim();
          });
          return obj;
        });

      await onImport(importedData, headers);
    } catch (error: any) {
      console.error('Excel import error:', error);
      alert(`Failed to import Excel file: ${error?.message || 'Unknown error'}`);
    }
  };

  reader.readAsArrayBuffer(file);
}

export function validateStudentImportData(data: ImportedRow[]) {
  const requiredFields = ['Student ID', 'Full Name', 'Email', 'Program', 'Campus'];
  const errors: string[] = [];

  data.forEach((row, index) => {
    requiredFields.forEach((field) => {
      if (!row[field] || String(row[field]).trim() === '') {
        errors.push(`Row ${index + 2}: Missing required field \"${field}\"`);
      }
    });

    if (row.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.Email)) {
      errors.push(`Row ${index + 2}: Invalid email format`);
    }

    if (row['Credits Registered'] && Number.isNaN(Number(row['Credits Registered']))) {
      errors.push(`Row ${index + 2}: Credits must be a number`);
    }

    const paymentModel = String(row['Payment Model'] || 'post_graduation').trim().toLowerCase();
    if (paymentModel && !['pre_payment', 'post_graduation', 'hybrid'].includes(paymentModel)) {
      errors.push(`Row ${index + 2}: Payment Model must be pre_payment, post_graduation, or hybrid`);
    }

    const prePaymentAmount = row['Pre-Payment Amount (ETB)'] || row['Pre-Payment Amount'] || '';
    if (paymentModel !== 'post_graduation' && (!prePaymentAmount || Number.isNaN(Number(prePaymentAmount)))) {
      errors.push(`Row ${index + 2}: Pre-Payment Amount is required for pre-payment and hybrid students`);
    }
  });

  return errors;
}
