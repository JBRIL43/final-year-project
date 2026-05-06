# HU Student Debt Management System
## Implementation Report

**Institution:** Hawassa University  
**System Name:** HU Student Debt Management System  
**Regulation:** Ethiopian Council of Ministers Regulation No. 447/2024  
**Academic Year:** 2024/2025

---

## CHAPTER ONE: INTRODUCTION

### 1.1 Background of the Implementation

Hawassa University, like many public universities in Ethiopia, is mandated by the Ethiopian Council of Ministers Regulation No. 447/2024 to track and recover cost-sharing obligations from students. These obligations cover a portion of tuition fees (15% of the full tuition cost), boarding costs, and food expenses incurred during the student's enrollment period. Prior to this system, debt tracking was managed manually through spreadsheets and paper-based records, which led to inconsistencies, delayed notifications, and difficulty in monitoring repayment progress.

The HU Student Debt Management System was implemented to digitize and automate this process. The system provides a student-facing mobile application built with Flutter, an administrative web dashboard built with React and TypeScript, and a RESTful backend API built with Node.js and Express, all backed by a PostgreSQL database. Firebase Authentication is used for identity management, and Firebase Cloud Messaging (FCM) is used for real-time push notifications. Chapa, Ethiopia's leading payment gateway, is integrated to allow students to make online payments directly from the mobile application.

The implementation addresses the following core problems:
- Manual and error-prone debt tracking across hundreds of students
- Lack of a formal, auditable withdrawal workflow
- No real-time payment status visibility for students or finance officers
- Absence of automated financial reporting for compliance and auditing

### 1.2 Methods of Implementation

The system was implemented using a **phased approach strategy**, where each major functional area was developed, tested, and deployed incrementally before moving to the next. The phases were:

1. **Phase 1 — Core Infrastructure:** Database schema design, backend API setup, Firebase authentication integration, and basic student debt balance retrieval.
2. **Phase 2 — Student Mobile App:** Flutter mobile application with debt dashboard, payment submission, cost-sharing statement PDF export, and push notification support.
3. **Phase 3 — Admin Web Dashboard:** React-based admin panel with student management, payment review queue, cost configuration, and graduate management.
4. **Phase 4 — Withdrawal Workflow:** Four-stage withdrawal approval process involving the student, department head, finance officer, and registrar, with automated notifications at each stage.
5. **Phase 5 — Payment Integration:** Chapa payment gateway integration for online payments, with automatic verification and finance approval flow.
6. **Phase 6 — Reporting and Analytics:** Finance report generation with charts, CSV export, and ERCA debtor export for tax authority submission.

This phased approach allowed early testing of core features while more complex features were developed in parallel, reducing integration risk and enabling continuous feedback from stakeholders.

---

## CHAPTER TWO: NAMING, CODING STANDARDS AND CODING PROCESS

### 2.1 Algorithms

**Debt Balance Calculation Algorithm**

The student's displayed balance is calculated based on their payment model:

- `post_graduation`: `displayedBalance = initialAmount - totalApprovedPayments`
- `pre_payment`: `displayedBalance = prePaymentCleared ? 0 : prePaymentAmount`
- `hybrid`: `totalPaid = (initialAmount - currentBalance) + prePaymentAmount`

**Prorated Withdrawal Settlement Algorithm**

When a student withdraws, their final settlement amount is calculated proportionally based on days enrolled:

```
daysEnrolled = withdrawalDate - enrollmentDate
proratedTuition = (tuitionCostPerYear × tuitionSharePercent%) × (daysEnrolled / 300)
proratedBoarding = boardingCostPerYear × (daysEnrolled / 300) 
proratedFood = foodCostPerMonth × ceil(daysEnrolled / 30)
finalSettlement = proratedTuition + proratedBoarding + proratedFood
```

The academic year is assumed to be 300 days. This calculation is performed server-side in `calculateFinalWithdrawalSettlement()` in `registrarRoutes.js`.

**Withdrawal Status State Machine**

```
null → requested → academic_approved → finance_approved → completed
                ↘ rejected
```

Cancellation is only permitted from the `requested` state.

**Notification Delivery Algorithm**

1. Look up `firebase_uid` from `users` table using `user_id`
2. If `firebase_uid` starts with `local-` (fallback UID), attempt to resolve the real UID from Firebase Auth by email and update the database
3. Store notification in `notifications` table using `firebase_uid`
4. If `fcm_token` exists, send FCM push notification via Firebase Admin SDK

### 2.2 Coding Standards

**File Naming**
- Backend route files: `camelCase` with `Routes` suffix (e.g., `studentRoutes.js`, `registrarRoutes.js`)
- Backend controller files: `camelCase` with `Controller` suffix (e.g., `paymentController.js`, `chapaController.js`)
- Flutter screen files: `snake_case` with `_screen` suffix (e.g., `home_screen.dart`, `withdrawal_screen.dart`)
- Flutter service files: `snake_case` with `_service` suffix (e.g., `notification_service.dart`, `finance_service.dart`)
- React components: `PascalCase` (e.g., `PaymentReviewQueue.tsx`, `WithdrawalApprovalDashboard.tsx`)
- React hooks: `camelCase` with `use` prefix (e.g., `usePolling.ts`)

**Variable Declarations**
- JavaScript/TypeScript: `const` for immutable values, `let` for mutable; `var` is not used
- Dart: `final` for runtime constants, `const` for compile-time constants
- Database parameters: always use parameterized queries (`$1`, `$2`, ...) — string interpolation in SQL is strictly prohibited

**Comments**
- Route handlers are prefixed with a comment indicating the HTTP method, path, and purpose (e.g., `// POST /api/student/withdrawal/request — submit student withdrawal request`)
- Complex business logic blocks include inline comments explaining the rationale
- Dart widgets include section comments using `// ── Section Name ──` separators

**Error Handling**
- All async route handlers are wrapped in `try/catch`
- Error responses follow the format: `{ error: 'message', code: 'SCREAMING_SNAKE_CASE' }`
- Database transactions use `BEGIN/COMMIT/ROLLBACK` with explicit client release in `finally` blocks
- Flutter async methods check `if (!mounted) return` before calling `setState` after any `await`

**Database Conventions**
- All tables use the `public` schema
- Column existence is checked via `information_schema.columns` before use, enabling backward compatibility across schema versions
- New columns are added with `ADD COLUMN IF NOT EXISTS` to make migrations idempotent

### 2.3 Coding Process

**Incremental Coding Strategy**

Features were developed incrementally, starting with the minimum viable implementation and adding complexity in subsequent iterations. For example, the withdrawal workflow began as a simple status flag and evolved into a four-stage approval process with notifications, settlement calculations, and finance approval gates.

**Source-Code Build Process**

- Backend: No build step required; Node.js runs CommonJS modules directly. The server is started with `node api/server.js`.
- Flutter: `flutter pub get` installs dependencies; `flutter build apk` produces the Android release build.
- Admin Dashboard: Vite is used as the build tool. `npm run build` produces an optimized static bundle in `student-debt-admin/build/`.

**Schema-Safe Coding**

A recurring pattern throughout the backend is checking for column existence before querying, using a shared `getAvailableColumns(tableName, columns)` helper. This allows the application to run correctly across different database schema versions without requiring all migrations to be applied simultaneously.

**Auto-Healing Patterns**

Several endpoints include self-healing logic:
- Missing `proof_url` column: auto-created with `ADD COLUMN IF NOT EXISTS` on first use
- Missing `finance_withdrawal_approved` column: auto-created during the finance approval flow
- Stale local Firebase UIDs: resolved to real UIDs via Firebase Auth lookup by email

---

## CHAPTER THREE: TESTING PROCESS

### 3.1 Test Plan

The testing plan for the HU Student Debt Management System covers the following areas:

| Test Area | Scope | Priority |
|-----------|-------|----------|
| Authentication | Firebase token verification, role resolution | High |
| Debt balance calculation | All three payment models | High |
| Payment submission | Chapa flow, manual receipt, bank transfer | High |
| Withdrawal workflow | All four stages, cancellation, notifications | High |
| Finance reports | All six report types, CSV export | Medium |
| Notification delivery | FCM push, in-app notification storage | Medium |
| Role-based access control | All protected routes | High |
| Schema compatibility | Column existence checks, fallback expressions | Medium |

### 3.2 Test Case Design

**Test Case 1: Student Debt Balance — Post-Graduation Model**

| Field | Value |
|-------|-------|
| Test ID | TC-001 |
| Description | Verify correct balance display for post-graduation payment model |
| Input | Student with `initial_amount = 45,000`, `current_balance = 30,000` |
| Expected Output | `currentBalance = 30,000`, `totalPaid = 15,000` |
| Status | Pass |

**Test Case 2: Chapa Payment Initialization**

| Field | Value |
|-------|-------|
| Test ID | TC-002 |
| Description | Verify Chapa checkout URL is returned for valid amount |
| Input | `amount = 5000`, valid Firebase token |
| Expected Output | `{ success: true, checkoutUrl: "https://checkout.chapa.co/...", txRef: "HU-..." }` |
| Invalid Input | `amount = -100` |
| Expected Error | `400: Valid amount is required` |

**Test Case 3: Withdrawal Request — Cancel Before Approval**

| Field | Value |
|-------|-------|
| Test ID | TC-003 |
| Description | Student can cancel withdrawal only when status is `requested` |
| Input | Student with `withdrawal_status = 'requested'` |
| Expected Output | `withdrawal_status = null`, success response |
| Invalid Input | Student with `withdrawal_status = 'academic_approved'` |
| Expected Error | `400: Request cannot be cancelled at this stage` |

**Test Case 4: Finance Approval — Balance Must Be Zero**

| Field | Value |
|-------|-------|
| Test ID | TC-004 |
| Description | Finance cannot approve withdrawal if student has outstanding balance |
| Input | Student with `current_balance = 5000` |
| Expected Error | `400: Student still has an outstanding balance of 5000 ETB` |
| Valid Input | Student with `current_balance = 0` |
| Expected Output | `{ success: true, message: "Finance approval granted..." }` |

**Test Case 5: Role-Based Access Control**

| Field | Value |
|-------|-------|
| Test ID | TC-005 |
| Description | Finance officer cannot access registrar-only endpoints |
| Input | Finance token accessing `POST /api/registrar/students/:id/clear` |
| Expected Output | `403: Forbidden: insufficient role permissions` |

### 3.3 Test Procedures

**Unit Testing**

Individual functions such as `normalizePaymentModel()`, `computeDaysBetween()`, `normalizeRole()`, and `toCsv()` were tested in isolation by passing known inputs and verifying outputs match expected values.

**Integration Testing**

API endpoints were tested end-to-end using HTTP requests with valid and invalid Firebase tokens. The full withdrawal workflow was tested by sequentially calling each stage endpoint and verifying the `withdrawal_status` field progressed correctly through `requested → academic_approved → finance_approved → completed`.

**System Testing**

The complete system was tested with the Flutter mobile app connected to the live backend on Render. Test scenarios included:
- A student submitting a Chapa payment and verifying the balance update after finance approval
- A department head approving a withdrawal and confirming the student received a push notification
- A finance officer generating a monthly collections report and downloading the CSV

**Acceptance Testing**

The system was demonstrated to university stakeholders using a demo environment configured per `docs/demo_setup.md`. Feedback was collected and incorporated into subsequent iterations.

---

## CHAPTER FOUR: SECURITY DESIGN AND IMPLEMENTATION

### 4.1 Database Level Security

**Connection Security**

The PostgreSQL database connection uses environment variables for all credentials (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`). These are never committed to source control. On Render, they are stored as encrypted environment variables in the service dashboard.

**Parameterized Queries**

All database queries use parameterized statements (`$1`, `$2`, ...) via the `pg` library's connection pool. This prevents SQL injection attacks entirely, as user-supplied values are never interpolated into query strings.

**Role and Privilege Assignment**

The database user (`DB_USER`) is granted only the minimum required privileges: `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on the `public` schema tables. `DROP`, `CREATE`, and `TRUNCATE` privileges are not granted to the application user. Schema migrations are applied manually by a privileged database administrator.

**Schema Isolation**

All application tables reside in the `public` schema. The `information_schema` is used read-only for column existence checks. No dynamic DDL is executed in production except for `ADD COLUMN IF NOT EXISTS` statements, which are idempotent and safe.

### 4.2 System Level Security

**Authentication**

Every protected API endpoint verifies the Firebase ID token sent in the `Authorization: Bearer <token>` header using the Firebase Admin SDK. The token is verified cryptographically against Google's public keys. Expired or tampered tokens are rejected with a `401 Unauthorized` response.

**Role-Based Access Control (RBAC)**

The `authenticateRequest` middleware resolves the authenticated user's role from the `users` table and attaches it to `req.user`. The `requireRoles([...])` middleware then enforces that only users with the specified roles can access each route. Roles are normalized to lowercase canonical strings (`admin`, `finance`, `registrar`, `department_head`, `student`) via `normalizeRole()` to prevent case-sensitivity bypass attacks.

**CORS Policy**

The Express server uses the `cors` package with an explicit allowlist of origins (`CLIENT_URL`, the admin dashboard URL, and `localhost` for development). Requests from unlisted origins are rejected.

**Sensitive Data Protection**

- Firebase service account credentials (`firebase-adminsdk.json`) are excluded from version control via `.gitignore`
- The `.env` file containing database credentials and API keys is excluded from version control
- Chapa API keys are stored as environment variables and never logged or returned in API responses
- FCM tokens stored in the `users` table are treated as sensitive and are not exposed in any API response

**Transport Security**

All production traffic is served over HTTPS. The backend is deployed on Render, which enforces TLS termination. The Flutter app communicates exclusively with the HTTPS production URL.

---

## CHAPTER FIVE: SYSTEM DEPLOYMENT STRATEGY

### 5.1 Deployment Strategies

The system uses a **cloud-based deployment** strategy with separate services for the backend API and the admin web dashboard, both hosted on [Render](https://render.com).

**Backend API Deployment**

- **Platform:** Render Web Service (Node.js)
- **Repository:** GitHub (`JBRIL43/final-year-project`, `master` branch)
- **Build command:** `npm install`
- **Start command:** `node api/server.js`
- **Port:** `10000`
- **Production URL:** `https://final-year-project-r2h8.onrender.com`
- **Configuration:** `backend/render.yaml` defines all environment variables. Database credentials are set manually in the Render dashboard.

**Admin Dashboard Deployment**

- **Platform:** Render Static Site
- **Build command:** `npm install --include=dev && npm run build`
- **Publish directory:** `build`
- **Configuration:** `student-debt-admin/render.yaml`
- **Production URL:** `https://student-debt-admin.onrender.com`

**Mobile App Distribution**

The Flutter mobile app is built as an Android APK using `flutter build apk`. For the demo and testing phase, the APK is distributed directly to devices. For production release, the app would be published to the Google Play Store.

**Database**

PostgreSQL is hosted on a managed cloud database service. Schema migrations are applied manually in order using the SQL files in `backend/database/`. Each migration file is named descriptively (e.g., `add_withdrawal_workflow_fields.sql`) and is designed to be idempotent using `IF NOT EXISTS` clauses.

**Deployment Workflow**

1. Developer pushes code to the `master` branch on GitHub
2. Render automatically detects the push and triggers a new build
3. The build runs `npm install` and starts the server
4. If the build fails, Render keeps the previous deployment active (zero-downtime rollback)

### 5.2 User Training Strategies

**Finance Officers**

Finance officers are trained on:
- Logging into the admin dashboard using their institutional email
- Reviewing and approving/rejecting pending payments in the Payment Review Queue
- Using the "Verify with Chapa" button for online payments vs. the manual approve/reject flow for bank transfers and receipts
- Generating finance reports and exporting CSV files for compliance
- Processing withdrawal approvals after confirming student payment settlement

**Department Heads**

Department heads are trained on:
- Accessing the Department Dashboard to view withdrawal requests from their department
- Approving or rejecting withdrawal requests with appropriate notes
- Understanding the four-stage withdrawal workflow and their role in stage 2

**Registrars**

Registrars are trained on:
- Using the Registrar Dashboard to view students pending final clearance
- Processing final withdrawal clearance after finance approval
- Understanding that clearance triggers an automatic push notification to the student

**Students**

Students are trained on:
- Installing the mobile app and logging in with their university email
- Viewing their current debt balance and payment history
- Submitting payments via Chapa or manual receipt upload
- Requesting and tracking withdrawal status through the app
- Understanding the withdrawal workflow stages and what each status means

### 5.3 User Manual

**Student Mobile App**

1. **Login:** Open the app and sign in with your Hawassa University email and password.
2. **Dashboard:** The home screen shows your current balance, repayment progress, and recent payment activity.
3. **Make a Payment:**
   - Tap the green `+` button on the dashboard
   - Select "Chapa" for online payment or "Bank Transfer"/"Receipt" for manual payment
   - Enter the amount and tap "Pay with Chapa" or "Submit Payment"
   - For Chapa: you will be redirected to the Chapa checkout page; complete payment and return to the app
4. **View Statement:** Tap "Statement" in the bottom navigation to see your full cost breakdown and download a PDF
5. **Notifications:** Tap "Notifications" to see payment status updates and withdrawal notifications
6. **Withdrawal Request:** Tap "More" → "Withdrawal Request" to submit, track, or cancel a withdrawal request. If your enrollment has been set to `WITHDRAWN`, a status banner appears at the top of the dashboard: red while an outstanding balance remains or final clearance is pending, and green once the registrar has granted full clearance.
7. **Change Password:** Tap "More" → "Change Password"

**Admin Dashboard (Finance Officer)**

1. **Login:** Navigate to the admin dashboard URL and sign in with your finance officer credentials
2. **Payment Review:** Click "Payment Review" in the sidebar to see pending payments; use "Verify & Approve" for Chapa payments or "Approve"/"Reject" for manual payments
3. **Withdrawal Approvals:** Click "Withdrawal Approvals" to see students awaiting finance sign-off; view the financial statement and click "Approve" when payment is confirmed
4. **Finance Reports:** Click "Finance Reports", select a report type from the dropdown, click "Generate Report" to preview, then "Export CSV" to download

### 5.4 Installation Strategies

**Backend**

```bash
# 1. Clone the repository
git clone https://github.com/JBRIL43/final-year-project.git
cd final-year-project

# 2. Install backend dependencies
cd backend && npm install

# 3. Configure environment variables
cp backend/api/.env.example backend/api/.env
# Edit .env with your database credentials, Firebase config, and Chapa keys

# 4. Apply database migrations (in order)
psql -U <db_user> -d <db_name> -f backend/database/complete_schema.sql
# Apply additional migration files as needed

# 5. Start the server
cd backend/api && node server.js
```

**Admin Dashboard**

```bash
cd student-debt-admin
npm install
npm run dev        # Development
npm run build      # Production build
```

**Flutter Mobile App**

```bash
cd frontend/mobile_app
flutter pub get
flutter run        # Run on connected device
flutter build apk  # Build release APK
```

**Prerequisites**

| Component | Requirement |
|-----------|-------------|
| Node.js | v18 or higher |
| PostgreSQL | v14 or higher |
| Flutter | SDK ^3.11 |
| Firebase project | With Authentication and Cloud Messaging enabled |
| Chapa account | Test or live API keys |

---

## CHAPTER SIX: SYSTEM MAINTENANCE STRATEGY

### 6.1 System Modification Strategy

**Adding New Features**

New features are added by:
1. Creating a new SQL migration file in `backend/database/` with an `add_` prefix
2. Adding the corresponding backend route in the appropriate routes file
3. Updating the Flutter mobile app or React admin dashboard as needed
4. Testing in the development environment before deploying to production

The schema-safe coding pattern (`getAvailableColumns` + `ADD COLUMN IF NOT EXISTS`) ensures that new database columns can be added without breaking existing functionality during the transition period.

**Modifying Existing Features**

Existing features are modified by:
1. Updating the relevant route handler or controller
2. If the database schema changes, creating a new migration file (never modifying existing ones)
3. Updating the corresponding frontend components
4. Deploying via a Git push to the `master` branch, which triggers an automatic Render rebuild

**Upgrading Dependencies**

Dependencies are upgraded periodically using:
- `npm outdated` and `npm update` for the backend and admin dashboard
- `flutter pub outdated` and `flutter pub upgrade` for the mobile app

Major version upgrades are tested in a separate branch before merging to `master`.

**Policy Updates**

When the Ethiopian Council of Ministers updates cost-sharing regulations, the system can be updated by:
- Modifying the `semester_amounts` table via the admin dashboard's Semester Amounts configuration
- Adjusting the `tuition_share_percent` in the `contracts` table for affected students
- No code changes are required for standard policy parameter updates

### 6.2 Backup and Recovery Strategy

**Database Backup**

The PostgreSQL database is backed up using the following strategy:

- **Automated daily backups:** The managed cloud database provider performs automated daily snapshots with a 7-day retention period
- **Manual backups before migrations:** Before applying any schema migration, a manual backup is taken using `pg_dump`:
  ```bash
  pg_dump -U <db_user> -h <db_host> -d <db_name> -F c -f backup_$(date +%Y%m%d).dump
  ```
- **Backup verification:** Backups are periodically restored to a test environment to verify integrity

**Recovery Strategy**

In the event of data loss or corruption:

1. **Point-in-time recovery:** The managed database provider supports point-in-time recovery to any point within the retention window
2. **Manual restore from dump:**
   ```bash
   pg_restore -U <db_user> -h <db_host> -d <db_name> -F c backup_YYYYMMDD.dump
   ```
3. **Application recovery:** Since the backend is stateless (all state is in the database), recovery requires only restoring the database and restarting the Render service

**Code Backup**

All source code is version-controlled in Git and hosted on GitHub. Every commit represents a recoverable state. The `master` branch is protected and requires pull request review before merging.

**Firebase Data**

Firebase Authentication user records are managed by Google and are not subject to local backup. FCM tokens stored in the `users` table are recovered automatically when students log in again after a database restore, as the app re-registers the token on startup.

---

## CHAPTER SEVEN: CONCLUSION AND RECOMMENDATION

### 7.1 Conclusion

The HU Student Debt Management System has been successfully implemented as a comprehensive, multi-platform solution for managing student cost-sharing obligations at Hawassa University. The system digitizes the entire debt lifecycle — from initial debt assignment through payment collection, withdrawal processing, and final clearance — replacing manual, error-prone processes with an automated, auditable workflow.

Key achievements of the implementation include:

- A Flutter mobile application that gives students real-time visibility into their debt balance, payment history, and withdrawal status, with integrated Chapa online payment support
- A React-based administrative dashboard that enables finance officers, department heads, and registrars to manage their respective responsibilities through role-based access control
- A four-stage withdrawal approval workflow with automated notifications at each stage, ensuring all stakeholders are informed in real time
- A comprehensive finance reporting module with live data previews, charts, and CSV export for compliance and auditing purposes
- A robust, schema-safe backend architecture that supports incremental database migrations without downtime

The system is deployed on Render's cloud platform with automatic deployments from GitHub, ensuring that updates are delivered reliably and with minimal operational overhead.

### 7.2 Recommendations

1. **Implement a dedicated mobile app for admin roles:** Currently, department heads, finance officers, and registrars use the web dashboard. A dedicated mobile interface would improve accessibility, particularly for department heads who may need to approve withdrawal requests while away from a desktop.

2. **Add SMS notification support:** While push notifications via FCM work well for students with the app installed, SMS notifications would ensure that students who have uninstalled the app or have connectivity issues still receive critical alerts about payment approvals and withdrawal status changes.

3. **Integrate with the university's Student Information System (SIS):** Currently, student records are imported manually via Excel. A direct API integration with the university's SIS would eliminate manual data entry and ensure student records are always up to date.

4. **Implement automated debt reconciliation scheduling:** The current debt reconciliation process is triggered manually. A scheduled job (e.g., using a cron service) that runs reconciliation monthly would ensure balances are always accurate without manual intervention.

5. **Add biometric authentication to the mobile app:** For enhanced security, fingerprint or face recognition authentication should be added to the Flutter app using the `local_auth` package, reducing the risk of unauthorized access to sensitive financial data.

6. **Expand payment method support:** While Chapa covers most online payment scenarios, adding support for additional Ethiopian payment methods such as Telebirr and HelloCash would increase payment accessibility for students across different regions.

7. **Implement audit logging:** A dedicated audit log table should be created to record all sensitive operations (payment approvals, withdrawal status changes, clearance grants) with timestamps and actor information, supporting compliance and dispute resolution.

---

## References

1. Ethiopian Council of Ministers Regulation No. 447/2024 — Cost-Sharing in Higher Education
2. Hawassa University Academic Regulations and Student Financial Policy
3. Chapa Developer Documentation — https://developer.chapa.co
4. Firebase Documentation — Authentication and Cloud Messaging — https://firebase.google.com/docs
5. Flutter Documentation — https://docs.flutter.dev
6. PostgreSQL 14 Documentation — https://www.postgresql.org/docs/14/
7. Express.js 4.x API Reference — https://expressjs.com/en/4x/api.html
8. React Documentation — https://react.dev
9. Material UI v9 Documentation — https://mui.com

---

## Appendix

### Appendix A: Database Schema Overview

| Table | Purpose |
|-------|---------|
| `users` | All system users (students, finance, registrar, admin) with Firebase UID and role |
| `students` | Student academic and financial profile, withdrawal status |
| `debt_records` | Per-student debt records with initial and current balance |
| `payment_history` | All payment submissions with status, method, and proof URL |
| `contracts` | Student cost-sharing contracts with tuition share percentage |
| `cost_shares` | Cost configuration by program and academic year |
| `semester_amounts` | Per-semester cost amounts by campus and program type |
| `notifications` | In-app notifications stored by Firebase UID |

### Appendix B: API Endpoint Summary

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/debt/balance` | student | Get student debt balance |
| POST | `/api/payment/record` | student | Submit manual payment |
| POST | `/api/payment/chapa/initialize` | student | Initialize Chapa payment |
| POST | `/api/payment/chapa/verify` | student | Verify Chapa payment |
| POST | `/api/student/withdrawal/request` | student | Submit withdrawal request |
| DELETE | `/api/student/withdrawal/request` | student | Cancel withdrawal request |
| POST | `/api/department/students/:id/withdrawal/approve` | department_head | Approve/reject withdrawal |
| POST | `/api/registrar/students/:id/withdrawal/finance-approve` | finance | Finance approve withdrawal |
| POST | `/api/registrar/students/:id/clear` | registrar | Grant final clearance |
| GET | `/api/admin/reports/monthly-collections` | finance/admin | Monthly collections report |
| GET | `/api/admin/reports/outstanding-debt` | finance/admin | Outstanding debt report |
| GET | `/api/notifications` | student | Get notifications |

### Appendix C: Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default 3000) |
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PORT` | Yes | PostgreSQL port |
| `DB_NAME` | Yes | Database name |
| `DB_USER` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `CLIENT_URL` | Yes | Admin dashboard URL (CORS allowlist) |
| `CHAPA_SECRET_KEY` | Yes | Chapa secret API key |
| `CHAPA_PUBLIC_KEY` | Yes | Chapa public API key |
| `CHAPA_ENCRYPTION_KEY` | Yes | Chapa encryption key |
| `API_BASE_URL` | Yes | Public backend URL (used in Chapa callbacks) |
