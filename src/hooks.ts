import { useEffect, useState } from 'react';
import type { DailyJournal, TradePosition } from './types';

const STORAGE_KEY = 'trading-journal-daily-v2';
const STORAGE_KEY_V1 = 'trading-journal-daily-v1';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function migrateEntry(e: DailyJournal & { losingStreak?: string; streak?: string }): DailyJournal {
    const next = { ...e } as DailyJournal & { losingStreak?: string };
    if (next.losingStreak) delete next.losingStreak;
    if (next.streak === 'long' || next.streak === 'short') next.streak = 'win';
    if (Array.isArray(e.holding) && e.holding.length > 0) {
      next.holding = e.holding.map((x) =>
        typeof x === 'string' ? { symbol: x, side: 'long' as const } : { ...x, side: x.side ?? 'long' }
      ) as TradePosition[];
    }
    return next;
}

export function useJournalData() {
  const [entries, setEntries] = useState<DailyJournal[]>([]);

  useEffect(() => {
    let raw = safeParse<DailyJournal[]>(localStorage.getItem(STORAGE_KEY), []);
    if (raw.length === 0) {
      raw = safeParse<DailyJournal[]>(localStorage.getItem(STORAGE_KEY_V1), []);
    }
    setEntries(raw.map((e) => migrateEntry(e)));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const getEntry = (date: string): DailyJournal | null =>
    entries.find((e) => e.date === date) ?? null;

  /** Holding (with percent & side) from the most recent day before this date (for new-day carryover). */
  const getPreviousHolding = (date: string): TradePosition[] => {
    const before = entries.filter((e) => e.date < date).sort((a, b) => b.localeCompare(a));
    const prev = before[0];
    if (!prev || !prev.holding) return [];
    const arr = prev.holding;
    return Array.isArray(arr) ? arr.map((x) => typeof x === 'string' ? { symbol: x, side: 'long' as const } : { ...x, side: x.side ?? 'long' }) : [];
  };

  /** Draft template from the most recent day before this date (holdings + Bias & Goals & Rules for new-day carryover). */
  const getPreviousDraftTemplate = (date: string): Pick<DailyJournal, 'holding' | 'market' | 'streak' | 'entriesPerDay' | 'goal'> | null => {
    const before = entries.filter((e) => e.date < date).sort((a, b) => b.localeCompare(a));
    const prev = before[0];
    if (!prev) return null;
    const holding = getPreviousHolding(date);
    return {
      holding: holding.length ? holding : undefined,
      market: prev.market,
      streak: prev.streak,
      entriesPerDay: prev.entriesPerDay,
      goal: prev.goal
    };
  };

  const hasEntry = (date: string): boolean =>
    entries.some((e) => e.date === date);

  const saveEntry = (entry: DailyJournal) => {
    setEntries((prev) => {
      const i = prev.findIndex((e) => e.date === entry.date);
      const next = { ...entry };
      if (i === -1) return [...prev, next];
      const clone = [...prev];
      clone[i] = next;
      return clone;
    });
  };

  return { entries, getEntry, getPreviousHolding, getPreviousDraftTemplate, hasEntry, saveEntry };
}
