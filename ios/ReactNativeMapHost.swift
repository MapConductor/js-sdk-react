import Foundation
import MapConductorCore
import UIKit

/// RN のビュー基底（``MCReactNativeMapViewBase``）が、プロバイダ固有の地図一式を
/// 触るための唯一の窓口。
///
/// ios-sdk 側の `MapLibreMapHost` / `HereMapHost` … は state の型（`MapLibreViewState` 等）や
/// デザイン型でジェネリックなので、`@objc` を持つ基底クラスからは直接扱えない
/// （`@objc` メンバはジェネリッククラスに置けない）。そこで**関連型を持たない**
/// このプロトコルを噛ませ、プロバイダ側の薄いアダプタが型を閉じる。
///
/// android の `MapConductorMapViewWrapper` と同じ位置づけ。実装を1つ書き忘れると
/// コンパイルエラーになる（黙って無反応にならない）ことも同じ。
@MainActor
public protocol MCReactNativeMapHost: AnyObject {
    /// 地図から上がったイベントの返し先。基底クラスが自分を差し込む。
    var mcDelegate: MCReactNativeMapHostDelegate? { get set }

    /// 拡張モジュール（クラスタリング等）が capability を引くレジストリ。
    var mcServiceRegistry: MutableMapServiceRegistry { get }

    /// 現在のズーム。拡張へマップクリックを配るときに渡す。
    var mcCameraZoom: Double { get }

    /// 地図を作れる状態か。API キーの到着を待つプロバイダ（GoogleMaps）が false を返す。
    /// false の間、基底は地図を作らず ``mcNotReadyMessage`` を表示する。
    /// 準備できたらプロバイダ側が `setNeedsLayout()` を呼べば次のレイアウトで作られる。
    var mcIsReady: Bool { get }

    /// ``mcIsReady`` が false のときに画面へ出す説明。nil なら何も出さない。
    var mcNotReadyMessage: String? { get }

    /// ネイティブの地図ビューを作って返す。基底がサブビューとして載せる。
    func mcMakeMapView(content: MapViewContent) -> UIView

    /// 組み立て済みのコンテンツを地図へ流す。
    func mcUpdateContent(_ content: MapViewContent)

    /// state を書き換えたあとに、ネイティブビューへ直接書く分（スタイル URL・ジェスチャ）を反映する。
    /// SwiftUI の `updateUIView` が担っていた仕事。
    func mcSyncNativeViewSettings()

    /// 地図とコントローラを破棄する。
    func mcUnbind()

    func mcSetMapDesign(id: String?)
    func mcMoveCamera(_ camera: MapCameraPosition, durationMillis: Int64?)
    func mcFitBounds(_ bounds: GeoRectBounds, padding: Int)
    func mcApplyUISettings(_ settings: MapUISettings)

    /// 地理座標 → スクリーン座標。JS 側の InfoBubble / マーカー追従に使う。
    /// 同期投影を持たないプロバイダは nil を返す。
    func mcToScreenOffset(_ position: GeoPointProtocol) -> CGPoint?

    /// プロバイダ固有のネイティブマーカー型に紐づく拡張（marker-clustering）を作る。
    /// 該当しない type には nil を返す（共通レジストリ側で解決される）。
    func mcMakeLocalExtensionRenderer(
        type: String,
        extensionId: String,
        eventSink: @escaping NativeMapExtensionEventSink
    ) -> NativeMapExtensionRenderer?
}

public extension MCReactNativeMapHost {
    /// 大半のプロバイダは prop を待たずに地図を作れる。
    var mcIsReady: Bool { true }
    var mcNotReadyMessage: String? { nil }
}

/// 地図から上がってきたイベントを RN のビュー基底へ返す口。
///
/// プロバイダ側のアダプタが ios-sdk の `MapViewHandlers<State>`（state 型で
/// ジェネリック）をこの非ジェネリックな形へ翻訳する。
@MainActor
public protocol MCReactNativeMapHostDelegate: AnyObject {
    func mcMapLoaded()
    func mcMapClick(_ point: GeoPoint)
    func mcMapLongClick(_ point: GeoPoint)
    func mcCameraMoveStart(_ camera: MapCameraPosition)
    func mcCameraMove(_ camera: MapCameraPosition)
    func mcCameraMoveEnd(_ camera: MapCameraPosition)
}
