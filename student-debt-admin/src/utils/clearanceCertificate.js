import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

const resolvedVfs =
  pdfFonts?.pdfMake?.vfs ||
  pdfFonts?.default?.pdfMake?.vfs ||
  pdfFonts?.default ||
  pdfFonts;

if (resolvedVfs) {
  if (typeof pdfMake.addVirtualFileSystem === 'function') {
    pdfMake.addVirtualFileSystem(resolvedVfs);
  } else {
    pdfMake.vfs = resolvedVfs;
  }
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} ETB`;
}

function formatDate(value) {
  if (!value) return new Date().toLocaleDateString('en-ET');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('en-ET');
  return date.toLocaleDateString('en-ET');
}

export const generateClearanceCertificate = (student) => {
  const isGraduate = String(student?.enrollment_status || '').toUpperCase() === 'GRADUATED';
  const title = isGraduate
    ? 'GRADUATION CLEARANCE CERTIFICATE'
    : 'WITHDRAWAL CLEARANCE CERTIFICATE';

  const debtSummary = student?.debt_summary || {};
  const latestDebt = student?.latest_debt || null;
  const currentBalance = debtSummary.current_balance;
  const hasOutstandingBalance = Boolean(debtSummary.has_outstanding_balance);

  const debtLine = debtSummary.has_debt_record
    ? hasOutstandingBalance
      ? `Outstanding debt balance: ${formatMoney(currentBalance)}`
      : 'Debt confirmation: No outstanding balance.'
    : 'Debt confirmation: No debt record found in the system.';

  return {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    header: {
      text: 'HAWASSA UNIVERSITY\nOFFICE OF THE REGISTRAR',
      style: 'header',
      alignment: 'center',
      margin: [0, 18, 0, 0],
    },
    content: [
      {
        text: title,
        style: 'title',
        alignment: 'center',
        margin: [0, 24, 0, 22],
      },
      {
        layout: 'noBorders',
        table: {
          widths: ['auto', '*', 'auto', '*'],
          body: [
            [
              { text: 'Name:', style: 'label' },
              { text: student?.full_name || '-', style: 'value' },
              { text: 'Student ID:', style: 'label' },
              { text: student?.student_number || '-', style: 'value' },
            ],
            [
              { text: 'Program:', style: 'label' },
              { text: student?.department || '-', style: 'value' },
              { text: 'Campus:', style: 'label' },
              { text: student?.campus || '-', style: 'value' },
            ],
            [
              { text: 'Status:', style: 'label' },
              { text: student?.enrollment_status || '-', style: 'value' },
              { text: 'Clearance Date:', style: 'label' },
              { text: formatDate(student?.updated_at), style: 'value' },
            ],
            [
              { text: 'Credits:', style: 'label' },
              { text: student?.credits_registered ?? 'N/A', style: 'value' },
              { text: 'Tuition Share:', style: 'label' },
              {
                text:
                  student?.tuition_share_percent != null
                    ? `${Number(student.tuition_share_percent).toFixed(2)}%`
                    : '15.00%',
                style: 'value',
              },
            ],
          ],
        },
        margin: [0, 0, 0, 20],
      },
      {
        text: isGraduate
          ? 'This is to certify that the above-named student has fulfilled all academic and financial obligations and is cleared for graduation.'
          : 'This is to certify that the above-named student has been officially withdrawn and is cleared for processing by the University.',
        style: 'body',
        alignment: 'justify',
        margin: [0, 0, 0, 14],
      },
      {
        text: debtLine,
        style: 'body',
        alignment: 'justify',
        margin: [0, 0, 0, 18],
      },
      latestDebt
        ? {
            text: `Latest debt record status: ${String(debtSummary.debt_status || 'UNKNOWN').replaceAll('_', ' ')}`,
            style: 'body',
            alignment: 'justify',
            margin: [0, 0, 0, 18],
          }
        : null,
      {
        text: 'Issued by the Office of the Registrar, Hawassa University.',
        style: 'footer',
        alignment: 'center',
        margin: [0, 28, 0, 0],
      },
    ].filter(Boolean),
    styles: {
      header: {
        fontSize: 16,
        bold: true,
        color: '#1a237e',
      },
      title: {
        fontSize: 18,
        bold: true,
        color: '#283593',
        letterSpacing: 0.5,
      },
      label: {
        fontSize: 11,
        bold: true,
        margin: [0, 5, 0, 0],
      },
      value: {
        fontSize: 11,
        margin: [0, 5, 0, 0],
      },
      body: {
        fontSize: 12,
        lineHeight: 1.4,
      },
      footer: {
        fontSize: 10,
        italics: true,
        color: '#5d6c7a',
      },
    },
    defaultStyle: {
      font: 'Roboto',
    },
  };
};

export { pdfMake };
