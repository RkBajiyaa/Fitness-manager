import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, CardHead } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { Ring } from '../../components/ui/Ring';
import { RecordWeightSheet } from './RecordWeight';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { sessionVolume } from '../../lib/derive';
import { dateShort, money, relativeDay } from '../../lib/format';
import { addDays, todayISO } from '../../lib/date';

export default function MemberHome() {
  const { session, toast } = useApp();
  const nav = useNavigate();
  const [weighIn, setWeighIn] = useState(false);
  const today = todayISO();
  const memberId = session?.memberId ?? '';

  const me = useData(() => (session && memberId ? api.members.get(session, memberId) : null), [memberId]);
  const streaks = useData(() => (session && memberId ? api.streaks.forMember(session, memberId) : null), [memberId]);
  const day = useData(() => (session && memberId ? api.programs.today(session, memberId) : null), [memberId]);
  const program = useData(() => (session && memberId ? api.programs.forMember(session, memberId) : null), [memberId]);
  const todaySession = useData(() => (session && memberId ? api.sessions.onDate(session, memberId, today) : null), [memberId]);
  const activeSession = useData(() => (session && memberId ? api.sessions.active(session, memberId) : null), [memberId]);
  const latest = useData(() => (session && memberId ? api.measurements.latest(session, memberId) : null), [memberId]);
  const waterMl = useData(() => (session && memberId ? api.water.today(session, memberId) : 0), [memberId]);
  const recentSessions = useData(() => (session && memberId ? api.sessions.completed(session, memberId).slice(0, 8) : []), [memberId]);
  const news = useData(() => (session ? api.announcements.list(session) : []), [session?.gymId]);

  if (!session || !me || !streaks) return null;

  const { member, membership, status, daysLeft, dues } = me;
  const first = member.name.split(' ')[0];
  const target = member.fitness.waterTargetMl;
  const weighedToday = latest?.takenAt === today;
  const doneIds = new Set(todaySession?.sets.map((s) => s.exerciseId) ?? []);
  const planned = day?.exercises ?? [];
  const doneCount = planned.filter((e) => doneIds.has(e.exerciseId)).length;
  const restDay = Boolean(day?.isRest) || (Boolean(program) && planned.length === 0);
  const weekVolume = recentSessions
    .filter((s) => s.date >= addDays(today, -6))
    .reduce((sum, s) => sum + sessionVolume(s), 0);

  const addWater = async (ml: number) => {
    if (!session || !memberId) return;
    const total = await api.water.add(session, memberId, ml);
    if (ml > 0 && total >= target && total - ml < target) {
      toast('success', 'Hydration target reached', `${(total / 1000).toFixed(1)} L today. Well done.`);
    }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  return (
    <div className="anim-page u-col u-gap-4">
      {/* ---- Consistency is the hero, not the expiry date ---- */}
      <section className="mhero">
        <div className="mhero__greeting" style={{ position: 'relative' }}>{greeting}, {first}</div>

        {streaks.training.current > 0 ? (
          <>
            <div className="mhero__headline">
              <span className="mhero__streak">
                {streaks.training.current}<span>day streak</span>
              </span>
            </div>
            <p className="mhero__sub">
              {streaks.training.trainedToday
                ? "Today's session is done. That's how it's built."
                : streaks.training.restToday
                  ? 'Scheduled rest day — recovery keeps the streak going.'
                  : "Train today to keep it going."}
            </p>
          </>
        ) : (
          <>
            <div className="mhero__headline">
              {streaks.totalSessions > 0 ? 'Time to start a new streak' : 'Your first session is waiting'}
            </div>
            <p className="mhero__sub">
              {streaks.totalSessions > 0
                ? `${streaks.totalSessions} sessions logged so far. One today restarts the run.`
                : 'Everything your coach has planned is ready in the app.'}
            </p>
          </>
        )}

        <div className="mhero__chips">
          <span className="mhero__chip">
            <Icon name="dumbbell" size={13} />{streaks.sessionsThisMonth} this month
          </span>
          <span className="mhero__chip">
            <Icon name="target" size={13} />{streaks.weekly.hit} of 8 weeks on target
          </span>
          {streaks.training.longest > streaks.training.current && (
            <span className="mhero__chip">
              <Icon name="trophy" size={13} />best {streaks.training.longest}
            </span>
          )}
        </div>
      </section>

      {/* ---- Membership only speaks up when it actually matters ---- */}
      {status === 'expiring' && (
        <div className="inline-alert inline-alert--warning">
          <Icon name="clock" size={17} style={{ flex: 'none', marginTop: 1, color: 'var(--warning)' }} />
          <span>
            <span className="t-sm" style={{ fontWeight: 600 }}>
              {daysLeft === 0 ? 'Your membership ends today' : `Renewal due in ${daysLeft} days`}
            </span>
            <span className="t-xs t-muted" style={{ display: 'block', marginTop: 2 }}>
              Speak to the front desk to keep your training uninterrupted.
            </span>
          </span>
        </div>
      )}
      {status === 'expired' && (
        <div className="inline-alert inline-alert--critical">
          <Icon name="alert" size={17} style={{ flex: 'none', marginTop: 1, color: 'var(--critical)' }} />
          <span>
            <span className="t-sm" style={{ fontWeight: 600 }}>Your membership has expired</span>
            <span className="t-xs t-muted" style={{ display: 'block', marginTop: 2 }}>
              It ended {relativeDay(membership!.endDate).toLowerCase()}. Renew at the studio to start training again.
            </span>
          </span>
        </div>
      )}
      {dues.due > 0 && (
        <div className="inline-alert inline-alert--warning">
          <Icon name="wallet" size={17} style={{ flex: 'none', marginTop: 1, color: 'var(--warning)' }} />
          <span className="t-sm">
            <strong>{money(dues.due)} outstanding</strong> on your current plan.
            <span className="t-xs t-muted" style={{ display: 'block', marginTop: 2 }}>
              You have paid {money(dues.paid)} of {money(dues.billed)}.
            </span>
          </span>
        </div>
      )}

      {/* ---- Today ---- */}
      <section className="todaycard">
        <div className="todaycard__head">
          <div className="todaycard__eyebrow">Today</div>
          <div className="todaycard__title">
            {activeSession ? activeSession.title
              : restDay ? 'Rest day'
              : day?.title ?? (program ? 'Free session' : 'Train freely')}
          </div>
          <div className="todaycard__focus">
            {activeSession ? 'Session in progress'
              : restDay ? (day?.notes || 'Recovery is part of the plan. Move, eat, sleep.')
              : day?.focus || 'No plan assigned yet — log whatever you train.'}
          </div>
        </div>

        {planned.length > 0 && !restDay && (
          <ul className="todaycard__list">
            {planned.slice(0, 6).map((x, i) => {
              const done = doneIds.has(x.exerciseId);
              return (
                <li key={x.id} className={`exline ${done ? 'exline--done' : ''}`}>
                  <span className="exline__idx">{done ? <Icon name="check" size={12} strokeWidth={2.6} /> : i + 1}</span>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="exline__name u-truncate" style={{ display: 'block' }}>
                      {api.exercises.name(x.exerciseId)}
                    </span>
                  </span>
                  <span className="exline__target u-nowrap">
                    {x.sets} × {x.reps}{x.targetWeightKg ? ` · ${x.targetWeightKg} kg` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="todaycard__foot">
          {activeSession ? (
            <Button variant="primary" size="lg" block icon="play" onClick={() => nav('/member/session')}>
              Continue workout
            </Button>
          ) : todaySession ? (
            <div className="u-row u-gap-3">
              <span className="u-grow u-row u-gap-2 t-sm" style={{ color: 'var(--good)', fontWeight: 560 }}>
                <Icon name="checkCircle" size={16} />
                Completed · {todaySession.sets.filter((s) => s.kind !== 'warmup').length} sets
              </span>
              <Button onClick={() => nav('/member/workout')}>View</Button>
            </div>
          ) : restDay ? (
            <Button block icon="dumbbell" onClick={() => nav('/member/session')}>
              Train anyway
            </Button>
          ) : (
            <Button variant="primary" size="lg" block icon="play" onClick={() => nav('/member/session')}>
              Start workout{planned.length ? ` · ${planned.length} exercises` : ''}
            </Button>
          )}
          {doneCount > 0 && doneCount < planned.length && (
            <p className="t-xs t-faint u-mt-3 u-center">{doneCount} of {planned.length} exercises done today</p>
          )}
        </div>
      </section>

      {/* ---- Today's three targets ---- */}
      <section>
        <div className="ringrow">
          <button className="ringcell" onClick={() => nav(todaySession ? '/member/workout' : '/member/session')}>
            <Ring value={todaySession || activeSession ? 1 : 0} max={1} size={58}
              color="var(--brand)" label="Session completed today">
              <Icon name="dumbbell" size={18} style={{ color: todaySession ? 'var(--brand)' : 'var(--text-3)' }} />
            </Ring>
            <span className="ringcell__label">Session</span>
            <span className="ringcell__value">{todaySession ? 'Done' : restDay ? 'Rest' : 'To do'}</span>
          </button>

          <div className="ringcell" style={{ cursor: 'default' }}>
            <Ring value={waterMl} max={target} size={58} color="var(--series-1)"
              label={`Hydration ${Math.round((waterMl / target) * 100)} percent`}>
              <span className="t-xs u-num" style={{ fontWeight: 640 }}>
                {(waterMl / 1000).toFixed(1)}
              </span>
            </Ring>
            <span className="ringcell__label">Water</span>
            <span className="ringcell__value">{(target / 1000).toFixed(1)} L target</span>
          </div>

          <button className="ringcell" onClick={() => setWeighIn(true)}>
            <Ring value={weighedToday ? 1 : 0} max={1} size={58} color="var(--series-3)"
              label="Weight logged today">
              <Icon name="scale" size={18} style={{ color: weighedToday ? 'var(--series-3)' : 'var(--text-3)' }} />
            </Ring>
            <span className="ringcell__label">Weight</span>
            <span className="ringcell__value">{latest ? `${latest.weightKg} kg` : '—'}</span>
          </button>
        </div>

        <div className="u-row u-gap-2 u-mt-3" style={{ justifyContent: 'center' }}>
          <Button size="sm" icon="plus" onClick={() => addWater(250)}>250 ml</Button>
          <Button size="sm" icon="plus" onClick={() => addWater(500)}>500 ml</Button>
          {waterMl > 0 && (
            <Button size="sm" variant="ghost" icon="undo" onClick={() => addWater(-1)} aria-label="Undo last glass" />
          )}
        </div>
      </section>

      {/* ---- Quick actions ---- */}
      <section>
        <h2 className="t-label u-mb-3">Quick actions</h2>
        <div className="quickgrid">
          <Link className="quickaction" to="/member/session">
            <span className="quickaction__icon"><Icon name="dumbbell" size={18} /></span>
            Log workout
          </Link>
          <button className="quickaction" onClick={() => setWeighIn(true)}>
            <span className="quickaction__icon"><Icon name="scale" size={18} /></span>
            Record weight
          </button>
          <Link className="quickaction" to="/member/exercises">
            <span className="quickaction__icon"><Icon name="library" size={18} /></span>
            Exercises
          </Link>
          <Link className="quickaction" to="/member/records">
            <span className="quickaction__icon"><Icon name="trophy" size={18} /></span>
            Records
          </Link>
        </div>
      </section>

      {/* ---- This week ---- */}
      <Card>
        <CardHead
          title="This week"
          subtitle={`${streaks.weekly.series[streaks.weekly.series.length - 1]?.count ?? 0} of ${streaks.weeklyTarget} sessions`}
          action={<Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => nav('/member/progress')}>Progress</Button>}
        />
        <CardBody>
          <div className="u-row u-gap-2" style={{ marginBottom: 'var(--s-4)' }}>
            {streaks.weekly.series.slice(-8).map((w) => (
              <div key={w.weekStart} className="u-grow" title={`Week of ${dateShort(w.weekStart)}: ${w.count} sessions`}>
                <div
                  style={{
                    height: 34, borderRadius: 5,
                    background: w.hit ? 'var(--brand)' : w.count > 0 ? 'var(--surface-inset)' : 'var(--surface-3)',
                    opacity: w.count === 0 ? 0.6 : 1,
                    display: 'grid', placeItems: 'center',
                    color: w.hit ? 'var(--brand-ink)' : 'var(--text-3)',
                    fontSize: 'var(--fs-11)', fontWeight: 640,
                  }}
                >
                  {w.count}
                </div>
              </div>
            ))}
          </div>
          <div className="u-between t-xs t-faint">
            <span>8 weeks ago</span>
            <span>This week</span>
          </div>

          {weekVolume > 0 && (
            <div className="u-between u-mt-5 t-sm">
              <span className="t-muted">Volume lifted, last 7 days</span>
              <span className="u-num" style={{ fontWeight: 620 }}>
                {Math.round(weekVolume).toLocaleString('en-IN')} kg
              </span>
            </div>
          )}
        </CardBody>
      </Card>

      {news.length > 0 && (
        <Card>
          <CardHead title="From the studio" />
          <CardBody flush>
            <ul className="cardlist">
              {news.slice(0, 2).map((a) => (
                <li key={a.id} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="t-sm" style={{ fontWeight: 580 }}>{a.title}</span>
                    <span className="t-xs t-muted" style={{ display: 'block', marginTop: 3, lineHeight: 1.55 }}>
                      {a.body}
                    </span>
                    <span className="t-xs t-faint" style={{ display: 'block', marginTop: 4 }}>
                      {relativeDay(a.publishedAt.slice(0, 10))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* ---- Membership, quietly, at the bottom where it belongs ---- */}
      {membership && status === 'active' && (
        <p className="quiet-note u-center">
          {membership.planNameSnapshot} · active until {dateShort(membership.endDate)}
          {' · '}
          <button className="auth__link" onClick={() => nav('/member/profile')} style={{ fontSize: 'inherit' }}>
            details
          </button>
        </p>
      )}

      {weighIn && <RecordWeightSheet onClose={() => setWeighIn(false)} />}
    </div>
  );
}
