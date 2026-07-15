package com.mapconductor.react.groundimage

import android.content.Context
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.features.GeoRectBounds
import com.mapconductor.core.groundimage.GroundImageEvent
import com.mapconductor.core.groundimage.GroundImageState
import com.mapconductor.react.marker.decodeNativeImageBitmap
import java.util.concurrent.ConcurrentHashMap

private val drawableCache = ConcurrentHashMap<String, Drawable>()

fun groundImageStatesFromReadableArray(
    value: ReadableArray?,
    context: Context,
    onClick: (String, GroundImageEvent) -> Unit,
): List<GroundImageState> =
    (0 until (value?.size() ?: 0)).mapNotNull { index ->
        groundImageStateFromReadableMap(value?.getMap(index), context, onClick)
    }

fun groundImageStateFromReadableMap(
    value: ReadableMap?,
    context: Context,
    onClick: (String, GroundImageEvent) -> Unit,
): GroundImageState? {
    value ?: return null
    val id = value.stringOrNull("id") ?: return null
    val bounds = value.mapOrNull("bounds")?.toGeoRectBounds() ?: return null
    val imageUrl = value.stringOrNull("imageUrl") ?: return null
    val image =
        drawableCache[imageUrl]
            ?: decodeNativeImageBitmap(imageUrl, context)?.let { bitmap ->
                BitmapDrawable(context.resources, bitmap).also { drawableCache[imageUrl] = it }
            }
            ?: return null

    return GroundImageState(
        id = id,
        bounds = bounds,
        image = image,
        opacity = value.doubleOrNull("opacity")?.toFloat() ?: 1f,
        tileSize = value.intOrNull("tileSize") ?: 256,
        onClick = { event -> onClick(id, event) },
    )
}

private fun ReadableMap.toGeoRectBounds(): GeoRectBounds? {
    val southWest = mapOrNull("southWest")?.toGeoPoint() ?: return null
    val northEast = mapOrNull("northEast")?.toGeoPoint() ?: return null
    return GeoRectBounds(southWest = southWest, northEast = northEast)
}

private fun ReadableMap.toGeoPoint(): GeoPoint? {
    return GeoPoint(
        latitude = doubleOrNull("latitude") ?: return null,
        longitude = doubleOrNull("longitude") ?: return null,
        altitude = doubleOrNull("altitude") ?: 0.0,
    )
}

private fun ReadableMap.hasValue(key: String): Boolean = hasKey(key) && !isNull(key)

private fun ReadableMap.stringOrNull(key: String): String? =
    if (hasValue(key)) getString(key) else null

private fun ReadableMap.doubleOrNull(key: String): Double? =
    if (hasValue(key)) getDouble(key) else null

private fun ReadableMap.intOrNull(key: String): Int? =
    if (hasValue(key)) getInt(key) else null

private fun ReadableMap.mapOrNull(key: String): ReadableMap? =
    if (hasValue(key)) getMap(key) else null
