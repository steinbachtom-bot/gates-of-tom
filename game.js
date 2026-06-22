/* ======================================================================
   CURSE OF HADES — logique du client (rendu + animations + flux de jeu)
   Jetons virtuels uniquement. S'appuie sur le moteur defini dans index.html
   ====================================================================== */

/* ======================================================================
   MOTEUR AUDIO — sons synthétisés (Web Audio), aucun fichier externe.
   ====================================================================== */
const Snd = (() => {
  const AC = (typeof window !== "undefined") && (window.AudioContext || window.webkitAudioContext);
  let ctx = null, master = null, sfxG = null, musicG = null, fileMusicG = null;
  let sfxMuted = false, musicMuted = false, musicOn = false, musicTimer = null, droneNodes = [];
  let clickBuf = null, whooshBuf = null, hitBuf = null, landBuf = null, scatterBuf = null, fsTrigBuf = null, orbZapBuf = null, bigWinBuf = null, musicBuf = null, fsMusicBuf = null, bigMusicBuf = null;
  let musicTrack = "base", activeMusic = [];
  const MUSIC_VOL = 0.4, XF = 1.8;   // volume musique (lit ~-23 dBFS), durée du crossfade (s)

  function loadBuf(url, set) {
    if (!ctx || !url || typeof window === "undefined" || !window.fetch) return;
    fetch(url).then((r) => r.arrayBuffer())
      .then((a) => ctx.decodeAudioData(a)).then(set).catch(() => {});
  }
  function loadClick() {
    if (!clickBuf) loadBuf(window.CLICK_URL, (b) => { clickBuf = b; });
    if (!whooshBuf) loadBuf(window.WHOOSH_URL, (b) => { whooshBuf = b; });
    if (!hitBuf) loadBuf(window.HIT_URL, (b) => { hitBuf = b; });
    if (!landBuf) loadBuf(window.LAND_URL, (b) => { landBuf = b; });
    if (!scatterBuf) loadBuf(window.SCATTER_URL, (b) => { scatterBuf = b; });
    if (!fsTrigBuf) loadBuf(window.FS_TRIGGER_URL, (b) => { fsTrigBuf = b; });
    if (!orbZapBuf) loadBuf(window.ORBZAP_URL, (b) => { orbZapBuf = b; });
    if (!bigWinBuf) loadBuf(window.BIGWIN_STINGER_URL, (b) => { bigWinBuf = b; });
  }
  function trackUrl(track) {
    if (typeof window === "undefined") return null;
    if (track === "fs") return window.FS_MUSIC_URL;
    if (track === "bigwin") return window.BIGWIN_MUSIC_URL;
    return window.MUSIC_URL;
  }
  function trackBuf(track) {
    return track === "fs" ? fsMusicBuf : (track === "bigwin" ? bigMusicBuf : musicBuf);
  }
  function loadTrack(track) {
    const url = trackUrl(track);
    if (!ctx || trackBuf(track) || !url || !window.fetch) return Promise.reject();
    return fetch(url).then((r) => { if (!r.ok) throw new Error("no music"); return r.arrayBuffer(); })
      .then((a) => ctx.decodeAudioData(a))
      .then((b) => { if (track === "fs") fsMusicBuf = b; else if (track === "bigwin") bigMusicBuf = b; else musicBuf = b; });
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
  function playBuf(buf, gain, rate) {
    if (!ctx || !buf) return;
    const s = ctx.createBufferSource(); s.buffer = buf;
    if (rate) s.playbackRate.value = rate;
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
    loadTrack("fs").catch(() => {});       // pré-chargement free spins
    loadTrack("bigwin").catch(() => {});   // pré-chargement big win
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
    setTrack(name) { switchTrack(name); },
    trackName() { return musicTrack; },
    startMusic,
    spin() { if (!ensure()) return; if (whooshBuf) { playBuf(whooshBuf, 0.45); return; } const t = now(); noise(t, 0.34, { gain: 0.16, freq: 950, type: "lowpass" }); tone(200, t, 0.16, { type: "sawtooth", gain: 0.05, to: 110 }); },
    land() { if (!ensure()) return; if (landBuf) { playBuf(landBuf, 0.3); return; } const t = now(); tone(150, t, 0.07, { type: "sine", gain: 0.10, to: 80 }); },
    pop() { if (!ensure()) return; const t = now(); noise(t, 0.16, { gain: 0.13, freq: 1700, type: "bandpass", q: 0.8 }); },
    orb() { if (!ensure()) return; const t = now(); tone(880, t, 0.2, { type: "triangle", gain: 0.11, to: 1320 }); tone(1320, t + 0.05, 0.2, { type: "sine", gain: 0.07, to: 1760 }); },
    win(mult) { if (!ensure()) return; if (hitBuf) { playBuf(hitBuf, 1.1); return; } const t = now(); const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; const n = Math.max(1, Math.min(notes.length, 1 + Math.floor((mult || 0) / 2))); for (let i = 0; i < n; i++) tone(notes[i], t + i * 0.07, 0.2, { type: "triangle", gain: 0.13 }); },
    scatter() { if (!ensure()) return; if (scatterBuf) { playBuf(scatterBuf, 0.4); return; } const t = now(); tone(660, t, 0.5, { type: "sine", gain: 0.15, to: 990 }); noise(t, 0.5, { gain: 0.05, freq: 700, type: "bandpass", q: 2 }); },
    anticip() { if (!ensure()) return; const t = now(); tone(220, t, 1.1, { type: "sawtooth", gain: 0.12, to: 660 }); tone(110, t, 1.1, { type: "sine", gain: 0.10, to: 220 }); noise(t, 1.1, { gain: 0.04, freq: 900, type: "bandpass", q: 3 }); },
    orbZap(i) { if (!ensure()) return; if (orbZapBuf) { playBuf(orbZapBuf, 0.25, 1 + Math.min(i || 0, 6) * 0.05); return; } const t = now(); const base = 520 + (i || 0) * 80; tone(base, t, 0.18, { type: "sawtooth", gain: 0.10, to: base * 2 }); tone(base * 1.5, t + 0.02, 0.16, { type: "triangle", gain: 0.06, to: base * 3 }); noise(t, 0.12, { gain: 0.05, freq: 3200, type: "highpass" }); },
    fsTrigger() { if (!ensure()) return; if (fsTrigBuf) { playBuf(fsTrigBuf, 0.55); return; } const t = now(); [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.13, 0.55, { type: "sawtooth", gain: 0.12 })); tone(98, t, 1.3, { type: "sine", gain: 0.16, to: 196 }); },
    bigWin() { if (!ensure()) return; if (bigWinBuf) { playBuf(bigWinBuf, 0.72); return; } const t = now(); [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => tone(f, t + i * 0.09, 0.42, { type: "triangle", gain: 0.15 })); },
  };
})();

/* Mapping DA « Mad Olympvs » : nos symboles -> assets PNG (du plus fort au plus faible). */
const SYM_FILE = {
  crown:      "premium_lion.png",   // Premium I
  hourglass:  "premium_demon.png",  // Premium II
  ring:       "premium_zeus.png",   // Premium III
  chalice:    "premium_mask.png",   // Premium IV
  gem_red:    "gem_red.png",
  gem_purple: "gem_purple.png",
  gem_yellow: "gem_yellow.png",
  gem_green:  "gem_green.png",
  gem_blue:   "gem_blue.png",
  SCATTER:    "scatter_hades.png",
};
// Source d'image : data-URI embarque (fichier autonome) sinon fichier dans assets/.
function symSrc(key) {
  const f = SYM_FILE[key];
  if (window.SYM_DATA && window.SYM_DATA[f]) return window.SYM_DATA[f];
  return "assets/symbols/" + f;
}
// Image de l'orbe multiplicateur (data-URI embarqué sinon fichier).
function orbSrc() {
  if (window.SYM_DATA && window.SYM_DATA["orb_mult.png"]) return window.SYM_DATA["orb_mult.png"];
  return "assets/symbols/orb_mult.png";
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
  balance: 10000,
  betIndex: 8,   // 1,00 par défaut
  busy: false,
  ante: false,
  speedIndex: 0, // NORMAL par défaut
  auto: 0,       // tours auto restants (-1 = illimité, 0 = arrêté)
  autoActive: false,
  autoStopBigWin: false,   // autoplay : stop si gros gain
  autoStopFs: false,       // autoplay : stop si free spins
  lastBigWin: false, lastFs: false,   // drapeaux du dernier spin (pour l'autoplay)
  inFs: false,             // true pendant les free spins (anticip dès 2 scatters : retrigger à 3)
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
const winBanner = $("bigWin");
const fsOverlay = $("fsOverlay");
const fsHud = $("fsHud");

const anteBtn = $("anteBtn");
const buyBtn = $("buyBtn");
const buyCostEl = $("buyCost");
const ptOverlay = $("ptOverlay");
const ptClose = $("ptClose");
const speedBtn = $("speedBtn");
const speedBolts = [...speedBtn.querySelectorAll(".spd-bolt")];  // 3 éclairs (1/vitesse)
const anteCostEl = $("anteCost");
const menuBtn = $("menuBtn");      // hamburger : regroupe Sons + Gains
const mainMenu = $("mainMenu");
const mmSons = $("mmSons");
const mmGains = $("mmGains");
const sndSub = $("sndSub");
const autoBtn = $("autoBtn");
const autoMenu = $("autoMenu");
const autoIco = $("autoIco");
const autoLbl = $("autoLbl");
const sfxToggle = $("sfxToggle");
const musToggle = $("musToggle");
const allToggle = $("allToggle");

/* Noms d'affichage (selon l'art applique) */
const SYM_NAME = {
  crown: "Roi-lion", hourglass: "Seigneur démon", ring: "Zeus cornu", chalice: "Masque démon",
  gem_red: "Rubis", gem_purple: "Améthyste", gem_yellow: "Topaze", gem_green: "Émeraude", gem_blue: "Saphir",
  SCATTER: "Orbe d'Hadès",
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
const SLAM_EASE = "cubic-bezier(.2,.75,.3,1)"; // chute rapide, sans rebond
function shakeGrid() {
  if (!hasLayout()) return;
  gridEl.classList.remove("shake");
  void gridEl.offsetWidth;            // force reflow pour relancer l'animation
  gridEl.classList.add("shake");
}
function hasLayout() {
  return typeof gridEl.getBoundingClientRect === "function" &&
         gridEl.getBoundingClientRect().height > 0;
}
function symbolInner(cell) {
  if (cell.t === "MULT") {
    return `<div class="mult-orb" style="--ms:${multScale(cell.v)}">` +
           `<img class="orb-img" src="${orbSrc()}" alt="">` +
           `<span class="v">x${cell.v}</span></div>`;
  }
  const key = cell.t === "SCATTER" ? "SCATTER" : cell.t;
  return `<img class="sym-img" src="${symSrc(key)}" alt="">`;
}
const PREMIUM_KEYS = { crown: 1, hourglass: 1, ring: 1, chalice: 1 };
function makeTile(cell) {
  const el = document.createElement("div");
  const tier = PREMIUM_KEYS[cell.t] ? " premium" : (cell.t.indexOf("gem_") === 0 ? " gem" : "");
  el.className = "tile" + (cell.t === "SCATTER" ? " scatter" : "") + (cell.t === "MULT" ? " mult" : "") + tier;
  el.innerHTML = symbolInner(cell);
  return el;
}
function placeAt(el, c, r) { el.style.gridColumn = c + 1; el.style.gridRow = r + 1; }

/* Descente complete : toutes les tuiles tombent du haut, en vague par colonne. */
async function dropIn(cells, animate = true, allowAnticip = true) {
  gridEl.innerHTML = "";
  tileAt = new Array(CFG.CELLS).fill(null);
  // Remplissage statique (animate=false) pour le tout premier rendu : évite que
  // l'animation de chute se fige si le layout (fond portrait) n'est pas encore stable.
  const H = (animate && hasLayout()) ? gridEl.getBoundingClientRect().height : 0;
  for (let c = 0; c < CFG.REELS; c++) {
    for (let r = 0; r < CFG.ROWS; r++) {
      const i = idx(c, r);
      const t = makeTile(cells[i]);
      placeAt(t, c, r);
      gridEl.appendChild(t);
      tileAt[i] = t;
      if (H) { t.style.transition = "none"; t.style.transform = `translateY(${-(H * 1.28)}px)`; }
    }
  }
  if (!H) return;                          // statique : rien à animer
  void gridEl.offsetHeight;                // reflow

  // Lâche une colonne (transition CSS), remplie du bas vers le haut.
  const dropCol = (c, slow, baseDelay) => {
    for (let r = 0; r < CFG.ROWS; r++) {
      const t = tileAt[idx(c, r)];
      const delay = dur((baseDelay || 0) + (CFG.ROWS - 1 - r) * 22);
      t.style.transition = `transform ${dur(380 * (slow || 1))}ms ${SLAM_EASE} ${delay}ms`;
      t.style.transform = "translateY(0)";
    }
  };
  const pulseCol = (c) => {
    for (let r = 0; r < CFG.ROWS; r++) {
      if (cells[idx(c, r)].t === "SCATTER" && tileAt[idx(c, r)]) tileAt[idx(c, r)].classList.add("anticip");
    }
  };

  // Colonne de déclenchement de l'anticipation : où le scatter « avant-dernier »
  // apparaît (de gauche à droite), s'il reste au moins une colonne à révéler après.
  // Base : dès 3 scatters (4 = free spins). Free spins : dès 2 scatters (3 = retrigger).
  const anticipNeed = state.inFs ? 2 : 3;
  let trigCol = -1;
  if (allowAnticip) {
    let cum = 0;
    for (let c = 0; c < CFG.REELS; c++) {
      for (let r = 0; r < CFG.ROWS; r++) if (cells[idx(c, r)].t === "SCATTER") cum++;
      if (cum >= anticipNeed && c < CFG.REELS - 1) { trigCol = c; break; }
    }
  }

  if (trigCol < 0) {
    // Cas normal : toutes les colonnes tombent (gauche -> droite, léger décalage).
    for (let c = 0; c < CFG.REELS; c++) dropCol(c, 1, c * 42);
    await sleep(dur(660));
    Snd.land();
    return;
  }

  // --- ANTICIPATION DE ROULEAUX (pendant la chute) ---
  // 1) On tombe les colonnes 0..trigCol ; les suivantes restent cachées au-dessus (cases vides).
  for (let c = 0; c <= trigCol; c++) dropCol(c, 1, c * 42);
  await sleep(dur(380 + trigCol * 42 + (CFG.ROWS - 1) * 22 + 60));
  Snd.land();
  // 2) Pulsation des scatters affichés + on assombrit le reste, pause de tension.
  gridEl.classList.add("anticip");
  for (let c = 0; c <= trigCol; c++) pulseCol(c);
  await sleep(dur(850));
  gridEl.classList.remove("anticip");      // on ré-éclaire pour bien voir les rouleaux révélés
  // 3) Révélation des colonnes restantes une par une, plus lentement (les scatters continuent de pulser).
  for (let c = trigCol + 1; c < CFG.REELS; c++) {
    dropCol(c, 1.35, 0);
    await sleep(dur(600));
    Snd.land();
    pulseCol(c);                           // pulse aussi un éventuel 4e scatter qui tombe
    if (c < CFG.REELS - 1) await sleep(dur(380));
  }
  await sleep(dur(300));
  // 4) Fin de l'anticipation.
  gridEl.querySelectorAll(".tile.anticip").forEach((t) => t.classList.remove("anticip"));
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

/* Indices des scatters présents dans une grille de cellules. */
function scatterIndices(cells) {
  const out = [];
  cells.forEach((c, i) => { if (c.t === "SCATTER") out.push(i); });
  return out;
}

/* L'anticipation de rouleaux est désormais gérée pendant la descente (voir dropIn) :
   pulsation des scatters affichés + pause des colonnes pas encore tombées. */

/* ----------------------------------------------------------------------
   Effets de gain : count-up, étincelles, popups, révélation des orbes
   ---------------------------------------------------------------------- */
// Calque plein écran pour les particules/popups (au-dessus de tout).
let fxLayer = null;
function getFxLayer() {
  if (fxLayer) return fxLayer;
  if (typeof document === "undefined" || !document.body) return null;
  fxLayer = document.createElement("div");
  fxLayer.className = "fx-layer";
  document.body.appendChild(fxLayer);
  return fxLayer;
}

// Compteur qui défile sur un élément (ease-out). Headless : valeur finale directe.
function countUpEl(el, from, to, ms) {
  if (!el) return Promise.resolve();
  if (!hasLayout() || typeof requestAnimationFrame !== "function") { el.textContent = fmt(to); return Promise.resolve(); }
  const t0 = performance.now();
  return new Promise((res) => {
    function step(nowT) {
      const k = Math.min(1, (nowT - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else { el.textContent = fmt(to); res(); }
    }
    requestAnimationFrame(step);
  });
}
function pulseGain() {
  if (!hasLayout()) return;
  winValEl.classList.remove("pulse"); void winValEl.offsetWidth; winValEl.classList.add("pulse");
}
function pulsePill(el) {
  if (!hasLayout() || !el) return;
  el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse");
}
async function countUpWin(from, to) { pulseGain(); await countUpEl(winValEl, from, to, 500); }

// Gerbe d'étincelles dorées (ou ichor) à une position écran.
function sparkBurst(cx, cy, n, kind) {
  const layer = getFxLayer();
  if (!hasLayout() || !layer) return;
  for (let k = 0; k < n; k++) {
    const s = document.createElement("div");
    s.className = "spark" + (kind === "ichor" ? " ichor" : "");
    const ang = Math.random() * Math.PI * 2;
    const dist = 38 + Math.random() * 92;
    const sz = 3 + Math.random() * 4;
    s.style.left = cx + "px"; s.style.top = cy + "px";
    s.style.width = sz + "px"; s.style.height = sz + "px";
    s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    s.style.setProperty("--dy", (Math.sin(ang) * dist - 28) + "px");
    s.style.setProperty("--life", (0.5 + Math.random() * 0.5) + "s");
    layer.appendChild(s);
    const node = s; setTimeout(() => node.remove(), 1100);
  }
}
// Montant « +X » flottant qui monte et s'estompe.
function floatWin(cx, cy, text, big) {
  const layer = getFxLayer();
  if (!hasLayout() || !layer) return;
  const p = document.createElement("div");
  p.className = "winpop" + (big ? " big" : "");
  p.textContent = text;
  p.style.left = cx + "px"; p.style.top = cy + "px";
  layer.appendChild(p);
  const node = p; setTimeout(() => node.remove(), 1300);
}
// Étincelles au centre de la grille.
function gridSparks(n, kind) {
  if (!hasLayout()) return;
  const r = gridEl.getBoundingClientRect();
  sparkBurst(r.left + r.width / 2, r.top + r.height / 2, n, kind);
}
// Popup de gain d'une cascade, au centre de la grille (décalé selon la cascade).
function popCascadeWin(stepWin, cascadeIdx) {
  if (!hasLayout() || stepWin <= 0) return;
  const r = gridEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height * (0.52 - Math.min(cascadeIdx, 3) * 0.05);
  floatWin(cx, cy, "+" + fmt(stepWin * bet()), cascadeIdx > 0);
  sparkBurst(cx, cy, 7 + Math.min(cascadeIdx, 4) * 3, "gold");
}

// Badge « xN » spectaculaire au centre de la zone de jeu.
async function flashMultTotal(sum) {
  const stage = $("stage");
  if (!hasLayout() || !stage) return;
  const el = document.createElement("div");
  el.className = "mult-flash";
  el.textContent = "x" + sum;
  stage.appendChild(el);
  await sleep(dur(640));
  el.classList.add("out");
  await sleep(dur(300));
  el.remove();
}

/* Révélation des orbes : chaque orbe « zappe » (éclair + son montant + étincelles),
   les valeurs s'additionnent, puis un badge « xN » s'affiche. Retourne la somme. */
async function revealMultipliers(cells) {
  if (!hasLayout()) return 0;
  const orbs = [];
  cells.forEach((c, i) => { if (c.t === "MULT") orbs.push({ i, v: c.v }); });
  if (!orbs.length) return 0;
  let sum = 0;
  const fast = orbs.length > 5;            // beaucoup d'orbes : on accélère
  for (let k = 0; k < orbs.length; k++) {
    const { i, v } = orbs[k];
    const t = tileAt[i];
    sum += v;
    if (t) {
      t.classList.add("zap");
      // Snd.orbZap(k);   // son des orbes désactivé (à réactiver si besoin) — orbzap.wav conservé
      const r = t.getBoundingClientRect();
      sparkBurst(r.left + r.width / 2, r.top + r.height / 2, 9, "gold");
      await sleep(dur(fast ? 90 : 175));
      t.classList.remove("zap");
    }
  }
  if (sum > 1) await flashMultTotal(sum);
  return sum;
}

/* Crédite un gain (en multiples de la mise) : solde qui défile + étincelles + Big Win. */
async function creditWin(unitWin) {
  if (unitWin <= 0) return;
  const w = round2(unitWin * bet());
  const bal0 = state.balance;
  state.balance = round2(state.balance + w);
  winValEl.textContent = fmt(w); pulseGain();
  gridSparks(Math.min(34, 8 + Math.round(unitWin)), "gold");
  await countUpEl(balanceEl, bal0, state.balance, 650);
  if (unitWin >= 20) await showBanner(unitWin);
}

/* ----------------------------------------------------------------------
   Animation d'un round (descente + cascades)
   ---------------------------------------------------------------------- */
async function animateRound(round, onPartial) {
  const frames = round.frames;
  let unitWin = 0;
  Snd.spin();
  // Descente initiale : gère l'anticipation de rouleaux (pulse scatters + pause des
  // colonnes pas encore tombées quand 3 scatters sont à l'écran) et le son d'atterrissage.
  await dropIn(frames[0].cells);
  if (hasLayout()) {
    if (!frames[0].winCells.length) shakeGrid(); // secousse seulement s'il n'y a pas de hit
    await sleep(dur(120));
  } else {
    Snd.land();
  }
  let i = 0;
  while (frames[i] && frames[i].winCells.length) {
    unitWin += frames[i].stepWin;
    Snd.win(frames[i].stepWin);
    popCascadeWin(frames[i].stepWin, i);   // « +X » flottant + étincelles par cascade
    if (onPartial) { onPartial(unitWin); pulseGain(); }
    await clearWinners(frames[i].winCells);
    if (frames[i + 1]) await tumbleTo(frames[i + 1].cells);
    i++;
  }
  return { baseWin: unitWin, multSum: round.multSum, scatters: round.scatters };
}

async function spinIntro() { /* la descente est geree par animateRound/dropIn */ }

/* ----------------------------------------------------------------------
   Écran Big Win : vidéo en fond + libellé de palier + montant qui défile
   (unitWin = gain en multiples de la mise)
   ---------------------------------------------------------------------- */
// Palier de gain : nom affiché + clé CSS (identité visuelle) + durée du décompte.
// Plus le palier est haut, plus le décompte est long (montée de tension).
function bigWinTierInfo(u) {
  if (u >= 500) return { name: "DÉMENTIEL", key: "dementiel", count: 3800 };
  if (u >= 100) return { name: "OLYMPIEN",  key: "olympien",  count: 2800 };
  if (u >= 50)  return { name: "ÉNORME",    key: "enorme",    count: 1800 };
  return          { name: "GRAND",     key: "grand",     count: 1300 };
}
const BW_TIER_CLASSES = ["tier-grand", "tier-enorme", "tier-olympien", "tier-dementiel"];
const bwVideo = $("bwVideo");
const bwTag = $("bwTag");
const bwAmount = $("bwAmount");
const bwHint = $("bwHint");

/* Choix de la vidéo Big Win selon l'orientation : portrait (mobile) ou 16:9 (desktop). */
function bigWinVideoUrl() {
  const portrait = typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(orientation: portrait) and (max-width: 760px)").matches;
  return portrait ? (window.BIGWIN_PORTRAIT_URL || window.BIGWIN_URL) : window.BIGWIN_URL;
}
function ensureBigWinSrc() {
  if (!bwVideo) return;
  const url = bigWinVideoUrl();
  if (url && bwVideo.getAttribute("src") !== url) { bwVideo.setAttribute("src", url); bwVideo.load(); }
}
const toastEl = $("toast");
const toastTag = $("toastTag");
const toastBig = $("toastBig");

/* Panneau éphémère centré dans la zone de jeu (retrigger, fin des free spins…) */
async function showStageToast(tag, big, ms) {
  if (!hasLayout()) return;
  toastTag.textContent = tag || "";
  toastBig.textContent = big || "";
  toastEl.classList.add("show");
  await sleep(ms);
  toastEl.classList.remove("show");
  await sleep(280);
}

async function showBanner(unitWin) {
  state.lastBigWin = true;                 // pour l'autoplay (stop sur big win)
  const chips = round2(unitWin * bet());
  const tier = bigWinTierInfo(unitWin);
  bwTag.textContent = tier.name;
  const mega = unitWin >= 100;             // 100x+ : grosse animation + musique ; 20–99x : panneau seul
  Snd.bigWin();                            // stinger (les deux paliers)

  // headless / pas de DOM animable : on ne joue pas l'écran
  if (typeof requestAnimationFrame !== "function" || !hasLayout()) return;

  if (bwHint) bwHint.classList.remove("show");
  bwAmount.textContent = fmt(0);
  winBanner.classList.toggle("mega", mega);   // .mega -> affiche la vidéo (CSS)
  winBanner.classList.remove(...BW_TIER_CLASSES);
  winBanner.classList.add("tier-" + tier.key);   // identité visuelle du palier
  winBanner.classList.add("show");
  document.body.classList.add("bigwin-active");   // masque HUD/contrôles pendant la célébration (mobile)

  let onEnded = null;
  const prevTrack = Snd.trackName();
  if (mega) {
    ensureBigWinSrc();                    // source vidéo selon l'orientation (portrait / 16:9)
    Snd.setTrack("bigwin");               // musique dédiée seulement à 100x+
    bwVideo.loop = false;                 // joue une fois puis se fige sur la frame 0 (décor propre)
    onEnded = () => { try { bwVideo.pause(); bwVideo.currentTime = 0; } catch (e) { /* ignore */ } };
    bwVideo.addEventListener("ended", onEnded);
    try { bwVideo.currentTime = 0; const p = bwVideo.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }

  // tap : pendant le décompte => accélère ; une fois le décompte fini => ferme
  let countDone = false, fastFwd = false, dismiss = false;
  const onTap = () => { if (!countDone) fastFwd = true; else dismiss = true; };
  winBanner.addEventListener("click", onTap);

  // compteur qui défile (ease-out) — durée croissante selon le palier (tension)
  const T = tier.count, t0 = performance.now();
  await new Promise((res) => {
    function step(nowT) {
      if (fastFwd) { res(); return; }
      const k = Math.min(1, (nowT - t0) / T);
      const e = 1 - Math.pow(1 - k, 3);
      bwAmount.textContent = fmt(chips * e);
      if (k < 1) requestAnimationFrame(step); else res();
    }
    requestAnimationFrame(step);
  });
  bwAmount.textContent = fmt(chips);
  countDone = true;

  // Fin de l'animation (mega) : à la place de la frame figée de la vidéo, on révèle
  // le décor du jeu SANS la grille de symboles (portail vide) + palier/montant.
  if (mega) document.body.classList.add("bigwin-reveal");

  // reste affiché jusqu'au tap du joueur (autoplay : referme tout seul pour ne pas bloquer)
  if (bwHint) bwHint.classList.add("show");
  await new Promise((res) => {
    let iv, autoTimer;
    const finish = () => { clearInterval(iv); clearTimeout(autoTimer); res(); };
    iv = setInterval(() => { if (dismiss) finish(); }, 80);
    if (state.autoActive) autoTimer = setTimeout(finish, mega ? 6000 : 3000);
  });
  if (bwHint) bwHint.classList.remove("show");

  winBanner.removeEventListener("click", onTap);
  if (onEnded) bwVideo.removeEventListener("ended", onEnded);
  winBanner.classList.remove("show", "mega", ...BW_TIER_CLASSES);
  document.body.classList.remove("bigwin-active", "bigwin-reveal");
  try { bwVideo.pause(); } catch (e) { /* ignore */ }
  if (mega) Snd.setTrack(prevTrack);      // retour à la musique précédente
  await sleep(mega ? 300 : 150);
}

/* ----------------------------------------------------------------------
   Free spins
   ---------------------------------------------------------------------- */
async function runFreeSpins(bought = false, startWin = 0) {
  const savedAnte = isAnte();
  setAnte(false);          // les free spins n'héritent JAMAIS du boost ante (sinon retriggers en boucle)
  state.inFs = true;       // anticip dès 2 scatters pendant les free spins
  $("fsTitle").textContent = bought ? "FREE SPINS ACHETÉS" : "LE DIEU FOU S'ÉVEILLE";
  fsOverlay.querySelector("#fsSub").textContent = CFG.FS_AWARD + " FREE SPINS";
  Snd.fsTrigger();
  fsOverlay.classList.add("show");
  await new Promise((res) => {
    const btn = $("fsStart");
    let auto = null;
    const done = () => { btn.removeEventListener("click", done); if (auto) clearTimeout(auto); res(); };
    btn.addEventListener("click", done);
    if (state.autoActive) auto = setTimeout(done, 1500);   // auto-valide en autoplay
  });
  fsOverlay.classList.remove("show");
  Snd.fsMusic();                       // bascule sur la musique de free spins

  fsHud.classList.add("show");
  let persist = 0, fsWin = 0, spins = CFG.FS_AWARD;
  // Plafond combiné base+FS : la session FS ne peut pas dépasser le solde
  // restant jusqu'à MAX_WIN (cf. eng.resolveBet) — max win 5000× = total du pari.
  const fsCap = Math.max(0, CFG.MAX_WIN - startWin);
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
    // révélation des orbes du tour (ils s'ajoutent au multiplicateur persistant)
    if (r.multSum > 0) {
      const fc = r.frames[r.frames.length - 1].cells;
      await revealMultipliers(fc);
    }
    persist += r.multSum;
    let w = r.baseWin;
    if (w > 0) w *= (persist > 0 ? persist : 1);
    const sc = r.scatters;
    w += scatterPay(sc);
    const fsBefore = fsWin;
    fsWin += w;
    if (fsWin > fsCap) { fsWin = fsCap; }
    const retrig = sc >= 3;
    if (retrig) spins += CFG.FS_RETRIG;
    setHud();
    if (r.multSum > 0) pulsePill($("fsMult"));
    if (w > 0) {
      const to = fsWin * bet();
      winValEl.textContent = fmt(to); pulseGain();
      gridSparks(Math.min(28, 6 + Math.round(w)), "ichor");
      await countUpEl($("fsWin"), fsBefore * bet(), to, 450);
      await sleep(180);
    }
    if (retrig) { Snd.fsTrigger(); await showStageToast("RETRIGGER", "+" + CFG.FS_RETRIG + " FREE SPINS", 1400); }
    if (fsWin >= fsCap) break;
  }

  state.inFs = false;      // sortie des free spins : anticip revient au seuil de base (3)
  setAnte(savedAnte);      // restaure le réglage ante du joueur
  fsHud.classList.remove("show");
  await showStageToast("TOURS GRATUITS TERMINÉS", fmt(fsWin * bet()) + " jetons", 2400);
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
  state.lastBigWin = false; state.lastFs = false;   // drapeaux pour l'autoplay

  setAnte(state.ante);                // synchronise le moteur
  state.balance = round2(state.balance - round2(spinCost()));
  balanceEl.textContent = fmt(state.balance);
  winValEl.textContent = fmt(0);

  await spinIntro();

  const round = generateRound();
  const res = await animateRound(round, (uw) => {
    winValEl.textContent = fmt(uw * bet());
  });

  // multiplicateurs du jeu de base : révélation des orbes (éclairs + total) puis count-up
  let unitWin = res.baseWin;
  if (unitWin > 0 && res.multSum > 0) {
    const finalCells = round.frames[round.frames.length - 1].cells;
    await revealMultipliers(finalCells);
    const before = unitWin * bet();
    unitWin *= res.multSum;
    await countUpWin(before, unitWin * bet());
  }
  // gains directs scatter
  const sc = res.scatters;
  unitWin += scatterPay(sc);
  if (unitWin > CFG.MAX_WIN) unitWin = CFG.MAX_WIN;

  // crediter (count-up du solde + étincelles proportionnelles au gain)
  await creditWin(unitWin);

  // free spins ?
  if (sc >= CFG.TRIGGER) {
    state.lastFs = true;
    const fsUnit = await runFreeSpins(false, unitWin);   // plafond combiné base+FS
    await creditWin(fsUnit);
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
  await dropIn(cells, true, false);    // achat : pas d'anticipation (révélation directe)
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
  await creditWin(fsUnit);
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
  const m = $("insufficientModal");
  if (m) m.classList.add("show");
}

/* ----------------------------------------------------------------------
   Autoplay : enchaîne des spins jusqu'à épuisement du compteur,
   solde insuffisant, ou arrêt manuel.
   ---------------------------------------------------------------------- */
function updateAutoUI() {
  autoBtn.classList.toggle("running", state.autoActive);
  if (state.autoActive) {
    autoLbl.textContent = state.auto < 0 ? "STOP" : (state.auto + " ▸");
    autoBtn.title = "Arrêter les tours automatiques";
  } else {
    autoLbl.textContent = "AUTO";
    autoBtn.title = "Tours automatiques";
  }
}
function stopAuto() {
  state.autoActive = false;
  state.auto = 0;
  updateAutoUI();
}
async function runAuto() {
  while (state.autoActive && state.auto !== 0) {
    if (state.balance < round2(spinCost())) { flashInsufficient(); break; }
    if (state.auto > 0) state.auto--;
    updateAutoUI();
    await spin();
    if (!state.autoActive) break;            // arrêt manuel pendant le spin
    if (state.autoStopFs && state.lastFs) break;          // stop sur free spins
    if (state.autoStopBigWin && state.lastBigWin) break;  // stop sur big win
    await sleep(dur(260));                    // petite pause entre deux tours
  }
  stopAuto();
}
function startAuto(n) {
  if (state.autoActive) return;
  autoMenu.classList.remove("show");
  if (state.balance < round2(spinCost())) { flashInsufficient(); return; }
  state.autoActive = true;
  state.auto = n;                            // -1 = illimité
  updateAutoUI();
  runAuto();
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
    `<div class="pt-thumb"><img src="${orbSrc()}" alt=""></div>` +
    `<div class="pt-name">Orbe multiplicateur</div>` +
    `<div class="pt-pays"><span>×2 → ×500 · s'additionnent</span></div></div>`;

  const rules =
    `<div class="pt-rules"><h3>Règles</h3><p>` +
    `<b>Pay-anywhere :</b> 8 symboles identiques ou plus, n'importe où sur la grille, paient.<br>` +
    `<b>Tumble :</b> les gagnants disparaissent, les autres tombent, de nouveaux arrivent — tant qu'il y a un gain.<br>` +
    `<b>Orbes :</b> les multiplicateurs présents s'additionnent et multiplient le gain de la séquence.<br>` +
    `<b>Free spins :</b> 4 Orbes d'Olympe ou plus déclenchent 15 tours ; multiplicateur persistant.<br>` +
    `<b>Ante bet :</b> mise +25 %, free spins plus fréquents. <b>Buy :</b> achat direct (100× la mise).<br>` +
    `<b>Max win :</b> 5000× la mise. <b>RTP :</b> ≈ 96 %.` +
    `</p></div>`;

  body.innerHTML = rows + rules;
}

/* ----------------------------------------------------------------------
   Controles
   ---------------------------------------------------------------------- */
// Persistance des réglages (PAS le solde) : mise, vitesse, sons.
const SETTINGS_KEY = "got_settings";
function hasStorage() {
  try { return typeof localStorage !== "undefined" && localStorage; } catch (e) { return false; }
}
function saveSettings() {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      bet: state.betIndex, speed: state.speedIndex,
      sfx: Snd.isSfxOn(), music: Snd.isMusicOn(),
      autoStopBig: state.autoStopBigWin, autoStopFs: state.autoStopFs,
    }));
  } catch (e) { /* quota / mode privé : on ignore */ }
}
function loadSettings() {
  if (!hasStorage()) return;
  let s;
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch (e) { return; }
  if (!s || typeof s !== "object") return;
  if (Number.isInteger(s.bet) && s.bet >= 0 && s.bet < BETS.length) state.betIndex = s.bet;
  if (Number.isInteger(s.speed) && s.speed >= 0 && s.speed < SPEEDS.length) state.speedIndex = s.speed;
  if (s.sfx === false) Snd.setSfx(false);     // par défaut activés
  if (s.music === false) Snd.setMusic(false);
  if (s.autoStopBig === true) state.autoStopBigWin = true;
  if (s.autoStopFs === true) state.autoStopFs = true;
}

function updateBet() {
  betValEl.textContent = fmt(spinCost());
  buyCostEl.textContent = fmt(buyCost());
  if (anteCostEl) anteCostEl.textContent = "+" + fmt(bet() * (ANTE_COST_MULT - 1));
}

function updateSpeed() {
  const lit = state.speedIndex + 1;   // NORMAL=1 éclair, RAPIDE=2, TURBO=3
  speedBolts.forEach((b, i) => b.classList.toggle("on", i < lit));
  speedBtn.classList.toggle("turbo", SPEEDS[state.speedIndex].name === "TURBO");
  speedBtn.title = "Vitesse : " + SPEEDS[state.speedIndex].name;
}
$("betUp").addEventListener("click", () => {
  Snd.click();
  if (state.busy) return;
  state.betIndex = Math.min(BETS.length - 1, state.betIndex + 1); updateBet(); saveSettings();
});
$("betDown").addEventListener("click", () => {
  Snd.click();
  if (state.busy) return;
  state.betIndex = Math.max(0, state.betIndex - 1); updateBet(); saveSettings();
});
anteBtn.addEventListener("click", () => {
  Snd.click();
  if (state.busy) return;
  state.ante = !state.ante;
  setAnte(state.ante);
  anteBtn.classList.toggle("on", state.ante);
  updateBet();
});
const buyConfirm = $("buyConfirm");
const buyConfirmBtn = $("buyConfirmBtn");
const buyCancel = $("buyCancel");
const buyConfirmCost = $("buyConfirmCost");
buyBtn.addEventListener("click", () => {
  if (state.busy) return;
  Snd.click();
  buyConfirmCost.textContent = fmt(buyCost());
  buyConfirm.classList.add("show");
});
buyCancel.addEventListener("click", () => { Snd.click(); buyConfirm.classList.remove("show"); });
buyConfirmBtn.addEventListener("click", () => { Snd.click(); buyConfirm.classList.remove("show"); buyBonus(); });
buyConfirm.addEventListener("click", (e) => { if (e.target === buyConfirm) buyConfirm.classList.remove("show"); });
const insufficientModal = $("insufficientModal");
$("insufficientOk").addEventListener("click", () => { Snd.click(); insufficientModal.classList.remove("show"); });
insufficientModal.addEventListener("click", (e) => { if (e.target === insufficientModal) insufficientModal.classList.remove("show"); });
function updateSndMenu() {
  const sfx = Snd.isSfxOn(), mus = Snd.isMusicOn();
  sfxToggle.classList.toggle("on", sfx);
  musToggle.classList.toggle("on", mus);
  allToggle.classList.toggle("on", sfx || mus);
  menuBtn.classList.toggle("muted", !sfx && !mus);
}
menuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  kickAudio();
  Snd.click();
  mainMenu.classList.toggle("show");
  if (!mainMenu.classList.contains("show")) {   // fermeture -> on replie le sous-menu Sons
    sndSub.classList.remove("show"); mmSons.classList.remove("open");
  }
});
// « Sons » : déplie/replie les réglages audio (le menu reste ouvert)
mmSons.addEventListener("click", (e) => {
  e.stopPropagation();
  Snd.click();
  const open = sndSub.classList.toggle("show");
  mmSons.classList.toggle("open", open);
});
// « Gains » : ouvre la liste des gains et ferme le menu
mmGains.addEventListener("click", (e) => {
  e.stopPropagation();
  Snd.click();
  mainMenu.classList.remove("show");
  sndSub.classList.remove("show"); mmSons.classList.remove("open");
  ptOverlay.classList.add("show");
});
allToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  kickAudio();
  const target = !(Snd.isSfxOn() || Snd.isMusicOn()); // si tout coupé -> tout activer
  Snd.setAll(target); if (target) Snd.click(); updateSndMenu(); saveSettings();
});
sfxToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  Snd.setSfx(!Snd.isSfxOn()); Snd.click(); updateSndMenu(); saveSettings();
});
musToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  kickAudio();
  Snd.setMusic(!Snd.isMusicOn()); Snd.click(); updateSndMenu(); saveSettings();
});
document.addEventListener("click", () => {
  mainMenu.classList.remove("show");
  sndSub.classList.remove("show"); mmSons.classList.remove("open");
});
speedBtn.addEventListener("click", () => {
  Snd.click();
  state.speedIndex = (state.speedIndex + 1) % SPEEDS.length;  // modifiable même en free spins
  updateSpeed(); saveSettings();
});
autoBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  Snd.click();
  if (state.autoActive) { stopAuto(); return; }   // en cours -> stop
  if (state.busy) return;                          // pas pendant un spin manuel
  autoMenu.classList.toggle("show");
});
autoMenu.querySelectorAll(".auto-opt").forEach((opt) => {
  opt.addEventListener("click", (e) => {
    e.stopPropagation();
    Snd.click();
    startAuto(parseInt(opt.dataset.n, 10));
  });
});
// Options autoplay : stop sur big win / free spins (toggles)
const autoStopBigBtn = $("autoStopBig"), autoStopFsBtn = $("autoStopFs");
function updateAutoStops() {
  if (autoStopBigBtn) autoStopBigBtn.classList.toggle("on", state.autoStopBigWin);
  if (autoStopFsBtn) autoStopFsBtn.classList.toggle("on", state.autoStopFs);
}
if (autoStopBigBtn) autoStopBigBtn.addEventListener("click", (e) => {
  e.stopPropagation(); Snd.click();
  state.autoStopBigWin = !state.autoStopBigWin; updateAutoStops(); saveSettings();
});
if (autoStopFsBtn) autoStopFsBtn.addEventListener("click", (e) => {
  e.stopPropagation(); Snd.click();
  state.autoStopFs = !state.autoStopFs; updateAutoStops(); saveSettings();
});
document.addEventListener("click", () => { autoMenu.classList.remove("show"); });
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
  const emberCount = (typeof window !== "undefined" && window.innerWidth && window.innerWidth < 560) ? 7 : 16;
  for (let i = 0; i < emberCount; i++) {
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

dropIn(Array.from({ length: CFG.CELLS }, newCell), false);   // remplissage initial statique (pas d'animation)
buildPaytable();
loadSettings();          // réglages sauvegardés (mise, vitesse, sons) — pas le solde
updateBet();
updateSpeed();
updateSndMenu();
updateAutoUI();
updateAutoStops();
balanceEl.textContent = fmt(state.balance);

/* ----------------------------------------------------------------------
   Écran de chargement : précharge les images (symboles + décor),
   affiche la progression, puis se retire en fondu.
   ---------------------------------------------------------------------- */
(function preloadAssets() {
  if (typeof Image === "undefined" || typeof document === "undefined") return; // headless
  const loader = $("loader");
  if (!loader) return;
  const fill = $("loaderFill"), pct = $("loaderPct");
  const bg = $("bgArt");
  const bgSrc = bg && typeof bg.getAttribute === "function" ? bg.getAttribute("src") : null;
  const urls = Object.keys(SYM_FILE).map(symSrc);
  if (bgSrc) urls.push(bgSrc);

  let done = 0;
  const total = urls.length;
  let finished = false;
  const setProgress = (n) => {
    const p = total ? Math.round((n / total) * 100) : 100;
    if (fill) fill.style.width = p + "%";
    if (pct) pct.textContent = p + "%";
  };
  const hide = () => {
    if (finished) return;
    finished = true;
    setProgress(total);
    if (typeof window !== "undefined" && typeof window.__hideLoader === "function") { window.__hideLoader(); return; }
    loader.classList.add("hide");
    setTimeout(() => loader.remove(), 600);
  };
  const tick = () => { done++; setProgress(done); if (done >= total) hide(); };

  setProgress(0);
  urls.forEach((u) => {
    const img = new Image();
    img.onload = tick;
    img.onerror = tick;       // on n'attend pas une image cassée
    img.src = u;
  });
  if (total === 0) hide();
  setTimeout(hide, 6000);     // garde-fou : ne jamais rester bloqué
})();
