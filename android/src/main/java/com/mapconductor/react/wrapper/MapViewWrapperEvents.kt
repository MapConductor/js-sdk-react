package com.mapconductor.react.wrapper

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.mapconductor.core.circle.CircleEvent
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.groundimage.GroundImageEvent
import com.mapconductor.core.marker.MarkerState
import com.mapconductor.core.polygon.PolygonEvent
import com.mapconductor.core.polyline.PolylineEvent
import android.view.View

/**
 * ネイティブ側の出来事を React Native のイベントとして送る部分。
 *
 * **プロバイダに依存しない。** 送る内容はどのプロバイダでも同じ（カメラ、各図形の
 * クリック、マーカーのドラッグ／アニメーション）で、必要なのはイベントを流す View と
 * コアの型だけ。以前は 4 つのラッパーが同じコードを持っていたので、ここへ集めた。
 *
 * `Event` のサブクラスも 1 つに統合してある。以前はプロバイダごとに
 * `XxxMapViewWrapperEvent` があったが、クラス名は RN 側から見えない
 * （名前は [Event.getEventName] が返す文字列で決まる）ため分ける理由が無かった。
 */
class MapViewWrapperEventEmitter(
    private val view: View,
) {
    fun emit(
        eventName: String,
        event: WritableMap,
    ) {
        val reactContext = view.context as? ReactContext ?: return
        val surfaceId = UIManagerHelper.getSurfaceId(view)
        UIManagerHelper.getEventDispatcher(reactContext)
            ?.dispatchEvent(MapViewWrapperEvent(surfaceId, view.id, eventName, event))
    }

    /**
     * カメラの中身への変換だけはプロバイダごとに違う（傾き・方位の扱いや
     * ズームの基準が地図 SDK で異なる）ので、変換済みの [cameraMap] を受け取る。
     */
    fun emitCameraEvent(
        eventName: String,
        cameraMap: WritableMap,
    ) {
        emit(eventName, Arguments.createMap().apply { putMap("cameraPosition", cameraMap) })
    }

    fun emitPolylineClick(
        id: String,
        event: PolylineEvent,
    ) {
        emit(
            "topPolylineClick",
            Arguments.createMap().apply {
                putString("polylineId", id)
                putMap("point", geoPointToWritableMap(GeoPoint.from(event.clicked)))
            },
        )
    }

    fun emitCircleClick(
        id: String,
        event: CircleEvent,
    ) {
        emit(
            "topCircleClick",
            Arguments.createMap().apply {
                putString("circleId", id)
                putMap("point", geoPointToWritableMap(GeoPoint.from(event.clicked)))
            },
        )
    }

    fun emitPolygonClick(
        id: String,
        event: PolygonEvent,
    ) {
        emit(
            "topPolygonClick",
            Arguments.createMap().apply {
                putString("polygonId", id)
                putMap("point", geoPointToWritableMap(GeoPoint.from(event.clicked)))
            },
        )
    }

    fun emitGroundImageClick(
        id: String,
        event: GroundImageEvent,
    ) {
        val clicked = event.clicked ?: return
        emit(
            "topGroundImageClick",
            Arguments.createMap().apply {
                putString("groundImageId", id)
                putMap("point", geoPointToWritableMap(GeoPoint.from(clicked)))
            },
        )
    }

    fun emitPointEvent(
        eventName: String,
        point: GeoPoint,
    ) {
        emit(
            eventName,
            Arguments.createMap().apply {
                putMap(
                    "point",
                    Arguments.createMap().apply {
                        putDouble("latitude", point.latitude)
                        putDouble("longitude", point.longitude)
                    },
                )
            },
        )
    }

    /**
     * 地理座標を JS へ渡す形にする。
     *
     * プロバイダ側にも同名の拡張関数があるが、そちらを使うと import が曖昧になるため
     * ここでは自前に持つ（中身は同じ）。
     */
    private fun geoPointToWritableMap(point: GeoPoint): WritableMap =
        Arguments.createMap().apply {
            putDouble("latitude", point.latitude)
            putDouble("longitude", point.longitude)
            putDouble("altitude", point.altitude)
        }

    fun emitMarkerCompositionBatchProcessed(
        generation: Int,
        sequence: Int,
    ) {
        emit(
            "topMarkerCompositionBatchProcessed",
            Arguments.createMap().apply {
                putInt("generation", generation)
                putInt("sequence", sequence)
            },
        )
    }

    /** マーカー由来の出来事を、名前に応じた RN イベントへ振り分ける。 */
    fun handleMarkerEvent(
        eventName: String,
        state: MarkerState,
    ) {
        when (eventName) {
            "markerClick" -> emit("topMarkerClick", Arguments.createMap().apply { putString("markerId", state.id) })
            "markerDragStart" -> emitMarkerDrag("topMarkerDragStart", state)
            "markerDrag" -> emitMarkerDrag("topMarkerDrag", state)
            "markerDragEnd" -> emitMarkerDrag("topMarkerDragEnd", state)
            "markerAnimateStart" -> emitMarkerAnimate("topMarkerAnimateStart", state)
            "markerAnimateEnd" -> emitMarkerAnimate("topMarkerAnimateEnd", state)
        }
    }

    fun emitMarkerDrag(
        eventName: String,
        state: MarkerState,
    ) {
        emit(
            eventName,
            Arguments.createMap().apply {
                putString("markerId", state.id)
                putMap("point", geoPointToWritableMap(GeoPoint.from(state.position)))
            },
        )
    }

    fun emitMarkerAnimate(
        eventName: String,
        state: MarkerState,
    ) {
        emit(
            eventName,
            Arguments.createMap().apply {
                putString("markerId", state.id)
            },
        )
    }
}

private class MapViewWrapperEvent(
    surfaceId: Int,
    viewTag: Int,
    private val name: String,
    private val payload: WritableMap,
) : Event<MapViewWrapperEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = name

    /**
     * まとめない。カメラ移動は 1 フレームごとに出るが、間引くと JS 側が
     * 最終位置しか受け取れず、追従して描くもの（吹き出しなど）がずれる。
     */
    override fun canCoalesce(): Boolean = false

    override fun getEventData(): WritableMap = payload
}
