import { useEffect, useRef } from 'react';
import {
  bounceInterpolation,
  MarkerAnimation,
  type MarkerAnimationOverlayEntry,
  type Offset,
} from '@mapconductor/js-sdk-core';

type ResolveScreenOffset = (
  entry: MarkerAnimationOverlayEntry,
) => Offset | null | Promise<Offset | null>;

/**
 * Animates a single marker's icon in screen space: starts above the top edge
 * of the map and translates down to the marker's projected screen position,
 * re-projecting every frame so the animation tracks camera movement, tilt,
 * rotation, or globe/3D perspective correctly (unlike interpolating lat/lng).
 * Mirrors Android's `MarkerAnimationLayer.kt` (compose/marker).
 */
function AnimatedMarkerImage({
  entry,
  resolveScreenOffset,
}: {
  entry: MarkerAnimationOverlayEntry;
  resolveScreenOffset: ResolveScreenOffset;
}) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelled = false;
    const startTime = performance.now();
    const duration = Math.max(1, entry.durationMillis);
    const interpolate = entry.animation === MarkerAnimation.Bounce ? bounceInterpolation : (t: number) => t;
    const { anchor, size } = entry.bitmapIcon;

    const tick = async () => {
      if (cancelled) return;
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const t = Math.min(1, Math.max(0, interpolate(progress)));

      const target = await Promise.resolve(resolveScreenOffset(entry));
      if (cancelled) return;

      const img = imgRef.current;
      if (img) {
        if (target == null) {
          img.style.opacity = '0';
        } else {
          const endX = target.x - anchor.x * size.width;
          const endY = target.y - anchor.y * size.height;
          const startY = -size.height;
          const y = startY + (endY - startY) * t;
          img.style.opacity = '1';
          img.style.transform = `translate(${endX}px, ${y}px)`;
        }
      }

      if (progress < 1) {
        requestAnimationFrame(() => void tick());
      } else {
        entry.onFinished();
      }
    };

    void tick();
    return () => {
      cancelled = true;
    };
    // entry identity (via id) is stable for the lifetime of one animation run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  return (
    <img
      ref={imgRef}
      src={entry.bitmapIcon.url}
      width={entry.bitmapIcon.size.width}
      height={entry.bitmapIcon.size.height}
      draggable={false}
      alt=""
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        opacity: 0,
        willChange: 'transform',
      }}
    />
  );
}

/**
 * Screen-space marker-animation overlay: a sibling layer sandwiched between
 * the native map view and InfoBubbles (same DOM position both render into).
 * Renders nothing while no animation is in flight.
 */
export function MarkerAnimationLayer({
  entries,
  resolveScreenOffset,
}: {
  entries: MarkerAnimationOverlayEntry[];
  resolveScreenOffset: ResolveScreenOffset;
}) {
  if (entries.length === 0) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {entries.map((entry) => (
        <AnimatedMarkerImage key={entry.id} entry={entry} resolveScreenOffset={resolveScreenOffset} />
      ))}
    </div>
  );
}
