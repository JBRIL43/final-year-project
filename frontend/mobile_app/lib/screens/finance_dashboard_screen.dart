import 'package:flutter/material.dart';
import '../services/finance_service.dart';

class FinanceDashboardScreen extends StatefulWidget {
  const FinanceDashboardScreen({super.key});

  @override
  State<FinanceDashboardScreen> createState() => _FinanceDashboardScreenState();
}

class _FinanceDashboardScreenState extends State<FinanceDashboardScreen> {
  List<dynamic> _pendingPayments = [];
  bool _isLoading = false;
  final int _verifiedBy = 1;

  Future<void> _loadPendingPayments() async {
    setState(() => _isLoading = true);
    try {
      final payments = await FinanceService.getPendingPayments();
      setState(() => _pendingPayments = payments);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error loading payments: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _verifyPayment(int paymentId, String action) async {
    try {
      await FinanceService.verifyPayment(
        paymentId: paymentId,
        verifiedBy: _verifiedBy,
        action: action,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Payment ${action.toLowerCase()}ed successfully!'),
          backgroundColor: Colors.green,
        ),
      );
      _loadPendingPayments();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  void initState() {
    super.initState();
    _loadPendingPayments();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Finance Dashboard'),
        backgroundColor: Colors.blue[700],
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadPendingPayments,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _pendingPayments.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.check_circle_outline,
                    size: 64,
                    color: Colors.green,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'No pending payments',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'All payments have been verified',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16.0),
              itemCount: _pendingPayments.length,
              itemBuilder: (context, index) {
                final payment = _pendingPayments[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                payment['student_number'],
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.orange[100],
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                'PENDING',
                                style: TextStyle(
                                  color: Colors.orange[800],
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${payment['department']} • ETB ${payment['amount']}',
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (payment['transaction_ref'] != null)
                          Text.rich(
                            TextSpan(
                              text: 'Ref: ',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                              children: [
                                TextSpan(
                                  text: payment['transaction_ref'],
                                  style: const TextStyle(
                                    fontWeight: FontWeight.normal,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        if (payment['notes'] != null)
                          Text(
                            'Notes: ${payment['notes']}',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () {
                                  _verifyPayment(
                                    payment['payment_id'],
                                    'REJECT',
                                  );
                                },
                                icon: const Icon(
                                  Icons.cancel,
                                  color: Colors.red,
                                ),
                                label: const Text(
                                  'Reject',
                                  style: TextStyle(color: Colors.red),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: () {
                                  _verifyPayment(
                                    payment['payment_id'],
                                    'APPROVE',
                                  );
                                },
                                icon: const Icon(
                                  Icons.check,
                                  color: Colors.white,
                                ),
                                label: const Text(
                                  'Approve',
                                  style: TextStyle(color: Colors.white),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.green[700],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
