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
    entries.push({ player: p, attempted: t.attempted, darts: t.darts, bust: bust, totalAfter: bust ? totals[p] : newTotal });
  });
  var currentPlayer = ((game.startPlayer || 0) + log.length) % n;
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

// darts thrown & points scored (non-bust) per player — the basis for both
// the card's compact stats line and the Stats tab's aggregate 3-dart average.
// Every turn counts 3 darts, except a winning checkout entered dart by dart,
// which records how many darts it actually took (`darts` on the log entry).
// Works for Score too: bust is always false there, so `scored` is simply the
// running total, and it's also how the Score high-score ranking reads a
// finished game's final totals.
function x01DartStats(game) {
  var st = computeX01State(game);
  var turns = game.players.map(function () { return 0; });
  var darts = game.players.map(function () { return 0; });
  var scored = game.players.map(function () { return 0; });
  st.entries.forEach(function (e) {
    turns[e.player]++;
    darts[e.player] += x01EntryDarts(game, e);
    if (!e.bust) scored[e.player] += e.attempted;
  });
  return game.players.map(function (_, pi) { return { darts: darts[pi], turns: turns[pi], scored: scored[pi] }; });
}
// darts one computeX01State entry counts for: 3, or fewer for a winning
// checkout entered dart by dart
function x01EntryDarts(game, e) {
  var checkout = game.type === 'x01' && !e.bust && e.totalAfter === 0;
  return (checkout && e.darts >= 1 && e.darts <= 3) ? e.darts : 3;
}
// 3-dart average from x01DartStats-style totals: points per dart, times 3
function x01Avg3(scored, darts) {
  return darts ? (scored / darts * 3) : 0;
}

// value of one dart: a plain number*multiplier, or 25/50 for single/double bull
// (no triple bull).
function dartValue(num, mult) {
  if (num === 25) return mult === 2 ? 50 : 25;
  return num * mult;
}
function sumDarts(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }
// true once the darts tapped so far end the turn early in 301/501: exactly 0
// (game over), or a bust — past 0, or 1 left in double-out, where no dart can finish
function dartEndsTurn() {
  if (!activeGame || activeGame.type !== 'x01') return false;
  var st = computeX01State(activeGame);
  if (st.finished) return false;
  var left = st.totals[st.currentPlayer] - sumDarts(x01Darts);
  return left <= 0 || (activeGame.doubleOut && left === 1);
}

// ---------- rendering ----------
// "+52" floating up from a player's score when a turn is committed (anyone's:
// a click here, the bot, or another device through the snapshot). Detected
// as the log growing by exactly one entry since the last render of this same
// game, so opening or resuming a game, and undo, play nothing. The bubble
// lives on #x01Board, outside the rows, so a row resizing can't cut it short.
var x01FxSeen = { id: null, len: 0 };
function playX01ScoreFx(game, st) {
  var len = (game.log || []).length;
  var grew = x01FxSeen.id === game.id && len === x01FxSeen.len + 1;
  x01FxSeen = { id: game.id, len: len };
  if (!grew) return;
  var e = st.entries[st.entries.length - 1];
  var num = els.x01Players.querySelector('[data-pi="' + e.player + '"] .ring-num');
  if (!num) return;
  // position from offsetLeft/Top summed up to #x01Board: unlike
  // getBoundingClientRect, they ignore transforms mid-animation
  var x = 0, y = 0;
  for (var el = num; el && el !== els.x01Board; el = el.offsetParent) { x += el.offsetLeft; y += el.offsetTop; }
  var fx = document.createElement('span');
  fx.className = 'score-fx' + (e.bust ? ' bust' : '');
  fx.textContent = e.bust ? 'BUST' : '+' + e.attempted;
  fx.style.left = x + 'px';
  fx.style.top = (y - 10) + 'px';
  els.x01Board.appendChild(fx);
  setTimeout(function () { fx.remove(); }, 1400);
}

// Player rows: a ring per player that empties from the start score down to 0
// (in Score mode it fills with the rounds played instead). Rows keep the turn
// order; the thrower's row opens up. Built once per game and then only
// updated, so the opening, the ring and the numbers animate between renders.
var RING_C = 2 * Math.PI * 44;
var x01RingsKey = null;
function buildX01Rings(game) {
  var circle = function (cls) {
    return '<circle class="' + cls + '" cx="50" cy="50" r="44" stroke-dasharray="' + RING_C.toFixed(2) + '" transform="rotate(-90 50 50)"/>';
  };
  els.x01Players.innerHTML = game.players.map(function (name, pi) {
    return '<div class="ring-row" data-pi="' + pi + '">'
      + '<div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-track" cx="50" cy="50" r="44"/>' + circle('ring-preview') + circle('ring-arc') + '</svg>'
      + '<span class="ring-num"></span></div>'
      + '<div class="ring-info"><div class="ring-name"><b>' + escapeHtml(name) + '</b><span class="ring-avg"></span></div>'
      + '<div class="ring-more"><span class="ring-stat"></span><span class="ring-last"></span></div></div></div>';
  }).join('');
}
function updateX01Rings(game, st, pendingSum, dstats) {
  var key = game.id + '|' + game.players.join('|');
  if (key !== x01RingsKey) { buildX01Rings(game); x01RingsKey = key; }
  var isScore = game.type === 'score';
  Array.prototype.forEach.call(els.x01Players.children, function (row, pi) {
    var cur = pi === st.currentPlayer && !st.finished;
    var total = st.totals[pi], pend = cur ? pendingSum : 0;
    var shown = isScore ? total + pend : Math.max(0, total - pend);
    var turns = st.entries.filter(function (e) { return e.player === pi; });
    var frac, fracBefore;
    if (isScore) { frac = fracBefore = Math.min(1, turns.length / game.variant); }
    else { frac = shown / game.variant; fracBefore = total / game.variant; }
    row.classList.toggle('cur', cur);
    row.classList.toggle('winner', st.winnerIndex === pi);
    row.querySelector('.ring-arc').setAttribute('stroke-dashoffset', (RING_C * (1 - frac)).toFixed(2));
    row.querySelector('.ring-preview').setAttribute('stroke-dashoffset', (RING_C * (1 - fracBefore)).toFixed(2));
    row.querySelector('.ring-num').textContent = shown;
    var avg = x01Avg3(dstats[pi].scored, dstats[pi].darts).toFixed(1);
    row.querySelector('.ring-avg').textContent = 'moy ' + avg;
    row.querySelector('.ring-stat').textContent = dstats[pi].darts + ' fléchettes · moy ' + avg;
    row.querySelector('.ring-last').innerHTML = turns.slice(-3).map(function (e) {
      return '<i class="' + (e.bust ? 'bust' : '') + '">' + e.attempted + '</i>';
    }).join('');
  });
}
// label of one entered dart, from its value and multiplier (0 = miss)
function dartLabel(value, mult) {
  if (mult === 0) return 'Raté';
  if (value === 50 && mult === 2) return 'Bull';
  if (value === 25 && mult === 1) return '25';
  return (mult === 3 ? 'T' : mult === 2 ? 'D' : '') + (value / mult);
}
// this turn's 3 darts; the empty ones show the suggested finish for what's left
function renderX01Slots(game, st, pendingSum) {
  els.x01Slots.hidden = st.finished;
  if (st.finished) return;
  var left = st.totals[st.currentPlayer] - pendingSum;
  var path = game.type === 'x01' ? suggestCheckout(left, game.doubleOut, 3 - x01Darts.length) : null;
  var html = '';
  for (var i = 0; i < 3; i++) {
    if (x01Darts[i] !== undefined) {
      html += '<span class="x01-slot ' + (x01DartMult[i] === 0 ? 'miss' : 'done') + '">' + dartLabel(x01Darts[i], x01DartMult[i]) + '</span>';
    } else {
      var hint = path ? path[i - x01Darts.length] : null;
      html += '<span class="x01-slot' + (hint ? ' hint' : '') + '">' + (hint ? (hint === 'B' ? 'Bull' : hint) : '·') + '</span>';
    }
  }
  els.x01Slots.innerHTML = html;
}
function renderX01(game) {
  var st = computeX01State(game);
  els.x01Pad.hidden = st.finished;
  var dstats = x01DartStats(game);
  // darts already tapped this turn (dart-by-dart mode), or the total being
  // typed (total mode), previewed live on the thrower's ring before "Valider"
  var pendingSum = (!st.finished && x01Darts.length) ? sumDarts(x01Darts) : 0;
  var typed = (!st.finished && x01EntryMode === 'total' && x01Input) ? parseInt(x01Input, 10) : 0;
  updateX01Rings(game, st, pendingSum || typed, dstats);
  // switchable mid-game (301/501 only) for when it was set wrong at launch
  els.x01OutSeg.hidden = game.type !== 'x01' || st.finished;
  Array.prototype.forEach.call(els.x01OutSeg.querySelectorAll('button'), function (b) {
    b.classList.toggle('active', (b.dataset.double === '1') === !!game.doubleOut);
    b.disabled = botIndex(game) === st.currentPlayer;
  });
  playX01ScoreFx(game, st);
  renderX01Slots(game, st, pendingSum);

  Array.prototype.forEach.call(els.x01EntryModeSeg.querySelectorAll('button'), function (b) {
    b.classList.toggle('active', b.dataset.mode === x01EntryMode);
  });
  els.x01TotalMode.hidden = x01EntryMode !== 'total';
  els.x01DartMode.hidden = x01EntryMode !== 'darts';

  var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'ok'];
  els.x01Keypad.innerHTML = keys.map(function (k) {
    if (k === '⌫') return '<button type="button" class="soft" data-key="⌫" aria-label="Effacer"><svg class="ui-icon" viewBox="0 0 24 24"><path d="M9 6h11v12H9l-6-6z"/><path d="M13 10l4 4M17 10l-4 4"/></svg></button>';
    if (k === 'ok') return '<button type="button" class="ok" data-key="ok" aria-label="Valider le tour"><svg class="ui-icon" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>';
    return '<button type="button" data-key="' + k + '">' + k + '</button>';
  }).join('');
  renderX01Display();
  els.checkoutConfirm.hidden = true;
  // Locked while the bot is mid-turn — it drives x01Darts/x01Input itself,
  // programmatically, so this only ever blocks a stray human click.
  var isBotTurn = botIndex(game) === st.currentPlayer;
  Array.prototype.forEach.call(els.x01Pad.querySelectorAll('button'), function (b) {
    if (b === els.undoX01Btn) return;
    b.disabled = st.finished || isBotTurn;
  });
  els.undoX01Btn.disabled = (game.log || []).length === 0 || isBotTurn;

  // dart-by-dart pad: set last so its own per-button disabling (bull has no
  // triple, at most 3 darts a turn) isn't clobbered by the blanket toggle above
  Array.prototype.forEach.call(els.x01MultChips.querySelectorAll('.chip'), function (c) {
    c.classList.toggle('active', parseInt(c.dataset.mult, 10) === selectedMult);
  });
  els.x01DartGrid.innerHTML = X01_DART_NUMS.map(function (num) {
    var isBull = num === 25;
    var disabled = st.finished || isBotTurn || (isBull && selectedMult === 3) || x01Darts.length >= 3;
    return '<button type="button" class="x01-dart-btn' + (isBull ? ' bull' : '') + '" data-num="' + num + '" ' + (disabled ? 'disabled' : '') + '>' + (isBull ? 'Bull' : num) + '</button>';
  }).join('');
  els.x01DartMissBtn.disabled = st.finished || isBotTurn || x01Darts.length >= 3;
  els.x01DartUndoBtn.disabled = st.finished || isBotTurn || x01Darts.length === 0;

  renderThrowLogX01(game, st);
  renderWinner(game, st.finished, st.winnerIndex);
}
function renderX01Display() {
  els.x01Display.innerHTML = '<small>Tour</small> ' + (x01Input || '—');
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
    if (x01Darts.length) {
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
  var turn = { player: computeX01State(activeGame).currentPlayer, attempted: attempted, confirmedDouble: !!confirmedDouble };
  // dart-by-dart entry knows how many darts were thrown — matters for a
  // checkout on the 1st or 2nd dart (see x01DartStats)
  if (x01Darts.length) turn.darts = x01Darts.length;
  var newLog = (activeGame.log || []).concat([turn]);
  var patched = Object.assign({}, activeGame, { log: newLog });
  var st = computeX01State(patched);
  var lastEntry = st.entries[st.entries.length - 1];
  if (lastEntry.bust) playMiss(); else playHit();
  announceScore(attempted, lastEntry.bust, botIndex(activeGame) === lastEntry.player);
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
  if (!b || b.disabled || x01Darts.length >= 3) return;
  playHit();
  x01Darts.push(dartValue(parseInt(b.dataset.num, 10), selectedMult));
  x01DartMult.push(selectedMult);
  x01Input = String(sumDarts(x01Darts));
  selectedMult = 1; // back to Simple after every dart — Double/Triple is a one-shot pick, not a sticky mode
  if (activeGame) renderX01(activeGame);
  // 3rd dart: nothing left to enter, so validate the turn on its own — same
  // as soon as a dart finishes the game or busts (see dartEndsTurn)
  if (x01Darts.length === 3 || dartEndsTurn()) submitX01Turn();
});
els.x01DartMissBtn.addEventListener('click', function () {
  if (x01Darts.length >= 3) return;
  playMiss();
  x01Darts.push(0);
  x01DartMult.push(0);
  x01Input = String(sumDarts(x01Darts));
  selectedMult = 1;
  if (activeGame) renderX01(activeGame);
  if (x01Darts.length === 3) submitX01Turn();
});
els.x01DartUndoBtn.addEventListener('click', function () {
  if (!x01Darts.length) return;
  x01Darts.pop();
  x01DartMult.pop();
  x01Input = x01Darts.length ? String(sumDarts(x01Darts)) : '';
  if (activeGame) renderX01(activeGame);
});

els.x01Keypad.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b || b.disabled) return;
  var k = b.dataset.key;
  if (k === 'ok') { submitX01Turn(); return; }
  if (k === '⌫') { x01Input = x01Input.slice(0, -1); }
  else {
    if (x01Input.length >= 3) return;
    var next = (x01Input + k).replace(/^0+(?=\d)/, '');
    if (parseInt(next, 10) > 180) return;
    x01Input = next;
  }
  if (activeGame) renderX01(activeGame);
});
els.x01Submit.addEventListener('click', submitX01Turn);
els.undoX01Btn.addEventListener('click', undoX01);
els.checkoutYes.addEventListener('click', function () { if (pendingAttempt != null) commitX01Turn(pendingAttempt, true); });
els.checkoutNo.addEventListener('click', function () { if (pendingAttempt != null) commitX01Turn(pendingAttempt, false); });
els.x01OutSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b || b.disabled || !activeGame || activeGame.type !== 'x01') return;
  var want = b.dataset.double === '1';
  if (want === !!activeGame.doubleOut) return;
  playClick();
  Store.updateGame(activeGame.id, { doubleOut: want });
});
