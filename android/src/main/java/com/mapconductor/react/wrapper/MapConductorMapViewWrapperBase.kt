package com.mapconductor.react.wrapper

import android.content.Context
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.widget.FrameLayout
import androidx.compose.ui.platform.ComposeView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.mapconductor.core.ResourceProvider
import com.mapconductor.core.controller.BaseMapViewController
import com.mapconductor.core.groundimage.GroundImageState
import com.mapconductor.core.map.MapCameraPosition
import com.mapconductor.core.map.MapOverlayRegistry
import com.mapconductor.core.map.MapUISettings
import com.mapconductor.core.marker.MarkerIconInterface
import com.mapconductor.core.marker.MarkerOverlay
import com.mapconductor.core.marker.MarkerState
import com.mapconductor.core.marker.MarkerTilingOptions
import com.mapconductor.core.raster.RasterLayerState
import com.mapconductor.react.circle.circleStateFromReadableMap
import com.mapconductor.react.circle.circleStatesFromReadableArray
import com.mapconductor.react.codec.fromReadableMap
import com.mapconductor.react.codec.geoRectBoundsFromReadableMap
import com.mapconductor.react.codec.getBooleanOrNull
import com.mapconductor.react.codec.toWritableMap
import com.mapconductor.react.extensions.NativeMapExtensionHostState
import com.mapconductor.react.groundimage.groundImageStateFromReadableMap
import com.mapconductor.react.groundimage.groundImageStatesFromReadableArray
import com.mapconductor.react.marker.MarkerScaleBridge
import com.mapconductor.react.marker.applyNativeMarkerUpdate
import com.mapconductor.react.marker.decodeNativeMarkerBatch
import com.mapconductor.react.marker.decodeNativeMarkerIcon
import com.mapconductor.react.marker.decodeNativeMarkerState
import com.mapconductor.react.polygon.polygonStateFromReadableMap
import com.mapconductor.react.polygon.polygonStatesFromReadableArray
import com.mapconductor.react.polyline.polylineStateFromReadableMap
import com.mapconductor.react.polyline.polylineStatesFromReadableArray
import com.mapconductor.react.raster.rasterLayerStateFromReadableMap
import com.mapconductor.react.raster.rasterLayerStatesFromReadableArray
import java.util.concurrent.Executors
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * RN の地図ビュー本体。プロバイダ非依存の仕事を全部持つ。
 *
 * RN では Compose の `XxxMapView` を通さず、**RN 層からコア層のコントローラを直接叩く**。
 * マーカーが数万件になると Compose の再コンポジションで固まるため。拡張モジュール
 * （ヒートマップ / GeoJSON レイヤ / クラスタリング）だけは [extensionComposeView] に載せる。
 *
 * プロバイダ側に残るのは [MapConductorReactNativeHost] の実装だけ
 * （ネイティブの地図生成 / デザイン変換 / 投影 / 破棄）。
 * iOS の `MCReactNativeMapViewBase`（js-sdk-react/ios）と対になる。
 */
abstract class MapConductorMapViewWrapperBase(context: Context) :
    FrameLayout(context),
    MapConductorMapViewWrapper,
    MapConductorReactNativeHostDelegate {
    companion object {
        // 全ラッパーインスタンスで共有する 1 本のバックグラウンドスレッド。
        // ReadableArray/ReadableMap の解析とマーカーアイコンのデコード（JNI + ビットマップ I/O）を
        // UI スレッドから外すためのもの。20k 件規模の compositionMarkers() でも地図が固まらない。
        // 単一スレッドなのは、同じビューに対する compositionMarkers / updateMarker /
        // clearOverlays が重なったとき、React Native が発行した順に `markerStates` へ
        // 反映されるようにするため。
        private val markerIngestDispatcher: CoroutineDispatcher =
            Executors.newSingleThreadExecutor { r ->
                Thread(r, "MCMarkerIngest").apply { isDaemon = true }
            }.asCoroutineDispatcher()
    }

    /** プロバイダ固有の地図一式。サブクラスが 1 つ差すだけ。 */
    protected abstract val host: MapConductorReactNativeHost

    private val mainCoroutine: CoroutineScope = CoroutineScope(Dispatchers.Main)
    private val markerCoroutine: CoroutineScope = CoroutineScope(markerIngestDispatcher)

    private val extensionComposeView = ComposeView(context)
    private val extensionRegistry by lazy {
        MapOverlayRegistry().apply {
            host.extensionScope
                .buildRegistry()
                .getAll()
                // マーカーだけは Compose を通さない（大量マーカーで固まるため）。
                .filterNot { it is MarkerOverlay }
                .forEach(::register)
        }
    }

    private var mapView: View? = null

    // メインスレッド（カメラ / ライフサイクルのコールバック）と markerCoroutine の
    // バックグラウンドスレッド（compositionMarkers / updateMarker）の両方から読む。
    // 素の `var` だと onDropViewInstance() の書き込みとマーカーコルーチンの読み取りの間に
    // happens-before が無く、GC 負荷が高いときに「破棄済みコントローラへの古い非 null 参照」を
    // 観測しうる。@Volatile で書き込みを即座に見えるようにする。
    @Volatile
    private var mapController: BaseMapViewController? = null

    private var initialized = false
    private var emittedMapLoaded = false

    /** JS が要求したカメラ。地図生成時の初期カメラにも使う。 */
    private var requestedCameraPosition: MapCameraPosition? = null

    /** 地図から上がってきた最新のカメラ。拡張へマップクリックを配るときのズームに使う。 */
    private var latestCameraPosition: MapCameraPosition? = null

    // ビュー生成前に applyUISettings が来ることがある（RN は prop/command の到達順を
    // 保証しない）。コントローラが出来た時点で configureController から流し込む。
    private var pendingUISettings: MapUISettings = MapUISettings.Default

    private var markerStates: Map<String, MarkerState> = emptyMap()
    private var markerCompositionGeneration: Int? = null
    private val markerCompositionBuffer = mutableMapOf<String, MarkerState>()
    private var markerCompositionIcons: List<MarkerIconInterface?> = emptyList()
    private var rasterLayerStates: Map<String, RasterLayerState> = emptyMap()
    private var groundImageStates: Map<String, GroundImageState> = emptyMap()
    private var markerTilingOptions = MarkerTilingOptions.Default
    private var infoBubblePositions: List<WrapperInfoBubblePosition> = emptyList()

    private val events = MapViewWrapperEventEmitter(this)
    private val screenPositions = MapViewWrapperScreenPositions(events, mainCoroutine)

    private val nativeMapExtensionHost =
        NativeMapExtensionHostState(context) { extensionId, eventName, payload ->
            events.emit(
                "topNativeMapExtensionEvent",
                Arguments.createMap().apply {
                    putString("extensionId", extensionId)
                    putString("eventName", eventName)
                    putMap("payload", payload)
                },
            )
        }

    init {
        ResourceProvider.init(context)

        // 拡張が何も差し込んでいなくてもこの Compose ビューは全面に載るので、
        // クリック可能なままだとタップを吸って地図に届かなくなる。
        extensionComposeView.isClickable = false
        extensionComposeView.isFocusable = false
        addView(
            extensionComposeView,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
        )
    }

    // ---------------------------------------------------------------- lifecycle

    /** ViewManager の `onAfterUpdateTransaction` から呼ばれる。prop が揃ってから地図を作る。 */
    fun initializeMapIfNeeded() {
        if (initialized) return
        initialized = true
        markerTrace("wrapper init")

        val nativeMapView =
            host.createMapView(
                context = context,
                initialCamera = requestedCameraPosition ?: MapCameraPosition.Default,
                markerTiling = markerTilingOptions,
                delegate = this,
            )
        mapView = nativeMapView
        addView(
            nativeMapView,
            0,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
        )
    }

    /** ViewManager の `onDropViewInstance` から呼ばれる。 */
    fun onDropViewInstance() {
        markerTrace("wrapper drop")
        initialized = false
        MarkerScaleBridge.invalidate(id)
        nativeMapExtensionHost.clear()
        extensionComposeView.disposeComposition()
        // 破棄する前に参照を null にする。ここより後にコントローラを読むマーカーコルーチンは
        // null を見て何もしない（MarkerManager が破棄済みの参照を掴まない）。
        mapController = null
        host.destroy()
        mapView = null
        markerCoroutine.cancel()
        mainCoroutine.cancel()
    }

    override fun onLayout(
        changed: Boolean,
        left: Int,
        top: Int,
        right: Int,
        bottom: Int,
    ) {
        super.onLayout(changed, left, top, right, bottom)
        mapView?.layout(0, 0, right - left, bottom - top)
        extensionComposeView.layout(0, 0, right - left, bottom - top)
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    // -------------------------------------------- MapConductorReactNativeHostDelegate

    override val isAttached: Boolean
        get() = initialized

    override fun onControllerReady(controller: BaseMapViewController) {
        mapController = controller
        configureController(controller)
        extensionComposeView.setContent {
            RenderNativeExtensions(
                scope = host.extensionScope,
                registry = extensionRegistry,
                controller = controller,
                serviceRegistry = host.serviceRegistry,
                host = nativeMapExtensionHost,
            )
        }
        markerCoroutine.launch {
            runMarkerControllerCall { controller.compositionMarkers(markerStates.values.toList()) }
        }
    }

    override fun onMapLoaded() {
        if (emittedMapLoaded) return
        emittedMapLoaded = true
        markerTrace("SDK onMapLoaded callback")
        events.emit("topMapLoaded", Arguments.createMap())
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    private fun configureController(controller: BaseMapViewController) {
        controller.applyUISettings(pendingUISettings)
        controller.setCameraMoveStartListener { camera ->
            latestCameraPosition = camera
            events.emitCameraEvent("topCameraMoveStart", camera.toWritableMap())
            emitMarkerScreenPositions()
            emitInfoBubbleScreenPositions()
        }
        controller.setCameraMoveListener { camera ->
            latestCameraPosition = camera
            events.emitCameraEvent("topCameraMove", camera.toWritableMap())
            emitMarkerScreenPositions()
            emitInfoBubbleScreenPositions()
        }
        controller.setCameraMoveEndListener { camera ->
            latestCameraPosition = camera
            events.emitCameraEvent("topCameraMoveEnd", camera.toWritableMap())
            emitMarkerScreenPositions()
            emitInfoBubbleScreenPositions()
        }
        controller.setMapClickListener { point ->
            val zoom =
                latestCameraPosition?.zoom
                    ?: requestedCameraPosition?.zoom
                    ?: MapCameraPosition.Default.zoom
            if (!nativeMapExtensionHost.dispatchMapClick(point, zoom)) {
                events.emitPointEvent("topMapClick", point)
            }
        }
        controller.setMapLongClickListener { events.emitPointEvent("topMapLongClick", it) }
    }

    // ------------------------------------------------------------------- props

    fun setCameraPosition(cameraPosition: ReadableMap?) {
        val position = MapCameraPosition.fromReadableMap(cameraPosition)
        requestedCameraPosition = position
        mapController?.moveCamera(position)
    }

    fun setMapDesignType(mapDesignType: String?) {
        host.setMapDesign(mapDesignType)
    }

    fun setInfoBubblePositions(positions: ReadableArray?) {
        infoBubblePositions = MapViewWrapperScreenPositions.parseInfoBubblePositions(positions)
        emitInfoBubbleScreenPositions()
    }

    fun setMarkerTilingOptions(options: ReadableMap?) {
        markerTilingOptions = markerTilingOptionsFromReadableMap(options, viewId = id)
        MarkerScaleBridge.invalidate(id)
    }

    // ---------------------------------------------------------------- commands

    override fun moveCamera(cameraPosition: ReadableMap?) {
        setCameraPosition(cameraPosition)
    }

    override fun animateCamera(
        cameraPosition: ReadableMap?,
        durationMillis: Int,
    ) {
        val position = MapCameraPosition.fromReadableMap(cameraPosition)
        requestedCameraPosition = position
        mapController?.animateCamera(position, durationMillis.toLong())
    }

    override fun fitBounds(
        bounds: ReadableMap?,
        padding: Int,
    ) {
        mapController?.fitBounds(geoRectBoundsFromReadableMap(bounds), padding)
    }

    /**
     * `state.uiSettings` のジェスチャ設定をネイティブへ適用する。
     * 省略されたフラグは MapUISettings の既定（true = 有効）に倒す。
     */
    override fun applyUISettings(payload: ReadableMap?) {
        val settings =
            MapUISettings(
                scrollGesture = payload?.getBooleanOrNull("scrollGesture") ?: true,
                zoomGesture = payload?.getBooleanOrNull("zoomGesture") ?: true,
                rotateGesture = payload?.getBooleanOrNull("rotateGesture") ?: true,
                tiltGesture = payload?.getBooleanOrNull("tiltGesture") ?: true,
            )
        pendingUISettings = settings
        mapController?.applyUISettings(settings)
    }

    override fun clearOverlays() {
        // markerCoroutine 経由にしてあるので、同じキューに残っている
        // compositionMarkers / updateMarker との順序が保たれる。
        markerCoroutine.launch {
            markerStates = emptyMap()
            runMarkerControllerCall { mapController?.compositionMarkers(emptyList()) }
            withContext(Dispatchers.Main) {
                mapController?.compositionPolygons(emptyList())
                mapController?.compositionPolylines(emptyList())
                mapController?.compositionCircles(emptyList())
                val groundImageIds = groundImageStates.keys
                groundImageStates = emptyMap()
                host.extensionScope.groundImageCollector.flow.value =
                    host.extensionScope.groundImageCollector.flow.value
                        .filterKeys { id -> id !in groundImageIds }
                        .toMutableMap()
                val rasterLayerIds = rasterLayerStates.keys
                rasterLayerStates = emptyMap()
                host.extensionScope.rasterLayerCollector.flow.value =
                    host.extensionScope.rasterLayerCollector.flow.value
                        .filterKeys { id -> id !in rasterLayerIds }
                        .toMutableMap()
                infoBubblePositions = emptyList()
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
        }
    }

    // ----------------------------------------------------------------- markers

    override fun compositionMarkers(payload: ReadableMap?) {
        markerCoroutine.launch {
            val nextStates =
                decodeNativeMarkerBatch(
                    payload = payload,
                    context = context,
                    previousStates = markerStates,
                    onMarkerEvent = events::handleMarkerEvent,
                ).associateBy { it.id }
            markerStates = nextStates
            runMarkerControllerCall { mapController?.compositionMarkers(nextStates.values.toList()) }
            withContext(Dispatchers.Main) {
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
        }
    }

    override fun beginMarkerComposition(
        generation: Int,
        iconDictionary: ReadableArray?,
    ) {
        markerTrace("begin received generation=$generation icons=${iconDictionary?.size() ?: 0}")
        markerCoroutine.launch {
            markerTrace("begin executing generation=$generation")
            markerCompositionGeneration = generation
            markerCompositionBuffer.clear()
            markerCompositionIcons =
                if (iconDictionary == null) {
                    emptyList()
                } else {
                    (0 until iconDictionary.size()).map { index ->
                        decodeNativeMarkerIcon(iconDictionary.getMap(index), context)
                    }
                }
        }
    }

    override fun appendMarkerComposition(
        generation: Int,
        sequence: Int,
        payload: ReadableMap?,
    ) {
        val count = payload?.getArray("ids")?.size() ?: 0
        markerTrace("append received generation=$generation sequence=$sequence count=$count")
        markerCoroutine.launch {
            val startedAt = SystemClock.elapsedRealtime()
            if (markerCompositionGeneration != generation) {
                markerTrace(
                    "append ignored generation=$generation sequence=$sequence current=$markerCompositionGeneration",
                )
                return@launch
            }
            decodeNativeMarkerBatch(
                payload = payload,
                context = context,
                sharedIcons = markerCompositionIcons,
                onMarkerEvent = events::handleMarkerEvent,
            ).forEach { state ->
                markerCompositionBuffer[state.id] = state
            }
            markerTrace(
                "append decoded generation=$generation sequence=$sequence count=$count " +
                    "buffer=${markerCompositionBuffer.size} elapsedMs=${SystemClock.elapsedRealtime() - startedAt}",
            )
            withContext(Dispatchers.Main) {
                markerTrace("append ACK emit generation=$generation sequence=$sequence")
                events.emitMarkerCompositionBatchProcessed(generation, sequence)
            }
        }
    }

    override fun commitMarkerComposition(generation: Int) {
        markerTrace("commit received generation=$generation")
        markerCoroutine.launch {
            if (markerCompositionGeneration != generation) {
                markerTrace("commit ignored generation=$generation current=$markerCompositionGeneration")
                return@launch
            }
            val nextStates = markerCompositionBuffer.toMap()
            markerCompositionBuffer.clear()
            markerCompositionIcons = emptyList()
            markerCompositionGeneration = null
            val startedAt = SystemClock.elapsedRealtime()
            markerTrace("commit controller assignment start generation=$generation count=${nextStates.size}")
            markerStates = nextStates
            runMarkerControllerCall { mapController?.compositionMarkers(nextStates.values.toList()) }
            markerTrace(
                "commit controller assignment end generation=$generation count=${nextStates.size} " +
                    "elapsedMs=${SystemClock.elapsedRealtime() - startedAt}",
            )
            withContext(Dispatchers.Main) {
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
        }
    }

    override fun updateMarker(marker: ReadableMap?) {
        if (marker == null) return
        markerCoroutine.launch {
            val id = if (marker.hasKey("id") && !marker.isNull("id")) marker.getString("id") else null
            val existing = id?.let(markerStates::get)
            if (existing == null) {
                // まだ地図に載っていないマーカーは updateMarker では出せない
                // （コアの AbstractMarkerController.update は未登録 id を黙って捨てる）。
                // 追加してから composition で流し直す。
                val state = decodeNativeMarkerState(marker, context, events::handleMarkerEvent) ?: return@launch
                markerStates = markerStates + (state.id to state)
                runMarkerControllerCall { mapController?.compositionMarkers(markerStates.values.toList()) }
            } else {
                applyNativeMarkerUpdate(marker, context, existing)
                runMarkerControllerCall { mapController?.updateMarker(existing) }
            }
            withContext(Dispatchers.Main) {
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
        }
    }

    // ---------------------------------------------------------------- overlays

    override fun compositionPolylines(polylines: ReadableArray?) {
        val states = polylineStatesFromReadableArray(polylines, events::emitPolylineClick)
        mainCoroutine.launch { mapController?.compositionPolylines(states) }
    }

    override fun updatePolyline(polyline: ReadableMap?) {
        val state = polylineStateFromReadableMap(polyline, events::emitPolylineClick) ?: return
        mainCoroutine.launch { mapController?.updatePolyline(state) }
    }

    override fun compositionCircles(circles: ReadableArray?) {
        val states = circleStatesFromReadableArray(circles, events::emitCircleClick)
        mainCoroutine.launch { mapController?.compositionCircles(states) }
    }

    override fun updateCircle(circle: ReadableMap?) {
        val state = circleStateFromReadableMap(circle, events::emitCircleClick) ?: return
        mainCoroutine.launch { mapController?.updateCircle(state) }
    }

    override fun compositionPolygons(polygons: ReadableArray?) {
        val states = polygonStatesFromReadableArray(polygons, events::emitPolygonClick)
        mainCoroutine.launch { mapController?.compositionPolygons(states) }
    }

    override fun updatePolygon(polygon: ReadableMap?) {
        val state = polygonStateFromReadableMap(polygon, events::emitPolygonClick) ?: return
        mainCoroutine.launch { mapController?.updatePolygon(state) }
    }

    override fun compositionRasterLayers(layers: ReadableArray?) {
        val states = rasterLayerStatesFromReadableArray(layers)
        val previousIds = rasterLayerStates.keys
        rasterLayerStates = states.associateBy { it.id }
        val extensionLayers =
            host.extensionScope.rasterLayerCollector.flow.value.filterKeys { id -> id !in previousIds }
        host.extensionScope.rasterLayerCollector.flow.value =
            (extensionLayers + rasterLayerStates).toMutableMap()
    }

    override fun updateRasterLayer(layer: ReadableMap?) {
        val state = rasterLayerStateFromReadableMap(layer) ?: return
        rasterLayerStates = rasterLayerStates + (state.id to state)
        host.extensionScope.rasterLayerCollector.flow.value =
            host.extensionScope.rasterLayerCollector.flow.value
                .toMutableMap()
                .apply { put(state.id, state) }
    }

    override fun compositionGroundImages(images: ReadableArray?) {
        val states = groundImageStatesFromReadableArray(images, context, events::emitGroundImageClick)
        val previousIds = groundImageStates.keys
        groundImageStates = states.associateBy { it.id }
        val extensionImages =
            host.extensionScope.groundImageCollector.flow.value.filterKeys { id -> id !in previousIds }
        host.extensionScope.groundImageCollector.flow.value =
            (extensionImages + groundImageStates).toMutableMap()
    }

    override fun updateGroundImage(image: ReadableMap?) {
        val state = groundImageStateFromReadableMap(image, context, events::emitGroundImageClick) ?: return
        groundImageStates = groundImageStates + (state.id to state)
        host.extensionScope.groundImageCollector.flow.value =
            host.extensionScope.groundImageCollector.flow.value
                .toMutableMap()
                .apply { put(state.id, state) }
    }

    // -------------------------------------------------------------- extensions

    override fun upsertNativeMapExtension(
        extensionId: String,
        type: String,
        payload: ReadableMap?,
    ) {
        nativeMapExtensionHost.upsert(extensionId, type, payload)
    }

    override fun removeNativeMapExtension(extensionId: String) {
        nativeMapExtensionHost.remove(extensionId)
    }

    // ----------------------------------------------------------------- helpers

    private fun emitMarkerScreenPositions() {
        screenPositions.emitMarkers(markerStates.values, markerTilingOptions) { host.toScreenOffset(it) }
    }

    private fun emitInfoBubbleScreenPositions() {
        screenPositions.emitInfoBubbles(infoBubblePositions) { host.toScreenOffset(it) }
    }

    private fun markerTrace(message: String) {
        Log.d(
            MARKER_TRACE_TAG,
            "[${host.providerName}][RN][t=${SystemClock.elapsedRealtime()}]" +
                "[thread=${Thread.currentThread().name}] $message",
        )
    }

    /**
     * マーカーの取り込みは markerCoroutine のバックグラウンドスレッドで走るため、
     * onDropViewInstance() がメインスレッドでコントローラの MarkerManager を壊した瞬間に
     * まだ処理中のコマンドが残っていることがある（ビューはもう無いので、取り残しの更新が
     * 失敗してもアプリを落とすほどのことではない）。この競合だけを飲み込む。
     * キャンセルを含め、それ以外はそのまま伝播させる。
     */
    private suspend fun runMarkerControllerCall(block: suspend () -> Unit) {
        try {
            block()
        } catch (e: CancellationException) {
            throw e
        } catch (e: IllegalStateException) {
            markerTrace("marker controller call skipped after teardown: ${e.message}")
        }
    }
}
