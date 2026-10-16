/**
 * Rettifica Beta 0.9.1 – «Controllo quota» (pure helpers, no DOM, no pairing math):
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
    const kEi = (g >= 4 && g <= 7) ? FD.k[i] : 0; // shaft k: deviation only for IT4–IT7, else 0
    const delta = () => it - (IT[g - 1] ? IT[g - 1][i] : it); // Δ = IT(n) − IT(n−1)
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
      else if (L === 'k') { es = g <= 8 ? -kEi + delta() : 0; ei = es - it; }
      else if (L === 'm' || L === 'n') {
        if (g > 8) return { ok: false, error: p.code.replace(/^./, (c) => c.toUpperCase()) + ' non supportato (solo IT4–IT8)' };
        es = -FD[L][i] + delta(); ei = es - it;
      } else { // P
        es = -FD.p[i] + (g <= 7 ? delta() : 0); ei = es - it;
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
    let mode = raw.mode === 'iso' || raw.mode === 'asim' || raw.mode === 'sim' ? raw.mode : (raw.iso ? 'iso' : (raw.up != null || raw.low != null) ? 'asim' : 'sim');
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
    } else {
      let tol = numOf(raw.tol); if (tol == null || tol <= 0) return { ok: false, error: 'tolleranza non valida (± mm, maggiore di 0)' };
      tol = Math.abs(tol); q.tol = tol; lo = r5(nom - tol); hi = r5(nom + tol); q.mode = 'sim';
    }
    if (!(hi > lo)) return { ok: false, error: 'limiti non validi' };
    if (hi - lo > 5) return { ok: false, error: 'tolleranza troppo larga (oltre 5 mm)' };
    q.lo = lo; q.hi = hi; q.centro = r5((lo + hi) / 2);
    q.nome = str(raw.nome, 40) || autoName(q);
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
    const c = Object.assign({ outer: 'stringe', bore: 'stringe', umPerTocco: 1, scala: 'diametro', stato: 'da_verificare' }, cal || {});
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
    const lastWords = (grow, um) => { const n = tocchiFor(um, c), k = keyFor(grow); return { key: k, presses: n, txt: (grow ? 'allarga' : 'stringi') + ' di ' + fmtUm(um) + ' µm sul Ø → ' + k + ' ×' + n + ' ' + (n === 1 ? 'tocco' : 'tocchi') }; };
    const relevant = !dentro || near;
    // can we still act on THIS piece? grinding only removes material: an outer diameter can only shrink, a bore can only grow
    const canNow = bore ? (need > 0) : (need < 0);
    const grow = need > 0; // the diameter would need to grow (to reach the centre)
    if (!dentro && ((!bore && side === 'sotto') || (bore && side === 'sopra'))) {
      cr.kind = 'non_recuperabile'; cr.recoverable = false;
      cr.words = 'Non recuperabile: ' + (bore ? 'foro troppo grande di ' : 'diametro troppo piccolo di ') + fmtUm(outByUm) + ' µm ' + (bore ? 'sopra il massimo' : 'sotto il minimo') + ' (' + (bore ? 'rettificando il foro cresce' : 'togliendo materiale il diametro non cresce') + ')';
      cr.short = 'non recuperabile';
      const nx = lastWords(grow, an); cr.next = { um: an, key: nx.key, presses: nx.presses, words: 'Per i prossimi pezzi: ' + nx.txt };
      return out;
    }
    if (!relevant) { cr.words = 'Non serve correggere'; return out; }
    if (an < 0.5) { cr.kind = 'centro'; cr.words = 'già al centro: non togliere altro'; return out; }
    if (canNow) {
      const w = lastWords(!bore ? false : true, an); // outer: stringi (shrink) · bore: allarga (grow)
      cr.kind = 'ora'; cr.um = an; cr.key = w.key; cr.presses = w.presses;
      cr.words = (bore ? 'Allarga il foro di ' : 'Stringi il diametro di ') + fmtUm(an) + ' µm sul Ø (' + fmtUm(an / 2) + ' µm per lato) → ' + w.key + ' ×' + w.presses + ' ' + (w.presses === 1 ? 'tocco' : 'tocchi');
      cr.short = w.key + ' ×' + w.presses;
    } else {
      // inside, but on the «wrong» side of the centre: material cannot be added back
      const nx = lastWords(grow, an);
      cr.kind = 'sotto_centro'; cr.um = an; cr.key = nx.key; cr.presses = nx.presses;
      cr.words = (bore ? 'Foro ' + fmtUm(an) + ' µm sopra il centro: non togliere altro (non si può restringere)' : 'Diametro ' + fmtUm(an) + ' µm sotto il centro: non togliere altro (non si può aggiungere materiale)');
      cr.short = 'non togliere altro';
      cr.next = { um: an, key: nx.key, presses: nx.presses, words: 'Per i prossimi pezzi: ' + nx.txt };
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
      quote: (c.quote || []).map((q) => { const o = { nome: q.nome, tipo: q.tipo, mode: q.mode, nom: q.nom, lo: q.lo, hi: q.hi, note: q.note || '' }; if (q.mode === 'iso') o.iso = q.iso; else if (q.mode === 'asim') { o.up = q.up; o.low = q.low; } else o.tol = q.tol; return o; }) };
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
        corr: i.ev.corr.kind, corrUm: i.ev.corr.um || 0, key: i.ev.corr.key || '', presses: i.ev.corr.presses || 0 })) };
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

  const api = { MAX_QUOTE, NEAR_FRAC, TIPI, IT, FD, RANGE_UP, LETTERS, GRADES, QCOLS, numOf, rangeIndex, itGrade, isoParse, isoLimits, tipoOf, autoName, normalizeQuota, quotaLimits, quotaText, parseMeasure, fmtMeasure,
    evalQuota, evalControllo, tocchiFor, normalizeControllo, controlloToPkg, templateAA, diffControllo, findControllo, applyControllo, makePiece, pieceRows, qCells, fmtN, fmtUm, sg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Quota = api;
})(typeof window !== 'undefined' ? window : globalThis);
