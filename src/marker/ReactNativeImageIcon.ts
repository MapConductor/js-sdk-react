import type { MarkerIcon, Offset, BitmapIcon } from '@mapconductor/js-sdk-core';
import { ColorDefaultIcon, combineHash, hashBool, hashNum, hashStr } from '@mapconductor/js-sdk-core';
import { Settings } from '@mapconductor/js-sdk-core';

export interface ReactNativeImageIconOptions {
  iconSize?: number;
  scale?: number;
  anchor?: Offset;
  infoAnchor?: Offset;
  debug?: boolean;
}

export interface ReactNativeImageDefaultIconOptions {
  strokeColor?: string;
  strokeWidth?: number;
  scale?: number;
  label?: string | null;
  labelTextColor?: string | null;
  labelTextSize?: number;
  labelStrokeColor?: string;
  infoAnchor?: Offset;
  iconSize?: number;
  debug?: boolean;
}

export class ReactNativeImageIcon implements MarkerIcon {
  readonly iconSize: number;
  readonly scale: number;
  readonly anchor: Offset;
  readonly infoAnchor: Offset;
  readonly debug: boolean;

  constructor(
    readonly uri: string,
    options: ReactNativeImageIconOptions = {},
  ) {
    this.iconSize = options.iconSize ?? Settings.Default.iconSize;
    this.scale = options.scale ?? 1;
    this.anchor = options.anchor ?? { x: 0.5, y: 0.5 };
    this.infoAnchor = options.infoAnchor ?? { x: 0.5, y: 0.5 };
    this.debug = options.debug ?? false;
  }

  hashCode(): number {
    let result = hashStr(this.uri);
    result = combineHash(result, hashNum(this.iconSize));
    result = combineHash(result, hashNum(this.scale));
    result = combineHash(result, hashNum(this.anchor.x));
    result = combineHash(result, hashNum(this.anchor.y));
    result = combineHash(result, hashNum(this.infoAnchor.x));
    result = combineHash(result, hashNum(this.infoAnchor.y));
    result = combineHash(result, hashBool(this.debug));
    return result;
  }

  toBitmapIcon(): BitmapIcon {
    throw new Error('ReactNativeImageIcon is rendered by native React Native providers.');
  }
}

export class ReactNativeImageDefaultIcon implements MarkerIcon {
  readonly strokeColor: string;
  readonly strokeWidth: number;
  readonly scale: number;
  readonly label: string | null;
  readonly labelTextColor: string | null;
  readonly labelTextSize: number;
  readonly labelStrokeColor: string;
  readonly iconSize: number;
  readonly anchor: Offset = { x: 0.5, y: 1 };
  readonly infoAnchor: Offset;
  readonly debug: boolean;

  constructor(
    readonly uri: string,
    options: ReactNativeImageDefaultIconOptions = {},
  ) {
    this.strokeColor = options.strokeColor ?? '#ffffff';
    this.strokeWidth = options.strokeWidth ?? 1;
    this.scale = options.scale ?? 1;
    this.label = options.label ?? null;
    this.labelTextColor = options.labelTextColor ?? '#000000';
    this.labelTextSize = options.labelTextSize ?? 18;
    this.labelStrokeColor = options.labelStrokeColor ?? '#ffffff';
    this.infoAnchor = options.infoAnchor ?? { x: 0.5, y: 0 };
    this.iconSize = options.iconSize ?? Settings.Default.iconSize;
    this.debug = options.debug ?? false;
  }

  hashCode(): number {
    let result = hashStr(this.uri);
    result = combineHash(result, hashStr(this.strokeColor));
    result = combineHash(result, hashNum(this.strokeWidth));
    result = combineHash(result, hashNum(this.scale));
    result = combineHash(result, hashStr(this.label ?? ''));
    result = combineHash(result, hashStr(this.labelTextColor ?? ''));
    result = combineHash(result, hashNum(this.labelTextSize));
    result = combineHash(result, hashStr(this.labelStrokeColor));
    result = combineHash(result, hashNum(this.infoAnchor.x));
    result = combineHash(result, hashNum(this.infoAnchor.y));
    result = combineHash(result, hashNum(this.iconSize));
    result = combineHash(result, hashBool(this.debug));
    return result;
  }

  toBitmapIcon(): BitmapIcon {
    throw new Error('ReactNativeImageDefaultIcon is rendered by native React Native providers.');
  }
}

export function isReactNativeImageIcon(icon: MarkerIcon | null): icon is ReactNativeImageIcon {
  return icon instanceof ReactNativeImageIcon;
}

export function isReactNativeImageDefaultIcon(
  icon: MarkerIcon | null
): icon is ReactNativeImageDefaultIcon {
  return icon instanceof ReactNativeImageDefaultIcon;
}

export interface NativeMarkerIconPayload {
  type: 'image' | 'imageDefault' | 'colorDefault';
  uri?: string;
  fillColor?: string;
  iconSize: number;
  scale: number;
  infoAnchor: Offset;
  debug: boolean;
  anchor?: Offset;
  strokeColor?: string;
  strokeWidth?: number;
  label?: string | null;
  labelTextColor?: string | null;
  labelTextSize?: number;
  labelStrokeColor?: string;
}

export function markerIconToNative(icon: MarkerIcon | null): NativeMarkerIconPayload | null {
  if (icon instanceof ColorDefaultIcon) {
    return {
      type: 'colorDefault',
      fillColor: icon.fillColor,
      strokeColor: icon.strokeColor,
      strokeWidth: icon.strokeWidth,
      scale: icon.scale,
      label: icon.label,
      labelTextColor: icon.labelTextColor,
      labelTextSize: icon.labelTextSize,
      labelStrokeColor: icon.labelStrokeColor,
      infoAnchor: icon.infoAnchor,
      iconSize: icon.iconSize,
      debug: icon.debug,
    };
  }
  if (isReactNativeImageIcon(icon)) {
    return {
      type: 'image',
      uri: icon.uri,
      iconSize: icon.iconSize,
      scale: icon.scale,
      anchor: icon.anchor,
      infoAnchor: icon.infoAnchor,
      debug: icon.debug,
    };
  }
  if (isReactNativeImageDefaultIcon(icon)) {
    return {
      type: 'imageDefault',
      uri: icon.uri,
      strokeColor: icon.strokeColor,
      strokeWidth: icon.strokeWidth,
      scale: icon.scale,
      label: icon.label,
      labelTextColor: icon.labelTextColor,
      labelTextSize: icon.labelTextSize,
      labelStrokeColor: icon.labelStrokeColor,
      infoAnchor: icon.infoAnchor,
      iconSize: icon.iconSize,
      debug: icon.debug,
    };
  }
  return null;
}
