# Mindmemo — Agent Routing Map

## New agent? Start here

Any new AI session **must** read before working:

1. **`CONTEXT.md`** — master project context (workspace map, workflow, handoff)
2. `AGENTS.md` — short bootstrap checklist
3. `STATUS.md` — what to do **now**
4. `PROJECT_LOG.md` — everything from project start **until now** (append-only history)
5. This file — routing and rules
6. `standards/CONTEXT.md` + `planning/docs/project-origin.md`

**End of session:** update `STATUS.md` + append `PROJECT_LOG.md` (required). See `AGENTS.md`.

## Project identity

**Mindmemo** is a privacy-first Flutter app (iOS-first) for creators: record voice memos on-device, transcribe to text, and analyze or structure thoughts with a local LLM—no network calls for processing. Users iterate via per-memo chat and convert ideas into formats like scripts or blog posts.

**Done (v1):** App Store submission accepted with MVP scope from planning (on-device record → transcribe → tag/store → optional LLM analyze → iterative chat → content conversion).

## Workspace overview

| Workspace | Folder | Use when |
|-----------|--------|----------|
| Planning | `planning/` | PRD, architecture, risks, core loop—before code |
| Spec definition | `spec-definition/` | Per-feature requirements, design, tasks (80% rule) |
| Development | `development/` | Implementation, blockers, session logs, package allowlist |
| Publishing | `publishing/` | Store submission, listing, assets, final checklist |

Shared Flutter conventions: `../../flutter-standards/`.

## Routing table

| Task | Go to | Read first | Also load |
|------|-------|------------|-----------|
| Product scope, PRD, arch decisions | `planning/` | `planning/CONTEXT.md`, `STATUS.md` | `standards/CONTEXT.md` |
| Feature requirements / design / tasks | `spec-definition/` | `spec-definition/CONTEXT.md`, feature folder | `planning/docs/` if exists |
| Implement feature, fix blocker, update pubspec | `development/` | `development/CONTEXT.md`, `STATUS.md` | `../../flutter-standards/CONTEXT.md`, active spec in `spec-definition/features/` |
| App Store, listing, screenshots brief | `publishing/` | `publishing/CONTEXT.md` | `planning/docs/` PRD summary |
| Session start (any mode) | project root | `CONTEXT.md` → `STATUS.md` → `PROJECT_LOG.md` | `AGENTS.md`, this file, `standards/CONTEXT.md`, `planning/docs/project-origin.md` |
| End session | project root | — | Update `STATUS.md` + append `PROJECT_LOG.md` + workspace `CONTEXT.md` if needed |

## Global rules

1. **On-device only** — No outbound API calls for STT, LLM, or user content; offline-first.
2. **Lazy-load LLM** — Do not bundle or initialize analysis models at app launch; load on first user-triggered analysis.
3. **Clean Architecture + BloC + GoRouter + get_it** — Match `flutter-standards/`; feature folders under `lib/features/`.
4. **Specs before code** — No implementation in `development/` without Requirements + Design + Tasks in `spec-definition/features/[feature]/`.
5. **Package allowlist** — Only add dependencies listed in `development/packages/ALLOWED_PACKAGES.md` (or extend that file in the same PR with justification).
6. **STATUS.md every session** — Update last action, implementations, next step, blockers before stopping.
7. **80% spec rule** — Specs aim for complete logic; minor drift is logged in implementation log, not silent scope creep.

## Naming conventions

| Item | Convention |
|------|------------|
| App slug / folder | `mindmemo` (rename project folder + this file if product name changes) |
| Feature folders | `snake_case` — e.g. `voice_memo`, `memo_chat` |
| Dart files | `snake_case.dart` |
| BloC events/states | `PascalCase` classes; files `*_bloc.dart`, `*_event.dart`, `*_state.dart` |
| Routes | `kebab-case` paths in GoRouter — e.g. `/memo/:id` |
| Spec artifacts | `requirements.md`, `design.md`, `tasks.md` per feature |
| Local DB / store keys | `memo_`, `tag_`, `thread_` prefixes |

## Package stack (target — confirm versions at implementation)

| Concern | Package direction |
|---------|-------------------|
| On-device AI (STT + LLM) | **runanywhere** (ONNX); evaluate Whisper path if STT gaps |
| Local LLM-oriented storage | **tostore** |
| Audio capture | `record` |
| DI / state / routes | `get_it`, `flutter_bloc`, `go_router` |
| Permissions / paths | `permission_handler`, `path_provider` |
| Export (creator MVP+) | `pdf`, `printing`, `share_plus`, `markdown` |
| IDs / utils | `uuid`, `intl`, `equatable` |

See `planning/docs/package-research.md` for audience features and export expectations.

**Last updated:** 2026-05-19  
**Recent changes:** Added master `CONTEXT.md` for cross-agent continuity; session start reads `CONTEXT.md` first.
