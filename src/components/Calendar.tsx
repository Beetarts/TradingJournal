import type { DailyJournal } from '../types';

interface Props {
  year: number;
  month: number;
  selectedDate: string | null;
  entries: DailyJournal[];
  onSelectDate: (date: string) => void;
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [];

  for (let i = 0; i < startDow; i++) week.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Calendar({ year, month, selectedDate, entries, onSelectDate }: Props) {
  const grid = getMonthGrid(year, month);
  const entryDates = new Set(entries.map((e) => e.date));
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="calendar-card">
      <div className="calendar-header">
        <div className="calendar-title">
          {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
        </div>
      </div>
      <div className="calendar-grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="calendar-weekday">
            {d}
          </div>
        ))}
        {grid.flat().map((date, i) => {
          if (!date) {
            return <div key={`empty-${i}`} className="calendar-cell calendar-cell-empty" />;
          }
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const hasJournal = entryDates.has(dateStr);
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isFuture}
              className={`calendar-cell ${isSelected ? 'calendar-cell-selected' : ''} ${hasJournal ? 'calendar-cell-has-entry' : ''} ${isToday ? 'calendar-cell-today' : ''} ${isFuture ? 'calendar-cell-future' : ''}`}
              onClick={() => !isFuture && onSelectDate(dateStr)}
            >
              <span className="calendar-cell-day">{date.getDate()}</span>
              {hasJournal && <span className="calendar-cell-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
