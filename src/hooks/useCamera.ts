import { useEffect, useCallback } from 'react';
import { useMapViewController } from '../MapContext';
import { type MapCameraPosition, type CameraOptions, type GeoRectBounds } from '@mapconductor/core';

/**
 * Hook for controlling the map camera
 */
export function useCamera() {
  const controller = useMapViewController();

  const moveCamera = useCallback(
    (position: MapCameraPosition): Promise<boolean> => {
      if (!controller) {
        return Promise.reject(new Error('Map controller not available'));
      }
      return controller.moveCamera(position);
    },
    [controller]
  );

  const animateCamera = useCallback(
    (position: MapCameraPosition, options?: CameraOptions): Promise<boolean> => {
      if (!controller) {
        return Promise.reject(new Error('Map controller not available'));
      }
      return controller.animateCamera(position, options);
    },
    [controller]
  );

  const fitBounds = useCallback(
    (bounds: GeoRectBounds, options?: CameraOptions): Promise<boolean> => {
      if (!controller) {
        return Promise.reject(new Error('Map controller not available'));
      }
      return controller.fitBounds(bounds, options);
    },
    [controller]
  );

  const getCameraPosition = useCallback(() => {
    return controller?.getCameraPosition() || null;
  }, [controller]);

  const getBounds = useCallback(() => {
    return controller?.getBounds() || null;
  }, [controller]);

  return {
    moveCamera,
    animateCamera,
    fitBounds,
    getCameraPosition,
    getBounds,
  };
}

/**
 * Hook to automatically update camera position when props change
 */
export function useCameraPosition(position: MapCameraPosition | null) {
  const { moveCamera } = useCamera();

  useEffect(() => {
    if (position) {
      moveCamera(position);
    }
  }, [position, moveCamera]);
}
