const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'student_debt_system',
  user: process.env.DB_USER || 'db_user',
  password: process.env.DB_PASSWORD || 'db_user1',
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('✅ Database connected successfully');
  }
});

module.exports = pool;