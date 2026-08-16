import assert from 'node:assert/strict';
import { test } from 'node:test';

// TypeScript のまま読む（Node 24 の型ストリップ）。`dist/internal.native.mjs` は
// `react-native` を巻き込み、あれは Flow なので Node では構文エラーになる。
import {
  toNativeCameraPosition,
  toNativeMarkerTilingOptions,
} from '../src/native-bridge/nativePayloads.ts';

/**
 * RN ブリッジへ渡すペイロードの変換。
 *
 * ## なぜここを固定するか
 *
 * この 2 関数は **RN プロバイダ 8 本すべてが通る共通層**にある。以前はプロバイダごとに
 * 写しを持っていて、値の落とし方に差が出ていた。壊れても TypeScript は通り、地図も
 * 描けてしまうので、**気づけるのは実機で「なぜかタイリングが効かない」を踏んだとき**
 * になる。ここで形を固定しておく。
 */

test('toNativeCameraPosition: altitude 未指定は 0 に倒す', () => {
  const native = toNativeCameraPosition({
    position: { latitude: 35.681, longitude: 139.767 },
    zoom: 12,
    bearing: 30,
    tilt: 45,
  });

  // ネイティブ側（Kotlin / Swift）は altitude が数値必須。null を渡すと
  // ブリッジのデコードで落ちるか、0 と解釈されるかがプロバイダ依存になる。
  assert.equal(native.position.altitude, 0);
  assert.equal(native.position.latitude, 35.681);
  assert.equal(native.position.longitude, 139.767);
  assert.equal(native.zoom, 12);
  assert.equal(native.bearing, 30);
  assert.equal(native.tilt, 45);
});

test('toNativeCameraPosition: altitude があればそのまま通す', () => {
  const native = toNativeCameraPosition({
    position: { latitude: 0, longitude: 0, altitude: 1234.5 },
    zoom: 3,
    bearing: 0,
    tilt: 0,
  });
  assert.equal(native.position.altitude, 1234.5);
});

test('toNativeCameraPosition: undefined は undefined のまま', () => {
  assert.equal(toNativeCameraPosition(undefined), undefined);
});

test('toNativeMarkerTilingOptions: iconScaleCallback は「有無」だけを送る', () => {
  // JS の関数はブリッジを越えられない。実際の倍率はネイティブ側が JSI 経由で
  // JS へ問い合わせるので、ここで送るのは真偽値だけ。**関数そのものを載せると
  // ブリッジのシリアライズで静かに落ちる。**
  const withCallback = toNativeMarkerTilingOptions({
    enabled: true,
    debugTileOverlay: false,
    minMarkerCount: 500,
    cacheSize: 64,
    iconScaleCallback: () => 1,
  });
  assert.equal(withCallback.hasIconScaleCallback, true);
  assert.equal('iconScaleCallback' in withCallback, false);

  const withoutCallback = toNativeMarkerTilingOptions({
    enabled: true,
    debugTileOverlay: false,
    minMarkerCount: 500,
    cacheSize: 64,
  });
  assert.equal(withoutCallback.hasIconScaleCallback, false);
});

test('toNativeMarkerTilingOptions: enabled=false でも件数設定は落とさない', () => {
  // タイリングの判定はネイティブ側が `enabled && count >= minMarkerCount` で行う。
  // ここで minMarkerCount を落とすと、判定が「常に真」に倒れて全マーカーが
  // タイル経路へ落ちる（android-for-longdo / android-for-maptiler が踏んだ形）。
  const native = toNativeMarkerTilingOptions({
    enabled: false,
    debugTileOverlay: true,
    minMarkerCount: 1000,
    cacheSize: 16,
  });
  assert.equal(native.enabled, false);
  assert.equal(native.debugTileOverlay, true);
  assert.equal(native.minMarkerCount, 1000);
  assert.equal(native.cacheSize, 16);
});

test('toNativeMarkerTilingOptions: undefined は undefined のまま', () => {
  assert.equal(toNativeMarkerTilingOptions(undefined), undefined);
});
