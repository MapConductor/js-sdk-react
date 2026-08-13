import type React from 'react';
import { MapViewHolderBase } from '@mapconductor/js-sdk-core';
import type { GeoPoint, Offset } from '@mapconductor/js-sdk-core';

/**
 * React Native の全プロバイダで共有するホルダー。
 *
 * RN では投影をすべてネイティブ側で行い、必要な画面座標は
 * `onMarkerScreenPositions` / `onInfoBubbleScreenPositions` としてイベントで届く。
 * そのため JS 側の投影は常に「持たない」を返す（capability としても
 * `useNativeCapabilityDeclarations` が `screenProjectionSync` を非対応と宣言する）。
 *
 * `map` が null なのは、ネイティブの地図インスタンスが JS から触れないため。
 * ネイティブビューへの参照だけが `mapView` として取れる。
 */
export class ReactNativeMapViewHolder<ViewRef> extends MapViewHolderBase<ViewRef | null, null> {
  readonly map = null;

  constructor(private readonly nativeRef: React.RefObject<ViewRef | null>) {
    super();
  }

  get mapView(): ViewRef | null {
    return this.nativeRef.current;
  }

  toScreenOffset(_position: GeoPoint): null {
    return null;
  }

  fromScreenOffsetSync(_offset: Offset): GeoPoint | null {
    return null;
  }
}
