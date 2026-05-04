<div align="center">

<br />

<img src="assets/banner.png" alt="Boxi" width="460" />

<br />
<br />

*Your private mind, on local silicon.*

<br />

[![Download APK](https://img.shields.io/badge/↓%20Download%20APK-v1.0.0-000?style=for-the-badge)](https://github.com/OlixIgnacious/boxi-ai/releases/latest)&nbsp;
[![Android](https://img.shields.io/badge/Android-7.0+-3DDC84?style=for-the-badge&logo=android&logoColor=white)](.)&nbsp;
[![Offline](https://img.shields.io/badge/100%25%20Offline-000?style=for-the-badge)](.)&nbsp;
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)

<br />

</div>

---

Boxi is a **fully offline AI assistant** for Android, powered by Google's Gemma 4 model running entirely on your device. No subscription. No cloud. No data collection. Your conversations never leave your phone.

---

## Features

**🔒 Private by default**
Conversations are stored locally in SQLite and never transmitted anywhere. No account required.

**⚡ Works offline**
Download the model once on first launch (~2.5 GB). After that, Boxi works with no internet connection — forever.

**🎙 Voice mode**
Tap the mic, speak naturally. Boxi transcribes on-device, generates a response, and speaks it back using Kokoro neural TTS.

**📄 Document Q&A**
Attach a PDF or text file to any conversation and ask questions about it. Boxi reads and reasons over your documents locally.

**🖼 Vision**
Send a photo and ask about it. The Gemma 4 multimodal model analyzes images entirely on-device.

**💬 Multi-turn chat**
Full conversation history with AI-generated titles, message previews, and streaming token rendering.

---

## How the voice pipeline works

```
You speak
    │
    ▼
Android SpeechRecognizer (on-device, API 31+)
    │
    ▼
Gemma 4 via LiteRT — streams tokens as they generate
    │
    ▼
Kokoro TTS (Sherpa-ONNX) — pre-synthesises next chunk
while the current one plays on a shared AudioTrack
    │
    ▼
You hear a response in seconds
```

---

## Tech stack

**Frontend** — React Native 0.85, React Navigation 7, react-native-svg, op-sqlite, rn-fetch-blob

**Native (Kotlin)** — Google AI Edge LiteRT 0.10 · Sherpa-ONNX 1.12.39 · Android SpeechRecognizer · Apache Commons Compress

**Models**

| | |
|---|---|
| LLM | Gemma 4 E4B Instruct — `.litertlm` format, ~2.5 GB |
| Voice | Kokoro EN v0.19 via Sherpa-ONNX — ~80 MB |

---

## Device requirements

| | |
|---|---|
| Android | 7.0+ (API 24) |
| RAM | 6 GB minimum |
| Storage | 3 GB free |
| Architecture | arm64-v8a |

---

## Build

```sh
# Dependencies
npm install

# Bundle JS
npx react-native bundle \
  --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

# Debug
cd android && ./gradlew assembleDevDebug

# Production (Play Store)
cd android && ./gradlew bundleProdRelease
```

**Flavors:** `dev` → `com.olix.dev` · `qa` → `com.olix.qa` · `prod` → `com.olix`

---

## Privacy

Boxi collects nothing. No analytics, no telemetry, no crash reporting sent anywhere. The only network request the app ever makes is the one-time model download on first launch. After that, it is fully air-gapped.

---

<div align="center">

Made by [Olix Studios](https://github.com/OlixIgnacious)

</div>
