package com.triplevingt.game.dto;

import tools.jackson.databind.JsonNode;
import com.triplevingt.game.Game;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record GameResponse(
        UUID id,
        String type,
        Integer variant,
        boolean doubleOut,
        String finishMode,
        String clockMultiplier,
        List<Integer> clockOrder,
        UUID matchId,
        Integer legsToWin,
        Integer setsToWin,
        List<String> players,
        JsonNode log,
        String status,
        Integer winnerIndex,
        Instant createdAt,
        Instant finishedAt
) {
    public static GameResponse from(Game g) {
        return new GameResponse(
                g.getId(), g.getType(), g.getVariant(), g.isDoubleOut(), g.getFinishMode(),
                g.getClockMultiplier(), g.getClockOrder(), g.getMatchId(), g.getLegsToWin(), g.getSetsToWin(),
                g.getPlayers(), g.getLog(), g.getStatus(), g.getWinnerIndex(), g.getCreatedAt(), g.getFinishedAt()
        );
    }
}
