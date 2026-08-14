import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebMercatorScreenProjection } from '../dist/native-bridge/WebMercatorScreenProjection.mjs';

const SIZE = { width: 400, height: 800 };
const camera = (overrides = {}) => ({
  position: { latitude: 35.681236, longitude: 139.767125, altitude: 0 },
  zoom: 12,
  bearing: 0,
  tilt: 0,
  visibleRegion: null,
  ...overrides,
});

test('中心はビューの中央に来る', () => {
  const c = camera();
  const project = createWebMercatorScreenProjection(c, SIZE);
  const p = project(c.position);
  assert.ok(Math.abs(p.x - 200) < 1e-6, `x=${p.x}`);
  assert.ok(Math.abs(p.y - 400) < 1e-6, `y=${p.y}`);
});

test('東は右、北は上', () => {
  const c = camera();
  const project = createWebMercatorScreenProjection(c, SIZE);
  const east = project({ ...c.position, longitude: c.position.longitude + 0.05 });
  const north = project({ ...c.position, latitude: c.position.latitude + 0.05 });
  assert.ok(east.x > 200, `east.x=${east.x}`);
  assert.ok(Math.abs(east.y - 400) < 1e-6);
  assert.ok(north.y < 400, `north.y=${north.y}`);
  assert.ok(Math.abs(north.x - 200) < 1e-6);
});

test('ズームが 1 上がると中心からの距離が 2 倍になる', () => {
  const target = { latitude: 35.681236, longitude: 139.8, altitude: 0 };
  const a = createWebMercatorScreenProjection(camera({ zoom: 12 }), SIZE)(target);
  const b = createWebMercatorScreenProjection(camera({ zoom: 13 }), SIZE)(target);
  const ratio = (b.x - 200) / (a.x - 200);
  assert.ok(Math.abs(ratio - 2) < 1e-9, `ratio=${ratio}`);
});

test('bearing=90 では東が上に来る', () => {
  const c = camera({ bearing: 90 });
  const project = createWebMercatorScreenProjection(c, SIZE);
  const east = project({ ...c.position, longitude: c.position.longitude + 0.05 });
  assert.ok(east.y < 400, `east.y=${east.y}`);
  assert.ok(Math.abs(east.x - 200) < 1e-6, `east.x=${east.x}`);
});

test('日付変更線をまたいでも短いほうへ回る', () => {
  const c = camera({ position: { latitude: 0, longitude: 179.9, altitude: 0 }, zoom: 8 });
  const project = createWebMercatorScreenProjection(c, SIZE);
  const across = project({ latitude: 0, longitude: -179.9, altitude: 0 });
  // 0.2 度ぶんだけ右にあるべき。地図の反対側（数万 px）へ飛ばない。
  assert.ok(across.x > 200 && across.x < 400, `x=${across.x}`);
});

test('ビューの大きさが未確定なら null', () => {
  const project = createWebMercatorScreenProjection(camera(), { width: 0, height: 0 });
  assert.equal(project({ latitude: 0, longitude: 0, altitude: 0 }), null);
});
