package com.mapconductor.react.wrapper

import android.content.Context
import android.view.View
import androidx.compose.ui.geometry.Offset
import com.mapconductor.compose.MapViewScope
import com.mapconductor.core.controller.BaseMapViewController
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.features.GeoPointInterface
import com.mapconductor.core.map.MapCameraPosition
import com.mapconductor.core.map.MutableMapServiceRegistry
import com.mapconductor.core.marker.MarkerTilingOptions

/**
 * RN のラッパー基底（[MapConductorMapViewWrapperBase]）が、プロバイダ固有の地図一式を
 * 触るための唯一の窓口。
 *
 * 地図 SDK に依存しない仕事（コマンドの受け口、マーカーの取り込み、スクリーン座標の通知、
 * 拡張モジュールの Compose レイヤ）は全部基底が持つ。ここに残るのは
 * 「ネイティブの地図を作る」「デザイン ID を SDK のデザイン型へ訳す」「投影」「破棄」だけ。
 *
 * iOS の `MCReactNativeMapHost`（js-sdk-react/ios）と対になる。実装を 1 つ書き忘れると
 * コンパイルエラーになる（黙って無反応にならない）ことも同じ。
 */
interface MapConductorReactNativeHost {
    /** ログとマーカー取り込みスレッドの名前に使う。例: "MapLibre"。 */
    val providerName: String

    /**
     * 拡張モジュール（ヒートマップ / GeoJSON レイヤ等）が使う Compose のスコープ。
     * プロバイダごとの `XxxMapViewScope` を返す。
     */
    val extensionScope: MapViewScope

    /** 拡張モジュールが capability を引くレジストリ。 */
    val serviceRegistry: MutableMapServiceRegistry

    /**
     * true のプロバイダは、地図ビューが [MapConductorReactNativeHostDelegate] へ
     * カメライベントを直接返す。
     *
     * 通常はコントローラのリスナーから受け取る。Longdo のように Compose の地図ホストが
     * start / move / end を合成するプロバイダだけ true にし、同じ move をコントローラ経由でも
     * 配送して二重発火させない。
     */
    val deliversCameraEventsDirectly: Boolean
        get() = false

    /**
     * ネイティブの地図ビューを作って返す。基底が index 0 のサブビューとして載せる。
     *
     * 地図 SDK ごとに準備の段取りが違う（MapLibre は `getMapAsync` → `setStyle`、
     * HERE はコントローラ生成が同期で `loadScene` が後、ArcGIS は suspend）ので、
     * 完成の通知は [delegate] へのコールバックで行う。呼ぶ順序は
     * [MapConductorReactNativeHostDelegate.onControllerReady] →
     * [MapConductorReactNativeHostDelegate.onMapLoaded]。
     *
     * 非同期コールバックの先頭では必ず [MapConductorReactNativeHostDelegate.isAttached] を
     * 見ること。ビューが先に落ちていることがある。
     */
    fun createMapView(
        context: Context,
        initialCamera: MapCameraPosition,
        markerTiling: MarkerTilingOptions,
        delegate: MapConductorReactNativeHostDelegate,
    ): View

    /**
     * JS から来たデザイン ID を SDK のデザイン型へ訳して適用する。
     * コントローラがまだ無い段階でも呼ばれるので、その場合は保持して地図生成時に使う。
     */
    fun setMapDesign(id: String?)

    /**
     * 地理座標 → スクリーン座標（px）。JS 側の InfoBubble / マーカー追従に使う。
     * 同期投影を持たないプロバイダは null を返す。
     */
    fun toScreenOffset(position: GeoPointInterface): Offset?

    /** 地図とコントローラを破棄する。基底はこの後にコルーチンを畳む。 */
    fun destroy()
}

/**
 * 地図の準備状況をラッパー基底へ返す口。実装は [MapConductorMapViewWrapperBase]。
 *
 * iOS の `MCReactNativeMapHostDelegate` と対になる。
 */
interface MapConductorReactNativeHostDelegate {
    /**
     * ビューがまだ生きているか。`onDropViewInstance` の後は false。
     * 地図 SDK の非同期コールバックの先頭で見ること。
     */
    val isAttached: Boolean

    /**
     * コントローラができたら 1 回だけ呼ぶ。基底がここでカメラ／クリックのリスナーを張り、
     * 拡張の Compose レイヤを載せ、先に届いていた UI 設定とマーカーを流し込む。
     */
    fun onControllerReady(controller: BaseMapViewController)

    /**
     * 地図が描けるようになったら呼ぶ。何回呼んでも JS への `topMapLoaded` は 1 回だけ。
     * （SDK によっては初期化リスナーと状態フラグの両方から来る）
     */
    fun onMapLoaded()

    /** 地図ホスト自身がイベントを組み立てるプロバイダ用。iOS の同名 delegate と対になる。 */
    fun onMapClick(point: GeoPoint)

    fun onMapLongClick(point: GeoPoint)

    fun onCameraMoveStart(camera: MapCameraPosition)

    fun onCameraMove(camera: MapCameraPosition)

    fun onCameraMoveEnd(camera: MapCameraPosition)
}
