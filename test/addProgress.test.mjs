import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createCircleState, createGeoPoint, notifyOverlaysAdded, OverlayCollector, subscribeOverlaysAdded } from '@mapconductor/js-sdk-core';
import { AddProgressTracker } from '../src/AddProgress.ts';
import { OwnedOverlays } from '../src/OwnedOverlays.ts';

/**
 * `<Markers>` / `<Circles>` / `<Polylines>` / `<Polygons>` の onAddStart / onAddProgress / onAddEnd
 * （src/AddProgress.ts）。
 *
 * - 地図に未だ無い state を持ち込んだリストで onAddStart(total)。
 * - 各 state の onAdded と同じ時点で 1 つ数える。途中経過は 100 ms に 1 回まで。
 * - 全部載ったら onAddProgress(total, total) と onAddEnd(total)。
 * - 載る前に外された state は数から抜ける。新しい追加は数え直し、前のリストの onAddEnd は来ない。
 * - 更新・削除だけのリストは何も呼ばない。他のコレクションの state は数えない。
 */

const p = (latitude, longitude) => createGeoPoint({ latitude, longitude });
const circle = (id) => createCircleState({ id, center: p(42.35, -71.06), radiusMeters: 5 });

function setUp() {
  const calls = [];
  let clock = 1000;
  const tracker = new AddProgressTracker(
    () => ({
      onAddStart: (total) => calls.push(['start', total]),
      onAddProgress: (added, total) => calls.push(['progress', added, total]),
      onAddEnd: (total) => calls.push(['end', total]),
    }),
    () => clock,
  );
  const owned = new OwnedOverlays(new OverlayCollector(), () => {});
  const set = (states) => {
    const { added, removedIds } = owned.set(states);
    tracker.track(added, removedIds);
  };
  return { calls, tracker, set, advance: (ms) => (clock += ms) };
}

test('全部載ったら start → progress(total) → end', () => {
  const { calls, tracker, set } = setUp();
  const states = [circle('a'), circle('b'), circle('c')];
  set(states);
  assert.deepEqual(calls, [['start', 3]]);
  tracker.arrived([states[0]]);
  tracker.arrived([states[1], states[2]]);
  assert.deepEqual(calls, [['start', 3], ['progress', 1, 3], ['progress', 3, 3], ['end', 3]]);
});

test('途中経過は 100 ms に 1 回まで', async () => {
  const { calls, tracker, set, advance } = setUp();
  const states = Array.from({ length: 5 }, (_, i) => circle(`s${i}`));
  set(states);
  advance(1000);
  tracker.arrived([states[0]]); // emits now
  tracker.arrived([states[1]]); // throttled
  tracker.arrived([states[2]]); // throttled
  assert.deepEqual(calls.slice(1), [['progress', 1, 5]]);
  advance(100);
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(calls.slice(1), [['progress', 1, 5], ['progress', 3, 5]]);
  tracker.arrived([states[3], states[4]]);
  assert.deepEqual(calls.at(-1), ['end', 5]);
});

test('載る前に外された state は数から抜け、残りが載れば終わる', () => {
  const { calls, tracker, set } = setUp();
  const [a, b, c] = [circle('a'), circle('b'), circle('c')];
  set([a, b, c]);
  tracker.arrived([a]);
  set([a, b]); // c removed before it arrived
  tracker.arrived([b]);
  assert.deepEqual(calls.slice(-2), [['progress', 2, 2], ['end', 2]]);
});

test('残りを全部外せば、その場で終わる', () => {
  const { calls, tracker, set } = setUp();
  const [a, b] = [circle('a'), circle('b')];
  set([a, b]);
  tracker.arrived([a]);
  set([a]);
  assert.deepEqual(calls.slice(-2), [['progress', 1, 1], ['end', 1]]);
});

test('追加の途中で新しい追加が来たら数え直し、前のリストの end は来ない', () => {
  const { calls, tracker, set } = setUp();
  const [a, b, c] = [circle('a'), circle('b'), circle('c')];
  set([a, b]);
  set([a, b, c]); // only c is new
  assert.deepEqual(calls, [['start', 2], ['start', 1]]);
  tracker.arrived([a, b]); // from the earlier list: no longer counted
  tracker.arrived([c]);
  assert.deepEqual(calls.slice(2), [['progress', 1, 1], ['end', 1]]);
});

test('更新・削除だけのリストと、他のコレクションの state では何も呼ばない', () => {
  const { calls, tracker, set } = setUp();
  const [a, b] = [circle('a'), circle('b')];
  set([a, b]);
  tracker.arrived([a, b]);
  calls.length = 0;
  set([circle('a')]); // a updated in place, b removed
  tracker.arrived([circle('other')]);
  assert.deepEqual(calls, []);
});

test('notifyOverlaysAdded は購読者に state をそのまま渡し、解除後は渡さない', () => {
  const seen = [];
  const unsubscribe = subscribeOverlaysAdded((states) => seen.push(states));
  const a = circle('a');
  notifyOverlaysAdded([a]);
  notifyOverlaysAdded([]);
  unsubscribe();
  notifyOverlaysAdded([a]);
  assert.equal(seen.length, 1);
  assert.equal(seen[0][0], a);
});
