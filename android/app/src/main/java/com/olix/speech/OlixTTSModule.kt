package com.olix.speech

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.LinkedBlockingQueue

class OlixTTSModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "OlixTTS"
        private const val TAG = "OlixTTS"
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var tts: OfflineTts? = null
    private var audioTrack: AudioTrack? = null

    @Volatile private var isStopped = false
    @Volatile private var draining = false

    private val queue = LinkedBlockingQueue<Pair<String, Promise>>()
    private var currentPromise: Promise? = null

    override fun getName(): String = MODULE_NAME

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
                Log.d(TAG, "Kokoro TTS initialized, sampleRate=${tts?.sampleRate()}")
                promise.resolve(null)
            } catch (e: Exception) {
                Log.e(TAG, "Kokoro init failed", e)
                promise.reject("TTS_INIT_ERROR", e.message ?: "Init failed", e)
            }
        }
    }

    @ReactMethod
    fun speak(text: String, promise: Promise) {
        if (tts == null) {
            Log.w(TAG, "speak() called before initialize() — resolving immediately")
            promise.resolve(null)
            return
        }
        queue.add(Pair(text, promise))
        if (!draining) {
            scope.launch { drain() }
        }
    }

    private suspend fun drain() {
        draining = true
        while (true) {
            val item = queue.poll() ?: break
            val (text, promise) = item
            if (isStopped) { promise.resolve(null); continue }
            synthesizeAndPlay(text, promise)
        }
        draining = false
    }

    private suspend fun synthesizeAndPlay(text: String, promise: Promise) {
        val localTts = tts ?: run { promise.resolve(null); return }
        currentPromise = promise

        val audio = try {
            localTts.generate(text = text, sid = 0, speed = 1.0f)
        } catch (e: Exception) {
            Log.e(TAG, "TTS generate failed", e)
            currentPromise = null
            promise.resolve(null)
            return
        }

        if (isStopped || audio.samples.isEmpty()) {
            currentPromise = null
            promise.resolve(null)
            return
        }

        val minBuf = AudioTrack.getMinBufferSize(
            audio.sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT
        ).coerceAtLeast(4096)

        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(audio.sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                    .build()
            )
            .setBufferSizeInBytes(minBuf)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()

        audioTrack = track

        try {
            if (!isStopped) {
                track.play()
                // WRITE_BLOCKING feeds samples into the hardware buffer on this thread.
                // It returns only after all samples are accepted — so by the time we
                // reach delay() the audio is fully queued and playing.
                track.write(audio.samples, 0, audio.samples.size, AudioTrack.WRITE_BLOCKING)

                // Wait for the queued audio to actually play out.
                // Duration = samples / sampleRate, plus a small safety margin.
                val playoutMs = (audio.samples.size.toLong() * 1000L) / audio.sampleRate + 150L
                val deadline = System.currentTimeMillis() + playoutMs
                while (System.currentTimeMillis() < deadline && !isStopped) {
                    delay(50L)
                }
            }
        } finally {
            track.stop()
            track.release()
            if (audioTrack == track) audioTrack = null
            currentPromise = null
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun stop() {
        isStopped = true
        currentPromise?.resolve(null)
        currentPromise = null
        var item = queue.poll()
        while (item != null) {
            item.second.resolve(null)
            item = queue.poll()
        }
        audioTrack?.stop()
        audioTrack?.release()
        audioTrack = null
        scope.launch {
            delay(200)
            isStopped = false
        }
    }

    override fun onCatalystInstanceDestroy() {
        isStopped = true
        queue.forEach { (_, p) -> p.resolve(null) }
        queue.clear()
        audioTrack?.stop()
        audioTrack?.release()
        audioTrack = null
        tts?.release()
        tts = null
        scope.cancel()
    }
}
