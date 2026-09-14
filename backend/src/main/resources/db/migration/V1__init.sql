CREATE TABLE game (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type              VARCHAR(16)  NOT NULL CHECK (type IN ('cricket', 'x01', 'score', 'clock')),
    variant           INTEGER NULL,
    double_out        BOOLEAN NOT NULL DEFAULT false,
    finish_mode       VARCHAR(8) NULL CHECK (finish_mode IN ('outer', 'bull', 'any')),
    clock_multiplier  VARCHAR(8) NULL CHECK (clock_multiplier IN ('any', 'double', 'triple')),
    clock_order       JSONB NULL,
    match_id          UUID NULL,
    legs_to_win       INTEGER NULL,
    sets_to_win       INTEGER NULL,
    players           JSONB NOT NULL,
    log               JSONB NOT NULL DEFAULT '[]'::jsonb,
    status            VARCHAR(12) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'finished', 'abandoned')),
    winner_index      INTEGER NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at       TIMESTAMPTZ NULL
);

CREATE INDEX idx_game_status ON game (status);
CREATE INDEX idx_game_match_id ON game (match_id) WHERE match_id IS NOT NULL;
CREATE INDEX idx_game_type_status_finished ON game (type, status, finished_at);
CREATE INDEX idx_game_players_gin ON game USING GIN (players jsonb_path_ops);
