/* ======================================================================
   MOTEUR MATH (port JS de slot_engine.py) — jetons virtuels uniquement
   Source unique de la math, utilisee par le jeu (index.html) ET les tests.
   ====================================================================== */
const CFG = {
  ROWS:5, REELS:6, CELLS:30,
  SYMBOLS:{ // poids d'apparition
    crown:22.5, hourglass:25, ring:27.5, chalice:30,
    gem_red:32.5, gem_purple:35, gem_yellow:37.5, gem_green:40, gem_blue:42.5
  },
  PAYTABLE:{ // x mise totale : [8-9, 10-11, 12+]
    crown:[10,25,50], hourglass:[2.5,10,25], ring:[2,5,15], chalice:[1.5,2,12],
    gem_red:[1,1.5,10], gem_purple:[0.8,1.2,8], gem_yellow:[0.5,1,6],
    gem_green:[0.4,0.9,5], gem_blue:[0.25,0.75,4]
  },
  SCATTER_W:7, MULT_W:5,
  SCATTER_PAYS:{4:3,5:5,6:100}, TRIGGER:4, FS_AWARD:15, FS_RETRIG:5,
  MULT_VALUES:[2,3,4,5,6,8,10,12,15,20,25,50,100,250,500],
  MULT_WEIGHTS:[300,250,200,160,130,90,70,50,35,22,14,6,3,1,1],
  PAY_SCALE:0.851, MAX_WIN:5000
};

const PAY_KEYS = Object.keys(CFG.SYMBOLS);
const DRAW_POOL = [...PAY_KEYS, "SCATTER", "MULT"];
const BASE_PAY_W = PAY_KEYS.map(k=>CFG.SYMBOLS[k]);

// Ante bet : mise +25 %, scatters boostes (~double la frequence des free spins).
let anteActive = false;
const ANTE_SCATTER_MULT = 1.9;
const ANTE_COST_MULT = 1.25;
function setAnte(v){ anteActive = !!v; }
function isAnte(){ return anteActive; }
function drawWeights(){
  return [...BASE_PAY_W, CFG.SCATTER_W*(anteActive?ANTE_SCATTER_MULT:1), CFG.MULT_W];
}

function wchoice(pool, weights){
  let t=weights.reduce((a,b)=>a+b,0), r=Math.random()*t;
  for(let i=0;i<pool.length;i++){ r-=weights[i]; if(r<=0) return pool[i]; }
  return pool[pool.length-1];
}
function newCell(){
  const s=wchoice(DRAW_POOL,drawWeights());
  if(s==="MULT") return {t:"MULT", v:wchoice(CFG.MULT_VALUES,CFG.MULT_WEIGHTS)};
  return {t:s, v:0};
}
function payFor(sym,count){
  if(count<8) return 0;
  const tier = count<=9?0 : (count<=11?1:2);
  return CFG.PAYTABLE[sym][tier]*CFG.PAY_SCALE;
}
const idx=(c,r)=>c*CFG.ROWS+r;

/* Genere un round complet et renvoie les FRAMES pour l'animation. */
function generateRound(){
  let cells = Array.from({length:CFG.CELLS}, newCell);
  const frames=[];
  let baseWin=0;
  while(true){
    const counts={};
    cells.forEach(c=>{ if(CFG.SYMBOLS[c.t]) counts[c.t]=(counts[c.t]||0)+1; });
    const winSyms=new Set(); let stepWin=0;
    for(const s in counts){ const p=payFor(s,counts[s]); if(p>0){ stepWin+=p; winSyms.add(s);} }
    const winCells=[];
    cells.forEach((c,i)=>{ if(winSyms.has(c.t)) winCells.push(i); });
    frames.push({cells:cells.map(c=>({...c})), winCells, stepWin});
    if(stepWin<=0) break;
    baseWin+=stepWin;
    const next=cells.map(c=>({...c}));
    for(let c=0;c<CFG.REELS;c++){
      const kept=[];
      for(let r=0;r<CFG.ROWS;r++){ const cell=cells[idx(c,r)]; if(!winSyms.has(cell.t)) kept.push(cell); }
      const need=CFG.ROWS-kept.length;
      const col=[]; for(let k=0;k<need;k++) col.push(newCell());
      col.push(...kept);
      for(let r=0;r<CFG.ROWS;r++) next[idx(c,r)]=col[r];
    }
    cells=next;
  }
  const final=frames[frames.length-1].cells;
  const multSum=final.reduce((a,c)=>a+(c.t==="MULT"?c.v:0),0);
  const scatters=Math.min(final.filter(c=>c.t==="SCATTER").length,6);
  return {frames, multSum, scatters, baseWin};
}

/* Gain direct des scatters (x mise). */
function scatterPay(sc){
  if(sc>=6) return CFG.SCATTER_PAYS[6];
  return CFG.SCATTER_PAYS[sc] || 0;
}

/* Resolution MATH pure (sans animation) — sert de source de verite et de test. */
function resolveBaseSpin(){
  const r=generateRound();
  let win=r.baseWin;
  if(win>0 && r.multSum>0) win*=r.multSum;
  win+=scatterPay(r.scatters);
  if(win>CFG.MAX_WIN) win=CFG.MAX_WIN;
  return {win, trigger:r.scatters>=CFG.TRIGGER};
}
function resolveFreeSpins(){
  let spins=CFG.FS_AWARD, persist=0, total=0;
  while(spins>0){
    spins--;
    const r=generateRound();
    persist+=r.multSum;
    let w=r.baseWin;
    if(w>0) w*=(persist>0?persist:1);
    w+=scatterPay(r.scatters);
    total+=w;
    if(r.scatters>=3) spins+=CFG.FS_RETRIG;
    if(total>=CFG.MAX_WIN){ total=CFG.MAX_WIN; break; }
  }
  return total;
}

// Export pour Node (tests). Sans effet dans le navigateur.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CFG, PAY_KEYS, newCell, generateRound,
                     scatterPay, resolveBaseSpin, resolveFreeSpins,
                     setAnte, isAnte, ANTE_COST_MULT };
}
