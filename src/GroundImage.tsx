import React, { useEffect, useRef } from 'react';
import { useMapViewScope } from './MapViewScope';
import {
  createGroundImageState,
  type GroundImageState,
  type OnGroundImageEventHandler,
  type GeoRectBounds,
  type Serializable,
} from '@mapconductor/js-sdk-core';

interface GroundImageStateProps {
    state: GroundImageState;
}

/** Registers a ground image overlay. Mirrors `GroundImageComponent.kt#GroundImage(state)`. */
export function GroundImage({ state }: GroundImageStateProps): null {
    const { groundImageCollector } = useMapViewScope();

    useEffect(() => {
        groundImageCollector.add(state);
    }, [state, groundImageCollector]);

    useEffect(() => {
        return () => { groundImageCollector.remove(state.id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.id, groundImageCollector]);

    return null;
}

interface GroundImagePropsExpanded {
    bounds: GeoRectBounds;
    imageUrl: string;
    opacity?: number;
    tileSize?: number;
    id?: string | null;
    extra?: Serializable | null;
    onClick?: OnGroundImageEventHandler | null;
}

/**
 * Convenience overload: creates a GroundImageState from props, then registers it.
 * Mirrors `GroundImageComponent.kt#GroundImage(bounds, image, ...)` (web port uses imageUrl instead of Drawable).
 */
export function GroundImageFromProps(props: GroundImagePropsExpanded): React.ReactElement | null {
    const stateRef = useRef<GroundImageState | null>(null);
    if (!stateRef.current) {
        stateRef.current = createGroundImageState({
            bounds: props.bounds,
            imageUrl: props.imageUrl,
            opacity: props.opacity ?? 0.5,
            tileSize: props.tileSize,
            id: props.id,
            extra: props.extra ?? null,
            onClick: props.onClick ?? null,
        });
    }
    const state = stateRef.current;

    useEffect(() => { state.bounds = props.bounds; }, [state, props.bounds]);
    useEffect(() => { state.imageUrl = props.imageUrl; }, [state, props.imageUrl]);
    useEffect(() => { state.opacity = props.opacity ?? 0.5; }, [state, props.opacity]);
    useEffect(() => { state.onClick = props.onClick ?? null; }, [state, props.onClick]);

    return <GroundImage state={state} />;
}
