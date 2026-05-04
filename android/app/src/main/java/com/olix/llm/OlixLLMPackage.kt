package com.olix.llm

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class OlixLLMPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(OlixLLMModule(context), OlixBuildConfigModule(context), OlixDownloadModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
