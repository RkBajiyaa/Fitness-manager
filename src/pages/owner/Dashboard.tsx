import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Button, Card, CardBody, CardHead, EmptyState, PageHead, StatTile, StatusBadge,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import {
  BarChart, ChartFrame, DivergingBarChart, Legend, LineChart, SERIES,
} from '../../components/charts';
import { AddExpenseDialog, MarkAttendanceDialog, RecordPaymentDialog, RenewMembershipDialog } from '../../components/dialogs';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { count, dateLong, dayLabel, money, moneyCompact, monthLabel } from '../../lib/format';
import { addDays, addMonths, monthKey, startOfMonth, todayISO } from '../../lib/date';

export default function Dashboard() {
  const { session } = useApp();
  const nav = useNavigate();
  const [dialog, setDialog] = useState<'payment' | 'expense' | 'attendance' | null>(null);
  const [renewId, setRenewId] = useState<string | null>(null);

  const today = todayISO();

  const k = useData(() => (session ? api.dashboard.get(session) : null), [session?.gymId]);
  const revenue = useData(() => (session ? api.dashboard.revenueTrend(session, 6) : []), [session?.gymId]);
  const spend = useData(() => (session ? api.dashboard.expenseTrend(session, 6) : []), [session?.gymId]);
  const growth = useData(() => (session ? api.dashboard.memberGrowth(session, 6) : []), [session?.gymId]);
  const regs = useData(() => (session ? api.dashboard.registrationTrend(session, 6) : { fresh: [], renewals: [] }), [session?.gymId]);
  const attendance = useData(
    () => (session ? api.attendance.trend(session, addDays(today, -29), today) : []),
    [session?.gymId],
  );
  const expiring = useData(() => (session ? api.dashboard.expiring(session, 7) : []), [session?.gymId]);
  const dues = useData(() => (session ? api.payments.outstanding(session) : []), [session?.gymId]);

  if (!session || !k) return null;

  const profitSeries = revenue.map((p, i) => ({ ...p, y: p.y - (spend[i]?.y ?? 0) }));
  const monthLabelNow = monthLabel(monthKey(today));
  const prevMonth = monthKey(addMonths(today, -1));
  const prevRevenue = revenue.find((p) => p.x === prevMonth)?.y ?? 0;
  const revenueDelta = prevRevenue > 0 ? ((k.revenueMonth - prevRevenue) / prevRevenue) * 100 : 0;

  return (
    <div className="anim-page">
      <PageHead
        title={`Good ${greeting()}, ${session.name.split(' ')[0]}`}
        subtitle={dateLong(today)}
        actions={
          <>
            <Button icon="calendarCheck" onClick={() => setDialog('attendance')}>
              <span className="hide-mobile">Mark attendance</span>
              <span className="only-mobile">Attendance</span>
            </Button>
            <Button icon="receipt" onClick={() => setDialog('expense')}>
              <span className="hide-mobile">Add expense</span>
              <span className="only-mobile">Expense</span>
            </Button>
            <Button variant="primary" icon="wallet" onClick={() => setDialog('payment')}>
              <span className="hide-mobile">Record payment</span>
              <span className="only-mobile">Payment</span>
            </Button>
          </>
        }
      />

      {/* ---- The month, as one number ---- */}
      <Card className="u-mb-5">
        <div className="card__body">
          <div className="grid-3" style={{ alignItems: 'center' }}>
            <div>
              <div className="t-label">Operating profit · {monthLabelNow}</div>
              <div
                className="u-mt-2"
                style={{
                  fontSize: 'var(--fs-44)', fontWeight: 680, letterSpacing: '-0.035em', lineHeight: 1.05,
                  color: k.profitMonth >= 0 ? 'var(--text-1)' : 'var(--critical)',
                }}
              >
                {money(k.profitMonth)}
              </div>
              <div className="t-xs t-faint u-mt-2">
                Revenue received minus expenses recorded, month to date.
              </div>
            </div>
            <div className="u-col u-gap-4">
              <MiniLine label="Revenue this month" value={money(k.revenueMonth)}
                delta={prevRevenue > 0 ? `${revenueDelta >= 0 ? '+' : '−'}${Math.abs(revenueDelta).toFixed(0)}% vs last month` : undefined}
                tone={revenueDelta >= 0 ? 'good' : 'bad'} color={SERIES.s1} />
              <MiniLine label="Expenses this month" value={money(k.expensesMonth)} color={SERIES.s2} />
            </div>
            <div className="u-col u-gap-3">
              <div className="u-between">
                <span className="t-sm t-muted">Margin</span>
                <span className="t-sm u-num" style={{ fontWeight: 620 }}>
                  {k.revenueMonth > 0 ? `${((k.profitMonth / k.revenueMonth) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-inset)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${barShare(k.expensesMonth, k.revenueMonth)}%`, background: SERIES.s2 }} />
                <div style={{ width: 2, background: 'var(--surface-1)' }} />
                <div style={{ flex: 1, background: k.profitMonth >= 0 ? SERIES.s1 : 'var(--critical)' }} />
              </div>
              <div className="u-row u-gap-4 t-xs t-faint">
                <span className="u-row u-gap-2">
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: SERIES.s2 }} />Expenses
                </span>
                <span className="u-row u-gap-2">
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: SERIES.s1 }} />Profit
                </span>
              </div>
              <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => nav('/owner/profit-loss')}
                style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
                Full profit &amp; loss
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ---- Today ---- */}
      <h2 className="t-label u-mb-3">Today</h2>
      <div className="grid-stats grid-stats--6 u-mb-5">
        <StatTile label="Attendance" icon="calendarCheck" value={count(k.attendanceToday)}
          hint="members checked in" onClick={() => nav('/owner/attendance')} />
        <StatTile
          label="Inside now" icon="users"
          value={k.insideNow == null ? '—' : count(k.insideNow)}
          hint={k.insideNow == null ? 'no check-out data yet' : 'not yet checked out'}
          onClick={() => nav('/owner/attendance')}
        />
        <StatTile label="Revenue" icon="wallet" value={money(k.revenueToday)}
          hint="received today" onClick={() => nav('/owner/payments')} accent={SERIES.s1} />
        <StatTile label="Expenses" icon="receipt" value={money(k.expensesToday)}
          hint="spent today" onClick={() => nav('/owner/expenses')} accent={SERIES.s2} />
        <StatTile label="New members" icon="userPlus" value={count(k.newToday)}
          hint="registered today" onClick={() => nav('/owner/members')} />
        <StatTile label="Renewals" icon="refresh" value={count(k.renewalsToday)}
          hint="renewed today" onClick={() => nav('/owner/memberships')} />
      </div>

      {/* ---- Membership health ---- */}
      <h2 className="t-label u-mb-3">Membership health</h2>
      <div className="grid-stats u-mb-5">
        <StatTile label="Total members" icon="users" value={count(k.totalMembers)}
          hint="on the roster" onClick={() => nav('/owner/members')} />
        <StatTile label="Active" icon="checkCircle" value={count(k.activeMembers)}
          hint={`${k.totalMembers ? Math.round((k.activeMembers / k.totalMembers) * 100) : 0}% of the roster`}
          accent="var(--good)" onClick={() => nav('/owner/members')} />
        <StatTile label="Expiring in 7 days" icon="clock" value={count(k.expiringSoon)}
          hint="renewal calls to make" accent="var(--warning-mark)"
          onClick={() => nav('/owner/memberships')} />
        <StatTile label="Pending payments" icon="alert" value={money(k.pendingTotal)}
          hint={`${k.pendingCount} member${k.pendingCount === 1 ? '' : 's'} owe money`}
          accent="var(--critical)" onClick={() => nav('/owner/payments')} />
      </div>

      {/* ---- Charts ---- */}
      <div className="grid-2 u-mb-5">
        <Card>
          <CardBody>
            <ChartFrame
              title="Revenue vs expenses"
              subtitle="Last 6 months, money actually received and spent"
              legend={<Legend series={[{ label: 'Revenue', color: SERIES.s1 }, { label: 'Expenses', color: SERIES.s2 }]} />}
            >
              <BarChart
                height={250}
                format={moneyCompact}
                xLabel={(p) => monthLabel(p.label)}
                series={[
                  { key: 'rev', label: 'Revenue', color: SERIES.s1, points: revenue },
                  { key: 'exp', label: 'Expenses', color: SERIES.s2, points: spend },
                ]}
              />
            </ChartFrame>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <ChartFrame title="Operating profit" subtitle="Revenue minus expenses, by month">
              <DivergingBarChart
                points={profitSeries}
                height={250}
                format={moneyCompact}
                xLabel={(p) => monthLabel(p.label)}
              />
            </ChartFrame>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <ChartFrame title="Attendance" subtitle="Distinct members checking in, last 30 days">
              <LineChart
                area
                height={230}
                format={(v) => String(Math.round(v))}
                xLabel={(p) => dayLabel(p.label)}
                series={[{ key: 'att', label: 'Check-ins', color: SERIES.s1, points: attendance }]}
              />
            </ChartFrame>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <ChartFrame
              title="New registrations vs renewals"
              subtitle="How much of the month's growth is new business"
              legend={<Legend series={[{ label: 'New', color: SERIES.s1 }, { label: 'Renewals', color: SERIES.s2 }]} />}
            >
              <BarChart
                height={230}
                format={(v) => String(Math.round(v))}
                xLabel={(p) => monthLabel(p.label)}
                series={[
                  { key: 'new', label: 'New', color: SERIES.s1, points: regs.fresh },
                  { key: 'ren', label: 'Renewals', color: SERIES.s2, points: regs.renewals },
                ]}
              />
            </ChartFrame>
          </CardBody>
        </Card>
      </div>

      <Card className="u-mb-5">
        <CardBody>
          <ChartFrame title="Member growth" subtitle="Total members on the roster at each month end">
            <LineChart
              area
              height={200}
              format={(v) => String(Math.round(v))}
              xLabel={(p) => monthLabel(p.label)}
              series={[{ key: 'g', label: 'Members', color: SERIES.s1, points: growth }]}
            />
          </ChartFrame>
        </CardBody>
      </Card>

      {/* ---- Work queues ---- */}
      <div className="grid-2">
        <Card>
          <CardHead
            title="Expiring in the next 7 days"
            subtitle={expiring.length ? `${expiring.length} membership${expiring.length === 1 ? '' : 's'} to renew` : undefined}
            action={<Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => nav('/owner/memberships')}>All</Button>}
          />
          <CardBody flush>
            {expiring.length === 0 ? (
              <EmptyState icon="checkCircle" title="Nothing expiring this week"
                message="Every active membership has more than a week left." />
            ) : (
              <ul className="cardlist">
                {expiring.slice(0, 6).map((r) => (
                  <li key={r.member.id} className="cardlist__item" style={{ cursor: 'default' }}>
                    <Avatar name={r.member.name} size="sm" />
                    <span className="u-grow u-truncate">
                      <span className="t-sm u-truncate" style={{ fontWeight: 560, display: 'block' }}>{r.member.name}</span>
                      <span className="t-xs t-faint">{r.membership?.planNameSnapshot}</span>
                    </span>
                    <StatusBadge status={r.status} daysLeft={r.daysLeft} />
                    <Button size="sm" variant="primary" onClick={() => setRenewId(r.member.id)}>Renew</Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Who owes money"
            subtitle={dues.length ? `${money(k.pendingTotal)} outstanding across ${dues.length} members` : undefined}
            action={<Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => nav('/owner/payments')}>All</Button>}
          />
          <CardBody flush>
            {dues.length === 0 ? (
              <EmptyState icon="checkCircle" title="Everyone is paid up"
                message="No member currently has a pending balance." />
            ) : (
              <ul className="cardlist">
                {dues.slice(0, 6).map((r) => (
                  <li key={r.member.id} className="cardlist__item" style={{ cursor: 'default' }}>
                    <Avatar name={r.member.name} size="sm" />
                    <span className="u-grow u-truncate">
                      <span className="t-sm u-truncate" style={{ fontWeight: 560, display: 'block' }}>{r.member.name}</span>
                      <span className="t-xs t-faint">
                        paid {money(r.dues.paid)} of {money(r.dues.billed)}
                      </span>
                    </span>
                    <span className="t-sm u-num u-nowrap" style={{ fontWeight: 620, color: 'var(--critical)' }}>
                      {money(r.dues.due)}
                    </span>
                    <Button size="sm" onClick={() => nav(`/owner/members/${r.member.id}`)} aria-label={`Open ${r.member.name}`}>
                      <Icon name="chevronRight" size={15} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <p className="t-xs t-faint u-mt-5 u-center">
        Every figure above is derived from stored events at read time — nothing here is a cached total.
        Period shown: {monthLabel(monthKey(startOfMonth(today)))} to date.
      </p>

      {dialog === 'payment' && <RecordPaymentDialog onClose={() => setDialog(null)} />}
      {dialog === 'expense' && <AddExpenseDialog onClose={() => setDialog(null)} />}
      {dialog === 'attendance' && <MarkAttendanceDialog onClose={() => setDialog(null)} />}
      {renewId && <RenewMembershipDialog memberId={renewId} onClose={() => setRenewId(null)} />}
    </div>
  );
}

function MiniLine({ label, value, delta, tone, color }: {
  label: string; value: string; delta?: string; tone?: 'good' | 'bad'; color: string;
}) {
  return (
    <div>
      <div className="t-xs t-muted u-row u-gap-2">
        <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
        {label}
      </div>
      <div className="t-h2 u-num u-mt-2">{value}</div>
      {delta && (
        <div className="t-xs u-mt-2" style={{ color: tone === 'good' ? 'var(--good)' : 'var(--critical)' }}>
          {delta}
        </div>
      )}
    </div>
  );
}

function barShare(expense: number, revenue: number): number {
  if (revenue <= 0) return 100;
  return Math.min(100, Math.max(0, (expense / revenue) * 100));
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
