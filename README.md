# GATES OF TOM — Mad Olympus 🏛️⚡

Slot « pay-anywhere » type Gates of Olympus, thème *Mad Olympus* (Olympe doré et corrompu,
ambiance dérangée à la Nolimit). **Jetons virtuels uniquement** — aucun argent réel.

## Jouer

Double-cliquer **`index.html`** (s'ouvre dans le navigateur). Barre Espace ou bouton **SPIN** pour lancer.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Page du jeu (structure + style *Mad Olympus*) |
| `engine.js` | **Moteur math** (source unique : poids, paytable, cascades, orbes, free spins, RTP) |
| `game.js` | Rendu, animations de cascade, multiplicateurs, flux des free spins |
| `slot_engine.py` + scripts | Moteur Python d'origine + outils de calibrage/simulation |
| `MATH_SPEC.md` | Fiche math (PAR sheet simplifiée) |
| `node_test.js` | Test RTP du moteur JS : `node node_test.js 600000` |

## Caractéristiques

- Grille **6×5**, gains pay-anywhere (8+ symboles), **tumbles** en cascade
- Orbes multiplicateurs **x2–x500**, multiplicateur **persistant** en free spins
- **15 free spins** (4+ scatters), retrigger, **max win 5000×**
- **RTP ≈ 96 %**, volatilité élevée — vérifié sur des millions de spins

## Mettre en ligne

Le jeu est 100 % front-end (HTML/CSS/JS), hébergeable gratuitement tel quel
(Netlify, Vercel, GitHub Pages) : déposer le dossier, c'est en ligne.

> ⚠️ Pour une vraie offre B2B : RNG côté serveur (anti-triche), certification labo
> (RTP/PAR sheet), licence fournisseur, et **assets graphiques originaux**
> (le nom et les visuels de Gates of Olympus appartiennent à Pragmatic Play).
