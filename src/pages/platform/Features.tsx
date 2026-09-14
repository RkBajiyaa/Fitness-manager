import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Card, CardBody, CardHead, Meter, PageHead, Segmented,
} from '../../components/ui/primitives';
import { SearchInput } from '../../components/ui/forms';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { CATEGORY_LABEL, CATEGORY_ORDER, type FeatureCategory } from '../../lib/platform/catalog';

/**
 * The catalog, read-only. What a feature IS lives here; who HAS it is
 * decided per customer. Keeping the two screens apart is the whole
 * point of the separation.
 */
export default function PlatformFeatures() {
  const { session } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [delivery, setDelivery] = useState<'all' | 'live' | 'designed'>('all');

  const rows = useData(() => (session ? api.platform.features.list(session) : []), [session?.userId]);
  const totalGyms = useData(
    () => (session ? api.platform.metrics.get(session).totalGyms : 0),
    [session?.userId],
  );

  if (!session) return null;

  const needle = q.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (delivery !== 'all' && r.def.delivery !== delivery) return false;
    if (!needle) return true;
    return r.def.name.toLowerCase().includes(needle)
      || r.def.key.includes(needle)
      || r.def.description.toLowerCase().includes(needle);
  });

  const live = rows.filter((r) => r.def.delivery === 'live').length;

  return (
    <div className="anim-page">
      <PageHead
        title="Feature catalog"
        subtitle={`${rows.length} capabilities. ${live} work today; the rest are seams designed for later phases.`}
      />

      <Card className="u-mb-4">
        <CardBody>
          <div className="filterbar">
            <SearchInput value={q} onChange={setQ} placeholder="Search features" />
            <Segmented
              ariaLabel="Delivery" value={delivery} onChange={setDelivery}
              options={[
                { value: 'all', label: 'All', count: rows.length },
                { value: 'live', label: 'Built', count: live },
                { value: 'designed', label: 'Seam only', count: rows.length - live },
              ]}
            />
          </div>
        </CardBody>
      </Card>

      {CATEGORY_ORDER.map((cat) => {
        const group = filtered.filter((r) => r.def.category === cat);
        if (!group.length) return null;
        return (
          <Card key={cat} className="u-mb-4">
            <CardHead title={CATEGORY_LABEL[cat as FeatureCategory]} subtitle={`${group.length} features`} />
            <CardBody flush>
              <ul className="featurelist">
                {group.map((r) => (
                  <li key={r.def.key} className="featurerow">
                    <div className="featurerow__main">
                      <div className="u-row u-gap-2 u-wrap">
                        <span className="t-sm" style={{ fontWeight: 570 }}>{r.def.name}</span>
                        <code className="t-xs t-faint">{r.def.key}</code>
                        {r.def.delivery === 'designed' && <span className="tag tag--quiet">Not built yet</span>}
                        {r.def.foundational && <span className="tag tag--quiet">Foundational</span>}
                      </div>
                      <p className="t-xs t-muted u-mt-2" style={{ maxWidth: '70ch' }}>{r.def.description}</p>
                      <div className="u-row u-gap-2 u-wrap u-mt-3">
                        {r.def.requires?.length ? (
                          <span className="t-xs t-faint">
                            Requires {r.def.requires.map((k) => rows.find((x) => x.def.key === k)?.def.name ?? k).join(', ')}
                          </span>
                        ) : null}
                        {r.packages.length > 0 && (
                          <span className="t-xs t-faint">
                            {r.def.requires?.length ? ' · ' : ''}In {r.packages.join(', ')}
                          </span>
                        )}
                        {r.overrides.length > 0 && (
                          <span className="t-xs" style={{ color: 'var(--brand)' }}>
                            · {r.overrides.length} individual override{r.overrides.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="featurerow__controls" style={{ alignItems: 'flex-end' }}>
                      <Badge tone={r.gyms > 0 ? 'good' : 'neutral'}>
                        {r.gyms} of {totalGyms}
                      </Badge>
                      <div style={{ width: 90 }}>
                        <Meter value={r.gyms} max={Math.max(1, totalGyms)}
                          label={`${r.def.name} enabled for ${r.gyms} customers`} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        );
      })}

      <p className="quiet-note u-center">
        To change who has what, open a customer and use the Features tab.{' '}
        <button className="auth__link" onClick={() => nav('/platform/gyms')}>Go to customers</button>
      </p>
    </div>
  );
}
