import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InfoBubbleContentSlot } from '../src/info/InfoBubbleContentSlot.ts';

/**
 * `<InfoBubble>` / `<InfoBubbleCustom>` の中身の差し替え。
 *
 * ## なぜここを固定するか
 *
 * 以前は中身を登録時の値としてエントリに焼き込んでいて、children や bubbleColor だけが
 * 変わっても画面の吹き出しは古いままだった。壊れても型は通り、吹き出しも出てしまうので、
 * 気づけるのは「カウンタを上げても数字が変わらない」を画面で見たときだけになる。
 *
 * 直し方は「エントリは作り直さず、エントリが持つ 1 つの要素が入れ物の今の中身を描く」。
 * ここではその入れ物の約束を固定する:
 * - エントリに入れる要素は、中身を何度差し替えても同じ参照（= 再登録が要らない）
 * - 差し替えると購読者（入れ物を読むコンポーネント）が起きて、最新の中身が読める
 * - 同じ値の差し替えでは誰も起こさない
 */

test('element は中身を差し替えても同じ参照のまま', () => {
  const slot = new InfoBubbleContentSlot('count: 0');
  const element = slot.element;

  slot.set('count: 1');
  slot.set('count: 2');

  assert.equal(slot.element, element);
  assert.equal(slot.element.props.slot, slot);
});

test('set で購読者が起き、最新の中身が読める', () => {
  const slot = new InfoBubbleContentSlot('count: 0');
  const seen = [];
  const unsubscribe = slot.subscribe(() => seen.push(slot.getSnapshot()));

  slot.set('count: 1');
  slot.set('count: 2');

  assert.deepEqual(seen, ['count: 1', 'count: 2']);
  assert.equal(slot.current, 'count: 2');

  unsubscribe();
  slot.set('count: 3');
  assert.deepEqual(seen, ['count: 1', 'count: 2'], '購読解除後は呼ばれない');
  assert.equal(slot.getSnapshot(), 'count: 3', '解除後も中身自体は更新される');
});

test('同じ値の set では購読者を起こさない', () => {
  const node = { type: 'div', props: {} };
  const slot = new InfoBubbleContentSlot(node);
  let calls = 0;
  slot.subscribe(() => calls++);

  slot.set(node);
  assert.equal(calls, 0);

  slot.set({ type: 'div', props: {} });
  assert.equal(calls, 1, '別のオブジェクトは（中身が同じでも）差し替えとして扱う');
});

test('getSnapshot は差し替えるまで同じ値を返す（useSyncExternalStore の約束）', () => {
  const slot = new InfoBubbleContentSlot({ label: 'a' });
  assert.equal(slot.getSnapshot(), slot.getSnapshot());
});
