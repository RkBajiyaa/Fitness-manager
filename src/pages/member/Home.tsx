/* ============================================================
   THE MEMBER HOME — a fitness dashboard, not an account page.

   The first screen answers one question, and the rest of it is
   ordered by how often a member asks the next one:

     1  WHAT AM I DOING TODAY?   the workout, as the hero, with
                                 its state on it and one button.
     2  AM I ON TRACK TODAY?     the four daily targets.
     3  AM I CONSISTENT?         streak and the last eight weeks.
     4  AM I GETTING ANYWHERE?   body weight and volume, moving.
     5  the things people tap for often enough to deserve a tile.
     6  MY MEMBERSHIP            once, quietly, and only as loudly
                                 as the situation actually is.

   What changed and why: this screen used to open with a streak
   headline and then THREE stacked alerts — a renewal countdown, an
   outstanding balance and a paid-of-billed breakdown — before it
   ever mentioned training. Three separate alarms about one fact is
   how a fitness app starts feeling like an invoice. Membership is
   now one strip that knows how to be quiet, and it sits below the
   training.

   Nothing was removed. Hydration, nutrition, weigh-in, the
   first-week checklist, quick actions, studio news and the weekly
   history are all still here — they are just no longer competing
   with each other for the top of the page.
   ============================================================ */
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
  const weights = useData(() => (session && memberId ? safe(() => api.measurements.list(session, memberId), []) : []), [memberId]);
  const waterMl = useData(() => (session && memberId ? safe(() => api.water.today(session, memberId), 0) : 0), [memberId]);
  const recentSessions = useData(() => (session && memberId ? safe(() => api.sessions.completed(session, memberId).slice(0, 12), []) : []), [memberId]);
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

  /** Body weight, now versus roughly a month ago. Only if there are two points. */
  const weightTrend = (() => {
    if (weights.length < 2 || !latest) return null;
    const cutoff = addDays(today, -35);
    const earlier = [...weights].reverse().find((m) => m.takenAt <= cutoff) ?? weights[0];
    if (earlier.id === latest.id) return null;
    const delta = latest.weightKg - earlier.weightKg;
    if (Math.abs(delta) < 0.15) return { delta: 0, since: earlier.takenAt };
    return { delta, since: earlier.takenAt };
  })();

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

  /* ---- today's state, decided once and used everywhere ---- */
  const state: 'active' | 'done' | 'rest' | 'todo' =
    activeSession ? 'active' : todaySession ? 'done' : restDay ? 'rest' : 'todo';
  const workedSets = todaySession?.sets.filter((s) => s.kind !== 'warmup').length ?? 0;
  const title = activeSession ? activeSession.title
    : state === 'rest' ? 'Rest day'
      : day?.title ?? (program ? 'Free session' : 'Train freely');

  return (
    <div className="anim-page u-col u-gap-4">
      <p className="mgreet">
        {greeting}, {first}
        <span>{relativeDay(today)}</span>
      </p>

      {/* ============================================================
          1 — TODAY. The hero, and the only thing on this screen
          that gets to be this big.
          ============================================================ */}
      <section className={`todayhero todayhero--${state}`}>
        <div className="todayhero__head">
          <span className={`todayhero__state todayhero__state--${state}`}>
            {state === 'active' ? 'In progress'
              : state === 'done' ? 'Completed'
                : state === 'rest' ? 'Rest day' : "Today's workout"}
            {/* Which programme this day belongs to. It answers "what am
                I following at the moment" without needing a row of its
                own, and it is the one piece of membership-adjacent
                context that is genuinely about training. */}
            {program?.name && <em>{program.name}</em>}
          </span>
          <h1 className="todayhero__title">{title}</h1>
          <p className="todayhero__focus">
            {state === 'active' ? 'Pick up where you left off.'
              : state === 'done' ? `${workedSets} sets logged${weekVolume > 0 ? '' : ''}. Recovery starts now.`
                : state === 'rest' ? (day?.notes || 'Recovery is part of the plan. Move, eat, sleep.')
                  : day?.focus || 'No plan assigned yet — log whatever you train.'}
          </p>
        </div>

        {/* The movements, as pictures. A member who cannot read
            "Romanian Deadlift" can still recognise the shape of it,
            and this is the one place every exercise of the day is
            visible without opening anything. */}
        {planned.length > 0 && state !== 'rest' && (
          <ul className="todayhero__strip" aria-label="Today's exercises">
            {planned.slice(0, 6).map((x) => {
              const done = doneIds.has(x.exerciseId);
              return (
                <li key={x.id} className={done ? 'is-done' : ''}>
                  <ExerciseThumb exerciseId={x.exerciseId} name={api.exercises.name(x.exerciseId)} />
                  {done && <span className="todayhero__tick"><Icon name="check" size={11} strokeWidth={3} /></span>}
                </li>
              );
            })}
            {planned.length > 6 && <li className="todayhero__more">+{planned.length - 6}</li>}
          </ul>
        )}

        {planned.length > 0 && state !== 'rest' && (
          <p className="todayhero__meta">
            {planned.length} exercises
            {doneCount > 0 && doneCount < planned.length && ` · ${doneCount} done`}
            {day?.focus && state !== 'todo' ? ` · ${day.focus}` : ''}
          </p>
        )}

        <div className="todayhero__act">
          {state === 'active' ? (
            <Button variant="primary" size="lg" block icon="play" onClick={() => nav('/member/session')}>
              Continue workout
            </Button>
          ) : state === 'done' ? (
            <div className="u-row u-gap-3">
              <span className="u-grow u-row u-gap-2 t-sm" style={{ color: 'var(--good)', fontWeight: 560 }}>
                <Icon name="checkCircle" size={16} />
                Done · {workedSets} sets
              </span>
              <Button onClick={() => nav('/member/workout')}>View</Button>
            </div>
          ) : state === 'rest' ? (
            <Button block icon="dumbbell" onClick={() => nav('/member/session')}>Train anyway</Button>
          ) : (
            <Button variant="primary" size="lg" block icon="play" onClick={() => nav('/member/session')}>
              Start workout
            </Button>
          )}
        </div>
      </section>

      {/* ============================================================
          2 — TODAY'S TARGETS
          ============================================================ */}
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
            <span className="ringcell__value">of {(target / 1000).toFixed(1)} L</span>
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
                of {nutrition.planned.toLocaleString('en-IN')} kcal
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

      {/* ============================================================
          3 — CONSISTENCY. The streak and the eight weeks behind it
          belong together: one is the headline and the other is the
          evidence, and they used to be at opposite ends of the page.
          ============================================================ */}
      {streaks.totalSessions > 0 && (
        <section className="mcard">
          <div className="mcard__head">
            <h2 className="mcard__title">Consistency</h2>
            <button className="mcard__link" onClick={() => nav('/member/progress')}>
              Progress <Icon name="arrowRight" size={13} />
            </button>
          </div>

          <div className="consist">
            <div className="consist__streak">
              <span className="consist__num">{streaks.training.current}</span>
              <span className="consist__unit">day<br />streak</span>
            </div>
            <div className="consist__weeks">
              <div className="weekbars" aria-hidden="true">
                {streaks.weekly.series.slice(-8).map((w) => (
                  <span key={w.weekStart}
                    className={`weekbars__b ${w.hit ? 'is-hit' : w.count > 0 ? 'is-some' : ''}`}
                    title={`Week of ${dateShort(w.weekStart)}: ${w.count} sessions`}>
                    {w.count}
                  </span>
                ))}
              </div>
              <p className="consist__note">
                {streaks.training.trainedToday
                  ? "Today's session is done. That's how it's built."
                  : streaks.training.restToday
                    ? 'Scheduled rest day — recovery keeps the streak going.'
                    : `${streaks.weekly.hit} of the last 8 weeks on target.`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
          4 — PROGRESS. Two numbers that have actually moved, or
          nothing at all. A dashboard of zeroes is worse than a
          screen that waits until it has something to say.
          ============================================================ */}
      {(weightTrend || weekVolume > 0) && (
        <section className="mcard">
          <div className="mcard__head">
            <h2 className="mcard__title">Recent progress</h2>
            <button className="mcard__link" onClick={() => nav('/member/progress')}>
              Details <Icon name="arrowRight" size={13} />
            </button>
          </div>
          <div className="progrow">
            {weightTrend && latest && (
              <div className="progrow__item">
                <span className="progrow__label">Body weight</span>
                <span className="progrow__value u-num">{latest.weightKg} kg</span>
                <span className={`progrow__delta ${weightTrend.delta === 0 ? '' : weightTrend.delta > 0 ? 'is-up' : 'is-down'}`}>
                  {weightTrend.delta === 0
                    ? 'Holding steady'
                    : `${weightTrend.delta > 0 ? '+' : ''}${weightTrend.delta.toFixed(1)} kg since ${dateShort(weightTrend.since)}`}
                </span>
              </div>
            )}
            {weekVolume > 0 && (
              <div className="progrow__item">
                <span className="progrow__label">Volume, last 7 days</span>
                <span className="progrow__value u-num">
                  {Math.round(weekVolume).toLocaleString('en-IN')} kg
                </span>
                <span className="progrow__delta">
                  {streaks.sessionsThisMonth} sessions this month
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---- 5 — Quick actions ---- */}
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

      {/* ============================================================
          6 — MEMBERSHIP. Once.

          This used to be three stacked alerts — a countdown, a
          balance and a paid-of-billed line — each shouting at the
          same volume, above the training. They are one fact about
          one membership, so they are one strip, and it only raises
          its voice when the situation has actually changed.
          ============================================================ */}
      <MembershipStrip
        planName={membership?.planNameSnapshot ?? null}
        endDate={membership?.endDate ?? null}
        status={status}
        daysLeft={daysLeft}
        dues={dues}
        onOpen={() => nav('/member/profile')}
      />

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

      {weighIn && <RecordWeightSheet onClose={() => setWeighIn(false)} />}
    </div>
  );
}

/* ============================================================
   ONE membership area.

   Four situations, one shape, and the loudest thing it will ever
   do is turn amber. Everything it knows is already derived (§5) —
   `status`, `daysLeft` and `dues` all come from `members.get`, so
   this component holds no state and cannot disagree with the
   Profile screen about what is owed.
   ============================================================ */
function MembershipStrip({
  planName, endDate, status, daysLeft, dues, onOpen,
}: {
  planName: string | null;
  endDate: string | null;
  status: string;
  daysLeft: number;
  dues: { due: number; paid: number; billed: number };
  onOpen: () => void;
}) {
  if (!planName) return null;

  const owes = dues.due > 0;
  const tone = status === 'expired' ? 'critical' : (status === 'expiring' || owes) ? 'warn' : 'calm';

  // The headline is whichever fact is most urgent. It is never two
  // facts: a member who is both overdue and expiring is told about
  // the expiry, because that is the one with a deadline on it.
  const headline = status === 'expired' ? 'Membership expired'
    : status === 'expiring'
      ? (daysLeft === 0 ? 'Renews today' : `Renews in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`)
      : owes ? `${money(dues.due)} outstanding`
        : `Active until ${endDate ? dateShort(endDate) : '—'}`;

  const detail = status === 'expired'
    ? `Ended ${endDate ? relativeDay(endDate).toLowerCase() : 'recently'}. Renew at the studio to start training again.`
    : owes
      ? `${money(dues.paid)} of ${money(dues.billed)} paid${status === 'expiring' ? ' · renewal due' : ''}.`
      : null;

  // A healthy membership is a footnote, not a card.
  if (tone === 'calm') {
    return (
      <p className="quiet-note u-center">
        {planName} · {headline}
        {' · '}
        <button className="auth__link" onClick={onOpen} style={{ fontSize: 'inherit' }}>details</button>
      </p>
    );
  }

  return (
    <section className={`memstrip memstrip--${tone}`}>
      <span className="memstrip__icon">
        <Icon name={status === 'expired' ? 'alert' : owes ? 'wallet' : 'clock'} size={16} />
      </span>
      <span className="memstrip__text">
        <span className="memstrip__head">{headline}</span>
        <span className="memstrip__sub">
          {planName}{detail ? ` · ${detail}` : ''}
        </span>
      </span>
      <Button size="sm" onClick={onOpen}>
        {status === 'expired' ? 'Renew' : owes ? 'Pay' : 'Details'}
      </Button>
    </section>
  );
}
