# CURSE OF HADES — Journal de développement

> Récapitulatif de tout ce qui a été fait, et des décisions prises.
> Projet : slot machine « pay-anywhere » type Gates of Olympus — **jetons virtuels uniquement**.
> Dernière mise à jour : 2026-06-22.

---

## 1. Identité du projet

| Élément | Valeur |
|---|---|
| Nom de code initial | Gates of Tom |
| **Nom définitif** | **Curse of Hades** |
| Sous-titre / thème | **Mad Olympvs** (Olympe doré et corrompu, ambiance « dérangée » à la Nolimit) |
| Type de jeu | Slot 6×5 *pay-anywhere* (gains 8+ symboles), cascades (tumbles) |
| Argent | **Jetons virtuels uniquement**, aucun argent réel |
| Solde de départ | **10 000** |
| Hébergement | GitHub Pages — repo `steinbachtom-bot/WZ-Guide`… (voir mémoire) |

---

## 2. Architecture technique

```
Gates of Tom/
├── index.html        markup + TOUT le CSS (thème Mad Olympvs)
├── engine.js         MOTEUR MATH — source unique de vérité (port de slot_engine.py)
├── game.js           rendu, audio, animations cascade, multiplicateurs, flux free spins (~1270 lignes)
├── build.py          build → GATES_OF_TOM.html autonome (assets base64 embarqués)
├── slot_engine.py    moteur Python d'origine + outils de calibrage
├── node_test.js      test RTP du moteur JS
├── MATH_SPEC.md      fiche math (PAR sheet simplifiée)
├── ROADMAP.md        feuille de route Phases 1→5
└── assets/
    ├── symbols/   premium_lion/demon/zeus/mask.png, gem_red/purple/yellow/green/blue.png,
    │              scatter_hades.png, orb_mult.png
    ├── decor/     bg_portrait.(png|jpg), bg_portrait_fg.png (avant-plan), bg_hades_web.jpg,
    │              bigwin.mp4 (16:9, 3.3 Mo), bigwin_portrait.mp4 (4.2 Mo),
    │              og-image.jpg (1200×630), win_plaque.png
    ├── icons/     icon-32.png, icon-180.png, icon-512.png
    └── audio/     click, whoosh_spin, hit, land, scatter, fs_trigger, orbzap,
                   bigwin, music, music_fs, bigwin_music
```

**Principe clé** : `engine.js` décide TOUT (résultat math). `game.js` ne fait qu'afficher.
C'est volontaire pour préparer la Phase 2 (RNG côté serveur).

**Build** : `python build.py` produit `GATES_OF_TOM.html` (~28 Mo, un seul fichier autonome,
tous les assets en base64 — images, vidéos, sons, favicons).

---

## 3. Moteur math (engine.js)

- Grille **6×5**, *pay-anywhere* (8+ symboles identiques n'importe où)
- **Tumbles** : les symboles gagnants disparaissent, le reste tombe, nouveaux symboles (FLIP animation)
- **Orbes multiplicateurs x2–x500** (orbe violette `orb_mult.png`)
- Multiplicateur **persistant** pendant les free spins
- **Free spins** : 15 tours (4+ scatters), retrigger possible
- **Max win 5000×**
- **RTP ≈ 95,5–96 %**, volatilité élevée — vérifié sur des millions de spins
- ⚠️ Correctif appliqué : les scatter pays n'étaient pas scalés par `PAY_SCALE` côté JS (divergeait du Python) → corrigé.

---

## 4. Assets graphiques (workflow & décisions)

Workflow récurrent : **l'utilisateur génère les visuels en externe** (ChatGPT / PixVerse) →
**je les intègre** (détourage, découpe, câblage dans le jeu).

### Symboles
- **Premiums** : `premium_lion`, `premium_demon`, `premium_zeus`, `premium_mask`
- **Gemmes** (basses) : `gem_red`, `gem_purple`, `gem_yellow`, `gem_green`, `gem_blue`
- **Scatter** : `scatter_hades.png` — tête d'Hadès dans une orbe, mot « SCATTER » écrit dessus
- **Orbe multiplicateur** : `orb_mult.png` — orbe **violette** (l'utilisateur n'aimait pas l'ancienne)
- **Décision tailles** : premiums **agrandis à 125 %**, gemmes basses rétrécies.

### Détourage
- Problème récurrent : les PNG exportés par ChatGPT sont **aplatis sur fond blanc** (`hasAlpha: no`)
  même s'ils paraissent transparents → détourage par **flood-fill Pillow depuis les bords**.

### Fond & portail (mobile)
- Fond portrait régénéré plus **lisse** puis avec un **portail plus large** (ratio ~1,02) pour loger la grille 6×5.
- **Technique de l'avant-plan** : `bg_portrait_fg.png` = découpe du portail posée **au-dessus** de la grille
  (z-index 5) → les bras de Méduse / la lance de Zeus passent **devant** les symboles.
- **Zoom du fond** `scale(1.16)` (portrait) pour éviter que les symboles débordent sur personnages/piliers.

---

## 5. Audio (game.js — module `Snd`)

- Web Audio API : sons fichiers (mp3/wav) avec **fallback synthé**.
- **Équilibrage des gains par mesure RMS** :

| Son | Gain | Note |
|---|---|---|
| click | 0,5 | |
| whoosh (spin) | 0,45 | |
| hit | **1,1** | boosté (était noyé sous la musique) |
| land | 0,3 | |
| scatter | 0,4 | coupé du Taiko drum |
| fs_trigger | 0,55 | fanfare (Suno) |
| orbzap | 0,25 | **désactivé** (l'utilisateur ne l'aimait pas) |
| bigwin | 0,72 | |
| MUSIC_VOL | 0,4 | |

**Décisions audio** :
- Pas de `pop.mp3` (le son « hit » suffit).
- Pas de son d'anticipation scatter (remplacé par un effet **visuel** de pulsation).
- Musique : `music.mp3` (ambiance) + `music_fs.mp3` (free spins) + `bigwin_music.mp3` (gros gain).

---

## 6. Animations & game feel

- **Cascade (tumble)** : FLIP animation, chute colonne par colonne.
- **Anticipation scatter** (drapeau `state.inFs`) : pulsation des scatters déjà posés + **pause** des
  colonnes pas encore révélées, **pendant** la cascade. Seuil dépendant du contexte :
  - **Jeu de base** : dès **3 scatters** (il en faut 4 pour les free spins).
  - **Free spins** : dès **2 scatters** (il en faut 3 pour un retrigger). *(maj 2026-06-22)*
- **Révélation des orbes** : zap + `flashMultTotal`, `sparkBurst`, `floatWin`, `countUpEl`, count-up requestAnimationFrame.

### Big Win — présentation à deux niveaux (décision utilisateur)

| Gain | Présentation |
|---|---|
| **20× à 99×** (non-mega) | **Panneau seul** `win_plaque.png` — pas de vidéo, pas de musique big win |
| **100× et plus** (mega) | **Animation seule** : vidéo `bigwin.mp4` + musique big win (**plus de panneau**) |

> ⚠️ Évolution (2026-06-22) : à l'origine le mega affichait panneau **ET** vidéo. Désormais **mega = animation
> seule** (le cadre du panneau est retiré, seuls **libellé + montant** restent par-dessus la vidéo) et
> **non-mega = panneau seul**. Le montant est conservé sur le mega (sinon le joueur ne verrait pas son gain).

### Paliers de gain différenciés *(maj 2026-06-22)*

Chaque palier a sa **propre identité** (couleur du libellé, intensité, durée de décompte croissante) :

| Palier | Plage | Présentation | Identité visuelle | Décompte |
|---|---|---|---|---|
| **GRAND** | 20–49× | panneau | or sobre | 1,3 s |
| **ÉNORME** | 50–99× | panneau | or chaud + halo renforcé | 1,8 s |
| **OLYMPIEN** | 100–499× | animation + musique | aura d'**ichor** (turquoise divin) | 2,8 s |
| **DÉMENTIEL** | 500×+ | animation + musique | **oxblood + or**, pulsation « folie » | 3,8 s |

Implémenté via `bigWinTierInfo(u)` (game.js) + classes `.tier-grand/enorme/olympien/dementiel` (CSS).

### Autres décisions Big Win

- **Fermeture du panneau / écran** : reste affiché **jusqu'au tap du joueur** (indice « Appuyez pour continuer »).
  Exception : en **autoplay**, fermeture auto (mega 6 s / non-mega 3 s) pour ne pas bloquer l'enchaînement.
- **Fin de l'animation mega** *(maj 2026-06-22)* : au lieu de figer la **frame 0** de la vidéo, on révèle le
  **décor du jeu SANS la grille de symboles** (portail vide) + palier/montant. Via `body.bigwin-reveal` :
  masque la vidéo + les symboles (la grille n'a pas de fond propre → le portail noir vient de l'image de fond)
  et allège le voile sombre. Tout est restauré au tap.
- Texte Big Win calé sur le portail (container-query) et **rétréci/resserré** pour ne pas déborder du panneau
  (testé jusqu'à des montants longs type « 250 000,00 »). Clip vidéo choisi : **B (fade)**.

---

## 7. Responsive & ergonomie

- **Portrait / paysage / desktop** entièrement gérés.
- Correctif paysage : `.stage` s'effondrait à 2 px (flex column qui shrink un élément à enfants absolus)
  → ajout de `flex-shrink: 0`.
- **Écran « tap to start »** (`.start-overlay`) : icône 512 + logo + « Appuyez pour commencer »,
  câblé en script inline **indépendant de game.js** (backstop si game.js tarde / cache GitHub Pages).
- **Réglages persistants (localStorage `got_settings`)** : mise, vitesse, sfx, musique, autoStopBig, autoStopFs.
- **Autoplay** avec arrêts conditionnels : `autoStopBig` (stop sur gros gain), `autoStopFs` (stop sur free spins) —
  toggles dans le menu autoplay, persistés et restaurés.
- **Menu unique « hamburger » (☰)** *(maj 2026-06-22)* : pour alléger la barre de contrôles, les boutons
  **Gains** et **Sons** ont été regroupés sous un seul bouton ☰ qui ouvre un menu :
  - **Sons** → se déplie en place (Tous les sons / Effets / Musique) — IDs des toggles préservés.
  - **Gains** → ouvre la liste des gains.
  Le menu est **aligné à gauche** du bouton (pas de débordement en portrait). Barre passée de 8 à 7 éléments.
  *Objectif affiché par l'utilisateur : garder le moins de boutons possible sur l'écran de jeu.*

---

## 8. SEO / partage / branding

- `<title>` : **Curse of Hades — Mad Olympvs**
- **Favicons** : icon-32, apple-touch-180 ; theme-color.
- **OG / Twitter** : meta avec **URLs absolues** vers `og-image.jpg` (1200×630, DA du site).

---

## 9. État d'avancement (vs ROADMAP)

- ✅ **Phase 1 COMPLÈTE** — démo « vitrine » : assets originaux, son, polish animations, autoplay,
  table des gains, réglages, responsive complet, écran de chargement, solde persistant.
- ⏳ **Phase 2** (non commencée) — architecture production : RNG côté serveur (RGS),
  séparation client/serveur stricte, **moteur de rendu WebGL/PixiJS** (hybride : grille+effets en WebGL,
  UI en HTML), tests math industriels (50–100 M spins).
- ⏳ Phases 3→5 — certification, conformité, distribution, juridique (largement externe).

---

## 10. Points ouverts / à décider (mineurs)

- ✅ ~~Nettoyer l'orphelin `imp.png`~~ *(maj 2026-06-22)* : aucun fichier `imp.png` n'existe dans
  le projet (rien à supprimer) ; le Diablotin « Premium V » du handoff n'a pas été retenu (4 premiums
  finaux). Référence stale annotée dans `assets/DESIGN_HANDOFF.md`.
- ✅ ~~Lever l'ambiguïté du **max win base + FS**~~ *(maj 2026-06-22)* : tranché à **5000× sur le TOTAL
  du pari** (base + free spins), standard du marché. Avant, base (≤5000×) et FS (≤5000×) étaient plafonnés
  séparément → cumul possible jusqu'à 10000×. Correctif : plafond **combiné** dans la source de vérité
  (`engine.js` → `resolveBet()`, `slot_engine.py` → `play_bet()`), répercuté dans `game.js`
  (`runFreeSpins(bought, startWin)` : la session FS est bornée par `MAX_WIN − gain de base`) et les
  simulateurs (`node_test.js`, `simulate.py`, `accumulate.py`). Vérifié : JS 4 M spins → RTP 96,0 %,
  gain max = 5000,0× exactement.
- 🌐 Bloquants mise en ligne **côté business** (pas l'app) : domaine + AdSense (voir mémoire WZ Guide — projet voisin).

---

## 11. Conventions de travail

- **Commit + push automatiques après CHAQUE modification** *(maj 2026-06-22)* : l'utilisateur teste
  sur son portable via GitHub Pages, donc chaque changement terminé est commité **et** poussé sur `main`
  sans attendre — standalone reconstruit si `engine.js`/`game.js`/`index.html` ont changé.
- Les visuels/vidéos/sons sont produits en externe par l'utilisateur ; j'écris les **prompts**
  (ChatGPT / Suno / PixVerse) puis j'**intègre** les livrables.
- Scripts helper dans `/tmp` (slice_symbols.py, measure.py, transp.py) — modifiés par l'utilisateur, **ne pas écraser**.

---

## 12. Derniers commits notables

Du plus récent au plus ancien :

- `c496f60` — Big Win (mega) : fin d'animation → décor sans la grille (portail vide) au lieu de la frame figée.
- `c8c8aa3` — Paliers Big Win différenciés (couleur/intensité/durée) + menu unique hamburger (Sons & Gains).
- `8e78aa3` — Big Win : 100×+ animation seule (sans panneau) · panneau 20-99× resserré · anticip dès 2 scatters en FS.
- `a3d533e` — Big Win : le panneau (20-99×) reste affiché jusqu'au tap.
- (avant : rebrand Curse of Hades, favicon/OG, écran tap-to-start, compression vidéos, panneau de gain, etc.)

> Convention : quand l'utilisateur dit « commit/push », je commit ET pousse sur GitHub. Chaque changement de
> code observable est vérifié en **preview navigateur** (captures) avant commit, et le standalone est reconstruit.
