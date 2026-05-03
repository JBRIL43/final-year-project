const https = require('https');
const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');
const { sendPaymentNotification } = require('../utils/notifications');

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || '';
const CHAPA_BASE_URL = process.env.CHAPA_BASE_URL || 'https://api.chapa.co/v1';

// ── helpers ──────────────────────────────────────────────────────────────────

function chapaRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(CHAPA_BASE_URL + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
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

  if (result.rows.length > 0) {
    return result.rows[0];
  }
  return null;
}

// ── POST /api/payment/chapa/initialize ───────────────────────────────────────
exports.initializePayment = async (req, res) => {
  try {
    const { amount, returnUrl } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const student = await resolveStudentFromRequest(req);
    if (!student) {
      return res.status(401).json({ error: 'Unable to resolve student' });
    }

    // Generate a unique transaction reference
    const txRef = `HU-${student.student_id}-${Date.now()}`;

    const payload = {
      amount: String(Number(amount).toFixed(2)),
      currency: 'ETB',
      email: student.email || `student${student.student_id}@hu.edu.et`,
      first_name: (student.full_name || 'Student').split(' ')[0],
      last_name: (student.full_name || 'Student').split(' ').slice(1).join(' ') || 'User',
      tx_ref: txRef,
      callback_url: `${process.env.API_BASE_URL || 'https://final-year-project-r2h8.onrender.com'}/api/payment/chapa/webhook`,
      return_url: returnUrl || 'hudebt://payment/return',
      customization: {
        title: 'HU Student Debt Payment',
        description: `Debt payment for student ${student.student_id}`,
      },
    };

    const chapaRes = await chapaRequest('POST', '/transaction/initialize', payload);

    if (chapaRes.status !== 200 || chapaRes.body?.status !== 'success') {
      console.error('Chapa initialize failed:', chapaRes.body);
      return res.status(502).json({
        error: chapaRes.body?.message || 'Failed to initialize Chapa payment',
      });
    }

    // Store the pending transaction reference so we can verify it later
    await pool.query(
      `INSERT INTO public.payment_history
         (debt_id, amount, payment_method, transaction_ref, status)
       SELECT dr.debt_id, $2, 'CHAPA', $3, 'PENDING'
       FROM public.debt_records dr
       WHERE dr.student_id = $1
       ORDER BY dr.debt_id DESC LIMIT 1`,
      [student.student_id, Number(amount), txRef]
    );

    res.json({
      success: true,
      checkoutUrl: chapaRes.body.data?.checkout_url,
      txRef,
    });
  } catch (error) {
    console.error('Chapa initialize error:', error);
    res.status(500).json({ error: 'Failed to initialize payment' });
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

    // Verify with Chapa
    const chapaRes = await chapaRequest('GET', `/transaction/verify/${encodeURIComponent(txRef)}`);

    if (chapaRes.status !== 200) {
      return res.status(502).json({ error: 'Failed to verify payment with Chapa' });
    }

    const txData = chapaRes.body?.data;
    const chapaStatus = String(txData?.status || '').toLowerCase();

    if (chapaStatus !== 'success') {
      // Update the pending record to failed if Chapa says it failed
      if (chapaStatus === 'failed' || chapaStatus === 'cancelled') {
        await pool.query(
          `UPDATE public.payment_history
           SET status = 'FAILED'
           WHERE transaction_ref = $1`,
          [txRef]
        );
      }
      return res.status(400).json({
        error: `Payment not successful. Chapa status: ${chapaStatus}`,
        chapaStatus,
      });
    }

    // Payment succeeded — update the record to PENDING (awaiting finance approval)
    // and update the debt balance
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
        `Your Chapa payment of ETB ${payment.amount} was received and is pending finance verification.`,
        {
          type: 'CHAPA_PAYMENT_RECEIVED',
          paymentId: String(payment.payment_id),
          txRef,
        }
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
          'New Chapa Payment Needs Review',
          `A Chapa payment of ETB ${payment.amount} was received and is pending verification.`,
          { type: 'PAYMENT_PENDING_VERIFICATION', paymentId: String(payment.payment_id) }
        );
      }
    } catch (notifErr) {
      console.error('Finance notification failed:', notifErr);
    }

    res.json({
      success: true,
      message: 'Payment verified and recorded. Pending finance approval.',
      paymentId: payment.payment_id,
      amount: payment.amount,
      txRef,
    });
  } catch (error) {
    console.error('Chapa verify error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};
