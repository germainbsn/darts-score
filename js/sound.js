"use strict";

// Lightweight sound effects synthesized with the Web Audio API — nothing to
// fetch, so nothing the artifact sandbox can block. One shared AudioContext,
// created lazily on first use (browsers require a user gesture first, and
// every call site here is already inside a click handler).
var audioCtx = null;
var soundEnabled = true;
try { soundEnabled = localStorage.getItem('tv_sound') !== 'off'; } catch (e) {}

function ensureAudioCtx() {
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) { audioCtx = new Ctx(); }
  if (audioCtx.state === 'suspended') { audioCtx.resume(); }
  return audioCtx;
}

function playTone(freq, duration, type, peak) {
  if (!soundEnabled) return;
  var ctx = ensureAudioCtx();
  if (!ctx) return;
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.02);
}

function playHit() { playTone(880, 0.12, 'triangle', 0.18); }
function playMiss() { playTone(140, 0.2, 'sawtooth', 0.15); }
function playClick() { playTone(660, 0.04, 'square', 0.07); }
function playWin() {
  [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, i) {
    setTimeout(function () { playTone(freq, 0.18, 'triangle', 0.2); }, i * 110);
  });
}

// Spoken score call-out ("120", "Raté") for 301/501 and Score turns, like a
// scorer calling out the total — uses the browser's built-in speech synthesis,
// so nothing to fetch.
function speak(text) {
  if (!soundEnabled) return;
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch (e) { /* speech synthesis unavailable in this view */ }
}

function setSoundEnabled(on) {
  soundEnabled = on;
  try { localStorage.setItem('tv_sound', on ? 'on' : 'off'); } catch (e) {}
  if (els.soundToggle) {
    els.soundToggle.textContent = on ? '🔊' : '🔇';
    els.soundToggle.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son');
  }
}
