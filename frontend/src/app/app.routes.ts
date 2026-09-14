import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { Play } from './features/play/play';
import { History } from './features/history/history';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'play/:id', component: Play },
  { path: 'history', component: History },
];
