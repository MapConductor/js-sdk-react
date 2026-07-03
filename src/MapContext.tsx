import { createContext, useContext } from 'react';
import type { MapViewControllerInterface } from '@mapconductor/core';

/**
 * Context for sharing map controller across components
 */
export interface MapContextValue {
  controller: MapViewControllerInterface | null;
  isReady: boolean;
}

export const MapContext = createContext<MapContextValue | null>(null);

/**
 * Hook to access the map controller
 */
export function useMapViewController(): MapViewControllerInterface | null {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapViewController must be used within a MapProvider');
  }
  return context.controller;
}

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
