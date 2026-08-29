import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import { SkeletonRows } from '../ui/primitives';

/** One breakpoint hook — the whole app agrees on where "desktop" starts. */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    on();
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export const useIsDesktop = () => useMediaQuery('(min-width: 900px)');

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  width?: string;
  hideBelow?: number;                      // px width under which the column is dropped
  render: (row: T) => ReactNode;
}

/**
 * One component, two renderings: a real table at >= 900px, a tappable
 * card list below it. No screen hand-rolls either.
 */
export function DataTable<T>({
  rows, columns, keyOf, onRowClick, mobile, empty, loading,
  sortKey, sortOrder, onSort, caption,
}: {
  rows: T[];
  columns: Array<Column<T>>;
  keyOf: (row: T) => string;
  onRowClick?: (row: T) => void;
  mobile: (row: T) => ReactNode;
  empty: ReactNode;
  loading?: boolean;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  caption?: string;
}) {
  const isDesktop = useIsDesktop();
  const wide = useMediaQuery('(min-width: 1280px)');

  if (loading) return <SkeletonRows rows={6} />;
  if (!rows.length) return <>{empty}</>;

  if (!isDesktop) {
    return (
      <ul className="cardlist">
        {rows.map((row) => (
          <li key={keyOf(row)}>
            <button
              className="cardlist__item"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              type="button"
              style={onRowClick ? undefined : { cursor: 'default' }}
            >
              {mobile(row)}
              {onRowClick && <Icon name="chevronRight" size={16} className="t-faint" />}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  const visible = columns.filter((c) => !c.hideBelow || wide || c.hideBelow <= 1280);

  return (
    <div className="table-wrap">
      <table className="table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {visible.map((c) => (
              <th key={c.key} style={{ width: c.width, textAlign: c.align }} scope="col"
                aria-sort={sortKey === c.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}>
                {c.sortable && onSort ? (
                  <button onClick={() => onSort(c.key)}>
                    {c.header}
                    <Icon
                      name={sortKey === c.key ? (sortOrder === 'asc' ? 'arrowUp' : 'arrowDown') : 'chevronDown'}
                      size={12}
                      style={{ opacity: sortKey === c.key ? 1 : 0.35 }}
                    />
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyOf(row)}
              data-clickable={onRowClick ? 'true' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); }
              } : undefined}
            >
              {visible.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'cell-num' : undefined}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
