import { useState } from 'react';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, Modal, StatTile,
} from '../../components/ui/primitives';
import { SearchInput } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { ChartFrame, LineChart, SERIES } from '../../components/charts';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { count, dateShort, dayLabel } from '../../lib/format';

/**
 * Personal records, derived from actual sessions. Nothing here can be entered
 * by hand — a record only exists because a set produced it.
 */
export default function Records() {
  const { session } = useApp();
  const memberId = session?.memberId ?? '';
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useData(() => (session && memberId ? api.records.forMember(session, memberId) : []), [memberId]);

  if (!session) return null;

  const filtered = q.trim()
    ? rows.filter((r) => r.exerciseName.toLowerCase().includes(q.toLowerCase().trim())
      || r.muscleGroup.toLowerCase().includes(q.toLowerCase().trim()))
    : rows;

  const byMuscle = new Map<string, typeof rows>();
  filtered.forEach((r) => byMuscle.set(r.muscleGroup, [...(byMuscle.get(r.muscleGroup) ?? []), r]));

  const heaviest = rows[0];
  const totalSets = rows.reduce((s, r) => s + r.totalSets, 0);

  return (
    <div className="anim-page u-col u-gap-4">
      <div>
        <h1 className="t-h1">Personal records</h1>
        <p className="t-sm t-muted u-mt-2">Every number here came from a set you actually logged.</p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon="trophy" title="No records yet"
            message="Log a few working sets and your bests will appear here automatically." />
        </Card>
      ) : (
        <>
          <div className="grid-stats">
            <StatTile label="Exercises tracked" icon="library" value={count(rows.length)} />
            <StatTile label="Working sets" icon="zap" value={count(totalSets)} hint="warm-ups excluded" />
            {heaviest && (
              <StatTile label="Best estimated 1RM" icon="trophy"
                value={`${heaviest.best1RM.toFixed(1)} kg`} hint={heaviest.exerciseName} />
            )}
          </div>

          <SearchInput value={q} onChange={setQ} placeholder="Search records" />

          {[...byMuscle.entries()].map(([muscle, list]) => (
            <Card key={muscle}>
              <CardHead title={muscle} subtitle={`${list.length} exercise${list.length === 1 ? '' : 's'}`} />
              <CardBody flush>
                <ul className="cardlist">
                  {list.map((r) => (
                    <li key={r.exerciseId}>
                      <button className="cardlist__item" onClick={() => setOpen(r.exerciseId)}>
                        <span className="u-grow" style={{ minWidth: 0 }}>
                          <span className="t-sm" style={{ fontWeight: 580 }}>{r.exerciseName}</span>
                          <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                            {r.heaviestKg > 0 ? `${r.heaviestKg} kg × ${r.bestReps}` : `${r.bestReps} reps`}
                            {r.heaviestAt ? ` · ${dateShort(r.heaviestAt)}` : ''}
                          </span>
                        </span>
                        <span className="u-right u-nowrap">
                          <span className="prbadge">
                            <Icon name="trophy" size={11} />
                            {r.best1RM > 0 ? `${r.best1RM.toFixed(0)} kg` : `${r.bestReps}`}
                          </span>
                          <span className="t-xs t-faint" style={{ display: 'block', marginTop: 3 }}>est. 1RM</span>
                        </span>
                        <Icon name="chevronRight" size={15} className="t-faint" />
                      </button>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}

          {filtered.length === 0 && (
            <Card><EmptyState icon="search" title="No record matches that search" /></Card>
          )}

          <p className="quiet-note u-center">
            Estimated 1RM uses the Epley formula on sets of 12 reps or fewer, where it holds.
          </p>
        </>
      )}

      {open && <RecordDetail exerciseId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function RecordDetail({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const { session } = useApp();
  const memberId = session?.memberId ?? '';
  const series = useData(
    () => (session && memberId ? api.records.progression(session, memberId, exerciseId) : []),
    [exerciseId, memberId],
  );
  const rows = useData(() => (session && memberId ? api.records.forMember(session, memberId) : []), [memberId]);
  const rec = rows.find((r) => r.exerciseId === exerciseId);
  if (!session || !rec) return null;

  const gain = series.length > 1 ? series[series.length - 1].y - series[0].y : 0;

  return (
    <Modal title={rec.exerciseName} subtitle={rec.muscleGroup} onClose={onClose}
      footer={<Button block variant="primary" onClick={onClose}>Close</Button>}>
      <div className="u-col u-gap-5">
        <div className="grid-stats">
          <StatTile label="Heaviest set" icon="trophy" value={`${rec.heaviestKg} kg`}
            hint={rec.heaviestAt ? dateShort(rec.heaviestAt) : undefined} />
          <StatTile label="Estimated 1RM" icon="chevronsUp" value={`${rec.best1RM.toFixed(1)} kg`} />
        </div>

        {series.length > 1 ? (
          <ChartFrame
            title="Strength progression"
            subtitle={gain !== 0
              ? `${gain > 0 ? 'Up' : 'Down'} ${Math.abs(gain).toFixed(1)} kg estimated 1RM over ${series.length} sessions`
              : undefined}
          >
            <LineChart
              area height={200} yMinZero={false}
              format={(v) => `${v.toFixed(0)}`}
              xLabel={(p) => dayLabel(p.label)}
              series={[{ key: 'e1rm', label: 'Estimated 1RM', color: SERIES.s1, points: series }]}
            />
          </ChartFrame>
        ) : (
          <p className="t-sm t-faint">Log this exercise again to see a progression curve.</p>
        )}

        <div>
          <div className="kv"><span className="kv__k">Best reps at top weight</span>
            <span className="kv__v">{rec.bestReps}</span></div>
          <div className="kv"><span className="kv__k">Best session volume</span>
            <span className="kv__v u-num">{Math.round(rec.bestSessionVolume).toLocaleString('en-IN')} kg</span></div>
          <div className="kv"><span className="kv__k">Working sets logged</span>
            <span className="kv__v">{rec.totalSets}</span></div>
          <div className="kv"><span className="kv__k">Last performed</span>
            <span className="kv__v">{rec.lastPerformedAt ? dateShort(rec.lastPerformedAt) : '—'}</span></div>
        </div>
        <Badge icon="info">Records recompute from your session history — nothing is stored separately.</Badge>
      </div>
    </Modal>
  );
}
