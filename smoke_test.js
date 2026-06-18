/* Smoke test headless du client : DOM stub + fast-forward des animations.
   Verifie qu'un grand nombre de spins (dont free spins) s'executent sans
   erreur et que la math du solde reste coherente. */
const fs = require("fs");
const vm = require("vm");

const DIR = __dirname + "/";
const engineSrc = fs.readFileSync(DIR + "engine.js", "utf8");
const gameSrc = fs.readFileSync(DIR + "game.js", "utf8");

// --- DOM stub minimal ---
function makeEl(id) {
  const children = [];
  const classes = new Set();
  const style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
  const el = {
    id, textContent: "", innerHTML: "", _classes: classes,
    style, dataset: {},
    offsetLeft: 0, offsetTop: 0, offsetWidth: 100, offsetHeight: 100,
    remove() {},
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      contains: (x) => classes.has(x),
      toggle: (x) => (classes.has(x) ? classes.delete(x) : classes.add(x)),
    },
    get className() { return [...classes].join(" "); },
    set className(v) { classes.clear(); String(v).split(/\s+/).forEach((x) => x && classes.add(x)); },
    appendChild: (c) => children.push(c),
    get children() { return children; },
    addEventListener: (type, cb) => {
      // Auto-confirme l'ecran free spins : declenche le clic "DECHAINER".
      if (id === "fsStart" && type === "click") setTimeout(cb, 0);
    },
    removeEventListener: () => {},
    querySelector: (sel) => getEl(sel.replace("#", "")),
    querySelectorAll: () => [],
    getAttribute: () => null,
  };
  return el;
}

const registry = {};
function getEl(id) { return (registry[id] ||= makeEl(id)); }

const document = {
  getElementById: getEl,
  createElement: () => makeEl("dyn"),
  addEventListener: () => {},
};

const context = {
  document, console, Math, setTimeout: (fn) => setTimeout(fn, 0),
  module: undefined,
};
context.window = context;
vm.createContext(context);
const exporter = "\nvar __state=state, __spin=spin, __CFG=CFG;";
vm.runInContext(engineSrc + "\n" + gameSrc + exporter, context);
context.state = context.__state;
context.spin = context.__spin;
context.CFG = context.__CFG;

// --- run ---
(async () => {
  const N = parseInt(process.argv[2] || "3000", 10);
  let fsSeen = 0, bigWins = 0, errors = 0;
  let prevBalance = context.state.balance;

  let buys = 0, anteToggles = 0;
  for (let i = 0; i < N; i++) {
    const before = context.state.balance;
    // alterne ante de temps en temps
    if (i % 7 === 0) { context.state.ante = !context.state.ante; context.setAnte(context.state.ante); anteToggles++; }
    try {
      if (i % 40 === 39) { buys++; await context.buyBonus(); }
      else await context.spin();
    } catch (e) {
      errors++;
      if (errors <= 3) console.log("ERREUR:", e.message);
    }
    const bal = context.state.balance;
    if (Number.isNaN(bal)) { console.log("Solde NaN au spin", i); errors++; break; }
    // detection grossiere de free spins via le HUD
    if (registry.fsMult && registry.fsMult.textContent !== "x0") fsSeen++;
    if (bal > before) bigWins++;
    prevBalance = bal;
    // recharge si a sec, pour continuer le test (le buy coute ~100x)
    if (context.state.balance < 5000) context.state.balance += 40000;
  }

  console.log(`Smoke test : ${N} actions jouees`);
  console.log(`  Erreurs ................ ${errors}`);
  console.log(`  Bonus buys ............. ${buys}`);
  console.log(`  Ante toggles ........... ${anteToggles}`);
  console.log(`  Actions avec gain ...... ${bigWins}`);
  console.log(`  Solde final ............ ${Math.round(context.state.balance)}`);
  console.log(errors === 0 ? "  >>> OK : aucun plantage." : "  >>> ECHEC : voir erreurs.");
  process.exit(errors === 0 ? 0 : 1);
})();
