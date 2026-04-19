function normalizeRole(rawRole) {
  const normalized = String(rawRole || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')

  if (['ADMIN', 'ADMINISTRATOR', 'SUPER_ADMIN'].includes(normalized)) return 'admin'
  if (['FINANCE', 'FINANCE_OFFICER', 'FINANCE_MANAGER'].includes(normalized)) return 'finance'
  if (['REGISTRAR', 'REGISTRY'].includes(normalized)) return 'registrar'
  if (['DEPARTMENT_HEAD', 'DEPT_HEAD', 'DEPARTMENT_CHAIR'].includes(normalized)) return 'department_head'
  return 'student'
}

module.exports = {
  normalizeRole,
}
