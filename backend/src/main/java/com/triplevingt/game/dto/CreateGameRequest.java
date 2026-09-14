package com.triplevingt.game.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record CreateGameRequest(
        @NotBlank String type,
        Integer variant,
        Boolean doubleOut,
        String finishMode,
        String clockMultiplier,
        // "sequential" (default) or "random" — the server generates the actual
        // shuffled clockOrder itself rather than trusting a client-supplied one.
        String clockOrderMode,
        UUID matchId,
        Integer legsToWin,
        Integer setsToWin,
        @NotEmpty @Size(min = 1, max = 4) List<@NotBlank String> players
) {}
