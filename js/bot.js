"use strict";

// Pure bot AI: skill table + turn simulators. No Firestore, no DOM — the
// orchestration (delays between darts, writing the result) lives in app.js
// and reuses the exact same commit functions a human's clicks would call.

// One row per level (1-10): probability of actually landing the intended
// segment for a single/double/triple attempt, plus `wild`, the share of darts
// that ignore the aim altogether (see wildDart). A miss doesn't vanish into
// nothing — rollDart() below resolves it into the closest plausible outcome,
// same as a real dart that drifted a little instead of teleporting.
// Calibrated by simulating thousands of 501 legs (sortie simple): the 3-dart
// average over a whole leg lands around the figure in each row's comment,
// 25 to 115 in steps of 10 — a mean, not a cap: single legs vary a lot.
// Double-out runs roughly 8-13 points lower (more darts spent on doubles).
var BOT_LEVELS = [
  { single: .36, double: .14, triple: 0, wild: .72 },  // ~25
  { single: .57, double: .21, triple: .04, wild: .45 },  // ~35
  { single: .67, double: .27, triple: .10, wild: .27 },  // ~45
  { single: .74, double: .33, triple: .17, wild: .17 },  // ~55
  { single: .78, double: .37, triple: .23, wild: .11 },  // ~65
  { single: .83, double: .42, triple: .30, wild: .06 },  // ~75
  { single: .86, double: .46, triple: .37, wild: .03 },  // ~85
  { single: .90, double: .50, triple: .44, wild: .01 },  // ~95
  { single: .93, double: .54, triple: .51, wild: .01 },  // ~105
  { single: .96, double: .58, triple: .59, wild: 0 }   // ~115
];
function botSkill(level) { return BOT_LEVELS[Math.max(1, Math.min(10, level)) - 1]; }

// A dartboard neighbor of `num` on the 1-20 ring, for "missed but landed
// next door" outcomes. Falls back to `num` itself for the bull (25).
var DART_RING = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
function ringNeighbor(num) {
  var i = DART_RING.indexOf(num);
  if (i === -1) return num;
  var dir = Math.random() < 0.5 ? -1 : 1;
  return DART_RING[(i + dir + DART_RING.length) % DART_RING.length];
}

// Resolves one dart aimed at (number, intendedMult) into what actually
// lands, given a skill level. intendedMult: 1 = single, 2 = double, 3 =
// triple. Returns {number, mult} — mult 0 means a complete miss (0 points).
// A "wild" dart (skill.wild) ignores the aim altogether: a random segment,
// or off the board — what keeps the beginner levels genuinely beginner.
function wildDart() {
  var r = Math.random();
  if (r < 0.30) return { number: 0, mult: 0 };
  var num = 1 + Math.floor(Math.random() * 20);
  return { number: num, mult: r < 0.90 ? 1 : (r < 0.95 ? 2 : 3) };
}
function rollDart(number, intendedMult, level) {
  var skill = botSkill(level);
  var isBull = number === 25;
  if (Math.random() < skill.wild) return wildDart();
  if (intendedMult === 3) {
    if (Math.random() < skill.triple) return { number: number, mult: 3 };
    var r = Math.random();
    if (r < 0.65) return { number: number, mult: 1 };
    if (r < 0.85) return { number: ringNeighbor(number), mult: 1 };
    return { number: 0, mult: 0 };
  }
  if (intendedMult === 2) {
    if (Math.random() < skill.double) return { number: number, mult: 2 };
    var r2 = Math.random();
    if (r2 < 0.55) return { number: number, mult: 1 };
    if (r2 < 0.75) return { number: isBull ? number : ringNeighbor(number), mult: 1 };
    return { number: 0, mult: 0 };
  }
  // intendedMult === 1
  if (Math.random() < skill.single) return { number: number, mult: 1 };
  if (!isBull && Math.random() < 0.7) return { number: ringNeighbor(number), mult: 1 };
  return { number: 0, mult: 0 };
}

// ---------- 301/501/Score ----------
// Up to 3 darts for one turn. Goes for a checkout path once one exists for
// the darts left in the turn (reuses x01.js's own solver so the bot "sees"
// exactly the same finish a human would be hinted); otherwise goes for
// volume on T20, steering off it at higher levels to avoid leaving a bare 1
// when doubleOut is on (the classic beginner trap).
function simulateX01BotTurn(remaining, doubleOut, level) {
  var darts = [];
  var left = remaining;
  for (var i = 0; i < 3 && left > 0; i++) {
    var dartsLeftInTurn = 3 - i;
    var aimNum = 20, aimMult = 3;
    var path = suggestCheckout(left, doubleOut, dartsLeftInTurn);
    if (path) {
      var label = path[0];
      if (label === 'B') { aimNum = 25; aimMult = 2; }
      else if (label === '25') { aimNum = 25; aimMult = 1; }
      else if (label.charAt(0) === 'D') { aimMult = 2; aimNum = parseInt(label.slice(1), 10); }
      else if (label.charAt(0) === 'T') { aimMult = 3; aimNum = parseInt(label.slice(1), 10); }
      else { aimMult = 1; aimNum = parseInt(label, 10); }
    } else if (doubleOut && level >= 4 && left - 60 === 1) {
      aimNum = 19; aimMult = 3;
    } else if (!doubleOut && left < 60) {
      // no finish in the darts left (e.g. 59 with one dart): the biggest
      // treble that can't bust, to leave an easy finish next turn
      aimNum = Math.floor(left / 3); aimMult = 3;
    }
    var got = rollDart(aimNum, aimMult, level);
    var value = got.mult === 0 ? 0 : dartValue(got.number, got.mult);
    darts.push({ value: value, mult: got.mult, isDouble: got.mult === 2 });
    left = left - value;
    if (left <= 0) break;
  }
  return darts;
}

// ---------- Cricket ----------
// marksForBot: this bot's own [20,19,18,17,16,15,25] mark counts (0-3).
// closedByAllOthers(numIdx): true if every OTHER player already has that
// number closed (so hitting it further would score nothing).
function simulateCricketBotTurn(marksForBot, closedByAllOthers, level) {
  var marks = marksForBot.slice();
  var darts = [];
  for (var d = 0; d < 3; d++) {
    var targetIdx = -1;
    for (var i = 0; i < CRICKET_NUMS.length; i++) {
      if (marks[i] < 3) { targetIdx = i; break; }
    }
    if (targetIdx === -1) {
      for (var j = 0; j < CRICKET_NUMS.length; j++) {
        if (!closedByAllOthers(j)) { targetIdx = j; break; }
      }
      if (targetIdx === -1) targetIdx = 0; // everything closed by everyone — aim 20, harmless
    }
    var num = CRICKET_NUMS[targetIdx];
    var isBull = num === 25;
    // Going for triples is a deliberate risk a player takes on more often as
    // they improve — a smooth ramp (0% at level 1, 100% at level 10) instead
    // of a hard cutoff, so MPR climbs gradually instead of jumping.
    var tripleChance = (level - 1) / 9;
    var intendedMult = isBull ? 1 : (Math.random() < tripleChance ? 3 : 1);
    var got = rollDart(num, intendedMult, level);
    // A miss can drift to a neighbor that isn't even a Cricket number (e.g.
    // aiming 20, landing on 1) — that's a wasted dart under Cricket's rules
    // (only 15-20+Bull ever score), so it must log as a real miss, not as a
    // "hit" on a number outside the set (which would silently go nowhere).
    var gi = got.mult > 0 ? CRICKET_NUMS.indexOf(got.number) : -1;
    if (gi === -1) {
      darts.push({ number: 0, mult: 0 });
    } else {
      darts.push({ number: got.number, mult: got.mult });
      marks[gi] = Math.min(3, marks[gi] + got.mult);
    }
  }
  return darts;
}

// ---------- Horloge ----------
// hitsAlready: this bot's current hit count (0-20, or already >=21 never
// called). Stops early once a simulated hit reaches 21, same as the real
// game ending mid-turn.
function simulateClockBotTurn(game, hitsAlready, level) {
  var hits = hitsAlready;
  var darts = [];
  var reqMult = game.clockMultiplier === 'double' ? 2 : game.clockMultiplier === 'triple' ? 3 : 1;
  for (var d = 0; d < 3 && hits < 21; d++) {
    var num = clockTargetAt(game, hits);
    var isFinish = num > 20;
    var targetNum = isFinish ? 25 : num;
    var intendedMult = isFinish ? (game.finishMode === 'bull' ? 2 : 1) : reqMult;
    var requiredMult = isFinish ? (game.finishMode === 'bull' ? 2 : game.finishMode === 'outer' ? 1 : null) : reqMult;
    var got = rollDart(targetNum, intendedMult, level);
    var hit = got.mult > 0 && got.number === targetNum && (requiredMult == null || got.mult === requiredMult);
    darts.push({ hit: hit });
    if (hit) hits++;
  }
  return darts;
}
