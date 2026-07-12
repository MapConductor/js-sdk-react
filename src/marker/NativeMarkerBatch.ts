import type { MarkerState } from '@mapconductor/js-sdk-core';
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
  /** Index into `icons`, or -1 when the marker has no icon. */
  iconIndex: number[];
  animation: Array<string | null>;
  icons: NativeMarkerIconPayload[];
}

export function encodeMarkerBatch(states: MarkerState[]): NativeMarkerBatchPayload {
  const icons: NativeMarkerIconPayload[] = [];
  const iconIndexByKey = new Map<string, number>();

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

    const iconPayload = markerIconToNative(state.icon);
    if (iconPayload == null) {
      iconIndex[i] = -1;
      return;
    }
    const key = JSON.stringify(iconPayload);
    let index = iconIndexByKey.get(key);
    if (index === undefined) {
      index = icons.length;
      icons.push(iconPayload);
      iconIndexByKey.set(key, index);
    }
    iconIndex[i] = index;
  });

  return { ids, positions, clickable, draggable, zIndex, iconIndex, animation, icons };
}
