import Foundation
import MapConductorCore
import SwiftUI

public typealias NativeMapExtensionEventSink = (
    _ extensionId: String,
    _ eventName: String,
    _ payload: [String: Any]
) -> Void

public protocol NativeMapExtensionRenderer: AnyObject {
    func update(payload: [String: Any])
    func dispose()

    /// The overlay(s) this extension contributes, as a standalone `MapViewContent` fragment.
    ///
    /// Extension types like GeoJSON/heatmap wrap a `ViewBasedMapOverlay` (e.g. `GeoJSONLayer`)
    /// whose non-view contributions (e.g. its backing raster tile layer) are only reachable
    /// through `MapOverlayItemProtocol.append(to:)` or the `MapViewContentBuilder` DSL — a plain
    /// `AnyView` isn't enough to pick those up. Implementations typically do:
    /// `MapViewContentBuilder.buildExpression(MyOverlay(...))`.
    func makeContent() -> MapViewContent
}

public typealias NativeMapExtensionRendererFactory = (
    _ extensionId: String,
    _ eventSink: @escaping NativeMapExtensionEventSink
) -> NativeMapExtensionRenderer

/// Per-(host, type) override tried before the global `NativeMapExtensionRegistry`.
///
/// Some extension types (e.g. marker-clustering) are generic over the concrete native marker
/// type, so a single globally-registered factory can't produce the right instantiation for every
/// map provider. A provider's own `NativeMapExtensionHost` can supply a `localFactory` that knows
/// its own concrete types, without disturbing provider-agnostic extensions (geojson, heatmap)
/// which continue to resolve through the shared global registry.
public typealias NativeMapExtensionLocalFactory = (
    _ type: String,
    _ extensionId: String,
    _ eventSink: @escaping NativeMapExtensionEventSink
) -> NativeMapExtensionRenderer?

@objc public final class NativeMapExtensionRegistry: NSObject {
    private static let lock = NSLock()
    private static var factories: [String: NativeMapExtensionRendererFactory] = [:]

    public static func register(type: String, factory: @escaping NativeMapExtensionRendererFactory) {
        precondition(!type.isEmpty, "Native map extension type must not be empty")
        lock.lock()
        factories[type] = factory
        lock.unlock()
    }

    static func make(
        type: String,
        extensionId: String,
        eventSink: @escaping NativeMapExtensionEventSink
    ) -> NativeMapExtensionRenderer? {
        lock.lock()
        let factory = factories[type]
        lock.unlock()
        return factory?(extensionId, eventSink)
    }
}

public final class NativeMapExtensionHost: ObservableObject {
    private struct Entry {
        let type: String
        let renderer: NativeMapExtensionRenderer
    }

    @Published private var entries: [String: Entry] = [:]
    private let eventSink: NativeMapExtensionEventSink
    private let localFactory: NativeMapExtensionLocalFactory?

    public init(
        eventSink: @escaping NativeMapExtensionEventSink,
        localFactory: NativeMapExtensionLocalFactory? = nil
    ) {
        self.eventSink = eventSink
        self.localFactory = localFactory
    }

    /// Merged overlay content contributed by every active extension, in no particular order.
    /// Merge into the provider's own `MapViewContent` from the provider's root view.
    public var content: MapViewContent {
        var merged = MapViewContent()
        for entry in entries.values {
            let contribution = entry.renderer.makeContent()
            merged.markers.append(contentsOf: contribution.markers)
            merged.polylines.append(contentsOf: contribution.polylines)
            merged.polygons.append(contentsOf: contribution.polygons)
            merged.circles.append(contentsOf: contribution.circles)
            merged.groundImages.append(contentsOf: contribution.groundImages)
            merged.rasterLayers.append(contentsOf: contribution.rasterLayers)
            merged.views.append(contentsOf: contribution.views)
        }
        return merged
    }

    public func upsert(extensionId: String, type: String, payload: [String: Any]) {
        if let current = entries[extensionId], current.type == type {
            current.renderer.update(payload: payload)
            return
        }

        remove(extensionId: extensionId)
        let renderer = localFactory?(type, extensionId, eventSink)
            ?? NativeMapExtensionRegistry.make(type: type, extensionId: extensionId, eventSink: eventSink)
        guard let renderer else {
            eventSink(extensionId, "error", [
                "message": "No native map extension renderer registered for type '\(type)'",
            ])
            return
        }
        entries[extensionId] = Entry(type: type, renderer: renderer)
        renderer.update(payload: payload)
    }

    public func remove(extensionId: String) {
        entries.removeValue(forKey: extensionId)?.renderer.dispose()
    }

    public func dispose() {
        entries.values.forEach { $0.renderer.dispose() }
        entries.removeAll()
    }
}
