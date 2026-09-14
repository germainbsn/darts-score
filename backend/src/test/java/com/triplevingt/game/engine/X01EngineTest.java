package com.triplevingt.game.engine;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;

class X01EngineTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode log(Object[]... turns) {
        ArrayNode arr = mapper.createArrayNode();
        for (Object[] t : turns) {
            var node = mapper.createObjectNode();
            node.put("player", (int) t[0]);
            node.put("attempted", (int) t[1]);
            node.put("confirmedDouble", (boolean) t[2]);
            arr.add(node);
        }
        return arr;
    }

    @Test
    void countsDownFrom301() {
        X01State st = X01Engine.compute(List.of("A", "B"), 301, false, false, log(new Object[]{0, 60, false}));
        assertEquals(241, st.totals()[0]);
        assertFalse(st.entries().get(0).bust());
    }

    @Test
    void bustsOnOvershoot() {
        X01State st = X01Engine.compute(List.of("A", "B"), 40, false, false, log(new Object[]{0, 60, false}));
        assertEquals(40, st.totals()[0]); // reverted, turn doesn't count
        assertTrue(st.entries().get(0).bust());
    }

    @Test
    void doubleOutBustsOnLandingExactlyOne() {
        X01State st = X01Engine.compute(List.of("A", "B"), 41, true, false, log(new Object[]{0, 40, false}));
        assertEquals(41, st.totals()[0]);
        assertTrue(st.entries().get(0).bust());
    }

    @Test
    void doubleOutBustsOnZeroWithoutConfirmedDouble() {
        X01State st = X01Engine.compute(List.of("A", "B"), 40, true, false, log(new Object[]{0, 40, false}));
        assertEquals(40, st.totals()[0]);
        assertTrue(st.entries().get(0).bust());
        assertNull(st.winnerIndex());
    }

    @Test
    void doubleOutWinsOnZeroWithConfirmedDouble() {
        X01State st = X01Engine.compute(List.of("A", "B"), 40, true, false, log(new Object[]{0, 40, true}));
        assertEquals(0, st.totals()[0]);
        assertFalse(st.entries().get(0).bust());
        assertEquals(0, st.winnerIndex());
        assertTrue(st.finished());
    }

    @Test
    void scoreModeCountsUpAndEndsAfterVariantRoundsWithHighestTotalWinning() {
        // variant=2 rounds, 2 players -> finished after 4 logged turns
        X01State st = X01Engine.compute(List.of("A", "B"), 2, false, true, log(
                new Object[]{0, 50, false},
                new Object[]{1, 30, false},
                new Object[]{0, 20, false},
                new Object[]{1, 10, false}
        ));
        assertEquals(70, st.totals()[0]);
        assertEquals(40, st.totals()[1]);
        assertTrue(st.finished());
        assertEquals(0, st.winnerIndex());
    }
}
