import { useEffect, useId, type ReactNode } from 'react';
import { DrawInfoBubble } from './DrawInfoBubble.native';
import { useMapViewScope } from '../MapViewScope.native';
import type { InfoBubbleEntry } from './InfoBubbleEntry';
import type { GeoPoint, MarkerState, Offset } from '@mapconductor/js-sdk-core';

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
    const buildEntry = (): InfoBubbleEntry => ({
      id: marker.id,
      markerId: marker.id,
      positionProvider: () => marker.position,
      icon: marker.icon,
      tailOffset: { x: 0.5, y: 1.0 },
      content,
    });
    bubbleCollector.add(buildEntry());
    // marker.position/icon can change in place - e.g. a native drag callback mutates the same
    // MarkerState object rather than creating a new one - which the [marker] effect dependency
    // below won't observe. Re-adding on every fingerprint tick renotifies InfoBubbleLayer so it
    // recomputes the bubble's screen position from the marker's current position.
    const unsubscribe = marker.asObservable().subscribe(() => {
      bubbleCollector.add(buildEntry());
    });
    return () => {
      unsubscribe();
      bubbleCollector.remove(marker.id);
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
      markerId: null,
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
    const buildEntry = (): InfoBubbleEntry => ({
      id: marker.id,
      markerId: marker.id,
      positionProvider: () => marker.position,
      icon: marker.icon,
      tailOffset,
      content: children,
    });
    bubbleCollector.add(buildEntry());
    // See InfoBubble's identical effect above: re-add on every fingerprint tick so a native
    // drag (which mutates the same MarkerState object in place) still updates the bubble.
    const unsubscribe = marker.asObservable().subscribe(() => {
      bubbleCollector.add(buildEntry());
    });
    return () => {
      unsubscribe();
      bubbleCollector.remove(marker.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marker, tailOffset]);

  return null;
}
