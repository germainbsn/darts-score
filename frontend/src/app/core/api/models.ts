export type GameType = 'cricket' | 'x01' | 'score' | 'clock';
export type GameStatus = 'in_progress' | 'finished' | 'abandoned';

export interface CricketLogEntry {
  player: number;
  number: number; // 1-20, 25 (bull), or 0 for a miss
  mult: number; // 1 (simple), 2 (double), 3 (triple)
}

export interface X01LogEntry {
  player: number;
  attempted: number;
  confirmedDouble: boolean;
}

export interface ClockLogEntry {
  player: number;
  hit: boolean;
}

export interface Game {
  id: string;
  type: GameType;
  variant: number | null;
  doubleOut: boolean;
  finishMode: 'outer' | 'bull' | 'any' | null;
  clockMultiplier: 'any' | 'double' | 'triple' | null;
  clockOrder: number[] | null;
  matchId: string | null;
  legsToWin: number | null;
  setsToWin: number | null;
  players: string[];
  log: unknown[];
  status: GameStatus;
  winnerIndex: number | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface CreateGameRequest {
  type: GameType;
  variant?: number | null;
  doubleOut?: boolean;
  finishMode?: string | null;
  clockMultiplier?: string | null;
  // "sequential" (default) or "random" — the server generates the actual
  // shuffled clockOrder itself.
  clockOrderMode?: string | null;
  matchId?: string | null;
  legsToWin?: number | null;
  setsToWin?: number | null;
  players: string[];
}
