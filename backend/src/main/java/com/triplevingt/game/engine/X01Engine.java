package com.triplevingt.game.engine;

import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * Direct port of the original app's computeX01State (js/x01.js), shared by
 * 301/501 (isScore=false, counts down from `variant`, can bust) and Score
 * (isScore=true, counts up from 0, no bust, ends after `variant` rounds).
 * Log entry shape: {player: int, attempted: int, confirmedDouble: boolean}.
 */
public final class X01Engine {

    private X01Engine() {}

    public static X01State compute(List<String> players, Integer variant, boolean doubleOut, boolean isScore, JsonNode log) {
        int n = players.size();
        int start = isScore ? 0 : (variant == null ? 0 : variant);
        int[] totals = new int[n];
        for (int i = 0; i < n; i++) totals[i] = start;

        List<X01Entry> entries = new ArrayList<>();
        int len = log == null ? 0 : log.size();
        for (int i = 0; i < len; i++) {
            JsonNode t = log.get(i);
            int p = t.path("player").asInt();
            int attempted = t.path("attempted").asInt();
            boolean confirmedDouble = t.path("confirmedDouble").asBoolean(false);
            boolean bust = false;
            int newTotal;
            if (isScore) {
                newTotal = totals[p] + attempted;
            } else {
                newTotal = totals[p] - attempted;
                if (newTotal < 0) bust = true;
                else if (doubleOut && newTotal == 1) bust = true;
                else if (doubleOut && newTotal == 0 && !confirmedDouble) bust = true;
            }
            if (!bust) totals[p] = newTotal;
            entries.add(new X01Entry(p, attempted, bust, bust ? totals[p] : newTotal));
        }

        int currentPlayer = n == 0 ? 0 : len % n;
        Integer winnerIndex = null;
        boolean finished;
        if (isScore) {
            int rounds = variant == null ? 0 : variant;
            finished = len >= rounds * n;
            if (finished) {
                int maxIdx = 0;
                for (int p = 1; p < n; p++) if (totals[p] > totals[maxIdx]) maxIdx = p;
                winnerIndex = maxIdx;
            }
        } else {
            for (int p = 0; p < n; p++) { if (totals[p] == 0) { winnerIndex = p; break; } }
            finished = winnerIndex != null;
        }

        return new X01State(totals, entries, currentPlayer, winnerIndex, finished);
    }
}
