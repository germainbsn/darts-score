package com.triplevingt.game.engine;

public record ClockState(
        int[] hits,
        int[] darts,
        int currentPlayer,
        int dartInTurn,
        Integer winnerIndex,
        boolean finished
) {}
