import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLive } from "../live/store";
import { monthDay } from "../lib/format";
import { useMedia, useReducedMotion } from "../lib/useMedia";
import { useTour } from "./store";

/**
 * The first-visit walkthrough: a short spotlight tour over the real page.
 * Nothing is blocked; the page stays live and clickable under the dim, and
 * the tour can be skipped from every step or with Esc.
 */

interface Step {
  /** `data-tour` of the element to spotlight; none centers the card. */
  target?: string;
  title: string;
  body: ReactNode;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const GAP = 14;
const CARD_W = 360;

function useSteps(phone: boolean): Step[] {
  const mode = useLive((s) => s.mode);
  const replay = useLive((s) => s.replay);
  const tonight = useLive((s) => s.tonight);
  const replaying = mode === "demo" && !!replay;
  const night = replay ? monthDay(replay.night_date) : "";
  // Phones get four short steps in page order, so the tour only scrolls
  // down the page and then back to the top once.
  if (phone)
    return [
      {
        target: "map",
        title: "Each ring is a team's playoff odds",
        body: (
          <>
            <p className="text-ink-soft">
              {replaying
                ? `No games on yet, so this is ${night} replayed.`
                : `${tonight.length} ${tonight.length === 1 ? "game" : "games"} tonight, live.`}
            </p>
            <div className="mt-2 flex items-start gap-3">
              <RingSample />
              <p>
                The fuller the ring, the better the odds. A goal sends out a shockwave and every
                ring it hits moves: <span className="up font-semibold">blue</span> went up,{" "}
                <span className="down font-semibold">red</span> went down.
              </p>
            </div>
          </>
        ),
      },
      {
        target: "timeline",
        title: "The goal timeline",
        body: (
          <p>
            Each red mark is a goal; tap one to open it.
            {replaying ? " Drag to rewind or change the speed." : ""}
          </p>
        ),
      },
      {
        target: "games",
        title: replaying ? "That night's games" : "Tonight's games",
        body: (
          <p>
            The bar is each team's chance to win the game. The small bars on the right show how much
            it could move the playoff race.
          </p>
        ),
      },
      {
        target: "myteam",
        title: "Make it yours",
        body: (
          <p>
            Pick your team to keep its odds up top and see what every goal did to it. The other
            pages are in the menu.
          </p>
        ),
      },
    ];
  return [
    {
      title: "Every goal moves the playoff race",
      body: (
        <>
          <p>
            {replaying
              ? `No games are on right now, so you're watching ${night} again, goal by goal. When games start, the map goes live by itself.`
              : `${tonight.length} ${tonight.length === 1 ? "game" : "games"} tonight. Every goal lands here moments after it's scored.`}
          </p>
          <p className="mt-2">This short tour shows you how to read it.</p>
        </>
      ),
    },
    {
      target: "map",
      title: "Each ring is a team's playoff odds",
      body: (
        <div className="flex items-start gap-3">
          <RingSample />
          <p>
            The fuller the ring, the better the team's chance of making the playoffs. The tick under
            it is the team's color. Tap any team for its full outlook.
          </p>
        </div>
      ),
    },
    {
      target: "map",
      title: "A goal sends out a shockwave",
      body: (
        <>
          <p>
            It ripples out from the arena, and every ring it passes moves.{" "}
            <span className="up font-semibold">Blue</span> numbers went up,{" "}
            <span className="down font-semibold">red</span> went down, in percentage points: 40% to
            42% is +2.0.
          </p>
          <p className="mt-2">
            M is the goal's magnitude: how hard it shook the whole league.
            {replaying ? " The replay keeps running, so watch for the next one." : ""}
          </p>
        </>
      ),
    },
    {
      target: "timeline",
      title: "The goal timeline",
      body: (
        <p>
          {replaying ? "The whole night on one strip." : "Tonight on one strip."} Each red mark is a
          goal, and the curve shows how hard the odds were moving.{" "}
          {replaying
            ? "Drag to rewind, change the speed, or tap a mark to open that goal."
            : "Tap a mark to open that goal."}
        </p>
      ),
    },
    {
      target: "games",
      title: replaying ? "That night's games" : "Tonight's games",
      body: (
        <p>
          The bar under each game is each team's chance to win it, which is not the same as playoff
          odds. The small bars on the right show how much a game could move the playoff race.
        </p>
      ),
    },
    {
      target: "myteam",
      title: "Make it yours",
      body: (
        <p>
          Pick your team and Puckquake follows it: its odds stay at the top of this page, and every
          goal tells you what it did to them.
        </p>
      ),
    },
    {
      target: "nav",
      title: "There's more to explore",
      body: (
        <dl className="grid grid-cols-[5.75rem_1fr] gap-x-3 gap-y-1.5">
          <dt className="font-semibold">Nights</dt>
          <dd>Replay any night of the last three seasons.</dd>
          <dt className="font-semibold">Leaders</dt>
          <dd>The players who added the most playoff odds.</dd>
          <dt className="font-semibold">What if</dt>
          <dd>Pick results and watch the odds change.</dd>
          <dt className="font-semibold">How it works</dt>
          <dd>The model, in plain language.</dd>
        </dl>
      ),
    },
  ];
}

/** A small ring like the map's, filling from 40% to 62% on arrival. */
function RingSample() {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="44" viewBox="0 0 40 44" aria-hidden className="mt-0.5 shrink-0">
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="var(--surface)"
        stroke="var(--ice-scratch)"
        strokeWidth="3.5"
      />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="3.5"
        strokeDasharray={`${c * 0.62} ${c}`}
        transform="rotate(-90 20 20)"
        className="tour-ring"
        style={{ ["--ring-from" as string]: `${c * 0.4}`, ["--ring-to" as string]: `${c * 0.62}` }}
      />
      <rect x="14" y="38" width="12" height="3" fill="var(--goal)" />
    </svg>
  );
}

/** True when the target is on the page and laid out, on screen or not. A
 * step is skipped only when this is false (a hidden panel), never merely
 * because the target is scrolled out of view. */
function present(target: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width >= 4 && r.height >= 4;
}

function measure(target: string | undefined, floor: number): Box | null {
  if (!target) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  // Only the part actually on screen: a panel inside a scrolling rail is
  // clipped to the rail, and everything to the viewport.
  let { top, left, right, bottom } = el.getBoundingClientRect();
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll" || o === "hidden") {
      const c = p.getBoundingClientRect();
      top = Math.max(top, c.top);
      bottom = Math.min(bottom, c.bottom);
      left = Math.max(left, c.left);
      right = Math.min(right, c.right);
    }
  }
  top = Math.max(top, 0);
  left = Math.max(left, 0);
  bottom = Math.min(bottom, floor);
  right = Math.min(right, window.innerWidth);
  if (right - left < 4 || bottom - top < 4) return null;
  return {
    top: top - PAD,
    left: left - PAD,
    width: right - left + PAD * 2,
    height: bottom - top + PAD * 2,
  };
}

/** Beside the target if there is room (right, left, below, above), else
 * inside its lower right corner. Desktop only; phones dock the card. */
function place(box: Box | null, card: { w: number; h: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.max(16, Math.min(vw - card.w - 16, x));
  const clampY = (y: number) => Math.max(16, Math.min(vh - card.h - 16, y));
  if (!box) return { left: (vw - card.w) / 2, top: Math.max(16, (vh - card.h) / 2) };
  const right = box.left + box.width + GAP;
  const left = box.left - GAP - card.w;
  const below = box.top + box.height + GAP;
  const above = box.top - GAP - card.h;
  if (right + card.w <= vw - 16) return { left: right, top: clampY(box.top) };
  if (left >= 16) return { left, top: clampY(box.top) };
  if (below + card.h <= vh - 16) return { left: clampX(box.left + box.width - card.w), top: below };
  if (above >= 16) return { left: clampX(box.left), top: above };
  return {
    left: clampX(box.left + box.width - card.w - 16),
    top: clampY(box.top + box.height - card.h - 16),
  };
}

export function Tour() {
  const open = useTour((s) => s.open);
  const step = useTour((s) => s.step);
  const go = useTour((s) => s.go);
  const close = useTour((s) => s.close);
  const phone = !useMedia("(min-width: 640px)");
  const steps = useSteps(phone);
  const reduce = useReducedMotion();
  const [box, setBox] = useState<Box | null>(null);
  const [card, setCard] = useState({ w: CARD_W, h: 220 });
  const cardRef = useRef<HTMLDivElement>(null);
  // Which way the visitor is moving, so a missing target is skipped in the
  // same direction (Back over it, not forward again).
  const prevStep = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const current = steps[step];
  // The steps are rebuilt on every render (the live store ticks during a
  // replay); key the scroll on the target so a tick never scrolls the page.
  const target = current?.target;
  const last = step === steps.length - 1;
  const next = () => (last ? close() : go(step + 1));
  const back = () => step > 0 && go(step - 1);

  // Leaving the page ends the tour; it counts as seen.
  useEffect(() => () => void (useTour.getState().open && useTour.getState().close()), []);

  // A phone that turns sideways can leave the step past the end.
  useEffect(() => {
    if (open && step >= steps.length) go(steps.length - 1);
  }, [open, step, steps.length, go]);

  // Bring the target into view, then follow it while the page scrolls or
  // resizes. A step whose target is missing (a hidden panel) is skipped.
  useLayoutEffect(() => {
    if (!open || step >= steps.length) return;
    const dir = step >= prevStep.current ? 1 : -1;
    prevStep.current = step;
    if (target && !present(target)) {
      const to = step + dir;
      if (to >= 0 && to < steps.length) go(to);
      else close();
      return;
    }
    const el = target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null;
    if (el) {
      if (phone) {
        // The card is docked at the bottom; put the target near the top, or
        // the page's top when the target is close to it, so the header and
        // its menu stay in view. A jump, not a long smooth scroll.
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top < window.innerHeight * 0.4 ? 0 : top - 12, behavior: "auto" });
      } else {
        el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      }
    }
    // Measure only when something moved, not every frame: the map animates
    // underneath, and layout reads each frame make the whole page drag.
    let frame = 0;
    const update = () => {
      frame = 0;
      const dock = cardRef.current;
      const floor = phone && dock ? dock.getBoundingClientRect().top - 8 : window.innerHeight;
      const b = measure(target, floor);
      setBox((prev) =>
        prev &&
        b &&
        Math.abs(prev.top - b.top) +
          Math.abs(prev.left - b.left) +
          Math.abs(prev.width - b.width) +
          Math.abs(prev.height - b.height) <
          1
          ? prev
          : b,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    if (el) ro.observe(el);
    if (cardRef.current) ro.observe(cardRef.current);
    titleRef.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, [open, step, target, steps.length, go, close, phone, reduce]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCard({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("input, select, textarea")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") {
        if (step < steps.length - 1) go(step + 1);
        else close();
      } else if (e.key === "ArrowLeft" && step > 0) go(step - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step, steps.length, go, close]);

  if (!open || !current) return null;
  const pos = phone ? null : place(box, card);
  const ms = phone ? 200 : 320;
  const ease = reduce
    ? "none"
    : ["top", "left", "width", "height"].map((p) => `${p} ${ms}ms var(--ease-out)`).join(", ");
  const spot = box ?? {
    top: window.innerHeight / 2,
    left: window.innerWidth / 2,
    width: 0,
    height: 0,
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {/* The dim is the spotlight's shadow; clicks pass through to the page. */}
      <div
        aria-hidden
        className="absolute rounded-[10px]"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          boxShadow: "0 0 0 200vmax rgba(6, 13, 19, 0.56)",
          outline: box ? "2px solid var(--blue-line)" : "none",
          outlineOffset: 0,
          transition: ease,
        }}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        // Phones: swipe the card left for the next step, right to go back.
        onTouchStart={(e) => {
          const t = e.touches[0];
          swipe.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const s = swipe.current;
          const t = e.changedTouches[0];
          swipe.current = null;
          if (!s || !t) return;
          const dx = t.clientX - s.x;
          if (Math.abs(dx) < 48 || Math.abs(t.clientY - s.y) > Math.abs(dx) / 2) return;
          if (dx < 0) next();
          else back();
        }}
        className={`pointer-events-auto absolute flex flex-col rounded-[var(--radius)] border border-ice-scratch bg-surface text-ink shadow-[0_18px_48px_rgba(6,13,19,0.28)] ${
          phone
            ? "inset-x-2 bottom-2 p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-[14px] leading-[1.45]"
            : "p-5 text-[14px] leading-[1.5]"
        }`}
        style={
          pos
            ? {
                top: pos.top,
                left: pos.left,
                width: CARD_W,
                transition: reduce
                  ? "none"
                  : "top 320ms var(--ease-out), left 320ms var(--ease-out)",
              }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="tour-title"
            ref={titleRef}
            tabIndex={-1}
            className={`display font-bold leading-none [text-wrap:balance] focus:outline-none focus-visible:outline-none ${
              phone ? "pt-1 text-[21px]" : "text-[24px]"
            }`}
            style={{ outline: "none" }}
          >
            {current.title}
          </h2>
          {phone ? (
            <button
              type="button"
              onClick={close}
              aria-label="Skip tour"
              className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-[var(--radius)] text-ink-soft hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" />
              </svg>
            </button>
          ) : (
            <span className="shrink-0 text-[12px] text-ink-soft tabular-nums">
              {step + 1} of {steps.length}
            </span>
          )}
        </div>
        <div key={step} className={`tour-step ${phone ? "mt-2" : "mt-3"}`} aria-live="polite">
          {current.body}
        </div>
        <div className={`flex items-center gap-2 ${phone ? "mt-3" : "mt-5"}`}>
          {phone ? (
            <span className="text-[12px] text-ink-soft tabular-nums">
              {step + 1} of {steps.length}
            </span>
          ) : (
            <button
              type="button"
              onClick={close}
              className="min-h-[44px] px-1 text-[13px] font-semibold text-ink-soft hover:text-ink"
            >
              {step === 0 ? "Skip" : "Skip tour"}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="min-h-[44px] rounded-[var(--radius)] border border-ice-scratch px-4 text-[13px] font-semibold hover:bg-ice-land"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="min-h-[44px] rounded-[var(--radius)] bg-ink px-4 text-[13px] font-semibold text-ice"
            >
              {phone
                ? last
                  ? "Done"
                  : "Next"
                : step === 0
                  ? "Show me around"
                  : last
                    ? "Start watching"
                    : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
