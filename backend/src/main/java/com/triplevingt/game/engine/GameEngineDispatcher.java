package com.triplevingt.game.engine;

import com.triplevingt.game.Game;

/**
 * Dispatches log-replay to the right per-mode engine, based on the game's
 * own type/variant/doubleOut fields plus the log passed in (the log isn't
 * necessarily saved onto `game` yet when this is called).
 */
public final class GameEngineDispatcher {

    private GameEngineDispatcher() {}

    public static EngineResult compute(Game game, tools.jackson.databind.JsonNode log) {
        return switch (game.getType()) {
            case "cricket" -> {
                CricketState st = CricketEngine.compute(game.getPlayers(), log);
                yield new EngineResult(st.finished(), st.winnerIndex());
            }
            case "x01", "score" -> {
                boolean isScore = "score".equals(game.getType());
                X01State st = X01Engine.compute(game.getPlayers(), game.getVariant(), game.isDoubleOut(), isScore, log);
                yield new EngineResult(st.finished(), st.winnerIndex());
            }
            case "clock" -> {
                ClockState st = ClockEngine.compute(game.getPlayers(), log);
                yield new EngineResult(st.finished(), st.winnerIndex());
            }
            default -> throw new UnsupportedOperationException("Engine not yet implemented for game type: " + game.getType());
        };
    }
}
