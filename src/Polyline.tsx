import React, { useEffect, useMemo } from 'react';
import { useMapViewScope } from './MapViewScope';
import { OwnedOverlays } from './OwnedOverlays';
import { useAddProgress, type AddProgressCallbacks } from './AddProgress';
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

interface PolylinesProps extends AddProgressCallbacks {
    states: readonly PolylineState[];
}

/**
 * Efficiently registers many polylines without per-polyline effects.
 * Mirrors `PolylineComponent.kt#Polylines(states)` and `<Polygons>`.
 *
 * Only this instance's ids are added and removed, so several `<Polylines>` and
 * `<Polyline>` can share one map; unmounting removes this instance's polylines
 * and no others. A state whose id stays from one list to the next keeps its
 * first object, which takes the new values in place.
 */
export function Polylines({ states, onAddStart, onAddProgress, onAddEnd }: PolylinesProps): null {
    const { polylineCollector } = useMapViewScope();
    const owned = useMemo(() => new OwnedOverlays(polylineCollector, syncPolylineState), [polylineCollector]);

    const trackAdd = useAddProgress({ onAddStart, onAddProgress, onAddEnd });

    useEffect(() => {
        const { added, removedIds } = owned.set(states);
        trackAdd(added, removedIds);
    }, [states, owned, trackAdd]);

    useEffect(() => () => owned.clear(), [owned]);

    return null;
}

function syncPolylineState(target: PolylineState, source: PolylineState): void {
    if (target.points !== source.points) target.points = source.points;
    if (target.strokeColor !== source.strokeColor) target.strokeColor = source.strokeColor;
    if (target.strokeWidth !== source.strokeWidth) target.strokeWidth = source.strokeWidth;
    if (target.geodesic !== source.geodesic) target.geodesic = source.geodesic;
    if (target.clickable !== source.clickable) target.clickable = source.clickable;
    if (target.zIndex !== source.zIndex) target.zIndex = source.zIndex;
    if (target.extra !== source.extra) target.extra = source.extra;
    if (target.onClick !== source.onClick) target.onClick = source.onClick;
    if (target.onAdded !== source.onAdded) target.onAdded = source.onAdded;
}

interface PolylineCommonProps {
    id?: string | null;
    strokeColor?: string;
    strokeWidth?: number;
    geodesic?: boolean;
    clickable?: boolean;
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
    const state = useMemo(
        () =>
            createPolylineState({
                points: props.points,
                id: props.id,
                strokeColor: props.strokeColor ?? '#000000',
                strokeWidth: props.strokeWidth ?? 1,
                geodesic: props.geodesic ?? false,
                clickable: props.clickable ?? true,
                zIndex: props.zIndex ?? 0,
                extra: props.extra ?? null,
                onClick: props.onClick ?? null,
            }),
        [
            props.points,
            props.id,
            props.strokeColor,
            props.strokeWidth,
            props.geodesic,
            props.clickable,
            props.zIndex,
            props.extra,
            props.onClick,
        ],
    );

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
