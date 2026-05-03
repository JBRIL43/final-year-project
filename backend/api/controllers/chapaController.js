const https = require('https');
const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');
const { sendPaymentNotification } = require('../utils/notifications');

const CHAPA_BASE_URL = 'https://api.chapa.co/v1';

// Read key at call time so Render env vars are always picked up
function getChapaKey() {
  const key = process.env.CHAPA_SECRET_KEY || '';
  if (!key) console.warn('CHAPA_SECRET_KEY is not set');
  return key;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function chapaRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(CHAPA_BASE_URL + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Bearer ${getChapaKey()}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function resolveStudentFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  let firebaseUid = null;
  let email = null;

  if (token && firebaseAdmin && firebaseAdmin.apps.length > 0) {
    try {
      const decoded = await firebaseAdmin.auth().verifyIdToken(token);
      firebaseUid = decoded.uid || null;
      email = decoded.email || null;
    } catch (e) {
      console.warn('Chapa: token verification failed:', e.message);
    }
  }

  if (!firebaseUid && req.headers['x-firebase-uid']) {
    firebaseUid = String(req.headers['x-firebase-uid']).trim();
  }
  if (!email && req.headers['x-user-email']) {
    email = String(req.headers['x-user-email']).trim().toLowerCase();
  }

  if (!firebaseUid && !email) return null;

  const result = await pool.query(
    `SELECT s.student_id, s.user_id, u.email, u.full_name
     FROM public.users u
     JOIN public.students s ON s.user_id = u.user_id
     WHERE ($1::text IS NOT NULL AND u.firebase_uid = $1)
        OR ($2::text IS NOT NULL AND LOWER(TRIM(u.email)) = LOWER(TRIM($2)))
     ORDER BY CASE WHEN $1::text IS NOT NULL AND u.firebase_uid = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [firebaseUid, email]
  );

  return result.rows[0] || null;
}

// ── POST /api/payment/chapa/initialize ───────────────────────────────────────
exports.initializePayment = async (req, res) => {
  try {
    const { amount, returnUrl } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (!getChapaKey()) {
      return res.status(500).json({ error: 'Payment gateway not configured. Contact support.' });
    }

    const student = await resolveStudentFromRequest(req);
    if (!student) {
      return res.status(401).json({ error: 'Unable to resolve student' });
    }

    const txRef = `HU-${student.student_id}-${Date.now()}`;
    const apiBase = process.env.API_BASE_URL || 'https://final-year-project-r2h8.onrender.com';

    // Split full_name safely
    const nameParts = (student.full_name || 'Student User').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Student';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    const payload = {
      amount: String(Number(amount).toFixed(2)),
      currency: 'ETB',
      email: student.email || `student${student.student_id}@hu.edu.et`,
      first_name: firstName,
      last_name: lastName,
      tx_ref: txRef,
      callback_url: `${apiBase}/api/payment/chapa/webhook`,
      return_url: returnUrl || `${apiBase}/api/payment/chapa/return`,
      customization: {
        title: 'HU Debt Payment',
        description: `Ref ${txRef}`,
      },
    };

    console.log('Chapa initialize payload:', JSON.stringify(payload));

    const chapaRes = await chapaRequest('POST', '/transaction/initialize', payload);

    console.log('Chapa response:', chapaRes.status, JSON.stringify(chapaRes.body));

    if (chapaRes.status !== 200 || chapaRes.body?.status !== 'success') {
      const errMsg = typeof chapaRes.body === 'object'
        ? (chapaRes.body?.message || JSON.stringify(chapaRes.body))
        : String(chapaRes.body);
      return res.status(502).json({ error: errMsg });
    }

    // Find the debt record for this student
    const debtRes = await pool.query(
      `SELECT debt_id FROM public.debt_records
       WHERE student_id = $1
       ORDER BY debt_id DESC LIMIT 1`,
      [student.student_id]
    );

    if (debtRes.rows.length === 0) {
      return res.status(404).json({ error: 'No debt record found for this student' });
    }

    const debtId = debtRes.rows[0].debt_id;

    // Check if payment_history has a student_id column
    const colCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'payment_history'
       AND column_name = 'student_id' LIMIT 1`
    );
    const hasStudentId = colCheck.rows.length > 0;

    if (hasStudentId) {
      await pool.query(
        `INSERT INTO public.payment_history
           (debt_id, student_id, amount, payment_method, transaction_ref, status)
         VALUES ($1, $2, $3, 'CHAPA', $4, 'PENDING')`,
        [debtId, student.student_id, Number(amount), txRef]
      );
    } else {
      await pool.query(
        `INSERT INTO public.payment_history
           (debt_id, amount, payment_method, transaction_ref, status)
         VALUES ($1, $2, 'CHAPA', $3, 'PENDING')`,
        [debtId, Number(amount), txRef]
      );
    }

    res.json({
      success: true,
      checkoutUrl: chapaRes.body.data?.checkout_url,
      txRef,
    });
  } catch (error) {
    console.error('Chapa initialize error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    res.status(500).json({ error: `Failed to initialize payment: ${error.message}` });
  }
};

// ── POST /api/payment/chapa/verify ───────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const { txRef } = req.body;

    if (!txRef) {
      return res.status(400).json({ error: 'txRef is required' });
    }

    const student = await resolveStudentFromRequest(req);
    if (!student) {
      return res.status(401).json({ error: 'Unable to resolve student' });
    }

    const chapaRes = await chapaRequest('GET', `/transaction/verify/${encodeURIComponent(txRef)}`);

    console.log('Chapa verify response:', chapaRes.status, JSON.stringify(chapaRes.body));

    if (chapaRes.status !== 200) {
      return res.status(502).json({ error: 'Failed to verify payment with Chapa' });
    }

    const txData = chapaRes.body?.data;
    const chapaStatus = String(txData?.status || '').toLowerCase();

    if (chapaStatus !== 'success') {
      if (chapaStatus === 'failed' || chapaStatus === 'cancelled') {
        await pool.query(
          `UPDATE public.payment_history SET status = 'FAILED' WHERE transaction_ref = $1`,
          [txRef]
        );
      }
      return res.status(400).json({
        error: `Payment not successful. Status: ${chapaStatus}`,
        chapaStatus,
      });
    }

    const updateResult = await pool.query(
      `UPDATE public.payment_history
       SET status = 'PENDING'
       WHERE transaction_ref = $1
       RETURNING payment_id, debt_id, amount`,
      [txRef]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment record not found for this transaction' });
    }

    const payment = updateResult.rows[0];

    // Notify student
    try {
      await sendPaymentNotification(
        student.user_id,
        'Chapa Payment Received 💳',
        `Your payment of ETB ${payment.amount} was received and is pending finance verification.`,
        { type: 'CHAPA_PAYMENT_RECEIVED', paymentId: String(payment.payment_id), txRef }
      );
    } catch (notifErr) {
      console.error('Chapa payment notification failed:', notifErr);
    }

    // Notify finance officers
    try {
      const financeUsers = await pool.query(
        `SELECT user_id FROM public.users WHERE UPPER(role) IN ('FINANCE', 'FINANCE_OFFICER')`
      );
      for (const fu of financeUsers.rows) {
        await sendPaymentNotification(
          fu.user_id,
          'New Chapa Payment',
          `A Chapa payment of ETB ${payment.amount} is pending verification.`,
          { type: 'PAYMENT_PENDING_VERIFICATION', paymentId: String(payment.payment_id) }
        );
      }
    } catch (notifErr) {
      console.error('Finance notification failed:', notifErr);
    }

    res.json({
      success: true,
      message: 'Payment verified. Pending finance approval.',
      paymentId: payment.payment_id,
      amount: payment.amount,
      txRef,
    });
  } catch (error) {
    console.error('Chapa verify error:', error.message);
    res.status(500).json({ error: `Failed to verify payment: ${error.message}` });
  }
};

// ── GET /api/payment/chapa/verify-admin ──────────────────────────────────────
// Finance verifies a Chapa transaction — auto-approves and updates debt if confirmed
exports.verifyAndApproveAdmin = async (req, res) => {
  const { txRef, paymentId } = req.query;
  try {
    const chapaRes = await chapaRequest('GET', `/transaction/verify/${encodeURIComponent(txRef)}`);

    if (chapaRes.status !== 200) {
      return res.status(502).json({ error: 'Could not reach Chapa', status: 'unknown', verified: false });
    }

    const txData = chapaRes.body?.data;
    const chapaStatus = String(txData?.status || '').toLowerCase();

    if (chapaStatus !== 'success') {
      return res.json({ success: true, status: chapaStatus, verified: false });
    }

    // Auto-approve: update payment to SUCCESS and reduce debt balance
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const paymentRes = await client.query(
        `SELECT payment_id, debt_id, amount FROM public.payment_history
         WHERE payment_id = $1 FOR UPDATE`,
        [Number(paymentId)]
      );

      if (paymentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Payment not found', verified: false });
      }

      const payment = paymentRes.rows[0];

      // Store Chapa receipt URL as proof_url so finance can view it later
      const chapaRef = txData?.reference || String(txRef);
      const receiptUrl = `https://chapa.link/payment-receipt/${encodeURIComponent(chapaRef)}`;

      // Ensure proof_url column exists
      await client.query(`
        ALTER TABLE public.payment_history
        ADD COLUMN IF NOT EXISTS proof_url TEXT
      `);

      await client.query(
        `UPDATE public.payment_history
         SET status = 'SUCCESS', proof_url = COALESCE(proof_url, $2)
         WHERE payment_id = $1`,
        [payment.payment_id, receiptUrl]
      );

      // Reduce debt balance
      const debtRes = await client.query(
        `SELECT current_balance FROM public.debt_records WHERE debt_id = $1 FOR UPDATE`,
        [payment.debt_id]
      );
      if (debtRes.rows.length > 0) {
        const newBalance = Math.max(0, Number(debtRes.rows[0].current_balance) - Number(payment.amount));
        await client.query(
          `UPDATE public.debt_records SET current_balance = $1, last_updated = NOW() WHERE debt_id = $2`,
          [newBalance, payment.debt_id]
        );
      }

      await client.query('COMMIT');

      // Notify student
      try {
        const userRes = await pool.query(
          `SELECT u.user_id FROM public.debt_records dr
           JOIN public.students s ON dr.student_id = s.student_id
           JOIN public.users u ON s.user_id = u.user_id
           WHERE dr.debt_id = $1 LIMIT 1`,
          [payment.debt_id]
        );
        if (userRes.rows.length > 0) {
          await sendPaymentNotification(
            userRes.rows[0].user_id,
            'Chapa Payment Approved 💰',
            `Your Chapa payment of ETB ${payment.amount} has been verified and your balance updated.`,
            { type: 'CHAPA_PAYMENT_APPROVED', paymentId: String(payment.payment_id) }
          );
        }
      } catch (notifErr) {
        console.error('Chapa admin verify notification failed:', notifErr);
      }

      res.json({ success: true, status: 'success', verified: true, receiptUrl });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Chapa admin verify error:', error.message);
    res.status(500).json({ error: error.message, verified: false });
  }
};
