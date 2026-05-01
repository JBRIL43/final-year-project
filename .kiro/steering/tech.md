# Tech Stack

## Backend

- **Runtime**: Node.js (CommonJS modules)
- **Framework**: Express.js 4.x
- **Database**: PostgreSQL (via `pg` connection pool)
- **Auth**: Firebase Admin SDK — verifies Firebase ID tokens on every protected request
- **Push notifications**: Firebase Cloud Messaging (server-side via `firebase-admin`)
- **Environment config**: `dotenv`
- **CORS**: Configured with an allowlist; credentials enabled

### Key Backend Libraries

| Package | Purpose |
|---------|---------|
| `express` ^4.18 | HTTP server and routing |
| `pg` ^8.11 | PostgreSQL client / connection pool |
| `firebase-admin` ^13 | Token verification, FCM |
| `cors` ^2.8 | Cross-origin request handling |
| `dotenv` ^16 | Environment variable loading |

## Frontend (Mobile)

- **Framework**: Flutter (Dart SDK ^3.11)
- **State management**: `setState` / local widget state (no external state manager)
- **Auth**: Firebase Auth (`firebase_auth` ^6)
- **Push notifications**: `firebase_messaging` ^16
- **HTTP**: `http` ^1.6
- **PDF generation**: `pdf` ^3.10 + `printing` ^5.12
- **Localization/formatting**: `intl` ^0.18
- **UI**: Material 3 (`useMaterial3: true`), `cupertino_icons`

### Flutter Dev Dependencies

- `flutter_lints` ^6 — lint rules enforced via `analysis_options.yaml`
- `flutter_test` — unit and widget testing

## Database

- PostgreSQL with a `public` schema
- Schema managed via incremental SQL migration files in `backend/database/`
- Connection pool configured in `backend/api/config/db.js`

## Authentication Flow

1. Client obtains a Firebase ID token
2. Token sent as `Authorization: Bearer <token>` header
3. `authenticateRequest` middleware verifies token via Firebase Admin, resolves the app user from `public.users`, and attaches `req.user` (with normalized role) to the request
4. Role-based access enforced via `requireRoles([...])` middleware

## Common Commands

### Backend

```bash
# Install dependencies
cd backend && npm install

# Start the API server
cd backend/api && node server.js

# The server listens on PORT env var (default 3000), bound to 0.0.0.0
```

### Flutter (Mobile)

```bash
# Install dependencies
cd frontend/mobile_app && flutter pub get

# Run on connected device / emulator
flutter run

# Build Android APK
flutter build apk

# Run tests
flutter test

# Analyze code (lint)
flutter analyze
```

### Database

SQL migration files are applied manually in order. Files are in `backend/database/` and named descriptively (e.g., `add_contracts_table.sql`). Apply with `psql` or your preferred PostgreSQL client.

## Environment Variables (Backend)

Defined in `backend/api/.env`. Key variables:

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 3000) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| `CLIENT_URL` | Allowed CORS origin |

## API Base URL (Flutter)

Configured via `ApiConfig` in `frontend/mobile_app/lib/services/api_config.dart`. The base URL can be overridden at build time with `--dart-define=API_BASE_URL=<url>`. Default points to the production Render deployment.
