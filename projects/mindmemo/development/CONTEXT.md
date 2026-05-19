# Development Workspace

> **New agent:** Read [`../CONTEXT.md`](../CONTEXT.md) and [`../STATUS.md`](../STATUS.md) before this file.

## Purpose

Execute approved specs: implement features in order dictated by dependencies, track blockers, log each session’s work, and maintain the package allowlist for `pubspec.yaml` changes.

## Process

1. Read `../STATUS.md` and the active feature’s `../spec-definition/features/[feature]/tasks.md`.
2. Confirm feature has requirements + design + tasks; if not, stop and return to spec-definition.
3. Implement in `../app/` (Flutter project root—create during planning handoff) following `flutter-standards/`.
4. **Blockers** — Log in `../STATUS.md` with what was tried; do not silently skip spec items.
5. **Session log** — Append to `logs/implementation-log.md`: date, feature, files touched, done vs deferred.
6. **Packages** — Only add deps from `packages/ALLOWED_PACKAGES.md`; extend allowlist in same change with rationale.
7. On feature completion: check off tasks, update `../STATUS.md`, append `../PROJECT_LOG.md`, note in spec folder if drift from design.
8. **End session** — Update `../STATUS.md` and append `../PROJECT_LOG.md` (see `../AGENTS.md`).

## What good output looks like

- Implementation matches spec; deviations documented in implementation log.
- BloC tests and domain tests added per flutter-standards.
- `STATUS.md` always reflects true next step for the next session.
- No new features without spec trilogy.

**Last updated:** 2026-05-18  
**Recent changes:** Workspace created; Flutter app not scaffolded (`mindmemo_app/` TBD at planning).
