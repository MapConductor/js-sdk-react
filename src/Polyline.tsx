import React, { useEffect, useRef } from 'react';
import { useMapViewScope } from './MapViewScope';
import {
  createPolylineState,
  type PolylineState,
  type OnPolylineEventHandler,
  type GeoPoint,
  type GeoRectBounds,
  type Serializable,
  fromLatLng,
} from '@mapconductor/core';

interface PolylineStateProps {
    state: PolylineState;
}

/** Registers a single polyline. Mirrors `PolylineComponent.kt#Polyline(state)`. */
export function Polyline({ state }: PolylineStateProps): null {
    const { polylineCollector } = useMapViewScope();

    useEffect(() => {
        polylineCollector.add(state);
    }, [state, polylineCollector]);

    useEffect(() => {
        return () => { polylineCollector.remove(state.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.id, polylineCollector]);

    return null;
}

interface PolylinePropsExpanded {
    points: GeoPoint[];
    id?: string | null;
    strokeColor?: string;
    strokeWidth?: number;
    geodesic?: boolean;
    zIndex?: number;
    extra?: Serializable | null;
    onClick?: OnPolylineEventHandler | null;
}

/**
 * Convenience overload: creates a PolylineState from props, then registers it.
 * Mirrors `PolylineComponent.kt#Polyline(points, ...)`.
 */
export function PolylineFromProps(props: PolylinePropsExpanded): React.ReactElement | null {
    const stateRef = useRef<PolylineState | null>(null);
    if (!stateRef.current) {
        stateRef.current = createPolylineState({
            points: props.points,
            id: props.id,
            strokeColor: props.strokeColor ?? '#000000',
            strokeWidth: props.strokeWidth ?? 1,
            geodesic: props.geodesic ?? false,
            zIndex: props.zIndex ?? 0,
            extra: props.extra ?? null,
            onClick: props.onClick ?? null,
        });
    }
    const state = stateRef.current;

    useEffect(() => { state.points = props.points; }, [state, props.points]);
    useEffect(() => { state.strokeColor = props.strokeColor ?? '#000000'; }, [state, props.strokeColor]);
    useEffect(() => { state.strokeWidth = props.strokeWidth ?? 1; }, [state, props.strokeWidth]);
    useEffect(() => { state.geodesic = props.geodesic ?? false; }, [state, props.geodesic]);
    useEffect(() => { state.zIndex = props.zIndex ?? 0; }, [state, props.zIndex]);
    useEffect(() => { state.onClick = props.onClick ?? null; }, [state, props.onClick]);

    return <Polyline state={state} />;
}

interface PolylineBoundsProps {
    bounds: GeoRectBounds;
    id?: string | null;
    strokeColor?: string;
    strokeWidth?: number;
    geodesic?: boolean;
    zIndex?: number;
    extra?: Serializable | null;
    onClick?: OnPolylineEventHandler | null;
}

/**
 * Draws a polyline forming the rectangle defined by `bounds`.
 * Mirrors `PolylineComponent.kt#Polyline(bounds, ...)`.
 */
export function PolylineFromBounds({ bounds, ...rest }: PolylineBoundsProps): React.ReactElement | null {
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

    return <PolylineFromProps points={points} {...rest} />;
}
