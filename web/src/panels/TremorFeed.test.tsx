import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { Tremor } from "../api/types.gen";
import { TremorLine } from "./TremorFeed";

// A late goal in a decided game: nobody's odds move.
const garbageTime = {
  id: 1,
  team: "CGY",
  home: "VGK",
  away: "CGY",
  scorer: { id: 9, name: "Matt Coronato" },
  period: 3,
  period_type: "REG",
  t_period_s: 1119,
  score_after: { home: 6, away: 2 },
  magnitude: 0,
  overturned: false,
  shootout: false,
  wp_before: {
    home_reg: 0.97,
    home_ot: 0.01,
    home_so: 0.01,
    away_reg: 0.01,
    away_ot: 0,
    away_so: 0,
  },
  wp_after: {
    home_reg: 0.95,
    home_ot: 0.01,
    home_so: 0.01,
    away_reg: 0.02,
    away_ot: 0.01,
    away_so: 0,
  },
  deltas: [
    { team: "ANA", d_playoffs: 0.0001, d_cup: 0, d_division: 0, p_playoffs_after: 0.6 },
    { team: "BOS", d_playoffs: -0.0001, d_cup: 0, d_division: 0, p_playoffs_after: 0.8 },
    { team: "CGY", d_playoffs: 0.0002, d_cup: 0, d_division: 0, p_playoffs_after: 0.1 },
  ],
} as unknown as Tremor;

describe("TremorLine", () => {
  it("does not list teams that did not move", () => {
    render(
      <MemoryRouter>
        <TremorLine t={garbageTime} myTeam={null} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/ANA/)).toBeNull();
    expect(screen.getByText("No team's odds moved by 0.1 pp")).toBeInTheDocument();
  });

  it("shows a tiny magnitude as <0.1 and says what the goal did to the game", () => {
    render(
      <MemoryRouter>
        <TremorLine t={garbageTime} myTeam={null} />
      </MemoryRouter>,
    );
    expect(screen.getByText("<0.1")).toBeInTheDocument();
    expect(screen.getByText("CGY win chance 1% to 3%")).toBeInTheDocument();
  });

  it("shows an unmoved team's change as 0.0, not as a loss", () => {
    render(
      <MemoryRouter>
        <TremorLine t={garbageTime} myTeam={null} focus="CGY" />
      </MemoryRouter>,
    );
    const change = screen.getByLabelText("CGY 0.0 pp");
    expect(change).toHaveTextContent(/^0\.0$/);
    expect(change).not.toHaveClass("down");
  });
});
