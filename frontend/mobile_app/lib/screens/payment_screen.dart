import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import 'dart:convert';
import '../services/api_config.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> with WidgetsBindingObserver {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _transactionRefController = TextEditingController();
  final _notesController = TextEditingController();

  String _selectedMethod = 'CHAPA';
  bool _isLoading = false;

  // Tracks a pending Chapa tx so we can verify when the user returns
  String? _pendingTxRef;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _amountController.dispose();
    _transactionRefController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  // Called when the app resumes (user returns from browser after Chapa)
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _pendingTxRef != null) {
      _verifyChapa(_pendingTxRef!);
    }
  }

  Future<Map<String, String>> _authHeaders() async {
    final user = FirebaseAuth.instance.currentUser;
    final token = await user?.getIdToken(true);
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      if (user?.uid != null) 'x-firebase-uid': user!.uid,
      if (user?.email != null) 'x-user-email': user!.email!,
    };
  }

  // ── Chapa flow ─────────────────────────────────────────────────────────────

  Future<void> _payWithChapa() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      final headers = await _authHeaders();
      final amount = double.parse(_amountController.text);

      for (final baseUrl in ApiConfig.candidateBaseUrls()) {
        try {
          final res = await http
              .post(
                Uri.parse('$baseUrl/api/payment/chapa/initialize'),
                headers: headers,
                body: jsonEncode({'amount': amount}),
              )
              .timeout(const Duration(seconds: 10));

          if (res.statusCode == 200) {
            final data = jsonDecode(res.body) as Map<String, dynamic>;
            final checkoutUrl = data['checkoutUrl'] as String?;
            final txRef = data['txRef'] as String?;

            if (checkoutUrl == null || txRef == null) {
              throw Exception('Invalid response from server');
            }

            _pendingTxRef = txRef;

            final uri = Uri.parse(checkoutUrl);
            if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
              throw Exception('Could not open Chapa checkout');
            }
            return;
          }

          final err = jsonDecode(res.body)['error'] ?? 'Unknown error';
          throw Exception(err);
        } catch (e) {
          if (e is Exception && !e.toString().contains('Request failed')) rethrow;
        }
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _verifyChapa(String txRef) async {
    if (!mounted) return;
    setState(() { _isLoading = true; _pendingTxRef = null; });

    try {
      final headers = await _authHeaders();

      for (final baseUrl in ApiConfig.candidateBaseUrls()) {
        try {
          final res = await http
              .post(
                Uri.parse('$baseUrl/api/payment/chapa/verify'),
                headers: headers,
                body: jsonEncode({'txRef': txRef}),
              )
              .timeout(const Duration(seconds: 10));

          if (res.statusCode == 200) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Payment received! Pending finance verification.'),
                backgroundColor: Colors.green,
              ),
            );
            Navigator.pop(context);
            return;
          }

          final err = jsonDecode(res.body)['error'] ?? 'Verification failed';
          throw Exception(err);
        } catch (e) {
          if (e is Exception && !e.toString().contains('Request failed')) rethrow;
        }
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Payment verification failed: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── Manual payment flow ────────────────────────────────────────────────────

  Future<void> _recordManualPayment() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      final headers = await _authHeaders();

      for (final baseUrl in ApiConfig.candidateBaseUrls()) {
        try {
          final res = await http
              .post(
                Uri.parse('$baseUrl/api/payment/record'),
                headers: headers,
                body: jsonEncode({
                  'amount': double.parse(_amountController.text),
                  'paymentMethod': _selectedMethod,
                  'transactionRef': _transactionRefController.text.isNotEmpty
                      ? _transactionRefController.text
                      : null,
                  'notes': _notesController.text.isNotEmpty
                      ? _notesController.text
                      : null,
                }),
              )
              .timeout(const Duration(seconds: 8));

          if (res.statusCode == 201) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Payment submitted. Pending finance review.'),
                backgroundColor: Colors.blue,
              ),
            );
            Navigator.pop(context);
            return;
          }

          final err = jsonDecode(res.body)['error'] ?? 'Unknown error';
          throw Exception(err);
        } catch (e) {
          if (e is Exception && !e.toString().contains('Request failed')) rethrow;
        }
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _onSubmit() {
    if (_selectedMethod == 'CHAPA') {
      _payWithChapa();
    } else {
      _recordManualPayment();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isChapaSelected = _selectedMethod == 'CHAPA';

    return Scaffold(
      appBar: AppBar(title: const Text('Make Payment')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              // ── Method selector ──────────────────────────────────────
              const Text(
                'Payment Method',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _MethodCard(
                    label: 'Chapa',
                    icon: Icons.credit_card,
                    color: Colors.green,
                    selected: _selectedMethod == 'CHAPA',
                    onTap: () => setState(() => _selectedMethod = 'CHAPA'),
                  ),
                  const SizedBox(width: 10),
                  _MethodCard(
                    label: 'Bank Transfer',
                    icon: Icons.account_balance,
                    color: Colors.blue,
                    selected: _selectedMethod == 'BANK_TRANSFER',
                    onTap: () => setState(() => _selectedMethod = 'BANK_TRANSFER'),
                  ),
                  const SizedBox(width: 10),
                  _MethodCard(
                    label: 'Receipt',
                    icon: Icons.receipt_long,
                    color: Colors.orange,
                    selected: _selectedMethod == 'RECEIPT',
                    onTap: () => setState(() => _selectedMethod = 'RECEIPT'),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // ── Chapa info banner ────────────────────────────────────
              if (isChapaSelected)
                Card(
                  color: Colors.green[50],
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: Colors.green.shade200),
                  ),
                  child: const Padding(
                    padding: EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, color: Colors.green),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'You will be redirected to Chapa to complete your payment securely. '
                            'Return to the app after payment to confirm.',
                            style: TextStyle(fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              const SizedBox(height: 16),

              // ── Amount ───────────────────────────────────────────────
              TextFormField(
                controller: _amountController,
                decoration: const InputDecoration(
                  labelText: 'Amount (ETB)',
                  prefixIcon: Icon(Icons.attach_money),
                  hintText: '5000.00',
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Amount is required';
                  final n = double.tryParse(v);
                  if (n == null || n <= 0) return 'Enter a valid positive amount';
                  return null;
                },
              ),

              const SizedBox(height: 16),

              // ── Reference (manual methods only) ─────────────────────
              if (!isChapaSelected)
                TextFormField(
                  controller: _transactionRefController,
                  decoration: InputDecoration(
                    labelText: _selectedMethod == 'BANK_TRANSFER'
                        ? 'Bank Reference Number'
                        : 'Receipt Number',
                    prefixIcon: const Icon(Icons.receipt),
                    border: const OutlineInputBorder(),
                  ),
                ),

              if (!isChapaSelected) const SizedBox(height: 16),

              if (!isChapaSelected)
                TextFormField(
                  controller: _notesController,
                  decoration: const InputDecoration(
                    labelText: 'Notes (Optional)',
                    prefixIcon: Icon(Icons.note),
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),

              const SizedBox(height: 28),

              // ── Submit button ────────────────────────────────────────
              SizedBox(
                height: 52,
                child: FilledButton.icon(
                  onPressed: _isLoading ? null : _onSubmit,
                  icon: _isLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Icon(isChapaSelected ? Icons.open_in_browser : Icons.send),
                  label: Text(
                    isChapaSelected ? 'Pay with Chapa' : 'Submit Payment',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: isChapaSelected ? Colors.green[700] : Colors.blue[700],
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),

              // ── Manual verify button (if user returned without auto-detect) ──
              if (_pendingTxRef != null) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => _verifyChapa(_pendingTxRef!),
                  icon: const Icon(Icons.verified),
                  label: const Text('I completed payment — verify now'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MethodCard extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  const _MethodCard({
    required this.label,
    required this.icon,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? color.withValues(alpha: 0.12) : Colors.grey[100],
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? color : Colors.grey.shade300,
              width: selected ? 2 : 1,
            ),
          ),
          child: Column(
            children: [
              Icon(icon, color: selected ? color : Colors.grey, size: 22),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                  color: selected ? color : Colors.grey[700],
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
