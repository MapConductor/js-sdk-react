import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Offset } from '@mapconductor/js-sdk-core';
import type { MapViewScope } from '../MapViewScope.native';
import type { InfoBubbleEntry } from './InfoBubbleEntry';
import { InfoBubbleOverlay } from './InfoBubbleOverlay.native';

export type MarkerScreenPositionMap = ReadonlyMap<string, Offset>;
export type InfoBubbleScreenPositionMap = ReadonlyMap<string, Offset>;
export interface InfoBubblePositionRequest {
  id: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
}

export function InfoBubbleLayer({
  scope,
  markerScreenPositions,
  infoBubbleScreenPositions,
  onPositionRequestsChange,
}: {
  scope: MapViewScope;
  markerScreenPositions: MarkerScreenPositionMap;
  infoBubbleScreenPositions: InfoBubbleScreenPositionMap;
  onPositionRequestsChange?: (positions: InfoBubblePositionRequest[]) => void;
}) {
  const [entries, setEntries] = useState<InfoBubbleEntry[]>([]);

  useEffect(() => {
    return scope.bubbleCollector.subscribe((map) => setEntries(Array.from(map.values())));
  }, [scope]);

  const positionRequests = useMemo(
    () =>
      entries.map((entry) => {
        const position = entry.positionProvider();
        return {
          id: entry.id,
          latitude: position.latitude,
          longitude: position.longitude,
          altitude: position.altitude ?? null,
        };
      }),
    [entries]
  );

  useEffect(() => {
    onPositionRequestsChange?.(positionRequests);
  }, [onPositionRequestsChange, positionRequests]);

  if (entries.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {entries.map((entry) => {
        const markerId = entry.markerId ?? entry.id;
        const offset = infoBubbleScreenPositions.get(entry.id) ?? markerScreenPositions.get(markerId);
        if (!offset) return null;
        const iconSizeValue = entry.icon ? entry.icon.iconSize * entry.icon.scale : 0;
        const iconOffset = entry.icon?.anchor ?? { x: 0.5, y: 0.5 };
        const infoAnchorOffset = entry.icon?.infoAnchor ?? { x: 0.5, y: 0.5 };

        return (
          <InfoBubbleOverlay
            key={entry.id}
            positionOffset={offset}
            iconSize={{ width: iconSizeValue, height: iconSizeValue }}
            iconOffset={iconOffset}
            infoAnchorOffset={infoAnchorOffset}
            tailOffset={entry.tailOffset}
            style={styles.bubble}
          >
            {entry.content}
          </InfoBubbleOverlay>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    maxWidth: 260,
  },
});
