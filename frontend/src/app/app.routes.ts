import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { Play } from './features/play/play';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'play/:id', component: Play },
];
