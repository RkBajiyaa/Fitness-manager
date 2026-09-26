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
  // thigh/shin solved so the ankle lands ON the floor and stays there:
  // §10 asks for planted feet, and a bench press where the feet drift
  // is a bench press with nothing to push against.
  hip: [56, 66], spine: 178, neck: 178,
  upperArm: -90, foreArm: -90,
  thigh: 26, shin: 77, foot: 0,
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

/**
 * Legs hanging straight, for the front-view pull-up.
 *
 * The `Pull` frame's arm angles are solved BACKWARDS from the bar
 * rather than eyeballed: the hands have to finish where they started,
 * because in a pull-up the bar is what does not move. Two 13-unit
 * segments reaching 16 units put the elbow 51° off the line, which is
 * the wide elbow flare a pull-up actually has from the front.
 */
const PU_LEGS: Partial<Pose> = { thigh: 88, shin: 92, foot: 30 };

/** A back squat's arms: the upper arm points away, the forearm up. */
const SQ_ARMS = { upperArm: 0.55, foreArm: 0.72 } as const;

export const MOVEMENT_DRAWINGS: MovementDrawing[] = [
  /* ============ horizontal push ============ */
  {
    /* ------------------------------------------------------------
       THE BENCH PRESS — benchmark two.

       SIDE, not three-quarter, and that is a correction rather than a
       preference. A pose stores angles in the picture plane and draws
       every segment at full length, so declaring a camera also asserts
       that the body is side-on to it. For a STANDING figure the spine
       is vertical and that holds at any camera angle, which is why the
       squat turns freely. For a figure LYING DOWN the spine is
       horizontal, so turning the camera would foreshorten the whole
       torso — and at three-quarters the plan was instead separating
       the two shoulders along the body's own length, putting the near
       shoulder a hand's width nearer the feet than the far one.

       Profile is also what §13 asks for on its merits: a bench press
       is bar path, elbow angle and the arch, and all three are
       sagittal facts.

       The arms foreshorten (§5). At the bottom the upper arms point
       away from a side-on viewer — the grip is wider than the
       shoulders — so they draw at half length, which is what puts the
       elbow beside the ribs instead of a forearm's reach past them.
       ------------------------------------------------------------ */
    key: 'press_flat', name: 'Flat press', scene: 'flat_bench', prop: 'barbell',
    armPlane: 'frontal',
    view: 'side', tempoScale: 1.72, effortFrame: 2,
    stabilisers: ['abs', 'rotator_cuff'],
    frames: [
      {
        label: 'Setup', ease: 'decel', moveShare: 0.62, holdMs: 1150,
        pose: SUPINE,
        cue: 'Shoulder blades pinned back and down, feet flat on the floor.',
      },
      {
        label: 'Lower', ease: 'smooth', moveShare: 1, holdMs: 620,
        pose: pose(SUPINE, {
          upperArm: -55, foreArm: -100,
          short: { upperArm: 0.62, foreArm: 0.955 },
        }),
        cue: 'Down under control. Elbows about 45°, not flared wide.',
      },
      {
        label: 'Chest', ease: 'decel', moveShare: 0.74, holdMs: 1150,
        pose: pose(SUPINE, {
          upperArm: 35, foreArm: -92,
          short: { upperArm: 0.5, foreArm: 0.97 },
        }),
        cue: 'The bar touches the mid-chest. Ribs stay down.',
      },
      {
        label: 'Press', ease: 'accel', moveShare: 1, holdMs: 560,
        pose: pose(SUPINE, {
          upperArm: -55, foreArm: -100,
          short: { upperArm: 0.62, foreArm: 0.955 },
        }),
        cue: 'Drive up and slightly back, over the shoulders.',
      },
    ],
    mistake: {
      label: 'Bar drifts to the throat',
      at: 2,
      pose: pose(SUPINE, {
        upperArm: -140, foreArm: -77,
        short: { upperArm: 0.5, foreArm: 0.84 },
      }),
      why: 'The bar belongs on the mid-chest — higher and the load moves away from the muscles doing the work.',
    },
  },
  {
    // Side for the same reason the flat press is: a reclined trunk is
    // 65° off vertical, so a turned camera would foreshorten it.
    key: 'press_incline', name: 'Incline press', scene: 'incline_bench', prop: 'dumbbell',
    armPlane: 'frontal',
    view: 'side', tempoScale: 1.05,
    frames: [
      { label: 'Setup', pose: RECLINED, cue: 'Bench at 30°. Any steeper is a shoulder press.' },
      { label: 'Lower', ease: 'smooth', moveShare: 0.84, pose: pose(RECLINED, { upperArm: -5, foreArm: -110 }), holdMs: 900, cue: 'Down to the upper chest, under control.' },
      { label: 'Press', ease: 'settle', moveShare: 0.62, pose: RECLINED, holdMs: 700, cue: 'Up and slightly together.' },
    ],
  },
  {
    key: 'fly', name: 'Fly', scene: 'flat_bench', prop: 'dumbbell',
    armPlane: 'frontal',
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
    armPlane: 'frontal',
    view: 'three_quarter', tempoScale: 1.05,
    frames: [
      {
        label: 'Rack', cue: 'Bar at collarbone height, elbows under it.',
        pose: pose(STANDING, { hip: [50, 58], thigh: 84, shin: 96, upperArm: 118, foreArm: -86 }),
      },
      {
        label: 'Press', ease: 'settle', moveShare: 0.62, holdMs: 900,
        cue: 'Straight overhead. Squeeze the glutes so you do not lean back.',
        pose: pose(STANDING, { hip: [50, 58], thigh: 84, shin: 96, upperArm: -84, foreArm: -88 }),
      },
      {
        label: 'Lower', ease: 'smooth', moveShare: 0.84, holdMs: 700,
        pose: pose(STANDING, { hip: [50, 58], thigh: 84, shin: 96, upperArm: 118, foreArm: -86 }),
      },
    ],
  },
  {
    key: 'raise_lateral', name: 'Lateral raise', scene: 'floor', prop: 'dumbbell',
    armPlane: 'frontal',
    view: 'front', tempoScale: 1.2,
    frames: [
      { label: 'Start', pose: pose(STANDING, { upperArm: 82, foreArm: 86 }), cue: 'Arms by your sides, slight bend at the elbow.' },
      { label: 'Raise', ease: 'decel', moveShare: 0.78, pose: pose(STANDING, { upperArm: 2, foreArm: 8 }), holdMs: 900, cue: 'Up to shoulder height. No higher, no swinging.' },
      { label: 'Lower', ease: 'smooth', moveShare: 0.86, pose: pose(STANDING, { upperArm: 82, foreArm: 86 }), holdMs: 700 },
    ],
  },

  /* ============ vertical pull ============ */
  {
    key: 'pulldown', name: 'Pulldown', scene: 'lat_tower', prop: 'cable',
    armPlane: 'frontal',
    /*
     * Three-quarters, not dead-on, and the reason is the SEAT. A
     * seated figure's thighs point at the camera, and a pose angle
     * measured in the picture plane cannot say "towards you" — from
     * the front the mirror puts one thigh out to each side and the
     * member gets a frog. Turned, the same angles read as two thighs
     * going forward. It is still the view §15 asks for (front/¾) and
     * it still shows both lats and both elbows.
     */
    view: 'three_quarter', tempoScale: 1.05,
    frames: [
      { label: 'Reach', pose: pose(SEATED, { spine: -84, upperArm: -80, foreArm: -86 }), cue: 'Arms long overhead, chest tall.' },
      { label: 'Pull', ease: 'decel', moveShare: 0.7, pose: pose(SEATED, { spine: -80, upperArm: -20, foreArm: -120 }), holdMs: 900, cue: 'Elbows to the ribs. Lead with the elbows, not the hands.' },
      { label: 'Return', ease: 'smooth', moveShare: 0.84, pose: pose(SEATED, { spine: -84, upperArm: -80, foreArm: -86 }), holdMs: 700 },
    ],
    mistake: {
      label: 'Leaning too far back',
      at: 1,
      pose: pose(SEATED, { spine: -58, upperArm: -46, foreArm: -128 }),
      why: 'Past a slight lean it stops being a pulldown and becomes a row you cannot control.',
    },
  },
  {
    key: 'pull_up', name: 'Pull-up', scene: 'pull_bar', prop: 'none',
    armPlane: 'frontal',
    view: 'front', tempoScale: 1.1,
    /*
     * The shared HANGING base tucks the knees so that a hang fits the
     * old 100-unit box. Seen from the FRONT that tuck mirrors into a
     * frog — one knee out to each side — so this drawing hangs its
     * legs straight instead. It can afford to: the frame is composed
     * from the drawing's own extremes now, so a tall pose is no
     * longer a problem to be posed around.
     */
    frames: [
      { label: 'Hang', pose: pose(HANGING, PU_LEGS), cue: 'Dead hang, shoulders active.' },
      { label: 'Pull', ease: 'accel', moveShare: 0.68, pose: pose(HANGING, { ...PU_LEGS, hip: [50, 52], upperArm: -28, foreArm: -131 }), holdMs: 900, cue: 'Chest towards the bar, chin over it.' },
      { label: 'Lower', ease: 'smooth', moveShare: 0.86, pose: pose(HANGING, PU_LEGS), holdMs: 700 },
    ],
  },
  {
    key: 'hang', name: 'Hang', scene: 'pull_bar', prop: 'none',
    armPlane: 'frontal',
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
    view: 'three_quarter_rear', tempoScale: 1.05,
    frames: [
      { label: 'Hinge', pose: pose(STANDING, { hip: [52, 60], spine: -140, thigh: 80, shin: 92, upperArm: 84, foreArm: 88 }), cue: 'Hips back, back flat, bar hanging.' },
      { label: 'Pull', ease: 'accel', moveShare: 0.62, pose: pose(STANDING, { hip: [52, 60], spine: -140, thigh: 80, shin: 92, upperArm: 130, foreArm: 30 }), holdMs: 900, cue: 'Bar to the lower ribs. The torso does not rise.' },
      { label: 'Lower', ease: 'smooth', moveShare: 0.84, pose: pose(STANDING, { hip: [52, 60], spine: -140, thigh: 80, shin: 92, upperArm: 84, foreArm: 88 }), holdMs: 700 },
    ],
    mistake: {
      label: 'Torso rises with the bar',
      at: 1,
      pose: pose(STANDING, { hip: [52, 60], spine: -168, thigh: 80, shin: 92, upperArm: 150, foreArm: 20 }),
      why: 'Standing up as you pull hands the work to the lower back instead of the lats.',
    },
  },
  {
    key: 'face_pull', name: 'Face pull', scene: 'cable_tower', prop: 'cable',
    armPlane: 'frontal',
    frames: [
      { label: 'Reach', pose: pose(STANDING, { upperArm: -35, foreArm: -30 }) },
      { label: 'Pull', pose: pose(STANDING, { upperArm: -5, foreArm: -155 }), holdMs: 900, cue: 'Rope to the forehead, elbows high and wide.' },
      { label: 'Return', pose: pose(STANDING, { upperArm: -35, foreArm: -30 }), holdMs: 700 },
    ],
  },

  /* ============ squat ============ */
  {
    /*
     * The upper arm points BACK from a three-quarter viewer and the
     * forearm comes up and slightly forward, so neither is side-on and
     * neither draws at full length. Without this the elbow lands at
     * the navel and the folded arm unions into a paddle across the
     * chest; with it the elbow sits at mid-torso where a back squat
     * actually puts it.
     */
    /* eslint-disable-next-line */
    /* ------------------------------------------------------------
       THE BACK SQUAT — the benchmark this renderer was built against.

       Three things here are not like the other drawings, and all
       three are the brief's:

       · EVERY KEY IS SOLVED FROM A PLANTED ANKLE (§10). A pose hangs
         off the hip, so interpolating the angles between a standing
         figure and a squatting one slides the foot four units forward
         and a unit through the floor — the figure squats on roller
         skates. The fix is not an IK solver: it is enough keys, each
         with its hip solved BACKWARDS from the ankle it must keep.
         With four down and two up the worst mid-key drift is 0.83
         units, a fifth of a foot width, which nobody can see.
       · SIX KEYS, FOUR PHASES (§15). The two shaping keys are
         `silent`: they carry the travel and none of the vocabulary.
       · THE ARMS ARE FRONTAL (§13). A back squat's hands go out to
         the sides of the bar, so the far arm is a genuine mirror. The
         legs are sagittal — the knees both travel forward — which is
         what stops a three-quarter squat being drawn as a lunge.
       ------------------------------------------------------------ */
    key: 'squat', name: 'Squat', scene: 'rack', prop: 'barbell',
    armPlane: 'frontal', gripBehind: true,
    view: 'three_quarter', tempoScale: 1.42,
    /*
     * Named, not inferred. `effortIndex` falls back to the longest
     * hold, and the top of a squat is held for about as long as the
     * bottom — so the fallback picked STANDING as the working
     * position, and the quadriceps lit up brightest at the one moment
     * in the repetition they are doing the least.
     */
    effortFrame: 3,
    stabilisers: ['abs', 'obliques', 'spinal_erectors'],
    frames: [
      {
        label: 'Stand', ease: 'settle', moveShare: 0.6, holdMs: 1000,
        pose: { hip: [50, 56], spine: -90, chest: -90, neck: -90,
          upperArm: 84, foreArm: -78, short: SQ_ARMS, thigh: 88, shin: 90, foot: 0 },
        cue: 'Bar across the upper back, feet shoulder-width, chest tall.',
      },
      {
        label: 'Descend', ease: 'smooth', moveShare: 1, holdMs: 560,
        pose: { hip: [44.4, 58.1], spine: -79, chest: -82, neck: -86,
          upperArm: 84, foreArm: -78, short: SQ_ARMS, thigh: 62, shin: 96, foot: 0 },
        cue: 'Hips back and down together. Knees track out over the toes.',
      },
      {
        silent: true, ease: 'linear', moveShare: 1, holdMs: 560,
        label: 'Descend',
        pose: { hip: [40, 65], spine: -66, chest: -71, neck: -80,
          upperArm: 84, foreArm: -78, short: SQ_ARMS, thigh: 30, shin: 104, foot: 0 },
      },
      {
        label: 'Bottom', ease: 'decel', moveShare: 0.7, holdMs: 980,
        pose: { hip: [40.1, 76], spine: -58, chest: -64, neck: -76,
          upperArm: 84, foreArm: -78, short: SQ_ARMS, thigh: -6, shin: 112, foot: 0 },
        cue: 'Hip crease just below the knee. Whole foot stays down.',
      },
      {
        label: 'Drive', ease: 'accel', moveShare: 1, holdMs: 480,
        pose: { hip: [40, 65], spine: -66, chest: -71, neck: -80,
          upperArm: 84, foreArm: -78, short: SQ_ARMS, thigh: 30, shin: 104, foot: 0 },
        cue: 'Push the floor away. Hips and chest rise together.',
      },
      {
        silent: true, ease: 'linear', moveShare: 1, holdMs: 560,
        label: 'Drive',
        pose: { hip: [44.4, 58.1], spine: -79, chest: -82, neck: -86,
          upperArm: 84, foreArm: -78, short: SQ_ARMS, thigh: 62, shin: 96, foot: 0 },
      },
    ],
    mistake: {
      /*
       * Now an honest drawing rather than an approximate one. With two
       * trunk segments the THORAX can drop while the lumbar segment
       * holds its angle, which is exactly what "the chest falls" looks
       * like on a real squat — and it is a different picture from
       * simply leaning further forward, which is all one segment could
       * ever say.
       */
      label: 'Chest drops forward',
      at: 3,
      pose: { hip: [40.1, 76], spine: -56, chest: -32, neck: -50,
        upperArm: 74, foreArm: -62, thigh: -6, shin: 112, foot: 0 },
      why: 'The bar travels forward of the mid-foot, which turns a squat into a good morning.',
    },
  },
  {
    key: 'leg_press', name: 'Leg press', scene: 'press_sled', prop: 'none',
    view: 'side', tempoScale: 1.05,
    frames: [
      {
        label: 'Start',
        pose: { hip: [48, 78], spine: 215, neck: 215, upperArm: 120, foreArm: 60, thigh: -25, shin: -25, foot: -115 },
      },
      {
        label: 'Bend', ease: 'smooth', moveShare: 0.84,
        pose: { hip: [48, 78], spine: 215, neck: 215, upperArm: 120, foreArm: 60, thigh: -80, shin: 5, foot: -95 },
        holdMs: 900,
        cue: 'Knees towards the chest. Lower back stays on the pad.',
      },
      {
        label: 'Press', ease: 'accel', moveShare: 0.62,
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
    /* ------------------------------------------------------------
       THE DEADLIFT — benchmark three, and the one that most needed
       the planted ankle.

       It used to hinge from a hip that moved twelve units while the
       angles stayed put, so between "Set" and "Stand" the ankle
       travelled eight units forward and EIGHT AND A HALF UNITS BELOW
       THE FLOOR. Every key here is solved backwards from an ankle that
       does not move.

       Two things the two-segment trunk buys, and both are the lift's
       actual coaching points:

       · the knee travels BACK as the bar rises (shin 101° → 95°),
         which is what "push the floor away" looks like and what a
         single hip-rooted interpolation could never show;
       · "hips rise first" is now a drawing rather than a caption. The
         wrong pose has the hip three units higher and the thorax ten
         degrees flatter, at the same instant, with the hands still on
         the bar — so the reader compares two setups, not a setup and
         a lockout.

       SIDE, deliberately, against §13's preference for three-quarter:
       bar over mid-foot, shin angle, hip height and back angle are all
       profile facts, and from three-quarters the near leg hides the
       one relationship the lift is taught by.
       ------------------------------------------------------------ */
    key: 'deadlift', name: 'Deadlift', scene: 'floor', prop: 'barbell',
    view: 'side', tempoScale: 1.45, effortFrame: 1,
    stabilisers: ['abs', 'traps', 'forearms'],
    frames: [
      {
        label: 'Set', ease: 'smooth', moveShare: 0.55, holdMs: 1100,
        pose: {
          hip: [37, 72.3], spine: -40, chest: -44, neck: -30,
          upperArm: 93, foreArm: 93, thigh: 3.5, shin: 101.4, foot: 0,
        },
        cue: 'Bar over mid-foot, shoulders just in front of it, chest up.',
      },
      {
        label: 'Pull', ease: 'accel', moveShare: 1, holdMs: 620,
        pose: {
          hip: [37.8, 63.8], spine: -42, chest: -49, neck: -36,
          upperArm: 93.5, foreArm: 93.5, thigh: 33, shin: 94.9, foot: 0,
        },
        cue: 'Push the floor away. The bar and the hips rise together.',
      },
      {
        label: 'Stand', ease: 'settle', moveShare: 0.68, holdMs: 1050,
        pose: {
          hip: [50, 56], spine: -90, chest: -90, neck: -90,
          upperArm: 93.1, foreArm: 93.1, thigh: 88.5, shin: 89.4, foot: 0,
        },
        cue: 'Stand tall. Squeeze the hips; do not lean back.',
      },
      {
        label: 'Lower', ease: 'smooth', moveShare: 1, holdMs: 620,
        pose: {
          hip: [37.8, 63.8], spine: -42, chest: -49, neck: -36,
          upperArm: 93.5, foreArm: 93.5, thigh: 33, shin: 94.9, foot: 0,
        },
        cue: 'Hips back first, then bend the knees.',
      },
      {
        silent: true, ease: 'smooth', moveShare: 1, holdMs: 700,
        label: 'Lower',
        pose: {
          hip: [37, 72.3], spine: -40, chest: -44, neck: -30,
          upperArm: 93, foreArm: 93, thigh: 3.5, shin: 101.4, foot: 0,
        },
      },
    ],
    mistake: {
      label: 'Hips rise first',
      at: 0,
      pose: {
        hip: [37, 69], spine: -30, chest: -32, neck: -22,
        upperArm: 99.1, foreArm: 99.1, thigh: 14.5, shin: 99.7, foot: 0,
      },
      why: 'The hips rise before the bar does, so the back takes the load the legs were meant to.',
    },
  },
  {
    key: 'rdl', name: 'Romanian deadlift', scene: 'floor', prop: 'barbell',
    view: 'side', tempoScale: 1.2,
    frames: [
      { label: 'Stand', pose: pose(STANDING, { upperArm: 82, foreArm: 88 }) },
      { label: 'Hinge', ease: 'smooth', moveShare: 0.86, pose: pose(STANDING, { hip: [54, 58], spine: -150, thigh: 84, shin: 95, upperArm: 84, foreArm: 88 }), holdMs: 900, cue: 'Hips travel back. Knees soft, not bent.' },
      { label: 'Stand', ease: 'accel', moveShare: 0.64, pose: pose(STANDING, { upperArm: 82, foreArm: 88 }), holdMs: 700 },
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
    view: 'three_quarter', tempoScale: 1.0,
    frames: [
      { label: 'Start', pose: pose(STANDING, { upperArm: 84, foreArm: 88 }) },
      { label: 'Curl', ease: 'decel', moveShare: 0.7, pose: pose(STANDING, { upperArm: 84, foreArm: -40 }), holdMs: 900, cue: 'Only the forearm moves. Elbows stay at your sides.' },
      { label: 'Lower', ease: 'smooth', moveShare: 0.86, pose: pose(STANDING, { upperArm: 84, foreArm: 88 }), holdMs: 700 },
    ],
  },
  {
    key: 'pushdown', name: 'Pushdown', scene: 'cable_tower', prop: 'cable',
    view: 'three_quarter', tempoScale: 0.95,
    frames: [
      { label: 'Start', pose: pose(STANDING, { upperArm: 84, foreArm: -50 }) },
      { label: 'Extend', ease: 'accel', moveShare: 0.66, pose: pose(STANDING, { upperArm: 84, foreArm: 88 }), holdMs: 900, cue: 'Elbows pinned. Straighten fully at the bottom.' },
      { label: 'Return', ease: 'smooth', moveShare: 0.84, pose: pose(STANDING, { upperArm: 84, foreArm: -50 }), holdMs: 700 },
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
    armPlane: 'frontal',
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
    armPlane: 'frontal',
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
    armPlane: 'frontal',
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
    // Slow both ways. The default split returned 160° of arm rotation
    // in half a second, which on a mobility drill is the opposite of
    // the instruction.
    tempoScale: 1.15,
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
        holdMs: 1200, ease: 'smooth', moveShare: 0.82,
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
    armPlane: 'frontal',
    /*
     * QUARTERS, not thirds, and `linear` throughout.
     *
     * The three original keys were 62°, 113° and 175° apart and were
     * each given the same 500ms, so the arm crawled through the first
     * third of the circle and whipped through the last. A circle is
     * the one movement in the library that genuinely travels at one
     * speed, which is what `linear` is for (§19), and four keys are
     * what make each quarter the same size.
     */
    frames: [
      { label: 'Forward', pose: pose(STANDING, { upperArm: 0, foreArm: 2 }), holdMs: 420, ease: 'linear', moveShare: 1 },
      { label: 'Up', pose: pose(STANDING, { upperArm: -90, foreArm: -88 }), holdMs: 420, ease: 'linear', moveShare: 1 },
      { label: 'Back', pose: pose(STANDING, { upperArm: 180, foreArm: 178 }), holdMs: 420, ease: 'linear', moveShare: 1 },
      { label: 'Down', pose: pose(STANDING, { upperArm: 90, foreArm: 92 }), holdMs: 420, ease: 'linear', moveShare: 1 },
    ],
  },
  {
    key: 'shoulder_rotation', name: 'Shoulder rotation', scene: 'floor', prop: 'band',
    armPlane: 'frontal',
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
    armPlane: 'frontal',
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
