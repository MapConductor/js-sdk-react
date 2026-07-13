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
                uri.startsWith("file:") || uri.startsWith("content:") || uri.startsWith("android.resource:") ->
                    context.contentResolver.openInputStream(Uri.parse(uri))?.use(BitmapFactory::decodeStream)
                else -> null
            }
        bitmap?.also { nativeBitmapCache[uri] = it }
    }

fun decodeNativeMarkerIcon(
    payload: ReadableMap?,
    context: Context,
): MarkerIconInterface? = NativeMarkerIcon.fromReadableMap(payload)?.toMarkerIcon(context)

fun decodeNativeMarkerBatch(
    payload: ReadableMap?,
    context: Context,
    previousStates: Map<String, MarkerState> = emptyMap(),
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
    val iconPayloads = payload.getArray("icons")
    val icons =
        if (iconPayloads == null) {
            emptyList()
        } else {
            (0 until iconPayloads.size()).map { index ->
                decodeNativeMarkerIcon(iconPayloads.getMap(index), context)
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
    val strokeColor: Color,
    val strokeWidth: Float,
    val label: String?,
    val labelTextColor: Color?,
    val labelTextSize: Float,
    val labelStrokeColor: Color,
) {
    fun toMarkerIcon(context: Context): MarkerIconInterface? =
        iconCache[this] ?: decodeBitmap(context)?.let { bitmap ->
            val icon =
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
            iconCache[this] = icon
            icon
        }

    private fun decodeBitmap(context: Context): Bitmap? =
        decodeNativeImageBitmap(uri, context)

    companion object {
        private val iconCache = ConcurrentHashMap<NativeMarkerIcon, MarkerIconInterface>()

        fun fromReadableMap(map: ReadableMap?): NativeMarkerIcon? {
            if (map == null) return null
            val type = map.string("type") ?: return null
            if (type != "image" && type != "imageDefault") return null
            val uri = map.string("uri") ?: return null
            return NativeMarkerIcon(
                type = type,
                uri = uri,
                iconSize = (map.number("iconSize") ?: 48.0).toFloat(),
                scale = (map.number("scale") ?: 1.0).toFloat(),
                anchor = map.offset("anchor", Offset(0.5f, 0.5f)),
                infoAnchor = map.offset("infoAnchor", Offset(0.5f, 0.5f)),
                debug = map.boolean("debug") ?: false,
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
