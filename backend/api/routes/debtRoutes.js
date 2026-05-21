const express = require('express');
const { getDebtBalance } = require('../controllers/dbController');
const { authenticateRequest, validateOwnership } = require('../middleware/auth');

const router = express.Router();

// UC-02: Get student debt balance (ownership inherent in getDebtBalance controller via resolveStudentFromRequest)
router.get('/balance', authenticateRequest, validateOwnership, getDebtBalance);

module.exports = router;