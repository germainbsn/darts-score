import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateGameRequest, Game } from './models';

const BASE_URL = 'http://localhost:8080/api/games';

@Injectable({ providedIn: 'root' })
export class GameApiService {
  private readonly http = inject(HttpClient);

  create(req: CreateGameRequest): Observable<Game> {
    return this.http.post<Game>(BASE_URL, req);
  }

  get(id: string): Observable<Game> {
    return this.http.get<Game>(`${BASE_URL}/${id}`);
  }

  list(status?: string): Observable<Game[]> {
    return this.http.get<Game[]>(BASE_URL, status ? { params: { status } } : {});
  }

  updateLog(id: string, log: unknown[]): Observable<Game> {
    return this.http.patch<Game>(`${BASE_URL}/${id}`, { log });
  }

  abandon(id: string): Observable<Game> {
    return this.http.post<Game>(`${BASE_URL}/${id}/abandon`, {});
  }
}
