import { Component, inject } from '@angular/core';
import { GameStore } from '../../../core/state/game-store';
import { clockTargetLabel } from '../../../engine/clock-engine';
import { PostGameActions } from '../post-game-actions/post-game-actions';

@Component({
  imports: [PostGameActions],
  selector: 'app-clock-board',
  styleUrl: './clock-board.css',
  templateUrl: './clock-board.html',
})
export class ClockBoard {
  readonly store = inject(GameStore);

  targetLabel(index: number): string {
    const g = this.store.game();
    if (!g) return '';
    return clockTargetLabel(g, index);
  }

  hit(): void {
    this.store.applyClockDart(true);
  }

  miss(): void {
    this.store.applyClockDart(false);
  }

  undo(): void {
    this.store.undoLast();
  }
}
