const express = require('express');
const { recordPayment, getStudentPayments } = require('../controllers/paymentController');
const chapaController = require('../controllers/chapaController');

const router = express.Router();

// UC-03: Record new payment (manual)
router.post('/record', recordPayment);

// Student payment status/history
router.get('/history', getStudentPayments);

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
