import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HealthService } from './core/api/health.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend');
  // Phase 0 smoke test only — proves the Angular -> Spring Boot -> Postgres
  // wiring works end to end. Removed once the real home page (Phase 1) lands.
  protected readonly backendStatus = signal('checking backend...');

  constructor() {
    inject(HealthService)
      .check()
      .subscribe({
        next: (res) => this.backendStatus.set('backend: ' + res.status),
        error: () => this.backendStatus.set('backend: unreachable'),
      });
  }
}
