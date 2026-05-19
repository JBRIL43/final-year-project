# Package & Feature Research — Mindmemo

> Research snapshot for planning. Verify versions and iOS compatibility on pub.dev before locking ADRs.

## Target packages (MVP stack)

| Area | Package / approach | Role |
|------|------------------|------|
| On-device AI | **runanywhere** (ONNX) | STT + local LLM analysis; align with lazy-load requirement |
| STT fallback | **Whisper** (ON-device binding, e.g. whisper.cpp Flutter wrapper) | If runanywhere STT insufficient on iOS |
| Storage | **tostore** | LLM-oriented local store for memos, tags, chat threads |
| Audio | `record` | Capture voice memos |
| State | `flutter_bloc`, `bloc` | Feature state |
| Navigation | `go_router` | Declarative routes |
| DI | `get_it` | Service locator + feature modules |
| Files | `path_provider` | Audio file paths |
| Permissions | `permission_handler` | Microphone |
| Models | `equatable`, `uuid` | Entities and memo IDs |
| Export | `pdf`, `printing`, `share_plus` | Creator-facing export |
| Markdown | `markdown` or `flutter_markdown` | Preview converted content |

## Creator / audience features (prioritize in PRD)

**MVP-strong (align with your prompt)**

- Voice record + playback with waveform or duration
- On-device transcription with manual edit
- Tags and local library (search/filter by tag)
- Per-memo iterative chat (refine ideas)
- Content conversion templates (e.g. short script, blog outline)
- Lazy-loaded analysis LLM (first-use download/init)

**High value soon after MVP**

- Export transcript / converted content as **PDF** and **Markdown**
- Share sheet export (`share_plus`)
- Full-text search across memos
- Favorites / pinned memos
- Dark mode + consistent creator-focused typography (theme in planning)

**Later / optional**

- Siri shortcut or iOS widget for quick capture
- Encrypted local backup export (file, not cloud)
- Multiple conversion templates user-defined
- Transcript ↔ audio sync scrubbing

## Technical spikes (planning risks)

1. runanywhere: STT quality + model size on lowest supported iPhone
2. First-run LLM download UX and storage quota
3. tostore schema for memo + chat history + conversion versions
4. App Store privacy labels for “on-device processing” vs analytics (should be none)

## Open questions for PRD

- Minimum iOS version?
- Maximum recording length?
- Single language STT at v1 or multi?
- Is account/login required? (Likely no for v1)
