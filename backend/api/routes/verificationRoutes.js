const express = require('express');
const { getPendingPayments, verifyPayment } = require('../controllers/verificationController');

const router = express.Router();

// UC-04: Get pending payments for verification
router.get('/pending', getPendingPayments);

// UC-04: Verify (approve/reject) a payment
router.post('/verify', verifyPayment);

module.exports = router;
