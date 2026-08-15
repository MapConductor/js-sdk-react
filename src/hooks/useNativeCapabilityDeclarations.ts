import { useEffect } from 'react';
import type {
  MapDesignTypeInterface,
  MapViewStateInterface,
} from '@mapconductor/js-sdk-core';

/**
 * React Native プロバイダに共通する capability の宣言。
 *
 * RN のホルダーは `toScreenOffset` / `fromScreenOffsetSync` が常に null を返す
 * （投影はすべてネイティブ側で行い、必要な画面座標はネイティブから
 * `onMarkerScreenPositions` / `onInfoBubbleScreenPositions` として届く）。
 * 宣言しておかないと、同期投影を要求する利用側は「まだ初期化中」と
 * 区別がつかず、無言で機能が落ちる。
 *
 * web 版に対応するフックは無い（web のホルダーは実際に同期投影できる）。
 */
export function useNativeCapabilityDeclarations(
  state: MapViewStateInterface<MapDesignTypeInterface<unknown>> | null | undefined,
): void {
  useEffect(() => {
    const registry = state?.serviceRegistry;
    if (!registry?.declareUnsupported) return;
    const registration = registry.declareUnsupported(
      'screenProjectionSync',
      'React Native では投影をネイティブ側で行うため、JS のホルダーは同期投影を持たない。',
    );
    return () => registration.dispose();
  }, [state]);
}
