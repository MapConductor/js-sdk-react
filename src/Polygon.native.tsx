import React, { useEffect, useRef } from 'react';
import {
  createPolygonState,
  fromLatLng,
  unionHolesInPlace,
  type GeoPoint,
  type GeoRectBounds,
  type OnPolygonEventHandler,
  type PolygonState,
  type Serializable,
} from '@mapconductor/js-sdk-core';
import { useMapViewScope } from './MapViewScope.native';

const EMPTY_HOLES: GeoPoint[][] = [];

export interface PolygonStateProps {
  state: PolygonState;
  points?: never;
  bounds?: never;
}

function PolygonWithState({ state }: PolygonStateProps): null {
  const { polygonCollector } = useMapViewScope();

  useEffect(() => {
    if (state.holes.length > 1) unionHolesInPlace(state);
    polygonCollector.add(state);
  }, [state, polygonCollector]);

  useEffect(
    () => () => {
      polygonCollector.remove(state.id);
    },
    [state.id, polygonCollector]
  );

  return null;
}

interface PolygonsProps {
  states: PolygonState[];
}

/**
 * Efficiently registers many polygons without per-polygon effects.
 * Mirrors `PolygonComponent.kt#Polygons(states)` and the `<Markers>` collection.
 */
export function Polygons({ states }: PolygonsProps): null {
  const { polygonCollector } = useMapViewScope();
  const stableStatesRef = useRef<Map<string, PolygonState>>(new Map());

  useEffect(() => {
    polygonCollector.batchChanges(() => {
      const nextIds = new Set<string>();
      const added: PolygonState[] = [];
      for (const state of states) {
        nextIds.add(state.id);
        const stableState = stableStatesRef.current.get(state.id);
        if (!stableState) {
          if (state.holes.length > 1) unionHolesInPlace(state);
          stableStatesRef.current.set(state.id, state);
          added.push(state);
        } else {
          syncPolygonState(stableState, state);
        }
      }

      // Remove only the ids this <Polygons> instance owns, as <Markers> does, so
      // several <Polygons>/<Polygon> can share one map's collector.
      const removedIds: string[] = [];
      for (const id of stableStatesRef.current.keys()) {
        if (!nextIds.has(id)) removedIds.push(id);
      }
      for (const id of removedIds) stableStatesRef.current.delete(id);

      if (added.length > 0 || removedIds.length > 0) {
        polygonCollector.applyDiff(added, removedIds);
      }
    });
  }, [states, polygonCollector]);

  useEffect(() => {
    const ownStates = stableStatesRef.current;
    return () => {
      // Remove only our own polygons on unmount, never the whole collection.
      polygonCollector.applyDiff([], [...ownStates.keys()]);
      ownStates.clear();
    };
  }, [polygonCollector]);

  return null;
}

function syncPolygonState(target: PolygonState, source: PolygonState): void {
  if (target.points !== source.points) target.points = source.points;
  // Holes replaced later are unioned by the renderer's resolveHoles(), as with
  // vertex drags; unioning here would make them differ from source every render.
  if (target.holes !== source.holes) target.holes = source.holes;
  if (target.strokeColor !== source.strokeColor) target.strokeColor = source.strokeColor;
  if (target.strokeWidth !== source.strokeWidth) target.strokeWidth = source.strokeWidth;
  if (target.fillColor !== source.fillColor) target.fillColor = source.fillColor;
  if (target.geodesic !== source.geodesic) target.geodesic = source.geodesic;
  if (target.clickable !== source.clickable) target.clickable = source.clickable;
  if (target.zIndex !== source.zIndex) target.zIndex = source.zIndex;
  if (target.extra !== source.extra) target.extra = source.extra;
  if (target.onClick !== source.onClick) target.onClick = source.onClick;
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

export function Polygon(props: PolygonStateProps): null;
export function Polygon(props: PolygonPointsProps): React.ReactElement | null;
export function Polygon(props: PolygonBoundsProps): React.ReactElement | null;
export function Polygon(props: PolygonProps): React.ReactElement | null {
  if (isPolygonPointsProps(props)) return <PolygonFromPointsProps {...props} />;
  if (isPolygonBoundsProps(props)) return <PolygonFromBoundsProps {...props} />;
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
      holes: props.holes ?? EMPTY_HOLES,
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

  useEffect(() => {
    if (state.points !== props.points) state.points = props.points;
  }, [state, props.points]);
  useEffect(() => {
    const holes = props.holes ?? EMPTY_HOLES;
    if (state.holes !== holes) state.holes = holes;
  }, [state, props.holes]);
  useEffect(() => {
    const strokeColor = props.strokeColor ?? '#000000';
    if (state.strokeColor !== strokeColor) state.strokeColor = strokeColor;
  }, [state, props.strokeColor]);
  useEffect(() => {
    const strokeWidth = props.strokeWidth ?? 1;
    if (state.strokeWidth !== strokeWidth) state.strokeWidth = strokeWidth;
  }, [state, props.strokeWidth]);
  useEffect(() => {
    const fillColor = props.fillColor ?? 'transparent';
    if (state.fillColor !== fillColor) state.fillColor = fillColor;
  }, [state, props.fillColor]);
  useEffect(() => {
    const geodesic = props.geodesic ?? false;
    if (state.geodesic !== geodesic) state.geodesic = geodesic;
  }, [state, props.geodesic]);
  useEffect(() => {
    const zIndex = props.zIndex ?? 0;
    if (state.zIndex !== zIndex) state.zIndex = zIndex;
  }, [state, props.zIndex]);
  useEffect(() => {
    const extra = props.extra ?? null;
    if (state.extra !== extra) state.extra = extra;
  }, [state, props.extra]);
  useEffect(() => {
    const onClick = props.onClick ?? null;
    if (state.onClick !== onClick) state.onClick = onClick;
  }, [state, props.onClick]);

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
