import React, { useEffect, useRef } from 'react';
import { useMapViewScope } from './MapViewScope';
import {
  createRasterLayerState,
  type RasterLayerState,
  type RasterLayerSource,
} from '@mapconductor/core';

interface RasterLayerStateProps {
    state: RasterLayerState;
}

/** Registers a raster tile layer. Mirrors `RasterLayerComponent.kt#RasterLayer(state)`. */
export function RasterLayer({ state }: RasterLayerStateProps): null {
    const { rasterLayerCollector } = useMapViewScope();

    useEffect(() => {
        rasterLayerCollector.add(state);
    }, [state, rasterLayerCollector]);

    useEffect(() => {
        return () => { rasterLayerCollector.remove(state.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.id, rasterLayerCollector]);

    return null;
}

interface RasterLayerPropsExpanded {
    source: RasterLayerSource;
    opacity?: number;
    visible?: boolean;
    zIndex?: number;
    userAgent?: string;
    id?: string | null;
    extraHeaders?: Record<string, string> | null;
    debug?: boolean;
}

/**
 * Convenience overload: creates a RasterLayerState from props, then registers it.
 * Mirrors `RasterLayerComponent.kt#RasterLayer(source, ...)`.
 */
export function RasterLayerFromProps(props: RasterLayerPropsExpanded): React.ReactElement | null {
    const stateRef = useRef<RasterLayerState | null>(null);
    if (!stateRef.current) {
        stateRef.current = createRasterLayerState({
            source: props.source,
            opacity: props.opacity ?? 1.0,
            visible: props.visible ?? true,
            zIndex: props.zIndex ?? 0,
            userAgent: props.userAgent,
            id: props.id,
            extraHeaders: props.extraHeaders ?? null,
            debug: props.debug ?? false,
        });
    }
    const state = stateRef.current;

    useEffect(() => { state.source = props.source; }, [state, props.source]);
    useEffect(() => { state.opacity = props.opacity ?? 1.0; }, [state, props.opacity]);
    useEffect(() => { state.visible = props.visible ?? true; }, [state, props.visible]);
    useEffect(() => { state.zIndex = props.zIndex ?? 0; }, [state, props.zIndex]);
    useEffect(() => { state.extraHeaders = props.extraHeaders ?? null; }, [state, props.extraHeaders]);
    useEffect(() => { state.debug = props.debug ?? false; }, [state, props.debug]);

    return <RasterLayer state={state} />;
}
