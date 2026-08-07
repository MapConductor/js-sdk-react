package com.mapconductor.react.wrapper

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.features.GeoPointInterface
import androidx.compose.ui.geometry.Offset
import com.mapconductor.core.marker.MarkerState
import com.mapconductor.core.marker.MarkerTilingOptions
import com.mapconductor.core.ResourceProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** 吹き出しの吸着先。JS 側が持つ id と地理座標の組。 */
data class WrapperInfoBubblePosition(
    val id: String,
    val point: GeoPoint,
)

/**
 * マーカーと吹き出しの**画面座標**を JS へ送る部分。
 *
 * JS 側はネイティブの地図の上に React のビューを重ねるので、地理座標ではなく
 * 画面上の位置が要る。カメラが動くたびに計算し直す必要がある。
 *
 * **空の payload を毎フレーム送らない**のが要点。カメラのリスナはパン・ズーム中に
 * 毎フレーム発火する。報告するものが無いとき（タイル描画中、マーカー 0 件、
 * 吹き出し 0 件）に空配列を送り続けるとブリッジが溢れ、JS 側で毎フレーム
 * setState が走る。空は「消してよい」の合図として 1 回だけ送り、
 * 中身が戻るまで抑制する。
 *
 * プロバイダに依存しない。画面座標の求め方だけがプロバイダで違う（ArcGIS は
 * SceneView の投影を先に試し、駄目なら holder に落とす）ので、[Offset] を返す
 * 関数を受け取る形にしてある。
 */
class MapViewWrapperScreenPositions(
    private val emitter: MapViewWrapperEventEmitter,
    private val scope: CoroutineScope,
) {
    // どちらもメインスレッドからのみ触る。
    private var emittedEmptyMarkers = false
    private var emittedEmptyInfoBubbles = false

    fun reset() {
        emittedEmptyMarkers = false
        emittedEmptyInfoBubbles = false
    }

    fun emitMarkers(
        markerStates: Collection<MarkerState>,
        tilingOptions: MarkerTilingOptions,
        toScreenOffset: (GeoPointInterface) -> Offset?,
    ) {
        val tilingActive = markerStates.size >= tilingOptions.minMarkerCount
        if (tilingActive || markerStates.isEmpty()) {
            emitEmptyOnce("topMarkerScreenPositions", emittedEmptyMarkers) { emittedEmptyMarkers = it }
            return
        }
        emittedEmptyMarkers = false
        scope.launch {
            val density = ResourceProvider.getDensity()
            val array =
                Arguments.createArray().apply {
                    markerStates.forEach { marker ->
                        val offset = toScreenOffset(marker.position) ?: return@forEach
                        pushMap(
                            Arguments.createMap().apply {
                                putString("markerId", marker.id)
                                putDouble("x", offset.x.toDouble() / density)
                                putDouble("y", offset.y.toDouble() / density)
                            },
                        )
                    }
                }
            emitter.emit(
                "topMarkerScreenPositions",
                Arguments.createMap().apply { putArray("positions", array) },
            )
        }
    }

    fun emitInfoBubbles(
        positions: List<WrapperInfoBubblePosition>,
        toScreenOffset: (GeoPointInterface) -> Offset?,
    ) {
        if (positions.isEmpty()) {
            emitEmptyOnce("topInfoBubbleScreenPositions", emittedEmptyInfoBubbles) { emittedEmptyInfoBubbles = it }
            return
        }
        emittedEmptyInfoBubbles = false
        scope.launch {
            val density = ResourceProvider.getDensity()
            val array =
                Arguments.createArray().apply {
                    positions.forEach { position ->
                        val offset = toScreenOffset(position.point) ?: return@forEach
                        pushMap(
                            Arguments.createMap().apply {
                                putString("id", position.id)
                                putDouble("x", offset.x.toDouble() / density)
                                putDouble("y", offset.y.toDouble() / density)
                            },
                        )
                    }
                }
            emitter.emit(
                "topInfoBubbleScreenPositions",
                Arguments.createMap().apply { putArray("positions", array) },
            )
        }
    }

    private inline fun emitEmptyOnce(
        eventName: String,
        alreadyEmitted: Boolean,
        crossinline setEmitted: (Boolean) -> Unit,
    ) {
        if (alreadyEmitted) return
        setEmitted(true)
        scope.launch {
            emitter.emit(
                eventName,
                Arguments.createMap().apply { putArray("positions", Arguments.createArray()) },
            )
        }
    }

    companion object {
        /** JS から来た吹き出しの位置一覧を読む。id と座標がそろっているものだけ採る。 */
        fun parseInfoBubblePositions(positions: ReadableArray?): List<WrapperInfoBubblePosition> =
            (0 until (positions?.size() ?: 0)).mapNotNull { index ->
                val position = positions?.getMap(index) ?: return@mapNotNull null
                val id =
                    if (position.hasKey("id") && !position.isNull("id")) {
                        position.getString("id")
                    } else {
                        null
                    } ?: return@mapNotNull null
                val latitude = readDouble(position, "latitude") ?: return@mapNotNull null
                val longitude = readDouble(position, "longitude") ?: return@mapNotNull null
                val point = GeoPoint(latitude, longitude, readDouble(position, "altitude") ?: 0.0)
                WrapperInfoBubblePosition(id = id, point = point)
            }

        /**
         * プロバイダ側にも同じ読み取りの拡張関数があるが、そちらを使うと import が
         * 曖昧になるためここでは自前に持つ（中身は同じ）。
         */
        private fun readDouble(
            map: com.facebook.react.bridge.ReadableMap,
            key: String,
        ): Double? = if (map.hasKey(key) && !map.isNull(key)) map.getDouble(key) else null
    }
}
