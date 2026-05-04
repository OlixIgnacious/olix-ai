package com.olix.llm

import android.content.Context
import android.os.PowerManager
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore

/**
 * React Native native module that wraps Google AI Edge LiteRT for Android.
 *
 * CRITICAL — LiteRT session safety:
 *   conversation.close() must NEVER be called while the native inference engine
 *   thread is still running. Doing so causes a SIGSEGV (null pointer dereference)
 *   inside liblitertlm_jni.so. The design here ensures this never happens:
 *
 *   - stopGeneration() only sets isCancelled=true so tokens are discarded.
 *     It does NOT cancel the coroutine or close the conversation.
 *   - The coroutine lets the Flow drain naturally (LiteRT finishes inference).
 *   - conversation.close() is called only inside the finally{} block, after
 *     collect{} has returned — meaning the native thread has already finished.
 *   - A Semaphore(1) ensures at most one LiteRT conversation is open at a time.
 *     A new generateStream() call waits for the previous conversation to close
 *     before calling createConversation().
 *   - A generationId guards against a stale completed session emitting DONE/ERROR
 *     events or resolving/rejecting a Promise that belongs to a newer generation.
 */
class OlixLLMModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "OlixLLM"
        const val TOKEN_EVENT = "OlixLLM_token"
        const val DONE_EVENT = "OlixLLM_done"
        const val ERROR_EVENT = "OlixLLM_error"
    }

    private val wakeLock: PowerManager.WakeLock by lazy {
        val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "OlixLLM::GenerationWakeLock")
    }

    private var engine: Engine? = null

    // Only one LiteRT conversation may be alive at a time.
    // Acquired before createConversation(), released after conversation.close().
    private val sessionSemaphore = Semaphore(1)

    // Monotonically increasing counter. Each generateStream() call captures its
    // own value. Stale coroutines check this before emitting events or settling promises.
    @Volatile private var generationId = 0

    // isCancelled suppresses token forwarding so the JS side sees nothing after
    // stopGeneration(), but the native inference is still allowed to complete.
    @Volatile private var isCancelled = false

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun getName(): String = MODULE_NAME

    // ── loadModel ─────────────────────────────────────────────────────────────

    @ReactMethod
    fun loadModel(path: String, promise: Promise) {
        scope.launch {
            try {
                Log.d(MODULE_NAME, "Loading model: $path")
                val config = EngineConfig(
                    modelPath = path,
                    backend = Backend.CPU(),
                    visionBackend = Backend.CPU(),
                )
                val newEngine = Engine(config)
                newEngine.initialize()
                engine = newEngine
                Log.d(MODULE_NAME, "Model loaded successfully")
                promise.resolve(null)
            } catch (e: Exception) {
                Log.e(MODULE_NAME, "Failed to load model", e)
                promise.reject("LOAD_MODEL_FAILED", e.message, e)
            }
        }
    }

    // ── generateStream ────────────────────────────────────────────────────────

    @ReactMethod
    fun generateStream(prompt: String, imagePath: String?, promise: Promise) {
        val currentEngine = engine
        if (currentEngine == null) {
            promise.reject("MODEL_NOT_LOADED", "Call loadModel before generateStream")
            return
        }

        // Invalidate any in-flight generation. Its coroutine will drain naturally
        // but will not emit events or settle its promise once the id is stale.
        generationId++
        val myId = generationId
        isCancelled = false

        scope.launch {
            wakeLock.acquire(10 * 60 * 1000L) // 10-min cap
            try {
                // Wait for the previous conversation to close before opening a new one.
                // This is the only safe ordering — LiteRT does not support concurrent sessions
                // and crashes (SIGSEGV) if close() is called while inference is running.
                sessionSemaphore.acquire()
                val conversation = try {
                    currentEngine.createConversation()
                } catch (e: Exception) {
                    sessionSemaphore.release()
                    if (myId == generationId) {
                        Log.e(MODULE_NAME, "createConversation failed", e)
                        promise.reject("GENERATION_FAILED", e.message, e)
                    }
                    return@launch
                }

                if (imagePath != null) {
                    val imgFile = java.io.File(imagePath)
                    if (!imgFile.exists() || !imgFile.canRead()) {
                        try { conversation.close() } catch (_: Exception) {}
                        sessionSemaphore.release()
                        if (myId == generationId) {
                            promise.reject("IMAGE_NOT_FOUND", "Image file not accessible: $imagePath")
                        }
                        return@launch
                    }
                }

                try {
                    var tokenCount = 0
                    val responseFlow = if (imagePath != null) {
                        val contents = Contents.of(listOf(Content.Text(prompt), Content.ImageFile(imagePath)))
                        conversation.sendMessageAsync(Message.user(contents))
                    } else {
                        conversation.sendMessageAsync(prompt)
                    }

                    responseFlow.collect { token ->
                        // Always drain the flow completely — never abort collect() mid-inference.
                        // Aborting would leave the LiteRT engine thread running against a closed
                        // conversation object and cause a SIGSEGV.
                        if (isCancelled || myId != generationId) return@collect

                        val tokenStr = token.toString()
                            .removePrefix("Message(content=")
                            .removeSuffix(")")

                        tokenCount++
                        if (tokenStr.isNotEmpty()) {
                            val payload = WritableNativeMap().apply { putString("token", tokenStr) }
                            emitEvent(TOKEN_EVENT, payload)
                        }
                    }

                    Log.d(MODULE_NAME, "generateStream: complete, tokens=$tokenCount, id=$myId")
                    if (!isCancelled && myId == generationId) {
                        emitEvent(DONE_EVENT, null)
                        promise.resolve(null)
                    }
                } catch (e: Exception) {
                    if (!isCancelled && myId == generationId) {
                        Log.e(MODULE_NAME, "generateStream exception", e)
                        val payload = WritableNativeMap().apply { putString("error", e.message ?: "Unknown error") }
                        emitEvent(ERROR_EVENT, payload)
                        promise.reject("GENERATION_FAILED", e.message, e)
                    }
                } finally {
                    // Safe to close now — collect{} has exited, native thread has finished.
                    try { conversation.close() } catch (_: Exception) {}
                    sessionSemaphore.release()
                }
            } finally {
                if (wakeLock.isHeld) wakeLock.release()
            }
        }
    }

    // ── stopGeneration ────────────────────────────────────────────────────────

    @ReactMethod
    fun stopGeneration() {
        // Suppress token forwarding and mark this generation stale.
        // Do NOT cancel the coroutine or close the conversation — the LiteRT
        // native engine must be allowed to finish before close() is safe to call.
        isCancelled = true
        generationId++
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private fun emitEvent(name: String, payload: WritableNativeMap?) {
        val emitter = reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        if (emitter == null) {
            Log.e(MODULE_NAME, "emitEvent: RCTDeviceEventEmitter is NULL — name=$name")
            return
        }
        emitter.emit(name, payload)
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        isCancelled = true
        generationId++
        try { engine?.close() } catch (_: Exception) {}
        scope.cancel()
    }

    @ReactMethod
    fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

    @ReactMethod
    fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) {}
}
