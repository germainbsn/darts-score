package com.triplevingt.match;

public record MatchStandingsResponse(
        int[] setsWon,
        int[] legsWon,
        int legsPlayed,
        Integer matchWinner,
        boolean matchOver
) {}
