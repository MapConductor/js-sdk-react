import { useEffect } from 'react';
import {
    createCollectorMarkerRenderingSupport,
    MarkerRenderingSupportKey,
    type MapDesignTypeInterface,
    type MapViewControllerInterface,
    type MapViewStateInterface,
} from '@mapconductor/js-sdk-core';
import type { MapViewScope } from '../MapViewScope';

/**
 * このマップの `MarkerRenderingSupport` をサービスレジストリへ登録する。
 *
 * marker-clustering のような拡張はマーカーレンダラを自前で組み立てず、
 * `useMapServiceRegistry().get(MarkerRenderingSupportKey)` で**プロバイダから受け取る**。
 * android-sdk の各 `*MapView.kt` / `*MapViewController.kt` が
 * `serviceRegistry.put(MarkerRenderingSupportKey, ...)` するのと、
 * ios-sdk の各 `*MapView.swift` が
 * `state.serviceRegistry.put(MarkerRenderingSupportKey.self, ...)` するのと同じ位置づけ。
 *
 * web では全プロバイダで実装が同じ（クラスタ結果は `MarkerState` のままマーカーコレクタへ入り、
 * そこから先はプロバイダ通常のマーカー経路が処理する）ため、
 * 既定実装を `createCollectorMarkerRenderingSupport` に 1 つだけ置き、
 * 各プロバイダはこのフックを呼ぶだけでよい。別の描画経路が要るプロバイダは、
 * このフックを使わず自前の `MarkerRenderingSupport` を `state.serviceRegistry` へ
 * 登録すればよい。
 *
 * コントローラが差し替わる（プロバイダ切り替え・再マウント）と登録し直し、
 * アンマウント時は取り下げる。`clear()` ではなく `remove()` を使うのは、
 * 同じレジストリに載る他の capability を巻き添えにしないため。
 */
export function useMarkerRenderingSupport(
    // state が null を取りうるのは React Native 側のビューが optional に受けているため。
    state: MapViewStateInterface<MapDesignTypeInterface<unknown>> | null | undefined,
    scope: MapViewScope,
    controller: MapViewControllerInterface | null,
): void {
    useEffect(() => {
        if (!controller || !state) return;

        const registry = state.serviceRegistry;
        registry.put(
            MarkerRenderingSupportKey,
            createCollectorMarkerRenderingSupport({
                collector: scope.markerCollector,
                holder: controller.holder,
            }),
        );

        return () => {
            registry.remove(MarkerRenderingSupportKey);
        };
    }, [state, scope, controller]);
}
