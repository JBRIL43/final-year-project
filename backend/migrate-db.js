const { Pool } = require('pg');
require('dotenv').config();

const DEFAULT_TABLE_ORDER = [
  'fayda_config',
  'semester_amounts',
  'users',
  'students',
  'debt_records',
  'payment_history',
  'contracts',
  'cost_shares',
  'historical_payments',
  'notifications',
  'cost_sharing_statement_audit',
];

function normalizeConnectionString(value, label) {
  if (!value) {
    throw new Error(`${label} is required`);
  }

  const trimmed = value.trim();
  if (
    !trimmed ||
    /^base$/i.test(trimmed) ||
    /^postgres:\/\/base$/i.test(trimmed) ||
    /<user>|<password>|<host>|<database>|your[_-]?secure[_-]?password|placeholder/i.test(trimmed)
  ) {
    throw new Error(`${label} is missing or still set to a placeholder`);
  }

  return trimmed;
}

function buildPool(connectionString, label) {
  return new Pool({
    connectionString: normalizeConnectionString(connectionString, label),
    ssl: {
      rejectUnauthorized: false,
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
  });
}

function parseTables() {
  const tables = process.env.MIGRATION_TABLES;
  if (!tables) {
    return DEFAULT_TABLE_ORDER;
  }

  return tables
    .split(',')
    .map((table) => table.trim())
    .filter(Boolean);
}

async function getExistingTables(pool, tableNames) {
  const result = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [tableNames]
  );

  return new Set(result.rows.map((row) => row.table_name));
}

async function getTableColumns(pool, tableName) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

async function getAutoIncrementColumns(pool, tableName) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND (column_default LIKE 'nextval(%' OR is_identity = 'YES')
     ORDER BY ordinal_position`,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

function quoteIdent(ident) {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

async function migrateTable(sourcePool, targetPool, tableName) {
  const columns = await getTableColumns(sourcePool, tableName);

  if (columns.length === 0) {
    console.log(`ℹ️  Skipping ${tableName} (no columns found)`);
    return;
  }

  const selectSql = `SELECT ${columns.map(quoteIdent).join(', ')} FROM ${quoteIdent(tableName)}`;
  const { rows } = await sourcePool.query(selectSql);

  if (rows.length === 0) {
    console.log(`ℹ️  No rows to migrate for ${tableName}`);
    return;
  }

  const insertSql = `INSERT INTO ${quoteIdent(tableName)} (${columns.map(quoteIdent).join(', ')}) VALUES (${columns
    .map((_, index) => `$${index + 1}`)
    .join(', ')})`;

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((column) => row[column]);
    await targetPool.query(insertSql, values);
    inserted += 1;
  }

  const autoIncrementColumns = await getAutoIncrementColumns(targetPool, tableName);
  for (const columnName of autoIncrementColumns) {
    const sequenceResult = await targetPool.query(
      `SELECT pg_get_serial_sequence($1, $2) AS sequence_name`,
      [`public.${tableName}`, columnName]
    );

    const sequenceName = sequenceResult.rows[0]?.sequence_name;
    if (!sequenceName) {
      continue;
    }

    await targetPool.query(
      `SELECT setval($1, COALESCE((SELECT MAX(${quoteIdent(columnName)}) FROM ${quoteIdent(tableName)}), 1), true)`,
      [sequenceName]
    );
  }

  console.log(`✅ Migrated ${inserted} row(s) from ${tableName}`);
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

  const sourcePool = buildPool(sourceUrl, 'SOURCE_DATABASE_URL');
  const targetPool = buildPool(targetUrl, 'TARGET_DATABASE_URL');

  const tablesToMigrate = parseTables();
  const existingTables = await getExistingTables(sourcePool, tablesToMigrate);

  console.log('🔍 Tables requested:', tablesToMigrate.join(', '));
  console.log('🔍 Tables found in source:', Array.from(existingTables).join(', ') || 'none');

  try {
    for (const tableName of tablesToMigrate) {
      if (!existingTables.has(tableName)) {
        console.log(`ℹ️  Skipping missing table ${tableName}`);
        continue;
      }

      await migrateTable(sourcePool, targetPool, tableName);
    }

    console.log('🎉 Migration completed successfully');
  } finally {
    await Promise.all([sourcePool.end(), targetPool.end()]);
  }
}

main().catch((error) => {
  console.error('❌ Migration failed:', {
    message: error.message,
    code: error.code || null,
    stack: error.stack,
  });
  process.exit(1);
});