package com.olix.llm

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.olix.BuildConfig

/**
 * Exposes build-time constants (flavor, env, etc.) to JS via getConstants().
 *
 * react-native-config resolves BuildConfig via context.getPackageName() which
 * returns the applicationId (e.g. "com.olix.dev"). For non-prod flavors the
 * applicationId differs from the Gradle namespace ("com.olix"), so the class
 * lookup fails and Config.APP_ENV comes back as undefined.
 *
 * This module imports com.olix.BuildConfig directly — the namespace-derived
 * class that always exists regardless of applicationId — and exposes the
 * values as synchronous constants available immediately on the JS side via
 * NativeModules.OlixBuildConfig.APP_ENV.
 */
class OlixBuildConfigModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OlixBuildConfig"

    override fun getConstants(): Map<String, Any> = mapOf(
        "APP_ENV"          to BuildConfig.APP_ENV,
        "MODEL_CDN_URL"    to BuildConfig.MODEL_CDN_URL,
        "APP_DISPLAY_NAME" to BuildConfig.APP_DISPLAY_NAME,
        "BUNDLE_ID"        to BuildConfig.BUNDLE_ID,
    )
}
