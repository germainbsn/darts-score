package com.triplevingt.game;

import tools.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "game")
public class Game {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, length = 16)
    private String type;

    private Integer variant;

    @Column(name = "double_out", nullable = false)
    private boolean doubleOut;

    @Column(name = "finish_mode", length = 8)
    private String finishMode;

    @Column(name = "clock_multiplier", length = 8)
    private String clockMultiplier;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "clock_order")
    private List<Integer> clockOrder;

    @Column(name = "match_id")
    private UUID matchId;

    @Column(name = "legs_to_win")
    private Integer legsToWin;

    @Column(name = "sets_to_win")
    private Integer setsToWin;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<String> players;

    // Mode-dependent shape (per-dart for cricket/clock, per-turn for x01/score) —
    // kept generic here and parsed by the mode-specific engine, mirroring how
    // the original JS treats `log` as untyped until a mode function reads it.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private JsonNode log;

    @Column(nullable = false, length = 12)
    private String status;

    @Column(name = "winner_index")
    private Integer winnerIndex;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Integer getVariant() { return variant; }
    public void setVariant(Integer variant) { this.variant = variant; }

    public boolean isDoubleOut() { return doubleOut; }
    public void setDoubleOut(boolean doubleOut) { this.doubleOut = doubleOut; }

    public String getFinishMode() { return finishMode; }
    public void setFinishMode(String finishMode) { this.finishMode = finishMode; }

    public String getClockMultiplier() { return clockMultiplier; }
    public void setClockMultiplier(String clockMultiplier) { this.clockMultiplier = clockMultiplier; }

    public List<Integer> getClockOrder() { return clockOrder; }
    public void setClockOrder(List<Integer> clockOrder) { this.clockOrder = clockOrder; }

    public UUID getMatchId() { return matchId; }
    public void setMatchId(UUID matchId) { this.matchId = matchId; }

    public Integer getLegsToWin() { return legsToWin; }
    public void setLegsToWin(Integer legsToWin) { this.legsToWin = legsToWin; }

    public Integer getSetsToWin() { return setsToWin; }
    public void setSetsToWin(Integer setsToWin) { this.setsToWin = setsToWin; }

    public List<String> getPlayers() { return players; }
    public void setPlayers(List<String> players) { this.players = players; }

    public JsonNode getLog() { return log; }
    public void setLog(JsonNode log) { this.log = log; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getWinnerIndex() { return winnerIndex; }
    public void setWinnerIndex(Integer winnerIndex) { this.winnerIndex = winnerIndex; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant finishedAt) { this.finishedAt = finishedAt; }
}
