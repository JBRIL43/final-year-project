import 'package:flutter/material.dart';
import 'withdrawal_screen.dart';
import 'account_screen.dart';

class MoreScreen extends StatelessWidget {
  final String? withdrawalStatus;
  final VoidCallback onWithdrawalStatusChanged;

  const MoreScreen({
    super.key,
    required this.withdrawalStatus,
    required this.onWithdrawalStatusChanged,
  });

  String _withdrawalLabel(String? status) {
    switch (status?.toLowerCase()) {
      case 'requested':
        return 'Pending department review';
      case 'academic_approved':
        return 'Department approved — awaiting finance';
      case 'finance_approved':
        return 'Finance approved — awaiting registrar';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Not requested';
    }
  }

  Color _withdrawalColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'requested':
        return Colors.orange;
      case 'academic_approved':
        return Colors.blue;
      case 'finance_approved':
        return Colors.teal;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Withdrawal section ─────────────────────────────────────────
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'Withdrawal',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 13,
              color: Colors.black54,
              letterSpacing: 0.5,
            ),
          ),
        ),
        Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: _withdrawalColor(withdrawalStatus).withValues(alpha: 0.12),
              child: Icon(
                Icons.exit_to_app,
                color: _withdrawalColor(withdrawalStatus),
              ),
            ),
            title: const Text(
              'Withdrawal Request',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: Text(_withdrawalLabel(withdrawalStatus)),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => WithdrawalScreen(
                  withdrawalStatus: withdrawalStatus,
                  onStatusChanged: onWithdrawalStatusChanged,
                ),
              ),
            ),
          ),
        ),

        const SizedBox(height: 20),

        // ── Account section ────────────────────────────────────────────
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'Account',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 13,
              color: Colors.black54,
              letterSpacing: 0.5,
            ),
          ),
        ),
        Card(
          child: ListTile(
            leading: const CircleAvatar(
              backgroundColor: Color(0xFFE8EAF6),
              child: Icon(Icons.lock_reset, color: Colors.indigo),
            ),
            title: const Text(
              'Change Password',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: const Text('Update your account password securely'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const AccountScreen()),
            ),
          ),
        ),

        const SizedBox(height: 20),

        // ── Policy info section ────────────────────────────────────────
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'Information',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 13,
              color: Colors.black54,
              letterSpacing: 0.5,
            ),
          ),
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.policy_outlined, color: Colors.indigo),
                    SizedBox(width: 8),
                    Text(
                      'Cost-Sharing Policy',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                _policyRow(
                  Icons.school_outlined,
                  'Tuition Share',
                  '15% of full tuition cost per academic year',
                ),
                _policyRow(
                  Icons.hotel_outlined,
                  'Boarding',
                  'Full boarding cost applies to on-campus students',
                ),
                _policyRow(
                  Icons.restaurant_outlined,
                  'Food',
                  '3,000 ETB/month × 10 months = 30,000 ETB/year',
                ),
                _policyRow(
                  Icons.payments_outlined,
                  'Repayment',
                  'Begins after graduation — zero balance required for clearance',
                ),
                _policyRow(
                  Icons.gavel_outlined,
                  'Regulation',
                  'Ethiopian Council of Ministers Regulation No. 447/2024',
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
                const Row(
                  children: [
                    Icon(Icons.exit_to_app, color: Colors.orange),
                    SizedBox(width: 8),
                    Text(
                      'Withdrawal Policy',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                _policyRow(
                  Icons.looks_one_outlined,
                  'Step 1 — Student',
                  'Submit a withdrawal request through this app',
                ),
                _policyRow(
                  Icons.looks_two_outlined,
                  'Step 2 — Department',
                  'Department head reviews and approves academic standing',
                ),
                _policyRow(
                  Icons.looks_3_outlined,
                  'Step 3 — Finance',
                  'Finance calculates prorated settlement; you must pay in full',
                ),
                _policyRow(
                  Icons.looks_4_outlined,
                  'Step 4 — Registrar',
                  'Registrar finalizes withdrawal and issues clearance',
                ),
                _policyRow(
                  Icons.cancel_outlined,
                  'Cancellation',
                  'You can cancel only while pending department review',
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),

        // ── App info ───────────────────────────────────────────────────
        Center(
          child: Text(
            'HU Student Debt System\nHawassa University',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[500],
              height: 1.6,
            ),
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _policyRow(IconData icon, String title, String detail) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: Colors.black45),
          const SizedBox(width: 10),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(color: Colors.black87, fontSize: 13),
                children: [
                  TextSpan(
                    text: '$title: ',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  TextSpan(text: detail),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
