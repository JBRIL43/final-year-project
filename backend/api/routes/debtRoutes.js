const express = require('express');
const { getDebtBalance } = require('../controllers/dbController');
const { authenticateRequest } = require('../middleware/auth');

const router = express.Router();

// UC-02: Get student debt balance
router.get('/balance', authenticateRequest, getDebtBalance);

module.exports = router;