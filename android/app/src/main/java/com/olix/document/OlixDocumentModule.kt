package com.olix.document

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.File

class OlixDocumentModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OlixDocument"

    @ReactMethod
    fun extractPdfText(filePath: String, promise: Promise) {
        Thread {
            try {
                PDFBoxResourceLoader.init(reactContext)
                val document = PDDocument.load(File(filePath))
                val text = PDFTextStripper().getText(document)
                document.close()
                promise.resolve(text)
            } catch (e: Exception) {
                promise.reject("PDF_EXTRACT_ERROR", e.message ?: "Failed to extract PDF text", e)
            }
        }.start()
    }
}
