# Planning Workspace

> **New agent:** Read [`../CONTEXT.md`](../CONTEXT.md) and [`../STATUS.md`](../STATUS.md) before this file.

## Purpose

Build the foundation before any Flutter code: app overview, PRD, architecture decisions, technical strategy (schema, packages, theming), risk register, and the core user loop. Unknown-unknowns are surfaced and mitigated here—not during implementation.

## Process

1. **App overview** — One-pager: audience, problem, differentiator (on-device privacy).
2. **PRD** — MVP features, out-of-scope, success metrics; file in `docs/prd.md`.
3. **Core user loop** — Record → transcribe → tag/store → (optional) analyze → chat refine → convert; diagram in `docs/core-loop.md`.
4. **Architecture decisions** — ADRs in `docs/adr/` (STT path, LLM lazy load, tostore schema, feature boundaries).
5. **Technical strategy** — Package list aligned with `../development/packages/ALLOWED_PACKAGES.md`; DB/schema in `docs/data-model.md`.
6. **Risk assessment** — `risks/register.md`: model size, iOS memory, STT accuracy, App Store privacy labels.
7. **Handoff** — When PRD + arch + risks are reviewed, update `../STATUS.md` phase to **Spec definition**.

## What good output looks like

- PRD is testable: each MVP feature has acceptance criteria.
- ADRs state decision, alternatives rejected, and consequences.
- Risk register has owner, likelihood, mitigation, and “spike needed” flags.
- No implementation tasks sneaking in—those belong in spec-definition.

**Last updated:** 2026-05-18  
**Recent changes:** Workspace created; awaiting PRD draft.
