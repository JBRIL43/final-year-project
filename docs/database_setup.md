# Database Setup Guide

## Creating a New Database (Supabase — Free)

### Step 1: Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Fill in:
   - **Name**: `hu-student-debt`
   - **Database Password**: choose a strong password and save it
   - **Region**: pick the closest to Ethiopia (e.g. EU West)
4. Click **Create new project** and wait ~2 minutes

### Step 2: Get the connection string

1. In your Supabase project, go to **Settings → Database**
2. Scroll to **Connection string** section
3. Select **URI** tab
4. Copy the string — it looks like:
   ```
   postgres://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the password you set in Step 1

### Step 3: Apply the schema

1. In Supabase, go to **SQL Editor**
2. Click **New query**
3. Open `backend/database/complete_schema.sql` from this repo
4. Paste the entire contents into the SQL editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned"

### Step 3b: Seed test data (optional)

To populate the database with test accounts and sample records for development or demo purposes:

1. In Supabase, go to **SQL Editor** → **New query**
2. Open `backend/database/seed_test_data.sql` from this repo
3. Paste the entire contents and click **Run**

This creates the following test accounts (Firebase UIDs are placeholders — they are updated automatically on first login):

| Email | Role | Notes |
|-------|------|-------|
| `admin@hu.edu.et` | `admin` | System administrator |
| `finance@hu.edu.et` | `finance` | Finance officer |
| `registrar@hu.edu.et` | `registrar` | Registrar office |
| `depthead@hu.edu.et` | `department_head` | CS department head |
| `student@hu.edu.et` | `student` | Test student (HU/2021/001) |

The seed also inserts:
- A student record for `HU/2021/001` (Computer Science, Main Campus, enrolled 2021)
- A debt record of **45,000 ETB** for academic year 2024/2025
- Semester amounts for 2024/2025 across Main Campus and IoT Campus programs
- Cost shares for 2024/2025 across common programs

The script is idempotent — re-running it will update existing records rather than fail on conflicts.

### Step 4: Add the connection string to Render

1. Go to [render.com](https://render.com) → your backend service (`final-year-project-r2h8`)
2. Click **Environment** in the left sidebar
3. Find `SUPABASE_DATABASE_URL` (or add it if missing)
4. Set the value to the connection string from Step 2
5. Click **Save Changes**
6. Render will automatically redeploy — wait ~1 minute

### Step 5: Verify

After the redeploy, check the Render logs. You should see:
```
✅ Database connected successfully
🚀 Backend running on http://0.0.0.0:10000
```

If you see `❌ Database connection error`, double-check the connection string has the correct password.

---

## Troubleshooting

### `getaddrinfo ENOTFOUND base`
The `SUPABASE_DATABASE_URL` environment variable is not set on Render.
→ Follow Step 4 above.

### `SSL connection required`
Add `?sslmode=require` to the end of your connection string:
```
postgres://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres?sslmode=require
```

### `password authentication failed`
The password in the connection string is wrong.
→ Go to Supabase → Settings → Database → Reset database password, then update the connection string on Render.

### `relation "students" does not exist`
The schema hasn't been applied yet.
→ Follow Step 3 above.

---

## Schema Overview

The complete schema is in `backend/database/complete_schema.sql`. It creates:

| Table | Purpose |
|-------|---------|
| `users` | All system users with Firebase UID and role |
| `students` | Student profiles with withdrawal and payment fields |
| `debt_records` | Per-student debt with balance tracking |
| `payment_history` | All payment submissions |
| `contracts` | Student cost-sharing contracts |
| `cost_shares` | Cost config by program and year |
| `semester_amounts` | Per-semester amounts by campus |
| `notifications` | In-app push notifications |
| `fayda_config` | National ID integration config |
