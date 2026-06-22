"""
Worker d'accumulation : lance un lot de spins et AJOUTE les totaux a un fichier.
On l'appelle plusieurs fois (seeds differentes) pour cumuler des millions de spins.
Usage : python accumulate.py <n_spins> <seed>
Agregation : python accumulate.py report
"""
import sys
import os
import random
import slot_engine as eng

ACC = "/tmp/slot_acc.csv"


def worker(n, seed):
    rng = random.Random(seed)
    tb = tw = 0.0
    hits = fs = 0
    mx = 0.0
    for _ in range(n):
        tb += 1.0
        w, trig, _ = eng.play_bet(rng)   # pari complet, plafond combine base+FS
        if trig:
            fs += 1
        tw += w
        if w > 0:
            hits += 1
        if w > mx:
            mx = w
    with open(ACC, "a") as f:
        f.write(f"{n},{tw},{hits},{fs},{mx},{seed}\n")
    print(f"+{n:,} spins (seed {seed}) : RTP lot = {tw/tb*100:.2f} %")


def report():
    if not os.path.exists(ACC):
        print("Aucun resultat.")
        return
    N = TW = H = FS = 0.0
    MX = 0.0
    with open(ACC) as f:
        for line in f:
            n, tw, hits, fs, mx, seed = line.strip().split(",")
            N += float(n); TW += float(tw); H += float(hits)
            FS += float(fs); MX = max(MX, float(mx))
    print("=" * 56)
    print(f"  CUMUL : {int(N):,} spins")
    print(f"  RTP global ......... {TW/N*100:.3f} %")
    print(f"  Hit rate ........... {H/N*100:.2f} %")
    print(f"  Free spins ......... 1 / {N/FS:,.0f} spins")
    print(f"  Gain max observe ... {MX:,.1f} x la mise")
    print("=" * 56)


if __name__ == "__main__":
    if sys.argv[1] == "report":
        report()
    else:
        worker(int(sys.argv[1]), int(sys.argv[2]))
