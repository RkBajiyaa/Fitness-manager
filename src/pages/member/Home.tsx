import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, CardHead } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { Ring } from '../../components/ui/Ring';
import { ExerciseThumb } from '../../components/member/ExerciseThumb';
import { RecordWeightSheet } from './RecordWeight';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { sessionVolume } from '../../lib/derive';
import { dateShort, money, relativeDay } from '../../lib/format';
import { addDays, todayISO } from '../../lib/date';

/** Cross-module reads: a gym can have Diet or Hydration switched off. */
function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export default function MemberHome() {
  const { session, toast, has } = useApp();
  const nav = useNavigate();
  const [weighIn, setWeighIn] = useState(false);
  const today = todayISO();
  const memberId = session?.memberId ?? '';

  const me = useData(() => (session && memberId ? safe(() => api.members.get(session, memberId), null) : null), [memberId]);
  const streaks = useData(() => (session && memberId ? safe(() => api.streaks.forMember(session, memberId), null) : null), [memberId]);
  const day = useData(() => (session && memberId ? safe(() => api.programs.today(session, memberId), null) : null), [memberId]);
  const program = useData(() => (session && memberId ? safe(() => api.programs.forMember(session, memberId), null) : null), [memberId]);
  const todaySession = useData(() => (session && memberId ? safe(() => api.sessions.onDate(session, memberId, today), null) : null), [memberId]);
  const activeSession = useData(() => (session && memberId ? safe(() => api.sessions.active(session, memberId), null) : null), [memberId]);
  const latest = useData(() => (session && memberId ? safe(() => api.measurements.latest(session, memberId), null) : null), [memberId]);
  const waterMl = useData(() => (session && memberId ? safe(() => api.water.today(session, memberId), 0) : 0), [memberId]);
  const recentSessions = useData(() => (session && memberId ? safe(() => api.sessions.completed(session, memberId).slice(0, 8), []) : []), [memberId]);
  const news = useData(() => (session ? safe(() => api.announcements.list(session), []) : []), [session?.gymId]);
  const platformNews = useData(() => api.platform.publishedUpdates('members'), []);
  const myWorkouts = useData(
    () => (session && memberId ? safe(() => api.workouts.list(session, memberId), []) : []),
    [memberId],
  );
  /*
   * Today's nutrition, from the same two rows the Diet screen reads.
   * Derived here rather than stored: a cached "calories today" is a
   * number that goes stale the moment a meal is un-ticked.
   */
  const nutrition = useData(() => {
    if (!session || !memberId) return null;
    return safe(() => {
      const bundle = api.diet.forMember(session, memberId);
      const plan = bundle.assigned ?? bundle.personal;
      if (!plan) return null;
      const ticked = api.diet.completions(session, memberId, today);
      return {
        eaten: plan.items.filter((i) => ticked.has(i.id)).reduce((n, i) => n + i.calories, 0),
        planned: plan.items.reduce((n, i) => n + i.calories, 0),
      };
    }, null);
  }, [memberId]);

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
                  <ExerciseThumb exerciseId={x.exerciseId} name={api.exercises.name(x.exerciseId)} size="sm" />
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

          {has('hydration_tracking') && (
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
          )}

          {has('diet_plans') && nutrition && nutrition.planned > 0 && (
            <button className="ringcell" onClick={() => nav('/member/diet')}>
              {/* Same shape as the hydration ring on purpose: progress
                  inside, the target underneath. Two adjacent rings that
                  read differently is two things to learn, not one. */}
              <Ring value={nutrition.eaten} max={nutrition.planned} size={58} color="var(--series-2)"
                label={`Nutrition ${Math.round((nutrition.eaten / nutrition.planned) * 100)} percent of today's plan`}>
                <span className="t-xs u-num" style={{ fontWeight: 640 }}>
                  {nutrition.eaten >= 1000
                    ? `${(nutrition.eaten / 1000).toFixed(1)}k`
                    : nutrition.eaten}
                </span>
              </Ring>
              <span className="ringcell__label">Food</span>
              <span className="ringcell__value">
                {nutrition.planned.toLocaleString('en-IN')} kcal target
              </span>
            </button>
          )}

          {has('body_measurements') && (
            <button className="ringcell" onClick={() => setWeighIn(true)}>
              <Ring value={weighedToday ? 1 : 0} max={1} size={58} color="var(--series-3)"
                label="Weight logged today">
                <Icon name="scale" size={18} style={{ color: weighedToday ? 'var(--series-3)' : 'var(--text-3)' }} />
              </Ring>
              <span className="ringcell__label">Weight</span>
              <span className="ringcell__value">{latest ? `${latest.weightKg} kg` : '—'}</span>
            </button>
          )}
        </div>

        {has('hydration_tracking') && (
          <div className="u-row u-gap-2 u-mt-3" style={{ justifyContent: 'center' }}>
            <Button size="sm" icon="plus" onClick={() => addWater(250)}>250 ml</Button>
            <Button size="sm" icon="plus" onClick={() => addWater(500)}>500 ml</Button>
            {waterMl > 0 && (
              <Button size="sm" variant="ghost" icon="undo" onClick={() => addWater(-1)} aria-label="Undo last glass" />
            )}
          </div>
        )}
      </section>

      {/*
        A brand-new member. No fabricated streak, no fake achievement —
        just the three things that make the app start working for them.
      */}
      {streaks.totalSessions === 0 && !latest && (
        <Card>
          <CardHead
            title="Your first steps"
            subtitle="Nothing here is filled in for you — it starts when you do"
          />
          <CardBody flush>
            <ul className="cardlist">
              {has('body_measurements') && (
              <li>
                <button className="cardlist__item" onClick={() => setWeighIn(true)}>
                  <span className="quickaction__icon"><Icon name="scale" size={17} /></span>
                  <span className="u-grow">
                    <span className="t-sm" style={{ fontWeight: 550 }}>Record your weight</span>
                    <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                      The first point on your progress chart
                    </span>
                  </span>
                  <Icon name="chevronRight" size={15} className="t-faint" />
                </button>
              </li>
              )}
              {has('workout_builder') && (
                <li>
                  <Link className="cardlist__item" to="/member/workouts/new">
                    <span className="quickaction__icon"><Icon name="layers" size={17} /></span>
                    <span className="u-grow">
                      <span className="t-sm" style={{ fontWeight: 550 }}>Build your first workout</span>
                      <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                        Pick exercises once, start it with one tap after that
                      </span>
                    </span>
                    <Icon name="chevronRight" size={15} className="t-faint" />
                  </Link>
                </li>
              )}
              <li>
                <Link className="cardlist__item" to="/member/session">
                  <span className="quickaction__icon"><Icon name="play" size={17} /></span>
                  <span className="u-grow">
                    <span className="t-sm" style={{ fontWeight: 550 }}>Log a session</span>
                    <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                      Your records and streak start from the first set you finish
                    </span>
                  </span>
                  <Icon name="chevronRight" size={15} className="t-faint" />
                </Link>
              </li>
            </ul>
          </CardBody>
        </Card>
      )}

      {/* ---- Quick actions ---- */}
      <section>
        <h2 className="t-label u-mb-3">Quick actions</h2>
        <div className="quickgrid">
          <Link className="quickaction" to="/member/session">
            <span className="quickaction__icon"><Icon name="dumbbell" size={18} /></span>
            Log workout
          </Link>
          {has('body_measurements') && (
            <button className="quickaction" onClick={() => setWeighIn(true)}>
              <span className="quickaction__icon"><Icon name="scale" size={18} /></span>
              Record weight
            </button>
          )}
          {has('workout_builder') && (
            <Link className="quickaction" to="/member/workouts">
              <span className="quickaction__icon"><Icon name="layers" size={18} /></span>
              My workouts
              {myWorkouts.length > 0 && <span className="quickaction__count">{myWorkouts.length}</span>}
            </Link>
          )}
          {has('exercise_library') && (
            <Link className="quickaction" to="/member/exercises">
              <span className="quickaction__icon"><Icon name="library" size={18} /></span>
              Exercises
            </Link>
          )}
          {has('personal_records') && (
            <Link className="quickaction" to="/member/records">
              <span className="quickaction__icon"><Icon name="trophy" size={18} /></span>
              Records
            </Link>
          )}
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

      {(news.length > 0 || platformNews.length > 0) && (
        <Card>
          <CardHead title={news.length ? 'From the studio' : 'From Fitness Manager'} />
          <CardBody flush>
            <ul className="cardlist">
              {(news.length
                ? news.slice(0, 2)
                : platformNews.slice(0, 2).map((u) => ({
                  id: u.id, title: u.title, body: u.body,
                  publishedAt: u.publishedAt ?? u.createdAt,
                }))
              ).map((a) => (
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
