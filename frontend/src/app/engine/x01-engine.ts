import { Game, X01LogEntry } from '../core/api/models';

export interface X01Entry {
  player: number;
  attempted: number;
  bust: boolean;
  totalAfter: number;
}

export interface X01State {
  totals: number[];
  entries: X01Entry[];
  currentPlayer: number;
  winnerIndex: number | null;
  finished: boolean;
}

// Direct port of computeX01State (js/x01.js) — shared by 301/501 (counts
// down from `variant`, can bust) and Score (counts up from 0, no bust, ends
// after `variant` rounds per player, highest total wins).
export function computeX01State(game: Game): X01State {
  const players = game.players;
  const n = players.length;
  const isScore = game.type === 'score';
  const start = isScore ? 0 : (game.variant ?? 0);
  const totals: number[] = players.map(() => start);
  const log = game.log as X01LogEntry[];
  const entries: X01Entry[] = [];

  for (const t of log) {
    const p = t.player;
    let bust = false;
    let newTotal: number;
    if (isScore) {
      newTotal = totals[p] + t.attempted;
    } else {
      newTotal = totals[p] - t.attempted;
      if (newTotal < 0) bust = true;
      else if (game.doubleOut && newTotal === 1) bust = true;
      else if (game.doubleOut && newTotal === 0 && !t.confirmedDouble) bust = true;
    }
    if (!bust) totals[p] = newTotal;
    entries.push({ player: p, attempted: t.attempted, bust, totalAfter: bust ? totals[p] : newTotal });
  }

  const currentPlayer = n === 0 ? 0 : log.length % n;
  let winnerIndex: number | null = null;
  let finished: boolean;
  if (isScore) {
    const rounds = game.variant ?? 0;
    finished = log.length >= rounds * n;
    if (finished) {
      winnerIndex = totals.indexOf(Math.max(...totals));
    }
  } else {
    for (let p = 0; p < n; p++) { if (totals[p] === 0) { winnerIndex = p; break; } }
    finished = winnerIndex !== null;
  }

  return { totals, entries, currentPlayer, winnerIndex, finished };
}
