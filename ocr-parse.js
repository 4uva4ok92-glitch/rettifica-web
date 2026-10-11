/**
 * Parse OCR text (and optional word boxes) from Elenco caratteristiche screen.
 * Works with noisy OCR: 1/I, 0/O, 5/S confusions.
 */

function normalizeOcrText(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[|]+/g, ' ')
    .replace(/[–—\u2212]/g, '-')
    .replace(/[×xX]/g, 'x')
    // v1.9.8: decimal comma read as a space: "18 0018" → "18,0018", "-0 0097" → "-0,0097"
    .replace(/(^|[^\d,.])(-?\d{1,2}) (\d{4})(?![\d,.])/g, '$1$2,$3');
}

function fixLabel(raw) {
  let s = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Fix common OCR: FIA->F1A, SIA->S1A, GIA->G1A, FIB->F1B, etc.
  s = s.replace(/^F[I1L]([ABC])$/, 'F1$1')
    .replace(/^S[I1L]([ABC])$/, 'S1$1')
    .replace(/^G[I1L]([ABC])$/, 'G1$1')
    .replace(/^F([ABC])$/, 'F1$1')
    .replace(/^S([ABC])$/, 'S1$1')
    .replace(/^G([ABC])$/, 'G1$1');
  // F1A already ok
  if (/^[FSG]1[ABC]$/.test(s)) return s;
  // FIA without digit
  const m = s.match(/^([FSG])[I1L]?([ABC])$/);
  if (m) return m[1] + '1' + m[2];
  return null;
}

function parseItalianNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  // keep leading minus
  s = s.replace(/\s/g, '');
  s = s.replace(/[^0-9,.\-]/g, '');
  if (!s || s === '-' || s === ',' || s === '.') return null;
  // if both comma and dot: assume European (dot thousands, comma decimal) or opposite
  if (s.includes(',') && s.includes('.')) {
    // last separator is decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

/** Number like "-0,007", "- 0,01", "0.013", "-,010" → mm (may be negative). */
function parseSmallMm(raw) {
  if (raw == null) return null;
  let t = String(raw).replace(/\s+/g, '').replace(/[Oo]/g, '0');
  if (/^-?[,.]\d/.test(t)) t = t.replace(/^(-?)/, '$10');
  return parseItalianNumber(t);
}

/**
 * Limits of a G row, e.g. "G1A ( -0,007 / -0,01) -0,2776" → {min:7,max:10} µm.
 * The screen shows G = S − F (negative); the two limits are the gioco range.
 * Accepts OCR noise: missing ")" , "/" read as "I" "l" "\", spaces inside numbers.
 */
function extractGLimits(after) {
  const t = String(after || '');
  const num = '(-?\\s?\\d?\\s?[,.]\\s?\\d{1,3})';
  const re = new RegExp('[\\(\\[{]\\s*' + num + '\\s*[\\/\\\\Il]?\\s*' + num + '\\s*[\\)\\]}]?');
  let m = t.match(re);
  if (!m) m = t.match(new RegExp(num + '\\s*[\\/\\\\]\\s*' + num)); // parens lost, "/" kept
  if (!m) return null;
  const a = parseSmallMm(m[1]), b = parseSmallMm(m[2]);
  if (a == null || b == null) return null;
  const x = Math.round(Math.abs(a) * 1000), y = Math.round(Math.abs(b) * 1000);
  const lo = Math.min(x, y), hi = Math.max(x, y);
  // plausible gioco range: 1–60 µm, width 1–20 µm
  if (lo < 1 || hi > 60 || hi - lo < 1 || hi - lo > 20) return null;
  return { min: lo, max: hi, index: m.index, length: m[0].length };
}

/**
 * Nominal of an F/S row, e.g. "(22 ± 0,1)", "(24,5 ± 0,1)", OCR "(22 +0,1)", "(22 # 0,1)",
 * "(22 £ 0,1)", "(22 40,1)" (± read as 4) → {nominal, tol}.
 */
function extractNominal(after) {
  const t = String(after || '');
  // v1.9.4: first try a nominal WITH decimals ("(24,5 ± 0,1)", OCR "(24,5 20,1)" with ± read as 2),
  // then a whole nominal ("(22 ± 0,1)"). Tolerance must look like a real one (≤ 0,3 mm).
  const SIGN = '(?:±|\\+\\s*\\/?\\s*-?|#|£|\\*|t|4|2)?';
  const res = [
    new RegExp('[\\(\\[{]\\s*(\\d{2}[,.]\\d{1,3})\\s*' + SIGN + '\\s*(\\d?[,.]\\d{1,3})\\s*[\\)\\]}]?'),
    new RegExp('[\\(\\[{]\\s*(\\d{2})\\s*' + SIGN + '\\s*(\\d?[,.]\\d{1,3})\\s*[\\)\\]}]?'),
  ];
  for (const re of res) {
    const m = t.match(re);
    if (!m) continue;
    const nominal = parseItalianNumber(m[1]);
    const tol = parseSmallMm(m[2]);
    if (nominal == null || nominal < 10 || nominal > 60) continue;
    if (tol == null || tol <= 0 || tol > 0.3) continue;
    return { nominal, tol, index: m.index, length: m[0].length };
  }
  return null;
}

function mostFrequent(list, keyFn) {
  const counts = new Map();
  for (const it of list) {
    const k = keyFn(it);
    const c = counts.get(k) || { n: 0, it };
    c.n++; counts.set(k, c);
  }
  let best = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best ? { item: best.it, votes: best.n } : null;
}

function extractHeader(text) {
  const t = normalizeOcrText(text);
  const out = { lotto: null, codice: null, pezzi: null, buoni: null, scarti: null, deroghe: null };
  let m = t.match(/Lotto\s*[:\.]?\s*(\d{6,})/i);
  if (m) out.lotto = m[1];
  m = t.match(/Codice\s*elemento\s*[:\.]?\s*([0-9A-Za-z_]+)/i) ||
      t.match(/(?:elemento|element[o0])\s*[:\.,]?\s*([0-9]{5,}[_\-]?[0-9A-Za-z]*)/i) ||
      t.match(/(660023777[_\-]?0522|610023903[_\-]?0522|61082903[_\-]?0522)/i);
  if (m) out.codice = m[1].replace('-', '_');
  m = t.match(/Pezzi\s*[:\.]?\s*0*(\d{1,4})/i) || t.match(/\b0*(\d{2,3})\b(?=[\s\S]{0,40}Scarti)/i);
  if (m) out.pezzi = parseInt(m[1], 10);
  m = t.match(/Buoni\s*[:\.]?\s*0*(\d{1,4})/i);
  if (m) out.buoni = parseInt(m[1], 10);
  m = t.match(/Scarti\s*[:\.]?\s*0*(\d{1,4})/i);
  if (m) out.scarti = parseInt(m[1], 10);
  m = t.match(/Deroghe\s*[:\.]?\s*0*(\d{1,4})/i);
  if (m) out.deroghe = parseInt(m[1], 10);
  return out;
}

const NUM_RE = /-?\d{1,3}[,.]\d{3,4}/g;
const r4 = (x) => Math.round(x * 10000) / 10000;

/**
 * v1.9.8: pick the measured value of one row from its own text segment (limits already removed).
 * Next to every value the screen prints a small secondary number (the deviation):
 *   F/S rows: deviation = value − nominal (18,0098 → 0,0098);  G rows: deviation = value.
 * The deviation is never taken as the value; it confirms the value or repairs a misread one
 * (e.g. OCR "48,0018" with deviation 0,0018 and nominal 18 → 18,0018).
 */
function pickRowValue(lab, seg, nominal) {
  const toks = [...String(seg || '').matchAll(NUM_RE)].map((m) => ({ s: m[0], v: parseItalianNumber(m[0]), i: m.index })).filter((t) => t.v != null);
  const isG = lab.startsWith('G');
  const out = { value: null, dev: null, confidence: 0.5, fix: null };
  if (!toks.length) return out;
  if (isG) {
    const gs = toks.filter((t) => Math.abs(t.v) < 1);
    const main = gs.find((t) => Math.abs(t.v) >= 0.0005);
    if (!main) return out;
    out.value = main.v; out.confidence = Math.abs(main.v) >= 0.005 ? 0.8 : 0.6;
    const dev = gs.find((t) => t.i > main.i);
    if (dev) {
      out.dev = dev.v;
      if (Math.abs(dev.v - main.v) <= 0.00015) out.confidence = 0.95;
      else out.confidence = 0.65; // value and deviation disagree: let the operator check
    }
    return out;
  }
  const tolWin = 0.3;
  let mainIdx = toks.findIndex((t) => t.v > 15 && t.v < 40 && (nominal == null || Math.abs(t.v - nominal) <= tolWin));
  if (mainIdx < 0 && nominal == null) mainIdx = toks.findIndex((t) => t.v > 15 && t.v < 40);
  const main = mainIdx >= 0 ? toks[mainIdx] : null;
  // deviation: first small number after the value (or anywhere if the value is unreadable)
  const dev = toks.find((t, k) => Math.abs(t.v) < 1 && (main ? k > mainIdx : true));
  if (dev) out.dev = dev.v;
  if (main) {
    out.value = main.v; out.confidence = 0.85;
    if (dev && nominal != null) {
      if (Math.abs(main.v - nominal - dev.v) <= 0.00055) out.confidence = 0.95;
      else out.confidence = 0.7;
    }
    return out;
  }
  if (nominal == null) return out;
  if (dev && Math.abs(dev.v) <= tolWin) { // value misread or cut: nominal + deviation
    out.value = r4(nominal + dev.v); out.confidence = 0.75; out.fix = 'scostamento'; return out;
  }
  // leading digit misread ("48,0018" for 18,0018): swap in the nominal's integer part
  const ni = String(Math.trunc(nominal));
  for (const t of toks) {
    const m = t.s.match(/^(-?)(\d+)([,.]\d+)$/);
    if (!m || m[1] || m[2].length !== ni.length || m[2] === ni) continue;
    const v = parseItalianNumber(ni + m[3]);
    if (v != null && Math.abs(v - nominal) <= tolWin) { out.value = v; out.confidence = 0.6; out.fix = 'cifra'; return out; }
  }
  return out;
}

/** Nominal implied by value − deviation, if it is a clean one (18,0000 / 24,5000). */
function nominalFromDev(value, dev) {
  if (value == null || dev == null) return null;
  const n = value - dev, n1 = Math.round(n * 10) / 10;
  return Math.abs(n - n1) <= 0.00015 && n1 >= 10 && n1 <= 60 ? n1 : null;
}

/**
 * v1.9.8: close-up of the value column only (no row labels readable): F, S, G in screen order,
 * each optionally followed by its deviation.
 */
function parseValueColumn(text) {
  // limits/nominals in parentheses are not measured values
  const body = String(text || '').replace(/[\(\[{][^\)\]}\n]*[\)\]}]?/g, ' ');
  const toks = [...body.matchAll(NUM_RE)].map((m) => parseItalianNumber(m[0])).filter((v) => v != null);
  const items = [];
  for (let i = 0; i < toks.length; i++) {
    const v = toks[i], nx = toks[i + 1];
    let dev = null;
    if (nx != null && Math.abs(nx) < 1) {
      if (Math.abs(v) >= 1 && nominalFromDev(v, nx) != null) dev = nx;
      else if (Math.abs(v) < 1 && Math.abs(nx - v) <= 0.00015) dev = nx;
    }
    items.push({ v, dev }); if (dev != null) i++;
  }
  const big = (x) => x && x.v > 15 && x.v < 40;
  if (!(big(items[0]) && big(items[1]))) return null;
  const g = items[2] && Math.abs(items[2].v) < 1 ? items[2] : null;
  return { F: items[0], S: items[1], G: g };
}

/**
 * Parse rows from full OCR text.
 * Looks for patterns like: F1A (22 ± 0,1) ... 22,2741
 * or multiline: label then number on next lines.
 */
function parseElencoText(ocrText) {
  const text = normalizeOcrText(ocrText);
  const header = extractHeader(text);
  const rows = {}; // F1A: {value, tolBase, tolPlus, confidence}
  const giocoFromTol = []; // from G parentheses
  const nominals = []; // from F/S parentheses

  // Match label + optional paren + nearby number
  // Examples: F1A (22 ± 0,1) 22,2741
  //           G1A (-0,007 / -0,01) -0,2776
  //           FIA(22401] 22,2741
  const labelRe = /([FSG][I1L]?[ABC]|[FSG]1[ABC]|[FSG][ABC])\s*[\(\[]?\s*([^\)\]]{0,30})?[\)\]]?/gi;
  const lines = text.split(/\n+/);
  const joined = text.replace(/\n/g, ' ');

  // Strategy 1: find all labels then find numbers after them in a window
  const found = [];
  let m;
  const re = /([FSGfsg][I1L01]?[ABCabc])/g;
  while ((m = re.exec(joined)) !== null) {
    const lab = fixLabel(m[1]);
    if (!lab) continue;
    const after = joined.slice(m.index, m.index + 100);
    // Limits/nominal in parens: strip them before picking the measured value.
    // Only look up to the next row label so a missing ")" can't eat the next row.
    const nextLab = after.slice(3).search(/[FSG][I1L]?[ABC]\s*[\(\[]|[FSG][1IL][ABC]\b/i);
    const own = nextLab > 0 ? after.slice(0, nextLab + 3) : after;
    const tolM = lab.startsWith('G') ? extractGLimits(own) : extractNominal(own);
    let afterMeasure = own;
    if (tolM) {
      afterMeasure = own.slice(0, tolM.index) + ' ' + own.slice(tolM.index + tolM.length);
    }
    // v1.9.8: value from the row's own segment only; the small deviation number confirms or repairs it
    const pick = pickRowValue(lab, afterMeasure, tolM && !lab.startsWith('G') ? tolM.nominal : null);
    const value = pick.value;
    const confidence = pick.confidence;
    let tolBase = null, tolMm = null, giocoMinUm = null, giocoMaxUm = null;
    if (tolM && lab.startsWith('G')) { giocoMinUm = tolM.min; giocoMaxUm = tolM.max; }
    else if (tolM) { tolBase = tolM.nominal; tolMm = tolM.tol; }
    if (!rows[lab] || (value != null && (rows[lab].value == null || confidence > rows[lab].confidence + 0.05))) {
      rows[lab] = { value, dev: pick.dev, fix: pick.fix, tolBase, tolMm, giocoMinUm, giocoMaxUm, confidence: value != null ? confidence : 0.2, raw: own.slice(0, 60) };
    }
    if (giocoMinUm != null) {
      if (rows[lab].giocoMinUm == null) { rows[lab].giocoMinUm = giocoMinUm; rows[lab].giocoMaxUm = giocoMaxUm; }
      giocoFromTol.push({ lab, giocoMinUm, giocoMaxUm });
    }
    if (tolBase != null) {
      if (rows[lab].tolBase == null) { rows[lab].tolBase = tolBase; rows[lab].tolMm = tolMm; }
      nominals.push({ lab, nominal: tolBase, tol: tolMm });
    }
  }

  // Also scan for explicit number lines after known labels in multiline.
  // v1.9.8: the window stops at the next labelled line, so a cut-off row never takes the next row's value.
  const labOf = (ln) => { const mm = ln.match(/(?:^|[^A-Za-z])([FSG][I1L01]?[ABC])(?![a-z])/i); return mm ? fixLabel(mm[1]) : null; };
  for (let i = 0; i < lines.length; i++) {
    const lab = labOf(lines[i]);
    if (!lab) continue;
    let j = i + 1;
    while (j < lines.length && j < i + 3 && !labOf(lines[j])) j++;
    let win = lines.slice(i, j).join(' ');
    const lim = lab.startsWith('G') ? extractGLimits(win) : extractNominal(win);
    if (lim) win = win.slice(0, lim.index) + ' ' + win.slice(lim.index + lim.length);
    const li = win.search(/[FSG][I1L01]?[ABC]/i); if (li >= 0) win = win.slice(li + 3);
    const nom = !lab.startsWith('G') ? (lim ? lim.nominal : (rows[lab] && rows[lab].tolBase)) : null;
    const pick = pickRowValue(lab, win, nom == null ? null : nom);
    if (pick.value != null) {
      const cur = rows[lab];
      if (!cur || cur.value == null || cur.confidence < 0.7 && pick.confidence > cur.confidence) {
        rows[lab] = Object.assign(cur || {}, { value: pick.value, dev: pick.dev, fix: pick.fix, confidence: Math.max(pick.confidence, 0.6) });
      }
    }
  }

  // v1.9.8: no labels at all (close-up of the value column) → F, S, G in screen order
  const notes = [];
  // Only when no row label was read at all, or only A labels with every value after them (column
  // layout): with B/C labels around, values in order could belong to other rows.
  const labs = Object.keys(rows);
  const colLayout = () => {
    if (labs.some((k) => !/A$/.test(k))) return false;
    let lastLab = -1; const lr = /[FSG][I1L01]?A\s*[\(\[{]?/gi; let mm;
    while ((mm = lr.exec(joined)) !== null) if (fixLabel(mm[0].replace(/[\s\(\[{]/g, ''))) lastLab = mm.index;
    const firstBig = joined.search(/(^|[^\d])[1-3]\d[,.]\d{3,4}/);
    return firstBig < 0 || firstBig > lastLab;
  };
  if (!labs.some((k) => /^[FS]1A$/.test(k) && rows[k].value != null) && (labs.length === 0 || colLayout())) {
    const col = parseValueColumn(text);
    if (col) {
      rows.F1A = { value: col.F.v, dev: col.F.dev, confidence: 0.6, positional: true };
      rows.S1A = { value: col.S.v, dev: col.S.dev, confidence: 0.6, positional: true };
      if (col.G && !(rows.G1A && rows.G1A.value != null)) rows.G1A = Object.assign(rows.G1A || {}, { value: col.G.v, dev: col.G.dev, confidence: 0.6, positional: true });
      notes.push('Valori presi in ordine F1A, S1A, G1A (etichette non abbinate): controlla.');
    }
  }
  // v1.9.8: nominal implied by value − deviation (when the "(18 ± 0,1)" text is unreadable)
  const devNominals = [];
  for (const k of ['F1A', 'S1A', 'F1B', 'S1B', 'F1C', 'S1C']) {
    const r = rows[k]; if (!r || r.fix) continue;
    const n = nominalFromDev(r.value, r.dev); if (n != null) devNominals.push({ nominal: n });
  }

  // Base: nominal printed on F/S rows (most frequent), else guessed from values.
  let base = null, baseSource = null, tolleranza = null;
  const nomBest = mostFrequent(nominals, (x) => x.nominal.toFixed(3));
  if (nomBest) { base = nomBest.item.nominal; tolleranza = nomBest.item.tol; baseSource = 'foto'; }
  let baseFrom = nomBest ? 'etichetta' : null;
  const devBest = mostFrequent(devNominals, (x) => x.nominal.toFixed(1));
  if (base == null && devBest) { base = devBest.item.nominal; baseSource = 'foto'; baseFrom = 'scostamento'; }
  // labels read but the A-row value unreadable: repair it now that the base is known
  if (base != null) {
    for (const k of ['F1A', 'S1A']) {
      const r = rows[k];
      if (r && r.value == null && r.dev != null && Math.abs(r.dev) <= 0.3) { r.value = r4(base + r.dev); r.confidence = 0.75; r.fix = 'scostamento'; }
    }
  }
  if (base == null) {
    for (const k of ['S1A', 'F1A', 'S1B']) {
      if (rows[k] && rows[k].value != null) {
        const v = rows[k].value;
        if (Math.abs(v - 22) < 0.5) base = 22;
        else if (Math.abs(v - 24.5) < 0.35) base = 24.5;
        else if (Math.abs(v - 24.6) < 0.35) base = 24.6;
        else if (Math.abs(v - 20.6) < 0.35) base = 20.6;
        if (base != null) baseSource = 'valori';
        break;
      }
    }
  }

  // Gioco limits from the G rows (G1A/G1B/G1C): most frequent pair wins.
  // No defaults here: if the G row is missing the app falls back to the series.
  let giocoMin = null, giocoMax = null, giocoSource = null, giocoVotes = 0;
  const gBest = mostFrequent(giocoFromTol, (x) => x.giocoMinUm + '-' + x.giocoMaxUm);
  if (gBest) {
    giocoMin = gBest.item.giocoMinUm; giocoMax = gBest.item.giocoMaxUm;
    giocoSource = 'foto'; giocoVotes = gBest.votes;
  }

  const S1A = rows.S1A && rows.S1A.value != null ? rows.S1A.value : null;
  const F1A = rows.F1A && rows.F1A.value != null ? rows.F1A.value : null;
  let G1A = rows.G1A && rows.G1A.value != null ? rows.G1A.value : null;
  // v1.9.8: G row cut off or unreadable → the screen's G is S − F
  let gInferred = false;
  if (G1A == null && S1A != null && F1A != null) {
    G1A = r4(S1A - F1A); gInferred = true;
    rows.G1A = Object.assign(rows.G1A || {}, { value: G1A, confidence: 0.7, inferred: true });
    notes.push('G1A non letto: calcolato S − F = ' + String(G1A).replace('.', ',') + ' mm.');
  } else if (G1A != null && S1A != null && F1A != null && Math.abs(r4(S1A - F1A) - G1A) > 0.0006) {
    notes.push('Attenzione: G1A non corrisponde a S1A − F1A. Controlla i valori.');
  }
  for (const k of ['F1A', 'S1A']) if (rows[k] && rows[k].fix) notes.push(k + ' ricostruito dal piccolo scostamento accanto al valore: controlla.');

  // Paired detection: F1A within ~0.05 of base (or within tolerance 0.1)
  let paired = null;
  if (F1A != null && base != null) {
    paired = Math.abs(F1A - base) <= 0.05;
  } else if (F1A != null && S1A != null) {
    paired = Math.abs(F1A - S1A) < 0.05;
  }

  // Suggested series base: if values ~24.6 but label 24.5, suggest 24.6
  let suggestedBase = base;
  if (S1A != null && baseSource !== 'foto') {
    if (Math.abs(S1A - 24.6) < Math.abs(S1A - 24.5) && Math.abs(S1A - 24.6) < 0.15) suggestedBase = 24.6;
    else if (Math.abs(S1A - 24.5) < 0.15) suggestedBase = 24.5;
    else if (Math.abs(S1A - 22) < 0.15) suggestedBase = 22;
    else if (Math.abs(S1A - 20.6) < 0.15) suggestedBase = 20.6;
  }

  return {
    header,
    rows,
    base,
    baseSource,
    tolleranza,
    suggestedBase,
    giocoMin,
    giocoMax,
    giocoSource,
    giocoVotes,
    S1A,
    F1A,
    G1A,
    paired,
    baseFrom,
    gInferred,
    notes,
    lowConfidence: Object.keys(rows).filter((k) => rows[k].confidence < 0.55 || rows[k].value == null),
  };
}

/**
 * Given ML Kit-like blocks [{text, box:{l,t,r,b}}], build text sorted by reading order.
 */
function blocksToText(blocks) {
  if (!blocks || !blocks.length) return '';
  const withBox = blocks.filter((b) => b && b.box);
  if (!withBox.length) return blocks.map((b) => (b && b.text) || '').join('\n');
  // Group by vertical overlap (values use a bigger font than labels, so centres differ).
  const sorted = withBox.slice().sort((a, b) => (a.box.t + a.box.b) - (b.box.t + b.box.b));
  const lines = [];
  let cur = null;
  for (const bl of sorted) {
    const t = bl.box.t, b = bl.box.b, h = Math.max(1, b - t);
    if (cur) {
      const ov = Math.min(b, cur.b) - Math.max(t, cur.t);
      if (ov >= 0.5 * Math.min(h, cur.b - cur.t)) {
        cur.items.push(bl); cur.t = Math.min(cur.t, t); cur.b = Math.max(cur.b, b); continue;
      }
    }
    cur = { t, b, items: [bl] }; lines.push(cur);
  }
  return lines.map((ln) => ln.items.sort((a, b) => a.box.l - b.box.l).map((x) => x.text).join(' ')).join('\n');
}

const LABEL_BLOCK_RE = /(?:^|[^A-Za-z])[FSG][I1L01]?[ABC]\s*[\(\[{]|^\s*[FSG][1IL][ABC]\b/;

/**
 * v1.9.8: rebuild rows around the row labels (F1A, S1A, G1A …). Close-ups make the value
 * column much taller than the labels and a slight tilt can push a value nearer the next row,
 * so every other block goes to the label row whose centre is nearest (tilt-corrected).
 * Blocks well above the first label are the header; blocks far below the last label (a row
 * cut off by the frame) are dropped instead of being attached to the wrong row.
 * Returns null when fewer than 2 labels are found (caller falls back to blocksToText).
 */
function labelAnchoredText(blocks) {
  const bl = (blocks || []).filter((b) => b && b.box && b.text);
  const cy = (b) => (b.box.t + b.box.b) / 2, cx = (b) => (b.box.l + b.box.r) / 2;
  const labels = bl.filter((b) => LABEL_BLOCK_RE.test(b.text)).sort((a, b) => cy(a) - cy(b));
  if (labels.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < labels.length; i++) gaps.push(cy(labels[i]) - cy(labels[i - 1]));
  gaps.sort((a, b) => a - b);
  const rowH = Math.max(gaps[Math.floor(gaps.length / 2)], 1);
  // tilt: label left edges drift with y when the phone is rotated (least squares, clamped)
  let slope = 0;
  if (labels.length >= 3) {
    const n = labels.length, my = labels.reduce((s, b) => s + cy(b), 0) / n, mx = labels.reduce((s, b) => s + b.box.l, 0) / n;
    let num = 0, den = 0;
    for (const b of labels) { num += (cy(b) - my) * (b.box.l - mx); den += (cy(b) - my) ** 2; }
    const s = den > 0 ? num / den : 0;
    if (Math.abs(s) >= 0.035) slope = Math.max(-0.2, Math.min(0.2, s));
  }
  const rows = labels.map((b) => ({ lab: b, items: [] }));
  const header = [];
  for (const b of bl) {
    if (labels.includes(b)) continue;
    let best = null, bd = Infinity;
    for (const r of rows) {
      const y = cy(b) + slope * (cx(b) - cx(r.lab));
      const d = Math.abs(y - cy(r.lab));
      if (d < bd) { bd = d; best = r; }
    }
    if (best === rows[0] && cy(b) + slope * (cx(b) - cx(labels[0])) < cy(labels[0]) - 0.45 * rowH) { header.push(b); continue; }
    if (bd > 0.75 * rowH) continue; // far from every row (cut-off row, bar/Buono column noise)
    best.items.push(b);
  }
  const out = [];
  if (header.length) out.push(blocksToText(header));
  for (const r of rows) out.push([r.lab].concat(r.items.sort((a, b) => a.box.l - b.box.l)).map((x) => x.text).join(' '));
  return out.join('\n');
}

function parseElencoBlocks(blocks) {
  const anchored = labelAnchoredText(blocks);
  const res = parseElencoText(anchored != null ? anchored : blocksToText(blocks));
  // second opinion from plain line grouping when the anchored read misses an A value
  if (anchored != null && (res.S1A == null || res.F1A == null)) {
    const alt = parseElencoText(blocksToText(blocks));
    if ((alt.S1A != null) + (alt.F1A != null) > (res.S1A != null) + (res.F1A != null)) return alt;
  }
  return res;
}

if (typeof module !== 'undefined' && module.exports) {
module.exports = {
  parseElencoText,
  parseElencoBlocks,
  blocksToText,
  labelAnchoredText,
  pickRowValue,
  fixLabel,
  parseItalianNumber,
  normalizeOcrText,
  extractGLimits,
  extractNominal,
};

}
