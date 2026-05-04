package com.olix

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Switch from SplashTheme (set in AndroidManifest) to AppTheme before the
   * React Native view is attached. This keeps the splash visible during the
   * JS bundle load and avoids a white flash on cold start.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    // Pass null so Android never tries to restore react-native-screens fragments,
    // which always throws IllegalStateException when restored.
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "Exis"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
