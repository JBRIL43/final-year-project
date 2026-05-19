# Spec Definition Workspace

> **New agent:** Read [`../CONTEXT.md`](../CONTEXT.md) and [`../STATUS.md`](../STATUS.md) before this file.

## Purpose

Iterate on one feature at a time to ~80% completeness before coding: Requirements, Design, and Tasks per feature. Reduces rework and gives development a clear contract.

## Process

1. Pick the next feature from PRD priority in `../planning/docs/prd.md`.
2. Create `features/[feature_name]/` with three artifacts:
   - `requirements.md` — user stories, acceptance criteria, edge cases.
   - `design.md` — UI flows, bloc states/events, domain entities, data sources.
   - `tasks.md` — ordered, checkbox implementation steps (file-level where helpful).
3. **80% rule** — Spec covers happy path + known errors; mark TBDs explicitly.
4. Review against `../standards/CONTEXT.md` (privacy, lazy LLM, tagging).
5. When all three docs are stable, update `../STATUS.md` and hand off to **development**.

## What good output looks like

- Tasks are small enough for one session (roughly half-day max each).
- Design names align with Clean Architecture folders and BloC naming in `CLAUDE.md`.
- Requirements trace to PRD section IDs.
- No code in this workspace—only specs.

**Last updated:** 2026-05-18  
**Recent changes:** Workspace created; no features specced yet.
