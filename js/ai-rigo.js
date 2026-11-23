/* ------------------------------------------------------------------
    Ponte tra Rigo e il BFF locale (server/server.js). La pagina NON ha
    la chiave del modello: chiede solo di LEGGERE gli allegati.
    Confini voluti (blueprint): il modello fa ESTRAZIONE dai documenti
    (fornitore, data, totale, anomalie di testo); il verdetto lo danno
    sempre le regole nel browser. Se il BFF non c'e' o una lettura non e'
    verificata, lo si dice in modo onesto: nessuna estrazione fingibile.
    ------------------------------------------------------------------ */

/* token della demo: chi apre il link ricevuto (quello con ?t=...) lo
   memorizza qui nel proprio browser e lo riporta al BFF a ogni chiamata */
function tokenDemoRigo() {
  try {
    return localStorage.getItem("rigo.demoToken") || "";
  } catch (e) {
    return "";
  }
}
(function memorizzaTokenDalLink() {
  try {
    const m = location.search.match(/[?&]t=([A-Za-z0-9_-]{4,128})/);
    if (m) localStorage.setItem("rigo.demoToken", m[1]);
  } catch (e) {
    /* niente localStorage o link senza token: si procedera' senza */
  }
})();

const AI = {
  /* se la pagina e' servita dal BFF stesso (link del tunnel, oppure
     http://127.0.0.1:8790) la chiamata e' same-origin: niente permessi
     browser. Altrimenti (file://) il BFF e' il localhost di chi apre. */
  urlBase: (function () {
    const h = location.hostname || "";
    const servitaDalBff = location.protocol.indexOf("http") === 0 && !/\.github\.io$/.test(h);
    return servitaDalBff ? "" : "http://127.0.0.1:8790";
  })(),
  pronto: false,
  modello: null,

  /* indaga: il motore di lettura c'e' e con che modello risponde? */
  async indaga() {
    try {
      const t = tokenDemoRigo();
      const resp = await fetch(this.urlBase + "/api/salute", {
        headers: t ? { "X-Token": t } : {},
        signal: AbortSignal.timeout(1500),
      });
      const dati = await resp.json();
      this.pronto = Boolean(dati.ok);
      this.modello = dati.modello || null;
    } catch (e) {
      this.pronto = false;
      this.modello = null;
    }
    aggiornaBadgeMotore();
    return this.pronto;
  },

  /* leggi: manda al modello gl'allegati delle righe date e riceve le
     letture VERIFICATE lato server (il totale citato deve essere
     stampato nel documento). Non butta giu' nessun verdetto: quello
     resta alle regole. */
  async leggi(righe) {
    const ricevute = righeConDocumento(righe);
    if (!ricevute.length) return { perId: {}, riepilogo: null };
    const t = tokenDemoRigo();
    const intestazioni = { "Content-Type": "application/json" };
    if (t) intestazioni["X-Token"] = t;
    let resp;
    try {
      resp = await fetch(this.urlBase + "/api/leggi", {
        method: "POST",
        headers: intestazioni,
        body: JSON.stringify({ ricevute }),
        signal: AbortSignal.timeout(150000),
      });
    } catch (e) {
      if (e && e.name === "TimeoutError") throw new Error("il modello non ha risposto entro 150 secondi");
      if (this.urlBase) {
        throw new Error("BFF non raggiungibile su " + this.urlBase + ": avviare con «node server/server.js» o con il link di chi condivide la demo");
      }
      throw new Error("il motore di questa pagina non risponde: chi condivide il link deve riavviarlo");
    }
    const dati = await resp.json().catch(() => null);
    if (!resp.ok || !dati || !dati.ok) {
      throw new Error((dati && dati.motivo) || "il BFF ha dato una risposta che non si puo' leggere");
    }
    const perId = {};
    (dati.letture || []).forEach(l => { perId[l.id] = l; });
    return { perId, riepilogo: riassumeLettura(perId, righe) };
  },
};

/* le righe che hanno davvero un documento da leggere: le ricevute
   false restano fuori, perche' li' il documento non c'e' — ed e' il
   motivo per cui quella riga torna a una persona */
function righeConDocumento(righe) {
  return (typeof RICEVUTE === "undefined" ? [] : righe)
    .filter(r => r.ricevuta && RICEVUTE[r.id])
    .map(r => ({
      id: r.id,
      testo: RICEVUTE[r.id],
      dichiaratoCent: r.importo || null,
      fornitore: r.fornitore || null,
      cat: r.cat || null,
    }));
}

/* confronta le letture con le dichiarazioni: coerenza cifra/documento e
   anomalie segnalate dal modello (segnali per l'amministrazione, non
   verdetti) */
function riassumeLettura(perId, righe) {
  const r = { totali: 0, letti: 0, coerenti: 0, diversi: 0, falliti: 0, anomalie: [] };
  righe.forEach(row => {
    if (!row.ricevuta || typeof RICEVUTE === "undefined" || !RICEVUTE[row.id]) return;
    r.totali++;
    const l = perId[row.id];
    if (!l || !l.trovato) { r.falliti++; return; }
    r.letti++;
    if (row.importo != null && l.totaleCent !== row.importo) r.diversi++;
    else r.coerenti++;
    if (l.anomalia) r.anomalie.push({ id: row.id, desc: row.desc, testo: l.anomalia });
  });
  return r;
}

/* ---------- etichette del motore (badge in testata) ---------- */
function nomeModelloBreve() {
  return String(AI.modello || "").split("/").pop();
}
function etichettaMotoreRigo() {
  return AI.modello ? "lettura allegati: modello " + nomeModelloBreve() : "lettura allegati: modello non raggiungibile";
}
function aggiornaBadgeMotore() {
  const el = document.getElementById("motoreBadge");
  if (el) el.textContent = etichettaMotoreRigo();
}

/* il testo onesto del riepilogo lettura, identico in lista e dettaglio */
function testoRiepilogoLettura(rip) {
  if (!rip || !rip.totali) return "nessun documento da leggere in queste righe";
  let s = `${rip.letti}/${rip.totali} documenti letti e verificati · ` +
          `${rip.coerenti} coerenti col dichiarato`;
  if (rip.diversi) s += ` · ${rip.diversi} con cifra DIVERSA dal dichiarato`;
  if (rip.falliti) s += ` · ${rip.falliti} letture non riuscite`;
  if (rip.anomalie.length) s += ` · ${rip.anomalie.length} anomal${rip.anomalie.length === 1 ? "ia" : "ie"} segnalata${rip.anomalie.length === 1 ? "" : "e"}`;
  return s;
}

/* sondaggio all'avvio: accende il badge; se il BFF arriva dopo, basta
   rilanciare la verifica */
if (typeof window !== "undefined") {
  AI.indaga();
}

/* ---------- gancio QA ----------
   ?qa=lettura apre la pagina, fa leggere davvero i documenti del primo
   fascicolo e scrive il risultato nel DOM: basta un dump del browser
   (o un click) per verificare tutto il percorso pagina→BFF→modello. */
if (typeof window !== "undefined" && /[?&]qa=lettura/.test(location.search)) {
  window.addEventListener("load", async function () {
    const pre = document.createElement("pre");
    pre.id = "qa-out";
    pre.textContent = "QA-LETTURA in corso...";
    document.body.appendChild(pre);
    try {
      const rep = REPORTS[0];
      const es = await AI.leggi(rep.righe);
      pre.textContent = "QA-LETTURA " + (es.riepilogo ? "OK " + testoRiepilogoLettura(es.riepilogo) : "nessun documento") +
        " · motore=" + (AI.modello || "?");
    } catch (e) {
      pre.textContent = "QA-LETTURA FALLITA: " + e.message;
    }
  });
}
