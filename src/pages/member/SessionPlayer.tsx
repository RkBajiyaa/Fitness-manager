/* ============================================================
   THE ACTIVE WORKOUT PLAYER.

   The one screen in this product that is used standing up, one
   handed, mid-set, with a barbell waiting. Every decision here is
   downstream of that:

     · ONE exercise is expanded at a time (§14). Eight open cards
       means scrolling to find your place between every set.
     · The expanded exercise is chosen for you — the first one with
       work left — but you can open any of them, in any order (§14).
       A member who does the cable fly before the incline press is
       not wrong, and the app should not argue.
     · Weight and reps are steppers first, keyboard second (§16).
       A numeric keyboard covers half a phone and takes two taps to
       dismiss; +2.5 takes one tap and never hides anything.
     · The How-To only mounts for the OPEN exercise (§27), so a
       six-exercise workout animates one figure, not six.
     · Previous performance sits directly above the inputs (§17),
       because "what did I do last time" is the question the member
       actually opens the app to answer.
     · OPENING AN EXERCISE KEEPS YOU WITH THAT EXERCISE. One card
       open at a time means every expand also COLLAPSES one, and
       when the collapsing card is above the tapped one the whole
       list slides up under your finger — measured at 360px, a tap
       on exercise 4 sent it 689px off the top of the screen. The
       accordion is scroll-anchored: see `useLayoutEffect` below.
   ============================================================ */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, Modal } from '../../components/ui/primitives';
import { SearchInput } from '../../components/ui/forms';
import { Icon } from '../../components/ui/Icon';
import { HowTo } from '../../components/member/HowTo';
import { ExerciseThumb } from '../../components/member/ExerciseThumb';
import { MuscleMap } from '../../components/member/MuscleMap';
import { ExerciseTeaching } from '../../components/member/ExerciseTeaching';
import { useApp, useData } from '../../state/app';
import * as api from '../../lib/api';
import type { Exercise, SessionSet, WorkoutSession } from '../../lib/types';
import { errorMessage } from '../../components/ui/forms';

/** Plate-friendly step. Most gyms' smallest usable jump on a bar. */
const WEIGHT_STEP = 2.5;
const DEFAULT_REST_SEC = 90;
/**
 * Where an exercise you just opened comes to rest, measured from the
 * top of the scrolling area. Not zero: a few pixels of the card above
 * stay visible, which is what tells you the list did not reset.
 */
const ANCHOR_TOP = 10;

export default function SessionPlayer() {
  const { session, toast, celebrate, confirm } = useApp();
  const nav = useNavigate();
  const memberId = session?.memberId ?? '';

  const active = useData(() => (session && memberId ? api.sessions.active(session, memberId) : null), [memberId]);
  const me = useData(() => {
    if (!session || !memberId) return null;
    try { return api.members.get(session, memberId); } catch { return null; }
  }, [memberId]);

  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [rest, setRest] = useState<{ total: number; left: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  /** Which exercise is expanded. null ⇒ fall back to the first with work left. */
  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * A second tap on the open header folds it away. The auto-open
   * fallback would immediately re-open the same card, so "nothing is
   * expanded" needs its own flag rather than `openId = null`.
   */
  const [collapsed, setCollapsed] = useState(false);
  /** Suppress the frame timer while a number is being edited. */
  const [editing, setEditing] = useState(false);

  /* ---- scroll anchoring ---- */
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());
  /**
   * What the next layout should do with the card we are about to
   * open or fold. `hold` is the viewport y the header was at when it
   * was tapped — set when folding, so the card stays exactly under
   * the finger; null when opening, so it comes up to ANCHOR_TOP.
   */
  const anchor = useRef<{ id: string; hold: number | null } | null>(null);
  const settled = useRef(false);

  // `undefined` means nobody has expressed a preference, which is not
  // the same as "off" (§13). Only an explicit false turns it off.
  const showHowTo = me?.member.fitness.showHowTo !== false;

  const toggleHowTo = useCallback(async () => {
    if (!session || !memberId) return;
    try {
      await api.members.updateFitness(session, memberId, { showHowTo: !showHowTo });
      toast('info', showHowTo ? 'Demonstrations hidden' : 'Demonstrations shown',
        showHowTo ? 'Sets and reps only. Turn them back on any time.' : '');
    } catch (e) {
      toast('error', 'Could not save that preference', errorMessage(e));
    }
  }, [session, memberId, showHowTo, toast]);

  /* ---- elapsed clock ---- */
  useEffect(() => {
    if (!active) return;
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - new Date(active.startedAt).getTime()) / 1000)));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [active?.id, active?.startedAt]);

  /* ---- rest timer ---- */
  useEffect(() => {
    if (!rest) return;
    if (rest.left <= 0) { setRest(null); return; }
    const t = window.setTimeout(() => setRest((r) => (r ? { ...r, left: r.left - 1 } : null)), 1000);
    return () => window.clearTimeout(t);
  }, [rest]);

  const start = useCallback(async () => {
    if (!session || !memberId) return;
    setStarting(true);
    try {
      await api.sessions.start(session, memberId, {});
    } catch (e) {
      toast('error', 'Could not start the session', errorMessage(e));
    } finally {
      setStarting(false);
    }
  }, [session, memberId, toast]);

  // Auto-start so "Start workout" is genuinely one tap from Home.
  useEffect(() => {
    if (session && memberId && !active && !starting) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, memberId, active]);

  /**
   * NOT `useMemo(..., [active])`. `db.commit()` mutates rows in place
   * (§25), so adding an exercise mid-workout pushes sets onto the
   * very object this already holds — same reference, so a memo keyed
   * on it never recomputes. The session was written, the toast said
   * so, and the new exercise did not appear until a reload. `useData`
   * folds the store revision into its own dependencies, which is the
   * only key that is honest about an in-place store.
   */
  const groups = useData(() => (active ? groupByExercise(active) : []), [active]);

  /**
   * Display numbers count WORKING exercises only. Numbering the
   * warm-ups too made the first real exercise of the day "4", which
   * is both wrong and mildly demoralising.
   */
  const displayNumbers = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const g of groups) {
      const warmup = g.sets.length > 0 && g.sets.every((s) => s.kind === 'warmup');
      map.set(g.exerciseId, warmup ? 0 : ++n);
    }
    return map;
  }, [groups]);

  /**
   * The exercise to show expanded. An explicit choice wins; otherwise
   * it is the first with unfinished sets, which is what makes the
   * player feel like it is following you rather than the other way
   * round.
   */
  const firstUnfinished = groups.find((g) => g.sets.some((s) => !s.completed))?.exerciseId ?? null;
  const currentId = openId && groups.some((g) => g.exerciseId === openId)
    ? openId
    : firstUnfinished ?? groups[0]?.exerciseId ?? null;
  /** What is actually expanded — `currentId` is still "where you are". */
  const openCardId = collapsed ? null : currentId;

  /**
   * KEEP THE SCREEN WITH THE EXERCISE YOU TAPPED.
   *
   * Expanding one card collapses another, and when the collapsing
   * card is above the tapped one every pixel it gives up drags the
   * list upward — plus the browser clamps scrollTop when the
   * document shrinks. Measured on a 360×780 phone: tapping exercise
   * 4 while it sat comfortably at y=376 put it at y=-313. You tap an
   * exercise because you want to look at that exercise; the screen
   * should still be looking at it afterwards.
   *
   * So the scroll position is not preserved — the CARD's position
   * is. After the DOM has changed and before the browser paints,
   * measure where the card landed and correct the scroller by the
   * difference. Opening brings the header to ANCHOR_TOP, which is
   * the only position that guarantees the newly revealed body is on
   * screen; folding puts the header back exactly where the finger
   * left it.
   *
   * useLayoutEffect, not useEffect: after paint this is a visible
   * jump followed by a correction. It also runs ONLY when the open
   * card changes, so ticking a set never moves the page.
   *
   * The one thing it cannot do is scroll past the end: folding the
   * LAST card removes most of what there was to scroll against, so
   * the browser clamps and that header drifts down the screen. It
   * stays visible and it never rises, which is the part that
   * mattered — you are still looking at the exercise you tapped.
   */
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const pending = anchor.current;
    anchor.current = null;
    if (!scroller) return;
    const targetId = openCardId ?? pending?.id ?? null;
    const el = targetId ? cardEls.current.get(targetId) : null;
    if (!el) return;
    // The first card opens itself on mount; the member has not asked
    // for anything yet, so nothing should move.
    if (!settled.current) { settled.current = true; return; }
    const want = pending?.hold ?? scroller.getBoundingClientRect().top + ANCHOR_TOP;
    const delta = el.getBoundingClientRect().top - want;
    if (Math.abs(delta) < 2) return;
    const reduced = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({
      top: scroller.scrollTop + delta,
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [openCardId]);

  /**
   * Tapping a header. The open one folds away; any other one opens.
   * `headerTop` is measured by the caller BEFORE React re-renders,
   * which is the only moment it is still true.
   */
  const toggleCard = (id: string, headerTop: number) => {
    if (id === openCardId) {
      anchor.current = { id, hold: headerTop };
      setCollapsed(true);
      return;
    }
    anchor.current = { id, hold: null };
    setCollapsed(false);
    setOpenId(id);
  };

  /** Jumping, adding and auto-advancing all mean "open this one". */
  const goTo = (id: string) => {
    anchor.current = { id, hold: null };
    setCollapsed(false);
    setOpenId(id);
  };

  if (!session || !memberId) return null;

  if (!active) {
    return (
      <div className="player">
        <div className="player__body">
          <div className="player__inner">
            <EmptyState icon="dumbbell" title="Preparing your session" message="One moment." />
          </div>
        </div>
      </div>
    );
  }

  const workingSets = active.sets.filter((s) => s.kind !== 'warmup');
  const completed = workingSets.filter((s) => s.completed);
  const volume = active.sets
    .filter((s) => s.completed && s.kind !== 'warmup')
    .reduce((sum, s) => sum + s.reps * s.weightKg, 0);
  const progressPct = workingSets.length ? (completed.length / workingSets.length) * 100 : 0;

  const currentIndex = groups.findIndex((g) => g.exerciseId === currentId);
  const workingGroups = groups.filter((g) => !g.sets.every((x) => x.kind === 'warmup'));
  const currentWorkingNo = displayNumbers.get(currentId ?? '') ?? 0;
  const upNext = groups
    .slice(currentIndex + 1)
    .find((g) => g.sets.some((s) => !s.completed)) ?? null;

  /** Moves on after the last set of an exercise, so the member never hunts. */
  const advance = (fromExerciseId: string) => {
    const idx = groups.findIndex((g) => g.exerciseId === fromExerciseId);
    const next = groups.slice(idx + 1).find((g) => g.sets.some((s) => !s.completed))
      ?? groups.find((g) => g.exerciseId !== fromExerciseId && g.sets.some((s) => !s.completed));
    goTo(next ? next.exerciseId : fromExerciseId);
  };

  const finish = async () => {
    if (!completed.length) {
      const ok = await confirm({
        title: 'Nothing logged yet',
        message: 'You have not completed any sets. Discard this session?',
        confirmLabel: 'Discard',
        tone: 'danger',
      });
      if (ok) { await api.sessions.discard(session, active.id); nav('/member', { replace: true }); }
      return;
    }
    setFinishing(true);
    try {
      const summary = await api.sessions.finish(session, active.id, {});
      const prs = summary.records;
      const delta = summary.previousVolume != null
        ? Math.round(summary.volume - summary.previousVolume) : null;

      // Streak is read AFTER the write, so it includes this session.
      // The TRAINING streak is the program-aware one — a scheduled rest
      // day keeps it alive (§D.4), which is the only version worth
      // showing someone who trains five days a week.
      let streak = 0;
      try { streak = api.streaks.forMember(session, memberId).training.current; } catch { streak = 0; }

      const lines: string[] = [];
      if (prs.length) {
        lines.push(prs.slice(0, 2).map((p) =>
          `${api.exercises.name(p.exerciseId)} — ${p.value.toFixed(1)} kg`
          + (p.previous > 0 ? ` (up ${(p.value - p.previous).toFixed(1)} kg)` : ''),
        ).join(' · '));
      } else if (delta != null && delta !== 0) {
        lines.push(`${Math.abs(delta).toLocaleString('en-IN')} kg ${delta > 0 ? 'more' : 'less'} volume than last time.`);
      } else {
        lines.push('Logged and added to your history.');
      }

      celebrate({
        icon: prs.length ? 'trophy' : 'checkCircle',
        title: prs.length ? 'New personal record' : 'Workout complete',
        message: lines.join(' '),
        stats: [
          { value: String(summary.exercises), label: 'Exercises' },
          { value: String(summary.workingSets), label: 'Sets' },
          { value: formatClock(summary.session.durationSec), label: 'Duration' },
          // Volume is only honest when something was actually loaded —
          // a bodyweight session reporting "0 kg" reads as a failure.
          ...(summary.volume > 0
            ? [{ value: `${Math.round(summary.volume).toLocaleString('en-IN')} kg`, label: 'Volume' }]
            : []),
          ...(streak > 1 ? [{ value: `${streak} days`, label: 'Streak' }] : []),
        ],
        actionLabel: 'Done',
        onAction: () => nav('/member', { replace: true }),
      });
    } catch (e) {
      toast('error', 'Could not finish the session', errorMessage(e));
    } finally {
      setFinishing(false);
    }
  };

  const discard = async () => {
    const ok = await confirm({
      title: 'Discard this workout?',
      message: 'Everything logged in this session will be removed. This cannot be undone.',
      confirmLabel: 'Discard workout',
      tone: 'danger',
    });
    if (!ok) return;
    await api.sessions.discard(session, active.id);
    toast('info', 'Workout discarded');
    nav('/member', { replace: true });
  };

  return (
    <div className="player">
      <div className="player__bar">
        <Button variant="ghost" size="sm" icon="chevronDown" onClick={() => nav('/member')}
          aria-label="Minimise session" />
        <div className="u-grow" style={{ minWidth: 0 }}>
          <div className="t-sm u-truncate" style={{ fontWeight: 620 }}>{active.title}</div>
          {/* Two different progress questions, and the member asks the
              first one far more often: "how far through the WORKOUT am
              I", then "how far through this exercise". */}
          <div className="t-xs t-faint">
            {workingGroups.length > 0 && currentWorkingNo > 0
              ? `Exercise ${currentWorkingNo} of ${workingGroups.length} · `
              : ''}
            {completed.length}/{workingSets.length} sets
            {volume > 0 && ` · ${Math.round(volume).toLocaleString('en-IN')} kg`}
          </div>
        </div>
        {/*
          The escape hatch, where somebody actually wants it.
          The preference already existed on the Profile screen, which
          is the wrong place to discover it: a member works out that
          the demonstrations are slowing them down while they are
          standing in front of a barbell, not while editing a profile.
          Same stored field (§13) — turning it off here turns it off
          for good, and we never ask again.
        */}
        <button
          className="player__howtoggle"
          aria-pressed={showHowTo}
          onClick={toggleHowTo}
          title={showHowTo ? 'Hide demonstrations' : 'Show demonstrations'}
          aria-label={showHowTo ? 'Hide demonstrations' : 'Show demonstrations'}
        >
          <Icon name={showHowTo ? 'eye' : 'eyeOff'} size={17} />
        </button>
        <span className="player__clock" aria-label="Elapsed time">{formatClock(elapsed)}</span>
      </div>

      <div className="playerprog" role="progressbar" aria-valuenow={Math.round(progressPct)}
        aria-valuemin={0} aria-valuemax={100} aria-label="Workout progress">
        <div className="playerprog__fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="player__body" ref={scrollerRef}>
        <div className="player__inner">
          {groups.length === 0 ? (
            <EmptyState
              icon="dumbbell" title="Nothing planned for today"
              message="Add the exercises you are training and log them as you go."
              action={<Button variant="primary" icon="plus" onClick={() => setPicker(true)}>Add exercise</Button>}
            />
          ) : (
            <>
              <JumpBar groups={groups} currentId={openCardId} numbers={displayNumbers} onJump={goTo} />

              <div className="exacc">
                {groups.map((group, i) => (
                  <ExerciseCard
                    key={group.exerciseId}
                    index={displayNumbers.get(group.exerciseId) ?? i + 1}
                    sessionId={active.id}
                    exerciseId={group.exerciseId}
                    sets={group.sets}
                    memberId={memberId}
                    open={group.exerciseId === openCardId}
                    showHowTo={showHowTo}
                    howToPaused={editing}
                    registerEl={(el) => {
                      if (el) cardEls.current.set(group.exerciseId, el);
                      else cardEls.current.delete(group.exerciseId);
                    }}
                    onToggle={(top) => toggleCard(group.exerciseId, top)}
                    onEditing={setEditing}
                    onSetCompleted={(restSec) => setRest({ total: restSec, left: restSec })}
                    onExerciseDone={() => advance(group.exerciseId)}
                  />
                ))}
              </div>

              {upNext && (
                <button className="upnext" onClick={() => goTo(upNext.exerciseId)}>
                  <ExerciseThumb exerciseId={upNext.exerciseId} name={api.exercises.name(upNext.exerciseId)} />
                  <span className="u-grow" style={{ minWidth: 0 }}>
                    <span className="upnext__label">Up next</span>
                    <span className="upnext__name u-truncate" style={{ display: 'block' }}>
                      {api.exercises.name(upNext.exerciseId)}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={16} className="t-faint" />
                </button>
              )}

              <Button block icon="plus" onClick={() => setPicker(true)} className="u-mt-3">
                Add exercise
              </Button>
            </>
          )}

          {rest && (
            <div className="resttimer" role="status" aria-live="polite">
              <span className="resttimer__time">{formatClock(rest.left)}</span>
              <span className="resttimer__bar">
                <span className="resttimer__fill" style={{ width: `${(rest.left / rest.total) * 100}%` }} />
              </span>
              <button onClick={() => setRest((r) => (r ? { ...r, left: r.left + 30 } : null))}>+30s</button>
              <button onClick={() => setRest(null)}>Skip</button>
            </div>
          )}
        </div>
      </div>

      <div className="player__foot">
        <div className="player__foot-inner">
          <Button onClick={discard} style={{ flex: '0 0 auto' }} aria-label="Discard workout" icon="trash" />
          <Button variant="primary" size="lg" className="u-grow" loading={finishing} onClick={finish}>
            Finish workout
          </Button>
        </div>
      </div>

      {picker && (
        <ExercisePicker
          sessionId={active.id}
          memberId={memberId}
          onClose={() => setPicker(false)}
          onAdded={(id) => goTo(id)}
        />
      )}
    </div>
  );
}

/* ============================================================
   Jump bar — every exercise, one tap away (§14)
   ============================================================ */
function JumpBar({
  groups, currentId, numbers, onJump,
}: {
  groups: Group[]; currentId: string | null;
  numbers: Map<string, number>;
  onJump: (id: string) => void;
}) {
  if (groups.length < 2) return null;
  return (
    <div className="jumpbar" role="tablist" aria-label="Jump to exercise">
      {groups.map((g) => {
        const done = g.sets.every((s) => s.completed);
        const warmup = g.sets.every((s) => s.kind === 'warmup');
        const name = api.exercises.name(g.exerciseId);
        return (
          <button
            key={g.exerciseId}
            role="tab"
            aria-selected={g.exerciseId === currentId}
            aria-label={`${name}${done ? ', complete' : ''}`}
            title={name}
            className={`jumpbar__pip ${done ? 'is-done' : ''} ${g.exerciseId === currentId ? 'is-open' : ''} ${warmup ? 'jumpbar__pip--warmup' : ''}`}
            onClick={() => onJump(g.exerciseId)}
          >
            {done ? <Icon name="check" size={13} strokeWidth={2.8} /> : warmup ? 'W' : numbers.get(g.exerciseId)}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   One exercise: header always, detail only when open
   ============================================================ */
function ExerciseCard({
  index, sessionId, exerciseId, sets, memberId, open, showHowTo, howToPaused,
  registerEl, onToggle, onEditing, onSetCompleted, onExerciseDone,
}: {
  index: number;
  sessionId: string; exerciseId: string; sets: SessionSet[]; memberId: string;
  open: boolean; showHowTo: boolean; howToPaused: boolean;
  /** Lets the player measure this card when the accordion changes. */
  registerEl: (el: HTMLElement | null) => void;
  /** Carries the header's viewport y, read before React re-renders. */
  onToggle: (headerTop: number) => void;
  onEditing: (v: boolean) => void;
  onSetCompleted: (restSec: number) => void;
  onExerciseDone: () => void;
}) {
  const { session, toast } = useApp();
  const [sheet, setSheet] = useState(false);
  const exercise = useData(() => (session ? safeExercise(session, exerciseId) : null), [exerciseId]);

  // Only the OPEN card pays for the previous-session lookup and the
  // How-To resolution. Collapsed cards cost a name and a tally.
  const previous = useData(
    () => (session && open ? api.sessions.previousPerformance(session, memberId, exerciseId, sessionId) : null),
    [exerciseId, memberId, open],
  );
  // Resolved whenever the card is open, not only when the inline
  // animation is on: the "How to" sheet needs the same drawing, and
  // a member who has hidden the demonstration has not said they never
  // want to see it again.
  const howTo = useData(
    () => (session && open ? api.exercises.howTo(session, exerciseId) : null),
    [exerciseId, open],
  );
  const prescribed = useData(
    () => (session && open ? api.sessions.prescription(session, sessionId, exerciseId) : null),
    [exerciseId, sessionId, open],
  );

  if (!session || !exercise) return null;

  const isWarmup = exercise.kind === 'warmup';
  const working = sets.filter((s) => s.kind !== 'warmup');
  const doneCount = sets.filter((s) => s.completed).length;
  const allDone = sets.length > 0 && doneCount === sets.length;
  const tracksWeight = exercise.tracks.includes('weight');
  const tracksReps = exercise.tracks.includes('reps');
  const tracksDuration = exercise.tracks.includes('duration') && !tracksReps;

  const target = working[0];
  const repRange = prescribed && prescribed.repsMax > prescribed.reps
    ? `${prescribed.reps}–${prescribed.repsMax}`
    : target ? String(target.reps) : '';
  const prescription = target
    ? `${working.length} × ${repRange}${target.weightKg ? ` · ${target.weightKg} kg` : ''}`
    : null;

  // The prescribed RANGE comes from the plan, not from the logged sets —
  // see api.sessions.prescription. Without it there is nothing to top
  // out of, and the hint correctly stays silent.
  const hint = prescribed ? api.sessions.progression(prescribed, previous) : null;

  const complete = async (set: SessionSet) => {
    // `db.commit()` mutates rows IN PLACE, so `set` is a live reference
    // into the store — by the time this await resolves, `set.completed`
    // has already flipped. Reading it after the write to decide what to
    // do next silently does nothing, which is exactly how the rest
    // timer never fired. Capture the intent first.
    const willComplete = !set.completed;
    try {
      await api.sessions.updateSet(session, sessionId, set.id, { completed: willComplete });
    } catch (e) {
      toast('error', 'Could not save that set', errorMessage(e));
      return;
    }
    if (!willComplete) return;
    if (set.kind !== 'warmup') onSetCompleted(DEFAULT_REST_SEC);
    // Last set of this exercise → move the member on themselves. Read
    // AFTER the write, which is correct here: the store is mutated in
    // place, so this already reflects the set just ticked.
    if (sets.every((s) => s.completed)) onExerciseDone();
  };

  const change = async (set: SessionSet, field: 'reps' | 'weightKg' | 'durationSec', value: number) => {
    await api.sessions.updateSet(session, sessionId, set.id, { [field]: Math.max(0, value) });
  };

  const addSet = async () => {
    const template = sets.filter((x) => x.kind !== 'warmup').at(-1);
    try {
      await api.sessions.addSet(session, sessionId, {
        exerciseId,
        reps: template?.reps ?? previous?.bestReps ?? 10,
        weightKg: template?.weightKg ?? previous?.bestWeightKg ?? 0,
        kind: 'normal',
      });
    } catch (e) {
      toast('error', 'Could not add the set', errorMessage(e));
    }
  };

  const removeSet = async (setId: string) => {
    try { await api.sessions.removeSet(session, sessionId, setId); }
    catch (e) { toast('error', 'Could not remove the set', errorMessage(e)); }
  };

  /** Ticks every remaining set at its current numbers and moves on. */
  const finishExercise = async () => {
    // Snapshot the ids BEFORE writing: `sets` holds live store objects,
    // so filtering lazily mid-loop would shrink under its own feet.
    const pending = sets.filter((s) => !s.completed).map((s) => s.id);
    try {
      for (const id of pending) {
        await api.sessions.updateSet(session, sessionId, id, { completed: true });
      }
    } catch (e) {
      toast('error', 'Could not save those sets', errorMessage(e));
      return;
    }
    onExerciseDone();
  };

  return (
    <section ref={registerEl}
      className={`exacc__item ${open ? 'is-open' : ''} ${allDone ? 'is-done' : ''}`}>
      <button
        className="exacc__btn"
        aria-expanded={open}
        onClick={(e) => onToggle(e.currentTarget.getBoundingClientRect().top)}
      >
        <span className={`exacc__idx ${isWarmup ? 'exacc__idx--warmup' : ''}`}>
          {allDone ? <Icon name="check" size={14} strokeWidth={2.8} /> : isWarmup ? 'W' : index}
        </span>
        <span className="exacc__text">
          <span className="exacc__name">{exercise.name}</span>
          <span className="exacc__sub">
            {api.exercises.label.muscleGroup(exercise.muscleGroup)}
            {' · '}{api.exercises.label.equipment(exercise.equipment)}
            {prescription && !open ? ` · ${prescription}` : ''}
          </span>
        </span>
        <span className="exacc__right">
          <span className="exacc__tally">{doneCount}/{sets.length}</span>
          <Icon name="chevronDown" size={16} className="exacc__chev" />
        </span>
      </button>

      {open && (
        <div className="exacc__body">
          {/*
            The instructional block, in the order the questions arrive:
            what the movement looks like, what it works, then the one
            cue worth reading mid-set. The demonstration and the muscle
            chart sit side by side because they are answering two halves
            of the same question and splitting them vertically pushes
            the numbers off a 360px screen.
          */}
          {showHowTo && (howTo || !isWarmup) && (
            <div className="exteach">
              {howTo && (
                <div className="exteach__vis">
                  <HowTo key={howTo.drawing.key} drawing={howTo.drawing}
                    prop={howTo.prop} scene={howTo.scene} size="player"
                    paused={howToPaused} />
                </div>
              )}
              {!isWarmup && (
                <div className="exteach__map">
                  <MuscleMap
                    size="sm" variant="compact" views="key"
                    primaryMuscles={exercise.primaryMuscles}
                    secondaryMuscles={exercise.secondaryMuscles}
                    muscleGroup={exercise.muscleGroup}
                    labelFor={api.exercises.label.muscle}
                  />
                </div>
              )}
            </div>
          )}

          {/* ONE cue. The full setup, steps and mistakes are a tap away
              and stay there — a wall of instruction between a member and
              the weight they are about to lift is not teaching. */}
          {(exercise.focus || exercise.summary) && (
            <button className="exacc__focus" onClick={() => setSheet(true)}>
              <Icon name="target" size={15} />
              <span className="u-grow">{exercise.focus || exercise.summary}</span>
              <span className="exacc__focusmore">How to</span>
            </button>
          )}

          {/* Last time and today's target, side by side. They are read
              together — "what did I do, what am I aiming at" is one
              question — and two stacked rows made it two (§17). */}
          {!isWarmup && (
            <div className="exfacts">
              <div className="exfacts__col">
                <span className="exfacts__label">Last time</span>
                {previous ? (
                  <span className="exfacts__sets">
                    {previous.sets.slice(0, 4).map((s, i) => (
                      <span key={i} className="exfacts__set">
                        {s.weightKg > 0 ? `${s.weightKg} × ${s.reps}` : `${s.reps} reps`}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="exfacts__none">First time — set your baseline.</span>
                )}
              </div>
              {prescription && (
                <div className="exfacts__col exfacts__col--target">
                  <span className="exfacts__label">Today</span>
                  <span className="exfacts__target">{prescription}</span>
                </div>
              )}
            </div>
          )}

          {hint && (
            <div className="progtip" role="note">
              <Icon name="trendingUp" size={14} />
              <span>{hint.message}</span>
            </div>
          )}

          {isWarmup ? (
            /* A warm-up is a tick. Asking someone to type "5" into a
               minutes box before they are allowed to start training is
               friction with nothing on the other side of it. */
            <div className="warmrow">
              {sets.map((set) => (
                <button
                  key={set.id}
                  className={`warmrow__btn ${set.completed ? 'is-done' : ''}`}
                  aria-pressed={set.completed}
                  onClick={() => complete(set)}
                >
                  <Icon name="check" size={17} strokeWidth={2.6} />
                  <span>{set.completed ? 'Done' : 'Mark done'}</span>
                </button>
              ))}
            </div>
          ) : (
          <div className="setgrid setgrid--stepper u-mt-3">
            <span className="setgrid__head">Set</span>
            <span className="setgrid__head">{tracksWeight ? 'kg' : tracksDuration ? 'Minutes' : 'Reps'}</span>
            <span className="setgrid__head">{tracksWeight || tracksDuration ? (tracksDuration ? '' : 'Reps') : ''}</span>
            <span className="setgrid__head" />

            {sets.map((set) => (
              <div key={set.id} className={`setrow-contents ${set.completed ? 'setrow--done' : ''}`}>
                <button
                  className={`setrow-num ${set.kind === 'warmup' ? 'setrow-num--warmup' : ''} ${set.completed ? 'setrow-num--done' : ''}`}
                  onClick={() => removeSet(set.id)}
                  title="Remove this set"
                  aria-label={`Remove set ${set.setNo}`}
                >
                  {set.kind === 'warmup' ? 'W' : set.setNo}
                </button>

                {tracksDuration ? (
                  <>
                    <NumberField
                      value={Math.round(set.durationSec / 60)}
                      step={1}
                      min={0}
                      ariaLabel={`Set ${set.setNo} minutes`}
                      onEditing={onEditing}
                      onChange={(v) => change(set, 'durationSec', v * 60)}
                    />
                    <span />
                  </>
                ) : tracksWeight ? (
                  <>
                    <NumberField
                      value={set.weightKg}
                      step={WEIGHT_STEP}
                      min={0}
                      decimals
                      placeholder={previous?.bestWeightKg}
                      ariaLabel={`Set ${set.setNo} weight in kilograms`}
                      onEditing={onEditing}
                      onChange={(v) => change(set, 'weightKg', v)}
                    />
                    <NumberField
                      value={set.reps}
                      step={1}
                      min={0}
                      stepper={false}
                      placeholder={previous?.bestReps}
                      ariaLabel={`Set ${set.setNo} reps`}
                      onEditing={onEditing}
                      onChange={(v) => change(set, 'reps', v)}
                    />
                  </>
                ) : (
                  <>
                    <NumberField
                      value={set.reps}
                      step={1}
                      min={0}
                      placeholder={previous?.bestReps}
                      ariaLabel={`Set ${set.setNo} reps`}
                      onEditing={onEditing}
                      onChange={(v) => change(set, 'reps', v)}
                    />
                    <span />
                  </>
                )}

                <button
                  className="setcheck" aria-pressed={set.completed}
                  onClick={() => complete(set)}
                  aria-label={set.completed ? `Mark set ${set.setNo} incomplete` : `Complete set ${set.setNo}`}
                >
                  <Icon name="check" size={18} strokeWidth={2.6} />
                </button>
              </div>
            ))}
          </div>
          )}

          {!isWarmup && (
            <div className="exacc__foot">
              <Button size="sm" icon="plus" onClick={addSet}>Add set</Button>
              {!allDone && (
                <Button size="sm" variant="primary" icon="check" onClick={finishExercise}>
                  Exercise done
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {sheet && (
        <Modal title={exercise.name}
          subtitle={`${api.exercises.label.muscleGroup(exercise.muscleGroup)} · ${api.exercises.label.equipment(exercise.equipment)}`}
          onClose={() => setSheet(false)}
          footer={<Button variant="primary" block onClick={() => setSheet(false)}>Back to my sets</Button>}>
          <ExerciseTeaching exercise={exercise} howTo={howTo} labels={api.exercises.label} />
        </Modal>
      )}
    </section>
  );
}

/* ============================================================
   Fast numeric entry (§16)

   A stepper either side of a real input. The stepper is the
   primary path — one tap, no keyboard, no layout shift — and the
   input is there for the jump from 60 to 85 that stepping would
   make absurd.

   The value is held locally while focused so typing "12" does not
   round-trip through the store on "1"; it commits on change and on
   blur. `onEditing` tells the player to hold the How-To timer
   still, because a figure moving under your thumb while you aim at
   a 46px target is genuinely annoying.
   ============================================================ */
function NumberField({
  value, step, min = 0, decimals, placeholder, ariaLabel, stepper = true, onChange, onEditing,
}: {
  value: number; step: number; min?: number; decimals?: boolean;
  placeholder?: number; ariaLabel: string;
  /** false renders the bare input — see the grid note in premium.css. */
  stepper?: boolean;
  onChange: (v: number) => void;
  onEditing: (v: boolean) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value ? String(value) : '');

  const commit = (raw: string) => {
    const parsed = Number(raw.replace(/[^\d.]/g, ''));
    onChange(Number.isFinite(parsed) ? parsed : 0);
  };

  const bump = (delta: number) => {
    const next = Math.max(min, Math.round((value + delta) * 100) / 100);
    setDraft(null);
    onChange(next);
  };

  const input = (
    <input
      className="setinput"
      inputMode={decimals ? 'decimal' : 'numeric'}
      value={shown}
      placeholder={placeholder != null && placeholder > 0 ? String(placeholder) : '0'}
      aria-label={ariaLabel}
      onFocus={() => onEditing(true)}
      onChange={(e) => { setDraft(e.target.value); commit(e.target.value); }}
      onBlur={() => { setDraft(null); onEditing(false); }}
    />
  );

  if (!stepper) return input;

  // `.stepper` is the shared control from components.css, resized for a
  // set row in premium.css rather than reimplemented here.
  return (
    <div className="stepper">
      <button onClick={() => bump(-step)} aria-label={`Decrease ${ariaLabel}`} type="button">
        <Icon name="minus" size={16} />
      </button>
      {input}
      <button onClick={() => bump(step)} aria-label={`Increase ${ariaLabel}`} type="button">
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

/* ============================================================
   Exercise picker
   ============================================================ */
function ExercisePicker({
  sessionId, memberId, onClose, onAdded,
}: { sessionId: string; memberId: string; onClose: () => void; onAdded: (id: string) => void }) {
  const { session, toast } = useApp();
  const [q, setQ] = useState('');
  const rows = useData(() => (session ? api.exercises.list(session, { q }) : []), [q]);

  const add = async (exerciseId: string) => {
    if (!session) return;
    const last = api.sessions.lastPerformance(session, memberId, exerciseId);
    try {
      await api.sessions.addExercise(session, sessionId, exerciseId, {
        sets: 3, reps: last?.reps ?? 10, weightKg: last?.weightKg ?? 0,
      });
      toast('success', 'Added to this workout', api.exercises.name(exerciseId));
      onAdded(exerciseId);
      onClose();
    } catch (e) {
      toast('error', 'Could not add the exercise', errorMessage(e));
    }
  };

  return (
    <Modal title="Add exercise" onClose={onClose}
      footer={<Button block onClick={onClose}>Close</Button>}>
      <div className="u-col u-gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, muscle or equipment" />
        <ul className="cardlist" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', maxHeight: '46dvh', overflowY: 'auto' }}>
          {rows.slice(0, 40).map((e) => (
            <li key={e.id}>
              <button className="cardlist__item" onClick={() => add(e.id)}>
                <ExerciseThumb exerciseId={e.id} name={e.name} size="sm" />
                <span className="u-grow" style={{ minWidth: 0 }}>
                  <span className="t-sm" style={{ fontWeight: 560 }}>{e.name}</span>
                  <span className="t-xs t-faint" style={{ display: 'block' }}>
                    {api.exercises.label.muscleGroup(e.muscleGroup)} · {api.exercises.label.equipment(e.equipment)}
                  </span>
                </span>
                {e.scope === 'member' && <span className="tag tag--custom">Custom</span>}
                <Icon name="plus" size={16} className="t-faint" />
              </button>
            </li>
          ))}
          {rows.length === 0 && (
            <li style={{ padding: 'var(--s-4)' }} className="t-sm t-faint">
              No exercise matches “{q}”. You can create it in the exercise library.
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}

/* ---------------- helpers ---------------- */

interface Group { exerciseId: string; sets: SessionSet[] }

function groupByExercise(session: WorkoutSession): Group[] {
  const map = new Map<string, SessionSet[]>();
  for (const set of [...session.sets].sort((a, b) => a.order - b.order || a.setNo - b.setNo)) {
    map.set(set.exerciseId, [...(map.get(set.exerciseId) ?? []), set]);
  }
  return [...map.entries()].map(([exerciseId, sets]) => ({ exerciseId, sets }));
}

function safeExercise(session: Parameters<typeof api.exercises.get>[0], id: string): Exercise | null {
  try { return api.exercises.get(session, id); } catch { return null; }
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

export { formatClock };
