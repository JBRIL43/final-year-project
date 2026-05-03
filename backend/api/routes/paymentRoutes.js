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

module.exports = router;
