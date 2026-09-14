import { Injectable, computed, inject, signal } from '@angular/core';
import { GameApiService } from '../api/game-api.service';
import { CricketLogEntry, Game } from '../api/models';
import { computeCricketState, CricketState } from '../../engine/cricket-engine';

@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly api = inject(GameApiService);

  readonly game = signal<Game | null>(null);

  readonly cricketState = computed<CricketState | null>(() => {
    const g = this.game();
    if (!g || g.type !== 'cricket') return null;
    return computeCricketState(g.players, g.log as CricketLogEntry[]);
  });

  load(id: string): void {
    this.api.get(id).subscribe((g) => this.game.set(g));
  }

  // Appends one entry to the log and lets the backend replay it to derive
  // the authoritative status/winnerIndex/finishedAt — the response, not this
  // client's own guess, becomes the new state.
  private appendLog(entry: unknown): void {
    const g = this.game();
    if (!g) return;
    const newLog = [...g.log, entry];
    this.api.updateLog(g.id, newLog).subscribe((updated) => this.game.set(updated));
  }

  applyCricketDart(number: number, mult: number): void {
    const g = this.game();
    if (!g) return;
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

  undoLast(): void {
    const g = this.game();
    if (!g || g.log.length === 0) return;
    const newLog = g.log.slice(0, -1);
    this.api.updateLog(g.id, newLog).subscribe((updated) => this.game.set(updated));
  }

  abandon(): void {
    const g = this.game();
    if (!g) return;
    this.api.abandon(g.id).subscribe((updated) => this.game.set(updated));
  }
}
