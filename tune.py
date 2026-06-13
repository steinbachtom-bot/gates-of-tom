"""
Chercheur de calibrage : teste des combinaisons de poids pour viser RTP ~96%.
On fait varier :
  - sym_scale  : facteur multiplicatif sur les poids des symboles de paiement
  - scatter_w  : poids du scatter (frequence des free spins)
  - mult_w     : poids des orbes multiplicateurs
"""
import random
import slot_engine as eng

BASE_SYM = dict(eng.SYMBOL_WEIGHTS)


def configure(sym_scale, scatter_w, mult_w):
    eng.SYMBOL_WEIGHTS = {k: v * sym_scale for k, v in BASE_SYM.items()}
    eng.SCATTER_WEIGHT = scatter_w
    eng.MULT_WEIGHT = mult_w
    # Reconstruire la roue de tirage
    eng._PAY_SYMBOLS = list(eng.SYMBOL_WEIGHTS.keys())
    eng._DRAW_POOL = eng._PAY_SYMBOLS + ["SCATTER", "MULT"]
    eng._DRAW_WEIGHTS = (
        [eng.SYMBOL_WEIGHTS[s] for s in eng._PAY_SYMBOLS]
        + [eng.SCATTER_WEIGHT, eng.MULT_WEIGHT]
    )


def quick_rtp(n=70_000, seeds=(7,)):
    # Moyenne sur plusieurs seeds pour reduire le bruit
    rtps, hits_, fss_ = [], [], []
    for seed in seeds:
        rng = random.Random(seed)
        tb = tw = 0.0
        hits = 0
        fs = 0
        for _ in range(n):
            tb += 1.0
            w, trig, _ = eng.play_base_spin(rng)
            if trig:
                fs += 1
                w += eng.play_free_spins(rng)
            tw += w
            if w > 0:
                hits += 1
        rtps.append(tw / tb)
        hits_.append(hits / n)
        fss_.append(fs / n)
    return (sum(rtps) / len(rtps), sum(hits_) / len(hits_),
            sum(fss_) / len(fss_))


grid = []
for sym_scale in [1.25, 1.40, 1.55]:
    for scatter_w in [6, 7]:
        for mult_w in [4, 5]:
            configure(sym_scale, scatter_w, mult_w)
            rtp, hit, fsf = quick_rtp()
            grid.append((sym_scale, scatter_w, mult_w, rtp, hit, fsf))
            print(f"sym*{sym_scale:<4} scat={scatter_w} mult={mult_w} "
                  f"| RTP={rtp*100:6.2f}%  hit={hit*100:5.2f}%  "
                  f"FS=1/{1/fsf:,.0f}")

best = min(grid, key=lambda r: abs(r[3] - 0.96))
print("\nMeilleur vers 96% :", best)
