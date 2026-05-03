const express = require('express');
const { recordPayment, getStudentPayments } = require('../controllers/paymentController');
const chapaController = require('../controllers/chapaController');

const router = express.Router();

// UC-03: Record new payment (manual)
router.post('/record', recordPayment);

// Student payment status/history
router.get('/history', getStudentPayments);

// Finance: submit/update proof URL for a manual payment
router.patch('/:paymentId/proof', async (req, res) => {
  const { paymentId } = req.params;
  const { proof_url } = req.body;
  if (!proof_url) return res.status(400).json({ error: 'proof_url is required' });
  const pool = require('../config/db');
  try {
    const result = await pool.query(
      `UPDATE public.payment_history SET proof_url = $1 WHERE payment_id = $2 RETURNING payment_id`,
      [proof_url, Number(paymentId)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update proof' });
  }
});

// Chapa payment integration
router.post('/chapa/initialize', chapaController.initializePayment);
router.post('/chapa/verify', chapaController.verifyPayment);

// Finance-side: verify a Chapa transaction by txRef and auto-approve if confirmed
router.get('/chapa/verify-admin', (req, res) => chapaController.verifyAndApproveAdmin(req, res));

// Chapa return URL — user lands here after completing payment in browser
// The app detects the resume lifecycle event and calls /verify automatically
router.get('/chapa/return', (req, res) => {
  const { tx_ref, status } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Payment ${status === 'success' ? 'Complete' : 'Status'}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#f4f7fb}
      .card{background:#fff;border-radius:16px;padding:32px;max-width:360px;margin:auto;box-shadow:0 4px 20px rgba(0,0,0,.08)}
      h2{color:${status === 'success' ? '#16a34a' : '#dc2626'}}p{color:#555}</style></head>
      <body><div class="card">
        <h2>${status === 'success' ? '✅ Payment Received' : '⚠️ Payment Status'}</h2>
        <p>${status === 'success'
          ? 'Your payment was received. Please return to the HU Student Debt app to confirm.'
          : 'Please return to the app to check your payment status.'}</p>
        ${tx_ref ? `<p style="font-size:12px;color:#999">Ref: ${tx_ref}</p>` : ''}
      </div></body>
    </html>
  `);
});

module.exports = router;
