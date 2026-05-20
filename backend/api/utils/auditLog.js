const { recordSystemLog, ensureSystemLogsTable } = require('./systemLog');

/** @deprecated Use system_logs table via recordSystemLog */
async function ensureAuditLogsTable() {
  return ensureSystemLogsTable();
}

async function auditLog(req, action, entity = {}, oldValue = null, newValue = null, metadata = {}) {
  return recordSystemLog({
    req,
    action,
    entity,
    oldValue,
    newValue,
    metadata: { ...metadata, source: 'auditLog' },
    statusCode: null,
    httpMethod: req?.method,
    httpPath: req?.originalUrl?.split('?')[0],
    requestId: req?.id,
  });
}

module.exports = {
  ensureAuditLogsTable,
  auditLog,
};
