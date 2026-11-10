import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createGeoPoint, createPolylineState, OverlayCollector } from '@mapconductor/js-sdk-core';
import { OwnedOverlays } from '../src/OwnedOverlays.ts';

/**
 * `<Polylines states>` の足し引き（src/Polyline.tsx は OwnedOverlays に任せる）。
 *
 * android-sdk の `Polylines(states)`、ios-sdk の `Polylines(_:)` と同じ約束:
 * - 自分が足した id だけを足し引きする。複数の `<Polylines>` / `<Polyline>` が 1 つの地図に同居できる。
 * - 片方を外す（アンマウント）と、その分だけが消え、他方は残る。
 * - 前回と同じ id は最初の state を使い続け、値だけ移す（地図ではその場の変更になる）。
 * - 1 回の差し替えで collector の通知は 1 回。
 */

const p = (latitude, longitude) => createGeoPoint({ latitude, longitude });
const line = (id, extra = {}) => createPolylineState({ id, points: [p(0, 0), p(1, 1)], ...extra });

/** Mirrors the sync in Polyline.tsx for what these tests look at. */
const sync = (target, source) => {
  if (target.strokeColor !== source.strokeColor) target.strokeColor = source.strokeColor;
  if (target.points !== source.points) target.points = source.points;
};

function collectorWithLog() {
  const collector = new OverlayCollector();
  const notified = [];
  collector.subscribe((map) => notified.push([...map.keys()].sort()));
  notified.length = 0; // subscribe may emit the current map
  return { collector, notified };
}

test('2 つの Polylines が同じ地図に同居し、互いの id に触れない', () => {
  const { collector } = collectorWithLog();
  const a = new OwnedOverlays(collector, sync);
  const b = new OwnedOverlays(collector, sync);
  a.set([line('a1'), line('a2')]);
  b.set([line('b1')]);
  collector.add(line('single')); // a <Polyline> beside them
  assert.deepEqual([...collector.values()].map((s) => s.id).sort(), ['a1', 'a2', 'b1', 'single']);

  // a drops a2: b's and the single one stay.
  a.set([line('a1')]);
  assert.deepEqual([...collector.values()].map((s) => s.id).sort(), ['a1', 'b1', 'single']);
});

test('片方を外すとその分だけ消え、他方は残る', () => {
  const { collector } = collectorWithLog();
  const a = new OwnedOverlays(collector, sync);
  const b = new OwnedOverlays(collector, sync);
  a.set([line('a1'), line('a2')]);
  b.set([line('b1'), line('b2')]);
  a.clear();
  assert.deepEqual([...collector.values()].map((s) => s.id).sort(), ['b1', 'b2']);
  assert.equal(a.size, 0);
  // Mounting again adds them again.
  a.set([line('a1')]);
  assert.deepEqual([...collector.values()].map((s) => s.id).sort(), ['a1', 'b1', 'b2']);
});

test('同じ id は最初の state のまま値だけ移り、差し替え 1 回で通知は 1 回', async () => {
  const { collector, notified } = collectorWithLog();
  const owned = new OwnedOverlays(collector, sync);
  const first = line('x', { strokeColor: '#111111' });
  owned.set([first, line('y')]);
  assert.equal(notified.length, 1);

  const next = line('x', { strokeColor: '#222222' });
  owned.set([next, line('z')]);
  assert.equal(notified.length, 2, 'one notification for the add, the removal and the in-place change');
  assert.deepEqual(notified.at(-1), ['x', 'z']);
  assert.equal(collector.get('x'), first, 'the first state object stays');
  assert.equal(first.strokeColor, '#222222', 'with the new values');

  // The same list again: nothing to tell.
  owned.set([next, line('z')]);
  assert.equal(notified.length, 2);
});
