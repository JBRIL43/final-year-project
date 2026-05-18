import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';

pw.Document generateCostSharingStatementPdf({
  required String fullName,
  required String studentId,
  required String program,
  required String campus,
  required String academicYear,
  required String preparatorySchool,
  required double tuitionFullCost,
  required double tuitionStudentShare,
  required double boardingCost,
  required double foodCostMonthly,
  required double foodCostAnnual,
  required double totalDebt,
  required List<Map<String, dynamic>> paymentHistory,
}) {
  final pdf = pw.Document();
  final numberFormatter = NumberFormat.simpleCurrency(
    decimalDigits: 2,
    locale: 'en_ET',
    name: 'ETB',
  );

  pdf.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(20),
      build: (context) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.stretch,
        children: [
          // ── Header ────────────────────────────────
          pw.Container(
            alignment: pw.Alignment.center,
            margin: const pw.EdgeInsets.only(bottom: 20),
            child: pw.Column(
              children: [
                pw.Text(
                  'HAWASSA UNIVERSITY',
                  style: pw.TextStyle(
                    fontSize: 18,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.Text(
                  'COST-SHARING BENEFICIARY STATEMENT',
                  style: pw.TextStyle(
                    fontSize: 14,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.Text(
                  'Federal Democratic Republic of Ethiopia',
                  style: const pw.TextStyle(fontSize: 10),
                ),
                pw.Text(
                  'Ministry of Education',
                  style: const pw.TextStyle(fontSize: 10),
                ),
              ],
            ),
          ),

          // ── Student Information ────────────────────────────────
          pw.Container(
            padding: const pw.EdgeInsets.all(10),
            decoration: pw.BoxDecoration(border: pw.Border.all(width: 1)),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                _buildFormRow('Student Name', fullName),
                _buildFormRow('Student ID', studentId),
                _buildFormRow('Program/Department', program),
                _buildFormRow('Campus', campus),
                _buildFormRow('Preparatory School', preparatorySchool),
                _buildFormRow('Academic Year', academicYear),
              ],
            ),
          ),

          pw.SizedBox(height: 15),

          // ── Cost Breakdown ────────────────────────────────
          pw.Text(
            'COST BREAKDOWN (Academic Year $academicYear)',
            style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 8),

          pw.Table(
            border: pw.TableBorder.all(width: 0.5),
            columnWidths: {
              0: const pw.FlexColumnWidth(3),
              1: const pw.FlexColumnWidth(2),
            },
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                children: [
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text(
                      'Item Description',
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                    ),
                  ),
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text(
                      'Amount (ETB)',
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                      textAlign: pw.TextAlign.right,
                    ),
                  ),
                ],
              ),
              pw.TableRow(
                children: [
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text('Full Tuition Cost'),
                  ),
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text(
                      numberFormatter.format(tuitionFullCost),
                      textAlign: pw.TextAlign.right,
                    ),
                  ),
                ],
              ),
              pw.TableRow(
                children: [
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text(
                      'Student Cost Share (15%)',
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                    ),
                  ),
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text(
                      numberFormatter.format(tuitionStudentShare),
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                      textAlign: pw.TextAlign.right,
                    ),
                  ),
                ],
              ),
              pw.TableRow(
                children: [
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text('Boarding Cost (Full Year)'),
                  ),
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text(
                      numberFormatter.format(boardingCost),
                      textAlign: pw.TextAlign.right,
                    ),
                  ),
                ],
              ),
              pw.TableRow(
                children: [
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text('Food Cost (Monthly)'),
                  ),
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text(
                      numberFormatter.format(foodCostMonthly),
                      textAlign: pw.TextAlign.right,
                    ),
                  ),
                ],
              ),
              pw.TableRow(
                children: [
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text('Food Cost (Annual - 10 months)'),
                  ),
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text(
                      numberFormatter.format(foodCostAnnual),
                      textAlign: pw.TextAlign.right,
                    ),
                  ),
                ],
              ),
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                children: [
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text(
                      'TOTAL COST-SHARING OBLIGATION',
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                    ),
                  ),
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(6),
                    child: pw.Text(
                      numberFormatter.format(totalDebt),
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                      textAlign: pw.TextAlign.right,
                    ),
                  ),
                ],
              ),
            ],
          ),

          pw.SizedBox(height: 15),

          // ── Amount In Words ────────────────────────────────
          pw.Container(
            padding: const pw.EdgeInsets.all(8),
            decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5)),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  'Amount in Words:',
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  _convertNumberToWords(totalDebt),
                  style: const pw.TextStyle(fontSize: 11),
                ),
              ],
            ),
          ),

          pw.SizedBox(height: 15),

          // ── Payment History ────────────────────────────────
          if (paymentHistory.isNotEmpty) ...[
            pw.Text(
              'PAYMENT HISTORY',
              style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold),
            ),
            pw.SizedBox(height: 8),
            pw.Table(
              border: pw.TableBorder.all(width: 0.5),
              columnWidths: {
                0: const pw.FlexColumnWidth(1.5),
                1: const pw.FlexColumnWidth(1.5),
                2: const pw.FlexColumnWidth(1.5),
                3: const pw.FlexColumnWidth(1.5),
              },
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                  children: [
                    pw.Padding(
                      padding: const pw.EdgeInsets.all(4),
                      child: pw.Text(
                        'Year',
                        style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                        textAlign: pw.TextAlign.center,
                      ),
                    ),
                    pw.Padding(
                      padding: const pw.EdgeInsets.all(4),
                      child: pw.Text(
                        'Amount (ETB)',
                        style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                        textAlign: pw.TextAlign.center,
                      ),
                    ),
                    pw.Padding(
                      padding: const pw.EdgeInsets.all(4),
                      child: pw.Text(
                        'Receipt No.',
                        style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                        textAlign: pw.TextAlign.center,
                      ),
                    ),
                    pw.Padding(
                      padding: const pw.EdgeInsets.all(4),
                      child: pw.Text(
                        'Date',
                        style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                        textAlign: pw.TextAlign.center,
                      ),
                    ),
                  ],
                ),
                ...paymentHistory.map((payment) {
                  final year =
                      payment['academic_year'] ?? payment['year'] ?? '';
                  final amount = ((payment['amount'] as num?) ?? 0).toDouble();
                  final receiptNo = payment['receipt_no'] ?? 'N/A';
                  final date = payment['payment_date'] ?? payment['date'] ?? '';
                  return pw.TableRow(
                    children: [
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(4),
                        child: pw.Text(year, textAlign: pw.TextAlign.center),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(4),
                        child: pw.Text(
                          numberFormatter.format(amount),
                          textAlign: pw.TextAlign.right,
                        ),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(4),
                        child: pw.Text(
                          receiptNo,
                          textAlign: pw.TextAlign.center,
                        ),
                      ),
                      pw.Padding(
                        padding: const pw.EdgeInsets.all(4),
                        child: pw.Text(date, textAlign: pw.TextAlign.center),
                      ),
                    ],
                  );
                }),
              ],
            ),
            pw.SizedBox(height: 15),
          ],

          // ── Official Declaration ────────────────────────────────
          pw.Container(
            padding: const pw.EdgeInsets.all(10),
            decoration: pw.BoxDecoration(border: pw.Border.all(width: 1)),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  'OFFICIAL DECLARATION',
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
                ),
                pw.SizedBox(height: 8),
                pw.Text(
                  'This document certifies that the above-named student is registered as a cost-sharing beneficiary '
                  'under the Ethiopian Council of Ministers Regulation No. 447/2024 (Regulation on Cost-Sharing in '
                  'Higher Education). The amounts listed represent the student\'s financial obligation for the specified '
                  'academic year. This statement is issued for official use by the University, the student, and relevant '
                  'authorities including ERCA (Ethiopian Revenue and Customs Authority).',
                  style: const pw.TextStyle(fontSize: 10, height: 1.5),
                  textAlign: pw.TextAlign.justify,
                ),
              ],
            ),
          ),

          pw.SizedBox(height: 20),

          // ── Signature Section ────────────────────────────────
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Container(
                    width: 80,
                    height: 40,
                    decoration: pw.BoxDecoration(
                      border: pw.Border(bottom: pw.BorderSide(width: 1)),
                    ),
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text('Registrar', style: const pw.TextStyle(fontSize: 9)),
                ],
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Container(
                    width: 80,
                    height: 40,
                    decoration: pw.BoxDecoration(
                      border: pw.Border(bottom: pw.BorderSide(width: 1)),
                    ),
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    'Finance Officer',
                    style: const pw.TextStyle(fontSize: 9),
                  ),
                ],
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Container(
                    width: 80,
                    height: 40,
                    decoration: pw.BoxDecoration(
                      border: pw.Border(bottom: pw.BorderSide(width: 1)),
                    ),
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text('Student', style: const pw.TextStyle(fontSize: 9)),
                ],
              ),
            ],
          ),

          pw.SizedBox(height: 20),

          // ── Footer ────────────────────────────────
          pw.Container(
            alignment: pw.Alignment.center,
            child: pw.Column(
              children: [
                pw.Text(
                  'Date: ${DateTime.now().toString().split(' ')[0]}',
                  style: const pw.TextStyle(fontSize: 9),
                ),
                pw.Text(
                  'Document ID: HU-CSSB-$studentId-${DateTime.now().millisecondsSinceEpoch}',
                  style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey),
                ),
                pw.Text(
                  'Hawassa University Student Debt Management System',
                  style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  return pdf;
}

pw.Widget _buildFormRow(String label, String value) {
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 3),
    child: pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Expanded(
          flex: 2,
          child: pw.Text(
            label,
            style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10),
          ),
        ),
        pw.Text(': ', style: const pw.TextStyle(fontSize: 10)),
        pw.Expanded(
          flex: 3,
          child: pw.Text(value, style: const pw.TextStyle(fontSize: 10)),
        ),
      ],
    ),
  );
}

String _convertNumberToWords(double amount) {
  // Simplified conversion for Ethiopian Birr amounts
  // For production, use a proper library like 'number_to_words'
  final wholeNumber = amount.toInt();
  final cents = ((amount - wholeNumber) * 100).toInt();

  final units = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
  ];
  final teens = [
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  final tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];
  final scales = ['', 'Thousand', 'Million', 'Billion'];

  if (wholeNumber == 0) {
    return 'Zero Birr';
  }

  String convertBelow1000(int num) {
    if (num == 0) return '';
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    final ten = num ~/ 10;
    final unit = num % 10;
    return unit == 0 ? tens[ten] : '${tens[ten]} ${units[unit]}';
  }

  String convertWhole(int num) {
    if (num == 0) return '';
    final parts = <String>[];
    var scaleIndex = 0;
    while (num > 0) {
      final chunk = num % 1000;
      if (chunk != 0) {
        var chunkWords = convertBelow1000(chunk);
        if (scales[scaleIndex].isNotEmpty) {
          chunkWords += ' ${scales[scaleIndex]}';
        }
        parts.insert(0, chunkWords);
      }
      num ~/= 1000;
      scaleIndex++;
    }
    return parts.join(' ');
  }

  var result = convertWhole(wholeNumber) + ' Birr';
  if (cents > 0) {
    result += ' and ${convertWhole(cents)} Cents';
  }
  return result;
}
