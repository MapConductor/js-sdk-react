import React, { useEffect, useRef } from 'react';
import { useMapViewScope } from './MapViewScope';
import {
  createCircleState,
  type CircleState,
  type OnCircleEventHandler,
  type GeoPoint,
  type Serializable,
} from '@mapconductor/core';

interface CircleStateProps {
    state: CircleState;
}

/** Registers a single circle. Mirrors `CircleCompose.kt#Circle(state)`. */
export function Circle({ state }: CircleStateProps): null {
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

interface CirclePropsExpanded {
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

/**
 * Convenience overload: creates a CircleState from props, then registers it.
 * Mirrors `CircleCompose.kt#Circle(center, ...)`.
 */
export function CircleFromProps(props: CirclePropsExpanded): React.ReactElement | null {
    const stateRef = useRef<CircleState | null>(null);
    if (!stateRef.current) {
        stateRef.current = createCircleState({
            center: props.center,
            radiusMeters: props.radiusMeters,
            id: props.id,
            strokeColor: props.strokeColor ?? '#FF0000',
            strokeWidth: props.strokeWidth ?? 2,
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
    useEffect(() => { state.strokeWidth = props.strokeWidth ?? 2; }, [state, props.strokeWidth]);
    useEffect(() => { state.fillColor = props.fillColor ?? 'rgba(255,255,255,0.5)'; }, [state, props.fillColor]);
    useEffect(() => { state.zIndex = props.zIndex ?? null; }, [state, props.zIndex]);
    useEffect(() => { state.geodesic = props.geodesic ?? true; }, [state, props.geodesic]);
    useEffect(() => { state.clickable = props.clickable ?? true; }, [state, props.clickable]);
    useEffect(() => { state.onClick = props.onClick ?? null; }, [state, props.onClick]);

    return <Circle state={state} />;
}
