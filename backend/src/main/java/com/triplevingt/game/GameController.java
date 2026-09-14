package com.triplevingt.game;

import com.triplevingt.game.dto.CreateGameRequest;
import com.triplevingt.game.dto.GameResponse;
import com.triplevingt.game.dto.UpdateLogRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games")
public class GameController {

    private final GameService service;

    public GameController(GameService service) {
        this.service = service;
    }

    @PostMapping
    public GameResponse create(@Valid @RequestBody CreateGameRequest req) {
        return GameResponse.from(service.create(req));
    }

    @GetMapping("/{id}")
    public GameResponse get(@PathVariable UUID id) {
        return GameResponse.from(service.get(id));
    }

    @GetMapping
    public List<GameResponse> list(@RequestParam(required = false) String status) {
        return service.list(status).stream().map(GameResponse::from).toList();
    }

    @PatchMapping("/{id}")
    public GameResponse updateLog(@PathVariable UUID id, @Valid @RequestBody UpdateLogRequest req) {
        return GameResponse.from(service.updateLog(id, req.log()));
    }

    @PostMapping("/{id}/abandon")
    public GameResponse abandon(@PathVariable UUID id) {
        return GameResponse.from(service.abandon(id));
    }
}
