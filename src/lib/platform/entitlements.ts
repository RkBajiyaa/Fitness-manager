/* ============================================================
   ENTITLEMENTS (docs/ARCHITECTURE.md §M.3).

   An entitlement answers one question: "is this feature actually
   available to THIS customer right now?" It is DERIVED, never
   stored — exactly like membership status or a personal record.
   Storing an effective flag would drift the moment a package is
   edited underneath it.

        package default      what they bought
      + individual override   what we decided for them
      + dependency check      what cannot run without something else
      ------------------------------------------------------------
      = effective entitlement

   The override is the important half. Package-only entitlement
   would force us to invent a bespoke package every time one
   customer wants one extra feature, and with 3–5 customers that
   is the common case, not the exception.
   ============================================================ */
import {
  FEATURE_CATALOG, featureDef, type FeatureDef, type FeatureKey,
} from './catalog';

export type EntitlementSource =
  | 'package'          // on, inherited from the package
  | 'override_on'      // on, because we turned it on for this customer
  | 'override_off'     // off, because we turned it off for this customer
  | 'not_in_package'   // off, simply not part of what they have
  | 'blocked';         // off, because something it depends on is off

export interface Entitlement {
  key: FeatureKey;
  def: FeatureDef;
  /** Does the package include it? */
  inPackage: boolean;
  /** null = no individual override recorded. */
  override: boolean | null;
  /** The answer the app acts on. */
  effective: boolean;
  source: EntitlementSource;
  /** Populated when `source === 'blocked'`. */
  blockedBy: FeatureKey[];
  /** A sentence the Super Admin can read without decoding the model. */
  reason: string;
}

export type EntitlementMap = Record<FeatureKey, Entitlement>;

export interface EntitlementInput {
  /** Features the gym's package grants. */
  packageFeatures: readonly FeatureKey[];
  /** Individual per-gym overrides: key → forced value. */
  overrides: ReadonlyMap<FeatureKey, boolean>;
  /** Optional package label, used only for the explanation string. */
  packageName?: string;
}

/**
 * Resolve every catalogued feature for one gym.
 *
 * Dependencies are resolved to a fixed point: a feature whose
 * prerequisite is off is reported as `blocked`, not silently on.
 * That keeps impossible states (Online Payments with no Payment
 * Gateway) off the screen instead of half-working in the app.
 */
export function resolveEntitlements(input: EntitlementInput): EntitlementMap {
  const pkg = new Set(input.packageFeatures);
  const pkgName = input.packageName ?? 'the package';
  const map = {} as EntitlementMap;

  for (const def of FEATURE_CATALOG) {
    const inPackage = pkg.has(def.key);
    const override = input.overrides.has(def.key) ? input.overrides.get(def.key)! : null;
    const effective = override ?? inPackage;
    map[def.key] = {
      key: def.key,
      def,
      inPackage,
      override,
      effective,
      source: override === true ? 'override_on'
        : override === false ? 'override_off'
        : inPackage ? 'package' : 'not_in_package',
      blockedBy: [],
      reason: '',
    };
  }

  // Fixed point: turning one prerequisite off can cascade.
  let changed = true;
  let guard = 0;
  while (changed && guard++ < FEATURE_CATALOG.length + 1) {
    changed = false;
    for (const def of FEATURE_CATALOG) {
      const row = map[def.key];
      if (!row.effective || !def.requires?.length) continue;
      const missing = def.requires.filter((r) => !map[r]?.effective);
      if (missing.length) {
        row.effective = false;
        row.source = 'blocked';
        row.blockedBy = missing;
        changed = true;
      }
    }
  }

  for (const def of FEATURE_CATALOG) {
    map[def.key].reason = explain(map[def.key], pkgName);
  }
  return map;
}

function explain(e: Entitlement, pkgName: string): string {
  switch (e.source) {
    case 'package':
      return `Included in ${pkgName}.`;
    case 'override_on':
      return e.inPackage
        ? `Included in ${pkgName}, and kept on by an individual override.`
        : `Not in ${pkgName} — switched on for this customer individually.`;
    case 'override_off':
      return e.inPackage
        ? `Included in ${pkgName}, but switched off for this customer individually.`
        : `Not in ${pkgName}, and switched off individually.`;
    case 'blocked': {
      const names = e.blockedBy.map((k) => featureDef(k)?.name ?? k).join(' and ');
      return `Unavailable until ${names} ${e.blockedBy.length > 1 ? 'are' : 'is'} enabled.`;
    }
    default:
      return `Not included in ${pkgName}.`;
  }
}

/** The flat set the app gates on. */
export function effectiveFeatures(map: EntitlementMap): Set<FeatureKey> {
  const out = new Set<FeatureKey>();
  for (const key of Object.keys(map) as FeatureKey[]) {
    if (map[key].effective) out.add(key);
  }
  return out;
}

/** Everything a package grants that the customer has not been given. */
export function overriddenKeys(map: EntitlementMap): FeatureKey[] {
  return (Object.keys(map) as FeatureKey[]).filter((k) => map[k].override !== null);
}

export function entitlementList(map: EntitlementMap): Entitlement[] {
  return (Object.keys(map) as FeatureKey[]).map((k) => map[k]);
}
