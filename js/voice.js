"use strict";

// The user's own recorded voice for the 301/501/Score call-out ("120",
// "Raté"), replacing the browser's synthesized voice on human turns — bots
// keep the synthesized one. One Firestore doc per score in `voiceClips`,
// holding the compressed recording inline as a data URL: Cloud Storage
// would need the paid Blaze plan, and ~170 one-second clips fit easily in
// Firestore's free tier. Recorded and managed from the 🎙 view.
var VOICE_BUST_KEY = 'bust';
// every total three darts can actually make, 0-180 — the 9 impossible ones
// (163, 166, 169, 172, 173, 175, 176, 178, 179) aren't worth recording;
// typed anyway, they fall back to the synthesized voice
var VOICE_SCORES = (function () {
  var one = [0, 25, 50];
  for (var n = 1; n <= 20; n++) { one.push(n, n * 2, n * 3); }
  var seen = {};
  one.forEach(function (a) { one.forEach(function (b) { one.forEach(function (c) { seen[a + b + c] = true; }); }); });
  return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
})();
var VOICE_KEYS = VOICE_SCORES.map(String).concat([VOICE_BUST_KEY]);
var VOICE_MAX_MS = 4000; // a score call-out is ~1s; stop on our own if the user forgets
var voiceClips = {};   // key -> {data, mime, start, end} as stored in Firestore
var voiceBuffers = {}; // key -> Promise<AudioBuffer>, decoded lazily on first play
var voiceSource = null; // the clip currently playing, so a new call-out cuts it off
var voiceSelected = null; // key shown in the recorder
var voiceStream = null; // mic stream, kept open while the view is shown so each take starts instantly
var voiceRec = null;   // {recorder, chunks, key, timer} while recording

function voiceLabel(key) { return key === VOICE_BUST_KEY ? 'Raté' : key; }

function watchVoiceClips() {
  if (!usingDb) return;
  db.collection('voiceClips').onSnapshot(function (snap) {
    snap.docChanges().forEach(function (ch) {
      delete voiceBuffers[ch.doc.id];
      if (ch.type === 'removed') delete voiceClips[ch.doc.id];
      else voiceClips[ch.doc.id] = ch.doc.data();
    });
    if (currentTab === 'voice') renderVoiceView();
  }, function () { /* no access (rules) or offline: synthesized voice only */ });
}

function voiceBuffer(key) {
  if (!voiceBuffers[key]) {
    var ctx = ensureAudioCtx();
    voiceBuffers[key] = fetch(voiceClips[key].data)
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { return ctx.decodeAudioData(ab); });
    voiceBuffers[key].catch(function () { delete voiceBuffers[key]; });
  }
  return voiceBuffers[key];
}

function stopVoicePlayback() {
  if (voiceSource) { try { voiceSource.stop(); } catch (e) {} voiceSource = null; }
}

// Plays the recorded clip for `key`, trimmed to the speech found when it was
// recorded. Returns false (nothing played) when there's no clip, so the
// caller can fall back to speech synthesis.
function playVoiceClip(key) {
  var clip = voiceClips[key];
  if (!soundEnabled || !clip || !ensureAudioCtx()) return false;
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  stopVoicePlayback();
  voiceBuffer(key).then(function (buf) {
    var start = clip.start || 0;
    var end = clip.end && clip.end > start ? Math.min(clip.end, buf.duration) : buf.duration;
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0, start, end - start);
    voiceSource = src;
  }).catch(function () {
    // this browser can't decode the clip (format recorded on another device)
    try { new Audio(clip.data).play(); } catch (e) {}
  });
  return true;
}

// Score call-out after a 301/501/Score turn: the recorded voice for human
// players, synthesis for the bot or any score not recorded yet.
function announceScore(attempted, bust, isBot) {
  var key = bust ? VOICE_BUST_KEY : String(attempted);
  if (!isBot && playVoiceClip(key)) return;
  speak(bust ? 'Raté' : String(attempted));
}

// ---------- recording ----------
function pickVoiceMime() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  var types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  for (var i = 0; i < types.length; i++) { if (MediaRecorder.isTypeSupported(types[i])) return types[i]; }
  return '';
}

// Where the speech sits in the take, so playback skips the silence before
// the user starts talking and after they stop.
function findSpeechBounds(buf) {
  var data = buf.getChannelData(0);
  var peak = 0;
  for (var i = 0; i < data.length; i++) { var a = Math.abs(data[i]); if (a > peak) peak = a; }
  if (peak < 0.01) return null;
  var thr = peak * 0.1;
  var first = 0, last = data.length - 1;
  while (first < data.length && Math.abs(data[first]) < thr) first++;
  while (last > first && Math.abs(data[last]) < thr) last--;
  var sr = buf.sampleRate;
  return { start: Math.max(0, first / sr - 0.06), end: Math.min(buf.duration, last / sr + 0.15) };
}

function blobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    var fr = new FileReader();
    fr.onload = function () { resolve(fr.result); };
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

async function startVoiceRecording() {
  if (voiceRec || !voiceSelected) return;
  if (!window.MediaRecorder || !navigator.mediaDevices) { setVoiceStatus('Enregistrement impossible sur ce navigateur.'); return; }
  try {
    if (!voiceStream) voiceStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    setVoiceStatus('Micro refusé — autorise le micro pour ce site.');
    return;
  }
  stopVoicePlayback();
  var mime = pickVoiceMime();
  var recorder = new MediaRecorder(voiceStream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
  var rec = { recorder: recorder, chunks: [], key: voiceSelected, timer: null };
  recorder.ondataavailable = function (e) { if (e.data && e.data.size) rec.chunks.push(e.data); };
  recorder.onstop = function () { finishVoiceRecording(rec); };
  recorder.start();
  rec.timer = setTimeout(stopVoiceRecording, VOICE_MAX_MS);
  voiceRec = rec;
  renderVoiceView();
}

function stopVoiceRecording() {
  if (!voiceRec) return;
  clearTimeout(voiceRec.timer);
  if (voiceRec.recorder.state !== 'inactive') voiceRec.recorder.stop();
}

async function finishVoiceRecording(rec) {
  voiceRec = null;
  var blob = new Blob(rec.chunks, { type: rec.recorder.mimeType || 'audio/webm' });
  var bounds = null;
  try {
    var buf = await ensureAudioCtx().decodeAudioData(await blob.arrayBuffer());
    bounds = findSpeechBounds(buf);
    if (!bounds) { setVoiceStatus('Rien entendu — réessaie un peu plus fort.'); renderVoiceView(); return; }
  } catch (e) { /* can't analyse here: keep the whole take */ }
  var clip = { data: await blobToDataUrl(blob), mime: blob.type, start: bounds ? bounds.start : 0, end: bounds ? bounds.end : 0, updatedAt: nowTs() };
  if (clip.data.length > 900000) { setVoiceStatus('Enregistrement trop long, réessaie.'); renderVoiceView(); return; }
  voiceClips[rec.key] = clip;
  delete voiceBuffers[rec.key];
  playVoiceClip(rec.key);
  // straight on to the next score still missing, so recording them all is just
  // "talk, tap, talk, tap"
  var next = nextMissingVoiceKey(rec.key);
  if (next) voiceSelected = next;
  renderVoiceView();
  if (!usingDb) { setVoiceStatus('Hors ligne : enregistrement non sauvegardé.'); return; }
  try {
    await db.collection('voiceClips').doc(rec.key).set(clip);
  } catch (e) {
    setVoiceStatus('Sauvegarde refusée par Firebase (règles Firestore ?).');
  }
}

function nextMissingVoiceKey(after) {
  var i = VOICE_KEYS.indexOf(after);
  for (var k = 1; k <= VOICE_KEYS.length; k++) {
    var key = VOICE_KEYS[(i + k) % VOICE_KEYS.length];
    if (!voiceClips[key]) return key;
  }
  return null;
}

function releaseVoiceMic() {
  stopVoiceRecording();
  if (voiceStream) { voiceStream.getTracks().forEach(function (t) { t.stop(); }); voiceStream = null; }
}

// ---------- view ----------
function setVoiceStatus(text) { els.voiceStatus.textContent = text || ''; }

function renderVoiceView() {
  if (!voiceSelected) voiceSelected = nextMissingVoiceKey(VOICE_KEYS[VOICE_KEYS.length - 1]) || VOICE_KEYS[0];
  var done = VOICE_KEYS.filter(function (k) { return voiceClips[k]; }).length;
  var has = !!voiceClips[voiceSelected];
  var recording = !!voiceRec;
  els.voiceProgress.textContent = done + ' / ' + VOICE_KEYS.length + ' enregistrés';
  els.voiceCurrent.textContent = voiceLabel(voiceSelected);
  els.voiceCurrent.classList.toggle('recording', recording);
  els.voiceRecBtn.textContent = recording ? '■ Arrêter' : (has ? '● Refaire' : '● Enregistrer');
  els.voiceRecBtn.classList.toggle('recording', recording);
  els.voicePlayBtn.disabled = recording || !has;
  els.voiceDeleteBtn.disabled = recording || !has;
  els.voicePrevBtn.disabled = recording;
  els.voiceNextBtn.disabled = recording;
  if (recording) setVoiceStatus('Dis « ' + voiceLabel(voiceSelected) + ' » puis appuie sur Arrêter (ou Espace).');
  els.voiceGrid.innerHTML = VOICE_KEYS.map(function (k) {
    var cls = 'voice-cell' + (voiceClips[k] ? ' done' : '') + (k === voiceSelected ? ' cur' : '') + (k === VOICE_BUST_KEY ? ' wide' : '');
    return '<button type="button" class="' + cls + '" data-key="' + k + '"' + (recording ? ' disabled' : '') + '>' + voiceLabel(k) + '</button>';
  }).join('');
}

function selectVoiceKey(key) {
  voiceSelected = key;
  setVoiceStatus('');
  renderVoiceView();
}

els.voiceRecBtn.addEventListener('click', function () {
  if (voiceRec) stopVoiceRecording(); else { setVoiceStatus(''); startVoiceRecording(); }
});
els.voicePlayBtn.addEventListener('click', function () { playVoiceClip(voiceSelected); });
els.voicePrevBtn.addEventListener('click', function () {
  var i = VOICE_KEYS.indexOf(voiceSelected);
  selectVoiceKey(VOICE_KEYS[(i - 1 + VOICE_KEYS.length) % VOICE_KEYS.length]);
});
els.voiceNextBtn.addEventListener('click', function () {
  var i = VOICE_KEYS.indexOf(voiceSelected);
  selectVoiceKey(VOICE_KEYS[(i + 1) % VOICE_KEYS.length]);
});
els.voiceDeleteBtn.addEventListener('click', async function () {
  var key = voiceSelected;
  delete voiceClips[key];
  delete voiceBuffers[key];
  renderVoiceView();
  if (usingDb) { try { await db.collection('voiceClips').doc(key).delete(); } catch (e) {} }
});
els.voiceGrid.addEventListener('click', function (e) {
  var b = e.target.closest('.voice-cell');
  if (b && !b.disabled) selectVoiceKey(b.dataset.key);
});
// Space toggles recording on a computer — no need to aim for the button
document.addEventListener('keydown', function (e) {
  if (currentTab !== 'voice' || e.code !== 'Space' || e.repeat) return;
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  e.preventDefault();
  // a focused button would also "click" itself on Space's keyup
  if (e.target && e.target.tagName === 'BUTTON') e.target.blur();
  els.voiceRecBtn.click();
});

watchVoiceClips();
