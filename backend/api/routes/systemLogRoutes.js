const express = require('express');
const systemLogController = require('../controllers/systemLogController');
const { authenticateRequest, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateRequest, requireRoles(['admin']));

router.get('/summary', systemLogController.getSummary);
router.get('/', systemLogController.listLogs);
router.get('/:id', systemLogController.getLogById);

module.exports = router;
