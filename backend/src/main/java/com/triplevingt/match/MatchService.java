package com.triplevingt.match;

import com.triplevingt.game.Game;
import com.triplevingt.game.GameRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Port of computeMatchStandings (js/app.js): a "leg" is one ordinary game
 * document; several legs sharing a matchId form a match. Standings are
 * derived on the fly by replaying every finished leg in play order —
 * crediting a set once a player's leg count within it reaches legsToWin,
 * and the match once a player's set count reaches setsToWin — never stored.
 */
@Service
public class MatchService {

    private final GameRepository gameRepository;

    public MatchService(GameRepository gameRepository) {
        this.gameRepository = gameRepository;
    }

    public MatchStandingsResponse standings(UUID matchId) {
        List<Game> legs = gameRepository.findByMatchIdOrderByCreatedAtAsc(matchId).stream()
                .filter(g -> "finished".equals(g.getStatus()) && g.getWinnerIndex() != null)
                .toList();

        if (legs.isEmpty()) {
            return new MatchStandingsResponse(new int[0], new int[0], 0, null, false);
        }

        Game first = legs.get(0);
        int n = first.getPlayers().size();
        int legsToWin = first.getLegsToWin();
        int setsToWin = first.getSetsToWin();

        int[] setsWon = new int[n];
        int[] legsWon = new int[n];
        for (Game g : legs) {
            int w = g.getWinnerIndex();
            legsWon[w]++;
            if (legsWon[w] >= legsToWin) {
                setsWon[w]++;
                legsWon = new int[n];
            }
        }

        Integer matchWinner = null;
        for (int i = 0; i < n; i++) {
            if (setsWon[i] >= setsToWin) { matchWinner = i; break; }
        }

        return new MatchStandingsResponse(setsWon, legsWon, legs.size(), matchWinner, matchWinner != null);
    }
}
