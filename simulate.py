"""
Simulateur Monte-Carlo : lance N spins et mesure les metriques cles.
Usage : python simulate.py [nb_spins] [seed]
"""

import sys
import random
import time

import slot_engine as eng


def run(n_spins, seed=12345):
    rng = random.Random(seed)
    bet = 1.0

    total_bet = 0.0
    total_win = 0.0
    wins_count = 0          # spins avec gain > 0
    fs_triggers = 0         # nb de declenchements de free spins
    fs_total_win = 0.0      # gain cumule venant des free spins
    base_total_win = 0.0    # gain cumule du jeu de base
    max_win = 0.0           # plus gros gain sur un round complet (x mise)
    win_buckets = {"0x": 0, "0-1x": 0, "1-5x": 0, "5-20x": 0,
                   "20-100x": 0, "100-1000x": 0, "1000x+": 0}

    for _ in range(n_spins):
        total_bet += bet
        spin_win, trigger, _sc = eng.play_base_spin(rng)
        base_total_win += spin_win
        round_win = spin_win

        if trigger:
            fs_triggers += 1
            fs_win = eng.play_free_spins(rng)
            fs_total_win += fs_win
            round_win += fs_win

        total_win += round_win
        if round_win > 0:
            wins_count += 1
        if round_win > max_win:
            max_win = round_win

        # Repartition des gains
        if round_win == 0:
            win_buckets["0x"] += 1
        elif round_win < 1:
            win_buckets["0-1x"] += 1
        elif round_win < 5:
            win_buckets["1-5x"] += 1
        elif round_win < 20:
            win_buckets["5-20x"] += 1
        elif round_win < 100:
            win_buckets["20-100x"] += 1
        elif round_win < 1000:
            win_buckets["100-1000x"] += 1
        else:
            win_buckets["1000x+"] += 1

    rtp = total_win / total_bet
    hit_rate = wins_count / n_spins
    fs_freq = fs_triggers / n_spins

    print("=" * 60)
    print(f"  RESULTATS SUR {n_spins:,} SPINS  (seed={seed})")
    print("=" * 60)
    print(f"  RTP global ............. {rtp*100:.2f} %")
    print(f"     dont jeu de base .... {base_total_win/total_bet*100:.2f} %")
    print(f"     dont free spins ..... {fs_total_win/total_bet*100:.2f} %")
    print(f"  Hit rate (taux de gain)  {hit_rate*100:.2f} %")
    print(f"  Free spins : 1 fois tous les {1/fs_freq:,.0f} spins"
          if fs_freq > 0 else "  Free spins : jamais declenches")
    print(f"  Gain max observe ....... {max_win:,.1f} x la mise")
    print("-" * 60)
    print("  Repartition des gains par round :")
    for k, v in win_buckets.items():
        print(f"     {k:<12} {v/n_spins*100:6.2f} %")
    print("=" * 60)
    return rtp


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 200_000
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 12345
    t0 = time.time()
    run(n, seed)
    print(f"  (calcule en {time.time()-t0:.1f} s)")
