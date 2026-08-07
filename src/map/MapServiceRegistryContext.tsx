import React, { createContext, useContext } from 'react';
import { EmptyMapServiceRegistry, type MapServiceRegistry } from '@mapconductor/js-sdk-core';

/**
 * 現在スコープにあるサービスレジストリ。
 *
 * android-sdk の `LocalMapServiceRegistry`（CompositionLocal）、
 * ios-sdk の `MapServiceRegistryScope.current` に対応する。
 * React では CompositionLocal の役割をそのまま Context が担う。
 *
 * マーカーコレクタ等とは**別の Context** にしてあるのが要点で、
 * `MarkerClusterGroup` のように子のために自前の `MapViewScope` を作るコンポーネントの
 * 内側でも、レジストリはマップのものが見え続ける（android-sdk で
 * `LocalMarkerCollector` と `LocalMapServiceRegistry` が別々なのと同じ理由）。
 */
const MapServiceRegistryContext = createContext<MapServiceRegistry>(EmptyMapServiceRegistry);

/**
 * 各 `react-for-*` のマップビューが、自分の `state.serviceRegistry` を子へ供給する。
 * android-sdk の `MapViewBase` が
 * `CompositionLocalProvider(LocalMapServiceRegistry provides serviceRegistry)` で
 * 行っているのと同じ位置づけ。
 */
export function MapServiceRegistryProvider({
    registry,
    children,
}: {
    /**
     * null / undefined を許すのは、React Native 側のビューが `state` を optional に
     * 取っているため（state 未指定のうちは解決できるサービスが無い＝Empty と同じ）。
     */
    registry: MapServiceRegistry | null | undefined;
    children: React.ReactNode;
}): React.ReactElement {
    return (
        <MapServiceRegistryContext.Provider value={registry ?? EmptyMapServiceRegistry}>
            {children}
        </MapServiceRegistryContext.Provider>
    );
}

/**
 * スコープ内のレジストリを取得する。マップの外で呼ばれた場合は
 * `EmptyMapServiceRegistry`（`get()` が常に null）を返す。
 */
export function useMapServiceRegistry(): MapServiceRegistry {
    return useContext(MapServiceRegistryContext);
}
