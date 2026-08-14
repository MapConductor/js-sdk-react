import {
  WebMercator,
  WEB_MERCATOR_MAX_EXTENT_METERS,
  type GeoPointInterface,
  type MapCameraPosition,
} from '@mapconductor/js-sdk-core';

/** ビューの大きさ（dp）。RN の `onLayout` から取る。 */
export interface ViewportSize {
  width: number;
  height: number;
}

/** 画面座標（dp）。左上が原点。 */
export interface ScreenOffset {
  x: number;
  y: number;
}

/** 統一ズーム 0 のときの世界の大きさ（px）。統一ズームは Google 基準の 256px タイル。 */
const WORLD_SIZE_AT_ZOOM_0 = 256;

/**
 * 地理座標 → 画面座標を **JS 側で** 計算する。
 *
 * ## なぜ要るのか
 *
 * RN の InfoBubble とマーカー追従は画面座標で描くが、その座標はこれまで
 * すべてネイティブ側（`MapViewHolder.toScreenOffset`）から来ていた。
 * ところが **WebView ベースのプロバイダは同期投影を持たない**
 * （Longdo Android / MapTiler Android は `toScreenOffset` が null を返す）。
 * その結果 RN では InfoBubble もマーカー追従も出ない。
 *
 * 地図が Web Mercator なら投影はカメラとビューの大きさだけで決まるので、
 * ネイティブに頼らず JS で計算できる。**プロバイダ非依存**なのでここに置く。
 *
 * ## 使えない条件
 *
 * - **Web Mercator でない地図**（3D globe の HERE、球面の Cesium 等）。
 *   これらはネイティブの投影を使うこと。
 * - **tilt が 0 でないとき。** 傾いたカメラは平面の相似変換にならないため
 *   誤差が出る。tilt を持つプロバイダはネイティブ投影を使うこと。
 *   （必要になったら `visibleRegion` の 4 隅からホモグラフィを組む方式へ拡張できる。
 *   平面地図なら透視投影はホモグラフィそのものなので厳密に扱える。）
 *
 * bearing（回転）には対応している。
 */
export function createWebMercatorScreenProjection(
  camera: MapCameraPosition,
  size: ViewportSize,
): (position: GeoPointInterface) => ScreenOffset | null {
  const worldSize = WORLD_SIZE_AT_ZOOM_0 * Math.pow(2, camera.zoom);
  const center = normalize(camera.position);
  const bearingRadians = (camera.bearing * Math.PI) / 180;
  const cos = Math.cos(bearingRadians);
  const sin = Math.sin(bearingRadians);

  return (position: GeoPointInterface): ScreenOffset | null => {
    if (size.width <= 0 || size.height <= 0) return null;
    if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) return null;

    const point = normalize(position);

    // 日付変更線をまたぐときは短いほうへ回す。これをしないと地図の反対側へ飛ぶ。
    let deltaX = point.x - center.x;
    if (deltaX > 0.5) deltaX -= 1;
    else if (deltaX < -0.5) deltaX += 1;

    const offsetX = deltaX * worldSize;
    const offsetY = (point.y - center.y) * worldSize;

    // bearing は「画面の上が指す方位（北から時計回り）」。世界を -bearing 回す。
    const rotatedX = offsetX * cos + offsetY * sin;
    const rotatedY = -offsetX * sin + offsetY * cos;

    return {
      x: size.width / 2 + rotatedX,
      y: size.height / 2 + rotatedY,
    };
  };
}

/** Web Mercator のメートル座標を [0,1] へ。y は北が 0。 */
function normalize(position: GeoPointInterface): { x: number; y: number } {
  const projected = WebMercator.project(position);
  const extent = 2 * WEB_MERCATOR_MAX_EXTENT_METERS;
  return {
    x: 0.5 + projected.x / extent,
    y: 0.5 - projected.y / extent,
  };
}
