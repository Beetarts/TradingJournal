import { useState, useEffect, useCallback, useRef } from 'react';
import type { DailyJournal, TradePosition } from '../types';

type PreviousDraft = Pick<DailyJournal, 'holding' | 'market' | 'streak' | 'entriesPerDay' | 'goal'> | null;

interface Props {
  date: string | null;
  entry: DailyJournal | null;
  previousHolding: TradePosition[];
  previousDraft: PreviousDraft;
  onSave: (entry: DailyJournal) => void;
}

const TEXT_FIELDS: { name: keyof DailyJournal; label: string }[] = [
  { name: 'market', label: 'Market' },
  { name: 'goal', label: 'Goal' },
];

type TradeKey = 'holding' | 'newEntry' | 'failedEntry' | 'stopped' | 'closed';

const TRADE_LABELS: { key: TradeKey; label: string }[] = [
  { key: 'holding', label: 'Holding' },
  { key: 'newEntry', label: 'New Entry' },
  { key: 'failedEntry', label: 'Failed Entry' },
  { key: 'stopped', label: 'Stopped' },
  { key: 'closed', label: 'Closed' },
];

function toPositionList(v: TradePosition[] | string[] | string | undefined): TradePosition[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map((x) => {
      if (typeof x === 'string') return { symbol: x.trim(), side: 'long' as const };
      return {
        symbol: x.symbol.trim(),
        percent: x.percent?.trim() || undefined,
        side: x.side ?? 'long'
      };
    }).filter((x) => x.symbol);
  }
  const s = String(v).trim();
  return s ? [{ symbol: s, side: 'long' }] : [];
}

function formatPosition(p: TradePosition): string {
  return p.percent ? `${p.symbol} (${p.percent}%)` : p.symbol;
}

const AUTO_SAVE_DELAY_MS = 800;

export function DayJournal({ date, entry, previousHolding, previousDraft, onSave }: Props) {
  const [holding, setHolding] = useState<TradePosition[]>([]);
  const [newEntry, setNewEntry] = useState<TradePosition[]>([]);
  const [failedEntry, setFailedEntry] = useState<TradePosition[]>([]);
  const [stopped, setStopped] = useState<TradePosition[]>([]);
  const [closed, setClosed] = useState<TradePosition[]>([]);
  const [addingKey, setAddingKey] = useState<TradeKey | null>(null);
  const [addSymbol, setAddSymbol] = useState('');
  const [addPercent, setAddPercent] = useState('');
  const [addSide, setAddSide] = useState<'long' | 'short'>('long');
  const lastDateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!date) return;
    const isNewDate = lastDateRef.current !== date;
    lastDateRef.current = date;

    if (entry) {
      setHolding(toPositionList(entry.holding));
      setNewEntry(toPositionList(entry.newEntry));
      setFailedEntry(toPositionList(entry.failedEntry));
      setStopped(toPositionList(entry.stopped));
      setClosed(toPositionList(entry.closed));
    } else {
      const carryOver = previousDraft?.holding?.length ? previousDraft.holding : previousHolding;
      setHolding(carryOver?.length ? carryOver.map((p) => ({ ...p, side: p.side ?? 'long' })) : []);
      setNewEntry([]);
      setFailedEntry([]);
      setStopped([]);
      setClosed([]);
    }
    if (isNewDate) setAddSide('long'); // Only reset L/S when switching days; not when save creates entry for same day
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previousHolding/previousDraft excluded to avoid reset on parent re-render
  }, [date, entry]);

  const formRef = useRef<HTMLFormElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const buildCurrentEntry = useCallback((): DailyJournal | null => {
    if (!date || !formRef.current) return null;
    const form = formRef.current;
    const next: DailyJournal = { date };
    const scalarKeys: (keyof DailyJournal)[] = [
      'market', 'streak', 'entriesPerDay', 'goal',
      'preMarketPlan',
      'complianceScore', 'complianceComment',
      'remarks', 'postMarketThought'
    ];
    scalarKeys.forEach((key) => {
      const el = form.elements.namedItem(key);
      if (el && 'value' in el) {
        const val = (el as HTMLInputElement | HTMLTextAreaElement).value.trim();
        if (val) {
          if (key === 'streak' && (val === 'win' || val === 'lose')) {
            next.streak = val;
          } else if (key !== 'streak') {
            (next as Record<string, string>)[key] = val;
          }
        }
      }
    });
    next.holding = holding.length ? holding : undefined;
    next.newEntry = newEntry.length ? newEntry : undefined;
    next.failedEntry = failedEntry.length ? failedEntry : undefined;
    next.stopped = stopped.length ? stopped : undefined;
    next.closed = closed.length ? closed : undefined;
    return next;
  }, [date, holding, newEntry, failedEntry, stopped, closed]);

  const triggerAutoSave = useCallback(() => {
    if (!date) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      const next = buildCurrentEntry();
      if (next) {
        onSave(next);
        setLastSavedAt(Date.now());
      }
    }, AUTO_SAVE_DELAY_MS);
  }, [date, buildCurrentEntry, onSave]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (holding.length > 0 || newEntry.length > 0 || failedEntry.length > 0 || stopped.length > 0 || closed.length > 0) {
      triggerAutoSave();
    }
  }, [holding, newEntry, failedEntry, stopped, closed, triggerAutoSave]);

  const addTo = (key: TradeKey, symbol: string, percent?: string) => {
    const trimmed = symbol.trim().toUpperCase();
    if (!trimmed) return;
    const pct = percent?.trim();
    if (key === 'newEntry') {
      const pctNum = pct ? parseInt(pct, 10) : NaN;
      if (!pct || pctNum < 1 || pctNum > 100 || !Number.isInteger(pctNum)) return;
    }
    const pos: TradePosition = { symbol: trimmed, percent: pct || undefined, side: addSide };
    if (key === 'newEntry') {
      setNewEntry((prev) => [...prev, pos]);
      setHolding((prev) => (prev.some((x) => x.symbol === trimmed) ? prev : [...prev, pos]));
    } else if (key === 'stopped' || key === 'closed') {
      if (key === 'stopped') setStopped((prev) => [...prev, pos]);
      else setClosed((prev) => [...prev, pos]);
      setHolding((prev) => {
        const existing = prev.find((x) => x.symbol === trimmed);
        if (!existing) return prev;
        const closedPct = pct ? parseInt(pct, 10) : NaN;
        const heldPct = existing.percent ? parseInt(existing.percent, 10) : NaN;
        if (!isNaN(closedPct) && !isNaN(heldPct)) {
          const remaining = heldPct - closedPct;
          if (remaining <= 0) return prev.filter((x) => x.symbol !== trimmed);
          return prev.map((x) => x.symbol === trimmed ? { ...x, percent: String(remaining) } : x);
        }
        return prev.filter((x) => x.symbol !== trimmed);
      });
    } else if (key === 'failedEntry') {
      setFailedEntry((prev) => [...prev, pos]);
    }
    setAddSymbol('');
    setAddPercent('');
    setAddSide('long');
    setAddingKey(null);
  };

  const removeFrom = (key: TradeKey, symbol: string) => {
    if (key === 'newEntry') {
      setNewEntry((prev) => prev.filter((x) => x.symbol !== symbol));
      setHolding((prev) => prev.filter((x) => x.symbol !== symbol));
    } else if (key === 'failedEntry') setFailedEntry((prev) => prev.filter((x) => x.symbol !== symbol));
    else if (key === 'stopped') setStopped((prev) => prev.filter((x) => x.symbol !== symbol));
    else if (key === 'closed') setClosed((prev) => prev.filter((x) => x.symbol !== symbol));
  };

  if (!date) {
    return (
      <div className="panel journal-panel">
        <div className="panel-title">Daily journal</div>
        <p className="muted">Click a day on the calendar to view or edit that day&apos;s journal.</p>
      </div>
    );
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const form = e.currentTarget;
    const next: DailyJournal = { date };
    const scalarKeys: (keyof DailyJournal)[] = [
      'market', 'streak', 'entriesPerDay', 'goal',
      'preMarketPlan',
      'complianceScore', 'complianceComment',
      'remarks', 'postMarketThought'
    ];
    scalarKeys.forEach((key) => {
      const el = form.elements.namedItem(key);
      if (el && 'value' in el) {
        const val = (el as HTMLInputElement | HTMLTextAreaElement).value.trim();
        if (val) {
          if (key === 'streak' && (val === 'win' || val === 'lose')) next.streak = val;
          else if (key !== 'streak') (next as Record<string, string>)[key] = val;
        }
      }
    });
    next.holding = holding.length ? holding : undefined;
    next.newEntry = newEntry.length ? newEntry : undefined;
    next.failedEntry = failedEntry.length ? failedEntry : undefined;
    next.stopped = stopped.length ? stopped : undefined;
    next.closed = closed.length ? closed : undefined;
    onSave(next);
    setLastSavedAt(Date.now());
  };

  const displayDate = new Date(date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const positionLists: Record<TradeKey, TradePosition[]> = {
    holding,
    newEntry,
    failedEntry,
    stopped,
    closed
  };

  // For new drafts: carry over only holdings + Bias & Goals & Rules. Other sections start empty.
  const biasSource = entry ?? previousDraft;
  const otherSource = entry;

  return (
    <div className="panel journal-panel">
      <div className="panel-title journal-date">{displayDate}</div>
      <form
        key={date}
        ref={formRef}
        className="journal-form"
        onSubmit={handleSubmit}
        onInput={(e) => { if (!(e.target as Element).closest('.journal-side-toggle')) triggerAutoSave(); }}
        onChange={(e) => { if (!(e.target as Element).closest('.journal-side-toggle')) triggerAutoSave(); }}
      >
        <fieldset className="journal-fieldset">
          <legend className="journal-section-label">Bias & Goals & Rules</legend>
          <div className="journal-row-fields">
            {TEXT_FIELDS.map(({ name, label }) => (
              <label key={name} className="journal-inline-label">
                <span className="journal-field-label">{label}:</span>
                <input type="text" name={name} defaultValue={biasSource?.[name] ?? ''} placeholder="" />
              </label>
            ))}
            <label className="journal-inline-label">
              <span className="journal-field-label">Streak:</span>
              <select name="streak" defaultValue={biasSource?.streak ?? 'win'}>
                <option value="win">Win</option>
                <option value="lose">Lose</option>
              </select>
            </label>
            <label className="journal-inline-label journal-entries-day">
              <span className="journal-field-label">Entries:</span>
              <input type="text" name="entriesPerDay" defaultValue={biasSource?.entriesPerDay ?? ''} placeholder="" inputMode="numeric" />
              <span className="journal-suffix">/day</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="journal-fieldset">
          <legend className="journal-section-label">Pre-Market Plan</legend>
          <textarea name="preMarketPlan" rows={3} defaultValue={otherSource?.preMarketPlan ?? ''} placeholder="" />
        </fieldset>

        <fieldset className="journal-fieldset">
          <legend className="journal-section-label">Trades</legend>
          <p className="journal-hint muted">New Entry adds to Holding (with portfolio %). Stopped/Closed remove from Holding.</p>
          <div className="journal-trade-lists">
            {TRADE_LABELS.map(({ key, label }) => (
              <div key={key} className="journal-trade-group">
                <span className="journal-trade-group-label">{label}</span>
                <div className="journal-chips">
                  {key === 'holding' ? (
                    holding.map((p) => (
                      <span key={p.symbol} className={`journal-chip journal-chip-readonly journal-chip-${p.side ?? 'long'}`}>
                        <span className="journal-chip-side">{p.side === 'short' ? 'S' : 'L'}</span>
                        {p.symbol}{p.percent ? ` (${p.percent}%)` : ''}
                      </span>
                    ))
                  ) : (
                    <>
                      {positionLists[key].map((p) => (
                        <span key={p.symbol} className={`journal-chip journal-chip-${p.side ?? 'long'}`}>
                          <span className="journal-chip-side">{p.side === 'short' ? 'S' : 'L'}</span>
                          {formatPosition(p)}
                          <button
                            type="button"
                            className="journal-chip-remove"
                            onClick={() => removeFrom(key, p.symbol)}
                            aria-label={`Remove ${p.symbol}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {addingKey === key ? (
                        <span className="journal-add-inline">
                          <span className="journal-side-toggle" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`journal-side-btn ${addSide === 'long' ? 'journal-side-long active' : ''}`}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddSide('long'); }}
                              title="Long"
                            >
                              L
                            </button>
                            <button
                              type="button"
                              className={`journal-side-btn ${addSide === 'short' ? 'journal-side-short active' : ''}`}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddSide('short'); }}
                              title="Short"
                            >
                              S
                            </button>
                          </span>
                          <input
                            type="text"
                            className="journal-chip-input"
                            value={addSymbol}
                            onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
                            placeholder="Symbol"
                            autoFocus
                          />
                          <input
                            type="text"
                            className="journal-chip-input journal-percent-input"
                            value={addPercent}
                            onChange={(e) => setAddPercent(e.target.value.replace(/\D/g, ''))}
                            placeholder={key === 'newEntry' ? '% (required)' : '%'}
                            inputMode="numeric"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (key === 'newEntry' && (!addPercent.trim() || !/^\d+$/.test(addPercent) || parseInt(addPercent, 10) < 1 || parseInt(addPercent, 10) > 100)) return;
                                addTo(key, addSymbol, addPercent);
                              }
                              if (e.key === 'Escape') {
                                setAddingKey(null);
                                setAddSymbol('');
                                setAddPercent('');
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="journal-add-confirm"
                            onClick={() => addTo(key, addSymbol, addPercent)}
                            disabled={key === 'newEntry' && (!addPercent.trim() || !/^\d+$/.test(addPercent) || parseInt(addPercent, 10) < 1 || parseInt(addPercent, 10) > 100)}
                          >
                            Add
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="journal-add-btn"
                          onClick={() => setAddingKey(key)}
                        >
                          + Add
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="journal-fieldset">
          <legend className="journal-section-label">Compliance</legend>
          <div className="journal-compliance-row">
            <label className="journal-inline-label journal-compliance">
              <input type="text" name="complianceScore" defaultValue={otherSource?.complianceScore ?? ''} placeholder="" inputMode="numeric" />
              <span className="journal-suffix">/10</span>
            </label>
            <label className="journal-compliance-comment">
              <span className="journal-field-label">Comment on today&apos;s action</span>
              <textarea name="complianceComment" rows={2} defaultValue={otherSource?.complianceComment ?? ''} placeholder="Brief comment on the day's action" />
            </label>
          </div>
        </fieldset>

        <fieldset className="journal-fieldset">
          <legend className="journal-section-label">Remarks</legend>
          <textarea
            name="remarks"
            rows={4}
            defaultValue={otherSource?.remarks?.trim() ? otherSource.remarks : '- '}
            placeholder="Press Enter for a new bullet point"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const ta = e.currentTarget;
                const start = ta.selectionStart ?? 0;
                const end = ta.selectionEnd ?? 0;
                const val = ta.value;
                const before = val.slice(0, start);
                const after = val.slice(end);
                ta.value = before + '\n- ' + after;
                ta.setSelectionRange(start + 3, start + 3);
              }
            }}
          />
        </fieldset>

        <fieldset className="journal-fieldset">
          <legend className="journal-section-label">Post market thought</legend>
          <textarea name="postMarketThought" rows={4} defaultValue={otherSource?.postMarketThought ?? ''} placeholder="" />
        </fieldset>

        <div className="journal-actions">
          <button type="submit" className="primary-button">Save journal</button>
          {lastSavedAt != null && (
            <span className="journal-saved-indicator">Saved</span>
          )}
        </div>
      </form>
    </div>
  );
}
