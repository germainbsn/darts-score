package com.triplevingt.game.engine;

public record CricketState(
        int[][] marks,
        int[] scores,
        int currentPlayer,
        int dartInTurn,
        Integer winnerIndex,
        boolean finished
) {}
