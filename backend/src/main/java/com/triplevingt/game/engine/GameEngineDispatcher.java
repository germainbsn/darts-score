package com.triplevingt.game.engine;

import tools.jackson.databind.JsonNode;
import java.util.List;

/**
 * Dispatches log-replay to the right per-mode engine. Only "cricket" is
 * implemented so far (Phase 1) — x01/score/clock land in Phase 2.
 */
public final class GameEngineDispatcher {

    private GameEngineDispatcher() {}

    public static EngineResult compute(String type, List<String> players, JsonNode log) {
        return switch (type) {
            case "cricket" -> {
                CricketState st = CricketEngine.compute(players, log);
                yield new EngineResult(st.finished(), st.winnerIndex());
            }
            default -> throw new UnsupportedOperationException("Engine not yet implemented for game type: " + type);
        };
    }
}
