/* ======================================================================
   GATES OF TOM — logique du client (rendu + animations + flux de jeu)
   Jetons virtuels uniquement. S'appuie sur le moteur defini dans index.html
   ====================================================================== */

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

const BETS = [4, 10, 20, 40, 100, 200];

const state = {
  balance: 10000,
  betIndex: 2,
  busy: false,
  ante: false,
};
const BUY_COST_MULT = 100; // achat des free spins = 100x la mise

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

/* Noms d'affichage (selon l'art applique) */
const SYM_NAME = {
  crown: "Roi-lion", hourglass: "Seigneur démon", ring: "Zeus cornu", chalice: "Masque démon",
  gem_red: "Rubis", gem_purple: "Couronne", gem_yellow: "Laurier", gem_green: "Émeraude", gem_blue: "Saphir",
  SCATTER: "Orbe d'Olympe",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
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
        const delay = c * 45 + (CFG.ROWS - 1 - r) * 26; // gauche->droite, remplit par le bas
        t.style.transition = `transform .42s ${DROP_EASE} ${delay}ms`;
        t.style.transform = "translateY(0)";
      }
    }
  }
}

/* Disparition des gagnants : lueur + fumee + dissolution, puis retrait. */
async function clearWinners(winCells) {
  winCells.forEach((i) => { const t = tileAt[i]; if (t) t.classList.add("winglow"); });
  await sleep(220);
  winCells.forEach((i) => { const t = tileAt[i]; if (t) { puffSmoke(t); t.classList.add("popping"); } });
  await sleep(430);
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
    t.style.transition = `transform .38s ${DROP_EASE}`;
    t.style.transform = "translateY(0)";
  });
  created.forEach(({ t, r }) => {                // play nouveaux (vague)
    const delay = r * 32; if (delay > maxDelay) maxDelay = delay;
    t.style.transition = `transform .42s ${DROP_EASE} ${delay}ms`;
    t.style.transform = "translateY(0)";
  });
  await sleep(440 + maxDelay);
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
  dropIn(frames[0].cells);              // descente initiale (toutes les colonnes)
  await sleep(hasLayout() ? 760 : 0);
  let i = 0;
  while (frames[i] && frames[i].winCells.length) {
    unitWin += frames[i].stepWin;
    if (onPartial) onPartial(unitWin);
    await clearWinners(frames[i].winCells);
    if (frames[i + 1]) await tumbleTo(frames[i + 1].cells);
    i++;
  }
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
  fsOverlay.classList.add("show");
  await new Promise((res) => {
    const btn = $("fsStart");
    const handler = () => { btn.removeEventListener("click", handler); res(); };
    btn.addEventListener("click", handler);
  });
  fsOverlay.classList.remove("show");

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
  return fsWin;
}

/* ----------------------------------------------------------------------
   Spin principal
   ---------------------------------------------------------------------- */
async function spin() {
  if (state.busy) return;
  if (state.balance < spinCost()) { flashInsufficient(); return; }
  setBusy(true);
  spinBtn.classList.add("spinning");

  setAnte(state.ante);                // synchronise le moteur
  state.balance -= spinCost();
  balanceEl.textContent = fmt(state.balance);
  winValEl.textContent = "0";

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
    state.balance += totalUnit * bet();
    balanceEl.textContent = fmt(state.balance);
    winValEl.textContent = fmt(totalUnit * bet());
    if (totalUnit >= 20) await showBanner(totalUnit);
  }

  // free spins ?
  if (sc >= CFG.TRIGGER) {
    const fsUnit = await runFreeSpins();
    if (fsUnit > 0) {
      state.balance += fsUnit * bet();
      balanceEl.textContent = fmt(state.balance);
      winValEl.textContent = fmt(fsUnit * bet());
      if (fsUnit >= 20) await showBanner(fsUnit);
    }
  }

  spinBtn.classList.remove("spinning");
  setBusy(false);
}

/* Bonus buy : payer pour entrer directement dans les free spins. */
async function buyBonus() {
  if (state.busy) return;
  if (state.balance < buyCost()) { flashInsufficient(); return; }
  setBusy(true);
  setAnte(false);                    // l'achat ignore l'ante
  state.balance -= buyCost();
  balanceEl.textContent = fmt(state.balance);
  winValEl.textContent = "0";

  const fsUnit = await runFreeSpins(true);
  if (fsUnit > 0) {
    state.balance += fsUnit * bet();
    balanceEl.textContent = fmt(state.balance);
    winValEl.textContent = fmt(fsUnit * bet());
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
}
$("betUp").addEventListener("click", () => {
  if (state.busy) return;
  state.betIndex = Math.min(BETS.length - 1, state.betIndex + 1); updateBet();
});
$("betDown").addEventListener("click", () => {
  if (state.busy) return;
  state.betIndex = Math.max(0, state.betIndex - 1); updateBet();
});
anteBtn.addEventListener("click", () => {
  if (state.busy) return;
  state.ante = !state.ante;
  setAnte(state.ante);
  anteBtn.classList.toggle("on", state.ante);
  updateBet();
});
buyBtn.addEventListener("click", buyBonus);
payBtn.addEventListener("click", () => ptOverlay.classList.add("show"));
ptClose.addEventListener("click", () => ptOverlay.classList.remove("show"));
ptOverlay.addEventListener("click", (e) => { if (e.target === ptOverlay) ptOverlay.classList.remove("show"); });
spinBtn.addEventListener("click", spin);
document.addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); spin(); } });

/* ----------------------------------------------------------------------
   Init
   ---------------------------------------------------------------------- */
const fsOrb = $("fsOrb");
if (fsOrb) fsOrb.src = symSrc("SCATTER");

dropIn(Array.from({ length: CFG.CELLS }, newCell));
buildPaytable();
updateBet();
balanceEl.textContent = fmt(state.balance);
