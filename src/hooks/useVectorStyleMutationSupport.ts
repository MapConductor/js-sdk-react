import { useEffect } from 'react';
import {
    applyStyleMutations,
    StyleMutationStore,
    VectorStyleMutationSupportKey,
    type MapDesignTypeInterface,
    type MapViewStateInterface,
    type StylePatchableMap,
} from '@mapconductor/js-sdk-core';

/**
 * A map whose style can be patched, and which says when it has loaded one.
 *
 * Structural: MapLibre GL JS, Mapbox GL JS and the MapTiler SDK all satisfy
 * it, and this package depends on none of them.
 */
export interface StylePatchableGlMap extends StylePatchableMap {
    on(event: 'styledata', handler: () => void): void;
    off(event: 'styledata', handler: () => void): void;
    /**
     * MapLibre types this `boolean | void` -- it answers nothing at all
     * before the style object exists -- so the result is read as truthy
     * rather than compared to `true`.
     */
    isStyleLoaded(): boolean | void;
}

/**
 * Declares that this map can be told to change a loaded style in place.
 *
 * Without it, adjusting a style means handing the map a new document: the
 * renderer drops its tiles, re-reads it, and the app's overlays are rebuilt.
 * With it, moving a colour slider sets a handful of paint properties and
 * the map never reloads anything. `VectorStyle` looks this capability up
 * and takes the cheap road when it is there.
 *
 * Two things this does that a provider would otherwise have to remember:
 *
 * - **The whole set goes back on after a style load.** A design change, a
 *   provider rebuilding -- the renderer comes back with the document's own
 *   values and nothing that was applied over them. `styledata` is where
 *   that is noticed.
 * - **Dropping a rule puts its property back.** Handled inside
 *   `StyleMutationStore`, which is shared with Android and iOS.
 *
 * android-sdk の各プロバイダが `VectorStyleMutationSupportKey` を put するのと、
 * ios-sdk の各 `*MapHost.swift` が同じことをするのと同じ位置づけ。
 */
export function useVectorStyleMutationSupport(
    state: MapViewStateInterface<MapDesignTypeInterface<unknown>> | null | undefined,
    map: StylePatchableGlMap | null | undefined,
    /**
     * The controller, so a finished style load reaches everything that
     * cares rather than only the mutation store.
     *
     * The installed `MapViewStyle` listens for the same moment — it may
     * have to serve its document again — and on android/iOS the provider's
     * controller is what announces it. Here the `styledata` subscription
     * lives in this hook, so the announcement is made from here.
     */
    controller?: Partial<{ notifyStyleLoaded(): void }> | null,
): void {
    useEffect(() => {
        if (!state || !map) return;

        const store = new StyleMutationStore((mutations) => applyStyleMutations(map, mutations));
        state.serviceRegistry.put(VectorStyleMutationSupportKey, store);

        // `styledata` fires for more than a finished load -- a source
        // arriving, a sprite landing -- so the applied set would otherwise
        // be re-sent dozens of times per style. Re-sending is harmless but
        // not free, and `isStyleLoaded` is the only signal GL-JS gives that
        // the layers are actually there to be patched.
        let loaded = Boolean(map.isStyleLoaded());
        const onStyleData = () => {
            const now = Boolean(map.isStyleLoaded());
            if (now && !loaded) {
                store.onStyleLoaded();
                controller?.notifyStyleLoaded?.();
            }
            loaded = now;
        };
        map.on('styledata', onStyleData);

        return () => {
            map.off('styledata', onStyleData);
            // `remove`, not `clear`: the registry carries other capabilities
            // and this one is only taking its own back.
            state.serviceRegistry.remove(VectorStyleMutationSupportKey);
        };
    }, [state, map, controller]);
}
