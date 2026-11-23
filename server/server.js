/* ------------------------------------------------------------------
    BFF locale di Rigo: un unico processo Node, zero dipendenze.
    Serve due cose:
      GET  /api/salute  -> il modello di lettura e' pronto? quale?
      POST /api/leggi   -> legge gli allegati (estrazione, mai verdetti)
                           (con DEMO_TOKEN attivo chiede anche il token)
      GET  /*           -> l'app stessa (index.html, js/, ...)
    Ascolta SOLO su 127.0.0.1:8790: la chiave resta locale. Per
    condividere un link col modello: "Condividi app col collega.command"
    (tunnel HTTPS + token), come per la demo smistamento email.
    Avvio:  node server/server.js   (legge ../.env)
    ------------------------------------------------------------------ */
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { leggiRicevute } = require("./motore-lettura.js");

function leggiEnv() {
  const file = path.join(__dirname, "..", ".env");
  const valori = {};
  try {
    fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((riga) => {
        const m = riga.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m) valori[m[1]] = m[2].replace(/^["']|["']$/g, "");
      });
  } catch (e) {
    /* niente .env: si puo' usare ancora l'ambiente */
  }
  return {
    baseUrl: process.env.AI_BASE_URL || valori.AI_BASE_URL || null,
    apiKey: process.env.AI_API_KEY || valori.AI_API_KEY || null,
    modello: process.env.AI_MODEL || valori.AI_MODEL || null,
    porta: Number(process.env.AI_PORT || valori.AI_PORT || 8790),
    demoToken: process.env.DEMO_TOKEN || valori.DEMO_TOKEN || null,
  };
}

const cfg = leggiEnv();
const pronto = Boolean(cfg.baseUrl && cfg.apiKey && cfg.modello);

/* -------------------- protezione del link condiviso --------------------
   Con DEMO_TOKEN nel .env, /api/leggi accetta solo chi porta il token
   (header X-Token o ?t=... nel link). Senza DEMO_TOKEN il BFF resta
   aperto, ma allora e' solo locale: non va mai esposto su un tunnel. */
function tokenOk(req) {
  if (!cfg.demoToken) return true;
  let dalLink = null;
  try {
    dalLink = new URL(req.url, "http://locale").searchParams.get("t");
  } catch (e) { /* URL ballerina: conta solo l'header */ }
  const ricevuto = req.headers["x-token"] || dalLink;
  return ricevuto === cfg.demoToken;
}

/* -------------------- l'app, servita da qui -------------------- */
const RADICE = path.join(__dirname, "..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function serviStatica(req, res) {
  let percorso;
  try {
    percorso = decodeURIComponent(req.url.split("?")[0]);
  } catch (e) {
    rispondi(res, 400, { ok: false, motivo: "percorso non valido" });
    return;
  }
  if (percorso === "/") percorso = "/index.html";
  const file = path.normalize(path.join(RADICE, percorso));
  const est = path.extname(file).toLowerCase();
  /* niente uscite dalla cartella e niente file senza estensione nota:
     .env e i sorgenti server restano invisibili */
  if (!file.startsWith(RADICE + path.sep) || !(est in MIME)) {
    rispondi(res, 404, { ok: false, motivo: "non si trova (o non si serve)" });
    return;
  }
  fs.readFile(file, (err, dati) => {
    if (err) {
      rispondi(res, 404, { ok: false, motivo: "non si trova" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[est],
      "Cache-Control": "no-store",
      "Content-Length": dati.length,
    });
    res.end(req.method === "HEAD" ? undefined : dati);
  });
}

function ora() {
  return new Date().toTimeString().slice(0, 8);
}

function rispondi(res, codice, oggetto) {
  const corpo = JSON.stringify(oggetto);
  res.writeHead(codice, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Private-Network": "true",
    "Content-Length": Buffer.byteLength(corpo),
  });
  res.end(corpo);
}

function corpoRichiesta(req) {
  return new Promise((resolve, reject) => {
    let dati = "";
    req.on("data", (chunk) => {
      dati += chunk;
      if (dati.length > 200000) reject(new Error("richiesta troppo grande"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(dati || "{}"));
      } catch (e) {
        reject(new Error("body non JSON"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Token",
      /* pagine servite da internet che chiamano il BFF su localhost */
      "Access-Control-Allow-Private-Network": "true",
    });
    res.end();
    return;
  }

  if (req.url === "/api/salute" && req.method === "GET") {
    rispondi(res, 200, pronto
      ? { ok: true, motore: "modello", modello: cfg.modello }
      : { ok: false, motivo: "BFF senza chiave: configura .env (AI_BASE_URL, AI_API_KEY, AI_MODEL)" });
    return;
  }

  if (req.url.startsWith("/api/leggi") && req.method === "POST") {
    const t0 = Date.now();
    if (!tokenOk(req)) {
      console.log(`[rigo ${ora()}] leggi -> rifiutata: token demo mancante o errato`);
      rispondi(res, 401, { ok: false, motivo: "token della demo mancante: riaprire il link ricevuto per intero (quello con ?t=...)" });
      return;
    }
    if (!pronto) {
      console.log(`[rigo ${ora()}] leggi -> rifiutata: BFF non configurato`);
      rispondi(res, 503, { ok: false, motivo: "BFF non configurato: manca .env" });
      return;
    }
    let corpo;
    try {
      corpo = await corpoRichiesta(req);
    } catch (e) {
      rispondi(res, 400, { ok: false, motivo: e.message });
      return;
    }
    const ricevute = (Array.isArray(corpo.ricevute) ? corpo.ricevute : [])
      .filter(r => r && typeof r.id === "string" && typeof r.testo === "string" && r.testo.length > 5)
      .slice(0, 80)
      .map(r => ({ id: r.id.slice(0, 24), testo: r.testo.slice(0, 700) }));
    if (!ricevute.length) {
      rispondi(res, 400, { ok: false, motivo: "nessuna ricevuta da leggere" });
      return;
    }
    try {
      const letture = await leggiRicevute(ricevute, cfg);
      let ok = 0, scartate = 0;
      for (const l of letture) { if (l.trovato) ok++; else scartate++; }
      console.log(`[rigo ${ora()}] leggi -> ${ok}/${letture.length} letture verificate (${Date.now() - t0}ms)`);
      rispondi(res, 200, { ok: true, motore: "modello", modello: cfg.modello, letture });
    } catch (e) {
      console.log(`[rigo ${ora()}] leggi -> errore ${Date.now() - t0}ms · ${e.message}`);
      rispondi(res, 502, { ok: false, motivo: String(e.message || e).slice(0, 200) });
    }
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && !req.url.startsWith("/api/")) {
    serviStatica(req, res);
    return;
  }

  rispondi(res, 404, { ok: false, motivo: "rota non conosciuta" });
});

server.listen(cfg.porta, "127.0.0.1", () => {
  console.log(`[rigo ${ora()}] BFF in ascolto su http://127.0.0.1:${cfg.porta}`);
  console.log(pronto
    ? `[rigo ${ora()}] motore: modello ${cfg.modello} via ${cfg.baseUrl}` + (cfg.demoToken ? " · link protetto da token" : " · ATTENZIONE: DEMO_TOKEN assente")
    : `[rigo ${ora()}] ATTENZIONE: .env assente o incompleto, /api/leggi rispondera' 503`);
});
