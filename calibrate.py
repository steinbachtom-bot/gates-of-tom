"""
Calibrage final : on fixe les parametres de structure (qui pilotent le FEEL),
puis on regle le PAY_SCALE pour viser exactement 96% de RTP.
"""
import random
import slot_engine as eng

TARGET_RTP = 0.96

# --- Parametres de structure (le "ressenti" du jeu) ---
SYM_SCALE = 1.25     # frequence des gains de base
SCATTER_W = 7        # frequence des free spins
MULT_W = 5           # frequence des orbes multiplicateurs

BASE_SYM = dict(eng.SYMBOL_WEIGHTS)


def configure():
    eng.SYMBOL_WEIGHTS = {k: v * SYM_SCALE for k, v in BASE_SYM.items()}
    eng.SCATTER_WEIGHT = SCATTER_W
    eng.MULT_WEIGHT = MULT_W
    eng._PAY_SYMBOLS = list(eng.SYMBOL_WEIGHTS.keys())
    eng._DRAW_POOL = eng._PAY_SYMBOLS + ["SCATTER", "MULT"]
    eng._DRAW_WEIGHTS = (
        [eng.SYMBOL_WEIGHTS[s] for s in eng._PAY_SYMBOLS]
        + [eng.SCATTER_WEIGHT, eng.MULT_WEIGHT]
    )


def measure(n, seed):
    rng = random.Random(seed)
    tb = tw = 0.0
    for _ in range(n):
        tb += 1.0
        w, trig, _ = eng.play_base_spin(rng)
        if trig:
            w += eng.play_free_spins(rng)
        tw += w
    return tw / tb


configure()

# 1) Mesure avec PAY_SCALE = 1
eng.PAY_SCALE = 1.0
rtp1 = measure(400_000, seed=21)
print(f"RTP brut (PAY_SCALE=1) ............ {rtp1*100:.2f} %")

# 2) Reglage lineaire
scale = TARGET_RTP / rtp1
eng.PAY_SCALE = scale
print(f"PAY_SCALE calcule ................. {scale:.4f}")

# 3) Confirmation
rtp2 = measure(400_000, seed=777)
print(f"RTP apres reglage (seed neuf) ..... {rtp2*100:.2f} %")
print(f"\n>>> PAY_SCALE a inscrire dans slot_engine.py : {scale:.4f}")
