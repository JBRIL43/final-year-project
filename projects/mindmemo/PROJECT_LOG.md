# Mindmemo — Project Log

Append-only chronological record. **Newest entries at the top.** Every agent session must add an entry before ending.

---

## 2026-05-19 — Master project context

**What happened**

- Added `CONTEXT.md` at project root: single entry for any agent—workspace map, four-phase workflow, context layers, non-negotiables, file index, session handoff.
- Updated `AGENTS.md`, `CLAUDE.md`, `STATUS.md`, and `.cursor/rules/mindmemo-bootstrap.mdc` to read `CONTEXT.md` first.

**Decisions**

- `STATUS.md` remains live “what to do now”; `CONTEXT.md` is stable “how the project works”; `PROJECT_LOG.md` is append-only history.

**Next agent should**

1. Read `CONTEXT.md` → `STATUS.md` → continue planning (PRD, core loop) per “What is next” in `STATUS.md`.

---

## 2026-05-18 — Orchestration bootstrap

**What happened**

- Completed discovery (4 rounds): product identity, four workspaces (planning → spec → development → publishing), Flutter standards, multi-app layout (`flutter-standards/` + `projects/mindmemo/`).
- Created folder-based agent orchestration under `projects/mindmemo/` with `CLAUDE.md`, `STATUS.md`, workspace `CONTEXT.md` files, risk register stub, package research stub, publishing checklist stubs.
- Provisional app slug: `mindmemo` (display name TBD).
- Phase: **Planning**. No Flutter `app/` scaffold yet.

**Decisions**

- On-device only: runanywhere (ONNX) for STT + LLM; Whisper fallback if needed; tostore for storage; lazy LLM load on first user analysis.
- Stack: BloC, GoRouter, get_it, Clean Architecture feature folders.
- Spec-before-code: each feature needs requirements + design + tasks in `spec-definition/features/`.
- v1 complete = successful App Store submission with MVP from PRD.

**Deferred**

- PRD, core user loop doc, ADRs, Flutter app scaffold.
- Confirm final product name; runanywhere iOS STT spike.

**Next agent should**

1. Read `AGENTS.md` bootstrap list (this log + `STATUS.md`).
2. Continue planning: `planning/docs/prd.md`, `planning/docs/core-loop.md`.

---

<!-- Template for future entries:

## YYYY-MM-DD — Short title

**What happened**
**Decisions**
**Deferred**
**Next agent should**

-->
