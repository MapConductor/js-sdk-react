import React, { createContext, useContext } from 'react';
import {
  CircleOverlay,
  MapOverlayRegistry,
  MarkerOverlay,
  OverlayCollector,
  PolygonOverlay,
  PolylineOverlay,
  RasterLayerOverlay,
  type MapOverlayInterface,
  type CircleState,
  type MarkerState,
  type PolygonState,
  type PolylineState,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import type { InfoBubbleEntry } from './info/InfoBubbleEntry';
import { MarkerAnimationStore } from './marker/MarkerAnimationStore';

export class MapViewScope {
  readonly circleCollector = new OverlayCollector<CircleState>();
  readonly markerCollector = new OverlayCollector<MarkerState>();
  readonly markerAnimationStore = new MarkerAnimationStore();
  readonly polygonCollector = new OverlayCollector<PolygonState>();
  readonly polylineCollector = new OverlayCollector<PolylineState>();
  readonly rasterLayerCollector = new OverlayCollector<RasterLayerState>();
  readonly bubbleCollector = new OverlayCollector<InfoBubbleEntry>();

  buildRegistry(): MapOverlayRegistry {
    const registry = new MapOverlayRegistry();
    registry.register(new CircleOverlay(this.circleCollector) as MapOverlayInterface<unknown>);
    registry.register(new MarkerOverlay(this.markerCollector) as MapOverlayInterface<unknown>);
    registry.register(
      new PolygonOverlay(this.polygonCollector) as MapOverlayInterface<unknown>
    );
    registry.register(
      new PolylineOverlay(this.polylineCollector) as MapOverlayInterface<unknown>
    );
    registry.register(
      new RasterLayerOverlay(this.rasterLayerCollector) as MapOverlayInterface<unknown>
    );
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
