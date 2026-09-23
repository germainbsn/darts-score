 "use strict";

// Central lookup table of every element the app touches, populated once
// the DOM is parsed (this script is loaded at the end of <body>).
var els = {};
[
  'mainTabs', 'offlineNotice', 'activeBanner', 'activeBannerText', 'resumeBtn',
  'homeAbandonBtn', 'homeAbandonConfirm', 'homeAbandonYes', 'homeAbandonNo',
  'setupForm', 'typeSeg', 'doubleOutField', 'doubleOutCheck', 'playerMinus', 'playerPlus', 'playerCount', 'nameInputs', 'playersDatalist',
  'matchLegsField', 'legsMinus', 'legsPlus', 'legsCount', 'matchSetsField', 'setsMinus', 'setsPlus', 'setsCount',
  'statTiles', 'historyList', 'deleteGameConfirm', 'deleteGameConfirmText', 'deleteGameYes', 'deleteGameNo', 'backBtn', 'abandonBtn', 'abandonConfirm', 'abandonYes', 'abandonNo', 'playTitle', 'winnerBanner', 'topBadge', 'postGameActions', 'postGameUndoBtn', 'playAgainBtn',
  'gameChartCard', 'gameChartTitle', 'gameChartLegend', 'gameChartWrap', 'gameChartSvg', 'gameChartTooltip',
  'cricketBoard', 'cricketTable',
  'dartPad', 'multChips', 'numGrid', 'missBtn', 'undoCricketBtn', 'cricketTurnLabel', 'dartDots',
  'x01Board', 'x01Players', 'checkoutHint', 'x01Pad', 'x01Display', 'x01Keypad', 'checkoutConfirm', 'checkoutYes', 'checkoutNo',
  'x01Submit', 'undoX01Btn', 'throwLog',
  'x01EntryModeSeg', 'x01TotalMode', 'x01DartMode', 'dartSlots', 'x01MultChips', 'x01DartGrid',
  'statsPlayerListWrap', 'statsPlayerList', 'statsPlayerDetail', 'statsBackBtn', 'statsPlayerName',
  'deletePlayerBtn', 'deletePlayerConfirm', 'deletePlayerConfirmText', 'deletePlayerYes', 'deletePlayerNo',
  'statsFilterType', 'statsGamesPlayed', 'statsWinPct', 'statsThirdTile', 'statsThirdLabel', 'statsThirdValue',
  'statsTopCard', 'statsTopTitle', 'statsTopList',
  'mprChartCard', 'mprPeriodSeg', 'mprChartWrap', 'mprChartSvg', 'mprChartTooltip', 'mprChartEmpty',
  'avg3ChartCard', 'avg3PeriodSeg', 'avg3ChartWrap', 'avg3ChartSvg', 'avg3ChartTooltip', 'avg3ChartEmpty',
  'clockChartCard', 'clockChartPeriodSeg', 'clockChartWrap', 'clockChartSvg', 'clockChartTooltip', 'clockChartEmpty',
  'clockNumberStatsCard', 'clockNumberPeriodSeg', 'clockNumberSortSeg', 'clockNumberStatsList',
  'rankingStat', 'rankingList', 'rankingX01Field', 'rankingX01Filter', 'rankingRoundsField', 'rankingRoundsFilter', 'rankingClockField', 'rankingClockFilter',
  'roundsField', 'roundsCount', 'roundsMinus', 'roundsPlus', 'soundToggle',
  'clockFinishField', 'clockFinishSeg', 'clockMultiplierField', 'clockMultiplierSeg', 'clockOrderField', 'clockOrderSeg', 'clockBoard', 'clockPlayers', 'clockPad', 'clockHitBtn', 'clockMissBtn', 'clockMiss2Btn', 'clockMiss3Btn', 'undoClockBtn', 'clockTurnLabel', 'clockDartDots'
].forEach(function (id) {
  els[id] = document.getElementById(id);
});
els.viewHome = document.getElementById('view-home');
els.viewHistory = document.getElementById('view-history');
els.viewStats = document.getElementById('view-stats');
els.viewRanking = document.getElementById('view-ranking');
els.viewPlay = document.getElementById('view-play');

// Scrolls the current player's card into the middle of a horizontally
// scrolling .x01-players row — but only once per turn (tracked via a data
// attribute on the container) so it doesn't fight a player manually scrolling
// to check someone else's card while their own turn is still live.
function focusCurrentPlayerCard(container, gameId, currentIndex, finished) {
  var key = gameId + ':' + (finished ? 'done' : currentIndex);
  if (container.dataset.focusKey === key) return;
  container.dataset.focusKey = key;
  var cur = container.querySelector('.x01-card.cur') || container.lastElementChild;
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}
