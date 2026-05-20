/**
 * schemaCache.js
 *
 * Process-level cache for information_schema.columns lookups.
 *
 * Why: Every authenticated request was firing one or more
 * `SELECT column_name FROM information_schema.columns WHERE table_name = ...`
 * queries. On Supabase/Render each round-trip costs ~5–15 ms, and with 20+
 * call-sites the overhead stacks up fast.
 *
 * The schema is stable at runtime — columns are only added via migrations,
 * never during normal operation. So we query once per table per process
 * lifetime and serve from a plain Map after that.
 *
 * Usage:
 *   const { hasColumn, getColumns } = require('../utils/schemaCache');
 *
 *   // true/false — zero DB round-trips after first call per table
 *   const ok = await hasColumn('payment_history', 'student_id');
 *
 *   // Set<string> of column names present in the table
 *   const cols = await getColumns('users', ['user_id', 'department', 'role']);
 */

const pool = require('../config/db');

// table_name → Promise<Set<string>>
// Storing the Promise (not the resolved value) means concurrent callers
// that arrive before the first query resolves all await the same Promise
// instead of firing duplicate queries.
const _cache = new Map();

/**
 * Return a Set of column names that exist in `tableName`.
 * If `wantedColumns` is provided, only those columns are checked/returned
 * (reduces the result set; the cache key is still the full table).
 *
 * @param {string} tableName
 * @param {string[]} [wantedColumns]  optional filter
 * @returns {Promise<Set<string>>}
 */
async function getColumns(tableName, wantedColumns) {
  if (!_cache.has(tableName)) {
    // Store the Promise immediately so concurrent callers share it.
    _cache.set(
      tableName,
      pool
        .query(
          `SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = $1`,
          [tableName]
        )
        .then((result) => new Set(result.rows.map((r) => r.column_name)))
        .catch((err) => {
          // On error, evict so the next call retries.
          _cache.delete(tableName);
          throw err;
        })
    );
  }

  const allColumns = await _cache.get(tableName);

  if (!wantedColumns || wantedColumns.length === 0) {
    return allColumns;
  }

  // Return only the intersection with wantedColumns.
  const filtered = new Set();
  for (const col of wantedColumns) {
    if (allColumns.has(col)) filtered.add(col);
  }
  return filtered;
}

/**
 * Convenience: check whether a single column exists.
 *
 * @param {string} tableName
 * @param {string} columnName
 * @returns {Promise<boolean>}
 */
async function hasColumn(tableName, columnName) {
  const cols = await getColumns(tableName);
  return cols.has(columnName);
}

/**
 * Invalidate the cache for one or more tables.
 * Call this after running a migration that adds columns.
 *
 * @param {...string} tableNames
 */
function invalidateSchema(...tableNames) {
  if (tableNames.length === 0) {
    _cache.clear();
  } else {
    for (const t of tableNames) {
      _cache.delete(t);
    }
  }
}

module.exports = { getColumns, hasColumn, invalidateSchema };
