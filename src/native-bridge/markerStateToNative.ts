import type { MarkerAnimation, MarkerState } from '@mapconductor/js-sdk-core';
import { markerIconToNative, type NativeMarkerIconPayload } from '../marker/ReactNativeImageIcon';

/** ネイティブブリッジが受け取るマーカーの形。全プロバイダ共通。 */
export interface NativeMarkerStatePayload {
  id: string;
  position: MarkerState['position'];
  clickable: boolean;
  draggable: boolean;
  zIndex: number;
  icon: NativeMarkerIconPayload | null;
  animation: MarkerAnimation | null;
}

/**
 * `MarkerState` をネイティブブリッジが受け取る形へ変換する。
 *
 * プロバイダごとに写しを持っていたため `zIndex` の扱いに差が出ていた
 * （null をそのまま送る実装と 0 に倒す実装が混在していた）。ネイティブ側は
 * 数値必須なのでここで 0 に倒す。
 */
export function markerStateToNative(state: MarkerState): NativeMarkerStatePayload {
  return {
    id: state.id,
    position: state.position,
    clickable: state.clickable,
    draggable: state.draggable,
    zIndex: state.zIndex ?? 0,
    icon: markerIconToNative(state.icon),
    animation: state.animation,
  };
}
