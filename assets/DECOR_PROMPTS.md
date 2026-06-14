# Décor « Mad Olympvs » — prompts IA pour key-art pro

But : générer le **fond** (et éléments de décor) dans un générateur d'images IA
(Midjourney, DALL·E 3, Stable Diffusion / Flux…), puis me les donner — je les
intègre à la place du décor CSS actuel (la grille et le HUD viennent par-dessus).

Direction artistique (rappel) : *« opulence en décomposition »* — Olympe doré
corrompu, obsidienne, **or martelé**, marbre rongé, accents **oxblood** (#6B1F2E),
fuite de lumière **ichor** turquoise (#7FE3D2) ultra-dosée. Sombre, l'or = la lumière.
Identité 100 % originale (ne pas copier Gates of Olympus / Pragmatic).

Palette à mentionner : noir chaud #0A0807, or #C9A227 / #F9EDB4, oxblood #6B1F2E,
ichor #7FE3D2, marbre os #E8DEC6.

---

## 1) Fond principal — jeu de base (paysage 16:9)

> Dark fantasy slot game background, corrupted Mount Olympus throne hall in decay,
> black volcanic obsidian and cracked veined marble, hammered tarnished gold
> ornaments and broken columns, oxblood-red marble veins, faint turquoise spectral
> light (ichor) leaking from cracks, god-rays from above, heavy atmosphere, embers
> floating, baroque divine ruin, cinematic volumetric lighting, ultra-detailed,
> painterly concept art, **dark center kept empty and uncluttered for a game grid**,
> symmetrical composition, no characters, no text, no logo —
> color palette: warm black #0A0807, gold #C9A227 #F9EDB4, oxblood #6B1F2E, ichor teal #7FE3D2
> --ar 16:9 --style raw  (Midjourney)  |  for SD/Flux add: highly detailed, 8k, artstation

Négatif (SD/Flux) : `text, watermark, logo, ui, buttons, characters, people, bright cartoon colors, neon casino, rainbow, flat lighting, low detail`

Important : **laisser le centre plus sombre et vide** (la grille 6×5 s'y pose).

## 2) Fond — free spins (variante plus intense, 16:9)

> Same corrupted Olympus hall but **night / feature mode**: stronger turquoise ichor
> glow, storm clouds, gold lightning, more embers, oxblood haze rising, ominous and
> epic, the ruin awakened — empty dark center for the grid, no text, no characters
> --ar 16:9 --style raw

## 3) Version portrait mobile (9:16)

Reprendre le prompt 1 en `--ar 9:16`, en précisant :
> vertical composition, columns framing left and right edges, empty central vertical
> band for a 6x5 grid, more sky at top for the logo.

## 4) Piliers / cadre (optionnel, PNG détourés transparents)

> A single ornate broken Greek marble column, hammered gold capital, oxblood marble
> veins, cracked, weathered, dark fantasy, isolated on transparent background,
> game asset, front view, no shadow on ground --ar 1:2

(Génère-en 1, je le miroir pour l'autre côté.)

---

## Réglages conseillés

- **Résolution** : viser ≥ 2560×1440 (16:9) et 1440×2560 (9:16). Upscale si besoin.
- **Format de livraison** : `.webp` ou `.jpg` (fond), `.png` transparent (piliers/objets).
- **Cohérence** : générer base + free spins avec la **même seed / mêmes réfs** pour
  garder le même lieu.
- Outils : Midjourney v6/v6.1 (`--style raw --ar 16:9`), Flux.1, ou SDXL.

## Intégration (ce que je ferai)

1. Tu déposes les images dans `assets/decor/` (ex. `bg_base.webp`, `bg_fs.webp`,
   `bg_base_portrait.webp`, `pillar.png`).
2. Je remplace le décor CSS par ces fonds (avec parallaxe légère + mes braises par-dessus),
   je bascule sur le fond « free spins » pendant la feature, et je gère le responsive
   (paysage desktop / portrait mobile).
3. Le grain, la vignette et la grille restent par-dessus — rendu cohérent.

> Astuce : commence par le **fond de base 16:9**. Dès que tu l'as, envoie-le, je le
> branche et on juge sur pièce avant de générer les variantes.
