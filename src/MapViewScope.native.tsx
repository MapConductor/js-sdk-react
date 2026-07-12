import React, { createContext, useContext } from 'react';
import {
  MapOverlayRegistry,
  MarkerOverlay,
  OverlayCollector,
  type MapOverlayInterface,
  type MarkerState,
} from '@mapconductor/js-sdk-core';
import type { InfoBubbleEntry } from './info/InfoBubbleEntry';
import { MarkerAnimationStore } from './marker/MarkerAnimationStore';

export class MapViewScope {
  readonly markerCollector = new OverlayCollector<MarkerState>();
  readonly markerAnimationStore = new MarkerAnimationStore();
  readonly bubbleCollector = new OverlayCollector<InfoBubbleEntry>();

  buildRegistry(): MapOverlayRegistry {
    const registry = new MapOverlayRegistry();
    registry.register(new MarkerOverlay(this.markerCollector) as MapOverlayInterface<unknown>);
    return registry;
  }
}

const MapViewScopeContext = createContext<MapViewScope | null>(null);

export function MapViewScopeProvider({
  scope,
  children,
}: {
  scope: MapViewScope;
  children: React.ReactNode;
}) {
  return <MapViewScopeContext.Provider value={scope}>{children}</MapViewScopeContext.Provider>;
}

export function useMapViewScope(): MapViewScope {
  const scope = useContext(MapViewScopeContext);
  if (!scope) throw new Error('useMapViewScope must be used within a MapViewScopeProvider');
  return scope;
}
