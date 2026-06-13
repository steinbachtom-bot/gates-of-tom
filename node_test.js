/* Test du moteur JS : verifie le RTP et l'absence d'erreur. */
const eng = require("./engine.js");

function simulate(n) {
  let bet = 0, win = 0, hits = 0, fs = 0, mx = 0;
  for (let i = 0; i < n; i++) {
    bet += 1;
    const r = eng.resolveBaseSpin();
    let w = r.win;
    if (r.trigger) { fs++; w += eng.resolveFreeSpins(); }
    win += w;
    if (w > 0) hits++;
    if (w > mx) mx = w;
  }
  return { rtp: win / bet, hit: hits / n, fsFreq: fs / n, mx };
}

const N = parseInt(process.argv[2] || "500000", 10);
const t0 = Date.now();
const r = simulate(N);
console.log(`Moteur JS — ${N.toLocaleString("fr-FR")} spins`);
console.log(`  RTP ............ ${(r.rtp * 100).toFixed(2)} %`);
console.log(`  Hit rate ....... ${(r.hit * 100).toFixed(2)} %`);
console.log(`  Free spins ..... 1 / ${(1 / r.fsFreq).toFixed(0)} spins`);
console.log(`  Gain max ....... ${r.mx.toFixed(1)} x`);
console.log(`  (en ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
