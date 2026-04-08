import 'package:flutter/material.dart';

class FinanceDashboardScreen extends StatelessWidget {
  const FinanceDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Finance Dashboard'),
        backgroundColor: Colors.blue[700],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.account_balance, size: 64, color: Colors.blue),
            const SizedBox(height: 16),
            const Text(
              'Finance Officer Dashboard',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Pending payments will appear here for verification',
              style: TextStyle(color: Colors.grey[600], fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: () {
                // Will implement pending payments list later
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh Pending Payments'),
            ),
          ],
        ),
      ),
    );
  }
}