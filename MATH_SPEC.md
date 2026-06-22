# Fiche math (PAR sheet simplifiée) — Slot « pay-anywhere » type Gates of Olympus

Prototype de math, calibré et vérifié par simulation Monte-Carlo.
Ce document résume la mécanique, les paramètres et les résultats mesurés.

## Mécanique

- **Grille** : 6 rouleaux × 5 lignes (30 cases).
- **Gains « pay anywhere »** : 8 symboles identiques ou plus, n'importe où sur la grille, paient. Pas de lignes.
- **Tumble (cascade)** : les symboles gagnants disparaissent, les autres tombent, de nouveaux symboles remplissent le haut, ré-évaluation. On continue tant qu'il y a un gain.
- **Orbes multiplicateurs (Zeus)** : valeurs x2 à x500. En jeu de base, la somme des orbes présents multiplie le gain du round. En free spins, un **multiplicateur persistant** additionne tous les orbes de la session et s'applique à chaque gain.
- **Scatters** : 4 scatters ou plus déclenchent **15 free spins** (retrigger +5 avec 3+ scatters). Gains directs : 4 = 3×, 5 = 5×, 6 = 100× la mise.
- **Plafond de gain (max win)** : 5000× la mise par round. Standard du marché ; indispensable pour borner la volatilité.

## Paramètres calibrés

| Paramètre | Valeur |
|---|---|
| Poids des symboles | crown 22,5 → gem_blue 42,5 (croissant) |
| Poids scatter | 9 |
| Scatters par colonne | **1 maximum** (donc ≤ 6 scatters par grille) |
| Poids orbe multiplicateur | 5 |
| Scaler de gains (PAY_SCALE) | **0,890** (le bouton qui règle le RTP) |
| Ante bet | mise **×1,25**, poids scatter **×1,14** (free spins ~1,55× plus fréquents) — **RTP-neutre ~95,7 %** (≤ base) ; le boost ne s'applique **pas** pendant les free spins |
| Plafond max win | 5000× (sur le **total** du pari : base + free spins) |

Le RTP est **linéaire** en fonction du scaler : pour viser un autre RTP, multiplier le scaler par `RTP_cible / RTP_mesuré`.

## Résultats mesurés (simulation Monte-Carlo)

| Métrique | Valeur |
|---|---|
| **RTP cible** | 96,00 % |
| **RTP mesuré** | ≈ 95,5–96 % (centre ~96 % ; lots de 6 M entre 94,8 % et 96,2 % ; 48 M agrégés) |
| Hit rate (taux de gain) | ≈ 15,1 % |
| Fréquence des free spins | ≈ 1 / 194 spins |
| Gain max observé | ~5000× (plafond), atteint ~1 / 1 300 000 spins |
| Volatilité | **Élevée** (profil « hybride A » : ~44 % du RTP via les free spins, ~52 % via le jeu de base) |

## Note importante sur la précision du RTP

Ce slot est **très volatil** : une grande partie du RTP provient de sessions de free spins rares et très payantes. Conséquence : estimer le RTP à ±0,01 % près (ce qu'exige une certification) demande **plusieurs dizaines de millions de spins**, idéalement en code compilé (C/Rust) tournant plusieurs heures. Le présent prototype atteint la cible à ~±1 % près, ce qui est normal et attendu à ce stade. Les outils fournis (`accumulate.py`) permettent de pousser la précision aussi loin que voulu en cumulant les lots.

## Fichiers livrés

- `slot_engine.py` — le moteur (config + logique de jeu). **C'est ici qu'on règle tout.**
- `simulate.py` — simulation rapide avec rapport détaillé (`python simulate.py 200000`).
- `accumulate.py` — accumulation de millions de spins pour un RTP précis (`python accumulate.py 1000000 <seed>`, puis `python accumulate.py report`).
- `tune.py` / `finals.py` / `calibrate.py` — scripts de calibrage utilisés pour trouver les paramètres.

## Prochaines étapes (rappel du plan)

1. ✅ Moteur mathématique + simulateur + calibrage RTP.
2. Client de jeu (front-end) : grille, animations de cascade, orbes, free spins, branché sur ce moteur.
3. Couche d'intégration server-authoritative (API de spin standardisée) pour brancher chez un opérateur / agrégateur.
4. Documentation math complète (PAR sheet) + soumission à un labo agréé (GLI/eCOGRA) pour certification.
5. Licence fournisseur B2B selon les juridictions visées.

> ⚠️ Rappel : reproduire les **mécaniques** est OK, mais le nom « Gates of Olympus », les visuels et les sons sont la propriété de Pragmatic Play. Le jeu final doit avoir un thème, des symboles et une identité **originaux**.
