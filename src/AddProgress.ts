import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeOverlaysAdded } from '@mapconductor/js-sdk-core';

/**
 * How far a collection (`<Markers>`, `<Circles>`, `<Polylines>`, `<Polygons>`)
 * is with putting its states on the map: for a list of thousands, the screen
 * shows nothing until they are drawn, and these say that work is going on.
 *
 * "On the map" is what each state's `onAdded` means: drawn natively, or, for a
 * state drawn in tiles, its tiles handed to the map (their images may still be
 * loading).
 *
 * - `onAddStart(total)`: a list brought states that are not on the map yet;
 *   `total` is how many.
 * - `onAddProgress(added, total)`: how many of them are on the map so far, at
 *   most every 100 ms, and once more with `added === total` before the end.
 * - `onAddEnd(total)`: all of them are on the map. A state taken out of the
 *   list before it got there no longer counts against the end.
 *
 * A list that brings new states while an earlier one is still being added
 * starts over: a new `onAddStart` with only the new states, and no `onAddEnd`
 * for the earlier list. A list that only updates or removes states calls nothing.
 */
export interface AddProgressCallbacks {
    onAddStart?: (total: number) => void;
    onAddProgress?: (added: number, total: number) => void;
    onAddEnd?: (total: number) => void;
}

const PROGRESS_INTERVAL_MS = 100;

/**
 * The states one collection handed over and how many of them are on the map.
 * Kept apart from React so that it can be driven directly.
 */
export class AddProgressTracker {
    /** State objects handed over and not on the map yet, by id. */
    private pending = new Map<object, string>();
    private total = 0;
    private added = 0;
    private lastProgressAt = 0;
    private timer: ReturnType<typeof setTimeout> | null = null;

    private readonly callbacks: () => AddProgressCallbacks;
    private readonly now: () => number;

    constructor(callbacks: () => AddProgressCallbacks, now: () => number = () => performance.now()) {
        this.callbacks = callbacks;
        this.now = now;
    }

    /** A list was handed to the collector: the states it added and the ids it removed. */
    track(added: readonly { id: string }[], removedIds: readonly string[]): void {
        if (this.pending.size > 0 && removedIds.length > 0) {
            const removed = new Set(removedIds);
            for (const [state, id] of this.pending) {
                if (removed.has(id)) {
                    this.pending.delete(state);
                    this.total--;
                }
            }
            if (added.length === 0) this.finishIfDone();
        }
        if (added.length === 0) return;
        this.cancelTimer();
        this.pending = new Map(added.map(state => [state as object, state.id]));
        this.total = added.length;
        this.added = 0;
        this.lastProgressAt = 0;
        this.callbacks().onAddStart?.(this.total);
    }

    /** States reached the map (any collection's: the others are not ours). */
    arrived(states: readonly object[]): void {
        if (this.pending.size === 0) return;
        let hit = false;
        for (const state of states) {
            if (this.pending.delete(state)) {
                this.added++;
                hit = true;
            }
        }
        if (!hit) return;
        if (this.pending.size === 0) this.finishIfDone();
        else this.reportProgress();
    }

    dispose(): void {
        this.cancelTimer();
        this.pending.clear();
    }

    private finishIfDone(): void {
        if (this.pending.size > 0) return;
        this.cancelTimer();
        this.callbacks().onAddProgress?.(this.total, this.total);
        this.callbacks().onAddEnd?.(this.total);
    }

    private reportProgress(): void {
        if (this.timer != null) return;
        const wait = this.lastProgressAt + PROGRESS_INTERVAL_MS - this.now();
        if (wait <= 0) this.emitProgress();
        else this.timer = setTimeout(() => this.emitProgress(), wait);
    }

    private emitProgress(): void {
        this.timer = null;
        if (this.pending.size === 0) return;
        this.lastProgressAt = this.now();
        this.callbacks().onAddProgress?.(this.added, this.total);
    }

    private cancelTimer(): void {
        if (this.timer != null) clearTimeout(this.timer);
        this.timer = null;
    }
}

/**
 * Tracks the states one collection hands over. Call the returned function from
 * the effect that hands a list to the collector, with the states it added and
 * the ids it removed.
 */
export function useAddProgress({ onAddStart, onAddProgress, onAddEnd }: AddProgressCallbacks) {
    const callbacks = useRef<AddProgressCallbacks>({});
    callbacks.current = { onAddStart, onAddProgress, onAddEnd };
    const wanted = onAddStart != null || onAddProgress != null || onAddEnd != null;
    const [tracker] = useState(() => new AddProgressTracker(() => callbacks.current));

    useEffect(() => {
        if (!wanted) return;
        return subscribeOverlaysAdded(states => tracker.arrived(states));
    }, [wanted, tracker]);

    useEffect(() => () => tracker.dispose(), [tracker]);

    return useCallback(
        (added: readonly { id: string }[], removedIds: readonly string[]) => {
            if (wanted) tracker.track(added, removedIds);
        },
        [wanted, tracker],
    );
}
