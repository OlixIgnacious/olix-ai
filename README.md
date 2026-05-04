<p align="center">
  <img src="assets/banner.png" alt="Boxi — Your Offline AI" width="480" />
</p>

<p align="center">
  <strong>Your private mind, on local silicon.</strong>
</p>

<p align="center">
  A fully offline AI assistant for Android. Powered by Gemma 4 running entirely on-device via Google AI Edge LiteRT — no cloud, no API keys, no data collection.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android-3DDC84?logo=android&logoColor=white" />
  <img src="https://img.shields.io/badge/React%20Native-0.85-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Model-Gemma%204-4285F4?logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Offline-100%25-000000" />
</p>

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Native UI                      │
│  HomeScreen  ChatScreen  VoiceScreen  ConversationList  │
└────────────────────────┬────────────────────────────────┘
                         │ JS ↔ Native Bridge
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
   ┌─────────────┐ ┌──────────┐ ┌───────────────┐
   │  OlixLLM    │ │OlixSpeech│ │   OlixTTS     │
   │  (Kotlin)   │ │ (Kotlin) │ │  (Kotlin)     │
   │             │ │          │ │               │
   │  LiteRT     │ │ Android  │ │ Sherpa-ONNX   │
   │  .litertlm  │ │ Speech   │ │ Kokoro ONNX   │
   │  Gemma 4    │ │Recognizer│ │ espeak-ng     │
   └─────────────┘ └──────────┘ └───────────────┘
          │
   ┌──────▼──────┐
   │   op-sqlite │  ← conversations + messages (local)
   └─────────────┘
```

### Voice Pipeline

```
Mic → SpeechRecognizer → transcript
                              │
                    formatGemmaPrompt (voice mode)
                              │
                    LiteRT generateStream
                              │
                    token buffer → flush on sentence boundary
                              │
                    Kokoro TTS (pre-synthesise next chunk
                    while current chunk plays)
                              │
                    Shared AudioTrack → Speaker
```

---

## Tech Stack

### Frontend

| Package | Version | Role |
|---------|---------|------|
| React Native | 0.85.0 | UI framework |
| React | 19.2.3 | Component model |
| React Navigation | 7.x | Stack + bottom tabs |
| react-native-svg | 15.15.4 | Wave animation, SVG icons |
| op-sqlite | — | Local SQLite database |
| rn-fetch-blob | 0.12.0 | Resumable model download |

### Native (Kotlin / Android)

| Library | Version | Role |
|---------|---------|------|
| Google AI Edge LiteRT | 0.10.0 | On-device LLM inference |
| Sherpa-ONNX | 1.12.39 | Kokoro TTS + espeak-ng phonemizer |
| Android SpeechRecognizer | — | On-device speech-to-text |
| Apache Commons Compress | 1.26.1 | tar.bz2 extraction for voice model |

### Model

| | |
|---|---|
| LLM | Gemma 4 E4B Instruct (`.litertlm`, ~2.5 GB) |
| Voice | Kokoro EN v0.19 via Sherpa-ONNX (~80 MB) |
| Source | HuggingFace `litert-community/gemma-4-E4B-it-litert-lm` |

---

## Device Requirements

| | |
|---|---|
| Min SDK | API 24 (Android 7.0) |
| Target SDK | API 36 |
| Min RAM | 6 GB |
| Min storage | 3 GB free |
| Architecture | arm64-v8a |

---

## Project Structure

```
src/
├── assets/          # Logo and static images
├── components/      # GradientBackground, MessageBubble, TabIcons (SVG)
├── config/          # env.ts, featureFlags.ts
├── db/              # SQLite repository (conversations, messages)
├── native/          # JS bridges to Kotlin modules
├── navigation/      # RootNavigator, MainTabNavigator
├── screens/         # HomeScreen, ChatScreen, VoiceScreen, …
├── services/        # ModelDownloader, DocumentReader, ImageReader
├── theme/           # colors.ts (black/white palette)
└── utils/           # formatPrompt, generateTitle, logger

android/app/src/main/java/com/olix/
├── llm/             # OlixLLMModule (inference + download)
├── speech/          # OlixSpeechModule (STT), OlixTTSModule (Kokoro)
└── document/        # OlixDocumentModule (PDF/text)
```

---

## Build

```sh
# Install dependencies
npm install

# Bundle JS
npx react-native bundle \
  --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

# Debug APK
cd android && ./gradlew assembleDevDebug

# Production AAB (Play Store)
cd android && ./gradlew bundleProdRelease
```

---

## Environments

| Flavor | App ID | Label |
|--------|--------|-------|
| `dev` | `com.olix.dev` | Boxi Dev |
| `qa` | `com.olix.qa` | Boxi QA |
| `prod` | `com.olix` | Boxi |

---

## Privacy

Boxi collects no data. All inference, speech recognition, and conversation storage happen on-device. No telemetry, no analytics, no network calls after the initial model download.

---

<p align="center">Made with ❤️ by <a href="https://github.com/OlixIgnacious">Olix Studios</a></p>
