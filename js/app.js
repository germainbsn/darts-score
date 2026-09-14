"use strict";

function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
function newMatchId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// ---------- tabs / navigation ----------
function setTab(tab) {
  currentTab = tab;
  els.viewHome.hidden = tab !== 'home';
  els.viewHistory.hidden = tab !== 'history';
  els.viewStats.hidden = tab !== 'stats';
  els.viewRanking.hidden = tab !== 'ranking';
  els.viewPlay.hidden = tab !== 'play';
  Array.prototype.forEach.call(els.mainTabs.querySelectorAll('.tab'), function (b) {
    b.classList.toggle('active', b.dataset.tab === tab && tab !== 'play');
  });
  if (tab === 'play' && activeGame) renderPlay(activeGame);
  if (tab === 'stats') showStatsList();
  if (tab === 'ranking') renderRanking();
}
els.mainTabs.addEventListener('click', function (e) {
  var b = e.target.closest('.tab');
  if (!b) return;
  playClick();
  setTab(b.dataset.tab);
});
els.backBtn.addEventListener('click', function () { playClick(); setTab('home'); });
els.soundToggle.addEventListener('click', function () {
  setSoundEnabled(!soundEnabled);
  if (soundEnabled) playClick();
});

// Subscribe the Play view to one specific game, replacing any previous watch.
// Unlike the home banner's "in_progress" query, this keeps showing the game
// once it finishes (winner banner, final board, stats) until the player
// navigates away themselves.
function watchGame(id) {
  if (activeGameUnsub) { activeGameUnsub(); activeGameUnsub = null; }
  activeGame = null;
  if (!id) return;
  activeGameUnsub = Store.watchGame(id, function (game) {
    activeGame = game;
    if (currentTab === 'play') {
      if (game) renderPlay(game); else setTab('home');
    }
  });
}

// ---------- setup form ----------
var setupType = 'cricket';
var playerCount = 2;
var roundsCount = 10;
var clockFinishMode = 'any';
var clockMultiplier = 'any';
var clockOrderMode = 'sequential';
var legsToWin = 1;
var setsToWin = 1;
var savedNames = [];
try {
  var raw = localStorage.getItem('tv_lastPlayers');
  if (raw) savedNames = JSON.parse(raw);
} catch (e) { savedNames = []; }

// One plain text input per player, same as before — but backed by a shared
// <datalist> of known players so typing offers suggestions. Native, minimal,
// and typing anything not in the list just adds a new player.
function renderNameInputs() {
  els.playersDatalist.innerHTML = uniquePlayerNames().map(function (p) {
    return '<option value="' + escapeHtml(p) + '">';
  }).join('');
  var existing = els.nameInputs.querySelectorAll('input');
  var html = '';
  for (var i = 0; i < playerCount; i++) {
    var val = (existing[i] ? existing[i].value : (savedNames[i] || '')).replace(/"/g, '&quot;');
    html += '<input type="text" list="playersDatalist" maxlength="18" placeholder="Joueur ' + (i + 1) + '" value="' + val + '">';
  }
  els.nameInputs.innerHTML = html;
}
renderNameInputs();
// Legs-per-set / sets-to-win a match only make sense with an opponent.
function updateMatchFieldsVisibility() {
  els.matchLegsField.hidden = playerCount < 2;
  els.matchSetsField.hidden = playerCount < 2;
}
updateMatchFieldsVisibility();

els.typeSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  playClick();
  setupType = b.dataset.type;
  Array.prototype.forEach.call(els.typeSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
  els.doubleOutField.hidden = setupType !== '301' && setupType !== '501';
  els.roundsField.hidden = setupType !== 'score';
  els.clockFinishField.hidden = setupType !== 'clock';
  els.clockMultiplierField.hidden = setupType !== 'clock';
  els.clockOrderField.hidden = setupType !== 'clock';
});
els.playerMinus.addEventListener('click', function () { if (playerCount > 1) { playClick(); playerCount--; els.playerCount.textContent = playerCount; renderNameInputs(); updateMatchFieldsVisibility(); } });
els.playerPlus.addEventListener('click', function () { if (playerCount < 4) { playClick(); playerCount++; els.playerCount.textContent = playerCount; renderNameInputs(); updateMatchFieldsVisibility(); } });
els.legsMinus.addEventListener('click', function () { if (legsToWin > 1) { playClick(); legsToWin--; els.legsCount.textContent = legsToWin; } });
els.legsPlus.addEventListener('click', function () { if (legsToWin < 9) { playClick(); legsToWin++; els.legsCount.textContent = legsToWin; } });
els.setsMinus.addEventListener('click', function () { if (setsToWin > 1) { playClick(); setsToWin--; els.setsCount.textContent = setsToWin; } });
els.setsPlus.addEventListener('click', function () { if (setsToWin < 9) { playClick(); setsToWin++; els.setsCount.textContent = setsToWin; } });
els.roundsMinus.addEventListener('click', function () { if (roundsCount > 3) { playClick(); roundsCount--; els.roundsCount.textContent = roundsCount; } });
els.roundsPlus.addEventListener('click', function () { if (roundsCount < 20) { playClick(); roundsCount++; els.roundsCount.textContent = roundsCount; } });
els.clockFinishSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  playClick();
  clockFinishMode = b.dataset.finish;
  Array.prototype.forEach.call(els.clockFinishSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
});
els.clockMultiplierSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  playClick();
  clockMultiplier = b.dataset.mult;
  Array.prototype.forEach.call(els.clockMultiplierSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
});
els.clockOrderSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  playClick();
  clockOrderMode = b.dataset.order;
  Array.prototype.forEach.call(els.clockOrderSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
});

els.setupForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  playClick();
  var inputs = Array.prototype.slice.call(els.nameInputs.querySelectorAll('input'));
  var names = inputs.map(function (inp, i) { return (inp.value.trim() || ('Joueur ' + (i + 1))); });
  try { localStorage.setItem('tv_lastPlayers', JSON.stringify(names)); } catch (err) { }

  var isX01 = setupType === '301' || setupType === '501';
  // Random order: one shuffled sequence of all 21 targets (1-20 plus a 21st
  // "finish" slot for the bull) generated once at creation and stored on the
  // game, so every player follows the exact same draw and it survives
  // undo/redo and reloads. Sequential mode stores no order (null) — 21 is
  // simply hits+1 at read time (see clockTargetAt in clock.js).
  var clockOrder = (setupType === 'clock' && clockOrderMode === 'random') ? shuffleArray([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]) : null;
  // A "match" only exists once there's an opponent and either threshold is
  // above 1 — otherwise this stays a plain standalone game (matchId null),
  // exactly like before this feature existed.
  var isMatch = playerCount > 1 && (legsToWin > 1 || setsToWin > 1);
  var data = {
    type: setupType === 'cricket' ? 'cricket' : (setupType === 'score' ? 'score' : (setupType === 'clock' ? 'clock' : 'x01')),
    variant: (setupType === 'cricket' || setupType === 'clock') ? null : (setupType === 'score' ? roundsCount : parseInt(setupType, 10)),
    doubleOut: isX01 ? els.doubleOutCheck.checked : false,
    finishMode: setupType === 'clock' ? clockFinishMode : null,
    clockMultiplier: setupType === 'clock' ? clockMultiplier : null,
    clockOrder: clockOrder,
    matchId: isMatch ? newMatchId() : null,
    legsToWin: isMatch ? legsToWin : null,
    setsToWin: isMatch ? setsToWin : null,
    players: names,
    log: [],
    status: 'in_progress',
    createdAt: nowTs(),
    finishedAt: null,
    winnerIndex: null
  };
  var id = await Store.createGame(data);
  watchGame(id);
  setTab('play');
});

els.resumeBtn.addEventListener('click', function () {
  playClick();
  if (pendingGame) watchGame(pendingGame.id);
  setTab('play');
});

// ---------- match play: best-of-N legs per set, best-of-N sets ----------
// A "leg" is one ordinary game document; several legs sharing a matchId form
// a match. Standings are derived, not stored — replay every finished leg of
// this matchId in play order, crediting a set once a player's leg count
// within it reaches legsToWin, and the match once a player's set count
// reaches setsToWin.
function computeMatchStandings(game) {
  if (!game.matchId) return null;
  var legs = historyGames.filter(function (g) { return g.matchId === game.matchId && g.status === 'finished' && g.winnerIndex != null; });
  if (activeGame && activeGame.matchId === game.matchId && activeGame.status === 'finished' && activeGame.winnerIndex != null
    && !legs.some(function (g) { return g.id === activeGame.id; })) {
    legs = legs.concat([activeGame]);
  }
  legs.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
  var n = game.players.length;
  var setsWon = game.players.map(function () { return 0; });
  var legsWon = game.players.map(function () { return 0; });
  legs.forEach(function (g) {
    legsWon[g.winnerIndex]++;
    if (legsWon[g.winnerIndex] >= game.legsToWin) {
      setsWon[g.winnerIndex]++;
      legsWon = game.players.map(function () { return 0; });
    }
  });
  var matchWinner = null;
  for (var i = 0; i < n; i++) { if (setsWon[i] >= game.setsToWin) { matchWinner = i; break; } }
  return { setsWon: setsWon, legsWon: legsWon, legsPlayed: legs.length, matchWinner: matchWinner, matchOver: matchWinner != null };
}

// ---------- shared: winner banner, abandon, play shell ----------
var lastWinSoundGameId = null; // avoid replaying the win jingle on every re-render of a finished game
function renderWinner(game, finished, winnerIndex) {
  var standings = game.matchId ? computeMatchStandings(game) : null;
  if (finished && winnerIndex != null) {
    els.winnerBanner.hidden = false;
    if (standings && standings.matchOver) {
      els.winnerBanner.textContent = '🏆 ' + game.players[standings.matchWinner] + ' remporte le MATCH (sets ' + standings.setsWon.join('-') + ') !';
    } else if (standings) {
      els.winnerBanner.textContent = '🏆 ' + game.players[winnerIndex] + ' remporte la manche — Sets ' + standings.setsWon.join('-') + ' · Manches ' + standings.legsWon.join('-');
    } else {
      els.winnerBanner.textContent = '🏆 ' + game.players[winnerIndex] + ' remporte la partie !';
    }
    if (lastWinSoundGameId !== game.id) {
      playWin();
      lastWinSoundGameId = game.id;
    }
  } else {
    els.winnerBanner.hidden = true;
  }
  els.postGameActions.hidden = !finished;
  if (finished) {
    els.playAgainBtn.textContent = (standings && !standings.matchOver) ? 'Manche suivante' : 'Rejouer';
  }
  renderGameChart(game, finished);
  renderTopBadge(game);
}
function undoActiveGame() {
  if (!activeGame) return;
  if (activeGame.type === 'cricket') undoCricket();
  else if (activeGame.type === 'clock') undoClock();
  else undoX01();
}
els.postGameUndoBtn.addEventListener('click', undoActiveGame);
els.playAgainBtn.addEventListener('click', async function () {
  if (!activeGame) return;
  playClick();
  var g = activeGame;
  var standings = g.matchId ? computeMatchStandings(g) : null;
  var continueMatch = standings && !standings.matchOver;
  var data = {
    type: g.type,
    variant: g.variant,
    doubleOut: !!g.doubleOut,
    finishMode: g.finishMode || null,
    clockMultiplier: g.clockMultiplier || null,
    // a fresh shuffle, not the same draw replayed
    clockOrder: (g.type === 'clock' && g.clockOrder) ? shuffleArray(g.clockOrder) : null,
    // "Manche suivante" keeps the same match going; "Rejouer" (match over, or
    // no match to begin with) starts over from scratch — a brand-new matchId
    // when this was a match, or no match at all otherwise.
    matchId: continueMatch ? g.matchId : (g.matchId ? newMatchId() : null),
    legsToWin: g.matchId ? g.legsToWin : null,
    setsToWin: g.matchId ? g.setsToWin : null,
    players: g.players,
    log: [],
    status: 'in_progress',
    createdAt: nowTs(),
    finishedAt: null,
    winnerIndex: null
  };
  var id = await Store.createGame(data);
  watchGame(id);
  setTab('play');
});

// ---------- top-5 personal-best badge ----------
// Maps a game to the same filterType key topGamesForPlayer/STATS_TOP_LABELS
// use, so this reuses that exact "personal record book" instead of a second
// ranking definition.
function statsFilterTypeForGame(game) {
  if (game.type === 'cricket') return 'cricket';
  if (game.type === 'x01') return String(game.variant);
  if (game.type === 'score') return 'score';
  if (game.type === 'clock') return 'clock-' + (game.clockMultiplier === 'double' ? 'double' : game.clockMultiplier === 'triple' ? 'triple' : 'any');
  return null;
}
function computeTopBadgeText(game) {
  if (game.status !== 'finished') return null;
  var filterType = statsFilterTypeForGame(game);
  if (!filterType) return null;
  var parts = [];
  game.players.forEach(function (name) {
    var top = topGamesForPlayer(name, filterType);
    var idx = -1;
    for (var i = 0; i < Math.min(top.length, 5); i++) { if (top[i].id === game.id) { idx = i; break; } }
    if (idx === -1) return;
    parts.push(escapeHtml(name) + (idx === 0 ? ' bat son record personnel' : ' entre dans son top 5 (#' + (idx + 1) + ')'));
  });
  if (!parts.length) return null;
  return '⭐ ' + parts.join(' · ');
}
function renderTopBadge(game) {
  var text = computeTopBadgeText(game);
  els.topBadge.hidden = !text;
  if (text) els.topBadge.textContent = text;
}

// ---------- round-by-round chart for the just-finished game ----------
// Cricket and Horloge log one dart per entry with no explicit turn boundary,
// so — like computeCricketState/computeClockState already assume — every
// group of up to 3 consecutive log entries is replayed as one turn to get a
// per-turn snapshot of that player's running total (cumulative bonus score
// for Cricket, hits landed for Horloge). 301/501 and Score already log one
// entry per turn (computeX01State's entries), so those are used as-is.
function cricketTurnEntries(game) {
  var n = game.players.length;
  var marks = game.players.map(function () { return [0, 0, 0, 0, 0, 0, 0]; });
  var scores = game.players.map(function () { return 0; });
  var log = game.log || [];
  var entries = [];
  log.forEach(function (t, i) {
    if (t.number) {
      var idx = CRICKET_NUMS.indexOf(t.number);
      var cur = marks[t.player][idx];
      var newMarks = Math.min(3, cur + t.mult);
      var used = newMarks - cur;
      var overflow = t.mult - used;
      marks[t.player][idx] = newMarks;
      if (overflow > 0) {
        var allOthersClosed = true;
        for (var pi = 0; pi < n; pi++) { if (pi !== t.player && marks[pi][idx] < 3) { allOthersClosed = false; break; } }
        if (!allOthersClosed) scores[t.player] += overflow * t.number;
      }
    }
    if ((i + 1) % 3 === 0 || i === log.length - 1) entries.push({ player: t.player, value: scores[t.player] });
  });
  return entries;
}
function clockTurnEntries(game) {
  var hits = game.players.map(function () { return 0; });
  var log = game.log || [];
  var entries = [];
  log.forEach(function (t, i) {
    if (t.hit) hits[t.player]++;
    if ((i + 1) % 3 === 0 || i === log.length - 1) entries.push({ player: t.player, value: hits[t.player] });
  });
  return entries;
}
var GAME_CHART_YLABELS = { x01: 'Reste', score: 'Score', cricket: 'Score', clock: 'Touchés' };
function gameRoundSeries(game) {
  var perPlayer, start;
  if (game.type === 'x01' || game.type === 'score') {
    var st = computeX01State(game);
    start = game.type === 'x01' ? game.variant : 0;
    perPlayer = game.players.map(function (_, pi) {
      return st.entries.filter(function (e) { return e.player === pi; }).map(function (e) { return e.totalAfter; });
    });
  } else if (game.type === 'cricket') {
    var ce = cricketTurnEntries(game);
    start = 0;
    perPlayer = game.players.map(function (_, pi) { return ce.filter(function (e) { return e.player === pi; }).map(function (e) { return e.value; }); });
  } else {
    var cke = clockTurnEntries(game);
    start = 0;
    perPlayer = game.players.map(function (_, pi) { return cke.filter(function (e) { return e.player === pi; }).map(function (e) { return e.value; }); });
  }
  var rounds = Math.max.apply(null, perPlayer.map(function (a) { return a.length; }).concat([0]));
  var series = game.players.map(function (name, pi) { return { name: name, values: [start].concat(perPlayer[pi]) }; });
  return { rounds: rounds, series: series, yLabel: GAME_CHART_YLABELS[game.type] };
}

var GAME_CHART_COLOR_VARS = ['--gold', '--chart-blue', '--red', '--chart-purple'];
function renderGameChart(game, finished) {
  if (!finished) { els.gameChartCard.hidden = true; return; }
  var data = gameRoundSeries(game);
  if (data.rounds < 1) { els.gameChartCard.hidden = true; return; }
  els.gameChartCard.hidden = false;
  els.gameChartTitle.textContent = 'Évolution — ' + data.yLabel;

  var W = 600, H = 240, padL = 34, padR = 12, padT = 14, padB = 26;
  var innerW = W - padL - padR, innerH = H - padT - padB;
  var allValues = [0];
  data.series.forEach(function (s) { allValues = allValues.concat(s.values); });
  var minVal = Math.min.apply(null, allValues), maxVal = Math.max.apply(null, allValues.concat([1]));
  if (minVal === maxVal) maxVal = minVal + 1;
  var span = maxVal - minVal;
  var yMin = minVal - span * 0.08, yMax = maxVal + span * 0.08;
  function xAt(i) { return data.rounds > 0 ? padL + (innerW * i / data.rounds) : padL; }
  function yAt(v) { return padT + innerH - (innerH * (v - yMin) / (yMax - yMin)); }

  var gridSvg = '';
  for (var s = 0; s <= 4; s++) {
    var v = yMin + (yMax - yMin) * s / 4, y = yAt(v);
    gridSvg += '<line class="trend-grid" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '"/>';
    gridSvg += '<text class="trend-axis-label" x="' + (padL - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + Math.round(v) + '</text>';
  }
  var labelEvery = Math.max(1, Math.ceil((data.rounds + 1) / 8));
  var xLabelsSvg = '';
  for (var r = 0; r <= data.rounds; r++) {
    if (r % labelEvery !== 0 && r !== data.rounds) continue;
    xLabelsSvg += '<text class="trend-axis-label" x="' + xAt(r).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + r + '</text>';
  }

  var linesSvg = '', dotsSvg = '', legendHtml = '';
  data.series.forEach(function (ser, si) {
    var colorVar = 'var(' + GAME_CHART_COLOR_VARS[si % GAME_CHART_COLOR_VARS.length] + ')';
    var pathD = ser.values.map(function (v, i) { return (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ',' + yAt(v).toFixed(1); }).join(' ');
    linesSvg += '<path class="game-chart-line" d="' + pathD + '" fill="none" stroke="' + colorVar + '"/>';
    ser.values.forEach(function (v, i) {
      dotsSvg += '<circle class="game-chart-dot" data-i="' + i + '" cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(v).toFixed(1) + '" r="3.5" fill="' + colorVar + '"/>';
    });
    if (data.series.length > 1) {
      legendHtml += '<span class="chart-legend-item"><span class="chart-legend-dot" style="background:' + colorVar + '"></span>' + escapeHtml(ser.name) + '</span>';
    }
  });

  els.gameChartSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  els.gameChartSvg.innerHTML = gridSvg + linesSvg + dotsSvg + xLabelsSvg
    + '<line id="gameChartCrosshair" x1="0" y1="' + padT + '" x2="0" y2="' + (H - padB) + '" stroke="var(--ink-soft)" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>'
    + '<rect id="gameChartHoverLayer" x="' + padL + '" y="' + padT + '" width="' + innerW + '" height="' + innerH + '" fill="transparent"/>';
  els.gameChartLegend.innerHTML = legendHtml;

  wireGameChartHover(data, xAt);
}
function wireGameChartHover(data, xAt) {
  var svg = els.gameChartSvg;
  var hoverLayer = svg.querySelector('#gameChartHoverLayer');
  var crosshair = svg.querySelector('#gameChartCrosshair');
  function showAt(round) {
    var x = xAt(round);
    crosshair.setAttribute('x1', x); crosshair.setAttribute('x2', x); crosshair.setAttribute('opacity', '1');
    var anchorY = null;
    Array.prototype.forEach.call(svg.querySelectorAll('.game-chart-dot'), function (dot) {
      var isRound = parseInt(dot.dataset.i, 10) === round;
      dot.setAttribute('r', isRound ? '5.5' : '3.5');
      if (isRound && anchorY === null) anchorY = parseFloat(dot.getAttribute('cy'));
    });
    var scale = svg.getBoundingClientRect().width / 600;
    els.gameChartTooltip.style.left = (x * scale) + 'px';
    els.gameChartTooltip.style.top = ((anchorY || 20) * scale) + 'px';
    var lines = data.series.map(function (s) {
      var v = s.values[round];
      return escapeHtml(s.name) + ' : ' + (v === undefined ? '—' : v);
    }).join(' · ');
    els.gameChartTooltip.textContent = 'Tour ' + round + ' — ' + lines;
    els.gameChartTooltip.hidden = false;
  }
  function hide() {
    Array.prototype.forEach.call(svg.querySelectorAll('.game-chart-dot'), function (dot) { dot.setAttribute('r', '3.5'); });
    crosshair.setAttribute('opacity', '0');
    els.gameChartTooltip.hidden = true;
  }
  function nearestRound(clientX) {
    var rect = svg.getBoundingClientRect();
    var xUser = (clientX - rect.left) * (600 / rect.width);
    var nearest = 0, best = Infinity;
    for (var r = 0; r <= data.rounds; r++) { var dx = Math.abs(xAt(r) - xUser); if (dx < best) { best = dx; nearest = r; } }
    return nearest;
  }
  hoverLayer.addEventListener('mousemove', function (e) { showAt(nearestRound(e.clientX)); });
  hoverLayer.addEventListener('mouseleave', hide);
  hoverLayer.addEventListener('touchstart', function (e) { showAt(nearestRound(e.touches[0].clientX)); }, { passive: true });
}
async function abandonGame(id) {
  if (!id) return;
  await Store.updateGame(id, { status: 'abandoned', finishedAt: nowTs() });
}

els.abandonBtn.addEventListener('click', function () {
  if (!activeGame) { setTab('home'); return; }
  els.abandonConfirm.hidden = false;
});
els.abandonYes.addEventListener('click', async function () {
  els.abandonConfirm.hidden = true;
  await abandonGame(activeGame && activeGame.id);
  setTab('home');
});
els.abandonNo.addEventListener('click', function () { els.abandonConfirm.hidden = true; });

els.homeAbandonBtn.addEventListener('click', function () { els.homeAbandonConfirm.hidden = false; });
els.homeAbandonYes.addEventListener('click', async function () {
  els.homeAbandonConfirm.hidden = true;
  await abandonGame(pendingGame && pendingGame.id);
});
els.homeAbandonNo.addEventListener('click', function () { els.homeAbandonConfirm.hidden = true; });

function renderPlay(game) {
  if (!game) { return; }
  if (game.type === 'cricket') {
    els.playTitle.textContent = 'Cricket';
  } else if (game.type === 'score') {
    var doneRounds = Math.min(Math.floor((game.log || []).length / game.players.length), game.variant);
    els.playTitle.textContent = 'Score · ' + game.variant + ' lancers (tour ' + Math.min(doneRounds + 1, game.variant) + '/' + game.variant + ')';
  } else if (game.type === 'clock') {
    els.playTitle.textContent = 'Tour de l\'horloge · finir sur ' + finishLabel(game.finishMode);
  } else {
    els.playTitle.textContent = game.variant + (game.doubleOut ? ' · double sortie' : ' · sortie simple');
  }
  els.abandonBtn.hidden = (game.status === 'finished' || game.status === 'abandoned');
  els.cricketBoard.hidden = game.type !== 'cricket';
  els.clockBoard.hidden = game.type !== 'clock';
  els.x01Board.hidden = game.type === 'cricket' || game.type === 'clock';
  if (game.type === 'cricket') renderCricket(game);
  else if (game.type === 'clock') renderClock(game);
  else renderX01(game);
}

// ---------- home banner + stats ----------
function renderHomeBanner() {
  var has = !!pendingGame;
  els.activeBanner.hidden = !has;
  if (has) {
    var label = pendingGame.type === 'cricket' ? 'Cricket'
      : pendingGame.type === 'score' ? ('Score · ' + pendingGame.variant + ' lancers')
      : pendingGame.type === 'clock' ? ('Horloge · finir sur ' + finishLabel(pendingGame.finishMode))
      : ('' + pendingGame.variant);
    els.activeBannerText.textContent = label + ' — ' + pendingGame.players.join(', ');
  } else {
    els.homeAbandonConfirm.hidden = true;
  }
}

function renderStats() {
  if (!historyGames.length) {
    els.statTiles.innerHTML = '<p class="stat-empty">Aucune partie terminée pour l\'instant.</p>';
    return;
  }
  var wins = {};
  historyGames.forEach(function (g) {
    if (g.winnerIndex == null || g.players.length < 2) return;
    var name = g.players[g.winnerIndex];
    wins[name] = (wins[name] || 0) + 1;
  });
  var names = Object.keys(wins).sort(function (a, b) { return wins[b] - wins[a]; });
  var max = names.length ? wins[names[0]] : 1;
  var html = '<div class="stat-total">' + historyGames.length + '</div><div class="stat-total-label">parties jouées</div>';
  names.slice(0, 6).forEach(function (name) {
    var pct = Math.max(6, Math.round((wins[name] / max) * 100));
    html += '<div class="stat-row"><span class="stat-name">' + escapeHtml(name) + '</span>'
      + '<span class="stat-bar-track"><span class="stat-bar-fill" style="width:' + pct + '%"></span></span>'
      + '<span class="stat-val mono">' + wins[name] + '</span></div>';
  });
  els.statTiles.innerHTML = html;
}

function renderHistory() {
  if (!historyGames.length) {
    els.historyList.innerHTML = '<p class="history-empty">Aucune partie enregistrée pour l\'instant. Lance ta première partie !</p>';
    return;
  }
  var html = '';
  historyGames.forEach(function (g) {
    var typeLabel = g.type === 'cricket' ? 'Cricket'
      : g.type === 'score' ? ('Score · ' + g.variant + ' lancers')
      : g.type === 'clock' ? ('Horloge · finir sur ' + finishLabel(g.finishMode))
      : (g.variant + (g.doubleOut ? ' · double sortie' : ''));
    var winner = g.winnerIndex != null ? g.players[g.winnerIndex] : '—';
    var date = g.finishedAt ? new Date(g.finishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    html += '<button type="button" class="history-item" data-game-id="' + g.id + '"><div class="hi-main"><span class="hi-type">' + typeLabel + '</span>'
      + '<span class="hi-players">' + g.players.map(escapeHtml).join(' · ') + '</span></div>'
      + '<div style="text-align:right"><div>🏆 ' + escapeHtml(winner) + '</div><div class="hi-date">' + date + '</div></div></button>';
  });
  els.historyList.innerHTML = html;
}
function openGameFromList(id) {
  playClick();
  watchGame(id);
  setTab('play');
}
els.historyList.addEventListener('click', function (e) {
  var b = e.target.closest('[data-game-id]');
  if (!b) return;
  openGameFromList(b.dataset.gameId);
});

// ---------- stats tab: player list + per-player detail ----------
function uniquePlayerNames() {
  var seen = {};
  historyGames.forEach(function (g) { g.players.forEach(function (n) { seen[n] = true; }); });
  return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
}
// Horloge now has a "touché requis" variant (Simple/Doubles/Triples) that
// changes what counts as a hit, so — same as 301 vs 501 — each variant gets
// its own stats bucket instead of being averaged together.
function isClockFilter(f) { return f === 'clock-any' || f === 'clock-double' || f === 'clock-triple'; }
function clockFilterVariant(f) { return f === 'clock-double' ? 'double' : f === 'clock-triple' ? 'triple' : 'any'; }
function statsForPlayer(name, filterType) {
  var games = historyGames.filter(function (g) {
    if (g.players.indexOf(name) === -1) return false;
    if (filterType === 'cricket') return g.type === 'cricket';
    if (filterType === '301') return g.type === 'x01' && g.variant === 301;
    if (filterType === '501') return g.type === 'x01' && g.variant === 501;
    if (filterType === 'x01') return g.type === 'x01';
    if (filterType === 'score') return g.type === 'score';
    if (isClockFilter(filterType)) return g.type === 'clock' && (g.clockMultiplier || 'any') === clockFilterVariant(filterType);
    return true;
  });
  // a solo game has no opponent, so "win" or "loss" is meaningless there —
  // keep it out of the victory-rate numerator/denominator while still
  // counting it for every other stat below (MPR, moyenne, darts-to-finish...).
  var multiGames = games.filter(function (g) { return g.players.length > 1; });
  var wins = multiGames.filter(function (g) { return g.winnerIndex != null && g.players[g.winnerIndex] === name; }).length;
  var pct = multiGames.length ? Math.round(wins / multiGames.length * 100) : 0;

  // aggregate darts/marks (cricket), darts/points (301-501/Score) and darts
  // to finish (Horloge, wins only — an unfinished attempt has no "darts to
  // finish") across every matched game, so the average is over real totals,
  // not an average of per-game averages
  var totalDarts = 0, totalMarks = 0, totalTurns = 0, totalScored = 0, totalClockDarts = 0, clockFinishes = 0;
  games.forEach(function (g) {
    var pi = g.players.indexOf(name);
    if (g.type === 'cricket') {
      var cs = cricketDartStats(g)[pi];
      totalDarts += cs.darts;
      totalMarks += cs.marks;
    } else if (g.type === 'clock') {
      if (g.winnerIndex === pi) {
        totalClockDarts += computeClockState(g).darts[pi];
        clockFinishes++;
      }
    } else {
      var xs = x01DartStats(g)[pi];
      totalTurns += xs.turns;
      totalScored += xs.scored;
    }
  });
  var mpr = totalDarts ? (totalMarks / totalDarts * 3) : 0;
  var avg3 = totalTurns ? (totalScored / totalTurns) : 0;
  var avgClockDarts = clockFinishes ? (totalClockDarts / clockFinishes) : 0;

  return { played: games.length, playedMulti: multiGames.length, wins: wins, pct: pct, mpr: mpr, avg3: avg3, avgClockDarts: avgClockDarts };
}

// Top 100 of this player's own best individual-game performances for the
// selected mode — MPR (Cricket), average aux 3 fléchettes (301/501/Score
// treated as a raw score instead), or fewest darts to finish (Horloge, wins
// only). Ranking/Classement compares across everyone; this is this player's
// personal record book.
var STATS_TOP_LABELS = {
  cricket: 'Top 100 — meilleur MPR',
  301: 'Top 100 — meilleure moyenne aux 3 fléchettes',
  501: 'Top 100 — meilleure moyenne aux 3 fléchettes',
  score: 'Top 100 — meilleurs scores',
  'clock-any': 'Top 100 — le moins de fléchettes pour terminer',
  'clock-double': 'Top 100 — le moins de fléchettes pour terminer (doubles)',
  'clock-triple': 'Top 100 — le moins de fléchettes pour terminer (triples)'
};
function topGamesForPlayer(name, filterType) {
  var games = historyGames.filter(function (g) {
    if (g.players.indexOf(name) === -1) return false;
    if (filterType === 'cricket') return g.type === 'cricket';
    if (filterType === '301') return g.type === 'x01' && g.variant === 301;
    if (filterType === '501') return g.type === 'x01' && g.variant === 501;
    if (filterType === 'score') return g.type === 'score';
    if (isClockFilter(filterType)) {
      return g.type === 'clock' && (g.clockMultiplier || 'any') === clockFilterVariant(filterType)
        && g.winnerIndex != null && g.players[g.winnerIndex] === name;
    }
    return false;
  });
  var rows = games.map(function (g) {
    var pi = g.players.indexOf(name);
    if (g.type === 'cricket') {
      var cs = cricketDartStats(g)[pi];
      var mpr = cs.darts ? (cs.marks / cs.darts * 3) : 0;
      return { id: g.id, date: g.finishedAt, value: mpr, display: mpr.toFixed(1) + ' mpr', sub: '' };
    }
    if (g.type === 'x01') {
      var xs = x01DartStats(g)[pi];
      var avg = xs.turns ? (xs.scored / xs.turns) : 0;
      return { id: g.id, date: g.finishedAt, value: avg, display: avg.toFixed(1) + ' moy/3', sub: '' };
    }
    if (g.type === 'score') {
      var scored = x01DartStats(g)[pi].scored;
      return { id: g.id, date: g.finishedAt, value: scored, display: scored + ' pts', sub: g.variant + ' lancers' };
    }
    var darts = computeClockState(g).darts[pi];
    return { id: g.id, date: g.finishedAt, value: darts, display: darts + ' flé', sub: 'finir sur ' + finishLabel(g.finishMode) };
  });
  var ascending = isClockFilter(filterType); // fewer darts is better there, everywhere else higher is better
  rows.sort(function (a, b) { return ascending ? (a.value - b.value) : (b.value - a.value); });
  return rows.slice(0, 100);
}
function renderStatsTopList() {
  var show = !!statsSelectedPlayer && STATS_TOP_LABELS.hasOwnProperty(statsFilterType);
  els.statsTopCard.hidden = !show;
  if (!show) return;
  els.statsTopTitle.textContent = STATS_TOP_LABELS[statsFilterType];
  var rows = topGamesForPlayer(statsSelectedPlayer, statsFilterType);
  if (!rows.length) {
    els.statsTopList.innerHTML = '<p class="history-empty">Aucune partie pour l\'instant.</p>';
    return;
  }
  els.statsTopList.innerHTML = rows.map(function (r, i) {
    var date = r.date ? new Date(r.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    return '<button type="button" class="history-item" data-game-id="' + r.id + '"><span class="rank-num mono">' + (i + 1) + '</span>'
      + '<div style="text-align:right"><div class="mono">' + r.display + '</div><div class="hi-date">' + (r.sub ? r.sub + ' · ' : '') + date + '</div></div></button>';
  }).join('');
}
els.statsTopList.addEventListener('click', function (e) {
  var b = e.target.closest('[data-game-id]');
  if (!b) return;
  openGameFromList(b.dataset.gameId);
});

function renderStatsPlayerList() {
  var names = uniquePlayerNames();
  if (!names.length) {
    els.statsPlayerList.innerHTML = '<p class="history-empty">Aucune partie terminée pour l\'instant.</p>';
    return;
  }
  els.statsPlayerList.innerHTML = names.map(function (name) {
    return '<button type="button" class="history-item" data-player="' + escapeHtml(name) + '">'
      + '<span class="hi-players">' + escapeHtml(name) + '</span><span class="chev">›</span></button>';
  }).join('');
}
function renderStatsDetail() {
  var st = statsForPlayer(statsSelectedPlayer, statsFilterType);
  els.statsPlayerName.textContent = statsSelectedPlayer;
  els.statsGamesPlayed.textContent = st.played;
  els.statsWinPct.textContent = st.pct + '%';
  if (statsFilterType === 'cricket') {
    els.statsThirdTile.hidden = false;
    els.statsThirdLabel.textContent = 'MPR moyen';
    els.statsThirdValue.textContent = st.mpr.toFixed(1);
  } else if (statsFilterType === '301' || statsFilterType === '501' || statsFilterType === 'score') {
    els.statsThirdTile.hidden = false;
    els.statsThirdLabel.textContent = 'Moyenne aux 3 fléchettes';
    els.statsThirdValue.textContent = st.avg3.toFixed(1);
  } else if (isClockFilter(statsFilterType)) {
    els.statsThirdTile.hidden = false;
    els.statsThirdLabel.textContent = 'Fléchettes moy. pour terminer';
    els.statsThirdValue.textContent = st.avgClockDarts.toFixed(1);
  } else {
    els.statsThirdTile.hidden = true;
  }
  renderStatsTopList();
  renderMprChart();
  renderAvg3Chart();
  renderClockChart();
  renderClockNumberStats();
}

// ---------- stats tab: trend charts (MPR for Cricket, avg-per-3-darts for 301/501) ----------
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function chartBucketKey(ts, period) {
  var d = new Date(ts);
  if (period === 'day') return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  if (period === 'month') return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  var dow = (d.getDay() + 6) % 7; // Monday-start week
  var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  return monday.getFullYear() + '-' + pad2(monday.getMonth() + 1) + '-' + pad2(monday.getDate());
}
function chartBucketLabel(key, period) {
  var parts = key.split('-').map(Number);
  if (period === 'month') { return new Date(parts[0], parts[1] - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }); }
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function mprTrendData(name, period) {
  var buckets = {};
  historyGames.forEach(function (g) {
    if (g.type !== 'cricket' || !g.finishedAt || g.players.indexOf(name) === -1) return;
    var pi = g.players.indexOf(name);
    var cs = cricketDartStats(g)[pi];
    var key = chartBucketKey(g.finishedAt, period);
    if (!buckets[key]) buckets[key] = { darts: 0, marks: 0 };
    buckets[key].darts += cs.darts;
    buckets[key].marks += cs.marks;
  });
  return Object.keys(buckets).sort().map(function (key) {
    var b = buckets[key];
    return { label: chartBucketLabel(key, period), value: b.darts ? (b.marks / b.darts * 3) : 0, count: b.darts };
  });
}
function avg3TrendData(name, variant, period) {
  var buckets = {};
  historyGames.forEach(function (g) {
    if (g.type !== 'x01' || g.variant !== variant || !g.finishedAt || g.players.indexOf(name) === -1) return;
    var pi = g.players.indexOf(name);
    var xs = x01DartStats(g)[pi];
    var key = chartBucketKey(g.finishedAt, period);
    if (!buckets[key]) buckets[key] = { turns: 0, scored: 0 };
    buckets[key].turns += xs.turns;
    buckets[key].scored += xs.scored;
  });
  return Object.keys(buckets).sort().map(function (key) {
    var b = buckets[key];
    return { label: chartBucketLabel(key, period), value: b.turns ? (b.scored / b.turns) : 0, count: b.turns * 3 };
  });
}

// Draws one line-trend chart into elsChart {wrap, svg, tooltip, empty} and wires
// its hover crosshair/tooltip. `idPrefix` keeps each chart's internal SVG ids
// unique on the page; `unit` is the short label shown after the value in the
// tooltip; `countLabel(d)` formats the tooltip's parenthetical context (darts
// thrown, finishes counted, ...) since it differs per chart.
function renderTrendChart(data, elsChart, idPrefix, unit, countLabel) {
  elsChart.empty.hidden = data.length > 0;
  elsChart.wrap.hidden = data.length === 0;
  elsChart.tooltip.hidden = true;
  if (!data.length) { elsChart.svg.innerHTML = ''; return; }

  var W = 600, H = 220, padL = 32, padR = 12, padT = 14, padB = 26;
  var innerW = W - padL - padR, innerH = H - padT - padB;
  var maxVal = Math.max.apply(null, data.map(function (d) { return d.value; }));
  var yMax = Math.max(1, Math.ceil(maxVal * 1.15 * 10) / 10);
  function xAt(i) { return data.length > 1 ? padL + (innerW * i / (data.length - 1)) : padL + innerW / 2; }
  function yAt(v) { return padT + innerH - (innerH * v / yMax); }

  var gridSvg = '';
  for (var s = 0; s <= 4; s++) {
    var v = yMax * s / 4, y = yAt(v);
    gridSvg += '<line class="trend-grid" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '"/>';
    gridSvg += '<text class="trend-axis-label" x="' + (padL - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + v.toFixed(1) + '</text>';
  }

  var pathD = data.map(function (d, i) { return (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ',' + yAt(d.value).toFixed(1); }).join(' ');

  var labelEvery = Math.max(1, Math.ceil(data.length / 6));
  var xLabelsSvg = data.map(function (d, i) {
    if (i % labelEvery !== 0 && i !== data.length - 1) return '';
    return '<text class="trend-axis-label" x="' + xAt(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + escapeHtml(d.label) + '</text>';
  }).join('');

  var dotsSvg = data.map(function (d, i) {
    return '<circle class="trend-dot" data-i="' + i + '" cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(d.value).toFixed(1) + '" r="4.5"/>';
  }).join('');

  elsChart.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  elsChart.svg.innerHTML = gridSvg
    + '<path class="trend-line" d="' + pathD + '" fill="none"/>'
    + dotsSvg + xLabelsSvg
    + '<line id="' + idPrefix + 'Crosshair" x1="0" y1="' + padT + '" x2="0" y2="' + (H - padB) + '" stroke="var(--ink-soft)" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>'
    + '<rect id="' + idPrefix + 'HoverLayer" x="' + padL + '" y="' + padT + '" width="' + innerW + '" height="' + innerH + '" fill="transparent"/>';

  wireTrendHover(elsChart, idPrefix, data, xAt, W, unit, countLabel);
}
function wireTrendHover(elsChart, idPrefix, data, xAt, viewboxW, unit, countLabel) {
  var svg = elsChart.svg;
  var hoverLayer = svg.querySelector('#' + idPrefix + 'HoverLayer');
  var crosshair = svg.querySelector('#' + idPrefix + 'Crosshair');
  var dots = svg.querySelectorAll('.trend-dot');
  function showAt(i) {
    var d = data[i];
    Array.prototype.forEach.call(dots, function (dot, di) { dot.setAttribute('r', di === i ? '6.5' : '4.5'); });
    var x = parseFloat(dots[i].getAttribute('cx')), y = parseFloat(dots[i].getAttribute('cy'));
    crosshair.setAttribute('x1', x); crosshair.setAttribute('x2', x); crosshair.setAttribute('opacity', '1');
    var scale = svg.getBoundingClientRect().width / viewboxW;
    elsChart.tooltip.style.left = (x * scale) + 'px';
    elsChart.tooltip.style.top = (y * scale) + 'px';
    elsChart.tooltip.textContent = d.label + ' — ' + d.value.toFixed(1) + ' ' + unit + ' (' + countLabel(d) + ')';
    elsChart.tooltip.hidden = false;
  }
  function hide() {
    Array.prototype.forEach.call(dots, function (dot) { dot.setAttribute('r', '4.5'); });
    crosshair.setAttribute('opacity', '0');
    elsChart.tooltip.hidden = true;
  }
  function nearestIndex(clientX) {
    var rect = svg.getBoundingClientRect();
    var xUser = (clientX - rect.left) * (viewboxW / rect.width);
    var nearest = 0, best = Infinity;
    data.forEach(function (d, i) { var dx = Math.abs(xAt(i) - xUser); if (dx < best) { best = dx; nearest = i; } });
    return nearest;
  }
  hoverLayer.addEventListener('mousemove', function (e) { showAt(nearestIndex(e.clientX)); });
  hoverLayer.addEventListener('mouseleave', hide);
  hoverLayer.addEventListener('touchstart', function (e) { showAt(nearestIndex(e.touches[0].clientX)); }, { passive: true });
}

var mprChartPeriod = 'week';
function renderMprChart() {
  if (statsFilterType !== 'cricket' || !statsSelectedPlayer) { els.mprChartCard.hidden = true; return; }
  els.mprChartCard.hidden = false;
  var data = mprTrendData(statsSelectedPlayer, mprChartPeriod);
  renderTrendChart(data, { wrap: els.mprChartWrap, svg: els.mprChartSvg, tooltip: els.mprChartTooltip, empty: els.mprChartEmpty }, 'mpr', 'mpr',
    function (d) { return d.count + ' flé'; });
}
els.mprPeriodSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  playClick();
  mprChartPeriod = b.dataset.period;
  Array.prototype.forEach.call(els.mprPeriodSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
  renderMprChart();
});

var avg3ChartPeriod = 'week';
function renderAvg3Chart() {
  var show = !!statsSelectedPlayer && (statsFilterType === '301' || statsFilterType === '501');
  els.avg3ChartCard.hidden = !show;
  if (!show) return;
  var data = avg3TrendData(statsSelectedPlayer, parseInt(statsFilterType, 10), avg3ChartPeriod);
  renderTrendChart(data, { wrap: els.avg3ChartWrap, svg: els.avg3ChartSvg, tooltip: els.avg3ChartTooltip, empty: els.avg3ChartEmpty }, 'avg3', 'moy/3',
    function (d) { return d.count + ' flé'; });
}
els.avg3PeriodSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  playClick();
  avg3ChartPeriod = b.dataset.period;
  Array.prototype.forEach.call(els.avg3PeriodSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
  renderAvg3Chart();
});

// Horloge: fléchettes moyennes pour terminer, dans le temps — only the
// player's own completed games count (an unfinished attempt has no "darts to
// finish"), one bucket value = a plain average of those finishes.
function clockTrendData(name, period, variant) {
  var buckets = {};
  historyGames.forEach(function (g) {
    if (g.type !== 'clock' || !g.finishedAt || g.winnerIndex == null) return;
    if ((g.clockMultiplier || 'any') !== variant) return;
    var pi = g.players.indexOf(name);
    if (pi === -1 || pi !== g.winnerIndex) return;
    var darts = computeClockState(g).darts[pi];
    var key = chartBucketKey(g.finishedAt, period);
    if (!buckets[key]) buckets[key] = { total: 0, count: 0 };
    buckets[key].total += darts;
    buckets[key].count++;
  });
  return Object.keys(buckets).sort().map(function (key) {
    var b = buckets[key];
    return { label: chartBucketLabel(key, period), value: b.count ? (b.total / b.count) : 0, count: b.count };
  });
}
var clockChartPeriod = 'week';
function renderClockChart() {
  var show = !!statsSelectedPlayer && isClockFilter(statsFilterType);
  els.clockChartCard.hidden = !show;
  if (!show) return;
  var data = clockTrendData(statsSelectedPlayer, clockChartPeriod, clockFilterVariant(statsFilterType));
  renderTrendChart(data, { wrap: els.clockChartWrap, svg: els.clockChartSvg, tooltip: els.clockChartTooltip, empty: els.clockChartEmpty }, 'clock', 'flé',
    function (d) { return d.count + ' partie' + (d.count > 1 ? 's' : ''); });
}
els.clockChartPeriodSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  playClick();
  clockChartPeriod = b.dataset.period;
  Array.prototype.forEach.call(els.clockChartPeriodSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
  renderClockChart();
});

// Horloge: taux de réussite par numéro visé (1 à 20, puis la bulle de
// finition) — the log only stores {player, hit} per dart, so the target a
// given dart was thrown at is reconstructed by replaying that player's own
// hit count so far (same rule renderClock uses to show the live target).
// `cutoff` restricts to games finished on/after that timestamp (the
// day/week/month window), or the whole history when omitted.
function clockNumberStats(name, cutoff, variant) {
  var rows = [];
  for (var n = 1; n <= 20; n++) { rows.push({ key: n, label: String(n), darts: 0, hits: 0 }); }
  rows.push({ key: 'finish', label: 'Bull', darts: 0, hits: 0 });
  historyGames.forEach(function (g) {
    if (g.type !== 'clock') return;
    if ((g.clockMultiplier || 'any') !== variant) return;
    if (cutoff && (!g.finishedAt || g.finishedAt < cutoff)) return;
    var pi = g.players.indexOf(name);
    if (pi === -1) return;
    var hits = 0;
    (g.log || []).forEach(function (t) {
      if (t.player !== pi) return;
      var targetNum = clockTargetAt(g, hits); // 1-20, or 21 for the finish — order-agnostic
      var row = targetNum <= 20 ? rows[targetNum - 1] : rows[20];
      row.darts++;
      if (t.hit) { row.hits++; hits++; }
    });
  });
  return rows;
}
function clockNumberPeriodCutoff(period) {
  var days = period === 'day' ? 1 : period === 'month' ? 30 : 7;
  return Date.now() - days * 86400000;
}
var clockNumberPeriod = 'week';
var clockNumberSort = 'number';
function renderClockNumberStats() {
  var show = !!statsSelectedPlayer && isClockFilter(statsFilterType);
  els.clockNumberStatsCard.hidden = !show;
  if (!show) return;
  var cutoff = clockNumberPeriodCutoff(clockNumberPeriod);
  var rows = clockNumberStats(statsSelectedPlayer, cutoff, clockFilterVariant(statsFilterType))
    .filter(function (r) { return r.darts > 0; })
    .map(function (r) { return { label: r.label, pct: Math.round(r.hits / r.darts * 100) }; });
  if (clockNumberSort === 'asc') rows.sort(function (a, b) { return a.pct - b.pct; });
  else if (clockNumberSort === 'desc') rows.sort(function (a, b) { return b.pct - a.pct; });
  if (!rows.length) {
    els.clockNumberStatsList.innerHTML = '<p class="stat-empty">Pas de fléchette en Horloge sur cette période.</p>';
    return;
  }
  els.clockNumberStatsList.innerHTML = rows.map(function (r) {
    return '<div class="stat-row"><span class="stat-name">' + r.label + '</span>'
      + '<span class="stat-bar-track"><span class="stat-bar-fill" style="width:' + r.pct + '%"></span></span>'
      + '<span class="stat-val mono">' + r.pct + '%</span></div>';
  }).join('');
}
els.clockNumberPeriodSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  playClick();
  clockNumberPeriod = b.dataset.period;
  Array.prototype.forEach.call(els.clockNumberPeriodSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
  renderClockNumberStats();
});
els.clockNumberSortSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  playClick();
  clockNumberSort = b.dataset.sort;
  Array.prototype.forEach.call(els.clockNumberSortSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
  renderClockNumberStats();
});

function showStatsList() {
  statsSelectedPlayer = null;
  els.statsPlayerListWrap.hidden = false;
  els.statsPlayerDetail.hidden = true;
  renderStatsPlayerList();
}
function showStatsDetail(name) {
  statsSelectedPlayer = name;
  statsFilterType = 'all';
  els.statsFilterType.value = 'all';
  els.deletePlayerConfirm.hidden = true;
  els.statsPlayerListWrap.hidden = true;
  els.statsPlayerDetail.hidden = false;
  renderStatsDetail();
}
function refreshStatsView() {
  if (currentTab !== 'stats') return;
  if (statsSelectedPlayer) renderStatsDetail(); else renderStatsPlayerList();
}

els.statsPlayerList.addEventListener('click', function (e) {
  var b = e.target.closest('[data-player]');
  if (!b) return;
  showStatsDetail(b.dataset.player);
});
els.statsBackBtn.addEventListener('click', function () { playClick(); showStatsList(); });
els.statsFilterType.addEventListener('change', function () {
  statsFilterType = els.statsFilterType.value;
  renderStatsDetail();
});

// Deleting a player permanently erases every finished game they're in — since
// player names are baked into each game's log by index, there's no way to
// pull just one name out of a shared game without corrupting it, so a game
// they shared with someone else disappears from that other player's history
// too. The confirmation spells that out before it happens.
els.deletePlayerBtn.addEventListener('click', function () {
  var name = statsSelectedPlayer;
  var games = historyGames.filter(function (g) { return g.players.indexOf(name) !== -1; });
  var shared = games.filter(function (g) { return g.players.length > 1; }).length;
  var text = 'Supprimer ' + name + ' effacera définitivement ' + games.length + ' partie' + (games.length > 1 ? 's' : '') + ' de l\'historique.';
  if (shared > 0) {
    text += ' ' + shared + ' d\'entre elles ' + (shared > 1 ? 'étaient partagées' : 'était partagée') + ' avec d\'autres joueurs, qui les perdront aussi de leur historique.';
  }
  els.deletePlayerConfirmText.textContent = text;
  els.deletePlayerConfirm.hidden = false;
});
els.deletePlayerNo.addEventListener('click', function () { els.deletePlayerConfirm.hidden = true; });
els.deletePlayerYes.addEventListener('click', async function () {
  els.deletePlayerConfirm.hidden = true;
  var name = statsSelectedPlayer;
  var games = historyGames.filter(function (g) { return g.players.indexOf(name) !== -1; });
  for (var i = 0; i < games.length; i++) { await Store.deleteGame(games[i].id); }
  showStatsList();
});

// ---------- ranking tab ----------
function computeRanking(statKey) {
  var rows = uniquePlayerNames().map(function (name) {
    if (statKey === 'mpr') {
      var cs = statsForPlayer(name, 'cricket');
      return { name: name, games: cs.played, value: cs.mpr, display: cs.mpr.toFixed(1) + ' mpr' };
    }
    if (statKey === 'avg3') {
      var xs = statsForPlayer(name, 'x01');
      return { name: name, games: xs.played, value: xs.avg3, display: xs.avg3.toFixed(1) + ' moy/3' };
    }
    var ws = statsForPlayer(name, 'all');
    return { name: name, games: ws.playedMulti, value: ws.pct, display: ws.pct + '%' };
  });
  rows = rows.filter(function (r) { return r.games > 0; });
  rows.sort(function (a, b) { return b.value - a.value || b.games - a.games || a.name.localeCompare(b.name, 'fr'); });
  return rows;
}
// Score mode's all-time high-score board: one row per individual game
// performance (not per player), since the point is "best score ever set",
// grouped by how many lancers that game was — a 15-round game and a 5-round
// game aren't comparable, so the ranking filters to one length at a time.
function scoreRoundsOptions() {
  var seen = {};
  historyGames.forEach(function (g) { if (g.type === 'score') seen[g.variant] = true; });
  return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
}
function computeBestScores(roundsFilter) {
  var rows = [];
  historyGames.forEach(function (g) {
    if (g.type !== 'score') return;
    if (roundsFilter !== 'all' && g.variant !== parseInt(roundsFilter, 10)) return;
    var dstats = x01DartStats(g);
    g.players.forEach(function (name, pi) {
      rows.push({ name: name, score: dstats[pi].scored, rounds: g.variant, date: g.finishedAt });
    });
  });
  rows.sort(function (a, b) { return b.score - a.score || (b.date || 0) - (a.date || 0); });
  return rows;
}
function renderBestScores() {
  var current = els.rankingRoundsFilter.value;
  var values = scoreRoundsOptions();
  els.rankingRoundsFilter.innerHTML = '<option value="all">Toutes les longueurs</option>'
    + values.map(function (v) { return '<option value="' + v + '">' + v + ' lancers</option>'; }).join('');
  els.rankingRoundsFilter.value = (current === 'all' || values.indexOf(parseInt(current, 10)) !== -1) ? current : 'all';

  var rows = computeBestScores(els.rankingRoundsFilter.value);
  if (!rows.length) {
    els.rankingList.innerHTML = '<p class="history-empty">Aucune partie de Score terminée pour l\'instant.</p>';
    return;
  }
  els.rankingList.innerHTML = rows.slice(0, 100).map(function (r, i) {
    var date = r.date ? new Date(r.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    return '<div class="history-item"><div class="hi-main"><span class="rank-num mono">' + (i + 1) + '</span>'
      + '<span class="hi-players">' + escapeHtml(r.name) + '</span></div>'
      + '<div style="text-align:right"><div class="mono">' + r.score + ' pts</div><div class="hi-date">' + r.rounds + ' lancers · ' + date + '</div></div></div>';
  }).join('');
}

// Horloge's all-time best board: fewest darts to complete the clock, one row
// per finishing performance (not per player) — mirrors Score's high-score
// board but ascending, and filters by finishMode since finishing on the
// bull (50) is harder than "25 ou 50".
function computeBestClock(finishFilter) {
  var rows = [];
  historyGames.forEach(function (g) {
    if (g.type !== 'clock' || g.winnerIndex == null) return;
    if (finishFilter !== 'all' && g.finishMode !== finishFilter) return;
    var cst = computeClockState(g);
    rows.push({ name: g.players[g.winnerIndex], darts: cst.darts[g.winnerIndex], finishMode: g.finishMode, date: g.finishedAt });
  });
  rows.sort(function (a, b) { return a.darts - b.darts || (b.date || 0) - (a.date || 0); });
  return rows;
}
function renderBestClock() {
  var rows = computeBestClock(els.rankingClockFilter.value);
  if (!rows.length) {
    els.rankingList.innerHTML = '<p class="history-empty">Aucune partie d\'Horloge terminée pour l\'instant.</p>';
    return;
  }
  els.rankingList.innerHTML = rows.slice(0, 100).map(function (r, i) {
    var date = r.date ? new Date(r.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    return '<div class="history-item"><div class="hi-main"><span class="rank-num mono">' + (i + 1) + '</span>'
      + '<span class="hi-players">' + escapeHtml(r.name) + '</span></div>'
      + '<div style="text-align:right"><div class="mono">' + r.darts + ' flé</div><div class="hi-date">' + finishLabel(r.finishMode) + ' · ' + date + '</div></div></div>';
  }).join('');
}

function renderRanking() {
  var isBestScore = els.rankingStat.value === 'bestscore';
  var isClockDarts = els.rankingStat.value === 'clockdarts';
  els.rankingRoundsField.hidden = !isBestScore;
  els.rankingClockField.hidden = !isClockDarts;
  if (isBestScore) { renderBestScores(); return; }
  if (isClockDarts) { renderBestClock(); return; }

  var rows = computeRanking(els.rankingStat.value);
  if (!rows.length) {
    els.rankingList.innerHTML = '<p class="history-empty">Aucune partie terminée pour l\'instant.</p>';
    return;
  }
  els.rankingList.innerHTML = rows.map(function (r, i) {
    return '<div class="history-item"><div class="hi-main"><span class="rank-num mono">' + (i + 1) + '</span>'
      + '<span class="hi-players">' + escapeHtml(r.name) + '</span></div>'
      + '<div class="mono">' + r.display + '</div></div>';
  }).join('');
}
els.rankingStat.addEventListener('change', renderRanking);
els.rankingRoundsFilter.addEventListener('change', renderBestScores);
els.rankingClockFilter.addEventListener('change', renderBestClock);

// ---------- snapshot handlers (called by store.js) ----------
// Drives only the home "resume" banner — separate from the Play view, which
// watches its own game via watchGame() so a finished game stays visible.
function onPendingSnapshot(game) {
  pendingGame = game;
  renderHomeBanner();
}
function onHistorySnapshot(list) {
  historyGames = list;
  renderStats();
  renderHistory();
  refreshStatsView();
  renderNameInputs();
  if (currentTab === 'ranking') renderRanking();
  // the just-finished active game may not have been in historyGames yet when
  // renderWinner first tried the top-5 check (a separate, slightly-delayed
  // snapshot) — redo it now that this fresher list has landed.
  if (activeGame && currentTab === 'play') renderPlay(activeGame);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

// ---------- init ----------
async function init() {
  setSoundEnabled(soundEnabled);
  try {
    db = await window.claude.use('db');
  } catch (e) { db = null; }
  usingDb = !!db;
  els.offlineNotice.hidden = usingDb;

  if (usingDb) {
    db.collection('games').where('status', '==', 'in_progress').limit(1).onSnapshot(function (snap) {
      if (snap.empty) { onPendingSnapshot(null); return; }
      var d = snap.docs[0];
      onPendingSnapshot(Object.assign({ id: d.id }, d.data()));
    }, function () { /* degrade silently */ });

    db.collection('games').where('status', '==', 'finished').orderBy('finishedAt', 'desc').limit(500).onSnapshot(function (snap) {
      onHistorySnapshot(snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }));
    }, function () { /* degrade silently */ });
  } else {
    renderPendingFromMemory();
    renderHistoryFromMemory();
  }
}

init();
