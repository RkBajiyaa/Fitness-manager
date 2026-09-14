import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, Meter, PageHead, StatTile,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { count } from '../../lib/format';
import { CATEGORY_LABEL, type FeatureCategory } from '../../lib/platform/catalog';

/**
 * Platform overview. Every number here is a COUNT of rows that exist —
 * no projections, no health scores, no invented enterprise analytics.
 * With 3–5 customers, an honest small dashboard beats a padded one.
 */
export default function PlatformDashboard() {
  const { session } = useApp();
  const nav = useNavigate();

  const m = useData(() => (session ? api.platform.metrics.get(session) : null), [session?.userId]);
  const gyms = useData(() => (session ? api.platform.gyms.list(session) : []), [session?.userId]);
  const recent = useData(() => (session ? api.platform.audit.list(session, { limit: 8 }) : []), [session?.userId]);
  const demo = useData(() => (session ? api.platform.demo.status(session) : null), [session?.userId]);

  if (!session || !m) return null;

  const adopted = m.adoption.filter((a) => a.gyms > 0);
  const byCategory = new Map<string, typeof m.adoption>();
  adopted.forEach((a) => {
    const list = byCategory.get(a.category) ?? [];
    list.push(a);
    byCategory.set(a.category, list);
  });

  return (
    <div className="anim-page">
      <PageHead
        title="Platform overview"
        subtitle="Every customer, what they have, and what changed."
        actions={<Button variant="primary" icon="plus" onClick={() => nav('/platform/gyms?new=1')}>Add customer</Button>}
      />

      {m.totalGyms === 0 ? (
        <Card>
          <EmptyState
            icon="building"
            title="No customers yet"
            message="Add your first gym, or load the demonstration dataset to see the console with something in it."
            action={(
              <div className="u-row u-gap-2 u-wrap" style={{ justifyContent: 'center' }}>
                <Button variant="primary" icon="plus" onClick={() => nav('/platform/gyms?new=1')}>Add a customer</Button>
                <Button icon="compass" onClick={() => nav('/platform/settings')}>Load demo data</Button>
              </div>
            )}
          />
        </Card>
      ) : (
        <>
          <div className="grid-stats">
            <StatTile label="Customers" icon="building" value={count(m.totalGyms)}
              hint={`${m.liveGyms} live · ${m.demoGyms} demo`} onClick={() => nav('/platform/gyms')} />
            <StatTile label="Active" icon="checkCircle" value={count(m.activeGyms)}
              hint={m.suspendedGyms > 0 ? `${m.suspendedGyms} suspended` : 'none suspended'} />
            <StatTile label="Gym owners" icon="user" value={count(m.totalOwners)} />
            <StatTile label="Members" icon="users" value={count(m.totalMembers)}
              hint={`${count(m.activeMembers)} active`} />
            <StatTile label="New customers" icon="trendingUp" value={count(m.newGyms30)} hint="last 30 days" />
            <StatTile label="New members" icon="userPlus" value={count(m.newMembers30)} hint="last 30 days" />
          </div>

          <div className="grid-2 u-mt-4">
            <div className="u-col u-gap-4">
              <Card>
                <CardHead
                  title="Package distribution"
                  subtitle="What each customer is on"
                  action={<Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => nav('/platform/packages')}>Packages</Button>}
                />
                <CardBody>
                  {m.packageMix.filter((p) => p.gyms > 0).length === 0 ? (
                    <p className="t-sm t-faint">No customer is on a package yet.</p>
                  ) : (
                    <ul className="u-col u-gap-4">
                      {m.packageMix.filter((p) => p.gyms > 0).map((row) => (
                        <li key={row.pkg.id}>
                          <div className="u-between u-mb-2">
                            <span className="t-sm" style={{ fontWeight: 560 }}>{row.pkg.name}</span>
                            <span className="t-sm u-num t-muted">
                              {row.gyms} of {m.totalGyms}
                            </span>
                          </div>
                          <Meter value={row.gyms} max={Math.max(1, m.totalGyms)}
                            label={`${row.pkg.name}: ${row.gyms} customers`} />
                          <p className="t-xs t-faint u-mt-2">{row.pkg.features.length} features</p>
                        </li>
                      ))}
                      {m.unpackaged > 0 && (
                        <li className="t-xs" style={{ color: 'var(--warning)' }}>
                          {m.unpackaged} customer{m.unpackaged === 1 ? '' : 's'} with no package — they have no features at all.
                        </li>
                      )}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHead title="Activity" subtitle="Real events across every customer, last 7 days" />
                <CardBody>
                  <div className="kvgrid">
                    <div>
                      <div className="kvgrid__value u-num">{count(m.activity.activeGyms7)}</div>
                      <div className="kvgrid__label">Customers with activity</div>
                    </div>
                    <div>
                      <div className="kvgrid__value u-num">{count(m.activity.sessions7)}</div>
                      <div className="kvgrid__label">Training sessions</div>
                    </div>
                    <div>
                      <div className="kvgrid__value u-num">{count(m.activity.checkIns7)}</div>
                      <div className="kvgrid__label">Check-ins</div>
                    </div>
                    <div>
                      <div className="kvgrid__value u-num">{count(m.activity.payments7)}</div>
                      <div className="kvgrid__label">Payments recorded</div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="u-col u-gap-4">
              <Card>
                <CardHead
                  title="Customers"
                  subtitle={`${m.totalGyms} in total`}
                  action={<Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => nav('/platform/gyms')}>All</Button>}
                />
                <CardBody flush>
                  <ul className="cardlist">
                    {gyms.slice(0, 6).map((row) => (
                      <li key={row.gym.id}>
                        <button className="cardlist__item" onClick={() => nav(`/platform/gyms/${row.gym.id}`)}>
                          <span style={{
                            width: 34, height: 34, flex: 'none', display: 'grid', placeItems: 'center',
                            borderRadius: 'var(--r-md)', background: 'var(--surface-3)', color: 'var(--text-2)',
                          }}>
                            <Icon name="building" size={16} />
                          </span>
                          <span className="u-grow" style={{ minWidth: 0 }}>
                            <span className="u-row u-gap-2">
                              <span className="t-sm u-truncate" style={{ fontWeight: 570 }}>{row.gym.name}</span>
                              {row.gym.dataMode === 'demo' && <span className="tag">Demo</span>}
                            </span>
                            <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                              {row.owner?.name ?? 'No owner'} · {count(row.memberCount)} members
                            </span>
                          </span>
                          <span className="u-col u-right" style={{ gap: 3 }}>
                            <Badge tone={row.gym.status === 'active' ? 'good' : 'warning'}>
                              {row.gym.status === 'active' ? 'Active' : 'Suspended'}
                            </Badge>
                            <span className="t-xs t-faint">{row.pkg?.name ?? 'No package'}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>

              <Card>
                <CardHead
                  title="Recent changes"
                  subtitle="Platform configuration only"
                  action={<Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => nav('/platform/audit')}>History</Button>}
                />
                <CardBody flush>
                  {recent.length === 0 ? (
                    <div style={{ padding: 'var(--s-4)' }}>
                      <p className="t-sm t-faint">Nothing has been changed yet.</p>
                    </div>
                  ) : (
                    <ul className="cardlist">
                      {recent.map((row) => (
                        <li key={row.id} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                          <span className="u-grow" style={{ minWidth: 0 }}>
                            <span className="t-sm" style={{ fontWeight: 540 }}>{row.summary}</span>
                            <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                              {new Date(row.at).toLocaleString('en-IN', {
                                day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                              })} · {row.actorName}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>

          <Card className="u-mt-4">
            <CardHead
              title="Feature adoption"
              subtitle="How many customers have each feature effectively enabled"
              action={<Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => nav('/platform/features')}>Catalog</Button>}
            />
            <CardBody>
              {adopted.length === 0 ? (
                <p className="t-sm t-faint">No feature is enabled anywhere yet.</p>
              ) : (
                <div className="adoptgrid">
                  {[...byCategory.entries()].map(([cat, rows]) => (
                    <div key={cat}>
                      <div className="t-label u-mb-3">{CATEGORY_LABEL[cat as FeatureCategory] ?? cat}</div>
                      <ul className="u-col u-gap-3">
                        {rows.map((a) => (
                          <li key={a.key}>
                            <div className="u-between u-gap-2">
                              <span className="t-sm u-truncate">
                                {a.name}
                                {a.delivery === 'designed' && <span className="tag tag--quiet" style={{ marginLeft: 6 }}>seam</span>}
                              </span>
                              <span className="t-sm u-num t-muted u-nowrap">{a.gyms}</span>
                            </div>
                            <div className="u-mt-2">
                              <Meter value={a.gyms} max={Math.max(1, m.totalGyms)} label={`${a.name}: ${a.gyms} customers`} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {demo?.loaded && (
            <p className="quiet-note u-center u-mt-4">
              The demonstration dataset is loaded ({demo.gyms} workspaces, {count(demo.members)} members).
              It is counted above, and kept separate from live customers.
            </p>
          )}
        </>
      )}
    </div>
  );
}
