import { useState } from 'react';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, PageHead, Pagination, StatTile,
} from '../../components/ui/primitives';
import { DateField, SearchInput, SelectField, TextField } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { CategoryBars, ChartFrame, SERIES } from '../../components/charts';
import { DataTable, type Column } from '../../components/data/DataTable';
import { AddExpenseDialog } from '../../components/dialogs';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { Expense, ExpenseCategory } from '../../lib/types';
import { CATEGORY_LABEL } from '../../lib/derive';
import { count, dateShort, money, titleCase } from '../../lib/format';
import { startOfMonth, todayISO } from '../../lib/date';

const LIMIT = 20;

export default function Expenses() {
  const { session, confirm, toast } = useApp();
  const today = todayISO();

  const [from, setFrom] = useState(startOfMonth(today));
  const [to, setTo] = useState(today);
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all');
  const [min, setMin] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);

  const result = useData(
    () => (session
      ? api.expenses.list(session, {
        from, to, category, q,
        min: min ? Number(min) : undefined,
        page, limit: LIMIT,
      })
      : null),
    [session?.gymId, from, to, category, min, q, page],
  );
  const pl = useData(() => (session ? api.dashboard.profitLoss(session, from, to) : null), [session?.gymId, from, to]);
  const k = useData(() => (session ? api.dashboard.get(session) : null), [session?.gymId]);

  if (!session || !result || !pl || !k) return null;

  const recurring = result.data.filter((e) => e.isRecurring).length;

  const remove = async (e: Expense) => {
    const ok = await confirm({
      title: 'Delete this expense?',
      tone: 'danger',
      confirmLabel: 'Delete expense',
      message: `${money(e.amount)} · ${e.description}. Operating profit for that period will increase by ${money(e.amount)}.`,
    });
    if (!ok) return;
    try {
      await api.expenses.remove(session, e.id);
      toast('success', 'Expense deleted', `${money(e.amount)} removed from ${CATEGORY_LABEL[e.category]}.`);
    } catch { toast('error', 'Could not delete expense'); }
  };

  const columns: Array<Column<Expense>> = [
    {
      key: 'description', header: 'Expense', width: '32%',
      render: (e) => (
        <span style={{ minWidth: 0 }}>
          <span className="t-sm u-truncate" style={{ fontWeight: 560, display: 'block' }}>{e.description}</span>
          <span className="t-xs t-faint">{e.vendor || 'No vendor'}</span>
        </span>
      ),
    },
    { key: 'category', header: 'Category', render: (e) => <Badge>{CATEGORY_LABEL[e.category]}</Badge> },
    { key: 'method', header: 'Paid by', hideBelow: 1280,
      render: (e) => <span className="t-sm t-muted">{titleCase(e.method)}</span> },
    {
      key: 'recurring', header: 'Type',
      render: (e) => e.isRecurring
        ? <Badge tone="brand" icon="refresh">Recurring</Badge>
        : <span className="t-xs t-faint">One-off</span>,
    },
    { key: 'spentAt', header: 'Date', align: 'right',
      render: (e) => <span className="t-sm u-num">{dateShort(e.spentAt)}</span> },
    { key: 'amount', header: 'Amount', align: 'right',
      render: (e) => <span className="t-sm u-num" style={{ fontWeight: 620 }}>{money(e.amount)}</span> },
    {
      key: 'action', header: '', align: 'right',
      render: (e) => (
        <Button size="sm" variant="ghost" icon="trash" aria-label="Delete expense"
          onClick={(ev) => { ev.stopPropagation(); remove(e); }} />
      ),
    },
  ];

  return (
    <div className="anim-page">
      <PageHead
        title="Expenses"
        subtitle="Money out — fixed costs and one-off spending, in one ledger."
        actions={<Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Add expense</Button>}
      />

      <div className="grid-stats u-mb-5">
        <StatTile label="Spent in range" icon="receipt" value={money(pl.totalExpenses)}
          accent={SERIES.s2} hint={`${dateShort(from)} → ${dateShort(to)}`} />
        <StatTile label="Today" icon="calendar" value={money(k.expensesToday)} />
        <StatTile label="This month" icon="trendingUp" value={money(k.expensesMonth)} />
        <StatTile label="Entries" icon="inbox" value={count(result.meta.total)}
          hint={`${recurring} recurring on this page`} />
      </div>

      <div className="grid-2:1 u-mb-5">
        <Card>
          <div className="card__body" style={{ paddingBottom: 'var(--s-4)' }}>
            <div className="toolbar">
              <div className="toolbar__search">
                <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }}
                  placeholder="Search description or vendor" />
              </div>
              <DateField aria-label="From date" value={from} max={to}
                onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
              <DateField aria-label="To date" value={to} min={from} max={today}
                onChange={(e) => { setTo(e.target.value); setPage(1); }} />
              <SelectField aria-label="Category" value={category}
                onChange={(e) => { setCategory(e.target.value as ExpenseCategory | 'all'); setPage(1); }}
                options={[
                  { value: 'all', label: 'All categories' },
                  ...(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
                ]} />
              <TextField aria-label="Minimum amount" placeholder="Min ₹" inputMode="numeric"
                value={min} onChange={(e) => { setMin(e.target.value.replace(/[^\d]/g, '')); setPage(1); }}
                style={{ maxWidth: 110 }} />
            </div>
          </div>

          <CardBody flush>
            <DataTable
              rows={result.data}
              columns={columns}
              keyOf={(e) => e.id}
              caption="Expenses"
              mobile={(e) => (
                <>
                  <span style={{
                    width: 36, height: 36, flex: 'none', display: 'grid', placeItems: 'center',
                    borderRadius: 'var(--r-md)', background: 'var(--serious-soft)', color: 'var(--serious)',
                  }}>
                    <Icon name="arrowUp" size={17} />
                  </span>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="u-between u-gap-2">
                      <span className="t-sm u-truncate" style={{ fontWeight: 580 }}>{e.description}</span>
                      <span className="t-sm u-num" style={{ fontWeight: 620 }}>{money(e.amount)}</span>
                    </span>
                    <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                      {CATEGORY_LABEL[e.category]} · {dateShort(e.spentAt)}{e.vendor ? ` · ${e.vendor}` : ''}
                    </span>
                  </span>
                </>
              )}
              empty={
                <EmptyState
                  icon="receipt" title="No expenses recorded"
                  message="Nothing matches this range and filter. Add an expense to start tracking what the gym spends."
                  action={<Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Add expense</Button>}
                />
              }
            />
            <Pagination page={result.meta.page} totalPages={result.meta.totalPages}
              total={result.meta.total} limit={result.meta.limit} onPage={setPage} unit="expenses" />
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Where the money went" subtitle={`${dateShort(from)} → ${dateShort(to)}`} />
          <CardBody>
            <ChartFrame>
              <CategoryBars
                rows={pl.expenseByCategory}
                format={money}
                color={SERIES.s2}
                emptyLabel="No expenses recorded in this period."
              />
            </ChartFrame>
            {pl.expenseByCategory.length > 0 && (
              <p className="t-xs t-faint u-mt-5">
                One measure across categories, so one colour — the bar length already carries the size.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {open && <AddExpenseDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
