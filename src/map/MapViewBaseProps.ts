import type { StyleProp, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import type {
  CameraRestriction,
  GeoPoint,
  MapCameraPosition,
  MapDesignTypeInterface,
  MapViewStateInterface,
  MapViewStyle,
} from '@mapconductor/js-sdk-core';

export type OnMapLoadedHandler<TState> = (state: TState) => void;
export type OnMapEventHandler = (point: GeoPoint) => void;
export type OnCameraMoveHandler = (camera: MapCameraPosition) => void;

export interface MapViewBaseProps<
  TState extends MapViewStateInterface<MapDesignTypeInterface<unknown>>,
> {
  state: TState;
  /** この要素自身の見た目。React/RN の `style` そのもので、地図の見た目ではない。 */
  style?: StyleProp<ViewStyle>;
  /**
   * 地図の見た目。デザイン名を選ぶ代わりにアプリが直接述べるときに渡す。
   *
   * ベクタースタイルは**ベースマップそのもの**なので、重ねるのではなく
   * 「これが地図だ」と言う。`@mapconductor/vectorstyle` が作る。下で何が
   * 起きるかはバックエンド次第で、アプリは知らなくてよい。
   *
   * **android-sdk と ios-sdk ではこの引数の名前は `style`。** JS だけ違うのは
   * `style` が React の予約語に等しいため——要素自身の CSS を指す名前を地図の
   * 見た目に使うと、React を書く人全員が踏む。ここは言語の慣習が勝つ——
   * 内部 API の印が 3 プラットフォームで別の綴りなのと同じ扱い。
   */
  mapStyle?: MapViewStyle | null;
  /** スタイルが言ってきたこと。渡さなければ console に出る。 */
  onStyleDiagnostics?: (diagnostics: readonly string[]) => void;
  children?: ReactNode;
  onMapLoaded?: OnMapLoadedHandler<TState>;
  onMapClick?: OnMapEventHandler;
  onMapLongClick?: OnMapEventHandler;
  onCameraMoveStart?: OnCameraMoveHandler;
  onCameraMove?: OnCameraMoveHandler;
  onCameraMoveEnd?: OnCameraMoveHandler;
  /** カメラの可動範囲を制限する。core の MapViewBaseProps と同じ意味。 */
  cameraRestriction?: CameraRestriction | null;
}
