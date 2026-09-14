"use strict";

// Persistence layer. Uses the Claude Artifact `db` capability when the page
// runs inside a published Artifact (real-time sync across devices); falls
// back to an in-memory store for local viewing/testing outside that runtime.
var db = null;
var usingDb = false;
var memGames = []; // fallback in-memory store
var memIdSeq = 1;
var memWatchId = null; // id currently watched via Store.watchGame, memory mode
var memWatchCb = null;

function nowTs() { return Date.now(); }

var Store = {
  async createGame(data) {
    if (usingDb) {
      var ref = await db.collection('games').add(data);
      return ref.id;
    }
    var id = 'local-' + (memIdSeq++);
    memGames.push(Object.assign({ id: id }, data));
    renderPendingFromMemory();
    renderHistoryFromMemory();
    renderWatchedFromMemory();
    return id;
  },
  async updateGame(id, patch) {
    if (usingDb) {
      await db.collection('games').doc(id).update(patch);
      return;
    }
    var g = memGames.find(function (x) { return x.id === id; });
    if (g) { Object.assign(g, patch); }
    renderPendingFromMemory();
    renderHistoryFromMemory();
    renderWatchedFromMemory();
  },
  // Permanently remove one game — used to purge a deleted player's history.
  async deleteGame(id) {
    if (usingDb) {
      await db.collection('games').doc(id).delete();
      return;
    }
    memGames = memGames.filter(function (x) { return x.id !== id; });
    renderPendingFromMemory();
    renderHistoryFromMemory();
    renderWatchedFromMemory();
  },
  // Subscribe to one specific game by id, regardless of its status — used by
  // the Play view so a game stays visible (winner banner, board, stats) once
  // it finishes, instead of vanishing the moment it leaves the "in_progress"
  // query. Returns an unsubscribe function.
  watchGame(id, cb) {
    if (usingDb) {
      return db.collection('games').doc(id).onSnapshot(function (snap) {
        cb(snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null);
      });
    }
    memWatchId = id;
    memWatchCb = cb;
    var g = memGames.find(function (x) { return x.id === id; });
    cb(g ? Object.assign({}, g) : null);
    return function () {
      if (memWatchCb === cb) { memWatchId = null; memWatchCb = null; }
    };
  }
};

function renderPendingFromMemory() {
  var g = memGames.find(function (x) { return x.status === 'in_progress'; });
  onPendingSnapshot(g ? Object.assign({ id: g.id }, g) : null);
}
function renderHistoryFromMemory() {
  var list = memGames.filter(function (x) { return x.status === 'finished'; })
    .sort(function (a, b) { return (b.finishedAt || 0) - (a.finishedAt || 0); });
  onHistorySnapshot(list.map(function (g) { return Object.assign({ id: g.id }, g); }));
}
function renderWatchedFromMemory() {
  if (!memWatchId || !memWatchCb) return;
  var g = memGames.find(function (x) { return x.id === memWatchId; });
  memWatchCb(g ? Object.assign({}, g) : null);
}
