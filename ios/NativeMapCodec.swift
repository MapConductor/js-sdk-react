import CoreGraphics
import Foundation
import MapConductorCore
import UIKit

// Shared RN-payload decoding for the map provider glue views (`GoogleMapsReactNativeView`,
// `MapLibreReactNativeView`). Mirrors the codecs Android keeps in `js-sdk-react/android`
// (`NativeMarkerCodec.kt`, `NativeGroundImageCodec.kt`, `NativeRasterLayerCodec.kt`) plus the
// per-provider circle/polygon/polyline decoders (`ReactNativeCircleState.kt` and friends), which
// are provider-agnostic on iOS since both providers consume the same `MapConductorCore` types.

// MARK: - Primitives

public func mcNumber(_ value: Any?) -> NSNumber? { value as? NSNumber }
public func mcBool(_ value: Any?, default def: Bool) -> Bool { mcNumber(value)?.boolValue ?? def }
public func mcInt(_ value: Any?, default def: Int) -> Int { mcNumber(value)?.intValue ?? def }
public func mcDouble(_ value: Any?, default def: Double) -> Double { mcNumber(value)?.doubleValue ?? def }
public func mcString(_ value: Any?) -> String? { value as? String }
public func mcMap(_ value: Any?) -> [String: Any]? { value as? [String: Any] }
public func mcArray(_ value: Any?) -> [Any]? { value as? [Any] }

/// RN's `processColor()` packs a color as a 32-bit ARGB integer; used by circle/polygon/polyline/
/// ground-image/raster-layer payloads, matching Android's `ReadableMap.colorOrDefault`.
public func mcColor(argb value: Any?, default def: UIColor) -> UIColor {
    guard let n = mcNumber(value) else { return def }
    let argb = UInt32(bitPattern: Int32(truncatingIfNeeded: n.int64Value))
    return UIColor(
        red: CGFloat((argb >> 16) & 0xFF) / 255,
        green: CGFloat((argb >> 8) & 0xFF) / 255,
        blue: CGFloat(argb & 0xFF) / 255,
        alpha: CGFloat((argb >> 24) & 0xFF) / 255
    )
}

/// Like `mcColor(argb:default:)` but returns `nil` (instead of a fallback color) when absent,
/// for fields where "unset" is meaningfully different from a specific color (e.g. per-feature
/// GeoJSON style overrides that should fall back to the layer style, not to black/white).
public func mcColorOrNil(argb value: Any?) -> UIColor? {
    guard let n = mcNumber(value) else { return nil }
    return mcColor(argb: n, default: .black)
}

/// Marker-icon colors arrive as CSS-style hex strings (`#RGB`, `#RRGGBB`, `#AARRGGBB`), not
/// `processColor`-packed ints, matching Android's `Color.parseColor` usage in
/// `ReactNativeMarkerIcon.kt`.
public func mcColor(css value: Any?, default def: UIColor?) -> UIColor? {
    guard let hex = mcString(value)?.trimmingCharacters(in: .whitespaces), hex.hasPrefix("#") else { return def }
    var chars = Array(hex.dropFirst())
    switch chars.count {
    case 3: chars = chars.flatMap { [$0, $0] }
    case 6: chars.insert(contentsOf: "FF", at: 0)
    case 8: break
    default: return def
    }
    guard let value = UInt32(String(chars), radix: 16) else { return def }
    return UIColor(
        red: CGFloat((value >> 16) & 0xFF) / 255,
        green: CGFloat((value >> 8) & 0xFF) / 255,
        blue: CGFloat(value & 0xFF) / 255,
        alpha: CGFloat((value >> 24) & 0xFF) / 255
    )
}

public func mcOffset(_ value: Any?, default def: CGPoint) -> CGPoint {
    guard let map = mcMap(value) else { return def }
    return CGPoint(x: mcDouble(map["x"], default: def.x), y: mcDouble(map["y"], default: def.y))
}

public func mcGeoPoint(_ value: Any?) -> GeoPoint? {
    guard let map = mcMap(value), let lat = mcNumber(map["latitude"]), let lng = mcNumber(map["longitude"]) else { return nil }
    return GeoPoint(latitude: lat.doubleValue, longitude: lng.doubleValue, altitude: mcDouble(map["altitude"], default: 0))
}

public func mcGeoPoints(_ value: Any?) -> [GeoPoint] {
    (mcArray(value) ?? []).compactMap(mcGeoPoint)
}

public func mcGeoRectBounds(_ value: Any?) -> GeoRectBounds {
    let map = mcMap(value)
    return GeoRectBounds(southWest: mcGeoPoint(map?["southWest"]), northEast: mcGeoPoint(map?["northEast"]))
}

public func mcAttributionRules(_ value: Any?) -> [AttributionRule] {
    (mcArray(value) ?? []).compactMap { item in
        guard let map = mcMap(item), let attribution = mcString(map["attribution"]) else { return nil }
        let bounds = mcMap(map["bounds"]).flatMap { boundsMap -> GeoRectBounds? in
            guard let southWest = mcGeoPoint(boundsMap["southWest"]),
                  let northEast = mcGeoPoint(boundsMap["northEast"]) else { return nil }
            return GeoRectBounds(southWest: southWest, northEast: northEast)
        }
        return AttributionRule(
            attribution: attribution,
            minZoom: mcNumber(map["minZoom"])?.intValue,
            maxZoom: mcNumber(map["maxZoom"])?.intValue,
            bounds: bounds
        )
    }
}

public func mcCameraPosition(_ value: Any?) -> MapCameraPosition? {
    guard let map = mcMap(value), let point = mcGeoPoint(map["position"]) else { return nil }
    return MapCameraPosition(
        position: point,
        zoom: mcDouble(map["zoom"], default: 0),
        bearing: mcDouble(map["bearing"], default: 0),
        tilt: mcDouble(map["tilt"], default: 0)
    )
}

public func mcPointPayload(_ point: GeoPointProtocol) -> [String: Any] {
    let point = GeoPoint.from(position: point)
    return ["latitude": point.latitude, "longitude": point.longitude, "altitude": point.altitude ?? 0]
}

public func mcCameraPayload(_ camera: MapCameraPosition) -> [String: Any] {
    var payload: [String: Any] = [
        "position": mcPointPayload(GeoPoint.from(position: camera.position)),
        "zoom": camera.zoom,
        "bearing": camera.bearing,
        "tilt": camera.tilt
    ]
    if let visibleRegion = camera.visibleRegion {
        payload["visibleRegion"] = mcVisibleRegionPayload(visibleRegion)
    }
    return payload
}

private func mcGeoRectBoundsPayload(_ bounds: GeoRectBounds) -> [String: Any] {
    var payload: [String: Any] = [:]
    if let southWest = bounds.southWest {
        payload["southWest"] = mcPointPayload(southWest)
    }
    if let northEast = bounds.northEast {
        payload["northEast"] = mcPointPayload(northEast)
    }
    return payload
}

private func mcVisibleRegionPayload(_ region: VisibleRegion) -> [String: Any] {
    var payload: [String: Any] = ["bounds": mcGeoRectBoundsPayload(region.bounds)]
    if let nearLeft = region.nearLeft { payload["nearLeft"] = mcPointPayload(nearLeft) }
    if let nearRight = region.nearRight { payload["nearRight"] = mcPointPayload(nearRight) }
    if let farLeft = region.farLeft { payload["farLeft"] = mcPointPayload(farLeft) }
    if let farRight = region.farRight { payload["farRight"] = mcPointPayload(farRight) }
    return payload
}

// MARK: - Marker icons

private let mcImageCache = NSCache<NSString, UIImage>()

/// Supports base64 images, iOS asset-catalog names (`bundle://name`), and local file paths.
/// Bare http(s) URLs are intentionally not loaded synchronously.
public func mcLoadImage(uri: String) -> UIImage? {
    if let cached = mcImageCache.object(forKey: uri as NSString) { return cached }
    let image: UIImage?
    if uri.hasPrefix("data:image") {
        if let range = uri.range(of: "base64,"), let data = Data(base64Encoded: String(uri[range.upperBound...])) {
            image = UIImage(data: data)
        } else {
            image = nil
        }
    } else if uri.hasPrefix("bundle://") {
        let resourceName = String(uri.dropFirst("bundle://".count))
        image = UIImage(named: resourceName)
    } else if uri.hasPrefix("file://"), let url = URL(string: uri) {
        image = UIImage(contentsOfFile: url.path)
    } else {
        image = UIImage(contentsOfFile: uri)
    }
    if let image { mcImageCache.setObject(image, forKey: uri as NSString) }
    return image
}

public struct NativeMarkerIconPayload {
    public let type: String
    public let uri: String
    public let fillColor: UIColor
    public let iconSize: CGFloat
    public let scale: CGFloat
    public let anchor: CGPoint
    public let infoAnchor: CGPoint
    public let debug: Bool
    public let strokeColor: UIColor
    public let strokeWidth: CGFloat
    public let label: String?
    public let labelTextColor: UIColor?
    public let labelTextSize: CGFloat
    public let labelStrokeColor: UIColor

    public static func decode(_ value: Any?) -> NativeMarkerIconPayload? {
        guard let map = mcMap(value), let type = mcString(map["type"]),
              type == "image" || type == "imageDefault" || type == "colorDefault" else { return nil }
        let uri = mcString(map["uri"]) ?? ""
        if type != "colorDefault" && uri.isEmpty { return nil }
        return NativeMarkerIconPayload(
            type: type,
            uri: uri,
            fillColor: mcColor(css: map["fillColor"], default: .red) ?? .red,
            iconSize: CGFloat(mcDouble(map["iconSize"], default: Double(DefaultMarkerIcon.defaultIconSize))),
            scale: CGFloat(mcDouble(map["scale"], default: 1.0)),
            anchor: mcOffset(map["anchor"], default: CGPoint(x: 0.5, y: 0.5)),
            infoAnchor: mcOffset(map["infoAnchor"], default: CGPoint(x: 0.5, y: 0.5)),
            debug: mcBool(map["debug"], default: false),
            strokeColor: mcColor(css: map["strokeColor"], default: .white) ?? .white,
            strokeWidth: CGFloat(mcDouble(map["strokeWidth"], default: 1.0)),
            label: mcString(map["label"]),
            labelTextColor: mcColor(css: map["labelTextColor"], default: .black),
            labelTextSize: CGFloat(mcDouble(map["labelTextSize"], default: 18.0)),
            labelStrokeColor: mcColor(css: map["labelStrokeColor"], default: .white) ?? .white
        )
    }

    public func toMarkerIcon() -> (any MarkerIconProtocol)? {
        if type == "colorDefault" {
            return DefaultMarkerIcon(
                fillColor: fillColor,
                strokeColor: strokeColor,
                strokeWidth: strokeWidth,
                scale: scale,
                label: label,
                labelTextColor: labelTextColor,
                labelTextSize: labelTextSize,
                labelStrokeColor: labelStrokeColor,
                infoAnchor: infoAnchor,
                iconSize: iconSize,
                debug: debug
            )
        }
        guard let image = mcLoadImage(uri: uri) else { return nil }
        if type == "imageDefault" {
            return ImageDefaultIcon(
                backgroundImage: image,
                strokeColor: strokeColor,
                strokeWidth: strokeWidth,
                scale: scale,
                label: label,
                labelTextColor: labelTextColor,
                labelTextSize: labelTextSize,
                labelStrokeColor: labelStrokeColor,
                infoAnchor: infoAnchor,
                iconSize: iconSize,
                debug: debug
            )
        }
        return ImageIcon(image: image, iconSize: iconSize, scale: scale, anchor: anchor, infoAnchor: infoAnchor, debug: debug)
    }
}

public func mcMarkerIcons(_ value: Any?) -> [(any MarkerIconProtocol)?] {
    (mcArray(value) ?? []).map { NativeMarkerIconPayload.decode($0)?.toMarkerIcon() }
}

private func mcMarkerAnimation(_ value: Any?) -> MarkerAnimation? {
    switch mcString(value) {
    case "Drop": return .Drop
    case "Bounce": return .Bounce
    default: return nil
    }
}

/// Decodes the compressed `compositionMarkers()`/`appendMarkerComposition()` batch payload
/// (structure-of-arrays referring to the composition-level icon dictionary), matching Android's
/// `markerStatesFromBatchReadableMap`. Reuses an existing `MarkerState` (mutating it in place) when
/// one is already present for an id, so identity-sensitive consumers (e.g. clustering) keep it.
public func mcMarkerStatesFromBatch(
    _ payload: [String: Any],
    previousStates: [String: MarkerState] = [:],
    sharedIcons: [(any MarkerIconProtocol)?]? = nil,
    onEvent: @escaping (String, MarkerState) -> Void
) -> [MarkerState] {
    guard let ids = mcArray(payload["ids"]) as? [String], let positions = mcArray(payload["positions"]) as? [NSNumber] else { return [] }
    let clickable = mcArray(payload["clickable"]) as? [NSNumber]
    let draggable = mcArray(payload["draggable"]) as? [NSNumber]
    let zIndex = mcArray(payload["zIndex"]) as? [NSNumber]
    let iconIndex = mcArray(payload["iconIndex"]) as? [NSNumber]
    let animation = mcArray(payload["animation"])
    let icons = sharedIcons ?? mcMarkerIcons(payload["icons"])

    var result: [MarkerState] = []
    result.reserveCapacity(ids.count)
    for index in ids.indices {
        let id = ids[index]
        let offset = index * 3
        guard positions.indices.contains(offset + 2) else { continue }
        let position = GeoPoint(
            latitude: positions[offset].doubleValue,
            longitude: positions[offset + 1].doubleValue,
            altitude: positions[offset + 2].doubleValue
        )
        let isClickable = (clickable?.indices).map { $0.contains(index) } == true ? clickable![index].boolValue : true
        let isDraggable = (draggable?.indices).map { $0.contains(index) } == true ? draggable![index].boolValue : false
        let zIndexValue: Int? = (zIndex?.indices).map { $0.contains(index) } == true ? zIndex![index].intValue : nil
        let iconIdx = (iconIndex?.indices).map { $0.contains(index) } == true ? iconIndex![index].intValue : -1
        let icon = icons.indices.contains(iconIdx) ? icons[iconIdx] : nil
        let animationValue = mcMarkerAnimation((animation?.indices).map { $0.contains(index) } == true ? animation?[index] : nil)

        if let existing = previousStates[id] {
            existing.position = position
            existing.clickable = isClickable
            existing.draggable = isDraggable
            existing.zIndex = zIndexValue
            existing.icon = icon
            if let animationValue { existing.animate(animationValue) }
            result.append(existing)
        } else {
            result.append(mcMakeMarker(
                id: id,
                position: position,
                icon: icon,
                animation: animationValue,
                clickable: isClickable,
                draggable: isDraggable,
                zIndex: zIndexValue,
                onEvent: onEvent
            ))
        }
    }
    return result
}

public func mcMarkerState(_ value: Any?, onEvent: @escaping (String, MarkerState) -> Void) -> MarkerState? {
    guard let map = mcMap(value), let id = mcString(map["id"]), let position = mcGeoPoint(map["position"]) else { return nil }
    return mcMakeMarker(
        id: id,
        position: position,
        icon: NativeMarkerIconPayload.decode(map["icon"])?.toMarkerIcon(),
        animation: mcMarkerAnimation(map["animation"]),
        clickable: mcBool(map["clickable"], default: true),
        draggable: mcBool(map["draggable"], default: false),
        zIndex: mcNumber(map["zIndex"])?.intValue,
        onEvent: onEvent
    )
}

/// Applies an `updateMarker()` payload onto an existing `MarkerState` in place.
public func mcApplyMarkerUpdate(_ value: [String: Any], to state: MarkerState) {
    if let position = mcGeoPoint(value["position"]) { state.position = position }
    state.clickable = mcBool(value["clickable"], default: true)
    state.draggable = mcBool(value["draggable"], default: false)
    state.zIndex = mcNumber(value["zIndex"])?.intValue
    if let icon = NativeMarkerIconPayload.decode(value["icon"])?.toMarkerIcon() { state.icon = icon }
    if let animation = mcMarkerAnimation(value["animation"]) { state.animate(animation) }
}

private func mcMakeMarker(
    id: String,
    position: GeoPoint,
    icon: (any MarkerIconProtocol)?,
    animation: MarkerAnimation?,
    clickable: Bool,
    draggable: Bool,
    zIndex: Int?,
    onEvent: @escaping (String, MarkerState) -> Void
) -> MarkerState {
    MarkerState(
        position: position,
        id: id,
        icon: icon,
        animation: animation,
        clickable: clickable,
        draggable: draggable,
        zIndex: zIndex,
        onClick: { onEvent("markerClick", $0) },
        onDragStart: { onEvent("markerDragStart", $0) },
        onDrag: { onEvent("markerDrag", $0) },
        onDragEnd: { onEvent("markerDragEnd", $0) },
        onAnimateStart: { onEvent("markerAnimateStart", $0) },
        onAnimateEnd: { onEvent("markerAnimateEnd", $0) }
    )
}

// MARK: - Circles / polygons / polylines

public func mcCircleState(_ value: Any?, onClick: @escaping (String, CircleEvent) -> Void) -> CircleState? {
    guard let map = mcMap(value), let id = mcString(map["id"]), let center = mcGeoPoint(map["center"]) else { return nil }
    return CircleState(
        center: center,
        radiusMeters: mcDouble(map["radiusMeters"], default: 0),
        geodesic: mcBool(map["geodesic"], default: true),
        clickable: mcBool(map["clickable"], default: true),
        strokeColor: mcColor(argb: map["strokeColor"], default: .red),
        strokeWidth: mcDouble(map["strokeWidth"], default: 1.0),
        fillColor: mcColor(argb: map["fillColor"], default: UIColor(white: 1.0, alpha: 0.5)),
        id: id,
        zIndex: mcNumber(map["zIndex"])?.intValue,
        onClick: { onClick(id, $0) }
    )
}

public func mcCircleStates(_ value: Any?, onClick: @escaping (String, CircleEvent) -> Void) -> [CircleState] {
    (mcArray(value) ?? []).compactMap { mcCircleState($0, onClick: onClick) }
}

public func mcPolygonState(_ value: Any?, onClick: @escaping (String, PolygonEvent) -> Void) -> PolygonState? {
    guard let map = mcMap(value), let id = mcString(map["id"]) else { return nil }
    let points = mcGeoPoints(map["points"])
    let holes = (mcArray(map["holes"]) ?? []).map(mcGeoPoints)
    return PolygonState(
        points: points,
        id: id,
        strokeColor: mcColor(argb: map["strokeColor"], default: .black),
        strokeWidth: mcDouble(map["strokeWidth"], default: 1.0),
        fillColor: mcColor(argb: map["fillColor"], default: .clear),
        geodesic: mcBool(map["geodesic"], default: false),
        zIndex: mcInt(map["zIndex"], default: 0),
        holes: holes,
        onClick: { onClick(id, $0) }
    )
}

public func mcPolygonStates(_ value: Any?, onClick: @escaping (String, PolygonEvent) -> Void) -> [PolygonState] {
    (mcArray(value) ?? []).compactMap { mcPolygonState($0, onClick: onClick) }
}

public func mcPolylineState(_ value: Any?, onClick: @escaping (String, PolylineEvent) -> Void) -> PolylineState? {
    guard let map = mcMap(value), let id = mcString(map["id"]) else { return nil }
    let points = mcGeoPoints(map["points"])
    return PolylineState(
        points: points,
        id: id,
        strokeColor: mcColor(argb: map["strokeColor"], default: .black),
        strokeWidth: mcDouble(map["strokeWidth"], default: 1.0),
        geodesic: mcBool(map["geodesic"], default: false),
        zIndex: mcInt(map["zIndex"], default: 0),
        onClick: { onClick(id, $0) }
    )
}

public func mcPolylineStates(_ value: Any?, onClick: @escaping (String, PolylineEvent) -> Void) -> [PolylineState] {
    (mcArray(value) ?? []).compactMap { mcPolylineState($0, onClick: onClick) }
}

// MARK: - Ground images / raster layers

public func mcGroundImageState(_ value: Any?, onClick: @escaping (String, GroundImageEvent) -> Void) -> GroundImageState? {
    guard let map = mcMap(value), let id = mcString(map["id"]),
          let bounds = mcMap(map["bounds"]).flatMap({ b -> GeoRectBounds? in
              guard let sw = mcGeoPoint(b["southWest"]), let ne = mcGeoPoint(b["northEast"]) else { return nil }
              return GeoRectBounds(southWest: sw, northEast: ne)
          }),
          let imageUrl = mcString(map["imageUrl"]),
          let image = mcLoadImage(uri: imageUrl) else { return nil }
    return GroundImageState(
        bounds: bounds,
        image: image,
        opacity: mcDouble(map["opacity"], default: 1.0),
        tileSize: mcInt(map["tileSize"], default: 256),
        id: id,
        onClick: { onClick(id, $0) }
    )
}

public func mcGroundImageStates(_ value: Any?, onClick: @escaping (String, GroundImageEvent) -> Void) -> [GroundImageState] {
    (mcArray(value) ?? []).compactMap { mcGroundImageState($0, onClick: onClick) }
}

public func mcRasterSource(_ value: Any?) -> RasterSource? {
    guard let map = mcMap(value) else { return nil }
    switch mcString(map["type"]) {
    case "UrlTemplate":
        guard let template = mcString(map["template"]) else { return nil }
        return .urlTemplate(
            template: template,
            tileSize: mcInt(map["tileSize"], default: RasterSource.defaultTileSize),
            minZoom: mcNumber(map["minZoom"])?.intValue,
            maxZoom: mcNumber(map["maxZoom"])?.intValue,
            attributionRules: mcAttributionRules(map["attributionRules"]),
            scheme: mcString(map["scheme"]) == "TMS" ? .TMS : .XYZ
        )
    case "TileJson":
        guard let url = mcString(map["url"]) else { return nil }
        return .tileJson(url: url)
    case "ArcGisService":
        guard let serviceUrl = mcString(map["serviceUrl"]) else { return nil }
        return .arcGisService(serviceUrl: serviceUrl)
    default:
        return nil
    }
}

public func mcRasterLayerState(_ value: Any?) -> RasterLayerState? {
    guard let map = mcMap(value), let source = mcRasterSource(map["source"]) else { return nil }
    let extraHeaders = (mcMap(map["extraHeaders"]))?.compactMapValues { $0 as? String }
    return RasterLayerState(
        source: source,
        opacity: mcDouble(map["opacity"], default: 1.0),
        visible: mcBool(map["visible"], default: true),
        zIndex: mcInt(map["zIndex"], default: 0),
        debug: mcBool(map["debug"], default: false),
        userAgent: mcString(map["userAgent"]) ?? "MapConductor/RasterLayerAgent(https://mapconductor.com)",
        extraHeaders: extraHeaders?.isEmpty == false ? extraHeaders : nil,
        id: mcString(map["id"])
    )
}

public func mcRasterLayerStates(_ value: Any?) -> [RasterLayerState] {
    (mcArray(value) ?? []).compactMap(mcRasterLayerState)
}
