import Foundation
import MapConductorCore

/**
 How a ``MapViewStyle`` reaches a React Native map.

 ## Why the style is built here and not in JavaScript

 Everywhere else the app writes a `MapViewStyle` and the SDK installs it.
 Under React Native neither half of that works: the rules compiler is a wasm
 binary and Hermes has no wasm, and the map is this iOS SDK rather than a
 JavaScript object. So the JS side only *describes* the style — a document
 and a rules document, two strings — and `MapConductorVectorStyle` rebuilds
 it here. What a user sees is drawn by exactly the code a native app runs.

 ## Why this is a registry and not a dependency

 `MapConductorVectorStyle` carries the compiler, 2.6 MB of it, and this
 package is the base of every React Native provider. Depending on it would
 put that in every app whether or not it ever adjusts a style. So the pod
 that has the compiler registers itself here when the app installs it, and
 an app that does not gets a diagnostic naming the pod to add rather than a
 prop that quietly does nothing.

 The Android side does the same thing with `Class.forName`, which Swift has
 no equivalent of for a Swift type; this is the same seam spelled the way
 iOS can spell it.
 */
public enum MCReactNativeVectorStyle {
    /// What the descriptor from JavaScript means, filled in by the pod that
    /// carries the compiler. Set once, when that pod loads.
    public nonisolated(unsafe) static var builder: ((MCVectorStyleDescriptor) -> MapViewStyle?)?

    /// The pod to add, named in the diagnostic so the fix is in the message.
    public static let moduleName = "MapConductorReactVectorStyle"
}

/// The `vectorStyle` prop, parsed. Mirrors core's `NativeStyleDescriptor`
/// on the JavaScript side and `ReactNativeVectorStyle` on Android.
public struct MCVectorStyleDescriptor: Equatable, Sendable {
    public let documentJson: String?
    public let documentUrl: String?
    public let documentHeaders: [String: String]
    public let fromCurrentDesign: Bool
    public let rulesJson: String

    /// Reads the dictionary React Native hands over, or nil when it is not
    /// one — a prop that cannot be read is reported, never guessed at.
    public init?(_ props: NSDictionary?) {
        guard let props, let rulesJson = props["rulesJson"] as? String else { return nil }
        self.rulesJson = rulesJson
        documentJson = props["documentJson"] as? String
        documentUrl = props["documentUrl"] as? String
        documentHeaders = props["documentHeaders"] as? [String: String] ?? [:]
        fromCurrentDesign = props["fromCurrentDesign"] as? Bool ?? false
    }
}

/**
 Keeps the `vectorStyle` prop applied to one map.

 The prop and the map arrive in either order — React Native sets props
 before the view has a controller as often as not — so both are remembered
 and the work happens when both are in hand.
 */
@MainActor
final class MCVectorStyleBinding {
    private let onDiagnostics: ([String]) -> Void
    private var host: MapViewStyleHost?
    private var pending: MCVectorStyleDescriptor?
    private var reportedMissingModule = false

    init(onDiagnostics: @escaping ([String]) -> Void) {
        self.onDiagnostics = onDiagnostics
    }

    func set(_ props: NSDictionary?) {
        if props == nil {
            pending = nil
            host?.apply(nil)
            return
        }
        guard let descriptor = MCVectorStyleDescriptor(props) else {
            onDiagnostics(["the vectorStyle prop could not be read; it needs a `rulesJson`"])
            return
        }
        pending = descriptor
        apply()
    }

    func attach(to host: MapViewStyleHost) {
        self.host = host
        apply()
    }

    func dispose() {
        host?.dispose()
        host = nil
    }

    private func apply() {
        guard let host, let descriptor = pending else { return }
        guard let builder = MCReactNativeVectorStyle.builder else {
            reportMissingModule()
            return
        }
        guard let style = builder(descriptor) else {
            onDiagnostics(["the style could not be built from the vectorStyle prop"])
            return
        }
        host.apply(style, onDiagnostics: onDiagnostics)
    }

    private func reportMissingModule() {
        guard !reportedMissingModule else { return }
        reportedMissingModule = true
        onDiagnostics([
            "a style was given but \(MCReactNativeVectorStyle.moduleName) is not installed; "
                + "add `pod '\(MCReactNativeVectorStyle.moduleName)'` to the app's Podfile",
        ])
    }
}
