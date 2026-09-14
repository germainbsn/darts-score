package com.triplevingt.game.engine;

import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * Direct port of the original app's computeClockState (js/clock.js). Log
 * entry shape: {player: int, hit: boolean}. One shared sequential log like
 * Cricket — 3 darts per turn, current player derived from position.
 */
public final class ClockEngine {

    private ClockEngine() {}

    public static ClockState compute(List<String> players, JsonNode log) {
        int n = players.size();
        int[] hits = new int[n];
        int[] darts = new int[n];
        int len = log == null ? 0 : log.size();

        for (int i = 0; i < len; i++) {
            JsonNode t = log.get(i);
            int p = t.path("player").asInt();
            darts[p]++;
            if (t.path("hit").asBoolean(false)) hits[p]++;
        }

        int currentPlayer = n == 0 ? 0 : (len / 3) % n;
        int dartInTurn = len % 3;

        Integer winnerIndex = null;
        for (int p = 0; p < n; p++) { if (hits[p] >= 21) { winnerIndex = p; break; } }

        return new ClockState(hits, darts, currentPlayer, dartInTurn, winnerIndex, winnerIndex != null);
    }

    // The target for the `index`-th dart a player still needs (0-based).
    // Sequential mode (no clockOrder stored) is just index+1, 1-20 then 21
    // for the finish. Random mode looks up the shuffled draw stored on the
    // game at creation, so every player follows that same draw.
    public static int targetAt(List<Integer> clockOrder, int index) {
        if (clockOrder != null && !clockOrder.isEmpty()) return clockOrder.get(index);
        return index + 1;
    }
}
