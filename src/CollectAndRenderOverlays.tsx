import { useEffect } from 'react';
import type { MapViewControllerInterface, MapOverlayRegistry } from '@mapconductor/core';

/**
 * React hook that subscribes every overlay registered in `registry` to the
 * given `controller`.  Whenever an overlay's collector emits a new state map,
 * the overlay's `render()` is called, which forwards the data to the controller
 * via the appropriate `*Capable` interface (e.g. `MarkerCapable`).
 *
 * Mirrors `CollectAndRenderOverlays()` in the Android SDK's `OverlayProvider.kt`.
 *
 * Usage:
 * ```tsx
 * const scope = useMemo(() => new MapViewScope(), []);
 * const registry = useMemo(() => scope.buildRegistry(), [scope]);
 *
 * useCollectAndRenderOverlays(registry, controller);
 * ```
 */
export function useCollectAndRenderOverlays(
    registry: MapOverlayRegistry,
    controller: MapViewControllerInterface | null,
): void {
    useEffect(() => {
        if (!controller) return;

        const overlays = registry.getAll();
        const unsubscribers = overlays.map((overlay) => {
            // Subscribe to state changes; re-render on each emission.
            return overlay.subscribe((data) => {
                overlay.render(data, controller).catch((err: unknown) => {
                    console.error('[MapConductor] overlay render error', err);
                });
            });
        });

        return () => {
            unsubscribers.forEach((unsub) => unsub());
        };
    }, [registry, controller]);
}
