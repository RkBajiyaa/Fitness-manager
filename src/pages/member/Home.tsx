import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, Meter, StatTile,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { Sparkline, SERIES } from '../../components/charts';
import { RecordWeightSheet } from './RecordWeight';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { count, dateShort, money, relativeDay } from '../../lib/format';
import { parseISO, todayISO } from '../../lib/date';

export default function MemberHome() {
  const { session } = useApp();
  const nav = useNavigate();
  const [weighIn, setWeighIn] = useState(false);
  const today = todayISO();
  const memberId = session?.memberId ?? '';

  const me = useData(() => (session && memberId ? api.members.get(session, memberId) : null), [memberId]);
  const stats = useData(() => (session && memberId ? api.attendance.stats(session, memberId, 30) : null), [memberId]);
  const plan = useData(() => (session && memberId ? api.workouts.planFor(session, memberId) : null), [memberId]);
  const todayLog = useData(() => (session && memberId ? api.workouts.logOn(session, memberId, today) : null), [memberId]);
  const measures = useData(() => (session && memberId ? api.measurements.list(session, memberId) : []), [memberId]);

  if (!session || !me || !stats) return null;

  const { membership, status, daysLeft, dues } = me;
  const dow = parseISO(today).getDay();
  const todayPlan = (plan?.exercises ?? []).filter((e) => e.dayOfWeek === dow).sort((a, b) => a.order - b.order);
  const doneIds = new Set(todayLog?.sets.map((s) => s.exerciseId) ?? []);
  const doneCount = todayPlan.filter((e) => doneIds.has(e.exerciseId)).length;

  const latest = measures[measures.length - 1];
  const prev = measures[measures.length - 2];
  const weightPoints = measures.slice(-12).map((m) => ({ x: m.takenAt, label: m.takenAt, y: m.weightKg }));

  const totalDays = membership
    ? Math.max(1, Math.round(
      (parseISO(membership.endDate).getTime() - parseISO(membership.startDate).getTime()) / 86_400_000) + 1)
    : 0;

  return (
    <div className="anim-page u-col u-gap-4">
      {/* ---- Membership status: the one thing a member checks most ---- */}
      <section className="hero-stat">
        <div className="u-between" style={{ position: 'relative' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-12)', fontWeight: 560, opacity: 0.85 }}>
              {membership ? membership.planNameSnapshot : 'No active membership'}
            </div>
            <div className="hero-stat__value u-mt-2">
              {membership && daysLeft >= 0 ? daysLeft : 0}
              <span style={{ fontSize: 'var(--fs-16)', fontWeight: 560, marginLeft: 8, opacity: 0.9 }}>
                {daysLeft === 1 ? 'day left' : 'days left'}
              </span>
            </div>
            <div className="u-mt-3" style={{ fontSize: 'var(--fs-13)', opacity: 0.9 }}>
              {membership
                ? `Valid until ${dateShort(membership.endDate)}`
                : 'Talk to the front desk to activate a plan'}
            </div>
          </div>
        </div>

        {membership && (
          <div className="u-mt-5" style={{ position: 'relative' }}>
            <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999, background: '#fff',
                width: `${Math.max(2, Math.min(100, (Math.max(0, daysLeft) / totalDays) * 100))}%`,
                transition: 'width var(--dur-slow) var(--ease)',
              }} />
            </div>
            <div className="u-between u-mt-2" style={{ fontSize: 'var(--fs-11)', opacity: 0.85 }}>
              <span>{dateShort(membership.startDate)}</span>
              <span>{dateShort(membership.endDate)}</span>
            </div>
          </div>
        )}
      </section>

      {status === 'expiring' && (
        <Alert tone="warning" icon="clock"
          title={daysLeft === 0 ? 'Your membership ends today' : `Your membership ends in ${daysLeft} days`}
          body="Renew at the front desk to keep your access and your streak going." />
      )}
      {status === 'expired' && (
        <Alert tone="critical" icon="alert" title="Your membership has expired"
          body={`It ended ${relativeDay(membership!.endDate).toLowerCase()}. Renew at the desk to start training again.`} />
      )}
      {dues.due > 0 && (
        <Alert tone="warning" icon="wallet" title={`${money(dues.due)} pending`}
          body={`You have paid ${money(dues.paid)} of ${money(dues.billed)} for this plan.`} />
      )}

      {/* ---- Quick actions: the whole point of the member app ---- */}
      <section>
        <h2 className="t-label u-mb-3">Quick actions</h2>
        <div className="quickgrid">
          <Link className="quickaction" to="/member/workout/log">
            <span className="quickaction__icon"><Icon name="dumbbell" size={18} /></span>
            Log workout
          </Link>
          <button className="quickaction" onClick={() => setWeighIn(true)}>
            <span className="quickaction__icon"><Icon name="scale" size={18} /></span>
            Record weight
          </button>
          <Link className="quickaction" to="/member/diet">
            <span className="quickaction__icon"><Icon name="utensils" size={18} /></span>
            Today's diet
          </Link>
          <Link className="quickaction" to="/member/attendance">
            <span className="quickaction__icon"><Icon name="calendarCheck" size={18} /></span>
            Attendance
          </Link>
        </div>
      </section>

      {/* ---- Today's workout ---- */}
      <Card>
        <CardHead
          title="Today's workout"
          subtitle={todayPlan.length
            ? `${doneCount} of ${todayPlan.length} exercises done`
            : 'Rest day'}
          action={todayPlan.length
            ? <Button size="sm" variant="primary" onClick={() => nav('/member/workout/log')}>Log</Button>
            : undefined}
        />
        <CardBody flush>
          {todayPlan.length === 0 ? (
            <EmptyState
              icon="flame"
              title={plan ? 'Rest day' : 'No plan assigned yet'}
              message={plan
                ? 'Nothing scheduled today. You can still log anything you train.'
                : 'Ask your trainer to assign a workout plan — you can log freely in the meantime.'}
              action={<Button icon="plus" onClick={() => nav('/member/workout/log')}>Log a workout</Button>}
            />
          ) : (
            <>
              <div style={{ padding: 'var(--s-3) var(--s-4) 0' }}>
                <Meter value={doneCount} max={todayPlan.length}
                  tone={doneCount === todayPlan.length ? 'good' : undefined}
                  label={`${doneCount} of ${todayPlan.length} exercises complete`} />
              </div>
              <ul className="cardlist u-mt-3">
                {todayPlan.map((x) => {
                  const done = doneIds.has(x.exerciseId);
                  return (
                    <li key={x.id} className="cardlist__item" style={{ cursor: 'default' }}>
                      <span style={{
                        width: 26, height: 26, flex: 'none', display: 'grid', placeItems: 'center',
                        borderRadius: '50%',
                        background: done ? 'var(--good-soft)' : 'var(--surface-inset)',
                        color: done ? 'var(--good)' : 'var(--text-3)',
                      }}>
                        <Icon name={done ? 'check' : 'dumbbell'} size={13} strokeWidth={2.4} />
                      </span>
                      <span className="u-grow" style={{ minWidth: 0 }}>
                        <span className="t-sm u-truncate" style={{
                          fontWeight: 550, display: 'block',
                          textDecoration: done ? 'line-through' : undefined,
                          color: done ? 'var(--text-3)' : undefined,
                        }}>
                          {api.workouts.exerciseName(x.exerciseId)}
                        </span>
                        <span className="t-xs t-faint">
                          {x.sets} × {x.reps}{x.targetWeight ? ` · ${x.targetWeight} kg` : ''} · rest {x.restSec}s
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      {/* ---- Today's activity + body ---- */}
      <div className="u-col u-gap-3">
        <h2 className="t-label">Your numbers</h2>
        <div className="grid-stats">
          <StatTile label="Sets logged today" icon="zap" value={count(todayLog?.sets.length ?? 0)}
            hint={todayLog ? `${todayLog.durationMin || 0} min` : 'nothing yet'} />
          <StatTile label="Attendance streak" icon="flame" value={`${stats.streak}d`}
            hint={`best ${stats.best} days`} />
          <StatTile
            label="Current weight" icon="scale"
            value={latest ? `${latest.weightKg} kg` : '—'}
            delta={latest && prev
              ? `${latest.weightKg < prev.weightKg ? '−' : '+'}${Math.abs(latest.weightKg - prev.weightKg).toFixed(1)} kg`
              : undefined}
            deltaTone={latest && prev ? (latest.weightKg <= prev.weightKg ? 'good' : 'neutral') : undefined}
            onClick={() => setWeighIn(true)}
          >
            {weightPoints.length > 1 && (
              <div className="stat__spark"><Sparkline points={weightPoints} color={SERIES.s1} /></div>
            )}
          </StatTile>
          <StatTile label="Visits this month" icon="calendarCheck" value={count(stats.visits)}
            hint={`${Math.round(stats.percentage)}% of days`} onClick={() => nav('/member/attendance')} />
        </div>
      </div>

      <div className="u-row u-gap-2 u-wrap u-mt-2">
        <Badge icon="shield">{me.member.memberCode}</Badge>
        <Badge icon="info">You can only ever see your own data</Badge>
      </div>

      {weighIn && <RecordWeightSheet onClose={() => setWeighIn(false)} />}
    </div>
  );
}

function Alert({ tone, icon, title, body }: {
  tone: 'warning' | 'critical'; icon: 'clock' | 'alert' | 'wallet'; title: string; body: string;
}) {
  return (
    <div
      className="u-row u-gap-3"
      style={{
        padding: 'var(--s-4)', borderRadius: 'var(--r-lg)', alignItems: 'flex-start',
        background: tone === 'warning' ? 'var(--warning-soft)' : 'var(--critical-soft)',
        border: `1px solid ${tone === 'warning' ? 'var(--warning-mark)' : 'var(--critical)'}`,
      }}
      role="status"
    >
      <Icon name={icon} size={17}
        style={{ flex: 'none', marginTop: 1, color: tone === 'warning' ? 'var(--warning)' : 'var(--critical)' }} />
      <span>
        <span className="t-sm" style={{ fontWeight: 600 }}>{title}</span>
        <span className="t-xs t-muted" style={{ display: 'block', marginTop: 2 }}>{body}</span>
      </span>
    </div>
  );
}
