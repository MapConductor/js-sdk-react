import type { MarkerAnimationOverlayEntry } from '@mapconductor/js-sdk-core';

/**
 * Reactive collection of in-flight marker animations, driving the
 * screen-space `MarkerAnimationLayer`. Mirrors Android's
 * `MutableStateFlow<Map<String, MarkerAnimationOverlayEntry>>`
 * (`MapViewScope.markerAnimationFlow` in the Compose SDK).
 */
export class MarkerAnimationStore {
  private readonly entries = new Map<string, MarkerAnimationOverlayEntry>();
  private readonly subs = new Set<(entries: MarkerAnimationOverlayEntry[]) => void>();

  /** Used as a `MarkerAnimationOverlayHost`: start playing an animation entry. */
  start = (entry: MarkerAnimationOverlayEntry): void => {
    const onFinished = entry.onFinished;
    this.entries.set(entry.id, {
      ...entry,
      onFinished: () => {
        this.entries.delete(entry.id);
        this.notify();
        onFinished();
      },
    });
    this.notify();
  };

  subscribe(fn: (entries: MarkerAnimationOverlayEntry[]) => void): () => void {
    this.subs.add(fn);
    fn(Array.from(this.entries.values()));
    return () => {
      this.subs.delete(fn);
    };
  }

  private notify(): void {
    const list = Array.from(this.entries.values());
    this.subs.forEach((fn) => fn(list));
  }
}
