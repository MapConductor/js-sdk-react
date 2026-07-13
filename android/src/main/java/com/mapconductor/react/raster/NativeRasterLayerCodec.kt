package com.mapconductor.react.raster

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.mapconductor.core.raster.RasterLayerSource
import com.mapconductor.core.raster.RasterLayerState
import com.mapconductor.core.raster.TileScheme

fun rasterLayerStatesFromReadableArray(value: ReadableArray?): List<RasterLayerState> =
    (0 until (value?.size() ?: 0)).mapNotNull { index ->
        rasterLayerStateFromReadableMap(value?.getMap(index))
    }

fun rasterLayerStateFromReadableMap(value: ReadableMap?): RasterLayerState? {
    value ?: return null
    val source = rasterLayerSourceFromReadableMap(value.mapOrNull("source")) ?: return null
    val extraHeaders =
        value.mapOrNull("extraHeaders")?.toHashMap()?.mapNotNull { (key, headerValue) ->
            (headerValue as? String)?.let { key to it }
        }?.toMap()

    return RasterLayerState(
        id = value.stringOrNull("id"),
        source = source,
        opacity = value.doubleOrNull("opacity")?.toFloat() ?: 1f,
        visible = value.booleanOrNull("visible") ?: true,
        zIndex = value.intOrNull("zIndex") ?: 0,
        userAgent =
            value.stringOrNull("userAgent")
                ?: "MapConductor/RasterLayerAgent(https://mapconductor.com)",
        debug = value.booleanOrNull("debug") ?: false,
        extraHeaders = extraHeaders,
    )
}

private fun rasterLayerSourceFromReadableMap(value: ReadableMap?): RasterLayerSource? {
    value ?: return null
    return when (value.stringOrNull("type")) {
        "UrlTemplate" ->
            RasterLayerSource.UrlTemplate(
                template = value.stringOrNull("template") ?: return null,
                tileSize = value.intOrNull("tileSize") ?: RasterLayerSource.DEFAULT_TILE_SIZE,
                minZoom = value.intOrNull("minZoom"),
                maxZoom = value.intOrNull("maxZoom"),
                attribution = value.stringOrNull("attribution"),
                scheme =
                    when (value.stringOrNull("scheme")) {
                        "TMS" -> TileScheme.TMS
                        else -> TileScheme.XYZ
                    },
            )
        "TileJson" ->
            RasterLayerSource.TileJson(
                url = value.stringOrNull("url") ?: return null,
            )
        "ArcGisService" ->
            RasterLayerSource.ArcGisService(
                serviceUrl = value.stringOrNull("serviceUrl") ?: return null,
            )
        else -> null
    }
}

private fun ReadableMap.hasValue(key: String): Boolean = hasKey(key) && !isNull(key)

private fun ReadableMap.stringOrNull(key: String): String? =
    if (hasValue(key)) getString(key) else null

private fun ReadableMap.doubleOrNull(key: String): Double? =
    if (hasValue(key)) getDouble(key) else null

private fun ReadableMap.intOrNull(key: String): Int? =
    if (hasValue(key)) getInt(key) else null

private fun ReadableMap.booleanOrNull(key: String): Boolean? =
    if (hasValue(key)) getBoolean(key) else null

private fun ReadableMap.mapOrNull(key: String): ReadableMap? =
    if (hasValue(key)) getMap(key) else null
