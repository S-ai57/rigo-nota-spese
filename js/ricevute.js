/* ------------------------------------------------------------------
    Rigo · allegati del prototipo: il testo di ogni ricevuta/documento
    associato a una riga di spesa (id della riga → testo dell'allegato).
    Sono i documenti che il MODELLO legge davvero via BFF: estrazione di
    fornitore, data e totale. Il verdetto resta alle regole (blueprint:
    "inferenza per leggere gli allegati in ingresso, solo estrazione,
    mai per il verdetto"). Le cifre sono inventate come tutto il resto
    del dataset, e combaciano con gli importi dichiarati delle righe.
    Le righe senza ricevuta (ricevuta:false) qui NON compaiono: non c'è
    documento da leggere, ed è esattamente il punto della demo.
    ------------------------------------------------------------------ */

const RICEVUTE = {
  /* --- milano · Marco Delfino (12-13 marzo) --- */
  mi1: 'TRENITALIA S.p.A. · biglietto FRECCIAROSA 9602 · gio 12/03/2026 · Torino Porta Nuova → Milano Centrale · classe Standard sed. 42C · totale € 57,80 · PA',
  mi2: 'HOTEL BERNA *** · Via Lincoln 8, Milano · P.IVA 09123450967 · check-in 12/03/2026 check-out 14/03/2026 · 2 notti camera doppia uso singola con colazione · subtotale € 271,00 · city tax € 25,00 · TOTALE € 296,00',
  mi3: 'TRATTORIA DEL SOLE · Milano · 13/03/2026 ore 13:20 · coperti 2 (Delfino + sig. Ferretti) · Doc. N. 002145 · totale € 21,40 · PA',
  mi4: 'OSTERIA AL PORTO · Milano · 12/03/2026 ore 21:05 · 1 coperto · Doc. N. 008812 · totale € 38,50 · PA',
  mi5: 'RADIO TAXI 4040 · Torino · corsa del 12/03/2026 ore 21:10 · da Porta Nuova a cliente zona lambrate · compenso € 24,00 · totale € 24,00 · riceuta n. 14477',
  mi6: 'BAR CENTRALE · Milano · 13/03/2026 ore 12:40 · 1 coperto, pranzo veloce · Doc. N. A0199 · totale € 19,90 · PA',
  mi7: 'TRENITALIA S.p.A. · biglietto FRECCIAROSA 9615 · ven 13/03/2026 · Milano Centrale → Torino Porta Nuova · classe Standard sed. 11A · totale € 57,80 · PA',

  /* --- roma · Elisa Baldi (5-7 maggio) --- */
  rm1: 'ITALO Treno NV S.r.l. · biglietto Italo NV 9305 · mer 05/05/2026 · Torino → Roma Termini · classe Prima · tot. € 29,60 · PA',
  rm2: 'HOTEL QUIRINO **** · Via dei Penitenzieri 5, Roma · P.IVA 07712341004 · check-in 05/05/2026 check-out 07/05/2026 · 2 notti camera singola · tariffa piena periodo di fiera Edilexpo · TOTALE € 369,00 · fattura n. 221/2026',
  rm3: 'TAVERNA ROMANA · Roma · 05/05/2026 ore 13:35 · 1 coperto · Doc. N. 04512 · totale € 31,00 · PA',
  rm4: 'RISTORANTE LUCCIOLA · Ostia Lido (RM) · 06/05/2026 ore 20:50 · coperti 2 (Baldi + Geom. Bruni, Bruni Costruzioni) · Doc. N. 07331 · totale € 96,00 · PA',
  rm5: 'HOTEL QUIRINO · Roma · conto camera 204 del 06/05/2026 · voce "addebiti camera": consumazioni minibar (2 bevande, 1 snack) · € 14,00 · importo presentato come servizio di camera · allegato al conto n. 221',
  rm6: 'HOTEL QUIRINO · Roma · camera 204 · 06/05/2026 · servizio pay-per-view film prima serata · € 12,90 · aggiunto al conto finale',
  rm7: 'TAXI ROMA 06 · Roma · corsa del 06/05/2026 ore 22:40 · da fiera Edilexpo a hotel · compenso € 38,00 · totale € 38,00 · n. corsa 8842',
  rm8: 'ITALO Treno NV S.r.l. · biglietto Italo NV 9310 · ven 07/05/2026 · Roma Termini → Torino · classe Prima · tot. € 29,60 · PA',

  /* --- bologna · Luca Moretti (8-9 ottobre) --- */
  bo1: 'TRENITALIA S.p.A. · biglietto FRECCIAROSA 9730 · lun 08/10/2026 · Torino Porta Nuova → Bologna Centrale · classe Standard · totale € 41,20 · PA',
  bo2: 'HOTEL ZANARDI *** · Via Zamboni 21, Bologna · check-in 08/10/2026 check-out 09/10/2026 · 1 notte doppia uso singola · colazioni incluse · TOTALE € 105,00 · documento n. 318',
  bo5: 'RISTORANTE IL CENTRO · Bologna · 09/10/2026 ore 13:05 · 1 coperto · Doc. N. 047 · totale € 22,40 · PA',
  bo6: 'RISTORANTE IL CENTRO · Bologna · 09/10/2026 ore 13:05 · 1 coperto · Doc. N. 047 · totale € 22,40 · PA',
  bo7: 'TRENITALIA S.p.A. · biglietto FRECCIAROSA 9741 · mar 09/10/2026 · Bologna Centrale → Torino Porta Nuova · classe Standard · totale € 41,20 · PA',

  /* --- anna · Anna Riva (26-27 febbraio) --- */
  an1: 'TRENITALIA S.p.A. · biglietto FRECCIAROSA 9521 · gio 26/02/2026 · Torino → Padova · classe Standard · totale € 32,40 · PA',
  an2: 'HOTEL ANTONINUS *** · Padova · 26-27/02/2026 · 1 notte camera singola con colazione · TOTALE € 98,00 · fattura semplificata n. 402',
  an3: 'OSTERIA DEL SANTO · Padova · 26/02/2026 ore 20:30 · 1 coperto · Doc. N. 11255 · totale € 24,50 · PA',
  an4: 'BISTÈRE VENETO · Padova · 27/02/2026 ore 13:10 · coperti 2 (Riva + ufficio acquisti Ferretto) · Doc. N. 11480 · totale € 18,90 · PA',
  an5: 'TAXI PADOVA 3000 · Padova · corsa del 27/02/2026 ore 17:55 · da cliente a stazione · € 22,00 · n. 5510',
  an6: 'TRENITALIA S.p.A. · biglietto FRECCIAROSA 9536 · ven 27/02/2026 · Padova → Torino · classe Standard · totale € 32,40 · PA',

  /* --- pietro · Pietro Casetti (2-4 marzo) --- */
  pt1: 'TRENITALIA S.p.A. · biglietto INTERCITY 705 · lun 02/03/2026 · Torino Porta Nuova → Genova Piazza Principe · classe Standard · totale € 41,80 · PA',
  pt2: 'HOTEL GENOVA CENTRO *** · Genova · check-in 02/03/2026 check-out 04/03/2026 · 2 notti camera singola · TOTALE € 176,00 · documento n. 1899',
  pt3: 'TRATTORIA BISCANTI · Genova · 02/03/2026 ore 20:15 · 1 coperto · Doc. N. 3301 · totale € 26,20 · PA',
  pt4: 'FOCACCERIA OLDENI · Genova · 04/03/2026 ore 12:50 · 1 coperto · Doc. N. 3577 · totale € 19,80 · PA',
  pt5: 'TRENITALIA S.p.A. · biglietto INTERCITY 712 · mer 04/03/2026 · Genova Piazza Principe → Torino · classe Standard · totale € 41,80 · PA',

  /* --- sara · Sara Merlin (18 marzo, in giornata) --- */
  sr1: 'ITALO Treno NV S.r.l. · biglietto Italo NV 9303 · mer 18/03/2026 · Torino → Milano · classe Smart · tot. € 29,60 · PA',
  sr2: 'RISTORANTE LIBERTY · Milano · 18/03/2026 ore 13:00 · coperti 2 (Merlin + Arch. Pivetti) · Doc. N. 6015 · totale € 74,00 · PA',
  sr3: 'ITALO Treno NV S.r.l. · biglietto Italo NV 9322 · mer 18/03/2026 ore 20:15 · Milano → Torino · tariffa serale · tot. € 33,40 · PA',

  /* --- davico · Davide Ferrante (19 marzo; i km non hanno documento) --- */
  dv2: 'OSTERIA DEL BICERIN · Cuneo · 19/03/2026 ore 12:35 · 1 coperto, pranzo di lavoro · Doc. N. 0884 · totale € 28,00 · PA',

  /* --- nadia · Nadia Cinti (20-21 novembre) --- */
  nd1: 'TRENITALIA S.p.A. · biglietto FRECCIAROSA 9812 · gio 20/11/2025 · Torino → Verona Porta Nuova · classe Standard · totale € 38,80 · PA',
  nd2: 'HOTEL ARENA *** · Verona · 20-21/11/2025 · 1 notte camera singola · colazione inclusa · TOTALE € 104,00 · documento n. 7741',
  nd3: 'RISTORANTE VERONESE · Verona · 20/11/2025 ore 20:40 · 1 coperto · Doc. N. 2001 · totale € 52,00 · PA',
  nd4: 'TRATTORIA DEL PAVONE · Verona · 21/11/2025 ore 12:45 · 1 coperto · Doc. N. 2088 · totale € 21,40 · PA',
  nd5: 'OSTERIA DA RINO · Verona · 21/11/2025 ore 13:30 · coperti 2 (Cinti + agente Scala) · Doc. N. 2095 · totale € 69,00 · PA',
  nd6: 'TRENITALIA S.p.A. · biglietto FRECCIAROSA 9827 · ven 21/11/2025 · Verona → Torino · classe Standard · totale € 38,80 · PA',

  /* --- gianni · Gianni Pession (24-25 novembre; gg3 senza documento) --- */
  gg1: 'TRENITALIA S.p.A. · biglietto FRECCIAROSA 9930 · lun 24/11/2025 · Torino → Firenze S.M.N. · classe Standard · totale € 33,50 · PA',
  gg2: 'HOTEL FIORE *** · Firenze · 24-25/11/2025 · 1 notte camera doppia uso singola · TOTALE € 96,00 · documento n. 5512',
  gg4: 'ALL’ANTICO VINATTIERE · Firenze · 25/11/2025 ore 13:15 · 1 coperto · Doc. N. 0212 · totale € 17,50 · PA',
  gg5: 'TRENITALIA S.p.A. · biglietto FRECCIAROSA 9945 · mar 25/11/2025 · Firenze S.M.N. → Torino · classe Standard · totale € 33,50 · PA',
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RICEVUTE };
}
