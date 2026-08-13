import { useEffect } from 'react';
import { mapViewStateInternal } from '@mapconductor/js-sdk-core';
import type {
  MapUISettings,
  MapViewControllerInterface,
  MapViewStateInterface,
  MapDesignTypeInterface,
} from '@mapconductor/js-sdk-core';

/**
 * Keeps a provider's map engine in sync with `state.uiSettings`.
 *
 * The gesture flags live on the view state, but the state is a plain object the
 * app mutates — assigning to it cannot re-render a map view it does not own. So
 * the view subscribes here instead: the flags are applied once the controller is
 * ready, and again on every later assignment.
 *
 * This is the React counterpart of the `LaunchedEffect(state.uiSettings)` block
 * in Android's `MapViewBase` and of `.onChange(of: uiSettings)` on iOS.
 */
export function useMapUISettings(
  // React Native 版のビューは `state` を省略できる（プロバイダ側が既定の state を
  // 内部で作る）ので、controller と同じく null/undefined を受け付ける。
  state: MapViewStateInterface<MapDesignTypeInterface<unknown>> | null | undefined,
  controller: MapViewControllerInterface | null,
): void {
  useEffect(() => {
    if (!state || !controller?.applyUISettings) return;

    const apply = (settings: MapUISettings) => controller.applyUISettings?.(settings);
    apply(state.uiSettings);
    mapViewStateInternal(state).setUISettingsChangeListener(apply);
    return () => mapViewStateInternal(state).setUISettingsChangeListener(null);
  }, [state, controller]);
}
