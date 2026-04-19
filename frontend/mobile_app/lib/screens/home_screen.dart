import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'payment_screen.dart';
import '../service/debt_service.dart';
import 'notifications_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _debtData;
  bool _isLoading = true;
  String? _error;
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadDebtBalance();
  }

  Future<void> _loadDebtBalance() async {
    setState(() => _isLoading = true);
    try {
      final data = await DebtService().getDebtBalance();
      setState(() {
        _debtData = data['data'];
        _error = null;
      });
    } catch (e) {
      setState(() {
        _error = 'Network error: $e';
      });
      debugPrint('DEBUG ERROR: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Widget _buildDashboard(BuildContext context, NumberFormat formatter) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 60, color: Colors.red),
              const SizedBox(height: 16),
              Text(
                'Error: $_error',
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

    final paymentHistory =
        (_debtData!['paymentHistory'] as List<dynamic>? ?? []);
    final hasPending = paymentHistory.any(
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
          const Text(
            'Payment History',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: paymentHistory.isEmpty
                ? const Center(child: Text('No payment history yet'))
                : ListView.builder(
                    itemCount: paymentHistory.length,
                    itemBuilder: (context, index) {
                      final payment =
                          paymentHistory[index] as Map<String, dynamic>;
                      final method =
                          payment['paymentMethod'] ??
                          payment['payment_method'] ??
                          'UNKNOWN';
                      final transactionRef =
                          payment['transactionRef'] ??
                          payment['transaction_ref'] ??
                          'N/A';
                      final paymentDateValue =
                          payment['paymentDate'] ?? payment['payment_date'];
                      final paymentDate = paymentDateValue != null
                          ? DateTime.tryParse(paymentDateValue.toString())
                          : null;
                      final amountValue = payment['amount'];
                      final amount = amountValue is num
                          ? amountValue
                          : num.tryParse(amountValue?.toString() ?? '0') ?? 0;
                      final status = (payment['status'] ?? 'UNKNOWN')
                          .toString();
                      final normalizedStatus = status.toUpperCase();
                      final isPending = normalizedStatus == 'PENDING';
                      final isApproved =
                          normalizedStatus == 'SUCCESS' ||
                          normalizedStatus == 'APPROVED';
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: method == 'CHAPA'
                              ? Colors.blue[100]
                              : Colors.orange[100],
                          child: Icon(
                            method == 'CHAPA' ? Icons.payments : Icons.receipt,
                            color: method == 'CHAPA'
                                ? Colors.blue[800]
                                : Colors.orange[800],
                          ),
                        ),
                        title: Text('${formatter.format(amount)} via $method'),
                        subtitle: Text(
                          'Ref: $transactionRef • ${paymentDate != null ? paymentDate.toString().split(' ')[0] : 'N/A'}',
                        ),
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: isPending
                                ? Colors.amber[50]
                                : isApproved
                                ? Colors.green[50]
                                : Colors.red[50],
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            normalizedStatus,
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
                    },
                  ),
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
          _selectedIndex == 0 ? 'HU Student Debt System' : 'Notifications',
        ),
        actions: [
          if (_selectedIndex == 0)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _loadDebtBalance,
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
            icon: Icon(Icons.notifications_none),
            selectedIcon: Icon(Icons.notifications),
            label: 'Notifications',
          ),
        ],
      ),
    );
  }
}
