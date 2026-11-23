/* ------------------------------------------------------------------
    Motore di lettura degli allegati: chiede al modello (gateway
    OpenAI-compatibile, la cui chiave vive solo nel .env locale) di
    LEGGERE le ricevute ed estrarre i dati. Solo estrazione: il verdetto
    lo danno le regole nel browser, mai questo file (blueprint Rigo).
    Ogni dato estratto viene VERIFICATO qui contro il testo vero della
    ricevuta: se il totale dichiarato dal modello non compare nel
    documento, la lettura di quella riga è scartata. Niente numeri
    fingibili, mai.
    ------------------------------------------------------------------ */
"use strict";

function estraiRigheJSON(testo) {
  /* protocollo: un oggetto JSON per documento. Non mi fido che stiano
     sempre su UNA riga: scansiono il testo e raccolgo ogni oggetto
     {..} bilanciato (fuori dalle stringhe), cosi' un oggetto scritto su
     piu' righe o un pezzo di testo in mezzo non perde documenti. */
  const out = [];
  let profondità = 0, inizio = 0, nellaStringa = false, dopoBackslash = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (nellaStringa) {
      if (dopoBackslash) dopoBackslash = false;
      else if (c === "\\") dopoBackslash = true;
      else if (c === '"') nellaStringa = false;
      continue;
    }
    if (c === '"') { nellaStringa = true; continue; }
    if (c === "{") { if (profondità === 0) inizio = i; profondità++; continue; }
    if (c === "}") {
      if (profondità > 0) profondità--;
      if (profondità === 0) {
        try {
          const o = JSON.parse(testo.slice(inizio, i + 1));
          if (o && typeof o.id === "string") out.push(o);
        } catch (e) { /* oggetto non ricostruibile: verra' riportato come mancante */ }
      }
    }
  }
  return out;
}

function promptBatch(ricevute) {
  return "Leggi questi documenti di spesa (ricevute, biglietti, fatture semplificate) e per ciascuno estrai i dati.\n" +
    "Rispondi SOLO con una riga per documento, in questo esatto formato (un oggetto JSON compatto per riga, niente altro testo, niente array intorno):\n" +
    '{"id":"...","trovato":true,"fornitore":"...","data":"...","totaleEuro":"...","tipoDocumento":"...","anomalia":"..."}\n' +
    "Regole vincolanti:\n" +
    "- una riga per ogni documento ricevuto, stesso id, stesso ordine;\n" +
    "- totaleEuro: il TOTALE FINALE cioe' l'importo che il cliente paga (se il documento mostra subtotale, tasse o extra separati, prendi la cifra finale, non il subtotale), ESATTAMENTE come stampato (con la virgola, senza simbolo €);\n" +
    "- mai inventare: se un dato non c'è nel documento, metti quel campo a null e trovato=false;\n" +
    "- tipoDocumento: uno tra biglietto, fattura, scontrino, ricevuta-taxi, conto-albergo, altro;\n" +
    "- anomalia: una frase breve SOLO se il testo lo merita (numerazione identica a un altro documento, una voce anomala come minibar o film presentata come servizio di camera, una cifra che non torna con i subtotali), altrimenti null;\n" +
    "- nei campi di testo non usare MAI il carattere apice doppio: usa gli apici singoli, mai a capo;\n" +
    "- non giudicare nulla: né rimborsabilità, né politica aziendale. Solo lettura.\n\n" +
    "DOCUMENTI:\n" +
    ricevute.map(r => `- id=${r.id}\n  ${r.testo}`).join("\n");
}

async function chiamaModello(ricevute, cfg) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40000);
  try {
    const resp = await fetch(cfg.baseUrl.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.apiKey,
      },
      body: JSON.stringify({
        model: cfg.modello,
        temperature: 0,
        max_tokens: 1800,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: "Sei un estrattore di dati da ricevute fiscali italiane. Leggi, non giudichi. Rispondi solo con righe JSON, una per documento." },
          { role: "user", content: promptBatch(ricevute) },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error("gateway " + resp.status + " " + (await resp.text()).slice(0, 160));
    const dati = await resp.json();
    const testo = (((dati.choices || [])[0] || {}).message || {}).content || "";
    return estraiRigheJSON(testo);
  } finally {
    clearTimeout(timer);
  }
}

/* normalizza per il confronto "la cifra è stampata nel documento?" */
function addola(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9,.-]/g, "");
}
function cifraPresente(testo, euro) {
  const t = addola(testo);
  const cifre = addola(euro).replace(/[.-]+$/, "");
  return cifre.length > 0 && t.includes(cifre);
}
function euroAcent(euro) {
  const t = String(euro).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

async function leggiRicevute(ricevute, cfg) {
  const perId = new Map();
  const DIM = 8;
  const fondi = async (batch) => {
    let letture = await chiamaModello(batch, cfg);
    if (!letture.length) letture = await chiamaModello(batch, cfg);
    for (const l of letture) {
      if (!l || typeof l.id !== "string") continue;
      const orig = batch.find(r => r.id === l.id);
      if (!orig || perId.has(l.id)) continue;
      if (!l.trovato) {
        perId.set(l.id, { id: l.id, trovato: false, motivo: "il modello non ha trovato i dati nel documento" });
        continue;
      }
      const cent = euroAcent(l.totaleEuro == null ? "" : l.totaleEuro);
      if (cent === null || !cifraPresente(orig.testo, String(l.totaleEuro))) {
        /* prova non verificata: la cifra citata non è stampata nel documento */
        perId.set(l.id, { id: l.id, trovato: false, motivo: "lettura scartata: il totale citato non compare nel documento" });
        continue;
      }
      perId.set(l.id, {
        id: l.id,
        trovato: true,
        fornitore: String(l.fornitore || "").slice(0, 60) || null,
        data: String(l.data || "").slice(0, 30) || null,
        totaleEuro: String(l.totaleEuro).slice(0, 12),
        totaleCent: cent,
        tipoDocumento: String(l.tipoDocumento || "altro").slice(0, 20),
        anomalia: l.anomalia ? String(l.anomalia).slice(0, 140) : null,
      });
    }
  };
  for (let i = 0; i < ricevute.length; i += DIM) {
    await fondi(ricevute.slice(i, i + DIM));
  }
  /* passata di recupero: una risposta mozzata a meta' blocco non deve
     costare documenti che il modello, ritentando, sa leggere benissimo */
  const mancanti = ricevute.filter(r => !perId.has(r.id));
  for (let i = 0; i < mancanti.length; i += DIM) {
    await fondi(mancanti.slice(i, i + DIM));
  }
  /* una lettura per ogni ricevuta chiesta: anche chi non ha avuto
     risposta riceve un esito onesto, mai un buco silenzioso */
  return ricevute.map(r =>
    perId.get(r.id) || { id: r.id, trovato: false, motivo: "il modello non ha risposto per questo documento" }
  );
}

module.exports = { leggiRicevute };
