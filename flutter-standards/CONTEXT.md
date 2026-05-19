# Flutter Standards — Context

## What these standards cover

App-agnostic conventions for Flutter projects in this workspace: Clean Architecture layout, BloC state management, GoRouter navigation, get_it dependency injection, theming, testing protocols, and service integration patterns for **on-device** apps (local persistence, lazy-loaded ONNX models via runanywhere, no cloud inference for user content).

**Reference app:** [Mindmemo](../projects/mindmemo/) — discovery snapshot in `projects/mindmemo/planning/docs/project-origin.md`. Project-specific rules (privacy, memo tagging, per-memo chat) live in `projects/mindmemo/standards/CONTEXT.md`; do not duplicate those here.

## Workspace layout

```
flutter-standards/          ← shared conventions (this folder)
projects/[app-name]/        ← one folder per app (e.g. mindmemo)
  planning/                 ← PRD, architecture, risks
  spec-definition/          ← per-feature requirements, design, tasks
  development/              ← implementation, logs, package allowlist
  publishing/               ← store checklist, listing, assets
```

**v1 done (per project):** App Store submission accepted with MVP from planning; post-MVP work stays in the same project folder.

## When to load which standards file

| Situation | Load |
|-----------|------|
| Any Flutter code change | This file + `bloc-conventions.md` (when created) |
| UI / theming work | `theming.md` (when created) |
| Writing or running tests | `testing.md` (when created) |
| New feature scaffolding | `architecture.md` (when created) |
| Local storage / on-device AI | `service-patterns.md` (when created) |
| Joining an existing app mid-project | App’s `AGENTS.md` → `STATUS.md` → `PROJECT_LOG.md` → app `CLAUDE.md` → app `standards/CONTEXT.md` |

Until topic files exist, follow summaries in the app’s `CLAUDE.md` and this file’s non-negotiables.

## Target stack (workspace default)

Confirm versions in each app’s `development/packages/ALLOWED_PACKAGES.md` at implementation time.

| Concern | Direction |
|---------|-----------|
| State | `flutter_bloc` |
| Navigation | `go_router` |
| DI | `get_it` — `lib/injection.dart` + `features/[name]/[name]_injection.dart` |
| On-device AI (STT + LLM) | **runanywhere** (ONNX); Whisper path viable for STT |
| Local LLM-oriented storage | **tostore** |
| Audio capture | `record` |
| Permissions / paths | `permission_handler`, `path_provider` |
| Export (when in scope) | `pdf`, `printing`, `share_plus`, `markdown` |
| IDs / utils | `uuid`, `intl`, `equatable` |

**Not the default here:** Firebase or other cloud-backed stores for apps that require on-device-only processing.

## Non-negotiables

1. **Feature-based Clean Architecture** — `lib/features/[name]/` with `data/`, `domain/`, `presentation/`; no business logic in widgets.
2. **BloC for state** — UI reads state from Bloc/Cubit; no ad-hoc `setState` for feature state.
3. **GoRouter for navigation** — declarative routes; no imperative-only Navigator stacks for main flows.
4. **get_it for DI** — central `injection.dart` plus per-feature `*_injection.dart`; no manual `new` in presentation layer.
5. **Theme.of(context)** — colors, text styles, and spacing from theme extensions; no hardcoded brand colors in widgets.
6. **Tests for domain + bloc** — every use case and bloc gets unit tests before a feature is “done” in development workspace.
7. **On-device processing** — For privacy-first apps in this workspace: no outbound API calls for STT, LLM, or user content; offline-first.
8. **Lazy-load heavy models** — Do not initialize STT/LLM at app launch; load on first user-triggered action (download/init as spec defines).
9. **Local persistence** — User content stored on-device with stable IDs; use app-chosen local store (e.g. tostore), not cloud sync, unless PRD/ADR explicitly changes that.
10. **Specs before code** — Requirements + design + tasks in `spec-definition/features/[feature]/` before implementation in `development/`.
11. **No secrets in repo** — No committed credentials, API keys, or PII fixtures.

## How to add new standards

1. Add a focused `.md` file under `flutter-standards/` (one topic per file).
2. Link it from this file’s “When to load” table.
3. Add one line to affected projects’ `CLAUDE.md` routing table if agents need an explicit trigger.
4. Keep each standards file under ~150 lines; split if it grows.
5. Reusable across apps → here; single-app only → `projects/[app]/standards/CONTEXT.md`.

**Last updated:** 2026-05-19  
**Recent changes:** Aligned with Mindmemo `project-origin.md` — workspace layout, on-device stack (runanywhere, tostore), lazy model loading, local storage default, reference app pointer.
