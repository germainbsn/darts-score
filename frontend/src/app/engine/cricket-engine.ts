import { CricketLogEntry } from '../core/api/models';

// 20 down to 15, then Bull — matches CRICKET_NUMS in the original constants.js.
export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25];
export const CRICKET_LABELS: Record<number, string> = {
  20: '20', 19: '19', 18: '18', 17: '17', 16: '16', 15: '15', 25: 'Bull',
};

export interface CricketState {
  marks: number[][]; // [player][numberIndex] 0-3
  scores: number[];
  currentPlayer: number;
  dartInTurn: number;
  winnerIndex: number | null;
  finished: boolean;
}

// Direct port of computeCricketState (js/cricket.js) — pure function, used
// for live board rendering while darts are being entered, before the turn is
// committed to the backend via PATCH.
export function computeCricketState(players: string[], log: CricketLogEntry[]): CricketState {
  const n = players.length;
  const marks: number[][] = players.map(() => [0, 0, 0, 0, 0, 0, 0]);
  const scores: number[] = players.map(() => 0);

  for (const t of log) {
    if (!t.number) continue; // miss
    const idx = CRICKET_NUMBERS.indexOf(t.number);
    if (idx < 0) continue;
    const cur = marks[t.player][idx];
    const add = t.mult;
    const newMarks = Math.min(3, cur + add);
    const used = newMarks - cur;
    const overflow = add - used;
    marks[t.player][idx] = newMarks;
    if (overflow > 0) {
      let allOthersClosed = true;
      for (let pi = 0; pi < n; pi++) {
        if (pi !== t.player && marks[pi][idx] < 3) { allOthersClosed = false; break; }
      }
      if (!allOthersClosed) scores[t.player] += overflow * t.number;
    }
  }

  const turnIndex = Math.floor(log.length / 3);
  const currentPlayer = n === 0 ? 0 : turnIndex % n;
  const dartInTurn = log.length % 3;

  let winnerIndex: number | null = null;
  for (let p = 0; p < n; p++) {
    const allClosed = marks[p].every((m) => m === 3);
    if (!allClosed) continue;
    let highest = true;
    for (let q = 0; q < n; q++) { if (q !== p && scores[q] > scores[p]) { highest = false; break; } }
    if (highest) { winnerIndex = p; break; }
  }

  return { marks, scores, currentPlayer, dartInTurn, winnerIndex, finished: winnerIndex !== null };
}
