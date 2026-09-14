package com.triplevingt.game;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.triplevingt.game.dto.CreateGameRequest;
import com.triplevingt.game.engine.EngineResult;
import com.triplevingt.game.engine.GameEngineDispatcher;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class GameService {

    private final GameRepository repository;
    private final ObjectMapper objectMapper;

    public GameService(GameRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public Game create(CreateGameRequest req) {
        Game g = new Game();
        g.setType(req.type());
        g.setVariant(req.variant());
        g.setDoubleOut(Boolean.TRUE.equals(req.doubleOut()));
        g.setFinishMode(req.finishMode());
        g.setClockMultiplier(req.clockMultiplier());
        g.setClockOrder(buildClockOrder(req));
        g.setMatchId(req.matchId());
        g.setLegsToWin(req.legsToWin());
        g.setSetsToWin(req.setsToWin());
        g.setPlayers(req.players());
        g.setLog(objectMapper.createArrayNode());
        g.setStatus("in_progress");
        g.setCreatedAt(Instant.now());
        return repository.save(g);
    }

    // One shuffled sequence of all 21 targets (1-20 plus a 21st "finish" slot
    // for the bull), generated server-side so a client can't hand us a
    // pre-arranged "random" order. Sequential mode stores no order at all.
    private List<Integer> buildClockOrder(CreateGameRequest req) {
        if (!"clock".equals(req.type()) || !"random".equals(req.clockOrderMode())) return null;
        List<Integer> order = new ArrayList<>();
        for (int i = 1; i <= 21; i++) order.add(i);
        Collections.shuffle(order);
        return order;
    }

    public Game get(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Game not found: " + id));
    }

    public List<Game> list(String status) {
        return status == null
                ? repository.findAll()
                : repository.findByStatusOrderByCreatedAtDesc(status);
    }

    public Page<Game> history(Pageable pageable) {
        return repository.findByStatusOrderByFinishedAtDesc("finished", pageable);
    }

    // The client sends only the new `log`; status/winnerIndex/finishedAt are
    // always server-derived from replaying it, never trusted from the client.
    public Game updateLog(UUID id, JsonNode log) {
        Game g = get(id);
        g.setLog(log);
        EngineResult result = GameEngineDispatcher.compute(g, log);
        g.setStatus(result.finished() ? "finished" : "in_progress");
        g.setWinnerIndex(result.winnerIndex());
        g.setFinishedAt(result.finished() ? Instant.now() : null);
        return repository.save(g);
    }

    public Game abandon(UUID id) {
        Game g = get(id);
        g.setStatus("abandoned");
        g.setFinishedAt(Instant.now());
        return repository.save(g);
    }
}
