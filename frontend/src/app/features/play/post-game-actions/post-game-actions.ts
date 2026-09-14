import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GameApiService } from '../../../core/api/game-api.service';
import { CreateGameRequest } from '../../../core/api/models';
import { GameStore } from '../../../core/state/game-store';

// Shared by all four board types: once a leg finishes, shows the winner
// (mode-aware for a match: "Manche suivante" keeps a best-of-legs/sets match
// going, "Rejouer" starts a fresh game or a fresh match) plus an undo button
// that keeps working after the fact.
@Component({
  imports: [],
  selector: 'app-post-game-actions',
  styleUrl: './post-game-actions.css',
  templateUrl: './post-game-actions.html',
})
export class PostGameActions {
  readonly store = inject(GameStore);
  private readonly api = inject(GameApiService);
  private readonly router = inject(Router);

  readonly winnerText = computed(() => {
    const g = this.store.game();
    if (!g || g.status !== 'finished' || g.winnerIndex === null) return null;
    const standings = this.store.matchStandings();
    if (standings) {
      if (standings.matchOver && standings.matchWinner !== null) {
        return `🏆 ${g.players[standings.matchWinner]} remporte le MATCH (sets ${standings.setsWon.join('-')}) !`;
      }
      return `🏆 ${g.players[g.winnerIndex]} remporte la manche — Sets ${standings.setsWon.join('-')} · Manches ${standings.legsWon.join('-')}`;
    }
    return `🏆 ${g.players[g.winnerIndex]} remporte la partie !`;
  });

  readonly nextLabel = computed(() => {
    const standings = this.store.matchStandings();
    return standings && !standings.matchOver ? 'Manche suivante' : 'Rejouer';
  });

  undo(): void {
    this.store.undoLast();
  }

  playAgain(): void {
    const g = this.store.game();
    if (!g) return;
    const standings = this.store.matchStandings();
    const continueMatch = !!standings && !standings.matchOver;
    const req: CreateGameRequest = {
      type: g.type,
      variant: g.variant,
      doubleOut: g.doubleOut,
      finishMode: g.finishMode,
      clockMultiplier: g.clockMultiplier,
      clockOrderMode: g.clockOrder ? 'random' : undefined,
      matchId: continueMatch ? (g.matchId ?? undefined) : (g.matchId ? crypto.randomUUID() : undefined),
      legsToWin: g.matchId ? (g.legsToWin ?? undefined) : undefined,
      setsToWin: g.matchId ? (g.setsToWin ?? undefined) : undefined,
      players: g.players,
    };
    this.api.create(req).subscribe((created) => {
      this.router.navigate(['/play', created.id]);
    });
  }
}
