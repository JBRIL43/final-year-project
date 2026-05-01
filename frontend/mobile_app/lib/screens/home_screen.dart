import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';
import 'payment_screen.dart';
import '../service/debt_service.dart';
import 'notifications_screen.dart';
import '../services/student_statement_service.dart';
import '../utils/cost_statement_pdf.dart';
import 'account_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _debtData;
  Map<String, dynamic>? _costBreakdown;
  List<dynamic> _paymentHistory = [];

  bool _isLoadingDebt = true;
  bool _isLoadingStatement = true;
  bool _isSubmittingWithdrawal = false;

  String? _debtError;
  String? _statementError;
  String? _withdrawalStatus;

  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadAllStudentData();
  }

  Future<void> _loadAllStudentData() async {
    await Future.wait([_loadDebtBalance(), _loadStudentStatement()]);
  }

  Future<void> _loadDebtBalance() async {
    setState(() => _isLoadingDebt = true);
    try {
      final data = await DebtService().getDebtBalance();
      setState(() {
        _debtData = data['data'];
        _withdrawalStatus = (_debtData?['withdrawalStatus'] as String?);
        _debtError = null;
      });
    } catch (e) {
      setState(() {
        _debtError = 'Network error: $e';
      });
      debugPrint('Debt load error: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoadingDebt = false);
      }
    }
  }

  Future<void> _loadStudentStatement() async {
    setState(() => _isLoadingStatement = true);
    try {
      final service = StudentStatementService();
      final costResponse = await service.getCostBreakdown();
      final payments = await service.getPayments();

      setState(() {
        _costBreakdown = costResponse['costBreakdown'] as Map<String, dynamic>?;
        _paymentHistory = payments;
        _statementError = null;
      });
    } catch (e) {
      setState(() {
        _statementError = 'Failed to load statement: $e';
      });
      debugPrint('Statement load error: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoadingStatement = false);
      }
    }
  }

  Future<void> _requestWithdrawal() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Withdrawal Request'),
        content: const Text(
          'Submit a withdrawal request for department and registrar review? This action starts the formal withdrawal workflow.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.orange[700],
            ),
            child: const Text('Submit Request'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isSubmittingWithdrawal = true);
    try {
      final message = await DebtService().requestWithdrawal();
      if (!mounted) return;
      setState(() => _withdrawalStatus = 'requested');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: Colors.green),
      );
      await _loadDebtBalance();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmittingWithdrawal = false);
      }
    }
  }(BuildContext context, NumberFormat formatter) {
    if (_isLoadingDebt) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_debtError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 60, color: Colors.red),
              const SizedBox(height: 16),
              Text(
                'Error: $_debtError',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadDebtBalance,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_debtData == null) {
      return const Center(child: Text('No debt data available'));
    }

    final dashboardHistory =
        (_debtData!['paymentHistory'] as List<dynamic>? ?? []);
    final currentBalance = ((_debtData!['currentBalance'] as num?) ?? 0)
        .toDouble();
    final totalPaid = ((_debtData!['totalPaid'] as num?) ?? 0).toDouble();
    final totalPortfolio = currentBalance + totalPaid;
    final paidRatio = totalPortfolio <= 0
        ? 0.0
        : (totalPaid / totalPortfolio).clamp(0.0, 1.0);
    final hasPending = dashboardHistory.any(
      (item) =>
          ((item as Map<String, dynamic>)['status'] ?? '')
              .toString()
              .toUpperCase() ==
          'PENDING',
    );

    return RefreshIndicator(
      onRefresh: _loadDebtBalance,
      child: ListView(
        padding: const EdgeInsets.all(16.0),
        children: [
          Card(
            elevation: 4,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.indigo[700]!,
                    Colors.blue[900]!,
                    Colors.teal[700]!,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  children: [
                    Text(
                      'CURRENT BALANCE',
                      style: TextStyle(color: Colors.white70, fontSize: 16),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      formatter.format(_debtData!['currentBalance']),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 48,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.attach_money, color: Colors.green[300]),
                        const SizedBox(width: 4),
                        Text(
                          'Total Paid: ${formatter.format(_debtData!['totalPaid'])}',
                          style: TextStyle(
                            color: Colors.green[100],
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: paidRatio,
                        minHeight: 9,
                        backgroundColor: Colors.white24,
                        valueColor: const AlwaysStoppedAnimation<Color>(
                          Colors.lightGreenAccent,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Repayment progress ${(paidRatio * 100).toStringAsFixed(1)}%',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Card(
                  elevation: 0,
                  color: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: BorderSide(color: Colors.blueGrey.shade50),
                  ),
                  child: const Padding(
                    padding: EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.insights_outlined, color: Colors.indigo),
                        SizedBox(height: 6),
                        Text(
                          'Health',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Debt portfolio tracked live',
                          style: TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: Card(
                  elevation: 0,
                  color: hasPending ? Colors.amber[50] : Colors.green[50],
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: BorderSide(
                      color: hasPending
                          ? Colors.amber.shade200
                          : Colors.green.shade200,
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          hasPending ? Icons.hourglass_bottom : Icons.verified,
                          color: hasPending
                              ? Colors.amber[900]
                              : Colors.green[800],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          hasPending ? 'Pending Review' : 'Up-to-date',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          hasPending
                              ? 'A payment is waiting for finance confirmation'
                              : 'No payments waiting for review',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Card(
            child: ListTile(
              leading: const Icon(Icons.request_quote, color: Colors.indigo),
              title: const Text('Cost-Sharing Statement'),
              subtitle: const Text(
                'See full tuition, boarding, food, and payment breakdown',
              ),
              trailing: FilledButton(
                onPressed: () => setState(() => _selectedIndex = 1),
                child: const Text('Open'),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Card(
            child: ListTile(
              leading: Icon(Icons.exit_to_app, color: Colors.orange[800]),
              title: const Text('Request Withdrawal'),
              subtitle: Text(
                _withdrawalStatus == 'requested'
                    ? 'Withdrawal request pending department review'
                    : _withdrawalStatus != null
                        ? 'Withdrawal status: $_withdrawalStatus'
                        : 'Start department and registrar withdrawal processing',
              ),
              trailing: FilledButton(
                onPressed: (_isSubmittingWithdrawal || _withdrawalStatus != null)
                    ? null
                    : _requestWithdrawal,
                style: FilledButton.styleFrom(
                  backgroundColor: _withdrawalStatus != null
                      ? Colors.grey[400]
                      : Colors.orange[700],
                ),
                child: _isSubmittingWithdrawal
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(_withdrawalStatus != null ? 'Requested' : 'Request'),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Card(
            child: ListTile(
              leading: Icon(Icons.lock_reset, color: Colors.blue[800]),
              title: const Text('Change Password'),
              subtitle: const Text('Update your account password securely'),
              trailing: FilledButton(
                onPressed: () => setState(() => _selectedIndex = 3),
                child: const Text('Open'),
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (hasPending)
            Card(
              color: Colors.amber[50],
              child: const Padding(
                padding: EdgeInsets.all(12.0),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.amber),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Your payment is pending finance review. Please wait before submitting another payment.',
                        style: TextStyle(color: Colors.brown),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (hasPending) const SizedBox(height: 16),
          const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Recent Activity',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ),
          const SizedBox(height: 8),
          if (dashboardHistory.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(14),
                child: Text('No recent payment activity yet.'),
              ),
            )
          else
            ...dashboardHistory.take(3).map((item) {
              final payment = item as Map<String, dynamic>;
              final status = (payment['status'] ?? 'UNKNOWN')
                  .toString()
                  .toUpperCase();
              final amount = ((payment['amount'] as num?) ?? 0).toDouble();
              return Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: status == 'PENDING'
                        ? Colors.amber[100]
                        : Colors.blue[100],
                    child: Icon(
                      status == 'PENDING'
                          ? Icons.pending_actions
                          : Icons.check_circle_outline,
                      color: status == 'PENDING'
                          ? Colors.amber[800]
                          : Colors.blue[800],
                    ),
                  ),
                  title: Text(
                    formatter.format(amount),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text('Status: $status'),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildCostRow(
    String label,
    String value, {
    bool isHighlighted = false,
    bool isTotal = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontWeight: isTotal ? FontWeight.bold : FontWeight.w500,
              fontSize: isTotal ? 16 : 14,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: isHighlighted || isTotal
                  ? FontWeight.bold
                  : FontWeight.normal,
              color: isTotal ? Colors.blue[800] : null,
              fontSize: isTotal ? 16 : 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBreakdownBar(
    String label,
    double amount,
    double total,
    Color color,
    NumberFormat formatter,
  ) {
    final ratio = total <= 0
        ? 0.0
        : (amount / total).clamp(0.0, 1.0).toDouble();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
              Text(formatter.format(amount)),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: 10,
              backgroundColor: color.withValues(alpha: 0.15),
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentItem(
    Map<String, dynamic> payment,
    NumberFormat formatter,
  ) {
    final method =
        payment['paymentMethod'] ?? payment['payment_method'] ?? 'UNKNOWN';
    final transactionRef =
        payment['transactionRef'] ?? payment['transaction_ref'] ?? 'N/A';
    final paymentDateValue = payment['paymentDate'] ?? payment['payment_date'];
    final paymentDate = paymentDateValue != null
        ? DateTime.tryParse(paymentDateValue.toString())
        : null;
    final amountValue = payment['amount'];
    final amount = amountValue is num
        ? amountValue
        : num.tryParse(amountValue?.toString() ?? '0') ?? 0;
    final status = (payment['status'] ?? 'UNKNOWN').toString().toUpperCase();
    final isPending = status == 'PENDING';
    final isApproved = status == 'SUCCESS' || status == 'APPROVED';

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: method == 'CHAPA'
            ? Colors.blue[100]
            : Colors.orange[100],
        child: Icon(
          method == 'CHAPA' ? Icons.payments : Icons.receipt,
          color: method == 'CHAPA' ? Colors.blue[800] : Colors.orange[800],
        ),
      ),
      title: Text('${formatter.format(amount)} via $method'),
      subtitle: Text(
        'Ref: $transactionRef • ${paymentDate != null ? paymentDate.toString().split(' ')[0] : 'N/A'}',
      ),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isPending
              ? Colors.amber[50]
              : isApproved
              ? Colors.green[50]
              : Colors.red[50],
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          status,
          style: TextStyle(
            color: isPending
                ? Colors.amber[900]
                : isApproved
                ? Colors.green[800]
                : Colors.red[800],
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildStatement(BuildContext context, NumberFormat formatter) {
    if (_isLoadingStatement) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_statementError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 56),
              const SizedBox(height: 12),
              Text(_statementError!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadStudentStatement,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_costBreakdown == null) {
      return const Center(child: Text('No cost statement available'));
    }

    final tuitionFull =
        (_costBreakdown!['tuitionFullCost'] as num?)?.toDouble() ?? 0;
    final tuitionShare =
        (_costBreakdown!['tuitionStudentShare'] as num?)?.toDouble() ?? 0;
    final boarding = (_costBreakdown!['boardingCost'] as num?)?.toDouble() ?? 0;
    final foodMonthly =
        (_costBreakdown!['foodCostMonthly'] as num?)?.toDouble() ?? 0;
    final foodAnnual =
        (_costBreakdown!['foodCostAnnual'] as num?)?.toDouble() ?? 0;
    final totalDebt = (_costBreakdown!['totalDebt'] as num?)?.toDouble() ?? 0;

    return RefreshIndicator(
      onRefresh: _loadStudentStatement,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Cost-Sharing Statement',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            'Academic Year: ${_costBreakdown!['academicYear'] ?? 'N/A'}',
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: Colors.indigo,
            ),
          ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: () async {
              final pdf = generateCostStatementPdf(
                fullName: '${_costBreakdown!['fullName'] ?? 'Student'}',
                program: '${_costBreakdown!['program'] ?? 'N/A'}',
                campus: '${_costBreakdown!['campus'] ?? 'Main Campus'}',
                academicYear: '${_costBreakdown!['academicYear'] ?? 'N/A'}',
                tuitionFullCost: tuitionFull,
                tuitionStudentShare: tuitionShare,
                boardingCost: boarding,
                foodCostMonthly: foodMonthly,
                foodCostAnnual: foodAnnual,
                totalDebt: totalDebt,
              );

              try {
                await Printing.sharePdf(
                  bytes: await pdf.save(),
                  filename:
                      'Hawassa_University_Cost_Statement_${DateTime.now().year}.pdf',
                );
              } catch (e) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Failed to generate PDF: $e')),
                );
              }
            },
            icon: const Icon(Icons.picture_as_pdf),
            label: const Text('Download Statement'),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildCostRow(
                    'Program',
                    '${_costBreakdown!['program'] ?? 'N/A'}',
                  ),
                  _buildCostRow(
                    'Campus',
                    '${_costBreakdown!['campus'] ?? 'Main Campus'}',
                  ),
                  const Divider(),
                  _buildCostRow(
                    'Full Tuition Cost',
                    formatter.format(tuitionFull),
                  ),
                  _buildCostRow(
                    'Your Share (15%)',
                    formatter.format(tuitionShare),
                    isHighlighted: true,
                  ),
                  const Divider(),
                  _buildCostRow(
                    'Boarding (Full)',
                    formatter.format(boarding),
                    isHighlighted: true,
                  ),
                  _buildCostRow(
                    'Food (Monthly)',
                    formatter.format(foodMonthly),
                  ),
                  _buildCostRow(
                    'Food (Annual - 10 months)',
                    formatter.format(foodAnnual),
                    isHighlighted: true,
                  ),
                  const Divider(),
                  _buildCostRow(
                    'TOTAL DEBT',
                    formatter.format(totalDebt),
                    isTotal: true,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Visual Cost Breakdown',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  _buildBreakdownBar(
                    'Tuition Share',
                    tuitionShare,
                    totalDebt,
                    Colors.blue,
                    formatter,
                  ),
                  _buildBreakdownBar(
                    'Boarding',
                    boarding,
                    totalDebt,
                    Colors.deepOrange,
                    formatter,
                  ),
                  _buildBreakdownBar(
                    'Food (Annual)',
                    foodAnnual,
                    totalDebt,
                    Colors.green,
                    formatter,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Payment History',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          if (_paymentHistory.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('No payment history yet'),
              ),
            )
          else
            ..._paymentHistory.map(
              (p) => _buildPaymentItem(p as Map<String, dynamic>, formatter),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(locale: 'en_ET', symbol: 'ETB ');

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _selectedIndex == 0
              ? 'HU Student Debt System'
              : _selectedIndex == 1
              ? 'Cost Statement'
              : _selectedIndex == 2
              ? 'Notifications'
              : 'Account',
        ),
        actions: [
          if (_selectedIndex == 0 || _selectedIndex == 1)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _selectedIndex == 0
                  ? _loadDebtBalance
                  : _loadStudentStatement,
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _selectedIndex == 0
            ? () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const PaymentScreen(),
                  ),
                );
              }
            : null,
        backgroundColor: Colors.green[700],
        child: const Icon(Icons.add),
      ),
      body: IndexedStack(
        index: _selectedIndex,
        children: [
          _buildDashboard(context, formatter),
          _buildStatement(context, formatter),
          const NotificationsScreen(),
          const AccountScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          setState(() => _selectedIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Statement',
          ),
          NavigationDestination(
            icon: Icon(Icons.notifications_none),
            selectedIcon: Icon(Icons.notifications),
            label: 'Notifications',
          ),
          NavigationDestination(
            icon: Icon(Icons.lock_outline),
            selectedIcon: Icon(Icons.lock),
            label: 'Account',
          ),
        ],
      ),
    );
  }
}
