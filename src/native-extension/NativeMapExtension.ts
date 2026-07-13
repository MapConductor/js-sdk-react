import { useContext, useLayoutEffect } from 'react';
import type { MapViewControllerInterface } from '@mapconductor/js-sdk-core';
import { MapContext } from '../MapContext';

export interface NativeMapExtensionDescriptor {
  readonly id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

export interface NativeMapExtensionEvent {
  readonly extensionId: string;
  readonly eventName: string;
  readonly payload: Record<string, unknown>;
}

export type NativeMapExtensionEventHandler = (event: NativeMapExtensionEvent) => void;

export interface NativeMapExtensionCapable extends MapViewControllerInterface {
  upsertNativeMapExtension(
    extension: NativeMapExtensionDescriptor,
    eventHandler?: NativeMapExtensionEventHandler | null,
  ): void;
  removeNativeMapExtension(extensionId: string): void;
}

export function isNativeMapExtensionCapable(
  controller: MapViewControllerInterface | null,
): controller is NativeMapExtensionCapable {
  if (controller == null) return false;
  const candidate = controller as Partial<NativeMapExtensionCapable>;
  return typeof candidate.upsertNativeMapExtension === 'function' &&
    typeof candidate.removeNativeMapExtension === 'function';
}

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
