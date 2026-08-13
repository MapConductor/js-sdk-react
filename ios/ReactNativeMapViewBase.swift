import Combine
import Foundation
import MapConductorCore
import SwiftUI
import UIKit

/// React Native の地図ビュー本体。**プロバイダ非依存の部分をすべて持つ。**
///
/// 各 `reactnative-for-*` はこれを継承し、``makeHost()`` でプロバイダ固有のアダプタ
/// （``MCReactNativeMapHost``）を返すだけでよい。`@objc` のコマンド群・マーカーの
/// バックグラウンド取り込み・スクリーン座標の通知・拡張モジュールの受け口は全部ここにある。
///
/// ## SwiftUI を挟まない理由
///
/// android の `*MapViewWrapper` が Compose を迂回してコントローラを直接叩くのと同じ形に
/// 揃えてある。RN から来た大量のマーカー（数万件）を毎回 SwiftUI の
/// `MapViewContent` 再構築に通すと、`@Published` 更新のたびに全件の値型を作り直す
/// ことになるため。マーカーのデコードは ``markerIngestQueue`` で行い、地図への反映だけ
/// メインスレッドへ戻す。
///
/// SwiftUI が残るのは拡張モジュールが差し込むビュー（`MapViewContent.views`）だけで、
/// これは android の `extensionComposeView` に対応する。
@MainActor
open class MCReactNativeMapViewBase: UIView, MCReactNativeMapHostDelegate {
    @objc public var eventHandler: ((String, [String: Any]) -> Void)?

    /// プロバイダ固有の地図一式。サブクラスが ``makeHost()`` で作る。
    public private(set) lazy var host: MCReactNativeMapHost = {
        let host = makeHost()
        host.mcDelegate = self
        return host
    }()

    /// プロバイダ固有のアダプタを作る。**サブクラスは必ず override すること。**
    open func makeHost() -> MCReactNativeMapHost {
        fatalError("\(type(of: self)) must override makeHost()")
    }

    // MARK: - 状態

    private var mapView: UIView?
    private var initialized = false
    private var notReadyLabel: UILabel?

    private var markersById: [String: MarkerState] = [:]
    private var markers: [MarkerState] = []
    private var circles: [CircleState] = []
    private var polygons: [PolygonState] = []
    private var polylines: [PolylineState] = []
    private var groundImages: [GroundImageState] = []
    private var rasterLayers: [RasterLayerState] = []
    private var tiling = MarkerTilingOptions.Default

    private let markerIngestQueue = DispatchQueue(
        label: "com.mapconductor.react.marker-ingest",
        qos: .userInitiated
    )
    private var ingestCompositionGeneration: Int?
    private var ingestPendingMarkers: [MarkerState] = []
    private var ingestMarkerIcons: [(any MarkerIconProtocol)?] = []
    private var activeCompositionGeneration: Int?
    private var pendingMarkerUpdates: [[String: Any]] = []
    private var markerScaleViewId = 0
    private var infoBubblePositions: [(id: String, point: GeoPoint)] = []
    private var emittedEmptyMarkerScreenPositions = false
    private var emittedEmptyInfoBubbleScreenPositions = false
    private var contentUpdateScheduled = false

    // MARK: - 拡張モジュール（SwiftUI が残る唯一の場所）

    private let extensionViews = ExtensionViewsModel()
    private lazy var extensionHostingController = UIHostingController(
        rootView: ExtensionViewsRoot(model: extensionViews)
    )
    public private(set) lazy var extensionHost = NativeMapExtensionHost(
        eventSink: { [weak self] extensionId, eventName, payload in
            self?.eventHandler?(
                "nativeMapExtensionEvent",
                ["extensionId": extensionId, "eventName": eventName, "payload": payload]
            )
        },
        localFactory: { [weak self] type, extensionId, eventSink in
            self?.host.mcMakeLocalExtensionRenderer(type: type, extensionId: extensionId, eventSink: eventSink)
        }
    )
    private var extensionObserver: AnyCancellable?

    // MARK: - ライフサイクル

    public override init(frame: CGRect) {
        super.init(frame: frame)
        extensionHostingController.view.backgroundColor = .clear
        addSubview(extensionHostingController.view)
        // 拡張が差し込むビューが増減したらコンテンツを組み直す。
        extensionObserver = extensionHost.objectWillChange.sink { [weak self] _ in
            DispatchQueue.main.async { self?.setNeedsContentUpdate() }
        }
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        if markerScaleViewId != 0 {
            MCMarkerScaleBridge.remove(viewId: markerScaleViewId)
        }
    }

    open override func removeFromSuperview() {
        super.removeFromSuperview()
        extensionHost.dispose()
        host.mcUnbind()
    }

    open override func layoutSubviews() {
        super.layoutSubviews()
        // 地図の生成は最初のレイアウトまで遅らせる。RN は prop を流し込んでから
        // レイアウトするので、この時点なら apiKey やデザイン指定が揃っている。
        // android の `initializeMapIfNeeded()` と同じ位置づけ。
        initializeMapIfNeeded()
        mapView?.frame = bounds
        notReadyLabel?.frame = bounds.insetBy(dx: 16, dy: 16)
        extensionHostingController.view.frame = bounds
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    private func initializeMapIfNeeded() {
        guard !initialized, !bounds.isEmpty else { return }
        // API キーのようにビューより後から届く前提のものを待つ。GoogleMaps は
        // キー未設定のまま GMSMapView を作ると落ちるため、ここで止めて理由を出す。
        guard host.mcIsReady else {
            showNotReadyMessageIfNeeded()
            return
        }
        notReadyLabel?.removeFromSuperview()
        notReadyLabel = nil
        initialized = true
        let mapView = host.mcMakeMapView(content: buildContent())
        self.mapView = mapView
        mapView.frame = bounds
        insertSubview(mapView, at: 0)
    }

    private func showNotReadyMessageIfNeeded() {
        guard notReadyLabel == nil, let message = host.mcNotReadyMessage else { return }
        let label = UILabel()
        label.text = message
        label.numberOfLines = 0
        label.textAlignment = .center
        notReadyLabel = label
        addSubview(label)
        setNeedsLayout()
    }

    // MARK: - コンテンツ

    /// 次のランループでコンテンツを組み直す。
    ///
    /// RN は 1 フレームに複数のコマンドを投げてくる（円を足してからポリゴンを足す等）。
    /// 都度 `mcUpdateContent` すると同じマーカー配列を何度も同期し直すことになるので、
    /// まとめて 1 回にする。SwiftUI の再描画がやっていた合流をここが引き受ける。
    private func setNeedsContentUpdate() {
        guard initialized, !contentUpdateScheduled else { return }
        contentUpdateScheduled = true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.contentUpdateScheduled = false
            self.host.mcUpdateContent(self.buildContent())
        }
    }

    private func buildContent() -> MapViewContent {
        // プロバイダのレジストリが見えるのはコンテンツ組み立ての間だけ、という取り決めは
        // SwiftUI 版（各プロバイダの `body`）と同じ。前後を挟むことで、外された
        // プラグインを検知できる。
        let support = host.mcServiceRegistry.get(MarkerRenderingSupportKey.self)
        support?.beginContentPass()
        var content = MapServiceRegistryScope.with(host.mcServiceRegistry) { () -> MapViewContent in
            var content = MapViewContent()
            content.markers = markers.map(Marker.init(state:))
            content.circles = circles.map(Circle.init(state:))
            content.polygons = polygons.map(Polygon.init(state:))
            content.polylines = polylines.map(Polyline.init(state:))
            content.groundImages = groundImages.map(GroundImage.init(state:))
            content.rasterLayers = rasterLayers.map(RasterLayer.init(state:))
            content.markerTilingOptions = tiling
            mcMergeMapViewContent(extensionHost.content, into: &content)
            return content
        }
        support?.endContentPass()
        // 拡張が差し込むビューだけ SwiftUI 側へ渡し、地図本体には流さない。
        extensionViews.views = content.views
        content.views = []
        return content
    }

    // MARK: - カメラ / デザイン

    @objc public func setCameraPosition(_ payload: [String: Any]) {
        if let camera = mcCameraPosition(payload) { host.mcMoveCamera(camera, durationMillis: nil) }
    }

    @objc public func setMapDesignType(_ value: String?) {
        host.mcSetMapDesign(id: value)
        host.mcSyncNativeViewSettings()
    }

    @objc public func moveCamera(_ payload: [String: Any], duration: Double) {
        if let camera = mcCameraPosition(payload) {
            host.mcMoveCamera(camera, durationMillis: Int64(duration))
        }
    }

    @objc public func fitBounds(_ bounds: [String: Any], padding: Int) {
        host.mcFitBounds(mcGeoRectBounds(bounds), padding: padding)
    }

    /// `state.uiSettings` のジェスチャ設定を適用する。省略されたフラグは既定（有効）。
    @objc public func applyUISettings(_ payload: [String: Any]) {
        func flag(_ key: String) -> Bool { (payload[key] as? NSNumber)?.boolValue ?? true }
        host.mcApplyUISettings(
            MapUISettings(
                scrollGesture: flag("scrollGesture"),
                zoomGesture: flag("zoomGesture"),
                rotateGesture: flag("rotateGesture"),
                tiltGesture: flag("tiltGesture")
            )
        )
        host.mcSyncNativeViewSettings()
    }

    // MARK: - オーバーレイ

    @objc public func clearOverlays() {
        activeCompositionGeneration = nil
        pendingMarkerUpdates.removeAll()
        markerIngestQueue.async { [weak self] in
            self?.ingestCompositionGeneration = nil
            self?.ingestPendingMarkers.removeAll()
            self?.ingestMarkerIcons.removeAll()
        }
        markersById.removeAll()
        markers = []
        circles = []
        polygons = []
        polylines = []
        groundImages = []
        rasterLayers = []
        infoBubblePositions = []
        setNeedsContentUpdate()
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    @objc public func setMarkerTilingOptions(_ payload: [String: Any]?, viewId: Int) {
        if markerScaleViewId != 0 && markerScaleViewId != viewId {
            MCMarkerScaleBridge.remove(viewId: markerScaleViewId)
        }
        markerScaleViewId = viewId
        MCMarkerScaleBridge.invalidate(viewId: viewId)
        let iconScaleCallback: ((MarkerState, Int) -> Double)? =
            mcBool(payload?["hasIconScaleCallback"], default: false) && viewId != 0
                ? { state, zoom in
                    MCMarkerScaleBridge.requestScale(viewId: viewId, markerId: state.id, zoom: zoom)
                }
                : nil
        tiling = MarkerTilingOptions(
            enabled: mcBool(payload?["enabled"], default: true),
            debugTileOverlay: mcBool(payload?["debugTileOverlay"], default: false),
            minMarkerCount: mcInt(payload?["minMarkerCount"], default: 2000),
            cacheSize: mcInt(payload?["cacheSize"], default: 8 * 1024 * 1024),
            iconScaleCallback: iconScaleCallback
        )
        setNeedsContentUpdate()
    }

    @objc public func beginMarkerComposition(_ value: Int, icons: [[String: Any]]) {
        activeCompositionGeneration = value
        markerIngestQueue.async { [weak self] in
            guard let self else { return }
            self.ingestCompositionGeneration = value
            self.ingestPendingMarkers.removeAll(keepingCapacity: true)
            self.ingestMarkerIcons = mcMarkerIcons(icons)
        }
    }

    @objc public func appendMarkerComposition(_ value: Int, sequence: Int, payload: [String: Any]) {
        markerIngestQueue.async { [weak self] in
            guard let self, self.ingestCompositionGeneration == value else { return }
            self.ingestPendingMarkers.append(contentsOf: mcMarkerStatesFromBatch(
                payload,
                sharedIcons: self.ingestMarkerIcons,
                onEvent: { [weak self] name, marker in self?.emitMarkerEvent(name, marker) }
            ))
            DispatchQueue.main.async { [weak self] in
                guard let self, self.activeCompositionGeneration == value else { return }
                self.eventHandler?("markerCompositionBatchProcessed", ["generation": value, "sequence": sequence])
            }
        }
    }

    @objc public func commitMarkerComposition(_ value: Int) {
        markerIngestQueue.async { [weak self] in
            guard let self, self.ingestCompositionGeneration == value else { return }
            let markers = self.ingestPendingMarkers
            self.ingestPendingMarkers.removeAll()
            self.ingestMarkerIcons.removeAll()
            self.ingestCompositionGeneration = nil
            DispatchQueue.main.async { [weak self] in
                guard let self, self.activeCompositionGeneration == value else { return }
                self.markers = markers
                self.markersById = Dictionary(uniqueKeysWithValues: markers.map { ($0.id, $0) })
                self.activeCompositionGeneration = nil
                let updates = self.pendingMarkerUpdates
                self.pendingMarkerUpdates.removeAll()
                updates.forEach(self.applyMarkerUpdate)
                self.setNeedsContentUpdate()
                self.emitMarkerScreenPositions()
                self.emitInfoBubbleScreenPositions()
            }
        }
    }

    @objc public func updateMarker(_ payload: [String: Any]) {
        if activeCompositionGeneration != nil {
            pendingMarkerUpdates.append(payload)
            return
        }
        applyMarkerUpdate(payload)
        setNeedsContentUpdate()
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    private func applyMarkerUpdate(_ payload: [String: Any]) {
        guard let id = payload["id"] as? String else { return }
        if let existing = markersById[id] {
            mcApplyMarkerUpdate(payload, to: existing)
        } else if let state = mcMarkerState(payload, onEvent: { [weak self] name, marker in
            self?.emitMarkerEvent(name, marker)
        }) {
            markersById[state.id] = state
            markers.append(state)
        }
    }

    @objc public func compositionCircles(_ payload: [[String: Any]]) {
        circles = mcCircleStates(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("circleClick", ["circleId": id, "point": mcPointPayload(event.clicked)])
        })
        setNeedsContentUpdate()
    }

    @objc public func updateCircle(_ payload: [String: Any]) {
        guard let state = mcCircleState(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("circleClick", ["circleId": id, "point": mcPointPayload(event.clicked)])
        }) else { return }
        if let index = circles.firstIndex(where: { $0.id == state.id }) { circles[index] = state } else { circles.append(state) }
        setNeedsContentUpdate()
    }

    @objc public func compositionPolygons(_ payload: [[String: Any]]) {
        polygons = mcPolygonStates(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("polygonClick", ["polygonId": id, "point": mcPointPayload(event.clicked)])
        })
        setNeedsContentUpdate()
    }

    @objc public func updatePolygon(_ payload: [String: Any]) {
        guard let state = mcPolygonState(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("polygonClick", ["polygonId": id, "point": mcPointPayload(event.clicked)])
        }) else { return }
        if let index = polygons.firstIndex(where: { $0.id == state.id }) { polygons[index] = state } else { polygons.append(state) }
        setNeedsContentUpdate()
    }

    @objc public func compositionPolylines(_ payload: [[String: Any]]) {
        polylines = mcPolylineStates(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("polylineClick", ["polylineId": id, "point": mcPointPayload(event.clicked)])
        })
        setNeedsContentUpdate()
    }

    @objc public func updatePolyline(_ payload: [String: Any]) {
        guard let state = mcPolylineState(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("polylineClick", ["polylineId": id, "point": mcPointPayload(event.clicked)])
        }) else { return }
        if let index = polylines.firstIndex(where: { $0.id == state.id }) { polylines[index] = state } else { polylines.append(state) }
        setNeedsContentUpdate()
    }

    @objc public func compositionGroundImages(_ payload: [[String: Any]]) {
        groundImages = mcGroundImageStates(payload, onClick: { [weak self] id, event in
            guard let clicked = event.clicked else { return }
            self?.eventHandler?("groundImageClick", ["groundImageId": id, "point": mcPointPayload(clicked)])
        })
        setNeedsContentUpdate()
    }

    @objc public func updateGroundImage(_ payload: [String: Any]) {
        guard let state = mcGroundImageState(payload, onClick: { [weak self] id, event in
            guard let clicked = event.clicked else { return }
            self?.eventHandler?("groundImageClick", ["groundImageId": id, "point": mcPointPayload(clicked)])
        }) else { return }
        if let index = groundImages.firstIndex(where: { $0.id == state.id }) { groundImages[index] = state } else { groundImages.append(state) }
        setNeedsContentUpdate()
    }

    @objc public func compositionRasterLayers(_ payload: [[String: Any]]) {
        rasterLayers = mcRasterLayerStates(payload)
        setNeedsContentUpdate()
    }

    @objc public func updateRasterLayer(_ payload: [String: Any]) {
        guard let state = mcRasterLayerState(payload) else { return }
        if let index = rasterLayers.firstIndex(where: { $0.id == state.id }) { rasterLayers[index] = state } else { rasterLayers.append(state) }
        setNeedsContentUpdate()
    }

    @objc public func setInfoBubblePositions(_ positions: [[String: Any]]) {
        infoBubblePositions = positions.compactMap { entry in
            guard let id = entry["id"] as? String, let point = mcGeoPoint(entry) else { return nil }
            return (id: id, point: point)
        }
        emitInfoBubbleScreenPositions()
    }

    @objc public func upsertNativeMapExtension(_ extensionId: String, type: String, payload: [String: Any]) {
        extensionHost.upsert(extensionId: extensionId, type: type, payload: payload)
    }

    @objc public func removeNativeMapExtension(_ extensionId: String) {
        extensionHost.remove(extensionId: extensionId)
    }

    // MARK: - MCReactNativeMapHostDelegate

    public func mcMapLoaded() {
        eventHandler?("mapLoaded", [:])
    }

    public func mcMapClick(_ point: GeoPoint) {
        if extensionHost.dispatchMapClick(point, zoom: host.mcCameraZoom) { return }
        eventHandler?("mapClick", ["point": mcPointPayload(point)])
    }

    public func mcMapLongClick(_ point: GeoPoint) {
        eventHandler?("mapLongClick", ["point": mcPointPayload(point)])
    }

    public func mcCameraMoveStart(_ camera: MapCameraPosition) { emitCamera("cameraMoveStart", camera) }
    public func mcCameraMove(_ camera: MapCameraPosition) { emitCamera("cameraMove", camera) }
    public func mcCameraMoveEnd(_ camera: MapCameraPosition) { emitCamera("cameraMoveEnd", camera) }

    private func emitCamera(_ name: String, _ camera: MapCameraPosition) {
        eventHandler?(name, ["cameraPosition": mcCameraPayload(camera)])
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    // MARK: - スクリーン座標の通知

    private func emitMarkerEvent(_ name: String, _ marker: MarkerState) {
        switch name {
        case "markerClick", "markerAnimateStart", "markerAnimateEnd":
            eventHandler?(name, ["markerId": marker.id])
        case "markerDragStart", "markerDrag", "markerDragEnd":
            eventHandler?(name, ["markerId": marker.id, "point": mcPointPayload(GeoPoint.from(position: marker.position))])
        default:
            break
        }
    }

    private func emitMarkerScreenPositions() {
        let tilingActive = markers.count >= tiling.minMarkerCount
        if tilingActive || markers.isEmpty {
            if emittedEmptyMarkerScreenPositions { return }
            emittedEmptyMarkerScreenPositions = true
            eventHandler?("markerScreenPositions", ["positions": []])
            return
        }
        emittedEmptyMarkerScreenPositions = false
        let positions: [[String: Any]] = markers.compactMap { marker in
            guard let offset = host.mcToScreenOffset(marker.position) else { return nil }
            return ["markerId": marker.id, "x": offset.x, "y": offset.y]
        }
        eventHandler?("markerScreenPositions", ["positions": positions])
    }

    private func emitInfoBubbleScreenPositions() {
        if infoBubblePositions.isEmpty {
            if emittedEmptyInfoBubbleScreenPositions { return }
            emittedEmptyInfoBubbleScreenPositions = true
            eventHandler?("infoBubbleScreenPositions", ["positions": []])
            return
        }
        emittedEmptyInfoBubbleScreenPositions = false
        let positions: [[String: Any]] = infoBubblePositions.compactMap { entry in
            guard let offset = host.mcToScreenOffset(entry.point) else { return nil }
            return ["id": entry.id, "x": offset.x, "y": offset.y]
        }
        eventHandler?("infoBubbleScreenPositions", ["positions": positions])
    }
}

// MARK: - 拡張モジュールが差し込むビューの置き場

private final class ExtensionViewsModel: ObservableObject {
    @Published var views: [AnyView] = []
}

private struct ExtensionViewsRoot: View {
    @ObservedObject var model: ExtensionViewsModel

    var body: some View {
        ZStack {
            ForEach(0..<model.views.count, id: \.self) { index in
                model.views[index]
            }
        }
    }
}
