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

# Embarquer le décor (image de fond) en data-URI
decor = os.path.join(ROOT, "assets/decor/bg_hades_web.jpg")
if os.path.exists(decor):
    with open(decor, "rb") as f:
        b = base64.b64encode(f.read()).decode("ascii")
    html = html.replace('src="assets/decor/bg_hades_web.jpg"',
                        'src="data:image/jpeg;base64,' + b + '"')

out = os.path.join(ROOT, "GATES_OF_TOM.html")
open(out, "w", encoding="utf-8").write(html)
kb = round(len(html) / 1024)
print(f"OK -> GATES_OF_TOM.html ({kb} Ko, {len(sym_data)} symboles embarques)")
print("src restants:", '"engine.js"' in html or '"game.js"' in html)
