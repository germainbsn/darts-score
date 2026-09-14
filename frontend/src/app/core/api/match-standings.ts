export interface MatchStandings {
  setsWon: number[];
  legsWon: number[];
  legsPlayed: number;
  matchWinner: number | null;
  matchOver: boolean;
}
