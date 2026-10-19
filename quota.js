/**
 * Rettifica Beta 0.9.2 – «Controllo quota» (pure helpers, no DOM, no pairing math):
 *  • ISO 286 limits: IT grades IT4–IT12 and the fundamental deviations d e f g h js k m n p / D E F G H JS K M N P by size range
 *  • quote (outer diameter / bore / position-length): limits from «nominale ± tol», «sup./inf.» or an ISO code
 *  • quick entry (last digits), evaluation DENTRO/FUORI (exactly on a limit = inside), margins, deviation from the centre,
 *    correction to the centre (µm, tocchi from the machine calibration for diameters, µm only for positions), «recuperabile»
 *  • controllo = list of quote + job fields (codice, rev, lavorazione, lotto); template of the drawing A-A «Riservato Lotto»
 * Works in the browser (window.Quota) and in node (module.exports). All lengths in mm, all deviations / margins in µm.
 */
(function (root) {
  'use strict';
  const MAX_QUOTE = 8;
  const NEAR_FRAC = 0.2; // «vicino al limite»: margin to a limit ≤ 20 % of the half-band
  const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100, r5 = (x) => Math.round(x * 1e5) / 1e5;
  const numOf = (v) => { if (v == null || v === '') return null; const t = String(v).trim().replace(/\s+/g, '').replace('−', '-').replace(',', '.'); if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null; const x = Number(t); return Number.isFinite(x) ? x : null; };
  const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n || 60);
  const strNL = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f]+/g, ' ').trim().slice(0, n || 300);
  const fmtN = (x, d) => (x == null || !Number.isFinite(Number(x)) ? '' : Number(x).toFixed(d).replace('.', ','));
  const fmtUm = (x) => { const v = r1(Math.abs(x)); return String(v).replace('.', ','); };
  const sg = (x) => { const v = r1(x); return (v > 0 ? '+' : v < 0 ? '−' : '±') + String(Math.abs(v)).replace('.', ','); };

  /* ───────── ISO 286-1 ───────── */
  // size ranges: over … up to and including (mm)
  const RANGE_UP = [3, 6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500];
  // standard tolerance grades IT (µm) per size range
  const IT = {
    4: [3, 4, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20],
    5: [4, 5, 6, 8, 9, 11, 13, 15, 18, 20, 23, 25, 27],
    6: [6, 8, 9, 11, 13, 16, 19, 22, 25, 29, 32, 36, 40],
    7: [10, 12, 15, 18, 21, 25, 30, 35, 40, 46, 52, 57, 63],
    8: [14, 18, 22, 27, 33, 39, 46, 54, 63, 72, 81, 89, 97],
    9: [25, 30, 36, 43, 52, 62, 74, 87, 100, 115, 130, 140, 155],
    10: [40, 48, 58, 70, 84, 100, 120, 140, 160, 185, 210, 230, 250],
    11: [60, 75, 90, 110, 130, 160, 190, 220, 250, 290, 320, 360, 400],
    12: [100, 120, 150, 180, 210, 250, 300, 350, 400, 460, 520, 570, 630],
  };
  // fundamental deviations of the SHAFTS (µm): d e f g = upper deviation es (negative); k m n p = lower deviation ei (positive)
  const FD = {
    d: [-20, -30, -40, -50, -65, -80, -100, -120, -145, -170, -190, -210, -230],
    e: [-14, -20, -25, -32, -40, -50, -60, -72, -85, -100, -110, -125, -135],
    f: [-6, -10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68],
    g: [-2, -4, -5, -6, -7, -9, -10, -12, -14, -15, -17, -18, -20],
    k: [0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5],
    m: [2, 4, 6, 7, 8, 9, 11, 13, 15, 17, 20, 21, 23],
    n: [4, 8, 10, 12, 15, 17, 20, 23, 27, 31, 34, 37, 40],
    p: [6, 12, 15, 18, 22, 26, 32, 37, 43, 50, 56, 62, 68],
  };
  const LETTERS = ['d', 'e', 'f', 'g', 'h', 'js', 'k', 'm', 'n', 'p'];
  const GRADES = [4, 5, 6, 7, 8, 9, 10, 11, 12];
  function rangeIndex(nom) { if (!(nom > 0) || nom > 500) return -1; for (let i = 0; i < RANGE_UP.length; i++) if (nom <= RANGE_UP[i] + 1e-9) return i; return -1; }
  /** IT grade (µm) for a nominal size, or null */
  function itGrade(nom, grade) { const i = rangeIndex(Number(nom)); const t = IT[grade]; return i < 0 || !t ? null : t[i]; }
  /** «h6» / «H7» / «JS6» / «Ø42 h6» → {letter, grade, hole} | null. Lower case = shaft (albero, esterno), UPPER case = hole (foro). */
  function isoParse(code) {
    const t = String(code == null ? '' : code).replace(/^[Øø⌀\s]*\d+([.,]\d+)?\s*/, '').replace(/\s+/g, '');
    const m = /^([A-Za-z]{1,2})(\d{1,2})$/.exec(t); if (!m) return null;
    let L = m[1]; const hole = L === L.toUpperCase(); const lc = L.toLowerCase();
    if (!(LETTERS.indexOf(lc) >= 0)) return { error: 'lettera «' + L + '» non supportata (ci sono d e f g h js k m n p, e le maiuscole per i fori)' };
    const grade = Number(m[2]); if (GRADES.indexOf(grade) < 0) return { error: 'grado IT' + grade + ' non supportato (IT4–IT12)' };
    if (L.length === 2 && lc !== 'js') return { error: 'codice ISO non valido' };
    return { letter: lc, grade, hole, code: (hole ? lc.toUpperCase() : lc) + grade };
  }
  /**
   * ISO 286 deviations for a nominal size (mm) and a code. µm: es/ei for a shaft, ES/EI for a hole (returned as hi/lo in µm).
   * @returns {{ok:boolean, error?:string, kind:'albero'|'foro', code:string, it:number, esUm:number, eiUm:number, lo:number, hi:number}}
   */
  function isoLimits(nom, code) {
    const n = numOf(nom); if (n == null || !(n > 0)) return { ok: false, error: 'nominale non valido' };
    const i = rangeIndex(n); if (i < 0) return { ok: false, error: 'ISO 286: nominale fino a 500 mm' };
    const p = isoParse(code); if (!p) return { ok: false, error: 'codice ISO non valido (es. h6, H7, g6, js6)' }; if (p.error) return { ok: false, error: p.error };
    const it = IT[p.grade][i], L = p.letter, g = p.grade;
    let es, ei;
    const kEi = (g >= 4 && g <= 7) ? FD.k[i] : 0; // shaft k: deviation only for IT4–IT7, else 0 (shafts only)
    const delta = () => it - (IT[g - 1] ? IT[g - 1][i] : it); // Δ = IT(n) − IT(n−1)
    const dl = () => (i === 0 ? 0 : delta()); // Beta 0.9.3: no Δ for nominal ≤ 3 mm
    if (!p.hole) {
      if (L === 'h') { es = 0; ei = -it; }
      else if (L === 'js') { es = it / 2; ei = -it / 2; }
      else if (L === 'k') { ei = kEi; es = ei + it; }
      else if (L === 'm' || L === 'n' || L === 'p') { ei = FD[L][i]; es = ei + it; }
      else { es = FD[L][i]; ei = es - it; } // d e f g
    } else {
      if (L === 'h') { es = it; ei = 0; }
      else if (L === 'js') { es = it / 2; ei = -it / 2; }
      else if (L === 'd' || L === 'e' || L === 'f' || L === 'g') { ei = -FD[L][i]; es = ei + it; }
      // Beta 0.9.3 (ISO 286-1 tab. 3): K/M/N up to IT8 and P up to IT7 get «+Δ», but NOT for nominal ≤ 3 mm (there Δ = 0).
      // K uses the shaft k value (FD.k) for IT ≤ 8 (0.9.2 wrongly dropped it at IT8). N ≤ 3 mm = −4 µm (FD.n[0]).
      else if (L === 'k') { es = g <= 8 ? -FD.k[i] + dl() : 0; ei = es - it; }
      else if (L === 'm' || L === 'n') {
        if (g > 8) return { ok: false, error: p.code.replace(/^./, (c) => c.toUpperCase()) + ' non supportato (solo IT4–IT8)' };
        es = -FD[L][i] + dl(); ei = es - it;
      } else { // P
        es = -FD.p[i] + (g <= 7 ? dl() : 0); ei = es - it;
      }
    }
    es = r2(es); ei = r2(ei);
    return { ok: true, kind: p.hole ? 'foro' : 'albero', code: p.code, it, esUm: es, eiUm: ei, lo: r5(n + ei / 1000), hi: r5(n + es / 1000) };
  }

  /* ───────── quote ───────── */
  const TIPI = { esterno: 'Diametro esterno', foro: 'Foro', posizione: 'Posizione / lunghezza' };
  function tipoOf(v) {
    const t = String(v == null ? '' : v).toLowerCase();
    if (/^(foro|interno|bore|hole)/.test(t)) return 'foro';
    if (/^(pos|lung|quota di pos|length)/.test(t)) return 'posizione';
    return 'esterno';
  }
  function fmtNom(n) { let s = String(Math.round(n * 1000) / 1000).replace('.', ','); return s; }
  function autoName(q) {
    const diam = q.tipo !== 'posizione' ? 'Ø' : '';
    if (q.mode === 'iso') return diam + fmtNom(q.nom) + ' ' + q.iso;
    if (q.mode === 'gen') return diam + fmtNom(q.nom) + ' (ISO 2768-' + q.gen + ' ±' + String(q.tol).replace('.', ',') + ')';
    if (q.mode === 'sim') return diam + fmtNom(q.nom) + ' ± ' + String(q.tol).replace('.', ',');
    if (q.mode === 'asim') { const f = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + String(Math.abs(x)).replace('.', ','); return diam + fmtNom(q.nom) + ' ' + (q.up === 0 ? '0' : f(q.up)) + '/' + (q.low === 0 ? '0' : f(q.low)); }
    return diam + fmtNom(q.nom);
  }
  /**
   * Normalise a quota definition. raw: {nome, tipo, mode:'iso'|'sim'|'asim', nom, iso | tol | up, low, note}.
   * @returns {{ok:boolean, error?:string, q?:object}}
   */
  function normalizeQuota(raw, opts) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'quota non valida' };
    const nom = numOf(raw.nom); if (nom == null || nom <= 0 || nom > 5000) return { ok: false, error: 'nominale non valido (mm)' };
    const tipo = tipoOf(raw.tipo);
    let mode = raw.mode === 'iso' || raw.mode === 'asim' || raw.mode === 'sim' || raw.mode === 'gen' ? raw.mode : (raw.iso ? 'iso' : (raw.up != null || raw.low != null) ? 'asim' : raw.gen ? 'gen' : 'sim');
    const q = { id: str(raw.id, 24) || 'q_' + Math.random().toString(36).slice(2, 8), nome: '', tipo, mode, nom, note: strNL(raw.note, 200) };
    let lo, hi;
    if (mode === 'iso') {
      const r = isoLimits(nom, raw.iso); if (!r.ok) return { ok: false, error: r.error };
      q.iso = r.code; lo = r.lo; hi = r.hi;
      if (tipo === 'esterno' && r.kind === 'foro') q.warn = 'Codice da foro (maiuscolo) su una quota esterna: controlla';
      if (tipo === 'foro' && r.kind === 'albero') q.warn = 'Codice da albero (minuscolo) su un foro: controlla';
    } else if (mode === 'asim') {
      const up = numOf(raw.up), low = numOf(raw.low); if (up == null || low == null) return { ok: false, error: 'scrivi scostamento superiore e inferiore (mm)' };
      if (!(up > low)) return { ok: false, error: 'lo scostamento superiore deve essere maggiore dell\'inferiore' };
      q.up = up; q.low = low; lo = r5(nom + low); hi = r5(nom + up);
    } else if (mode === 'gen') {
      const g = genTol(nom, raw.gen); if (!g.ok) return { ok: false, error: g.error };
      q.gen = g.cls; q.tol = g.tol; lo = r5(nom - g.tol); hi = r5(nom + g.tol);
    } else {
      let tol = numOf(raw.tol); if (tol == null || tol <= 0) return { ok: false, error: 'tolleranza non valida (± mm, maggiore di 0)' };
      tol = Math.abs(tol); q.tol = tol; lo = r5(nom - tol); hi = r5(nom + tol); q.mode = 'sim';
    }
    if (!(hi > lo)) return { ok: false, error: 'limiti non validi' };
    if (hi - lo > 5) return { ok: false, error: 'tolleranza troppo larga (oltre 5 mm)' };
    q.lo = lo; q.hi = hi; q.centro = r5((lo + hi) / 2);
    q.nome = str(raw.nome, 40) || autoName(q);
    // Beta 0.9.3: geometric tolerance frame (µm) – circolarità / cilindricità from the drawing (only for diameters)
    if (tipo !== 'posizione') { const gc = geoUm(raw.circ), gy = geoUm(raw.cyl); if (gc != null) q.circ = gc; if (gy != null) q.cyl = gy; }
    if (raw.lo != null && raw.hi != null && opts && opts.warn) {
      const a = numOf(raw.lo), b = numOf(raw.hi); if (a != null && b != null && (Math.abs(a - lo) > 0.00051 || Math.abs(b - hi) > 0.00051)) opts.warn('«' + q.nome + '»: i limiti del file non corrispondono alla definizione, uso quelli calcolati (' + fmtN(lo, 3) + '–' + fmtN(hi, 3) + ')');
    }
    return { ok: true, q };
  }
  function quotaLimits(q) {
    if (!q) return null; const lo = numOf(q.lo), hi = numOf(q.hi); if (lo == null || hi == null || !(hi > lo)) return null;
    return { lo, hi, centro: r5((lo + hi) / 2), halfUm: r2((hi - lo) * 500) };
  }
  /** «Ø42 h6 · 41,984–42,000 · centro 41,992» */
  function quotaText(q) { const l = quotaLimits(q); return l ? fmtN(l.lo, 3) + '–' + fmtN(l.hi, 3) + ' · centro ' + fmtN(l.centro, 3) : ''; }

  /* ───────── quick entry ───────── */
  /**
   * The typed text → full value in mm. With a comma/dot: the number as typed. Without: the last digits, the integer part
   * is the one that brings the value closest to the centre of the quota («9915» on Ø42 h6 = 41,9915; «0005» = 42,0005).
   * Digits typed without comma need at least 3 digits (µm) before the value counts; with a comma any number counts.
   */
  function parseMeasure(buf, q) {
    const t = String(buf == null ? '' : buf).trim().replace(/\s+/g, '');
    if (!t) return null;
    if (/[.,]/.test(t)) { if (!/^\d*[.,]\d*$/.test(t) || t === ',' || t === '.') return null; const v = Number(t.replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null; }
    if (!/^\d+$/.test(t)) return null;
    const l = quotaLimits(q); if (!l) return null;
    const ctr = l.centro, I0 = Math.floor(ctr);
    const cands = [I0 - 1, I0, I0 + 1, I0 + 2].filter((i) => i >= 0).sort((a, b) => Math.abs(a + 0.5 - ctr) - Math.abs(b + 0.5 - ctr));
    if (t.length > 4) { // «419915»: the integer part typed in full
      for (const I of [I0, I0 - 1, I0 + 1].filter((i) => i > 0)) { const s = String(I); if (t.startsWith(s) && t.length - s.length >= 3) return Number(s + '.' + t.slice(s.length)); }
    }
    if (t.length < 3) return null;
    const dec = Number('0.' + t.slice(0, 5));
    let best = null; cands.forEach((I) => { const v = I + dec; if (best == null || Math.abs(v - ctr) < Math.abs(best - ctr) - 1e-12) best = v; });
    return best == null ? null : r5(best);
  }
  /** full value for the preview: at least 3 decimals, as many as typed up to 5 */
  function fmtMeasure(v, buf) {
    if (v == null) return '';
    const b = String(buf || ''); const m = /[.,](\d*)$/.exec(b); const typed = m ? m[1].length : (/^\d+$/.test(b) ? Math.min(5, b.length) : 3);
    return fmtN(v, Math.max(3, Math.min(5, typed)));
  }

  /* ───────── evaluation ───────── */
  function tocchiFor(um, cal) { const c = cal || {}, per = (Number(c.umPerTocco) > 0 ? Number(c.umPerTocco) : 1) * (c.scala === 'raggio' ? 2 : 1); const v = Math.abs(Number(um) || 0) / per; return v < 1e-9 ? 0 : Math.max(1, Math.ceil(v - 0.5 - 1e-9)); }
  const tocchiTxt = (n) => n + (n === 1 ? ' tocco' : ' tocchi');
  /**
   * Evaluate one measure against a quota. cal = machine calibration {outer:'stringe'|'allarga', bore:…, umPerTocco, scala, stato}.
   * state: 'dentro' (also exactly ON a limit) | 'fuori'. near: inside but within 20 % of the half-band of a limit.
   */
  function evalQuota(q, value, cal) {
    const l = quotaLimits(q); const v = numOf(value); if (!l || v == null) return null;
    const c = Object.assign({ outer: 'stringe', bore: 'stringe', umPerTocco: 1, scala: 'diametro', stato: 'da_verificare', modo: 'tocchi' }, cal || {});
    const vm = c.modo === 'valore';
    const dev = r2((v - l.centro) * 1000), mLo = r2((v - l.lo) * 1000), mHi = r2((l.hi - v) * 1000);
    const dentro = mLo >= 0 && mHi >= 0;
    const near = dentro && Math.min(mLo, mHi) <= l.halfUm * NEAR_FRAC + 1e-9;
    const side = dentro ? null : (mLo < 0 ? 'sotto' : 'sopra');
    const outByUm = dentro ? 0 : r1(Math.abs(mLo < 0 ? mLo : mHi));
    const need = r1((l.centro - v) * 1000); // + = the measure must grow
    const out = { q, value: v, lo: l.lo, hi: l.hi, centro: l.centro, halfUm: l.halfUm, devUm: r1(dev), marginLoUm: r1(mLo), marginHiUm: r1(mHi), state: dentro ? 'dentro' : 'fuori', near, side, outByUm, needUm: need,
      tipo: q.tipo, verify: c.stato !== 'verificata', corr: { kind: 'nessuna', um: 0, key: '', presses: 0, words: '', short: '', recoverable: true, next: null } };
    const cr = out.corr, an = Math.abs(need);
    const diam = q.tipo === 'esterno' || q.tipo === 'foro';
    if (!diam) { // position / length: only the shift in µm, never presses
      if (!dentro || near) {
        if (an < 0.05) { cr.kind = 'centro'; cr.words = 'già al centro'; }
        else { cr.kind = 'sposta'; cr.um = an; cr.dir = need > 0 ? 'su' : 'giu'; cr.words = 'Quota di posizione: sposta di ' + sg(need) + ' µm (la quota deve ' + (need > 0 ? 'aumentare' : 'diminuire') + ') per arrivare al centro ' + fmtN(l.centro, 3); cr.short = 'sposta ' + sg(need) + ' µm'; }
      } else { cr.words = 'Non serve correggere'; }
      return out;
    }
    const bore = q.tipo === 'foro';
    const effectNeeded = (grow) => (bore ? (grow ? 'allarga' : 'stringe') : (grow ? 'allarga' : 'stringe')); // diameter grows / shrinks
    const keyFor = (grow) => { const plus = bore ? c.bore : c.outer; const eff = grow ? 'allarga' : 'stringe'; return plus === eff ? '+' : '−'; };
    const lastWords = (grow, um) => { const n = tocchiFor(um, c), k = keyFor(grow), val = vm ? valoreTxt(um, k, c) : '';
      return { key: k, presses: n, val, txt: (grow ? 'allarga' : 'stringi') + ' di ' + fmtUm(um) + ' µm sul Ø → ' + (vm ? 'inserisci ' + val : k + ' ×' + n + ' ' + (n === 1 ? 'tocco' : 'tocchi')) }; };
    const relevant = !dentro || near;
    // can we still act on THIS piece? grinding only removes material: an outer diameter can only shrink, a bore can only grow
    const canNow = bore ? (need > 0) : (need < 0);
    const grow = need > 0; // the diameter would need to grow (to reach the centre)
    if (!dentro && ((!bore && side === 'sotto') || (bore && side === 'sopra'))) {
      cr.kind = 'non_recuperabile'; cr.recoverable = false;
      cr.words = 'Non recuperabile: ' + (bore ? 'foro troppo grande di ' : 'diametro troppo piccolo di ') + fmtUm(outByUm) + ' µm ' + (bore ? 'sopra il massimo' : 'sotto il minimo') + ' (' + (bore ? 'rettificando il foro cresce' : 'togliendo materiale il diametro non cresce') + ')';
      cr.short = 'non recuperabile';
      const nx = lastWords(grow, an); cr.next = { um: an, key: nx.key, presses: nx.presses, val: nx.val, words: 'Per i prossimi pezzi: ' + nx.txt };
      return out;
    }
    if (!relevant) { cr.words = 'Non serve correggere'; return out; }
    if (an < 0.5) { cr.kind = 'centro'; cr.words = 'già al centro: non togliere altro'; return out; }
    if (canNow) {
      const w = lastWords(!bore ? false : true, an); // outer: stringi (shrink) · bore: allarga (grow)
      cr.kind = 'ora'; cr.um = an; cr.key = w.key; cr.presses = w.presses; cr.val = w.val;
      cr.words = (bore ? 'Allarga il foro di ' : 'Stringi il diametro di ') + fmtUm(an) + ' µm sul Ø (' + fmtUm(an / 2) + ' µm per lato) → ' + (vm ? 'Inserisci ' + w.val + ' mm' + (c.scala === 'raggio' ? ' (sul raggio)' : '') : w.key + ' ×' + w.presses + ' ' + (w.presses === 1 ? 'tocco' : 'tocchi'));
      cr.short = vm ? 'Inserisci ' + w.val : w.key + ' ×' + w.presses;
    } else {
      // inside, but on the «wrong» side of the centre: material cannot be added back
      const nx = lastWords(grow, an);
      cr.kind = 'sotto_centro'; cr.um = an; cr.key = nx.key; cr.presses = nx.presses; cr.val = nx.val;
      cr.words = (bore ? 'Foro ' + fmtUm(an) + ' µm sopra il centro: non togliere altro (non si può restringere)' : 'Diametro ' + fmtUm(an) + ' µm sotto il centro: non togliere altro (non si può aggiungere materiale)');
      cr.short = 'non togliere altro';
      cr.next = { um: an, key: nx.key, presses: nx.presses, val: nx.val, words: 'Per i prossimi pezzi: ' + nx.txt };
    }
    return out;
  }

  /** all quotas of a controllo vs the measures {quotaId: valueMm}. */
  function evalControllo(c, vals, cal) {
    const items = ((c && c.quote) || []).map((q) => { const v = vals && vals[q.id]; return { q, ev: v == null ? null : evalQuota(q, v, cal) }; });
    const meas = items.filter((i) => i.ev), fuori = meas.filter((i) => i.ev.state === 'fuori'), dentro = meas.length - fuori.length;
    const total = items.length, mancanti = total - meas.length;
    const overall = !total || !meas.length ? 'vuoto' : fuori.length ? 'fuori' : 'dentro';
    return { items, total, measured: meas.length, dentro, fuori: fuori.length, mancanti, parziale: mancanti > 0 && meas.length > 0, overall, near: meas.some((i) => i.ev.near && i.ev.state === 'dentro') };
  }

  /* ───────── controllo (job type) ───────── */
  function normalizeControllo(raw, warn) {
    const w = typeof warn === 'function' ? warn : () => {};
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'controllo non valido' };
    const arr = Array.isArray(raw.quote) ? raw.quote : [];
    if (!arr.length) return { ok: false, error: 'nessuna quota' };
    const quote = []; const errs = [];
    arr.slice(0, MAX_QUOTE).forEach((x, i) => { const r = normalizeQuota(x, { warn: w }); if (r.ok) { if (r.q.warn) w('«' + r.q.nome + '»: ' + r.q.warn); quote.push(r.q); } else errs.push('quota ' + (i + 1) + ': ' + r.error); });
    if (arr.length > MAX_QUOTE) w('Massimo ' + MAX_QUOTE + ' quote: le altre sono state tolte');
    if (errs.length) return { ok: false, error: errs.join('; ') };
    const ids = new Set(); quote.forEach((q) => { if (ids.has(q.id)) q.id = 'q_' + Math.random().toString(36).slice(2, 8); ids.add(q.id); });
    return { ok: true, c: { id: str(raw.id, 24) || 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nome: str(raw.nome, 60) || 'Controllo quota', codice: str(raw.codice, 40), rev: str(raw.rev, 12),
      lav: str(raw.lav != null ? raw.lav : raw.lavorazione, 40), lotto: str(raw.lotto, 40), note: strNL(raw.note, 600), forma: raw.forma === true || raw.ovalita === true || /^(si|sì|true|1)$/i.test(String(raw.ovalita == null ? '' : raw.ovalita)), quote } };
  }
  /** pkg form (controlli[] entry) */
  function controlloToPkg(c) {
    return { nome: c.nome, codice: c.codice || '', rev: c.rev || '', lavorazione: c.lav || '', note: c.note || '', ovalita: !!c.forma,
      quote: (c.quote || []).map((q) => { const o = { nome: q.nome, tipo: q.tipo, mode: q.mode, nom: q.nom, lo: q.lo, hi: q.hi, note: q.note || '' }; if (q.mode === 'iso') o.iso = q.iso; else if (q.mode === 'asim') { o.up = q.up; o.low = q.low; } else if (q.mode === 'gen') o.gen = q.gen; else o.tol = q.tol; if (q.circ != null) o.circ = q.circ; if (q.cyl != null) o.cyl = q.cyl; return o; }) };
  }
  /** Template of the drawing section A-A «Riservato Lotto»: Ø42 h6 (outer, ground on the Studer) + 29,5 ± 0,02 (distance C face → lateral Ø5 hole). */
  function templateAA() {
    return normalizeControllo({ id: 'c_tpl_aa', nome: 'Disegno sez. A-A – Riservato Lotto', codice: '', rev: '', lav: '', note: 'Ø42 h6: diametro esterno, rettificato sulla Studer. 29,5 ± 0,02: distanza dalla faccia di riferimento C al foro laterale Ø5 (correzione = spostamento di posizione). Non servono: foro Ø20 H6, concentricità, parallelismo, simmetria.', forma: false,
      quote: [{ id: 'q_d42', nome: 'Ø42 h6', tipo: 'esterno', mode: 'iso', nom: 42, iso: 'h6' }, { id: 'q_p295', nome: '29,5 ± 0,02', tipo: 'posizione', mode: 'sim', nom: 29.5, tol: 0.02, note: 'da faccia C al foro laterale Ø5' }] }).c;
  }
  /** what changes when a controllo is updated: [{label, from, to}] */
  function diffControllo(c, pc) {
    const d = [], add = (label, a, b) => { if (String(a == null ? '' : a) !== String(b == null ? '' : b)) d.push({ label, from: a == null || a === '' ? '—' : a, to: b == null || b === '' ? '—' : b }); };
    add('Nome', c.nome, pc.nome); add('Codice', c.codice, pc.codice); add('Revisione', c.rev, pc.rev); add('Lavorazione', c.lav, pc.lav);
    add('Ovalità/conicità', c.forma ? 'sì' : 'no', pc.forma ? 'sì' : 'no');
    const a = (c.quote || []).map((q) => q.nome + ' ' + quotaText(q)).join(' | '), b = (pc.quote || []).map((q) => q.nome + ' ' + quotaText(q)).join(' | ');
    add('Quote', a, b);
    return d;
  }
  function findControllo(list, pc) {
    const L = list || [], eq = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    if (pc.codice) { const c = L.find((x) => eq(x.codice, pc.codice)); return c ? { c, how: 'codice' } : null; }
    if (pc.nome) { const c = L.find((x) => eq(x.nome, pc.nome)); return c ? { c, how: 'nome' } : null; }
    return null;
  }
  /** write a normalised package controllo onto an existing/new controllo; measures (state.quotaPezzi) are never touched */
  function applyControllo(c, pc, o) {
    c.nome = pc.nome; c.codice = pc.codice; c.rev = pc.rev; c.lav = pc.lav; if (pc.note) c.note = pc.note; c.forma = !!pc.forma;
    c.quote = pc.quote.map((q) => Object.assign({}, q)); if (o && o.lotto) c.lotto = o.lotto;
    if (o && o.check) c.fromPackage = { at: o.now || new Date().toISOString(), check: o.check };
    return c;
  }

  /* ───────── records / export rows ───────── */
  /** one saved piece (all measured quotas) → record */
  function makePiece(c, vals, cal, meta) {
    const ec = evalControllo(c, vals, cal), m = meta || {};
    if (!ec.measured) return null;
    return { id: 'qp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ts: m.ts || new Date().toISOString(), controlloId: c.id, nome: c.nome, codice: c.codice || '', rev: c.rev || '', lav: c.lav || '', lotto: m.lotto != null ? m.lotto : (c.lotto || ''),
      machineName: m.machineName || '', esito: ec.overall, parziale: ec.parziale, forma: !!c.forma,
      quote: ec.items.filter((i) => i.ev).map((i) => ({ id: i.q.id, nome: i.q.nome, tipo: i.q.tipo, nom: i.q.nom, lo: i.ev.lo, hi: i.ev.hi, centro: i.ev.centro, misura: i.ev.value, devUm: i.ev.devUm, marginLoUm: i.ev.marginLoUm, marginHiUm: i.ev.marginHiUm, esito: i.ev.state, near: i.ev.near,
        corr: i.ev.corr.kind, corrUm: i.ev.corr.um || 0, key: i.ev.corr.key || '', presses: i.ev.corr.presses || 0, val: i.ev.corr.val || '' })) };
  }
  /** pieces → flat rows for the CSV/report (one row per quota) */
  function pieceRows(pezzi) {
    const out = [];
    (pezzi || []).forEach((p) => (p.quote || []).forEach((q) => out.push({ ts: p.ts, machine: p.machineName, serie: p.nome, codice: p.codice, rev: p.rev, lav: p.lav, lotto: p.lotto, base: q.nom, lavoro: 'controllo quota', S: q.misura, status: p.esito,
      qNome: q.nome, qTipo: q.tipo, qLo: q.lo, qHi: q.hi, qCentro: q.centro, qDev: q.devUm, qEsito: q.esito, pid: p.id })));
    return out;
  }
  const QCOLS = ['Controllo quota', 'Tipo quota', 'Limite min mm', 'Limite max mm', 'Centro mm', 'Scostamento dal centro µm', 'Esito quota'];
  function qCells(r) {
    const q = (x) => { const t = x == null ? '' : String(x); return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    if (r.qNome == null || r.qNome === '') return ['', '', '', '', '', '', ''];
    return [q(r.qNome), q(TIPI[r.qTipo] || r.qTipo || ''), fmtN(r.qLo, 3), fmtN(r.qHi, 3), fmtN(r.qCentro, 3), fmtN(r.qDev, 1), q(r.qEsito || '')];
  }


  /* ───────── Beta 0.9.2: streak (ultimi pezzi) + live feedback debounce ───────── */
  /** Last up to `max` (default 12) pieces for a controllo (+ same lotto). Chronological (oldest → newest). */
  function lastPieces(pezzi, controlloId, lotto, max) {
    const lim = max == null ? 12 : Math.max(0, max | 0);
    const lot = lotto == null ? '' : String(lotto);
    const id = String(controlloId == null ? '' : controlloId);
    return (pezzi || []).filter((p) => p && String(p.controlloId || '') === id && (p.lotto || '') === lot).slice(-lim);
  }
  /**
   * From chronological pieces (or raw esito strings): { states:['dentro'|'fuori',...], streakOk, n }.
   * streakOk = consecutive DENTRO from the end (resets on FUORI). Partial pieces still count by overall esito.
   */
  function streakOf(piecesOrEsiti) {
    const states = (piecesOrEsiti || []).map((p) => {
      if (p == null) return 'dentro';
      if (typeof p === 'string') return p === 'fuori' ? 'fuori' : 'dentro';
      return p.esito === 'fuori' ? 'fuori' : 'dentro';
    });
    let streakOk = 0;
    for (let i = states.length - 1; i >= 0; i--) { if (states[i] === 'dentro') streakOk++; else break; }
    return { states, streakOk, n: states.length };
  }
  /**
   * Live feedback while typing a full measure. Call only when parseMeasure succeeded.
   * prev = { spoken:'dentro'|'fuori'|null, haptic:'dentro'|'fuori'|null }.
   * Returns { next, speak?:'dentro'|'fuori', hapticMs?:number }. Speak only on state flip; haptic 80 ms once per entry into FUORI.
   */
  function liveFeedback(prev, state) {
    const p = prev && typeof prev === 'object' ? prev : {};
    const next = { spoken: p.spoken == null ? null : p.spoken, haptic: p.haptic == null ? null : p.haptic };
    const out = { next };
    if (state !== 'dentro' && state !== 'fuori') return out;
    if (state === 'fuori' && p.haptic !== 'fuori') { out.hapticMs = 80; next.haptic = 'fuori'; }
    else if (state === 'dentro') next.haptic = 'dentro';
    if (p.spoken !== state) { out.speak = state; next.spoken = state; }
    return out;
  }

  /* ───────── Beta 0.9.3 ───────── */
  /** «Valore diretto» (CNC without tocchi buttons): the signed value in mm to type. key '+'|'−' = direction from the machine rule. */
  function valoreTxt(um, key, cal) {
    const c = cal || {}, a = Math.abs(Number(um) || 0) / (c.scala === 'raggio' ? 2 : 1) / 1000;
    const r = Math.round(a * 10000) / 10000, d = Math.abs(r * 1000 - Math.round(r * 1000)) < 1e-6 ? 3 : 4;
    return (r === 0 ? '' : key === '−' || key === '-' ? '−' : '+') + r.toFixed(d);
  }
  /** µm from a geometric tolerance value: «0,003» (mm, < 1) → 3 · «3» → 3 µm. null when empty / invalid. */
  function geoUm(v) {
    if (v == null || v === '') return null; const t = String(v).trim().replace(',', '.').replace('−', '-'); const x = Number(t);
    if (!Number.isFinite(x) || x <= 0) return null; const um = /[.]/.test(t) && x < 1 ? x * 1000 : x; return um > 200 ? null : r1(um);
  }
  /** Ovality / taper limits for a quota from its frame: circolarità → ovalità, cilindricità → both (the stricter wins). null = use 2–3 µm. */
  function formLimitsOf(q) {
    if (!q || (q.circ == null && q.cyl == null)) return null;
    const ov = [q.circ, q.cyl].filter((x) => x != null), oval = Math.min.apply(null, ov), con = q.cyl != null ? q.cyl : null;
    return { oval, con, txt: 'Dal disegno: ' + (q.circ != null ? 'circolarità ' + fmtUm(q.circ) + ' µm' : '') + (q.circ != null && q.cyl != null ? ' · ' : '') + (q.cyl != null ? 'cilindricità ' + fmtUm(q.cyl) + ' µm' : '')
      + ' → ovalità entro ' + fmtUm(oval) + ' µm' + (con != null ? ', conicità entro ' + fmtUm(con) + ' µm' : ', conicità circa 2–3 µm') };
  }
  /* ISO 2768-1 general tolerances, linear dimensions (± mm). Ranges: over … up to (mm); first range from 0,5. */
  const GEN_UP = [3, 6, 30, 120, 400, 1000, 2000, 4000];
  const GEN = { f: [0.05, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, null], m: [0.1, 0.1, 0.2, 0.3, 0.5, 0.8, 1.2, 2], c: [0.2, 0.3, 0.5, 0.8, 1.2, 2, 3, 4], v: [null, 0.5, 1, 1.5, 2.5, 4, 6, 8] };
  const GEN_NAMES = { f: 'fine', m: 'media', c: 'grossolana', v: 'molto grossolana' };
  /** «m» / «ISO 2768-mK» / «2768 m» → class letter f|m|c|v (+ geometric class H|K|L) or null */
  function genParse(x) {
    const t = String(x == null ? '' : x).trim(); if (!t) return null;
    let m = /(?:ISO|UNI|EN)?\s*(?:22768|2768)(?:\s*-\s*1)?\s*[-–\s]\s*([fmcv])\s*([HKL])?\b/i.exec(t) || /^([fmcvFMCV])\s*([HKL])?$/.exec(t);
    if (!m) return null; return { cls: m[1].toLowerCase(), geo: m[2] ? m[2].toUpperCase() : '' };
  }
  function genTol(nom, cls) {
    const n = numOf(nom), p = genParse(cls); if (n == null || !(n > 0)) return { ok: false, error: 'nominale non valido' };
    if (!p) return { ok: false, error: 'classe ISO 2768 non valida (f, m, c, v)' };
    if (n < 0.5) return { ok: false, error: 'ISO 2768: sotto 0,5 mm la tolleranza va scritta sul disegno' };
    let i = GEN_UP.findIndex((u) => n <= u + 1e-9); if (i < 0) return { ok: false, error: 'ISO 2768: nominale fino a 4000 mm' };
    const t = GEN[p.cls][i]; if (t == null) return { ok: false, error: 'ISO 2768-' + p.cls + ': per questo nominale non è definita, chiedi al responsabile' };
    return { ok: true, cls: p.cls, geo: p.geo, tol: t, lo: r5(n - t), hi: r5(n + t) };
  }
  /** Fit «40 H7/g6»: hole + shaft limits and the gioco (F − S) min/max in µm. Negative = interferenza. */
  function fitParse(code) {
    const t = String(code == null ? '' : code).replace(/\s+/g, ' ').trim();
    const m = /^[Øø⌀∅]?\s*(\d+(?:[.,]\d+)?)\s*([A-Z]{1,2}\d{1,2})\s*[\/⁄-]\s*([a-z]{1,2}\d{1,2})$/.exec(t);
    return m ? { nom: numOf(m[1]), hole: m[2], shaft: m[3] } : null;
  }
  function fitLimits(nom, holeCode, shaftCode) {
    if (holeCode == null && shaftCode == null) { const p = fitParse(nom); if (!p) return { ok: false, error: 'scrivi l\'accoppiamento come 40 H7/g6' }; nom = p.nom; holeCode = p.hole; shaftCode = p.shaft; }
    const h = isoLimits(nom, holeCode), s = isoLimits(nom, shaftCode);
    if (!h.ok) return { ok: false, error: 'foro: ' + h.error }; if (!s.ok) return { ok: false, error: 'albero: ' + s.error };
    if (h.kind !== 'foro') return { ok: false, error: 'il primo codice è del foro (maiuscolo, es. H7)' };
    if (s.kind !== 'albero') return { ok: false, error: 'il secondo codice è dell\'albero (minuscolo, es. g6)' };
    const gMin = r1(h.eiUm - s.esUm), gMax = r1(h.esUm - s.eiUm);
    const tipo = gMin >= 0 ? 'gioco' : gMax <= 0 ? 'interferenza' : 'incerto';
    const sys = /^H/.test(h.code) ? 'foro base' : /^h/.test(s.code) ? 'albero base' : '';
    const words = tipo === 'gioco' ? 'Accoppiamento con gioco: ' + fmtUm(gMin) + '–' + fmtUm(gMax) + ' µm'
      : tipo === 'interferenza' ? 'Accoppiamento con INTERFERENZA: ' + fmtUm(-gMax) + '–' + fmtUm(-gMin) + ' µm (il maschio è più grande del foro)'
      : 'Accoppiamento INCERTO: da ' + fmtUm(-gMin) + ' µm di interferenza a ' + fmtUm(gMax) + ' µm di gioco';
    return { ok: true, nom: numOf(nom), hole: h, shaft: s, giocoMinUm: gMin, giocoMaxUm: gMax, tipo, sys, words, code: fmtNom(numOf(nom)) + ' ' + h.code + '/' + s.code };
  }
  /** «misura a pezzo freddo»: thermal growth ΔL = α · L · ΔT, in µm. α default 1,2·10⁻⁵ /°C (acciaio, dispensa p. 251). */
  const ALPHA = { acciaio: 12e-6, ghisa: 10.5e-6, inox: 16e-6, alluminio: 23e-6, ottone: 19e-6 };
  function thermalUm(Lmm, dT, alpha) {
    const L = numOf(Lmm), T = numOf(dT); if (L == null || T == null || !(L > 0)) return null;
    const a = typeof alpha === 'string' ? ALPHA[alpha] : (Number(alpha) > 0 ? Number(alpha) : ALPHA.acciaio); if (!(a > 0)) return null;
    return r1(a * L * T * 1000);
  }

  /* ───────── Beta 0.9.3: tolerances written on drawings (OCR text / typed) → quota definitions ───────── */
  const DN = '(\\d+(?:[.,]\\d+)?)';
  const SN = '([+\\-−]?\\s*\\d*[.,]?\\d+)';
  const nn = (x) => numOf(String(x).replace(/\s+/g, '').replace('−', '-'));
  /**
   * Parse the text of a drawing (one dimension per line, OCR or typed). Recognised forms:
   *  «Ø42 h6» · «Ø42 h6 (41,984/42,000)» · «40 H7/g6» · «29,5 ±0,02» · «42 0/−0,016» · «42 +0,000 −0,016» · «42 0» + next line «−0,016» (stacked) ·
   *  «42,000/41,984» (two limits) · «ISO 2768-mK» (general class) · «circolarità 0,003» / «○ 0,003» · «cilindricità 0,005» / «⌭ 0,005».
   *  Auxiliary dimensions in parentheses «(35)» are ignored (ISO 129: no tolerance). Plain «Ø30» gets the general class if found.
   * @returns {{items:Array<{raw:string, def?:object, fit?:object, aux?:boolean, noTol?:boolean, warn?:string}>, gen:object|null, geo:{circ?:number, cyl?:number}}}
   */
  function parseDrawingText(text) {
    const lines = String(text == null ? '' : text).replace(/\r/g, '').split('\n').map((l) => l.replace(/[\u00a0\t]+/g, ' ').replace(/[–—\u2212]/g, '−').replace(/\+\s*\/\s*[-−]|\+[-−]/g, '±').trim()).filter(Boolean);
    const out = { items: [], gen: null, geo: {} };
    lines.forEach((l) => { const g = genParse(l); if (g && !out.gen) out.gen = g; });
    const geoRe = [[/(circolarit[aà]|rotondit[aà]|^[○◯⭘]|\s[○◯⭘])\s*[:=]?\s*(\d*[.,]?\d+)/i, 'circ'], [/(cilindricit[aà]|⌭)\s*[:=]?\s*(\d*[.,]?\d+)/i, 'cyl']];
    let lastGeoTarget = null;
    for (let k = 0; k < lines.length; k++) {
      let l = lines[k];
      if (genParse(l) && !/[Øø⌀∅]/.test(l)) continue;
      let geoHit = false;
      geoRe.forEach(([re, key]) => { const m = re.exec(l); if (m) { const v = geoUm(m[2]); if (v != null) { geoHit = true; if (lastGeoTarget) lastGeoTarget[key] = v; else out.geo[key] = v; } } });
      if (geoHit) continue;
      if (/^\(\s*[Øø⌀∅]?\s*\d+(?:[.,]\d+)?\s*\)$/.test(l)) { out.items.push({ raw: l, aux: true }); continue; }
      // a «(41,984/42,000)» after an ISO code is a check, not an auxiliary dimension
      let chk = null; const pm = /\(\s*(\d+[.,]\d+)\s*[\/÷\s]\s*(\d+[.,]\d+)\s*\)\s*$/.exec(l);
      if (pm) { chk = [nn(pm[1]), nn(pm[2])].sort((a, b) => a - b); l = l.slice(0, pm.index).trim(); }
      else l = l.replace(/\(\s*[Øø⌀∅]?\s*\d+(?:[.,]\d+)?\s*\)/g, ' ').replace(/\s+/g, ' ').trim();
      const diam = /^[Øø⌀∅]|^diam/i.test(l) || /\s[Øø⌀∅]\s*\d/.test(l);
      const body = l.replace(/^.*?(?=[Øø⌀∅]?\s*\d)/, '').replace(/^[Øø⌀∅]\s*/, '');
      let m;
      if ((m = new RegExp('^' + DN + '\\s*([A-Z]{1,2}\\d{1,2})\\s*[/⁄]\\s*([a-z]{1,2}\\d{1,2})\\b').exec(body))) {
        const f = fitLimits(nn(m[1]), m[2], m[3]);
        if (f.ok) { const hd = { tipo: 'foro', mode: 'iso', nom: f.nom, iso: f.hole.code }, sd = { tipo: 'esterno', mode: 'iso', nom: f.nom, iso: f.shaft.code };
          out.items.push({ raw: l, fit: f, def: hd, pair: sd }); lastGeoTarget = null; }
        else out.items.push({ raw: l, warn: f.error });
        continue;
      }
      if ((m = new RegExp('^' + DN + '\\s*([A-Za-z]{1,2}\\d{1,2})\\b').exec(body)) && !/^(mm|x)$/i.test(m[2].replace(/\d+/g, ''))) {
        const code = m[2], hole = code[0] === code[0].toUpperCase();
        const def = { tipo: hole ? 'foro' : 'esterno', mode: 'iso', nom: nn(m[1]), iso: code };
        const r = isoLimits(def.nom, code); const it = { raw: lines[k], def };
        if (!r.ok) it.warn = r.error;
        else if (chk && (Math.abs(chk[0] - r.lo) > 0.0006 || Math.abs(chk[1] - r.hi) > 0.0006)) it.warn = 'I limiti scritti tra parentesi (' + fmtN(chk[0], 3) + '/' + fmtN(chk[1], 3) + ') non tornano con ' + code + ' (' + fmtN(r.lo, 3) + '/' + fmtN(r.hi, 3) + '): controlla';
        out.items.push(it); lastGeoTarget = def; continue;
      }
      const tipoNoIso = diam ? 'esterno' : 'posizione';
      if ((m = new RegExp('^' + DN + '\\s*±\\s*' + DN + '\\s*$').exec(body))) {
        const def = { tipo: tipoNoIso, mode: 'sim', nom: nn(m[1]), tol: nn(m[2]) }; out.items.push({ raw: l, def, tipoGuess: diam }); lastGeoTarget = diam ? def : null; continue;
      }
      // two signed deviations «42 +0,02 −0,01» / «42 0/−0,016» / «42 −0,01/+0,02»
      if ((m = new RegExp('^' + DN + '\\s+' + SN + '\\s*[/\\s]\\s*' + SN + '\\s*$').exec(body)) || (m = new RegExp('^' + DN + '\\s*([+\\-−]\\s*\\d*[.,]?\\d+)\\s*[/\\s]?\\s*([+\\-−]\\s*\\d*[.,]?\\d+|0)\\s*$').exec(body))) {
        const nom = nn(m[1]), a = nn(m[2]), b = nn(m[3]);
        if (nom != null && a != null && b != null && Math.abs(a) < 5 && Math.abs(b) < 5 && a !== b) { const def = { tipo: tipoNoIso, mode: 'asim', nom, up: Math.max(a, b), low: Math.min(a, b) }; out.items.push({ raw: l, def, tipoGuess: diam }); lastGeoTarget = diam ? def : null; continue; }
      }
      // stacked: «42 0» / «42 +0,02» and the next line only a signed deviation
      if ((m = new RegExp('^' + DN + '\\s+' + SN + '$').exec(body)) && k + 1 < lines.length && new RegExp('^' + SN + '$').test(lines[k + 1].replace(/\s+/g, ''))) {
        const nom = nn(m[1]), a = nn(m[2]), b = nn(lines[k + 1]);
        if (nom != null && a != null && b != null && Math.abs(a) < 5 && Math.abs(b) < 5 && a !== b) { const def = { tipo: tipoNoIso, mode: 'asim', nom, up: Math.max(a, b), low: Math.min(a, b) }; out.items.push({ raw: l + ' / ' + lines[k + 1], def, tipoGuess: diam }); lastGeoTarget = diam ? def : null; k++; continue; }
      }
      // two limits «42,000/41,984» or «41,984 ÷ 42,000»
      if ((m = /^(\d+[.,]\d+)\s*(?:\/|÷|\s-\s|\s−\s)\s*(\d+[.,]\d+)\s*$/.exec(body))) {
        const a = nn(m[1]), b = nn(m[2]);
        if (a != null && b != null && a !== b && Math.abs(a - b) < 5 && Math.abs(a - b) / Math.max(a, b) < 0.2) {
          const lo = Math.min(a, b), hi = Math.max(a, b), nom = Math.round(((lo + hi) / 2) * 1000) / 1000;
          const def = { tipo: tipoNoIso, mode: 'asim', nom: hi, up: 0, low: r5(lo - hi) };
          out.items.push({ raw: l, def, tipoGuess: diam, limits: true }); lastGeoTarget = diam ? def : null; void nom; continue;
        }
      }
      // plain dimension: general tolerance (if the title block has ISO 2768) or «senza tolleranza»
      if ((m = new RegExp('^' + DN + '\\s*$').exec(body)) && /\d/.test(l)) {
        const nom = nn(m[1]); if (nom == null || nom <= 0) continue;
        out.items.push({ raw: l, noTol: true, nom, tipo: tipoNoIso }); continue;
      }
    }
    if (out.gen) out.items.forEach((it) => { if (it.noTol) { const g = genTol(it.nom, out.gen.cls); if (g.ok) { it.def = { tipo: it.tipo, mode: 'gen', nom: it.nom, gen: out.gen.cls }; it.general = true; } } });
    return out;
  }

  const api = { MAX_QUOTE, NEAR_FRAC, TIPI, IT, FD, RANGE_UP, LETTERS, GRADES, QCOLS, numOf, rangeIndex, itGrade, isoParse, isoLimits, tipoOf, autoName, normalizeQuota, quotaLimits, quotaText, parseMeasure, fmtMeasure,
    evalQuota, evalControllo, tocchiFor, normalizeControllo, controlloToPkg, templateAA, diffControllo, findControllo, applyControllo, makePiece, pieceRows, qCells, lastPieces, streakOf, liveFeedback, fmtN, fmtUm, sg,
    valoreTxt, geoUm, formLimitsOf, GEN, GEN_UP, GEN_NAMES, genParse, genTol, fitParse, fitLimits, ALPHA, thermalUm, parseDrawingText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Quota = api;
})(typeof window !== 'undefined' ? window : globalThis);
