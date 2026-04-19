import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'payment_screen.dart';
import '../service/debt_service.dart';
import 'notifications_screen.dart';
import '../services/student_statement_service.dart';

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

  String? _debtError;
  String? _statementError;

  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadAllStudentData();
  }

  Future<void> _loadAllStudentData() async {
    await Future.wait([
      _loadDebtBalance(),
      _loadStudentStatement(),
    ]);
  }

  Future<void> _loadDebtBalance() async {
    setState(() => _isLoadingDebt = true);
    try {
      final data = await DebtService().getDebtBalance();
      setState(() {
        _debtData = data['data'];
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

  Widget _buildDashboard(BuildContext context, NumberFormat formatter) {
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
    final hasPending = dashboardHistory.any(
      (item) =>
          ((item as Map<String, dynamic>)['status'] ?? '')
              .toString()
              .toUpperCase() ==
          'PENDING',
    );

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          Card(
            elevation: 4,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.blue[700]!, Colors.blue[900]!],
                ),
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
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Card(
            child: ListTile(
              leading: const Icon(Icons.request_quote, color: Colors.indigo),
              title: const Text('Cost-Sharing Statement'),
              subtitle: const Text('See full tuition, boarding, food, and payment breakdown'),
              trailing: FilledButton(
                onPressed: () => setState(() => _selectedIndex = 1),
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
              fontWeight:
                  isHighlighted || isTotal ? FontWeight.bold : FontWeight.normal,
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
    final ratio = total <= 0 ? 0.0 : (amount / total).clamp(0.0, 1.0).toDouble();
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

  Widget _buildPaymentItem(Map<String, dynamic> payment, NumberFormat formatter) {
    final method = payment['paymentMethod'] ?? payment['payment_method'] ?? 'UNKNOWN';
    final transactionRef = payment['transactionRef'] ?? payment['transaction_ref'] ?? 'N/A';
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
        backgroundColor: method == 'CHAPA' ? Colors.blue[100] : Colors.orange[100],
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

    final tuitionFull = (_costBreakdown!['tuitionFullCost'] as num?)?.toDouble() ?? 0;
    final tuitionShare = (_costBreakdown!['tuitionStudentShare'] as num?)?.toDouble() ?? 0;
    final boarding = (_costBreakdown!['boardingCost'] as num?)?.toDouble() ?? 0;
    final foodMonthly = (_costBreakdown!['foodCostMonthly'] as num?)?.toDouble() ?? 0;
    final foodAnnual = (_costBreakdown!['foodCostAnnual'] as num?)?.toDouble() ?? 0;
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
            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.indigo),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildCostRow('Program', '${_costBreakdown!['program'] ?? 'N/A'}'),
                  _buildCostRow('Campus', '${_costBreakdown!['campus'] ?? 'Main Campus'}'),
                  const Divider(),
                  _buildCostRow('Full Tuition Cost', formatter.format(tuitionFull)),
                  _buildCostRow('Your Share (15%)', formatter.format(tuitionShare), isHighlighted: true),
                  const Divider(),
                  _buildCostRow('Boarding (Full)', formatter.format(boarding), isHighlighted: true),
                  _buildCostRow('Food (Monthly)', formatter.format(foodMonthly)),
                  _buildCostRow(
                    'Food (Annual - 10 months)',
                    formatter.format(foodAnnual),
                    isHighlighted: true,
                  ),
                  const Divider(),
                  _buildCostRow('TOTAL DEBT', formatter.format(totalDebt), isTotal: true),
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
                  _buildBreakdownBar('Tuition Share', tuitionShare, totalDebt, Colors.blue, formatter),
                  _buildBreakdownBar('Boarding', boarding, totalDebt, Colors.deepOrange, formatter),
                  _buildBreakdownBar('Food (Annual)', foodAnnual, totalDebt, Colors.green, formatter),
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
            ..._paymentHistory.map((p) => _buildPaymentItem(p as Map<String, dynamic>, formatter)),
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
                  : 'Notifications',
        ),
        actions: [
          if (_selectedIndex == 0 || _selectedIndex == 1)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _selectedIndex == 0 ? _loadDebtBalance : _loadStudentStatement,
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
        ],
      ),
    );
  }
}
