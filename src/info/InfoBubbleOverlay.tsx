import { useRef, useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import type { Offset } from '@mapconductor/js-sdk-core';

interface InfoBubbleOverlayProps {
    /** Screen pixel offset of the anchor point (marker position projected to screen). */
    positionOffset: Offset;
    /** Pixel size of the associated icon. */
    iconSize: { width: number; height: number };
    /** Normalised anchor point within the icon that aligns to the map position (0–1). */
    iconOffset: Offset;
    /** Normalised point within the icon that the info bubble connects to (0–1). */
    infoAnchorOffset: Offset;
    /** Normalised connection point within the bubble content (0–1). */
    tailOffset: Offset;
    children: ReactNode;
    style?: CSSProperties;
}

/**
 * Positions its children at the correct screen coordinates relative to a map marker.
 * Mirrors `InfoBubbleOverlay` from `InfoWindowOverlay.kt`.
 */
export function InfoBubbleOverlay({
    positionOffset,
    iconSize,
    iconOffset,
    infoAnchorOffset,
    tailOffset,
    children,
    style,
}: InfoBubbleOverlayProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [infoWndSize, setInfoWndSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setInfoWndSize({ width, height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const x =
        positionOffset.x +
        (-tailOffset.x * infoWndSize.width) +
        ((0.5 - iconOffset.x) * iconSize.width) +
        ((infoAnchorOffset.x - 0.5) * iconSize.width);

    const y =
        positionOffset.y +
        (-tailOffset.y * infoWndSize.height) +
        ((0.5 - iconOffset.y) * iconSize.height) +
        ((infoAnchorOffset.y - 0.5) * iconSize.height);

    return (
        <div
            ref={ref}
            style={{
                position: 'absolute',
                left: x,
                top: y,
                ...style,
            }}
        >
            {children}
        </div>
    );
}
