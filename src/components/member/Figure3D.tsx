/* ============================================================
   THE 3D FIGURE, PAINTED.

   `data/media/figure3d.ts` turns angles into depth-sorted shapes
   with a light direction on each one. This file is the part that
   knows about SVG: gradients, contours, the order things are
   drawn in, and how a muscle highlight sits on top of a volume.

   Three things it is careful about, all of them learned by
   looking at the output rather than by reasoning about it:

     · ONE SORT FOR EVERYTHING. The body and the equipment are
       depth-sorted together, not painted as two layers. Sorting
       them separately is what puts a barbell behind the chest it
       is resting on, and it is the single most obvious tell that
       a "3D" drawing is really two flat ones.
     · SHADE ALONG THE LIMB, NOT ACROSS THE SCREEN. Each volume
       gets its own gradient, aligned to the part of the light
       that is square to that limb's axis. A single screen-space
       gradient over the whole figure makes it look like a sticker
       with a sheen on it.
     · DEPTH IS ALSO COLOUR. Far-side limbs are washed toward the
       background. Perspective alone is far too weak at this size
       to say which arm is nearer, and a viewer who cannot tell
       cannot read the pose.
   ============================================================ */
import { memo, useId, useMemo } from 'react';
import {
  CAMERA, GROUND_Y, LIGHT, arcArrow3D, bodyCentre, capsulePath, fitCamera, fitPoints,
  motionBetween3D, project, renderBody, v,
  type Camera, type Pose3D, type Region, type ScreenShape, type Skeleton, type V3,
} from '../../data/media/figure3d';
import { buildRig, rigPoints, type Rig, type RigPart, type Tone } from '../../data/media/rig3d';

/* ============================================================
   Shading
   ============================================================ */

interface Painted {
  key: string;
  path: string;
  /** Gradient direction, in the shape's own screen space. */
  lit: readonly [number, number];
  /** 0…1, how square-on to the light. */
  bright: number;
  depth: number;
  far: boolean;
  tone: Tone | 'skin';
  region?: Region;
}

/** A gradient vector for SVG's objectBoundingBox units, from the lit side to the shadow side. */
function gradVector(lit: readonly [number, number]) {
  return {
    x1: `${(0.5 - lit[0] * 0.62) * 100}%`,
    y1: `${(0.5 - lit[1] * 0.62) * 100}%`,
    x2: `${(0.5 + lit[0] * 0.62) * 100}%`,
    y2: `${(0.5 + lit[1] * 0.62) * 100}%`,
  };
}

/* ============================================================
   The kit, projected

   A disc is drawn as a capsule along its own axis: seen edge-on
   the two caps make a plate, seen face-on they merge into a
   circle, and every angle between is right without a special
   case. A box is its three camera-facing faces, each flat-shaded
   by its own normal — flat is correct, a box has no curvature to
   fake.
   ============================================================ */

function paintRig(parts: readonly RigPart[], cam: Camera, depthRef: number): Painted[] {
  const out: Painted[] = [];
  parts.forEach((p, i) => {
    if (p.t === 'cable') {
      const a = project(p.a, cam);
      const b = project(p.b, cam);
      out.push({
        key: `c${i}`,
        path: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
        lit: [0, -1], bright: 1, depth: (a.z + b.z) / 2, far: (a.z + b.z) / 2 < depthRef,
        tone: 'cable',
      });
      return;
    }
    if (p.t === 'box') {
      const side = v.norm(v.cross(p.u, p.w));
      const corner = (su: number, ss: number, sw: number): V3 => v.add(p.c, v.add(
        v.mul(p.u, su * p.half[0]),
        v.add(v.mul(side, ss * p.half[1]), v.mul(p.w, sw * p.half[2])),
      ));
      // Six faces, each as [normal, four corners]; only the ones
      // pointing at the camera are drawn.
      const faces: Array<[V3, V3[]]> = [
        [p.u, [corner(1, -1, -1), corner(1, -1, 1), corner(1, 1, 1), corner(1, 1, -1)]],
        [v.mul(p.u, -1), [corner(-1, -1, -1), corner(-1, 1, -1), corner(-1, 1, 1), corner(-1, -1, 1)]],
        [side, [corner(-1, 1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(-1, 1, 1)]],
        [v.mul(side, -1), [corner(-1, -1, -1), corner(-1, -1, 1), corner(1, -1, 1), corner(1, -1, -1)]],
        [p.w, [corner(-1, -1, 1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, -1, 1)]],
        [v.mul(p.w, -1), [corner(-1, -1, -1), corner(1, -1, -1), corner(1, 1, -1), corner(-1, 1, -1)]],
      ];
      faces.forEach(([n, pts], f) => {
        const proj = pts.map((q) => project(q, cam));
        // Screen-space winding decides visibility: a face whose
        // projected outline runs clockwise is pointing away.
        const area = proj.reduce((s, q, k) => {
          const r = proj[(k + 1) % proj.length];
          return s + (q.x * r.y - r.x * q.y);
        }, 0);
        if (area >= 0) return;
        const bright = 0.5 + Math.max(0, -v.dot(LIGHT, n)) * 0.5;
        out.push({
          key: `b${i}-${f}`,
          path: `M ${proj.map((q) => `${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' L ')} Z`,
          lit: [0, -1],
          bright,
          depth: proj.reduce((s, q) => s + q.z, 0) / proj.length,
          far: proj.reduce((s, q) => s + q.z, 0) / proj.length < depthRef,
          tone: p.tone,
        });
      });
      return;
    }
    // Tubes and discs are both capsules — a disc is simply a very
    // short one along its own axis.
    const a = p.t === 'tube' ? p.a : v.add(p.c, v.mul(v.norm(p.axis), -p.thick / 2));
    const b = p.t === 'tube' ? p.b : v.add(p.c, v.mul(v.norm(p.axis), p.thick / 2));
    const r = p.t === 'tube' ? p.r : p.r;
    const pa = project(a, cam);
    const pb = project(b, cam);
    const axis = v.norm(v.sub(b, a));
    const along = Math.abs(v.dot(LIGHT, axis));
    out.push({
      key: `t${i}`,
      path: capsulePath([pa.x, pa.y], [pb.x, pb.y], r * 2 * pa.k, r * 2 * pb.k),
      lit: litScreen(axis),
      bright: 0.55 + (1 - along) * 0.45,
      depth: (pa.z + pb.z) / 2,
      far: (pa.z + pb.z) / 2 < depthRef,
      tone: p.tone,
    });
  });
  return out;
}

/** The across-the-limb part of the light, in screen space. */
function litScreen(axis: V3): readonly [number, number] {
  const along = v.dot(LIGHT, axis);
  const perp = v.sub(LIGHT, v.mul(axis, along));
  const p = project(perp, { ...CAMERA, dist: 1e9, origin: [0, 0], scale: 1 });
  const l = Math.hypot(p.x, p.y) || 1e-6;
  return [p.x / l, p.y / l];
}

/* ============================================================
   Muscle highlighting

   Coarse on purpose. The model answers WHERE ON THE BODY, and
   the front/back chart beside it answers WHICH MUSCLE, to the
   exact head. Splitting a projected capsule down its length to
   separate a biceps from a triceps would be both a worse drawing
   and a worse lesson than pointing at the arm and letting the
   chart be precise.
   ============================================================ */

/**
 * Taxonomy muscle → the VOLUME it lives on.
 *
 * Front and back collapse onto the same volume on purpose: a lat
 * and a pectoral share one rib cage, and this model has no way to
 * paint half a projected capsule that would not also be wrong from
 * the other side. The model says "your torso"; the front/back chart
 * beside it says "your latissimus dorsi, and here is where it is".
 * Two visuals, two jobs — the same split the 2D system already
 * makes between the moving figure and the muscle map.
 */
const MUSCLE_REGION: Record<string, Region[]> = {
  pectorals: ['chest'],
  lats: ['chest'], rhomboids: ['chest'], traps: ['chest', 'neck'],
  spinal_erectors: ['abdomen'],
  front_delts: ['shoulder'], side_delts: ['shoulder'], rear_delts: ['shoulder'],
  rotator_cuff: ['shoulder'],
  biceps: ['upperArm'], triceps: ['upperArm'], forearms: ['foreArm'],
  abs: ['abdomen'], obliques: ['abdomen'], hip_flexors: ['abdomen'],
  glutes: ['glutes'], quads: ['thigh'], hamstrings: ['thigh'], adductors: ['thigh'],
  calves: ['shin'],
  heart_lungs: ['chest'],
};

/** The body regions an exercise lights up. Keys in, regions out (rule 22 stays intact). */
export function regionsFor(muscles: readonly string[]): Set<Region> {
  const out = new Set<Region>();
  for (const m of muscles) for (const r of MUSCLE_REGION[m] ?? []) out.add(r);
  return out;
}

/* ============================================================
   The component
   ============================================================ */

export interface Figure3DProps {
  pose: Pose3D;
  rig: Rig;
  /** Shared across every frame of a drawing so the model cannot drift. */
  camera: Camera;
  /** Body regions to light up strongly. */
  primary?: ReadonlySet<Region>;
  /** Body regions to light up quietly. */
  secondary?: ReadonlySet<Region>;
  /** The position being moved away from, drawn as a hint. */
  ghost?: Pose3D | null;
}

/**
 * A camera that frames every frame of a drawing identically.
 * Computed from the union of all of them — fitting each frame on
 * its own makes the model grow and shrink as it moves, which on a
 * three-frame loop reads as a bounce.
 */
export function cameraFor(poses: readonly Pose3D[], rig: Rig, size = 100): Camera {
  const pts: V3[] = [];
  for (const p of poses) {
    pts.push(...fitPoints(p));
    pts.push(...rigPoints(buildRig(rig, skeletonOf(p))));
  }
  return fitCamera(pts, CAMERA, size, 6);
}

function skeletonOf(pose: Pose3D): Skeleton {
  return renderBody(pose).skeleton;
}

export const Figure3D = memo(function Figure3D({
  pose, rig, camera, primary, secondary, ghost,
}: Figure3DProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  const { shapes, ground, painted } = useMemo(() => {
    const body = renderBody(pose, camera);
    const depthRef = project(body.skeleton.pelvis, camera).z;
    const kit = paintRig(buildRig(rig, body.skeleton), camera, depthRef);

    const bodyPainted: Painted[] = body.shapes.map((s: ScreenShape, i) => ({
      key: `s${i}-${s.id}`,
      path: s.path ?? circleToPath(s.circle!),
      lit: s.lit,
      bright: s.key,
      depth: s.depth,
      far: s.far,
      tone: 'skin' as const,
      region: s.region,
    }));

    // ONE sort. See the note at the top of the file.
    const all = [...bodyPainted, ...kit].sort((a, b) => a.depth - b.depth);

    // Where the figure meets the floor, for the contact shadow.
    const feet = [body.skeleton.toe.l, body.skeleton.toe.r, body.skeleton.ankle.l, body.skeleton.ankle.r];
    const cx = feet.reduce((n, p) => n + p[0], 0) / feet.length;
    const cz = feet.reduce((n, p) => n + p[2], 0) / feet.length;
    const g = project([cx, GROUND_Y, cz], camera);

    return { shapes: all, ground: g, painted: all };
  }, [pose, rig, camera]);

  const ghostShapes = useMemo(() => {
    if (!ghost) return null;
    return renderBody(ghost, camera).shapes;
  }, [ghost, camera]);

  return (
    <>
      <defs>
        {painted.map((p, i) => (
          <linearGradient key={p.key} id={`${uid}-g${i}`} {...gradVector(p.lit)}>
            <stop offset="0%" stopColor={`var(--m3d-${p.tone}-hi)`} />
            <stop offset="52%" stopColor={`var(--m3d-${p.tone})`} />
            <stop offset="100%" stopColor={`var(--m3d-${p.tone}-lo)`} />
          </linearGradient>
        ))}
      </defs>

      {/* A soft contact shadow. Without it the model hovers. */}
      <ellipse className="m3d__shadow" cx={ground.x} cy={ground.y} rx={26 * camera.scale} ry={5 * camera.scale} />

      {/* Where the movement came from. Outline only, and only when
          asked for: on a flat 2D figure a dashed ghost reads as a
          previous position, but behind a shaded one it reads as
          scaffolding. The 3D demonstrations carry direction with
          the arrow and the phase caption instead. */}
      {ghostShapes && (
        <g className="m3d__ghost">
          {ghostShapes.map((s, i) => (
            <path key={i} d={s.path ?? circleToPath(s.circle!)} />
          ))}
        </g>
      )}

      {shapes.map((p, i) => {
        const tone = p.region && primary?.has(p.region) ? 'primary'
          : p.region && secondary?.has(p.region) ? 'secondary' : null;
        return (
          <g key={p.key} className={`m3d__part m3d__part--${p.tone}`}>
            {/* Opaque. An earlier pass dimmed each volume with
                `opacity` to carry its brightness, which made the
                whole body translucent — you could see a far thigh
                through a near one, and the figure read as muddy
                glass. Brightness belongs to the gradient; a shade
                overlay carries the rest. */}
            <path d={p.path} fill={`url(#${uid}-g${i})`} />
            {p.bright < 0.92 && (
              <path d={p.path} className="m3d__shade" style={{ opacity: (0.92 - p.bright) * 0.34 }} />
            )}
            {p.far && <path d={p.path} className="m3d__depth" />}
            {tone && <path d={p.path} className={`m3d__muscle m3d__muscle--${tone}`} />}
          </g>
        );
      })}
    </>
  );
});

/** A ball's circle, as a path, so every shape goes through one code path. */
function circleToPath(c: { cx: number; cy: number; r: number }): string {
  const { cx, cy, r } = c;
  return `M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} a ${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(r * 2).toFixed(2)} 0 a ${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-r * 2).toFixed(2)} 0 Z`;
}

/* ============================================================
   DIRECTION

   Derived from the difference between two frames, in 3D, exactly
   as the flat system derives it in 2D: nothing about which way a
   rep travels is stored, so it cannot go stale when a pose is
   corrected (hard rule 5, applied to a drawing).
   ============================================================ */
export function Arrow3D({
  from, to, camera,
}: {
  from: Pose3D;
  to: Pose3D;
  camera: Camera;
}) {
  const geom = useMemo(() => {
    const m = motionBetween3D(from, to, camera);
    if (!m) return null;
    const centre = bodyCentre(renderBody(to, camera).points);
    return arcArrow3D(m, centre, 5);
  }, [from, to, camera]);

  if (!geom) return null;
  return (
    <g className="m3d__arrow">
      {/* A halo in the stage colour, so the arrow survives crossing
          a dark limb without being outlined in a third colour. */}
      <path d={geom.path} className="m3d__arrow-halo" />
      <path d={geom.path} className="m3d__arrow-line" />
      <g transform={`translate(${geom.tipX} ${geom.tipY}) rotate(${geom.tipAngle})`}>
        <path d="M 0 0 L -4.4 2.4 L -3.3 0 L -4.4 -2.4 Z" className="m3d__arrow-head" />
      </g>
    </g>
  );
}
