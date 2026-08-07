import { createContext, useContext } from 'react';
import type {
  MapDesignTypeInterface,
  MapViewControllerInterface,
  MapViewStateInterface,
} from '@mapconductor/js-sdk-core';

/**
 * Context wiring between a provider view (MapLibreView, GoogleMapsView, ...)
 * and the SDK's internal React components.
 *
 * コントローラは公開しない（{@link MapContextInternal} 側に置く）。アプリケーション
 * コードは state オブジェクトを使うこと — mapViewState.moveCameraTo(),
 * markerState.setPosition(), ... — ネイティブへ触るなら getMapViewHolder()。
 */
export interface MapContextValue {
  isReady: boolean;

  /**
   * このマップの状態オブジェクト。
   *
   * カメラを読む正規の経路は `state.cameraPosition` で、表示範囲はそこに載っている
   * `cameraPosition.visibleRegion.bounds` から取る。変化を追いたい場合は
   * `onCameraMove` / `onCameraMoveEnd`、あるいはオーバーレイコントローラとして
   * 登録して `onCameraChanged` を受ける。
   *
   * 拡張モジュールがコントローラの `getCameraPosition()` を直接叩かずに済むように
   * ここへ載せている（`getCameraPosition()` はプロバイダが自分の状態を組み立てる
   * ための内部経路）。
   */
  state: MapViewStateInterface<MapDesignTypeInterface<unknown>> | null;

  /**
   * 地図エンジンの初期化が完了したか。`onMapLoaded` が呼ばれる瞬間と同じ。
   *
   * [isReady] とは別物で、あちらは「コントローラの配線が終わった」こと。
   * @internal 読むときは [useMapLoaded] を使う。
   */
  isLoaded: boolean;
}

/**
 * プロバイダのビューと SDK 内部のコンポーネントだけが使う配線。**公開 API ではない。**
 *
 * `controller` は React ブリッジと地図プロバイダの間の内部プロトコルで、アプリから
 * 直に叩くと props（`onCameraMove` など）で張ったリスナーを上書きしてしまう。
 * 公開型 {@link MapContextValue} には出さず、SDK 内部からは
 * {@link mapContextInternal} で取り出す。
 */
export interface MapContextInternal {
  controller: MapViewControllerInterface | null;
}

/** @internal */
export const MapContext = createContext<MapContextValue | null>(null);

/**
 * プロバイダのビューが `MapContext.Provider` に渡す値を組み立てる。
 *
 * 戻り値は公開型なので、コントローラは型の上では外から見えない。
 * **プロバイダのビュー専用。**
 */
export function createMapContextValue(
  value: MapContextValue & MapContextInternal,
): MapContextValue {
  return value;
}

/**
 * コンテキストから内部配線（{@link MapContextInternal}）を取り出す。
 *
 * **SDK 内部専用。** 値は必ず {@link createMapContextValue} で作られているので、
 * 実行時は常に成立する。
 */
export function mapContextInternal(value: MapContextValue): MapContextInternal {
  return value as unknown as MapContextInternal;
}

/**
 * 地図エンジンの初期化が完了したかを返す。3 者共通のコールバック `onMapLoaded` が
 * 呼ばれる瞬間と同じで、**そのイベントを「値」として読む**もの。
 *
 * `onMapLoaded` は一度きりなので、マップインスタンスを画面間で使い回す構成では
 * 後からマウントした子が発火を取り逃す。そういう子はこのフックで現在値を読む。
 */
export function useMapLoaded(): boolean {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapLoaded must be used within a map view');
  }
  return context.isLoaded;
}

