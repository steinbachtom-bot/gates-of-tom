"""
Construit GATES_OF_TOM.html : un fichier unique autonome.
- inline engine.js + game.js
- embarque les symboles PNG en base64 (window.SYM_DATA)
Usage : python build.py
"""
import base64, glob, os, json

ROOT = os.path.dirname(os.path.abspath(__file__))

def read(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()

html = read("index.html")
engine = read("engine.js")
game = read("game.js")

# Embarquer les PNG des symboles en data-URI
sym_data = {}
for path in sorted(glob.glob(os.path.join(ROOT, "assets/symbols/*.png"))):
    name = os.path.basename(path)
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    sym_data[name] = "data:image/png;base64," + b64

assets_script = "<script>window.SYM_DATA=" + json.dumps(sym_data) + ";</script>"

html = html.replace('<script src="engine.js"></script>',
                    "<script>\n" + engine + "\n</script>")
html = html.replace('<script src="game.js"></script>',
                    assets_script + "\n<script>\n" + game + "\n</script>")

# Embarquer les décors (fond large + fond portrait) en data-URI
for decor_rel in ("assets/decor/bg_hades_web.jpg", "assets/decor/bg_portrait_web.jpg"):
    decor = os.path.join(ROOT, decor_rel)
    if os.path.exists(decor):
        with open(decor, "rb") as f:
            b = base64.b64encode(f.read()).decode("ascii")
        html = html.replace('src="' + decor_rel + '"',
                            'src="data:image/jpeg;base64,' + b + '"')

# Embarquer les vidéos Big Win (16:9 + portrait) en data-URI.
# La source est choisie par JS via window.BIGWIN_URL / window.BIGWIN_PORTRAIT_URL :
# on remplace donc les littéraux de chaîne (pas un attribut src=).
for vid_rel in ("assets/decor/bigwin.mp4", "assets/decor/bigwin_portrait.mp4"):
    vid = os.path.join(ROOT, vid_rel)
    if os.path.exists(vid):
        with open(vid, "rb") as f:
            b = base64.b64encode(f.read()).decode("ascii")
        html = html.replace('"' + vid_rel + '"',
                            '"data:video/mp4;base64,' + b + '"')

# Embarquer les sons en data-URI (MIME selon l'extension : mp3 -> mpeg, wav -> wav)
for path in ["assets/audio/click.mp3", "assets/audio/whoosh_spin.mp3",
             "assets/audio/hit.mp3", "assets/audio/land.mp3",
             "assets/audio/scatter.wav", "assets/audio/fs_trigger.wav",
             "assets/audio/music.mp3",
             "assets/audio/music_fs.mp3", "assets/audio/bigwin_music.mp3"]:
    full = os.path.join(ROOT, path)
    if os.path.exists(full):
        with open(full, "rb") as f:
            b = base64.b64encode(f.read()).decode("ascii")
        mime = "audio/wav" if path.endswith(".wav") else "audio/mpeg"
        html = html.replace('"' + path + '"', '"data:' + mime + ";base64," + b + '"')

out = os.path.join(ROOT, "GATES_OF_TOM.html")
open(out, "w", encoding="utf-8").write(html)
kb = round(len(html) / 1024)
print(f"OK -> GATES_OF_TOM.html ({kb} Ko, {len(sym_data)} symboles embarques)")
print("src restants:", '"engine.js"' in html or '"game.js"' in html)
