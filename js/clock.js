"use strict";

// ---------- pure derivation ----------
// One shared dart-by-dart log like Cricket: each entry is just {player, hit}.
// A player's progress is fully derivable from how many of their darts hit —
// 1..20 in order, then the finishing bull (25, 50, or either per finishMode).
function finishLabel(mode) {
  if (mode === 'outer') return '25';
  if (mode === 'bull') return '50';
  return '25/50';
}
// 1-20 targets can require the double or the triple instead of any hit (a
// classic "Round the Clock" variant); the finish (25/50) has no triple and is
// already effectively a double at 50, so clockMultiplier never touches it.
function clockTargetLabel(num, game) {
  if (num > 20) return finishLabel(game.finishMode);
  var prefix = game.clockMultiplier === 'double' ? 'D' : game.clockMultiplier === 'triple' ? 'T' : '';
  return prefix + num;
}
// The target for the `index`-th dart a player still needs (0-based: index 0
// is their very first dart). Sequential mode (no clockOrder stored) is just
// index+1, 1-20 then 21 for the finish. Random mode looks up the shuffled
// draw stored on the game at creation, so every player follows that same
// draw and the finish bull can land anywhere in it, not only at the end.
function clockTargetAt(game, index) {
  if (game.clockOrder && game.clockOrder.length) return game.clockOrder[index];
  return index + 1;
}

function computeClockState(game) {
  var n = game.players.length;
  var hits = game.players.map(function () { return 0; });
  var darts = game.players.map(function () { return 0; });
  var log = game.log || [];
  log.forEach(function (t) {
    darts[t.player]++;
    if (t.hit) hits[t.player]++;
  });
  var currentPlayer = Math.floor(log.length / 3) % n;
  var dartInTurn = log.length % 3;
  var winnerIndex = null;
  for (var p = 0; p < n; p++) { if (hits[p] >= 21) { winnerIndex = p; break; } }
  return { hits: hits, darts: darts, currentPlayer: currentPlayer, dartInTurn: dartInTurn, winnerIndex: winnerIndex, finished: winnerIndex !== null };
}

// ---------- rendering ----------
function renderClock(game) {
  var st = computeClockState(game);
  els.clockPad.hidden = st.finished;
  var html = '';
  game.players.forEach(function (name, pi) {
    var label = st.hits[pi] >= 21 ? '✓' : clockTargetLabel(clockTargetAt(game, st.hits[pi]), game);
    // live-only success rate (hits / darts thrown) — not tracked in Stats/Classement
    var rate = st.darts[pi] ? (st.hits[pi] / st.darts[pi] * 100) : 0;
    html += '<div class="x01-card ' + (pi === st.currentPlayer && !st.finished ? 'cur' : '') + '">'
      + '<div class="name">' + escapeHtml(name) + '</div>'
      + '<div class="score-row">'
      + '<div class="remaining' + (label.length > 3 ? ' tight' : '') + '">' + label + '</div>'
      + '<div class="stats"><div>' + st.darts[pi] + ' flé</div><div>' + rate.toFixed(2) + ' %</div></div>'
      + '</div>'
      + '</div>';
  });
  els.clockPlayers.innerHTML = html;
  focusCurrentPlayerCard(els.clockPlayers, game.id, st.currentPlayer, st.finished);

  var label = clockTargetLabel(clockTargetAt(game, st.hits[st.currentPlayer]), game);
  els.clockHitBtn.textContent = label;
  els.clockHitBtn.classList.toggle('tight', label.length > 3);
  els.clockHitBtn.disabled = st.finished;
  var dartsLeftInTurn = 3 - st.dartInTurn;
  els.clockMissBtn.disabled = st.finished;
  els.clockMiss2Btn.disabled = st.finished || dartsLeftInTurn < 2;
  els.clockMiss3Btn.disabled = st.finished || dartsLeftInTurn < 3;
  els.undoClockBtn.disabled = (game.log || []).length === 0;

  els.clockTurnLabel.textContent = st.finished
    ? 'Partie terminée'
    : (game.players[st.currentPlayer] + ' — fléchette ' + (st.dartInTurn + 1) + '/3 — cible : ' + label);
  // this turn's already-thrown darts are simply the last dartInTurn log
  // entries (one shared sequential log, 3 per player like Cricket) — color
  // each dot by whether that dart actually hit or missed.
  var turnEntries = st.dartInTurn > 0 ? (game.log || []).slice(-st.dartInTurn) : [];
  var dots = '';
  for (var d = 0; d < 3; d++) {
    var e = turnEntries[d];
    dots += '<span class="dart-dot' + (e ? (e.hit ? ' hit' : ' miss') : '') + '"></span>';
  }
  els.clockDartDots.innerHTML = dots;

  renderThrowLogClock(game, st);
  renderWinner(game, st.finished, st.winnerIndex);
}

function renderThrowLogClock(game) {
  var log = game.log || [];
  if (!log.length) { els.throwLog.innerHTML = '<p class="empty">Les fléchettes jouées apparaîtront ici.</p>'; return; }
  var progress = game.players.map(function () { return 0; });
  var entries = log.map(function (t) {
    var target = clockTargetAt(game, progress[t.player]);
    if (t.hit) progress[t.player]++;
    return { player: t.player, hit: t.hit, target: target };
  });
  var html = '';
  entries.slice(-30).forEach(function (e) {
    var who = game.players[e.player];
    var label = clockTargetLabel(e.target, game);
    var what = (e.hit ? 'Touché ' : 'Raté ') + label;
    html += '<div class="log-line' + (!e.hit ? ' bust' : '') + '"><span class="who">' + escapeHtml(who) + '</span><span class="what">' + what + '</span></div>';
  });
  els.throwLog.innerHTML = html;
}

// ---------- actions ----------
async function applyClockHit() {
  if (!activeGame) return;
  var st = computeClockState(activeGame);
  if (st.finished) return;
  playHit();
  var newLog = (activeGame.log || []).concat([{ player: st.currentPlayer, hit: true }]);
  var patched = Object.assign({}, activeGame, { log: newLog });
  var newSt = computeClockState(patched);
  await Store.updateGame(activeGame.id, {
    log: newLog,
    status: newSt.finished ? 'finished' : 'in_progress',
    winnerIndex: newSt.winnerIndex,
    finishedAt: newSt.finished ? nowTs() : null
  });
}
// count is 1/2/3 misses logged at once (the ✕ / ✕✕ / ✕✕✕ buttons) — always
// the current player's own darts, since a render never enables a shortcut
// for more darts than they have left in this turn.
async function applyClockMiss(count) {
  if (!activeGame) return;
  var st = computeClockState(activeGame);
  if (st.finished || count > 3 - st.dartInTurn) return;
  playMiss();
  var misses = [];
  for (var i = 0; i < count; i++) { misses.push({ player: st.currentPlayer, hit: false }); }
  var newLog = (activeGame.log || []).concat(misses);
  await Store.updateGame(activeGame.id, { log: newLog });
}
async function undoClock() {
  if (!activeGame || !(activeGame.log || []).length) return;
  var newLog = activeGame.log.slice(0, -1);
  var patched = Object.assign({}, activeGame, { log: newLog });
  var st = computeClockState(patched);
  await Store.updateGame(activeGame.id, {
    log: newLog, status: st.finished ? 'finished' : 'in_progress', winnerIndex: st.winnerIndex, finishedAt: st.finished ? nowTs() : null
  });
}

// ---------- events ----------
els.clockHitBtn.addEventListener('click', applyClockHit);
els.clockMissBtn.addEventListener('click', function () { applyClockMiss(1); });
els.clockMiss2Btn.addEventListener('click', function () { applyClockMiss(2); });
els.clockMiss3Btn.addEventListener('click', function () { applyClockMiss(3); });
els.undoClockBtn.addEventListener('click', undoClock);
