import type { MapCameraPosition, MarkerTilingOptions } from '@mapconductor/js-sdk-core';

/** ネイティブへ渡すマーカータイリング設定。全プロバイダ共通。 */
export interface NativeMarkerTilingOptions {
  enabled: boolean;
  debugTileOverlay: boolean;
  minMarkerCount: number;
  cacheSize: number;
  /**
   * JS の関数はブリッジを越えられないので、`iconScaleCallback` が設定されている
   * ことだけを伝える。実際の倍率はネイティブ側が MarkerScaleBridge (JSI) 経由で
   * JS へ問い合わせる。
   */
  hasIconScaleCallback: boolean;
}

export function toNativeMarkerTilingOptions(
  markerTilingOptions: MarkerTilingOptions | undefined
): NativeMarkerTilingOptions | undefined {
  if (!markerTilingOptions) return undefined;
  return {
    enabled: markerTilingOptions.enabled,
    debugTileOverlay: markerTilingOptions.debugTileOverlay,
    minMarkerCount: markerTilingOptions.minMarkerCount,
    cacheSize: markerTilingOptions.cacheSize,
    hasIconScaleCallback: markerTilingOptions.iconScaleCallback != null,
  };
}

export function toNativeCameraPosition(cameraPosition: MapCameraPosition | undefined) {
  if (!cameraPosition) return undefined;
  return {
    position: {
      latitude: cameraPosition.position.latitude,
      longitude: cameraPosition.position.longitude,
      altitude: cameraPosition.position.altitude ?? 0,
    },
    zoom: cameraPosition.zoom,
    bearing: cameraPosition.bearing,
    tilt: cameraPosition.tilt,
  };
}
