import { ClockLogEntry, Game } from '../core/api/models';

export interface ClockState {
  hits: number[];
  darts: number[];
  currentPlayer: number;
  dartInTurn: number;
  winnerIndex: number | null;
  finished: boolean;
}

// Direct port of computeClockState (js/clock.js) — one shared sequential
// log like Cricket, 3 darts per turn.
export function computeClockState(game: Game): ClockState {
  const n = game.players.length;
  const hits: number[] = game.players.map(() => 0);
  const darts: number[] = game.players.map(() => 0);
  const log = game.log as ClockLogEntry[];

  for (const t of log) {
    darts[t.player]++;
    if (t.hit) hits[t.player]++;
  }

  const currentPlayer = n === 0 ? 0 : Math.floor(log.length / 3) % n;
  const dartInTurn = log.length % 3;

  let winnerIndex: number | null = null;
  for (let p = 0; p < n; p++) { if (hits[p] >= 21) { winnerIndex = p; break; } }

  return { hits, darts, currentPlayer, dartInTurn, winnerIndex, finished: winnerIndex !== null };
}

export function finishLabel(mode: Game['finishMode']): string {
  if (mode === 'outer') return '25';
  if (mode === 'bull') return '50';
  return '25/50';
}

// The target for the `index`-th dart a player still needs (0-based).
export function clockTargetAt(game: Game, index: number): number {
  if (game.clockOrder && game.clockOrder.length) return game.clockOrder[index];
  return index + 1;
}

export function clockTargetLabel(game: Game, index: number): string {
  const num = clockTargetAt(game, index);
  if (num > 20) return finishLabel(game.finishMode);
  const prefix = game.clockMultiplier === 'double' ? 'D' : game.clockMultiplier === 'triple' ? 'T' : '';
  return prefix + num;
}
