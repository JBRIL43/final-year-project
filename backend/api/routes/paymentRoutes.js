const express = require('express');
const { recordPayment, getStudentPayments } = require('../controllers/paymentController');

const router = express.Router();

// UC-03: Record new payment
router.post('/record', recordPayment);

// Student payment status/history
router.get('/history', getStudentPayments);

module.exports = router;
