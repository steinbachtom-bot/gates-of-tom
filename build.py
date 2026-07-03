"""
Construit GATES_OF_TOM.html : un fichier unique autonome (artefact LOCAL, non versionné).
- inline engine.js + game.js
- embarque les symboles PNG en base64 (window.SYM_DATA)
Chaque remplacement est VÉRIFIÉ : si une cible n'existe plus dans index.html
(ligne reformatée, attribut changé…), le build échoue au lieu de régresser en silence.
Usage : python3 build.py
"""
import base64, glob, os, json, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))

def read(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()

def b64(path):
    with open(os.path.join(ROOT, path), "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")

def sub(html, old, new, label):
    """replace() vérifié : la cible DOIT exister (sinon le standalone régresserait en silence)."""
    n = html.count(old)
    if n == 0:
        sys.exit(f"build.py: cible introuvable ({label}) : {old[:90]!r}")
    return html.replace(old, new)

html = read("index.html")
engine = read("engine.js")
game = read("game.js")

# Scripts inline
html = sub(html, '<script src="engine.js"></script>', "<script>\n" + engine + "\n</script>", "engine.js")

# Embarquer les PNG des symboles en data-URI.
# Liste ATTENDUE (référencée par game.js via concaténation, donc invisible au contrôle final) :
# si un symbole manque/est renommé, on échoue au lieu de livrer un standalone à images cassées.
EXPECTED_SYMBOLS = {
    "premium_lion.png", "premium_demon.png", "premium_zeus.png", "premium_mask.png",
    "gem_red.png", "gem_purple.png", "gem_yellow.png", "gem_green.png", "gem_blue.png",
    "scatter_hades.png", "orb_mult.png",
}
sym_data = {}
for path in sorted(glob.glob(os.path.join(ROOT, "assets/symbols/*.png"))):
    name = os.path.basename(path)
    sym_data[name] = "data:image/png;base64," + b64(os.path.join("assets/symbols", name))
missing = EXPECTED_SYMBOLS - set(sym_data)
if missing:
    sys.exit("build.py: symboles manquants dans assets/symbols/ : " + ", ".join(sorted(missing)))
assets_script = "<script>window.SYM_DATA=" + json.dumps(sym_data) + ";</script>"
html = sub(html, '<script src="game.js"></script>',
           assets_script + "\n<script>\n" + game + "\n</script>", "game.js")

# Décors (fond large + fond portrait) en data-URI
for decor_rel in ("assets/decor/bg_hades_web.jpg", "assets/decor/bg_portrait_web.jpg"):
    if os.path.exists(os.path.join(ROOT, decor_rel)):
        html = sub(html, 'src="' + decor_rel + '"',
                   'src="data:image/jpeg;base64,' + b64(decor_rel) + '"', decor_rel)

# PNG décor transparents (avant-plan portrait + panneau de gain)
for png_rel in ("assets/decor/bg_portrait_fg.png", "assets/decor/win_plaque.png"):
    if os.path.exists(os.path.join(ROOT, png_rel)):
        html = sub(html, 'src="' + png_rel + '"',
                   'src="data:image/png;base64,' + b64(png_rel) + '"', png_rel)

# Cadre HUD : référencé en CSS url(...) (pas un src=)
hud_rel = "assets/decor/hud_frame.png"
if os.path.exists(os.path.join(ROOT, hud_rel)):
    html = sub(html, "url(" + hud_rel + ")",
               "url(data:image/png;base64," + b64(hud_rel) + ")", hud_rel)

# Favicons (href=) + icône de l'écran « appuyez pour commencer » (src=)
for icon_rel in ("assets/icons/icon-32.png", "assets/icons/icon-180.png"):
    if os.path.exists(os.path.join(ROOT, icon_rel)):
        html = sub(html, 'href="' + icon_rel + '"',
                   'href="data:image/png;base64,' + b64(icon_rel) + '"', icon_rel)
icon512 = "assets/icons/icon-512.png"
if os.path.exists(os.path.join(ROOT, icon512)):
    html = sub(html, 'src="' + icon512 + '"',
               'src="data:image/png;base64,' + b64(icon512) + '"', icon512)

# Vidéos Big Win (littéraux de chaîne choisis par JS, pas un attribut src=)
for vid_rel in ("assets/decor/bigwin.mp4", "assets/decor/bigwin_portrait.mp4"):
    if os.path.exists(os.path.join(ROOT, vid_rel)):
        html = sub(html, '"' + vid_rel + '"',
                   '"data:video/mp4;base64,' + b64(vid_rel) + '"', vid_rel)

# Sons (MIME selon l'extension : mp3 -> mpeg, wav -> wav)
for path in ["assets/audio/click.mp3", "assets/audio/whoosh_spin.mp3",
             "assets/audio/hit.mp3", "assets/audio/land.mp3",
             "assets/audio/scatter.wav", "assets/audio/fs_trigger.wav",
             "assets/audio/orbzap.wav", "assets/audio/bigwin.wav",
             "assets/audio/music.mp3",
             "assets/audio/music_fs.mp3", "assets/audio/bigwin_music.mp3"]:
    if os.path.exists(os.path.join(ROOT, path)):
        mime = "audio/wav" if path.endswith(".wav") else "audio/mpeg"
        html = sub(html, '"' + path + '"',
                   '"data:' + mime + ";base64," + b64(path) + '"', path)

# Polices auto-hébergées : CSS inliné + woff2 en data-URI.
# NB : dans fonts.css les url() sont relatives AU CSS (ex. url(barlow-300.woff2)) —
# c'est requis pour la version multi-fichiers (une feuille externe résout par rapport à elle-même).
fonts_css_rel = "assets/fonts/fonts.css"
if os.path.exists(os.path.join(ROOT, fonts_css_rel)):
    fcss = read(fonts_css_rel)
    for woff in sorted(set(re.findall(r'url\(([a-z0-9-]+\.woff2)\)', fcss))):
        fcss = fcss.replace("url(" + woff + ")",
                            "url(data:font/woff2;base64," + b64("assets/fonts/" + woff) + ")")
    if re.search(r'url\((?!data:)', fcss):
        sys.exit("build.py: fonts.css contient encore une url() non embarquée")
    html = sub(html, '<link rel="stylesheet" href="assets/fonts/fonts.css">',
               "<style>\n" + fcss + "</style>", "fonts.css")

# --- Contrôle final : aucune référence relative assets/ ne doit rester (hors liste blanche) ---
WHITELIST = {
    "assets/symbols/orb_mult.png",   # fallback JS couvert par window.SYM_DATA (jamais utilisé en standalone)
    "assets/symbols/",               # préfixe du fallback symSrc (idem, couvert par SYM_DATA)
}
leftovers = set(re.findall(r'(?:src|href)="(assets/[^"]+)"', html))
leftovers |= set(re.findall(r'url\(["\']?(assets/[^)"\']+)', html))
leftovers |= set(re.findall(r'"(assets/[^"]*)"', html))
leftovers |= set(re.findall(r"'(assets/[^']*)'", html))
leftovers = {x for x in leftovers if x not in WHITELIST}
if leftovers:
    sys.exit("build.py: références relatives restantes dans le standalone : " + ", ".join(sorted(leftovers)))

out = os.path.join(ROOT, "GATES_OF_TOM.html")
open(out, "w", encoding="utf-8").write(html)
kb = round(len(html) / 1024)
print(f"OK -> GATES_OF_TOM.html ({kb} Ko, {len(sym_data)} symboles embarques, 0 reference relative restante)")
