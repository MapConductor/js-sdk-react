import { useEffect, useId, type ReactNode } from 'react';
import { DrawInfoBubble } from './DrawInfoBubble';
import { useMapViewScope } from '../MapViewScope';
import type { InfoBubbleEntry } from './InfoBubbleEntry';
import type { GeoPoint, MarkerState, Offset } from '@mapconductor/core';

interface InfoBubbleProps {
    marker: MarkerState;
    bubbleColor?: string;
    borderColor?: string;
    contentPadding?: number;
    cornerRadius?: number;
    tailSize?: number;
    children: ReactNode;
}

/** Draws a styled speech-bubble anchored to a marker. Mirrors `InfoBubbleCompose.kt#InfoBubble(marker, ...)`. */
export function InfoBubble({
    marker,
    bubbleColor = '#ffffff',
    borderColor = '#000000',
    contentPadding = 8,
    cornerRadius = 4,
    tailSize = 8,
    children,
}: InfoBubbleProps) {
    const { bubbleCollector } = useMapViewScope();

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
        const entry: InfoBubbleEntry = {
            id: marker.id,
            positionProvider: () => marker.position,
            icon: marker.icon,
            tailOffset: { x: 0.5, y: 1.0 },
            content,
        };
        bubbleCollector.add(entry);
        return () => {
            bubbleCollector.remove(entry.id);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marker]);

    return null;
}

interface InfoBubblePositionProps {
    position: GeoPoint;
    bubbleColor?: string;
    borderColor?: string;
    contentPadding?: number;
    cornerRadius?: number;
    tailSize?: number;
    children: ReactNode;
}

/** Draws a styled speech-bubble anchored to a geo position. Mirrors `InfoBubbleCompose.kt#InfoBubble(position, ...)`. */
export function InfoBubbleAtPosition({
    position,
    bubbleColor = '#ffffff',
    borderColor = '#000000',
    contentPadding = 8,
    cornerRadius = 4,
    tailSize = 8,
    children,
}: InfoBubblePositionProps) {
    const { bubbleCollector } = useMapViewScope();
    const id = useId();

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
        const entry: InfoBubbleEntry = {
            id,
            positionProvider: () => position,
            icon: null,
            tailOffset: { x: 0.5, y: 1.0 },
            content,
        };
        bubbleCollector.add(entry);
        return () => {
            bubbleCollector.remove(id);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [position]);

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
            positionProvider: () => marker.position,
            icon: marker.icon,
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
