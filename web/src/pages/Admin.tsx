import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, adminLogin, adminLogout, setBotMode, useAdminStatus } from "../api/client";
import type { BotInfo } from "../api/types.gen";
import { useDocumentMeta } from "../lib/meta";
import { PageLoading } from "../components/PageLoading";
import { Unreachable } from "../components/PageMessage";

function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 90) return `${s} s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 172800) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/** Every recent run as a bar, oldest to newest; taller took longer. */
function SimStrip({ runs }: { runs: Record<string, unknown>[] }) {
  if (runs.length === 0) return <p className="mt-2 text-[14px] text-ink-soft">No runs yet.</p>;
  const ordered = [...runs].reverse();
  const max = Math.max(1, ...ordered.map((r) => Number(r.duration_ms)));
  const counts = ordered.reduce<Record<string, number>>((acc, r) => {
    const k = String(r.trigger);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <figure className="mt-3">
      <div
        role="img"
        aria-label={`Last ${ordered.length} simulations, longest ${Math.round(max)} ms`}
        className="flex h-16 items-end gap-[3px] border-b border-ice-scratch"
      >
        {ordered.map((r) => (
          <span
            key={String(r.id)}
            title={`${String(r.trigger)}, ${Math.round(Number(r.duration_ms))} ms`}
            className="min-w-[3px] flex-1"
            style={{
              height: `${Math.max(6, (Number(r.duration_ms) / max) * 100)}%`,
              background: r.trigger === "goal" ? "var(--ink)" : "var(--ink-soft)",
            }}
          />
        ))}
      </div>
      <figcaption className="mt-1.5 text-[12px] text-ink-soft">
        The last {ordered.length} runs, oldest first, longest {Math.round(max)} ms:{" "}
        {Object.entries(counts)
          .map(([k, n]) => `${n} ${k}`)
          .join(", ")}
        . Goal runs are the darker bars.
      </figcaption>
    </figure>
  );
}

const button =
  "min-h-[44px] rounded-[var(--radius)] px-4 text-[14px] font-semibold disabled:opacity-50";

function SignIn({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminLogin(password);
      setPassword("");
      onDone();
    } catch (err) {
      setError(err instanceof ApiError && err.detail ? err.detail : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="display text-[38px] font-extrabold leading-none">Admin</h1>
      <form onSubmit={(e) => void submit(e)} className="mt-6">
        <label className="block text-[13px] font-semibold">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "admin-error" : undefined}
            className="mt-2 block min-h-[44px] w-full rounded-[var(--radius)] border border-ice-scratch bg-surface px-3 text-[15px] text-ink"
          />
        </label>
        {error && (
          <p id="admin-error" role="alert" className="down mt-2 text-[14px]">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={`${button} mt-4 bg-ink text-ice`}>
          {busy ? "Signing in" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

const BOT_MODES: { mode: BotInfo["mode"]; label: string; hint: string }[] = [
  { mode: "off", label: "Off", hint: "Posts nothing." },
  { mode: "dry_run", label: "Dry run", hint: "Writes each post to the log only." },
  { mode: "live", label: "Live", hint: "Posts every regular-season goal to X." },
];

function GoalBot({ bot, onChange }: { bot: BotInfo; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (mode: BotInfo["mode"]) => {
    if (mode === "live" && !window.confirm("Start posting every goal to X?")) return;
    setBusy(true);
    setError(null);
    try {
      await setBotMode(mode);
      onChange();
    } catch (err) {
      setError(err instanceof ApiError && err.detail ? err.detail : "Could not switch the bot.");
    } finally {
      setBusy(false);
    }
  };
  const dollars = (m: number) => `$${(m / 1000).toFixed(2)}`;
  return (
    <section className="mt-10">
      <h2 className="display text-[26px] font-bold">Goal bot on X</h2>
      <p className="mt-1 text-[14px] text-ink-soft">
        Spent {dollars(bot.spent_millicents)} of {dollars(bot.cap_millicents)} this month.
        {!bot.keys_present && " The X keys are not set, so live stays off."}
      </p>
      <div role="radiogroup" aria-label="Goal bot mode" className="mt-3 flex flex-wrap gap-2">
        {BOT_MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            role="radio"
            aria-checked={bot.mode === m.mode}
            disabled={busy || (m.mode === "live" && !bot.keys_present)}
            onClick={() => void pick(m.mode)}
            title={m.hint}
            className={`${button} border ${
              bot.mode === m.mode
                ? "border-ink bg-ink text-ice"
                : "border-ice-scratch bg-surface text-ink hover:border-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-ink-soft">
        {BOT_MODES.find((m) => m.mode === bot.mode)?.hint}
      </p>
      {error && (
        <p role="alert" className="down mt-2 text-[14px]">
          {error}
        </p>
      )}
    </section>
  );
}

export default function AdminPage() {
  const { data, error, isLoading, refetch } = useAdminStatus();
  const queryClient = useQueryClient();
  useDocumentMeta("Admin");
  const reload = () => void queryClient.invalidateQueries({ queryKey: ["admin-status"] });
  if (isLoading) return <PageLoading label="Loading" />;
  if (error instanceof ApiError && error.status === 401) return <SignIn onDone={reload} />;
  if (error instanceof ApiError && error.status === 503)
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="display text-[38px] font-extrabold leading-none">Admin</h1>
        <p className="mt-3 text-ink-soft">
          Set ADMIN_PASSWORD in the server's .env and recreate the api to turn this page on.
        </p>
      </div>
    );
  if (!data) return <Unreachable onRetry={() => void refetch()} />;
  const h = data.health;
  const signOut = async () => {
    await adminLogout();
    queryClient.removeQueries({ queryKey: ["admin-status"] });
    reload();
  };
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="display text-[38px] font-extrabold leading-none sm:text-[60px]">
          Pipeline status
        </h1>
        <button
          type="button"
          onClick={() => void signOut()}
          className={`${button} border border-ice-scratch bg-surface hover:border-ink`}
        >
          Sign out
        </button>
      </div>
      <p className={`mt-2 text-[15px] ${h.ok ? "" : "down"}`}>
        {h.ok ? "The worker is running." : "The worker's heartbeat is stale or missing."}
      </p>
      <dl className="mt-5 grid grid-cols-2 divide-ice-scratch border-y border-ice-scratch sm:grid-cols-4 sm:divide-x">
        {[
          ["Mode", h.mode === "live" ? "Live" : "Replay"],
          ["Heartbeat", h.worker_lag_s != null ? `${Math.round(h.worker_lag_s)} s ago` : "none"],
          ["Last simulation", h.last_sim_ms != null ? `${Math.round(h.last_sim_ms)} ms` : "none"],
          ["Scoreboard poll", ago(h.last_poll.score)],
        ].map(([k, v]) => (
          <div key={k} className="px-3 py-3 sm:first:pl-0">
            <dt className="text-[12px] text-ink-soft">{k}</dt>
            <dd className="display text-[30px] font-bold leading-none tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <GoalBot bot={data.bot} onChange={reload} />
      <section className="mt-10">
        <h2 className="display text-[26px] font-bold">Last successful polls</h2>
        <ul className="mt-2 text-[14px]">
          {Object.entries(h.last_poll).map(([k, v]) => (
            <li key={k} className="flex justify-between border-t border-ice-scratch py-1.5">
              <span>{k}</span>
              <span className="tabular-nums text-ink-soft">{ago(v)}</span>
            </li>
          ))}
          {Object.keys(h.last_poll).length === 0 && (
            <li className="text-ink-soft">No polls yet.</li>
          )}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="display text-[26px] font-bold">Recent simulations</h2>
        <SimStrip runs={data.sim_runs} />
        {data.sim_runs.length > 0 && (
          <table className="mt-4 w-full text-[14px]">
            <thead className="text-left text-[12px] text-ink-soft">
              <tr>
                <th className="font-normal">When</th>
                <th className="font-normal">Trigger</th>
                <th className="text-right font-normal">Seasons</th>
                <th className="text-right font-normal">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.sim_runs.slice(0, 6).map((r) => (
                <tr key={String(r.id)} className="border-t border-ice-scratch">
                  <td className="py-1.5">{ago(String(r.created_at))}</td>
                  <td>{String(r.trigger)}</td>
                  <td className="text-right tabular-nums">{Number(r.n_sims).toLocaleString()}</td>
                  <td className="text-right tabular-nums">
                    {Math.round(Number(r.duration_ms))} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="mt-10">
        <h2 className="display text-[26px] font-bold">Standings reconciliation</h2>
        {data.reconcile.length === 0 ? (
          <p className="mt-2 text-[14px] text-ink-soft">
            No mismatches between computed standings and NHL.com.
          </p>
        ) : (
          <ul className="mt-2 text-[14px]">
            {data.reconcile.map((r) => (
              <li key={String(r.id)} className="border-t border-ice-scratch py-1.5">
                {ago(String(r.created_at))}: {String(r.kind)}{" "}
                <code className="text-[12px] text-ink-soft">{JSON.stringify(r.detail)}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-10">
        <h2 className="display text-[26px] font-bold">Jobs</h2>
        {data.jobs.length === 0 && <p className="mt-2 text-[14px] text-ink-soft">No jobs yet.</p>}
        <table className="mt-2 w-full text-[14px]">
          <tbody>
            {data.jobs.map((j) => (
              <tr key={j.id} className="border-t border-ice-scratch">
                <td className="py-1.5">{j.job}</td>
                <td>{j.status}</td>
                <td className="text-right text-ink-soft">{ago(j.started_at)}</td>
                <td className="text-right tabular-nums text-ink-soft">
                  {j.finished_at
                    ? `${Math.round((Date.parse(j.finished_at) - Date.parse(j.started_at)) / 1000)} s`
                    : "running"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
