# akhr

> Your private mind, on local silicon.

A fully offline, private AI assistant for Android. Powered by Gemma 4 running entirely on-device via Google AI Edge LiteRT — no cloud, no API keys, no data leaves the device.

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
                    token buffer → flush on [.!?,]
                              │
                    Kokoro TTS → AudioTrack → Speaker
```

Gemma generates while Kokoro speaks the previous sentence — parallel pipeline with no blocking.

---

## Tech Stack

### Frontend

| Package | Version | Role |
|---------|---------|------|
| React Native | 0.85.0 | UI framework |
| React | 19.2.3 | Component model |
| React Navigation | 7.x | Stack + bottom tabs |
| react-native-svg | 15.15.4 | Wave animation (VoiceScreen) |
| op-sqlite | — | Local SQLite database |
| rn-fetch-blob | 0.12.0 | Resumable model download |
| AsyncStorage | — | Lightweight key-value store |

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
| Model | Gemma 4 E4B Instruct |
| Format | `.litertlm` (LiteRT mobile format) |
| Size | ~2.5 GB |
| Source | HuggingFace `litert-community/gemma-4-E4B-it-litert-lm` |
| Voice model | Kokoro EN v0.19 (Sherpa-ONNX, ~80 MB) |

---

## Android Requirements

| | |
|---|---|
| Min SDK | API 24 (Android 7.0) |
| Target SDK | API 36 |
| Compile SDK | 36 |
| Min RAM | 6 GB |
| Min storage | 3 GB free |
| Architecture | arm64-v8a |

---

## Project Structure

```
src/
├── assets/          # Logo and static images
├── components/      # GradientBackground, MessageBubble, TabIcons
├── config/          # env.ts, featureFlags.ts
├── db/              # SQLite repository (conversations, messages)
├── native/          # JS bridges to Kotlin modules
│   ├── LLMBridge.ts
│   ├── NativeOlixSpeech.ts
│   ├── NativeOlixTTS.ts
│   └── NativeOlixDownload.ts
├── navigation/      # RootNavigator, MainTabNavigator, types
├── screens/         # HomeScreen, ChatScreen, VoiceScreen, ...
├── services/        # ModelDownloader, compatibility check
├── theme/           # colors.ts
└── utils/           # formatPrompt, generateTitle, logger

android/app/src/main/java/com/olix/
├── llm/             # OlixLLMModule (inference), OlixDownloadModule
├── speech/          # OlixSpeechModule (STT), OlixTTSModule (Kokoro)
└── document/        # OlixDocumentModule (PDF/text reading)
```

---

## Build

### Prerequisites

- Node 18+
- JDK 17+
- Android SDK (API 36)

### Install dependencies

```sh
npm install
```

### Bundle JS

```sh
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
```

### Debug builds

```sh
# Dev flavor
cd android && ./gradlew assembleDevDebug

# Install on connected device
adb install -r app/build/outputs/apk/dev/debug/app-dev-debug.apk
```

### Production build (Play Store)

```sh
cd android && ./gradlew bundleProdRelease
# Output: app/build/outputs/bundle/prodRelease/app-prod-release.aab
```

---

## Environments

| Flavor | App ID | Label |
|--------|--------|-------|
| `dev` | `com.olix.dev` | akhr Dev |
| `qa` | `com.olix.qa` | akhr QA |
| `prod` | `com.olix` | akhr |

---

## Signing

Production keystore is excluded from git (`*.keystore`). Store `akhr-release.keystore` securely outside the repository — losing it means you cannot publish updates to the Play Store.

---

## Privacy

akhr collects no data. All inference, speech recognition, and conversation storage happen on-device. No telemetry, no analytics, no network calls after the initial model download.

---

Made by [Olix Studios](https://github.com/OlixIgnacious)
