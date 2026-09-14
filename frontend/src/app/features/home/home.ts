import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GameApiService } from '../../core/api/game-api.service';

@Component({
  imports: [],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {
  private readonly api = inject(GameApiService);
  private readonly router = inject(Router);

  readonly playerCount = signal(2);
  readonly names = signal<string[]>(['', '']);

  setPlayerCount(count: number): void {
    if (count < 1 || count > 4) return;
    this.playerCount.set(count);
    const current = this.names();
    const next = Array.from({ length: count }, (_, i) => current[i] ?? '');
    this.names.set(next);
  }

  onNameInput(index: number, value: string): void {
    const next = [...this.names()];
    next[index] = value;
    this.names.set(next);
  }

  startGame(): void {
    const players = this.names().map((n, i) => n.trim() || `Joueur ${i + 1}`);
    this.api.create({ type: 'cricket', players }).subscribe((game) => {
      this.router.navigate(['/play', game.id]);
    });
  }
}
