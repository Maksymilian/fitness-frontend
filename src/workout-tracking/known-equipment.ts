import { useCallback, useState } from 'react';

const KNOWN_EQUIPMENT_KEY = 'known-equipment';

/**
 * Workout Tracking can't list equipment (equipment calls it, not the other way round), so the
 * back office keeps the ids it has seen in this browser: those it registered or looked up, and
 * the equipment in the test records (fitness-backend's `apps/workout-tracking/liquibase/test-data`).
 */
export const TEST_EQUIPMENT_IDS = [
  '0199c3a2-0000-7000-8000-000000000001',
  '0199c3a2-0000-7000-8000-000000000002',
  '0199c3a2-0000-7000-8000-000000000003',
] as const;

function load(): string[] {
  try {
    const stored = localStorage.getItem(KNOWN_EQUIPMENT_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [...TEST_EQUIPMENT_IDS];
  } catch {
    return [...TEST_EQUIPMENT_IDS];
  }
}

function save(ids: string[]): void {
  try {
    localStorage.setItem(KNOWN_EQUIPMENT_KEY, JSON.stringify(ids));
  } catch {
    // Storage blocked: the list lasts until the page is reloaded.
  }
}

export function useKnownEquipment() {
  const [ids, setIds] = useState(load);
  const update = useCallback((change: (current: string[]) => string[]) => {
    setIds((current) => {
      const next = change(current);
      save(next);
      return next;
    });
  }, []);
  return {
    ids,
    /** Newest first; an id already known moves to the top. */
    remember: useCallback((id: string) => update((current) => [id, ...current.filter((known) => known !== id)]), [update]),
    forget: useCallback((id: string) => update((current) => current.filter((known) => known !== id)), [update]),
  };
}
