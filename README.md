# akhr

A fully offline, private AI assistant for Android powered by Gemma 4 running entirely on-device via Google AI Edge LiteRT.

No cloud. No API keys. No data leaves the device.

---

## Requirements

- Node 18+
- JDK 17+
- Android SDK (API 26+)
- Physical Android device with 6 GB+ RAM and 3 GB+ free storage

## Setup

```sh
npm install
```

## Build

Bundle the JS:

```sh
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
```

Build debug APK:

```sh
cd android && ./gradlew assembleDevDebug
```

Build production AAB (for Play Store):

```sh
cd android && ./gradlew bundleProdRelease
```

Install on a connected device:

```sh
adb install -r android/app/build/outputs/apk/dev/debug/app-dev-debug.apk
```

## Architecture

| Layer | Detail |
|---|---|
| UI | React Native 0.85, React Navigation |
| LLM inference | Google AI Edge LiteRT (`litertlm-android`) |
| LLM bridge | Kotlin — `loadModel`, `generateStream`, `stopGeneration` |
| Token streaming | `RCTDeviceEventEmitter` → `DeviceEventEmitter` |
| Speech recognition | Android `SpeechRecognizer` (on-device) |
| Text-to-speech | Kokoro via Sherpa-ONNX (`k2-fsa/sherpa-onnx`) |
| Data | SQLite via `op-sqlite` — conversations + messages |

## Environments

Three flavors: `dev` (`com.olix.dev`), `qa` (`com.olix.qa`), `prod` (`com.olix`).

## Signing

Production keystore is excluded from git (`*.keystore`). Store it securely outside the repo.
