"use strict";

// Shared mutable state, read and written across the cricket/x01/app modules.
var activeGame = null;   // {id, ...fields} of the game loaded in the Play view, whatever its status
var activeGameUnsub = null; // unsubscribe fn for the activeGame watch, so it can be swapped/stopped
var pendingGame = null;  // the in_progress game (if any) — drives the home "resume" banner only
var historyGames = [];   // finished games, most recent first
var currentTab = 'home'; // 'home' | 'history' | 'play'
var selectedMult = 1;    // cricket: 1 = simple, 2 = double, 3 = triple
var x01Input = '';       // 301/501: running turn total, however it was entered
var x01EntryMode = 'total'; // 301/501: 'total' (type the 3-dart sum) | 'darts' (tap each dart)
var x01Darts = [];       // 301/501 dart-by-dart mode: values entered so far this turn (max 3)
var x01DartMult = [];    // parallel to x01Darts: the multiplier each of those darts was thrown with (0 for a miss) — lets a checkout auto-detect whether the last dart was a double instead of asking
var pendingAttempt = null; // 301/501: turn total awaiting a "closed on a double?" confirmation
var statsSelectedPlayer = null; // name shown in the Stats tab detail view, or null for the player list
var statsFilterType = 'all';    // 'all' | 'cricket' | '301' | '501' | 'score' | 'clock-any' | 'clock-double' | 'clock-triple' — mode filter in the Stats detail view
