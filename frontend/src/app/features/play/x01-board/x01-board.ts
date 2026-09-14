import { Component, inject, signal } from '@angular/core';
import { GameStore } from '../../../core/state/game-store';
import { PostGameActions } from '../post-game-actions/post-game-actions';

@Component({
  imports: [PostGameActions],
  selector: 'app-x01-board',
  styleUrl: './x01-board.css',
  templateUrl: './x01-board.html',
})
export class X01Board {
  readonly store = inject(GameStore);
  readonly input = signal('');
  readonly pendingConfirm = signal(false);
  private pendingAttempted = 0;

  press(digit: string): void {
    if (this.input().length >= 3) return;
    const next = this.input() + digit;
    if (parseInt(next, 10) > 180) return;
    this.input.set(next);
  }

  clear(): void {
    this.input.set('');
  }

  backspace(): void {
    this.input.set(this.input().slice(0, -1));
  }

  submit(): void {
    const g = this.store.game();
    const st = this.store.x01State();
    if (!g || !st || st.finished) return;
    const attempted = parseInt(this.input() || '0', 10);
    if (isNaN(attempted) || attempted < 0 || attempted > 180) return;
    const wouldRemain = st.totals[st.currentPlayer] - attempted;
    if (g.type === 'x01' && g.doubleOut && wouldRemain === 0) {
      this.pendingAttempted = attempted;
      this.pendingConfirm.set(true);
      return;
    }
    this.commit(attempted, false);
  }

  confirmDouble(confirmed: boolean): void {
    this.commit(this.pendingAttempted, confirmed);
    this.pendingConfirm.set(false);
  }

  private commit(attempted: number, confirmedDouble: boolean): void {
    this.store.applyX01Turn(attempted, confirmedDouble);
    this.input.set('');
  }

  undo(): void {
    this.store.undoLast();
  }
}
