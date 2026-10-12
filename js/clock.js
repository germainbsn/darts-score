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
  var currentPlayer = ((game.startPlayer || 0) + Math.floor(log.length / 3)) % n;
  var dartInTurn = log.length % 3;
  var winnerIndex = null;
  for (var p = 0; p < n; p++) { if (hits[p] >= 21) { winnerIndex = p; break; } }
  return { hits: hits, darts: darts, currentPlayer: currentPlayer, dartInTurn: dartInTurn, winnerIndex: winnerIndex, finished: winnerIndex !== null };
}

// ---------- rendering ----------
// A real dartboard with the zone to hit lit in gold: the whole number when
// any hit counts, only the double or treble ring when those are required,
// and the outer bull / bullseye / both for the finish (per finishMode).
var CLOCK_RING = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
function clockArc(r1, r2, a1, a2) {
  function p(r, a) { return (r * Math.sin(a)).toFixed(2) + ' ' + (-r * Math.cos(a)).toFixed(2); }
  return 'M' + p(r2, a1) + ' A' + r2 + ' ' + r2 + ' 0 0 1 ' + p(r2, a2) + ' L' + p(r1, a2) + ' A' + r1 + ' ' + r1 + ' 0 0 0 ' + p(r1, a1) + 'Z';
}
function clockBoardSvg(game, target) {
  var seg = Math.PI * 2 / 20, mult = game.clockMultiplier || 'any', isFinish = target > 20, out = '';
  out += '<defs><filter id="clockGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  out += '<circle r="122" fill="var(--board)"/>';
  CLOCK_RING.forEach(function (n, i) {
    var a1 = i * seg - seg / 2, a2 = a1 + seg, dark = i % 2 === 0;
    var single = dark ? 'var(--board)' : 'var(--seg-light)', ring = dark ? 'var(--red)' : 'var(--green)';
    var isTarget = !isFinish && n === target;
    var cls = function (part) {
      if (isTarget && (mult === 'any' || (mult === 'double' && part === 'd') || (mult === 'triple' && part === 't'))) return ' class="lit"';
      return isTarget ? '' : ' class="dim"';
    };
    out += '<path d="' + clockArc(16, 57, a1, a2) + '" fill="' + single + '"' + cls('s') + '/>'
      + '<path d="' + clockArc(57, 63, a1, a2) + '" fill="' + ring + '"' + cls('t') + '/>'
      + '<path d="' + clockArc(63, 94, a1, a2) + '" fill="' + single + '"' + cls('s') + '/>'
      + '<path d="' + clockArc(94, 100, a1, a2) + '" fill="' + ring + '"' + cls('d') + '/>';
    var x = (112 * Math.sin(i * seg)).toFixed(1), y = (-112 * Math.cos(i * seg) + 5).toFixed(1);
    out += '<text class="board-num' + (isTarget ? ' t' : '') + '" x="' + x + '" y="' + y + '" text-anchor="middle">' + n + '</text>';
  });
  var outerLit = isFinish && game.finishMode !== 'bull', innerLit = isFinish && game.finishMode !== 'outer';
  out += '<circle r="16" fill="var(--green)" class="' + (outerLit ? 'lit' : 'dim') + '"/>'
    + '<circle r="6.4" fill="var(--red)" class="' + (innerLit ? 'lit' : 'dim') + '"/>';
  return '<svg class="clock-board" viewBox="-126 -126 252 252" role="img" aria-label="Cible : viser ' + clockTargetLabel(target, game) + '">' + out + '</svg>';
}
function clockPlayerTarget(game, st, pi) {
  return st.hits[pi] >= 21 ? '✓' : clockTargetLabel(clockTargetAt(game, st.hits[pi]), game);
}
// Tabs are built once per game and then only updated, so the thrower's tab
// slides into the slate instead of the whole row being redrawn.
var clockTabsKey = null;
function renderClock(game) {
  var st = computeClockState(game);
  els.clockPad.hidden = st.finished;
  var key = game.id + '|' + game.players.join('|');
  if (key !== clockTabsKey) {
    els.clockPlayers.innerHTML = game.players.map(function (name, pi) {
      return '<div class="clock-tab" data-pi="' + pi + '"><span class="clock-tab-name">' + escapeHtml(name) + '</span><b class="clock-tab-target"></b></div>';
    }).join('');
    clockTabsKey = key;
  }
  Array.prototype.forEach.call(els.clockPlayers.children, function (tab, pi) {
    tab.classList.toggle('cur', pi === st.currentPlayer && !st.finished);
    tab.classList.toggle('winner', st.winnerIndex === pi);
    tab.querySelector('.clock-tab-target').textContent = clockPlayerTarget(game, st, pi);
  });
  focusCurrentPlayerCard(els.clockPlayers, game.id, st.currentPlayer, st.finished);

  var cp = st.currentPlayer;
  var target = clockTargetAt(game, Math.min(st.hits[cp], 20));
  var label = clockTargetLabel(target, game);
  if (st.finished) {
    els.clockTurnLabel.innerHTML = '<small>Partie terminée</small>';
  } else {
    els.clockTurnLabel.innerHTML = '<small>' + escapeHtml(game.players[cp]) + ' vise</small><b>' + label + '</b>';
  }
  els.clockTargetBoard.innerHTML = clockBoardSvg(game, st.finished ? 0 : target);

  // stats of everyone: next target, hits out of 21, live success rate, darts
  var rows = game.players.map(function (name, pi) {
    var rate = st.darts[pi] ? Math.round(st.hits[pi] / st.darts[pi] * 100) : 0;
    return '<tr class="' + (pi === cp && !st.finished ? 'cur' : '') + '"><td>' + escapeHtml(name) + '</td><td class="aim">' + clockPlayerTarget(game, st, pi) + '</td>'
      + '<td>' + Math.min(st.hits[pi], 21) + '/21</td><td>' + rate + '&nbsp;%</td><td>' + st.darts[pi] + '</td></tr>';
  }).join('');
  els.clockStats.innerHTML = '<thead><tr><th>Joueur</th><th>Cible</th><th>Faits</th><th>Réussite</th><th>Flé</th></tr></thead><tbody>' + rows + '</tbody>';

  // Locked while the bot is mid-turn, same reasoning as Cricket's dart pad.
  var isBotTurn = botIndex(game) === cp;
  els.clockHitBtn.innerHTML = 'Touché <b>' + label + '</b>';
  els.clockHitBtn.disabled = st.finished || isBotTurn;
  var dartsLeftInTurn = 3 - st.dartInTurn;
  els.clockMissBtn.disabled = st.finished || isBotTurn;
  els.clockMiss2Btn.disabled = st.finished || isBotTurn || dartsLeftInTurn < 2;
  els.clockMiss3Btn.disabled = st.finished || isBotTurn || dartsLeftInTurn < 3;
  els.undoClockBtn.disabled = (game.log || []).length === 0 || isBotTurn;

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
