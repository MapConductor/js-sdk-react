/*
 * RN ブリッジのペイロード変換。地図 SDK に依存しないため全プロバイダで共有する。
 * 以前は reactnative-for-* の各パッケージに同じ内容が写経されていた。
 */
package com.mapconductor.react.codec

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.features.GeoRectBounds

// --- ReadableMapExt.kt ---
fun ReadableMap.getDoubleOrNull(name: String): Double? =
    if (hasKey(name) && !isNull(name)) getDouble(name) else null

fun ReadableMap.getBooleanOrNull(name: String): Boolean? =
    if (hasKey(name) && !isNull(name)) getBoolean(name) else null

fun ReadableMap.getIntOrNull(name: String): Int? =
    if (hasKey(name) && !isNull(name)) getInt(name) else null

// --- GeoPoint.kt ---
fun GeoPoint.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
        putDouble("latitude", latitude)
        putDouble("longitude", longitude)
        putDouble("altitude", altitude)
    }

fun GeoPoint.Companion.fromReadableMap(map: ReadableMap?): GeoPoint? {
    if (map == null) return null
    val latitude = map.getDoubleOrNull("latitude") ?: return null
    val longitude = map.getDoubleOrNull("longitude") ?: return null
    return GeoPoint(latitude, longitude, map.getDoubleOrNull("altitude") ?: 0.0)
}

// --- GeoRectBounds.kt ---
fun geoRectBoundsFromReadableMap(map: ReadableMap?): GeoRectBounds {
    if (map == null) return GeoRectBounds()
    return GeoRectBounds(
        southWest = GeoPoint.fromReadableMap(map.getMap("southWest")),
        northEast = GeoPoint.fromReadableMap(map.getMap("northEast")),
    )
}
