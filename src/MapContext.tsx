import { createContext, useContext } from 'react';
import type { MapViewControllerInterface } from '@mapconductor/js-sdk-core';

/**
 * Context wiring between a provider view (MapLibreView, GoogleMapsView, ...)
 * and the SDK's internal React components.
 *
 * @internal The controller carried here is the SDK's internal wire protocol
 * between the React bridge and the map providers. Application code must use
 * the state objects instead — mapViewState.moveCameraTo(),
 * markerState.setPosition(), ... — or getMapViewHolder() for native access.
 */
export interface MapContextValue {
  controller: MapViewControllerInterface | null;
  isReady: boolean;
}

/** @internal */
export const MapContext = createContext<MapContextValue | null>(null);

/**
 * Hook to check if map is ready
 */
export function useMapReady(): boolean {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapReady must be used within a MapProvider');
  }
  return context.isReady;
}
