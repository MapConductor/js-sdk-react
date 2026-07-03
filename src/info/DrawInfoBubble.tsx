import { useRef, useState, useEffect, type ReactNode } from 'react';

interface DrawInfoBubbleProps {
    bubbleColor?: string;
    borderColor?: string;
    contentPadding?: number;
    cornerRadius?: number;
    tailSize?: number;
    children: ReactNode;
}

function buildPath({
    w,
    h,
    r,
    t,
}: {
    w: number;
    h: number;
    r: number;
    t: number;
}): string {
    return [
        `M ${r} 0`,
        `L ${w - r} 0`,
        `A ${r} ${r} 0 0 1 ${w} ${r}`,
        `L ${w} ${h - t - r}`,
        `A ${r} ${r} 0 0 1 ${w - r} ${h - t}`,
        `L ${w / 2 + t / 2} ${h - t}`,
        `L ${w / 2} ${h}`,
        `L ${w / 2 - t / 2} ${h - t}`,
        `L ${r} ${h - t}`,
        `A ${r} ${r} 0 0 1 0 ${h - t - r}`,
        `L 0 ${r}`,
        `A ${r} ${r} 0 0 1 ${r} 0`,
        'Z',
    ].join(' ');
}

export function DrawInfoBubble({
    bubbleColor = '#ffffff',
    borderColor = '#000000',
    contentPadding = 8,
    cornerRadius = 4,
    tailSize = 8,
    children,
}: DrawInfoBubbleProps) {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setSize({ width, height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const { width, height } = size;
    const pathD = width > 0 && height > 0
        ? buildPath({ w: width, h: height, r: cornerRadius, t: tailSize })
        : '';

    return (
        <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
            {pathD && (
                <svg
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        overflow: 'visible',
                        pointerEvents: 'none',
                    }}
                    viewBox={`0 0 ${width} ${height}`}
                    aria-hidden="true"
                >
                    <path d={pathD} fill={bubbleColor} stroke={borderColor} strokeWidth={2} />
                </svg>
            )}
            <div
                style={{
                    padding: `${contentPadding}px ${contentPadding}px ${contentPadding + tailSize}px ${contentPadding}px`,
                    position: 'relative',
                }}
            >
                {children}
            </div>
        </div>
    );
}
