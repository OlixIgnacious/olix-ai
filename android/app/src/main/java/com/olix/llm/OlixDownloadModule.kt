package com.olix.llm

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.util.Log
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Native OkHttp-based model downloader.
 *
 * Why native instead of JS fetch() + rn-fetch-blob:
 *   - Streams directly from OkHttp to FileOutputStream — no base64 round-trip,
 *     no JS thread involvement, no GC pressure from 16 MB ArrayBuffers.
 *   - ~10-20x faster than the JS chunked approach on a real device.
 *   - OkHttp follows HuggingFace's XET cross-domain redirects correctly by default.
 *
 * JS API (NativeModules.OlixDownload):
 *   downloadModel(url, destPath)  → Promise<destPath>
 *   cancelDownload()              → Promise<void>
 *
 * Events (DeviceEventEmitter):
 *   OlixDownloadProgress  { percent: number, received: number, total: number }
 *   OlixDownloadError     { message: string }
 */
class OlixDownloadModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var currentCall: Call? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun getName(): String = "OlixDownload"

    private fun sendEvent(name: String, params: com.facebook.react.bridge.WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, params)
    }

    @ReactMethod
    fun downloadModel(url: String, destPath: String, promise: Promise) {
        val destFile = File(destPath)
        destFile.parentFile?.mkdirs()

        val resumeOffset: Long = if (destFile.exists()) destFile.length() else 0L
        Log.d("OlixDownload", "Starting download: url=$url dest=$destPath resumeOffset=$resumeOffset")

        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()

        val requestBuilder = Request.Builder().url(url)
        if (resumeOffset > 0) {
            requestBuilder.header("Range", "bytes=$resumeOffset-")
            Log.d("OlixDownload", "Resuming from $resumeOffset bytes")
        }

        val call = client.newCall(requestBuilder.build())
        currentCall = call

        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (call.isCanceled()) return
                Log.e("OlixDownload", "Download failed", e)
                promise.reject("DOWNLOAD_FAILED", e.message ?: "Network error", e)
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val code = response.code
                    if (code != 200 && code != 206) {
                        promise.reject("DOWNLOAD_FAILED", "HTTP $code")
                        return
                    }

                    val body = response.body
                    if (body == null) {
                        promise.reject("DOWNLOAD_FAILED", "Empty response body")
                        return
                    }

                    // Determine total file size from Content-Range (on 206) or Content-Length.
                    val totalSize: Long = if (code == 206) {
                        response.header("Content-Range")
                            ?.let { cr -> Regex("""\/(\d+)$""").find(cr)?.groupValues?.get(1)?.toLongOrNull() }
                            ?: (resumeOffset + body.contentLength())
                    } else {
                        body.contentLength()
                    }

                    try {
                        // Append to partial file when resuming; overwrite otherwise.
                        // Note: FileOutputStream(file, true) seeks to EOF automatically,
                        // which equals resumeOffset — safe because resumeOffset == file.length().
                        // The old RandomAccessFile approach caused EBADF because the RAF was
                        // GC'd before the async OkHttp callback finished writing.
                        val outputStream = FileOutputStream(destFile, resumeOffset > 0 && destFile.exists())

                        val buffer = ByteArray(32 * 1024) // 32 KB buffer
                        var bytesRead: Int
                        var totalReceived = resumeOffset
                        val inputStream = body.byteStream()
                        var lastProgressPercent = -1

                        outputStream.use {
                            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                                outputStream.write(buffer, 0, bytesRead)
                                totalReceived += bytesRead

                                val percent = if (totalSize > 0) {
                                    ((totalReceived.toDouble() / totalSize) * 100)
                                        .toInt().coerceIn(0, 100)
                                } else 0

                                // Emit progress at most once per percent point to avoid flooding the bridge.
                                if (percent != lastProgressPercent) {
                                    lastProgressPercent = percent
                                    val params = Arguments.createMap().apply {
                                        putInt("percent", percent)
                                        putDouble("received", totalReceived.toDouble())
                                        putDouble("total", totalSize.toDouble())
                                    }
                                    sendEvent("OlixDownloadProgress", params)
                                }
                            }
                        }

                        Log.d("OlixDownload", "Download complete: $destPath")
                        promise.resolve(destPath)

                    } catch (e: Exception) {
                        if (call.isCanceled()) return
                        Log.e("OlixDownload", "Error writing file", e)
                        promise.reject("DOWNLOAD_FAILED", e.message ?: "Write error", e)
                    }
                }
            }
        })
    }

    @ReactMethod
    fun cancelDownload(promise: Promise) {
        currentCall?.cancel()
        currentCall = null
        Log.d("OlixDownload", "Download cancelled")
        promise.resolve(null)
    }

    @ReactMethod
    fun getFilesDir(promise: Promise) {
        promise.resolve(reactApplicationContext.filesDir.absolutePath)
    }

    @ReactMethod
    fun extractTarBz2(tarPath: String, destDir: String, promise: Promise) {
        scope.launch {
            try {
                val destDirectory = File(destDir)
                destDirectory.mkdirs()
                FileInputStream(File(tarPath)).buffered().use { fis ->
                    BZip2CompressorInputStream(fis).use { bzIn ->
                        TarArchiveInputStream(bzIn).use { tarIn ->
                            var entry: TarArchiveEntry? = tarIn.nextTarEntry
                            while (entry != null) {
                                val outFile = File(destDir, entry.name)
                                if (entry.isDirectory) {
                                    outFile.mkdirs()
                                } else {
                                    outFile.parentFile?.mkdirs()
                                    FileOutputStream(outFile).use { out -> tarIn.copyTo(out) }
                                }
                                entry = tarIn.nextTarEntry
                            }
                        }
                    }
                }
                Log.d("OlixDownload", "Extraction complete: $destDir")
                promise.resolve(destDir)
            } catch (e: Exception) {
                Log.e("OlixDownload", "Extraction failed", e)
                promise.reject("EXTRACT_FAILED", e.message ?: "Extraction error", e)
            }
        }
    }

    // Required for event emitter — no-op implementations satisfy the RN framework.
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Double) {}
}
