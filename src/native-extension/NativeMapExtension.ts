import { useContext, useLayoutEffect } from 'react';
import {
  isNativeMapExtensionCapable,
  type NativeMapExtensionDescriptor,
  type NativeMapExtensionEventHandler,
} from '@mapconductor/js-sdk-core';
import { MapContext } from '../MapContext';

export {
  isNativeMapExtensionCapable,
  type NativeMapExtensionCapable,
  type NativeMapExtensionDescriptor,
  type NativeMapExtensionEvent,
  type NativeMapExtensionEventHandler,
} from '@mapconductor/js-sdk-core';

export function useNativeMapExtension(
  extension: NativeMapExtensionDescriptor,
  eventHandler?: NativeMapExtensionEventHandler | null,
): void {
  const mapContext = useContext(MapContext);
  const controller = mapContext?.controller ?? null;
  const isReady = mapContext?.isReady ?? false;

  useLayoutEffect(() => {
    if (!isReady) return;
    if (!isNativeMapExtensionCapable(controller)) {
      if (controller != null) {
        console.warn(
          `[MapConductor] Native map extensions are not supported by this provider: ${extension.type}`,
        );
      }
      return;
    }

    controller.upsertNativeMapExtension(extension, eventHandler);
  }, [controller, eventHandler, extension, isReady]);

  useLayoutEffect(() => {
    if (!isNativeMapExtensionCapable(controller)) return undefined;
    const extensionId = extension.id;
    return () => controller.removeNativeMapExtension(extensionId);
  }, [controller, extension.id]);
}
