import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, CardBody, CardHead, EmptyState, PageHead, StatTile, StatusBadge,
} from '../../components/ui/primitives';
import { PeriodPicker, periodRange, type Period } from '../../components/ui/PeriodPicker';
import { Icon, type IconName } from '../../components/ui/Icon';
import {
  BarChart, CategoryBars, ChartFrame, DivergingBarChart, Legend, LineChart, SERIES,
} from '../../components/charts';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { count, dateShort, dayLabel, money, moneyCompact, monthLabel, pct, relativeDay } from '../../lib/format';
import { CATEGORY_LABEL } from '../../lib/derive';

type ReportKey =
  | 'membership' | 'attendance' | 'revenue' | 'expense' | 'profit'
  | 'pending' | 'expiring' | 'registrations';

const REPORTS: Array<{ key: ReportKey; label: string; icon: IconName; blurb: string }> = [
  { key: 'membership', label: 'Membership', icon: 'card', blurb: 'Roster health, plan mix and growth' },
  { key: 'attendance', label: 'Attendance', icon: 'calendarCheck', blurb: 'Daily footfall and the most regular members' },
  { key: 'revenue', label: 'Revenue', icon: 'trendingUp', blurb: 'What came in, and what it was for' },
  { key: 'expense', label: 'Expenses', icon: 'receipt', blurb: 'What went out, by category' },
  { key: 'profit', label: 'Profit & loss', icon: 'chart', blurb: 'Operating profit month by month' },
  { key: 'pending', label: 'Pending payments', icon: 'alert', blurb: 'Everyone who still owes money' },
  { key: 'expiring', label: 'Expiring memberships', icon: 'clock', blurb: 'The renewal call list' },
  { key: 'registrations', label: 'New vs renewals', icon: 'userPlus', blurb: 'How much growth is new business' },
];

export default function Reports() {
  const { session, toast } = useApp();
  const [report, setReport] = useState<ReportKey>('membership');
  const [period, setPeriod] = useState<Period>(() => ({ key: 'last_6', ...periodRange('last_6') }));

  const totals = useData(
    () => (session ? api.reports.totals(session, period.from, period.to) : null),
    [session?.gymId, period.from, period.to],
  );

  if (!session || !totals) return null;
  const active = REPORTS.find((r) => r.key === report)!;

  return (
    <div className="anim-page">
      <PageHead
        title="Reports"
        subtitle="Every report is a query over the same events — nothing here is pre-computed."
        actions={
          <Button icon="download" onClick={() => toast('info', 'Export coming later',
            'CSV and PDF export ship with the reporting service; the data shapes are already report-ready.')}>
            Export
          </Button>
        }
      />

      <div className="u-mb-4">
        <div className="u-row u-gap-2 u-wrap">
          {REPORTS.map((r) => (
            <button key={r.key} className="chip" aria-pressed={report === r.key} onClick={() => setReport(r.key)}>
              <Icon name={r.icon} size={13} />{r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="u-mb-5"><PeriodPicker value={period} onChange={setPeriod} /></div>

      <div className="grid-stats u-mb-5">
        <StatTile label="Revenue" icon="trendingUp" value={money(totals.revenue)} accent={SERIES.s1} />
        <StatTile label="Expenses" icon="receipt" value={money(totals.expenses)} accent={SERIES.s2} />
        <StatTile label={totals.profit >= 0 ? 'Operating profit' : 'Operating loss'} icon="chart"
          value={money(Math.abs(totals.profit))}
          accent={totals.profit >= 0 ? 'var(--good)' : 'var(--critical)'} />
        <StatTile label="Memberships sold" icon="card" value={count(totals.newMembers + totals.renewals)}
          hint={`${totals.newMembers} new · ${totals.renewals} renewals`} />
      </div>

      <Card>
        <CardHead
          title={`${active.label} report`}
          subtitle={`${active.blurb} · ${dateShort(period.from)} → ${dateShort(period.to)}`}
        />
        <CardBody>
          {report === 'membership' && <MembershipReport period={period} />}
          {report === 'attendance' && <AttendanceReport period={period} />}
          {report === 'revenue' && <RevenueReport period={period} />}
          {report === 'expense' && <ExpenseReport period={period} />}
          {report === 'profit' && <ProfitReport period={period} />}
          {report === 'pending' && <PendingReport />}
          {report === 'expiring' && <ExpiringReport />}
          {report === 'registrations' && <RegistrationReport period={period} />}
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------- individual reports ---------------- */

function MembershipReport({ period }: { period: Period }) {
  const { session } = useApp();
  const counts = useData(() => (session ? api.members.counts(session) : null), [session?.gymId]);
  const all = useData(() => (session ? api.memberships.list(session, { status: 'all' }) : []), [session?.gymId]);
  const plans = useData(() => (session ? api.plans.list(session) : []), [session?.gymId]);
  const growth = useData(() => (session ? api.dashboard.memberGrowth(session, 12) : []), [session?.gymId]);
  if (!counts) return null;

  const byPlan = plans.map((p) => ({
    key: p.id, label: p.name, amount: all.filter((r) => r.membership?.planId === p.id).length,
  })).filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);

  return (
    <div className="u-col u-gap-6">
      <div className="grid-stats">
        <StatTile label="On the roster" icon="users" value={count(counts.all)} />
        <StatTile label="Active" icon="checkCircle" value={count(counts.active)} accent="var(--good)" />
        <StatTile label="Expiring" icon="clock" value={count(counts.expiring)} accent="var(--warning-mark)" />
        <StatTile label="Expired" icon="alert" value={count(counts.expired)} accent="var(--critical)" />
      </div>
      <div className="grid-2:1">
        <ChartFrame title="Member growth" subtitle="Roster size at each month end">
          <LineChart area height={240} format={(v) => String(Math.round(v))}
            xLabel={(p) => monthLabel(p.label)}
            series={[{ key: 'g', label: 'Members', color: SERIES.s1, points: growth }]} />
        </ChartFrame>
        <div>
          <h3 className="t-h3 u-mb-4">Plan mix</h3>
          <CategoryBars rows={byPlan} format={(v) => `${v} members`}
            emptyLabel="No memberships sold yet." />
        </div>
      </div>
      <p className="t-xs t-faint">Period selected: {dateShort(period.from)} → {dateShort(period.to)}. Roster
        counts are always as of today; growth is historical.</p>
    </div>
  );
}

function AttendanceReport({ period }: { period: Period }) {
  const { session } = useApp();
  const trend = useData(
    () => (session ? api.attendance.trend(session, period.from, period.to) : []),
    [session?.gymId, period.from, period.to],
  );
  const members = useData(
    () => (session ? api.members.list(session, { limit: 1000 }).data : []),
    [session?.gymId],
  );
  const top = useData(() => {
    if (!session) return [];
    return members
      .map((m) => ({ member: m.member, stats: api.attendance.stats(session, m.member.id, 30) }))
      .filter((r) => r.stats.visits > 0)
      .sort((a, b) => b.stats.visits - a.stats.visits)
      .slice(0, 10);
  }, [session?.gymId, members.length]);

  const total = trend.reduce((s, p) => s + p.y, 0);
  const avg = trend.length ? total / trend.length : 0;
  const best = trend.reduce((a, b) => (b.y > a.y ? b : a), trend[0] ?? { x: '', label: '', y: 0 });

  return (
    <div className="u-col u-gap-6">
      <div className="grid-stats">
        <StatTile label="Total check-ins" icon="calendarCheck" value={count(total)} />
        <StatTile label="Daily average" icon="activity" value={count(Math.round(avg))} />
        <StatTile label="Busiest day" icon="flame" value={count(best.y)}
          hint={best.label ? dateShort(best.label) : undefined} />
        <StatTile label="Days covered" icon="calendar" value={count(trend.length)} />
      </div>
      <ChartFrame title="Daily attendance" subtitle="Distinct members checking in">
        <LineChart area height={250} format={(v) => String(Math.round(v))}
          xLabel={(p) => dayLabel(p.label)}
          series={[{ key: 'a', label: 'Check-ins', color: SERIES.s1, points: trend }]} />
      </ChartFrame>
      <div>
        <h3 className="t-h3 u-mb-4">Most regular members · last 30 days</h3>
        {top.length === 0 ? <EmptyState icon="users" title="No attendance recorded" /> : (
          <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            {top.map((r, i) => (
              <li key={r.member.id} className="cardlist__item" style={{ cursor: 'default' }}>
                <span className="t-xs t-faint u-num" style={{ width: 20 }}>{i + 1}</span>
                <Avatar name={r.member.name} size="sm" />
                <span className="u-grow u-truncate t-sm" style={{ fontWeight: 550 }}>{r.member.name}</span>
                <span className="t-xs t-faint u-nowrap">{pct(r.stats.percentage)}</span>
                <Badge tone="brand">{r.stats.visits} visits</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RevenueReport({ period }: { period: Period }) {
  const { session } = useApp();
  const pl = useData(() => (session ? api.dashboard.profitLoss(session, period.from, period.to) : null),
    [session?.gymId, period.from, period.to]);
  const byMonth = useData(() => (session ? api.reports.revenueByMonth(session, period.from, period.to) : []),
    [session?.gymId, period.from, period.to]);
  if (!pl) return null;

  return (
    <div className="grid-2:1">
      <ChartFrame title="Revenue by month">
        <BarChart height={260} format={moneyCompact} xLabel={(p) => monthLabel(p.label)}
          series={[{ key: 'r', label: 'Revenue', color: SERIES.s1, points: byMonth }]} />
      </ChartFrame>
      <div>
        <h3 className="t-h3 u-mb-4">By source</h3>
        <CategoryBars rows={pl.revenueBySource} format={money} emptyLabel="No revenue in this period." />
      </div>
    </div>
  );
}

function ExpenseReport({ period }: { period: Period }) {
  const { session } = useApp();
  const pl = useData(() => (session ? api.dashboard.profitLoss(session, period.from, period.to) : null),
    [session?.gymId, period.from, period.to]);
  const byMonth = useData(() => (session ? api.reports.expenseByMonth(session, period.from, period.to) : []),
    [session?.gymId, period.from, period.to]);
  const rows = useData(() => (session ? api.expenses.list(session, { from: period.from, to: period.to, limit: 8 }).data : []),
    [session?.gymId, period.from, period.to]);
  if (!pl) return null;

  return (
    <div className="u-col u-gap-6">
      <div className="grid-2:1">
        <ChartFrame title="Expenses by month">
          <BarChart height={260} format={moneyCompact} xLabel={(p) => monthLabel(p.label)}
            series={[{ key: 'e', label: 'Expenses', color: SERIES.s2, points: byMonth }]} />
        </ChartFrame>
        <div>
          <h3 className="t-h3 u-mb-4">By category</h3>
          <CategoryBars rows={pl.expenseByCategory} format={money} color={SERIES.s2}
            emptyLabel="No expenses in this period." />
        </div>
      </div>
      <div>
        <h3 className="t-h3 u-mb-4">Largest recent entries</h3>
        {rows.length === 0 ? <p className="t-sm t-faint">Nothing recorded.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>
                <th scope="col">Description</th><th scope="col">Category</th>
                <th scope="col">Date</th><th scope="col" style={{ textAlign: 'right' }}>Amount</th>
              </tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="t-sm">{e.description}</td>
                    <td><Badge>{CATEGORY_LABEL[e.category]}</Badge></td>
                    <td className="t-sm u-num">{dateShort(e.spentAt)}</td>
                    <td className="cell-num" style={{ fontWeight: 600 }}>{money(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfitReport({ period }: { period: Period }) {
  const { session } = useApp();
  const rev = useData(() => (session ? api.reports.revenueByMonth(session, period.from, period.to) : []),
    [session?.gymId, period.from, period.to]);
  const exp = useData(() => (session ? api.reports.expenseByMonth(session, period.from, period.to) : []),
    [session?.gymId, period.from, period.to]);
  const profit = rev.map((p, i) => ({ ...p, y: p.y - (exp[i]?.y ?? 0) }));

  return (
    <div className="u-col u-gap-6">
      <ChartFrame
        title="Revenue vs expenses"
        legend={<Legend series={[{ label: 'Revenue', color: SERIES.s1 }, { label: 'Expenses', color: SERIES.s2 }]} />}
      >
        <BarChart height={250} format={moneyCompact} xLabel={(p) => monthLabel(p.label)}
          series={[
            { key: 'r', label: 'Revenue', color: SERIES.s1, points: rev },
            { key: 'e', label: 'Expenses', color: SERIES.s2, points: exp },
          ]} />
      </ChartFrame>
      <ChartFrame title="Operating profit" subtitle="Above the line is profit, below it is loss">
        <DivergingBarChart points={profit} height={230} format={moneyCompact}
          xLabel={(p) => monthLabel(p.label)} />
      </ChartFrame>
    </div>
  );
}

function PendingReport() {
  const { session } = useApp();
  const nav = useNavigate();
  const rows = useData(() => (session ? api.payments.outstanding(session) : []), [session?.gymId]);
  const total = rows.reduce((s, r) => s + r.dues.due, 0);

  if (!rows.length) {
    return <EmptyState icon="checkCircle" title="Nobody owes money"
      message="Every membership in the gym is fully paid." />;
  }

  return (
    <div className="u-col u-gap-4">
      <div className="grid-stats">
        <StatTile label="Total outstanding" icon="alert" value={money(total)} accent="var(--critical)" />
        <StatTile label="Members" icon="users" value={count(rows.length)} />
        <StatTile label="Average balance" icon="wallet" value={money(Math.round(total / rows.length))} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr>
            <th scope="col">Member</th><th scope="col">Plan</th>
            <th scope="col" style={{ textAlign: 'right' }}>Billed</th>
            <th scope="col" style={{ textAlign: 'right' }}>Paid</th>
            <th scope="col" style={{ textAlign: 'right' }}>Balance</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.member.id} data-clickable="true" onClick={() => nav(`/owner/members/${r.member.id}`)}>
                <td className="t-sm">{r.member.name}</td>
                <td className="t-sm t-muted">{r.membership?.planNameSnapshot ?? '—'}</td>
                <td className="cell-num">{money(r.dues.billed)}</td>
                <td className="cell-num t-muted">{money(r.dues.paid)}</td>
                <td className="cell-num" style={{ color: 'var(--critical)', fontWeight: 620 }}>{money(r.dues.due)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpiringReport() {
  const { session } = useApp();
  const nav = useNavigate();
  const rows = useData(() => (session ? api.dashboard.expiring(session, 30) : []), [session?.gymId]);

  if (!rows.length) {
    return <EmptyState icon="checkCircle" title="Nothing expiring in the next 30 days" />;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>
          <th scope="col">Member</th><th scope="col">Plan</th><th scope="col">Status</th>
          <th scope="col">Expires</th><th scope="col" style={{ textAlign: 'right' }}>Phone</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.member.id} data-clickable="true" onClick={() => nav(`/owner/members/${r.member.id}`)}>
              <td className="t-sm">{r.member.name}</td>
              <td className="t-sm t-muted">{r.membership?.planNameSnapshot}</td>
              <td><StatusBadge status={r.status} daysLeft={r.daysLeft} /></td>
              <td className="t-sm u-num">
                {dateShort(r.membership!.endDate)}
                <span className="t-xs t-faint" style={{ marginLeft: 6 }}>{relativeDay(r.membership!.endDate)}</span>
              </td>
              <td className="cell-num t-muted">{r.member.phone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegistrationReport({ period }: { period: Period }) {
  const { session } = useApp();
  const months = Math.max(1, Math.min(12,
    (Number(period.to.slice(0, 4)) - Number(period.from.slice(0, 4))) * 12
    + (Number(period.to.slice(5, 7)) - Number(period.from.slice(5, 7))) + 1));
  const regs = useData(() => (session ? api.dashboard.registrationTrend(session, months) : { fresh: [], renewals: [] }),
    [session?.gymId, months]);

  const totalNew = regs.fresh.reduce((s, p) => s + p.y, 0);
  const totalRenew = regs.renewals.reduce((s, p) => s + p.y, 0);
  const retention = totalNew + totalRenew > 0 ? (totalRenew / (totalNew + totalRenew)) * 100 : 0;

  return (
    <div className="u-col u-gap-6">
      <div className="grid-stats">
        <StatTile label="New registrations" icon="userPlus" value={count(totalNew)} accent={SERIES.s1} />
        <StatTile label="Renewals" icon="refresh" value={count(totalRenew)} accent={SERIES.s2} />
        <StatTile label="Renewal share" icon="target" value={pct(retention)}
          hint="of all memberships sold" />
      </div>
      <ChartFrame
        title="New vs renewals by month"
        legend={<Legend series={[{ label: 'New', color: SERIES.s1 }, { label: 'Renewals', color: SERIES.s2 }]} />}
      >
        <BarChart height={250} format={(v) => String(Math.round(v))} xLabel={(p) => monthLabel(p.label)}
          series={[
            { key: 'n', label: 'New', color: SERIES.s1, points: regs.fresh },
            { key: 'r', label: 'Renewals', color: SERIES.s2, points: regs.renewals },
          ]} />
      </ChartFrame>
    </div>
  );
}
