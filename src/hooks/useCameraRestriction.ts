import { useEffect } from 'react';
import {
  resolveCameraRestriction,
  type CameraRestriction,
  type GeoRectBounds,
  type MapViewControllerInterface,
} from '@mapconductor/js-sdk-core';

export interface CameraRestrictionProps {
  cameraRestriction?: CameraRestriction | null;
  /** 旧来の個別 prop。`cameraRestriction` が指定されていればそちらが優先される。 */
  restrictBounds?: GeoRectBounds | null;
  minZoom?: number | null;
  maxZoom?: number | null;
}

/**
 * カメラの可動範囲制限をコントローラへ適用し、prop の変化に追随させる。
 *
 * これ以前は各 react-for-* がマップ生成時の config にだけ `restrictBounds` を渡しており、
 * 実行時に変更できなかった（examples/basic の MapViewContainer が restrictBounds のときだけ
 * 専用のマップインスタンスを立てていたのはこのため）。android-sdk は
 * `MapViewControllerInterface.setCameraRestriction` で実行時に変更できるので、それに揃える。
 *
 * `setCameraRestriction` は optional なので、未対応プロバイダでは何も起きない
 * （android-sdk のデフォルト実装が空なのと同じ）。
 */
export function useCameraRestriction(
  controller: MapViewControllerInterface | null,
  props: CameraRestrictionProps,
): void {
  const { cameraRestriction, restrictBounds, minZoom, maxZoom } = props;

  useEffect(() => {
    if (!controller?.setCameraRestriction) return;
    controller.setCameraRestriction(
      resolveCameraRestriction({ cameraRestriction, restrictBounds, minZoom, maxZoom }),
    );
  }, [controller, cameraRestriction, restrictBounds, minZoom, maxZoom]);
}
