import type { OverlayCollector } from '@mapconductor/js-sdk-core';

/**
 * The overlays one collection component (`<Polylines>`) has handed to a map's
 * collector, kept in step with the list it is given.
 *
 * Only the difference from the previous list goes to the collector, in one
 * notification: new ids are added, ids gone from the list are removed, and an
 * id that stays keeps its first state object, which takes the new one's values
 * (`sync`) so the collector's per-state subscription sees an in-place change.
 * It never touches ids it did not add, so several collections and single
 * overlays can share one collector, as `<Markers>` do.
 */
export class OwnedOverlays<S extends { id: string }> {
    private readonly owned = new Map<string, S>();
    private readonly collector: OverlayCollector<S>;
    private readonly sync: (target: S, source: S) => void;

    constructor(collector: OverlayCollector<S>, sync: (target: S, source: S) => void) {
        this.collector = collector;
        this.sync = sync;
    }

    /** Makes the owned set `states`. */
    set(states: readonly S[]): void {
        this.collector.batchChanges(() => {
            const nextIds = new Set<string>();
            const added: S[] = [];
            for (const state of states) {
                nextIds.add(state.id);
                const stable = this.owned.get(state.id);
                if (!stable) {
                    this.owned.set(state.id, state);
                    added.push(state);
                } else if (stable !== state) {
                    this.sync(stable, state);
                }
            }
            const removedIds: string[] = [];
            for (const id of this.owned.keys()) {
                if (!nextIds.has(id)) removedIds.push(id);
            }
            for (const id of removedIds) this.owned.delete(id);
            if (added.length > 0 || removedIds.length > 0) this.collector.applyDiff(added, removedIds);
        });
    }

    /** Removes every overlay this set added, and nothing else. */
    clear(): void {
        if (this.owned.size === 0) return;
        this.collector.applyDiff([], [...this.owned.keys()]);
        this.owned.clear();
    }

    get size(): number {
        return this.owned.size;
    }
}
