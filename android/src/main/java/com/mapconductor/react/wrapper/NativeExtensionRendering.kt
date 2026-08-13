package com.mapconductor.react.wrapper

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import com.facebook.react.bridge.ReadableMap
import com.mapconductor.compose.CollectAndRenderOverlays
import com.mapconductor.compose.MapViewScope
import com.mapconductor.compose.circle.LocalCircleCollector
import com.mapconductor.compose.groundimage.LocalGroundImageCollector
import com.mapconductor.compose.info.LocalInfoBubbleCollector
import com.mapconductor.compose.polygon.LocalPolygonCollector
import com.mapconductor.compose.polyline.LocalPolylineCollector
import com.mapconductor.compose.raster.LocalRasterLayerCollector
import com.mapconductor.core.controller.BaseMapViewController
import com.mapconductor.core.map.LocalMapOverlayRegistry
import com.mapconductor.core.map.LocalMapServiceRegistry
import com.mapconductor.core.map.LocalMapViewController
import com.mapconductor.core.map.MapOverlayRegistry
import com.mapconductor.core.map.MutableMapServiceRegistry
import com.mapconductor.core.marker.MarkerState
import com.mapconductor.core.marker.MarkerTilingOptions
import com.mapconductor.react.codec.getBooleanOrNull
import com.mapconductor.react.codec.getIntOrNull
import com.mapconductor.react.marker.MarkerScaleBridge

/** マーカー取り込みのトレースログのタグ。 */
const val MARKER_TRACE_TAG = "MCMarkerTrace"

/**
 * 拡張モジュール（ヒートマップ / GeoJSON レイヤ / マーカークラスタリング）を Compose で重ねる。
 *
 * RN では**マーカーだけ** Compose を通さない（大量マーカーで固まるため
 * [MapConductorMapViewWrapperBase] がコントローラを直接叩く）が、拡張はここで描く。
 * android-for-* の `XxxMapView` がやっているコレクタ配線と CompositionLocal の配布を、
 * Compose の MapView ごと省いた形で再現している。
 *
 * コントローラの型は [BaseMapViewController] で足りる（6 つの Capable interface を
 * 全部実装している）ので、以前プロバイダごとに写経されていたキャストは要らなくなった。
 */
@Composable
internal fun RenderNativeExtensions(
    scope: MapViewScope,
    registry: MapOverlayRegistry,
    controller: BaseMapViewController,
    serviceRegistry: MutableMapServiceRegistry,
    host: com.mapconductor.react.extensions.NativeMapExtensionHostState,
) {
    DisposableEffect(controller) {
        scope.groundImageCollector.setUpdateHandler { state ->
            if (controller.hasGroundImage(state)) controller.updateGroundImage(state)
        }
        scope.rasterLayerCollector.setUpdateHandler { state ->
            if (controller.hasRasterLayer(state)) controller.updateRasterLayer(state)
        }
        scope.polygonCollector.setUpdateHandler { state ->
            if (controller.hasPolygon(state)) controller.updatePolygon(state)
        }
        scope.polylineCollector.setUpdateHandler { state ->
            if (controller.hasPolyline(state)) controller.updatePolyline(state)
        }
        scope.circleCollector.setUpdateHandler { state ->
            if (controller.hasCircle(state)) controller.updateCircle(state)
        }
        onDispose {
            scope.groundImageCollector.setUpdateHandler(null)
            scope.rasterLayerCollector.setUpdateHandler(null)
            scope.polygonCollector.setUpdateHandler(null)
            scope.polylineCollector.setUpdateHandler(null)
            scope.circleCollector.setUpdateHandler(null)
        }
    }

    CollectAndRenderOverlays(
        registry = registry,
        controller = controller,
    )
    CompositionLocalProvider(
        LocalMapOverlayRegistry provides registry,
        LocalMapServiceRegistry provides serviceRegistry,
        LocalMapViewController provides controller,
        LocalInfoBubbleCollector provides scope.bubbleFlow,
        LocalCircleCollector provides scope.circleCollector,
        LocalPolylineCollector provides scope.polylineCollector,
        LocalPolygonCollector provides scope.polygonCollector,
        LocalGroundImageCollector provides scope.groundImageCollector,
        LocalRasterLayerCollector provides scope.rasterLayerCollector,
    ) {
        with(scope) {
            with(host) { RenderExtensions() }
        }
    }
}

/** JS から来たマーカータイリング設定を読む。全プロバイダ共通。 */
internal fun markerTilingOptionsFromReadableMap(
    map: ReadableMap?,
    viewId: Int,
): MarkerTilingOptions {
    if (map == null) return MarkerTilingOptions.Default
    val hasIconScaleCallback = map.getBooleanOrNull("hasIconScaleCallback") ?: false
    return MarkerTilingOptions.Default.copy(
        enabled = map.getBooleanOrNull("enabled") ?: MarkerTilingOptions.Default.enabled,
        debugTileOverlay = map.getBooleanOrNull("debugTileOverlay")
            ?: MarkerTilingOptions.Default.debugTileOverlay,
        minMarkerCount = map.getIntOrNull("minMarkerCount") ?: MarkerTilingOptions.Default.minMarkerCount,
        cacheSize = map.getIntOrNull("cacheSize") ?: MarkerTilingOptions.Default.cacheSize,
        iconScaleCallback =
            if (hasIconScaleCallback) {
                { state: MarkerState, zoom: Int -> MarkerScaleBridge.requestScale(viewId, state.id, zoom) }
            } else {
                null
            },
    )
}
