import type { AnnotationObject, DocumentSnapshot } from '@/types/editor';

export const MAX_HISTORY_STEPS = 100;

export interface HistoryManagerState {
  past: DocumentSnapshot[];
  present: DocumentSnapshot;
  future: DocumentSnapshot[];
  transactionStart: DocumentSnapshot | null;
}

export function cloneSnapshot(snapshot: DocumentSnapshot): DocumentSnapshot {
  return {
    projectName: snapshot.projectName,
    backgroundAssetId: snapshot.backgroundAssetId,
    annotations: structuredClone(snapshot.annotations),
  };
}

export function snapshotsEqual(a: DocumentSnapshot, b: DocumentSnapshot): boolean {
  if (a.projectName !== b.projectName) return false;
  if (a.backgroundAssetId !== b.backgroundAssetId) return false;
  if (a.annotations.length !== b.annotations.length) return false;
  return JSON.stringify(a.annotations) === JSON.stringify(b.annotations);
}

export function createInitialHistory(initial?: Partial<DocumentSnapshot>): HistoryManagerState {
  return {
    past: [],
    present: {
      projectName: initial?.projectName ?? 'Untitled Screenshot',
      backgroundAssetId: initial?.backgroundAssetId ?? null,
      annotations: initial?.annotations ? structuredClone(initial.annotations) : [],
    },
    future: [],
    transactionStart: null,
  };
}

export function recordHistoryChange(
  state: HistoryManagerState,
  nextPresent: DocumentSnapshot
): HistoryManagerState {
  const baseState = state.transactionStart ? commitHistoryTransaction(state) : state;

  if (snapshotsEqual(baseState.present, nextPresent)) {
    return baseState;
  }

  const nextPast = [...baseState.past, cloneSnapshot(baseState.present)];
  if (nextPast.length > MAX_HISTORY_STEPS) {
    nextPast.shift();
  }

  return {
    past: nextPast,
    present: cloneSnapshot(nextPresent),
    future: [],
    transactionStart: null,
  };
}

export function replaceHistoryPresent(
  state: HistoryManagerState,
  nextPresent: DocumentSnapshot
): HistoryManagerState {
  return {
    ...state,
    present: cloneSnapshot(nextPresent),
    future: [],
    transactionStart: null,
  };
}

export function beginHistoryTransaction(state: HistoryManagerState): HistoryManagerState {
  if (state.transactionStart) {
    return state;
  }
  return {
    ...state,
    transactionStart: cloneSnapshot(state.present),
  };
}

export function updateHistoryTransient(
  state: HistoryManagerState,
  nextAnnotations: AnnotationObject[]
): HistoryManagerState {
  const txStart = state.transactionStart ?? cloneSnapshot(state.present);
  return {
    ...state,
    transactionStart: txStart,
    present: {
      ...state.present,
      annotations: structuredClone(nextAnnotations),
    },
  };
}

export function commitHistoryTransaction(state: HistoryManagerState): HistoryManagerState {
  if (!state.transactionStart) {
    return state;
  }

  if (snapshotsEqual(state.transactionStart, state.present)) {
    return {
      ...state,
      transactionStart: null,
    };
  }

  const nextPast = [...state.past, state.transactionStart];
  if (nextPast.length > MAX_HISTORY_STEPS) {
    nextPast.shift();
  }

  return {
    past: nextPast,
    present: cloneSnapshot(state.present),
    future: [],
    transactionStart: null,
  };
}

export function cancelHistoryTransaction(state: HistoryManagerState): HistoryManagerState {
  if (!state.transactionStart) {
    return state;
  }
  return {
    ...state,
    present: state.transactionStart,
    transactionStart: null,
  };
}

export function undoHistory(state: HistoryManagerState): HistoryManagerState {
  if (state.transactionStart) {
    return cancelHistoryTransaction(state);
  }

  if (state.past.length === 0) {
    return state;
  }

  const previous = state.past[state.past.length - 1]!;
  const nextPast = state.past.slice(0, -1);

  return {
    past: nextPast,
    present: cloneSnapshot(previous),
    future: [cloneSnapshot(state.present), ...state.future],
    transactionStart: null,
  };
}

export function redoHistory(state: HistoryManagerState): HistoryManagerState {
  if (state.transactionStart) {
    return state;
  }

  if (state.future.length === 0) {
    return state;
  }

  const next = state.future[0]!;
  const nextFuture = state.future.slice(1);

  return {
    past: [...state.past, cloneSnapshot(state.present)],
    present: cloneSnapshot(next),
    future: nextFuture,
    transactionStart: null,
  };
}

export function getReferencedAssetIds(state: HistoryManagerState): Set<string> {
  const ids = new Set<string>();
  if (state.present.backgroundAssetId) ids.add(state.present.backgroundAssetId);
  if (state.transactionStart?.backgroundAssetId) ids.add(state.transactionStart.backgroundAssetId);
  for (const snap of state.past) {
    if (snap.backgroundAssetId) ids.add(snap.backgroundAssetId);
  }
  for (const snap of state.future) {
    if (snap.backgroundAssetId) ids.add(snap.backgroundAssetId);
  }
  return ids;
}
