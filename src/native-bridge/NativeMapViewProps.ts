import type { ViewProps } from 'react-native';
import type { GeoPoint, MapCameraPosition } from '@mapconductor/js-sdk-core';
import type { NativeMapExtensionEvent } from '../native-extension/NativeMapExtension';
import type { NativeMarkerTilingOptions } from './nativePayloads';

/** ネイティブビューが送ってくるイベントの外側の形。 */
export interface NativeMapViewEvent<T> {
  nativeEvent: T;
}

/**
 * RN のネイティブ地図ビューが受け取る props のうち、全プロバイダで共通のもの。
 *
 * ブリッジのコマンド/イベントはプロバイダに依らず同じ集合なので、以前は
 * 各プロバイダが同じ 90 行の interface を写経していた。プロバイダ固有の
 * props（apiKey など）は交差型で足す:
 *
 * ```ts
 * export interface NativeFooViewProps extends NativeMapViewProps {
 *   apiKey?: string;
 * }
 * ```
 */
/** {@link NativeMapViewProps.vectorStyle} の中身。core の `NativeStyleDescriptor` と同形。 */
export interface NativeVectorStyleProps {
  documentJson?: string;
  documentUrl?: string;
  documentHeaders?: Record<string, string>;
  fromCurrentDesign?: boolean;
  rulesJson: string;
}

export interface NativeMapViewProps extends ViewProps {
  cameraPosition?: {
    position: { latitude: number; longitude: number; altitude?: number | null };
    zoom: number;
    bearing: number;
    tilt: number;
  };
  mapDesignType?: string;
  /**
   * 地図の見た目。ネイティブ側の `VectorStyle` がこれを読んで組み立てる。
   *
   * JS で組み立てないのは、コンパイラが wasm で Hermes に wasm が無いため、
   * そして地図が JS オブジェクトではなく Android / iOS の SDK そのものだから。
   * 文字列 2 本だけ渡して、あとは各プラットフォームのベクタースタイル
   * モジュールに任せる——ユーザーが見る地図は、ネイティブアプリが動かすのと
   * まったく同じコードが描いたものになる。
   */
  vectorStyle?: NativeVectorStyleProps;
  markerTilingOptions?: NativeMarkerTilingOptions;
  infoBubblePositions?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    altitude?: number | null;
  }>;
  onMapLoaded?: () => void;
  onMarkerCompositionBatchProcessed?: (
    event: NativeMapViewEvent<{ generation: number; sequence: number }>
  ) => void;
  onMapClick?: (event: NativeMapViewEvent<{ point: GeoPoint }>) => void;
  onMapLongClick?: (event: NativeMapViewEvent<{ point: GeoPoint }>) => void;
  onCameraMoveStart?: (event: NativeMapViewEvent<{ cameraPosition: MapCameraPosition }>) => void;
  onCameraMove?: (event: NativeMapViewEvent<{ cameraPosition: MapCameraPosition }>) => void;
  onCameraMoveEnd?: (event: NativeMapViewEvent<{ cameraPosition: MapCameraPosition }>) => void;
  onMarkerClick?: (event: NativeMapViewEvent<{ markerId: string }>) => void;
  onCircleClick?: (event: NativeMapViewEvent<{ circleId: string; point: GeoPoint }>) => void;
  onGroundImageClick?: (
    event: NativeMapViewEvent<{ groundImageId: string; point: GeoPoint }>
  ) => void;
  onPolylineClick?: (event: NativeMapViewEvent<{ polylineId: string; point: GeoPoint }>) => void;
  onPolygonClick?: (event: NativeMapViewEvent<{ polygonId: string; point: GeoPoint }>) => void;
  onMarkerDragStart?: (event: NativeMapViewEvent<{ markerId: string; point: GeoPoint }>) => void;
  onMarkerDrag?: (event: NativeMapViewEvent<{ markerId: string; point: GeoPoint }>) => void;
  onMarkerDragEnd?: (event: NativeMapViewEvent<{ markerId: string; point: GeoPoint }>) => void;
  onMarkerAnimateStart?: (event: NativeMapViewEvent<{ markerId: string }>) => void;
  onMarkerAnimateEnd?: (event: NativeMapViewEvent<{ markerId: string }>) => void;
  onMarkerScreenPositions?: (
    event: NativeMapViewEvent<{ positions: Array<{ markerId: string; x: number; y: number }> }>
  ) => void;
  onInfoBubbleScreenPositions?: (
    event: NativeMapViewEvent<{ positions: Array<{ id: string; x: number; y: number }> }>
  ) => void;
  onNativeMapExtensionEvent?: (event: NativeMapViewEvent<NativeMapExtensionEvent>) => void;
}
