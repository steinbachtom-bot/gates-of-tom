/* ======================================================================
   GATES OF TOM — logique du client (rendu + animations + flux de jeu)
   Jetons virtuels uniquement. S'appuie sur le moteur defini dans index.html
   ====================================================================== */

/* ======================================================================
   MOTEUR AUDIO — sons synthétisés (Web Audio), aucun fichier externe.
   ====================================================================== */
const Snd = (() => {
  const AC = (typeof window !== "undefined") && (window.AudioContext || window.webkitAudioContext);
  let ctx = null, master = null, sfxG = null, musicG = null, fileMusicG = null;
  let sfxMuted = false, musicMuted = false, musicOn = false, musicTimer = null, droneNodes = [];
  let clickBuf = null, whooshBuf = null, musicBuf = null, fsMusicBuf = null;
  let musicTrack = "base", activeMusic = [];
  const MUSIC_VOL = 0.5, XF = 1.8;   // volume musique, durée du crossfade (s)

  function loadBuf(url, set) {
    if (!ctx || !url || typeof window === "undefined" || !window.fetch) return;
    fetch(url).then((r) => r.arrayBuffer())
      .then((a) => ctx.decodeAudioData(a)).then(set).catch(() => {});
  }
  function loadClick() {
    if (!clickBuf) loadBuf(window.CLICK_URL, (b) => { clickBuf = b; });
    if (!whooshBuf) loadBuf(window.WHOOSH_URL, (b) => { whooshBuf = b; });
  }
  function trackUrl(track) {
    if (typeof window === "undefined") return null;
    return track === "fs" ? window.FS_MUSIC_URL : window.MUSIC_URL;
  }
  function trackBuf(track) { return track === "fs" ? fsMusicBuf : musicBuf; }
  function loadTrack(track) {
    const url = trackUrl(track);
    if (!ctx || trackBuf(track) || !url || !window.fetch) return Promise.reject();
    return fetch(url).then((r) => { if (!r.ok) throw new Error("no music"); return r.arrayBuffer(); })
      .then((a) => ctx.decodeAudioData(a))
      .then((b) => { if (track === "fs") fsMusicBuf = b; else musicBuf = b; });
  }
  // Lecture en boucle avec crossfade : chaque passage a sa propre enveloppe
  // (fondu d'entrée / sortie), l'instance suivante chevauche la fin.
  function playLoop() {
    if (!ctx || !fileMusicG || !musicOn) return;
    const track = musicTrack;
    const buf = trackBuf(track);
    if (!buf) { loadTrack(track).then(() => { if (musicOn) playLoop(); }).catch(() => {}); return; }
    const d = buf.duration;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = ctx.createGain();
    s.connect(g).connect(fileMusicG);
    const t0 = now() + 0.03;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(1, t0 + XF);
    g.gain.setValueAtTime(1, t0 + Math.max(XF, d - XF));
    g.gain.linearRampToValueAtTime(0.0001, t0 + d);
    s.start(t0); s.stop(t0 + d + 0.1);
    const entry = { s, g, track };
    activeMusic.push(entry);
    s.onended = () => { const i = activeMusic.indexOf(entry); if (i >= 0) activeMusic.splice(i, 1); };
    musicTimer = setTimeout(() => { if (musicOn && musicTrack === track) playLoop(); }, Math.max(1000, (d - XF) * 1000));
  }
  function switchTrack(track) {
    if (!ctx || !musicOn || musicTrack === track) return;
    musicTrack = track;
    if (musicTimer) clearTimeout(musicTimer);
    const t = now();
    activeMusic.forEach(({ s, g }) => {
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.linearRampToValueAtTime(0.0001, t + 1.0);
        s.stop(t + 1.15);
      } catch (e) { /* ignore */ }
    });
    activeMusic = [];
    playLoop();
  }
  function playBuf(buf, gain) {
    if (!ctx || !buf) return;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(g).connect(sfxG); s.start();
  }

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxG = ctx.createGain(); sfxG.gain.value = sfxMuted ? 0 : 1.0; sfxG.connect(master);
      musicG = ctx.createGain(); musicG.gain.value = 0.0; musicG.connect(master);
      fileMusicG = ctx.createGain(); fileMusicG.gain.value = 0.0; fileMusicG.connect(master);
      loadClick();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  const now = () => (ctx ? ctx.currentTime : 0);

  function tone(freq, t0, dur, o = {}) {
    if (!ctx) return;
    const { type = "sine", gain = 0.2, attack = 0.005, release = 0.09, to = null, dest = null } = o;
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
    osc.connect(g).connect(dest || sfxG);
    osc.start(t0); osc.stop(t0 + dur + release + 0.02);
  }
  function noise(t0, dur, o = {}) {
    if (!ctx) return;
    const { gain = 0.2, type = "lowpass", freq = 1200, q = 1, dest = null } = o;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(dest || sfxG);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  // Progression sombre et ancienne (Ré phrygien) : Dm – Mi♭ – Dm – Do
  const CHORDS = [
    { pad: [146.83, 174.61, 220.00], bass: 73.42 },  // Dm
    { pad: [155.56, 196.00, 233.08], bass: 77.78 },  // Eb (bII phrygien)
    { pad: [146.83, 174.61, 220.00], bass: 73.42 },  // Dm
    { pad: [130.81, 164.81, 196.00], bass: 65.41 },  // C (bVII)
  ];
  // Mélodie modale (Ré phrygien : D Eb F G A Bb C) — flûte ancienne clairsemée
  const MEL = [174.61, 196.00, 220.00, 233.08, 261.63, 293.66, 311.13];
  let barIdx = 0;

  function mPad(freq, t0, dur, gain) {
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = freq * 1.004;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(280, t0); lp.frequency.linearRampToValueAtTime(620, t0 + dur * 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.9);
    g.gain.setValueAtTime(gain, t0 + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(musicG);
    const sg = ctx.createGain(); sg.gain.value = 0.4; o2.disconnect(); o2.connect(sg).connect(lp);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
  }
  function mBass(freq, t0, dur) {
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(musicG); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function mDrum(t0, gain) {            // tambour de guerre profond
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(34, t0 + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    o.connect(g).connect(musicG); o.start(t0); o.stop(t0 + 0.38);
  }
  function mMel(freq, t0, dur) {        // flûte ancienne (muffled)
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(lp).connect(g).connect(musicG); o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // Musique = vraie piste audio (fichier). Pas de musique synthé (trop "arcade").
  function startMusic() {
    if (!ensure() || musicOn) return;
    musicOn = true;
    musicTrack = "base";
    fileMusicG.gain.value = musicMuted ? 0 : MUSIC_VOL;
    playLoop();
    loadTrack("fs").catch(() => {});   // pré-chargement de la piste free spins
  }

  return {
    resume() { ensure(); },
    click() { if (!ensure()) return; if (clickBuf) playBuf(clickBuf, 0.5); else noise(now(), 0.05, { gain: 0.1, freq: 2000, type: "highpass" }); },
    isSfxOn() { return !sfxMuted; },
    isMusicOn() { return !musicMuted; },
    setSfx(on) { sfxMuted = !on; if (sfxG) sfxG.gain.setTargetAtTime(on ? 1 : 0, now(), 0.05); },
    setMusic(on) { musicMuted = !on; if (fileMusicG) fileMusicG.gain.setTargetAtTime(on ? MUSIC_VOL : 0, now(), 0.2); },
    setAll(on) { this.setSfx(on); this.setMusic(on); },
    fsMusic() { switchTrack("fs"); },
    baseMusic() { switchTrack("base"); },
    startMusic,
    spin() { if (!ensure()) return; if (whooshBuf) { playBuf(whooshBuf, 0.25); return; } const t = now(); noise(t, 0.34, { gain: 0.16, freq: 950, type: "lowpass" }); tone(200, t, 0.16, { type: "sawtooth", gain: 0.05, to: 110 }); },
    land() { if (!ensure()) return; const t = now(); tone(150, t, 0.07, { type: "sine", gain: 0.10, to: 80 }); },
    pop() { if (!ensure()) return; const t = now(); noise(t, 0.16, { gain: 0.13, freq: 1700, type: "bandpass", q: 0.8 }); },
    orb() { if (!ensure()) return; const t = now(); tone(880, t, 0.2, { type: "triangle", gain: 0.11, to: 1320 }); tone(1320, t + 0.05, 0.2, { type: "sine", gain: 0.07, to: 1760 }); },
    win(mult) { if (!ensure()) return; const t = now(); const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; const n = Math.max(1, Math.min(notes.length, 1 + Math.floor((mult || 0) / 2))); for (let i = 0; i < n; i++) tone(notes[i], t + i * 0.07, 0.2, { type: "triangle", gain: 0.13 }); },
    scatter() { if (!ensure()) return; const t = now(); tone(660, t, 0.5, { type: "sine", gain: 0.15, to: 990 }); noise(t, 0.5, { gain: 0.05, freq: 700, type: "bandpass", q: 2 }); },
    fsTrigger() { if (!ensure()) return; const t = now(); [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.13, 0.55, { type: "sawtooth", gain: 0.12 })); tone(98, t, 1.3, { type: "sine", gain: 0.16, to: 196 }); },
    bigWin() { if (!ensure()) return; const t = now(); [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => tone(f, t + i * 0.09, 0.42, { type: "triangle", gain: 0.15 })); },
  };
})();

/* Mapping DA « Mad Olympvs » : nos symboles -> assets PNG (du plus fort au plus faible). */
const SYM_FILE = {
  crown:      "lionking.png",  // Premium I
  hourglass:  "demon.png",     // Premium II
  ring:       "zeus.png",      // Premium III
  chalice:    "redmask.png",   // Premium IV
  gem_red:    "ruby.png",
  gem_purple: "crown2.png",
  gem_yellow: "laurel.png",
  gem_green:  "emerald.png",
  gem_blue:   "sapphire.png",
  SCATTER:    "orb.png",
};
// Source d'image : data-URI embarque (fichier autonome) sinon fichier dans assets/.
function symSrc(key) {
  const f = SYM_FILE[key];
  if (window.SYM_DATA && window.SYM_DATA[f]) return window.SYM_DATA[f];
  return "assets/symbols/" + f;
}
// Taille de l'orbe indexee sur la valeur (signature DA), bornee pour tenir dans la cellule.
function multScale(v) {
  const s = 0.78 + (Math.log(v) / Math.log(500)) * 0.42; // ~0.78 (x2) -> ~1.2 (x500)
  return Math.min(1.2, Math.max(0.7, s)).toFixed(3);
}

// Échelle de mises totales façon Pragmatic Play (Gates of Olympus), étendue à 500.
const BETS = [
  0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00,
  1.20, 1.40, 1.60, 1.80, 2.00,
  2.50, 3.00, 3.50, 4.00, 4.50, 5.00,
  6, 7, 8, 9, 10,
  12.50, 15, 17.50, 20,
  25, 30, 35, 40, 45, 50,
  60, 70, 80, 90, 100,
  125, 150, 175, 200,
  250, 300, 350, 400, 450, 500,
];

const state = {
  balance: 1000,
  betIndex: 8,   // 1,00 par défaut
  busy: false,
  ante: false,
  speedIndex: 0, // NORMAL par défaut
};
const BUY_COST_MULT = 100; // achat des free spins = 100x la mise

// Vitesses : multiplicateur applique a toutes les durees d'animation.
// NORMAL = de base (le plus lent), TURBO = l'ancienne vitesse rapide.
const SPEEDS = [
  { name: "NORMAL", mult: 2.1 },
  { name: "RAPIDE", mult: 1.5 },
  { name: "TURBO", mult: 1.0 },
];
const dur = (ms) => Math.round(ms * SPEEDS[state.speedIndex].mult);

// --- DOM refs ---
const $ = (id) => document.getElementById(id);
const gridEl = $("grid");
const balanceEl = $("balance");
const winValEl = $("winval");
const betValEl = $("betval");
const spinBtn = $("spinBtn");
const winBanner = $("winBanner");
const fsOverlay = $("fsOverlay");
const fsHud = $("fsHud");

const anteBtn = $("anteBtn");
const buyBtn = $("buyBtn");
const buyCostEl = $("buyCost");
const payBtn = $("payBtn");
const ptOverlay = $("ptOverlay");
const ptClose = $("ptClose");
const speedBtn = $("speedBtn");
const speedLbl = $("speedLbl");
const anteCostEl = $("anteCost");
const soundBtn = $("soundBtn");
const sndMenu = $("sndMenu");
const sfxToggle = $("sfxToggle");
const musToggle = $("musToggle");
const allToggle = $("allToggle");

/* Noms d'affichage (selon l'art applique) */
const SYM_NAME = {
  crown: "Roi-lion", hourglass: "Seigneur démon", ring: "Zeus cornu", chalice: "Masque démon",
  gem_red: "Rubis", gem_purple: "Couronne", gem_yellow: "Laurier", gem_green: "Émeraude", gem_blue: "Saphir",
  SCATTER: "Orbe d'Olympe",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => round2(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bet = () => BETS[state.betIndex];
const spinCost = () => bet() * (state.ante ? ANTE_COST_MULT : 1);
const buyCost = () => bet() * BUY_COST_MULT;

/* ----------------------------------------------------------------------
   Rendu base sur des TUILES deplacables (vraie cascade fluide).
   tileAt[i] = element de la tuile a la position i (i = col*ROWS + row), ou null.
   ---------------------------------------------------------------------- */
let tileAt = new Array(CFG.CELLS).fill(null);

const DROP_EASE = "cubic-bezier(.28,.9,.32,1)";
function hasLayout() {
  return typeof gridEl.getBoundingClientRect === "function" &&
         gridEl.getBoundingClientRect().height > 0;
}
function symbolInner(cell) {
  if (cell.t === "MULT") {
    return `<div class="mult-orb" style="--ms:${multScale(cell.v)}">` +
           `<div class="orb-core"><span class="v">x${cell.v}</span></div></div>`;
  }
  const key = cell.t === "SCATTER" ? "SCATTER" : cell.t;
  return `<img class="sym-img" src="${symSrc(key)}" alt="">`;
}
function makeTile(cell) {
  const el = document.createElement("div");
  el.className = "tile" + (cell.t === "SCATTER" ? " scatter" : "") + (cell.t === "MULT" ? " mult" : "");
  el.innerHTML = symbolInner(cell);
  return el;
}
function placeAt(el, c, r) { el.style.gridColumn = c + 1; el.style.gridRow = r + 1; }

/* Descente complete : toutes les tuiles tombent du haut, en vague par colonne. */
function dropIn(cells) {
  gridEl.innerHTML = "";
  tileAt = new Array(CFG.CELLS).fill(null);
  const H = hasLayout() ? gridEl.getBoundingClientRect().height : 0;
  for (let c = 0; c < CFG.REELS; c++) {
    for (let r = 0; r < CFG.ROWS; r++) {
      const i = idx(c, r);
      const t = makeTile(cells[i]);
      placeAt(t, c, r);
      gridEl.appendChild(t);
      tileAt[i] = t;
      if (H) { t.style.transition = "none"; t.style.transform = `translateY(${-(H * 1.15)}px)`; }
    }
  }
  if (H) {
    void gridEl.offsetHeight; // reflow
    for (let c = 0; c < CFG.REELS; c++) {
      for (let r = 0; r < CFG.ROWS; r++) {
        const t = tileAt[idx(c, r)];
        const delay = dur(c * 45 + (CFG.ROWS - 1 - r) * 26); // gauche->droite, remplit par le bas
        t.style.transition = `transform ${dur(420)}ms ${DROP_EASE} ${delay}ms`;
        t.style.transform = "translateY(0)";
      }
    }
  }
}

/* Disparition des gagnants : lueur + fumee + dissolution, puis retrait. */
async function clearWinners(winCells) {
  winCells.forEach((i) => { const t = tileAt[i]; if (t) t.classList.add("winglow"); });
  await sleep(dur(220));
  Snd.pop();
  winCells.forEach((i) => { const t = tileAt[i]; if (t) { puffSmoke(t); t.classList.add("popping"); } });
  await sleep(dur(430));
  winCells.forEach((i) => { const t = tileAt[i]; if (t) t.remove(); tileAt[i] = null; });
}

/* Cascade : les survivants glissent dans les trous, les nouveaux tombent du haut.
   Technique FLIP (mesure avant/apres + transition de transform). */
async function tumbleTo(nextCells) {
  const H = hasLayout() ? gridEl.getBoundingClientRect().height : 0;
  const firsts = new Map();
  if (H) for (let i = 0; i < CFG.CELLS; i++) {
    const t = tileAt[i]; if (t) firsts.set(t, t.getBoundingClientRect().top);
  }

  const next = new Array(CFG.CELLS).fill(null);
  const created = [];
  for (let c = 0; c < CFG.REELS; c++) {
    const surv = [];
    for (let r = 0; r < CFG.ROWS; r++) { const t = tileAt[idx(c, r)]; if (t) surv.push(t); }
    const need = CFG.ROWS - surv.length;
    for (let r = 0; r < need; r++) {           // nouveaux symboles en haut
      const t = makeTile(nextCells[idx(c, r)]);
      placeAt(t, c, r);
      gridEl.appendChild(t);
      next[idx(c, r)] = t; created.push({ t, r });
    }
    surv.forEach((t, k) => {                    // survivants vers le bas
      const r = need + k; placeAt(t, c, r); next[idx(c, r)] = t;
    });
  }
  tileAt = next;

  if (!H) return; // headless : pas d'animation

  void gridEl.offsetHeight;
  firsts.forEach((oldTop, t) => {               // invert survivants
    const dy = oldTop - t.getBoundingClientRect().top;
    t.style.transition = "none";
    t.style.transform = `translateY(${dy}px)`;
  });
  created.forEach(({ t }) => { t.style.transition = "none"; t.style.transform = `translateY(${-H}px)`; });
  void gridEl.offsetHeight;

  let maxDelay = 0;
  firsts.forEach((_, t) => {                     // play survivants
    t.style.transition = `transform ${dur(380)}ms ${DROP_EASE}`;
    t.style.transform = "translateY(0)";
  });
  created.forEach(({ t, r }) => {                // play nouveaux (vague)
    const delay = dur(r * 32); if (delay > maxDelay) maxDelay = delay;
    t.style.transition = `transform ${dur(420)}ms ${DROP_EASE} ${delay}ms`;
    t.style.transform = "translateY(0)";
  });
  await sleep(dur(440) + maxDelay);
}

/* Bouffee de fumee posee sur la grille (deborde la tuile). */
function puffSmoke(tileEl) {
  const gx = tileEl.offsetLeft, gy = tileEl.offsetTop;
  const w = tileEl.offsetWidth, h = tileEl.offsetHeight;
  for (let k = 0; k < 3; k++) {
    const s = document.createElement("div");
    s.className = "smoke" + (Math.random() < 0.22 ? " ichor" : "");
    const size = w * (0.8 + Math.random() * 0.55);
    s.style.width = size + "px";
    s.style.height = size + "px";
    s.style.left = (gx + w / 2 + (Math.random() * w * 0.3 - w * 0.15)) + "px";
    s.style.top = (gy + h / 2) + "px";
    s.style.transform = "translate(-50%,-50%)";
    s.style.setProperty("--dx", (-50 + (Math.random() * 50 - 25)) + "%");
    s.style.setProperty("--life", (0.5 + Math.random() * 0.4) + "s");
    gridEl.appendChild(s);
    const node = s;
    setTimeout(() => node.classList.add("go"), 12);
    setTimeout(() => node.remove(), 1100);
  }
}

/* ----------------------------------------------------------------------
   Animation d'un round (descente + cascades)
   ---------------------------------------------------------------------- */
async function animateRound(round, onPartial) {
  const frames = round.frames;
  let unitWin = 0;
  Snd.spin();
  dropIn(frames[0].cells);              // descente initiale (toutes les colonnes)
  await sleep(hasLayout() ? dur(760) : 0);
  Snd.land();
  let i = 0;
  while (frames[i] && frames[i].winCells.length) {
    unitWin += frames[i].stepWin;
    Snd.win(frames[i].stepWin);
    if (onPartial) onPartial(unitWin);
    await clearWinners(frames[i].winCells);
    if (frames[i + 1]) await tumbleTo(frames[i + 1].cells);
    i++;
  }
  if (round.multSum > 0 && unitWin > 0) Snd.orb();
  return { baseWin: unitWin, multSum: round.multSum, scatters: round.scatters };
}

async function spinIntro() { /* la descente est geree par animateRound/dropIn */ }

/* ----------------------------------------------------------------------
   Banniere de gain
   ---------------------------------------------------------------------- */
async function showBanner(unitWin) {
  let tag = "GRAND";
  if (unitWin >= 500) tag = "DÉMENTIEL";
  else if (unitWin >= 100) tag = "OLYMPIEN";
  else if (unitWin >= 50) tag = "ÉNORME";
  $("winBig").textContent = "x" + (Math.round(unitWin * 10) / 10);
  $("winTag").textContent = tag;
  Snd.bigWin();
  winBanner.classList.add("show");
  await sleep(1600);
  winBanner.classList.remove("show");
  await sleep(250);
}

/* ----------------------------------------------------------------------
   Free spins
   ---------------------------------------------------------------------- */
async function runFreeSpins(bought = false) {
  $("fsTitle").textContent = bought ? "FREE SPINS ACHETÉS" : "LE DIEU FOU S'ÉVEILLE";
  fsOverlay.querySelector("#fsSub").textContent = CFG.FS_AWARD + " FREE SPINS";
  Snd.fsTrigger();
  fsOverlay.classList.add("show");
  await new Promise((res) => {
    const btn = $("fsStart");
    const handler = () => { btn.removeEventListener("click", handler); res(); };
    btn.addEventListener("click", handler);
  });
  fsOverlay.classList.remove("show");
  Snd.fsMusic();                       // bascule sur la musique de free spins

  fsHud.classList.add("show");
  let persist = 0, fsWin = 0, spins = CFG.FS_AWARD;
  const setHud = () => {
    $("fsCount").textContent = spins;
    $("fsMult").textContent = "x" + persist;
    $("fsWin").textContent = fmt(fsWin * bet());
  };
  setHud();

  while (spins > 0) {
    spins--;
    const r = generateRound();
    await animateRound(r, null);
    persist += r.multSum;
    let w = r.baseWin;
    if (w > 0) w *= (persist > 0 ? persist : 1);
    const sc = r.scatters;
    if (sc >= 6) w += CFG.SCATTER_PAYS[6];
    else if (CFG.SCATTER_PAYS[sc]) w += CFG.SCATTER_PAYS[sc];
    fsWin += w;
    if (fsWin > CFG.MAX_WIN) { fsWin = CFG.MAX_WIN; }
    if (sc >= 3) spins += CFG.FS_RETRIG;
    setHud();
    if (w > 0) {
      winValEl.textContent = fmt(fsWin * bet());
      await sleep(350);
    }
    if (fsWin >= CFG.MAX_WIN) break;
  }

  fsHud.classList.remove("show");
  Snd.baseMusic();                      // retour à la musique de base
  return fsWin;
}

/* ----------------------------------------------------------------------
   Spin principal
   ---------------------------------------------------------------------- */
async function spin() {
  if (state.busy) return;
  if (state.balance < round2(spinCost())) { flashInsufficient(); return; }
  setBusy(true);
  spinBtn.classList.add("spinning");

  setAnte(state.ante);                // synchronise le moteur
  state.balance = round2(state.balance - round2(spinCost()));
  balanceEl.textContent = fmt(state.balance);
  winValEl.textContent = fmt(0);

  await spinIntro();

  const round = generateRound();
  const res = await animateRound(round, (uw) => {
    winValEl.textContent = fmt(uw * bet());
  });

  // multiplicateurs du jeu de base
  let unitWin = res.baseWin;
  if (unitWin > 0 && res.multSum > 0) {
    unitWin *= res.multSum;
    winValEl.textContent = fmt(unitWin * bet());
    await sleep(500);
  }
  // gains directs scatter
  const sc = res.scatters;
  if (sc >= 6) unitWin += CFG.SCATTER_PAYS[6];
  else if (CFG.SCATTER_PAYS[sc]) unitWin += CFG.SCATTER_PAYS[sc];
  if (unitWin > CFG.MAX_WIN) unitWin = CFG.MAX_WIN;

  // crediter
  let totalUnit = unitWin;
  if (totalUnit > 0) {
    const w = round2(totalUnit * bet());
    state.balance = round2(state.balance + w);
    balanceEl.textContent = fmt(state.balance);
    winValEl.textContent = fmt(w);
    if (totalUnit >= 20) await showBanner(totalUnit);
  }

  // free spins ?
  if (sc >= CFG.TRIGGER) {
    const fsUnit = await runFreeSpins();
    if (fsUnit > 0) {
      const w = round2(fsUnit * bet());
      state.balance = round2(state.balance + w);
      balanceEl.textContent = fmt(state.balance);
      winValEl.textContent = fmt(w);
      if (fsUnit >= 20) await showBanner(fsUnit);
    }
  }

  spinBtn.classList.remove("spinning");
  setBusy(false);
}

/* Grille de déclenchement : symboles aléatoires + exactement 4 scatters. */
function makeTriggerGrid() {
  const cells = Array.from({ length: CFG.CELLS }, () => ({
    t: PAY_KEYS[Math.floor(Math.random() * PAY_KEYS.length)], v: 0,
  }));
  const pos = new Set();
  while (pos.size < CFG.TRIGGER) pos.add(Math.floor(Math.random() * CFG.CELLS));
  pos.forEach((i) => { cells[i] = { t: "SCATTER", v: 0 }; });
  return cells;
}

/* Tour d'achat : on montre les 4 scatters qui tombent et déclenchent le bonus. */
async function animateTriggerSpin() {
  const cells = makeTriggerGrid();
  Snd.spin();
  dropIn(cells);
  await sleep(hasLayout() ? dur(760) : 0);
  Snd.scatter();
  if (hasLayout()) {
    for (let i = 0; i < CFG.CELLS; i++) {
      if (cells[i].t === "SCATTER" && tileAt[i]) tileAt[i].classList.add("winglow");
    }
    await sleep(dur(620));
  }
}

/* Bonus buy : payer, montrer le tour des 4 scatters, puis entrer dans les free spins. */
async function buyBonus() {
  if (state.busy) return;
  if (state.balance < round2(buyCost())) { flashInsufficient(); return; }
  setBusy(true);
  setAnte(false);                    // l'achat ignore l'ante
  state.balance = round2(state.balance - round2(buyCost()));
  balanceEl.textContent = fmt(state.balance);
  winValEl.textContent = fmt(0);

  await animateTriggerSpin();          // tour avec les 4 scatters qui tombent
  const fsUnit = await runFreeSpins(true);
  if (fsUnit > 0) {
    const w = round2(fsUnit * bet());
    state.balance = round2(state.balance + w);
    balanceEl.textContent = fmt(state.balance);
    winValEl.textContent = fmt(w);
    if (fsUnit >= 20) await showBanner(fsUnit);
  }
  setBusy(false);
}

function setBusy(b) {
  state.busy = b;
  spinBtn.disabled = b;
  anteBtn.disabled = b;
  buyBtn.disabled = b;
  $("betUp").disabled = $("betDown").disabled = b;
}

function flashInsufficient() {
  balanceEl.style.color = "#ff5b5b";
  setTimeout(() => (balanceEl.style.color = ""), 600);
}

/* ----------------------------------------------------------------------
   Liste des gains (paytable)
   ---------------------------------------------------------------------- */
function fmtPay(v) {
  const x = Math.round(v * CFG.PAY_SCALE * 100) / 100;
  return x.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}
function buildPaytable() {
  const body = $("ptBody");
  if (!body) return;
  let rows = "";
  for (const k of PAY_KEYS) {
    const p = CFG.PAYTABLE[k];
    rows +=
      `<div class="pt-row">` +
      `<div class="pt-thumb"><img src="${symSrc(k)}" alt=""></div>` +
      `<div class="pt-name">${SYM_NAME[k]}</div>` +
      `<div class="pt-pays">` +
      `<span><b>8–9</b>${fmtPay(p[0])}×</span>` +
      `<span><b>10–11</b>${fmtPay(p[1])}×</span>` +
      `<span><b>12+</b>${fmtPay(p[2])}×</span>` +
      `</div></div>`;
  }
  rows +=
    `<div class="pt-row">` +
    `<div class="pt-thumb"><img src="${symSrc("SCATTER")}" alt=""></div>` +
    `<div class="pt-name">${SYM_NAME.SCATTER} <span style="color:var(--ichor)">· Scatter</span></div>` +
    `<div class="pt-pays">` +
    `<span><b>4</b>${fmtPay(CFG.SCATTER_PAYS[4])}×</span>` +
    `<span><b>5</b>${fmtPay(CFG.SCATTER_PAYS[5])}×</span>` +
    `<span><b>6+</b>${fmtPay(CFG.SCATTER_PAYS[6])}×</span>` +
    `</div></div>`;
  rows +=
    `<div class="pt-row">` +
    `<div class="pt-thumb"><div class="pt-mini-orb">×</div></div>` +
    `<div class="pt-name">Orbe multiplicateur</div>` +
    `<div class="pt-pays"><span>×2 → ×500 · s'additionnent</span></div></div>`;

  const rules =
    `<div class="pt-rules"><h3>Règles</h3><p>` +
    `<b>Pay-anywhere :</b> 8 symboles identiques ou plus, n'importe où sur la grille, paient.<br>` +
    `<b>Tumble :</b> les gagnants disparaissent, les autres tombent, de nouveaux arrivent — tant qu'il y a un gain.<br>` +
    `<b>Orbes :</b> les multiplicateurs présents s'additionnent et multiplient le gain de la séquence.<br>` +
    `<b>Free spins :</b> 4 Orbes d'Olympe ou plus déclenchent 15 tours ; multiplicateur persistant.<br>` +
    `<b>Ante bet :</b> mise +25 %, double la chance de free spins. <b>Buy :</b> achat direct (100× la mise).<br>` +
    `<b>Max win :</b> 5000× la mise. <b>RTP :</b> ≈ 96 %.` +
    `</p></div>`;

  body.innerHTML = rows + rules;
}

/* ----------------------------------------------------------------------
   Controles
   ---------------------------------------------------------------------- */
function updateBet() {
  betValEl.textContent = fmt(spinCost());
  buyCostEl.textContent = fmt(buyCost());
  if (anteCostEl) anteCostEl.textContent = "+" + fmt(bet() * (ANTE_COST_MULT - 1));
}

function updateSpeed() {
  speedLbl.textContent = SPEEDS[state.speedIndex].name;
  speedBtn.classList.toggle("turbo", SPEEDS[state.speedIndex].name === "TURBO");
}
$("betUp").addEventListener("click", () => {
  Snd.click();
  if (state.busy) return;
  state.betIndex = Math.min(BETS.length - 1, state.betIndex + 1); updateBet();
});
$("betDown").addEventListener("click", () => {
  Snd.click();
  if (state.busy) return;
  state.betIndex = Math.max(0, state.betIndex - 1); updateBet();
});
anteBtn.addEventListener("click", () => {
  Snd.click();
  if (state.busy) return;
  state.ante = !state.ante;
  setAnte(state.ante);
  anteBtn.classList.toggle("on", state.ante);
  updateBet();
});
buyBtn.addEventListener("click", buyBonus);
function updateSndMenu() {
  const sfx = Snd.isSfxOn(), mus = Snd.isMusicOn();
  sfxToggle.classList.toggle("on", sfx);
  musToggle.classList.toggle("on", mus);
  allToggle.classList.toggle("on", sfx || mus);
  soundBtn.classList.toggle("muted", !sfx && !mus);
}
soundBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  kickAudio();
  Snd.click();
  sndMenu.classList.toggle("show");
});
allToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  kickAudio();
  const target = !(Snd.isSfxOn() || Snd.isMusicOn()); // si tout coupé -> tout activer
  Snd.setAll(target); if (target) Snd.click(); updateSndMenu();
});
sfxToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  Snd.setSfx(!Snd.isSfxOn()); Snd.click(); updateSndMenu();
});
musToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  kickAudio();
  Snd.setMusic(!Snd.isMusicOn()); Snd.click(); updateSndMenu();
});
document.addEventListener("click", () => { sndMenu.classList.remove("show"); });
speedBtn.addEventListener("click", () => {
  Snd.click();
  if (state.busy) return;
  state.speedIndex = (state.speedIndex + 1) % SPEEDS.length;
  updateSpeed();
});
payBtn.addEventListener("click", () => { Snd.click(); ptOverlay.classList.add("show"); });
ptClose.addEventListener("click", () => { Snd.click(); ptOverlay.classList.remove("show"); });
ptOverlay.addEventListener("click", (e) => { if (e.target === ptOverlay) ptOverlay.classList.remove("show"); });
spinBtn.addEventListener("click", spin);
document.addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); spin(); } });

// Démarrage audio au 1er geste (les navigateurs bloquent l'autoplay)
let audioStarted = false;
function kickAudio() {
  if (audioStarted) return;
  audioStarted = true;
  Snd.resume();
  Snd.startMusic();
}
document.addEventListener("pointerdown", kickAudio, { once: true });

/* ----------------------------------------------------------------------
   Init
   ---------------------------------------------------------------------- */
const fsOrb = $("fsOrb");
if (fsOrb) fsOrb.src = symSrc("SCATTER");

// Braises dorées du décor
const emberLayer = $("emberLayer");
if (emberLayer) {
  for (let i = 0; i < 16; i++) {
    const e = document.createElement("div");
    e.className = "ember";
    const size = 2 + Math.random() * 2.6;
    e.style.left = (Math.random() * 100) + "%";
    e.style.width = size + "px";
    e.style.height = size + "px";
    e.style.animationDuration = (7 + Math.random() * 9) + "s";
    e.style.animationDelay = (-Math.random() * 9) + "s";
    emberLayer.appendChild(e);
  }
}

dropIn(Array.from({ length: CFG.CELLS }, newCell));
buildPaytable();
updateBet();
updateSpeed();
updateSndMenu();
balanceEl.textContent = fmt(state.balance);
