const express = require('express');
const { recordPayment } = require('../controllers/paymentController');

const router = express.Router();

// UC-03: Record new payment
router.post('/record', recordPayment);

module.exports = router;
