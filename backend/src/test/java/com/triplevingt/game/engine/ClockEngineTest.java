package com.triplevingt.game.engine;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;

class ClockEngineTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode log(Object[]... darts) {
        ArrayNode arr = mapper.createArrayNode();
        for (Object[] d : darts) {
            var node = mapper.createObjectNode();
            node.put("player", (int) d[0]);
            node.put("hit", (boolean) d[1]);
            arr.add(node);
        }
        return arr;
    }

    @Test
    void countsHitsAndDartsSeparately() {
        ClockState st = ClockEngine.compute(List.of("A", "B"), log(
                new Object[]{0, true}, new Object[]{0, false}, new Object[]{0, true}
        ));
        assertEquals(2, st.hits()[0]);
        assertEquals(3, st.darts()[0]);
        assertFalse(st.finished());
    }

    @Test
    void winnerAt21Hits() {
        List<Object[]> darts = new ArrayList<>();
        for (int i = 0; i < 21; i++) darts.add(new Object[]{0, true});
        ClockState st = ClockEngine.compute(List.of("A", "B"), log(darts.toArray(new Object[0][])));
        assertTrue(st.finished());
        assertEquals(0, st.winnerIndex());
    }

    @Test
    void currentPlayerAndDartInTurnRotateEveryThreeDarts() {
        List<Object[]> darts = new ArrayList<>();
        for (int i = 0; i < 4; i++) darts.add(new Object[]{0, false}); // 4 darts logged
        ClockState st = ClockEngine.compute(List.of("A", "B"), log(darts.toArray(new Object[0][])));
        assertEquals(1, st.currentPlayer()); // floor(4/3) % 2 = 1
        assertEquals(1, st.dartInTurn());    // 4 % 3 = 1
        assertNull(st.winnerIndex());
    }

    @Test
    void sequentialTargetIsIndexPlusOne() {
        assertEquals(1, ClockEngine.targetAt(null, 0));
        assertEquals(21, ClockEngine.targetAt(null, 20));
    }

    @Test
    void randomTargetLooksUpTheStoredOrder() {
        List<Integer> order = List.of(7, 3, 21, 1);
        assertEquals(7, ClockEngine.targetAt(order, 0));
        assertEquals(21, ClockEngine.targetAt(order, 2));
    }
}
