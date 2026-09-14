import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GameApiService } from '../../core/api/game-api.service';
import { Game } from '../../core/api/models';
import { finishLabel } from '../../engine/clock-engine';

@Component({
  imports: [],
  selector: 'app-history',
  styleUrl: './history.css',
  templateUrl: './history.html',
})
export class History implements OnInit {
  private readonly api = inject(GameApiService);
  private readonly router = inject(Router);

  readonly games = signal<Game[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  ngOnInit(): void {
    this.loadPage(0);
  }

  loadPage(page: number): void {
    this.api.history(page).subscribe((res) => {
      this.games.set(res.content);
      this.page.set(res.number);
      this.totalPages.set(res.totalPages);
    });
  }

  typeLabel(g: Game): string {
    if (g.type === 'cricket') return 'Cricket';
    if (g.type === 'score') return `Score · ${g.variant} lancers`;
    if (g.type === 'clock') return `Horloge · finir sur ${finishLabel(g.finishMode)}`;
    return `${g.variant}${g.doubleOut ? ' · double sortie' : ''}`;
  }

  winnerName(g: Game): string {
    return g.winnerIndex !== null ? g.players[g.winnerIndex] : '—';
  }

  dateLabel(g: Game): string {
    if (!g.finishedAt) return '';
    return new Date(g.finishedAt).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  open(id: string): void {
    this.router.navigate(['/play', id]);
  }
}
