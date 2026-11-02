// Request coordination is separate from React/Firestore so slow responses,
// retries and moving live boundaries can be exercised deterministically.
export function createCursorFeed({ loadPage, watch, compare, pageSize = 24, enabled = true }) {
  let state = { items: [], cursor: null, hasMore: true, loading: enabled, loadingMore: false, error: '', denied: false, watchError: false };
  let disposed = false, busy = false, started = false, capacity = pageSize, stop, generation = 0, seenLive = false, headIds = new Set(), pageGeneration = 0;
  const listeners = new Set();
  const emit = patch => { if (!disposed) { state = { ...state, ...patch }; for (const listener of listeners) listener(); } };
  const merge = (before, after) => {
    const map = new Map(before.map(item => [item.id, item])); for (const item of after) map.set(item.id, item);
    const values = [...map.values()]; return compare ? values.sort(compare) : values;
  };
  const fail = (error, watchError = false) => {
    const denied = ['permission-denied', 'unauthenticated'].includes(error?.code?.replace('firestore/', ''));
    if (denied) { pageGeneration++; busy = false; stop?.(); }
    emit({ watchError, loading: false, loadingMore: false, error: denied ? 'Access is unavailable. Return to the marketplace or sign in again.' : 'Could not load these results. Please try again.', denied, ...(denied ? { items: [], cursor: null, hasMore: false } : {}) });
  };
  const load = async () => {
    if (disposed || busy || !enabled || state.denied || (!state.hasMore && state.items.length)) return;
    busy = true;
    const requestGeneration = generation, requestPageGeneration = pageGeneration;
    const cursor = state.cursor;
    emit({ loading: !state.items.length, loadingMore: !!state.items.length, error: '' });
    try {
      const page = await loadPage(cursor);
      if (disposed || requestGeneration !== generation || requestPageGeneration !== pageGeneration || state.denied) return;
      if (watch) {
        capacity += cursor ? pageSize : 0;
        const merged = merge(state.items, page.items), trimmed = merged.length > capacity;
        const items = merged.slice(0, capacity);
        emit({ items, cursor: items.at(-1)?.cursor ?? cursor, hasMore: page.hasMore || trimmed, loading: false, loadingMore: false });
      } else emit({ items: merge(state.items, page.items), cursor: page.cursor, hasMore: page.hasMore, loading: false, loadingMore: false });
    } catch (error) { if (requestGeneration === generation && requestPageGeneration === pageGeneration) fail(error); }
    finally { if (requestGeneration === generation && requestPageGeneration === pageGeneration) busy = false; }
  };
  return {
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => state,
    load,
    updateItems(updates) {
      if (disposed || state.denied) return;
      emit({ items: state.items.map(item => updates.has(item.id) ? { ...item, ...updates.get(item.id), id: item.id, cursor: item.cursor } : item) });
    },
    start() {
      if (started || !enabled) return; started = true; disposed = false;
      const watchGeneration = generation;
      if (watch) stop = watch(page => {
        if (disposed || watchGeneration !== generation || state.denied) return;
        // After a long disconnect/burst, the new head may have no overlap.
        // Keeping old history would leave an invisible gap behind the cursor.
        const gap = seenLive && page.items.length > 0 && !page.items.some(item => headIds.has(item.id));
        const reset = gap || !page.hasMore;
        const historyReset = gap && capacity > pageSize;
        if (reset) { pageGeneration++; busy = false; capacity = pageSize; }
        const merged = merge(reset ? [] : state.items, page.items), trimmed = merged.length > capacity;
        const items = merged.slice(0, capacity);
        emit({ items, cursor: items.at(-1)?.cursor ?? null, hasMore: reset ? page.hasMore : trimmed || (!seenLive ? page.hasMore : state.hasMore), loading: false, ...(reset ? { loadingMore: false } : {}), error: '', watchError: false, historyReset: state.historyReset || historyReset });
        headIds = new Set(page.items.map(item => item.id)); seenLive = true;
      }, error => { if (watchGeneration === generation) fail(error, true); });
      else void load();
    },
    dispose() { disposed = true; started = false; busy = false; generation++; stop?.(); },
  };
}
