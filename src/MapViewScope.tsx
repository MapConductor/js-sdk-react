import React, { createContext, useContext } from 'react';
import {
  OverlayCollector,
  type MarkerState,
  MarkerOverlay,
  type CircleState,
  CircleOverlay,
  type PolylineState,
  PolylineOverlay,
  type PolygonState,
  PolygonOverlay,
  type GroundImageState,
  GroundImageOverlay,
  type RasterLayerState,
  RasterLayerOverlay,
  type MapOverlayInterface,
  MapOverlayRegistry,
} from '@mapconductor/js-sdk-core';
import type { InfoBubbleEntry } from './info/InfoBubbleEntry';
import { MarkerAnimationStore } from './marker/MarkerAnimationStore';

export class MapViewScope {
    readonly markerCollector = new OverlayCollector<MarkerState>();
    readonly markerAnimationStore = new MarkerAnimationStore();
    readonly circleCollector = new OverlayCollector<CircleState>();
    readonly polylineCollector = new OverlayCollector<PolylineState>();
    readonly polygonCollector = new OverlayCollector<PolygonState>();
    readonly groundImageCollector = new OverlayCollector<GroundImageState>();
    readonly rasterLayerCollector = new OverlayCollector<RasterLayerState>();
    readonly bubbleCollector = new OverlayCollector<InfoBubbleEntry>();

    /**
     * Build a `MapOverlayRegistry` pre-populated with bridge overlays for all
     * overlay types managed by this scope.  Mirrors `MapViewScope.buildRegistry()`
     * in the Android SDK's `OverlayProvider.kt`.
     *
     * Pass the returned registry to `CollectAndRenderOverlays` (or an equivalent
     * React effect) so that state changes in each collector are forwarded to the
     * active map controller via the corresponding `*Capable` interface.
     */
    buildRegistry(): MapOverlayRegistry {
        const registry = new MapOverlayRegistry();
        registry.register(new MarkerOverlay(this.markerCollector) as MapOverlayInterface<unknown>);
        registry.register(new CircleOverlay(this.circleCollector) as MapOverlayInterface<unknown>);
        registry.register(new PolylineOverlay(this.polylineCollector) as MapOverlayInterface<unknown>);
        registry.register(new PolygonOverlay(this.polygonCollector) as MapOverlayInterface<unknown>);
        registry.register(new GroundImageOverlay(this.groundImageCollector) as MapOverlayInterface<unknown>);
        registry.register(new RasterLayerOverlay(this.rasterLayerCollector) as MapOverlayInterface<unknown>);
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
    return (
        <MapViewScopeContext.Provider value={scope}>
            {children}
        </MapViewScopeContext.Provider>
    );
}

export function useMapViewScope(): MapViewScope {
    const scope = useContext(MapViewScopeContext);
    if (!scope) throw new Error('useMapViewScope must be used within a MapViewScopeProvider');
    return scope;
}
