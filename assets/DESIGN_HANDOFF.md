# Handoff — « Mad Gods » · Slot « pay‑anywhere »

## Overview
**Mad Gods** est une machine à sous (slot) au thème *Olympe corrompu* — « opulence en décomposition » : panthéon doré, marbre, gemmes, mais fissuré, oxydé, dérangé (registre à la Nolimit). Mécanique **pay‑anywhere** : 8+ symboles identiques paient n'importe où sur une grille **6×5**, avec **tumble** (cascade) et **orbes de multiplicateur** qui s'additionnent (registre *Gates of Olympus*‑like, mais identité visuelle 100 % originale).

Ce bundle est une **planche de direction artistique (DA)** + des **assets de symboles détourés**. Il fixe la langue visuelle (couleurs, typo, matières, composants d'UI, cadrage) à appliquer ensuite au vrai jeu.

## About the Design Files
Les fichiers HTML/CSS de ce bundle sont des **références de design créées en HTML** — un prototype montrant l'intention visuelle et quelques comportements, **pas du code de production à copier tel quel**.

La tâche est de **recréer cette direction artistique dans l'environnement cible** :
- Pour le **moteur de jeu** (reels, animations, tumble, orbes), un moteur canvas/WebGL est attendu — **PixiJS** ou **Phaser** sont les choix naturels pour un slot. Les symboles fournis (PNG transparents) y sont directement utilisables comme sprites.
- Pour l'**UI périphérique** (menus, achat de bonus, écrans), utiliser le framework déjà en place dans le codebase (React/Vue/…) ; sinon, React + TypeScript est un défaut raisonnable.
- Si aucun environnement n'existe encore, choisir le framework le plus adapté et y implémenter la DA.

Les **tokens, mesures et composants** ci‑dessous sont la source de vérité. Le HTML n'est qu'une illustration de ces tokens.

## Fidelity
**Hi‑fi pour le langage visuel** (couleurs, typographie, matières, composants d'UI = valeurs finales, à reproduire fidèlement) **et assets de symboles prêts production** (PNG détourés).
**Le *layout de jeu* (section « Cadrage ») est indicatif** : ce sont des zones de principe (où vont logo / grille / HUD en portrait et paysage), pas un pixel‑perfect — la composition fine se fera dans le moteur.

---

## Design Tokens

### Couleurs (hex exacts — `:root` de `da-styles.css`)
| Token | Hex | Usage |
|---|---|---|
| `--obsidian` | `#0A0807` | Fond dominant (noir chaud, jamais pur) |
| `--obsidian-2` | `#13100C` | Fond de cartes/dégradés |
| `--ash` | `#1C1813` | Surface intermédiaire |
| `--ash-2` | `#272018` | Surface / profondeur |
| `--bone` | `#E8DEC6` | Texte principal, marbre |
| `--bone-dim` | `#A99F86` | Texte secondaire |
| `--bone-faint` | `#6F685A` | Texte tertiaire / légendes |
| `--gold-1` | `#5A4416` | Or — ombre |
| `--gold-2` | `#9A7B22` | Or — médium foncé (bordures) |
| `--gold` | `#C9A227` | **Or principal** |
| `--gold-3` | `#E8C64A` | Or — clair (accents, libellés) |
| `--gold-hi` | `#F9EDB4` | Or — haute lumière |
| `--oxblood` | `#6B1F2E` | Corruption / danger / achat |
| `--oxblood-hi` | `#9C2F3F` | Oxblood clair (hover danger) |
| `--oxblood-deep` | `#2E0C12` | Oxblood profond (ombres) |
| `--ichor` | `#7FE3D2` | Lueur spectrale surnaturelle (ultra‑rare) |
| `--ichor-deep` | `#1F4F49` | Ichor profond |

**Dégradé « or martelé » (signature)** — à utiliser pour texte/bords métalliques :
```css
--gold-foil: linear-gradient(135deg,#3a2c0e 0%, #8a6d1f 24%, #f2e2a8 47%, #b88e22 58%, #6e561a 78%, #cdaa34 100%);
```
Appliqué en texte via `background:var(--gold-foil); -webkit-background-clip:text; color:transparent;`.

### Matières (rendues en CSS dans la planche, à pousser en illustration/3D)
- **Or martelé** — reliefs/éclats, jamais lisse.
- **Émail fissuré** — doré laqué + craquelures noires.
- **Obsidienne** — noir vitreux, un seul reflet froid.
- **Marbre rongé** — pierre veinée d'oxblood.
- **Ichor** — sang divin luminescent (#7FE3D2), seule vraie source de lumière, dosé à l'extrême.

### Typographie
| Rôle | Police | Notes |
|---|---|---|
| Display « folie » | **Pirata One** | Réservé au mot « MAD » et titres de feature. Toujours en or martelé, ombré d'oxblood. |
| Titre / autorité | **Cinzel Decorative** (700) | Logo « GODS », gros titres. Lapidaire romain, `V` pour `U`. |
| Sections | **Cinzel** (500/600/700) | Titres de section, noms de symboles. |
| Interface | **Barlow** (300–700) + **Barlow Semi Condensed** (500/600) | Compteurs (chiffres tabulaires), libellés HUD en capitales espacées (`letter-spacing:.18–.46em`, `text-transform:uppercase`). |

Import Google Fonts (déjà dans le HTML) :
```
Cinzel:500,600,700 · Cinzel+Decorative:700 · Pirata+One · Barlow:300..700 · Barlow+Semi+Condensed:500,600
```

### Effets globaux
- **Grain** : SVG `feTurbulence` (baseFrequency 0.9) en overlay `opacity:.05; mix-blend-mode:overlay`.
- **Vignette** : `box-shadow:inset 0 0 240px 40px rgba(0,0,0,.7)`.
- Rayons d'angle cartes : 10–14px. Médaillons symboles : 16px.

---

## Symboles (assets fournis — `symbols/*.png`, PNG transparents détourés)

Hiérarchie de valeur (haut → bas) :

| Tier | Nom | Fichier | Notes |
|---|---|---|---|
| **Scatter** | Orbe d'Olympe | `orb.png` | Déclencheur : 4+ déclenche la feature. Halo doré ajouté en CSS (`drop-shadow` ichor/or). |
| Premium I | Roi‑lion | `lionking.png` | Lion couronné doré — symbole le plus fort. |
| Premium II | Seigneur démon | `demon.png` | Tête de démon rouge/noir cornue. |
| Premium III | Zeus cornu | `zeus.png` | Visage barbu cornu. |
| Premium IV | Masque démon | `redmask.png` | Masque rouge cornu, yeux jaunes. |
| Premium V | Diablotin | `imp.png` | ⚠️ **Non retenu** dans le jeu final (4 premiums : lion/démon/zeus/masque) — asset abandonné, aucun `imp.png` n'est embarqué. |
| Royale | Laurier d'or | `laurel.png` | Couronne de laurier (victoire). |
| Royale | Couronne | `crown2.png` | Couronne dorée à gemme. |
| Gemme | Rubis | `ruby.png` | |
| Gemme | Saphir | `sapphire.png` | |
| Gemme | Émeraude | `emerald.png` | |

Tous les PNG sont détourés (fond transparent), cadrés serrés (~210–620 px). Dans la planche, ils sont posés dans des **médaillons obsidienne à liseré or** ; dans le jeu, à utiliser comme sprites sur les cellules de la grille.

---

## Composants d'UI (hi‑fi — voir section « Interface » de la planche)

### Bouton Spin
- Cercle Ø ~128px. Cœur : `radial-gradient` obsidienne.
- Anneau : `conic-gradient` or (1→hi→1) + halos : `box-shadow` triple (cerne noir, cerne `--gold-2`, halo doré `rgba(201,162,39,.34)`).
- Label « SPIN » en Cinzel Decorative, or martelé, `letter-spacing:.18em`.

### Orbe de multiplicateur « démoniaque » (élément signature)
- Sphère : `radial-gradient` `#fff6e0 → gold-3 → gold → oxblood → #1a0a0e`, highlight spéculaire en `::after`.
- **Ailes de diable** symétriques (membrane oxblood + nervures or), via `clip-path` (forme de chauve‑souris) ; aile droite = `scaleX(-1)`.
- Valeur centrale en Cinzel Decorative (`#2a0d12`).
- **Comportement clé — la taille croît avec la valeur** :
  - Paliers : `[2, 3, 5, 10, 25, 50, 100, 250, 500]`.
  - Échelle : `scale = 0.62 + (index / 8) * 0.92` → de **×2 (≈0.62)** à **×500 (≈1.54)**.
  - Transition : `transform .2s cubic-bezier(.34,1.56,.64,1)` (léger overshoot).
  - Dans la planche, un slider pilote `--ms` et le texte `×N`. En jeu : l'orbe apparaît à l'échelle correspondant à sa valeur.

### Cellule de grille
- Carré ~120px, `radius:12px`, fond creusé (`inset` shadow), liseré or `--edge`.
- **Coins** : 4 équerres or (2px) en absolu.
- Symbole : sprite centré ~74 % de la cellule, `drop-shadow(0 4px 8px rgba(0,0,0,.6))`.
- État gagnant : intensifier le liseré or + lueur interne (à animer en jeu).

### Bannière de gain
- Fond `radial-gradient` oxblood→obsidienne, liseré or.
- Libellé en Barlow Semi Condensed (`letter-spacing:.34em`), montant en Cinzel Decorative or martelé.
- **Paliers de gain** : `Grand · Énorme · Olympien · Démentiel`.

### Boutons
- **Primaire** (Acheter) : fond or martelé, texte `#180a0d`, `box-shadow` doré.
- **Danger** (Ante Bet) : dégradé `#7d2330→#4a141d`, bord `--oxblood-hi`, texte os.
- **Fantôme** (Auto) : transparent, bord or `--edge`, texte `--gold-3`.
- Tous : Barlow Semi Condensed, uppercase, `letter-spacing:.18em`, `radius:6px`.

---

## Cadrage / Layout (indicatif — section « Cadrage » de la planche)

Règle d'or : **la grille reste le héros**. Logo réduit en jeu, jamais central.

### Mobile · Portrait 9:16
Empilement vertical :
1. Logo « MAD GODS » (bandeau haut).
2. Grille 6×5 (occupe **≥ 60 %** de la hauteur utile).
3. HUD : Solde · Spin · Mise.
4. Barre : Menu · Auto · Turbo.

### Desktop / Tablette · Paysage 16:9
- Logo « MAD GODS » réduit en **haut‑gauche**.
- Grille 6×5 **centrée**, occupant **≥ 70 %** de la largeur, encadrée par deux **piliers/décor** (gauche/droite). *(La grille démarre sous le logo — ne pas la faire chevaucher le logo.)*
- HUD en bandeau bas : Solde · Mise · Spin · Auto · Menu.

Le HUD ne mange jamais la zone de jeu : il l'encadre.

---

## Interactions & comportement (à implémenter dans le moteur)
- **Spin** → tirage de la grille (6×5).
- **Pay‑anywhere** : un symbole paie si **≥ 8** occurrences, n'importe où.
- **Tumble** : les symboles gagnants disparaissent, les autres tombent, de nouveaux arrivent ; on répète tant qu'il y a gain. Compteur de tumbles.
- **Orbes de multiplicateur** : tombent pendant les tumbles, valeur `[2..500]`, **s'additionnent** ; appliqués au gain de la séquence. Taille de l'orbe indexée sur la valeur (cf. composant).
- **Tours gratuits** : multiplicateur global persistant qui s'accumule sur tous les tours.
- **Scatter** : 4+ orbes d'Olympe déclenchent les tours gratuits.
- **Buy bonus / Ante** : achat d'accès direct à la feature ; ante = chance de déclenchement accrue (prévoir le cas « buy interdit » selon marché).
- **Big Win** : montée chiffrée + paliers (Grand → Démentiel).
- Animations : transitions courtes, easing avec léger overshoot pour les orbes ; pas de boucle décorative infinie.

## State (indicatif)
`balance`, `bet`, `grid[6×5]`, `tumbleCount`, `currentWin`, `multiplierOrbs[]`, `globalMultiplier`, `freeSpinsRemaining`, `gameMode (base | freeSpins | buyFeature)`.

## Garde‑fous (do / don't)
**À faire** : fond très sombre, l'or = la lumière ; fissurer/oxyder/faire suinter la matière ; doser l'ichor comme assaisonnement ; garder la posture sacrée mais dérégler le détail.
**À éviter** : dégradés arc‑en‑ciel / néon « casino » générique ; or plat et propre ; gore explicite (on suggère la démence) ; HUD surchargé.

## Assets & dépendances
- `symbols/` — 11 PNG transparents (symboles), prêts production.
- `image-slot.js` — composant d'emplacement d'image utilisé **uniquement** pour la key‑art du hero de la planche (drag‑and‑drop). Non nécessaire au jeu.
- Polices : Google Fonts (liste ci‑dessus). Vérifier les licences pour usage production (Cinzel, Cinzel Decorative, Pirata One, Barlow = SIL OFL, OK).
- La key‑art du hero et les illustrations « finales » des matières restent à produire.

## Files
- `Mad Gods Direction Artistique.html` — la planche DA (référence visuelle).
- `da-styles.css` — **tous les tokens et styles de composants** (source de vérité CSS).
- `symbols/*.png` — assets de symboles.
- `image-slot.js` — composant d'emplacement (planche uniquement).
