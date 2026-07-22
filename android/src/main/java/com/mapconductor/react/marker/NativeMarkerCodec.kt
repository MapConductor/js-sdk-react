package com.mapconductor.react.marker

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.util.Base64
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facebook.react.bridge.ReadableMap
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.marker.ColorDefaultIcon
import com.mapconductor.core.marker.DrawableDefaultIcon
import com.mapconductor.core.marker.ImageIcon
import com.mapconductor.core.marker.MarkerAnimation
import com.mapconductor.core.marker.MarkerIconInterface
import com.mapconductor.core.marker.MarkerState
import java.util.concurrent.ConcurrentHashMap

private val nativeBitmapCache = ConcurrentHashMap<String, Bitmap>()

fun decodeNativeImageBitmap(
    uri: String,
    context: Context,
): Bitmap? =
    nativeBitmapCache[uri] ?: run {
        val bitmap =
            when {
                uri.startsWith("data:image") -> {
                    val base64 = uri.substringAfter("base64,", "")
                    if (base64.isBlank()) null else {
                        val bytes = Base64.decode(base64, Base64.DEFAULT)
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    }
                }
                uri.startsWith("file:///android_res/") -> decodeDrawableResource(uri, context)
                uri.startsWith("file:") || uri.startsWith("content:") || uri.startsWith("android.resource:") ->
                    context.contentResolver.openInputStream(Uri.parse(uri))?.use(BitmapFactory::decodeStream)
                else -> decodeDrawableResource(uri, context)
            }
        bitmap?.also { nativeBitmapCache[uri] = it }
    }

private fun decodeDrawableResource(
    uri: String,
    context: Context,
): Bitmap? {
    val fileName = Uri.parse(uri).lastPathSegment ?: uri
    val resourceName = fileName.substringBeforeLast('.')
    val resourceId = context.resources.getIdentifier(resourceName, "drawable", context.packageName)
    return if (resourceId == 0) null else BitmapFactory.decodeResource(context.resources, resourceId)
}

fun decodeNativeMarkerIcon(
    payload: ReadableMap?,
    context: Context,
): MarkerIconInterface? = NativeMarkerIcon.fromReadableMap(payload)?.toMarkerIcon(context)

/**
 * Decodes a single `updateMarker()`/initial-mount payload (a plain `{id, position, ...}` map,
 * as opposed to [decodeNativeMarkerBatch]'s structure-of-arrays batch shape). Mirrors iOS's
 * `mcMarkerState`.
 */
fun decodeNativeMarkerState(
    payload: ReadableMap?,
    context: Context,
    onMarkerEvent: ((eventName: String, marker: MarkerState) -> Unit)? = null,
): MarkerState? {
    if (payload == null) return null
    val id = payload.string("id") ?: return null
    val position = payload.map("position")?.toGeoPoint() ?: return null
    val state =
        MarkerState(
            id = id,
            position = position,
            clickable = payload.boolean("clickable") ?: true,
            draggable = payload.boolean("draggable") ?: false,
            zIndex = payload.number("zIndex")?.toInt(),
            icon = decodeNativeMarkerIcon(payload.map("icon"), context),
            animation =
                payload.string("animation")?.let { runCatching { MarkerAnimation.valueOf(it) }.getOrNull() },
        )
    state.onClick = { onMarkerEvent?.invoke("markerClick", it) }
    state.onDragStart = { onMarkerEvent?.invoke("markerDragStart", it) }
    state.onDrag = { onMarkerEvent?.invoke("markerDrag", it) }
    state.onDragEnd = { onMarkerEvent?.invoke("markerDragEnd", it) }
    state.onAnimateStart = { onMarkerEvent?.invoke("markerAnimateStart", it) }
    state.onAnimateEnd = { onMarkerEvent?.invoke("markerAnimateEnd", it) }
    return state
}

/** Applies an `updateMarker()` payload onto an existing [MarkerState] in place. Mirrors iOS's `mcApplyMarkerUpdate`. */
fun applyNativeMarkerUpdate(
    payload: ReadableMap,
    context: Context,
    state: MarkerState,
) {
    payload.map("position")?.toGeoPoint()?.let { state.position = it }
    state.clickable = payload.boolean("clickable") ?: true
    state.draggable = payload.boolean("draggable") ?: false
    state.zIndex = payload.number("zIndex")?.toInt()
    decodeNativeMarkerIcon(payload.map("icon"), context)?.let { state.icon = it }
    payload.string("animation")?.let { name ->
        runCatching { MarkerAnimation.valueOf(name) }.getOrNull()?.let(state::animate)
    }
}

/**
 * Decodes the compressed `compositionMarkers()`/`appendMarkerComposition()` batch payload
 * (structure-of-arrays, referring to an icon dictionary by index). Mirrors iOS's
 * `mcMarkerStatesFromBatch`.
 *
 * @param sharedIcons When set, used instead of re-decoding `payload["icons"]` - the
 *   `beginMarkerComposition()`/`appendMarkerComposition()` wire protocol only sends the icon
 *   dictionary once per composition generation (see `beginMarkerComposition`), with every
 *   subsequent batch referencing it purely by `iconIndex`.
 */
fun decodeNativeMarkerBatch(
    payload: ReadableMap?,
    context: Context,
    previousStates: Map<String, MarkerState> = emptyMap(),
    sharedIcons: List<MarkerIconInterface?>? = null,
    onMarkerEvent: ((eventName: String, marker: MarkerState) -> Unit)? = null,
): List<MarkerState> {
    if (payload == null) return emptyList()
    val ids = payload.getArray("ids") ?: return emptyList()
    val positions = payload.getArray("positions") ?: return emptyList()
    val clickable = payload.getArray("clickable")
    val draggable = payload.getArray("draggable")
    val zIndexes = payload.getArray("zIndex")
    val iconIndexes = payload.getArray("iconIndex")
    val animations = payload.getArray("animation")
    val icons =
        sharedIcons ?: run {
            val iconPayloads = payload.getArray("icons")
            if (iconPayloads == null) {
                emptyList()
            } else {
                (0 until iconPayloads.size()).map { index ->
                    decodeNativeMarkerIcon(iconPayloads.getMap(index), context)
                }
            }
        }

    return buildList {
        for (index in 0 until ids.size()) {
            val id = ids.getString(index) ?: continue
            val positionIndex = index * 3
            if (positionIndex + 2 >= positions.size()) continue
            val position =
                GeoPoint(
                    latitude = positions.getDouble(positionIndex),
                    longitude = positions.getDouble(positionIndex + 1),
                    altitude = positions.getDouble(positionIndex + 2),
                )
            val animation =
                if (animations != null && index < animations.size() && !animations.isNull(index)) {
                    runCatching { MarkerAnimation.valueOf(animations.getString(index) ?: "") }.getOrNull()
                } else {
                    null
                }
            val iconIndex = if (iconIndexes != null && index < iconIndexes.size()) iconIndexes.getInt(index) else -1
            val state =
                previousStates[id]?.also { existing ->
                    existing.position = position
                    existing.clickable = clickable?.getBoolean(index) ?: true
                    existing.draggable = draggable?.getBoolean(index) ?: false
                    existing.zIndex = zIndexes?.getDouble(index)?.toInt()
                    existing.icon = icons.getOrNull(iconIndex)
                    animation?.let(existing::animate)
                } ?: MarkerState(
                    id = id,
                    position = position,
                    clickable = clickable?.getBoolean(index) ?: true,
                    draggable = draggable?.getBoolean(index) ?: false,
                    zIndex = zIndexes?.getDouble(index)?.toInt(),
                    icon = icons.getOrNull(iconIndex),
                    animation = animation,
                )

            state.onClick = { onMarkerEvent?.invoke("markerClick", it) }
            state.onDragStart = { onMarkerEvent?.invoke("markerDragStart", it) }
            state.onDrag = { onMarkerEvent?.invoke("markerDrag", it) }
            state.onDragEnd = { onMarkerEvent?.invoke("markerDragEnd", it) }
            state.onAnimateStart = { onMarkerEvent?.invoke("markerAnimateStart", it) }
            state.onAnimateEnd = { onMarkerEvent?.invoke("markerAnimateEnd", it) }
            add(state)
        }
    }
}

private data class NativeMarkerIcon(
    val type: String,
    val uri: String,
    val iconSize: Float,
    val scale: Float,
    val anchor: Offset,
    val infoAnchor: Offset,
    val debug: Boolean,
    val fillColor: Color,
    val strokeColor: Color,
    val strokeWidth: Float,
    val label: String?,
    val labelTextColor: Color?,
    val labelTextSize: Float,
    val labelStrokeColor: Color,
) {
    fun toMarkerIcon(context: Context): MarkerIconInterface? {
        iconCache[this]?.let { return it }
        val icon =
            if (type == "colorDefault") {
                ColorDefaultIcon(
                    fillColor = fillColor,
                    strokeColor = strokeColor,
                    strokeWidth = strokeWidth.dp,
                    scale = scale,
                    label = label,
                    labelTextColor = labelTextColor,
                    labelTextSize = labelTextSize.sp,
                    labelStrokeColor = labelStrokeColor,
                    infoAnchor = infoAnchor,
                    iconSize = iconSize.dp,
                    debug = debug,
                )
            } else {
                val bitmap = decodeBitmap(context) ?: return null
                if (type == "imageDefault") {
                    DrawableDefaultIcon(
                        backgroundDrawable = BitmapDrawable(context.resources, bitmap),
                        strokeColor = strokeColor,
                        strokeWidth = strokeWidth.dp,
                        scale = scale,
                        label = label,
                        labelTextColor = labelTextColor,
                        labelTextSize = labelTextSize.sp,
                        labelStrokeColor = labelStrokeColor,
                        infoAnchor = infoAnchor,
                        iconSize = iconSize.dp,
                        debug = debug,
                    )
                } else {
                    ImageIcon(
                        image = BitmapDrawable(context.resources, bitmap),
                        iconSize = iconSize.dp,
                        scale = scale,
                        anchor = anchor,
                        infoAnchor = infoAnchor,
                        debug = debug,
                    )
                }
            }
        iconCache[this] = icon
        return icon
    }

    private fun decodeBitmap(context: Context): Bitmap? =
        decodeNativeImageBitmap(uri, context)

    companion object {
        private val iconCache = ConcurrentHashMap<NativeMarkerIcon, MarkerIconInterface>()

        fun fromReadableMap(map: ReadableMap?): NativeMarkerIcon? {
            if (map == null) return null
            val type = map.string("type") ?: return null
            if (type != "image" && type != "imageDefault" && type != "colorDefault") return null
            val uri = if (type == "colorDefault") "" else map.string("uri") ?: return null
            return NativeMarkerIcon(
                type = type,
                uri = uri,
                iconSize = (map.number("iconSize") ?: 48.0).toFloat(),
                scale = (map.number("scale") ?: 1.0).toFloat(),
                anchor = map.offset("anchor", Offset(0.5f, 0.5f)),
                infoAnchor = map.offset("infoAnchor", Offset(0.5f, 0.5f)),
                debug = map.boolean("debug") ?: false,
                fillColor = parseColor(map.string("fillColor"), Color.Red),
                strokeColor = parseColor(map.string("strokeColor"), Color.White),
                strokeWidth = (map.number("strokeWidth") ?: 1.0).toFloat(),
                label = map.string("label"),
                labelTextColor = if (map.hasKey("labelTextColor") && map.isNull("labelTextColor")) null else
                    parseColor(map.string("labelTextColor"), Color.Black),
                labelTextSize = (map.number("labelTextSize") ?: 18.0).toFloat(),
                labelStrokeColor = parseColor(map.string("labelStrokeColor"), Color.White),
            )
        }
    }
}

private fun ReadableMap.string(key: String): String? =
    if (hasKey(key) && !isNull(key)) getString(key) else null

private fun ReadableMap.map(key: String): ReadableMap? =
    if (hasKey(key) && !isNull(key)) getMap(key) else null

private fun ReadableMap.toGeoPoint(): GeoPoint? {
    val latitude = number("latitude") ?: return null
    val longitude = number("longitude") ?: return null
    return GeoPoint(latitude = latitude, longitude = longitude, altitude = number("altitude") ?: 0.0)
}

private fun ReadableMap.number(key: String): Double? =
    if (hasKey(key) && !isNull(key)) getDouble(key) else null

private fun ReadableMap.boolean(key: String): Boolean? =
    if (hasKey(key) && !isNull(key)) getBoolean(key) else null

private fun ReadableMap.offset(
    key: String,
    fallback: Offset,
): Offset {
    val value = if (hasKey(key) && !isNull(key)) getMap(key) else null
    return Offset(
        x = (value?.number("x") ?: fallback.x.toDouble()).toFloat(),
        y = (value?.number("y") ?: fallback.y.toDouble()).toFloat(),
    )
}

private fun parseColor(
    value: String?,
    fallback: Color,
): Color = value?.let { runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull() } ?: fallback
