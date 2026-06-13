"""Test des configs finalistes sur un echantillon plus grand (2 seeds)."""
import random
import slot_engine as eng
from tune import configure, quick_rtp

candidates = [
    (1.15, 7, 4.0),
    (1.20, 7, 4.0),
    (1.25, 7, 4.3),
    (1.20, 7, 4.3),
]

for sym, scat, mult in candidates:
    configure(sym, scat, mult)
    rtp, hit, fsf = quick_rtp(n=110_000, seeds=(7, 99))
    print(f"sym*{sym:<4} scat={scat} mult={mult} "
          f"| RTP={rtp*100:6.2f}%  hit={hit*100:5.2f}%  FS=1/{1/fsf:,.0f}")
