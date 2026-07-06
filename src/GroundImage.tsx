import React, { useEffect, useRef } from 'react';
import { useMapViewScope } from './MapViewScope';
import {
  createGroundImageState,
  type GroundImageState,
  type OnGroundImageEventHandler,
  type GeoRectBounds,
  type Serializable,
} from '@mapconductor/js-sdk-core';

export interface GroundImageStateProps {
    state: GroundImageState;
    bounds?: never;
    imageUrl?: never;
}

/** Registers a ground image overlay. Mirrors `GroundImageComponent.kt#GroundImage(state)`. */
function GroundImageWithState({ state }: GroundImageStateProps): null {
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

/**
 * Registers a ground image overlay. Mirrors
 * `GroundImageComponent.kt#GroundImage(state)` and
 * `GroundImageComponent.kt#GroundImage(bounds, image, ...)` (web port uses imageUrl instead of Drawable).
 */
export type GroundImageProps = GroundImageStateProps | GroundImageBoundsProps;

export function GroundImage(props: GroundImageStateProps): null;
export function GroundImage(props: GroundImageBoundsProps): React.ReactElement | null;
export function GroundImage(props: GroundImageProps): React.ReactElement | null {
    if (isGroundImageBoundsProps(props)) {
        return <GroundImageFromBoundsProps {...props} />;
    }

    return <GroundImageWithState state={props.state} />;
}

function isGroundImageBoundsProps(props: GroundImageProps): props is GroundImageBoundsProps {
    return props.state === undefined;
}

function GroundImageFromBoundsProps(props: GroundImageBoundsProps): React.ReactElement | null {
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
    useEffect(() => { state.tileSize = props.tileSize ?? 256; }, [state, props.tileSize]);
    useEffect(() => { state.extra = props.extra ?? null; }, [state, props.extra]);
    useEffect(() => { state.onClick = props.onClick ?? null; }, [state, props.onClick]);

    return <GroundImageWithState state={state} />;
}
