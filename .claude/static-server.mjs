import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Racine = dossier du projet (parent de .claude/) — portable, pas de chemin personnel en dur.
const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const PORT = 8123;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
  ".wav": "audio/wav", ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    // Jamais servir les dossiers/fichiers cachés (.git, .claude, .DS_Store…) ni business/.
    // Comparaison INSENSIBLE à la casse : le FS de macOS l'est aussi (/BUSINESS/ = /business/).
    const segs = p.split("/").filter(Boolean);
    if (segs.some((s) => s.startsWith(".")) || (segs[0] || "").toLowerCase() === "business") { res.writeHead(403).end(); return; }
    const full = normalize(join(ROOT, p));
    // Anti-traversal strict : le chemin résolu doit être DANS ROOT (séparateur inclus,
    // sinon un dossier frère « <ROOT>-bak » passerait le simple startsWith).
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(full);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(full).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
  // Bind localhost UNIQUEMENT : le serveur de dev ne doit pas exposer le dossier au LAN.
}).listen(PORT, "127.0.0.1", () => console.log(`Serving Gates of Tom on http://localhost:${PORT}`));
