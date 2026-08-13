/**
 * React Native 版の内部配線。web 版は `internal.ts`。
 * **アプリケーションから import しないこと。** 予告なく変わる。
 */
export { useMapViewScope } from './MapViewScope.native';
export { useCollectAndRenderOverlays } from './CollectAndRenderOverlays';
export { useCameraRestriction } from './hooks/useCameraRestriction';
export { useMapUISettings } from './hooks/useMapUISettings';
export { useMarkerRenderingSupport } from './hooks/useMarkerRenderingSupport';
