// Web 0.9.8: Guida ai difetti di rettifica (offline). Pure data: cause probabili e rimedi, in ordine «prova prima».
// k = testo breve che finisce nella nota del Quaderno macchina quando il rimedio è spuntato.
(function (g) {
  const DIFETTI = [
    { id: 'vibrazioni', icon: '〰️', title: 'Vibrazioni',
      vede: 'Righe dritte e regolari lungo il pezzo, superficie «a buccia», rumore o fischio durante la passata.',
      cause: [
        'Mola da ravvivare: impastata o con il taglio chiuso',
        'Mola non equilibrata (appena montata o dopo molte diamantature)',
        'Pezzo poco sostenuto: punte usurate o sporche, contropunta poco serrata, manca la lunetta su pezzi lunghi e sottili',
        'Diamante consumato: la mola esce male dalla diamantatura',
        'Avanzamento o giri pezzo troppo alti',
        'Vibrazioni dalla macchina: mandrino, cinghie, macchina vicina'],
      rimedi: [
        { t: 'Diamanta la mola; se il diamante è piatto giralo o cambialo', k: 'diamantata la mola' },
        { t: 'Equilibra la mola', k: 'equilibrata la mola' },
        { t: 'Pulisci punte e centri del pezzo, controlla la contropunta; metti la lunetta sui pezzi lunghi', k: 'pulite punte/centri, lunetta' },
        { t: 'Cambia i giri pezzo (anche pochi giri rompono la risonanza)', k: 'cambiati giri pezzo' },
        { t: 'Riduci l\'avanzamento in finitura', k: 'ridotto avanzamento' },
        { t: 'Se resta su tutti i pezzi: avvisa la manutenzione', k: 'avvisata manutenzione' }] },
    { id: 'bruciature', icon: '🔥', title: 'Bruciature',
      vede: 'Zone scure o colorate (giallo, marrone, blu) sulla superficie; a volte piccole cricche.',
      cause: [
        'Refrigerante poco o non nel punto di contatto: ugello spostato o sporco',
        'Mola ottusa o impastata (da ravvivare) o troppo dura per il lavoro',
        'Passata troppo profonda o avanzamento troppo forte',
        'Giri pezzo troppo bassi: la mola resta troppo sullo stesso punto',
        'Emulsione poco concentrata o sporca'],
      rimedi: [
        { t: 'Punta l\'ugello sul contatto mola–pezzo, pulisci il filtro, controlla la portata', k: 'sistemato ugello refrigerante' },
        { t: 'Diamanta la mola (diamantatura più aperta = mola più tagliente)', k: 'diamantata la mola' },
        { t: 'Riduci l\'avanzamento: più passate leggere', k: 'ridotto avanzamento' },
        { t: 'Aumenta i giri pezzo', k: 'aumentati giri pezzo' },
        { t: 'Controlla la concentrazione dell\'emulsione (rifrattometro)', k: 'controllata emulsione' },
        { t: 'Pezzo bruciato: mettilo da parte e segnalalo (può avere cricche)', k: 'pezzo bruciato segnalato' }] },
    { id: 'conicita', icon: '📐', title: 'Conicità',
      vede: 'Il diametro davanti è diverso da quello in fondo.',
      cause: [
        'Tavola non allineata: regolazione conicità da correggere',
        'Punte usurate o sporche, contropunta troppo o poco serrata',
        'Mola consumata in modo non uniforme o diamantatura storta',
        'Corsa sbagliata: la mola non esce abbastanza alle estremità',
        'Il pezzo si scalda durante la rettifica e si dilata'],
      rimedi: [
        { t: 'Misura davanti e in fondo, poi correggi con la manopola della conicità poco alla volta', k: 'corretta conicità con manopola' },
        { t: 'Pulisci le punte e controlla la pressione della contropunta', k: 'pulite punte, contropunta' },
        { t: 'Diamanta di nuovo la mola', k: 'diamantata la mola' },
        { t: 'Regola la corsa: la mola esce ai lati di circa 1/3 della sua larghezza', k: 'regolata corsa' },
        { t: 'Refrigerante abbondante; misura il pezzo freddo', k: 'misurato a pezzo freddo' }] },
    { id: 'ovalita', icon: '⭕', title: 'Ovalità',
      vede: 'Girando il pezzo sotto il micrometro il diametro cambia.',
      cause: [
        'Centri del pezzo rovinati o sporchi, punte usurate',
        'Pezzo lungo o sottile che si flette: manca la lunetta o è regolata male',
        'Pezzo già ovale prima e sovrametallo troppo poco',
        'Serraggio o trascinatore che deforma il pezzo (pareti sottili)',
        'Gioco nella testa porta pezzo o nel mandrino'],
      rimedi: [
        { t: 'Pulisci centri e punte; se i centri sono rovinati falli ripassare', k: 'puliti centri e punte' },
        { t: 'Metti o regola la lunetta', k: 'regolata lunetta' },
        { t: 'Fai più giri a vuoto (spark-out) in finitura', k: 'più giri a vuoto' },
        { t: 'Stringi meno i pezzi a parete sottile', k: 'ridotto serraggio' },
        { t: 'Se succede su tutti i pezzi: avvisa la manutenzione', k: 'avvisata manutenzione' }] },
    { id: 'spirale', icon: '🌀', title: 'Segni a spirale',
      vede: 'Un\'elica regolare lungo il pezzo, come una filettatura leggera.',
      cause: [
        'Diamantatura troppo veloce: il diamante lascia un «filetto» sulla mola',
        'Spigoli della mola vivi dopo la diamantatura',
        'Velocità tavola troppo alta rispetto alla larghezza della mola',
        'Mola non parallela al pezzo',
        'Mola consumata in modo irregolare'],
      rimedi: [
        { t: 'Diamanta più lento, ultima passata senza incremento', k: 'diamantatura più lenta' },
        { t: 'Smussa leggermente gli spigoli della mola', k: 'smussati spigoli mola' },
        { t: 'Riduci la velocità tavola in finitura', k: 'ridotta velocità tavola' },
        { t: 'Fai controllare l\'allineamento della mola', k: 'controllato allineamento' }] },
    { id: 'finitura', icon: '✨', title: 'Finitura scarsa',
      vede: 'Ra troppo alto, superficie opaca o con righe sottili.',
      cause: [
        'Mola da diamantare, o diamantatura troppo aggressiva (mola troppo aperta)',
        'Refrigerante sporco: trucioli e abrasivo che girano e rigano',
        'Avanzamento o velocità tavola alti in finitura, pochi giri a vuoto',
        'Giri pezzo troppo alti',
        'Grana della mola troppo grossa per la rugosità richiesta'],
      rimedi: [
        { t: 'Diamanta con una passata finale fine e lenta', k: 'diamantatura fine' },
        { t: 'Più giri a vuoto alla fine (2–3)', k: 'più giri a vuoto' },
        { t: 'Pulisci il filtro o cambia il refrigerante', k: 'pulito refrigerante' },
        { t: 'Riduci avanzamenti e velocità tavola in finitura', k: 'ridotti avanzamenti' },
        { t: 'Serve una grana più fine: chiedi al responsabile', k: 'chiesta mola più fine' }] },
  ];
  g.DIFETTI = DIFETTI;
  if (typeof module !== 'undefined' && module.exports) module.exports = { DIFETTI };
})(typeof window !== 'undefined' ? window : globalThis);
