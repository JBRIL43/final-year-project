# Project Structure

```
/
├── backend/
│   ├── api/                        # Express API server
│   │   ├── config/
│   │   │   ├── db.js               # PostgreSQL connection pool (pg)
│   │   │   └── firebaseAdmin.js    # Firebase Admin SDK init
│   │   ├── controllers/            # Route handler logic
│   │   │   ├── dbController.js     # Student debt balance, payment model logic
│   │   │   ├── paymentController.js
│   │   │   └── verificationController.js
│   │   ├── middleware/
│   │   │   └── auth.js             # authenticateRequest + requireRoles
│   │   ├── routes/                 # One file per resource
│   │   │   ├── authRoutes.js
│   │   │   ├── debtRoutes.js
│   │   │   ├── paymentRoutes.js
│   │   │   ├── adminRoutes.js
│   │   │   ├── studentRoutes.js
│   │   │   ├── registrarRoutes.js
│   │   │   ├── departmentRoutes.js
│   │   │   ├── notificationRoutes.js
│   │   │   ├── faydaRoutes.js
│   │   │   ├── semesterAmountsRoutes.js
│   │   │   ├── userRoutes.js
│   │   │   └── verificationRoutes.js
│   │   ├── utils/
│   │   │   ├── roles.js            # normalizeRole() — canonical role strings
│   │   │   └── notifications.js    # FCM push helpers
│   │   ├── .env                    # Local environment variables (not committed)
│   │   ├── firebase-adminsdk.json  # Firebase service account (not committed)
│   │   └── server.js               # App entry point, middleware wiring, route mounting
│   ├── database/                   # Incremental SQL migration files
│   └── package.json
│
├── frontend/
│   └── mobile_app/                 # Flutter application
│       ├── lib/
│       │   ├── main.dart           # App entry, Firebase init, MaterialApp
│       │   ├── firebase_options.dart
│       │   ├── screens/            # Full-page UI widgets
│       │   │   ├── home_screen.dart          # Main student dashboard (tabs)
│       │   │   ├── login_screen.dart         # Student login
│       │   │   ├── finance_login_screen.dart # Finance officer login
│       │   │   ├── finance_dashboard_screen.dart
│       │   │   ├── payment_screen.dart
│       │   │   ├── notifications_screen.dart
│       │   │   └── account_screen.dart
│       │   ├── services/           # API communication layer
│       │   │   ├── api_config.dart           # Base URL resolution
│       │   │   ├── auth_service.dart
│       │   │   ├── finance_service.dart
│       │   │   ├── notification_service.dart
│       │   │   └── student_statement_service.dart
│       │   ├── service/            # Legacy service directory (debt_service.dart)
│       │   │   └── debt_service.dart
│       │   └── utils/
│       │       └── cost_statement_pdf.dart   # PDF generation logic
│       ├── assets/images/          # Static image assets
│       ├── android/                # Android platform project
│       ├── ios/                    # iOS platform project
│       └── pubspec.yaml
│
├── docs/
│   └── demo_setup.md               # Network/demo configuration guide
└── .kiro/
    └── steering/                   # AI assistant steering rules
```

## Backend Conventions

- **Route mounting**: All routes are prefixed with `/api/<resource>` in `server.js`
- **Auth pattern**: Protected routes use `authenticateRequest` then `requireRoles([...])` as middleware chain
- **Controller pattern**: Business logic lives in `controllers/`; routes only wire middleware and call controller exports
- **DB queries**: Always use parameterized queries (`$1`, `$2`, ...) — never string interpolation
- **Role normalization**: Always use `normalizeRole()` from `utils/roles.js`; never compare raw role strings
- **Error responses**: Return `{ error: 'message', code: 'SCREAMING_SNAKE_CASE' }` with appropriate HTTP status
- **Column safety**: When querying columns that may not exist across schema versions, check `information_schema.columns` first (see `auth.js` pattern)

## Flutter Conventions

- **Screen widgets**: Stateful widgets in `lib/screens/`; each screen manages its own loading/error state with `setState`
- **Services**: All HTTP calls go through service classes in `lib/services/`; screens never call `http` directly
- **API base URL**: Always use `ApiConfig.preferredBaseUrl` — never hardcode URLs in screens or services
- **Auth headers**: Send Firebase ID token as `Authorization: Bearer <token>`
- **Currency formatting**: Use `NumberFormat.currency(locale: 'en_ET', symbol: 'ETB ')` from `intl` for all monetary values
- **Error handling**: Wrap async calls in try/catch; show `SnackBar` for user-facing errors; use `debugPrint` for dev logging
- **Mounted check**: Always check `if (!mounted) return` before calling `setState` after an `await`
- **Navigation**: Use `Navigator.pushReplacement` for login/logout flows; `Navigator.push` for sub-screens

## Database Conventions

- All tables live in the `public` schema
- Migrations are standalone SQL files in `backend/database/`; name them descriptively with an `add_` or `migrate_` prefix
- Never modify existing migration files — add new ones for schema changes
