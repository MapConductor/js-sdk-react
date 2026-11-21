import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeOverlaysAdded, type TileActivity } from '@mapconductor/js-sdk-core';

/**
 * How far a collection (`<Markers>`, `<Circles>`, `<Polylines>`, `<Polygons>`)
 * is with putting its states on the map: for a list of thousands, the screen
 * shows nothing until they are drawn, and these say that work is going on.
 *
 * "On the map" is what each state's `onAdded` means: drawn natively, or, for a
 * state drawn in tiles, its tiles handed to the map. The work does not end
 * there for tiles, so the collection also counts as busy while its tiles are
 * being drawn ({@link AddProgressTracker.drawingChanged}): after a filter
 * change, and while the camera moves to where tiles are not drawn yet.
 *
 * - `onAddStart(total)`: a list was handed over, or tiles have been drawn for
 *   {@link DRAW_START_DELAY_MS} without one; `total` is how many states the
 *   list brought that are not on the map yet (0 when it only removed or
 *   updated states, or for tiles alone). An empty list after an empty one
 *   calls nothing.
 * - `onAddProgress(added, total)`: how many of them are on the map so far, at
 *   most every 100 ms, and once more with `added === total` before the end
 *   when `total` is not 0.
 * - `onAddEnd(total)`: all of them are on the map and nothing has been drawn
 *   for {@link SETTLE_MS}. A state taken out of the list before it got there
 *   no longer counts against the end.
 *
 * A list that brings new states while an earlier one is still being added
 * starts over: a new `onAddStart` with only the new states, and no `onAddEnd`
 * for the earlier list.
 */
export interface AddProgressCallbacks {
    onAddStart?: (total: number) => void;
    onAddProgress?: (added: number, total: number) => void;
    onAddEnd?: (total: number) => void;
}

const PROGRESS_INTERVAL_MS = 100;
/** Drawing alone counts as work only once it has lasted this long: a camera move over cached tiles does not. */
export const DRAW_START_DELAY_MS = 200;
/** Quiet this long -- nothing handed over, arriving or drawn -- before onAddEnd. */
export const SETTLE_MS = 400;

/** How the tracker waits; injectable so that tests can drive time. */
export interface AddProgressTimers {
    set(callback: () => void, ms: number): unknown;
    clear(handle: unknown): void;
}

const realTimers: AddProgressTimers = {
    set: (callback, ms) => setTimeout(callback, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

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
    private timer: unknown = null;

    /** Between an onAddStart and its onAddEnd. */
    private started = false;
    /** The last list had states: an empty list after an empty one hands nothing over. */
    private hadStates = false;
    /** The collection's tiles are being drawn (or its tiler is taking a list). */
    private drawing = false;
    /** When the last reason to be busy ended: a hand-over, the last arrival, drawing stopping. */
    private quietSince = -Infinity;
    private settle: unknown = null;
    private drawStart: unknown = null;

    private readonly callbacks: () => AddProgressCallbacks;
    private readonly now: () => number;
    private readonly timers: AddProgressTimers;

    constructor(
        callbacks: () => AddProgressCallbacks,
        now: () => number = () => performance.now(),
        timers: AddProgressTimers = realTimers,
    ) {
        this.callbacks = callbacks;
        this.now = now;
        this.timers = timers;
    }

    /**
     * A list of `size` states was handed to the collector: the states it added
     * and the ids it removed.
     */
    track(added: readonly { id: string }[], removedIds: readonly string[], size: number): void {
        const hadStates = this.hadStates;
        this.hadStates = size > 0;
        if (size === 0 && !hadStates) return;
        if (this.pending.size > 0 && removedIds.length > 0) {
            const removed = new Set(removedIds);
            for (const [state, id] of this.pending) {
                if (removed.has(id)) {
                    this.pending.delete(state);
                    this.total--;
                }
            }
        }
        this.quietSince = this.now();
        if (added.length > 0) {
            this.cancelTimer();
            this.pending = new Map(added.map(state => [state as object, state.id]));
            this.total = added.length;
            this.added = 0;
            this.lastProgressAt = 0;
            this.begin(this.total);
        } else if (!this.started) {
            this.total = 0;
            this.added = 0;
            this.begin(0);
        }
        this.scheduleSettle();
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
        if (this.pending.size === 0) {
            this.quietSince = this.now();
            this.scheduleSettle();
        } else {
            this.reportProgress();
        }
    }

    /** Whether the collection's tiles are being drawn now. */
    drawingChanged(drawing: boolean): void {
        if (drawing === this.drawing) return;
        this.drawing = drawing;
        if (drawing) {
            this.clear('settle');
            if (!this.started && this.drawStart == null) {
                this.drawStart = this.timers.set(() => {
                    this.drawStart = null;
                    if (this.drawing && !this.started) {
                        this.total = 0;
                        this.added = 0;
                        this.begin(0);
                    }
                }, DRAW_START_DELAY_MS);
            }
        } else {
            this.clear('drawStart');
            this.quietSince = this.now();
            this.scheduleSettle();
        }
    }

    dispose(): void {
        this.cancelTimer();
        this.clear('settle');
        this.clear('drawStart');
        this.pending.clear();
    }

    private begin(total: number): void {
        this.started = true;
        this.clear('drawStart');
        this.callbacks().onAddStart?.(total);
    }

    private scheduleSettle(): void {
        if (!this.started) return;
        this.clear('settle');
        this.settle = this.timers.set(() => {
            this.settle = null;
            this.finishIfIdle();
        }, SETTLE_MS);
    }

    private finishIfIdle(): void {
        if (!this.started || this.drawing || this.pending.size > 0) return;
        if (this.quietSince + SETTLE_MS - this.now() > 0) {
            this.scheduleSettle();
            return;
        }
        this.cancelTimer();
        this.started = false;
        const count = this.total;
        this.total = 0;
        this.added = 0;
        if (count > 0) this.callbacks().onAddProgress?.(count, count);
        this.callbacks().onAddEnd?.(count);
    }

    private reportProgress(): void {
        if (this.timer != null) return;
        const wait = this.lastProgressAt + PROGRESS_INTERVAL_MS - this.now();
        if (wait <= 0) this.emitProgress();
        else this.timer = this.timers.set(() => this.emitProgress(), wait);
    }

    private emitProgress(): void {
        this.timer = null;
        if (this.pending.size === 0) return;
        this.lastProgressAt = this.now();
        this.callbacks().onAddProgress?.(this.added, this.total);
    }

    private cancelTimer(): void {
        if (this.timer != null) this.timers.clear(this.timer);
        this.timer = null;
    }

    private clear(which: 'settle' | 'drawStart'): void {
        const handle = this[which];
        if (handle != null) this.timers.clear(handle);
        this[which] = null;
    }
}

/**
 * Tracks the states one collection hands over. Call the returned function from
 * the effect that hands a list to the collector, with the states it added, the
 * ids it removed and how many states the collection now has. With `activity`
 * (see `useOverlayTileActivity`), it also follows the map's tiler for this
 * kind of overlay: busy while it draws tiles.
 */
export function useAddProgress({ onAddStart, onAddProgress, onAddEnd }: AddProgressCallbacks, activity?: TileActivity | null) {
    const callbacks = useRef<AddProgressCallbacks>({});
    callbacks.current = { onAddStart, onAddProgress, onAddEnd };
    const wanted = onAddStart != null || onAddProgress != null || onAddEnd != null;
    const [tracker] = useState(() => new AddProgressTracker(() => callbacks.current));

    useEffect(() => {
        if (!wanted) return;
        return subscribeOverlaysAdded(states => tracker.arrived(states));
    }, [wanted, tracker]);

    useEffect(() => {
        if (!wanted || !activity) return;
        tracker.drawingChanged(activity.active);
        const unsubscribe = activity.subscribe(busy => tracker.drawingChanged(busy));
        return () => {
            unsubscribe();
            tracker.drawingChanged(false);
        };
    }, [wanted, activity, tracker]);

    useEffect(() => () => tracker.dispose(), [tracker]);

    return useCallback(
        (added: readonly { id: string }[], removedIds: readonly string[], size: number) => {
            if (wanted) tracker.track(added, removedIds, size);
        },
        [wanted, tracker],
    );
}
