import React, { useEffect, useRef } from 'react';
import {
  createPolylineState,
  fromLatLng,
  type GeoPoint,
  type GeoRectBounds,
  type OnPolylineEventHandler,
  type PolylineState,
  type Serializable,
} from '@mapconductor/js-sdk-core';
import { useMapViewScope } from './MapViewScope.native';

export interface PolylineStateProps {
  state: PolylineState;
  points?: never;
  bounds?: never;
}

function PolylineWithState({ state }: PolylineStateProps): null {
  const { polylineCollector } = useMapViewScope();

  useEffect(() => {
    polylineCollector.add(state);
  }, [state, polylineCollector]);

  useEffect(
    () => () => {
      polylineCollector.remove(state.id);
    },
    [state.id, polylineCollector]
  );

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

  useEffect(() => {
    if (state.points !== props.points) state.points = props.points;
  }, [state, props.points]);
  useEffect(() => {
    const strokeColor = props.strokeColor ?? '#000000';
    if (state.strokeColor !== strokeColor) state.strokeColor = strokeColor;
  }, [state, props.strokeColor]);
  useEffect(() => {
    const strokeWidth = props.strokeWidth ?? 1;
    if (state.strokeWidth !== strokeWidth) state.strokeWidth = strokeWidth;
  }, [state, props.strokeWidth]);
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
