import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createCircleState, createGeoPoint, OverlayCollector } from '@mapconductor/js-sdk-core';
import { OwnedOverlays } from '../src/OwnedOverlays.ts';

/**
 * `<Circles states>` の足し引き（src/Circle.tsx は OwnedOverlays に任せる）。
 *
 * android-sdk の `Circles(states)`、ios-sdk の `Circles(_:)` と同じ約束:
 * - 自分が足した id だけを足し引きする。複数の `<Circles>` / `<Circle>` が 1 つの地図に同居できる。
 * - 片方を外す（アンマウント）と、その分だけが消え、他方は残る。
 * - 前回と同じ id は最初の state を使い続け、値だけ移す（地図ではその場の変更になる）。
 * - 1 回の差し替えで collector の通知は 1 回。
 */

const p = (latitude, longitude) => createGeoPoint({ latitude, longitude });
const circle = (id, extra = {}) => createCircleState({ id, center: p(42.35, -71.06), radiusMeters: 5, ...extra });

/** Mirrors the sync in Circle.tsx for what these tests look at. */
const sync = (target, source) => {
  if (target.fillColor !== source.fillColor) target.fillColor = source.fillColor;
  if (target.radiusMeters !== source.radiusMeters) target.radiusMeters = source.radiusMeters;
};

function collectorWithLog() {
  const collector = new OverlayCollector();
  const notified = [];
  collector.subscribe((map) => notified.push([...map.keys()].sort()));
  notified.length = 0; // subscribe may emit the current map
  return { collector, notified };
}

const ids = (collector) => [...collector.values()].map((s) => s.id).sort();

test('2 つの Circles が同じ地図に同居し、互いの id に触れない', () => {
  const { collector } = collectorWithLog();
  const a = new OwnedOverlays(collector, sync);
  const b = new OwnedOverlays(collector, sync);
  a.set([circle('a1'), circle('a2')]);
  b.set([circle('b1')]);
  collector.add(circle('single')); // a <Circle> beside them
  assert.deepEqual(ids(collector), ['a1', 'a2', 'b1', 'single']);

  a.set([circle('a1')]);
  assert.deepEqual(ids(collector), ['a1', 'b1', 'single']);
});

test('片方を外すとその分だけ消え、他方は残る', () => {
  const { collector } = collectorWithLog();
  const a = new OwnedOverlays(collector, sync);
  const b = new OwnedOverlays(collector, sync);
  a.set([circle('a1'), circle('a2')]);
  b.set([circle('b1'), circle('b2')]);
  a.clear();
  assert.deepEqual(ids(collector), ['b1', 'b2']);
  assert.equal(a.size, 0);
  a.set([circle('a1')]);
  assert.deepEqual(ids(collector), ['a1', 'b1', 'b2']);
});

test('同じ id は最初の state のまま値だけ移り、差し替え 1 回で通知は 1 回', async () => {
  const { collector, notified } = collectorWithLog();
  const owned = new OwnedOverlays(collector, sync);
  const first = circle('x', { fillColor: '#111111' });
  owned.set([first, circle('y')]);
  assert.equal(notified.length, 1);

  const next = circle('x', { fillColor: '#222222', radiusMeters: 9 });
  owned.set([next, circle('z')]);
  assert.equal(notified.length, 2, 'one notification for the add, the removal and the in-place change');
  assert.deepEqual(notified.at(-1), ['x', 'z']);
  assert.equal(collector.get('x'), first, 'the first state object stays');
  assert.equal(first.fillColor, '#222222', 'with the new values');
  assert.equal(first.radiusMeters, 9);

  owned.set([next, circle('z')]);
  assert.equal(notified.length, 2);
});
