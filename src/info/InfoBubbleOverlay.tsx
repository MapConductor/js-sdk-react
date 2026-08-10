import { ScreenProjectionRequirement } from '@mapconductor/js-sdk-core';
import { useMapServiceRegistry } from '../map/MapServiceRegistryContext';
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
/**
 * 吹き出しの実体を画面座標へ配置する。**プロバイダのビュー専用**。
 *
 * アプリが使うのは `<InfoBubble>` で、こちらはそれを描くための下請け。
 * 実際、examples/basic からの参照は 0 件で、参照しているのは react-for-* だけ。
 *
 * @internal ドライバー実装点。公開 API サーフェスには含めない。
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
    // 同期投影を持たないと**宣言している**プロバイダでは吹き出しを出せない。
    // positionOffset が画面外の値になるだけだと理由が分からないので、
    // 宣言を見て 1 回だけ報告する。ScreenProjectionRequirement を参照。
    const registry = useMapServiceRegistry();
    const canProject = ScreenProjectionRequirement.check(registry, 'this provider', 'InfoBubble');

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

    // フックの後で判定する（フックの順序を崩さないため）。
    if (!canProject) return null;

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
