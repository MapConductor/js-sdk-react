package com.mapconductor.react.wrapper

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap

/**
 * ViewManager が受け取るコマンドの受け口。RN のブリッジは文字列でコマンドを指定するため、
 * プロバイダごとに `when (commandId)` を写経していると、綴り違いや追加漏れが
 * 「コンパイルは通るが黙って何もしない」という形で表に出ない。
 *
 * ラッパーにこの interface を実装させ、振り分けは
 * [MapConductorMapViewCommands.receive] 1 箇所に集約する。新しいコマンドを足すときは
 * ここに 1 行足せば、実装漏れがコンパイルエラーになる。
 */
interface MapConductorMapViewWrapper {
    fun moveCamera(cameraPosition: ReadableMap?)

    fun animateCamera(
        cameraPosition: ReadableMap?,
        durationMillis: Int,
    )

    fun fitBounds(
        bounds: ReadableMap?,
        padding: Int,
    )

    fun clearOverlays()

    fun applyUISettings(payload: ReadableMap?)

    fun compositionMarkers(payload: ReadableMap?)

    fun beginMarkerComposition(
        generation: Int,
        iconDictionary: ReadableArray?,
    )

    fun appendMarkerComposition(
        generation: Int,
        sequence: Int,
        payload: ReadableMap?,
    )

    fun commitMarkerComposition(generation: Int)

    fun updateMarker(payload: ReadableMap?)

    fun compositionCircles(payload: ReadableArray?)

    fun updateCircle(payload: ReadableMap?)

    fun compositionPolylines(payload: ReadableArray?)

    fun updatePolyline(payload: ReadableMap?)

    fun compositionPolygons(payload: ReadableArray?)

    fun updatePolygon(payload: ReadableMap?)

    fun compositionRasterLayers(payload: ReadableArray?)

    fun updateRasterLayer(payload: ReadableMap?)

    fun compositionGroundImages(payload: ReadableArray?)

    fun updateGroundImage(payload: ReadableMap?)

    fun upsertNativeMapExtension(
        extensionId: String,
        type: String,
        payload: ReadableMap?,
    )

    fun removeNativeMapExtension(extensionId: String)
}

/** コマンド振り分けと、JS のイベント名対応表。全プロバイダ共通。 */
object MapConductorMapViewCommands {
    fun receive(
        root: MapConductorMapViewWrapper,
        commandId: String,
        args: ReadableArray?,
    ) {
        when (commandId) {
            "moveCamera" -> root.moveCamera(args?.getMap(0))
            "animateCamera" -> root.animateCamera(args?.getMap(0), args?.getInt(1) ?: 0)
            "fitBounds" -> root.fitBounds(args?.getMap(0), args?.getInt(1) ?: 0)
            "clearOverlays" -> root.clearOverlays()
            "applyUISettings" -> root.applyUISettings(args?.getMap(0))
            "compositionMarkers" -> root.compositionMarkers(args?.getMap(0))
            "beginMarkerComposition" ->
                root.beginMarkerComposition(
                    generation = args?.getInt(0) ?: return,
                    iconDictionary = if (args.size() > 1 && !args.isNull(1)) args.getArray(1) else null,
                )
            "appendMarkerComposition" ->
                root.appendMarkerComposition(
                    generation = args?.getInt(0) ?: return,
                    sequence = args.getInt(1),
                    payload = args.getMap(2),
                )
            "commitMarkerComposition" -> root.commitMarkerComposition(args?.getInt(0) ?: return)
            "updateMarker" -> root.updateMarker(args?.getMap(0))
            "compositionCircles" -> root.compositionCircles(args?.getArray(0))
            "updateCircle" -> root.updateCircle(args?.getMap(0))
            "compositionPolylines" -> root.compositionPolylines(args?.getArray(0))
            "updatePolyline" -> root.updatePolyline(args?.getMap(0))
            "compositionPolygons" -> root.compositionPolygons(args?.getArray(0))
            "updatePolygon" -> root.updatePolygon(args?.getMap(0))
            "compositionRasterLayers" -> root.compositionRasterLayers(args?.getArray(0))
            "updateRasterLayer" -> root.updateRasterLayer(args?.getMap(0))
            "compositionGroundImages" -> root.compositionGroundImages(args?.getArray(0))
            "updateGroundImage" -> root.updateGroundImage(args?.getMap(0))
            "upsertNativeMapExtension" ->
                root.upsertNativeMapExtension(
                    extensionId = args?.getString(0) ?: return,
                    type = args.getString(1) ?: return,
                    payload = args.getMap(2),
                )
            "removeNativeMapExtension" ->
                root.removeNativeMapExtension(args?.getString(0) ?: return)
        }
    }

    /** ネイティブのイベント名 → JS の prop 名。JS 側の NativeMapViewProps と対になる。 */
    fun directEventTypeConstants(): MutableMap<String, Any> =
        mutableMapOf(
            "topMapLoaded" to mapOf("registrationName" to "onMapLoaded"),
            "topMarkerCompositionBatchProcessed" to
                mapOf("registrationName" to "onMarkerCompositionBatchProcessed"),
            "topMapClick" to mapOf("registrationName" to "onMapClick"),
            "topMapLongClick" to mapOf("registrationName" to "onMapLongClick"),
            "topCameraMoveStart" to mapOf("registrationName" to "onCameraMoveStart"),
            "topCameraMove" to mapOf("registrationName" to "onCameraMove"),
            "topCameraMoveEnd" to mapOf("registrationName" to "onCameraMoveEnd"),
            "topMarkerClick" to mapOf("registrationName" to "onMarkerClick"),
            "topCircleClick" to mapOf("registrationName" to "onCircleClick"),
            "topGroundImageClick" to mapOf("registrationName" to "onGroundImageClick"),
            "topPolylineClick" to mapOf("registrationName" to "onPolylineClick"),
            "topPolygonClick" to mapOf("registrationName" to "onPolygonClick"),
            "topMarkerDragStart" to mapOf("registrationName" to "onMarkerDragStart"),
            "topMarkerDrag" to mapOf("registrationName" to "onMarkerDrag"),
            "topMarkerDragEnd" to mapOf("registrationName" to "onMarkerDragEnd"),
            "topMarkerAnimateStart" to mapOf("registrationName" to "onMarkerAnimateStart"),
            "topMarkerAnimateEnd" to mapOf("registrationName" to "onMarkerAnimateEnd"),
            "topMarkerScreenPositions" to mapOf("registrationName" to "onMarkerScreenPositions"),
            "topInfoBubbleScreenPositions" to
                mapOf("registrationName" to "onInfoBubbleScreenPositions"),
            "topNativeMapExtensionEvent" to mapOf("registrationName" to "onNativeMapExtensionEvent"),
        )
}
