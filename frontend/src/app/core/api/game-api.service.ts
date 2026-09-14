import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateGameRequest, Game, PageResponse } from './models';
import { MatchStandings } from './match-standings';

const BASE_URL = 'http://localhost:8080/api/games';
const MATCHES_URL = 'http://localhost:8080/api/matches';

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

  history(page: number, size = 20): Observable<PageResponse<Game>> {
    return this.http.get<PageResponse<Game>>(`${BASE_URL}/history`, { params: { page, size } });
  }

  matchStandings(matchId: string): Observable<MatchStandings> {
    return this.http.get<MatchStandings>(`${MATCHES_URL}/${matchId}/standings`);
  }
}
