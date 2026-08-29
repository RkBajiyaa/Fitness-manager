import { useState } from 'react';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, Segmented, StatTile,
} from '../../components/ui/primitives';
import { ChartFrame, LineChart, SERIES } from '../../components/charts';
import { RecordWeightSheet } from './RecordWeight';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { bmi, volumeOf } from '../../lib/derive';
import { dateShort, dayLabel } from '../../lib/format';

type Metric = 'weightKg' | 'waistCm' | 'chestCm' | 'armsCm' | 'bodyFatPct';

const METRICS: Array<{ key: Metric; label: string; unit: string; lowerIsBetter: boolean }> = [
  { key: 'weightKg', label: 'Weight', unit: 'kg', lowerIsBetter: true },
  { key: 'waistCm', label: 'Waist', unit: 'cm', lowerIsBetter: true },
  { key: 'chestCm', label: 'Chest', unit: 'cm', lowerIsBetter: false },
  { key: 'armsCm', label: 'Arms', unit: 'cm', lowerIsBetter: false },
  { key: 'bodyFatPct', label: 'Body fat', unit: '%', lowerIsBetter: true },
];

export default function Progress() {
  const { session } = useApp();
  const [metric, setMetric] = useState<Metric>('weightKg');
  const [sheet, setSheet] = useState(false);
  const memberId = session?.memberId ?? '';

  const rows = useData(() => (session && memberId ? api.measurements.list(session, memberId) : []), [memberId]);
  const logs = useData(() => (session && memberId ? api.workouts.logs(session, memberId, 40) : []), [memberId]);

  if (!session) return null;

  const active = METRICS.find((m) => m.key === metric)!;
  const series = rows
    .filter((r) => r[metric] != null && r[metric] !== 0)
    .map((r) => ({ x: r.takenAt, label: r.takenAt, y: r[metric] as number }));

  const latest = rows[rows.length - 1];
  const first = rows[0];
  const change = latest && first ? (latest.weightKg - first.weightKg) : 0;
  const bmiValue = latest ? bmi(latest.weightKg, latest.heightCm) : null;

  const volumeSeries = [...logs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({ x: l.date, label: l.date, y: Math.round(volumeOf(l)) }));

  return (
    <div className="anim-page u-col u-gap-4">
      <div className="u-between">
        <div>
          <h1 className="t-h1">Progress</h1>
          <p className="t-sm t-muted u-mt-2">{rows.length} measurement{rows.length === 1 ? '' : 's'} recorded</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setSheet(true)}>Record</Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="ruler" title="No measurements yet"
            message="Record your weight to start the chart. Add chest, waist, arms and body fat whenever you want a fuller picture."
            action={<Button variant="primary" icon="plus" onClick={() => setSheet(true)}>Record weight</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid-stats">
            <StatTile label="Current weight" icon="scale" value={`${latest.weightKg} kg`}
              hint={dateShort(latest.takenAt)} />
            <StatTile
              label="Since you started" icon="trendingUp"
              value={`${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change).toFixed(1)} kg`}
              deltaTone={change <= 0 ? 'good' : 'neutral'}
              hint={first ? `from ${first.weightKg} kg on ${dateShort(first.takenAt)}` : undefined}
            />
            {bmiValue && <StatTile label="BMI" icon="activity" value={bmiValue.toFixed(1)}
              hint={bmiValue < 18.5 ? 'underweight' : bmiValue < 25 ? 'healthy range' : bmiValue < 30 ? 'overweight' : 'obese'} />}
            {latest.bodyFatPct != null && <StatTile label="Body fat" icon="target" value={`${latest.bodyFatPct}%`} />}
          </div>

          <Card>
            <CardBody>
              <div className="u-mb-4">
                <Segmented
                  ariaLabel="Metric" value={metric} onChange={setMetric}
                  options={METRICS
                    .filter((m) => rows.some((r) => r[m.key] != null && r[m.key] !== 0))
                    .map((m) => ({ value: m.key, label: m.label }))}
                />
              </div>
              <ChartFrame
                title={active.label}
                subtitle={series.length > 1
                  ? `${series[0].y} → ${series[series.length - 1].y} ${active.unit}`
                  : 'One reading so far — record another to see the trend'}
              >
                {series.length > 1 ? (
                  <LineChart
                    area height={230} yMinZero={false}
                    format={(v) => `${v.toFixed(1)}`}
                    xLabel={(p) => dayLabel(p.label)}
                    series={[{ key: metric, label: active.label, color: SERIES.s1, points: series }]}
                  />
                ) : (
                  <p className="t-sm t-faint">Record this metric at least twice to draw a trend.</p>
                )}
              </ChartFrame>
            </CardBody>
          </Card>

          {volumeSeries.length > 1 && (
            <Card>
              <CardBody>
                <ChartFrame title="Training volume" subtitle="Reps × weight per workout — is the work going up?">
                  <LineChart
                    height={190}
                    format={(v) => `${Math.round(v / 1000)}k`}
                    xLabel={(p) => dayLabel(p.label)}
                    series={[{ key: 'v', label: 'Volume (kg)', color: SERIES.s3, points: volumeSeries }]}
                  />
                </ChartFrame>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHead title="History" subtitle="Most recent first" />
            <CardBody flush>
              <ul className="cardlist">
                {[...rows].reverse().slice(0, 20).map((r) => (
                  <li key={r.id} className="cardlist__item" style={{ cursor: 'default' }}>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="u-between u-gap-2">
                        <span className="t-sm" style={{ fontWeight: 560 }}>{r.weightKg} kg</span>
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

          <p className="t-xs t-faint u-center">
            Progress photos are a planned addition — the record already has room for them.
          </p>
        </>
      )}

      {sheet && <RecordWeightSheet onClose={() => setSheet(false)} />}
    </div>
  );
}
