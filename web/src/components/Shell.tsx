import { useEffect, useId, useRef, useState } from "react";
import { NavLink, Outlet, Link, ScrollRestoration, useLocation } from "react-router";
import { useLive } from "../live/store";
import { useClock } from "../live/clock";
import { longDate } from "../lib/format";
import { Search } from "./Search";
import { Footer } from "./Footer";

const NAV = [
  { to: "/", label: "Tonight", end: true },
  { to: "/nights", label: "Nights" },
  { to: "/leaders", label: "Leaders" },
  { to: "/standings", label: "Standings" },
  { to: "/what-if", label: "What if" },
  { to: "/roster-lab", label: "Roster Lab" },
  { to: "/method", label: "How it works" },
];

export function Shell() {
  // The home view is an app-like screen that fills the viewport on desktop;
  // the footer sits below it, a scroll away, as on every other page. Every
  // page starts at least a screen tall, so the footer never shows while a
  // page is still loading and then jumps away.
  const path = useLocation().pathname;
  const home = path === "/";
  return (
    <div className="flex flex-col">
      <div className={`flex min-h-dvh flex-col ${home ? "lg:h-dvh" : ""}`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <header className="relative z-40 border-b border-ice-scratch">
          {/* Every page's content sits in the max-w-6xl column (the home map
            runs edge to edge below it), so the header lines up with it. */}
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 md:px-6">
            <Link to="/" className="display text-[30px] font-extrabold tracking-tight text-ink">
              Puckquake
            </Link>
            {/* Home states live or replay in its own title block. */}
            {!home && <ModeChip />}
            <Search />
            <MainNav />
          </div>
        </header>
        <main id="main" className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}

/** Wide screens list every page in the header. Narrower ones get a Menu
 * button that drops the same links down under the header; it closes on a
 * pick, a tap elsewhere, or Escape. One wrapper holds both, so the tour's
 * nav step finds whichever is showing. */
function MainNav() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useId();
  const { pathname } = useLocation();
  // A new page closes the menu; keyed on the path so the setter runs while
  // rendering instead of in an effect.
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={wrap} data-tour="nav" className="flex items-center lg:ml-auto">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
        className="-mr-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius)] text-ink-soft hover:text-ink aria-expanded:text-ink lg:hidden"
      >
        <MenuIcon open={open} />
      </button>
      <nav aria-label="Main" className="hidden text-[14px] lg:flex lg:gap-1">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `inline-flex min-h-[44px] items-center whitespace-nowrap rounded-[var(--radius)] px-2.5 py-1.5 transition-colors ${
                isActive ? "bg-ice-land font-semibold text-ink" : "text-ink-soft hover:text-ink"
              }`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <nav
        id={panel}
        aria-label="Main"
        hidden={!open}
        className="menu-drop absolute inset-x-0 top-full border-b border-ice-scratch bg-ice shadow-[0_10px_24px_-8px_rgba(10,20,30,0.18)] lg:hidden"
      >
        <ul className="mx-auto max-w-6xl px-2 py-2 md:px-4">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-[48px] items-center rounded-[var(--radius)] px-2 text-[17px] ${
                    isActive ? "bg-ice-land font-semibold text-ink" : "text-ink hover:bg-ice-land"
                  }`
                }
              >
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Three bars that fold into an X while the menu is open. */
function MenuIcon({ open }: { open: boolean }) {
  const bar = "origin-center transition-transform duration-200 ease-[var(--ease-out)]";
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden fill="none">
      <path
        d="M3 5.5h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className={bar}
        style={{ transform: open ? "translateY(4.5px) rotate(45deg)" : undefined }}
      />
      <path
        d="M3 10h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="transition-opacity duration-150"
        style={{ opacity: open ? 0 : 1 }}
      />
      <path
        d="M3 14.5h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className={bar}
        style={{ transform: open ? "translateY(-4.5px) rotate(-45deg)" : undefined }}
      />
    </svg>
  );
}

function ModeChip() {
  const mode = useLive((s) => s.mode);
  const replay = useLive((s) => s.replay);
  const liveCount = useLive(
    (s) => Object.values(s.games).filter((g) => g.state === "LIVE" || g.state === "CRIT").length,
  );
  const loaded = useLive((s) => s.loaded);
  const replaying = useClock((s) => s.mode === "replay");
  if (!loaded) return null;
  if (replaying && !(mode === "demo" && replay)) {
    return <span className="hidden text-[13px] text-ink-soft sm:inline">Replay</span>;
  }
  if (mode === "demo" && replay) {
    return (
      <span className="hidden text-[13px] text-ink-soft sm:inline">
        Replay of {longDate(replay.night_date)}
      </span>
    );
  }
  return (
    <span className="hidden items-center gap-2 text-[13px] text-ink-soft sm:inline-flex">
      {liveCount > 0 && <span aria-hidden className="h-2 w-2 rounded-full bg-goal" />}
      {liveCount > 0 ? `${liveCount} ${liveCount === 1 ? "game" : "games"} live` : "No games live"}
    </span>
  );
}
