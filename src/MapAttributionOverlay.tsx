import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  resolveAttributionRules,
  resolveRasterAttributions,
  type AttributionRule,
  type MapCameraPosition,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import type { MapViewScope } from './MapViewScope';

export interface MapAttributionOverlayProps {
  scope: MapViewScope;
  camera: MapCameraPosition;
  designAttributionRules?: readonly AttributionRule[];
  style?: CSSProperties;
}

export function MapAttributionOverlay({
  scope,
  camera,
  designAttributionRules = [],
  style,
}: MapAttributionOverlayProps) {
  const [states, setStates] = useState<RasterLayerState[]>(() =>
    scope.rasterLayerCollector.values(),
  );

  useEffect(() => scope.rasterLayerCollector.subscribe(map => {
    setStates(Array.from(map.values()));
  }), [scope]);

  const attributions = useMemo(() => {
    const resolved = [
      ...resolveAttributionRules(designAttributionRules, camera),
      ...resolveRasterAttributions(
        states.filter(state => state.visible).map(state => state.source),
        camera,
      ),
    ];
    return Array.from(new Set(resolved));
  }, [camera, designAttributionRules, states]);

  if (attributions.length === 0) return null;

  return (
    <div
      className="mc-map-attribution"
      role="note"
      style={{
        position: 'absolute',
        right: 4,
        bottom: 24,
        zIndex: 1000,
        maxWidth: 'calc(100% - 8px)',
        padding: '2px 5px',
        background: 'rgba(255, 255, 255, 0.85)',
        color: '#222',
        font: '10px/1.35 sans-serif',
        textAlign: 'right',
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {attributions.map((attribution, index) => (
        <span key={attribution}>
          {index > 0 && ' | '}
          <span dangerouslySetInnerHTML={{ __html: attribution }} />
        </span>
      ))}
    </div>
  );
}
