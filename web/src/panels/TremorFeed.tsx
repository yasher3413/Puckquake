import { Link } from "react-router";
import type { Tremor } from "../api/types.gen";
import { arrow, clock, direction, magnitude, pct, periodLabel, pp } from "../lib/format";
import { useLive } from "../live/store";
import { useMyTeam } from "../lib/myTeam";

/** One goal in a list. With `focus`, the list is about that team: its change
 * is the headline number and the goal's magnitude moves to the details. */
export function TremorLine({
  t,
  myTeam,
  focus,
}: {
  t: Tremor;
  myTeam: string | null;
  focus?: string;
}) {
  // A late goal in a decided game can move nobody; list only real changes.
  const movers = t.deltas.filter((d) => direction(d.d_playoffs) !== "flat").slice(0, 3);
  const mine = myTeam ? t.deltas.find((d) => d.team === myTeam) : undefined;
  const focused = focus ? t.deltas.find((d) => d.team === focus) : undefined;
  if (focused) {
    const v = focused.d_playoffs * 100;
    const dir = direction(focused.d_playoffs);
    return (
      <Link to={`/tremor/${t.id}`} className="grid grid-cols-[4.2rem_1fr] gap-3 py-2">
        <div
          className={`display text-right text-[30px] font-extrabold leading-none ${dir === "flat" ? "text-ink-soft" : dir} ${t.overturned ? "line-through decoration-2" : ""}`}
          aria-label={`${focus} ${pp(focused.d_playoffs)}`}
        >
          {dir === "up" ? "+" : dir === "down" ? "−" : ""}
          {dir === "flat" ? "0.0" : Math.abs(v).toFixed(1)}
        </div>
        <div className="min-w-0 text-[13px]">
          <div className="truncate font-semibold">
            {t.overturned ? "No goal: " : ""}
            {t.scorer?.name ?? "Goal"} <span className="font-normal text-ink-soft">({t.team})</span>
          </div>
          <div className="text-[12px] text-ink-soft">
            {t.away} {t.score_after.away}, {t.home} {t.score_after.home},{" "}
            {periodLabel(t.period, t.period_type)} {clock(t.t_period_s)}. Magnitude{" "}
            {magnitude(t.magnitude)}.
          </div>
        </div>
      </Link>
    );
  }
  return (
    <Link to={`/tremor/${t.id}`} className="grid grid-cols-[3.2rem_1fr] gap-3 py-2">
      {/* Weight follows size, so a 0.3 never shouts like a 4.7. An overturned
          goal keeps full contrast; its number is struck out instead. */}
      <div
        className={`display text-right text-[30px] leading-none ${
          t.overturned
            ? "font-bold text-ink-soft line-through decoration-2"
            : t.magnitude < 1
              ? "font-semibold text-ink-soft"
              : "font-extrabold"
        }`}
      >
        {magnitude(t.magnitude)}
      </div>
      <div className="min-w-0 text-[13px]">
        <div className="truncate font-semibold">
          {t.overturned ? "No goal: " : ""}
          {t.scorer?.name ?? "Goal"} <span className="font-normal text-ink-soft">({t.team})</span>
        </div>
        <div className="text-[12px] text-ink-soft">
          {t.away} {t.score_after.away}, {t.home} {t.score_after.home},{" "}
          {periodLabel(t.period, t.period_type)} {clock(t.t_period_s)}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] tabular-nums">
          {movers.map((d) => (
            <span
              key={d.team}
              className={
                direction(d.d_playoffs) === "flat"
                  ? "text-ink-soft"
                  : d.d_playoffs > 0
                    ? "up"
                    : "down"
              }
            >
              {d.team} {arrow(d.d_playoffs)} {pp(d.d_playoffs)}
            </span>
          ))}
          {movers.length === 0 && (
            <span className="text-ink-soft">No team's odds moved by 0.1 pp</span>
          )}
        </div>
        {/* A goal between two near-locks barely touches the race but can
            still swing the game; say so, or a row of small numbers reads as
            broken. */}
        {t.magnitude < 1 && !t.overturned && !t.shootout && (
          <div className="text-[12px] text-ink-soft">
            {t.team} win chance {pct(winChance(t, "before"), 0)} to {pct(winChance(t, "after"), 0)}
          </div>
        )}
        {mine &&
          myTeam &&
          !movers.some((d) => d.team === myTeam) &&
          Math.abs(mine.d_playoffs) >= 0.0005 && (
            <div className={`text-[12px] ${mine.d_playoffs > 0 ? "up" : "down"}`}>
              {mine.d_playoffs > 0 ? "Helped" : "Cost"} {myTeam} {pp(Math.abs(mine.d_playoffs))}
            </div>
          )}
      </div>
    </Link>
  );
}

/** The scoring team's chance to win the game, before or after the goal. */
function winChance(t: Tremor, when: "before" | "after"): number {
  const w = when === "before" ? t.wp_before : t.wp_after;
  const home = w.home_reg + w.home_ot + w.home_so;
  return t.team === t.home ? home : 1 - home;
}

export function TremorFeed({ limit = 12 }: { limit?: number }) {
  const tremors = useLive((s) => s.tremors);
  const myTeam = useMyTeam((s) => s.team);
  const replaying = useLive((s) => s.mode === "demo");
  return (
    <section aria-labelledby="feed-h" className="px-4 py-3">
      <h2 id="feed-h" className="display text-[24px] font-bold">
        Tremors
      </h2>
      {tremors.length === 0 && (
        <p className="mt-2 text-[13px] text-ink-soft">
          {replaying
            ? "No goals yet in this replay. Each one shows up here with how far it moved the standings."
            : "No goals yet. Every goal tonight will show up here with how far it moved the standings."}
        </p>
      )}
      <ul className="divide-y divide-ice-scratch">
        {tremors.slice(0, limit).map((t) => (
          <li key={t.id}>
            <TremorLine t={t} myTeam={myTeam} />
          </li>
        ))}
      </ul>
    </section>
  );
}
