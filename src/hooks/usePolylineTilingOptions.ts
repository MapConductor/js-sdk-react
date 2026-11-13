import { useEffect } from 'react';
import type { MapViewControllerInterface, PolylineTilingOptions } from '@mapconductor/js-sdk-core';

/**
 * Keeps a provider's polyline tiling in step with its `polylineTilingOptions`
 * prop. The map reads the prop when it is created; a later value is handed to
 * the controller and applies from the next time the polylines are handed to the
 * map. Leaving the prop out keeps whatever the map was created with.
 */
export function usePolylineTilingOptions(
  controller: MapViewControllerInterface | null,
  options: PolylineTilingOptions | undefined,
): void {
  useEffect(() => {
    if (!controller || !options) return;
    controller.setPolylineTilingOptions?.(options);
  }, [controller, options]);
}
