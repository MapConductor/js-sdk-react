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
} from '@mapconductor/js-sdk-core';

export interface PolylineStateProps {
    state: PolylineState;
    points?: never;
    bounds?: never;
}

/** Registers a single polyline. Mirrors `PolylineComponent.kt#Polyline(state)`. */
function PolylineWithState({ state }: PolylineStateProps): null {
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

interface PolylineCommonProps {
    id?: string | null;
    strokeColor?: string;
    strokeWidth?: number;
    geodesic?: boolean;
    zIndex?: number;
    extra?: Serializable | null;
    onClick?: OnPolylineEventHandler | null;
}

export interface PolylinePointsProps extends PolylineCommonProps {
    state?: never;
    points: GeoPoint[];
    bounds?: never;
}

export interface PolylineBoundsProps extends PolylineCommonProps {
    state?: never;
    points?: never;
    bounds: GeoRectBounds;
}

export type PolylineProps = PolylineStateProps | PolylinePointsProps | PolylineBoundsProps;

/**
 * Registers a single polyline. Mirrors `PolylineComponent.kt#Polyline(state)`,
 * `PolylineComponent.kt#Polyline(points, ...)`, and
 * `PolylineComponent.kt#Polyline(bounds, ...)`.
 */
export function Polyline(props: PolylineStateProps): null;
export function Polyline(props: PolylinePointsProps): React.ReactElement | null;
export function Polyline(props: PolylineBoundsProps): React.ReactElement | null;
export function Polyline(props: PolylineProps): React.ReactElement | null {
    if (isPolylinePointsProps(props)) {
        return <PolylineFromPointsProps {...props} />;
    }
    if (isPolylineBoundsProps(props)) {
        return <PolylineFromBoundsProps {...props} />;
    }

    return <PolylineWithState state={props.state} />;
}

function isPolylinePointsProps(props: PolylineProps): props is PolylinePointsProps {
    return props.state === undefined && props.points !== undefined;
}

function isPolylineBoundsProps(props: PolylineProps): props is PolylineBoundsProps {
    return props.state === undefined && props.bounds !== undefined;
}

function PolylineFromPointsProps(props: PolylinePointsProps): React.ReactElement | null {
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
    useEffect(() => { state.extra = props.extra ?? null; }, [state, props.extra]);
    useEffect(() => { state.onClick = props.onClick ?? null; }, [state, props.onClick]);

    return <PolylineWithState state={state} />;
}

function PolylineFromBoundsProps({ bounds, ...rest }: PolylineBoundsProps): React.ReactElement | null {
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

    return <PolylineFromPointsProps points={points} {...rest} />;
}
