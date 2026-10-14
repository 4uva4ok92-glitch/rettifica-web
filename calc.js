/**
 * Accoppiamento calculation for rettifica.
 * d = (S - base) in µm
 * valid n: giocoMin <= n - d <= giocoMax
 * ideal = d + (giocoMin + giocoMax) / 2
 */

function round1(x) {
  return Math.round(x * 10) / 10;
}

/**
 * @param {number} S - measured diameter mm
 * @param {number} base - series base mm
 * @param {number} giocoMin - µm
 * @param {number} giocoMax - µm
 * @returns {{ d: number, ideal: number, valid: number[], recommended: number[], edges: number[], outside: {n:number, gioco:number}[], details: {n:number, gioco:number, centered:boolean, edge:boolean}[] }}
 */
/**
 * v2.0.4 lavoro: 'maschio' (default) = the measure is the MALE, numbered parts are the mating female (F = base + n µm), gioco = n − d.
 * 'femmina' = the measure is the FEMALE, numbered parts are the mating male (M = base + n µm), gioco = d − n.
 * Both: gioco = sgn·(n − d), sgn = +1 / −1.
 */
function lavoroSign(mode) { return mode === 'femmina' ? -1 : 1; }
function normLavoro(mode) { return mode === 'femmina' ? 'femmina' : 'maschio'; }
function calcAccoppiamento(S, base, giocoMin, giocoMax, mode) {
  const sg = lavoroSign(mode);
  const d = (S - base) * 1000;
  const ideal = d + sg * (giocoMin + giocoMax) / 2;
  const nMin = sg > 0 ? Math.ceil(d + giocoMin - 1e-9) : Math.ceil(d - giocoMax - 1e-9);
  const nMax = sg > 0 ? Math.floor(d + giocoMax + 1e-9) : Math.floor(d - giocoMin + 1e-9);
  const valid = [];
  for (let n = nMin; n <= nMax; n++) valid.push(n === 0 ? 0 : n);

  // Sort by distance to ideal; on .5 ties either neighbor is fine
  const byCenter = [...valid].sort((a, b) => {
    const da = Math.abs(a - ideal);
    const db = Math.abs(b - ideal);
    if (Math.abs(da - db) < 1e-9) return a - b;
    return da - db;
  });
  const recommended = byCenter.slice(0, Math.min(2, byCenter.length));

  const edges = valid.length <= 2 ? [] : [valid[0], valid[valid.length - 1]].filter(
    (n) => !recommended.includes(n)
  );

  // Just-outside neighbors
  const outside = [];
  const lo = nMin - 1;
  const hi = nMax + 1;
  for (const n of [lo, hi]) {
    const gioco = sg * (n - d);
    if (gioco < giocoMin - 0.05 || gioco > giocoMax + 0.05) {
      outside.push({ n, gioco: round1(gioco) });
    }
  }

  const details = valid.map((n) => ({
    n,
    gioco: round1(sg * (n - d)),
    centered: recommended.includes(n),
    edge: edges.includes(n),
  }));

  return {
    d: round1(d),
    ideal: round1(ideal),
    valid,
    recommended,
    edges,
    outside,
    details,
    mode: normLavoro(mode),
  };
}

/**
 * Target diameter for desired part number.
 * target = base + (pezzo - giocoCentrale) / 1000
 */
function calcTarget(base, pezzoDesired, giocoMin, giocoMax, mode) {
  const centro = (giocoMin + giocoMax) / 2;
  const target = base + (pezzoDesired - lavoroSign(mode) * centro) / 1000; // femmina: F = M(n) + centro
  return { target, centro };
}

/**
 * Correction presses given machine rule.
 * Studer: + makes SMALLER, − makes BIGGER
 */
function calcCorrezione(currentS, target, machineRule) {
  const diffUm = (target - currentS) * 1000; // positive = need bigger piece
  const presses = Math.round(Math.abs(diffUm));
  let key = '?';
  let action = '';
  const rule = machineRule === 'plus_smaller' ? 'studer' : machineRule;
  if (rule === 'studer' || rule === 'plus_bigger') {
    const plusMakesSmaller = rule === 'studer';
    if (Math.abs(diffUm) <= 0.05) {
      key = '';
      action = 'già a target';
    } else if (diffUm > 0) {
      action = 'più grande';
      key = plusMakesSmaller ? '−' : '+';
    } else {
      action = 'più piccolo';
      key = plusMakesSmaller ? '+' : '−';
    }
  }
  return { diffUm: round1(diffUm), presses, key, action };
}

/**
 * Parse tolerant Italian measures.
 * Accepts comma/dot; tries to fix obvious typos without silently changing.
 */
function parseMisura(raw, base, tolleranza) {
  if (raw == null) return { value: null, warning: null, suggestion: null };
  let s = String(raw).trim().toLowerCase();
  if (!s) return { value: null, warning: null, suggestion: null };

  // "5 e 98" style relative fragments — return null with note unless full number
  // Normalize Italian decimal
  s = s.replace(/\s+/g, '');
  // "24,5,91" → try 24.591
  if (/^\d+[,.]\d+[,.]\d+$/.test(s)) {
    const parts = s.split(/[,.]/);
    s = parts[0] + '.' + parts.slice(1).join('');
  } else {
    // single comma or dot
    s = s.replace(',', '.');
  }

  // "A e BC" (spoken shorthand) is ambiguous: never turned into a value, at most a suggestion.
  // Behaviour kept identical to OmT 2.0.8 (see tests/golden-parse.json).
  const eMatch = String(raw).trim().match(/^(\d+)\s*e\s*(\d+)$/i);
  if (eMatch && base != null) {
    const a = eMatch[1];
    const b = eMatch[2].padStart(2, '0');
    // Only documented case: "5 e 98" near base 24,5 = 24,4898
    if (a === '5' && b === '98' && Math.abs(base - 24.5) < 0.05) {
      return { value: null, warning: 'Formato "5 e 98" ambiguo', suggestion: 24.4898 };
    }
    // Generic guess: (base tenths − 0,1) + "A BC" as ten-thousandths, offered only if close to the base
    const prefix = (Math.floor(base * 10) - 1) / 10;
    const cand = prefix + parseInt(a + b, 10) / 10000;
    return {
      value: null,
      warning: 'Formato "N e M" ambiguo, inserisci la misura completa (es. 24,4898)',
      suggestion: Math.abs(cand - base) < 0.05 ? round4(cand) : null,
    };
  }

  let value = parseFloat(s);
  if (Number.isNaN(value)) {
    return { value: null, warning: 'Misura non valida', suggestion: null };
  }

  // Incoherence check
  let warning = null;
  let suggestion = null;
  if (base != null) {
    const delta = Math.abs(value - base);
    const tol = tolleranza != null && tolleranza > 0 ? tolleranza : 0.1;
    if (delta > tol) {
      warning = `Misura incoerente con la base ${fmtMm(base)}, controlla`;
      // v1.9.4: first try the same decimals with the whole number next to the base (22,9966 → 21,9966)
      const frac4 = Math.round((value - Math.floor(value)) * 10000) / 10000;
      const bi0 = Math.floor(base);
      const swaps = [bi0 - 1, bi0, bi0 + 1].map((ip) => round4(ip + frac4))
        .filter((c) => Math.abs(c - base) <= tol && Math.abs(c - value) > 1e-9 && Math.abs(c - base) > 1e-9)
        .sort((a, b) => Math.abs(a - base) - Math.abs(b - base));
      if (swaps.length) return { value, warning, suggestion: swaps[0] };
      // Single-digit fix: try changing one digit to get closer to base
      // Try suggestions: if value looks like typo of nearby (e.g. 24.506 → 24.606)
      const candidates = [];
      const vs = value.toFixed(4);
      for (let i = 0; i < vs.length; i++) {
        if (vs[i] === '.' ) continue;
        for (let d = 0; d <= 9; d++) {
          if (String(d) === vs[i]) continue;
          const arr = vs.split('');
          arr[i] = String(d);
          const c = parseFloat(arr.join(''));
          if (Math.abs(c - base) <= tol && Math.abs(c - base) < Math.abs(value - base) && Math.abs(c - base) > 1e-9) {
            candidates.push(c);
          }
        }
      }
      // Prefer candidates whose tenths digit matches the base (e.g. 24,506 → 24,606)
      const baseTenthsDigit = Math.floor(base * 10) % 10;
      const tenthsDigit = (x) => Math.floor(x * 10) % 10;
      candidates.sort((a, b) => {
        const sa = tenthsDigit(a) === baseTenthsDigit ? 0 : 1;
        const sb = tenthsDigit(b) === baseTenthsDigit ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return Math.abs(a - base) - Math.abs(b - base);
      });
      if (candidates.length) suggestion = round4(candidates[0]);
    }
  }

  return { value, warning, suggestion };
}

function round4(x) {
  return Math.round(x * 10000) / 10000;
}

function fmtMm(x) {
  return String(x).replace('.', ',');
}

function giocoSF(S, F) {
  // G = S - F in mm, display in µm as negative typically
  const gMm = S - F;
  const gUm = round1(gMm * 1000);
  return { gMm, gUm };
}


/**
 * Interpret measure input: full value (comma/dot) as-is, OR suffix digits
 * combined with integer prefix nearest to base (or forcedPrefix).
 * @param {string} raw
 * @param {number} base
 * @param {number|null} tolleranza
 * @param {number|null} forcedPrefix - integer part override (e.g. 21)
 */
function interpretMeasure(raw, base, tolleranza, forcedPrefix) {
  const s0 = String(raw == null ? '' : raw).trim();
  if (!s0) return { value: null, warning: null, suggestion: null, mode: null, prefix: null, display: null };

  // Ambiguous speech formats → parseMisura
  if (/e/i.test(s0) || /^\d+\s*[,.]\s*\d+\s*[,.]\s*\d+$/.test(s0.replace(/\s/g, ''))) {
    const p = parseMisura(s0, base, tolleranza);
    const pref = p.value != null ? Math.floor(p.value) : Math.floor(base);
    return { ...p, mode: 'full', prefix: pref, display: p.value != null ? fmtMm(p.value) : null };
  }

  // v1.9.4: ",9966" typed after the shown prefix → suffix digits
  const cleaned = s0.replace(/\s+/g, '').replace(/^[,.]+/, '');
  if (!cleaned) return { value: null, warning: 'Misura non valida', suggestion: null, mode: null, prefix: null, display: null };
  const bi = Math.floor(base);
  const prefixes = [bi - 1, bi, bi + 1];

  // Full measure if it contains a separator AND left side looks like diameter integer (>=10 or matches a prefix)
  const fullMatch = cleaned.match(/^(\d+)[,.](\d+)$/);
  if (fullMatch) {
    const left = fullMatch[1];
    const right = fullMatch[2];
    const leftNum = parseInt(left, 10);
    // Treat as full if left has 2+ digits (typical mm) OR equals one of the candidate prefixes
    if (left.length >= 2 || prefixes.includes(leftNum)) {
      const value = parseFloat(left + '.' + right);
      const p = parseMisura(String(value), base, tolleranza);
      return {
        ...p,
        value,
        mode: 'full',
        prefix: Math.floor(value),
        display: left + ',' + right,
      };
    }
  }

  // Suffix-only: digits, optionally with a single comma/dot inside fractional part
  if (/^\d+([,.]\d+)?$/.test(cleaned) && !fullMatch) {
    let digits;
    if (/[,.]/.test(cleaned)) digits = cleaned.split(/[,.]/).join('');
    else digits = cleaned;

    const candidates = prefixes.map((pref) => {
      const value = parseFloat(pref + '.' + digits);
      return { prefix: pref, value, display: pref + ',' + digits };
    }).filter((c) => !Number.isNaN(c.value));

    // v1.9.4: "24590" / "21996" typed without comma → also try the compact reading (24,590)
    // v2.0.2: with a chosen integer only the compact reading with THAT integer is used; another integer is
    // never taken silently → reported as altCompact so the plausibility check can ask
    let altCompact = null;
    if (!/[,.]/.test(cleaned) && cleaned.length >= 4) {
      for (const pref of prefixes) {
        const ps = String(pref);
        if (cleaned.startsWith(ps) && cleaned.length > ps.length) {
          const dg = cleaned.slice(ps.length);
          const cand = { prefix: pref, value: parseFloat(pref + '.' + dg), display: pref + ',' + dg };
          if (forcedPrefix == null || pref === forcedPrefix) candidates.push(cand);
          else if (!altCompact || Math.abs(cand.value - base) < Math.abs(altCompact.value - base)) altCompact = cand;
        }
      }
    }
    const near = (a, b) => Math.abs(a.value - base) - Math.abs(b.value - base);
    let chosen;
    if (forcedPrefix != null && candidates.some((c) => c.prefix === forcedPrefix)) {
      chosen = candidates.filter((c) => c.prefix === forcedPrefix).sort(near)[0];
      const p = parseMisura(String(chosen.value), base, tolleranza);
      const out = { ...p, value: chosen.value, mode: 'suffix', prefix: chosen.prefix, display: chosen.display, forced: true };
      if (altCompact && Math.abs(altCompact.value - base) < Math.abs(chosen.value - base)) { out.altCompact = altCompact.value; out.altDisplay = altCompact.display; }
      return out;
    } else {
      candidates.sort((a, b) => {
        const da = Math.abs(a.value - base);
        const db = Math.abs(b.value - base);
        if (Math.abs(da - db) < 1e-12) return Math.abs(a.prefix - bi) - Math.abs(b.prefix - bi);
        return da - db;
      });
      chosen = candidates[0];
    }
    const p = parseMisura(String(chosen.value), base, tolleranza);
    return { ...p, value: chosen.value, mode: 'suffix', prefix: chosen.prefix, display: chosen.display };
  }

  // Compact "24590" / "21996" without separator
  if (/^\d{4,7}$/.test(cleaned)) {
    const candidates = [];
    for (const pref of prefixes) {
      const ps = String(pref);
      if (cleaned.startsWith(ps) && cleaned.length > ps.length) {
        const digits = cleaned.slice(ps.length);
        const value = parseFloat(pref + '.' + digits);
        candidates.push({ prefix: pref, value, display: pref + ',' + digits });
      }
    }
    if (candidates.length) {
      candidates.sort((a, b) => Math.abs(a.value - base) - Math.abs(b.value - base));
      const chosen = candidates[0];
      const p = parseMisura(String(chosen.value), base, tolleranza);
      return { ...p, value: chosen.value, mode: 'compact', prefix: chosen.prefix, display: chosen.display };
    }
  }

  const p = parseMisura(s0, base, tolleranza);
  const pref = p.value != null ? Math.floor(p.value) : bi;
  return { ...p, mode: 'full', prefix: pref, display: p.value != null ? fmtMm(p.value) : null };
}

/** Realistic hint digits for empty input, based on series base. */
function hintForBase(base) {
  const bi = Math.floor(base);
  const frac = base - bi;
  // Near-integer bases (22,000): show below-base example 996 → 21,996
  const delta = frac < 0.05 ? 0.004 : 0.01;
  const example = round4(base - delta);
  const prefix = Math.floor(example + 1e-9);
  let digs = example.toFixed(4).split('.')[1];
  digs = digs.replace(/0+$/, '');
  if (digs.length < 3) digs = example.toFixed(3).split('.')[1].replace(/0+$/, '') || digs;
  return { digits: digs, value: example, prefix, text: `Es. digita ${digs} → ${prefix},${digs}` };
}



/** Typo guard: warn if far from base or jump >25 µm from last measure. */
function typoGuard(S, base, tolleranza, lastS) {
  const warnings = [];
  let suggestion = null, hard = false;
  if (base != null && S != null) {
    const delta = Math.abs(S - base);
    const tol = tolleranza != null && tolleranza > 0 ? tolleranza : 0.1;
    if (delta > hardLimitMm(tolleranza) + 1e-9) hard = true;
    if (delta > tol) {
      warnings.push('Misura incoerente con la base ' + fmtMm(base));
      const p = parseMisura(String(S), base, tolleranza);
      if (p.suggestion != null) suggestion = p.suggestion;
    }
    if (lastS != null && Math.abs(S - lastS) > 0.025) {
      warnings.push('Salto >25 µm rispetto all\'ultima misura (' + fmtMm(lastS) + ')');
      // v1.9.4: never propose the previous measure as a "fix"
      if (suggestion == null) {
        const p = parseMisura(String(S), base, tolleranza);
        if (p.suggestion != null) suggestion = p.suggestion;
      }
    }
  }
  return { warn: warnings.length > 0, warnings, suggestion, hard };
}

/**
 * v2.0.2 sticky integer prefix ("21," vs "22,"): an explicit choice is kept per job and per series
 * (prefs map { 'job:<id>': 21, 'ser:<id>': 21 }) until the user changes it. Auto (nearest to the base) is only the fallback.
 */
function stickyPrefixFor(map, ctx) {
  if (!map || !ctx || ctx.base == null) return null;
  const bi = Math.floor(Number(ctx.base) + 1e-9);
  const ok = (v) => Number.isInteger(v) && Math.abs(v - bi) <= 1;
  const jk = 'job:' + ctx.jobId + ':' + (ctx.seriesId || '');
  if (ctx.jobId && ok(map[jk])) return map[jk];
  if (ctx.seriesId && ok(map['ser:' + ctx.seriesId])) return map['ser:' + ctx.seriesId];
  return null;
}
function setStickyPrefix(map, ctx, prefix) {
  const m = map && typeof map === 'object' ? map : {};
  const v = parseInt(prefix, 10); if (!Number.isInteger(v) || !ctx) return m;
  if (ctx.jobId) m['job:' + ctx.jobId + ':' + (ctx.seriesId || '')] = v;
  if (ctx.seriesId) m['ser:' + ctx.seriesId] = v;
  return m;
}

/** Series tolerance (mm), default ±0,1. */
function seriesTol(series) {
  const t = series && Number(series.tolleranza);
  return t > 0 ? t : 0.1;
}
/** Beyond this distance from the base (mm) a measure is impossible for the series: no "Conferma". */
function hardLimitMm(tolleranza) {
  const t = Number(tolleranza) > 0 ? Number(tolleranza) : 0.1;
  return Math.max(0.2, 2 * t);
}

/** Sum pezzi portati via entries. */
function pezziSum(entries) {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((a, e) => a + (Number(e.n) || 0), 0);
}

/** Classify mating part number vs measure. */
function checkPezzoHold(S, base, pezzoN, giocoMin, giocoMax, mode) {
  const d = (S - base) * 1000;
  const gioco = lavoroSign(mode) * (pezzoN - d);
  const g = round1(gioco);
  let status = 'NO';
  if (g >= giocoMin - 1e-9 && g <= giocoMax + 1e-9) {
    const edge = Math.abs(g - giocoMin) < 0.05 || Math.abs(g - giocoMax) < 0.05;
    status = edge ? 'AL_LIMITE' : 'OK';
    // also treat within 0.5 of edge as AL_LIMITE if at exact min/max integers
    if (g === giocoMin || g === giocoMax) status = 'AL_LIMITE';
    if (g > giocoMin && g < giocoMax) status = 'OK';
  }
  return { gioco: g, status, d: round1(d) };
}

/** Spiegazione in micron. */
function spiegazione(S, base, giocoMin, giocoMax, recommended, mode) {
  const sg = lavoroSign(mode);
  const d = (S - base) * 1000;
  const centro = (giocoMin + giocoMax) / 2;
  const ideal = d + sg * centro;
  const rec = recommended || [];
  const parts = rec.map((n) => {
    const g = round1(sg * (n - d));
    return { n, gioco: g };
  });
  const dStr = (d >= 0 ? '+' : '') + fmtUm(round1(d));
  let txt = fmtMm(S) + ' = ' + dStr + ' µm dalla base; ' +
    fmtUm(round1(d)) + (sg > 0 ? ' + ' : ' − ') + fmtUm(round1(centro)) + ' = ' + fmtUm(round1(ideal));
  if (rec.length) {
    txt += ' → pezzo ' + (sg > 0 ? '' : 'maschio ') + rec.join(' o ') + '; gioco ' +
      parts.map((p) => fmtUm(p.gioco)).join(' / ') + ' µm';
  }
  return { text: txt, d: round1(d), ideal: round1(ideal), centro: round1(centro) };
}

function fmtUm(x) { return String(round1(x)).replace('.', ','); }


/** Format mm with exactly 3 decimals, Italian comma: 24,600 */
function fmtMm3(x) {
  if (x == null || Number.isNaN(x)) return '—';
  const n = Math.round(Number(x) * 1000) / 1000;
  const s = n.toFixed(3).replace('.', ',');
  return s;
}

/**
 * v1.9.4 trend alert. Caller passes only the points of the current shift/day for the current series,
 * after the last real correction (oldest → newest, S in mm).
 * Rules: ≥ minPoints (5); ignore noise < 2 µm; alert on 5 in a row going the same way, or a clean
 * linear trend (R² ≥ 0.7). Presses are suggested only when they bring S back toward the base (centre)
 * and never more than the distance to the base.
 */
function detectDrift(SValues, opts) {
  opts = opts || {};
  const window = opts.window || 8;
  const minPoints = opts.minPoints || 5;
  const noiseUm = opts.noiseUm != null ? opts.noiseUm : 2;
  const rule = opts.machineRule === 'plus_smaller' ? 'studer' : (opts.machineRule || 'studer');
  const vals = (SValues || []).filter((v) => typeof v === 'number' && Number.isFinite(v));
  const none = (extra) => Object.assign({ ok: vals.length >= minPoints, points: vals.length, slopeUmPerPiece: null, alert: null, suggestion: null, rule: null }, extra || {});
  if (vals.length < minPoints) return none();
  const slice = vals.slice(-Math.min(window, vals.length));
  const n = slice.length;
  const y = slice.map((v) => v * 1000);
  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += y[i]; sxy += i * y[i]; sxx += i * i; syy += y[i] * y[i]; }
  const den = n * sxx - sx * sx;
  const slope = den ? (n * sxy - sx * sy) / den : 0;
  const vy = n * syy - sy * sy;
  const r2 = den && vy > 1e-12 ? Math.pow(n * sxy - sx * sy, 2) / (den * vy) : 0;
  const range = Math.max(...y) - Math.min(...y);
  const total = slope * (n - 1);
  const slopeR = round1(slope);
  if (range < noiseUm - 1e-9 || Math.abs(total) < noiseUm - 1e-9) return none({ slopeUmPerPiece: slopeR });
  const last5 = y.slice(-5);
  let up = true, down = true;
  for (let i = 1; i < last5.length; i++) { if (last5[i] < last5[i - 1] - 1e-9) up = false; if (last5[i] > last5[i - 1] + 1e-9) down = false; }
  const net5 = last5[last5.length - 1] - last5[0];
  const runRule = (up && net5 >= noiseUm - 1e-9) || (down && -net5 >= noiseUm - 1e-9);
  const trendRule = r2 >= 0.7;
  if (!runRule && !trendRule) return none({ slopeUmPerPiece: slopeR });
  const rising = total > 0;
  const per2 = round1(Math.abs(slope) * 2);
  let text = 'Stai ' + (rising ? 'salendo' : 'scendendo') + ' di ~' + fmtUm(per2) + ' µm ogni 2 pezzi';
  let suggestion = null;
  if (opts.base != null) {
    const dLast = (slice[n - 1] - opts.base) * 1000;
    const toward = (rising && dLast > 0) || (!rising && dLast < 0);
    const presses = Math.min(Math.round(Math.abs(slope) * 2), Math.floor(Math.abs(dLast) + 1e-9));
    if (toward && presses >= 1) {
      let key = null;
      if (rule === 'studer') key = rising ? '+' : '−';
      else if (rule === 'plus_bigger') key = rising ? '−' : '+';
      suggestion = { key, presses, per2Um: per2 };
      text += key ? ' → dai ' + key + ' ×' + presses + (presses === 1 ? ' tocco?' : ' tocchi?') : ' → correggi di ' + presses + ' µm?';
    } else text += ' · tienilo d\'occhio';
  } else text += ' · tienilo d\'occhio';
  return { ok: true, points: n, slopeUmPerPiece: slopeR, alert: text, suggestion, rule: runRule ? 'serie5' : 'trend' };
}

/**
 * Points for the trend: saves of the current shift (oldest → newest), same day, only the trailing run
 * of the given series, after the last real correction.
 * @param {{seriesId:string,S:number,ts?:string,correction?:boolean}[]} saves
 */
function driftPoints(saves, seriesId, dayKey) {
  const out = [];
  const list = saves || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    if (!s || s.seriesId !== seriesId) break; // series change → reset
    if (dayKey && s.ts && String(s.ts).slice(0, 10) !== dayKey) break; // new day → reset
    if (s.correction) break; // real correction → reset (this piece was before the correction)
    if (s.lavoro === 'femmina') continue; // v2.0.5: female measures (2.0.4) never mix with the male drift
    if (typeof s.S === 'number') out.unshift(s.S);
  }
  return out;
}

/**
 * v1.9.4 correction card: aim the chosen part at the centre of the gioco range.
 * |Δ| ≤ 0,5 µm → no correction. Presses round half down (never over-correct).
 */
function calcCorrezioneCard(S, base, giocoMin, giocoMax, wantPezzo, machineRule, mode) {
  const { target, centro } = calcTarget(base, wantPezzo, giocoMin, giocoMax, mode);
  const diffUm = (target - S) * 1000;
  const rule = machineRule === 'plus_smaller' ? 'studer' : (machineRule || 'studer');
  const out = { want: wantPezzo, centro, target, diffUm: round1(diffUm), presses: 0, key: '', action: '', none: false };
  if (Math.abs(diffUm) <= 0.5 + 1e-9) { out.none = true; out.action = 'nessuna correzione'; return out; }
  out.presses = Math.max(1, Math.ceil(Math.abs(diffUm) - 0.5 - 1e-9));
  const bigger = diffUm > 0;
  out.action = bigger ? 'più grande' : 'più piccolo';
  if (rule === 'studer') out.key = bigger ? '−' : '+';
  else if (rule === 'plus_bigger') out.key = bigger ? '+' : '−';
  else out.key = '';
  return out;
}
/**
 * v1.9.9: short hint to centre part n, same math and keys as the correction card
 * (Studer: + = piece smaller, − = bigger; 1 press = 1 µm).
 */
function correctionHint(S, base, giocoMin, giocoMax, n, machineRule, mode) {
  const c = calcCorrezioneCard(S, base, giocoMin, giocoMax, n, machineRule, mode);
  const w = corrWords(c.diffUm, c.presses, c.key, c.none);
  return { n, none: c.none, key: c.key, presses: c.presses, diffUm: c.diffUm, action: c.action, text: w.short, full: w.text, words: w };
}
/**
 * v2.0.8: one wording for every correction: measured position vs the centre FIRST, then the action, then the presses.
 * diffUm = target − measured (+ → the piece is BELOW the centre → make it bigger).
 */
function corrWords(diffUm, presses, key, none) {
  if (none || diffUm == null || Math.abs(diffUm) <= 0.5 + 1e-9) return { none: true, pos: 'al centro', posShort: 'al centro', act: 'nessuna correzione', keys: '', text: 'al centro: nessuna correzione', short: 'nessuna correzione' };
  const below = diffUm > 0, um = fmtUm(Math.abs(diffUm)) + ' µm', where = below ? 'sotto' : 'sopra';
  const act = 'fai più ' + (below ? 'grande' : 'piccolo');
  const keys = key ? key + ' ×' + presses : presses + ' µm';
  return { none: false, below, pos: um + ' ' + where + ' il centro', posShort: um + ' ' + where, act, keys,
    text: um + ' ' + where + ' il centro → ' + act + ': ' + keys, short: um + ' ' + where + ' → ' + keys };
}
/** Hints for the part, its neighbours (n+1, n−1) and an optional extra target. */
function neighbourHints(S, base, giocoMin, giocoMax, center, machineRule, extra, mode) {
  if (S == null || base == null || center == null || giocoMin == null || giocoMax == null) return null;
  const h = (n) => correctionHint(S, base, giocoMin, giocoMax, n, machineRule, mode);
  const out = { center: h(center), up: h(center + 1), down: h(center - 1), extra: null };
  if (extra != null && extra !== center && extra !== center + 1 && extra !== center - 1) out.extra = h(extra);
  out.line = 'Pezzo ' + out.up.n + ': ' + out.up.text + ' · Pezzo ' + out.down.n + ': ' + out.down.text;
  return out;
}
/** Parts offered in the «Altro pezzo» picker: center ± span. */
function hintPickerParts(center, span) {
  const s = span == null ? 8 : span, out = [];
  for (let n = center - s; n <= center + s; n++) out.push(n === 0 ? 0 : n);
  return out;
}
/** Parts offered when tapping the correction card: around the valid range, incl. 0 and negatives. */
function correctionOptions(acc) {
  const lo0 = acc.valid.length ? acc.valid[0] : Math.floor(acc.ideal);
  const hi0 = acc.valid.length ? acc.valid[acc.valid.length - 1] : Math.ceil(acc.ideal);
  const out = [];
  for (let n = lo0 - 3; n <= hi0 + 3; n++) out.push(n === 0 ? 0 : n);
  return out;
}
function nextCorrectionWant(options, current) {
  if (!options.length) return current;
  const i = options.indexOf(current);
  return options[(i + 1) % options.length];
}

/**
 * Stock-aware recommendation.
 * stock: { [n:string]: number } counts on table for mating part numbers.
 */
function recommendWithStock(acc, stock, opts) {
  opts = opts || {};
  stock = stock || {};
  const get = (n) => {
    const v = stock[String(n)];
    return v == null ? null : Number(v);
  };
  const idealList = (acc && acc.recommended) || [];
  const valid = (acc && acc.valid) || [];
  const ideal = acc && acc.ideal != null ? acc.ideal : null;

  function avail(n) {
    const c = get(n);
    if (c == null) return true; // unknown stock = assume available
    return c > 0;
  }

  // Prefer ideal/recommended that are in stock
  const preferred = [];
  for (const n of idealList) {
    if (avail(n)) preferred.push(n);
  }
  if (preferred.length) {
    return {
      recommended: preferred.slice(0, 2),
      reason: 'ideal',
      outOfStock: idealList.filter((n) => !avail(n)),
      correctionTarget: null,
      stockWarn: stockWarnNear(valid, stock, ideal),
    };
  }

  // Ideal out of stock → nearest available still within gioco (valid)
  const availableValid = valid.filter(avail).sort((a, b) => {
    const da = Math.abs(a - ideal);
    const db = Math.abs(b - ideal);
    return da - db || a - b;
  });
  if (availableValid.length) {
    return {
      recommended: availableValid.slice(0, 2),
      reason: 'nearest_available',
      outOfStock: idealList,
      correctionTarget: null,
      stockWarn: stockWarnNear(valid, stock, ideal),
    };
  }

  // Nothing in range available → suggest correction toward nearest stocked number overall
  const allStocked = Object.keys(stock)
    .map((k) => parseInt(k, 10))
    .filter((n) => !Number.isNaN(n) && get(n) > 0)
    .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || a - b);
  const target = allStocked.length ? allStocked[0] : (idealList[0] != null ? idealList[0] : Math.round(ideal));
  return {
    recommended: idealList.slice(0, 2),
    reason: 'correction',
    outOfStock: idealList,
    correctionTarget: target,
    stockWarn: stockWarnNear(valid.concat(allStocked.slice(0, 5)), stock, ideal),
  };
}

/**
 * Beta 0.2.0: availability of the numbered counterparts for ONE series.
 * stock = { "<n>": qty }. «Managed» = at least one number with qty > 0; then a number without an entry counts as 0.
 * Not managed → theoretical advice unchanged (acc.recommended), nothing classified.
 * Never changes quantities.
 * @returns {{managed:boolean, adattiDisp:{n:number,qty:number,gioco:number}[], adattiNonDisp:{n:number,gioco:number}[],
 *   dispCorr:{n:number,qty:number,gioco:number,dist:number}[], recommended:number[], reason:string}}
 */
function stockQty(stock, n) { const v = stock && stock[String(n)]; const q = Number(v); return v == null || !Number.isFinite(q) || q < 0 ? 0 : Math.floor(q); }
function stockManaged(stock) { return !!stock && Object.keys(stock).some((k) => !Number.isNaN(parseInt(k, 10)) && stockQty(stock, k) > 0); }
function classifyStock(acc, stock, opts) {
  opts = opts || {};
  const maxCorr = opts.maxCorr || 2;
  const valid = (acc && acc.valid) || [];
  const ideal = acc && acc.ideal != null ? acc.ideal : 0;
  const g = (n) => round1(lavoroSign(acc && acc.mode) * (n - acc.d));
  const byIdeal = (a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || a - b;
  if (!stockManaged(stock)) {
    return { managed: false, adattiDisp: [], adattiNonDisp: [], dispCorr: [], recommended: ((acc && acc.recommended) || []).slice(), reason: 'teorico' };
  }
  const adattiDisp = valid.filter((n) => stockQty(stock, n) > 0).sort(byIdeal).map((n) => ({ n, qty: stockQty(stock, n), gioco: g(n) }));
  const adattiNonDisp = valid.filter((n) => stockQty(stock, n) === 0).sort(byIdeal).map((n) => ({ n, gioco: g(n) }));
  const lo = valid.length ? valid[0] : Math.round(ideal), hi = valid.length ? valid[valid.length - 1] : Math.round(ideal);
  const outside = Object.keys(stock).map((k) => parseInt(k, 10))
    .filter((n) => !Number.isNaN(n) && stockQty(stock, n) > 0 && !valid.includes(n))
    .map((n) => ({ n, qty: stockQty(stock, n), gioco: g(n), dist: n < lo ? lo - n : n - hi }))
    .sort((a, b) => a.dist - b.dist || Math.abs(a.n - ideal) - Math.abs(b.n - ideal) || a.n - b.n);
  const dispCorr = outside.slice(0, maxCorr);
  let recommended, reason;
  if (adattiDisp.length) {
    recommended = adattiDisp.slice(0, 2).map((x) => x.n);
    const idealRec = (acc.recommended || []);
    reason = idealRec.length && idealRec.includes(recommended[0]) ? 'adatto_centrato' : 'adatto_disponibile';
  } else {
    recommended = ((acc && acc.recommended) || []).slice();
    reason = dispCorr.length ? 'serve_correzione' : 'nessuno_disponibile';
  }
  return { managed: true, adattiDisp, adattiNonDisp, dispCorr, recommended, reason };
}
/** Short Italian «why» line for the recommendation. */
function stockReasonText(cls) {
  if (!cls || !cls.managed) return '';
  const nd = cls.adattiNonDisp.length ? ' · finiti: ' + cls.adattiNonDisp.map((x) => x.n).join(', ') : '';
  switch (cls.reason) {
    case 'adatto_centrato': return 'Consigliato perché è nel gioco, il più vicino al centro, e ce l\'hai sul tavolo' + nd;
    case 'adatto_disponibile': return 'Il pezzo centrale non c\'è: questo è nel gioco ed è disponibile' + nd;
    case 'serve_correzione': return 'Nessun pezzo adatto sul tavolo: puoi correggere la macchina verso un pezzo che hai (previsione)' + nd;
    default: return 'Nessun pezzo adatto e nessun pezzo vicino sul tavolo' + nd;
  }
}
/** Take one piece (only on Salva). Returns true if a piece was really taken. */
function stockTake(stock, n) { if (!stock || stockQty(stock, n) <= 0) return false; stock[String(n)] = stockQty(stock, n) - 1; return true; }
/** Set an exact quantity (glove keypad). Negative / invalid → 0. */
function stockSet(stock, n, q) { const v = Math.max(0, Math.min(999, Math.floor(Number(q) || 0))); stock[String(n)] = v; return v; }

/**
 * Beta 0.3.0 «Interno (femmina)»: internal grinding of the bore. All values are DIAMETERS.
 * Target range of the bore: from tolerance (nom −tolM/+tolP) or from a known male (M + gioco min … M + gioco max).
 * @returns {{lo:number, hi:number, centro:number}|null}
 */
function internoTarget(cfg) {
  if (!cfg) return null;
  const n = (x) => (x == null || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
  if (cfg.mode === 'maschio') {
    const M = n(cfg.M); let a = n(cfg.gmin), b = n(cfg.gmax);
    if (M == null || a == null || b == null) return null;
    if (a > b) [a, b] = [b, a];
    const lo = round4(M + a / 1000), hi = round4(M + b / 1000);
    return { lo, hi, centro: round4((lo + hi) / 2) };
  }
  const nom = n(cfg.nom), tm = n(cfg.tolM), tp = n(cfg.tolP);
  if (nom == null || tm == null || tp == null) return null;
  const lo = round4(nom - Math.abs(tm)), hi = round4(nom + Math.abs(tp));
  return { lo, hi, centro: round4((lo + hi) / 2) };
}
/** Bore measure: full mm value ("20,0125") or a number relative to the base in µm, the way parts are numbered ("12", "-3"). */
function internoBore(raw, base, relative) {
  const t = String(raw == null ? '' : raw).trim().replace(/\s+/g, '');
  if (!t || t === '-' || t === ',') return null;
  if (relative) { if (!/^[-+]?\d+([.,]\d+)?$/.test(t) || base == null) return null; return round4(Number(base) + Number(t.replace(',', '.')) / 1000); }
  const v = Number(t.replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : null;
}
/**
 * Evaluate the bore and the correction. rule = machine setting «su interno il + fa il foro»:
 * 'plus_bigger' | 'plus_smaller' | null (NOT SET → no +/− key, words only). 1 press = 1 µm on the diameter.
 */
function calcInterno(bore, tgt, rule) {
  if (bore == null || !tgt) return null;
  const devUm = round1((bore - tgt.centro) * 1000);           // + = bore bigger than the centre
  const belowLo = round1((tgt.lo - bore) * 1000), aboveHi = round1((bore - tgt.hi) * 1000);
  const state = belowLo > 1e-9 ? 'stretto' : aboveHi > 1e-9 ? 'largo' : 'ok';
  const need = -devUm;                                       // + = must enlarge
  const out = { devUm, belowLo, aboveHi, state, needUm: round1(need), presses: 0, action: '', key: null, none: false, ruleSet: rule === 'plus_bigger' || rule === 'plus_smaller' };
  // Beta 0.4.2: below 1 µm there is nothing to correct (1 tocco = 1 µm)
  if (Math.abs(need) < 1 - 1e-9) { out.none = true; out.action = 'nessuna correzione'; return out; }
  out.presses = Math.max(1, Math.ceil(Math.abs(need) - 0.5 - 1e-9));
  out.action = need > 0 ? 'allarga' : 'stringi';
  if (out.ruleSet) out.key = (need > 0) === (rule === 'plus_bigger') ? '+' : '−';
  return out;
}
/** Beta 0.4.2: half-band (µm) of a «nominale ± tol» bore quota when it looks like the sheet's general tolerance (≥ 0,05 mm), else null. */
function internoTolWide(cfg) {
  if (!cfg || cfg.mode !== 'tol' || cfg.tolM == null || cfg.tolP == null) return null;
  const w = Math.max(Math.abs(Number(cfg.tolM)), Math.abs(Number(cfg.tolP)));
  return w >= 0.05 - 1e-9 ? Math.round(w * 1000) : null;
}
/** Short words for the correction, never with a key when the direction is not set. */
function internoWords(r) {
  if (!r) return '';
  if (r.none) return 'al centro: nessuna correzione';
  const um = String(round1(Math.abs(r.needUm))).replace('.', ',');
  return (r.action === 'allarga' ? 'allarga' : 'stringi') + ' di ' + um + ' µm' + (r.key ? ' → ' + r.key + ' ×' + r.presses : ' (verso del tasto da impostare)');
}

function stockWarnNear(candidates, stock, ideal) {
  if (ideal == null) return null;
  // warn if trend zone (ideal±3) has low stock
  const zone = [];
  for (let n = Math.floor(ideal) - 2; n <= Math.ceil(ideal) + 2; n++) zone.push(n);
  const low = zone.filter((n) => {
    const c = stock[String(n)];
    return c != null && c > 0 && c <= 2;
  });
  if (!low.length) return null;
  const total = low.reduce((s, n) => s + Number(stock[String(n)] || 0), 0);
  const lo = Math.min(...low);
  const hi = Math.max(...low);
  return 'tra poco ti servono i ' + lo + '–' + hi + ', ne hai ' + total;
}

/**
 * Training: check user answer for piece (+ optional presses toward target).
 */
function checkTrainingAnswer(S, base, giocoMin, giocoMax, userPezzo, opts) {
  opts = opts || {};
  const acc = calcAccoppiamento(S, base, giocoMin, giocoMax);
  const okPieces = new Set(acc.valid);
  const best = acc.recommended;
  const chosen = parseInt(userPezzo, 10);
  const pieceOk = okPieces.has(chosen);
  const pieceBest = best.includes(chosen);
  let pressesOk = null;
  let explanation = spiegazione(S, base, giocoMin, giocoMax, best).text;
  explanation += '. Pezzi validi: ' + acc.valid.join(', ') + '. Ideali: ' + best.join(' / ') + '.';
  if (opts.targetPezzo != null && opts.userKey != null) {
    const { target } = calcTarget(base, opts.targetPezzo, giocoMin, giocoMax);
    const corr = calcCorrezione(S, target, opts.machineRule || 'studer');
    pressesOk = corr.key === opts.userKey && corr.presses === Number(opts.userPresses || 0);
    if (!pressesOk && corr.key) {
      explanation += ' Correzione verso pezzo ' + opts.targetPezzo + ': ' + corr.key + ' ×' + corr.presses +
        ' (Δ ' + fmtUm(corr.diffUm) + ' µm).';
    }
  }
  const correct = pieceOk && (pressesOk === null || pressesOk);
  return {
    correct,
    pieceOk,
    pieceBest,
    pressesOk,
    valid: acc.valid,
    recommended: best,
    d: acc.d,
    explanation,
  };
}

/**
 * v2.0.0: measure the mating part (F) must have to be within gioco: F = S + gioco.
 * (The screen shows G = S − F, negative when there is clearance.) 4 decimals; centre = S + (min+max)/2.
 * For machines without numbered parts (e.g. Lizzini).
 */
function matingRange(S, giocoMin, giocoMax, mode) {
  if (S == null || giocoMin == null || giocoMax == null || Number.isNaN(Number(S))) return null;
  const lo = Math.min(giocoMin, giocoMax), hi = Math.max(giocoMin, giocoMax);
  const r = (x) => Math.round(x * 10000) / 10000;
  // v2.0.4: maschio measured → femmina F = S + gioco; femmina measured → maschio M = F − gioco
  if (mode === 'femmina') return { min: r(S - hi / 1000), max: r(S - lo / 1000), centro: r(S - (lo + hi) / 2000), giocoMin: lo, giocoMax: hi, of: 'maschio' };
  return { min: r(S + lo / 1000), max: r(S + hi / 1000), centro: r(S + (lo + hi) / 2000), giocoMin: lo, giocoMax: hi, of: 'femmina' };
}
/**
 * v2.0.4 «Femmina già fatta → misura da fare (maschio)»: target for the male = F − gioco.
 * With the male's current measure S (machine) → distance from the centre and presses (same math/keys as the correction card).
 */
function femminaTarget(F, giocoMin, giocoMax, S, machineRule) {
  const m = matingRange(F, giocoMin, giocoMax, 'femmina'); if (!m) return null;
  const out = { min: m.min, max: m.max, centro: m.centro, giocoMin: m.giocoMin, giocoMax: m.giocoMax, S: null, diffUm: null, inRange: null, gioco: null, presses: 0, key: '', action: '', none: false };
  if (S == null || Number.isNaN(Number(S))) return out;
  out.S = Number(S);
  out.diffUm = round1((m.centro - out.S) * 1000); // + = the male must become bigger
  out.gioco = round1((F - out.S) * 1000);
  out.inRange = out.gioco >= m.giocoMin - 1e-9 && out.gioco <= m.giocoMax + 1e-9;
  const rule = machineRule === 'plus_smaller' ? 'studer' : (machineRule || 'studer');
  if (Math.abs(out.diffUm) <= 0.5 + 1e-9) { out.none = true; out.action = 'nessuna correzione'; return out; }
  out.presses = Math.max(1, Math.ceil(Math.abs(out.diffUm) - 0.5 - 1e-9));
  const bigger = out.diffUm > 0;
  out.action = bigger ? 'più grande' : 'più piccolo';
  out.key = rule === 'studer' ? (bigger ? '−' : '+') : rule === 'plus_bigger' ? (bigger ? '+' : '−') : '';
  return out;
}
/** Label of the mating part: «femmina» when the measure is the maschio, and vice versa. */
function matingWho(mode) { return mode === 'femmina' ? 'maschio' : 'femmina'; }
function lavoroLabel(mode) { return mode === 'femmina' ? 'Femmina' : 'Maschio'; }
function fmtMm4(x) { return (x < 0 ? '-' : '') + Math.abs(x).toFixed(4).replace('.', ','); }
/** «Accoppiato da 18,0098 a 18,0128 mm · centro 18,0113 mm» */
function matingRangeText(m) {
  if (!m) return '';
  return 'Misura ' + (m.of || 'femmina') + ': da ' + fmtMm4(m.min) + ' a ' + fmtMm4(m.max) + ' mm · centro ' + fmtMm4(m.centro) + ' mm';
}

/**
 * v2.0.0 «Pezzi fatti»: pieces saved in the shift, total and per machine name (good / scarto).
 * nameOf(save) resolves the machine name (default: save.machineName). Biggest machine first.
 */
function shiftPieces(saves, nameOf) {
  const by = new Map();
  let buoni = 0, scarti = 0;
  for (const s of saves || []) {
    if (!s) continue;
    const raw = nameOf ? nameOf(s) : s.machineName;
    const name = String(raw || '').trim() || 'Senza macchina';
    const k = name.toLocaleLowerCase('it');
    if (!by.has(k)) by.set(k, { name, total: 0, buoni: 0, scarti: 0 });
    const m = by.get(k);
    m.total++;
    if (s.status === 'scarto') { m.scarti++; scarti++; } else { m.buoni++; buoni++; }
  }
  const byMachine = [...by.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'it'));
  return { total: buoni + scarti, buoni, scarti, byMachine };
}
/** «S33 O060 · 40 (38 buoni · 2 scarti)» – split shown only when there are scarti. */
function fmtMachineLine(m) {
  return m.name + ' · ' + m.total + (m.scarti ? ' (' + m.buoni + ' buoni · ' + m.scarti + (m.scarti === 1 ? ' scarto)' : ' scarti)') : '');
}

/**
 * Shift summary totals from saved pieces + pezzi portati via + checks.
 */
function summarizeShift(opts) {
  opts = opts || {};
  const saves = opts.saves || []; // {seriesId, seriesName, chosen, status, S, gioco, correction?:bool}
  const pezziPortati = opts.pezziPortati || 0;
  const bySeries = {};
  let buoni = 0, scarti = 0, correzioni = 0;
  const usedCount = {};
  for (const s of saves) {
    const sid = s.seriesId || 'x';
    if (!bySeries[sid]) bySeries[sid] = { seriesId: sid, name: s.seriesName || sid, count: 0, buoni: 0, scarti: 0 };
    bySeries[sid].count++;
    if (s.status === 'scarto') { scarti++; bySeries[sid].scarti++; }
    else { buoni++; bySeries[sid].buoni++; }
    if (s.correction) correzioni++;
    const n = s.chosen;
    if (n != null) usedCount[n] = (usedCount[n] || 0) + 1;
  }
  const mostUsed = Object.keys(usedCount)
    .map((k) => ({ n: parseInt(k, 10), count: usedCount[k] }))
    .sort((a, b) => b.count - a.count || a.n - b.n)
    .slice(0, 5);
  const fatti = shiftPieces(saves, opts.nameOf);
  return {
    total: saves.length,
    buoni,
    scarti,
    correzioni,
    pezziPortati: pezziPortati,
    byMachine: fatti.byMachine,
    bySeries: Object.values(bySeries),
    mostUsed,
    note: opts.note || '',
  };
}

/**
 * Generate a realistic training S near base given gioco band.
 */
function randomTrainingS(base, giocoMin, giocoMax, rng) {
  const rnd = rng || Math.random;
  // d in about -15..+10 µm around useful zone
  const dUm = Math.round((rnd() * 28) - 16);
  const S = round4(base + dUm / 1000);
  const acc = calcAccoppiamento(S, base, giocoMin, giocoMax);
  return { S, d: acc.d, recommended: acc.recommended, valid: acc.valid };
}


/**
 * Ovalità / conicità check. Shop rule: both must stay within about 2–3 µm.
 * ok: <= 2 µm · lim: > 2 and <= 3 µm · no: > 3 µm
 */
const FORM_OK_UM = 2;
const FORM_MAX_UM = 3;
function formStatus(um, okUm, maxUm) {
  if (um == null || um === '') return 'na'; // v1.9.4: non misurata
  const v = Math.abs(Number(um) || 0);
  const ok = Number.isFinite(okUm) ? okUm : FORM_OK_UM, mx = Number.isFinite(maxUm) ? maxUm : FORM_MAX_UM; // Beta 0.6.0: per-job limits
  if (v <= ok + 1e-9) return 'ok';
  if (v <= mx + 1e-9) return 'lim';
  return 'no';
}

/**
 * Taper (conicità) knob reminder for the user's Studer machines.
 * Knob is at the bottom of the machine: part bigger toward the far end ("in fondo")
 * → turn it toward yourself; bigger toward the near end ("davanti") → turn it the other way.
 * @param {number} conUm - measured conicità µm
 * @param {'davanti'|'fondo'|null} biggerEnd - which end is bigger
 * @param {{studer?: boolean, k?: number}} [opts] - studer=false → generic text (direction unknown); k = µm per tacca (if known → number of tacche)
 * @returns {{status:'ok'|'lim'|'no', show:boolean, needEnd:boolean, title:string, hint:string, turn:'verso'|'via'|null}}
 */
function taperHint(conUm, biggerEnd, opts) {
  opts = opts || {};
  const studer = opts.studer !== false;
  const v = Math.abs(Number(conUm) || 0);
  const status = conUm == null ? 'na' : formStatus(v, opts.okUm, opts.maxUm);
  const out = { status, show: status === 'lim' || status === 'no', needEnd: false, title: '', hint: '', turn: null, tacche: null, taccheText: '', knobText: '' };
  // v2.0.1: with the two-side control the side is known at once → direction shown for any taper > 0
  if (opts.always && conUm != null && v > 0) out.show = true;
  if (!out.show) return out;
  out.title = 'Conicità ' + fmtUm(v) + ' µm · ' + (status === 'ok' ? 'entro tolleranza' : status === 'lim' ? 'al limite' : 'fuori tolleranza') + ' (max ~' + (Number.isFinite(opts.maxUm) ? fmtUm(opts.maxUm) : FORM_MAX_UM) + ' µm)';
  const end = biggerEnd === 'fondo' || biggerEnd === 'davanti' ? biggerEnd : null;
  if (!end) { out.needEnd = true; out.hint = 'Dove è più grande il pezzo? Davanti o in fondo?'; return out; }
  const where = end === 'fondo' ? 'in fondo' : 'davanti';
  if (!studer) {
    out.hint = 'Pezzo più grande ' + where + ' → correggi la conicità (controlla il verso su questa macchina)';
    const kg = knobTacche(v, opts.k);
    if (kg) {
      out.tacche = kg.tacche; out.taccheText = kg.text;
      out.knobText = kg.tacche > 0 ? 'Gira circa ' + kg.text + ' (controlla il verso su questa macchina)' : 'Gira pochissimo (meno di mezza tacca)';
      out.hint = 'Pezzo più grande ' + where + ' → ' + out.knobText;
    }
    return out;
  }
  const toMe = (end === 'fondo') !== !!opts.invert; // Beta 0.6.0: machine with the knob direction inverted
  out.turn = toMe ? 'verso' : 'via';
  out.hint = 'Pezzo più grande ' + where + ' → gira la manopola della conicità ' +
    (toMe ? 'verso di te' : 'dalla parte opposta (via da te)');
  const kt = knobTacche(v, opts.k);
  if (kt) {
    out.tacche = kt.tacche;
    out.taccheText = kt.text;
    out.knobText = kt.tacche > 0
      ? 'Gira circa ' + kt.text + (toMe ? ' verso\u00a0di\u00a0te' : ' dall\'altra\u00a0parte')
      : 'Gira pochissimo (meno di mezza tacca) ' + (toMe ? 'verso\u00a0di\u00a0te' : 'dall\'altra\u00a0parte');
    out.hint = 'Pezzo più grande ' + where + ' → ' + out.knobText;
  }
  return out;
}

/**
 * v2.0.1 conicità control with two sides, «Davanti» and «In fondo» (µm, the side where the piece is BIGGER).
 * sides = { dav, fondo }: null = non misurata. Only one side can be non-zero: + on one side sets the other to 0.
 */
const TAPER_MAX_UM = 30;
function taperStep(sides, side, delta) {
  const s = { dav: sides && sides.dav != null ? sides.dav : null, fondo: sides && sides.fondo != null ? sides.fondo : null };
  const k = side === 'fondo' ? 'fondo' : 'dav', other = k === 'dav' ? 'fondo' : 'dav';
  const cur = s[k] == null ? 0 : s[k];
  if (delta > 0) { s[k] = Math.min(TAPER_MAX_UM, cur + delta); s[other] = 0; }
  else { s[k] = Math.max(0, cur + delta); if (s[other] == null) s[other] = 0; }
  return s;
}
/** Tap on a «—» value: measured, no taper (both sides 0). Measured values are kept. */
function taperTouch(sides) {
  if (sides && (sides.dav != null || sides.fondo != null)) return { dav: sides.dav || 0, fondo: sides.fondo || 0 };
  return { dav: 0, fondo: 0 };
}
/** → { con (µm or null = non misurata), conEnd ('davanti' | 'fondo' | null) } for status, knob hint and history. */
function taperFromSides(sides) {
  if (!sides || (sides.dav == null && sides.fondo == null)) return { con: null, conEnd: null };
  const d = Number(sides.dav) || 0, f = Number(sides.fondo) || 0;
  if (d > 0) return { con: d, conEnd: 'davanti' };
  if (f > 0) return { con: f, conEnd: 'fondo' };
  return { con: 0, conEnd: null };
}
const TAPER_SIDE_LBL = { davanti: 'davanti', fondo: 'in fondo' };

/**
 * Taper knob: µm of conicità per tacca (k) for a machine. No public value exists → unknown by default.
 * Valid k range guards against typos (0.05–50 µm per tacca).
 */
const KNOB_K_MIN = 0.05;
const KNOB_K_MAX = 50;
function validKnobK(k) {
  const v = Number(k);
  return Number.isFinite(v) && v >= KNOB_K_MIN && v <= KNOB_K_MAX;
}
/** Parse a typed k ("1,5" or "1.5"); returns number or null. */
function parseKnobK(raw) {
  if (raw == null) return null;
  const t = String(raw).trim().replace(',', '.');
  if (!/^\d*\.?\d+$/.test(t)) return null;
  const v = Number(t);
  return validKnobK(v) ? Math.round(v * 100) / 100 : null;
}
/** Format a number of tacche (0.5 steps) in Italian: "1 tacca", "1,5 tacche", "mezza tacca". */
function fmtTacche(x) {
  if (x === 0.5) return 'mezza tacca';
  if (x === 1) return '1 tacca';
  return String(x).replace('.', ',') + ' tacche';
}
/**
 * How many tacche for a given conicità: X = conicità / k, rounded DOWN to 0.5 (never over-correct).
 * @returns {{tacche:number, exact:number, text:string}|null} null if k unknown/invalid or conicità 0
 */
function knobTacche(conUm, k) {
  if (!validKnobK(k)) return null;
  const v = Math.abs(Number(conUm) || 0);
  if (v <= 0) return null;
  const exact = v / Number(k);
  const tacche = Math.floor(exact * 2 + 1e-9) / 2;
  return { tacche, exact: Math.round(exact * 100) / 100, text: tacche > 0 ? fmtTacche(tacche) : '' };
}
/**
 * Signed conicità for calibration: bigger "in fondo" = +, bigger "davanti" = −.
 * Lets a turn that goes through zero (4 in fondo → 2 davanti = 6 µm) be counted right.
 */
function signedCon(um, end) {
  const v = Math.abs(Number(um) || 0);
  return end === 'davanti' ? -v : v;
}
/**
 * One calibration trial: k = |T1 − T0| / N.
 * @param {{t0:number,t1:number,n:number,end0?:string,end1?:string}} tr
 * @returns {{ok:boolean,k:number|null,delta:number,error:string}}
 */
function knobTrialK(tr) {
  tr = tr || {};
  const n = Number(tr.n);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, k: null, delta: 0, error: 'Numero di tacche non valido' };
  const a = signedCon(tr.t0, tr.end0), b = signedCon(tr.t1, tr.end1);
  const delta = Math.round(Math.abs(b - a) * 100) / 100;
  if (delta <= 0) return { ok: false, k: null, delta, error: 'La conicità non è cambiata: gira di più tacche e riprova' };
  const k = Math.round((delta / n) * 100) / 100;
  if (!validKnobK(k)) return { ok: false, k, delta, error: 'Valore strano (' + String(k).replace('.', ',') + ' µm/tacca): ricontrolla le misure' };
  return { ok: true, k, delta, error: '' };
}
/**
 * Average k over repeated trials. spread = (max−min)/avg; warn when > 30 %.
 * @returns {{k:number|null, ks:number[], count:number, spread:number, warn:boolean}}
 */
function calibrateKnob(trials) {
  const ks = (trials || []).map(knobTrialK).filter((r) => r.ok).map((r) => r.k);
  if (!ks.length) return { k: null, ks, count: 0, spread: 0, warn: false };
  const avg = ks.reduce((a, b) => a + b, 0) / ks.length;
  const spread = ks.length > 1 ? (Math.max.apply(null, ks) - Math.min.apply(null, ks)) / avg : 0;
  return { k: Math.round(avg * 100) / 100, ks, count: ks.length, spread: Math.round(spread * 100) / 100, warn: spread > 0.3 };
}

/**
 * Which stock cells to show in the compact "Pezzi sul tavolo" grid.
 * Compact: window center-3..center+4 (8 cells, like the result ruler) plus any number with count > 0.
 * All: range lo..hi.
 */
function stockVisibleNums(stock, center, showAll, lo, hi) {
  lo = lo == null ? -10 : lo; hi = hi == null ? 25 : hi;
  const set = new Set();
  if (showAll) { for (let n = lo; n <= hi; n++) set.add(n); }
  else {
    const c = Math.round(Number(center) || 0);
    for (let n = c - 3; n <= c + 4; n++) set.add(n);
    Object.keys(stock || {}).forEach((k) => { const n = parseInt(k, 10); if (!Number.isNaN(n) && Number(stock[k]) > 0) set.add(n); });
  }
  return Array.from(set).sort((a, b) => a - b);
}



/** S in mm: 3 decimals, 4 when the 4th is significant (21,9966 stays 21,9966). */
function fmtMmS(x) {
  if (x == null || Number.isNaN(Number(x))) return '—';
  const n4 = Math.round(Number(x) * 10000);
  return n4 % 10 === 0 ? fmtMm3(x) : (n4 / 10000).toFixed(4).replace('.', ',');
}
/** Gioco of any part (also outside the valid range). */
function giocoOf(n, acc) { return round1(lavoroSign(acc && acc.mode) * (n - acc.d)); }

/** Parse a whole number of µm ("7", " 10 "); decimals/garbage → null. */
function parseGiocoInt(raw) {
  const t = String(raw == null ? '' : raw).trim().replace(/^[−–]/, '-');
  if (!/^-?\d{1,3}$/.test(t)) return null;
  return parseInt(t, 10);
}
function parseMmNumber(raw) {
  const t = String(raw == null ? '' : raw).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
/**
 * Validate the series form. Base 1–300 mm, tol empty or 0–1 mm, gioco whole µm 0–100 with min < max.
 * @returns {{ok:boolean, error:string, value?:{base:number,tolleranza:number|null,giocoMin:number,giocoMax:number}}}
 */
function validateSeriesInput(raw) {
  const base = parseMmNumber(raw.base);
  if (base == null || base < 1 || base > 300) return { ok: false, error: 'Base non valida (es. 24,600)' };
  let tol = null;
  if (String(raw.tol == null ? '' : raw.tol).trim()) {
    tol = parseMmNumber(raw.tol);
    if (tol == null || tol <= 0 || tol > 1) return { ok: false, error: 'Tolleranza non valida (es. 0,1)' };
  }
  const gmin = parseGiocoInt(raw.gmin), gmax = parseGiocoInt(raw.gmax);
  if (gmin == null || gmax == null) return { ok: false, error: 'Gioco: scrivi numeri interi in µm (es. 7 e 10)' };
  if (gmin < 0 || gmax > 100) return { ok: false, error: 'Gioco tra 0 e 100 µm' };
  if (gmax <= gmin) return { ok: false, error: 'Gioco max deve essere più grande del min' };
  return { ok: true, error: '', value: { base: round4(base), tolleranza: tol, giocoMin: gmin, giocoMax: gmax } };
}

/**
 * Check an imported backup. Repairs text numbers ("24,6"), drops series that stay invalid.
 * @returns {{ok:boolean, error:string, data?:object, dropped:number}}
 */
function sanitizeImport(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.machines) || !Array.isArray(data.series))
    return { ok: false, error: 'File non valido', dropped: 0 };
  const num = (v) => { if (typeof v === 'number') return Number.isFinite(v) ? v : null; const n = parseMmNumber(v); return n; };
  const int = (v) => { if (typeof v === 'number') return Number.isInteger(v) ? v : null; return parseGiocoInt(v); };
  const machines = data.machines.filter((m) => m && typeof m === 'object' && m.id != null)
    .map((m) => Object.assign({}, m, { id: String(m.id), name: String(m.name == null ? 'Macchina' : m.name).slice(0, 60) || 'Macchina' }));
  let dropped = 0;
  const series = [];
  for (const s of data.series) {
    if (!s || typeof s !== 'object' || s.id == null) { dropped++; continue; }
    const base = num(s.base), gmin = int(s.giocoMin), gmax = int(s.giocoMax);
    let tol = s.tolleranza == null || s.tolleranza === '' ? null : num(s.tolleranza);
    if (tol != null && (tol <= 0 || tol > 1)) tol = null;
    if (base == null || base < 1 || base > 300 || gmin == null || gmax == null || gmax <= gmin || gmin < 0 || gmax > 100) { dropped++; continue; }
    const history = Array.isArray(s.history) ? s.history.filter((h) => h && typeof h.S === 'number' && Number.isFinite(h.S)) : [];
    const stock = s.stock && typeof s.stock === 'object' ? s.stock : {};
    series.push(Object.assign({}, s, { id: String(s.id), machineId: s.machineId != null ? String(s.machineId) : null, base, tolleranza: tol, giocoMin: gmin, giocoMax: gmax, history, stock }));
  }
  const out = Object.assign({}, data, { machines, series });
  return { ok: true, error: '', data: out, dropped };
}

/**
 * Beta 0.1.0: check a backup file BEFORE importing. Accepts the wrapped Beta format
 * ({format:'rettifica-backup', data:{...}}) and the raw state of OmT/older exports.
 * Nothing is changed here; it only reports what the file contains.
 * @returns {{ok:boolean, error:string, data:object|null, info:{app:string, appVersion:string, exportedAt:string, machines:number, series:number, measures:number, femmine:number, turni:number, dropped:number}|null}}
 */
const BACKUP_FORMAT = 'rettifica-backup';
function wrapBackup(state, appVersion, nowIso) {
  return { format: BACKUP_FORMAT, formatVersion: 1, app: 'rettifica-beta', appVersion: appVersion, exportedAt: nowIso,
    unita: 'misure = diametri in mm; gioco e conicità in µm', data: state };
}
function inspectBackup(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Il file non è un backup di Rettifica', data: null, info: null };
  let meta = { app: 'sconosciuta (vecchio formato)', appVersion: '', exportedAt: '' };
  let data = raw;
  if (raw.format !== undefined) {
    if (raw.format !== BACKUP_FORMAT) return { ok: false, error: 'Formato file sconosciuto', data: null, info: null };
    if (!(Number(raw.formatVersion) >= 1) || Number(raw.formatVersion) > 1) return { ok: false, error: 'Backup di una versione più nuova: aggiorna l\'app', data: null, info: null };
    meta = { app: String(raw.app || ''), appVersion: String(raw.appVersion || ''), exportedAt: String(raw.exportedAt || '') };
    data = raw.data;
  } else if (Array.isArray(raw.machines) && Array.isArray(raw.series)) {
    meta.app = 'Rettifica OmT o versione precedente';
  }
  const res = sanitizeImport(data);
  if (!res.ok) return { ok: false, error: res.error, data: null, info: null };
  if (!res.data.series.length && !res.data.machines.length) return { ok: false, error: 'Il backup è vuoto', data: null, info: null };
  const d = res.data;
  const measures = d.series.reduce((a, s) => a + s.history.length, 0);
  return { ok: true, error: '', data: d, info: Object.assign(meta, {
    machines: d.machines.length, series: d.series.length, measures,
    femmine: Array.isArray(d.femmine) ? d.femmine.length : 0,
    turni: Array.isArray(d.turniArchivio) ? d.turniArchivio.length : 0, dropped: res.dropped }) };
}
/** Rolling list of automatic local backups (newest first, max n). Pure: returns the new list. */
function pushBackupList(list, entry, n) {
  const l = Array.isArray(list) ? list.slice() : [];
  l.unshift(entry); return l.slice(0, n || 5);
}

/**
 * Pick the series for a photo from the measured values. Nominal read on the photo wins only when S agrees.
 * @returns {{series:object|null, how:string, plausible:boolean, distMm:number|null}}
 */
function pickSeriesForValues(seriesList, v, currentId) {
  const list = seriesList || [];
  const S = v && typeof v.S === 'number' ? v.S : null;
  const F = v && typeof v.F === 'number' ? v.F : null;
  const ref = S != null ? S : F;
  const pref = (a, b) => (a.id === currentId ? -1 : b.id === currentId ? 1 : 0);
  if (v && v.nominal != null) {
    const m = list.filter((s) => Math.abs(s.base - v.nominal) < 0.0005).sort(pref)[0];
    const nearest = ref == null ? null : list.slice().sort((a, b) => Math.abs(ref - a.base) - Math.abs(ref - b.base))[0];
    const nearestOk = !nearest || !m || Math.abs(ref - m.base) - Math.abs(ref - nearest.base) < 0.0005;
    if (m && nearestOk && (ref == null || Math.abs(ref - m.base) <= hardLimitMm(m.tolleranza))) return { series: m, how: 'nominale', plausible: true, distMm: ref == null ? null : Math.abs(ref - m.base) };
  }
  if (ref == null) return { series: null, how: 'nessuna', plausible: false, distMm: null };
  const best = list.slice().sort((a, b) => (Math.abs(ref - a.base) - Math.abs(ref - b.base)) || pref(a, b))[0];
  if (!best) return { series: null, how: 'nessuna', plausible: false, distMm: null };
  const dist = Math.abs(ref - best.base);
  return { series: best, how: 'valori', plausible: dist <= hardLimitMm(best.tolleranza), distMm: dist };
}

/** CSV (separator ";", Italian decimals) of saved measures. rows: {ts, machine, base, lotto, S, d, chosen, gioco, oval, con, status} */
/**
 * v1.9.5 – the photo drives the job.
 * v = { S, F, nominal (from the photo label or null), tol (photo ± or null), gmin, gmax (photo G row or null) }
 * Returns { action, series, base, tol, gmin, gmax, inTol, distMm, note }
 *   action: 'use'    → existing series, same gioco (or no gioco on the photo)
 *           'update' → existing series with the photo base, gioco differs → photo gioco wins (saved)
 *           'create' → no series with the photo base → new series from the photo
 *           'values' → no usable nominal, series chosen from S/F (photo gioco used only for this calc)
 *           'block'  → S/F fit neither the photo nominal nor any series
 *           'manual' → nothing to go on (no S/F, no nominal)
 */
function planPhotoSeries(seriesList, v, currentId) {
  const list = seriesList || [];
  const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const S = num(v && v.S), F = num(v && v.F), nominal = num(v && v.nominal);
  const ref = S != null ? S : F;
  const gmin = Number.isInteger(v && v.gmin) ? v.gmin : null, gmax = Number.isInteger(v && v.gmax) ? v.gmax : null;
  const hasG = gmin != null && gmax != null && gmax > gmin && gmin >= 0 && gmax <= 100;
  const pref = (a, b) => (a.id === currentId ? -1 : b.id === currentId ? 1 : 0);
  const out = (o) => Object.assign({ series: null, base: null, tol: null, gmin: hasG ? gmin : null, gmax: hasG ? gmax : null, inTol: true, distMm: null, note: '' }, o);
  if (nominal != null && nominal >= 1 && nominal <= 300) {
    const tolP = num(v.tol) != null && v.tol > 0 && v.tol <= 1 ? v.tol : null;
    const tolN = tolP != null ? tolP : 0.1;
    // the nominal counts if S (or F) fits it: within the hard limit, ideally within its ± tolerance
    const fitsOf = (x) => x != null && Math.abs(x - nominal) <= hardLimitMm(tolN) + 1e-9;
    // misread label guard: an existing series much nearer to S (and S inside its tolerance) beats the nominal
    const dN = ref == null ? null : Math.abs(ref - nominal);
    const rival = ref == null ? null : list.filter((s) => Math.abs(s.base - nominal) >= 0.0005 && Math.abs(ref - s.base) <= seriesTol(s) + 1e-9)
      .sort((a, b) => Math.abs(ref - a.base) - Math.abs(ref - b.base))[0];
    const rivalWins = rival && Math.abs(ref - rival.base) * 2 < dN && dN > 0.01;
    if (!rivalWins && (ref == null || fitsOf(S) || (S == null && fitsOf(F)))) {
      const dist = ref == null ? null : Math.abs(ref - nominal);
      const inTol = dist == null || dist <= tolN + 1e-9;
      const same = list.filter((s) => Math.abs(s.base - nominal) < 0.0005).sort(pref)[0];
      if (same) {
        if (hasG && (same.giocoMin !== gmin || same.giocoMax !== gmax)) {
          return out({ action: 'update', series: same, base: same.base, tol: tolP, inTol, distMm: dist,
            note: `Base ${fmtMm3(same.base)}: gioco aggiornato ${same.giocoMin}–${same.giocoMax} → ${gmin}–${gmax} µm (dalla foto)` });
        }
        return out({ action: 'use', series: same, base: same.base, tol: tolP, inTol, distMm: dist, gmin: hasG ? gmin : same.giocoMin, gmax: hasG ? gmax : same.giocoMax, note: `Base ${fmtMm3(same.base)} letta dalla foto` });
      }
      return out({ action: 'create', base: round4(nominal), tol: tolN, inTol, distMm: dist,
        note: hasG ? `Nuova serie Base ${fmtMm3(nominal)} · gioco ${gmin}–${gmax} creata dalla foto` : `Nuova serie Base ${fmtMm3(nominal)} dalla foto: scrivi il gioco` });
    }
  }
  if (ref == null) return out({ action: 'manual' });
  const best = list.slice().sort((a, b) => (Math.abs(ref - a.base) - Math.abs(ref - b.base)) || pref(a, b))[0];
  if (best && Math.abs(ref - best.base) <= hardLimitMm(best.tolleranza) + 1e-9) {
    const dist = Math.abs(ref - best.base);
    return out({ action: 'values', series: best, base: best.base, inTol: dist <= seriesTol(best) + 1e-9, distMm: dist,
      gmin: hasG ? gmin : best.giocoMin, gmax: hasG ? gmax : best.giocoMax,
      note: nominal != null ? `Base ${fmtMm3(nominal)} letta dalla foto non torna con S: uso Base ${fmtMm3(best.base)} (dalle misure)` : `Serie scelta dalle misure: Base ${fmtMm3(best.base)}` });
  }
  return out({ action: 'block', series: best || null, distMm: best ? Math.abs(ref - best.base) : null,
    note: `Le misure (${S != null ? 'S ' + fmtMmS(S) : 'F ' + fmtMmS(F)}) non corrispondono né alla foto né a nessuna serie: controlla.` });
}
/** v1.9.7: confirmation shown on the new-measure screen after a save. */
function fmtSaveMsg(n, gioco, status) {
  return 'Salvato pezzo ' + n + ' · gioco ' + fmtUm(gioco) + ' µm' + (status === 'scarto' ? ' · SCARTO' : '');
}
/* ---------- v1.9.6: Lavori (jobs) ---------- */
/** Local calendar day 'YYYY-MM-DD' (not UTC: a shift at 00:30 in Italy is still that day). */
function localDayKey(d) {
  const x = d instanceof Date ? d : new Date(d == null ? Date.now() : d);
  const p = (n) => String(n).padStart(2, '0');
  return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
}
function cloneKnob(k) { return k && typeof k === 'object' ? JSON.parse(JSON.stringify(k)) : null; }
function makeJob(o) {
  const now = o.now != null ? new Date(o.now) : new Date();
  const s = o.series || null;
  return {
    id: o.id || ('job_' + now.getTime().toString(36) + '_' + Math.random().toString(36).slice(2, 6)),
    day: localDayKey(now), createdAt: now.toISOString(), updatedAt: now.toISOString(),
    machineName: String(o.machineName || '').replace(/\s+/g, ' ').trim().slice(0, 40), // v2.0.6: may be empty (clean first start)
    knob: cloneKnob(o.knob), seriesId: s ? s.id : (o.seriesId || null),
    base: s ? s.base : (o.base != null ? o.base : null), giocoMin: s ? s.giocoMin : null, giocoMax: s ? s.giocoMax : null,
    codice: String(o.codice || '').trim().slice(0, 40), lotto: String(o.lotto || '').trim().slice(0, 40),
    legacy: !!o.legacy,
  };
}
/** Make sure state.jobs / state.jobsArchive exist; with no jobs, the current context becomes the first job (no data loss). */
function ensureJobs(state, ctx) {
  if (!Array.isArray(state.jobs)) state.jobs = [];
  if (!Array.isArray(state.jobsArchive)) state.jobsArchive = [];
  state.jobs = state.jobs.filter((j) => j && typeof j === 'object' && j.id);
  let created = null;
  if (!state.jobs.length) {
    created = makeJob({ machineName: ctx.machineName, knob: ctx.knob, series: ctx.series, now: ctx.now, legacy: true });
    state.jobs.push(created);
  }
  return created;
}
/** Jobs of previous days go to the archive (never deleted). The active job stays until another one is started. */
function rolloverJobs(state, today, activeId, keepMax) {
  const max = keepMax || 1000;
  const old = state.jobs.filter((j) => j.day < today && j.id !== activeId);
  if (!old.length) return 0;
  state.jobs = state.jobs.filter((j) => !(j.day < today && j.id !== activeId));
  state.jobsArchive = (state.jobsArchive || []).concat(old);
  if (state.jobsArchive.length > max) state.jobsArchive = state.jobsArchive.slice(-max);
  return old.length;
}
/** Pieces saved in a job and the last measure. Legacy (migrated) job also counts untagged saves of its series on its day. */
function jobStats(job, seriesList) {
  let count = 0, last = null;
  for (const s of seriesList || []) {
    for (const h of s.history || []) {
      const mine = h.jobId ? h.jobId === job.id : (job.legacy && s.id === job.seriesId && h.ts && localDayKey(h.ts) === job.day);
      if (!mine) continue;
      count++;
      if (!last || String(h.ts) > String(last.ts)) last = { S: h.S, ts: h.ts, chosen: h.chosen, status: h.status, seriesId: s.id };
    }
  }
  return { count, last };
}
/** Latest known knob for a machine name (jobs first, then archive). */
function knobForMachineName(state, name) {
  const n = String(name || '').trim().toLowerCase(); if (!n) return null;
  // newest calibration wins (knob.updatedAt); a reset (k = null) also counts
  // v2.0.3: calibrations of deleted jobs are kept in state.knobsByName (removed only on explicit choice)
  const kept = state.knobsByName && state.knobsByName[n] ? [{ machineName: n, knob: state.knobsByName[n] }] : [];
  const all = kept.concat(state.jobsArchive || [], state.jobs || []).filter((j) => String(j.machineName || '').trim().toLowerCase() === n && j.knob && (j.knob.updatedAt || validKnobK(j.knob.k)));
  all.sort((a, b) => String(a.knob.updatedAt || '').localeCompare(String(b.knob.updatedAt || '')));
  return all.length ? cloneKnob(all[all.length - 1].knob) : null;
}
/**
 * v2.0.3 delete a job (today's list or archive). Its saved pieces stay in Storico / Turno unless opts.withPieces.
 * The machine's knob calibration is kept (state.knobsByName) unless opts.withKnob. Returns an undo snapshot or null.
 */
const jobKey = (name) => String(name || '').trim().toLowerCase();
function jobPieceMatch(job) {
  return (h, s) => (h.jobId ? h.jobId === job.id : (job.legacy && s.id === job.seriesId && h.ts && localDayKey(h.ts) === job.day));
}
function deleteJob(state, jobId, opts) {
  opts = opts || {};
  let where = 'jobs', idx = (state.jobs || []).findIndex((j) => j.id === jobId);
  if (idx < 0) { where = 'jobsArchive'; idx = (state.jobsArchive || []).findIndex((j) => j.id === jobId); }
  if (idx < 0) return null;
  const job = state[where][idx];
  const snap = { job, where, idx, pieces: [], saves: [], stamped: [], knobs: null, withPieces: !!opts.withPieces, withKnob: !!opts.withKnob };
  const mine = jobPieceMatch(job);
  const removedIds = new Set();
  for (const s of (state.series || []).concat(state.seriesArchive || [])) {
    const hist = s.history || [];
    for (let i = hist.length - 1; i >= 0; i--) {
      const h = hist[i]; if (!mine(h, s)) continue;
      if (snap.withPieces) { snap.pieces.push({ seriesId: s.id, i, h }); hist.splice(i, 1); if (h.id) removedIds.add(h.id); }
      else if (!h.machineName) { h.machineName = job.machineName; snap.stamped.push(h); } // name stays readable without the job
    }
  }
  const saves = (state.turno && state.turno.saves) || [];
  for (let i = saves.length - 1; i >= 0; i--) {
    const sv = saves[i];
    const of = sv.jobId === job.id || removedIds.has(sv.id);
    if (!of) continue;
    if (snap.withPieces) { snap.saves.push({ i, sv }); saves.splice(i, 1); }
    else if (!sv.machineName) { sv.machineName = job.machineName; snap.stamped.push(sv); }
  }
  snap.removedIds = [...removedIds];
  // knob: keep the calibration under the machine name unless explicitly removed
  const n = jobKey(job.machineName);
  if (snap.withKnob) snap.knobs = clearKnobForName(state, n);
  else if (job.knob && (job.knob.updatedAt || validKnobK(job.knob.k))) {
    state.knobsByName = state.knobsByName || {};
    const cur = state.knobsByName[n];
    snap.prevKept = cur ? cloneKnob(cur) : null;
    if (!cur || String(job.knob.updatedAt || '') >= String(cur.updatedAt || '')) state.knobsByName[n] = cloneKnob(job.knob);
  }
  state[where].splice(idx, 1);
  return snap;
}
/** Remove a machine's knob calibration everywhere (explicit choice). Returns what is needed to undo it. */
function clearKnobForName(state, name) {
  const n = jobKey(name); const out = { kept: null, jobs: [] };
  if (state.knobsByName && state.knobsByName[n]) { out.kept = state.knobsByName[n]; delete state.knobsByName[n]; }
  for (const j of (state.jobs || []).concat(state.jobsArchive || [])) {
    if (jobKey(j.machineName) === n && j.knob && (j.knob.updatedAt || validKnobK(j.knob.k))) { out.jobs.push({ j, knob: j.knob }); j.knob = { k: null, L0: null, trials: [], source: null, updatedAt: null }; }
  }
  return out;
}
function restoreKnobForName(state, name, out) {
  if (!out) return;
  if (out.kept) { state.knobsByName = state.knobsByName || {}; state.knobsByName[jobKey(name)] = out.kept; }
  for (const r of out.jobs) r.j.knob = r.knob;
}
function restoreJob(state, snap) {
  if (!snap) return false;
  const list = state[snap.where] = state[snap.where] || [];
  list.splice(Math.min(snap.idx, list.length), 0, snap.job);
  for (const p of snap.pieces.slice().reverse()) {
    const s = (state.series || []).concat(state.seriesArchive || []).find((x) => x.id === p.seriesId); if (!s) continue;
    s.history = s.history || []; s.history.splice(Math.min(p.i, s.history.length), 0, p.h);
  }
  if (snap.saves.length) {
    state.turno = state.turno || { saves: [] }; state.turno.saves = state.turno.saves || [];
    for (const r of snap.saves.slice().reverse()) state.turno.saves.splice(Math.min(r.i, state.turno.saves.length), 0, r.sv);
  }
  for (const h of snap.stamped) delete h.machineName;
  if (snap.withKnob) restoreKnobForName(state, snap.job.machineName, snap.knobs);
  else if (state.knobsByName) {
    const n = jobKey(snap.job.machineName);
    if (snap.prevKept) state.knobsByName[n] = snap.prevKept; else if ('prevKept' in snap) delete state.knobsByName[n];
  }
  return true;
}
/**
 * v2.0.3 delete a series (base): it leaves the lists/pickers but goes to state.seriesArchive with its history,
 * so saved measures stay in Storico / CSV / job counts. Returns an undo snapshot or null.
 */
function deleteSeries(state, id, now) {
  const idx = (state.series || []).findIndex((s) => s.id === id); if (idx < 0) return null;
  const s = state.series[idx];
  state.series.splice(idx, 1);
  s.deletedAt = new Date(now != null ? now : Date.now()).toISOString();
  state.seriesArchive = state.seriesArchive || []; state.seriesArchive.push(s);
  return { series: s, idx };
}
function restoreSeries(state, snap) {
  if (!snap || !snap.series) return false;
  state.seriesArchive = (state.seriesArchive || []).filter((s) => s !== snap.series && s.id !== snap.series.id);
  delete snap.series.deletedAt;
  state.series = state.series || []; state.series.splice(Math.min(snap.idx, state.series.length), 0, snap.series);
  return true;
}
/** Series to use after deleting the active one: the most recently measured, else the first; null → none left. */
function nextSeriesAfterDelete(seriesList, lastBySeries) {
  const l = (seriesList || []).slice(); if (!l.length) return null;
  const ts = (s) => String((lastBySeries && lastBySeries[s.id] && lastBySeries[s.id].ts) || (s.history || []).reduce((m, h) => (String(h.ts || '') > m ? String(h.ts) : m), ''));
  l.sort((a, b) => ts(b).localeCompare(ts(a)));
  return l[0];
}

/** Which job becomes active after deleting the active one: newest of today, else newest overall, else null. */
function nextActiveJob(state, today) {
  const t = jobsForToday(state, today, null);
  if (t.length) return t[0];
  const all = (state.jobs || []).slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return all[0] || null;
}

/**
 * v2.0.3 «Nuovo lavoro» photo = SETUP ONLY. Fields read from the photo (no pairing, no verdict, nothing blocks).
 * Unreadable → empty (editable). baseGuess = rounded S/F, offered only as a one-tap suggestion.
 */
function jobSetupFromParsed(parsed, machineName) {
  const p = parsed || {}, h = p.header || {};
  const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const base = p.baseSource === 'foto' ? num(p.base) : null;
  const ref = num(p.S1A) != null ? num(p.S1A) : num(p.F1A);
  const baseGuess = base == null && ref != null && ref > 0.5 && ref < 2000 ? Math.round(ref * 10) / 10 : null;
  let gmin = num(p.giocoMin), gmax = num(p.giocoMax);
  if (gmin == null || gmax == null) { gmin = null; gmax = null; } else if (gmin > gmax) { const x = gmin; gmin = gmax; gmax = x; }
  const tol = num(p.tolleranza);
  return { machineName: String(machineName || '').trim(), base, baseGuess, tol: tol != null && tol > 0 && tol < 5 ? tol : null, gmin, gmax,
    codice: String(h.codice || '').trim(), lotto: h.lotto != null ? String(h.lotto).trim() : '' };
}
/**
 * v2.0.6 gioco typed as µm (7, 10, 7,5) or in the sheet format (-0,007 / -0,01 / 0,007 mm) → positive µm (1 decimal).
 * A value with a separator and |v| < 1 is mm. Garbage → null.
 */
function normGiocoUm(v) {
  const s = String(v == null ? '' : v).trim().replace(/\s+/g, '').replace(/µm|um|mm$/i, '');
  if (!s || !/\d/.test(s)) return null;
  const n = parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const a = Math.abs(n);
  const um = /[,.]/.test(s) && a < 1 ? a * 1000 : a;
  return um > 500 ? null : Math.round(um * 10) / 10;
}
/** min/max in order (null kept) */
function orderGioco(a, b) { if (a != null && b != null && a > b) return [b, a]; return [a, b]; }
/** v2.0.6 «Adatta alla femmina» 📷: F1A = female, F nominal ± tol, G row → gioco, S1A → optional male. Missing → null (never blocks). */
function femFromParsed(parsed) {
  const p = parsed || {}, r = (p.rows && p.rows.F1A) || {};
  const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const nom = num(r.tolBase) != null ? num(r.tolBase) : (p.baseSource === 'foto' ? num(p.base) : null);
  const tol = num(r.tolMm) != null ? num(r.tolMm) : num(p.tolleranza);
  const [gmin, gmax] = orderGioco(normGiocoUm(p.giocoMin), normGiocoUm(p.giocoMax));
  return { F: num(p.F1A), S: num(p.S1A), nom, tol: tol != null && tol > 0 && tol < 5 ? tol : null, gmin, gmax };
}
/** Lenient readers for the setup form: '' / garbage → null (never an error). */
function setupNum(v) {
  const s = String(v == null ? '' : v).trim().replace(/\s+/g, '').replace(/^±/, '');
  if (!s) return null;
  const n = parseFloat(s.replace(/\.(?=.*[,.])/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function setupInt(v) { const n = setupNum(v); return n == null ? null : Math.round(Math.abs(n) < 1 && n !== 0 ? Math.abs(n) * 1000 : Math.abs(n)); }
/**
 * Which series the job uses: same base → that series (gioco / tol from the setup when given);
 * new base with gioco → new series; base without gioco and no match → none (the user completes it on Calcolo).
 */
function planJobSetup(seriesList, f) {
  const base = f && f.base != null && f.base > 0 ? Math.round(f.base * 10000) / 10000 : null;
  if (base == null) return { action: 'none', reason: 'base' };
  const g = f.gmin != null && f.gmax != null ? { min: Math.min(f.gmin, f.gmax), max: Math.max(f.gmin, f.gmax) } : null;
  const ser = (seriesList || []).find((s) => Math.abs(s.base - base) < 0.0005) || null;
  if (ser) return { action: 'use', series: ser, base, gioco: g, tol: f.tol, changes: !!(g && (g.min !== ser.giocoMin || g.max !== ser.giocoMax)) || (f.tol != null && f.tol !== ser.tolleranza) };
  if (!g) return { action: 'none', reason: 'gioco', base };
  return { action: 'create', base, gioco: g, tol: f.tol != null ? f.tol : 0.1 };
}

/** Today's list: today's jobs + the active one (even if started yesterday), newest activity first. */
function jobsForToday(state, today, activeId) {
  return (state.jobs || []).filter((j) => j.day === today || j.id === activeId)
    .slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
function historyCsv(rows) {
  const q = (x) => { const t = x == null ? '' : String(x); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const dec = (x, f) => (x == null || x === '' || Number.isNaN(Number(x)) ? '' : f(Number(x)));
  // v2.0.1: conicità + side where the piece is bigger; ovalità kept only for older measures (no longer entered)
  // v2.0.4: «Lavoro» = which part was measured (maschio S / femmina F); «Pezzo» = numbered mating part (femmina / maschio)
  const head = ['Data', 'Ora', 'Macchina', 'Base (diametro) mm', 'Lotto', 'Lavoro', 'Misura (diametro) mm', 'Scarto dalla base µm', 'Pezzo accoppiato', 'Gioco µm (femmina − maschio, positivo)', 'Conicità µm', 'Conicità più grande', 'Ovalità µm (vecchie misure)', 'Esito'];
  const lines = [head.join(';')];
  for (const r of rows || []) {
    const d = r.ts ? new Date(r.ts) : null;
    const pad = (n) => String(n).padStart(2, '0');
    lines.push([
      d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : '',
      d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : '',
      q(r.machine), dec(r.base, fmtMm3), q(r.lotto), r.lavoro === 'interno' ? 'interno (foro misurato)' : r.lavoro === 'femmina' ? 'femmina (F misurata)' : 'maschio (S misurato)', dec(r.S, fmtMmS), dec(r.d, fmtUm), r.interno ? 'quota foro ' + fmtMm4(r.interno.lo) + '–' + fmtMm4(r.interno.hi) + (r.interno.action ? ' · ' + r.interno.action + ' ' + fmtUm(Math.abs(r.interno.devUm)) + ' µm' : '') : r.target != null ? 'maschio da fare ' + fmtMm4(r.target) : r.chosen == null ? '' : (r.lavoro === 'femmina' ? 'maschio ' : 'femmina ') + r.chosen,
      dec(r.gioco, fmtUm), dec(r.con, fmtUm), q(r.conEnd === 'fondo' ? 'in fondo' : r.conEnd === 'davanti' ? 'davanti' : ''), dec(r.oval, fmtUm), q(r.status || ''),
    ].join(';'));
  }
  return '\ufeff' + lines.join('\r\n') + '\r\n';
}

/** Undo of the last save: removes the history row + shift save with that id and gives back the stock piece. */
function undoSave(state, rec) {
  if (!state || !rec) return false;
  const s = (state.series || []).find((x) => x.id === rec.seriesId);
  let done = false;
  if (s && Array.isArray(s.history)) {
    const before = s.history.length;
    s.history = s.history.filter((h) => h.id !== rec.id);
    done = s.history.length < before;
    if (done && rec.stockTaken && s.stock) s.stock[String(rec.chosen)] = (Number(s.stock[String(rec.chosen)]) || 0) + 1;
  }
  if (state.turno && Array.isArray(state.turno.saves)) {
    const b2 = state.turno.saves.length;
    state.turno.saves = state.turno.saves.filter((x) => x.id !== rec.id);
    done = done || state.turno.saves.length < b2;
  }
  return done;
}


/* ---------- Beta 0.6.0: clarity, per-machine calibration, per-job form limits, history snapshots ---------- */
/**
 * G read from the instrument vs the mating clearance. Gioco di accoppiamento = F − S (foro − maschio), positive = clearance.
 * The sign of G is kept as read. Never flips a negative into interference silently: the convention is stated.
 * @returns {{giocoUm:number|null, gLettoUm:number|null, src:'F−S'|'G'|null, conv:'S−F'|'F−S'|'diverso'|null, dedotto:boolean, interferenza:boolean, note:string}}
 */
function interpretG(Gmm, F, S) {
  const n = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const g = n(Gmm), f = n(F), sv = n(S);
  const gL = g == null ? null : round1(g * 1000);
  const out = { giocoUm: null, gLettoUm: gL, src: null, conv: null, dedotto: false, interferenza: false, note: '' };
  if (f != null && sv != null) {
    out.giocoUm = round1((f - sv) * 1000); out.src = 'F−S';
    if (gL != null) out.conv = Math.abs(gL + out.giocoUm) <= 1 ? 'S−F' : Math.abs(gL - out.giocoUm) <= 1 ? 'F−S' : 'diverso';
  } else if (gL != null) {
    // the measuring screen shows G = S − F (e.g. −0,0081 = 8,1 µm of clearance): stated, not hidden
    out.giocoUm = round1(-gL); out.src = 'G'; out.conv = 'S−F'; out.dedotto = true;
  }
  if (out.giocoUm != null) out.interferenza = out.giocoUm < 0;
  const sg = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmtUm(Math.abs(x));
  if (out.giocoUm != null) {
    out.note = (gL != null ? 'G letto ' + sg(gL) + ' µm (segno dello strumento)' : 'G non letto') + ' · gioco di accoppiamento F − S = ' + sg(out.giocoUm) + ' µm'
      + (out.interferenza ? ' → INTERFERENZA (il maschio è più grande del foro)' : ' (gioco)')
      + (out.dedotto ? ' · dedotto da G = S − F: controlla F e S' : '') + (out.conv === 'diverso' ? ' · ATTENZIONE: G non torna con F − S, controlla i valori' : '');
  }
  return out;
}
/**
 * Per-machine calibration (configuration only; the pairing math is unchanged).
 * outer/bore: what «+» does to the diameter ('stringe' = smaller). Default '+ stringe' for both, status 'da_verificare'.
 */
const CAL_DEFAULT = { outer: 'stringe', bore: 'stringe', umPerTocco: 1, scala: 'diametro', taper: 'normale', stato: 'da_verificare' };
function machineCal(m) {
  const c = Object.assign({}, CAL_DEFAULT, (m && m.cal) || {});
  if (!(m && m.cal && m.cal.outer) && m && m.rule === 'plus_bigger') c.outer = 'allarga';
  if (!(m && m.cal && m.cal.bore) && m && m.internoRule === 'plus_bigger') c.bore = 'allarga';
  if (!(Number(c.umPerTocco) > 0 && Number(c.umPerTocco) <= 50)) c.umPerTocco = 1; else c.umPerTocco = Number(c.umPerTocco);
  if (c.scala !== 'raggio') c.scala = 'diametro';
  if (c.taper !== 'invertito') c.taper = 'normale';
  if (c.stato !== 'verificata') c.stato = 'da_verificare';
  return c;
}
/** machine.rule / internoRule from the calibration (keeps the existing math keys). */
function calRules(cal) { return { rule: cal.outer === 'allarga' ? 'plus_bigger' : 'studer', internoRule: cal.bore === 'allarga' ? 'plus_bigger' : 'plus_smaller' }; }
/** Number of tocchi for a diameter change of diffUm µm. 1 µm/tocco on the diameter = the old presses (identical). */
function tocchiFor(diffUm, cal) {
  const c = cal || CAL_DEFAULT, per = (Number(c.umPerTocco) || 1) * (c.scala === 'raggio' ? 2 : 1);
  const v = Math.abs(Number(diffUm) || 0) / per;
  return v < 1e-9 ? 0 : Math.max(1, Math.ceil(v - 0.5 - 1e-9));
}
function fmtTocchi(n) { return n + (n === 1 ? ' tocco' : ' tocchi'); }
/** Correction in words: what happens to the diameter, independent of the key sign. diffUm = target − measured (same as corrWords). */
function corrWordsDiam(diffUm) {
  const d = Number(diffUm) || 0; if (Math.abs(d) < 0.05) return 'diametro già al centro';
  return (d > 0 ? 'diametro da aumentare di ' : 'diametro da ridurre di ') + fmtUm(Math.abs(d)) + ' µm';
}
/** Per-job form limits (µm). Default 2 µm conforme, 3 µm limite, for conicità and ovalità. */
const LIM_DEFAULT = { conOk: 2, conMax: 3, ovalOk: 2, ovalMax: 3 };
function jobLimits(series) {
  const s = series || {}, o = Object.assign({}, LIM_DEFAULT);
  ['conOk', 'conMax', 'ovalOk', 'ovalMax'].forEach((k) => { const v = Number(s.lim && s.lim[k]); if (Number.isFinite(v) && v >= 0 && v <= 50) o[k] = v; });
  if (o.conMax < o.conOk) o.conMax = o.conOk; if (o.ovalMax < o.ovalOk) o.ovalMax = o.ovalOk;
  return o;
}
/**
 * Beta 0.6.0: separate result lines instead of one BUONO.
 * @returns {Array<{k:string, label:string, st:'ok'|'lim'|'no'|'na'|'nr', word:string, val:string}>}
 */
function qualityLines(o) {
  const L = jobLimits({ lim: o.lim }), W = { ok: 'conforme', lim: 'al limite', no: 'fuori', na: 'non misurata', nr: 'non registrata' };
  const out = [];
  const gst = o.gioco == null ? 'na' : (o.gioco < o.giocoMin - 1e-9 || o.gioco > o.giocoMax + 1e-9) ? 'no' : (Math.abs(o.gioco - o.giocoMin) < 0.05 || Math.abs(o.gioco - o.giocoMax) < 0.05) ? 'lim' : 'ok';
  out.push({ k: 'gioco', label: 'Gioco', st: gst, word: W[gst], val: o.gioco == null ? '—' : fmtUm(o.gioco) + ' µm (' + o.giocoMin + '–' + o.giocoMax + ' µm)' });
  let dst = 'na', dv = '—';
  if (o.S != null && o.base != null && o.tolMm != null) { const d = round1((o.S - o.base) * 1000); dst = Math.abs(d) <= o.tolMm * 1000 + 1e-6 ? 'ok' : 'no'; dv = (d >= 0 ? '+' : '−') + fmtUm(Math.abs(d)) + ' µm dalla base (±' + fmtUm(o.tolMm * 1000) + ' µm)'; }
  out.push({ k: 'diam', label: 'Diametro', st: dst, word: W[dst], val: dv });
  const cst = formStatus(o.con, L.conOk, L.conMax);
  out.push({ k: 'con', label: 'Conicità', st: cst, word: W[cst], val: o.con == null ? 'limite ' + fmtUm(L.conOk) + '/' + fmtUm(L.conMax) + ' µm' : fmtUm(Math.abs(o.con)) + ' µm (limite ' + fmtUm(L.conOk) + '/' + fmtUm(L.conMax) + ' µm)' });
  const ost = o.oval == null ? 'nr' : formStatus(o.oval, L.ovalOk, L.ovalMax);
  out.push({ k: 'oval', label: 'Ovalità', st: ost, word: W[ost], val: o.oval == null ? 'si controlla dopo · limite ' + fmtUm(L.ovalOk) + '/' + fmtUm(L.ovalMax) + ' µm' : fmtUm(Math.abs(o.oval)) + ' µm (limite ' + fmtUm(L.ovalOk) + '/' + fmtUm(L.ovalMax) + ' µm)' });
  return out;
}
/** Snapshot stored with every saved measure: later edits of the series never change old records. */
function historySnap(series, gMin, gMax, cal) {
  const L = jobLimits(series);
  return { base: series.base, tolMm: seriesTol(series), giocoMin: gMin != null ? gMin : series.giocoMin, giocoMax: gMax != null ? gMax : series.giocoMax,
    conOk: L.conOk, conMax: L.conMax, ovalOk: L.ovalOk, ovalMax: L.ovalMax, cal: cal ? { outer: cal.outer, umPerTocco: cal.umPerTocco, scala: cal.scala, stato: cal.stato } : null };
}
/** Edit a saved measure keeping the previous values (h.edits). Uses the record's own snapshot, not the current series. */
function editHistoryRecord(h, series, newS, newChosen, nowIso) {
  const snap = h.snap || historySnap(series);
  const prev = { ts: nowIso, S: h.S, chosen: h.chosen, gioco: h.gioco, status: h.status };
  h.edits = (h.edits || []).concat([prev]).slice(-20);
  h.S = round4(newS); h.chosen = newChosen;
  const acc = calcAccoppiamento(h.S, snap.base, snap.giocoMin, snap.giocoMax, h.lavoro); h.gioco = giocoOf(newChosen, acc);
  if (!acc.valid.includes(newChosen)) h.status = 'scarto';
  else if (h.status === 'scarto' && formStatus(h.oval, snap.ovalOk, snap.ovalMax) !== 'no' && formStatus(h.con, snap.conOk, snap.conMax) !== 'no') h.status = 'buono';
  if (!h.snap) h.snap = snap;
  return h;
}
/** Import: duplicate measures inside the file and measures already in the phone. */
function importDuplicates(cur, incoming) {
  const key = (sid, h) => (h.id ? 'id:' + h.id : 'v:' + sid + '|' + h.ts + '|' + h.S);
  const have = new Set(); ((cur && cur.series) || []).forEach((s) => (s.history || []).forEach((h) => have.add(key(s.id, h))));
  let inFile = 0, already = 0; const seen = new Set();
  const series = ((incoming && incoming.series) || []).map((s) => {
    const hist = [];
    (s.history || []).forEach((h) => { const k = key(s.id, h), k2 = 'v:' + s.id + '|' + h.ts + '|' + h.S; if (seen.has(k) || seen.has(k2)) { inFile++; return; } seen.add(k); seen.add(k2); if (have.has(k)) already++; hist.push(h); });
    return Object.assign({}, s, { history: hist });
  });
  return { inFile, already, data: Object.assign({}, incoming, { series }) };
}

/* ---------- Beta 0.7.0: Rettifica manuale (everything by hand, no series, no photo) ---------- */
/** Gioco value: «7» = 7 µm; sheet style «-0,007» / «0,01» (mm, |v| < 1 with a separator) = 7 / 10 µm. */
function parseGiocoSheet(raw) {
  if (raw == null) return null; const t = String(raw).trim().replace(/\s+/g, '').replace('−', '-'); if (!t) return null;
  if (!/^[-+]?\d*[.,]?\d+$/.test(t)) return null;
  const v = Number(t.replace(',', '.')); if (!Number.isFinite(v)) return null;
  const um = /[.,]/.test(t) && Math.abs(v) < 1 ? Math.abs(v) * 1000 : Math.abs(v);
  return um > 200 ? null : round1(um);
}
/** Tolerance in mm, signed («-0,01», «+0,02», «0»); also accepts µm written as integer ≥ 1 (e.g. «-10» = −0,010 mm). */
function parseTolMm(raw) {
  if (raw == null) return null; const t = String(raw).trim().replace(/\s+/g, '').replace('−', '-'); if (!t) return null;
  if (!/^[-+]?\d*[.,]?\d+$/.test(t)) return null;
  const v = Number(t.replace(',', '.')); if (!Number.isFinite(v)) return null;
  if (!/[.,]/.test(t) && Math.abs(v) >= 1) return round4(v / 1000);
  return Math.abs(v) > 1 ? null : round4(v);
}
/** Range [lo, hi] mm from nominal + tolerances (any order). */
function rangeFromNominal(nom, tA, tB) {
  if (nom == null) return null; const a = tA == null ? 0 : tA, b = tB == null ? 0 : tB;
  return { lo: round4(nom + Math.min(a, b)), hi: round4(nom + Math.max(a, b)) };
}
/**
 * Target for the own part. mode 'maschio' (fit an existing female/bore) or 'femmina' (fit an existing male).
 * mate = { lo, hi } mm (measured → lo = hi). gioco = F − S in µm. Worst case over the whole mate range.
 * draw = own drawing limits { lo, hi } or null → intersection.
 * @returns {{ok:boolean, error:string, fit:{lo,hi,centro}|null, target:{lo,hi,centro}|null, overlap:boolean|null, warn:string}}
 */
function manualTarget(mode, mate, gMin, gMax, draw) {
  const out = { ok: false, error: '', fit: null, target: null, overlap: null, warn: '' };
  if (!mate || mate.lo == null || mate.hi == null) { out.error = 'Scrivi la misura (o nominale e tolleranze) del pezzo da accoppiare'; return out; }
  if (gMin == null || gMax == null) { out.error = 'Scrivi gioco min e max (µm)'; return out; }
  const g1 = Math.min(gMin, gMax), g2 = Math.max(gMin, gMax);
  let lo, hi;
  if (mode === 'femmina') { lo = mate.hi + g1 / 1000; hi = mate.lo + g2 / 1000; } // bore F = S + gioco
  else { lo = mate.hi - g2 / 1000; hi = mate.lo - g1 / 1000; } // male S = F − gioco
  lo = round4(lo); hi = round4(hi);
  if (hi < lo - 1e-9) { out.error = 'La tolleranza del pezzo da accoppiare è più larga del gioco: misura il pezzo vero e scrivi la misura'; return out; }
  out.fit = { lo, hi, centro: round4((lo + hi) / 2) };
  out.target = out.fit; out.ok = true;
  if (draw && draw.lo != null && draw.hi != null) {
    const a = Math.max(lo, draw.lo), b = Math.min(hi, draw.hi);
    out.overlap = b >= a - 1e-9;
    if (out.overlap) out.target = { lo: round4(a), hi: round4(b), centro: round4((a + b) / 2) };
    else out.warn = 'Il gioco richiesto e la tolleranza del disegno non si sovrappongono: decidi con il capo (uso il gioco)';
  }
  return out;
}
/**
 * Current measure of the own part vs the target. Outer (maschio): can only get smaller. Bore (femmina): can only get bigger.
 * diffUm = target centre − measured (µm on Ø). Correction keys from the machine calibration (outer / bore «+ stringe|allarga»).
 */
function manualStatus(mode, cur, target, cal) {
  if (cur == null || !target) return null;
  const c = cal || CAL_DEFAULT, bore = mode === 'femmina';
  const inRange = cur >= target.lo - 1e-9 && cur <= target.hi + 1e-9;
  const diffUm = round1((target.centro - cur) * 1000);
  const out = { state: 'ok', inRange, diffUm, removeUm: 0, perSideUm: 0, toLimitUm: 0, recoverable: true, key: '', presses: 0, words: '', none: false };
  const tooSmallMale = !bore && cur < target.lo - 1e-9, tooBigBore = bore && cur > target.hi + 1e-9;
  if (tooSmallMale || tooBigBore) {
    out.state = 'no'; out.recoverable = false;
    out.toLimitUm = round1(Math.abs((bore ? target.hi : target.lo) - cur) * 1000);
    out.words = 'non recuperabile: ' + (bore ? 'foro troppo grande di ' : 'maschio troppo piccolo di ') + fmtUm(out.toLimitUm) + ' µm sul Ø';
    out.none = true; return out;
  }
  const rem = round1(Math.abs(diffUm)); // material to remove to reach the centre (always the right direction here)
  out.removeUm = Math.abs(diffUm) <= 0.5 ? 0 : rem; out.perSideUm = round1(out.removeUm / 2);
  out.state = inRange ? 'ok' : 'da_togliere';
  if (!inRange) out.toLimitUm = round1(Math.abs(cur - (bore ? target.lo : target.hi)) * 1000);
  if (out.removeUm === 0) { out.none = true; out.words = 'al centro: non togliere altro'; return out; }
  if (!inRange || Math.abs(diffUm) > 0.5) {
    const effect = bore ? 'allarga' : 'stringe'; // what we need: male smaller (stringe), bore bigger (allarga)
    const plus = bore ? c.bore : c.outer; out.key = plus === effect ? '+' : '−';
    out.presses = tocchiFor(out.removeUm, c);
    out.words = (bore ? 'allarga il foro di ' : 'stringi il diametro di ') + fmtUm(out.removeUm) + ' µm sul Ø (' + fmtUm(out.perSideUm) + ' µm per lato) → ' + out.key + ' ×' + out.presses + ' ' + (out.presses === 1 ? 'tocco' : 'tocchi');
  }
  return out;
}

/* ---------- Beta 0.7.2: gioco obiettivo + fascia consigliata per serie, femmina fissa, inserimento a 3 cifre ---------- */
/** Series target settings, or null when the series has none (then nothing changes). */
function seriesObjective(series) {
  const s = series || {}; const gmin = s.giocoMin, gmax = s.giocoMax;
  const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const obj = num(s.obiettivo), fLo = num(s.fasciaLo), fHi = num(s.fasciaHi);
  if (obj == null && fLo == null && fHi == null) return null;
  const o = obj != null ? obj : (gmin + gmax) / 2;
  let lo = fLo, hi = fHi;
  if (lo == null || hi == null) { const third = (gmax - gmin) / 3; lo = round1(gmin + third); hi = round1(gmax - third); } // default: middle third
  if (hi < lo) { const t = lo; lo = hi; hi = t; }
  return { obiettivo: o, fasciaLo: Math.max(gmin, lo), fasciaHi: Math.min(gmax, hi) };
}
/**
 * Apply the objective to an accoppiamento result (maschio mode). Valid parts are unchanged (same pairing math);
 * only the recommendation moves to d + obiettivo and the «fascia consigliata» d+fLo..d+fHi is reported.
 */
function applyObjective(acc, obj) {
  if (!acc || !obj || acc.mode === 'femmina') return acc;
  const sg = 1, d = acc.d, ideal = round1(d + sg * obj.obiettivo);
  const fascia = acc.valid.filter((n) => n - d >= obj.fasciaLo - 1e-9 && n - d <= obj.fasciaHi + 1e-9);
  const inF = (n) => (fascia.includes(n) ? 0 : 1);
  const byObj = [...acc.valid].sort((a, b) => { const da = Math.abs(a - ideal), db = Math.abs(b - ideal); return Math.abs(da - db) < 1e-9 ? (inF(a) - inF(b)) || (a - b) : da - db; });
  const recommended = byObj.slice(0, Math.min(2, byObj.length));
  const edges = acc.valid.length <= 2 ? [] : [acc.valid[0], acc.valid[acc.valid.length - 1]].filter((n) => !recommended.includes(n));
  const details = acc.details.map((x) => Object.assign({}, x, { centered: recommended.includes(x.n), edge: edges.includes(x.n), fascia: fascia.includes(x.n) }));
  return Object.assign({}, acc, { ideal, recommended, edges, details, fascia, obiettivo: obj.obiettivo, fasciaLo: obj.fasciaLo, fasciaHi: obj.fasciaHi, consigliata: byObj.length ? byObj[0] : null });
}
/** Fixed female F (mm) against male S (mm): gioco = F − S, OK when gioco in [gmin, gmax]. n = female number (µm above base). */
function fixedFemale(F, S, base, gmin, gmax) {
  if (F == null || S == null || base == null) return null;
  const gioco = round1((F - S) * 1000), n = Math.round((F - base) * 1000);
  return { n, gioco, ok: gioco >= gmin - 1e-9 && gioco <= gmax + 1e-9 };
}
/**
 * Measure entry that stays near the base: when the fixed integer prefix (sticky / from the last measure) gives a value
 * far from the base but the automatic reading fits the base (e.g. base 10: «001» after a 9,998 → 10,001, not 9,001), use the automatic one.
 */
function interpretNearBase(raw, base, tol, forcedPrefix) {
  const p1 = interpretMeasure(raw, base, tol, forcedPrefix);
  if (forcedPrefix == null || !raw || /[.,]/.test(String(raw))) return p1;
  const hard = hardLimitMm(tol);
  if (p1 && p1.value != null && Math.abs(p1.value - base) <= hard + 1e-9) return p1;
  const p0 = interpretMeasure(raw, base, tol, null);
  if (p0 && p0.value != null && Math.abs(p0.value - base) <= (tol == null ? 0.1 : tol) + 1e-9) return Object.assign({}, p0, { autoFix: true });
  return p1;
}
/** Preset for the series «Corpo/Spillo Ø10» (Albedo). */
function presetCorpoSpillo10() {
  return { name: 'Corpo/Spillo Ø10', lotto: 'Corpo/Spillo Ø10', base: 10, tolleranza: 0.1, giocoMin: 10, giocoMax: 30, obiettivo: 20, fasciaLo: 20, fasciaHi: 25, forma: false,
    notes: 'Maschio = spillo (micrometro), femmina = corpo (Bowers). Gioco = F − S. Femmine numerate in µm sopra 10,000 (+7 = 10,007). Altre quote del disegno, fuori dall\'accoppiamento: 1,4 ± 0,05 e 4,4 ± 0,2 (altimetro).' };
}

if (typeof module !== 'undefined' && module.exports) {
module.exports = {
  seriesObjective, applyObjective, fixedFemale, interpretNearBase, presetCorpoSpillo10,
  parseGiocoSheet, parseTolMm, rangeFromNominal, manualTarget, manualStatus,
  interpretG, CAL_DEFAULT, machineCal, calRules, tocchiFor, fmtTocchi, corrWordsDiam, LIM_DEFAULT, jobLimits, qualityLines, historySnap, editHistoryRecord, importDuplicates,
  calcAccoppiamento,
  calcTarget,
  calcCorrezione,
  parseMisura,
  interpretMeasure,
  hintForBase,
  giocoSF,
  typoGuard,
  pezziSum,
  checkPezzoHold,
  spiegazione,
  round1,
  round4,
  fmtMm,
  fmtMm3,
  fmtUm,
  detectDrift,
  recommendWithStock,
  checkTrainingAnswer,
  summarizeShift,
  shiftPieces,
  fmtMachineLine,
  matingRange,
  matingRangeText,
  matingWho,
  femminaTarget,
  normGiocoUm,
  orderGioco,
  femFromParsed,
  lavoroLabel,
  lavoroSign,
  normLavoro,
  taperStep,
  taperTouch,
  stickyPrefixFor,
  setStickyPrefix,
  taperFromSides,
  TAPER_SIDE_LBL,
  fmtMm4,
  randomTrainingS,
  formStatus,
  taperHint,
  stockVisibleNums,
  validKnobK,
  parseKnobK,
  fmtTacche,
  knobTacche,
  signedCon,
  knobTrialK,
  calibrateKnob,
  seriesTol,
  hardLimitMm,
  driftPoints,
  correctionHint,
  corrWords,
  neighbourHints,
  hintPickerParts,
  correctionOptions,
  nextCorrectionWant,
  fmtMmS,
  giocoOf,
  parseGiocoInt,
  parseMmNumber,
  validateSeriesInput,
  sanitizeImport,
  pickSeriesForValues,
  historyCsv,
  planPhotoSeries,
  localDayKey,
  fmtSaveMsg,
  makeJob,
  ensureJobs,
  rolloverJobs,
  jobStats,
  knobForMachineName,
  jobsForToday,
  undoSave,
  deleteJob,
  restoreJob,
  deleteSeries,
  restoreSeries,
  nextSeriesAfterDelete,
  jobSetupFromParsed,
  planJobSetup,
  setupNum,
  setupInt,
  nextActiveJob,
  clearKnobForName,
  restoreKnobForName,
  jobPieceMatch,
  inspectBackup,
  internoTarget,
  internoBore,
  calcInterno,
  internoWords,
  internoTolWide,
  classifyStock,
  stockReasonText,
  stockQty,
  stockManaged,
  stockTake,
  stockSet,
  calcCorrezioneCard,
  wrapBackup,
  pushBackupList,
  BACKUP_FORMAT,
};

}
