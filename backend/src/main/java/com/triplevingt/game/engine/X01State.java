package com.triplevingt.game.engine;

import java.util.List;

public record X01State(
        int[] totals,
        List<X01Entry> entries,
        int currentPlayer,
        Integer winnerIndex,
        boolean finished
) {}
