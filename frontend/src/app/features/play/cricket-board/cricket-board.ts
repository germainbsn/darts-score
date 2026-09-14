import { Component, inject, signal } from '@angular/core';
import { GameStore } from '../../../core/state/game-store';
import { CRICKET_LABELS, CRICKET_NUMBERS } from '../../../engine/cricket-engine';
import { PostGameActions } from '../post-game-actions/post-game-actions';

@Component({
  imports: [PostGameActions],
  selector: 'app-cricket-board',
  styleUrl: './cricket-board.css',
  templateUrl: './cricket-board.html',
})
export class CricketBoard {
  readonly store = inject(GameStore);

  readonly numbers = CRICKET_NUMBERS;
  readonly labels = CRICKET_LABELS;
  readonly selectedMult = signal(1);

  setMult(mult: number): void {
    this.selectedMult.set(mult);
  }

  hit(number: number): void {
    this.store.applyCricketDart(number, this.selectedMult());
    this.selectedMult.set(1);
  }

  miss(): void {
    this.store.applyCricketMiss();
    this.selectedMult.set(1);
  }

  undo(): void {
    this.store.undoLast();
  }
}
