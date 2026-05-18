import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { amountToWords } from './numberToWords';

const resolvedVfs =
  (pdfFonts as any)?.pdfMake?.vfs ||
  (pdfFonts as any)?.default?.pdfMake?.vfs ||
  (pdfFonts as any)?.default ||
  pdfFonts;

if (resolvedVfs) {
  if (typeof (pdfMake as any).addVirtualFileSystem === 'function') {
    (pdfMake as any).addVirtualFileSystem(resolvedVfs);
  } else {
    (pdfMake as any).vfs = resolvedVfs;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────────

interface HistoricalPayment {
  academic_year: string;
  amount_in_birr: number;
  receipt_no?: string | null;
}

interface CostSharingStudent {
  full_name?: string;
  student_number?: string;
  tin?: string;
  date_of_birth?: string;
  department?: string;
  enrollment_year?: number;
  preparatory_school?: string;
  campus?: string;
  tuition_share_percent?: number;
  estimated_cost?: number;
  receipt_no?: string;
  phone?: string;
  email?: string;
  // Historical payment data by year
  historical_payments?: HistoricalPayment[];
  // Computed fields
  total_paid?: number;
  advanced_payment?: number;
}

// ── Ethiopian calendar academic years (2011–2018 EC ≈ 2018/19–2025/26 GC) ─────

const EC_ACADEMIC_YEARS = [
  '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018',
];

function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value?: string | null): string {
  if (!value) return new Date().toLocaleDateString('en-ET');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('en-ET');
  return date.toLocaleDateString('en-ET');
}

// ── PDF Document Definition ──────────────────────────────────────────────────────

export function generateCostSharingStatement(student: CostSharingStudent) {
  const historicalMap = new Map<string, HistoricalPayment>();
  (student.historical_payments || []).forEach((hp) => {
    historicalMap.set(String(hp.academic_year).trim(), hp);
  });

  const totalPaid = student.total_paid ??
    (student.historical_payments || []).reduce((sum, hp) => sum + Number(hp.amount_in_birr || 0), 0);
  const estimatedCost = Number(student.estimated_cost || 0);
  const advancedPayment = student.advanced_payment ?? 0;

  // Build historical payment rows for the table
  const paymentRows: any[][] = EC_ACADEMIC_YEARS.map((year) => {
    const hp = historicalMap.get(year);
    return [
      { text: year, style: 'tableCell', alignment: 'center' },
      { text: hp ? formatMoney(hp.amount_in_birr) : '___________', style: 'tableCell', alignment: 'right' },
    ];
  });

  // Total row
  paymentRows.push([
    { text: 'Total', style: 'tableCellBold', alignment: 'center' },
    { text: formatMoney(totalPaid), style: 'tableCellBold', alignment: 'right' },
  ]);

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 50],
    content: [
      // ── Header ────────────────────────────────────────────────────────────
      {
        columns: [
          { text: 'ሀዋሳ ዩኒቨርሲቲ\nየቴክኖሎጂ ኢንስቲቲዩት', style: 'headerAmharic', alignment: 'left', width: '*' },
          { text: '', width: 60 },
          { text: 'Hawassa University\nInstitute of Technology', style: 'headerEnglish', alignment: 'right', width: '*' },
        ],
        margin: [0, 0, 0, 5],
      },
      {
        text: 'Hawassa University',
        style: 'universityTitle',
        alignment: 'center',
        margin: [0, 8, 0, 2],
      },
      {
        text: 'Beneficiary Cost sharing Information',
        style: 'formTitle',
        alignment: 'center',
        margin: [0, 0, 0, 4],
      },
      {
        text: `Date: ${formatDate()}`,
        alignment: 'right',
        style: 'dateField',
        margin: [0, 0, 0, 12],
      },

      // ── Personal Information (fields 1–6) ─────────────────────────────────
      {
        layout: 'noBorders',
        table: {
          widths: ['auto', '*'],
          body: [
            [
              { text: '1. Full Name:', style: 'fieldLabel' },
              { text: student.full_name || '________________________', style: 'fieldValue' },
            ],
            [
              { text: '2. Identity No.:', style: 'fieldLabel' },
              { text: student.student_number || '________________________', style: 'fieldValue' },
            ],
            [
              { text: '3. TIN No.:', style: 'fieldLabel' },
              { text: student.tin || '________________________', style: 'fieldValue' },
            ],
            [
              { text: '4. Date of Birth:', style: 'fieldLabel' },
              { text: student.date_of_birth ? formatDate(student.date_of_birth) : '______/______/______', style: 'fieldValue' },
            ],
            [
              { text: '5. Faculty/College/School:', style: 'fieldLabel' },
              {
                text: `IoT     Department: ${student.department || '____________'}`,
                style: 'fieldValue',
              },
            ],
            [
              { text: '6. Year of Entrance:', style: 'fieldLabel' },
              { text: student.enrollment_year ? String(student.enrollment_year) : '____________', style: 'fieldValue' },
            ],
          ],
        },
        margin: [0, 0, 0, 8],
      },

      // ── Field 7: Preparatory School ───────────────────────────────────────
      {
        layout: 'noBorders',
        table: {
          widths: ['auto', '*'],
          body: [
            [
              { text: '7. School name where you completed preparatory program:', style: 'fieldLabel' },
              { text: student.preparatory_school || '________________________', style: 'fieldValue' },
            ],
          ],
        },
        margin: [0, 0, 0, 4],
      },

      // ── Region / Kebele ───────────────────────────────────────────────────
      {
        text: `    Region: ____________    Kebele: ____________`,
        style: 'fieldValue',
        margin: [0, 0, 0, 8],
      },

      // ── Field 8: Service Type ─────────────────────────────────────────────
      {
        layout: 'noBorders',
        table: {
          widths: ['auto', '*'],
          body: [
            [
              { text: '8. Type of Service you demand:', style: 'fieldLabel' },
              { text: student.department || '____________', style: 'fieldValue' },
            ],
          ],
        },
        margin: [0, 0, 0, 4],
      },

      // ── Field 9: Estimated Cost ───────────────────────────────────────────
      {
        layout: 'noBorders',
        table: {
          widths: ['auto', '*'],
          body: [
            [
              { text: '9. Estimated cost to be born by the beneficiary in the academic years below:', style: 'fieldLabel' },
              { text: estimatedCost > 0 ? `${formatMoney(estimatedCost)} ETB` : '', style: 'fieldValue' },
            ],
          ],
        },
        margin: [0, 0, 0, 8],
      },

      // ── Historical Payment Table ──────────────────────────────────────────
      {
        table: {
          headerRows: 1,
          widths: ['*', '*'],
          body: [
            [
              { text: 'Year', style: 'tableHeader', alignment: 'center' },
              { text: 'Amount in birr', style: 'tableHeader', alignment: 'center' },
            ],
            ...paymentRows,
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#333333',
          vLineColor: () => '#333333',
          paddingTop: () => 3,
          paddingBottom: () => 3,
          paddingLeft: () => 6,
          paddingRight: () => 6,
        },
        margin: [40, 0, 40, 10],
      },

      // ── "In Words" Section ────────────────────────────────────────────────
      {
        text: [
          { text: 'In words: ', style: 'fieldLabel' },
          {
            text: totalPaid > 0
              ? amountToWords(totalPaid)
              : '________________________________________________________________________',
            style: 'fieldValueItalic',
          },
        ],
        margin: [0, 4, 0, 12],
      },

      // ── Advanced Payment + Receipt ────────────────────────────────────────
      {
        layout: 'noBorders',
        table: {
          widths: ['auto', '*', 'auto', '*'],
          body: [
            [
              { text: '9. Advanced Payment:', style: 'fieldLabel' },
              { text: advancedPayment > 0 ? formatMoney(advancedPayment) : '____________', style: 'fieldValue' },
              { text: 'Date:', style: 'fieldLabel' },
              { text: '____________', style: 'fieldValue' },
            ],
            [
              { text: '10. Receipt No. for the advanced payment:', style: 'fieldLabel' },
              { text: student.receipt_no || '____________', style: 'fieldValue', colSpan: 3 },
              {},
              {},
            ],
          ],
        },
        margin: [0, 0, 0, 24],
      },

      // ── Signatures ────────────────────────────────────────────────────────
      {
        columns: [
          {
            text: 'Prepared by: ________________',
            style: 'signatureLine',
            width: '*',
          },
          {
            text: 'Approved by: ________________',
            style: 'signatureLine',
            width: '*',
            alignment: 'right',
          },
        ],
        margin: [0, 0, 0, 0],
      },
    ],
    styles: {
      headerAmharic: {
        fontSize: 11,
        bold: true,
      },
      headerEnglish: {
        fontSize: 11,
        bold: true,
      },
      universityTitle: {
        fontSize: 16,
        bold: true,
        color: '#1a237e',
      },
      formTitle: {
        fontSize: 14,
        bold: true,
        color: '#283593',
        decoration: 'underline',
      },
      dateField: {
        fontSize: 10,
        italics: true,
      },
      fieldLabel: {
        fontSize: 10,
        bold: true,
        margin: [0, 3, 4, 3] as any,
      },
      fieldValue: {
        fontSize: 10,
        margin: [0, 3, 0, 3] as any,
      },
      fieldValueItalic: {
        fontSize: 10,
        italics: true,
        margin: [0, 3, 0, 3] as any,
      },
      tableHeader: {
        fontSize: 10,
        bold: true,
        fillColor: '#e8eaf6',
      },
      tableCell: {
        fontSize: 10,
      },
      tableCellBold: {
        fontSize: 10,
        bold: true,
      },
      signatureLine: {
        fontSize: 10,
        italics: true,
        color: '#5d6c7a',
      },
    },
    defaultStyle: {
      font: 'Roboto',
    },
  };

  return docDefinition;
}

export { pdfMake };
