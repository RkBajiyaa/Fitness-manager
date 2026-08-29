import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, Meter, Segmented, StatTile,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { volumeOf } from '../../lib/derive';
import { count, dateShort, relativeDay } from '../../lib/format';
import { addDays, parseISO, todayISO } from '../../lib/date';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Workout() {
  const { session } = useApp();
  const nav = useNavigate();
  const [view, setView] = useState<'today' | 'plan' | 'history'>('today');
  const today = todayISO();
  const memberId = session?.memberId ?? '';

  const plan = useData(() => (session && memberId ? api.workouts.planFor(session, memberId) : null), [memberId]);
  const logs = useData(() => (session && memberId ? api.workouts.logs(session, memberId) : []), [memberId]);
  const todayLog = logs.find((l) => l.date === today) ?? null;

  if (!session) return null;

  const dow = parseISO(today).getDay();
  const todayPlan = (plan?.exercises ?? []).filter((e) => e.dayOfWeek === dow).sort((a, b) => a.order - b.order);
  const doneIds = new Set(todayLog?.sets.map((s) => s.exerciseId) ?? []);
  const doneCount = todayPlan.filter((e) => doneIds.has(e.exerciseId)).length;

  const last7 = logs.filter((l) => l.date >= addDays(today, -7));
  const totalVolume = logs.slice(0, 30).reduce((s, l) => s + volumeOf(l), 0);

  return (
    <div className="anim-page u-col u-gap-4">
      <div className="u-between">
        <div>
          <h1 className="t-h1">Workout</h1>
          <p className="t-sm t-muted u-mt-2">{plan ? plan.name : 'No plan assigned'}</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => nav('/member/workout/log')}>Log</Button>
      </div>

      <Segmented
        ariaLabel="Workout view" value={view} onChange={setView}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'plan', label: 'My plan' },
          { value: 'history', label: 'History', count: logs.length },
        ]}
      />

      {view === 'today' && (
        <>
          {todayPlan.length > 0 && (
            <Card>
              <CardHead title={`${DAYS[dow]} · ${todayPlan.length} exercises`}
                subtitle={`${doneCount} done`} />
              <CardBody flush>
                <div style={{ padding: 'var(--s-3) var(--s-4) 0' }}>
                  <Meter value={doneCount} max={todayPlan.length}
                    tone={doneCount === todayPlan.length ? 'good' : undefined}
                    label={`${doneCount} of ${todayPlan.length} complete`} />
                </div>
                <ul className="cardlist u-mt-3">
                  {todayPlan.map((x) => {
                    const done = doneIds.has(x.exerciseId);
                    const logged = todayLog?.sets.filter((s) => s.exerciseId === x.exerciseId) ?? [];
                    return (
                      <li key={x.id} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                        <span style={{
                          width: 26, height: 26, flex: 'none', marginTop: 2, display: 'grid', placeItems: 'center',
                          borderRadius: '50%',
                          background: done ? 'var(--good-soft)' : 'var(--surface-inset)',
                          color: done ? 'var(--good)' : 'var(--text-3)',
                        }}>
                          <Icon name={done ? 'check' : 'dumbbell'} size={13} strokeWidth={2.4} />
                        </span>
                        <span className="u-grow" style={{ minWidth: 0 }}>
                          <span className="t-sm" style={{ fontWeight: 550, display: 'block' }}>
                            {api.workouts.exerciseName(x.exerciseId)}
                          </span>
                          <span className="t-xs t-faint">
                            target {x.sets} × {x.reps}{x.targetWeight ? ` · ${x.targetWeight} kg` : ''}
                          </span>
                          {logged.length > 0 && (
                            <span className="t-xs u-mt-2" style={{ display: 'block', color: 'var(--good)' }}>
                              {logged.map((s) => s.durationSec
                                ? `${Math.round(s.durationSec / 60)}min`
                                : `${s.reps}×${s.weightKg || 'BW'}`).join(' · ')}
                            </span>
                          )}
                          {x.instructions && (
                            <span className="t-xs t-faint u-mt-2" style={{ display: 'block' }}>{x.instructions}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHead title="Logged today"
              subtitle={todayLog ? `${todayLog.sets.length} sets · ${todayLog.durationMin} min` : 'nothing yet'} />
            <CardBody flush>
              {!todayLog || todayLog.sets.length === 0 ? (
                <EmptyState icon="dumbbell" title="Nothing logged today"
                  message="Whatever you train — planned or not — log it and it counts."
                  action={<Button variant="primary" icon="plus" onClick={() => nav('/member/workout/log')}>Log workout</Button>} />
              ) : (
                <ul className="cardlist">
                  {groupSets(todayLog.sets).map((g) => (
                    <li key={g.exerciseId} className="cardlist__item" style={{ cursor: 'default' }}>
                      <span className="u-grow" style={{ minWidth: 0 }}>
                        <span className="t-sm" style={{ fontWeight: 550, display: 'block' }}>
                          {api.workouts.exerciseName(g.exerciseId)}
                        </span>
                        <span className="t-xs t-faint">{g.summary}</span>
                      </span>
                      <Badge>{g.count} sets</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {view === 'plan' && (
        plan ? (
          <div className="u-col u-gap-4">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const items = plan.exercises.filter((e) => e.dayOfWeek === d).sort((a, b) => a.order - b.order);
              if (!items.length) return null;
              return (
                <Card key={d} style={d === dow ? { borderColor: 'var(--brand)' } : undefined}>
                  <CardHead
                    title={DAYS[d]}
                    subtitle={`${items.length} exercises`}
                    action={d === dow ? <Badge tone="brand" dot>Today</Badge> : undefined}
                  />
                  <CardBody flush>
                    <ul className="cardlist">
                      {items.map((x) => (
                        <li key={x.id} className="cardlist__item" style={{ cursor: 'default' }}>
                          <span className="u-grow u-truncate">
                            <span className="t-sm" style={{ fontWeight: 550 }}>
                              {api.workouts.exerciseName(x.exerciseId)}
                            </span>
                          </span>
                          <span className="t-xs u-num t-muted u-nowrap">
                            {x.sets} × {x.reps}{x.targetWeight ? ` · ${x.targetWeight}kg` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card><EmptyState icon="route" title="No plan assigned yet"
            message="Your trainer can assign a structured plan. Until then, log freely — everything still counts towards your progress." /></Card>
        )
      )}

      {view === 'history' && (
        <div className="u-col u-gap-4">
          <div className="grid-stats">
            <StatTile label="Workouts logged" icon="dumbbell" value={count(logs.length)} />
            <StatTile label="Last 7 days" icon="calendarCheck" value={count(last7.length)} />
            <StatTile label="Volume (30 workouts)" icon="zap"
              value={`${Math.round(totalVolume / 1000)}k kg`} hint="reps × weight" />
          </div>
          {logs.length === 0 ? (
            <Card><EmptyState icon="dumbbell" title="No workout history"
              message="Your logged workouts will build up here."
              action={<Button variant="primary" icon="plus" onClick={() => nav('/member/workout/log')}>Log workout</Button>} /></Card>
          ) : (
            <Card><CardBody flush>
              <ul className="cardlist">
                {logs.slice(0, 30).map((l) => (
                  <li key={l.id} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                    <span style={{
                      width: 38, height: 38, flex: 'none', display: 'grid', placeItems: 'center',
                      borderRadius: 'var(--r-md)', background: 'var(--brand-soft)', color: 'var(--brand)',
                    }}>
                      <Icon name="dumbbell" size={17} />
                    </span>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="u-between u-gap-2">
                        <span className="t-sm" style={{ fontWeight: 580 }}>{dateShort(l.date)}</span>
                        <span className="t-xs t-faint">{relativeDay(l.date)}</span>
                      </span>
                      <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                        {l.sets.length} sets · {l.durationMin} min · {Math.round(volumeOf(l)).toLocaleString('en-IN')} kg volume
                      </span>
                      <span className="t-xs t-muted u-truncate" style={{ display: 'block', marginTop: 2 }}>
                        {groupSets(l.sets).slice(0, 3).map((g) => api.workouts.exerciseName(g.exerciseId)).join(', ')}
                        {groupSets(l.sets).length > 3 && '…'}
                      </span>
                      {l.notes && <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>“{l.notes}”</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody></Card>
          )}
        </div>
      )}
    </div>
  );
}

function groupSets(sets: Array<{ exerciseId: string; reps: number; weightKg: number; durationSec: number; distanceKm: number }>) {
  const map = new Map<string, typeof sets>();
  sets.forEach((s) => map.set(s.exerciseId, [...(map.get(s.exerciseId) ?? []), s]));
  return [...map.entries()].map(([exerciseId, list]) => ({
    exerciseId,
    count: list.length,
    summary: list.map((s) => s.durationSec
      ? `${Math.round(s.durationSec / 60)} min${s.distanceKm ? ` / ${s.distanceKm} km` : ''}`
      : `${s.reps}×${s.weightKg || 'BW'}`).join(' · '),
  }));
}
