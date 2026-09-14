package com.triplevingt.game.engine;

import tools.jackson.databind.JsonNode;
import java.util.List;

/**
 * Direct port of the original app's computeCricketState (js/cricket.js).
 * Log entry shape: {player: int, number: 1-20|25|0-for-miss, mult: 1|2|3}.
 */
public final class CricketEngine {

    // 20 down to 15, then Bull — matches CRICKET_NUMS in the original constants.js.
    public static final int[] NUMBERS = {20, 19, 18, 17, 16, 15, 25};

    private CricketEngine() {}

    public static CricketState compute(List<String> players, JsonNode log) {
        int n = players.size();
        int[][] marks = new int[n][NUMBERS.length];
        int[] scores = new int[n];
        int len = log == null ? 0 : log.size();

        for (int i = 0; i < len; i++) {
            JsonNode t = log.get(i);
            int number = t.path("number").asInt(0);
            if (number == 0) continue; // miss
            int idx = indexOf(number);
            if (idx < 0) continue; // defensive: unknown number, ignore
            int player = t.path("player").asInt();
            int mult = t.path("mult").asInt(1);

            int cur = marks[player][idx];
            int newMarks = Math.min(3, cur + mult);
            int used = newMarks - cur;
            int overflow = mult - used;
            marks[player][idx] = newMarks;

            if (overflow > 0) {
                boolean allOthersClosed = true;
                for (int p = 0; p < n; p++) {
                    if (p != player && marks[p][idx] < 3) { allOthersClosed = false; break; }
                }
                if (!allOthersClosed) {
                    scores[player] += overflow * number;
                }
            }
        }

        int turnIndex = len / 3;
        int currentPlayer = n == 0 ? 0 : turnIndex % n;
        int dartInTurn = len % 3;

        Integer winnerIndex = null;
        for (int p = 0; p < n; p++) {
            boolean allClosed = true;
            for (int m : marks[p]) { if (m != 3) { allClosed = false; break; } }
            if (!allClosed) continue;
            boolean highest = true;
            for (int q = 0; q < n; q++) { if (q != p && scores[q] > scores[p]) { highest = false; break; } }
            if (highest) { winnerIndex = p; break; }
        }

        return new CricketState(marks, scores, currentPlayer, dartInTurn, winnerIndex, winnerIndex != null);
    }

    private static int indexOf(int number) {
        for (int i = 0; i < NUMBERS.length; i++) {
            if (NUMBERS[i] == number) return i;
        }
        return -1;
    }
}
