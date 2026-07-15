import React, { useEffect, useRef } from 'react';
import {
  createGroundImageState,
  type GeoRectBounds,
  type GroundImageState,
  type OnGroundImageEventHandler,
  type Serializable,
} from '@mapconductor/js-sdk-core';
import { useMapViewScope } from './MapViewScope.native';

export interface GroundImageStateProps {
  state: GroundImageState;
  bounds?: never;
  imageUrl?: never;
}

function GroundImageWithState({ state }: GroundImageStateProps): null {
  const { groundImageCollector } = useMapViewScope();

  useEffect(() => {
    groundImageCollector.add(state);
  }, [state, groundImageCollector]);

  useEffect(
    () => () => {
      groundImageCollector.remove(state.id);
    },
    [state.id, groundImageCollector]
  );

  return null;
}

export interface GroundImageBoundsProps {
  state?: never;
  bounds: GeoRectBounds;
  imageUrl: string;
  opacity?: number;
  tileSize?: number;
  id?: string | null;
  extra?: Serializable | null;
  onClick?: OnGroundImageEventHandler | null;
}

export type GroundImageProps = GroundImageStateProps | GroundImageBoundsProps;

export function GroundImage(props: GroundImageStateProps): null;
export function GroundImage(props: GroundImageBoundsProps): React.ReactElement | null;
export function GroundImage(props: GroundImageProps): React.ReactElement | null {
  if (props.state === undefined) return <GroundImageFromBoundsProps {...props} />;
  return <GroundImageWithState state={props.state} />;
}

function GroundImageFromBoundsProps(
  props: GroundImageBoundsProps
): React.ReactElement | null {
  const stateRef = useRef<GroundImageState | null>(null);
  if (!stateRef.current) {
    stateRef.current = createGroundImageState({
      bounds: props.bounds,
      imageUrl: props.imageUrl,
      opacity: props.opacity ?? 1,
      tileSize: props.tileSize,
      id: props.id,
      extra: props.extra ?? null,
      onClick: props.onClick ?? null,
    });
  }
  const state = stateRef.current;

  useEffect(() => {
    if (state.bounds !== props.bounds) state.bounds = props.bounds;
  }, [state, props.bounds]);
  useEffect(() => {
    if (state.imageUrl !== props.imageUrl) state.imageUrl = props.imageUrl;
  }, [state, props.imageUrl]);
  useEffect(() => {
    const opacity = props.opacity ?? 1;
    if (state.opacity !== opacity) state.opacity = opacity;
  }, [state, props.opacity]);
  useEffect(() => {
    const tileSize = props.tileSize ?? 256;
    if (state.tileSize !== tileSize) state.tileSize = tileSize;
  }, [state, props.tileSize]);
  useEffect(() => {
    const extra = props.extra ?? null;
    if (state.extra !== extra) state.extra = extra;
  }, [state, props.extra]);
  useEffect(() => {
    const onClick = props.onClick ?? null;
    if (state.onClick !== onClick) state.onClick = onClick;
  }, [state, props.onClick]);

  return <GroundImageWithState state={state} />;
}
