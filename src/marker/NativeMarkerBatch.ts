import type { MarkerIcon, MarkerState } from '@mapconductor/js-sdk-core';
import { markerIconToNative, type NativeMarkerIconPayload } from './ReactNativeImageIcon';

/**
 * Compressed wire format for compositionMarkers(): structure-of-arrays instead of one object
 * per marker, and icons deduplicated into a dictionary. For a marker set in the thousands this
 * cuts payload size and native-side JNI parsing cost by an order of magnitude compared to
 * `NativeMapLibreMarkerState[]`, since large marker sets overwhelmingly share a small number of
 * distinct icons and are dominated by per-marker object/map overhead rather than actual data.
 */
export interface NativeMarkerBatchPayload {
  ids: string[];
  /** Interleaved [lat0, lng0, alt0, lat1, lng1, alt1, ...], length === ids.length * 3. */
  positions: number[];
  clickable: boolean[];
  draggable: boolean[];
  zIndex: number[];
  /** Index into the shared composition registry (or local `icons`), or -1 for no icon. */
  iconIndex: number[];
  animation: Array<string | null>;
  /** Present for standalone batches; omitted when a composition-level registry is used. */
  icons?: NativeMarkerIconPayload[];
}

export interface NativeMarkerIconRegistry {
  icons: NativeMarkerIconPayload[];
  iconIndexByReference: Map<MarkerIcon, number>;
  iconIndexByKey: Map<string, number>;
}

/** Keeps bridge decoding bounded and matches the native Android ingestion protocol. */
export const NATIVE_MARKER_BATCH_SIZE = 500;

export function createNativeMarkerIconRegistry(states: MarkerState[]): NativeMarkerIconRegistry {
  const registry: NativeMarkerIconRegistry = {
    icons: [],
    iconIndexByReference: new Map<MarkerIcon, number>(),
    iconIndexByKey: new Map<string, number>(),
  };

  states.forEach((state) => {
    nativeMarkerIconIndex(state.icon, registry, true);
  });
  return registry;
}

export function encodeMarkerBatch(
  states: MarkerState[],
  sharedRegistry?: NativeMarkerIconRegistry
): NativeMarkerBatchPayload {
  const registry: NativeMarkerIconRegistry = sharedRegistry ?? {
    icons: [],
    iconIndexByReference: new Map<MarkerIcon, number>(),
    iconIndexByKey: new Map<string, number>(),
  };

  const ids: string[] = new Array(states.length);
  const positions: number[] = new Array(states.length * 3);
  const clickable: boolean[] = new Array(states.length);
  const draggable: boolean[] = new Array(states.length);
  const zIndex: number[] = new Array(states.length);
  const iconIndex: number[] = new Array(states.length);
  const animation: Array<string | null> = new Array(states.length);

  states.forEach((state, i) => {
    ids[i] = state.id;
    positions[i * 3] = state.position.latitude;
    positions[i * 3 + 1] = state.position.longitude;
    positions[i * 3 + 2] = state.position.altitude ?? 0;
    clickable[i] = state.clickable;
    draggable[i] = state.draggable;
    zIndex[i] = state.zIndex;
    animation[i] = state.animation;

    iconIndex[i] = nativeMarkerIconIndex(state.icon, registry, !sharedRegistry);
  });

  const payload: NativeMarkerBatchPayload = {
    ids,
    positions,
    clickable,
    draggable,
    zIndex,
    iconIndex,
    animation,
  };
  if (!sharedRegistry) payload.icons = registry.icons;
  return payload;
}

function nativeMarkerIconIndex(
  markerIcon: MarkerIcon | null,
  registry: NativeMarkerIconRegistry,
  allowRegistration: boolean
): number {
  if (markerIcon != null) {
    const referenceIndex = registry.iconIndexByReference.get(markerIcon);
    if (referenceIndex !== undefined) return referenceIndex;
  }

  const iconPayload = markerIconToNative(markerIcon);
  if (iconPayload == null) return -1;

  const key = JSON.stringify(iconPayload);
  let index = registry.iconIndexByKey.get(key);
  if (index === undefined) {
    if (!allowRegistration) return -1;
    index = registry.icons.length;
    registry.icons.push(iconPayload);
    registry.iconIndexByKey.set(key, index);
  }
  if (markerIcon != null) registry.iconIndexByReference.set(markerIcon, index);
  return index;
}
