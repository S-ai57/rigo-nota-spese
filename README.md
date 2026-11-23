# Rigo — nota spese trasferta (prototipo demo)

L'app verifica le note spese di una PMI (Novaflow S.r.l.) riga per riga,
citando gli articoli della politica aziendale. **Il verdetto lo danno
sempre le regole** (fanno i conti al centesimo, come da BLUEPRINT); il
**modello IA legge davvero gli allegati** — estrae fornitore, data e
totale da ricevute e fatture e segnala anomalie di testo (es. numerazioni
identiche tra due ricevute). Solo estrazione, mai verdetti.

## Come si apre

- **Doppio clic su `Apri Rigo.command`** — interfaccia subito, senza motore.
  Lì la lettura degli allegati è disattivata e la pagina lo dice onestamente.
- **Doppio clic su `Condividi app col collega.command`** — parte il motore
  (modello reale via BFF locale + tunnel HTTPS temporaneo) e si copia un
  link protetto da token, pronto da mandare al collega. Lui apre e usa la
  demo completa col modello, senza installare niente. Chiude la finestra,
  il link muore. La chiave del modello resta su questo Mac, sempre.

Il BFF sta su `http://127.0.0.1:8790` (solo locale):
`GET /api/salute` e `POST /api/leggi` (chiede il token `DEMO_TOKEN`).

## L'app online

**https://s-ai57.github.io/rigo-nota-spese/** — interfaccia sempre online,
per guardare la demo senza installare niente (i dati sono inventati, come
nel dataset). Per far LEGGERE gli allegati al modello da chi apre il link
valgono le stesse regole della demo smistamento email:

- chi riceve il **link del tunnel** (`Condividi app col collega.command`)
  usa tutto col modello, senza installare niente: il modello gira sul Mac
  di chi condivide, il link muore chiudendo la finestra;
- in alternativa chi apre il link di GitHub Pages può avviare **il proprio**
  BFF locale (clone + `.env` con la propria chiave + `node server/server.js`):
  la pagina lo trova sul suo `localhost` e il browser chiede una volta il
  permesso di accedere alla rete locale, basta **Consenti**;
- senza motore raggiungibile la demo resta navigabile e la verifica dice
  onestamente che la lettura non è riuscita: i verdetti, quando ci sono,
  restano comunque solo dalle regole.

## Il confine (voluto, da BLUEPRINT)

| Chi fa cosa | Chi |
|---|---|
| Leggere gli allegati (fornitore, data, totale, anomalie) | modello via BFF |
| Verificare che la cifra letta sia stampata nel documento | BFF (prova verificata o lettura scartata) |
| Massimali, diaria, trattenute, verdetti, totali | regole nel browser |

Senza BFF raggiungibile la demo è comunque navigabile e la verifica dice
chiaro che la lettura non è riuscita: nessun risultato fingibile.

## File

- `index.html` — l'app (interfaccia + motore degli articoli + dataset inventato)
- `js/ricevute.js` — i testi degli allegati che il modello legge
- `js/ai-rigo.js` — ponte verso il BFF (stesso schema della demo smistamento)
- `server/server.js` — BFF: serve l'app, protegge col token, espone `/api/leggi`
- `server/motore-lettura.js` — prompt vincolante + verifica delle prove
- `.env` — chiave del gateway e token (resta locale, mai nel codice)
