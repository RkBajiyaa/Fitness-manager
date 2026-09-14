import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, CardBody, EmptyState, PageHead, Segmented,
} from '../../components/ui/primitives';
import { SearchInput } from '../../components/ui/forms';
import { Icon, type IconName } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';

type Scope = 'all' | 'features' | 'packages' | 'customers';

const SCOPE_PREFIX: Record<Scope, string[]> = {
  all: [],
  features: ['feature.'],
  packages: ['package.', 'subscription.'],
  customers: ['gym.', 'member.signup', 'demo.'],
};

function iconFor(action: string): IconName {
  if (action.startsWith('feature')) return 'layers';
  if (action.startsWith('package') || action.startsWith('subscription')) return 'card';
  if (action.startsWith('update')) return 'bell';
  if (action.startsWith('settings')) return 'settings';
  if (action.startsWith('demo')) return 'compass';
  return 'building';
}

/**
 * Platform change history. Small on purpose — it records WHO changed
 * WHAT for WHICH customer, which is exactly what you need six months
 * later when someone asks why a feature is off.
 */
export default function PlatformAudit() {
  const { session } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope>('all');

  const rows = useData(() => (session ? api.platform.audit.list(session, { q }) : []), [session?.userId, q]);
  if (!session) return null;

  const prefixes = SCOPE_PREFIX[scope];
  const visible = prefixes.length === 0
    ? rows
    : rows.filter((r) => prefixes.some((p) => r.action.startsWith(p)));

  const byDay = new Map<string, typeof visible>();
  visible.forEach((r) => {
    const day = new Date(r.at).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    const list = byDay.get(day) ?? [];
    list.push(r);
    byDay.set(day, list);
  });

  return (
    <div className="anim-page">
      <PageHead
        title="Change history"
        subtitle="Every platform configuration change, newest first."
      />

      <Card className="u-mb-4">
        <CardBody>
          <div className="filterbar">
            <SearchInput value={q} onChange={setQ} placeholder="Search changes" />
            <Segmented
              ariaLabel="Scope" value={scope} onChange={setScope}
              options={[
                { value: 'all', label: 'Everything' },
                { value: 'features', label: 'Features' },
                { value: 'packages', label: 'Packages' },
                { value: 'customers', label: 'Customers' },
              ]}
            />
          </div>
        </CardBody>
      </Card>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={rows.length === 0 ? 'note' : 'search'}
            title={rows.length === 0 ? 'Nothing has changed yet' : 'Nothing matches'}
            message={rows.length === 0
              ? 'Feature toggles, package moves and customer changes are recorded here as you make them.'
              : 'Try a different search or scope.'}
            action={rows.length > 0
              ? <Button onClick={() => { setQ(''); setScope('all'); }}>Clear filters</Button>
              : <Button variant="primary" onClick={() => nav('/platform/gyms')}>Go to customers</Button>}
          />
        </Card>
      ) : (
        <div className="u-col u-gap-4">
          {[...byDay.entries()].map(([day, group]) => (
            <Card key={day}>
              <CardBody flush>
                <div className="auditday">{day}</div>
                <ul className="cardlist">
                  {group.map((r) => (
                    <li key={r.id}>
                      <button
                        className="cardlist__item"
                        style={r.gymId ? undefined : { cursor: 'default' }}
                        onClick={r.gymId ? () => nav(`/platform/gyms/${r.gymId}`) : undefined}
                      >
                        <span style={{
                          width: 30, height: 30, flex: 'none', display: 'grid', placeItems: 'center',
                          borderRadius: 'var(--r-md)', background: 'var(--surface-3)', color: 'var(--text-2)',
                        }}>
                          <Icon name={iconFor(r.action)} size={14} />
                        </span>
                        <span className="u-grow" style={{ minWidth: 0 }}>
                          <span className="t-sm" style={{ fontWeight: 540 }}>{r.summary}</span>
                          <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                            {new Date(r.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                            {' · '}{r.actorName}
                            {' · '}<code>{r.action}</code>
                          </span>
                        </span>
                        {r.gymId && <Icon name="chevronRight" size={15} className="t-faint" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
