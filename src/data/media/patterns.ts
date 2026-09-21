/* ============================================================
   MOVEMENT DRAWINGS — the pose data behind every How-To visual.

   One drawing per MOVEMENT, not per exercise. Barbell bench press,
   dumbbell bench press and machine chest press are the same three
   poses with a different implement in the hands, so they share
   `press_flat` and differ only in the `prop` their media record
   supplies. Sixty exercises are covered by thirty-odd drawings.

   Authoring notes, so the next person can extend this safely:
     · angles are absolute degrees, clockwise from screen-right,
       +y downward (see figure.ts). −90 is straight up.
     · the floor sits at y ≈ 92; a bench at y ≈ 68; a seat at y ≈ 74.
     · the effort frame carries the longer `holdMs` so the loop
       reads as "work, then return" rather than a metronome.
     · frame labels are the instruction (§12). Keep them to one
       word where the movement allows it.
   ============================================================ */
import { type MovementDrawing, type Pose, pose, STANDING } from './figure';

/* ---------------- shared bases ---------------- */

/** Lying supine on a flat bench, head to the left. */
const SUPINE: Pose = {
  hip: [56, 66], spine: 178, neck: 178,
  upperArm: -85, foreArm: -85,
  thigh: 20, shin: 80, foot: 0,
};

/** Reclined on a 30° incline bench. */
const RECLINED: Pose = {
  hip: [54, 68], spine: 205, neck: 205,
  upperArm: -80, foreArm: -80,
  thigh: 25, shin: 80, foot: 0,
};

/** Seated upright on a machine seat or bench. */
const SEATED: Pose = {
  hip: [50, 72], spine: -88, neck: -90,
  upperArm: 80, foreArm: 85,
  thigh: -4, shin: 84, foot: 0,
};

/** Face-down on the forearms. */
const PRONE: Pose = {
  hip: [54, 74], spine: 187, neck: 187,
  upperArm: 75, foreArm: 175,
  thigh: 8, shin: 6, foot: 20,
};

/**
 * Hanging from a bar, arms overhead.
 *
 * The knees are tucked, not straight. With straight legs the figure
 * is 26 (spine) + 26 (overhead arm) + 34 (leg) tall, which does not
 * fit the 100-unit box: either the hands leave the top or the feet
 * go through the floor. A hang with bent knees is also what it
 * actually looks like on a standard-height bar.
 */
const HANGING: Pose = {
  hip: [50, 62], spine: -92, neck: -92,
  upperArm: -82, foreArm: -88,
  thigh: 70, shin: 20, foot: -10,
};

export const MOVEMENT_DRAWINGS: MovementDrawing[] = [
  /* ============ horizontal push ============ */
  {
    key: 'press_flat', name: 'Flat press', scene: 'flat_bench', prop: 'barbell',
    frames: [
      { label: 'Setup', pose: SUPINE, cue: 'Shoulder blades pinned back and down.' },
      { label: 'Lower', pose: pose(SUPINE, { upperArm: 10, foreArm: -100 }), holdMs: 900, cue: 'To mid-chest. Elbows about 45°, not flared.' },
      { label: 'Press', pose: SUPINE, holdMs: 700, cue: 'Drive up. Ribs stay down.' },
    ],
  },
  {
    key: 'press_incline', name: 'Incline press', scene: 'incline_bench', prop: 'dumbbell',
    frames: [
      { label: 'Setup', pose: RECLINED, cue: 'Bench at 30°. Any steeper is a shoulder press.' },
      { label: 'Lower', pose: pose(RECLINED, { upperArm: -5, foreArm: -110 }), holdMs: 900, cue: 'Down to the upper chest, under control.' },
      { label: 'Press', pose: RECLINED, holdMs: 700, cue: 'Up and slightly together.' },
    ],
  },
  {
    key: 'fly', name: 'Fly', scene: 'flat_bench', prop: 'dumbbell',
    frames: [
      { label: 'Top', pose: pose(SUPINE, { upperArm: -85, foreArm: -80 }) },
      { label: 'Open', pose: pose(SUPINE, { upperArm: -25, foreArm: -55 }), holdMs: 900, cue: 'Elbow angle stays fixed — this is not a press.' },
      { label: 'Squeeze', pose: pose(SUPINE, { upperArm: -85, foreArm: -80 }), holdMs: 700, cue: 'Bring the hands together over the chest.' },
    ],
  },
  {
    key: 'push_up', name: 'Push-up', scene: 'floor', prop: 'none',
    frames: [
      {
        label: 'Top',
        pose: { hip: [54, 70], spine: 185, neck: 185, upperArm: 88, foreArm: 90, thigh: 5, shin: 3, foot: 40 },
      },
      {
        label: 'Lower',
        pose: { hip: [54, 78], spine: 185, neck: 185, upperArm: 120, foreArm: 55, thigh: 5, shin: 3, foot: 40 },
        holdMs: 900,
        cue: 'Chest to the floor. Hips do not sag.',
      },
      {
        label: 'Press',
        pose: { hip: [54, 70], spine: 185, neck: 185, upperArm: 88, foreArm: 90, thigh: 5, shin: 3, foot: 40 },
        holdMs: 700,
      },
    ],
  },
  {
    key: 'dip', name: 'Dip', scene: 'dip_bars', prop: 'none',
    frames: [
      { label: 'Top', pose: pose(STANDING, { hip: [50, 52], spine: -100, upperArm: 92, foreArm: 90, thigh: 70, shin: 40, foot: -20 }) },
      { label: 'Lower', pose: pose(STANDING, { hip: [50, 64], spine: -104, upperArm: 130, foreArm: 60, thigh: 70, shin: 40, foot: -20 }), holdMs: 900, cue: 'Until the upper arm is level. No deeper.' },
      { label: 'Press', pose: pose(STANDING, { hip: [50, 52], spine: -100, upperArm: 92, foreArm: 90, thigh: 70, shin: 40, foot: -20 }), holdMs: 700 },
    ],
  },

  /* ============ vertical push ============ */
  {
    /*
     * The hip sits 2 units lower than STANDING, with the knees very
     * slightly softened to keep the feet on the floor. Without it a
     * fully extended overhead arm puts the bar at y ≈ 4 and the
     * plates clip straight out of the top of the box — the pose
     * typechecks and the picture is of a barbell cut in half.
     */
    key: 'press_overhead', name: 'Overhead press', scene: 'floor', prop: 'barbell',
    frames: [
      {
        label: 'Rack', cue: 'Bar at collarbone height, elbows under it.',
        pose: pose(STANDING, { hip: [50, 58], thigh: 84, shin: 96, upperArm: 118, foreArm: -86 }),
      },
      {
        label: 'Press', holdMs: 900,
        cue: 'Straight overhead. Squeeze the glutes so you do not lean back.',
        pose: pose(STANDING, { hip: [50, 58], thigh: 84, shin: 96, upperArm: -84, foreArm: -88 }),
      },
      {
        label: 'Lower', holdMs: 700,
        pose: pose(STANDING, { hip: [50, 58], thigh: 84, shin: 96, upperArm: 118, foreArm: -86 }),
      },
    ],
  },
  {
    key: 'raise_lateral', name: 'Lateral raise', scene: 'floor', prop: 'dumbbell',
    frames: [
      { label: 'Start', pose: pose(STANDING, { upperArm: 82, foreArm: 86 }), cue: 'Arms by your sides, slight bend at the elbow.' },
      { label: 'Raise', pose: pose(STANDING, { upperArm: 2, foreArm: 8 }), holdMs: 900, cue: 'Up to shoulder height. No higher, no swinging.' },
      { label: 'Lower', pose: pose(STANDING, { upperArm: 82, foreArm: 86 }), holdMs: 700 },
    ],
  },

  /* ============ vertical pull ============ */
  {
    key: 'pulldown', name: 'Pulldown', scene: 'lat_tower', prop: 'cable',
    frames: [
      { label: 'Reach', pose: pose(SEATED, { spine: -84, upperArm: -80, foreArm: -86 }), cue: 'Arms long overhead, chest tall.' },
      { label: 'Pull', pose: pose(SEATED, { spine: -80, upperArm: -20, foreArm: -120 }), holdMs: 900, cue: 'Elbows to the ribs. Lead with the elbows, not the hands.' },
      { label: 'Return', pose: pose(SEATED, { spine: -84, upperArm: -80, foreArm: -86 }), holdMs: 700 },
    ],
  },
  {
    key: 'pull_up', name: 'Pull-up', scene: 'pull_bar', prop: 'none',
    frames: [
      { label: 'Hang', pose: HANGING, cue: 'Dead hang, shoulders active.' },
      { label: 'Pull', pose: pose(HANGING, { hip: [50, 52], upperArm: -55, foreArm: -125 }), holdMs: 900, cue: 'Chest towards the bar, chin over it.' },
      { label: 'Lower', pose: HANGING, holdMs: 700 },
    ],
  },
  {
    key: 'hang', name: 'Hang', scene: 'pull_bar', prop: 'none',
    frames: [
      { label: 'Hang', pose: HANGING, holdMs: 1400 },
      { label: 'Pull down', pose: pose(HANGING, { hip: [50, 57] }), holdMs: 1400 },
    ],
  },

  /* ============ horizontal pull ============ */
  {
    key: 'row_seated', name: 'Seated row', scene: 'row_station', prop: 'cable',
    frames: [
      { label: 'Reach', pose: pose(SEATED, { spine: -78, upperArm: 6, foreArm: 2 }), cue: 'Let the shoulders travel forward, back stays flat.' },
      { label: 'Pull', pose: pose(SEATED, { spine: -92, upperArm: 40, foreArm: 175 }), holdMs: 900, cue: 'Handle to the navel, squeeze the shoulder blades.' },
      { label: 'Return', pose: pose(SEATED, { spine: -78, upperArm: 6, foreArm: 2 }), holdMs: 700 },
    ],
  },
  {
    key: 'row_bent', name: 'Bent-over row', scene: 'floor', prop: 'barbell',
    frames: [
      { label: 'Hinge', pose: pose(STANDING, { hip: [52, 60], spine: -140, thigh: 80, shin: 92, upperArm: 84, foreArm: 88 }), cue: 'Hips back, back flat, bar hanging.' },
      { label: 'Pull', pose: pose(STANDING, { hip: [52, 60], spine: -140, thigh: 80, shin: 92, upperArm: 130, foreArm: 30 }), holdMs: 900, cue: 'Bar to the lower ribs. The torso does not rise.' },
      { label: 'Lower', pose: pose(STANDING, { hip: [52, 60], spine: -140, thigh: 80, shin: 92, upperArm: 84, foreArm: 88 }), holdMs: 700 },
    ],
  },
  {
    key: 'face_pull', name: 'Face pull', scene: 'cable_tower', prop: 'cable',
    frames: [
      { label: 'Reach', pose: pose(STANDING, { upperArm: -35, foreArm: -30 }) },
      { label: 'Pull', pose: pose(STANDING, { upperArm: -5, foreArm: -155 }), holdMs: 900, cue: 'Rope to the forehead, elbows high and wide.' },
      { label: 'Return', pose: pose(STANDING, { upperArm: -35, foreArm: -30 }), holdMs: 700 },
    ],
  },

  /* ============ squat ============ */
  {
    key: 'squat', name: 'Squat', scene: 'rack', prop: 'barbell',
    frames: [
      { label: 'Stand', pose: pose(STANDING, { upperArm: 150, foreArm: -30 }), cue: 'Bar on the upper back, feet shoulder-width.' },
      {
        label: 'Descend',
        pose: pose(STANDING, { hip: [48, 72], spine: -105, thigh: 25, shin: 108, foot: 0, upperArm: 150, foreArm: -30 }),
        holdMs: 900,
        cue: 'Hips back and down. Knees track over the toes.',
      },
      { label: 'Drive', pose: pose(STANDING, { upperArm: 150, foreArm: -30 }), holdMs: 700, cue: 'Push the floor away. Chest stays up.' },
    ],
  },
  {
    // The one drawing that genuinely needed its own scenery. Without the
    // reclined pad and the angled plate, a person on a leg press in
    // strict profile is an unreadable zigzag — the machine IS the
    // information here, not the posture.
    key: 'leg_press', name: 'Leg press', scene: 'press_sled', prop: 'none',
    frames: [
      {
        label: 'Start',
        pose: { hip: [48, 78], spine: 215, neck: 215, upperArm: 120, foreArm: 60, thigh: -25, shin: -25, foot: -115 },
      },
      {
        label: 'Bend',
        pose: { hip: [48, 78], spine: 215, neck: 215, upperArm: 120, foreArm: 60, thigh: -80, shin: 5, foot: -95 },
        holdMs: 900,
        cue: 'Knees towards the chest. Lower back stays on the pad.',
      },
      {
        label: 'Press',
        pose: { hip: [48, 78], spine: 215, neck: 215, upperArm: 120, foreArm: 60, thigh: -25, shin: -25, foot: -115 },
        holdMs: 700,
      },
    ],
  },
  {
    key: 'lunge', name: 'Lunge', scene: 'floor', prop: 'dumbbell', symmetry: 'single',
    frames: [
      { label: 'Stand', pose: STANDING },
      { label: 'Step', pose: pose(STANDING, { hip: [48, 66], thigh: 45, shin: 95, foot: 0 }), holdMs: 900,
        farPose: { thigh: 122, shin: 62, foot: -35 }, cue: 'Back knee towards the floor. Front shin upright.' },
      { label: 'Drive', pose: STANDING, holdMs: 700 },
    ],
  },
  {
    key: 'calf_raise', name: 'Calf raise', scene: 'floor', prop: 'none',
    frames: [
      { label: 'Stretch', pose: pose(STANDING, { hip: [50, 60], foot: 25 }) },
      { label: 'Raise', pose: pose(STANDING, { hip: [50, 50], foot: -58 }), holdMs: 900, cue: 'All the way up onto the toes, pause at the top.' },
      { label: 'Lower', pose: pose(STANDING, { hip: [50, 60], foot: 25 }), holdMs: 700 },
    ],
  },

  /* ============ hinge ============ */
  {
    key: 'deadlift', name: 'Deadlift', scene: 'floor', prop: 'barbell',
    frames: [
      { label: 'Set', pose: pose(STANDING, { hip: [52, 68], spine: -125, thigh: 55, shin: 100, upperArm: 82, foreArm: 88 }), cue: 'Bar over mid-foot, shoulders just in front of it.' },
      { label: 'Pull', pose: pose(STANDING, { upperArm: 82, foreArm: 88 }), holdMs: 900, cue: 'Push the floor away and stand tall. Back stays flat.' },
      { label: 'Lower', pose: pose(STANDING, { hip: [52, 68], spine: -125, thigh: 55, shin: 100, upperArm: 82, foreArm: 88 }), holdMs: 700 },
    ],
  },
  {
    key: 'rdl', name: 'Romanian deadlift', scene: 'floor', prop: 'barbell',
    frames: [
      { label: 'Stand', pose: pose(STANDING, { upperArm: 82, foreArm: 88 }) },
      { label: 'Hinge', pose: pose(STANDING, { hip: [54, 58], spine: -150, thigh: 84, shin: 95, upperArm: 84, foreArm: 88 }), holdMs: 900, cue: 'Hips travel back. Knees soft, not bent.' },
      { label: 'Stand', pose: pose(STANDING, { upperArm: 82, foreArm: 88 }), holdMs: 700 },
    ],
  },
  {
    // `prop: 'none'` on purpose: the implement sits across the HIPS here,
    // and props are drawn at the hand. A barbell floating by the ear
    // would be worse than no barbell at all.
    key: 'hip_thrust', name: 'Hip thrust', scene: 'flat_bench', prop: 'none',
    frames: [
      {
        label: 'Down',
        pose: { hip: [52, 82], spine: 212, neck: 212, upperArm: 168, foreArm: 176, thigh: -20, shin: 80, foot: 0 },
      },
      {
        label: 'Drive',
        pose: { hip: [52, 70], spine: 185, neck: 190, upperArm: 168, foreArm: 176, thigh: 20, shin: 80, foot: 0 },
        holdMs: 900,
        cue: 'Squeeze the glutes at the top. Ribs down.',
      },
      {
        label: 'Lower',
        pose: { hip: [52, 82], spine: 212, neck: 212, upperArm: 168, foreArm: 176, thigh: -20, shin: 80, foot: 0 },
        holdMs: 700,
      },
    ],
  },
  {
    key: 'leg_curl', name: 'Leg curl', scene: 'flat_bench', prop: 'none',
    frames: [
      { label: 'Start', pose: { hip: [54, 74], spine: 184, neck: 184, upperArm: 80, foreArm: 90, thigh: 0, shin: 0, foot: -20 } },
      { label: 'Curl', pose: { hip: [54, 74], spine: 184, neck: 184, upperArm: 80, foreArm: 90, thigh: 0, shin: -95, foot: -110 }, holdMs: 900, cue: 'Heels towards the glutes. Hips stay on the pad.' },
      { label: 'Return', pose: { hip: [54, 74], spine: 184, neck: 184, upperArm: 80, foreArm: 90, thigh: 0, shin: 0, foot: -20 }, holdMs: 700 },
    ],
  },
  {
    key: 'leg_extension', name: 'Leg extension', scene: 'seat', prop: 'none',
    frames: [
      { label: 'Start', pose: pose(SEATED, { thigh: -2, shin: 86, foot: -30 }) },
      { label: 'Extend', pose: pose(SEATED, { thigh: -2, shin: -4, foot: -40 }), holdMs: 900, cue: 'Straighten fully, pause, then lower slowly.' },
      { label: 'Lower', pose: pose(SEATED, { thigh: -2, shin: 86, foot: -30 }), holdMs: 700 },
    ],
  },

  /* ============ arms ============ */
  {
    key: 'curl', name: 'Curl', scene: 'floor', prop: 'barbell',
    frames: [
      { label: 'Start', pose: pose(STANDING, { upperArm: 84, foreArm: 88 }) },
      { label: 'Curl', pose: pose(STANDING, { upperArm: 84, foreArm: -40 }), holdMs: 900, cue: 'Only the forearm moves. Elbows stay at your sides.' },
      { label: 'Lower', pose: pose(STANDING, { upperArm: 84, foreArm: 88 }), holdMs: 700 },
    ],
  },
  {
    key: 'pushdown', name: 'Pushdown', scene: 'cable_tower', prop: 'cable',
    frames: [
      { label: 'Start', pose: pose(STANDING, { upperArm: 84, foreArm: -50 }) },
      { label: 'Extend', pose: pose(STANDING, { upperArm: 84, foreArm: 88 }), holdMs: 900, cue: 'Elbows pinned. Straighten fully at the bottom.' },
      { label: 'Return', pose: pose(STANDING, { upperArm: 84, foreArm: -50 }), holdMs: 700 },
    ],
  },
  {
    key: 'extension_overhead', name: 'Overhead extension', scene: 'floor', prop: 'dumbbell', symmetry: 'mirror',
    frames: [
      { label: 'Start', pose: pose(STANDING, { upperArm: -72, foreArm: -78 }) },
      { label: 'Lower', pose: pose(STANDING, { upperArm: -72, foreArm: 150 }), holdMs: 900, cue: 'Behind the head. Elbows point forward throughout.' },
      { label: 'Extend', pose: pose(STANDING, { upperArm: -72, foreArm: -78 }), holdMs: 700 },
    ],
  },

  /* ============ core ============ */
  {
    key: 'plank', name: 'Plank', scene: 'floor', prop: 'none',
    frames: [
      { label: 'Brace', pose: PRONE, holdMs: 1500, cue: 'Straight line from head to heels. Squeeze everything.' },
      { label: 'Hold', pose: pose(PRONE, { hip: [54, 73], spine: 186 }), holdMs: 1500 },
    ],
  },
  {
    // Straight legs, so this one cannot share the tucked HANGING base —
    // the whole point of the exercise is the leg travelling.
    key: 'leg_raise', name: 'Leg raise', scene: 'pull_bar', prop: 'none',
    frames: [
      { label: 'Hang', pose: pose(HANGING, { thigh: 88, shin: 86, foot: -20 }) },
      { label: 'Raise', pose: pose(HANGING, { thigh: 2, shin: 4, foot: -30 }), holdMs: 900, cue: 'Lift with the abs, not by swinging.' },
      { label: 'Lower', pose: pose(HANGING, { thigh: 88, shin: 86, foot: -20 }), holdMs: 700 },
    ],
  },
  {
    key: 'rotation', name: 'Rotation', scene: 'cable_tower', prop: 'cable', symmetry: 'single',
    frames: [
      { label: 'Load', pose: pose(STANDING, { spine: -100, upperArm: -60, foreArm: -55 }) },
      { label: 'Rotate', pose: pose(STANDING, { spine: -78, upperArm: 45, foreArm: 50 }), holdMs: 900, cue: 'Turn through the ribs, hips stay square.' },
      { label: 'Return', pose: pose(STANDING, { spine: -100, upperArm: -60, foreArm: -55 }), holdMs: 700 },
    ],
  },

  /* ============ cardio & gait ============ */
  {
    key: 'run', name: 'Run', scene: 'treadmill', prop: 'none', symmetry: 'gait',
    frames: [
      { label: 'Drive', pose: pose(STANDING, { spine: -96, thigh: 50, shin: 120, foot: -20, upperArm: 130, foreArm: 10 }), holdMs: 420 },
      { label: 'Float', pose: pose(STANDING, { spine: -96, thigh: 110, shin: 60, foot: -40, upperArm: 40, foreArm: -60 }), holdMs: 420 },
    ],
  },
  {
    key: 'walk', name: 'Walk', scene: 'treadmill', prop: 'none', symmetry: 'gait',
    frames: [
      // A ±20° thigh swing was too subtle to read as walking at 104px —
      // both frames looked like a person standing still. Widened, with
      // the arm counter-swinging so the gait is unmistakable.
      { label: 'Step', pose: pose(STANDING, { thigh: 58, shin: 100, foot: -18, upperArm: 112, foreArm: 104 }), holdMs: 600 },
      { label: 'Stride', pose: pose(STANDING, { thigh: 120, shin: 86, foot: 14, upperArm: 52, foreArm: 60 }), holdMs: 600 },
    ],
  },
  {
    key: 'cycle', name: 'Cycle', scene: 'bike', prop: 'none', symmetry: 'gait',
    frames: [
      { label: 'Push', pose: pose(SEATED, { hip: [50, 70], spine: -108, thigh: 20, shin: 80, foot: 0, upperArm: -18, foreArm: -10 }), holdMs: 450 },
      { label: 'Recover', pose: pose(SEATED, { hip: [50, 70], spine: -108, thigh: -10, shin: 65, foot: 10, upperArm: -18, foreArm: -10 }), holdMs: 450 },
    ],
  },
  {
    key: 'row_erg', name: 'Row', scene: 'rower', prop: 'machine_handle', symmetry: 'mirror',
    frames: [
      { label: 'Catch', pose: pose(SEATED, { hip: [44, 76], spine: -70, thigh: -42, shin: 70, foot: -40, upperArm: -12, foreArm: -6 }) },
      { label: 'Drive', pose: pose(SEATED, { hip: [56, 76], spine: -102, thigh: -6, shin: 4, foot: -40, upperArm: 60, foreArm: 172 }), holdMs: 700 },
      { label: 'Recover', pose: pose(SEATED, { hip: [44, 76], spine: -70, thigh: -42, shin: 70, foot: -40, upperArm: -12, foreArm: -6 }), holdMs: 500 },
    ],
  },
  {
    key: 'stair', name: 'Stair climb', scene: 'stairs', prop: 'none', symmetry: 'gait',
    frames: [
      { label: 'Step up', pose: pose(STANDING, { hip: [50, 54], thigh: 42, shin: 108, foot: -10 }), holdMs: 550,
        farPose: { thigh: 100, shin: 92, foot: -10 } },
      { label: 'Drive', pose: pose(STANDING, { hip: [50, 50], thigh: 80, shin: 92, foot: -10 }), holdMs: 550,
        farPose: { thigh: 40, shin: 106, foot: -10 } },
    ],
  },
  {
    key: 'jump_rope', name: 'Jump rope', scene: 'floor', prop: 'rope',
    frames: [
      { label: 'Land', pose: pose(STANDING, { hip: [50, 60], thigh: 84, shin: 96, foot: -25, upperArm: 70, foreArm: 30 }), holdMs: 340 },
      { label: 'Hop', pose: pose(STANDING, { hip: [50, 50], thigh: 88, shin: 90, foot: -50, upperArm: 70, foreArm: 30 }), holdMs: 340 },
    ],
  },

  /* ============ mobility & warm-up ============ */
  {
    key: 'stretch_hip', name: 'Hip flexor stretch', scene: 'floor', prop: 'none', symmetry: 'single',
    frames: [
      {
      label: 'Kneel', holdMs: 1400,
      pose: { hip: [50, 66], spine: -92, neck: -92, upperArm: 84, foreArm: 88, thigh: 40, shin: 100, foot: 0 },
      farPose: { thigh: 130, shin: 10, foot: -60 },
      cue: 'Back knee down, front foot flat.',
    },
      {
      label: 'Press hips', holdMs: 1400,
      pose: { hip: [54, 68], spine: -80, neck: -80, upperArm: 84, foreArm: 88, thigh: 30, shin: 110, foot: 0 },
      farPose: { thigh: 138, shin: 6, foot: -64 },
      cue: 'Ease the hips forward until the front of the back thigh stretches.',
    },
    ],
  },
  {
    // Drawn as the quadruped "open book" rather than the side-lying
    // version: side-lying is genuinely ambiguous in strict profile —
    // the opening arm sweeps straight out of the picture plane.
    key: 'rotation_thoracic', name: 'Thoracic rotation', scene: 'floor', prop: 'none', symmetry: 'single',
    frames: [
      {
        label: 'Set',
        pose: { hip: [62, 54], spine: 159, neck: 159, upperArm: 90, foreArm: 90, thigh: 100, shin: 85, foot: 20 },
        holdMs: 700,
      },
      {
        // The informative frame, so the loop rests here rather than
        // spending most of its time on a shape that reads as a table.
        label: 'Open',
        pose: { hip: [62, 54], spine: 159, neck: 205, upperArm: 250, foreArm: 250, thigh: 100, shin: 85, foot: 20 },
        holdMs: 1700,
      },
      {
        label: 'Return',
        pose: { hip: [62, 54], spine: 159, neck: 159, upperArm: 90, foreArm: 90, thigh: 100, shin: 85, foot: 20 },
        holdMs: 700,
      },
    ],
  },
  {
    key: 'foam_roll', name: 'Foam roll', scene: 'floor', prop: 'none', symmetry: 'single',
    frames: [
      { label: 'Set', pose: { hip: [50, 74], spine: 200, neck: 200, upperArm: 130, foreArm: 168, thigh: 4, shin: -30, foot: -60 } },
      { label: 'Roll', pose: { hip: [58, 74], spine: 200, neck: 200, upperArm: 130, foreArm: 168, thigh: 4, shin: -30, foot: -60 }, holdMs: 900 },
    ],
  },
  {
    key: 'arm_circle', name: 'Arm circles', scene: 'floor', prop: 'none',
    frames: [
      { label: 'Forward', pose: pose(STANDING, { upperArm: -10, foreArm: -6 }), holdMs: 500 },
      { label: 'Up', pose: pose(STANDING, { upperArm: -72, foreArm: -76 }), holdMs: 500 },
      { label: 'Back', pose: pose(STANDING, { upperArm: 175, foreArm: 172 }), holdMs: 500 },
    ],
  },
  {
    key: 'shoulder_rotation', name: 'Shoulder rotation', scene: 'floor', prop: 'band',
    frames: [
      { label: 'In', pose: pose(STANDING, { upperArm: 84, foreArm: 4 }) },
      { label: 'Out', pose: pose(STANDING, { upperArm: 84, foreArm: -80 }), holdMs: 800 },
      { label: 'In', pose: pose(STANDING, { upperArm: 84, foreArm: 4 }), holdMs: 600 },
    ],
  },
  {
    key: 'leg_swing', name: 'Leg swing', scene: 'floor', prop: 'none', symmetry: 'single',
    frames: [
      { label: 'Back', pose: pose(STANDING, { thigh: 115, shin: 96 }), holdMs: 500,
        farPose: { thigh: 88, shin: 90, foot: 0 } },
      { label: 'Forward', pose: pose(STANDING, { thigh: 35, shin: 60 }), holdMs: 500,
        farPose: { thigh: 88, shin: 90, foot: 0 } },
    ],
  },
  {
    key: 'cat_cow', name: 'Cat–cow', scene: 'floor', prop: 'none',
    frames: [
      { label: 'Round', pose: { hip: [56, 68], spine: 172, neck: 145, upperArm: 88, foreArm: 90, thigh: 95, shin: 4, foot: -30 }, holdMs: 1100 },
      { label: 'Arch', pose: { hip: [56, 70], spine: 196, neck: 225, upperArm: 88, foreArm: 90, thigh: 95, shin: 4, foot: -30 }, holdMs: 1100 },
    ],
  },
  {
    // Shares the squat's LEGS but holds the load at the chest. Without
    // this, `goblet-squat` borrowed the back-squat arms and drew its
    // dumbbell straight through the figure's head — on day 1 of the
    // beginner plan, which is the first drawing most members ever see.
    key: 'squat_goblet', name: 'Goblet squat', scene: 'floor', prop: 'dumbbell',
    frames: [
      { label: 'Stand', pose: pose(STANDING, { upperArm: 70, foreArm: -100 }) },
      {
        label: 'Sit back',
        pose: pose(STANDING, { hip: [48, 72], spine: -105, thigh: 25, shin: 108, foot: 0, upperArm: 70, foreArm: -100 }),
        holdMs: 900,
        cue: 'Elbows inside the knees, chest proud.',
      },
      { label: 'Drive', pose: pose(STANDING, { upperArm: 70, foreArm: -100 }), holdMs: 700 },
    ],
  },
  {
    key: 'squat_bodyweight', name: 'Bodyweight squat', scene: 'floor', prop: 'none',
    frames: [
      { label: 'Stand', pose: pose(STANDING, { upperArm: 10, foreArm: 4 }) },
      { label: 'Sit back', pose: pose(STANDING, { hip: [48, 72], spine: -105, thigh: 25, shin: 108, foot: 0, upperArm: 8, foreArm: 2 }), holdMs: 900, cue: 'Sit between your heels. Heels stay down.' },
      { label: 'Stand', pose: pose(STANDING, { upperArm: 10, foreArm: 4 }), holdMs: 700 },
    ],
  },
];

/** Drawing lookup. Missing keys are a content bug, so this is checked at seed time. */
export const DRAWING_INDEX: ReadonlyMap<string, MovementDrawing> =
  new Map(MOVEMENT_DRAWINGS.map((d) => [d.key, d]));

export type DrawingKey = string;
