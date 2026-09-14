import { Injectable, computed, inject, signal } from '@angular/core';
import { GameApiService } from '../api/game-api.service';
import { ClockLogEntry, CricketLogEntry, Game, X01LogEntry } from '../api/models';
import { MatchStandings } from '../api/match-standings';
import { computeCricketState, CricketState } from '../../engine/cricket-engine';
import { computeX01State, X01State } from '../../engine/x01-engine';
import { computeClockState, ClockState } from '../../engine/clock-engine';

@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly api = inject(GameApiService);

  readonly game = signal<Game | null>(null);
  readonly matchStandings = signal<MatchStandings | null>(null);

  readonly cricketState = computed<CricketState | null>(() => {
    const g = this.game();
    if (!g || g.type !== 'cricket') return null;
    return computeCricketState(g.players, g.log as CricketLogEntry[]);
  });

  readonly x01State = computed<X01State | null>(() => {
    const g = this.game();
    if (!g || (g.type !== 'x01' && g.type !== 'score')) return null;
    return computeX01State(g);
  });

  readonly clockState = computed<ClockState | null>(() => {
    const g = this.game();
    if (!g || g.type !== 'clock') return null;
    return computeClockState(g);
  });

  load(id: string): void {
    this.api.get(id).subscribe((g) => {
      this.game.set(g);
      this.refreshMatchStandings(g);
    });
  }

  private refreshMatchStandings(g: Game): void {
    if (!g.matchId) { this.matchStandings.set(null); return; }
    this.api.matchStandings(g.matchId).subscribe((s) => this.matchStandings.set(s));
  }

  // Appends one entry to the log and lets the backend replay it to derive
  // the authoritative status/winnerIndex/finishedAt — the response, not this
  // client's own guess, becomes the new state.
  private appendLog(entry: unknown): void {
    const g = this.game();
    if (!g) return;
    const newLog = [...g.log, entry];
    this.api.updateLog(g.id, newLog).subscribe((updated) => {
      this.game.set(updated);
      this.refreshMatchStandings(updated);
    });
  }

  applyCricketDart(number: number, mult: number): void {
    const st = this.cricketState();
    if (!st || st.finished) return;
    const entry: CricketLogEntry = { player: st.currentPlayer, number, mult };
    this.appendLog(entry);
  }

  applyCricketMiss(): void {
    const st = this.cricketState();
    if (!st || st.finished) return;
    const entry: CricketLogEntry = { player: st.currentPlayer, number: 0, mult: 0 };
    this.appendLog(entry);
  }

  // `confirmedDouble` only matters when this turn lands exactly on 0 with
  // doubleOut on; the backend re-derives bust/finish regardless.
  applyX01Turn(attempted: number, confirmedDouble: boolean): void {
    const st = this.x01State();
    if (!st || st.finished) return;
    const entry: X01LogEntry = { player: st.currentPlayer, attempted, confirmedDouble };
    this.appendLog(entry);
  }

  applyClockDart(hit: boolean): void {
    const st = this.clockState();
    if (!st || st.finished) return;
    const entry: ClockLogEntry = { player: st.currentPlayer, hit };
    this.appendLog(entry);
  }

  undoLast(): void {
    const g = this.game();
    if (!g || g.log.length === 0) return;
    const newLog = g.log.slice(0, -1);
    this.api.updateLog(g.id, newLog).subscribe((updated) => {
      this.game.set(updated);
      this.refreshMatchStandings(updated);
    });
  }

  abandon(): void {
    const g = this.game();
    if (!g) return;
    this.api.abandon(g.id).subscribe((updated) => this.game.set(updated));
  }
}
