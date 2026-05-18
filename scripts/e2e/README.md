E2E DB-driven test for the withdrawal workflow

This script simulates the full withdrawal workflow by running a sequence of SQL operations inside a single transaction and rolling it back at the end so no data is persisted.

Prerequisites
- Node.js installed
- Access to the target PostgreSQL database (set `DATABASE_URL` environment variable to point to it)

Run the test

```bash
DATABASE_URL="postgres://user:pass@host:5432/dbname" node scripts/e2e/withdrawal_workflow_db_test.js
```

Notes
- The script uses the same DB connection code as the backend: `backend/api/config/db.js`. It will log database connection status.
- This test does not exercise API endpoints (auth complexity). It verifies the DB-level workflow and notifications logic.
- If you want a true HTTP E2E test, we can add an authenticated test harness that obtains Firebase tokens or uses test-only auth fallbacks.
