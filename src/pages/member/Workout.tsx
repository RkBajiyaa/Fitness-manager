import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, Meter, Segmented, StatTile,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { sessionVolume } from '../../lib/derive';
import { count, dateShort, relativeDay } from '../../lib/format';
import { addDays, parseISO, todayISO } from '../../lib/date';
import { formatClock } from './SessionPlayer';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Workout() {
  const { session } = useApp();
  const nav = useNavigate();
  const [view, setView] = useState<'today' | 'program' | 'history'>('today');
  const today = todayISO();
  const memberId = session?.memberId ?? '';

  const program = useData(() => (session && memberId ? api.programs.forMember(session, memberId) : null), [memberId]);
  const day = useData(() => (session && memberId ? api.programs.today(session, memberId) : null), [memberId]);
  const history = useData(() => (session && memberId ? api.sessions.completed(session, memberId) : []), [memberId]);
  const streaks = useData(() => (session && memberId ? api.streaks.forMember(session, memberId) : null), [memberId]);

  if (!session || !streaks) return null;

  const todaySession = history.find((s) => s.date === today) ?? null;
  const dow = parseISO(today).getDay();
  const planned = day?.exercises ?? [];
  const doneIds = new Set(todaySession?.sets.map((s) => s.exerciseId) ?? []);
  const doneCount = planned.filter((e) => doneIds.has(e.exerciseId)).length;
  const last7 = history.filter((s) => s.date >= addDays(today, -6));
  const volume30 = history
    .filter((s) => s.date >= addDays(today, -29))
    .reduce((sum, s) => sum + sessionVolume(s), 0);

  return (
    <div className="anim-page u-col u-gap-4">
      <div className="u-between">
        <div>
          <h1 className="t-h1">Workout</h1>
          <p className="t-sm t-muted u-mt-2">{program ? program.name : 'No program assigned'}</p>
        </div>
        <Button variant="primary" icon="play" onClick={() => nav('/member/session')}>Start</Button>
      </div>

      <Segmented
        ariaLabel="Workout view" value={view} onChange={setView}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'program', label: 'Program' },
          { value: 'history', label: 'History', count: history.length },
        ]}
      />

      {view === 'today' && (
        <>
          {day?.isRest ? (
            <Card>
              <CardBody>
                <div className="u-row u-gap-3">
                  <span style={{
                    width: 40, height: 40, flex: 'none', display: 'grid', placeItems: 'center',
                    borderRadius: 'var(--r-md)', background: 'var(--surface-3)', color: 'var(--text-2)',
                  }}>
                    <Icon name="moon" size={19} />
                  </span>
                  <div>
                    <div className="t-h3">{day.title}</div>
                    <p className="t-sm t-muted u-mt-2">
                      {day.notes || 'Recovery is part of the plan. Move gently, eat well, sleep.'}
                    </p>
                  </div>
                </div>
                {day.exercises.length > 0 && (
                  <ul className="u-col u-gap-2 u-mt-5">
                    {day.exercises.map((x) => (
                      <li key={x.id} className="u-row u-gap-3 t-sm">
                        <Icon name="check" size={14} className="t-faint" />
                        <span className="u-grow">{api.exercises.name(x.exerciseId)}</span>
                        <span className="t-xs t-faint">{x.notes}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button className="u-mt-5" block icon="dumbbell" onClick={() => nav('/member/session')}>
                  Train anyway
                </Button>
              </CardBody>
            </Card>
          ) : planned.length > 0 ? (
            <Card>
              <CardHead
                title={day?.title ?? DAYS[dow]}
                subtitle={day?.focus}
                action={<Badge tone={doneCount === planned.length ? 'good' : 'neutral'}>
                  {doneCount}/{planned.length}
                </Badge>}
              />
              <CardBody flush>
                <div style={{ padding: 'var(--s-3) var(--s-4) 0' }}>
                  <Meter value={doneCount} max={planned.length}
                    tone={doneCount === planned.length ? 'good' : undefined}
                    label={`${doneCount} of ${planned.length} exercises complete`} />
                </div>
                <ul className="u-mt-3">
                  {planned.map((x, i) => {
                    const done = doneIds.has(x.exerciseId);
                    const logged = todaySession?.sets.filter(
                      (s) => s.exerciseId === x.exerciseId && s.kind !== 'warmup') ?? [];
                    return (
                      <li key={x.id} className={`exline ${done ? 'exline--done' : ''}`} style={{ alignItems: 'flex-start' }}>
                        <span className="exline__idx" style={{ marginTop: 2 }}>
                          {done ? <Icon name="check" size={12} strokeWidth={2.6} /> : i + 1}
                        </span>
                        <span className="u-grow" style={{ minWidth: 0 }}>
                          <span className="exline__name" style={{ display: 'block' }}>
                            {api.exercises.name(x.exerciseId)}
                          </span>
                          <span className="exline__target">
                            target {x.sets} × {x.reps}{x.targetWeightKg ? ` · ${x.targetWeightKg} kg` : ''}
                            {x.restSec ? ` · rest ${x.restSec}s` : ''}
                          </span>
                          {logged.length > 0 && (
                            <span className="t-xs" style={{ display: 'block', marginTop: 3, color: 'var(--good)' }}>
                              {logged.map((s) => `${s.reps}×${s.weightKg || 'BW'}`).join(' · ')}
                            </span>
                          )}
                          {x.notes && (
                            <span className="t-xs t-faint" style={{ display: 'block', marginTop: 3 }}>{x.notes}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div style={{ padding: 'var(--s-4)' }}>
                  <Button variant="primary" size="lg" block icon="play" onClick={() => nav('/member/session')}>
                    {todaySession ? 'Log more' : 'Start workout'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon="dumbbell"
                title={program ? 'Nothing scheduled today' : 'No program assigned yet'}
                message={program
                  ? 'Your plan has no session for today. You can still train and log it.'
                  : 'Ask your coach to assign a program. In the meantime, log whatever you train — it all counts.'}
                action={<Button variant="primary" icon="play" onClick={() => nav('/member/session')}>Start a workout</Button>}
              />
            </Card>
          )}

          {day?.warmup && (
            <Card>
              <CardHead title="Warm-up" />
              <CardBody><p className="t-sm t-muted">{day.warmup}</p></CardBody>
            </Card>
          )}
          {day?.cooldown && (
            <Card>
              <CardHead title="Cool-down" />
              <CardBody><p className="t-sm t-muted">{day.cooldown}</p></CardBody>
            </Card>
          )}
        </>
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
              message="Your coach can build you a structured week. Until then, log freely — everything still counts towards your progress."
              action={<Button icon="library" onClick={() => nav('/member/exercises')}>Browse exercises</Button>} />
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
