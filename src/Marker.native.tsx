import React, { useEffect, useRef } from 'react';
import { useMapViewScope } from './MapViewScope.native';
import {
  createMarkerState,
  type GeoPoint,
  type MarkerAnimation,
  type MarkerIcon,
  type MarkerState,
  type OnMarkerEventHandler,
  type Serializable,
} from '@mapconductor/js-sdk-core';

export interface MarkerStateProps {
  state: MarkerState;
  position?: never;
}

/** Registers a single marker. Mirrors `MarkerCompose.kt#Marker(state)`. */
function MarkerWithState({ state }: MarkerStateProps): null {
  const { markerCollector } = useMapViewScope();

  useEffect(() => {
    markerCollector.add(state);
  }, [state, markerCollector]);

  useEffect(() => {
    return () => {
      markerCollector.remove(state.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.id, markerCollector]);

  return null;
}

interface MarkersProps {
  states: MarkerState[];
}

/**
 * Efficiently registers many markers without per-marker effects.
 * Mirrors `MarkerCompose.kt#Markers(states)`.
 */
export function Markers({ states }: MarkersProps): null {
  const { markerCollector } = useMapViewScope();
  const stableStatesRef = useRef<Map<string, MarkerState>>(new Map());

  useEffect(() => {
    const nextIds = new Set<string>();
    const stableStates = states.map((state) => {
      nextIds.add(state.id);
      const stableState = stableStatesRef.current.get(state.id);
      if (!stableState) {
        stableStatesRef.current.set(state.id, state);
        return state;
      }
      syncMarkerState(stableState, state);
      return stableState;
    });

    for (const id of stableStatesRef.current.keys()) {
      if (!nextIds.has(id)) stableStatesRef.current.delete(id);
    }

    markerCollector.replaceAll(stableStates);
  }, [states, markerCollector]);

  useEffect(
    () => () => {
      markerCollector.clear();
      stableStatesRef.current.clear();
    },
    [markerCollector]
  );

  return null;
}

function syncMarkerState(target: MarkerState, source: MarkerState): void {
  if (!target.position.equals(source.position)) target.position = source.position;
  if (target.extra !== source.extra) target.extra = source.extra;
  if (target.icon !== source.icon) target.icon = source.icon;
  if (target.animation !== source.animation) target.animation = source.animation;
  if (target.clickable !== source.clickable) target.clickable = source.clickable;
  if (target.draggable !== source.draggable) target.draggable = source.draggable;
  if (target.zIndex !== source.zIndex) target.zIndex = source.zIndex;
  if (target.onClick !== source.onClick) target.onClick = source.onClick;
  if (target.onDragStart !== source.onDragStart) target.onDragStart = source.onDragStart;
  if (target.onDrag !== source.onDrag) target.onDrag = source.onDrag;
  if (target.onDragEnd !== source.onDragEnd) target.onDragEnd = source.onDragEnd;
  if (target.onAnimateStart !== source.onAnimateStart) {
    target.onAnimateStart = source.onAnimateStart;
  }
  if (target.onAnimateEnd !== source.onAnimateEnd) target.onAnimateEnd = source.onAnimateEnd;
}

export interface MarkerPositionProps {
  state?: never;
  position: GeoPoint;
  id?: string | null;
  zIndex?: number | null;
  clickable?: boolean;
  draggable?: boolean;
  icon?: MarkerIcon | null;
  animation?: MarkerAnimation | null;
  extra?: Serializable | null;
  onClick?: OnMarkerEventHandler | null;
  onDragStart?: OnMarkerEventHandler | null;
  onDrag?: OnMarkerEventHandler | null;
  onDragEnd?: OnMarkerEventHandler | null;
  onAnimateStart?: OnMarkerEventHandler | null;
  onAnimateEnd?: OnMarkerEventHandler | null;
}

export type MarkerProps = MarkerStateProps | MarkerPositionProps;

export function Marker(props: MarkerStateProps): null;
export function Marker(props: MarkerPositionProps): React.ReactElement | null;
export function Marker(props: MarkerProps): React.ReactElement | null {
  if (isMarkerPositionProps(props)) {
    return <MarkerFromPositionProps {...props} />;
  }
  return <MarkerWithState state={props.state} />;
}

function isMarkerPositionProps(props: MarkerProps): props is MarkerPositionProps {
  return props.state === undefined;
}

function MarkerFromPositionProps(props: MarkerPositionProps): React.ReactElement | null {
  const stateRef = useRef<MarkerState | null>(null);

  if (!stateRef.current) {
    stateRef.current = createMarkerState({
      position: props.position,
      id: props.id,
      zIndex: props.zIndex ?? null,
      clickable: props.clickable ?? true,
      draggable: props.draggable ?? false,
      icon: props.icon ?? null,
      animation: props.animation ?? null,
      extra: props.extra ?? null,
      onClick: props.onClick ?? null,
      onDragStart: props.onDragStart ?? null,
      onDrag: props.onDrag ?? null,
      onDragEnd: props.onDragEnd ?? null,
      onAnimateStart: props.onAnimateStart ?? null,
      onAnimateEnd: props.onAnimateEnd ?? null,
    });
  }

  const state = stateRef.current;

  useEffect(() => {
    state.position = props.position;
  }, [state, props.position]);
  useEffect(() => {
    state.extra = props.extra ?? null;
  }, [state, props.extra]);
  useEffect(() => {
    state.icon = props.icon ?? null;
  }, [state, props.icon]);
  useEffect(() => {
    state.animation = props.animation ?? null;
  }, [state, props.animation]);
  useEffect(() => {
    state.setClickable(props.clickable ?? true);
  }, [state, props.clickable]);
  useEffect(() => {
    state.setDraggable(props.draggable ?? false);
  }, [state, props.draggable]);
  useEffect(() => {
    state.setZIndex(props.zIndex ?? 0);
  }, [state, props.zIndex]);
  useEffect(() => {
    state.onClick = props.onClick ?? null;
  }, [state, props.onClick]);
  useEffect(() => {
    state.onDragStart = props.onDragStart ?? null;
  }, [state, props.onDragStart]);
  useEffect(() => {
    state.onDrag = props.onDrag ?? null;
  }, [state, props.onDrag]);
  useEffect(() => {
    state.onDragEnd = props.onDragEnd ?? null;
  }, [state, props.onDragEnd]);
  useEffect(() => {
    state.onAnimateStart = props.onAnimateStart ?? null;
  }, [state, props.onAnimateStart]);
  useEffect(() => {
    state.onAnimateEnd = props.onAnimateEnd ?? null;
  }, [state, props.onAnimateEnd]);

  return <MarkerWithState state={state} />;
}
