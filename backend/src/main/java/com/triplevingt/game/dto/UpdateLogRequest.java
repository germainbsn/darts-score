package com.triplevingt.game.dto;

import tools.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;

public record UpdateLogRequest(@NotNull JsonNode log) {}
