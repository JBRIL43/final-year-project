import 'package:flutter/material.dart';
import '../service/debt_service.dart';

/// Human-readable label + color for each withdrawal_status value
class _StatusInfo {
  final String label;
  final String description;
  final Color color;
  final IconData icon;
  const _StatusInfo(this.label, this.description, this.color, this.icon);
}

_StatusInfo _statusInfo(String? raw) {
  switch (raw?.toLowerCase()) {
    case 'requested':
      return const _StatusInfo(
        'Pending Department Review',
        'Your request has been submitted and is waiting for your department head to review.',
        Colors.orange,
        Icons.hourglass_top,
      );
    case 'academic_approved':
      return const _StatusInfo(
        'Department Approved',
        'Your department head has approved your withdrawal. Finance is now reviewing your account.',
        Colors.blue,
        Icons.school,
      );
    case 'finance_approved':
      return const _StatusInfo(
        'Finance Approved',
        'Finance has confirmed your payment and approved the withdrawal. The registrar will finalize it shortly.',
        Colors.teal,
        Icons.account_balance,
      );
    case 'completed':
      return const _StatusInfo(
        'Withdrawal Complete ✅',
        'Your withdrawal has been fully processed and clearance has been granted by the registrar.',
        Colors.green,
        Icons.check_circle,
      );
    case 'rejected':
      return const _StatusInfo(
        'Rejected',
        'Your withdrawal request was rejected. Please contact your department for more information.',
        Colors.red,
        Icons.cancel,
      );
    default:
      return const _StatusInfo(
        'In Progress',
        'Your withdrawal is being processed.',
        Colors.grey,
        Icons.pending,
      );
  }
}

/// Ordered steps in the withdrawal workflow
const _steps = [
  ('Student Request', 'You submit a withdrawal request'),
  ('Department Review', 'Department head reviews academic standing'),
  ('Finance Review', 'Finance confirms payment and calculates settlement'),
  ('Registrar Finalization', 'Registrar marks you as withdrawn'),
];

int _currentStep(String? status) {
  switch (status?.toLowerCase()) {
    case 'requested':
      return 1;
    case 'academic_approved':
      return 2;
    case 'finance_approved':
      return 3;
    case 'completed':
      return 4; // all steps done
    default:
      return 0;
  }
}

class WithdrawalScreen extends StatefulWidget {
  final String? withdrawalStatus;
  final VoidCallback onStatusChanged;

  const WithdrawalScreen({
    super.key,
    required this.withdrawalStatus,
    required this.onStatusChanged,
  });

  @override
  State<WithdrawalScreen> createState() => _WithdrawalScreenState();
}

class _WithdrawalScreenState extends State<WithdrawalScreen> {
  bool _isSubmitting = false;
  late String? _status;

  @override
  void initState() {
    super.initState();
    _status = widget.withdrawalStatus;
  }

  @override
  void didUpdateWidget(WithdrawalScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.withdrawalStatus != widget.withdrawalStatus) {
      _status = widget.withdrawalStatus;
    }
  }

  Future<void> _requestWithdrawal() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Withdrawal Request'),
        content: const Text(
          'Submit a withdrawal request for department and registrar review? '
          'This starts the formal withdrawal workflow.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.orange[700]),
            child: const Text('Submit Request'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _isSubmitting = true);
    try {
      final msg = await DebtService().requestWithdrawal();
      if (!mounted) return;
      setState(() => _status = 'requested');
      widget.onStatusChanged();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.green),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _cancelWithdrawal() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Withdrawal Request'),
        content: const Text(
          'Are you sure you want to cancel your withdrawal request? '
          'You can submit a new one later.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _isSubmitting = true);
    try {
      await DebtService().cancelWithdrawal();
      if (!mounted) return;
      setState(() => _status = null);
      widget.onStatusChanged();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Withdrawal request cancelled.'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = _status != null ? _statusInfo(_status) : null;
    final step = _currentStep(_status);
    final canCancel = _status == 'requested';
    final canRequest = _status == null;

    return Scaffold(
      appBar: AppBar(title: const Text('Withdrawal Request')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Status banner ──────────────────────────────────────────────
          if (info != null)
            Card(
              color: info.color.withValues(alpha: 0.08),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(color: info.color.withValues(alpha: 0.4)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(info.icon, color: info.color, size: 32),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            info.label,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: info.color,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            info.description,
                            style: const TextStyle(fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

          if (info == null)
            Card(
              color: Colors.blue[50],
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(color: Colors.blue.shade200),
              ),
              child: const Padding(
                padding: EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.blue),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'You have not submitted a withdrawal request yet. '
                        'Use the button below to start the process.',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          const SizedBox(height: 20),

          // ── Progress stepper ───────────────────────────────────────────
          const Text(
            'Withdrawal Workflow',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 12),
          ..._steps.asMap().entries.map((e) {
            final i = e.key;
            final (title, desc) = e.value;
            final isDone = i < step;
            final isActive = i == step && _status != null;
            return _StepRow(
              index: i + 1,
              title: title,
              description: desc,
              isDone: isDone,
              isActive: isActive,
            );
          }),

          const SizedBox(height: 24),

          // ── Policy note ────────────────────────────────────────────────
          Card(
            color: Colors.amber[50],
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.amber.shade200),
            ),
            child: const Padding(
              padding: EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.policy_outlined, color: Colors.amber),
                      SizedBox(width: 8),
                      Text(
                        'Policy Note',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  SizedBox(height: 8),
                  Text(
                    '• Withdrawal requires department head approval first.\n'
                    '• Finance will calculate a prorated settlement based on your enrollment period.\n'
                    '• You must pay the full settlement balance before finance approves.\n'
                    '• The registrar finalizes the withdrawal after finance approval.\n'
                    '• You can only cancel your request while it is pending department review.',
                    style: TextStyle(fontSize: 13, height: 1.6),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          // ── Action button ──────────────────────────────────────────────
          if (_isSubmitting)
            const Center(child: CircularProgressIndicator())
          else if (canRequest)
            FilledButton.icon(
              onPressed: _requestWithdrawal,
              icon: const Icon(Icons.exit_to_app),
              label: const Text('Submit Withdrawal Request'),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.orange[700],
                minimumSize: const Size.fromHeight(48),
              ),
            )
          else if (canCancel)
            OutlinedButton.icon(
              onPressed: _cancelWithdrawal,
              icon: const Icon(Icons.cancel_outlined, color: Colors.red),
              label: const Text(
                'Cancel Withdrawal Request',
                style: TextStyle(color: Colors.red),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.red),
                minimumSize: const Size.fromHeight(48),
              ),
            )
          else
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.lock_outline, color: Colors.grey),
                  SizedBox(width: 8),
                  Text(
                    'Withdrawal is in progress — no changes allowed',
                    style: TextStyle(color: Colors.grey),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  final int index;
  final String title;
  final String description;
  final bool isDone;
  final bool isActive;

  const _StepRow({
    required this.index,
    required this.title,
    required this.description,
    required this.isDone,
    required this.isActive,
  });

  @override
  Widget build(BuildContext context) {
    final color = isDone
        ? Colors.green
        : isActive
            ? Colors.blue
            : Colors.grey[400]!;

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              CircleAvatar(
                radius: 14,
                backgroundColor: color.withValues(alpha: isDone || isActive ? 1 : 0.25),
                child: isDone
                    ? const Icon(Icons.check, size: 16, color: Colors.white)
                    : Text(
                        '$index',
                        style: TextStyle(
                          color: isActive ? Colors.white : Colors.grey[600],
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
              ),
              if (index < _steps.length)
                Container(
                  width: 2,
                  height: 32,
                  color: isDone ? Colors.green[200] : Colors.grey[200],
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isActive ? Colors.blue[800] : null,
                    ),
                  ),
                  Text(
                    description,
                    style: const TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
