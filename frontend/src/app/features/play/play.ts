import { Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { GameStore } from '../../core/state/game-store';
import { CricketBoard } from './cricket-board/cricket-board';
import { X01Board } from './x01-board/x01-board';
import { ClockBoard } from './clock-board/clock-board';

@Component({
  imports: [CricketBoard, X01Board, ClockBoard],
  selector: 'app-play',
  styleUrl: './play.css',
  templateUrl: './play.html',
})
export class Play {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(GameStore);

  // Angular reuses this component instance when navigating from one
  // /play/:id to another (only the route param changes) — ngOnInit would
  // only ever fire once. Watching the param signal instead means "Manche
  // suivante"/"Rejouer" (which navigate to a new id on the same route)
  // correctly reload the new game.
  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))));

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) this.store.load(id);
    });
  }
}
