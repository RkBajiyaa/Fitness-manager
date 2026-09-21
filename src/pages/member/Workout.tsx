import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, Segmented, StatTile,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { ISODate, WorkoutSession } from '../../lib/types';
import { sessionVolume } from '../../lib/derive';
import { count, dateShort, relativeDay } from '../../lib/format';
import { addDays, parseISO, todayISO } from '../../lib/date';
import { formatClock } from './SessionPlayer';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export default function Workout() {
  const { session, has } = useApp();
  const nav = useNavigate();
  const [view, setView] = useState<'today' | 'program' | 'mine' | 'history'>('today');
  const today = todayISO();
  const memberId = session?.memberId ?? '';

  const program = useData(() => (session && memberId ? api.programs.forMember(session, memberId) : null), [memberId]);
  const todayPlan = useData(
    () => (session && memberId ? api.programs.todayPlan(session, memberId) : null), [memberId]);
  const history = useData(() => (session && memberId ? api.sessions.completed(session, memberId) : []), [memberId]);
  const streaks = useData(() => (session && memberId ? api.streaks.forMember(session, memberId) : null), [memberId]);
  const mine = useData(() => {
    if (!session || !memberId || !has('workout_builder')) return [];
    try { return api.workouts.list(session, memberId); } catch { return []; }
  }, [memberId]);

  if (!session || !streaks) return null;

  const todaySession = history.find((s) => s.date === today) ?? null;
  const dow = parseISO(today).getDay();
  const last7 = history.filter((s) => s.date >= addDays(today, -6));
  const volume30 = history
    .filter((s) => s.date >= addDays(today, -29))
    .reduce((sum, s) => sum + sessionVolume(s), 0);

  return (
    <div className="anim-page u-col u-gap-4">
      {/* No Start button here on purpose: Today's card carries the one
          primary action, and two "Start"s on one screen is a choice the
          member should never have to make. */}
      <div>
        <h1 className="t-h1">Workout</h1>
        <p className="t-sm t-muted u-mt-2">{program ? program.name : 'No plan yet'}</p>
      </div>

      <Segmented
        ariaLabel="Workout view" value={view} onChange={setView}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'program', label: 'Program' },
          ...(has('workout_builder')
            ? [{ value: 'mine' as const, label: 'Mine', count: mine.length }]
            : []),
          { value: 'history', label: 'History', count: history.length },
        ]}
      />

      {view === 'mine' && (
        mine.length === 0 ? (
          <Card>
            <EmptyState
              icon="layers"
              title="No workouts of your own yet"
              message="Build a routine once and start it with one tap after that. Your own workouts never change what your coach has assigned."
              action={(
                <Button variant="primary" icon="plus" onClick={() => nav('/member/workouts/new')}>
                  Build a workout
                </Button>
              )}
            />
          </Card>
        ) : (
          <div className="u-col u-gap-3">
            {mine.map((w) => (
              <Card key={w.id}>
                <CardHead
                  title={w.name}
                  subtitle={w.focus || `${w.exercises.length} exercises`}
                  action={(
                    <Button size="sm" variant="ghost" icon="edit"
                      onClick={() => nav(`/member/workouts/${w.id}`)} aria-label={`Edit ${w.name}`} />
                  )}
                />
                <CardBody flush>
                  <ul>
                    {w.exercises.map((x, i) => (
                      <li key={x.id} className="exline">
                        <span className="exline__idx">{i + 1}</span>
                        <span className="u-grow u-truncate">
                          <span className="exline__name">{api.exercises.name(x.exerciseId)}</span>
                        </span>
                        <span className="exline__target u-nowrap">
                          {x.sets} × {x.reps}{x.targetWeightKg ? ` · ${x.targetWeightKg}kg` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div style={{ padding: 'var(--s-4)' }}>
                    <Button variant="primary" block icon="play" onClick={async () => {
                      await api.sessions.start(session, memberId, { workoutId: w.id });
                      nav('/member/session');
                    }}>
                      Start {w.name}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
            <Button icon="plus" block onClick={() => nav('/member/workouts/new')}>
              Build another workout
            </Button>
          </div>
        )
      )}

      {view === 'today' && (
        <TodayView
          today={today}
          plan={todayPlan}
          todaySession={todaySession}
          onStart={() => nav('/member/session')}
          onChangePlan={() => nav('/member/plans')}
        />
      )}

      {view === 'program' && (
        program ? (
          <div className="u-col u-gap-4">
            <Card>
              <CardBody>
                <div className="u-between u-gap-3">
                  <div>
                    <div className="t-h3">{program.name}</div>
                    <p className="t-sm t-muted u-mt-2">{program.description}</p>
                  </div>
                  {program.kind === 'onboarding' && <Badge tone="brand">Onboarding</Badge>}
                </div>
                {program.startedAt && (
                  <p className="t-xs t-faint u-mt-4">Started {dateShort(program.startedAt)}</p>
                )}
              </CardBody>
            </Card>

            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const pd = program.days.find((x) => x.dayIndex === d);
              if (!pd) return null;
              return (
                <Card key={pd.id} style={d === dow ? { borderColor: 'var(--brand)' } : undefined}>
                  <CardHead
                    title={pd.title}
                    subtitle={pd.isRest ? pd.focus : `${DAYS[d]} · ${pd.exercises.length} exercises`}
                    action={d === dow ? <Badge tone="brand" dot>Today</Badge> : undefined}
                  />
                  {pd.exercises.length > 0 && (
                    <CardBody flush>
                      <ul>
                        {pd.exercises.map((x, i) => (
                          <li key={x.id} className="exline">
                            <span className="exline__idx">{i + 1}</span>
                            <span className="u-grow u-truncate">
                              <span className="exline__name">{api.exercises.name(x.exerciseId)}</span>
                            </span>
                            <span className="exline__target u-nowrap">
                              {x.sets} × {x.reps}{x.targetWeightKg ? ` · ${x.targetWeightKg}kg` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardBody>
                  )}
                  {pd.isRest && pd.notes && (
                    <CardBody><p className="t-sm t-muted">{pd.notes}</p></CardBody>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState icon="route" title="No program assigned"
              message="Your coach can build you a structured week. Until then, build your own workouts or log freely — everything still counts towards your progress."
              action={(
                <div className="u-row u-gap-2 u-wrap" style={{ justifyContent: 'center' }}>
                  {has('workout_builder') && (
                    <Button variant="primary" icon="plus" onClick={() => nav('/member/workouts/new')}>
                      Build a workout
                    </Button>
                  )}
                  <Button icon="library" onClick={() => nav('/member/exercises')}>Browse exercises</Button>
                </div>
              )} />
          </Card>
        )
      )}

      {view === 'history' && (
        <div className="u-col u-gap-4">
          <div className="grid-stats">
            <StatTile label="Sessions" icon="dumbbell" value={count(history.length)} hint="all time" />
            <StatTile label="Last 7 days" icon="calendarCheck" value={count(last7.length)} />
            <StatTile label="Volume, 30 days" icon="zap"
              value={`${Math.round(volume30 / 1000)}k kg`} hint="reps × weight" />
          </div>

          {history.length === 0 ? (
            <Card>
              <EmptyState icon="dumbbell" title="No workouts yet"
                message="Your logged sessions will build up here."
                action={<Button variant="primary" icon="play" onClick={() => nav('/member/session')}>Start a workout</Button>} />
            </Card>
          ) : (
            <Card><CardBody flush>
              <ul className="cardlist">
                {history.slice(0, 40).map((s) => {
                  const names = [...new Set(s.sets.map((x) => api.exercises.name(x.exerciseId)))];
                  return (
                    <li key={s.id} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                      <span style={{
                        width: 38, height: 38, flex: 'none', display: 'grid', placeItems: 'center',
                        borderRadius: 'var(--r-md)', background: 'var(--surface-3)', color: 'var(--text-2)',
                      }}>
                        <Icon name="dumbbell" size={17} />
                      </span>
                      <span className="u-grow" style={{ minWidth: 0 }}>
                        <span className="u-between u-gap-2">
                          <span className="t-sm u-truncate" style={{ fontWeight: 580 }}>{s.title}</span>
                          <span className="t-xs t-faint u-nowrap">{relativeDay(s.date)}</span>
                        </span>
                        <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                          {s.sets.filter((x) => x.kind !== 'warmup').length} sets ·
                          {' '}{formatClock(s.durationSec)} ·
                          {' '}{Math.round(sessionVolume(s)).toLocaleString('en-IN')} kg
                        </span>
                        <span className="t-xs t-muted u-truncate" style={{ display: 'block', marginTop: 2 }}>
                          {names.slice(0, 3).join(', ')}{names.length > 3 ? '…' : ''}
                        </span>
                        {s.notes && (
                          <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>“{s.notes}”</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardBody></Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TODAY'S WORKOUT (§3)

   One card that answers, in reading order: what day is it, what am
   I doing, how big is it, what plan am I on, and where is the
   button. Everything else on this screen is secondary to that
   button — including changing plans, which sits in the plan strip
   as a quiet text action rather than competing for the same
   attention (§4).
   ============================================================ */
function TodayView({
  today, plan, todaySession, onStart, onChangePlan,
}: {
  today: ISODate;
  plan: api.TodayPlan | null;
  todaySession: WorkoutSession | null;
  onStart: () => void;
  onChangePlan: () => void;
}) {
  const date = parseISO(today);
  const dayName = DAYS[date.getDay()];
  const dateLabel = `${dayName} · ${date.getDate()} ${MONTHS[date.getMonth()]}`;

  const day = plan?.day ?? null;
  const exerciseCount = (plan?.strength.length ?? 0) + (plan?.cardio.length ?? 0) + (plan?.other.length ?? 0);
  const doneIds = new Set(todaySession?.sets.filter((s) => s.completed).map((s) => s.exerciseId) ?? []);

  /* ---- no plan at all ---- */
  if (!plan) {
    return (
      <div className="u-col u-gap-4">
        <Card>
          <EmptyState
            icon="route"
            title="No plan yet"
            message="Pick a training plan and your workout is scheduled for you every day — or just start and log whatever you train."
            action={(
              <div className="u-row u-gap-2 u-wrap" style={{ justifyContent: 'center' }}>
                <Button variant="primary" icon="route" onClick={onChangePlan}>Choose a plan</Button>
                <Button icon="play" onClick={onStart}>Start a workout</Button>
              </div>
            )}
          />
        </Card>
      </div>
    );
  }

  const planProgress = plan.progress?.dayNo != null
    ? `Day ${plan.progress.dayNo} of ${plan.progress.totalDays}`
    : plan.progress
      ? `Week ${plan.progress.weekNo}`
      : null;

  const isRest = day?.isRest ?? false;
  const nothingToday = !day;

  return (
    <div className="u-col u-gap-4">
      <div className="today">
        <div className="today__head">
          <div className="today__date">{dateLabel}</div>
          <h2 className="today__title">
            {nothingToday ? 'Nothing scheduled' : day!.title}
          </h2>
          {day?.focus && <p className="today__focus">{day.focus}</p>}
          {nothingToday && (
            <p className="today__focus">
              Your plan has no session for today. You can still train and log it.
            </p>
          )}

          {!nothingToday && !isRest && (
            <div className="today__meta">
              {exerciseCount > 0 && (
                <span className="today__metaitem">
                  <Icon name="dumbbell" size={14} />
                  {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                </span>
              )}
              {plan.estimatedMin > 0 && (
                <span className="today__metaitem">
                  <Icon name="clock" size={14} />
                  about {plan.estimatedMin} min
                </span>
              )}
              {plan.warmup.length > 0 && (
                <span className="today__metaitem">
                  <Icon name="flame" size={14} />
                  {plan.warmup.length}-move warm-up
                </span>
              )}
            </div>
          )}

          {isRest && day?.notes && <p className="t-sm t-muted u-mt-4">{day.notes}</p>}
        </div>

        <div className="today__plan">
          <div style={{ minWidth: 0 }}>
            <div className="today__planname u-truncate">{plan.program.name}</div>
            {planProgress && <div className="today__planprog">{planProgress}</div>}
          </div>
          <Button size="sm" variant="ghost" onClick={onChangePlan}>Change plan</Button>
        </div>

        <div className="today__cta">
          <Button variant="primary" size="lg" block icon="play" onClick={onStart}>
            {todaySession ? 'Continue workout' : isRest ? 'Train anyway' : 'Start workout'}
          </Button>
        </div>
      </div>

      {/* Sections. Each one is only rendered when it has something in
          it — an empty "Cardio" heading is worse than no heading. */}
      {plan.warmup.length > 0 && (
        <Card>
          <DaySection label="Warm-up" count={plan.warmup.length} />
          <CardBody flush>
            <ul>
              {plan.warmup.map((ex, i) => (
                <li key={ex.id} className={`exline ${doneIds.has(ex.id) ? 'exline--done' : ''}`}>
                  <span className="exline__idx exacc__idx--warmup">
                    {doneIds.has(ex.id) ? <Icon name="check" size={12} strokeWidth={2.6} /> : i + 1}
                  </span>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="exline__name" style={{ display: 'block' }}>{ex.name}</span>
                    <span className="exline__target">{ex.summary}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {plan.strength.length > 0 && (
        <Card>
          <DaySection label="Strength" count={plan.strength.length} />
          <CardBody flush>
            <PlannedList items={plan.strength} doneIds={doneIds} session={todaySession} />
          </CardBody>
        </Card>
      )}

      {plan.cardio.length > 0 && (
        <Card>
          <DaySection label="Cardio" count={plan.cardio.length} />
          <CardBody flush>
            <PlannedList items={plan.cardio} doneIds={doneIds} session={todaySession} />
          </CardBody>
        </Card>
      )}

      {plan.other.length > 0 && (
        <Card>
          <DaySection label="Mobility" count={plan.other.length} />
          <CardBody flush>
            <PlannedList items={plan.other} doneIds={doneIds} session={todaySession} />
          </CardBody>
        </Card>
      )}

      {plan.cooldown.length > 0 && (
        <Card>
          <DaySection label="Cool-down" count={plan.cooldown.length} />
          <CardBody flush>
            <ul>
              {plan.cooldown.map((ex) => (
                <li key={ex.id} className="exline">
                  <span className="exline__idx"><Icon name="moon" size={12} /></span>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="exline__name" style={{ display: 'block' }}>{ex.name}</span>
                    <span className="exline__target">{ex.summary}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function DaySection({ label, count }: { label: string; count: number }) {
  return (
    <div className="daysec">
      <span className="daysec__label">{label}</span>
      <span className="daysec__rule" />
      <span className="daysec__count">{count}</span>
    </div>
  );
}

function PlannedList({
  items, doneIds, session,
}: {
  items: api.PlannedItem[];
  doneIds: Set<string>;
  session: WorkoutSession | null;
}) {
  return (
    <ul>
      {items.map((item, i) => {
        const ex = item.exercise!;
        const p = item.prescribed;
        const done = doneIds.has(ex.id);
        const logged = session?.sets.filter(
          (s) => s.exerciseId === ex.id && s.completed && s.kind !== 'warmup') ?? [];
        const reps = p.repsMax > p.reps ? `${p.reps}–${p.repsMax}` : String(p.reps);
        return (
          <li key={p.id} className={`exline ${done ? 'exline--done' : ''}`} style={{ alignItems: 'flex-start' }}>
            <span className="exline__idx" style={{ marginTop: 2 }}>
              {done ? <Icon name="check" size={12} strokeWidth={2.6} /> : i + 1}
            </span>
            <span className="u-grow" style={{ minWidth: 0 }}>
              <span className="exline__name" style={{ display: 'block' }}>{ex.name}</span>
              <span className="exline__target">
                {p.sets} × {reps}{p.targetWeightKg ? ` · ${p.targetWeightKg} kg` : ''}
                {p.restSec ? ` · rest ${p.restSec}s` : ''}
              </span>
              {logged.length > 0 && (
                <span className="t-xs" style={{ display: 'block', marginTop: 3, color: 'var(--good)' }}>
                  {logged.map((s) => (s.weightKg ? `${s.weightKg}×${s.reps}` : `${s.reps} reps`)).join(' · ')}
                </span>
              )}
              {p.notes && (
                <span className="t-xs t-faint" style={{ display: 'block', marginTop: 3 }}>{p.notes}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
