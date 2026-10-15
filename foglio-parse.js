/**
 * Beta 0.8.0 – «Requisiti Disegno» sheet reader (generic, no hard-coded series).
 * Input: ML Kit lines [{text, box:{l,t,r,b}}] (any rotation), plain OCR text, or the AI JSON.
 * Output: { parts:[{name,role,nominal,upper,lower,tolPlus,tolMinus,instr}], gioco:{minUm,maxUm,formula,...},
 *           dims:[…other drawing dimensions…], oval, taper, warnings, … } – never calculates anything about pieces.
 */
(function (root) {
  'use strict';
  const MIN = /[−–—\u2212]/g;
  const F_WORDS = /^(corpo|foro|femmina|bussola|boccola|boccol|sede|cuscinetto|anello|guida|cassa|matrice|dado|alesaggio|cilindro|camicia|hole|bore)/i;
  const S_WORDS = /^(spillo|albero|maschio|perno|asse|pin|stelo|punzone|pistone|shaft|alberino|spina)/i;
  const INSTR = /(altimetr\w*|micromet\w*|bowers|calibr\w*|comparator\w*|tamp\w*|proiettor\w*|rugosimetr\w*|cmm|macchina di misura)/i;
  const HDR = [['requisit', /requisit|disegno\b/i], ['sup', /lim\w*\.?\s*sup/i], ['inf', /lim\w*\.?\s*inf/i], ['strum', /strument|misura\s*$/i], ['freq', /frequen|freq\./i]];
  const HDR_EXTRA = /^\(?\s*nom\b|tolleranza\s*\)|toller\w*\)|nom\s*[+\-]\s*tol|\(nom/i;

  const clean = (s) => String(s == null ? '' : s).replace(/\u00a0/g, ' ').replace(MIN, '-').replace(/\+\s*\/\s*-|\+-/g, '±').replace(/\s+/g, ' ').trim();
  /** Italian number from an OCR token (O→0, l/I→1 inside numbers). null when not a number. */
  function num(tok) {
    let s = clean(tok).replace(/^\+/, '');
    if (!/^[-]?[\dOolI|][\dOolI|,.]*$/.test(s) || !/\d/.test(s.replace(/[Oo]/g, '')) && !/[,.]/.test(s)) return null;
    s = s.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(',', '.');
    const v = Number(s); return Number.isFinite(v) ? v : null;
  }
  const NUM = '[-+]?[\\dOo][\\dOolI|]*(?:[,.][\\dOolI|]+)?';
  const DIAM = '(?:[ØøÖ⌀∅Φφ]|diam(?:etro)?\\.?)';
  const r4 = (x) => Math.round(x * 10000) / 10000;

  // ── recognition ─────────────────────────────────────────────
  const SCORE_KW = [/requisit/i, /lim\w*\.?\s*sup/i, /lim\w*\.?\s*inf/i, /strument/i, /frequen/i, /accoppiam/i, /nominal/i, /toller/i, /altimetr|micromet|bowers|calibr|comparator/i, /\bcalcolo\b/i, /\bgi?u?oco\b/i];
  function textOf(x) { return Array.isArray(x) ? x.map((b) => b.text).join('\n') : String(x || ''); }
  /** How much this OCR text looks like a drawing-requirements sheet. */
  function foglioScore(x) {
    const t = textOf(x), hits = SCORE_KW.filter((r) => r.test(t)).length;
    const strong = /accoppiam|lim\w*\.?\s*sup|requisit|strument/i.test(t);
    return { score: hits, isFoglio: (hits >= 3 && strong) || (/accoppiam/i.test(t) && hits >= 2) || (/lim\w*\.?\s*sup/i.test(t) && /lim\w*\.?\s*inf/i.test(t)) };
  }
  /** 'sideways' when most text lines are tall and narrow (photo rotated 90°), 'upright' when wide. */
  function orientationHint(blocks) {
    let tall = 0, wide = 0;
    (blocks || []).forEach((b) => { if (!b.box || clean(b.text).length < 4) return; const w = b.box.r - b.box.l, h = b.box.b - b.box.t; if (h > w * 1.5) tall++; else if (w > h * 1.2) wide++; });
    return tall > wide && tall >= 2 ? 'sideways' : wide > 0 ? 'upright' : 'unknown';
  }
  /** Rotate line geometry by deg clockwise (90/180/270). Text strings stay as they are. */
  function rotateBlocks(blocks, deg) {
    const bs = (blocks || []).filter((b) => b.box); if (!bs.length || !deg) return blocks;
    const W = Math.max(...bs.map((b) => b.box.r)), H = Math.max(...bs.map((b) => b.box.b));
    const pt = (x, y) => (deg === 90 ? [H - y, x] : deg === 180 ? [W - x, H - y] : [y, W - x]);
    return bs.map((b) => { const a = pt(b.box.l, b.box.t), c = pt(b.box.r, b.box.b);
      return { text: b.text, box: { l: Math.min(a[0], c[0]), r: Math.max(a[0], c[0]), t: Math.min(a[1], c[1]), b: Math.max(a[1], c[1]) } }; });
  }

  // ── label analysis ──────────────────────────────────────────
  function analyzeLabel(label) {
    const s = clean(label), o = { raw: s, name: '', diam: false, nominal: null, tolPlus: null, tolMinus: null, kind: null };
    if (/accoppiam|\bgi?u?oco\b|\bplay\b/i.test(s)) { o.kind = 'coupling'; o.name = s; return o; }
    if (/ovalit/i.test(s)) { o.kind = 'oval'; o.name = s; return o; }
    if (/conicit/i.test(s)) { o.kind = 'taper'; o.name = s; return o; }
    let rest = s;
    const nm = rest.match(/^([A-Za-zÀ-ÕÙ-õù-ÿ][A-Za-zÀ-ÕÙ-õù-ÿ'’/.-]*(?:\s+[A-Za-zÀ-ÕÙ-õù-ÿ][A-Za-zÀ-ÕÙ-õù-ÿ'’/.-]*)*)(?=\s|$|[ØøÖ⌀∅Φφ\d±+-])/);
    if (nm && !/^[ØøÖ]$/.test(nm[1])) { o.name = nm[1].replace(/\s+(?:diam(?:etro)?\.?)$/i, '').trim(); rest = rest.slice(nm[0].length).trim(); }
    const dm = rest.match(new RegExp('^(?:' + DIAM + '\\s*)'));
    if (dm) { o.diam = true; rest = rest.slice(dm[0].length).trim(); }
    else if (o.name && new RegExp('^[OQ0]\\s*(?=\\d)').test(rest) && /\d\s*$|\d\s*[±+-]/.test(rest) && !/^0[,.]/.test(rest)) { o.diam = true; rest = rest.replace(/^[OQ0]\s*/, ''); }
    const m1 = rest.match(new RegExp('^(' + NUM + ')'));
    if (m1) { o.nominal = num(m1[1]); rest = rest.slice(m1[0].length).trim(); }
    const sym = rest.match(new RegExp('^±\\s*(' + NUM + ')'));
    const asy = rest.match(new RegExp('^(?:\\+\\s*(' + NUM.replace('[-+]?', '') + ')\\s*)(?:[/ ]\\s*)?-\\s*(' + NUM.replace('[-+]?', '') + ')'));
    const asy2 = rest.match(new RegExp('^-\\s*(' + NUM.replace('[-+]?', '') + ')\\s*[/ ]?\\s*\\+\\s*(' + NUM.replace('[-+]?', '') + ')'));
    if (sym) { const t = Math.abs(num(sym[1])); o.tolPlus = t; o.tolMinus = t; }
    else if (asy) { o.tolPlus = Math.abs(num(asy[1])); o.tolMinus = Math.abs(num(asy[2])); }
    else if (asy2) { o.tolMinus = Math.abs(num(asy2[1])); o.tolPlus = Math.abs(num(asy2[2])); }
    return o;
  }
  const isRoleWord = (n) => F_WORDS.test(n || '') || S_WORDS.test(n || '');
  const roleOf = (n) => (F_WORDS.test(n || '') ? 'F' : S_WORDS.test(n || '') ? 'S' : null);
  const toMm = (x) => (x == null ? null : x);

  // ── geometry → rows ─────────────────────────────────────────
  /** Does this label line start a new table row (vs continue the previous label cell: ±, Ø, tolerances)? */
  function startsRow(t, cur) {
    const c = clean(t);
    if (/^(?:[±+\-]|[ØøÖ⌀∅Φφ]\s*\d|diam)/i.test(c)) return false;
    // OCR often reads «Ø10» as «010» / «O10»: right after a name-only label it is the diameter, not a new row
    if (cur && /^[0OQ]\s?\d{1,3}(?:[,.]\d+)?$/.test(c) && !/^0[,.]/.test(c) && /[A-Za-zÀ-ÕÙ-õù-ÿ]/.test(cur.label) && !/\d/.test(cur.label)) return false;
    return true;
  }
  function rowsFromBlocks(blocks) {
    const L = (blocks || []).map((b) => ({ text: clean(b.text), l: b.box.l, r: b.box.r, t: b.box.t, b: b.box.b })).filter((x) => x.text)
      .map((x) => Object.assign(x, { cx: (x.l + x.r) / 2, cy: (x.t + x.b) / 2 }));
    if (!L.length) return { rows: [], header: false };
    // header cells
    const hits = {}; const hdrLines = [];
    L.forEach((x) => { HDR.forEach(([k, re]) => { if (re.test(x.text) && !(k === 'requisit' && /^\d/.test(x.text))) { if (!hits[k] || x.t < hits[k].t) hits[k] = x; hdrLines.push(x); } }); if (HDR_EXTRA.test(x.text)) hdrLines.push(x); });
    // header band = lines near the topmost header line (same band as the 'Limite superiore' etc.)
    let bodyTop = -Infinity, header = false;
    if (hits.sup || hits.inf || hits.requisit) { header = true; const top = Math.min(...hdrLines.map((x) => x.t)); const hh = Math.max(...hdrLines.map((x) => x.b - x.t));
      bodyTop = Math.max(...hdrLines.filter((x) => x.t < top + hh * 3.2).map((x) => x.b)); }
    const body = L.filter((x) => x.cy > bodyTop);
    // columns
    let cols;
    if (header && (hits.sup || hits.inf)) {
      cols = { label: hits.requisit ? hits.requisit.cx : Math.min(...body.map((x) => x.cx)) };
      if (hits.sup) cols.sup = hits.sup.cx; if (hits.inf) cols.inf = hits.inf.cx; if (hits.strum) cols.strum = hits.strum.cx; if (hits.freq) cols.freq = hits.freq.cx;
      if (!cols.requisit && !hits.requisit) cols.label = Math.min(cols.label, (cols.sup || cols.inf) - 1);
    } else { // no header: cluster x-centres left→right: label, upper, lower, instrument…
      const xs = body.map((x) => x.cx).sort((a, b) => a - b), span = (xs[xs.length - 1] - xs[0]) || 1, cl = [];
      xs.forEach((x) => { const c = cl[cl.length - 1]; if (c && x - c.m < span * 0.07) { c.n++; c.m = (c.m * (c.n - 1) + x) / c.n; } else cl.push({ m: x, n: 1 }); });
      const cs = cl.map((c) => c.m); cols = { label: cs[0] }; const rest = cs.slice(1);
      const numCols = []; const txtCols = [];
      rest.forEach((c) => { const ls = body.filter((x) => Math.abs(x.cx - c) < span * 0.07); (ls.filter((x) => num(x.text) != null).length >= ls.length / 2 ? numCols : txtCols).push(c); });
      if (numCols[0] != null) cols.sup = numCols[0]; if (numCols[1] != null) cols.inf = numCols[1]; if (txtCols[0] != null) cols.strum = txtCols[0]; if (txtCols[1] != null) cols.freq = txtCols[1];
    }
    const names = Object.keys(cols);
    const colOf = (x) => { // nearest column; a number between «sup» and «inf» = one merged cell spanning both
      if (cols.sup != null && cols.inf != null && num(x.text) != null) { const d = Math.abs(cols.sup - cols.inf), mid = (cols.sup + cols.inf) / 2; if (Math.abs(x.cx - mid) < d * 0.22) return 'both'; }
      let best = null, bd = Infinity; names.forEach((n) => { const d = Math.abs(x.cx - cols[n]); if (d < bd) { bd = d; best = n; } }); return best;
    };
    body.forEach((x) => { x.col = colOf(x); });
    // label rows
    const labs = body.filter((x) => x.col === 'label').sort((a, b) => a.cy - b.cy);
    const rows = [];
    labs.forEach((x) => { const cur = rows[rows.length - 1]; if (cur && !startsRow(x.text, cur)) { cur.label += ' ' + x.text; cur.t = Math.min(cur.t, x.t); cur.b = Math.max(cur.b, x.b); } else rows.push({ label: x.text, t: x.t, b: x.b, cells: [] }); });
    if (!rows.length) { // no label column read: rows from the data lines themselves
      body.slice().sort((a, b) => a.cy - b.cy).forEach((x) => { const cur = rows[rows.length - 1]; if (cur && Math.abs(x.cy - (cur.t + cur.b) / 2) < (x.b - x.t) * 0.6) { cur.t = Math.min(cur.t, x.t); cur.b = Math.max(cur.b, x.b); } else rows.push({ label: '', t: x.t, b: x.b, cells: [] }); });
    }
    rows.forEach((r) => { r.cy = (r.t + r.b) / 2; });
    // data cells → the row whose band holds their y-centre
    body.filter((x) => x.col !== 'label').forEach((x) => {
      let best = null, bd = Infinity;
      rows.forEach((r, i) => { const up = i ? (rows[i - 1].b + r.t) / 2 : -Infinity, dn = i < rows.length - 1 ? (r.b + rows[i + 1].t) / 2 : Infinity;
        const d = x.cy >= up && x.cy <= dn ? Math.abs(x.cy - r.cy) * 0.01 : Math.abs(x.cy - r.cy) + 1e6; if (d < bd) { bd = d; best = r; } });
      if (best) best.cells.push(x);
    });
    return { rows: rows.map((r) => ({ label: r.label, cells: r.cells.sort((a, b) => a.cy - b.cy || a.cx - b.cx).map((c) => ({ text: c.text, col: c.col })) })), header, cols };
  }
  /** Plain OCR text (row-wise): a line starting with a name or a number opens a row; ±/Ø lines continue the label. */
  function rowsFromText(text) {
    const lines = String(text || '').split(/\r?\n/).map(clean).filter(Boolean);
    const rows = []; let cur = null, inHeader = true;
    lines.forEach((ln) => {
      if (HDR.some(([, re]) => re.test(ln)) || HDR_EXTRA.test(ln)) { inHeader = true; return; }
      if (/^(?:pezzo|disegno|codice)\b/i.test(ln) && !cur) return;
      inHeader = false;
      const parts = ln.split(/\t+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      const first = parts[0] || ln;
      if (cur && !startsRow(first, cur)) { // label continuation (maybe followed by cells on the same line)
        const m = ln.match(new RegExp('^((?:[±+-]\\s*' + NUM.replace('[-+]?', '') + '(?:\\s*[/ ]\\s*[-+]\\s*' + NUM.replace('[-+]?', '') + ')?)|(?:' + DIAM + '\\s*' + NUM.replace('[-+]?', '') + '))(.*)$'));
        if (m) { cur.label += ' ' + m[1]; pushCells(cur, m[2]); return; }
        cur.label += ' ' + ln; return;
      }
      const w0 = (first.split(' ')[0]) || '';
      const isName = /^[A-Za-zÀ-ÕÙ-õù-ÿ]/.test(w0) && !INSTR.test(w0) && !/^calcolo$/i.test(w0);
      const isNumRow = /^\d/.test(first) && !cur || (/^\d/.test(first) && /±/.test(ln));
      if (isName || isNumRow || !cur) {
        const N = NUM.replace('[-+]?', '');
        const lm = ln.match(new RegExp('^(?:((?:[A-Za-zÀ-ÕÙ-õù-ÿ][A-Za-zÀ-ÕÙ-õù-ÿ\'’/.-]*\\s*)+(?:' + DIAM + '\\s*' + N + ')?(?:\\s*±\\s*' + N + ')?)|(' + N + '(?:\\s*±\\s*' + N + ')?))(.*)$'));
        cur = { label: (lm && (lm[1] || lm[2]).trim()) || first, cells: [] }; rows.push(cur); pushCells(cur, lm ? lm[3] : ''); return;
      }
      pushCells(cur, ln);
    });
    function pushCells(row, rest) { clean(rest).split(' ').filter(Boolean).forEach((t) => row.cells.push({ text: t, col: null })); const joined = row.cells.filter((c) => num(c.text) == null).map((c) => c.text); void joined; }
    // text cells belong together («Calcolo Corpo -Spillo»)
    rows.forEach((r) => { const nums = r.cells.filter((c) => num(c.text) != null), txt = r.cells.filter((c) => num(c.text) == null); r.cells = nums.concat(txt.length ? [{ text: txt.map((c) => c.text).join(' '), col: 'strum' }] : []); });
    return { rows, header: false, textMode: true };
  }

  // ── rows → sheet ────────────────────────────────────────────
  function modelFromRow(r) {
    const a = analyzeLabel(r.label), m = Object.assign({}, a, { upper: null, lower: null, instr: '', freq: '' });
    const nums = [], texts = [];
    (r.cells || []).forEach((c) => { const v = num(c.text); if (v != null) nums.push({ v, col: c.col }); else texts.push(c.text); });
    nums.forEach((n) => { if (n.col === 'both') { m.upper = n.v; m.lower = n.v; m.both = true; } else if (n.col === 'sup') m.upper = n.v; else if (n.col === 'inf') m.lower = n.v; });
    const unk = nums.filter((n) => !n.col || (n.col !== 'both' && n.col !== 'sup' && n.col !== 'inf')); // no column info (text mode / no header)
    if (unk.length && m.upper == null && m.lower == null) {
      if (unk.length >= 2) { m.upper = Math.max(unk[0].v, unk[1].v); m.lower = Math.min(unk[0].v, unk[1].v); } else { m.upper = unk[0].v; m.lower = unk[0].v; m.both = true; }
    } else if (unk.length && (m.upper == null) !== (m.lower == null)) { const u = unk[0].v; if (m.upper == null) m.upper = u; else m.lower = u; }
    const strum = (r.cells || []).filter((c) => c.col === 'strum').map((c) => c.text);
    const txt = (strum.length ? strum : texts).join(' ').trim(); m.instrRaw = txt;
    const im = txt.match(INSTR); m.instr = im ? im[1].charAt(0).toUpperCase() + im[1].slice(1).toLowerCase() : (/calcolo/i.test(txt) ? '' : txt);
    const fm = (txt + ' ' + r.label).match(/(?:calcolo\s*)?([A-Za-zÀ-ÕÙ-õù-ÿ]{3,})\s*[-–—]\s*([A-Za-zÀ-ÕÙ-õù-ÿ]{3,})/i);
    if (fm && !/^calcolo$/i.test(fm[1])) m.formula = [fm[1], fm[2]];
    return m;
  }
  function modelFromAi(o) {
    const n = (v) => { if (v == null || v === '') return null; const x = typeof v === 'number' ? v : num(String(v)); return Number.isFinite(x) ? x : null; };
    const tp = n(o.tolPiu), tm = n(o.tolMeno), t = String(o.tipoRiga || o.tipo || '').toLowerCase();
    const label = String(o.nome || '').trim();
    const m = { raw: label, name: label, diam: /[ØøÖ⌀∅Φφ]|diam/i.test(label) || !!o.diametro, nominal: n(o.nominale), tolPlus: tp != null ? Math.abs(tp) : null, tolMinus: tm != null ? Math.abs(tm) : null,
      upper: n(o.limSup), lower: n(o.limInf), instr: String(o.strumento || '').trim(), instrRaw: String(o.strumento || '').trim(), kind: /accopp|gioco/.test(t + ' ' + label.toLowerCase()) ? 'coupling' : /oval/.test(t) ? 'oval' : /conic/.test(t) ? 'taper' : null, ai: true };
    if (m.upper != null && m.lower != null && m.upper === m.lower) m.both = true;
    const f = String(o.formula || '').match(/([A-Za-zÀ-ÕÙ-õù-ÿ]{3,})\s*[-–—−]\s*([A-Za-zÀ-ÕÙ-õù-ÿ]{3,})/); if (f) m.formula = [f[1], f[2]];
    if (m.name) { const a = analyzeLabel(m.name); m.name = a.name || m.name; if (m.nominal == null) m.nominal = a.nominal; }
    m.rowType = t;
    return m;
  }
  const same = (a, b) => a != null && b != null && Math.abs(a - b) < 1e-9;
  function finalize(models, extra) {
    const f = { parts: [], dims: [], gioco: null, oval: null, taper: null, warnings: [], hasForma: false, formula: null };
    models.forEach((m) => {
      if (m.kind === 'coupling') {
        let a = m.upper, b = m.lower; const vals = [a, b].filter((x) => x != null);
        if (!vals.length) { f.warnings.push('Riga accoppiamento senza valori leggibili.'); return; }
        const big = Math.max(...vals.map(Math.abs)); const mmv = big < 1;
        const um = (x) => Math.round(Math.abs(x) * (mmv ? 1000 : 1) * 10) / 10;
        let lo = Math.min(...vals.map(um)), hi = Math.max(...vals.map(um));
        if (vals.some((x) => x < 0)) f.warnings.push('Il gioco sul foglio ha segno negativo: controlla (qui gioco = foro − maschio, positivo = gioco).');
        if (!mmv && big > 500) { f.warnings.push('Valori di gioco fuori scala: controlla.'); return; }
        f.gioco = { minUm: lo, maxUm: hi, single: vals.length === 1, mm: mmv, formula: m.formula || null, instr: m.instrRaw || '' };
        if (vals.length === 1) f.warnings.push('Sul foglio c\'è un solo valore di accoppiamento: scrivi tu minimo e massimo.');
        if (m.formula) f.formula = m.formula;
        return;
      }
      if (m.kind === 'oval' || m.kind === 'taper') { const v = [m.upper, m.lower, m.nominal].find((x) => x != null); const um = v == null ? null : (Math.abs(v) < 1 ? Math.round(Math.abs(v) * 10000) / 10 : Math.abs(v)); f[m.kind] = { limUm: um, instr: m.instr }; f.hasForma = true; return; }
      const hasOd = m.diam || isRoleWord(m.name) || (m.rowType === 'parte');
      const part = hasOd && !(m.kind == null && !m.name && m.nominal != null && (m.tolPlus != null) && !m.diam);
      if (part && (m.name || m.diam) && (m.nominal != null || m.upper != null || m.lower != null)) {
        const p = { name: m.name || 'Pezzo', role: roleOf(m.name), nominal: m.nominal, upper: m.upper, lower: m.lower, tolPlus: m.tolPlus, tolMinus: m.tolMinus, instr: m.instr, raw: m.raw };
        if (p.nominal == null) p.nominal = p.upper != null && p.lower != null ? r4((p.upper + p.lower) / 2) : (p.upper != null ? p.upper : p.lower);
        if (p.upper == null && p.lower == null && p.nominal != null && (p.tolPlus != null || p.tolMinus != null)) { p.upper = r4(p.nominal + (p.tolPlus || 0)); p.lower = r4(p.nominal - (p.tolMinus || 0)); }
        if (p.tolPlus == null && p.tolMinus == null && p.upper != null && p.lower != null && !same(p.upper, p.lower) && p.nominal != null) { p.tolPlus = r4(p.upper - p.nominal); p.tolMinus = r4(p.nominal - p.lower); }
        p.limitOnly = p.upper != null && same(p.upper, p.lower);
        if (p.limitOnly && p.nominal != null && Math.abs(p.nominal - p.upper) > 1e-9) f.warnings.push(`${p.name}: il limite ${p.upper} è diverso dal nominale ${p.nominal}: controlla.`);
        f.parts.push(p); return;
      }
      if (m.nominal != null || m.upper != null) { // other drawing dimension → note
        const d = { name: m.name || '', nominal: m.nominal, tolPlus: m.tolPlus, tolMinus: m.tolMinus, upper: m.upper, lower: m.lower, instr: m.instr };
        if (d.upper == null && d.nominal != null && d.tolPlus != null) { d.upper = r4(d.nominal + d.tolPlus); d.lower = r4(d.nominal - (d.tolMinus != null ? d.tolMinus : d.tolPlus)); }
        f.dims.push(d);
      }
    });
    // roles: keywords first, then the coupling formula «A − B» = foro − maschio
    const stem = (s) => String(s || '').toLowerCase().slice(0, 4);
    if (f.formula && f.parts.length) {
      const [a, b] = f.formula; const pa = f.parts.find((p) => stem(p.name) === stem(a)), pb = f.parts.find((p) => stem(p.name) === stem(b));
      const ra = roleOf(a), rb = roleOf(b);
      if (ra === 'S' && rb === 'F') { f.inverted = true; f.warnings.push(`La formula del foglio è ${a} − ${b} (maschio − foro): il segno è opposto a quello dell'app (gioco = foro − maschio). Controlla i valori.`); }
      if (pa && !pa.role) pa.role = ra || (rb === 'S' ? 'F' : 'F'); if (pb && !pb.role) pb.role = rb || 'S';
      if (pa && pb && pa.role === pb.role) { f.warnings.push('Non riesco a capire quale è il foro e quale il maschio: controlla i ruoli.'); f.rolesGuessed = true; }
    }
    const nF = f.parts.filter((p) => p.role === 'F').length, nS = f.parts.filter((p) => p.role === 'S').length;
    if (f.parts.length >= 2 && (!nF || !nS) && !f.formula) { // unknown names: the first listed is the foro (sheet order), flagged
      const un = f.parts.filter((p) => !p.role); if (un.length >= 2 && !nF && !nS) { un[0].role = 'F'; un[1].role = 'S'; f.rolesGuessed = true; f.warnings.push('Nomi dei pezzi non riconosciuti: ho messo «' + un[0].name + '» come foro e «' + un[1].name + '» come maschio. Controlla.'); }
      else if (un.length === 1) { un[0].role = nF ? 'S' : 'F'; f.rolesGuessed = true; }
    }
    // gioco from the two parts' limits when the sheet has no coupling row (derived from read values, flagged)
    const F = f.parts.find((p) => p.role === 'F'), S = f.parts.find((p) => p.role === 'S');
    if (!f.gioco && F && S && F.upper != null && F.lower != null && S.upper != null && S.lower != null && (!F.limitOnly || !S.limitOnly)) {
      const lo = Math.round((F.lower - S.upper) * 10000) / 10, hi = Math.round((F.upper - S.lower) * 10000) / 10;
      if (lo >= 0 && hi > lo && hi < 500) { f.gioco = { minUm: lo, maxUm: hi, derived: true, formula: null }; f.warnings.push(`Gioco ${lo}–${hi} µm ricavato dai limiti di ${F.name} e ${S.name} (non c'era la riga Accoppiamento): controlla.`); }
    }
    if (!f.parts.length) f.warnings.push('Non ho trovato righe del foglio con foro/maschio: scrivi i valori a mano o usa «Leggi foto con AI».');
    if (!f.gioco) f.warnings.push('Riga accoppiamento / gioco non trovata: scrivi tu minimo e massimo (µm).');
    Object.assign(f, extra || {});
    return f;
  }
  function quality(f, rowsInfo) {
    let q = 0; if (f.parts.length) q += 2 + f.parts.length; if (f.gioco) q += 3; q += Math.min(f.dims.length, 3) * 0.5;
    if (rowsInfo && rowsInfo.header) q += 1;
    return q;
  }
  /** Parse ML Kit lines of any rotation. Tries the orientations the geometry allows and keeps the best reading. */
  function parseFoglioBlocks(blocks, opt) {
    const bs = (blocks || []).filter((b) => b && b.text && b.box);
    if (!bs.length) return parseFoglioText(textOf(blocks));
    const hint = orientationHint(bs), degs = hint === 'sideways' ? [270, 90] : hint === 'upright' ? [0, 180] : [0, 270, 90, 180];
    let best = null;
    degs.forEach((deg) => {
      const rb = deg ? rotateBlocks(bs, deg) : bs, ri = rowsFromBlocks(rb);
      // header order must read left→right (Requisiti … Limite sup … Limite inf …) and sit above the rows
      let ord = 0; const hx = {}; rb.forEach((b) => { HDR.forEach(([k, re]) => { if (re.test(b.text) && !hx[k]) hx[k] = (b.box.l + b.box.r) / 2; }); });
      const ks = ['requisit', 'sup', 'inf', 'strum', 'freq'].filter((k) => hx[k] != null); for (let i = 1; i < ks.length; i++) ord += hx[ks[i]] > hx[ks[i - 1]] ? 1 : -1;
      const f = finalize(ri.rows.map(modelFromRow), { rotation: deg, source: 'ocr' });
      const q = quality(f, ri) + ord * 2;
      if (!best || q > best.q) best = { q, f };
    });
    return best.f;
  }
  function parseFoglioText(text) { const ri = rowsFromText(text); return finalize(ri.rows.map(modelFromRow), { rotation: 0, source: 'testo' }); }
  /** AI JSON {righe:[{nome,tipoRiga,nominale,tolPiu,tolMeno,limSup,limInf,strumento,formula}]} → same sheet object. */
  function foglioFromAi(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const rows = Array.isArray(obj.righe) ? obj.righe : Array.isArray(obj.rows) ? obj.rows : null;
    if (!rows || !rows.length || rows.some((r) => !r || typeof r !== 'object')) return null;
    const f = finalize(rows.map(modelFromAi), { rotation: 0, source: 'ai', ai: true });
    f.warnings.unshift('Letto con AI: controlla ogni valore sul foglio prima di confermare.');
    if (!f.parts.length && !f.gioco) return null;
    return f;
  }
  /** Sheet → the editable «foglio disegno» form (everything stays editable in the UI). */
  function foglioToForm(f) {
    const F = f.parts.find((p) => p.role === 'F') || null, S = f.parts.find((p) => p.role === 'S') || null;
    const nom = (S && S.nominal != null) ? S.nominal : (F && F.nominal != null ? F.nominal : null);
    const tolOf = (p) => (p && (p.tolPlus != null || p.tolMinus != null) ? Math.max(Math.abs(p.tolPlus || 0), Math.abs(p.tolMinus || 0)) : null);
    const tol = [tolOf(S), tolOf(F)].find((x) => x != null);
    const warn = f.warnings.slice();
    if (F && S && F.nominal != null && S.nominal != null && Math.abs(F.nominal - S.nominal) > 0.0005) warn.push(`Nominali diversi: ${F.name} ${F.nominal} · ${S.name} ${S.nominal}. La base della serie è ${nom}.`);
    const fmt = (x) => String(x).replace('.', ',');
    const dimTxt = (d) => `${d.name ? d.name + ' ' : ''}${d.nominal != null ? fmt(d.nominal) : ''}${d.tolPlus != null ? ' ±' + fmt(d.tolPlus) : ''}${d.upper != null && d.lower != null && d.nominal != null ? ' (' + fmt(d.lower) + '–' + fmt(d.upper) + ')' : d.upper != null ? ' (' + fmt(d.upper) + ')' : ''}${d.instr ? ' · ' + d.instr.toLowerCase() : ''}`.trim();
    const name = F && S ? `${F.name}/${S.name}${nom != null ? ' Ø' + fmt(nom) : ''}` : (F || S) ? `${(F || S).name}${nom != null ? ' Ø' + fmt(nom) : ''}` : (nom != null ? 'Base ' + fmt(nom) : '');
    return { F, S, base: nom, tol: tol != null ? tol : null, giocoMin: f.gioco ? f.gioco.minUm : null, giocoMax: f.gioco ? f.gioco.maxUm : null,
      formula: f.formula ? f.formula[0] + ' − ' + f.formula[1] : null, name, forma: !!f.hasForma, oval: f.oval, taper: f.taper,
      dims: f.dims.map(dimTxt), instrF: F ? F.instr : '', instrS: S ? S.instr : '', warnings: warn, rolesGuessed: !!f.rolesGuessed, giocoDerived: !!(f.gioco && f.gioco.derived), ai: !!f.ai };
  }
  /** Notes text stored with the series (instruments, other dimensions). */
  function formNotes(fm) {
    const out = [];
    if (fm.F || fm.S) out.push([fm.F ? `${fm.F.name} (foro)${fm.instrF ? ': ' + fm.instrF : ''}` : '', fm.S ? `${fm.S.name} (maschio)${fm.instrS ? ': ' + fm.instrS : ''}` : ''].filter(Boolean).join(' · '));
    if (fm.giocoMin != null) out.push(`Gioco ${fm.giocoMin}–${fm.giocoMax} µm${fm.formula ? ' (calcolo ' + fm.formula + ')' : ''}.`);
    if (fm.dims && fm.dims.length) out.push('Altre quote del disegno (fuori dall\'accoppiamento): ' + fm.dims.join('; ') + '.');
    out.push('Dal foglio «Requisiti Disegno».');
    return out.join(' ');
  }
  const api = { foglioScore, orientationHint, rotateBlocks, parseFoglioBlocks, parseFoglioText, foglioFromAi, foglioToForm, formNotes, analyzeLabel, rowsFromBlocks, num };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FoglioParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
