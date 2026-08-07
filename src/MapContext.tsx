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
 * @internal The controller carried here is the SDK's internal wire protocol
 * between the React bridge and the map providers. Application code must use
 * the state objects instead — mapViewState.moveCameraTo(),
 * markerState.setPosition(), ... — or getMapViewHolder() for native access.
 */
export interface MapContextValue {
  controller: MapViewControllerInterface | null;
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

/** @internal */
export const MapContext = createContext<MapContextValue | null>(null);

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

