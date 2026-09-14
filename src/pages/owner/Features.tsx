import {
  Badge, Button, Card, CardBody, CardHead, KV, PageHead,
} from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import { dateShort } from '../../lib/format';
import { CATEGORY_LABEL, CATEGORY_ORDER, type FeatureCategory } from '../../lib/platform/catalog';

/**
 * The owner's view of their own entitlements — READ ONLY.
 *
 * An owner can see exactly what they have and what they do not; they
 * cannot grant themselves anything, because entitlement is a platform
 * decision. Showing it plainly is better than hiding it: "why can't I
 * see Reports?" gets answered here instead of in a support call.
 */
export default function OwnerFeatures() {
  const { session } = useApp();

  const rows = useData(() => (session ? api.features.list(session) : []), [session?.gymId]);
  const plan = useData(() => (session ? api.features.plan(session) : null), [session?.gymId]);
  const settings = useData(() => api.platform.publishedUpdates('owners'), []);

  if (!session) return null;

  const enabled = rows.filter((r) => r.effective);
  const unavailable = rows.filter((r) => !r.effective);

  return (
    <div className="anim-page">
      <PageHead
        title="Features"
        subtitle="What your plan includes, and what it does not."
      />

      <div className="grid-2 u-mb-4">
        <Card>
          <CardHead title="Your plan" />
          <CardBody>
            {plan?.pkg ? (
              <>
                <KV k="Plan">{plan.pkg.name}</KV>
                <KV k="Modules enabled">{enabled.length} of {rows.length}</KV>
                <KV k="Status">
                  <Badge tone={plan.subscription?.status === 'active' ? 'good' : 'brand'}>
                    {plan.subscription?.status ?? 'unknown'}
                  </Badge>
                </KV>
                {plan.subscription?.renewsAt && (
                  <KV k="Renews">{dateShort(plan.subscription.renewsAt)}</KV>
                )}
                <p className="t-xs t-muted u-mt-4" style={{ maxWidth: '52ch', lineHeight: 1.6 }}>
                  {plan.pkg.description}
                </p>
              </>
            ) : (
              <p className="t-sm t-muted">
                No plan is assigned to your gym yet. Contact Fitness Manager to get set up.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="How this works" />
          <CardBody>
            <ul className="u-col u-gap-3 t-sm t-muted" style={{ lineHeight: 1.6 }}>
              <li className="u-row u-gap-3" style={{ alignItems: 'flex-start' }}>
                <Icon name="check" size={15} style={{ flex: 'none', marginTop: 3, color: 'var(--good)' }} />
                <span>Your navigation only shows what you have. Nothing is displayed as a dead button you cannot press.</span>
              </li>
              <li className="u-row u-gap-3" style={{ alignItems: 'flex-start' }}>
                <Icon name="lock" size={15} style={{ flex: 'none', marginTop: 3, color: 'var(--text-3)' }} />
                <span>Features are set by Fitness Manager, not from inside your workspace. Ask us and we can switch one on for your gym specifically.</span>
              </li>
              <li className="u-row u-gap-3" style={{ alignItems: 'flex-start' }}>
                <Icon name="info" size={15} style={{ flex: 'none', marginTop: 3, color: 'var(--text-3)' }} />
                <span>A module marked <em>coming soon</em> is designed and reserved for you, but not built yet. We will not pretend it works.</span>
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const group = enabled.filter((r) => r.def.category === cat);
        if (!group.length) return null;
        return (
          <Card key={cat} className="u-mb-3">
            <CardHead title={CATEGORY_LABEL[cat as FeatureCategory]} subtitle={`${group.length} available`} />
            <CardBody>
              <div className="featuregrid">
                {group.map((r) => (
                  <div key={r.key} className="featurecard">
                    <span className="featurecard__icon"><Icon name="check" size={14} strokeWidth={2.6} /></span>
                    <span className="u-grow" style={{ minWidth: 0 }}>
                      <span className="u-row u-gap-2 u-wrap">
                        <span className="t-sm" style={{ fontWeight: 555 }}>{r.def.name}</span>
                        {r.def.delivery === 'designed' && <span className="tag tag--quiet">Coming soon</span>}
                      </span>
                      <span className="t-xs t-faint" style={{ display: 'block', marginTop: 3, lineHeight: 1.5 }}>
                        {r.def.description}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        );
      })}

      {unavailable.length > 0 && (
        <Card className="u-mt-4">
          <CardHead
            title="Not in your plan"
            subtitle={`${unavailable.length} modules exist in Fitness Manager but are not enabled for your gym`}
          />
          <CardBody>
            <div className="chiprow">
              {unavailable.map((r) => (
                <span key={r.key} className="featurechip featurechip--off">{r.def.name}</span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {settings.length > 0 && (
        <Card className="u-mt-4">
          <CardHead title="From Fitness Manager" subtitle="Platform updates" />
          <CardBody flush>
            <ul className="cardlist">
              {settings.slice(0, 4).map((u) => (
                <li key={u.id} className="cardlist__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="t-sm" style={{ fontWeight: 570 }}>{u.title}</span>
                    <span className="t-xs t-muted" style={{ display: 'block', marginTop: 3, lineHeight: 1.55 }}>
                      {u.body}
                    </span>
                    <span className="t-xs t-faint" style={{ display: 'block', marginTop: 4 }}>
                      {u.publishedAt ? dateShort(u.publishedAt) : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <p className="quiet-note u-center u-mt-5">
        <Button size="sm" variant="ghost" icon="settings" onClick={() => window.history.back()}>
          Back
        </Button>
      </p>
    </div>
  );
}
