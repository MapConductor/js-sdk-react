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

export interface PolygonStateProps {
    state: PolygonState;
    points?: never;
    bounds?: never;
}

/** Registers a single polygon. Mirrors `PolygonComponent.kt#Polygon(state)`. */
function PolygonWithState({ state }: PolygonStateProps): null {
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

interface PolygonCommonProps {
    id?: string | null;
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    geodesic?: boolean;
    zIndex?: number;
    extra?: Serializable | null;
    onClick?: OnPolygonEventHandler | null;
}

export interface PolygonPointsProps extends PolygonCommonProps {
    state?: never;
    points: GeoPoint[];
    holes?: GeoPoint[][];
    bounds?: never;
}

export interface PolygonBoundsProps extends PolygonCommonProps {
    state?: never;
    points?: never;
    holes?: never;
    bounds: GeoRectBounds;
}

export type PolygonProps = PolygonStateProps | PolygonPointsProps | PolygonBoundsProps;

/**
 * Registers a single polygon. Mirrors `PolygonComponent.kt#Polygon(state)`,
 * `PolygonComponent.kt#Polygon(points, ...)`, and
 * `PolygonComponent.kt#Polygon(bounds, ...)`.
 */
export function Polygon(props: PolygonStateProps): null;
export function Polygon(props: PolygonPointsProps): React.ReactElement | null;
export function Polygon(props: PolygonBoundsProps): React.ReactElement | null;
export function Polygon(props: PolygonProps): React.ReactElement | null {
    if (isPolygonPointsProps(props)) {
        return <PolygonFromPointsProps {...props} />;
    }
    if (isPolygonBoundsProps(props)) {
        return <PolygonFromBoundsProps {...props} />;
    }

    return <PolygonWithState state={props.state} />;
}

function isPolygonPointsProps(props: PolygonProps): props is PolygonPointsProps {
    return props.state === undefined && props.points !== undefined;
}

function isPolygonBoundsProps(props: PolygonProps): props is PolygonBoundsProps {
    return props.state === undefined && props.bounds !== undefined;
}

function PolygonFromPointsProps(props: PolygonPointsProps): React.ReactElement | null {
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
    useEffect(() => { state.extra = props.extra ?? null; }, [state, props.extra]);
    useEffect(() => { state.onClick = props.onClick ?? null; }, [state, props.onClick]);

    return <PolygonWithState state={state} />;
}

function PolygonFromBoundsProps({ bounds, ...rest }: PolygonBoundsProps): React.ReactElement | null {
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

    return <PolygonFromPointsProps points={points} {...rest} />;
}
