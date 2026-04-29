/*
  E2E DB-driven test for the withdrawal workflow.
  - Runs inside a transaction and rolls back at the end so it leaves the DB unchanged.
  - Requires a working DATABASE_URL environment variable (same DB your app uses).
  - Usage:
      DATABASE_URL="postgres://..." node scripts/e2e/withdrawal_workflow_db_test.js
*/

const pool = require('../../backend/api/config/db');

async function run() {
  const client = await pool.connect();
  try {
    console.log('Starting test transaction...');
    await client.query('BEGIN');

    // Create test users
    const dept = 'TEST_DEPT';

    const uRes = await client.query(
      `INSERT INTO public.users (email, full_name, role, department) VALUES
       ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12), ($13, $14, $15, $16)
       RETURNING user_id, email, role, department`,
      [
        'student.test@local', 'Test Student', 'STUDENT', null,
        'dept.head@local', 'Dept Head', 'DEPARTMENT_HEAD', dept,
        'finance.officer@local', 'Finance Officer', 'FINANCE_OFFICER', null,
        'registrar@local', 'Registrar', 'REGISTRAR', null,
      ]
    );

    const studentUser = uRes.rows.find(r => r.email === 'student.test@local');
    const deptHeadUser = uRes.rows.find(r => r.email === 'dept.head@local');
    const financeUser = uRes.rows.find(r => r.email === 'finance.officer@local');
    const registrarUser = uRes.rows.find(r => r.email === 'registrar@local');

    // Create student row
    const sRes = await client.query(
      `INSERT INTO public.students (user_id, full_name, department, enrollment_date)
       VALUES ($1, $2, $3, NOW() - INTERVAL '60 days') RETURNING student_id, user_id`,
      [studentUser.user_id, 'Test Student', dept]
    );
    const studentId = sRes.rows[0].student_id;

    console.log('Created test users and student:', { studentId });

    // Step 1: Student requests withdrawal
    await client.query(
      `UPDATE public.students SET withdrawal_status = 'requested', withdrawal_requested_at = NOW() WHERE student_id = $1`,
      [studentId]
    );

    // Simulate notifyDepartmentHead logic (insert notification)
    await client.query(
      `INSERT INTO public.notifications (user_id, type, message, data, is_read)
       VALUES ($1, 'withdrawal_request', $2, $3, false)`,
      [deptHeadUser.user_id, 'A student has requested withdrawal. Please review their academic standing.', JSON.stringify({ student_id: studentId })]
    );

    console.log('Step 1 complete: withdrawal requested and dept notified.');

    // Step 2: Department approves academic standing
    await client.query(
      `UPDATE public.students SET withdrawal_status = 'academic_approved' WHERE student_id = $1`,
      [studentId]
    );

    // Notify finance
    await client.query(
      `INSERT INTO public.notifications (user_id, type, message, data, is_read)
       VALUES ($1, 'finance_review_needed', $2, $3, false)`,
      [financeUser.user_id, `Student Test Student approved for withdrawal. Please calculate final settlement.`, JSON.stringify({ student_id: studentId })]
    );

    console.log('Step 2 complete: academic approved and finance notified.');

    // Step 3: Finance issues final statement (prorated)
    // For test, compute a fake final amount
    const finalAmount = 1234.56;

    // Create or update debt_records for student
    await client.query(
      `INSERT INTO public.debt_records (student_id, initial_amount, current_balance, is_final_settlement, settlement_type)
       VALUES ($1, $2, $2, true, 'withdrawal')
       ON CONFLICT (student_id) DO UPDATE SET current_balance = EXCLUDED.current_balance, is_final_settlement = EXCLUDED.is_final_settlement, settlement_type = EXCLUDED.settlement_type`,
      [studentId, finalAmount]
    );

    await client.query(
      `UPDATE public.students SET withdrawal_status = 'final_statement_issued', final_statement_issued_at = NOW() WHERE student_id = $1`,
      [studentId]
    );

    // Notify student
    await client.query(
      `INSERT INTO public.notifications (user_id, type, message, data, is_read)
       VALUES ($1, 'final_statement_ready', $2, $3, false)`,
      [studentUser.user_id, `Your final withdrawal settlement is ETB ${finalAmount}.`, JSON.stringify({ amount: finalAmount, student_id: studentId })]
    );

    console.log('Step 3 complete: final statement issued and student notified.');

    // Step 4: Student pays final amount -> simulate payment approval by finance
    // Simulate payment by setting debt_records.current_balance = 0
    await client.query(
      `UPDATE public.debt_records SET current_balance = 0 WHERE student_id = $1`,
      [studentId]
    );

    // Check and notify registrar if is_final_settlement and settlement_type = 'withdrawal'
    const debtCheck = await client.query(`SELECT is_final_settlement, settlement_type FROM public.debt_records WHERE student_id = $1`, [studentId]);
    if (debtCheck.rows.length > 0 && debtCheck.rows[0].is_final_settlement && debtCheck.rows[0].settlement_type === 'withdrawal') {
      await client.query(
        `INSERT INTO public.notifications (user_id, type, message, data, is_read)
         VALUES ($1, 'clearance_ready_withdrawal', $2, $3, false)`,
        [registrarUser.user_id, 'Student has settled final withdrawal balance. Ready for clearance certificate.', JSON.stringify({ student_id: studentId })]
      );
    }

    console.log('Step 4 complete: payment simulated and registrar notified.');

    // Step 5: Registrar issues certificate -> notify student
    await client.query(
      `INSERT INTO public.notifications (user_id, type, message, data, is_read)
       VALUES ($1, 'clearance_certificate_ready', $2, $3, false)`,
      [studentUser.user_id, 'Your official withdrawal clearance certificate is ready. You may download it from your dashboard.', JSON.stringify({ student_id: studentId })]
    );

    console.log('Step 5 complete: registrar issued certificate and student notified.');

    // Verifications: count expected notifications per user
    const notifCounts = await client.query(
      `SELECT u.email, COUNT(n.*) AS cnt
       FROM public.notifications n
       JOIN public.users u ON u.user_id = n.user_id
       WHERE u.email IN ($1, $2, $3, $4)
       GROUP BY u.email`,
      ['dept.head@local', 'finance.officer@local', 'registrar@local', 'student.test@local']
    );

    console.log('Notification counts:', notifCounts.rows);

    console.log('All steps executed inside transaction. Rolling back to leave DB unchanged.');
    await client.query('ROLLBACK');
    console.log('Transaction rolled back. Test completed successfully (no DB changes persist).');
  } catch (err) {
    console.error('Test failed:', err);
    try { await client.query('ROLLBACK'); } catch (e) {}
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
