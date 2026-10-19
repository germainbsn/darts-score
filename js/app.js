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
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
// Only one bot per game, so a single slot index is enough. Games created
// before the random start order have no botSlot — the bot was always last.
// Returns -1 when the game has no bot.
function botIndex(game) {
  if (game.botLevel == null) return -1;
  return game.botSlot != null ? game.botSlot : game.players.length - 1;
}
// Random start order: shuffles the players and tracks where the bot lands.
function shufflePlayers(names, botSlot) {
  var order = shuffleArray(names.map(function (_, i) { return i; }));
  return {
    players: order.map(function (i) { return names[i]; }),
    botSlot: botSlot >= 0 ? order.indexOf(botSlot) : null
  };
}
var botTurnRunning = false; // guards against a mid-turn re-render (each bot dart write fires the snapshot listener) kicking off a second, overlapping bot turn

// ---------- tabs / navigation ----------
// page name shown in the phone top bar, next to the menu button
var TAB_TITLES = { home: 'Jouer', history: 'Historique', stats: 'Stats', ranking: 'Classement', play: 'En partie', voice: 'Ma voix' };
var VIEWS_BY_TAB = { home: 'viewHome', history: 'viewHistory', stats: 'viewStats', ranking: 'viewRanking', play: 'viewPlay', voice: 'viewVoice' };
function setTab(tab) {
  currentTab = tab;
  els.viewHome.hidden = tab !== 'home';
  els.viewHistory.hidden = tab !== 'history';
  els.viewStats.hidden = tab !== 'stats';
  els.viewRanking.hidden = tab !== 'ranking';
  els.viewPlay.hidden = tab !== 'play';
  els.viewVoice.hidden = tab !== 'voice';
  els.voiceBtn.classList.toggle('active', tab === 'voice');
  Array.prototype.forEach.call(els.mainTabs.querySelectorAll('.tab'), function (b) {
    b.classList.toggle('active', b.dataset.tab === tab && tab !== 'play');
  });
  Array.prototype.forEach.call(els.drawer.querySelectorAll('[data-tab]'), function (b) {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  els.topbarWhere.textContent = TAB_TITLES[tab] || '';
  // Restart the fade/slide-in animation each time this view is (re)shown —
  // removing the class then forcing a reflow before re-adding it is what
  // makes a CSS animation replay on a class that never actually left the DOM.
  var shownView = els[VIEWS_BY_TAB[tab]];
  if (shownView) {
    shownView.classList.remove('view-in');
    void shownView.offsetWidth;
    shownView.classList.add('view-in');
  }
  if (tab === 'play' && activeGame) renderPlay(activeGame);
  if (tab === 'stats') showStatsList();
  if (tab === 'ranking') renderRanking();
  if (tab === 'history') { els.deleteGameConfirm.hidden = true; pendingDeleteGameId = null; }
  if (tab === 'voice') renderVoiceView(); else releaseVoiceMic();
}
els.mainTabs.addEventListener('click', function (e) {
  var b = e.target.closest('.tab');
  if (!b) return;
  playClick();
  setTab(b.dataset.tab);
});
els.backBtn.addEventListener('click', function () { playClick(); setTab('home'); });
els.voiceBtn.addEventListener('click', function () { playClick(); setTab('voice'); });
els.voiceBackBtn.addEventListener('click', function () { playClick(); setTab('home'); });
els.soundToggle.addEventListener('click', function () {
  setSoundEnabled(!soundEnabled);
  if (soundEnabled) playClick();
});

// ---------- phone menu (drawer) ----------
// Below 720px the top tabs and icon buttons are hidden (CSS) and this
// slide-in menu replaces them; it drives the very same setTab/sound code.
function setDrawerOpen(open) {
  els.drawer.classList.toggle('open', open);
  els.drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  els.menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  els.drawerScrim.hidden = !open;
  document.body.classList.toggle('drawer-open', open);
  if (open) { var first = els.drawer.querySelector('.drawer-item'); if (first) first.focus(); }
  else if (els.drawer.contains(document.activeElement)) els.menuBtn.focus();
}
els.menuBtn.addEventListener('click', function () { playClick(); setDrawerOpen(true); });
els.drawerScrim.addEventListener('click', function () { setDrawerOpen(false); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && els.drawer.classList.contains('open')) setDrawerOpen(false); });
els.drawer.addEventListener('click', function (e) {
  var item = e.target.closest('[data-tab]');
  if (item) { playClick(); setTab(item.dataset.tab); setDrawerOpen(false); return; }
  if (e.target.closest('#drawerSoundBtn')) {
    setSoundEnabled(!soundEnabled);
    if (soundEnabled) playClick();
  }
});

// Subscribe the Play view to one specific game, replacing any previous watch.
// Unlike the home banner's "in_progress" query, this keeps showing the game
// once it finishes (winner banner, final board, stats) until the player
// navigates away themselves.
function watchGame(id) {
  if (activeGameUnsub) { activeGameUnsub(); activeGameUnsub = null; }
  activeGame = null;
  botTurnRunning = false; // switching games invalidates any bot turn in flight for the previous one
  if (!id) return;
  activeGameUnsub = Store.watchGame(id, function (game) {
    activeGame = game;
    if (currentTab === 'play') {
      if (game) renderPlay(game); else setTab('home');
    }
  });
}

// ---------- setup form ----------
// Two steps: tap a game tile (step 1), then players, bot and that game's
// settings (step 2) with the launch button. The back arrow and the crumb's
// "Changer" return to step 1; players and settings are kept.
var setupType = 'cricket';
var playerCount = 2; // humans + the bot, if any
var roundsCount = 10;
var clockFinishMode = 'any';
var clockMultiplier = 'any';
var clockOrderMode = 'sequential';
var setupDoubleOut = false;
var legsToWin = 1;
var setsToWin = 1;
var botLevel = null; // null = no bot; 1-10 otherwise — the bot fills the last setup slot (the start order is shuffled at creation)
var savedNames = [];
try {
  var raw = localStorage.getItem('tv_lastPlayers');
  if (raw) savedNames = JSON.parse(raw);
} catch (e) { savedNames = []; }

var MODE_NAMES = { cricket: 'Cricket', '301': '301', '501': '501', clock: 'Horloge', score: 'Score' };

// Game logos: a small dartboard where the part that matters in that game is
// lit (15-20 + bull for Cricket, treble 20 + a plaque for 301/501, a white
// clockwise arrow for the clock, the treble ring for Score).
var DART_RING_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
function boardArc(r1, r2, a1, a2) {
  function p(r, a) { return (24 + r * Math.sin(a)).toFixed(2) + ' ' + (24 - r * Math.cos(a)).toFixed(2); }
  return 'M' + p(r2, a1) + ' A' + r2 + ' ' + r2 + ' 0 0 1 ' + p(r2, a2) + ' L' + p(r1, a2) + ' A' + r1 + ' ' + r1 + ' 0 0 0 ' + p(r1, a1) + 'Z';
}
function clockArrowSvg() {
  var r = 13.5, a1 = 0.35, a2 = Math.PI * 2 * 0.8;
  function p(a) { return [24 + r * Math.sin(a), 24 - r * Math.cos(a)]; }
  function xy(v) { return v[0].toFixed(2) + ' ' + v[1].toFixed(2); }
  var A = p(a1), B = p(a2), t = [Math.cos(a2), Math.sin(a2)], n = [Math.sin(a2), -Math.cos(a2)];
  var arcD = 'M' + xy(A) + ' A' + r + ' ' + r + ' 0 1 1 ' + xy(B);
  var head = 'M' + xy([B[0] + t[0] * 7, B[1] + t[1] * 7]) + ' L' + xy([B[0] + n[0] * 6, B[1] + n[1] * 6]) + ' L' + xy([B[0] - n[0] * 6, B[1] - n[1] * 6]) + 'Z';
  return '<path d="' + arcD + '" fill="none" stroke="var(--board)" stroke-width="8" stroke-linecap="round"/>'
    + '<path d="' + head + '" fill="var(--board)" stroke="var(--board)" stroke-width="3" stroke-linejoin="round"/>'
    + '<path d="' + arcD + '" fill="none" stroke="var(--white)" stroke-width="4.5" stroke-linecap="round"/>'
    + '<path d="' + head + '" fill="var(--white)"/>';
}
function modeLogoSvg(id) {
  var seg = Math.PI * 2 / 20, out = '<circle cx="24" cy="24" r="22.5" fill="var(--board)" stroke="var(--rule)"/>';
  var x01 = id === '301' || id === '501';
  DART_RING_ORDER.forEach(function (n, i) {
    var a1 = i * seg - seg / 2, a2 = a1 + seg;
    var base = i % 2 === 0 ? 'color-mix(in srgb, var(--cream) 22%, var(--board))' : 'color-mix(in srgb, var(--cream) 8%, var(--board))';
    var ringCol = i % 2 === 0 ? 'var(--red)' : 'var(--green)';
    var hot = id === 'cricket' && n >= 15, t20 = x01 && n === 20;
    out += '<path d="' + boardArc(4, 19, a1, a2) + '" fill="' + (hot ? ringCol : base) + '"/>';
    if (id === 'clock') out += '<path d="' + boardArc(19, 22, a1, a2) + '" fill="var(--gold)" opacity="' + (0.15 + 0.85 * n / 20).toFixed(2) + '"/>';
    else out += '<path d="' + boardArc(19, 22, a1, a2) + '" fill="' + (t20 ? 'var(--gold)' : ringCol) + '" opacity="' + (hot ? 1 : 0.35) + '"/>';
    out += '<path d="' + boardArc(10.5, 13, a1, a2) + '" fill="' + (t20 ? 'var(--gold)' : ringCol) + '" opacity="' + (hot || t20 || id === 'score' ? 1 : 0.35) + '"/>';
  });
  var bull = id === 'cricket' ? 1 : 0.55;
  out += '<circle cx="24" cy="24" r="4" fill="var(--green)" opacity="' + bull + '"/><circle cx="24" cy="24" r="1.8" fill="var(--red)" opacity="' + bull + '"/>';
  if (x01) out += '<rect x="4.5" y="25.5" width="39" height="18" rx="5" fill="var(--surface)" stroke="var(--gold)" stroke-width="1.5"/>'
    + '<text x="24" y="39" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="900" font-size="14.5" fill="var(--gold-ink)">' + id + '</text>';
  if (id === 'clock') out += clockArrowSvg();
  return '<svg class="mode-svg" viewBox="0 0 48 48" aria-hidden="true">' + out + '</svg>';
}
Array.prototype.forEach.call(document.querySelectorAll('[data-logo]'), function (el) { el.innerHTML = modeLogoSvg(el.dataset.logo); });

function setSetupStep(step) {
  els.setupStep1.hidden = step !== 1;
  els.setupStep2.hidden = step !== 2;
}
function humanNameValues() {
  return Array.prototype.map.call(els.nameInputs.querySelectorAll('input'), function (inp) { return inp.value; });
}
// One text input per human (backed by a shared <datalist> of known players
// for suggestions), a × to remove that row, and the bot as its own row.
// `values` replaces the current names (used when a row is removed).
function refreshPlayersDatalist() {
  els.playersDatalist.innerHTML = uniquePlayerNames().map(function (p) {
    return '<option value="' + escapeHtml(p) + '">';
  }).join('');
}
function renderNameInputs(values) {
  refreshPlayersDatalist();
  var current = values || humanNameValues();
  var humanCount = botLevel != null ? playerCount - 1 : playerCount;
  var canRemove = playerCount > 1 && (botLevel == null || humanCount > 1);
  var html = '';
  for (var i = 0; i < humanCount; i++) {
    var val = current[i] != null ? current[i] : (savedNames[i] || '');
    html += '<div class="player-row"><span class="player-av">' + (i + 1) + '</span>'
      + '<input type="text" list="playersDatalist" maxlength="18" placeholder="Joueur ' + (i + 1) + '" value="' + escapeHtml(val) + '" aria-label="Nom du joueur ' + (i + 1) + '">'
      + (canRemove ? '<button type="button" class="row-x" data-remove="' + i + '" aria-label="Retirer ce joueur">×</button>' : '')
      + '</div>';
  }
  if (botLevel != null) {
    html += '<div class="player-row bot"><span class="player-av bot">🤖</span>'
      + '<span class="bot-label">Bot niveau ' + botLevel + '<small>moyenne ~' + (15 + 10 * botLevel) + '</small></span>'
      + '<span class="stepper small"><button type="button" data-bot-level="-1" aria-label="Bot plus faible">−</button><button type="button" data-bot-level="1" aria-label="Bot plus fort">+</button></span>'
      + '<button type="button" class="row-x" data-remove-bot aria-label="Retirer le bot">×</button></div>';
  }
  els.nameInputs.innerHTML = html;
  els.botAddBtn.hidden = botLevel != null;
  els.playerPlus.hidden = playerCount >= 10;
  updateSetupSettings();
}
// Settings rows for the chosen game; match rows only with an opponent.
function updateSetupSettings() {
  var isX01 = setupType === '301' || setupType === '501';
  els.doubleOutField.hidden = !isX01;
  els.clockFinishField.hidden = setupType !== 'clock';
  els.clockMultiplierField.hidden = setupType !== 'clock';
  els.clockOrderField.hidden = setupType !== 'clock';
  els.roundsField.hidden = setupType !== 'score';
  els.matchLegsField.hidden = playerCount < 2;
  els.matchSetsField.hidden = playerCount < 2;
  var anyRule = Array.prototype.some.call(els.rulesGroup.children, function (r) { return !r.hidden; });
  els.rulesGroup.hidden = !anyRule;
  els.rulesTitle.hidden = !anyRule;
  renderSetupSummary();
}
function renderSetupSummary() {
  var names = humanNameValues().map(function (v, i) { return v.trim() || ('Joueur ' + (i + 1)); });
  var who = botLevel != null ? names.join(', ') + ' vs bot ' + botLevel : (names.length > 3 ? names.length + ' joueurs' : names.join(', '));
  var mode = MODE_NAMES[setupType];
  if (setupType === '301' || setupType === '501') mode += setupDoubleOut ? ' · double sortie' : ' · sortie simple';
  els.setupSummary.textContent = mode + ' · ' + who;
}
function chooseSetupMode(type) {
  setupType = type;
  els.modeCrumb.innerHTML = '<span class="mode-logo">' + modeLogoSvg(type) + '</span><span>' + MODE_NAMES[type] + '</span>'
    + '<button type="button" id="modeCrumbChange">Changer</button>';
  setSetupStep(2);
  renderNameInputs();
}
renderNameInputs();
setSetupStep(1);

els.typeSeg.addEventListener('click', function (e) {
  var b = e.target.closest('[data-type]');
  if (!b) return;
  playClick();
  chooseSetupMode(b.dataset.type);
});
els.setupBackBtn.addEventListener('click', function () { playClick(); setSetupStep(1); });
els.modeCrumb.addEventListener('click', function (e) { if (e.target.closest('#modeCrumbChange')) { playClick(); setSetupStep(1); } });
els.nameInputs.addEventListener('input', renderSetupSummary);
els.nameInputs.addEventListener('click', function (e) {
  var t;
  if ((t = e.target.closest('[data-remove]'))) {
    playClick();
    var vals = humanNameValues();
    vals.splice(parseInt(t.dataset.remove, 10), 1);
    playerCount--;
    renderNameInputs(vals);
    return;
  }
  if (e.target.closest('[data-remove-bot]')) {
    playClick();
    botLevel = null; playerCount--;
    renderNameInputs();
    return;
  }
  if ((t = e.target.closest('[data-bot-level]'))) {
    var lvl = Math.max(1, Math.min(10, botLevel + parseInt(t.dataset.botLevel, 10)));
    if (lvl !== botLevel) { playClick(); botLevel = lvl; try { localStorage.setItem('tv_botLevel', String(lvl)); } catch (err) { } renderNameInputs(); }
  }
});
els.playerPlus.addEventListener('click', function () {
  if (playerCount >= 10) return;
  playClick();
  var vals = humanNameValues();
  vals.push(savedNames[vals.length] || '');
  playerCount++;
  renderNameInputs(vals);
  var inputs = els.nameInputs.querySelectorAll('input');
  if (inputs.length && !inputs[inputs.length - 1].value) inputs[inputs.length - 1].focus();
});
els.botAddBtn.addEventListener('click', function () {
  if (botLevel != null || playerCount >= 10) return;
  playClick();
  var lastLevel = 5;
  try { lastLevel = parseInt(localStorage.getItem('tv_botLevel'), 10) || 5; } catch (err) { }
  botLevel = lastLevel;
  playerCount++;
  renderNameInputs();
});
// pill groups: one active button, value read from its data attribute
function bindPills(seg, onPick) {
  seg.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    playClick();
    Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
    onPick(b);
    renderSetupSummary();
  });
}
bindPills(els.doubleOutPills, function (b) { setupDoubleOut = b.dataset.double === '1'; });
bindPills(els.clockFinishSeg, function (b) { clockFinishMode = b.dataset.finish; });
bindPills(els.clockMultiplierSeg, function (b) { clockMultiplier = b.dataset.mult; });
bindPills(els.clockOrderSeg, function (b) { clockOrderMode = b.dataset.order; });
els.legsMinus.addEventListener('click', function () { if (legsToWin > 1) { playClick(); legsToWin--; els.legsCount.textContent = legsToWin; } });
els.legsPlus.addEventListener('click', function () { if (legsToWin < 9) { playClick(); legsToWin++; els.legsCount.textContent = legsToWin; } });
els.setsMinus.addEventListener('click', function () { if (setsToWin > 1) { playClick(); setsToWin--; els.setsCount.textContent = setsToWin; } });
els.setsPlus.addEventListener('click', function () { if (setsToWin < 9) { playClick(); setsToWin++; els.setsCount.textContent = setsToWin; } });
els.roundsMinus.addEventListener('click', function () { if (roundsCount > 3) { playClick(); roundsCount--; els.roundsCount.textContent = roundsCount; } });
els.roundsPlus.addEventListener('click', function () { if (roundsCount < 20) { playClick(); roundsCount++; els.roundsCount.textContent = roundsCount; } });

els.setupForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  playClick();
  var inputs = Array.prototype.slice.call(els.nameInputs.querySelectorAll('input'));
  var names = inputs.map(function (inp, i) { return (inp.value.trim() || ('Joueur ' + (i + 1))); });
  try { localStorage.setItem('tv_lastPlayers', JSON.stringify(names)); } catch (err) { }
  if (botLevel != null) names = names.concat(['Bot niveau ' + botLevel]);
  var seating = shufflePlayers(names, botLevel != null ? names.length - 1 : -1);

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
    doubleOut: isX01 ? setupDoubleOut : false,
    finishMode: setupType === 'clock' ? clockFinishMode : null,
    clockMultiplier: setupType === 'clock' ? clockMultiplier : null,
    clockOrder: clockOrder,
    matchId: isMatch ? newMatchId() : null,
    legsToWin: isMatch ? legsToWin : null,
    setsToWin: isMatch ? setsToWin : null,
    botLevel: botLevel,
    botSlot: seating.botSlot,
    players: seating.players,
    log: [],
    status: 'in_progress',
    createdAt: nowTs(),
    finishedAt: null,
    winnerIndex: null
  };
  var id = await Store.createGame(data);
  watchGame(id);
  setSetupStep(1); // next visit starts from the game choice again; players are kept
  setTab('play');
});

els.resumeBtn.addEventListener('click', function () {
  playClick();
  if (pendingGame) watchGame(pendingGame.id);
  setTab('play');
});

// ---------- match play: best-of-N legs per set, best-of-N sets ----------
// Every finished leg of game's match, oldest first (activeGame included
// even before the history snapshot catches up with it).
function matchLegs(game) {
  var legs = historyGames.filter(function (g) { return g.matchId === game.matchId && g.status === 'finished' && g.winnerIndex != null; });
  if (activeGame && activeGame.matchId === game.matchId && activeGame.status === 'finished' && activeGame.winnerIndex != null
    && !legs.some(function (g) { return g.id === activeGame.id; })) {
    legs = legs.concat([activeGame]);
  }
  legs.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
  return legs;
}
// A "leg" is one ordinary game document; several legs sharing a matchId form
// a match. Standings are derived, not stored — replay every finished leg of
// this matchId in play order, crediting a set once a player's leg count
// within it reaches legsToWin, and the match once a player's set count
// reaches setsToWin.
function computeMatchStandings(game) {
  if (!game.matchId) return null;
  var legs = matchLegs(game);
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
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
var CONFETTI_COLORS = ['var(--red)', 'var(--green)', 'var(--gold)', 'var(--chart-blue)', 'var(--chart-purple)'];
function spawnConfetti() {
  if (!els.confettiLayer || prefersReducedMotion()) return;
  var html = '';
  for (var i = 0; i < 28; i++) {
    var left = Math.random() * 100;
    var delay = (Math.random() * 0.35).toFixed(2);
    var duration = (2.2 + Math.random() * 1.1).toFixed(2);
    var drift = (Math.random() * 80 - 40).toFixed(0);
    var color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    var spin = (360 + Math.random() * 360).toFixed(0);
    html += '<span class="confetti-piece" style="left:' + left + '%; background:' + color
      + '; animation-delay:' + delay + 's; animation-duration:' + duration + 's; --drift:' + drift + 'px; --spin:' + spin + 'deg;"></span>';
  }
  els.confettiLayer.innerHTML = html;
  clearTimeout(spawnConfetti._clearTimer);
  spawnConfetti._clearTimer = setTimeout(function () { els.confettiLayer.innerHTML = ''; }, 3800);
}
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
      spawnConfetti();
      els.winnerBanner.classList.remove('banner-in');
      void els.winnerBanner.offsetWidth;
      els.winnerBanner.classList.add('banner-in');
      lastWinSoundGameId = game.id;
    }
  } else {
    els.winnerBanner.hidden = true;
  }
  els.postGameActions.hidden = !finished;
  if (finished) {
    els.playAgainBtn.textContent = (standings && !standings.matchOver) ? 'Manche suivante' : 'Rejouer';
  }
  renderMatchRecap(game, finished);
  renderGameChart(game, finished);
  renderTopBadge(game);
}
// One row per leg played so far in this match, one column per player: the
// leg's key figure for that player, the winner's cell highlighted, plus a
// totals row (legs won, and the 3-dart average over the whole match in x01).
function matchLegCell(leg, pi) {
  if (leg.type === 'x01' || leg.type === 'score') {
    var st = computeX01State(leg);
    if (leg.type === 'score') return { main: String(st.totals[pi]), sub: 'pts' };
    var xs = x01DartStats(leg)[pi];
    return { main: x01Avg3(xs.scored, xs.darts).toFixed(1), sub: pi === leg.winnerIndex ? xs.darts + ' fl.' : 'reste ' + st.totals[pi] };
  }
  if (leg.type === 'cricket') {
    var cst = computeCricketState(leg), cs = cricketDartStats(leg)[pi];
    return { main: String(cst.scores[pi]), sub: 'MPR ' + (cs.darts ? (cs.marks / cs.darts * 3) : 0).toFixed(2) };
  }
  var kst = computeClockState(leg);
  return { main: Math.min(kst.hits[pi], 21) + '/21', sub: kst.darts[pi] + ' fl.' };
}
function renderMatchRecap(game, finished) {
  var legs = (finished && game.matchId) ? matchLegs(game) : [];
  if (!legs.length) { els.matchRecapCard.hidden = true; return; }
  els.matchRecapCard.hidden = false;
  var mainLabel = { x01: 'moyenne 3 fl.', score: 'points', cricket: 'points', clock: 'cibles' }[game.type];
  els.matchRecapHint.textContent = 'Par manche : ' + mainLabel;
  var head = '<thead><tr><th>Manche</th>' + game.players.map(function (name) { return '<th>' + escapeHtml(name) + '</th>'; }).join('') + '</tr></thead>';
  var legsWon = game.players.map(function () { return 0; });
  var setNo = 1, legInSet = 0, setLegsWon = game.players.map(function () { return 0; });
  var showSets = game.setsToWin > 1;
  var rows = legs.map(function (leg, li) {
    legInSet++;
    var label = showSets ? 'S' + setNo + ' · M' + legInSet : 'M' + (li + 1);
    var cells = game.players.map(function (_, pi) {
      var c = matchLegCell(leg, pi), won = pi === leg.winnerIndex;
      return '<td class="' + (won ? 'won' : '') + '"><span class="mono recap-main">' + (won ? '🏆 ' : '') + c.main + '</span><span class="recap-sub">' + c.sub + '</span></td>';
    }).join('');
    legsWon[leg.winnerIndex]++;
    setLegsWon[leg.winnerIndex]++;
    var endsSet = setLegsWon[leg.winnerIndex] >= game.legsToWin;
    if (endsSet) { setNo++; legInSet = 0; setLegsWon = game.players.map(function () { return 0; }); }
    return '<tr class="' + (showSets && endsSet ? 'set-end' : '') + '"><th>' + label + '</th>' + cells + '</tr>';
  }).join('');
  var totalCells = game.players.map(function (_, pi) {
    var sub = legsWon[pi] > 1 ? ' manches' : ' manche';
    if (game.type === 'x01') {
      var scored = 0, darts = 0;
      legs.forEach(function (leg) { var xs = x01DartStats(leg)[pi]; scored += xs.scored; darts += xs.darts; });
      return '<td><span class="mono recap-main">' + legsWon[pi] + sub + '</span><span class="recap-sub">moy. ' + x01Avg3(scored, darts).toFixed(1) + '</span></td>';
    }
    return '<td><span class="mono recap-main">' + legsWon[pi] + sub + '</span></td>';
  }).join('');
  els.matchRecapTable.innerHTML = head + '<tbody>' + rows + '</tbody><tfoot><tr><th>Total</th>' + totalCells + '</tr></tfoot>';
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
  // "Manche suivante" must keep the same order: match standings are indexed
  // by player slot across legs. "Rejouer" is a new game, so a new draw.
  var seating = continueMatch
    ? { players: g.players, botSlot: g.botLevel != null ? botIndex(g) : null }
    : shufflePlayers(g.players, botIndex(g));
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
    botLevel: g.botLevel != null ? g.botLevel : null,
    botSlot: seating.botSlot,
    players: seating.players,
    // Slot of whoever throws first (absent = 0, i.e. games created before
    // this field). Each "Manche suivante" hands the start to the next player.
    startPlayer: continueMatch ? ((g.startPlayer || 0) + 1) % g.players.length : 0,
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
  if (game.type === 'x01') return String(game.variant) + (game.doubleOut ? '-double' : '-simple');
  if (game.type === 'score') return 'score';
  if (game.type === 'clock') return 'clock-' + (game.clockMultiplier === 'double' ? 'double' : game.clockMultiplier === 'triple' ? 'triple' : 'any');
  return null;
}
function computeTopBadgeText(game) {
  if (game.status !== 'finished') return null;
  var filterType = statsFilterTypeForGame(game);
  if (!filterType) return null;
  var parts = [];
  var bi = botIndex(game);
  game.players.forEach(function (name, pi) {
    if (pi === bi) return;
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

var GAME_CHART_COLOR_VARS = ['--gold', '--chart-blue', '--red', '--chart-purple', '--chart-teal', '--chart-pink', '--chart-orange', '--chart-slate'];
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
  maybeStartBotTurn(game);
}

// ---------- bot opponent ----------
// The bot sits at botIndex(game). Its turn is driven
// entirely client-side: bot.js decides the darts, this just plays them out
// with a human-like pause between each and writes them through the exact
// same functions a click would call (applyCricketDart, applyClockHit,
// commitX01Turn, ...) — same sounds, same Firestore writes, same win
// detection, nothing bot-specific in those files.
function maybeStartBotTurn(game) {
  if (!game || botTurnRunning) return;
  if (game.status === 'finished' || game.status === 'abandoned') return;
  var bi = botIndex(game);
  if (bi < 0) return;
  var st = game.type === 'cricket' ? computeCricketState(game)
    : game.type === 'clock' ? computeClockState(game) : computeX01State(game);
  if (st.finished || st.currentPlayer !== bi) return;
  botTurnRunning = true;
  runBotTurn(game, bi).catch(function (e) { console.error(e); }).then(function () { botTurnRunning = false; });
}
// Pause between two bot darts: 1.2-2 s, slow enough to follow each dart.
function botDartPause() { return 1200 + Math.random() * 800; }
async function runBotTurn(game, bi) {
  function stillHere() { return activeGame && activeGame.id === game.id; }
  await sleep(500 + Math.random() * 300);
  if (!stillHere()) return;

  if (game.type === 'x01' || game.type === 'score') {
    var st = computeX01State(activeGame);
    var savedMode = x01EntryMode;
    x01EntryMode = 'darts';
    x01Darts = []; x01DartMult = []; x01Input = ''; // defensive: start this turn's dart slots clean
    // Score mode counts UP with no target and no bust, so there's nothing to
    // "have left" — pass a sentinel large enough that the checkout/avoid-1
    // logic (gated on doubleOut anyway, always false for Score) never kicks in.
    var remainingForSim = game.type === 'score' ? Infinity : st.totals[bi];
    var darts = simulateX01BotTurn(remainingForSim, !!activeGame.doubleOut, activeGame.botLevel);
    for (var i = 0; i < darts.length; i++) {
      if (!stillHere()) { x01EntryMode = savedMode; return; }
      x01Darts.push(darts[i].value);
      x01DartMult.push(darts[i].mult);
      x01Input = String(sumDarts(x01Darts));
      renderX01(activeGame);
      await sleep(botDartPause());
    }
    x01EntryMode = savedMode;
    if (!stillHere()) return;
    var total = sumDarts(x01Darts);
    var lastDouble = darts.length > 0 && darts[darts.length - 1].isDouble;
    await commitX01Turn(total, lastDouble);

  } else if (game.type === 'cricket') {
    var cst = computeCricketState(activeGame);
    var n = activeGame.players.length;
    var closedByAllOthers = function (idx) {
      for (var pi = 0; pi < n; pi++) { if (pi !== bi && cst.marks[pi][idx] < 3) return false; }
      return true;
    };
    var cDarts = simulateCricketBotTurn(cst.marks[bi], closedByAllOthers, activeGame.botLevel);
    var savedMult = selectedMult;
    for (var j = 0; j < cDarts.length; j++) {
      if (!stillHere()) break;
      if (computeCricketState(activeGame).finished) break;
      if (cDarts[j].mult === 0) {
        await applyCricketMiss();
      } else {
        selectedMult = cDarts[j].mult;
        await applyCricketDart(cDarts[j].number);
      }
      await sleep(botDartPause());
    }
    selectedMult = savedMult;

  } else { // clock
    var kDarts = simulateClockBotTurn(activeGame, computeClockState(activeGame).hits[bi], activeGame.botLevel);
    for (var k = 0; k < kDarts.length; k++) {
      if (!stillHere()) break;
      if (computeClockState(activeGame).finished) break;
      if (kDarts[k].hit) { await applyClockHit(); } else { await applyClockMiss(1); }
      await sleep(botDartPause());
    }
  }
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

// Shared by the home "Dernières parties" widget and the full Historique list.
function gameTypeLabel(g) {
  return g.type === 'cricket' ? 'Cricket'
    : g.type === 'score' ? ('Score · ' + g.variant + ' lancers')
    : g.type === 'clock' ? ('Horloge · finir sur ' + finishLabel(g.finishMode))
    : (g.variant + (g.doubleOut ? ' · double sortie' : ''));
}
function renderHistory() {
  if (!historyGames.length) {
    els.historyList.innerHTML = '<p class="history-empty">Aucune partie enregistrée pour l\'instant. Lance ta première partie !</p>';
    return;
  }
  var html = '';
  historyGames.forEach(function (g) {
    var typeLabel = gameTypeLabel(g);
    var winner = g.winnerIndex != null ? g.players[g.winnerIndex] : '—';
    var date = g.finishedAt ? new Date(g.finishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    html += '<div class="history-item">'
      + '<button type="button" class="hi-open" data-game-id="' + g.id + '"><div class="hi-main"><span class="hi-type">' + typeLabel + '</span>'
      + '<span class="hi-players">' + g.players.map(escapeHtml).join(' · ') + '</span></div></button>'
      + '<div class="hi-right"><div style="text-align:right"><div>🏆 ' + escapeHtml(winner) + '</div><div class="hi-date">' + date + '</div></div>'
      + '<button type="button" class="ghost danger hi-delete" data-delete-id="' + g.id + '" aria-label="Supprimer cette partie">✕</button></div></div>';
  });
  els.historyList.innerHTML = html;
}
function openGameFromList(id) {
  playClick();
  watchGame(id);
  setTab('play');
}
var pendingDeleteGameId = null;
els.historyList.addEventListener('click', function (e) {
  var del = e.target.closest('[data-delete-id]');
  if (del) {
    pendingDeleteGameId = del.dataset.deleteId;
    els.deleteGameConfirmText.textContent = 'Supprimer définitivement cette partie de l\'historique ?';
    els.deleteGameConfirm.hidden = false;
    return;
  }
  var b = e.target.closest('[data-game-id]');
  if (!b) return;
  openGameFromList(b.dataset.gameId);
});
els.deleteGameNo.addEventListener('click', function () {
  pendingDeleteGameId = null;
  els.deleteGameConfirm.hidden = true;
});
els.deleteGameYes.addEventListener('click', async function () {
  els.deleteGameConfirm.hidden = true;
  if (!pendingDeleteGameId) return;
  await Store.deleteGame(pendingDeleteGameId);
  pendingDeleteGameId = null;
});

// ---------- stats tab: player list + per-player detail ----------
function uniquePlayerNames() {
  var seen = {};
  historyGames.forEach(function (g) {
    var bi = botIndex(g);
    g.players.forEach(function (n, pi) { if (pi !== bi) seen[n] = true; });
  });
  return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
}
// Horloge now has a "touché requis" variant (Simple/Doubles/Triples) that
// changes what counts as a hit, so — same as 301 vs 501 — each variant gets
// its own stats bucket instead of being averaged together.
function isClockFilter(f) { return f === 'clock-any' || f === 'clock-double' || f === 'clock-triple'; }
function clockFilterVariant(f) { return f === 'clock-double' ? 'double' : f === 'clock-triple' ? 'triple' : 'any'; }
// 301/501 can be finished on a double or on any dart ("sortie simple"), which
// isn't the same challenge — a double-out average isn't comparable to a
// straight-out one — so each variant also gets its own double/simple bucket,
// same idea as Horloge's Simple/Doubles/Triples split above. The plain
// '301'/'501' filters stay as the "toutes sorties" combined view.
function isScoreFilter(f) { return f === 'score' || (typeof f === 'string' && f.indexOf('score-') === 0); }
function scoreFilterRounds(f) { return f && f.indexOf('score-') === 0 ? parseInt(f.slice(6), 10) : null; }
function isX01Filter(f) { return f === '301' || f === '501' || f === '301-double' || f === '301-simple' || f === '501-double' || f === '501-simple'; }
function x01FilterVariant(f) { return f.indexOf('301') === 0 ? 301 : 501; }
function x01FilterDoubleOut(f) { return f.indexOf('-double') !== -1 ? true : f.indexOf('-simple') !== -1 ? false : null; }
// "Checkout %" (le classique du fléchette) : sur tous les tours où le joueur
// pouvait finir avant de lancer (le reste était atteignable compte tenu de
// la règle double/simple sortie de cette partie), quelle proportion a
// effectivement fini ce tour-là. Double sortie et sortie simple n'ont pas la
// même définition de "atteignable" — d'où le split par filtre comme
// avg3TrendData/statsForPlayer juste au-dessus.
function x01InCheckoutRange(remaining, doubleOut) {
  if (remaining < 1) return false;
  if (doubleOut) return suggestCheckout(remaining, true, 3) != null;
  return remaining <= 180; // no double required: any combo of 3 darts can clear up to T20 T20 T20
}
function x01CheckoutStats(name, filterType) {
  var wantVariant = x01FilterVariant(filterType);
  var wantDoubleOut = x01FilterDoubleOut(filterType);
  var attempts = 0, hits = 0;
  historyGames.forEach(function (g) {
    if (g.type !== 'x01' || g.variant !== wantVariant) return;
    if (wantDoubleOut !== null && !!g.doubleOut !== wantDoubleOut) return;
    var pi = g.players.indexOf(name);
    if (pi === -1) return;
    computeX01State(g).entries.forEach(function (e) {
      if (e.player !== pi) return;
      var remainingBefore = e.bust ? e.totalAfter : (e.totalAfter + e.attempted);
      if (!x01InCheckoutRange(remainingBefore, g.doubleOut)) return;
      attempts++;
      if (!e.bust && e.totalAfter === 0) hits++;
    });
  });
  return { attempts: attempts, hits: hits, pct: attempts ? (hits / attempts * 100) : 0 };
}
// Paliers et records 301/501, même filtre que x01CheckoutStats : nombre de
// tours à 180 / 140-179 / 100-139 (tours ratés exclus — un raté marque 0),
// meilleure finition, et moyenne sur les 9 premières fléchettes (les 3
// premiers tours de chaque partie, là où le joueur score sans viser de sortie).
function x01MilestoneStats(name, filterType) {
  var wantVariant = x01FilterVariant(filterType);
  var wantDoubleOut = x01FilterDoubleOut(filterType);
  var r = { t180: 0, t140: 0, t100: 0, bestCheckout: 0, first9Scored: 0, first9Darts: 0 };
  historyGames.forEach(function (g) {
    if (g.type !== 'x01' || g.variant !== wantVariant) return;
    if (wantDoubleOut !== null && !!g.doubleOut !== wantDoubleOut) return;
    var pi = g.players.indexOf(name);
    if (pi === -1) return;
    var turnNo = 0;
    computeX01State(g).entries.forEach(function (e) {
      if (e.player !== pi) return;
      turnNo++;
      var pts = e.bust ? 0 : e.attempted;
      if (pts === 180) r.t180++;
      else if (pts >= 140) r.t140++;
      else if (pts >= 100) r.t100++;
      if (!e.bust && e.totalAfter === 0 && pts > r.bestCheckout) r.bestCheckout = pts;
      if (turnNo <= 3) { r.first9Scored += pts; r.first9Darts += x01EntryDarts(g, e); }
    });
  });
  r.first9Avg = x01Avg3(r.first9Scored, r.first9Darts);
  return r;
}
// This player's finished games matching the Stats tab's mode filter.
function statsGamesFor(name, filterType) {
  return historyGames.filter(function (g) {
    if (g.players.indexOf(name) === -1) return false;
    if (filterType === 'cricket') return g.type === 'cricket';
    if (isX01Filter(filterType)) {
      var doubleOut = x01FilterDoubleOut(filterType);
      return g.type === 'x01' && g.variant === x01FilterVariant(filterType) && (doubleOut === null || !!g.doubleOut === doubleOut);
    }
    if (filterType === 'x01') return g.type === 'x01';
    if (isScoreFilter(filterType)) return g.type === 'score' && (scoreFilterRounds(filterType) === null || g.variant === scoreFilterRounds(filterType));
    if (isClockFilter(filterType)) return g.type === 'clock' && (g.clockMultiplier || 'any') === clockFilterVariant(filterType);
    return true;
  });
}
function statsForPlayer(name, filterType) {
  var games = statsGamesFor(name, filterType);
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
  var totalDarts = 0, totalMarks = 0, totalX01Darts = 0, totalScored = 0, totalClockDarts = 0, clockFinishes = 0;
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
      totalX01Darts += xs.darts;
      totalScored += xs.scored;
    }
  });
  var mpr = totalDarts ? (totalMarks / totalDarts * 3) : 0;
  var avg3 = x01Avg3(totalScored, totalX01Darts);
  var avgClockDarts = clockFinishes ? (totalClockDarts / clockFinishes) : 0;

  return { played: games.length, playedMulti: multiGames.length, wins: wins, pct: pct, mpr: mpr, avg3: avg3, avgClockDarts: avgClockDarts };
}

// Games played and won against each bot level, same mode filter. Each leg of
// a match counts as one game, like everywhere else in the stats.
function botRecordForPlayer(name, filterType) {
  var byLevel = {};
  statsGamesFor(name, filterType).forEach(function (g) {
    if (g.botLevel == null || g.winnerIndex == null) return;
    var r = byLevel[g.botLevel] || (byLevel[g.botLevel] = { level: g.botLevel, played: 0, wins: 0 });
    r.played++;
    if (g.players[g.winnerIndex] === name) r.wins++;
  });
  return Object.keys(byLevel).map(function (k) { return byLevel[k]; }).sort(function (a, b) { return a.level - b.level; });
}
function renderBotRecord() {
  var rows = botRecordForPlayer(statsSelectedPlayer, statsFilterType);
  els.statsBotCard.hidden = !rows.length;
  els.statsBotList.innerHTML = rows.map(function (r) {
    var pct = Math.round(r.wins / r.played * 100);
    return '<div class="bot-record-row">'
      + '<span class="bot-record-level">🤖 Niveau ' + r.level + ' <span class="bot-record-avg">moy. ~' + (15 + 10 * r.level) + '</span></span>'
      + '<span class="bot-record-bar"><span style="width:' + pct + '%"></span></span>'
      + '<span class="bot-record-figures"><span class="mono bot-record-pct">' + pct + '%</span>'
      + '<span class="bot-record-count">' + r.wins + ' / ' + r.played + (r.played > 1 ? ' parties' : ' partie') + '</span></span>'
      + '</div>';
  }).join('');
}

// Top 100 of this player's own best individual-game performances for the
// selected mode — MPR (Cricket), average aux 3 fléchettes (301/501/Score
// treated as a raw score instead), or fewest darts to finish (Horloge, wins
// only). Ranking/Classement compares across everyone; this is this player's
// personal record book.
var STATS_TOP_LABELS = {
  cricket: 'Top 100 — meilleur MPR',
  301: 'Top 100 — meilleure moyenne aux 3 fléchettes',
  '301-double': 'Top 100 — meilleure moyenne aux 3 fléchettes (double sortie)',
  '301-simple': 'Top 100 — meilleure moyenne aux 3 fléchettes (sortie simple)',
  501: 'Top 100 — meilleure moyenne aux 3 fléchettes',
  '501-double': 'Top 100 — meilleure moyenne aux 3 fléchettes (double sortie)',
  '501-simple': 'Top 100 — meilleure moyenne aux 3 fléchettes (sortie simple)',
  score: 'Top 100 — meilleurs scores',
  'clock-any': 'Top 100 — le moins de fléchettes pour terminer',
  'clock-double': 'Top 100 — le moins de fléchettes pour terminer (doubles)',
  'clock-triple': 'Top 100 — le moins de fléchettes pour terminer (triples)'
};
function topGamesForPlayer(name, filterType) {
  var games = historyGames.filter(function (g) {
    if (g.players.indexOf(name) === -1) return false;
    if (filterType === 'cricket') return g.type === 'cricket';
    if (isX01Filter(filterType)) {
      var doubleOut = x01FilterDoubleOut(filterType);
      return g.type === 'x01' && g.variant === x01FilterVariant(filterType) && (doubleOut === null || !!g.doubleOut === doubleOut);
    }
    if (isScoreFilter(filterType)) return g.type === 'score' && (scoreFilterRounds(filterType) === null || g.variant === scoreFilterRounds(filterType));
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
      var avg = x01Avg3(xs.scored, xs.darts);
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
  var labelKey = isScoreFilter(statsFilterType) ? 'score' : statsFilterType;
  var show = !!statsSelectedPlayer && STATS_TOP_LABELS.hasOwnProperty(labelKey);
  els.statsTopCard.hidden = !show;
  if (!show) return;
  var rounds = scoreFilterRounds(statsFilterType);
  els.statsTopTitle.textContent = STATS_TOP_LABELS[labelKey] + (rounds ? ' (' + rounds + ' lancers)' : '');
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

// "aujourd'hui" / "hier" / "il y a 3 j" / a date, for when someone last played
function relativeDay(ts) {
  if (!ts) return '';
  var d = new Date(ts), now = new Date();
  var days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days <= 0) return 'aujourd\'hui';
  if (days === 1) return 'hier';
  if (days < 7) return 'il y a ' + days + ' j';
  return 'le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
// One card per player, most recently active first: initial, games played,
// when they last played, the modes they play (mini-boards) and their key
// figure over the last 10 games of the mode they play the most.
function renderStatsPlayerList() {
  var names = uniquePlayerNames();
  if (!names.length) {
    els.statsPlayerList.innerHTML = '<p class="history-empty">Aucune partie terminée pour l\'instant.</p>';
    return;
  }
  var players = names.map(function (name) {
    var games = historyGames.filter(function (g) { return g.players.indexOf(name) !== -1; })
      .sort(function (a, b) { return (b.finishedAt || 0) - (a.finishedAt || 0); });
    var modes = STATS_MODES.map(function (m) { return { mode: m, games: games.filter(m.test) }; }).filter(function (x) { return x.games.length; });
    var top = modes.slice().sort(function (a, b) { return b.games.length - a.games.length; })[0];
    var figure = '';
    if (top) {
      var kind = top.mode.id === 'score' ? 'x01' : statsFigureKind(top.mode.filter);
      figure = '<b>' + formatStatsFigure(kind, statsFigure(kind, top.games.slice(0, 10), name)) + '</b><span>' + top.mode.label + ' · ' + STATS_FIGURE_LABELS[kind] + '</span>';
    }
    return { name: name, games: games, modes: modes, figure: figure, last: games.length ? games[0].finishedAt || 0 : 0 };
  }).sort(function (a, b) { return b.last - a.last || a.name.localeCompare(b.name, 'fr'); });
  els.statsPlayerList.innerHTML = players.map(function (p) {
    return '<button type="button" class="player-card" data-player="' + escapeHtml(p.name) + '">'
      + '<span class="pc-av">' + escapeHtml(p.name.charAt(0).toUpperCase()) + '</span>'
      + '<span class="pc-main"><b>' + escapeHtml(p.name) + '</b>'
      + '<span class="pc-meta">' + p.games.length + (p.games.length > 1 ? ' parties' : ' partie') + (p.last ? ' · ' + relativeDay(p.last) : '') + '</span>'
      + '<span class="pc-modes">' + p.modes.map(function (x) { return '<span class="mode-logo" title="' + x.mode.label + '">' + modeLogoSvg(x.mode.id) + '</span>'; }).join('') + '</span></span>'
      + '<span class="pc-figure">' + p.figure + '</span><span class="pc-chev" aria-hidden="true">›</span></button>';
  }).join('');
}
function renderStatsDetail() {
  var st = statsForPlayer(statsSelectedPlayer, statsFilterType);
  els.statsPlayerName.textContent = statsSelectedPlayer;
  els.statsGamesPlayed.textContent = st.played;
  // the same key figure, over the 10 most recent games of this filter only
  var kind = statsFigureKind(statsFilterType);
  if (kind) {
    var recent = statsGamesFor(statsSelectedPlayer, statsFilterType)
      .sort(function (a, b) { return (b.finishedAt || 0) - (a.finishedAt || 0); }).slice(0, 10);
    els.statsRecentTile.hidden = !recent.length;
    els.statsRecentValue.textContent = formatStatsFigure(kind, statsFigure(kind, recent, statsSelectedPlayer));
    els.statsRecentLabel.textContent = STATS_FIGURE_LABELS[kind] + ' · ' + (recent.length >= 10 ? '10' : recent.length) + ' dernières';
  } else {
    els.statsRecentTile.hidden = true;
  }
  if (statsFilterType === 'cricket') {
    els.statsThirdTile.hidden = false;
    els.statsThirdLabel.textContent = 'MPR · global';
    els.statsThirdValue.textContent = st.mpr.toFixed(1);
  } else if (isX01Filter(statsFilterType) || isScoreFilter(statsFilterType)) {
    els.statsThirdTile.hidden = false;
    els.statsThirdLabel.textContent = 'moyenne 3 fl. · global';
    els.statsThirdValue.textContent = st.avg3.toFixed(1);
  } else if (isClockFilter(statsFilterType)) {
    els.statsThirdTile.hidden = false;
    els.statsThirdLabel.textContent = 'fléchettes moy. pour finir';
    els.statsThirdValue.textContent = st.avgClockDarts.toFixed(1);
  } else {
    els.statsThirdTile.hidden = true;
  }
  if (isX01Filter(statsFilterType)) {
    var co = x01CheckoutStats(statsSelectedPlayer, statsFilterType);
    els.statsFourthTile.hidden = false;
    els.statsFourthValue.textContent = co.pct.toFixed(1) + '%';
    els.statsFourthLabel.textContent = 'fermeture (' + co.hits + '/' + co.attempts + ')';
    var ms = x01MilestoneStats(statsSelectedPlayer, statsFilterType);
    els.statsMilestonesCard.hidden = false;
    els.statsFirst9.textContent = ms.first9Darts ? ms.first9Avg.toFixed(1) : '—';
    els.statsBestCheckout.textContent = ms.bestCheckout || '—';
    els.stats180.textContent = ms.t180;
    els.stats140.textContent = ms.t140;
    els.stats100.textContent = ms.t100;
  } else if (isScoreFilter(statsFilterType)) {
    // best single-game total, for the selected length (or all lengths)
    var best = 0;
    statsGamesFor(statsSelectedPlayer, statsFilterType).forEach(function (g) {
      best = Math.max(best, computeX01State(g).totals[g.players.indexOf(statsSelectedPlayer)]);
    });
    els.statsFourthTile.hidden = false;
    els.statsFourthValue.textContent = best;
    els.statsFourthLabel.textContent = 'meilleur total';
    els.statsMilestonesCard.hidden = true;
  } else {
    els.statsFourthTile.hidden = true;
    els.statsMilestonesCard.hidden = true;
  }
  renderBotRecord();
  renderStatsTopList();
  renderMprChart();
  renderAvg3Chart();
  renderCheckoutChart();
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
function avg3TrendData(name, variant, period, doubleOut) {
  var buckets = {};
  historyGames.forEach(function (g) {
    if (g.type !== 'x01' || g.variant !== variant || !g.finishedAt || g.players.indexOf(name) === -1) return;
    if (doubleOut !== null && !!g.doubleOut !== doubleOut) return;
    var pi = g.players.indexOf(name);
    var xs = x01DartStats(g)[pi];
    var key = chartBucketKey(g.finishedAt, period);
    if (!buckets[key]) buckets[key] = { darts: 0, scored: 0 };
    buckets[key].darts += xs.darts;
    buckets[key].scored += xs.scored;
  });
  return Object.keys(buckets).sort().map(function (key) {
    var b = buckets[key];
    return { label: chartBucketLabel(key, period), value: x01Avg3(b.scored, b.darts), count: b.darts };
  });
}
function checkoutTrendData(name, variant, period, doubleOut) {
  var buckets = {};
  historyGames.forEach(function (g) {
    if (g.type !== 'x01' || g.variant !== variant || !g.finishedAt || g.players.indexOf(name) === -1) return;
    if (doubleOut !== null && !!g.doubleOut !== doubleOut) return;
    var pi = g.players.indexOf(name);
    var key = chartBucketKey(g.finishedAt, period);
    computeX01State(g).entries.forEach(function (e) {
      if (e.player !== pi) return;
      var remainingBefore = e.bust ? e.totalAfter : (e.totalAfter + e.attempted);
      if (!x01InCheckoutRange(remainingBefore, g.doubleOut)) return;
      if (!buckets[key]) buckets[key] = { attempts: 0, hits: 0 };
      buckets[key].attempts++;
      if (!e.bust && e.totalAfter === 0) buckets[key].hits++;
    });
  });
  return Object.keys(buckets).sort().map(function (key) {
    var b = buckets[key];
    return { label: chartBucketLabel(key, period), value: b.attempts ? (b.hits / b.attempts * 100) : 0, count: b.attempts };
  });
}

// Draws one line-trend chart into elsChart {wrap, svg, tooltip, empty} and wires
// its hover crosshair/tooltip. `idPrefix` keeps each chart's internal SVG ids
// unique on the page; `unit` is the short label shown after the value in the
// tooltip; `countLabel(d)` (optional) formats the tooltip's parenthetical context (darts
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
  var last = data.length - 1;
  var areaD = pathD + ' L' + xAt(last).toFixed(1) + ',' + yAt(0).toFixed(1) + ' L' + xAt(0).toFixed(1) + ',' + yAt(0).toFixed(1) + ' Z';
  var lastX = xAt(last), lastY = yAt(data[last].value);
  var endSvg = '<circle class="trend-end" cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="7"/>'
    + '<text class="trend-end-label" x="' + (lastX - 10).toFixed(1) + '" y="' + (lastY - 12).toFixed(1) + '" text-anchor="end">' + data[last].value.toFixed(1) + '</text>';

  var labelEvery = Math.max(1, Math.ceil(data.length / 6));
  var xLabelsSvg = data.map(function (d, i) {
    if (i % labelEvery !== 0 && i !== data.length - 1) return '';
    return '<text class="trend-axis-label" x="' + xAt(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + escapeHtml(d.label) + '</text>';
  }).join('');

  var dotsSvg = data.map(function (d, i) {
    return '<circle class="trend-dot" data-i="' + i + '" cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(d.value).toFixed(1) + '" r="3.5"/>';
  }).join('');

  elsChart.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  elsChart.svg.innerHTML = gridSvg
    + (data.length > 1 ? '<path class="trend-area" d="' + areaD + '"/>' : '')
    + '<path class="trend-line" d="' + pathD + '" fill="none"/>'
    + dotsSvg + endSvg + xLabelsSvg
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
    Array.prototype.forEach.call(dots, function (dot, di) { dot.setAttribute('r', di === i ? '6' : '3.5'); });
    var x = parseFloat(dots[i].getAttribute('cx')), y = parseFloat(dots[i].getAttribute('cy'));
    crosshair.setAttribute('x1', x); crosshair.setAttribute('x2', x); crosshair.setAttribute('opacity', '1');
    var scale = svg.getBoundingClientRect().width / viewboxW;
    elsChart.tooltip.style.left = (x * scale) + 'px';
    elsChart.tooltip.style.top = (y * scale) + 'px';
    elsChart.tooltip.textContent = d.label + ' — ' + d.value.toFixed(1) + ' ' + unit + (countLabel ? ' (' + countLabel(d) + ')' : '');
    elsChart.tooltip.hidden = false;
  }
  function hide() {
    Array.prototype.forEach.call(dots, function (dot) { dot.setAttribute('r', '3.5'); });
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
  renderTrendChart(data, { wrap: els.mprChartWrap, svg: els.mprChartSvg, tooltip: els.mprChartTooltip, empty: els.mprChartEmpty }, 'mpr', 'mpr');
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
function scoreTrendData(name, rounds, period) {
  var buckets = {};
  historyGames.forEach(function (g) {
    if (g.type !== 'score' || !g.finishedAt || g.players.indexOf(name) === -1) return;
    if (rounds !== null && g.variant !== rounds) return;
    var key = chartBucketKey(g.finishedAt, period);
    if (!buckets[key]) buckets[key] = { total: 0, count: 0 };
    buckets[key].total += computeX01State(g).totals[g.players.indexOf(name)];
    buckets[key].count++;
  });
  return Object.keys(buckets).sort().map(function (key) {
    var b = buckets[key];
    return { label: chartBucketLabel(key, period), value: b.total / b.count, count: b.count };
  });
}
function renderAvg3Chart() {
  var isScore = isScoreFilter(statsFilterType);
  var show = !!statsSelectedPlayer && (isX01Filter(statsFilterType) || isScore);
  els.avg3ChartCard.hidden = !show;
  if (!show) return;
  els.avg3ChartTitle.textContent = isScore ? 'Total moyen par partie' : 'Moyenne aux 3 fléchettes';
  if (isScore) {
    renderTrendChart(scoreTrendData(statsSelectedPlayer, scoreFilterRounds(statsFilterType), avg3ChartPeriod),
      { wrap: els.avg3ChartWrap, svg: els.avg3ChartSvg, tooltip: els.avg3ChartTooltip, empty: els.avg3ChartEmpty }, 'avg3', 'pts',
      function (d) { return d.count + (d.count > 1 ? ' parties' : ' partie'); });
    return;
  }
  var data = avg3TrendData(statsSelectedPlayer, x01FilterVariant(statsFilterType), avg3ChartPeriod, x01FilterDoubleOut(statsFilterType));
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

var checkoutChartPeriod = 'week';
function renderCheckoutChart() {
  var show = !!statsSelectedPlayer && isX01Filter(statsFilterType);
  els.checkoutChartCard.hidden = !show;
  if (!show) return;
  var data = checkoutTrendData(statsSelectedPlayer, x01FilterVariant(statsFilterType), checkoutChartPeriod, x01FilterDoubleOut(statsFilterType));
  renderTrendChart(data, { wrap: els.checkoutChartWrap, svg: els.checkoutChartSvg, tooltip: els.checkoutChartTooltip, empty: els.checkoutChartEmpty }, 'checkout', '%',
    function (d) { return d.count + ' tentative' + (d.count > 1 ? 's' : ''); });
}
els.checkoutPeriodSeg.addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  playClick();
  checkoutChartPeriod = b.dataset.period;
  Array.prototype.forEach.call(els.checkoutPeriodSeg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
  renderCheckoutChart();
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
  els.clockNumberStatsList.innerHTML = '<div class="heat-grid">' + rows.map(function (r) {
    return '<span class="heat-cell" style="--heat:' + Math.round(Math.min(1, r.pct / 60) * 80) + '%"><b>' + r.label + '</b><small>' + r.pct + '%</small></span>';
  }).join('') + '</div>';
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

// ---------- stats tab: summary by mode ----------
// A player's page opens on one card per mode they've played, each with its
// key figure over the last 10 games (fewer until they've played 10) and a
// sparkline of that figure game by game. Tapping a card opens that mode's
// detail (the tiles, records, bots, top list and charts below), filtered to
// that mode; 301/501 and Horloge add their own variant pills there.
var STATS_MODES = [
  { id: 'cricket', label: 'Cricket', filter: 'cricket', test: function (g) { return g.type === 'cricket'; } },
  { id: '301', label: '301', filter: '301', test: function (g) { return g.type === 'x01' && g.variant === 301; },
    subs: [['301', 'Toutes'], ['301-simple', 'Sortie simple'], ['301-double', 'Double sortie']] },
  { id: '501', label: '501', filter: '501', test: function (g) { return g.type === 'x01' && g.variant === 501; },
    subs: [['501', 'Toutes'], ['501-simple', 'Sortie simple'], ['501-double', 'Double sortie']] },
  { id: 'clock', label: 'Horloge', filter: 'clock-any', test: function (g) { return g.type === 'clock'; },
    subs: [['clock-any', 'Simple'], ['clock-double', 'Doubles'], ['clock-triple', 'Triples']] },
  { id: 'score', label: 'Score', filter: 'score', test: function (g) { return g.type === 'score'; } }
];
var STATS_FIGURE_LABELS = { cricket: 'MPR', x01: 'moyenne 3 fl.', clock: 'réussite', score: 'points / partie' };
var statsMode = null; // id of the mode whose detail is open, or null for the summary
function statsFigureKind(filter) {
  if (filter === 'cricket') return 'cricket';
  if (isX01Filter(filter)) return 'x01';
  if (isClockFilter(filter)) return 'clock';
  if (isScoreFilter(filter)) return 'score';
  return null;
}
// one game's contribution to a mode's key figure, as num/den so several
// games add up on real totals rather than averaging per-game averages
function gameFigurePart(kind, g, pi) {
  if (kind === 'cricket') { var cs = cricketDartStats(g)[pi]; return [cs.marks * 3, cs.darts]; }
  if (kind === 'x01') { var xs = x01DartStats(g)[pi]; return [xs.scored * 3, xs.darts]; }
  if (kind === 'clock') { var ks = computeClockState(g); return [Math.min(ks.hits[pi], 21) * 100, ks.darts[pi]]; }
  return [computeX01State(g).totals[pi], 1];
}
function statsFigure(kind, games, name) {
  var num = 0, den = 0;
  games.forEach(function (g) { var part = gameFigurePart(kind, g, g.players.indexOf(name)); num += part[0]; den += part[1]; });
  return den ? num / den : 0;
}
function formatStatsFigure(kind, v) {
  if (kind === 'clock') return Math.round(v) + ' %';
  if (kind === 'score') return String(Math.round(v));
  return v.toFixed(1);
}
function sparklineSvg(values) {
  if (values.length < 2) return '';
  var min = Math.min.apply(null, values), max = Math.max.apply(null, values), span = (max - min) || 1;
  var pts = values.map(function (v, i) { return (i * 100 / (values.length - 1)).toFixed(1) + ',' + (22 - 20 * (v - min) / span).toFixed(1); });
  return '<svg class="stats-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts.join(' ') + '"/></svg>';
}
function renderStatsSummary() {
  var name = statsSelectedPlayer;
  var games = historyGames.filter(function (g) { return g.players.indexOf(name) !== -1; });
  var oldest = games.reduce(function (m, g) { return g.finishedAt && (!m || g.finishedAt < m) ? g.finishedAt : m; }, null);
  els.statsMeta.textContent = games.length + (games.length > 1 ? ' parties' : ' partie')
    + (oldest ? ' depuis le ' + new Date(oldest).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '');
  var cards = STATS_MODES.map(function (mode) {
    // Score totals depend on the game length, so its card shows the 3-dart average instead
    var kind = mode.id === 'score' ? 'x01' : statsFigureKind(mode.filter);
    var mg = games.filter(mode.test).sort(function (a, b) { return (b.finishedAt || 0) - (a.finishedAt || 0); });
    if (!mg.length) return '';
    var recent = mg.slice(0, 10);
    var series = recent.slice().reverse().map(function (g) { return statsFigure(kind, [g], name); });
    return '<button type="button" class="stats-mode-card" data-mode="' + mode.id + '">'
      + '<span class="mode-logo">' + modeLogoSvg(mode.id) + '</span>'
      + '<span class="smc-name"><b>' + mode.label + '</b><span>' + mg.length + (mg.length > 1 ? ' parties' : ' partie') + ' · global ' + formatStatsFigure(kind, statsFigure(kind, mg, name)) + '</span></span>'
      + '<span class="smc-value"><b>' + formatStatsFigure(kind, statsFigure(kind, recent, name)) + '</b><span>' + STATS_FIGURE_LABELS[kind] + ' · ' + recent.length + ' dernières</span></span>'
      + sparklineSvg(series) + '</button>';
  }).join('');
  els.statsModeCards.innerHTML = cards || '<p class="history-empty">Aucune partie terminée pour l\'instant.</p>';
}
function showStatsSummary() {
  statsMode = null;
  els.statsBackBtn.textContent = '← Joueurs';
  els.statsSummary.hidden = false;
  els.statsModeView.hidden = true;
  els.statsPlayerName.textContent = statsSelectedPlayer;
  renderStatsSummary();
}
function openStatsMode(id) {
  var mode = STATS_MODES.filter(function (m) { return m.id === id; })[0];
  if (!mode) return;
  statsMode = id;
  statsFilterType = mode.filter;
  els.statsBackBtn.textContent = '← Résumé';
  els.statsSummary.hidden = true;
  els.statsModeView.hidden = false;
  els.statsModeLogo.innerHTML = modeLogoSvg(mode.id);
  els.statsModeTitle.textContent = mode.label;
  renderStatsSubPills(mode);
  renderStatsDetail();
  window.scrollTo(0, 0);
}
function scoreSubsFor(name) {
  var lengths = {};
  historyGames.forEach(function (g) { if (g.type === 'score' && g.players.indexOf(name) !== -1) lengths[g.variant] = true; });
  var list = Object.keys(lengths).map(Number).sort(function (a, b) { return a - b; });
  return list.length > 1 ? [['score', 'Toutes']].concat(list.map(function (n) { return ['score-' + n, n + ' lancers']; })) : null;
}
function renderStatsSubPills(mode) {
  var subs = mode.id === 'score' ? scoreSubsFor(statsSelectedPlayer) : mode.subs;
  els.statsSubPills.hidden = !subs;
  els.statsSubPills.innerHTML = (subs || []).map(function (sub) {
    return '<button type="button" data-filter="' + sub[0] + '" class="' + (sub[0] === statsFilterType ? 'active' : '') + '">' + sub[1] + '</button>';
  }).join('');
}

function showStatsList() {
  statsSelectedPlayer = null;
  statsMode = null;
  els.statsPlayerListWrap.hidden = false;
  els.statsPlayerDetail.hidden = true;
  renderStatsPlayerList();
}
function showStatsDetail(name) {
  statsSelectedPlayer = name;
  els.deletePlayerConfirm.hidden = true;
  els.statsPlayerListWrap.hidden = true;
  els.statsPlayerDetail.hidden = false;
  showStatsSummary();
}
function refreshStatsView() {
  if (currentTab !== 'stats') return;
  if (!statsSelectedPlayer) renderStatsPlayerList();
  else if (statsMode) renderStatsDetail();
  else renderStatsSummary();
}

els.statsPlayerList.addEventListener('click', function (e) {
  var b = e.target.closest('[data-player]');
  if (!b) return;
  showStatsDetail(b.dataset.player);
});
els.statsModeCards.addEventListener('click', function (e) {
  var b = e.target.closest('[data-mode]');
  if (!b) return;
  playClick();
  openStatsMode(b.dataset.mode);
});
els.statsSubPills.addEventListener('click', function (e) {
  var b = e.target.closest('[data-filter]');
  if (!b) return;
  playClick();
  statsFilterType = b.dataset.filter;
  Array.prototype.forEach.call(els.statsSubPills.children, function (x) { x.classList.toggle('active', x === b); });
  renderStatsDetail();
});
els.statsBackBtn.addEventListener('click', function () {
  playClick();
  if (statsMode) showStatsSummary(); else showStatsList();
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
function computeRanking(statKey, x01Filter) {
  var rows = uniquePlayerNames().map(function (name) {
    if (statKey === 'mpr') {
      var cs = statsForPlayer(name, 'cricket');
      return { name: name, games: cs.played, value: cs.mpr, display: cs.mpr.toFixed(1) + ' mpr' };
    }
    if (statKey === 'avg3') {
      var xs = statsForPlayer(name, x01Filter || 'x01');
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
  var isAvg3 = els.rankingStat.value === 'avg3';
  els.rankingRoundsField.hidden = !isBestScore;
  els.rankingClockField.hidden = !isClockDarts;
  els.rankingX01Field.hidden = !isAvg3;
  if (isBestScore) { renderBestScores(); return; }
  if (isClockDarts) { renderBestClock(); return; }

  var rows = computeRanking(els.rankingStat.value, els.rankingX01Filter.value);
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
els.rankingX01Filter.addEventListener('change', renderRanking);
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
  renderHistory();
  refreshStatsView();
  refreshPlayersDatalist(); // not the inputs themselves: that would steal focus mid-typing
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
// db/usingDb are already set by store.js at load time (Firebase init is
// synchronous there), so this just reacts to what that came out to.
function init() {
  setSoundEnabled(soundEnabled);
  els.offlineNotice.hidden = usingDb;

  if (usingDb) {
    db.collection('games').where('status', '==', 'in_progress').limit(1).onSnapshot(function (snap) {
      if (snap.empty) { onPendingSnapshot(null); return; }
      var d = snap.docs[0];
      onPendingSnapshot(Object.assign({ id: d.id }, d.data()));
    }, function () { /* degrade silently */ });

    // No orderBy here on purpose: status==+orderBy is a composite query that
    // Firestore needs a manually-created index for, which a fresh project
    // doesn't have. A single-field equality filter needs no index, and 500
    // finished games is nothing to sort client-side — same approach the
    // memory fallback below already uses.
    db.collection('games').where('status', '==', 'finished').limit(500).onSnapshot(function (snap) {
      var list = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      list.sort(function (a, b) { return (b.finishedAt || 0) - (a.finishedAt || 0); });
      onHistorySnapshot(list);
    }, function () { /* degrade silently */ });
  } else {
    renderPendingFromMemory();
    renderHistoryFromMemory();
  }
}

// ---------- update check ----------
// GitHub Pages lets browsers cache index.html for 10 minutes, so after a
// deploy a phone can keep running the old app. On load and whenever the tab
// comes back to the foreground, refetch this very page URL past the cache
// (same cache entry as the document: /darts-score/ and /index.html are
// cached separately) and compare its app-version. If it changed, that
// cache: 'reload' fetch has just stored the new page, so a plain reload
// picks it up, and css/js follow thanks to their ?v=. sessionStorage guards
// against a reload loop if a stale copy still comes back. Skipped mid bot
// turn so a turn is never cut in half.
var APP_VERSION = (document.querySelector('meta[name="app-version"]') || {}).content || '';
function checkForUpdate() {
  if (!APP_VERSION || botTurnRunning || location.protocol === 'file:') return;
  fetch(location.href.split('#')[0], { cache: 'reload' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
    var m = html.match(/<meta name="app-version" content="([^"]+)"/);
    if (!m || m[1] === APP_VERSION) return;
    var tried = null;
    try { tried = sessionStorage.getItem('tv_reloadedFor'); } catch (e) { }
    if (tried === m[1]) return;
    try { sessionStorage.setItem('tv_reloadedFor', m[1]); } catch (e) { }
    location.reload();
  }).catch(function () { /* offline: keep running what we have */ });
}
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') checkForUpdate(); });

init();
checkForUpdate();
