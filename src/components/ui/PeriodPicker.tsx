import { DateField } from './forms';
import { addDays, addMonths, endOfMonth, startOfMonth, todayISO } from '../../lib/date';
import type { ISODate } from '../../lib/types';

export type PeriodKey = 'this_month' | 'last_month' | 'last_3' | 'last_6' | 'last_12' | 'custom';

export interface Period { key: PeriodKey; from: ISODate; to: ISODate }

const OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_3', label: '3 months' },
  { key: 'last_6', label: '6 months' },
  { key: 'last_12', label: '12 months' },
  { key: 'custom', label: 'Custom' },
];

export function periodRange(key: PeriodKey, today = todayISO()): { from: ISODate; to: ISODate } {
  switch (key) {
    case 'last_month': {
      const prev = addMonths(today, -1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case 'last_3': return { from: startOfMonth(addMonths(today, -2)), to: today };
    case 'last_6': return { from: startOfMonth(addMonths(today, -5)), to: today };
    case 'last_12': return { from: startOfMonth(addMonths(today, -11)), to: today };
    case 'custom': return { from: addDays(today, -30), to: today };
    default: return { from: startOfMonth(today), to: today };
  }
}

/** Date-range control. One row, above the charts it filters. */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const today = todayISO();
  return (
    <div className="toolbar">
      <div className="segmented" role="group" aria-label="Reporting period">
        {OPTIONS.map((o) => (
          <button
            key={o.key} type="button" aria-pressed={value.key === o.key}
            onClick={() => onChange({ key: o.key, ...periodRange(o.key, today) })}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value.key === 'custom' && (
        <>
          <DateField aria-label="From date" value={value.from} max={value.to}
            onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <DateField aria-label="To date" value={value.to} min={value.from} max={today}
            onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </>
      )}
    </div>
  );
}

export function useInitialPeriod(key: PeriodKey = 'last_6'): Period {
  return { key, ...periodRange(key) };
}
