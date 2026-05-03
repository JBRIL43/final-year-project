import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/finance_service.dart';
import 'notifications_screen.dart';

class FinanceDashboardScreen extends StatefulWidget {
  const FinanceDashboardScreen({super.key});

  @override
  State<FinanceDashboardScreen> createState() => _FinanceDashboardScreenState();
}

class _FinanceDashboardScreenState extends State<FinanceDashboardScreen> {
  List<dynamic> _pendingPayments = [];
  List<dynamic> _pendingWithdrawals = [];
  bool _isLoadingPayments = false;
  bool _isLoadingWithdrawals = false;
  final int _verifiedBy = 1;
  int _selectedIndex = 0;
  Timer? _pollTimer;

  final _currencyFmt = NumberFormat.currency(locale: 'en_ET', symbol: 'ETB ');

  @override
  void initState() {
    super.initState();
    _loadPendingPayments();
    _loadPendingWithdrawals();
    // Poll every 20s for new payments and withdrawals
    _pollTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (mounted) {
        _loadPendingPayments();
        _loadPendingWithdrawals();
      }
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadPendingPayments() async {
    setState(() => _isLoadingPayments = true);
    try {
      final payments = await FinanceService.getPendingPayments();
      if (mounted) setState(() => _pendingPayments = payments);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading payments: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isLoadingPayments = false);
    }
  }

  Future<void> _loadPendingWithdrawals() async {
    setState(() => _isLoadingWithdrawals = true);
    try {
      final withdrawals = await FinanceService.getPendingWithdrawals();
      if (mounted) setState(() => _pendingWithdrawals = withdrawals);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading withdrawals: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isLoadingWithdrawals = false);
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
          content: Text('Payment ${action.toLowerCase()}ed successfully'),
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

  void _showStatementDialog(Map<String, dynamic> withdrawal) {
    final studentId = withdrawal['student_id'] as int;
    final name = withdrawal['full_name'] ?? 'Student';
    showDialog(
      context: context,
      builder: (ctx) => _StatementDialog(
        studentId: studentId,
        studentName: name,
        currencyFmt: _currencyFmt,
        onApprove: () {
          Navigator.pop(ctx);
          _approveWithdrawal(studentId, name);
        },
      ),
    );
  }

  Future<void> _approveWithdrawal(int studentId, String name) async {
    try {
      await FinanceService.financeApproveWithdrawal(studentId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Withdrawal approved for $name'),
          backgroundColor: Colors.green,
        ),
      );
      _loadPendingWithdrawals();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    }
  }

  Widget _buildApprovalsTab() {
    if (_isLoadingPayments) return const Center(child: CircularProgressIndicator());
    if (_pendingPayments.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_outline, size: 64, color: Colors.green),
            const SizedBox(height: 16),
            const Text('No pending payments', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('All payments have been verified', style: TextStyle(color: Colors.grey[600])),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadPendingPayments,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _pendingPayments.length,
        itemBuilder: (context, index) {
          final payment = _pendingPayments[index];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          payment['student_number'] ?? '',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.orange[100],
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text('PENDING',
                            style: TextStyle(color: Colors.orange[800], fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text('${payment['department'] ?? ''} • ETB ${payment['amount']}',
                      style: TextStyle(color: Colors.grey[600])),
                  if (payment['transaction_ref'] != null) ...[
                    const SizedBox(height: 4),
                    Text('Ref: ${payment['transaction_ref']}'),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _verifyPayment(payment['payment_id'], 'REJECT'),
                          icon: const Icon(Icons.cancel, color: Colors.red),
                          label: const Text('Reject', style: TextStyle(color: Colors.red)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _verifyPayment(payment['payment_id'], 'APPROVE'),
                          icon: const Icon(Icons.check, color: Colors.white),
                          label: const Text('Approve', style: TextStyle(color: Colors.white)),
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.green[700]),
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

  Widget _buildWithdrawalsTab() {
    if (_isLoadingWithdrawals) return const Center(child: CircularProgressIndicator());
    if (_pendingWithdrawals.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.exit_to_app, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            const Text('No pending withdrawals', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('No withdrawals awaiting finance approval', style: TextStyle(color: Colors.grey[600])),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadPendingWithdrawals,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _pendingWithdrawals.length,
        itemBuilder: (context, index) {
          final w = _pendingWithdrawals[index];
          final balance = (w['current_balance'] as num?)?.toDouble() ?? 0;
          final isPaid = balance <= 0;
          final requestedAt = w['withdrawal_requested_at'] != null
              ? DateTime.tryParse(w['withdrawal_requested_at'].toString())
              : null;

          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              w['full_name'] ?? w['student_number'] ?? 'Student',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            Text(w['student_number'] ?? '',
                                style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isPaid ? Colors.green[50] : Colors.red[50],
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isPaid ? Colors.green.shade300 : Colors.red.shade300,
                          ),
                        ),
                        child: Text(
                          isPaid ? 'PAID' : 'BALANCE DUE',
                          style: TextStyle(
                            color: isPaid ? Colors.green[800] : Colors.red[800],
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('${w['department'] ?? ''} • ${w['campus'] ?? ''}',
                      style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                  if (requestedAt != null)
                    Text(
                      'Requested: ${DateFormat('MMM d, yyyy').format(requestedAt)}',
                      style: TextStyle(color: Colors.grey[600], fontSize: 13),
                    ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.account_balance_wallet, size: 16, color: Colors.indigo),
                      const SizedBox(width: 4),
                      Text(
                        'Outstanding: ${_currencyFmt.format(balance)}',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: isPaid ? Colors.green[700] : Colors.red[700],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _showStatementDialog(w),
                          icon: const Icon(Icons.description_outlined),
                          label: const Text('View Statement'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: isPaid
                              ? () => _approveWithdrawal(
                                    w['student_id'] as int,
                                    w['full_name'] ?? 'Student',
                                  )
                              : null,
                          icon: const Icon(Icons.check_circle, color: Colors.white),
                          label: const Text('Approve', style: TextStyle(color: Colors.white)),
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.green[700]),
                        ),
                      ),
                    ],
                  ),
                  if (!isPaid)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        'Student must pay ${_currencyFmt.format(balance)} before approval',
                        style: TextStyle(color: Colors.red[700], fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  String get _appBarTitle {
    switch (_selectedIndex) {
      case 0: return 'Finance Dashboard';
      case 1: return 'Withdrawals';
      default: return 'Notifications';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_appBarTitle),
        backgroundColor: Colors.blue[700],
        foregroundColor: Colors.white,
        actions: [
          if (_selectedIndex == 0)
            IconButton(icon: const Icon(Icons.refresh), onPressed: _loadPendingPayments),
          if (_selectedIndex == 1)
            IconButton(icon: const Icon(Icons.refresh), onPressed: _loadPendingWithdrawals),
        ],
      ),
      body: IndexedStack(
        index: _selectedIndex,
        children: [
          _buildApprovalsTab(),
          _buildWithdrawalsTab(),
          const NotificationsScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.task_alt_outlined),
            selectedIcon: Icon(Icons.task_alt),
            label: 'Approvals',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: _pendingWithdrawals.isNotEmpty,
              label: Text('${_pendingWithdrawals.length}'),
              child: const Icon(Icons.exit_to_app_outlined),
            ),
            selectedIcon: const Icon(Icons.exit_to_app),
            label: 'Withdrawals',
          ),
          const NavigationDestination(
            icon: Icon(Icons.notifications_none),
            selectedIcon: Icon(Icons.notifications),
            label: 'Notifications',
          ),
        ],
      ),
    );
  }
}

// Statement dialog — shows semester or withdrawal statement and allows approval
class _StatementDialog extends StatefulWidget {
  final int studentId;
  final String studentName;
  final NumberFormat currencyFmt;
  final VoidCallback onApprove;

  const _StatementDialog({
    required this.studentId,
    required this.studentName,
    required this.currencyFmt,
    required this.onApprove,
  });

  @override
  State<_StatementDialog> createState() => _StatementDialogState();
}

class _StatementDialogState extends State<_StatementDialog> {
  String _type = 'semester';
  Map<String, dynamic>? _data;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final result = await FinanceService.getFinancialStatement(
        widget.studentId,
        type: _type,
      );
      if (mounted) setState(() => _data = result);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = widget.currencyFmt;
    final statement = _data?['statement'] as Map<String, dynamic>?;
    final student = _data?['student'] as Map<String, dynamic>?;
    final payments = (_data?['payments'] as List<dynamic>?) ?? [];

    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480, maxHeight: 640),
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              color: Colors.blue[700],
              child: Row(
                children: [
                  const Icon(Icons.description, color: Colors.white),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Financial Statement — ${widget.studentName}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            // Type toggle
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'semester', label: Text('Semester'), icon: Icon(Icons.calendar_month)),
                  ButtonSegment(value: 'withdrawal', label: Text('Withdrawal'), icon: Icon(Icons.exit_to_app)),
                ],
                selected: {_type},
                onSelectionChanged: (s) {
                  setState(() => _type = s.first);
                  _load();
                },
              ),
            ),
            // Content
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                      : statement == null
                          ? const Center(child: Text('No data'))
                          : SingleChildScrollView(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (student != null) ...[
                                    Text(student['fullName'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                    Text('${student['department'] ?? ''} • ${student['campus'] ?? ''}',
                                        style: TextStyle(color: Colors.grey[600])),
                                    Text('Status: ${student['enrollmentStatus'] ?? ''}',
                                        style: TextStyle(color: Colors.grey[600])),
                                    const Divider(height: 20),
                                  ],
                                  if (_type == 'semester') ...[
                                    _row('Academic Year', statement['academicYear']?.toString() ?? 'N/A'),
                                    _row('Full Tuition', fmt.format(statement['tuitionFullCost'] ?? 0)),
                                    _row('Your Share (${statement['tuitionSharePercent']}%)',
                                        fmt.format(statement['tuitionStudentShare'] ?? 0)),
                                    _row('Boarding', fmt.format(statement['boardingCost'] ?? 0)),
                                    _row('Food (Annual)', fmt.format(statement['foodCostAnnual'] ?? 0)),
                                    const Divider(),
                                    _row('Total Obligation', fmt.format(statement['totalObligation'] ?? 0), bold: true),
                                    _row('Total Paid', fmt.format(statement['totalPaid'] ?? 0), color: Colors.green[700]),
                                    _row('Current Balance', fmt.format(statement['currentBalance'] ?? 0),
                                        bold: true,
                                        color: (statement['currentBalance'] ?? 0) > 0 ? Colors.red[700] : Colors.green[700]),
                                  ] else ...[
                                    _row('Withdrawal Requested',
                                        statement['withdrawalRequestedAt'] != null
                                            ? DateFormat('MMM d, yyyy').format(
                                                DateTime.parse(statement['withdrawalRequestedAt']))
                                            : 'N/A'),
                                    _row('Days Enrolled', '${statement['daysEnrolled'] ?? 0} days'),
                                    _row('Prorated Tuition', fmt.format(statement['proratedTuition'] ?? 0)),
                                    _row('Prorated Boarding', fmt.format(statement['proratedBoarding'] ?? 0)),
                                    _row('Prorated Food', fmt.format(statement['proratedFood'] ?? 0)),
                                    const Divider(),
                                    _row('Settlement Amount', fmt.format(statement['settlementAmount'] ?? 0), bold: true),
                                    _row('Total Paid', fmt.format(statement['totalPaid'] ?? 0), color: Colors.green[700]),
                                    _row('Balance Due', fmt.format(statement['settlementBalance'] ?? 0),
                                        bold: true,
                                        color: (statement['settlementBalance'] ?? 0) > 0 ? Colors.red[700] : Colors.green[700]),
                                  ],
                                  if (payments.isNotEmpty) ...[
                                    const SizedBox(height: 12),
                                    const Text('Payment History', style: TextStyle(fontWeight: FontWeight.bold)),
                                    const SizedBox(height: 6),
                                    ...payments.take(5).map((p) {
                                      final status = (p['status'] ?? '').toString().toUpperCase();
                                      return Padding(
                                        padding: const EdgeInsets.symmetric(vertical: 3),
                                        child: Row(
                                          children: [
                                            Expanded(child: Text(fmt.format(p['amount'] ?? 0))),
                                            Text(status,
                                                style: TextStyle(
                                                  color: status == 'SUCCESS' || status == 'APPROVED'
                                                      ? Colors.green[700]
                                                      : status == 'PENDING'
                                                          ? Colors.orange[700]
                                                          : Colors.red[700],
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w600,
                                                )),
                                          ],
                                        ),
                                      );
                                    }),
                                  ],
                                ],
                              ),
                            ),
            ),
            // Footer
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Close'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: (statement != null &&
                              (_type == 'semester'
                                  ? (statement['currentBalance'] ?? 1) <= 0
                                  : (statement['settlementBalance'] ?? 1) <= 0))
                          ? widget.onApprove
                          : null,
                      icon: const Icon(Icons.check_circle),
                      label: const Text('Approve Withdrawal'),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.green[700]),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value, {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13)),
          Text(value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: bold ? FontWeight.bold : FontWeight.normal,
                color: color,
              )),
        ],
      ),
    );
  }
}
