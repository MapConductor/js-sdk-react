import { useEffect, useRef } from 'react';

/**
 * Tracks the most recent pointer input type (touch vs. mouse/pen).
 *
 * Returns a ref whose `.current` is updated on each `pointerdown` event.
 * Use it to select an appropriate hit-test radius at click time:
 *
 * ```ts
 * const pointerTypeRef = usePointerType();
 * // in click handler:
 * const radius = pointerTypeRef.current === 'touch'
 *   ? MARKER_HIT_RADIUS_TOUCH_PX
 *   : MARKER_HIT_RADIUS_MOUSE_PX;
 * ```
 */
export function usePointerType(): React.MutableRefObject<'touch' | 'mouse'> {
    const ref = useRef<'touch' | 'mouse'>('mouse');

    useEffect(() => {
        const onPointerDown = (e: PointerEvent) => {
            ref.current = e.pointerType === 'touch' ? 'touch' : 'mouse';
        };
        window.addEventListener('pointerdown', onPointerDown);
        return () => window.removeEventListener('pointerdown', onPointerDown);
    }, []);

    return ref;
}
