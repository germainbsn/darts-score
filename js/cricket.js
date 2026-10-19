"use strict";

// ---------- pure derivation ----------
function computeCricketState(game) {
  var n = game.players.length;
  var marks = game.players.map(function () { return [0, 0, 0, 0, 0, 0, 0]; });
  var scores = game.players.map(function () { return 0; });
  var log = game.log || [];
  log.forEach(function (t) {
    if (!t.number) return; // miss
    var idx = CRICKET_NUMS.indexOf(t.number);
    var cur = marks[t.player][idx];
    var add = t.mult;
    var newMarks = Math.min(3, cur + add);
    var used = newMarks - cur;
    var overflow = add - used;
    marks[t.player][idx] = newMarks;
    if (overflow > 0) {
      var allOthersClosed = true;
      for (var pi = 0; pi < n; pi++) {
        if (pi !== t.player && marks[pi][idx] < 3) { allOthersClosed = false; break; }
      }
      if (!allOthersClosed) { scores[t.player] += overflow * t.number; }
    }
  });
  var turnIndex = Math.floor(log.length / 3);
  var currentPlayer = ((game.startPlayer || 0) + turnIndex) % n;
  var dartInTurn = log.length % 3;
  var winnerIndex = null;
  for (var p = 0; p < n; p++) {
    var allClosed = marks[p].every(function (m) { return m === 3; });
    if (!allClosed) continue;
    var highest = true;
    for (var q = 0; q < n; q++) { if (q !== p && scores[q] > scores[p]) { highest = false; break; } }
    if (highest) { winnerIndex = p; break; }
  }
  return { marks: marks, scores: scores, currentPlayer: currentPlayer, dartInTurn: dartInTurn, winnerIndex: winnerIndex, finished: winnerIndex !== null };
}

// ---------- rendering ----------
function markSVG(n) {
  if (n <= 0) return '<svg class="mark" viewBox="0 0 24 24"></svg>';
  if (n === 1) return '<svg class="mark" viewBox="0 0 24 24"><line x1="7" y1="18" x2="17" y2="6"/></svg>';
  if (n === 2) return '<svg class="mark" viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
  return '<svg class="mark" viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/><circle cx="12" cy="12" r="9"/></svg>';
}

// The pub chalkboard: with 2 players the numbers sit in the middle, one
// player on each side (as on a real cricket board); with more, a numbers
// column then one column per player. Marks are chalk strokes, gold once the
// number is closed; a number closed by everyone is struck through.
function renderCricketSlate(game, st) {
  var stats = cricketDartStats(game);
  var order = game.players.length === 2 ? [0, 'N', 1] : ['N'].concat(game.players.map(function (_, i) { return i; }));
  var live = !st.finished;
  var lastTurns = cricketLastTurns(game);
  var html = '';
  order.forEach(function (c) {
    if (c === 'N') { html += '<div class="cs-head cs-num"></div>'; return; }
    var cls = (c === st.currentPlayer && live ? ' cur' : '') + (st.winnerIndex === c ? ' winner' : '');
    var last = '';
    for (var d = 0; d < 3; d++) {
      var t = lastTurns[c][d];
      last += t ? '<i class="' + (t.number ? 'm' + t.mult : 'miss') + '">' + cricketDartLabel(t) + '</i>' : '<i></i>';
    }
    html += '<div class="cs-head' + cls + '"><span class="cs-name">' + escapeHtml(game.players[c]) + '</span><b class="cs-score">' + st.scores[c] + '</b><span class="cs-last">' + last + '</span></div>';
  });
  CRICKET_NUMS.forEach(function (num, idx) {
    // closed by everyone: nobody can score on it any more
    var dead = st.marks.every(function (pm) { return pm[idx] >= 3; }) ? ' dead' : '';
    order.forEach(function (c) {
      if (c === 'N') { html += '<div class="cs-cell cs-num' + dead + (num === 25 ? ' bull' : '') + '">' + CRICKET_LABELS[num] + '</div>'; return; }
      var m = st.marks[c][idx];
      html += '<div class="cs-cell' + (c === st.currentPlayer && live ? ' cur' : '') + (m >= 3 ? ' closed' : '') + dead + '">' + markSVG(m) + '</div>';
    });
  });
  order.forEach(function (c) {
    if (c === 'N') { html += '<div class="cs-foot cs-num"></div>'; return; }
    var d = stats[c].darts, mpr = d ? (stats[c].marks / d * 3) : 0;
    html += '<div class="cs-foot' + (c === st.currentPlayer && live ? ' cur' : '') + '">' + d + ' flé · ' + mpr.toFixed(1) + ' mpr</div>';
  });
  els.cricketTable.classList.toggle('many', game.players.length > 2);
  els.cricketTable.style.gridTemplateColumns = order.map(function (c) { return c === 'N' ? '50px' : 'minmax(78px, 1fr)'; }).join(' ');
  els.cricketTable.innerHTML = html;
}

function renderCricket(game) {
  var st = computeCricketState(game);
  els.dartPad.hidden = st.finished;
  renderCricketSlate(game, st);

  // dart pad — also locked while the bot is mid-turn, so a stray human click
  // can't race the bot's own writes (it drives selectedMult/the log itself).
  var isBotTurn = botIndex(game) === st.currentPlayer;
  var padDisabled = st.finished || isBotTurn;
  var numHtml = CRICKET_NUMS.map(function (num, idx) {
    var isBull = num === 25;
    var disabled = padDisabled || (isBull && selectedMult === 3);
    // still tappable (a dart can land there), just shown struck like on the board
    var dead = st.marks.every(function (pm) { return pm[idx] >= 3; });
    return '<button type="button" class="num-btn' + (isBull ? ' bull' : '') + (dead ? ' dead' : '') + '" data-num="' + num + '" ' + (disabled ? 'disabled' : '') + '>' + CRICKET_LABELS[num] + '</button>';
  }).join('');
  els.numGrid.innerHTML = numHtml;
  els.missBtn.disabled = padDisabled;
  els.missTurnBtn.disabled = padDisabled;
  els.undoCricketBtn.disabled = (game.log || []).length === 0 || isBotTurn;

  Array.prototype.forEach.call(els.multChips.querySelectorAll('.chip'), function (c) {
    c.classList.toggle('active', parseInt(c.dataset.mult, 10) === selectedMult);
    c.disabled = padDisabled;
  });

  els.cricketTurnLabel.innerHTML = st.finished ? 'Partie terminée'
    : 'À <strong>' + escapeHtml(game.players[st.currentPlayer]) + '</strong> de jouer <span class="turn-dart">fléchette ' + (st.dartInTurn + 1) + '/3</span>';
  // one dot per dart of the current turn: green on a cricket number, red on a miss
  var turnDarts = st.dartInTurn ? (game.log || []).slice(-st.dartInTurn) : [];
  var dots = '';
  for (var d = 0; d < 3; d++) {
    var t = turnDarts[d];
    dots += '<span class="dart-dot' + (t ? (t.number ? ' hit' : ' miss') : '') + '"></span>';
  }
  els.dartDots.innerHTML = dots;

  renderThrowLogCricket(game, st);
  renderWinner(game, st.finished, st.winnerIndex);
}

// each player's most recent turn (the one in progress included), so the
// darts just entered can be checked on the board. Turns are always 3 log
// entries ("Tour raté" pads the rest with misses).
function cricketLastTurns(game) {
  var log = game.log || [];
  var last = game.players.map(function () { return []; });
  for (var i = 0; i < log.length; i += 3) { last[log[i].player] = log.slice(i, i + 3); }
  return last;
}
// short dart label: 20, D19, T18, B, DB, or – for a miss
function cricketDartLabel(t) {
  if (!t.number) return '–';
  if (t.number === 25) return t.mult === 2 ? 'DB' : 'B';
  return (t.mult === 2 ? 'D' : t.mult === 3 ? 'T' : '') + t.number;
}

// darts thrown & marks landed per player across the whole game — the basis
// for both the chalkboard's per-player footer and the Stats tab's aggregate MPR.
function cricketDartStats(game) {
  var darts = game.players.map(function () { return 0; });
  var marks = game.players.map(function () { return 0; });
  (game.log || []).forEach(function (t) {
    darts[t.player]++;
    if (t.number) marks[t.player] += t.mult;
  });
  return game.players.map(function (_, pi) { return { darts: darts[pi], marks: marks[pi] }; });
}

function renderThrowLogCricket(game, st) {
  var log = game.log || [];
  if (!log.length) { els.throwLog.innerHTML = '<p class="empty">Les fléchettes jouées apparaîtront ici.</p>'; return; }
  var html = '';
  log.slice(-30).forEach(function (t) {
    var who = game.players[t.player];
    var what = t.number ? (t.mult === 1 ? 'Simple ' : t.mult === 2 ? 'Double ' : 'Triple ') + CRICKET_LABELS[t.number] : 'Raté';
    html += '<div class="log-line"><span class="who">' + escapeHtml(who) + '</span><span class="what">' + what + '</span></div>';
  });
  els.throwLog.innerHTML = html;
}

// ---------- actions ----------
async function applyCricketDart(number) {
  if (!activeGame) return;
  var st = computeCricketState(activeGame);
  if (st.finished) return;
  playHit();
  var newLog = (activeGame.log || []).concat([{ player: st.currentPlayer, number: number, mult: selectedMult }]);
  var patched = Object.assign({}, activeGame, { log: newLog });
  var newSt = computeCricketState(patched);
  await Store.updateGame(activeGame.id, {
    log: newLog,
    status: newSt.finished ? 'finished' : 'in_progress',
    winnerIndex: newSt.winnerIndex,
    finishedAt: newSt.finished ? nowTs() : null
  });
}
// count: how many misses to log at once — omitted = 1, 'turn' = every dart
// left in the current turn (the "Tour raté" button).
async function applyCricketMiss(count) {
  if (!activeGame) return;
  var st = computeCricketState(activeGame);
  if (st.finished) return;
  var n = count === 'turn' ? 3 - st.dartInTurn : 1;
  playMiss();
  var misses = [];
  for (var i = 0; i < n; i++) { misses.push({ player: st.currentPlayer, number: 0, mult: 0 }); }
  var newLog = (activeGame.log || []).concat(misses);
  await Store.updateGame(activeGame.id, { log: newLog });
}
async function undoCricket() {
  if (!activeGame || !(activeGame.log || []).length) return;
  var newLog = activeGame.log.slice(0, -1);
  var patched = Object.assign({}, activeGame, { log: newLog });
  var st = computeCricketState(patched);
  await Store.updateGame(activeGame.id, {
    log: newLog, status: st.finished ? 'finished' : 'in_progress', winnerIndex: st.winnerIndex, finishedAt: st.finished ? nowTs() : null
  });
}

// ---------- events ----------
els.multChips.addEventListener('click', function (e) {
  var b = e.target.closest('.chip');
  if (!b) return;
  selectedMult = parseInt(b.dataset.mult, 10);
  if (activeGame && activeGame.type === 'cricket') renderCricket(activeGame);
});
els.numGrid.addEventListener('click', function (e) {
  var b = e.target.closest('.num-btn');
  if (!b || b.disabled) return;
  applyCricketDart(parseInt(b.dataset.num, 10)); // reads selectedMult before its first await
  resetCricketMult();
});
// Double/Triple only applies to the next dart, then the pad falls back to
// Simple. Only the human handlers call this — the bot drives selectedMult itself.
function resetCricketMult() {
  if (selectedMult === 1) return;
  selectedMult = 1;
  if (activeGame && activeGame.type === 'cricket') renderCricket(activeGame);
}
els.missBtn.addEventListener('click', function () { applyCricketMiss(); resetCricketMult(); });
els.missTurnBtn.addEventListener('click', function () { applyCricketMiss('turn'); resetCricketMult(); });
els.undoCricketBtn.addEventListener('click', undoCricket);
