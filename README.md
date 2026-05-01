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
- **Withdrawal request** — students can submit, track, and cancel a formal withdrawal request through a multi-stage approval workflow

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

## Getting Started

### Backend

```bash
cd backend && npm install
cd backend/api && node server.js
```

Requires a `.env` file in `backend/api/` — see `backend/api/.env` for required variables (DB connection, Firebase, CORS origin).

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

## Documentation

- [`docs/demo_setup.md`](docs/demo_setup.md) — network and demo environment configuration
