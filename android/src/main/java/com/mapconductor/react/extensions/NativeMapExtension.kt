package com.mapconductor.react.extensions

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateMapOf
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.mapconductor.compose.MapViewScope
import com.mapconductor.core.features.GeoPoint
import java.util.concurrent.ConcurrentHashMap

fun interface NativeMapExtensionEventSink {
    fun emit(
        extensionId: String,
        eventName: String,
        payload: WritableMap,
    )
}

interface NativeMapExtensionRenderer {
    /** Called on the React Native UI thread. Implementations may offload expensive decoding. */
    fun update(payload: ReadableMap?)

    /** Called from the provider wrapper when the user clicks the map. */
    fun onMapClick(
        point: GeoPoint,
        zoom: Double,
    ): Boolean = false

    @Composable
    fun MapViewScope.Render()

    fun dispose() {}
}

fun interface NativeMapExtensionRendererFactory {
    fun create(
        context: Context,
        extensionId: String,
        eventSink: NativeMapExtensionEventSink,
    ): NativeMapExtensionRenderer
}

object NativeMapExtensionRegistry {
    private val factories = ConcurrentHashMap<String, NativeMapExtensionRendererFactory>()

    fun register(
        type: String,
        factory: NativeMapExtensionRendererFactory,
    ) {
        require(type.isNotBlank()) { "Native map extension type must not be blank" }
        factories[type] = factory
    }

    fun unregister(type: String) {
        factories.remove(type)
    }

    internal fun create(
        type: String,
        context: Context,
        extensionId: String,
        eventSink: NativeMapExtensionEventSink,
    ): NativeMapExtensionRenderer? = factories[type]?.create(context, extensionId, eventSink)
}

class NativeMapExtensionHostState(
    private val context: Context,
    private val eventSink: NativeMapExtensionEventSink,
) {
    private data class Entry(
        val type: String,
        val renderer: NativeMapExtensionRenderer,
    )

    private val entries = mutableStateMapOf<String, Entry>()

    fun upsert(
        extensionId: String,
        type: String,
        payload: ReadableMap?,
    ) {
        val current = entries[extensionId]
        if (current != null && current.type == type) {
            current.renderer.update(payload)
            return
        }

        current?.renderer?.dispose()
        val renderer = NativeMapExtensionRegistry.create(type, context, extensionId, eventSink)
        if (renderer == null) {
            eventSink.emit(
                extensionId,
                "error",
                Arguments.createMap().apply {
                    putString("message", "No native map extension renderer registered for type '$type'")
                },
            )
            entries.remove(extensionId)
            return
        }
        renderer.update(payload)
        entries[extensionId] = Entry(type, renderer)
    }

    fun remove(extensionId: String) {
        entries.remove(extensionId)?.renderer?.dispose()
    }

    fun clear() {
        entries.values.forEach { it.renderer.dispose() }
        entries.clear()
    }

    fun dispatchMapClick(
        point: GeoPoint,
        zoom: Double,
    ): Boolean =
        entries.values.fold(false) { consumed, entry ->
            entry.renderer.onMapClick(point, zoom) || consumed
        }

    @Composable
    fun MapViewScope.RenderExtensions() {
        entries.toSortedMap().values.forEach { entry ->
            with(entry.renderer) { Render() }
        }
    }
}
