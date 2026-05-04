<div align="center">

<img src="assets/banner.png" alt="Boxi" width="520" />

<br />
<br />

**Your private mind, on local silicon.**

Boxi is a fully offline AI assistant for Android. Powered by Gemma 4, running entirely on your device — no cloud, no subscriptions, no data collection.

<br />

[![Download APK](https://img.shields.io/badge/Download_APK-v1.0.0-000000?style=for-the-badge&logo=android&logoColor=white)](https://github.com/OlixIgnacious/boxi-ai/releases/latest)
[![Platform](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://play.google.com/store)
[![React Native](https://img.shields.io/badge/React_Native_0.85-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev)
[![Gemma 4](https://img.shields.io/badge/Gemma_4-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/gemma)
[![100% Offline](https://img.shields.io/badge/100%25_Offline-000000?style=for-the-badge)](.)

</div>

---

## Why Boxi?

Most AI assistants send your conversations to the cloud. Boxi doesn't. Everything — the model, your chats, your voice — stays on your device, always.

<br />

<div align="center">

| 🔒 **Private by default** | ⚡ **Works offline** | 🎙️ **Voice mode** |
|:---:|:---:|:---:|
| Conversations never leave your phone. No account, no tracking, no logs. | Download once, use forever. No Wi-Fi needed after setup. | Talk hands-free. Boxi listens, thinks, and speaks back. |

| 📄 **Document Q&A** | 🖼️ **Vision** | 💬 **Multi-turn chat** |
|:---:|:---:|:---:|
| Attach PDFs or text files and ask questions about them. | Describe images or ask visual questions with the multimodal model. | Full conversation history with AI-generated titles and previews. |

</div>

---

## How it works

```
You speak  ──▶  On-device STT  ──▶  Gemma 4 (LiteRT)  ──▶  Kokoro TTS  ──▶  You hear
                                          │
                                    Stays on device.
                                    Always.
```

Boxi uses a **pipeline architecture** — Kokoro begins synthesising the first sentence while Gemma is still generating the rest. You hear a response in seconds, not minutes.

---

## Tech

<details>
<summary><strong>Frontend</strong></summary>

| Package | Role |
|---------|------|
| React Native 0.85 | UI framework |
| React Navigation 7 | Stack + bottom tab navigation |
| react-native-svg | Voice wave animation & SVG icons |
| op-sqlite | Local conversation + message storage |
| rn-fetch-blob | Resumable model download with progress |

</details>

<details>
<summary><strong>Native (Kotlin)</strong></summary>

| Library | Role |
|---------|------|
| Google AI Edge LiteRT 0.10 | On-device Gemma 4 inference |
| Sherpa-ONNX 1.12.39 | Kokoro neural TTS + espeak-ng phonemizer |
| Android SpeechRecognizer | On-device speech-to-text (API 31+) |
| Apache Commons Compress | Extracts the Kokoro voice model archive |

</details>

<details>
<summary><strong>Models</strong></summary>

| Model | Size | Source |
|-------|------|--------|
| Gemma 4 E4B Instruct (`.litertlm`) | ~2.5 GB | [HuggingFace](https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm) |
| Kokoro EN v0.19 (Sherpa-ONNX) | ~80 MB | [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) |

</details>

---

## Device requirements

| | Minimum |
|---|---|
| Android | 7.0 (API 24) |
| RAM | 6 GB |
| Free storage | 3 GB |
| Architecture | arm64-v8a |

---

## Build

```sh
# 1. Install JS dependencies
npm install

# 2. Bundle
npx react-native bundle \
  --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

# 3. Debug APK
cd android && ./gradlew assembleDevDebug

# 4. Production AAB (Play Store)
cd android && ./gradlew bundleProdRelease
```

**Flavors**

| Flavor | App ID | Label |
|--------|--------|-------|
| `dev` | `com.olix.dev` | Boxi Dev |
| `qa` | `com.olix.qa` | Boxi QA |
| `prod` | `com.olix` | Boxi |

---

## Privacy

Boxi collects nothing. No analytics, no telemetry, no crash reporting sent to any server. After the one-time model download, the app works entirely without internet. Your conversations are stored in a local SQLite database and never transmitted anywhere.

---

<div align="center">

Made by [Olix Studios](https://github.com/OlixIgnacious)

</div>
