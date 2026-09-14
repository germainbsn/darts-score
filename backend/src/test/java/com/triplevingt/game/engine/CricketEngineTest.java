package com.triplevingt.game.engine;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class CricketEngineTest {

    private final ObjectMapper mapper = new ObjectMapper();

    // Each dart is {player, number, mult} — number 0 means a miss.
    private JsonNode log(int[]... darts) {
        ArrayNode arr = mapper.createArrayNode();
        for (int[] d : darts) {
            var node = mapper.createObjectNode();
            node.put("player", d[0]);
            node.put("number", d[1]);
            node.put("mult", d[2]);
            arr.add(node);
        }
        return arr;
    }

    @Test
    void emptyLogHasNoMarksAndNoWinner() {
        CricketState state = CricketEngine.compute(List.of("A", "B"), log());
        assertArrayEquals(new int[7], state.marks()[0]);
        assertEquals(0, state.currentPlayer());
        assertEquals(0, state.dartInTurn());
        assertNull(state.winnerIndex());
        assertFalse(state.finished());
    }

    @Test
    void tripleClosesANumberInOneDart() {
        CricketState state = CricketEngine.compute(List.of("A", "B"), log(new int[]{0, 20, 3}));
        assertEquals(3, state.marks()[0][0]); // 20 is index 0 in NUMBERS
    }

    @Test
    void missIsIgnoredButStillCountsAsADart() {
        CricketState state = CricketEngine.compute(List.of("A", "B"), log(new int[]{0, 0, 0}));
        assertArrayEquals(new int[7], state.marks()[0]);
        assertEquals(1, state.dartInTurn());
    }

    @Test
    void overflowScoresWhenTheOtherPlayerHasNotClosedThatNumber() {
        CricketState state = CricketEngine.compute(List.of("A", "B"), log(
                new int[]{0, 20, 3}, // P0 closes 20
                new int[]{1, 19, 1}, // P1 plays elsewhere, 20 still open for P1
                new int[]{0, 20, 1}  // P0 hits 20 again: overflow of 1
        ));
        assertEquals(20, state.scores()[0]);
    }

    @Test
    void overflowDoesNotScoreOnceEveryOtherPlayerHasClosedThatNumber() {
        CricketState state = CricketEngine.compute(List.of("A", "B"), log(
                new int[]{0, 20, 3}, // P0 closes 20
                new int[]{1, 20, 3}, // P1 also closes 20 — nobody left to score off
                new int[]{0, 20, 1}  // overflow, but no opponent still open
        ));
        assertEquals(0, state.scores()[0]);
    }

    @Test
    void winnerIsFirstToCloseAllSevenWithTheHighestScore() {
        List<int[]> darts = new ArrayList<>();
        for (int num : CricketEngine.NUMBERS) darts.add(new int[]{0, num, 3});
        CricketState state = CricketEngine.compute(List.of("A", "B"), log(darts.toArray(new int[0][])));
        assertTrue(state.finished());
        assertEquals(0, state.winnerIndex());
    }

    @Test
    void closingEverythingIsNotEnoughIfSomeoneElseHasAHigherScore() {
        List<int[]> darts = new ArrayList<>();
        // P1 closes 20 then overflows on it while P0 hasn't touched 20 yet -> P1 scores 20
        darts.add(new int[]{1, 20, 3});
        darts.add(new int[]{1, 20, 1});
        // P0 then closes all seven numbers cleanly (one triple each, no overflow)
        for (int num : CricketEngine.NUMBERS) darts.add(new int[]{0, num, 3});
        CricketState state = CricketEngine.compute(List.of("A", "B"), log(darts.toArray(new int[0][])));
        assertEquals(3, state.marks()[0][0]); // P0 has closed 20 too by the end
        assertEquals(0, state.scores()[0]);
        assertEquals(20, state.scores()[1]);
        assertNull(state.winnerIndex()); // P0 closed all 7 but P1 has the higher score
    }
}
