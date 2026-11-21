import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createCircleState, createGeoPoint, notifyOverlaysAdded, OverlayCollector, subscribeOverlaysAdded } from '@mapconductor/js-sdk-core';
import { AddProgressTracker, DRAW_START_DELAY_MS, SETTLE_MS } from '../src/AddProgress.ts';
import { OwnedOverlays } from '../src/OwnedOverlays.ts';

/**
 * `<Markers>` / `<Circles>` / `<Polylines>` / `<Polygons>` の onAddStart / onAddProgress / onAddEnd
 * （src/AddProgress.ts）。android-sdk-compose の `AddProgressTrackerTest`、ios-sdk の
 * `AddProgressTests` と同じ内容。
 *
 * - リストを渡したら onAddStart(total)。total は地図に未だ無い state の数（削除・更新だけなら 0、空のあとの空は何も呼ばない）。
 * - 各 state の onAdded と同じ時点で 1 つ数える。途中経過は 100 ms に 1 回まで。
 * - 全部載り、タイルの描画も止まって 400 ms 静かになったら onAddProgress(total, total) と onAddEnd(total)。
 * - タイルの描画だけ（カメラの移動）は 200 ms 続いたら onAddStart(0)。それより短ければ何も呼ばない。
 * - 載る前に外された state は数から抜ける。新しい追加は数え直し、前のリストの onAddEnd は来ない。
 * - 他のコレクションの state は数えない。
 */

const p = (latitude, longitude) => createGeoPoint({ latitude, longitude });
const circle = (id) => createCircleState({ id, center: p(42.35, -71.06), radiusMeters: 5 });

function setUp() {
  const calls = [];
  let clock = 1000;
  let due = [];
  const timers = {
    set: (callback, ms) => {
      const handle = { at: clock + ms, callback };
      due.push(handle);
      return handle;
    },
    clear: (handle) => { due = due.filter((h) => h !== handle); },
  };
  const tracker = new AddProgressTracker(
    () => ({
      onAddStart: (total) => calls.push(['start', total]),
      onAddProgress: (added, total) => calls.push(['progress', added, total]),
      onAddEnd: (total) => calls.push(['end', total]),
    }),
    () => clock,
    timers,
  );
  const owned = new OwnedOverlays(new OverlayCollector(), () => {});
  const set = (states) => {
    const { added, removedIds } = owned.set(states);
    tracker.track(added, removedIds, owned.size);
  };
  /** Moves the clock, running each timer that comes due on the way. */
  const advance = (ms) => {
    const until = clock + ms;
    for (;;) {
      const next = due.filter((h) => h.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      due = due.filter((h) => h !== next);
      clock = next.at;
      next.callback();
    }
    clock = until;
  };
  return { calls, tracker, set, advance, settle: () => advance(SETTLE_MS) };
}

test('全部載り、静かになったら start → progress(total) → end', () => {
  const { calls, tracker, set, settle } = setUp();
  const states = [circle('a'), circle('b'), circle('c')];
  set(states);
  assert.deepEqual(calls, [['start', 3]]);
  tracker.arrived([states[0]]);
  tracker.arrived([states[1], states[2]]);
  assert.deepEqual(calls, [['start', 3], ['progress', 1, 3]]);
  settle();
  assert.deepEqual(calls, [['start', 3], ['progress', 1, 3], ['progress', 3, 3], ['end', 3]]);
});

test('途中経過は 100 ms に 1 回まで', () => {
  const { calls, tracker, set, advance, settle } = setUp();
  const states = Array.from({ length: 5 }, (_, i) => circle(`s${i}`));
  set(states);
  tracker.arrived([states[0]]); // emits now
  tracker.arrived([states[1]]); // throttled
  tracker.arrived([states[2]]); // throttled
  assert.deepEqual(calls.slice(1), [['progress', 1, 5]]);
  advance(100);
  assert.deepEqual(calls.slice(1), [['progress', 1, 5], ['progress', 3, 5]]);
  tracker.arrived([states[3], states[4]]);
  settle();
  assert.deepEqual(calls.at(-1), ['end', 5]);
});

test('載る前に外された state は数から抜け、残りが載れば終わる', () => {
  const { calls, tracker, set, settle } = setUp();
  const [a, b, c] = [circle('a'), circle('b'), circle('c')];
  set([a, b, c]);
  tracker.arrived([a]);
  set([a, b]); // c removed before it arrived
  tracker.arrived([b]);
  settle();
  assert.deepEqual(calls.slice(-2), [['progress', 2, 2], ['end', 2]]);
});

test('残りを全部外せば、静かになったところで終わる', () => {
  const { calls, tracker, set, settle } = setUp();
  const [a, b] = [circle('a'), circle('b')];
  set([a, b]);
  tracker.arrived([a]);
  set([a]);
  settle();
  assert.deepEqual(calls.slice(-2), [['progress', 1, 1], ['end', 1]]);
});

test('追加の途中で新しい追加が来たら数え直し、前のリストの end は来ない', () => {
  const { calls, tracker, set, settle } = setUp();
  const [a, b, c] = [circle('a'), circle('b'), circle('c')];
  set([a, b]);
  set([a, b, c]); // only c is new
  assert.deepEqual(calls, [['start', 2], ['start', 1]]);
  tracker.arrived([a, b]); // from the earlier list: no longer counted
  tracker.arrived([c]);
  settle();
  assert.deepEqual(calls.slice(2), [['progress', 1, 1], ['end', 1]]);
});

test('更新・削除だけのリストは 0 で始まり 0 で終わり、他のコレクションの state は数えない', () => {
  const { calls, tracker, set, settle } = setUp();
  const [a, b] = [circle('a'), circle('b')];
  set([a, b]);
  tracker.arrived([a, b]);
  settle();
  calls.length = 0;
  set([circle('a')]); // a updated in place, b removed
  tracker.arrived([circle('other')]);
  assert.deepEqual(calls, [['start', 0]]);
  settle();
  assert.deepEqual(calls, [['start', 0], ['end', 0]]);
});

test('空のあとの空のリストでは何も呼ばない', () => {
  const { calls, set, settle } = setUp();
  set([]);
  settle();
  assert.deepEqual(calls, []);
});

test('タイルを描いている間は end を待ち、止んで静かになったら終わる', () => {
  const { calls, tracker, set, advance } = setUp();
  const a = circle('a');
  set([a]);
  tracker.arrived([a]);
  tracker.drawingChanged(true);
  advance(2000);
  assert.deepEqual(calls, [['start', 1]]);
  tracker.drawingChanged(false);
  advance(SETTLE_MS - 1);
  assert.deepEqual(calls, [['start', 1]]);
  advance(1);
  assert.deepEqual(calls, [['start', 1], ['progress', 1, 1], ['end', 1]]);
});

test('描画だけなら 200 ms 続いたところで 0 で始まり、静かになったら終わる', () => {
  const { calls, tracker, advance, settle } = setUp();
  tracker.drawingChanged(true);
  advance(DRAW_START_DELAY_MS - 1);
  assert.deepEqual(calls, []);
  advance(1);
  assert.deepEqual(calls, [['start', 0]]);
  tracker.drawingChanged(false);
  settle();
  assert.deepEqual(calls, [['start', 0], ['end', 0]]);
});

test('短い描画では何も呼ばない', () => {
  const { calls, tracker, advance } = setUp();
  tracker.drawingChanged(true);
  advance(DRAW_START_DELAY_MS / 2);
  tracker.drawingChanged(false);
  advance(2000);
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
