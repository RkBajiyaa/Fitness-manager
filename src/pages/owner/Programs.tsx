import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, CardBody, CardHead, EmptyState, PageHead, StatTile,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { AssignProgramDialog } from '../../components/dialogs/communication';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { count, dateShort, pct } from '../../lib/format';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Programs() {
  const { session } = useApp();
  const nav = useNavigate();
  const [openTemplate, setOpenTemplate] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState<string | null>(null);

  const templates = useData(() => (session ? api.programs.templates(session) : []), [session?.gymId]);
  const rows = useData(() => (session ? api.members.rows(session) : []), [session?.gymId]);
  const assignments = useData(() => {
    if (!session) return [];
    return rows.map((r) => ({
      row: r,
      program: api.programs.forMember(session, r.member.id),
    }));
  }, [session?.gymId, rows.length]);

  if (!session) return null;

  const withProgram = assignments.filter((a) => a.program);
  const without = assignments.filter((a) => !a.program && a.row.status !== 'expired' && a.row.status !== 'none');
  const onboarding = withProgram.filter((a) => a.program?.kind === 'onboarding');
  const template = templates.find((t) => t.id === openTemplate);

  return (
    <div className="anim-page">
      <PageHead
        title="Programs"
        subtitle="Structured weeks your members open the app to. Assigning one is the difference between a plan and a membership."
      />

      <div className="grid-stats u-mb-5">
        <StatTile label="Templates" icon="route" value={count(templates.length)} />
        <StatTile label="Members on a program" icon="userCheck" value={count(withProgram.length)}
          hint={pct((withProgram.length / Math.max(1, rows.length)) * 100) + ' of the roster'} />
        <StatTile label="In onboarding" icon="sparkles" value={count(onboarding.length)}
          hint="first week" />
        <StatTile label="Without a program" icon="alert" value={count(without.length)}
          accent={without.length ? 'var(--warning-mark)' : undefined} hint="active members" />
      </div>

      <div className="grid-2:1">
        <div className="u-col u-gap-4">
          <h2 className="t-label">Templates</h2>
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHead
                title={t.name}
                subtitle={t.description}
                action={t.kind === 'onboarding' ? <Badge tone="brand">Onboarding</Badge> : undefined}
              />
              <CardBody flush>
                <ul>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const pd = t.days.find((x) => x.dayIndex === d);
                    if (!pd) return null;
                    return (
                      <li key={pd.id} className="exline">
                        <span className="exline__idx">{DAYS[d].slice(0, 2)}</span>
                        <span className="u-grow" style={{ minWidth: 0 }}>
                          <span className="exline__name">{pd.title}</span>
                          <span className="exline__target" style={{ display: 'block' }}>{pd.focus}</span>
                        </span>
                        <span className="t-xs t-faint u-nowrap">
                          {pd.isRest ? 'Rest' : `${pd.exercises.length} exercises`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div style={{ padding: 'var(--s-4)' }}>
                  <Button block icon="eye" onClick={() => setOpenTemplate(t.id)}>
                    View full program
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}

          <div className="inline-alert">
            <Icon name="info" size={16} style={{ flex: 'none', marginTop: 1, color: 'var(--text-2)' }} />
            <span className="t-sm t-muted">
              A visual program builder is the next step here. The data model already supports
              multi-week programs, per-day warm-ups and cool-downs, and per-exercise targets —
              these templates use all of it.
            </span>
          </div>
        </div>

        <Card>
          <CardHead
            title="Members without a program"
            subtitle={without.length ? `${without.length} active members` : 'Everyone has a plan'}
          />
          <CardBody flush>
            {without.length === 0 ? (
              <EmptyState icon="checkCircle" title="Everyone has a program"
                message="Every active member opens the app to a planned session." />
            ) : (
              <ul className="cardlist">
                {without.slice(0, 12).map((a) => (
                  <li key={a.row.member.id} className="cardlist__item" style={{ cursor: 'default' }}>
                    <Avatar name={a.row.member.name} size="sm" />
                    <span className="u-grow u-truncate">
                      <span className="t-sm u-truncate" style={{ fontWeight: 560, display: 'block' }}>
                        {a.row.member.name}
                      </span>
                      <span className="t-xs t-faint">
                        joined {dateShort(a.row.member.joinedAt)}
                      </span>
                    </span>
                    <Button size="sm" variant="primary" onClick={() => setAssignTo(a.row.member.id)}>
                      Assign
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {template && (
        <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpenTemplate(null); }}>
          <div className="modal modal--wide" role="dialog" aria-modal="true" aria-label={template.name}>
            <div className="modal__grabber" />
            <div className="modal__head">
              <div className="u-grow">
                <h2 className="t-h2">{template.name}</h2>
                <p className="t-sm t-muted u-mt-2">{template.description}</p>
              </div>
              <Button variant="ghost" size="sm" icon="x" onClick={() => setOpenTemplate(null)} aria-label="Close" />
            </div>
            <div className="modal__body">
              <div className="u-col u-gap-4">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const pd = template.days.find((x) => x.dayIndex === d);
                  if (!pd) return null;
                  return (
                    <Card key={pd.id}>
                      <CardHead title={pd.title} subtitle={`${DAYS[d]} · ${pd.focus}`}
                        action={pd.isRest ? <Badge>Rest</Badge> : undefined} />
                      <CardBody>
                        {pd.warmup && (
                          <p className="t-xs t-muted u-mb-3"><strong>Warm-up:</strong> {pd.warmup}</p>
                        )}
                        {pd.exercises.length > 0 && (
                          <ul className="u-col u-gap-2">
                            {pd.exercises.map((x, i) => (
                              <li key={x.id} className="u-row u-gap-3 t-sm">
                                <span className="exline__idx">{i + 1}</span>
                                <span className="u-grow" style={{ minWidth: 0 }}>
                                  <span style={{ fontWeight: 540 }}>{api.exercises.name(x.exerciseId)}</span>
                                  {x.notes && (
                                    <span className="t-xs t-faint" style={{ display: 'block' }}>{x.notes}</span>
                                  )}
                                </span>
                                <span className="t-xs u-num t-muted u-nowrap">
                                  {x.sets} × {x.reps}{x.targetWeightKg ? ` · ${x.targetWeightKg}kg` : ''} · {x.restSec}s
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {pd.notes && <p className="t-sm t-muted u-mt-3">{pd.notes}</p>}
                        {pd.cooldown && (
                          <p className="t-xs t-muted u-mt-3"><strong>Cool-down:</strong> {pd.cooldown}</p>
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </div>
            <div className="modal__foot">
              <Button onClick={() => setOpenTemplate(null)}>Close</Button>
              <Button variant="primary" icon="users" onClick={() => { setOpenTemplate(null); nav('/owner/members'); }}>
                Assign to a member
              </Button>
            </div>
          </div>
        </div>
      )}

      {assignTo && <AssignProgramDialog memberId={assignTo} onClose={() => setAssignTo(null)} />}
    </div>
  );
}
