import React, { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  resolveAttributionRules,
  resolveRasterAttributions,
  type AttributionRule,
  type MapCameraPosition,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import type { MapViewScope } from './MapViewScope.native';

export interface MapAttributionOverlayProps {
  scope: MapViewScope;
  camera: MapCameraPosition;
  designAttributionRules?: readonly AttributionRule[];
  style?: StyleProp<ViewStyle>;
}

interface AttributionPart {
  text: string;
  href?: string;
}

export function MapAttributionOverlay({
  scope,
  camera,
  designAttributionRules = [],
  style,
}: MapAttributionOverlayProps) {
  const [states, setStates] = useState<RasterLayerState[]>(() =>
    scope.rasterLayerCollector.values()
  );
  const [stateRevision, setStateRevision] = useState(0);

  useEffect(() => {
    let stateSubscriptions: Array<() => void> = [];
    const unsubscribeCollector = scope.rasterLayerCollector.subscribe((map) => {
      stateSubscriptions.forEach((unsubscribe) => unsubscribe());
      const nextStates = Array.from(map.values());
      stateSubscriptions = nextStates.map((state) =>
        state.asObservable().subscribe(() => setStateRevision((value) => value + 1))
      );
      setStates(nextStates);
    });

    return () => {
      unsubscribeCollector();
      stateSubscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [scope]);

  const attributions = useMemo(() => {
    // The raster states are mutable objects; this revision invalidates the
    // calculation when one emits without replacing its object reference.
    void stateRevision;
    const resolved = [
      ...resolveAttributionRules(designAttributionRules, camera),
      ...resolveRasterAttributions(
        states.filter((state) => state.visible).map((state) => state.source),
        camera
      ),
    ];
    return Array.from(new Set(resolved));
  }, [camera, designAttributionRules, stateRevision, states]);

  if (attributions.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.position, style]}>
      <Text accessibilityRole="text" style={styles.text}>
        {attributions.map((attribution, attributionIndex) => (
          <React.Fragment key={attribution}>
            {attributionIndex > 0 ? ' | ' : null}
            {parseAttribution(attribution).map((part, partIndex) =>
              part.href ? (
                <Text
                  key={`${partIndex}:${part.href}`}
                  accessibilityRole="link"
                  style={styles.link}
                  onPress={() => void Linking.openURL(part.href!)}
                >
                  {part.text}
                </Text>
              ) : (
                <React.Fragment key={partIndex}>{part.text}</React.Fragment>
              )
            )}
          </React.Fragment>
        ))}
      </Text>
    </View>
  );
}

function parseAttribution(html: string): AttributionPart[] {
  const parts: AttributionPart[] = [];
  const anchorPattern = /<a\s+[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let offset = 0;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) != null) {
    appendPlainText(parts, html.slice(offset, match.index));
    const href = decodeHtmlEntities(match[2]);
    const text = decodeHtmlEntities(stripTags(match[3]));
    if (text) parts.push({ text, href });
    offset = match.index + match[0].length;
  }
  appendPlainText(parts, html.slice(offset));
  return parts;
}

function appendPlainText(parts: AttributionPart[], value: string): void {
  const text = decodeHtmlEntities(stripTags(value));
  if (text) parts.push({ text });
}

function stripTags(value: string): string {
  return value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    copy: '©',
    gt: '>',
    lt: '<',
    nbsp: '\u00a0',
    quot: '"',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return namedEntities[name.toLowerCase()] ?? entity;
  });
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    right: 4,
    bottom: 24,
    zIndex: 1000,
    elevation: 6,
    maxWidth: '98%',
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  text: {
    color: '#222222',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'right',
  },
  link: {
    color: '#075ea8',
    textDecorationLine: 'underline',
  },
});
