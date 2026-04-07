const express = require('express');
const { getDebtBalance } = require('./debtController');

const router = express.Router();

// UC-02: Get student debt balance
router.get('/balance', getDebtBalance);

module.exports = router;