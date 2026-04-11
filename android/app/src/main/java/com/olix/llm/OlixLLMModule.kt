package com.olix.llm

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import java.util.concurrent.Executors

/**
 * React Native native module that wraps MediaPipe LLM Inference for Android.
 *
 * Streaming tokens are emitted as "OlixLLM_token" DeviceEventManager events
 * with payload { token: String }.
 *
 * Thread model
 * ────────────
 * All MediaPipe operations run on a dedicated single-thread executor so that
 * the JS bridge thread is never blocked by model I/O or inference.
 */
class OlixLLMModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "OlixLLM"
        const val TOKEN_EVENT = "OlixLLM_token"
        const val DONE_EVENT = "OlixLLM_done"
        const val ERROR_EVENT = "OlixLLM_error"
    }

    private var inference: LlmInference? = null

    @Volatile
    private var isCancelled = false

    // Single-thread executor keeps MediaPipe calls serial and off the JS thread.
    private val executor = Executors.newSingleThreadExecutor()

    override fun getName(): String = MODULE_NAME

    // ── loadModel ─────────────────────────────────────────────────────────────

    @ReactMethod
    fun loadModel(path: String, promise: Promise) {
        executor.execute {
            try {
                val options = LlmInference.LlmInferenceOptions.builder()
                    .setModelPath(path)
                    .setMaxTokens(1024)
                    .setTopK(40)
                    .setTemperature(0.8f)
                    .setRandomSeed(102)
                    .build()

                inference = LlmInference.createFromOptions(reactContext, options)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("LOAD_MODEL_FAILED", e.message, e)
            }
        }
    }

    // ── generateStream ────────────────────────────────────────────────────────

    /**
     * Begins streaming generation for [prompt].
     *
     * Each partial token fires an OlixLLM_token event. The promise resolves
     * when generation completes naturally or rejects on error.
     * Call [stopGeneration] to suppress further events.
     */
    @ReactMethod
    fun generateStream(prompt: String, promise: Promise) {
        val currentInference = inference
        if (currentInference == null) {
            promise.reject("MODEL_NOT_LOADED", "Call loadModel before generateStream")
            return
        }

        isCancelled = false

        executor.execute {
            try {
                currentInference.generateResponseAsync(prompt) { partialResult, done ->
                    if (isCancelled) return@generateResponseAsync

                    if (partialResult != null && partialResult.isNotEmpty()) {
                        val payload = WritableNativeMap().apply { putString("token", partialResult) }
                        emitEvent(TOKEN_EVENT, payload)
                    }

                    if (done) {
                        if (!isCancelled) {
                            emitEvent(DONE_EVENT, null)
                            promise.resolve(null)
                        }
                    }
                }
            } catch (e: Exception) {
                if (!isCancelled) {
                    val payload = WritableNativeMap().apply { putString("error", e.message ?: "Unknown error") }
                    emitEvent(ERROR_EVENT, payload)
                    promise.reject("GENERATION_FAILED", e.message, e)
                }
            }
        }
    }

    // ── stopGeneration ────────────────────────────────────────────────────────

    @ReactMethod
    fun stopGeneration() {
        isCancelled = true
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private fun emitEvent(name: String, payload: WritableNativeMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, payload)
    }

    // Required by RN for modules that emit events
    @ReactMethod
    fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

    @ReactMethod
    fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) {}
}
