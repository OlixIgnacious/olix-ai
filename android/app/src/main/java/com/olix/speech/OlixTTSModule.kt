package com.olix.speech

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.k2fsa.sherpa.onnx.GeneratedAudio
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.LinkedBlockingQueue

// Design:
// - One shared AudioTrack stays in play() state for the entire session.
//   WRITE_BLOCKING paces writes to real-time playback speed, so chunks play
//   back-to-back with zero gap — no teardown/setup noise between sentences.
// - Synthesis of chunk N+1 runs on a background async while chunk N is being
//   written (played), so the pipeline never stalls waiting for the CPU.

class OlixTTSModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "OlixTTS"
        private const val TAG = "OlixTTS"
        private const val SAMPLE_RATE = 24000
        private const val SPEED = 0.88f
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var tts: OfflineTts? = null

    // Shared AudioTrack — stays alive across chunks to eliminate inter-chunk gaps.
    private var sharedTrack: AudioTrack? = null

    @Volatile private var isStopped = false
    @Volatile private var draining = false

    private val queue = LinkedBlockingQueue<Pair<String, Promise>>()

    override fun getName(): String = MODULE_NAME

    // ── Init ─────────────────────────────────────────────────────────────────

    @ReactMethod
    fun initialize(modelDir: String, promise: Promise) {
        scope.launch {
            try {
                val config = OfflineTtsConfig(
                    model = OfflineTtsModelConfig(
                        kokoro = OfflineTtsKokoroModelConfig(
                            model = "$modelDir/model.onnx",
                            voices = "$modelDir/voices.bin",
                            tokens = "$modelDir/tokens.txt",
                            dataDir = "$modelDir/espeak-ng-data"
                        ),
                        numThreads = 2,
                        provider = "cpu"
                    )
                )
                tts = OfflineTts(config = config)
                sharedTrack = buildAudioTrack()
                sharedTrack?.play()
                Log.d(TAG, "Kokoro TTS initialized")
                promise.resolve(null)
            } catch (e: Exception) {
                Log.e(TAG, "Kokoro init failed", e)
                promise.reject("TTS_INIT_ERROR", e.message ?: "Init failed", e)
            }
        }
    }

    private fun buildAudioTrack(): AudioTrack {
        val minBuf = AudioTrack.getMinBufferSize(
            SAMPLE_RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT
        ).coerceAtLeast(8192)
        return AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                    .build()
            )
            .setBufferSizeInBytes(minBuf)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
    }

    // ── Speak ────────────────────────────────────────────────────────────────

    @ReactMethod
    fun speak(text: String, promise: Promise) {
        if (tts == null) { promise.resolve(null); return }
        queue.add(Pair(text, promise))
        if (!draining) scope.launch { drain() }
    }

    private suspend fun synthesize(text: String): GeneratedAudio? {
        val localTts = tts ?: return null
        return try {
            val audio = localTts.generate(text = text, sid = 0, speed = SPEED)
            if (audio.samples.isEmpty()) null else audio
        } catch (e: Exception) {
            Log.e(TAG, "Synthesis failed: ${e.message}")
            null
        }
    }

    private suspend fun drain() {
        draining = true
        var prefetchText: String? = null
        var prefetch: Deferred<GeneratedAudio?>? = null

        while (true) {
            val item = queue.poll() ?: break
            val (text, promise) = item

            if (isStopped) { promise.resolve(null); prefetch?.cancel(); break }

            // Use pre-synthesized audio if it matches this chunk.
            val audio: GeneratedAudio? = if (text == prefetchText) {
                prefetch?.await()
            } else {
                prefetch?.cancel()
                synthesize(text)
            }
            prefetch = null
            prefetchText = null

            if (audio == null) { promise.resolve(null); continue }

            // Pre-synthesize next chunk on IO thread while current chunk plays.
            val nextText = queue.peek()?.first
            if (nextText != null && !isStopped) {
                prefetchText = nextText
                prefetch = scope.async(Dispatchers.IO) { synthesize(nextText) }
            }

            writeAndPlay(audio, promise)
        }

        prefetch?.cancel()
        draining = false
    }

    // Write samples to the shared AudioTrack. WRITE_BLOCKING paces the call to
    // actual playback speed — returns only after samples are accepted into the
    // hardware buffer, which mirrors how long the audio takes to play.
    private suspend fun writeAndPlay(audio: GeneratedAudio, promise: Promise) {
        val track = sharedTrack
        if (track == null || isStopped) { promise.resolve(null); return }
        try {
            if (track.playState != AudioTrack.PLAYSTATE_PLAYING) track.play()
            track.write(audio.samples, 0, audio.samples.size, AudioTrack.WRITE_BLOCKING)
            // Small margin for last samples to leave the hardware buffer.
            delay(80L)
        } catch (e: Exception) {
            Log.e(TAG, "Playback error: ${e.message}")
        } finally {
            promise.resolve(null)
        }
    }

    // ── Stop ─────────────────────────────────────────────────────────────────

    @ReactMethod
    fun stop() {
        isStopped = true
        var item = queue.poll()
        while (item != null) { item.second.resolve(null); item = queue.poll() }
        try { sharedTrack?.pause(); sharedTrack?.flush() } catch (_: Exception) {}
        scope.launch {
            delay(200)
            isStopped = false
            try { sharedTrack?.play() } catch (_: Exception) {}
        }
    }

    override fun onCatalystInstanceDestroy() {
        isStopped = true
        queue.forEach { (_, p) -> p.resolve(null) }
        queue.clear()
        sharedTrack?.stop()
        sharedTrack?.release()
        sharedTrack = null
        tts?.release()
        tts = null
        scope.cancel()
    }
}
