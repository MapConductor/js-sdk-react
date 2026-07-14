import { NativeModules } from 'react-native';
import type { MarkerState } from '@mapconductor/js-sdk-core';

/**
 * JS side of the JSI bridge installed by MarkerScaleBridgeModule (see
 * OnLoad.cpp / MarkerScaleBridge.cpp in js-sdk-react/android). Native
 * marker-tiling code calls `__mapconductorRegisterIconScaleCallback`'s
 * registered function synchronously, from a background thread, to resolve
 * `MarkerTilingOptions.iconScaleCallback` for a given (markerId, zoom).
 *
 * Touching the module here (module-load time) forces it to be created and
 * initialize() to run as early as possible, since nothing else in JS ever
 * calls a method on it — it exists purely to install the globals below.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
NativeModules.MapConductorMarkerScaleBridge;

declare const global: {
  __mapconductorRegisterIconScaleCallback?: (
    viewId: number,
    callback: (markerId: string, zoom: number) => number
  ) => void;
  __mapconductorUnregisterIconScaleCallback?: (viewId: number) => void;
};

export function registerIconScaleCallback(
  viewId: number,
  iconScaleCallback: (state: MarkerState, zoom: number) => number,
  lookupState: (markerId: string) => MarkerState | undefined
): void {
  console.log(
    '[MarkerScaleBridge] registerIconScaleCallback viewId=',
    viewId,
    'installed=',
    typeof global.__mapconductorRegisterIconScaleCallback === 'function'
  );
  let loggedCalls = 0;
  global.__mapconductorRegisterIconScaleCallback?.(viewId, (markerId, zoom) => {
    const state = lookupState(markerId);
    const result = state ? iconScaleCallback(state, zoom) : 1.0;
    if (loggedCalls < 20) {
      loggedCalls++;
      console.log(
        '[MarkerScaleBridge] JS callback invoked markerId=',
        markerId,
        'zoom=',
        zoom,
        'hasState=',
        !!state,
        '-> ',
        result
      );
    }
    return result;
  });
}

export function unregisterIconScaleCallback(viewId: number): void {
  global.__mapconductorUnregisterIconScaleCallback?.(viewId);
}
