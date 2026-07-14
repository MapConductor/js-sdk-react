package com.mapconductor.react.marker

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.common.annotations.FrameworkAPI
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl
import com.facebook.react.turbomodule.core.interfaces.TurboModule

/**
 * Installs the JSI bridge (see OnLoad.cpp / MarkerScaleBridge.cpp) that lets native
 * marker-tiling code synchronously invoke a JS-defined `iconScaleCallback`.
 *
 * Nothing in JS ever calls a method on this module (it only installs global JSI
 * functions as a side effect of initialize()), so under the bridgeless/new-arch
 * runtime it would otherwise never be instantiated. `getEagerInitModuleNames()`
 * (ReactPackageTurboModuleManagerDelegate) only honors needsEagerInit when
 * ReactModuleInfo.isTurboModule is also true, which is a plain `is TurboModule`
 * check — hence implementing the (already-satisfied) marker interface here.
 */
@ReactModule(name = MarkerScaleBridgeModule.NAME, needsEagerInit = true)
class MarkerScaleBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TurboModule {

    companion object {
        const val NAME = "MapConductorMarkerScaleBridge"

        init {
            System.loadLibrary("mapconductor_markerscale")
        }

        // Native methods are registered as static (JNI receives a jclass, not a
        // jobject), so they must live in the companion object with @JvmStatic.
        @JvmStatic
        @OptIn(FrameworkAPI::class)
        private external fun nativeInstall(jsContext: Long, callInvokerHolder: CallInvokerHolderImpl)

        @JvmStatic
        private external fun nativeInvalidate()
    }

    override fun getName(): String = NAME

    @OptIn(FrameworkAPI::class)
    override fun initialize() {
        super.initialize()
        val jsContext = reactApplicationContext.javaScriptContextHolder
        val callInvokerHolder = reactApplicationContext.jsCallInvokerHolder as? CallInvokerHolderImpl
        Log.d(
            "MarkerScaleBridge",
            "initialize: jsContext=$jsContext callInvokerHolder=$callInvokerHolder",
        )
        if (jsContext == null || callInvokerHolder == null) return
        nativeInstall(jsContext.get(), callInvokerHolder)
    }

    override fun invalidate() {
        nativeInvalidate()
        super.invalidate()
    }
}
