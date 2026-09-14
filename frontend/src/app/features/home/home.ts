import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GameApiService } from '../../core/api/game-api.service';
import { CreateGameRequest, GameType } from '../../core/api/models';

type SetupType = 'cricket' | '301' | '501' | 'score' | 'clock';

@Component({
  imports: [],
  selector: 'app-home',
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {
  private readonly api = inject(GameApiService);
  private readonly router = inject(Router);

  readonly setupType = signal<SetupType>('cricket');
  readonly playerCount = signal(2);
  readonly names = signal<string[]>(['', '']);

  readonly doubleOut = signal(true);
  readonly roundsCount = signal(10);
  readonly clockFinishMode = signal<'outer' | 'bull' | 'any'>('any');
  readonly clockMultiplier = signal<'any' | 'double' | 'triple'>('any');
  readonly clockOrderMode = signal<'sequential' | 'random'>('sequential');
  readonly legsToWin = signal(1);
  readonly setsToWin = signal(1);

  setType(t: SetupType): void {
    this.setupType.set(t);
  }

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

  setLegsToWin(n: number): void { if (n >= 1 && n <= 9) this.legsToWin.set(n); }
  setSetsToWin(n: number): void { if (n >= 1 && n <= 9) this.setsToWin.set(n); }
  setRoundsCount(n: number): void { if (n >= 3 && n <= 20) this.roundsCount.set(n); }

  startGame(): void {
    const players = this.names().map((n, i) => n.trim() || `Joueur ${i + 1}`);
    const type = this.setupType();
    const isX01 = type === '301' || type === '501';
    const isMatch = this.playerCount() > 1 && (this.legsToWin() > 1 || this.setsToWin() > 1);

    const gameType: GameType = type === 'cricket' ? 'cricket' : type === 'score' ? 'score' : type === 'clock' ? 'clock' : 'x01';
    const req: CreateGameRequest = {
      type: gameType,
      variant: type === 'score' ? this.roundsCount() : isX01 ? parseInt(type, 10) : null,
      doubleOut: isX01 ? this.doubleOut() : false,
      finishMode: type === 'clock' ? this.clockFinishMode() : null,
      clockMultiplier: type === 'clock' ? this.clockMultiplier() : null,
      clockOrderMode: type === 'clock' ? this.clockOrderMode() : null,
      matchId: isMatch ? crypto.randomUUID() : null,
      legsToWin: isMatch ? this.legsToWin() : null,
      setsToWin: isMatch ? this.setsToWin() : null,
      players,
    };
    this.api.create(req).subscribe((game) => {
      this.router.navigate(['/play', game.id]);
    });
  }
}
