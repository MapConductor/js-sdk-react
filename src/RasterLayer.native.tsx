import React, { useEffect, useRef } from 'react';
import {
  createRasterLayerState,
  type RasterLayerSource,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import { useMapViewScope } from './MapViewScope.native';

const DEFAULT_RASTER_LAYER_USER_AGENT =
  'MapConductor/RasterLayerAgent(https://mapconductor.com)';

export interface RasterLayerStateProps {
  state: RasterLayerState;
  source?: never;
}

function RasterLayerWithState({ state }: RasterLayerStateProps): null {
  const { rasterLayerCollector } = useMapViewScope();

  useEffect(() => {
    rasterLayerCollector.add(state);
  }, [state, rasterLayerCollector]);

  useEffect(() => {
    return () => {
      rasterLayerCollector.remove(state.id);
    };
  }, [state.id, rasterLayerCollector]);

  return null;
}

export interface RasterLayerSourceProps {
  state?: never;
  source: RasterLayerSource;
  opacity?: number;
  visible?: boolean;
  zIndex?: number;
  userAgent?: string;
  id?: string | null;
  extraHeaders?: Record<string, string> | null;
  debug?: boolean;
}

export type RasterLayerProps = RasterLayerStateProps | RasterLayerSourceProps;

export function RasterLayer(props: RasterLayerStateProps): null;
export function RasterLayer(props: RasterLayerSourceProps): React.ReactElement | null;
export function RasterLayer(props: RasterLayerProps): React.ReactElement | null {
  if (isRasterLayerSourceProps(props)) {
    return <RasterLayerFromSourceProps {...props} />;
  }

  return <RasterLayerWithState state={props.state} />;
}

function isRasterLayerSourceProps(props: RasterLayerProps): props is RasterLayerSourceProps {
  return props.state === undefined;
}

function RasterLayerFromSourceProps(
  props: RasterLayerSourceProps
): React.ReactElement | null {
  const stateRef = useRef<RasterLayerState | null>(null);
  if (!stateRef.current) {
    stateRef.current = createRasterLayerState({
      source: props.source,
      opacity: props.opacity ?? 1,
      visible: props.visible ?? true,
      zIndex: props.zIndex ?? 0,
      userAgent: props.userAgent ?? DEFAULT_RASTER_LAYER_USER_AGENT,
      id: props.id,
      extraHeaders: props.extraHeaders ?? null,
      debug: props.debug ?? false,
    });
  }
  const state = stateRef.current;

  useEffect(() => {
    state.source = props.source;
  }, [state, props.source]);
  useEffect(() => {
    state.opacity = props.opacity ?? 1;
  }, [state, props.opacity]);
  useEffect(() => {
    state.visible = props.visible ?? true;
  }, [state, props.visible]);
  useEffect(() => {
    state.zIndex = props.zIndex ?? 0;
  }, [state, props.zIndex]);
  useEffect(() => {
    state.userAgent = props.userAgent ?? DEFAULT_RASTER_LAYER_USER_AGENT;
  }, [state, props.userAgent]);
  useEffect(() => {
    state.extraHeaders = props.extraHeaders ?? null;
  }, [state, props.extraHeaders]);
  useEffect(() => {
    state.debug = props.debug ?? false;
  }, [state, props.debug]);

  return <RasterLayerWithState state={state} />;
}
