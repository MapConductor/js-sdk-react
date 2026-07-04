import React, { useEffect, useRef } from 'react';
import { useMapViewScope } from './MapViewScope';
import {
  createPolygonState,
  type PolygonState,
  type OnPolygonEventHandler,
  unionHolesInPlace,
  type GeoPoint,
  type GeoRectBounds,
  type Serializable,
  fromLatLng,
} from '@mapconductor/js-sdk-core';

interface PolygonStateProps {
    state: PolygonState;
}

/** Registers a single polygon. Mirrors `PolygonComponent.kt#Polygon(state)`. */
export function Polygon({ state }: PolygonStateProps): null {
    const { polygonCollector } = useMapViewScope();

    useEffect(() => {
        if (state.holes.length > 1) unionHolesInPlace(state);
        polygonCollector.add(state);
    }, [state, polygonCollector]);

    useEffect(() => {
        return () => { polygonCollector.remove(state.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.id, polygonCollector]);

    return null;
}

interface PolygonPropsExpanded {
    points: GeoPoint[];
    holes?: GeoPoint[][];
    id?: string | null;
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    geodesic?: boolean;
    zIndex?: number;
    extra?: Serializable | null;
    onClick?: OnPolygonEventHandler | null;
}

/**
 * Convenience overload: creates a PolygonState from props, then registers it.
 * Mirrors `PolygonComponent.kt#Polygon(points, ...)`.
 */
export function PolygonFromProps(props: PolygonPropsExpanded): React.ReactElement | null {
    const stateRef = useRef<PolygonState | null>(null);
    if (!stateRef.current) {
        stateRef.current = createPolygonState({
            points: props.points,
            holes: props.holes ?? [],
            id: props.id,
            strokeColor: props.strokeColor ?? '#000000',
            strokeWidth: props.strokeWidth ?? 1,
            fillColor: props.fillColor ?? 'transparent',
            geodesic: props.geodesic ?? false,
            zIndex: props.zIndex ?? 0,
            extra: props.extra ?? null,
            onClick: props.onClick ?? null,
        });
    }
    const state = stateRef.current;

    useEffect(() => { state.points = props.points; }, [state, props.points]);
    useEffect(() => { state.holes = props.holes ?? []; }, [state, props.holes]);
    useEffect(() => { state.strokeColor = props.strokeColor ?? '#000000'; }, [state, props.strokeColor]);
    useEffect(() => { state.strokeWidth = props.strokeWidth ?? 1; }, [state, props.strokeWidth]);
    useEffect(() => { state.fillColor = props.fillColor ?? 'transparent'; }, [state, props.fillColor]);
    useEffect(() => { state.geodesic = props.geodesic ?? false; }, [state, props.geodesic]);
    useEffect(() => { state.zIndex = props.zIndex ?? 0; }, [state, props.zIndex]);
    useEffect(() => { state.onClick = props.onClick ?? null; }, [state, props.onClick]);

    return <Polygon state={state} />;
}

interface PolygonBoundsProps {
    bounds: GeoRectBounds;
    id?: string | null;
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    geodesic?: boolean;
    zIndex?: number;
    extra?: Serializable | null;
    onClick?: OnPolygonEventHandler | null;
}

/**
 * Draws a polygon following the rectangle defined by `bounds`.
 * Mirrors `PolygonComponent.kt#Polygon(bounds, ...)`.
 */
export function PolygonFromBounds({ bounds, ...rest }: PolygonBoundsProps): React.ReactElement | null {
    const ne = bounds.northEast;
    const sw = bounds.southWest;
    if (!ne || !sw) return null;

    const points: GeoPoint[] = [
        ne,
        fromLatLng({ latitude: sw.latitude, longitude: ne.longitude }),
        sw,
        fromLatLng({ latitude: ne.latitude, longitude: sw.longitude }),
        ne,
    ];

    return <PolygonFromProps points={points} {...rest} />;
}
