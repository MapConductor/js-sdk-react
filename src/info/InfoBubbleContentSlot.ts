import {
    createElement,
    useEffect,
    useLayoutEffect,
    useState,
    useSyncExternalStore,
    type ReactElement,
    type ReactNode,
} from 'react';

/**
 * 吹き出しの中身を、エントリを作り直さずに差し替えるための入れ物。
 *
 * `<InfoBubble>` はエントリ（位置・アイコン・中身）を bubbleCollector に登録し、
 * プロバイダのビューがそれを描く。以前は中身を**登録した時点の値**としてエントリに
 * 焼き込んでいたので、登録し直す条件（`[marker, position, className]`）に入っていない
 * children や bubbleColor が変わっても、画面には古い吹き出しが残った。
 *
 * 毎レンダーで登録し直せば直るが、それはコレクタの通知とプロバイダ側の再描画を
 * 毎回起こす。そこでエントリの `content` には**この入れ物を読む要素**を 1 つだけ
 * 入れておき、レンダーのたびに入れ物の中身だけを差し替える。差し替えで再描画される
 * のは入れ物を読む小さなコンポーネントだけで、エントリは同じ参照のまま残る。
 */
export class InfoBubbleContentSlot {
    private node: ReactNode;
    private readonly listeners = new Set<() => void>();

    /** エントリの `content` に入れる要素。入れ物の寿命の間ずっと同じ参照。 */
    readonly element: ReactElement;

    constructor(initial: ReactNode) {
        this.node = initial;
        this.element = createElement(InfoBubbleContentSlotView, { slot: this });
    }

    get current(): ReactNode {
        return this.node;
    }

    /** 中身を差し替える。同じ値なら何もしない（購読者も起こさない）。 */
    set(node: ReactNode): void {
        if (Object.is(node, this.node)) return;
        this.node = node;
        this.listeners.forEach((listener) => listener());
    }

    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    readonly getSnapshot = (): ReactNode => this.node;
}

function InfoBubbleContentSlotView({ slot }: { slot: InfoBubbleContentSlot }): ReactNode {
    return useSyncExternalStore(slot.subscribe, slot.getSnapshot, slot.getSnapshot);
}

// SSR では useLayoutEffect が警告を出す。サーバーでは差し替えるものが無いので useEffect でよい。
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * このレンダーの `content` を常に映す、参照の変わらない要素を返す。
 *
 * 返り値はエントリの `content` にそのまま入れる。差し替えはコミット時（layout effect）
 * に行うので、親のレンダーが捨てられた場合に未確定の中身が出ることはない。
 */
export function useInfoBubbleContentSlot(content: ReactNode): ReactElement {
    const [slot] = useState(() => new InfoBubbleContentSlot(content));
    useIsomorphicLayoutEffect(() => {
        slot.set(content);
    });
    return slot.element;
}
