# Mindmemo — Project Standards

## What these standards cover

Rules specific to **this app** (privacy, on-device AI, lazy model loading, memo tagging) plus pointers to shared Flutter standards. Does not duplicate full BloC/architecture guides—those live in `flutter-standards/`.

## When to load which standards file

| Situation | Load |
|-----------|------|
| Any agent session on Mindmemo | This file |
| Writing or reviewing Dart/Flutter code | `../../flutter-standards/CONTEXT.md` |
| Planning AI/storage architecture | `../planning/docs/` + this file § Non-negotiables |
| Adding a dependency | `../development/packages/ALLOWED_PACKAGES.md` |

## Non-negotiables

1. **Zero cloud inference** — User audio and transcripts never sent to remote APIs for processing.
2. **Lazy LLM load** — Analysis model downloaded/initialized only on first explicit user action.
3. **Tagged local persistence** — Every memo has stable ID + tags; stored via tostore (or documented migration if package changes).
4. **Iterative chat is per-memo** — Chat context scoped to one content piece unless spec explicitly defines cross-memo behavior.
5. **MVP content types** — At minimum: raw transcript, structured summary, and one conversion template (e.g. short script); others are post-MVP unless PRD says otherwise.
6. **iOS-first** — Android/desktop optimizations are out of scope until post-v1 unless PRD adds them.

## How to add new standards

1. Add a bullet or short section here if it applies to every feature.
2. If it’s reusable across future Flutter apps, add to `flutter-standards/` instead.
3. Update `CLAUDE.md` global rules if agents need a routing-table trigger.
4. Note the change in **Recent changes** below.

**Last updated:** 2026-05-18  
**Recent changes:** Initial project standards from discovery Round 3–4.
