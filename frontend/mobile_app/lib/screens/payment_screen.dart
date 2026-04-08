import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _transactionRefController = TextEditingController();
  final _notesController = TextEditingController();

  String _selectedMethod = 'CHAPA';
  bool _isLoading = false;

  Future<void> _recordPayment() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      final response = await http.post(
        Uri.parse('http://10.42.0.1:3000/api/payment/record'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'amount': double.parse(_amountController.text),
          'paymentMethod': _selectedMethod,
          'transactionRef': _transactionRefController.text.isNotEmpty
              ? _transactionRefController.text
              : null,
          'notes': _notesController.text.isNotEmpty ? _notesController.text : null,
        }),
      );

      if (response.statusCode == 201) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Payment recorded successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      } else {
        final error = jsonDecode(response.body)['error'] ?? 'Unknown error';
        throw Exception(error);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Record Payment')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              TextFormField(
                controller: _amountController,
                decoration: const InputDecoration(
                  labelText: 'Amount (ETB)',
                  prefixIcon: Icon(Icons.attach_money),
                  hintText: '5000.00',
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Amount is required';
                  }
                  final amount = double.tryParse(value);
                  if (amount == null || amount <= 0) {
                    return 'Enter a valid positive amount';
                  }
                  return null;
                },
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
              ),
              const SizedBox(height: 16),
              InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Payment Method',
                  border: OutlineInputBorder(),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedMethod,
                    onChanged: (String? newValue) {
                      setState(() {
                        _selectedMethod = newValue!;
                      });
                    },
                    items: <String>['CHAPA', 'RECEIPT', 'BANK_TRANSFER']
                        .map<DropdownMenuItem<String>>((String value) {
                      return DropdownMenuItem<String>(
                        value: value,
                        child: Text(value.replaceAll('_', ' ')),
                      );
                    }).toList(),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (_selectedMethod == 'CHAPA')
                TextFormField(
                  controller: _transactionRefController,
                  decoration: const InputDecoration(
                    labelText: 'Transaction Reference',
                    hintText: 'chapa_xxxxxx or tx_xxxxxx',
                    prefixIcon: Icon(Icons.receipt),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Transaction reference required for Chapa';
                    }
                    return null;
                  },
                ),
              if (_selectedMethod != 'CHAPA')
                TextFormField(
                  controller: _transactionRefController,
                  decoration: const InputDecoration(
                    labelText: 'Reference Number (Optional)',
                    hintText: 'Receipt number or bank ref',
                    prefixIcon: Icon(Icons.receipt),
                  ),
                ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _notesController,
                decoration: const InputDecoration(
                  labelText: 'Notes (Optional)',
                  hintText: 'Semester payment, partial payment, etc.',
                  prefixIcon: Icon(Icons.note),
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 24),
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _recordPayment,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green[700],
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'Record Payment',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
