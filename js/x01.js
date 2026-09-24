"use strict";

// ---------- pure derivation ----------
// Shared by 301/501 (count down from `variant`, bust on overshoot/bad double)
// and Score (count up from 0, no bust, `variant` holds the configured number
// of 3-dart rounds — best total after every player has thrown that many wins).
function computeX01State(game) {
  var n = game.players.length;
  var isScore = game.type === 'score';
  var start = isScore ? 0 : game.variant;
  var totals = game.players.map(function () { return start; });
  var log = game.log || [];
  var entries = [];
  log.forEach(function (t) {
    var p = t.player;
    var bust = false;
    var newTotal;
    if (isScore) {
      newTotal = totals[p] + t.attempted;
    } else {
      newTotal = totals[p] - t.attempted;
      if (newTotal < 0) bust = true;
      else if (game.doubleOut && newTotal === 1) bust = true;
      else if (game.doubleOut && newTotal === 0 && !t.confirmedDouble) bust = true;
    }
    if (!bust) { totals[p] = newTotal; }
    entries.push({ player: p, attempted: t.attempted, bust: bust, totalAfter: bust ? totals[p] : newTotal });
  });
  var currentPlayer = log.length % n;
  var winnerIndex = null, finished;
  if (isScore) {
    finished = log.length >= game.variant * n;
    if (finished) { winnerIndex = totals.indexOf(Math.max.apply(null, totals)); }
  } else {
    for (var p2 = 0; p2 < n; p2++) { if (totals[p2] === 0) { winnerIndex = p2; break; } }
    finished = winnerIndex !== null;
  }
  return { totals: totals, entries: entries, currentPlayer: currentPlayer, winnerIndex: winnerIndex, finished: finished };
}

// ---------- checkout suggestion (301/501 only) ----------
// Every value one dart can score, tried biggest-first so the search clears
// large numbers early like a real player would.
var CHECKOUT_MOVES = (function () {
  var moves = [];
  for (var n = 1; n <= 20; n++) { moves.push({ v: n, label: String(n), isDouble: false }); }
  for (var n = 1; n <= 20; n++) { moves.push({ v: n * 2, label: 'D' + n, isDouble: true }); }
  for (var n = 1; n <= 20; n++) { moves.push({ v: n * 3, label: 'T' + n, isDouble: false }); }
  moves.push({ v: 25, label: '25', isDouble: false });
  moves.push({ v: 50, label: 'B', isDouble: true });
  return moves;
})();

// Depth-first search for a sequence of `dartsLeft` darts summing exactly to
// `remaining`, whose last dart is a double (or Bull) when `doubleOut` is
// required. Not the fastest possible solver, but remaining is always small
// (<=170) and the search returns the first — biggest-dart-first — path it
// finds, which is what makes it match the classic "clear the big numbers
// first" checkout style.
function findCheckoutPath(remaining, dartsLeft, doubleOut) {
  if (dartsLeft === 0) return remaining === 0 ? [] : null;
  var candidates = CHECKOUT_MOVES.filter(function (m) { return m.v <= remaining; })
    .sort(function (a, b) { return b.v - a.v; });
  for (var i = 0; i < candidates.length; i++) {
    var m = candidates[i];
    var rest = remaining - m.v;
    if (dartsLeft === 1) {
      if (rest !== 0 || (doubleOut && !m.isDouble)) continue;
      return [m.label];
    }
    var sub = findCheckoutPath(rest, dartsLeft - 1, doubleOut);
    if (sub) return [m.label].concat(sub);
  }
  return null;
}
function suggestCheckout(remaining, doubleOut, maxDarts) {
  if (remaining <= 0 || remaining > 170) return null;
  for (var n = 1; n <= maxDarts; n++) {
    var path = findCheckoutPath(remaining, n, doubleOut);
    if (path) return path;
  }
  return null;
}
function checkoutHintText(remaining, doubleOut, maxDarts) {
  var path = suggestCheckout(remaining, doubleOut, maxDarts);
  if (!path) return null;
  return '🎯 ' + path.join(' ');
}

// darts thrown & points scored (non-bust) per player — the basis for both
// the card's compact stats line and the Stats tab's aggregate 3-dart average.
// Works for Score too: bust is always false there, so `scored` is simply the
// running total, and it's also how the Score high-score ranking reads a
// finished game's final totals.
function x01DartStats(game) {
  var st = computeX01State(game);
  var turns = game.players.map(function () { return 0; });
  var scored = game.players.map(function () { return 0; });
  st.entries.forEach(function (e) {
    turns[e.player]++;
    if (!e.bust) scored[e.player] += e.attempted;
  });
  return game.players.map(function (_, pi) { return { darts: turns[pi] * 3, turns: turns[pi], scored: scored[pi] }; });
}

// value of one dart: a plain number*multiplier, or 25/50 for single/double bull
// (no triple bull).
function dartValue(num, mult) {
  if (num === 25) return mult === 2 ? 50 : 25;
  return num * mult;
}
function sumDarts(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }

// ---------- rendering ----------
function renderX01(game) {
  var st = computeX01State(game);
  els.x01Pad.hidden = st.finished;
  var dstats = x01DartStats(game);
  var isScoreMode = game.type === 'score';
  // darts already tapped this turn (dart-by-dart mode) but not yet committed —
  // reflected live on the current player's card instead of waiting for
  // "Valider le tour". Always 0 in total-entry mode, since x01Darts stays empty.
  var pendingSum = (!st.finished && x01Darts.length) ? sumDarts(x01Darts) : 0;
  var html = '';
  game.players.forEach(function (name, pi) {
    var lastEntry = null;
    st.entries.forEach(function (e) { if (e.player === pi) lastEntry = e; });
    var turns = dstats[pi].turns;
    var avg = turns ? (dstats[pi].scored / turns) : 0;
    var shown = st.totals[pi];
    if (pi === st.currentPlayer && pendingSum) { shown = isScoreMode ? shown + pendingSum : shown - pendingSum; }
    html += '<div class="x01-card ' + (pi === st.currentPlayer && !st.finished ? 'cur' : '') + '">'
      + '<div class="name">' + escapeHtml(name) + '</div>'
      + '<div class="score-row">'
      + '<div class="remaining">' + shown + '</div>'
      + '<div class="stats"><div>' + dstats[pi].darts + ' flé</div><div>' + avg.toFixed(1) + ' moy/3</div></div>'
      + '</div>'
      + '<div class="sub">' + (lastEntry ? ('Dernier tour : ' + (lastEntry.bust ? 'raté (' + lastEntry.attempted + ')' : lastEntry.attempted)) : '—') + '</div>'
      + '</div>';
  });
  els.x01Players.innerHTML = html;
  focusCurrentPlayerCard(els.x01Players, game.id, st.currentPlayer, st.finished);

  if (game.type === 'x01' && !st.finished) {
    // same live adjustment, plus how many darts are left to suggest a
    // checkout with.
    var dartsLeftThisTurn = 3 - x01Darts.length;
    var effectiveRemaining = st.totals[st.currentPlayer] - pendingSum;
    var hint = checkoutHintText(effectiveRemaining, game.doubleOut, dartsLeftThisTurn);
    els.checkoutHint.hidden = !hint;
    if (hint) els.checkoutHint.textContent = hint;
  } else {
    els.checkoutHint.hidden = true;
  }

  Array.prototype.forEach.call(els.x01EntryModeSeg.querySelectorAll('button'), function (b) {
    b.classList.toggle('active', b.dataset.mode === x01EntryMode);
  });
  els.x01TotalMode.hidden = x01EntryMode !== 'total';
  els.x01DartMode.hidden = x01EntryMode !== 'darts';

  var keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'];
  els.x01Keypad.innerHTML = keys.map(function (k) { return '<button type="button" data-key="' + k + '">' + k + '</button>'; }).join('');

  els.x01Display.textContent = x01Input || '0';
  els.checkoutConfirm.hidden = true;
  // Locked while the bot is mid-turn — it drives x01Darts/x01Input itself,
  // programmatically, so this only ever blocks a stray human click.
  var isBotTurn = botIndex(game) === st.currentPlayer;
  els.x01Submit.disabled = st.finished || isBotTurn;
  Array.prototype.forEach.call(els.x01Pad.querySelectorAll('button'), function (b) {
    if (b === els.undoX01Btn) return;
    b.disabled = st.finished || isBotTurn;
  });
  els.undoX01Btn.disabled = (game.log || []).length === 0 || isBotTurn;

  // dart-by-dart pad: rendered last so its own per-button disabling (bull has
  // no triple, at most 3 darts a turn) isn't clobbered by the blanket toggle above
  Array.prototype.forEach.call(els.dartSlots.querySelectorAll('.dart-slot'), function (slot, i) {
    var v = x01Darts[i];
    if (v === undefined) { slot.textContent = ''; slot.className = 'dart-slot'; }
    else if (v === 0) { slot.textContent = '✕'; slot.className = 'dart-slot miss'; }
    else { slot.textContent = v; slot.className = 'dart-slot filled'; }
  });
  Array.prototype.forEach.call(els.x01MultChips.querySelectorAll('.chip'), function (c) {
    c.classList.toggle('active', parseInt(c.dataset.mult, 10) === selectedMult);
  });
  var dartGridHtml = X01_DART_NUMS.map(function (num) {
    var isBull = num === 25;
    var disabled = st.finished || isBotTurn || (isBull && selectedMult === 3) || x01Darts.length >= 3;
    return '<button type="button" class="x01-dart-btn" data-num="' + num + '" ' + (disabled ? 'disabled' : '') + '>' + (isBull ? 'Bull' : num) + '</button>';
  }).join('');
  // miss/undo ride along in the same grid as the number buttons — right after
  // Bull — so they land on Bull's row instead of a separate full-width row.
  var missDisabled = st.finished || isBotTurn || x01Darts.length >= 3;
  var undoDisabled = st.finished || isBotTurn || x01Darts.length === 0;
  dartGridHtml += '<button type="button" class="x01-dart-btn x01-dart-miss" id="x01DartMissBtn" title="Raté" ' + (missDisabled ? 'disabled' : '') + '>✕</button>';
  dartGridHtml += '<button type="button" class="x01-dart-btn x01-dart-undo" id="x01DartUndoBtn" title="Dernière fléchette" ' + (undoDisabled ? 'disabled' : '') + '>⌫</button>';
  els.x01DartGrid.innerHTML = dartGridHtml;

  renderThrowLogX01(game, st);
  renderWinner(game, st.finished, st.winnerIndex);
}

function renderThrowLogX01(game, st) {
  if (!st.entries.length) { els.throwLog.innerHTML = '<p class="empty">Les tours joués apparaîtront ici.</p>'; return; }
  var isScore = game.type === 'score';
  var html = '';
  st.entries.slice(-30).forEach(function (t) {
    var who = game.players[t.player];
    var what = t.bust ? ('Raté (tentative ' + t.attempted + ')') : (t.attempted + (isScore ? ' — total ' : ' — reste ') + t.totalAfter);
    html += '<div class="log-line' + (t.bust ? ' bust' : '') + '"><span class="who">' + escapeHtml(who) + '</span><span class="what">' + what + '</span></div>';
  });
  els.throwLog.innerHTML = html;
}

// ---------- actions ----------
async function submitX01Turn() {
  if (!activeGame) return;
  var st = computeX01State(activeGame);
  if (st.finished) return;
  var attempted = parseInt(x01Input || '0', 10);
  if (isNaN(attempted) || attempted < 0 || attempted > 180) return;
  var wouldRemain = st.totals[st.currentPlayer] - attempted;
  if (activeGame.doubleOut && wouldRemain === 0) {
    // Dart-by-dart mode already knows each dart's multiplier — the last one
    // thrown tells us straight away whether it was a double, no need to ask.
    // Total-entry mode only has the 3-dart sum, so that one still has to ask.
    if (x01Darts.length === 3) {
      await commitX01Turn(attempted, x01DartMult[x01DartMult.length - 1] === 2);
      return;
    }
    pendingAttempt = attempted;
    els.checkoutConfirm.hidden = false;
    return;
  }
  await commitX01Turn(attempted, false);
}
async function commitX01Turn(attempted, confirmedDouble) {
  var newLog = (activeGame.log || []).concat([{ player: computeX01State(activeGame).currentPlayer, attempted: attempted, confirmedDouble: !!confirmedDouble }]);
  var patched = Object.assign({}, activeGame, { log: newLog });
  var st = computeX01State(patched);
  var lastEntry = st.entries[st.entries.length - 1];
  if (lastEntry.bust) { playMiss(); speak('Raté'); } else { playHit(); speak(String(attempted)); }
  x01Input = '';
  x01Darts = [];
  x01DartMult = [];
  pendingAttempt = null;
  await Store.updateGame(activeGame.id, {
    log: newLog, status: st.finished ? 'finished' : 'in_progress', winnerIndex: st.winnerIndex, finishedAt: st.finished ? nowTs() : null
  });
}
async function undoX01() {
  if (!activeGame || !(activeGame.log || []).length) return;
  var newLog = activeGame.log.slice(0, -1);
  var patched = Object.assign({}, activeGame, { log: newLog });
  var st = computeX01State(patched);
  await Store.updateGame(activeGame.id, {
    log: newLog, status: st.finished ? 'finished' : 'in_progress', winnerIndex: st.winnerIndex, finishedAt: st.finished ? nowTs() : null
  });
}

// ---------- events ----------
els.x01EntryModeSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  x01EntryMode = b.dataset.mode;
  x01Input = '';
  x01Darts = [];
  x01DartMult = [];
  if (activeGame) renderX01(activeGame);
});
els.x01MultChips.addEventListener('click', function (e) {
  var b = e.target.closest('.chip');
  if (!b) return;
  selectedMult = parseInt(b.dataset.mult, 10);
  if (activeGame) renderX01(activeGame);
});
els.x01DartGrid.addEventListener('click', function (e) {
  var b = e.target.closest('.x01-dart-btn');
  if (!b || b.disabled) return;
  if (b.id === 'x01DartMissBtn') {
    if (x01Darts.length >= 3) return;
    playMiss();
    x01Darts.push(0);
    x01DartMult.push(0);
    x01Input = String(sumDarts(x01Darts));
    selectedMult = 1;
    if (activeGame) renderX01(activeGame);
    if (x01Darts.length === 3) submitX01Turn();
    return;
  }
  if (b.id === 'x01DartUndoBtn') {
    if (!x01Darts.length) return;
    x01Darts.pop();
    x01DartMult.pop();
    x01Input = x01Darts.length ? String(sumDarts(x01Darts)) : '';
    if (activeGame) renderX01(activeGame);
    return;
  }
  if (x01Darts.length >= 3) return;
  playHit();
  x01Darts.push(dartValue(parseInt(b.dataset.num, 10), selectedMult));
  x01DartMult.push(selectedMult);
  x01Input = String(sumDarts(x01Darts));
  selectedMult = 1; // back to Simple after every dart — Double/Triple is a one-shot pick, not a sticky mode
  if (activeGame) renderX01(activeGame);
  if (x01Darts.length === 3) submitX01Turn(); // 3rd dart: nothing left to enter, so validate the turn on its own
});

els.x01Keypad.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  var k = b.dataset.key;
  if (k === 'C') { x01Input = ''; }
  else if (k === '⌫') { x01Input = x01Input.slice(0, -1); }
  else {
    if (x01Input.length >= 3) return;
    var next = x01Input + k;
    if (parseInt(next, 10) > 180) return;
    x01Input = next;
  }
  els.x01Display.textContent = x01Input || '0';
});
els.x01Submit.addEventListener('click', submitX01Turn);
els.undoX01Btn.addEventListener('click', undoX01);
els.checkoutYes.addEventListener('click', function () { if (pendingAttempt != null) commitX01Turn(pendingAttempt, true); });
els.checkoutNo.addEventListener('click', function () { if (pendingAttempt != null) commitX01Turn(pendingAttempt, false); });
