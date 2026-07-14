package com.mapconductor.react.marker

import android.util.Log
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Public entry point for native marker-tiling code (e.g. MapLibreMapViewWrapper,
 * GoogleMapViewWrapper) to synchronously resolve an icon scale from the JS-defined
 * `iconScaleCallback` registered for a given view.
 *
 * Requests are cached per (viewId, markerId, zoom): the tile renderer calls this once
 * per marker per tile render, and the same marker is typically visible across many
 * tiles at the same zoom, so caching avoids redundant JS round trips.
 */
object MarkerScaleBridge {
    private const val DEFAULT_TIMEOUT_MS = 250.0

    init {
        System.loadLibrary("mapconductor_markerscale")
    }

    private val cache = ConcurrentHashMap<String, Double>()
    private val loggedCallCount = AtomicInteger(0)

    fun requestScale(viewId: Int, markerId: String, zoom: Int): Double {
        val key = "$viewId $markerId $zoom"
        cache[key]?.let { return it }
        val scale = nativeRequestScale(viewId, markerId, zoom, DEFAULT_TIMEOUT_MS)
        if (loggedCallCount.getAndIncrement() < 20) {
            Log.d("MarkerScaleBridge", "requestScale viewId=$viewId markerId=$markerId zoom=$zoom -> $scale")
        }
        // NaN means the bridge wasn't ready yet (see MarkerScaleBridge.cpp); don't
        // cache it, so the next tile render for this marker retries instead of
        // being stuck at a pre-startup fallback for the view's whole lifetime.
        if (scale.isNaN()) return 1.0
        cache[key] = scale
        return scale
    }

    /** Drops cached scales for a view, e.g. when it unmounts or its callback changes. */
    fun invalidate(viewId: Int) {
        val prefix = "$viewId "
        cache.keys.removeAll { it.startsWith(prefix) }
    }

    // Registered as static (JNI receives a jclass, not a jobject); required for
    // an `object`'s member too, since without @JvmStatic it still targets INSTANCE.
    @JvmStatic
    private external fun nativeRequestScale(
        viewId: Int,
        markerId: String,
        zoom: Int,
        timeoutMs: Double,
    ): Double
}
