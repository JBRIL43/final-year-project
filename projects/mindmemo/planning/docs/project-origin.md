# Project Origin — Discovery Snapshot

Frozen record of initial discovery. Supersede only via explicit PRD/ADR updates; do not contradict without documenting why in `PROJECT_LOG.md`.

## Product (Round 1)

**What:** Flutter mobile app (iOS first) for creators. Record voice memos on-device, transcribe to text, use a local LLM to analyze and structure thoughts.

**Technical requirements**

| Area | Requirement |
|------|-------------|
| Privacy | All processing on-device; no API calls; no data sent outward |
| Inference | runanywhere + ONNX for STT and LLM; Whisper viable for STT |
| Optimization | Do not load LLM at launch; load on first user-triggered analysis |
| Persistence | Each memo tagged and stored locally |
| Storage | Local LLM-oriented store (tostore) |

**Core features**

- Iterative chat per content piece to refine ideas
- Content conversion (e.g. short-form scripts, blog posts)

**Audience extras (planning research)**

- Export PDF/Markdown, share sheet, tagged library, search, manual transcript edit, dark mode — prioritize in PRD (some post-MVP).

## Work modes (Round 2)

Four workspaces — see `../CONTEXT.md` and sibling folders:

1. **Planning** — PRD, architecture, risks, core loop before code
2. **Spec definition** — per-feature requirements, design, tasks (~80% rule)
3. **Development** — implementation, blockers, session logs, package allowlist
4. **Publishing** — App Store checklist, listing, assets, final review

## Standards (Round 3)

- **State:** BloC; **Routes:** GoRouter; **DI:** get_it (`injection.dart` + `features/[x]/[x]_injection.dart`)
- **Structure:** Clean Architecture per feature — `data/`, `domain/`, `presentation/`
- **Shared:** `flutter-standards/` for BloC, theming, testing, architecture docs, service patterns
- **This app:** local storage (not Firebase pattern)

## Lifecycle (Round 4)

- **Layout:** `flutter-standards/` + `projects/[app-name]/`
- **Done (v1):** App Store submission successful; MVP from planning; post-MVP continues in same project folder
- **Session continuity:** STATUS + implementation log + clear next step
- **Tracking:** blockers, ongoing task, next in queue in `STATUS.md`

## Workflow for humans

Solo developer; agents must treat this document + `PROJECT_LOG.md` + `STATUS.md` as the source of truth when joining mid-project.

**Captured:** 2026-05-18
