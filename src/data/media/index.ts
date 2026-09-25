/* ============================================================
   EXERCISE MEDIA — the abstraction the UI renders through (§9).

   A screen never asks "is this a GIF or an SVG?". It hands an
   ExerciseMedia record to one component, and that component picks
   the renderer. Swapping a hand-drawn pose for a licensed Lottie
   later changes one row of content and nothing else.

   Every record carries its provenance (§33). `poseMedia()` stamps
   the in-house licence automatically, which is the point: an
   asset with no licence block cannot be created by accident,
   because the only two ways to make one both demand it.
   ============================================================ */
import type { ExerciseMedia, MediaProvenance } from '../../lib/types';
import type { PropGlyph, SceneGlyph } from './figure';
import { DRAWING_INDEX } from './patterns';

/** The provenance every in-house drawing carries. */
export const IN_HOUSE: MediaProvenance = {
  source: 'Fitness Manager',
  creator: 'Fitness Manager design',
  license: 'proprietary-owned',
  commercialUse: true,
  attributionRequired: false,
  modificationAllowed: true,
  verifiedOn: '2026-09-20',
  url: '',
};

/**
 * A How-To built from one of our own movement drawings.
 *
 * `prop` and `scene` override the drawing's defaults, which is how
 * one `press_flat` drawing serves the barbell, dumbbell and machine
 * versions of the same movement without three sets of poses.
 */
export function poseMedia(
  drawing: string,
  opts: { prop?: PropGlyph; scene?: SceneGlyph } = {},
): ExerciseMedia {
  return {
    kind: 'pose',
    src: drawing,
    poster: null,
    prop: opts.prop ?? null,
    scene: opts.scene ?? null,
    version: 1,
    provenance: IN_HOUSE,
  };
}

/**
 * An externally sourced asset. Provenance is REQUIRED — there is no
 * default, because "we will fill the licence in later" is exactly
 * how an unlicensed clip ends up shipped (§10, §33).
 */
export function externalMedia(input: {
  kind: Exclude<ExerciseMedia['kind'], 'pose'>;
  src: string;
  poster?: string | null;
  provenance: MediaProvenance;
}): ExerciseMedia {
  return {
    kind: input.kind,
    src: input.src,
    poster: input.poster ?? null,
    prop: null,
    scene: null,
    version: 1,
    provenance: input.provenance,
  };
}

/**
 * Content check, run at seed time. A media record pointing at a
 * drawing that does not exist renders as a blank box in a gym at
 * 6am — it must fail loudly here instead.
 */
export function unresolvedDrawings(media: Array<ExerciseMedia | null>): string[] {
  return [...new Set(
    media
      .filter((m): m is ExerciseMedia => !!m && m.kind === 'pose')
      .map((m) => m.src)
      .filter((key) => !DRAWING_INDEX.has(key)),
  )];
}

export { MOVEMENT_DRAWINGS, DRAWING_INDEX } from './patterns';
export * from './figure';
export * from './musculature';
export * from './anatomy';
