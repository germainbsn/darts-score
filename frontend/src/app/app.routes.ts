import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { CricketBoard } from './features/play/cricket-board/cricket-board';

export const routes: Routes = [
  { path: '', component: Home },
  // Phase 1: cricket only. Phase 2 replaces this with a dispatcher that picks
  // the board component based on the loaded game's type.
  { path: 'play/:id', component: CricketBoard },
];
