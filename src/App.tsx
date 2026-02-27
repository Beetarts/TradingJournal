import { useEffect, useState } from 'react';
import { Calendar } from './components/Calendar';
import { DayJournal } from './components/DayJournal';
import { useJournalData } from './hooks';

type Theme = 'black' | 'white' | 'dark-blue';

const THEME_KEY = 'trading-journal-theme';

function App() {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const s = localStorage.getItem(THEME_KEY);
    return (s === 'black' || s === 'white' || s === 'dark-blue') ? s : 'dark-blue';
  });
  const { entries, getEntry, getPreviousHolding, getPreviousDraftTemplate, saveEntry } = useJournalData();

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const effectiveDate = selectedDate && selectedDate <= todayStr ? selectedDate : null;

  useEffect(() => {
    if (selectedDate && selectedDate > todayStr) setSelectedDate(null);
  }, [selectedDate, todayStr]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const goPrevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1));
  const goNextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1));
  const goToday = () => {
    const t = new Date();
    setViewDate(t);
    setSelectedDate(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`);
  };

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>Trading Journal</h1>
            <p className="muted">Calendar journal: pick a day to view or edit that day&apos;s notes.</p>
          </div>
          <label className="theme-select-label">
            <span className="theme-label-text">Background</span>
            <select
              className="theme-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
            >
              <option value="dark-blue">Dark blue</option>
              <option value="black">Black</option>
              <option value="white">White</option>
            </select>
          </label>
        </div>
      </header>
      <main className="layout">
        <section className="layout-main">
          <div className="toolbar">
            <div className="toolbar-group">
              <button type="button" className="nav-btn" onClick={goPrevMonth}>◀</button>
              <span className="month-label">
                {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button type="button" className="nav-btn" onClick={goNextMonth}>▶</button>
              <button type="button" className="secondary-button small" onClick={goToday}>Today</button>
            </div>
          </div>
          <Calendar
            year={year}
            month={month}
            selectedDate={effectiveDate}
            entries={entries}
            onSelectDate={setSelectedDate}
          />
        </section>
        <aside className="layout-side">
          <DayJournal
            date={effectiveDate}
            entry={effectiveDate ? getEntry(effectiveDate) : null}
            previousHolding={effectiveDate ? getPreviousHolding(effectiveDate) : []}
            previousDraft={effectiveDate ? getPreviousDraftTemplate(effectiveDate) : null}
            onSave={saveEntry}
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
