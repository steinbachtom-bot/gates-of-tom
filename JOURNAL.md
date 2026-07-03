# CURSE OF HADES — Journal de développement

> Récapitulatif de tout ce qui a été fait, et des décisions prises.
> Projet : slot machine « pay-anywhere » type Gates of Olympus — **jetons virtuels uniquement**.
> Dernière mise à jour : 2026-07-03.

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
| Hébergement | GitHub Pages — repo **`steinbachtom-bot/gates-of-tom`** (branche `main`) ; l'utilisateur teste sur portable |

---

## 2. Architecture technique

```
Gates of Tom/
├── index.html        markup + TOUT le CSS (thème Mad Olympvs)
├── engine.js         MOTEUR MATH — source unique de vérité (port de slot_engine.py)
├── game.js           rendu, audio, animations cascade, multiplicateurs, flux free spins (~1500 lignes)
├── build.py          build → GATES_OF_TOM.html autonome (assets base64 embarqués)
├── slot_engine.py    moteur Python d'origine + outils de calibrage
├── node_test.js      test RTP du moteur JS
├── MATH_SPEC.md      fiche math (PAR sheet simplifiée)
├── ROADMAP.md        feuille de route Phases 1→5
└── assets/
    ├── symbols/   premium_lion/demon/zeus/mask.png, gem_red/purple/yellow/green/blue.png,
    │              scatter_hades.png, orb_mult.png
    ├── decor/     bg_portrait.(png|jpg), bg_portrait_fg.png (avant-plan), bg_hades_web.jpg,
    │              bigwin.mp4 / bigwin_portrait.mp4 (≈15 s), hud_frame.png (cadre Solde/Gain),
    │              og-image.jpg (1200×630), win_plaque.png
    ├── icons/     icon-32.png, icon-180.png, icon-512.png
    └── audio/     click, whoosh_spin, hit, land, scatter, fs_trigger, orbzap,
                   bigwin, music, music_fs, bigwin_music
```

**Principe clé** : `engine.js` décide TOUT (résultat math). `game.js` ne fait qu'afficher.
C'est volontaire pour préparer la Phase 2 (RNG côté serveur).

**Build** : `python build.py` produit `GATES_OF_TOM.html` (~31 Mo, un seul fichier autonome,
tous les assets en base64 — images, vidéos, sons, favicons). Note : `hud_frame.png` est référencé
en CSS `url(...)` (pas un `src=`) → embarqué à part dans `build.py`.

---

## 3. Moteur math (engine.js)

- Grille **6×5**, *pay-anywhere* (8+ symboles identiques n'importe où)
- **Tumbles** : les symboles gagnants disparaissent, le reste tombe, nouveaux symboles (FLIP animation)
- **Orbes multiplicateurs x2–x500** (orbe violette `orb_mult.png`)
- Multiplicateur **persistant** pendant les free spins
- **Free spins** : 15 tours (4+ scatters), retrigger possible
- **Max win 5000×** (plafond **combiné** base + FS, cf. §10)
- **1 scatter maximum par colonne** (≤ 6 scatters/grille) *(maj 2026-06-22)*
- **RTP ≈ 96 %** sur les **3 modes** (normal / ante / achat), volatilité élevée — voir le **calibrage détaillé au §10**
  (`SCATTER_W` 9, `PAY_SCALE` 0,890 ; ante ×1,14 ; achat 88×).
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
- **Grille légèrement agrandie** *(maj 2026-06-24)* : les symboles premium (125 %) d'extrémité étaient rognés
  par `overflow:hidden`. Portail portrait agrandi d'un cheveu (`--fl/--ft/--fw/--fh`) → la coupe passe
  **derrière le cadre** de l'avant-plan, symboles d'extrémité entiers.

### Cadre HUD « Solde » / « Gain » — `hud_frame.png` *(maj 2026-06-23)*
- L'utilisateur a généré un **cadre ornementé** (or martelé / oxblood / fissures ichor) via ChatGPT.
- Deux corrections à l'intégration : (1) le PNG n'était **pas transparent** (ChatGPT peint un **faux damier** en dur) →
  **détourage par flood-fill depuis les bords** (le cadre doré fait barrière, le panneau central sombre est conservé) ;
  (2) le cadre était **vertical** alors que le HUD Solde/Gain est **horizontal** → **rotation 90°** (au lieu de régénérer).
- Intégration : fond des pastilles `.stat` (ratio verrouillé pour éviter la déformation, texte centré dans le panneau).
- Prompt du cadre archivé dans `assets/DECOR_PROMPTS.md`.

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
- **Révélation des orbes** : chaque orbe « zappe » (éclair + `sparkBurst`) sur la grille. Le **total ×N**
  ne s'affiche **plus** dans un badge central (`flashMultTotal` retiré) → il apparaît dans la **volute de fumée**
  de la nouvelle présentation du gain (ci-dessous).

### Présentation du gain — accumulation → ×mult en fumée → multiplication → envol *(maj 2026-06-23)*

Nouveau déroulé (jeu de base **ET** free spins), décidé avec l'utilisateur. Le cadre « Gain » ne bouge
plus pendant le spin — il ne se met à jour qu'à l'**arrivée du vol** :

1. **Accumulation** : à chaque gain, un petit montant s'affiche **au-dessus de la grille** ; en cascade,
   il s'**additionne** (défilement) au fil des tumbles.
2. **×Multiplicateur** (s'il y en a un) : à côté du montant, le multiplicateur apparaît dans une **volute de
   fumée CSS** (petite zone, bien visible). Base = somme des orbes du spin ; **free spins = multiplicateur persistant**.
3. **Multiplication** : le montant est multiplié avec **défilement de chiffres** (ex. `10 → 500`).
4. **Envol** : le gain multiplié **s'envole** vers le cadre « Gain » et s'y additionne. Sans multiplicateur → envol direct.

Implémenté via `winStackShow/Pos/RevealMult/FlyToGain` + `presentSpinWin()` (game.js), branché dans
`animateRound` (accumulation), `spin()` et `runFreeSpins()`. **Position** du bandeau : `winStackPos()` le place
**entièrement au-dessus du bord haut de la grille** (mesuré en px, pas de repère DOM pour la barre dorée du fond).

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
- **Fin de l'animation mega** *(maj 2026-06-23)* : la vidéo joue **en ENTIER** (≈15 s, `loop:false`),
  le montant défile par-dessus (durée du palier), puis à la **fin de la vidéo** on révèle le **décor SANS la
  grille** (portail vide) via `body.bigwin-reveal`. **Tap = passer** à tout moment après le décompte. En autoplay,
  on avance ~1,4 s après le reveau (filet à 17 s). ⚠️ Avant (jusqu'au 2026-06-22) le reveal se déclenchait dès la
  fin du **décompte** (~2,8 s) → la vidéo de 15 s était coupée à ~3 s ; corrigé en calant le reveal sur la fin réelle de la vidéo.
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
- **Barre minimaliste empilée + menu central (☰)** *(maj 2026-06-24)* : objectif utilisateur =
  garder le moins de boutons possible à l'écran. Barre verticale :
  - **Buy Bonus** en haut · **SPIN** (agrandi : 168×92 desktop / 152×84 portrait) juste en dessous · **menu ☰** en bas.
  - **Position portrait fiable** : le `top:Xdvh` était piégeux (les barres de Safari faussent `dvh` → Buy chevauchait
    la grille). Remplacé par **`positionControls()` en JS** = placé sous le **bas RÉEL mesuré de la grille**
    (`gridEl.bottom + ~22 % de la bande en dessous`), recalculé au load / resize / orientationchange. Fiable sur tout appareil.
  Tout le reste est dans le menu ☰ : **Mise** (− valeur +), **Ante** (ligne rouge, garde `.ante`),
  **Vitesse** (3 éclairs), **Tours automatiques** (10/25/50/100/∞ + stops, déroulant), **Sons** (déroulant),
  **Gains**, **Plein écran** (PC uniquement — masqué sur tactile). Menu aligné à droite ; clics internes ne ferment
  pas le menu (un handler `stopPropagation` sur le conteneur `#mainMenu`).
  - **Mise aussi modifiable depuis le panneau d'achat** (sélecteur − valeur + ; change la mise globale).
  - **Autoplay** : plus de bouton AUTO dédié → lancé depuis le menu ; pour **arrêter**, le bouton **SPIN
    devient STOP** pendant l'autoplay (reste actif, oxblood ; `setBusy` adapté). IDs préservés (handlers intacts).
- **HUD Solde / Gain** *(maj 2026-06-23)* : label « Jetons » → **« Solde »** (les mentions « jetons virtuels »
  des meta/disclaimer sont conservées : nature légale). Les pastilles utilisent le **cadre `hud_frame.png`** (§4).
- **HUD free spins** *(maj 2026-06-23)* : le 3ᵉ panneau **« GAIN »** (visible seulement en FS) a été **supprimé**
  (redondant avec le cadre Gain principal). Les 2 pills restants (**FREE SPINS**, **MVLTI TOTAL**) sont placés
  **sous les cadres** Solde/Gain — un à gauche, un à droite.
- **Fix bug d'affichage du bouton SPIN** *(maj 2026-06-23)* : `button:hover` (couleur or) repassait le vrai texte
  « SPIN » du bouton (normalement transparent) → « SPIN » **en double** + état doré **collé** sur tactile.
  Corrigé : `.spin:hover/:focus/:active` forcent `color`/`-webkit-text-fill-color` à transparent (seul le `::after`
  en or martelé s'affiche).

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
- ✅ ~~Bug leak ante → free spins~~ *(maj 2026-06-22)* : le boost de scatter de l'**ante** continuait de
  s'appliquer **pendant les free spins** → retriggers en boucle, RTP ante mesuré à **2789 %**. Corrigé :
  `resolveFreeSpins()` (engine.js) et `runFreeSpins()` (game.js) **forcent l'ante à OFF** pendant la feature
  (save/restore). L'ante ne booste plus que le jeu de base.
- ✅ ~~Limiter les scatters à **1 par colonne**~~ *(maj 2026-06-22)* : mécanique standard/légale. Implémentée
  dans les deux moteurs (`fillColumn()` JS, `_fill_column()` Python ; remplissage + tumbles colonne par colonne).
  Vérifié : 0 violation, max 6 scatters/round.
- ✅ ~~Recalibrer le RTP du jeu NORMAL~~ *(maj 2026-06-22)* : la contrainte 1 scatter/col avait fait
  tomber le normal à 65 %. Choix utilisateur = **« Hybride A, moins sec »** (RTP surtout via la feature,
  mais base plus consistante pour avoir un peu de gain entre deux features). Calibré par Monte-Carlo :
  **`SCATTER_W` 7→9** et **`PAY_SCALE` 0,851→0,890**. Profil mesuré (48 M spins) : **RTP ~96 %**
  (centre, bruit inhérent ±0,7 %), hit 15,1 %, free spins **1/194**, répartition ~52 base / ~42 feature,
  max win ~1/1,3 M. ⚠️ Le RTP exact reste flou en JS (slot très volatil) → précision certif = sim compilée
  (cf. MATH_SPEC). Note : le hit rate (~15 %) ne bouge pas avec ces leviers — pour des gains de base **plus
  fréquents** (pas seulement plus gros), il faudrait toucher aux **poids des symboles** (réglage séparé).
- ✅ ~~Calibrer l'ANTE~~ *(maj 2026-06-22)* : choix utilisateur = **Option A** (RTP-neutre, coût inchangé
  ×1,25). La tension « doubler les FS à +25 % » étant impossible à RTP constant, on garde le coût ×1,25 et un
  boost modéré : **`ANTE_SCATTER_MULT` 1,9→1,14** → free spins **~1,55× plus fréquents** (1/194→1/125),
  **ante RTP ~95,7 %** (≤ base, certification-safe). Textes UI « double » → « free spins plus fréquents »
  (titre bouton, aide in-game, game sheet B2B).
- ✅ ~~Calibrer l'ACHAT des free spins~~ *(maj 2026-06-22)* : E[FS] re-mesuré à **83,8×** (avec les params
  recalibrés). Coût d'achat **100× → 88×** (`BUY_COST_MULT`, game.js) → **buy RTP ~95,2 %** (≤ base,
  certification-safe). Textes « 100× » → « 88× » (aide in-game, game sheet B2B). **Les 3 modes sont calibrés.**
- 🌐 Bloquants mise en ligne **côté business** (pas l'app) : domaine + AdSense (voir mémoire WZ Guide — projet voisin).

---

## 11. Conventions de travail

- **Commit + push automatiques après CHAQUE modification** *(maj 2026-06-22)* : l'utilisateur teste
  sur son portable via GitHub Pages, donc chaque changement terminé est commité **et** poussé sur `main`
  sans attendre — standalone reconstruit si `engine.js`/`game.js`/`index.html` ont changé.
- Les visuels/vidéos/sons sont produits en externe par l'utilisateur ; j'écris les **prompts**
  (ChatGPT / Suno / PixVerse) puis j'**intègre** les livrables.
- Scripts helper dans `/tmp` (slice_symbols.py, measure.py, transp.py) — modifiés par l'utilisateur, **ne pas écraser**.
- **Coéquipier, pas exécutant** : si une demande me semble une mauvaise idée, je le **dis** et j'explique pourquoi avant d'agir.
- **Tout le travail math est reporté en FIN de projet** (calibrage de précision, PAR sheet) — sauf bugs math évidents.
- **Vérification** : chaque changement visuel est prévisualisé en **Chrome headless** (captures) avant commit.
  ⚠️ Piège connu : Chrome headless impose une largeur mini (~500 px) → screenshoter les portraits à **≥ 500 px** ;
  et pour les positions liées aux barres du navigateur mobile (`dvh`), préférer la **mesure JS** (le headless n'a pas les barres Safari).

---

## 12. Derniers commits notables

Du plus récent au plus ancien :

- `b0d7e85` — Big Win mega : la vidéo joue **en entier** (reveal à la fin réelle, tap pour passer).
- `798eb07` / `5c9701a` / `fbae0d7` — Contrôles positionnés sous le bas RÉEL de la grille (`positionControls` JS) + grille agrandie (symboles non rognés).
- `3cc19f6` — Ante dans le menu (rouge) · Buy+SPIN remontés · SPIN agrandi.
- `c934b9a` — Barre minimaliste : Mise/Vitesse/Autospin dans le menu · mise dans le panneau d'achat.
- `e43b677` / `213292b` — Présentation du gain : accumulation → ×mult en fumée → multiplication → envol.
- `0f70f47` / `7db145c` / `6ed2c65` — HUD : cadres Solde/Gain (`hud_frame.png` détouré+tourné) · pills FS sous les cadres · label « Solde ».
- `c43dcc4` — Fix bouton SPIN (texte dédoublé + doré collé sur tactile).
- `380ab32` / `081b6d8` — Bouton « Plein écran » dans le menu (réservé PC).
- `8e74360` / `e2ae90b` — Barre à deux niveaux → SPIN agrandi/centré (étape intermédiaire, remplacée depuis).
- `a9cfe3f` / `6533647` / `cd96347` / `d38b04f` — Calibrage math (achat/ante/normal) + fix leak ante→FS + 1 scatter/colonne.
- `240a37d` / `44c8f79` — Bouton vitesse compact (3 éclairs).
- `088eae8` — Plafond max win combiné base+FS (5000×).
- (avant : rebrand Curse of Hades, favicon/OG, écran tap-to-start, paliers Big Win, panneau de gain, etc.)

> Convention : quand l'utilisateur dit « commit/push », je commit ET pousse sur GitHub. Chaque changement de
> code observable est vérifié en **preview navigateur** (captures) avant commit, et le standalone est reconstruit.
