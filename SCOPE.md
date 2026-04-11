# Olix — Android-First Scope

> **Decision (2026-04-12):** Build and ship the Android app first. iOS is deferred until Android is fully working and released. All phases below reflect Android-only until the iOS section at the bottom.

---

## Completed

### Phase 1 — Environment & Scaffold ✅
- Bare React Native project initialised (Olix)
- Three environments configured: Dev (`com.olix.dev`), QA (`com.olix.qa`), Prod (`com.olix`)
- TypeScript strict mode, ESLint, Prettier
- Folder structure: `screens/`, `components/`, `native/`, `services/`, `store/`, `config/`, `navigation/`, `utils/`, `db/`
- React Navigation with placeholder screens
- GitHub Actions: lint + type check + unit tests on every push

### Phase 2 — Compatibility Gate ✅
- Compatibility service: checks RAM (6GB+), free storage (2.5GB+), OS version (Android 8+)
- Result cached in AsyncStorage (runs once)
- `CompatibilityScreen` with loading state
- `BlockedScreen` showing per-check failure reasons
- Unit tests for all pass/fail combinations
- Navigation wired: pass → DownloadScreen, fail → BlockedScreen

### Phase 3 — Native Bridge ✅ (Android only)
- MediaPipe LLM Inference added to Android (Gradle)
- Android native module in Kotlin: `loadModel`, `generateStream`, `stopGeneration`
- TypeScript interface in `src/native/`
- Bridge tested in isolation
- Errors surfaced to Sentry
- _iOS native module (Swift + CocoaPods) — deferred_

### Phase 4 — Model Download ✅
- Resumable download via `rn-fetch-blob`
- Model stored in app documents directory
- `DownloadScreen`: progress bar, percentage, estimated time remaining
- Resume logic survives app close or crash
- Checksum verification after download
- Model path + version persisted in AsyncStorage
- Model loaded into native bridge after verified download
- Navigation wired: download complete → ConversationListScreen

### Phase 5 — Data Layer ✅ (current branch: `feature/phase-5-data-layer`)
- SQLite schema: `conversations` + `messages` tables
- `ConversationRepository`: `create`, `findAll`, `findById`, `updateTitle`, `touch`, `delete`
- `MessageRepository`: `create`, `findByConversation`, `deleteByConversation`, cascade delete
- Migration runner (`runMigrations`)
- Production singleton via `getDb()` / `db` proxy (`src/db/index.ts`)
- Full unit test coverage with real in-memory SQLite (`better-sqlite3`)

---

## Pending — Android

### Phase 6 — Chat UI
- `ConversationListScreen`: list of past conversations, new chat button, swipe-to-delete
- `ChatScreen`:
  - `MessageBubble` component (user + assistant)
  - Input bar with send button
  - Streaming token rendering — append partial tokens in real time
  - Abort button visible during generation
  - Auto-scroll to latest message
- Wire `ChatScreen` to native bridge: prompt → stream → persist to SQLite
- Touch parent conversation `updatedAt` on each new message
- Edge cases: generation error, model not loaded, empty input, app backgrounded mid-generation

### Phase 7 — App Shell & Polish
- `SettingsScreen`: clear history, model version info, app version
- App icon and splash screen (Android)
- Feature flag service wired to Firebase Remote Config with AsyncStorage fallback
- Model update flow: check version → prompt user → download → verify → swap
- Thermal throttling detection — warn user if generation slows significantly
- Low storage warning before download
- Error boundaries on all screens
- Full offline-first audit — zero network calls after model download

### Phase 8 — QA Pipeline (Android)
- Fastlane setup for Android builds
- GitHub Actions: auto-deploy to Play Store internal track on merge to `develop`
- GitHub Actions: auto-deploy to Production with phased rollout (10% → 50% → 100%) on merge to `main`
- Sentry verified in QA + Prod environments
- QA test checklist executed before every release:
  - Compatibility gate (pass + fail device)
  - Model download (fresh + resume)
  - Chat streaming + abort
  - Long conversation
  - Low storage scenario
  - App backgrounded mid-generation
  - Thermal warning

### Phase 9 — Android Release
- Production build: signing, bundle ID, entitlements
- Play Store: screenshots, description, privacy policy
- Submit to internal track → closed testing → open testing → production
- Monitor Sentry for 72 hours post-launch

---

## Deferred — iOS (post-Android release)

All iOS work is held until the Android app ships. Items to revisit:

- Phase 3: iOS native module (Swift + CocoaPods) for MediaPipe LLM Inference
- Phase 7: App icon and splash screen (iOS)
- Phase 8: Fastlane iOS lane, TestFlight deployment
- Phase 9: App Store submission (screenshots, description, privacy policy, review)
- Compatibility gate: iOS 16+ check
- Any iOS-specific edge cases (file system paths, background task limits, thermal APIs)

---

## Guiding Rules (unchanged)

- One phase at a time — do not jump ahead
- TypeScript strict mode, no `any`
- All errors handled — verbose in Dev, Sentry in QA/Prod
- Flag any React Native / MediaPipe limitation immediately rather than silently working around it
- Ask before any architectural decision not already covered in `.prompt.md`
