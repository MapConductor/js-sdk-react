import { useEffect, useMemo } from 'react';
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
 * アンマウント時は取り下げる。`clear()` ではなく自分の登録だけを外すのは、
 * 同じレジストリに載る他の capability や、後から入った別の実装を巻き添えにしないため。
 *
 * 登録は**描画中**に行う。拡張は描画中に `get()` するので、エフェクトで登録すると
 * コントローラが届いたその描画では子がまだ null を読む。エフェクトは子から先に走るため、
 * その後にマップ側の再描画が無ければ（カメラを動かすまで）拡張は空のままになる。
 * MapLibre のように controller・isReady・isLoaded が 1 回の描画にまとまるプロバイダで
 * marker-clustering が何も描かなかったのはこれ。親は子より先に描画されるので、
 * ここで入れておけば同じ描画のうちに子から見える。android-sdk / ios-sdk でも
 * put はコンポジション（ビュー構築）中に行われ、子の `get()` より先に済んでいる。
 */
export function useMarkerRenderingSupport(
    // state が null を取りうるのは React Native 側のビューが optional に受けているため。
    state: MapViewStateInterface<MapDesignTypeInterface<unknown>> | null | undefined,
    scope: MapViewScope,
    controller: MapViewControllerInterface | null,
): void {
    const registry = state?.serviceRegistry ?? null;
    const support = useMemo(
        () => (controller
            ? createCollectorMarkerRenderingSupport({
                collector: scope.markerCollector,
                holder: controller.holder,
            })
            : null),
        [scope, controller],
    );

    // 同じ値を入れ直すだけなので、何度描画されても結果は変わらない。
    if (registry && support && registry.get(MarkerRenderingSupportKey) !== support) {
        registry.put(MarkerRenderingSupportKey, support);
    }

    useEffect(() => {
        if (!registry || !support) return;
        // StrictMode の擬似アンマウントで外された後もここで戻す。
        registry.put(MarkerRenderingSupportKey, support);
        return () => {
            // 次のコントローラの分が描画中にもう入っていれば、それは消さない。
            if (registry.get(MarkerRenderingSupportKey) === support) {
                registry.remove(MarkerRenderingSupportKey);
            }
        };
    }, [registry, support]);
}
