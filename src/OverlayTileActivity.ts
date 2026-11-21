import { useContext } from 'react';
import type { OverlayKind, TileActivity } from '@mapconductor/js-sdk-core';
import { MapContext, mapContextInternal } from './MapContext';

/**
 * Whether the map's tiler of `kind` is busy -- taking a list or drawing tiles --
 * for a collection's onAddStart / onAddEnd ({@link useAddProgress}). Null
 * outside a map, before its controller exists, or for a kind without tiles.
 *
 * @internal
 */
export function useOverlayTileActivity(kind: OverlayKind): TileActivity | null {
    const context = useContext(MapContext);
    const controller = context ? mapContextInternal(context).controller : null;
    return (controller as { overlayTileActivity?(kind: OverlayKind): TileActivity | null } | null)
        ?.overlayTileActivity?.(kind) ?? null;
}
