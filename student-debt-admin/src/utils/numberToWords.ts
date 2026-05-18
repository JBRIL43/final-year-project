/**
 * Converts a number (ETB amount) to its English words representation.
 * Supports values up to 999,999,999,999.99
 * Example: 12345.67 → "Twelve Thousand Three Hundred Forty-Five Birr and Sixty-Seven Cents"
 */

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

const scales = ['', 'Thousand', 'Million', 'Billion'];

function convertHundreds(n: number): string {
  let result = '';

  if (n >= 100) {
    result += ones[Math.floor(n / 100)] + ' Hundred';
    n %= 100;
    if (n > 0) result += ' ';
  }

  if (n >= 20) {
    result += tens[Math.floor(n / 10)];
    n %= 10;
    if (n > 0) result += '-' + ones[n];
  } else if (n > 0) {
    result += ones[n];
  }

  return result;
}

function integerToWords(n: number): string {
  if (n === 0) return 'Zero';

  const parts: string[] = [];
  let scaleIndex = 0;

  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) {
      const chunkWords = convertHundreds(chunk);
      const scale = scales[scaleIndex];
      parts.unshift(scale ? `${chunkWords} ${scale}` : chunkWords);
    }
    n = Math.floor(n / 1000);
    scaleIndex++;
  }

  return parts.join(' ');
}

/**
 * Convert an ETB amount to words.
 * @param amount - The numeric amount in ETB
 * @returns A string like "Twelve Thousand Three Hundred Forty-Five Birr and Sixty-Seven Cents"
 */
export function amountToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '';

  const wholePart = Math.floor(amount);
  const centsPart = Math.round((amount - wholePart) * 100);

  let result = integerToWords(wholePart) + ' Birr';

  if (centsPart > 0) {
    result += ' and ' + integerToWords(centsPart) + ' Cents';
  }

  return result;
}

export default amountToWords;
