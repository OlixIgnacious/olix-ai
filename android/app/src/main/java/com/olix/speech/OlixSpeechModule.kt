package com.olix.speech

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class OlixSpeechModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "OlixSpeech"
        const val EVENT_PARTIAL = "OlixSpeech_partial"
        const val EVENT_ERROR = "OlixSpeech_error"
    }

    private var recognizer: SpeechRecognizer? = null
    @Volatile private var settled = false
    // SpeechRecognizer must be created and used on the main thread.
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun getName(): String = MODULE_NAME

    @ReactMethod
    fun startListening(promise: Promise) {
        mainHandler.post {
            try {
                recognizer?.destroy()
                recognizer = null
                settled = false
                recognizer = if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                    SpeechRecognizer.isOnDeviceRecognitionAvailable(reactContext)
                ) {
                    SpeechRecognizer.createOnDeviceSpeechRecognizer(reactContext)
                } else {
                    SpeechRecognizer.createSpeechRecognizer(reactContext)
                }.apply {
                    setRecognitionListener(object : RecognitionListener {
                        override fun onReadyForSpeech(params: Bundle?) {}
                        override fun onBeginningOfSpeech() {}
                        override fun onRmsChanged(rmsdB: Float) {}
                        override fun onBufferReceived(buffer: ByteArray?) {}
                        override fun onEndOfSpeech() {}
                        override fun onEvent(eventType: Int, params: Bundle?) {}

                        override fun onPartialResults(partialResults: Bundle?) {
                            val text = partialResults
                                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                                ?.firstOrNull() ?: return
                            emitEvent(EVENT_PARTIAL, WritableNativeMap().apply { putString("text", text) })
                        }

                        override fun onResults(results: Bundle?) {
                            if (settled) return
                            settled = true
                            val text = results
                                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                                ?.firstOrNull() ?: ""
                            promise.resolve(text)
                        }

                        override fun onError(error: Int) {
                            if (settled) return
                            settled = true
                            // Silence timeouts are not errors — resolve with empty so the UI resets cleanly
                            if (error == SpeechRecognizer.ERROR_NO_MATCH ||
                                error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                                promise.resolve("")
                                return
                            }
                            val msg = speechErrorMessage(error)
                            emitEvent(EVENT_ERROR, WritableNativeMap().apply { putString("message", msg) })
                            promise.reject("SPEECH_ERROR", msg)
                        }
                    })
                }

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                }
                recognizer?.startListening(intent)
            } catch (e: Exception) {
                Log.e(MODULE_NAME, "startListening failed", e)
                promise.reject("SPEECH_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun stopListening() {
        mainHandler.post { recognizer?.stopListening() }
    }

    private fun emitEvent(name: String, payload: WritableNativeMap?) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(name, payload)
    }

    private fun speechErrorMessage(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
        SpeechRecognizer.ERROR_CLIENT -> "Client side error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
        SpeechRecognizer.ERROR_NETWORK -> "Network error"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
        SpeechRecognizer.ERROR_NO_MATCH -> "No speech match found"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer busy"
        SpeechRecognizer.ERROR_SERVER -> "Server error"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input detected"
        else -> "Unknown speech error: $error"
    }

    override fun onCatalystInstanceDestroy() {
        mainHandler.post {
            recognizer?.destroy()
            recognizer = null
        }
    }

    @ReactMethod fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}
    @ReactMethod fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) {}
}
