import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GameStore } from '../../../core/state/game-store';
import { CRICKET_LABELS, CRICKET_NUMBERS } from '../../../engine/cricket-engine';

@Component({
  imports: [],
  selector: 'app-cricket-board',
  styleUrl: './cricket-board.css',
  templateUrl: './cricket-board.html',
})
export class CricketBoard implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(GameStore);

  readonly numbers = CRICKET_NUMBERS;
  readonly labels = CRICKET_LABELS;
  readonly selectedMult = signal(1);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.store.load(id);
  }

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
