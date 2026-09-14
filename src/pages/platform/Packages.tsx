import { useState } from 'react';
import {
  Badge, Button, Card, CardBody, CardHead, EmptyState, Modal, PageHead,
} from '../../components/ui/primitives';
import { Switch, TextField, TextareaField, fieldErrors, errorMessage } from '../../components/ui/forms';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import {
  CATEGORY_LABEL, CATEGORY_ORDER, FEATURE_CATALOG, type FeatureCategory,
} from '../../lib/platform/catalog';

/**
 * Packages are defaults, not permissions. Editing one changes every
 * customer inheriting it — the UI says how many before you touch it.
 */
export default function PlatformPackages() {
  const { session, toast, confirm } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const packages = useData(() => (session ? api.platform.packages.list(session) : []), [session?.userId]);
  if (!session) return null;

  const open = packages.find((p) => p.id === openId) ?? null;

  const toggle = async (packageId: string, feature: string, on: boolean, affected: number) => {
    if (affected > 0) {
      const ok = await confirm({
        title: on ? 'Add this feature to the package?' : 'Remove it from the package?',
        confirmLabel: on ? 'Add' : 'Remove',
        message: `${affected} customer${affected === 1 ? '' : 's'} inherit from this package. Anyone with an individual override for this feature keeps their override.`,
      });
      if (!ok) return;
    }
    await api.platform.packages.toggleFeature(session, packageId, feature, on);
    toast('success', on ? 'Feature added' : 'Feature removed');
  };

  const makeDefault = async (id: string, name: string) => {
    await api.platform.packages.update(session, id, { isDefault: true });
    toast('success', `${name} is the default`, 'New customers start here unless you change it.');
  };

  const remove = async (id: string, name: string, gyms: number) => {
    if (gyms > 0) {
      toast('error', 'Package in use', `Move those ${gyms} customers to another package first.`);
      return;
    }
    const ok = await confirm({
      title: `Delete the ${name} package?`, tone: 'danger', confirmLabel: 'Delete',
      message: 'No customer is on it, so nothing changes for anyone.',
    });
    if (!ok) return;
    try {
      await api.platform.packages.remove(session, id);
      toast('success', 'Package deleted');
      setOpenId(null);
    } catch (e) { toast('error', 'Could not delete', errorMessage(e)); }
  };

  return (
    <div className="anim-page">
      <PageHead
        title="Packages"
        subtitle="A package is a default set of entitlements. Individual overrides still beat it."
        actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New package</Button>}
      />

      <div className="pkggrid">
        {packages.map((p) => (
          <Card key={p.id}>
            <CardHead
              title={p.name}
              subtitle={p.description}
              action={p.isDefault ? <Badge tone="brand">Default</Badge>
                : p.isSystem ? <Badge>System</Badge> : undefined}
            />
            <CardBody>
              <div className="u-row u-gap-4 u-wrap">
                <div>
                  <div className="t-h3 u-num">{p.features.length}</div>
                  <div className="t-xs t-faint">features</div>
                </div>
                <div>
                  <div className="t-h3 u-num">{p.gyms}</div>
                  <div className="t-xs t-faint">customer{p.gyms === 1 ? '' : 's'}</div>
                </div>
              </div>

              <div className="u-row u-gap-2 u-wrap u-mt-5">
                <Button size="sm" icon="edit" onClick={() => setOpenId(p.id)}>Edit features</Button>
                {!p.isDefault && !p.isSystem && (
                  <Button size="sm" variant="ghost" onClick={() => makeDefault(p.id, p.name)}>
                    Make default
                  </Button>
                )}
                {!p.isSystem && p.gyms === 0 && (
                  <Button size="sm" variant="ghost" icon="trash"
                    onClick={() => remove(p.id, p.name, p.gyms)} aria-label={`Delete ${p.name}`} />
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {packages.length === 0 && (
        <Card>
          <EmptyState icon="card" title="No packages"
            message="Create one so new customers have something to inherit."
            action={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New package</Button>} />
        </Card>
      )}

      {open && (
        <Modal
          wide
          title={`${open.name} — features`}
          subtitle={`${open.gyms} customer${open.gyms === 1 ? '' : 's'} inherit from this package.`}
          onClose={() => setOpenId(null)}
          footer={<Button variant="primary" onClick={() => setOpenId(null)}>Done</Button>}
        >
          <div className="u-col u-gap-5">
            {CATEGORY_ORDER.map((cat) => {
              const defs = FEATURE_CATALOG.filter((f) => f.category === cat);
              return (
                <div key={cat}>
                  <div className="t-label u-mb-3">{CATEGORY_LABEL[cat as FeatureCategory]}</div>
                  <ul className="u-col u-gap-2">
                    {defs.map((def) => {
                      const on = open.features.includes(def.key);
                      return (
                        <li key={def.key} className="pkgfeature">
                          <span className="u-grow" style={{ minWidth: 0 }}>
                            <span className="u-row u-gap-2 u-wrap">
                              <span className="t-sm" style={{ fontWeight: 540 }}>{def.name}</span>
                              {def.delivery === 'designed' && <span className="tag tag--quiet">Not built</span>}
                            </span>
                            <span className="t-xs t-faint" style={{ display: 'block', marginTop: 2 }}>
                              {def.description}
                            </span>
                          </span>
                          <Switch checked={on} label={def.name} hideLabel
                            onChange={(next) => toggle(open.id, def.key, next, open.gyms)} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {creating && <CreatePackage onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreatePackage({ onClose }: { onClose: () => void }) {
  const { session, toast } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!session) return;
    setBusy(true); setErrors({});
    try {
      await api.platform.packages.create(session, { name, description, features: [] });
      toast('success', 'Package created', 'Add features to it next.');
      onClose();
    } catch (e) {
      setErrors(fieldErrors(e));
      if (!Object.keys(fieldErrors(e)).length) toast('error', 'Could not create', errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title="New package"
      subtitle="Starts empty. Add features once it exists."
      onClose={onClose}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>Create</Button>
        </>
      )}
    >
      <div className="u-col u-gap-4">
        <TextField label="Name" required autoFocus value={name} error={errors.name}
          onChange={(e) => setName(e.target.value)} placeholder="e.g. Studio Plus" />
        <TextareaField label="Description" rows={3} value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this package is for" />
      </div>
    </Modal>
  );
}
