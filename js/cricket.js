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
  var currentPlayer = turnIndex % n;
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
  if (n === 1) return '<svg class="mark" viewBox="0 0 24 24"><line x1="6" y1="18" x2="18" y2="6"/></svg>';
  if (n === 2) return '<svg class="mark" viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
  return '<svg class="mark" viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/><circle cx="12" cy="12" r="9"/></svg>';
}

function renderCricket(game) {
  var st = computeCricketState(game);
  els.dartPad.hidden = st.finished;
  var html = '<thead><tr><th>Cible</th>';
  game.players.forEach(function (name, i) {
    html += '<th class="' + (i === st.currentPlayer && !st.finished ? 'cur-col' : '') + '">' + escapeHtml(name) + '</th>';
  });
  html += '</tr></thead><tbody>';
  CRICKET_NUMS.forEach(function (num, idx) {
    var colorClass = idx % 2 === 0 ? 'c-red' : 'c-green';
    if (num === 25) colorClass = 'c-red';
    html += '<tr><th><span class="num-chip ' + colorClass + '">' + CRICKET_LABELS[num] + '</span></th>';
    game.players.forEach(function (name, pi) {
      var m = st.marks[pi][idx];
      var cls = 'mark-cell' + (m >= 3 ? ' closed' : '') + (pi === st.currentPlayer && !st.finished ? ' cur' : '');
      html += '<td class="' + cls + '">' + markSVG(m) + '</td>';
    });
    html += '</tr>';
  });
  html += '<tr class="score-row"><th>Score</th>';
  game.players.forEach(function (name, pi) {
    html += '<td class="' + (st.winnerIndex === pi ? 'winner' : '') + '">' + st.scores[pi] + '</td>';
  });
  html += '</tr>';
  html += statsRowHtml(game);
  html += '</tbody>';
  els.cricketTable.innerHTML = html;

  // dart pad — also locked while the bot is mid-turn, so a stray human click
  // can't race the bot's own writes (it drives selectedMult/the log itself).
  var isBotTurn = botIndex(game) === st.currentPlayer;
  var padDisabled = st.finished || isBotTurn;
  var numHtml = CRICKET_NUMS.map(function (num) {
    var isBull = num === 25;
    var disabled = padDisabled || (isBull && selectedMult === 3);
    return '<button type="button" class="num-btn" data-num="' + num + '" ' + (disabled ? 'disabled' : '') + '>' + CRICKET_LABELS[num] + '</button>';
  }).join('');
  els.numGrid.innerHTML = numHtml;
  els.missBtn.disabled = padDisabled;
  els.undoCricketBtn.disabled = (game.log || []).length === 0 || isBotTurn;

  Array.prototype.forEach.call(els.multChips.querySelectorAll('.chip'), function (c) {
    c.classList.toggle('active', parseInt(c.dataset.mult, 10) === selectedMult);
    c.disabled = padDisabled;
  });

  els.cricketTurnLabel.textContent = st.finished ? 'Partie terminée' : (game.players[st.currentPlayer] + ' — fléchette ' + (st.dartInTurn + 1) + '/3');
  var dots = '';
  for (var d = 0; d < 3; d++) { dots += '<span class="dart-dot' + (d < st.dartInTurn ? ' filled' : '') + '"></span>'; }
  els.dartDots.innerHTML = dots;

  renderThrowLogCricket(game, st);
  renderWinner(game, st.finished, st.winnerIndex);
}

// darts thrown & marks landed per player across the whole game — the basis
// for both the compact in-game stats row and the Stats tab's aggregate MPR.
function cricketDartStats(game) {
  var darts = game.players.map(function () { return 0; });
  var marks = game.players.map(function () { return 0; });
  (game.log || []).forEach(function (t) {
    darts[t.player]++;
    if (t.number) marks[t.player] += t.mult;
  });
  return game.players.map(function (_, pi) { return { darts: darts[pi], marks: marks[pi] }; });
}

// darts thrown & marks-per-3-darts (MPR) per player, kept to one compact row
function statsRowHtml(game) {
  var stats = cricketDartStats(game);
  var html = '<tr class="stats-row"><th>Stats</th>';
  game.players.forEach(function (name, pi) {
    var d = stats[pi].darts;
    var mpr = d ? (stats[pi].marks / d * 3) : 0;
    html += '<td>' + d + ' flé · ' + mpr.toFixed(1) + ' mpr</td>';
  });
  html += '</tr>';
  return html;
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
async function applyCricketMiss() {
  if (!activeGame) return;
  var st = computeCricketState(activeGame);
  if (st.finished) return;
  playMiss();
  var newLog = (activeGame.log || []).concat([{ player: st.currentPlayer, number: 0, mult: 0 }]);
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
  applyCricketDart(parseInt(b.dataset.num, 10));
});
els.missBtn.addEventListener('click', applyCricketMiss);
els.undoCricketBtn.addEventListener('click', undoCricket);
