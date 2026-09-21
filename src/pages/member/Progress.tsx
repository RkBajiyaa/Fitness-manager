import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, Meter, Segmented, StatTile,
} from '../../components/ui/primitives';
import { SelectField } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { ChartFrame, HeatStrip, LineChart, SERIES } from '../../components/charts';
import { ExerciseThumb } from '../../components/member/ExerciseThumb';
import { RecordWeightSheet } from './RecordWeight';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { bmi, bmiBand, sessionVolume } from '../../lib/derive';
import { count, dateLong, dateShort, dayLabel, pct } from '../../lib/format';
import { addDays, rangeDays, todayISO } from '../../lib/date';

type View = 'body' | 'strength' | 'habits';
type Metric = 'weightKg' | 'waistCm' | 'chestCm' | 'armsCm' | 'bodyFatPct';

const METRICS: Array<{ key: Metric; label: string; unit: string }> = [
  { key: 'weightKg', label: 'Weight', unit: 'kg' },
  { key: 'waistCm', label: 'Waist', unit: 'cm' },
  { key: 'chestCm', label: 'Chest', unit: 'cm' },
  { key: 'armsCm', label: 'Arms', unit: 'cm' },
  { key: 'bodyFatPct', label: 'Body fat', unit: '%' },
];

export default function Progress() {
  const { session } = useApp();
  const nav = useNavigate();
  const memberId = session?.memberId ?? '';
  const today = todayISO();

  const [view, setView] = useState<View>('body');
  const [metric, setMetric] = useState<Metric>('weightKg');
  const [exerciseId, setExerciseId] = useState('');
  const [sheet, setSheet] = useState(false);

  const me = useData(() => (session && memberId ? api.members.get(session, memberId) : null), [memberId]);
  const rows = useData(() => (session && memberId ? api.measurements.list(session, memberId) : []), [memberId]);
  const history = useData(() => (session && memberId ? api.sessions.completed(session, memberId) : []), [memberId]);
  const streaks = useData(() => (session && memberId ? api.streaks.forMember(session, memberId) : null), [memberId]);
  const records = useData(() => (session && memberId ? api.records.forMember(session, memberId) : []), [memberId]);
  const goals = useData(() => (session && memberId ? api.goals.progress(session, memberId) : []), [memberId]);

  const activeExercise = exerciseId || records[0]?.exerciseId || '';
  const strength = useData(
    () => (session && memberId && activeExercise
      ? api.records.progression(session, memberId, activeExercise) : []),
    [memberId, activeExercise],
  );

  if (!session || !me || !streaks) return null;

  const latest = rows[rows.length - 1];
  const first = rows[0];
  const activeMetric = METRICS.find((m) => m.key === metric)!;
  const series = rows
    .filter((r) => r[metric] != null && r[metric] !== 0)
    .map((r) => ({ x: r.takenAt, label: r.takenAt, y: r[metric] as number }));
  const bmiValue = latest ? bmi(latest.weightKg, me.member.fitness.heightCm ?? latest.heightCm) : null;
  const targetWeight = me.member.fitness.targetWeightKg;

  const volumeSeries = [...history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map((s) => ({ x: s.date, label: s.date, y: Math.round(sessionVolume(s)) }));

  const strip = rangeDays(addDays(today, -83), today).map((d) => ({
    date: d, value: history.some((s) => s.date === d) ? 1 : 0, label: dateLong(d),
  }));

  return (
    <div className="anim-page u-col u-gap-4">
      <div className="u-between">
        <div>
          <h1 className="t-h1">Progress</h1>
          <p className="t-sm t-muted u-mt-2">
            {count(history.length)} sessions · {count(rows.length)} measurements
          </p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setSheet(true)}>Record</Button>
      </div>

      <Segmented
        ariaLabel="Progress view" value={view} onChange={setView}
        options={[
          { value: 'body', label: 'Body' },
          { value: 'strength', label: 'Strength' },
          { value: 'habits', label: 'Habits' },
        ]}
      />

      {/* ================= BODY ================= */}
      {view === 'body' && (
        rows.length === 0 ? (
          <Card>
            <EmptyState icon="ruler" title="No measurements yet"
              message="Record your weight to start the chart. Add chest, waist, arms and body fat whenever you want a fuller picture."
              action={<Button variant="primary" icon="plus" onClick={() => setSheet(true)}>Record weight</Button>} />
          </Card>
        ) : (
          <div className="u-col u-gap-4">
            <div className="grid-stats">
              <StatTile label="Current weight" icon="scale" value={`${latest.weightKg} kg`}
                hint={dateShort(latest.takenAt)} />
              {first && (
                <StatTile label="Since you started" icon="trendingUp"
                  value={`${latest.weightKg - first.weightKg > 0 ? '+' : ''}${(latest.weightKg - first.weightKg).toFixed(1)} kg`}
                  hint={`from ${first.weightKg} kg`} />
              )}
              {bmiValue && (
                <StatTile label="BMI" icon="activity" value={bmiValue.toFixed(1)}
                  hint={bmiBand(bmiValue).label} />
              )}
              {latest.bodyFatPct != null && (
                <StatTile label="Body fat" icon="target" value={`${latest.bodyFatPct}%`} />
              )}
            </div>

            {targetWeight && targetWeight > 0 && first && (
              <Card>
                <CardBody>
                  <div className="u-between u-mb-3">
                    <span className="t-sm t-muted">Target weight</span>
                    <span className="t-sm u-num" style={{ fontWeight: 620 }}>
                      {latest.weightKg} kg → {targetWeight} kg
                    </span>
                  </div>
                  <Meter
                    value={Math.abs(first.weightKg - latest.weightKg)}
                    max={Math.max(0.1, Math.abs(first.weightKg - targetWeight))}
                    tone="good"
                    label="Progress toward target weight"
                  />
                  {/* "0.0 kg to go" is what a progress bar says when it
                      has nothing left to say. Reaching the target is the
                      whole point and deserves a sentence of its own. */}
                  <p className="t-xs u-mt-3"
                    style={Math.abs(latest.weightKg - targetWeight) < 0.5
                      ? { color: 'var(--good)', fontWeight: 600 } : { color: 'var(--text-3)' }}>
                    {Math.abs(latest.weightKg - targetWeight) < 0.5
                      ? 'Target reached.'
                      : `${Math.abs(latest.weightKg - targetWeight).toFixed(1)} kg to go.`}
                  </p>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardBody>
                <div className="u-mb-4">
                  <Segmented
                    ariaLabel="Metric" value={metric} onChange={setMetric}
                    options={METRICS.filter((m) => rows.some((r) => r[m.key] != null && r[m.key] !== 0))
                      .map((m) => ({ value: m.key, label: m.label }))}
                  />
                </div>
                <ChartFrame
                  title={activeMetric.label}
                  subtitle={series.length > 1
                    ? `${series[0].y} → ${series[series.length - 1].y} ${activeMetric.unit}`
                    : 'One reading so far'}
                >
                  {series.length > 1 ? (
                    <LineChart area height={220} yMinZero={false}
                      format={(v) => v.toFixed(1)} xLabel={(p) => dayLabel(p.label)}
                      series={[{ key: metric, label: activeMetric.label, color: SERIES.s1, points: series }]} />
                  ) : (
                    <p className="t-sm t-faint">Record this metric again to see the trend.</p>
                  )}
                </ChartFrame>
              </CardBody>
            </Card>

            <Card>
              <CardHead title="History" />
              <CardBody flush>
                <ul className="cardlist">
                  {[...rows].reverse().slice(0, 15).map((r) => (
                    <li key={r.id} className="cardlist__item" style={{ cursor: 'default' }}>
                      <span className="u-grow" style={{ minWidth: 0 }}>
                        <span className="u-between u-gap-2">
                          <span className="t-sm" style={{ fontWeight: 580 }}>{r.weightKg} kg</span>
                          <span className="t-xs t-faint">{dateShort(r.takenAt)}</span>
                        </span>
                        <span className="u-row u-gap-2 u-wrap u-mt-2">
                          {r.chestCm ? <Badge>Chest {r.chestCm}</Badge> : null}
                          {r.waistCm ? <Badge>Waist {r.waistCm}</Badge> : null}
                          {r.armsCm ? <Badge>Arms {r.armsCm}</Badge> : null}
                          {r.bodyFatPct ? <Badge>Fat {r.bodyFatPct}%</Badge> : null}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        )
      )}

      {/* ================= STRENGTH ================= */}
      {view === 'strength' && (
        records.length === 0 ? (
          <Card>
            <EmptyState icon="dumbbell" title="No strength data yet"
              message="Log a few working sets and your progression will appear here."
              action={<Button variant="primary" icon="play" onClick={() => nav('/member/session')}>Start a workout</Button>} />
          </Card>
        ) : (
          <div className="u-col u-gap-4">
            <SelectField
              aria-label="Exercise" value={activeExercise}
              onChange={(e) => setExerciseId(e.target.value)}
              options={records.map((r) => ({ value: r.exerciseId, label: r.exerciseName }))}
            />

            {/* The headline is the CHANGE, not the number. A chart of
                estimated 1RM is only meaningful once somebody has read
                "up 12 kg since you started" off the top of it. */}
            {strength.length > 1 && (
              <Card>
                <CardBody>
                  <div className="u-row u-gap-4" style={{ alignItems: 'center' }}>
                    <ExerciseThumb exerciseId={activeExercise}
                      name={api.exercises.name(activeExercise)} size="lg" />
                    <div className="u-grow" style={{ minWidth: 0 }}>
                      <div className="t-label">Estimated 1RM</div>
                      <div className="u-row u-gap-2" style={{ alignItems: 'baseline', marginTop: 2 }}>
                        <span className="u-num" style={{ fontSize: 'var(--fs-28)', fontWeight: 680, letterSpacing: '-0.02em' }}>
                          {strength[strength.length - 1].y} kg
                        </span>
                        {(() => {
                          const delta = strength[strength.length - 1].y - strength[0].y;
                          if (Math.abs(delta) < 0.5) return <span className="t-sm t-muted">holding steady</span>;
                          return (
                            <span className="t-sm" style={{ color: delta > 0 ? 'var(--good)' : 'var(--text-2)', fontWeight: 600 }}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg
                            </span>
                          );
                        })()}
                      </div>
                      <p className="t-xs t-faint u-mt-2">
                        over {strength.length} sessions, from {strength[0].y} kg
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardBody>
                <ChartFrame
                  title="Estimated 1RM"
                  subtitle={strength.length > 1
                    ? `${strength[0].y} → ${strength[strength.length - 1].y} kg over ${strength.length} sessions`
                    : 'Log this exercise again to see a curve'}
                >
                  {strength.length > 1 ? (
                    <LineChart area height={220} yMinZero={false}
                      format={(v) => v.toFixed(0)} xLabel={(p) => dayLabel(p.label)}
                      series={[{ key: 'e', label: 'Estimated 1RM', color: SERIES.s1, points: strength }]} />
                  ) : (
                    <p className="t-sm t-faint">Not enough sessions yet.</p>
                  )}
                </ChartFrame>
              </CardBody>
            </Card>

            {volumeSeries.length > 1 && (
              <Card>
                <CardBody>
                  <ChartFrame title="Training volume" subtitle="Reps × weight, per session">
                    <LineChart height={180} format={(v) => `${Math.round(v / 1000)}k`}
                      xLabel={(p) => dayLabel(p.label)}
                      series={[{ key: 'v', label: 'Volume (kg)', color: SERIES.s3, points: volumeSeries }]} />
                  </ChartFrame>
                </CardBody>
              </Card>
            )}

            <Button block icon="trophy" onClick={() => nav('/member/records')}>
              See all personal records
            </Button>
          </div>
        )
      )}

      {/* ================= HABITS ================= */}
      {view === 'habits' && (
        <div className="u-col u-gap-4">
          <div className="grid-stats">
            <StatTile label="Training streak" icon="flame" value={`${streaks.training.current}d`}
              accent="var(--accent)" hint={`best ${streaks.training.longest}`} />
            <StatTile label="This month" icon="dumbbell" value={count(streaks.sessionsThisMonth)}
              hint="sessions" />
            <StatTile label="Weeks on target" icon="target" value={`${streaks.weekly.hit}/8`}
              hint={`${streaks.weeklyTarget} a week`} />
            <StatTile label="Gym visits" icon="calendarCheck" value={count(streaks.visitStats.visits)}
              hint={`${pct(streaks.visitStats.percentage)} of last 30 days`} />
          </div>

          <Card>
            <CardHead title="Last 12 weeks" subtitle="Each square is a training day" />
            <CardBody>
              <HeatStrip days={strip} format={(v) => (v ? 'Trained' : 'No session')} />
              <p className="quiet-note u-mt-4">
                Your streak counts training days and scheduled rest days — a rest day your
                program prescribes does not break it.
              </p>
            </CardBody>
          </Card>

          {goals.length > 0 && (
            <Card>
              <CardHead title="Goals" subtitle={`${goals.filter((g) => g.achieved).length} of ${goals.length} reached`} />
              <CardBody flush>
                <ul className="cardlist">
                  {goals.map((g) => (
                    <li key={g.goal.id} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                      <span style={{
                        width: 30, height: 30, flex: 'none', display: 'grid', placeItems: 'center',
                        borderRadius: '50%', marginTop: 2,
                        background: g.achieved ? 'var(--good-soft)' : 'var(--surface-3)',
                        color: g.achieved ? 'var(--good)' : 'var(--text-3)',
                      }}>
                        <Icon name={g.achieved ? 'check' : 'target'} size={14} strokeWidth={2.2} />
                      </span>
                      <span className="u-grow" style={{ minWidth: 0 }}>
                        <span className="t-sm" style={{ fontWeight: 560 }}>{g.goal.label}</span>
                        <span className="t-xs t-faint" style={{ display: 'block', margin: '3px 0 6px' }}>
                          {g.current.toFixed(g.goal.unit === 'kg' ? 1 : 0)} of {g.target} {g.goal.unit}
                        </span>
                        <Meter value={g.ratio * 100} max={100} tone={g.achieved ? 'good' : undefined}
                          label={`${Math.round(g.ratio * 100)}% of goal`} />
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {sheet && <RecordWeightSheet onClose={() => setSheet(false)} />}
    </div>
  );
}
