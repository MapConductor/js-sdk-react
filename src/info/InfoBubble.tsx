import { useEffect, useId, type ReactNode } from 'react';
import { DrawInfoBubble } from './DrawInfoBubble';
import { useMapViewScope } from '../MapViewScope';
import type { InfoBubbleEntry } from './InfoBubbleEntry';
import { createDefaultIcon, type GeoPoint, type MarkerState, type Offset } from '@mapconductor/js-sdk-core';

interface InfoBubbleStyleProps {
    bubbleColor?: string;
    borderColor?: string;
    contentPadding?: number;
    cornerRadius?: number;
    tailSize?: number;
    children: ReactNode;
}

interface InfoBubbleMarkerProps extends InfoBubbleStyleProps {
    /** Anchor the bubble to a marker (tracks the marker's position/icon). */
    marker: MarkerState;
    position?: never;
}

interface InfoBubblePositionProps extends InfoBubbleStyleProps {
    marker?: never;
    /** Anchor the bubble to an arbitrary geo position. */
    position: GeoPoint;
}

/**
 * Props for {@link InfoBubble}: pass exactly one of `marker` or `position`.
 * The two forms mirror Compose/iOS's overloaded `InfoBubble(marker:)` /
 * `InfoBubble(position:)`.
 */
export type InfoBubbleProps = InfoBubbleMarkerProps | InfoBubblePositionProps;

/**
 * Draws a styled speech-bubble anchored to either a marker (`marker` prop) or an
 * arbitrary geo position (`position` prop). Mirrors the overloaded
 * `InfoBubbleCompose.kt#InfoBubble(marker, ...)` / `InfoBubble(position, ...)`.
 */
export function InfoBubble(props: InfoBubbleProps) {
    const {
        bubbleColor = '#ffffff',
        borderColor = '#000000',
        contentPadding = 8,
        cornerRadius = 4,
        tailSize = 8,
        children,
    } = props;
    const marker = props.marker;
    const position = props.position;
    const { bubbleCollector } = useMapViewScope();
    const generatedId = useId();

    const content = (
        <DrawInfoBubble
            bubbleColor={bubbleColor}
            borderColor={borderColor}
            contentPadding={contentPadding}
            cornerRadius={cornerRadius}
            tailSize={tailSize}
        >
            {children}
        </DrawInfoBubble>
    );

    useEffect(() => {
        const entry: InfoBubbleEntry = marker
            ? {
                  id: marker.id,
                  markerId: marker.id,
                  positionProvider: () => marker.position,
                  // A marker with no explicit icon is rendered with the default
                  // pin (48px, anchored at its bottom tip). Resolve null to that
                  // same default so the bubble is offset by the pin's real size
                  // instead of collapsing to a zero-size icon and overlapping the
                  // marker.
                  icon: marker.icon ?? createDefaultIcon(),
                  tailOffset: { x: 0.5, y: 1.0 },
                  content,
              }
            : {
                  id: generatedId,
                  markerId: null,
                  positionProvider: () => position!,
                  icon: null,
                  tailOffset: { x: 0.5, y: 1.0 },
                  content,
              };
        bubbleCollector.add(entry);
        return () => {
            bubbleCollector.remove(entry.id);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marker, position]);

    return null;
}

interface InfoBubbleCustomProps {
    marker: MarkerState;
    tailOffset: Offset;
    children: ReactNode;
}

/** Registers a fully custom bubble content. Mirrors `InfoBubbleCompose.kt#InfoBubbleCustom`. */
export function InfoBubbleCustom({ marker, tailOffset, children }: InfoBubbleCustomProps) {
    const { bubbleCollector } = useMapViewScope();

    useEffect(() => {
        const entry: InfoBubbleEntry = {
            id: marker.id,
            markerId: marker.id,
            positionProvider: () => marker.position,
            // A marker with no explicit icon is rendered with the default pin
            // (48px, anchored at its bottom tip). Resolve null to that same
            // default so the bubble is offset by the pin's real size instead of
            // collapsing to a zero-size icon and overlapping the marker.
            icon: marker.icon ?? createDefaultIcon(),
            tailOffset,
            content: children,
        };
        bubbleCollector.add(entry);
        return () => {
            bubbleCollector.remove(entry.id);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marker, tailOffset]);

    return null;
}
