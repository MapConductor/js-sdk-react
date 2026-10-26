import { useEffect, useId, type ReactNode } from 'react';
import { DrawInfoBubble } from './DrawInfoBubble';
import { useMapViewScope } from '../MapViewScope';
import type { InfoBubbleEntry } from './InfoBubbleEntry';
import {
    createDefaultIcon,
    type GeoPoint,
    type MarkerIcon,
    type MarkerState,
    type Offset,
    type OverlayCollector,
} from '@mapconductor/js-sdk-core';

/**
 * Registers a marker's bubble and keeps its icon current.
 *
 * The position is read through `positionProvider` on every draw, so it
 * follows the marker on its own. The icon is a value in the entry, so an icon
 * swapped on the same MarkerState (`marker.icon = …`) left the bubble at the
 * old icon's size, `anchor` and `infoAnchor`, and the `[marker]` effect
 * dependency never saw the change. Re-add the entry when the icon changes.
 *
 * Only on an icon change: the fingerprint also ticks on every position change,
 * which is every frame of an animation or a drag, and re-adding then would
 * renotify the collector for nothing.
 */
function followMarker(
    bubbleCollector: OverlayCollector<InfoBubbleEntry>,
    marker: MarkerState,
    buildEntry: (icon: MarkerIcon) => InfoBubbleEntry,
): () => void {
    let icon = marker.icon;
    // A marker with no explicit icon is rendered with the default pin (48px,
    // anchored at its bottom tip). Resolve null to that same default so the
    // bubble is offset by the pin's real size instead of collapsing to a
    // zero-size icon and overlapping the marker.
    const add = () => bubbleCollector.add(buildEntry(icon ?? createDefaultIcon()));
    add();
    const unsubscribe = marker.asObservable().subscribe(() => {
        if (marker.icon === icon) return;
        icon = marker.icon;
        add();
    });
    return () => {
        unsubscribe();
        bubbleCollector.remove(marker.id);
    };
}

interface InfoBubbleStyleProps {
    bubbleColor?: string;
    borderColor?: string;
    /** 枠線の太さ(px)。android の borderWidth / ios の borderWidth と同一契約。 */
    borderWidth?: number;
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
        borderWidth = 2,
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
            borderWidth={borderWidth}
            contentPadding={contentPadding}
            cornerRadius={cornerRadius}
            tailSize={tailSize}
        >
            {children}
        </DrawInfoBubble>
    );

    useEffect(() => {
        if (marker) {
            return followMarker(bubbleCollector, marker, (icon) => ({
                id: marker.id,
                markerId: marker.id,
                positionProvider: () => marker.position,
                icon,
                tailOffset: { x: 0.5, y: 1.0 },
                content,
            }));
        }

        const entry: InfoBubbleEntry = {
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
        return followMarker(bubbleCollector, marker, (icon) => ({
            id: marker.id,
            markerId: marker.id,
            positionProvider: () => marker.position,
            icon,
            tailOffset,
            content: children,
        }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marker, tailOffset]);

    return null;
}
