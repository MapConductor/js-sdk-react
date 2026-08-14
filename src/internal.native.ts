/**
 * React Native 版の内部配線。web 版は `internal.ts`。
 * **アプリケーションから import しないこと。** 予告なく変わる。
 */
export { useMapViewScope } from './MapViewScope.native';
export { useCollectAndRenderOverlays } from './CollectAndRenderOverlays';
export { useCameraRestriction } from './hooks/useCameraRestriction';
export { useMapUISettings } from './hooks/useMapUISettings';
export { useNativeCapabilityDeclarations } from './hooks/useNativeCapabilityDeclarations';
export { useMarkerRenderingSupport } from './hooks/useMarkerRenderingSupport';

// RN プロバイダ共通のブリッジ実装。プロバイダはこれを継承するだけでよい。
export { ReactNativeBridgeMapViewController, type NativeViewRef } from './native-bridge/ReactNativeBridgeMapViewController';
export { ReactNativeMapViewHolder } from './native-bridge/ReactNativeMapViewHolder';
export {
  createWebMercatorScreenProjection,
  type ScreenOffset,
  type ViewportSize,
} from './native-bridge/WebMercatorScreenProjection';
export {
  markerStateToNative,
  type NativeMarkerStatePayload,
} from './native-bridge/markerStateToNative';
export { NativeMapViewHost, type NativeMapViewHostProps } from './native-bridge/NativeMapViewHost';
export type { NativeMapViewProps, NativeMapViewEvent } from './native-bridge/NativeMapViewProps';
export {
  toNativeCameraPosition,
  toNativeMarkerTilingOptions,
  type NativeMarkerTilingOptions,
} from './native-bridge/nativePayloads';
