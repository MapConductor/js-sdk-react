import { useEffect } from 'react';
import type { CircleTilingOptions, MapViewControllerInterface } from '@mapconductor/js-sdk-core';

/**
 * Keeps a provider's circle tiling in step with its `circleTilingOptions`
 * prop. The map reads the prop when it is created; a later value is handed to
 * the controller and applies from the next time the circles are handed to the
 * map. Leaving the prop out keeps whatever the map was created with.
 */
export function useCircleTilingOptions(
  controller: MapViewControllerInterface | null,
  options: CircleTilingOptions | undefined,
): void {
  useEffect(() => {
    if (!controller || !options) return;
    controller.setCircleTilingOptions?.(options);
  }, [controller, options]);
}
