# HU Student Debt System

A student debt management platform for Hawassa University (Ethiopia). It tracks cost-sharing obligations under Ethiopian Council of Ministers Regulation No. 447/2024, which requires students to repay a portion of tuition, boarding, and food costs after graduation.

## Project Structure

```
/
├── backend/          # Node.js / Express API server
├── frontend/
│   └── mobile_app/   # Flutter student-facing mobile app
├── student-debt-admin/  # React admin web dashboard
└── docs/             # Setup and configuration guides
```

## Core Features

### Student Mobile App (Flutter)

- **Debt overview** — current balance, payment history, repayment progress
- **Cost-sharing statement** — per-year breakdown of tuition share (15%), boarding, and food costs; exportable as PDF
- **Payment submission** — Chapa online payment or manual receipt upload
- **Push notifications** — Firebase Cloud Messaging alerts for payment status changes and withdrawal clearance
- **Withdrawal request** — students can submit, track, and cancel a formal withdrawal request through a multi-stage approval workflow; once withdrawn, a status banner on the dashboard shows whether clearance has been granted or an outstanding balance remains

### Admin Web Dashboard (React)

- **Payment review queue** — finance staff approve or reject submitted payments
- **Student management** — view and manage student records
- **Cost configuration** — manage tuition and living cost parameters
- **Graduate management** — track graduates and delinquent accounts
- **ERCA export** — generate tax authority export files
- **Semester amounts** — configure per-semester cost amounts
- **Withdrawal approvals** — department heads and registrar process withdrawal requests
- **Finance reports** — revenue and payment analytics
- **Fayda integration** — national ID verification
- **Admin user management** — manage staff accounts and roles

## Withdrawal Workflow

The withdrawal feature follows a four-stage approval process:

| Stage | Actor | Description |
|-------|-------|-------------|
| 1. Student Request | Student | Submits withdrawal request via mobile app |
| 2. Department Review | Department Head | Reviews academic standing and approves/rejects |
| 3. Finance Review | Finance Officer | Confirms payment settlement, approves, sets enrollment to `WITHDRAWN`, and triggers final debt settlement calculation |
| 4. Registrar Finalization | Registrar | Performs final clearance check, closes the withdrawal record, and sends a push notification to the student when clearance is granted |

**Status values**: `requested` → `academic_approved` → `finance_approved` → `rejected`

Students can cancel their request only while it is in the `requested` (pending department review) state.

> **Note**: Enrollment status is set to `WITHDRAWN` and the final settlement amount is calculated during the Finance Review step (stage 3). The registrar clearance in stage 4 operates on an already-settled record; if the settlement calculation failed at stage 3, the registrar step will retry it automatically.

## User Roles

| Role | Description |
|------|-------------|
| `student` | Views debt, submits payments, requests withdrawal |
| `finance` | Reviews and approves/rejects payments |
| `registrar` | Finalizes withdrawal requests |
| `department_head` | First-stage withdrawal approval |
| `admin` | Full system access |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Node.js, Express 4.x, PostgreSQL |
| Mobile app | Flutter (Dart SDK ^3.11) |
| Admin dashboard | React, TypeScript, Material UI |
| Auth | Firebase Auth + Firebase Admin SDK |
| Push notifications | Firebase Cloud Messaging |
| Payments | Chapa |

## Backend Utilities

### Schema Cache (`backend/api/utils/schemaCache.js`)

A process-level cache for `information_schema.columns` lookups. Every authenticated request previously fired one or more column-existence queries (~5–15 ms each on Supabase/Render). `schemaCache` queries each table once per process lifetime and serves subsequent calls from an in-memory `Map`.

```js
const { hasColumn, getColumns, invalidateSchema } = require('../utils/schemaCache');

// Check a single column — zero DB round-trips after first call per table
const ok = await hasColumn('payment_history', 'student_id');

// Get a filtered Set of present column names
const cols = await getColumns('users', ['user_id', 'department', 'role']);

// Invalidate after running a migration that adds columns
invalidateSchema('students', 'debt_records');
```

Call `invalidateSchema()` (no arguments) to clear the entire cache, or pass specific table names to evict only those entries.

## Getting Started

### Backend

```bash
cd backend && npm install
cd backend/api && node server.js
```

Requires a `.env` file in `backend/api/` — see `backend/api/.env` for required variables (DB connection, Firebase, CORS origin).

Key environment variables:

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 3000) |
| `SUPABASE_DATABASE_URL` | Supabase PostgreSQL connection string (`sslmode=require`) |
| `DATABASE_URL` | Optional fallback PostgreSQL connection string |
| `CLIENT_URL` | Allowed CORS origin (admin dashboard URL) |
| `CHAPA_SECRET_KEY` | Chapa API secret key |
| `CHAPA_PUBLIC_KEY` | Chapa API public key |
| `CHAPA_ENCRYPTION_KEY` | Chapa encryption key |
| `API_BASE_URL` | Public URL of this server (used as Chapa callback and return URLs; defaults to the Render production URL) |
| `SYNC_SECRET` | Secret for the Firebase→Supabase sync endpoints (default: `hu-sync-2025`) |

### Render Deployment

The backend is configured for deployment on [Render](https://render.com) via `backend/render.yaml`. The service runs as a Node.js web service with:

- **Build command**: `npm install`
- **Start command**: `node api/server.js`
- **Port**: `10000`
- **Production URL**: `https://final-year-project-r2h8.onrender.com`

Set `SUPABASE_DATABASE_URL` in the deployment environment to point to the Supabase project database. The app will prefer `SUPABASE_DATABASE_URL` and fall back to `DATABASE_URL` if needed.

### Flutter Mobile App

```bash
cd frontend/mobile_app
flutter pub get
flutter run
```

### Admin Dashboard

```bash
cd student-debt-admin
npm install
npm run dev
```

## Auth API

### Firebase → database user sync

Syncs all Firebase Auth users into the `public.users` table. New users are inserted with role `student`; assign staff roles manually in the database after sync.

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/auth/sync-firebase-users` | Header `x-sync-secret: <SYNC_SECRET>` |

`SYNC_SECRET` is **required in production** (server fails to start if unset). There is no GET route — do not put secrets in URLs.

**Example**:
```bash
curl -X POST https://<host>/api/auth/sync-firebase-users \
  -H "x-sync-secret: $SYNC_SECRET"
```

**Response**:
```json
{
  "success": true,
  "summary": { "total": 42, "inserted": 3, "updated": 1, "skipped": 38, "errors": 0 },
  "details": { "inserted": [...], "updated": [...], "skipped": [...], "errors": [] }
}
```

> **Note**: Generate a long random `SYNC_SECRET` in Render → Environment. Rotate if the old default was ever used in production.

## Payment API

### Manual Payment Proof

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/payment/:paymentId/proof` | Updates the proof URL for a manual payment record |

**Request body**:
```json
{ "proof_url": "https://example.com/receipt.jpg" }
```

**Response** (on success):
```json
{ "success": true }
```

Returns `400` if `proof_url` is missing, `404` if the payment record does not exist.

### Chapa Payment API

Two endpoints handle the Chapa online payment flow:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/payment/chapa/initialize` | Creates a Chapa transaction and returns a `checkoutUrl` for the student to complete payment |
| `POST` | `/api/payment/chapa/verify` | Verifies a completed transaction with Chapa and records it as pending finance approval |

**Initialize request body**:
```json
{ "amount": 1500.00, "returnUrl": "https://your-app-return-url" }
```

> If `returnUrl` is omitted, the server falls back to `<API_BASE_URL>/api/payment/chapa/return`. The Chapa callback URL is always set to `<API_BASE_URL>/api/payment/chapa/webhook`. Both default to the Render production URL when `API_BASE_URL` is not set.

**Initialize response** (on success):
```json
{ "success": true, "checkoutUrl": "https://checkout.chapa.co/...", "txRef": "HU-123-1234567890" }
```

On failure the response includes the error message returned by Chapa (or a gateway error if Chapa is unreachable). If `CHAPA_SECRET_KEY` is not configured the endpoint returns `500` immediately.

**Verify request body**:
```json
{ "txRef": "HU-123-1234567890" }
```

Both endpoints resolve the student from the `Authorization: Bearer <token>` header (or `x-firebase-uid` / `x-user-email` fallback headers). A successful verification creates a `PENDING` payment record and sends push notifications to the student and finance officers.

> **Note**: The Chapa base URL (`https://api.chapa.co/v1`) is hardcoded in the controller and is not overridable via environment variable.

## Finance Reports API

All report endpoints are under `/api/admin/reports/` and require `finance` or `admin` role. Each endpoint returns JSON by default; append `.csv` to the path to download a UTF-8 CSV file (BOM-prefixed for Excel compatibility).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/reports/monthly-collections[.csv]` | Approved payment totals grouped by month. Optional `?months=N` param (1–36, default 12). |
| `GET` | `/api/admin/reports/outstanding-debt[.csv]` | Total outstanding debt grouped by campus and program. |
| `GET` | `/api/admin/reports/default-rate[.csv]` | Count of graduated students with overdue balances and the overall default rate. |
| `GET` | `/api/admin/reports/payment-methods[.csv]` | Transaction counts and amounts broken down by payment method (Chapa, bank transfer, etc.). |
| `GET` | `/api/admin/reports/withdrawal-settlements[.csv]` | Students with a withdrawal status or `WITHDRAWN` enrollment, with settlement and remaining balance. |
| `GET` | `/api/admin/reports/semester-costs[.csv]` | Configured tuition, boarding, food, and fee amounts per academic year, campus, and program type. |
| `GET` | `/api/admin/erca/debtors.csv` | ERCA tax-authority export — graduated students with outstanding balances, ordered by debt amount. |

**JSON response shape** (non-CSV):
```json
{ "success": true, "rows": [ ... ] }
```
The `default-rate` endpoint returns `totals` instead of `rows`:
```json
{ "success": true, "totals": { "total_graduates": 120, "delinquent_graduates": 14, "default_rate": 0.1167 } }
```

## Documentation

- [`docs/demo_setup.md`](docs/demo_setup.md) — network and demo environment configuration
