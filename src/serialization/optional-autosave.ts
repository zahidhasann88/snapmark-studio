import { parseProjectJson, type ParseProjectResult } from './project-io';

const PREF_KEY = 'snapmark:opt-in-autosave-enabled';
const DRAFT_KEY = 'snapmark:unencrypted-recovery-draft';

export function isLocalAutosaveEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PREF_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setLocalAutosaveEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(PREF_KEY, 'true');
    } else {
      window.localStorage.removeItem(PREF_KEY);
      window.localStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function saveLocalRecoveryDraft(serializedJson: string): boolean {
  if (typeof window === 'undefined' || !isLocalAutosaveEnabled()) return false;
  try {
    window.localStorage.setItem(DRAFT_KEY, serializedJson);
    return true;
  } catch {
    return false;
  }
}

export function loadLocalRecoveryDraft(): ParseProjectResult | null {
  if (typeof window === 'undefined' || !isLocalAutosaveEnabled()) return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return parseProjectJson(raw, 'local-recovery-draft.snapmark.json');
  } catch {
    return null;
  }
}

export function clearAllLocalSavedData(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(PREF_KEY);
  } catch {
    // Ignore
  }
}

export function hasLocalRecoveryDraft(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem(DRAFT_KEY));
  } catch {
    return false;
  }
}
