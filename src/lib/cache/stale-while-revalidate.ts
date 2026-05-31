/**
 * In-memory stale-while-revalidate cache for server-side snapshots.
 */

export type SwrEntry<T> = {
  value: T;
  freshUntil: number;
  staleUntil: number;
};

const store = new Map<string, SwrEntry<unknown>>();

export function swrGet<T>(key: string): SwrEntry<T> | undefined {
  return store.get(key) as SwrEntry<T> | undefined;
}

export function swrSet<T>(
  key: string,
  value: T,
  freshMs: number,
  staleMs: number,
): SwrEntry<T> {
  const now = Date.now();
  const entry: SwrEntry<T> = {
    value,
    freshUntil: now + freshMs,
    staleUntil: now + staleMs,
  };
  store.set(key, entry as SwrEntry<unknown>);
  return entry;
}

export function swrIsFresh<T>(entry: SwrEntry<T> | undefined): boolean {
  return !!entry && Date.now() < entry.freshUntil;
}

export function swrIsStaleUsable<T>(entry: SwrEntry<T> | undefined): boolean {
  return !!entry && Date.now() < entry.staleUntil;
}
