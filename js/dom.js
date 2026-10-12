 "use strict";

// Central lookup table of every element the app touches, populated once
// the DOM is parsed (this script is loaded at the end of <body>).
var els = {};
[
  'confettiLayer',
  'mainTabs', 'offlineNotice', 'activeBanner', 'activeBannerText', 'resumeBtn',
  'homeAbandonBtn', 'homeAbandonConfirm', 'homeAbandonYes', 'homeAbandonNo',
  'setupForm', 'typeSeg', 'doubleOutField', 'doubleOutPills', 'playerPlus', 'nameInputs', 'playersDatalist',
  'setupStep1', 'setupStep2', 'setupBackBtn', 'modeCrumb', 'botAddBtn', 'rulesTitle', 'rulesGroup', 'setupSummary',
  'matchLegsField', 'legsMinus', 'legsPlus', 'legsCount', 'matchSetsField', 'setsMinus', 'setsPlus', 'setsCount',
  'historyList', 'deleteGameConfirm', 'deleteGameConfirmText', 'deleteGameYes', 'deleteGameNo', 'backBtn', 'abandonBtn', 'abandonConfirm', 'abandonYes', 'abandonNo', 'playTitle', 'winnerBanner', 'topBadge', 'postGameActions', 'postGameUndoBtn', 'playAgainBtn',
  'matchRecapCard', 'matchRecapHint', 'matchRecapTable',
  'gameChartCard', 'gameChartTitle', 'gameChartLegend', 'gameChartWrap', 'gameChartSvg', 'gameChartTooltip',
  'cricketBoard', 'cricketTable',
  'dartPad', 'multChips', 'numGrid', 'missBtn', 'missTurnBtn', 'undoCricketBtn', 'cricketTurnLabel', 'dartDots',
  'x01Board', 'x01OutSeg', 'x01Players', 'x01Slots', 'x01Pad', 'x01Display', 'x01Keypad', 'checkoutConfirm', 'checkoutYes', 'checkoutNo',
  'x01Submit', 'undoX01Btn', 'throwLog',
  'x01EntryModeSeg', 'x01TotalMode', 'x01DartMode', 'x01MultChips', 'x01DartGrid', 'x01DartMissBtn', 'x01DartUndoBtn',
  'statsPlayerListWrap', 'statsPlayerList', 'statsPlayerDetail', 'statsBackBtn', 'statsPlayerName',
  'deletePlayerBtn', 'deletePlayerConfirm', 'deletePlayerConfirmText', 'deletePlayerYes', 'deletePlayerNo',
  'statsFilterType', 'statsGamesPlayed', 'statsWinPct', 'statsThirdTile', 'statsThirdLabel', 'statsThirdValue',
  'statsFourthTile', 'statsFourthLabel', 'statsFourthValue',
  'statsMilestonesCard', 'statsFirst9', 'statsBestCheckout', 'stats180', 'stats140', 'stats100',
  'statsBotCard', 'statsBotList',
  'statsTopCard', 'statsTopTitle', 'statsTopList',
  'mprChartCard', 'mprPeriodSeg', 'mprChartWrap', 'mprChartSvg', 'mprChartTooltip', 'mprChartEmpty',
  'avg3ChartCard', 'avg3PeriodSeg', 'avg3ChartWrap', 'avg3ChartSvg', 'avg3ChartTooltip', 'avg3ChartEmpty',
  'checkoutChartCard', 'checkoutPeriodSeg', 'checkoutChartWrap', 'checkoutChartSvg', 'checkoutChartTooltip', 'checkoutChartEmpty',
  'clockChartCard', 'clockChartPeriodSeg', 'clockChartWrap', 'clockChartSvg', 'clockChartTooltip', 'clockChartEmpty',
  'clockNumberStatsCard', 'clockNumberPeriodSeg', 'clockNumberSortSeg', 'clockNumberStatsList',
  'rankingStat', 'rankingList', 'rankingX01Field', 'rankingX01Filter', 'rankingRoundsField', 'rankingRoundsFilter', 'rankingClockField', 'rankingClockFilter',
  'roundsField', 'roundsCount', 'roundsMinus', 'roundsPlus', 'soundToggle', 'voiceBtn', 'menuBtn', 'topbarWhere', 'drawer', 'drawerScrim', 'drawerSoundBtn',
  'voiceBackBtn', 'voiceProgress', 'voiceCurrent', 'voiceStatus', 'voiceRecBtn', 'voicePlayBtn', 'voicePrevBtn', 'voiceNextBtn', 'voiceDeleteBtn', 'voiceGrid',
  'clockFinishField', 'clockFinishSeg', 'clockMultiplierField', 'clockMultiplierSeg', 'clockOrderField', 'clockOrderSeg', 'clockBoard', 'clockPlayers', 'clockPad', 'clockHitBtn', 'clockMissBtn', 'clockMiss2Btn', 'clockMiss3Btn', 'undoClockBtn', 'clockTurnLabel', 'clockDartDots', 'clockTargetBoard', 'clockStats'
].forEach(function (id) {
  els[id] = document.getElementById(id);
});
els.viewHome = document.getElementById('view-home');
els.viewHistory = document.getElementById('view-history');
els.viewStats = document.getElementById('view-stats');
els.viewRanking = document.getElementById('view-ranking');
els.viewPlay = document.getElementById('view-play');
els.viewVoice = document.getElementById('view-voice');

// Scrolls the current player's tab/card into the middle of a horizontally
// scrolling row of players — but only once per turn (tracked via a data
// attribute on the container) so it doesn't fight a player manually scrolling
// to check someone else's card while their own turn is still live.
function focusCurrentPlayerCard(container, gameId, currentIndex, finished) {
  var key = gameId + ':' + (finished ? 'done' : currentIndex);
  if (container.dataset.focusKey === key) return;
  container.dataset.focusKey = key;
  var cur = container.querySelector('.cur') || container.lastElementChild;
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}
