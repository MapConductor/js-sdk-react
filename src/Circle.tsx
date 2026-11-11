import React, { useEffect, useMemo, useRef } from 'react';
import { useMapViewScope } from './MapViewScope';
import { OwnedOverlays } from './OwnedOverlays';
import {
  createCircleState,
  type CircleState,
  type OnCircleEventHandler,
  type GeoPoint,
  type Serializable,
} from '@mapconductor/js-sdk-core';

export interface CircleStateProps {
    state: CircleState;
    center?: never;
    radiusMeters?: never;
}

/** Registers a single circle. Mirrors `CircleCompose.kt#Circle(state)`. */
function CircleWithState({ state }: CircleStateProps): null {
    const { circleCollector } = useMapViewScope();

    useEffect(() => {
        circleCollector.add(state);
    }, [state, circleCollector]);

    useEffect(() => {
        return () => { circleCollector.remove(state.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.id, circleCollector]);

    return null;
}

interface CirclesProps {
    /** An array or a collection that can be iterated again on remount. */
    states: Iterable<CircleState>;
}

/**
 * Efficiently registers many circles without per-circle effects.
 * Mirrors `CircleCompose.kt#Circles(states)`, `<Polylines>` and `<Polygons>`.
 *
 * Only this instance's ids are added and removed, so several `<Circles>` and
 * `<Circle>` can share one map; unmounting removes this instance's circles
 * and no others. A state whose id stays from one list to the next keeps its
 * first object, which takes the new values in place.
 */
export function Circles({ states }: CirclesProps): null {
    const { circleCollector } = useMapViewScope();
    const owned = useMemo(() => new OwnedOverlays(circleCollector, syncCircleState), [circleCollector]);

    useEffect(() => {
        owned.set(states);
    }, [states, owned]);

    useEffect(() => () => owned.clear(), [owned]);

    return null;
}

function syncCircleState(target: CircleState, source: CircleState): void {
    if (target.center !== source.center) target.center = source.center;
    if (target.radiusMeters !== source.radiusMeters) target.radiusMeters = source.radiusMeters;
    if (target.strokeColor !== source.strokeColor) target.strokeColor = source.strokeColor;
    if (target.strokeWidth !== source.strokeWidth) target.strokeWidth = source.strokeWidth;
    if (target.fillColor !== source.fillColor) target.fillColor = source.fillColor;
    if (target.geodesic !== source.geodesic) target.geodesic = source.geodesic;
    if (target.clickable !== source.clickable) target.clickable = source.clickable;
    if (target.zIndex !== source.zIndex) target.zIndex = source.zIndex;
    if (target.extra !== source.extra) target.extra = source.extra;
    if (target.onClick !== source.onClick) target.onClick = source.onClick;
    if (target.onAdded !== source.onAdded) target.onAdded = source.onAdded;
}

export interface CirclePositionProps {
    state?: never;
    center: GeoPoint;
    radiusMeters: number;
    id?: string | null;
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    zIndex?: number | null;
    geodesic?: boolean;
    clickable?: boolean;
    extra?: Serializable | null;
    onClick?: OnCircleEventHandler | null;
}

export type CircleProps = CircleStateProps | CirclePositionProps;

/**
 * Registers a single circle. Mirrors `CircleCompose.kt#Circle(state)` and
 * `CircleCompose.kt#Circle(center, ...)`.
 */
export function Circle(props: CircleStateProps): null;
export function Circle(props: CirclePositionProps): React.ReactElement | null;
export function Circle(props: CircleProps): React.ReactElement | null {
    if (isCirclePositionProps(props)) {
        return <CircleFromPositionProps {...props} />;
    }

    return <CircleWithState state={props.state} />;
}

function isCirclePositionProps(props: CircleProps): props is CirclePositionProps {
    return props.state === undefined;
}

function CircleFromPositionProps(props: CirclePositionProps): React.ReactElement | null {
    const stateRef = useRef<CircleState | null>(null);
    if (!stateRef.current) {
        stateRef.current = createCircleState({
            center: props.center,
            radiusMeters: props.radiusMeters,
            id: props.id,
            strokeColor: props.strokeColor ?? '#FF0000',
            strokeWidth: props.strokeWidth ?? 1,
            fillColor: props.fillColor ?? 'rgba(255,255,255,0.5)',
            zIndex: props.zIndex ?? null,
            geodesic: props.geodesic ?? true,
            clickable: props.clickable ?? true,
            extra: props.extra ?? null,
            onClick: props.onClick ?? null,
        });
    }
    const state = stateRef.current;

    useEffect(() => { state.center = props.center; }, [state, props.center]);
    useEffect(() => { state.radiusMeters = props.radiusMeters; }, [state, props.radiusMeters]);
    useEffect(() => { state.strokeColor = props.strokeColor ?? '#FF0000'; }, [state, props.strokeColor]);
    useEffect(() => { state.strokeWidth = props.strokeWidth ?? 1; }, [state, props.strokeWidth]);
    useEffect(() => { state.fillColor = props.fillColor ?? 'rgba(255,255,255,0.5)'; }, [state, props.fillColor]);
    useEffect(() => { state.zIndex = props.zIndex ?? null; }, [state, props.zIndex]);
    useEffect(() => { state.geodesic = props.geodesic ?? true; }, [state, props.geodesic]);
    useEffect(() => { state.clickable = props.clickable ?? true; }, [state, props.clickable]);
    useEffect(() => { state.extra = props.extra ?? null; }, [state, props.extra]);
    useEffect(() => { state.onClick = props.onClick ?? null; }, [state, props.onClick]);

    return <CircleWithState state={state} />;
}
