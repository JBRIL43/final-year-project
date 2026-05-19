const express = require('express');
const { getPendingPayments, verifyPayment } = require('../controllers/verificationController');
const { authenticateRequest, requireRoles } = require('../middleware/auth');

const router = express.Router();

// Finance-only. Canonical admin UI also uses /api/admin/payments/* — keep this for mobile finance app.
router.use(authenticateRequest, requireRoles(['admin', 'finance']));

router.get('/pending', getPendingPayments);
router.post('/verify', verifyPayment);

module.exports = router;
