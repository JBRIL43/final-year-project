import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

pw.Document generateClearanceCertificatePdf({
  required String fullName,
  required String studentId,
  required String program,
  required String campus,
  required String academicYear,
  required String clearanceDate,
  required double finalBalance,
}) {
  final pdf = pw.Document();

  pdf.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.a4,
      build: (context) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.stretch,
        children: [
          pw.Container(
            alignment: pw.Alignment.center,
            child: pw.Column(
              children: [
                pw.Text(
                  'HAWASSA UNIVERSITY',
                  style: pw.TextStyle(
                    fontSize: 22,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.Text(
                  'Student Withdrawal Clearance Certificate',
                  style: pw.TextStyle(
                    fontSize: 16,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 30),
          pw.Container(
            alignment: pw.Alignment.center,
            child: pw.Text(
              'This is to certify that',
              style: const pw.TextStyle(fontSize: 12),
            ),
          ),
          pw.SizedBox(height: 8),
          pw.Container(
            alignment: pw.Alignment.center,
            child: pw.Text(
              fullName,
              style: pw.TextStyle(
                fontSize: 16,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ),
          pw.SizedBox(height: 8),
          pw.Container(
            alignment: pw.Alignment.center,
            child: pw.Text(
              'Student ID: $studentId',
              style: const pw.TextStyle(fontSize: 11),
            ),
          ),
          pw.SizedBox(height: 20),
          pw.Container(
            padding: const pw.EdgeInsets.all(12),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(width: 1),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                _buildCertRow('Program', program),
                _buildCertRow('Campus', campus),
                _buildCertRow('Academic Year', academicYear),
                _buildCertRow('Clearance Date', clearanceDate),
                _buildCertRow('Final Balance', 'ETB ${finalBalance.toStringAsFixed(2)}'),
              ],
            ),
          ),
          pw.SizedBox(height: 20),
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 20),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  'has successfully completed the withdrawal process and clearance requirements. '
                  'All outstanding financial obligations have been settled. This student is cleared '
                  'to withdraw from Hawassa University with no further financial liabilities.',
                  style: const pw.TextStyle(fontSize: 11, height: 1.5),
                  textAlign: pw.TextAlign.justify,
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 30),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Container(
                    width: 100,
                    height: 50,
                    decoration: pw.BoxDecoration(
                      border: pw.Border(
                        bottom: pw.BorderSide(width: 1),
                      ),
                    ),
                  ),
                  pw.SizedBox(height: 4),
                  pw.Text('Registrar', style: const pw.TextStyle(fontSize: 10)),
                ],
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Container(
                    width: 100,
                    height: 50,
                    decoration: pw.BoxDecoration(
                      border: pw.Border(
                        bottom: pw.BorderSide(width: 1),
                      ),
                    ),
                  ),
                  pw.SizedBox(height: 4),
                  pw.Text('Finance Officer', style: const pw.TextStyle(fontSize: 10)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 20),
          pw.Container(
            alignment: pw.Alignment.center,
            child: pw.Column(
              children: [
                pw.Text(
                  'This document is issued on ${DateTime.now().toString().split(' ')[0]}',
                  style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey),
                ),
                pw.Text(
                  'Hawassa University Student Debt Management System',
                  style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey),
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

pw.Widget _buildCertRow(String label, String value) {
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 6),
    child: pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Expanded(
          flex: 2,
          child: pw.Text(
            label,
            style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
          ),
        ),
        pw.Expanded(
          flex: 3,
          child: pw.Text(value),
        ),
      ],
    ),
  );
}
