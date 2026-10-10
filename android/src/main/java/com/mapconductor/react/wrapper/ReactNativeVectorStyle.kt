package com.mapconductor.react.wrapper

import com.facebook.react.bridge.ReadableMap
import com.mapconductor.core.controller.BaseMapViewController
import com.mapconductor.core.map.MapDiagnostics
import com.mapconductor.core.map.MapServiceRegistry
import com.mapconductor.core.map.MapViewStyle
import com.mapconductor.core.map.MapViewStyleHost

/**
 * The `vectorStyle` prop, as a style on the map.
 *
 * ## Why React Native builds the style here and not in JavaScript
 *
 * Everywhere else the app writes a `MapViewStyle` and the SDK installs it.
 * Under React Native neither half of that works: the rules compiler is a
 * wasm binary and Hermes has no wasm, and the map is this Android SDK
 * rather than a JavaScript object. So the JS side only *describes* the
 * style — a document and a rules document, two strings — and this rebuilds
 * it with the same `com.mapconductor:vectorstyle` an Android app would use.
 * What a user sees is drawn by exactly that code.
 *
 * ## Why it is reached by reflection
 *
 * `com.mapconductor:vectorstyle` is **optional**. This class is the base of
 * every React Native provider, and an app that never adjusts a style should
 * not carry three ABIs of native compiler (about 1.3 MB) for nothing. The
 * dependency is `compileOnly` here and the app adds
 * `implementation("com.mapconductor:vectorstyle")` when it wants one;
 * without it the prop reports what to add rather than doing nothing.
 */
internal class ReactNativeVectorStyle(
    private val onDiagnostics: (List<String>) -> Unit,
) {
    private var host: MapViewStyleHost? = null
    private var pending: ReadableMap? = null
    private var reportedMissingModule = false

    /** The prop changed. Remembered until there is a controller to act on. */
    fun set(descriptor: ReadableMap?) {
        pending = descriptor
        apply()
    }

    /** A controller arrived, or was replaced. */
    fun onControllerReady(
        serviceRegistry: MapServiceRegistry,
        controller: BaseMapViewController,
    ) {
        host?.dispose()
        host = MapViewStyleHost(serviceRegistry, controller)
        apply()
    }

    fun dispose() {
        host?.dispose()
        host = null
    }

    private fun apply() {
        val host = host ?: return
        val descriptor = pending
        if (descriptor == null) {
            host.apply(null)
            return
        }
        val style = build(descriptor) ?: return
        host.apply(style, onDiagnostics)
    }

    /**
     * Builds the platform's own `VectorStyle` from the two strings.
     *
     * Reflection rather than a direct call, because the module is optional.
     * The shape being reached for is the one an Android app writes by hand:
     * `VectorStyle(document = ..., rules = StyleRules.parse(json))`.
     */
    private fun build(descriptor: ReadableMap): MapViewStyle? {
        val rulesJson = descriptor.getString("rulesJson") ?: return null
        return try {
            val sourceClass = Class.forName("com.mapconductor.vectorstyle.VectorStyleSource")
            val source =
                when {
                    descriptor.hasKey("documentJson") ->
                        Class
                            .forName("com.mapconductor.vectorstyle.VectorStyleSource\$Text")
                            .getConstructor(String::class.java)
                            .newInstance(descriptor.getString("documentJson"))

                    descriptor.hasKey("documentUrl") ->
                        Class
                            .forName("com.mapconductor.vectorstyle.VectorStyleSource\$Url")
                            .getConstructor(String::class.java, Map::class.java)
                            .newInstance(descriptor.getString("documentUrl"), headersOf(descriptor))

                    else ->
                        Class
                            .forName("com.mapconductor.vectorstyle.VectorStyleSource\$CurrentDesign")
                            .getField("INSTANCE")
                            .get(null)
                }
            val rulesClass = Class.forName("com.mapconductor.vectorstyle.StyleRules")
            val rules =
                rulesClass
                    .getMethod("parse", String::class.java)
                    .invoke(null, rulesJson)
            Class
                .forName("com.mapconductor.vectorstyle.VectorStyle")
                .getConstructor(sourceClass, rulesClass)
                .newInstance(source, rules) as MapViewStyle
        } catch (error: ClassNotFoundException) {
            reportMissingModule(error)
            null
        } catch (error: ReflectiveOperationException) {
            reportMissingModule(error)
            null
        }
    }

    private fun headersOf(descriptor: ReadableMap): Map<String, String> {
        val headers = descriptor.getMap("documentHeaders") ?: return emptyMap()
        val out = mutableMapOf<String, String>()
        val keys = headers.keySetIterator()
        while (keys.hasNextKey()) {
            val key = keys.nextKey()
            headers.getString(key)?.let { out[key] = it }
        }
        return out
    }

    private fun reportMissingModule(error: Throwable) {
        if (reportedMissingModule) return
        reportedMissingModule = true
        val message =
            "a style was given but com.mapconductor:vectorstyle is not on the classpath; " +
                "add `implementation(\"com.mapconductor:vectorstyle\")` to the app module " +
                "(${error.javaClass.simpleName}: ${error.message})"
        onDiagnostics(listOf(message))
        MapDiagnostics.sink.log("style: $message")
    }
}
