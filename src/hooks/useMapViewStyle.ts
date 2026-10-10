import { useEffect, useRef } from 'react';
import {
    MapViewStyleHost,
    type BaseMapViewController,
    type MapDesignTypeInterface,
    type MapViewControllerInterface,
    type MapViewStateInterface,
    type MapViewStyle,
} from '@mapconductor/js-sdk-core';

/**
 * A controller a style can be installed on.
 *
 * Every provider's controller extends `BaseMapViewController` and so has
 * these; the check is structural so the sixteen call sites can pass the
 * `MapViewControllerInterface` they already hold without a cast, and a
 * controller that somehow does not have them is skipped rather than
 * crashed into.
 */
function canHostStyle(
    controller: MapViewControllerInterface | BaseMapViewController | null | undefined,
): controller is BaseMapViewController {
    const candidate = controller as Partial<BaseMapViewController> | null | undefined;
    return (
        typeof candidate?.addStyleLoadedListener === 'function' &&
        typeof candidate?.mountRasterLayer === 'function'
    );
}

/**
 * Keeps the map's {@link MapViewStyle} installed, for every provider.
 *
 * Each `<XxxView>` takes a `style` and calls this once; nothing else about a
 * provider has to know what a vector style is. What a style then does to the
 * map depends on what that map declared it can do — draw a style document,
 * change a loaded one in place, or neither, in which case the style's own
 * rasteriser renders tiles and they go on as a raster layer.
 *
 * ## Why this is not just `useEffect(..., [style])`
 *
 * The three things that have to line up are in
 * {@link MapViewStyleHost.apply}; what this adds is *when* to ask:
 *
 * - **On every render, not only when `style` changes.** A style built inline
 *   in JSX is a new object each time, and the one that matters — the one
 *   whose rules just moved — is indistinguishable from the one that did not.
 *   Only the host can tell, by its key, so it is asked every time.
 * - **Not before the controller exists.** A style acts on a live map, and
 *   the provider builds its controller asynchronously.
 * - **Off when the view goes.** Disposing has to leave the map as it was
 *   found, or switching away from a style leaves its colours behind.
 *
 * android-sdk の `MapViewStyleEffect` と ios-sdk の `MapViewStyleHost` が
 * 同じ役目を持つ。
 */
export function useMapViewStyle(
    state: MapViewStateInterface<MapDesignTypeInterface<unknown>> | null | undefined,
    controller: MapViewControllerInterface | BaseMapViewController | null | undefined,
    style: MapViewStyle | null | undefined,
    onDiagnostics?: ((diagnostics: readonly string[]) => void) | null,
): void {
    const hostRef = useRef<MapViewStyleHost | null>(null);
    const ownerRef = useRef<BaseMapViewController | null>(null);
    const diagnosticsRef = useRef(onDiagnostics);
    diagnosticsRef.current = onDiagnostics;

    // A controller that was replaced takes its style with it: the host holds
    // the installation, and the old map is gone.
    if (canHostStyle(controller) && ownerRef.current !== controller) {
        hostRef.current?.dispose();
        hostRef.current = state ? new MapViewStyleHost(state.serviceRegistry, controller) : null;
        ownerRef.current = controller;
    }

    // Deliberately not keyed on `style`: see the comment above. An effect
    // with no dependency array runs after every render, which is what asking
    // every time means.
    useEffect(() => {
        hostRef.current?.apply(style, (diagnostics) => diagnosticsRef.current?.(diagnostics));
    });

    useEffect(
        () => () => {
            hostRef.current?.dispose();
            hostRef.current = null;
            ownerRef.current = null;
        },
        [],
    );
}
