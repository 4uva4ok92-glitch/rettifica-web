/**
 * Rettifica Beta 0.9.0 – pure helpers (no DOM, no pairing math):
 *  • Pacchetto serie / lavoro (file .rettifica / .json, text code RTF1./RTF2., QR): build, validate, match, diff, apply
 *  • Blocco quote con PIN (protection against MISTAKES, not security)
 *  • Checklist per lavoro (start / end)
 *  • Promemoria diamantatura + Quaderno macchina (counters derived from saved pieces, so Annulla/Elimina stay consistent)
 *  • Report per lotto/turno: stats, CSV (stable columns) and a one-page PDF
 * Works in the browser (window.Lavoro) and in node (module.exports).
 */
(function (root) {
  'use strict';
  const PKG_FORMAT = 'rettifica-pacchetto';
  const MAX_CHECK_ITEMS = 7;
  /** Beta 0.9.1: «Controllo quota» helpers live in quota.js (browser: window.Quota, node: require) */
  function QT() { return (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('./quota.js') : root.Quota; }

  /* ---------- small utils ---------- */
  function utf8(str) { return new TextEncoder().encode(String(str)); }
  function sha256hex(str) {
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const b = utf8(str), l = b.length, n = (((l + 8) >> 6) + 1) << 4;
    const words = new Uint32Array(n);
    for (let i = 0; i < l; i++) words[i >> 2] |= b[i] << (24 - (i & 3) * 8);
    words[l >> 2] |= 0x80 << (24 - (l & 3) * 8);
    words[n - 1] = l * 8; // messages here are far below 2^29 bytes
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const rotr = (x, k) => (x >>> k) | (x << (32 - k)), W = new Uint32Array(64);
    for (let o = 0; o < n; o += 16) {
      for (let i = 0; i < 16; i++) W[i] = words[o + i];
      for (let i = 16; i < 64; i++) { const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10); W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0; }
      let a = h0, bb = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  function b64urlFromBytes(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function bytesFromB64url(t) { const s = atob(String(t).replace(/-/g, '+').replace(/_/g, '/')); const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }
  const str = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 60);
  const strNL = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max || 600);
  function numOf(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const t = String(v).trim().replace(/\s/g, '').replace(',', '.'); if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null;
    return Number(t);
  }
  const eqCI = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const fmtC = (x, d) => (x == null || x === '' || !Number.isFinite(Number(x)) ? '' : Number(x).toFixed(d).replace('.', ','));
  const fmtT = (x) => (x == null ? '' : String(Math.round(Number(x) * 1000) / 1000).replace('.', ','));

  /* ---------- checklist ---------- */
  const DEFAULT_CHECK = {
    inizio: ['Disegno e revisione controllati', 'Strumento pulito', 'Pezzo a temperatura', 'Zero fatto'],
    fine: ['Ovalità/conicità controllate'],
  };
  function normItems(a, warn) {
    const out = [];
    (Array.isArray(a) ? a : String(a == null ? '' : a).split(/\r?\n/)).forEach((x) => { const t = str(x, 70); if (t) out.push(t); });
    if (out.length > MAX_CHECK_ITEMS) { if (warn) warn('Checklist: massimo ' + MAX_CHECK_ITEMS + ' voci, le altre sono state tolte'); return out.slice(0, MAX_CHECK_ITEMS); }
    return out;
  }
  function normalizeChecklist(c, warn) {
    if (!c || typeof c !== 'object') return null;
    const r = { inizio: normItems(c.inizio, warn), fine: normItems(c.fine, warn) };
    return r.inizio.length || r.fine.length ? r : null;
  }
  /** the list to use for a series: its own → the user's default → built-in */
  function checklistFor(series, userDefault) {
    const own = series && normalizeChecklist(series.checklist);
    if (own) return own;
    return normalizeChecklist(userDefault) || { inizio: DEFAULT_CHECK.inizio.slice(), fine: DEFAULT_CHECK.fine.slice() };
  }
  function checkNew(items) { const it = normItems(items); return { items: it, done: it.map(() => false), at: null }; }
  function checkCount(st) { const total = st && st.items ? st.items.length : 0; const done = total ? st.items.filter((_, i) => st.done && st.done[i]).length : 0; return { done, total, complete: total > 0 && done === total }; }
  function checkToggle(st, i, nowIso) {
    if (!st || !st.items || i < 0 || i >= st.items.length) return st;
    st.done = st.done || st.items.map(() => false); st.done[i] = !st.done[i];
    st.at = checkCount(st).complete ? (nowIso || new Date().toISOString()) : null; return st;
  }
  function checkAll(st, nowIso) { if (!st || !st.items) return st; st.done = st.items.map(() => true); st.at = nowIso || new Date().toISOString(); return st; }

  /* ---------- pacchetto ---------- */
  function seriesToPkg(s, opts) {
    const o = opts || {}, p = {
      nome: str(s.lotto || o.nome, 60), base: s.base, tolleranza: s.tolleranza != null ? s.tolleranza : 0.1,
      giocoMin: s.giocoMin, giocoMax: s.giocoMax,
    };
    if (s.obiettivo != null) p.obiettivo = s.obiettivo;
    if (s.fasciaLo != null) p.fasciaLo = s.fasciaLo;
    if (s.fasciaHi != null) p.fasciaHi = s.fasciaHi;
    p.forma = s.forma === false ? false : true;
    if (s.lim && typeof s.lim === 'object') p.lim = { conOk: s.lim.conOk, conMax: s.lim.conMax, ovalOk: s.lim.ovalOk, ovalMax: s.lim.ovalMax };
    if (s.fixedF != null) p.fixedF = s.fixedF;
    const meta = o.meta || {};
    p.codice = str(meta.codice != null ? meta.codice : s.codice, 40);
    p.rev = str(meta.rev != null ? meta.rev : s.rev, 12);
    p.lavorazione = str(meta.lav != null ? meta.lav : s.lav, 40);
    p.note = strNL(s.notes, 600);
    return p;
  }
  /** Build the package object. series: array of series (or one); job: {lotto,codice,rev,lav,note}; checklist optional. */
  function buildPackage(o) {
    const list = Array.isArray(o.series) ? o.series : (o.series ? [o.series] : []);
    const job = o.job || {};
    const body = {
      format: PKG_FORMAT, formatVersion: 1, createdAt: o.now || new Date().toISOString(), appVersion: o.appVersion || '',
      job: { lotto: str(job.lotto, 40), codice: str(job.codice, 40), rev: str(job.rev, 12), lavorazione: str(job.lav, 40), note: strNL(job.note, 300) },
      serie: list.map((s, i) => seriesToPkg(s, { meta: i === 0 ? { codice: job.codice, rev: job.rev, lav: job.lav } : null })),
    };
    if (Array.isArray(o.controlli) && o.controlli.length) { const q = QT(); body.controlli = o.controlli.map((c) => { const p = q.controlloToPkg(c); if (job.codice && !p.codice) p.codice = str(job.codice, 40); if (job.rev && !p.rev) p.rev = str(job.rev, 12); if (job.lav && !p.lavorazione) p.lavorazione = str(job.lav, 40); return p; }); }
    const cl = normalizeChecklist(o.checklist);
    if (cl) body.checklist = cl;
    body.check = sha256hex(JSON.stringify(body)).slice(0, 12);
    return body;
  }
  /** Validate + normalise. Never throws. warnings do not stop the import; errors drop that series / the package. */
  function validatePackage(raw) {
    const errors = [], warnings = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['Il file non è un pacchetto Rettifica'], warnings, pkg: null };
    if (raw.format === 'rettifica-backup') return { ok: false, errors: ['Questo è un backup, non un pacchetto: usa Setup → Importa'], warnings, pkg: null };
    if (raw.format !== PKG_FORMAT) return { ok: false, errors: ['Il file non è un pacchetto Rettifica'], warnings, pkg: null };
    if (!(Number(raw.formatVersion) >= 1) || Number(raw.formatVersion) > 1) return { ok: false, errors: ['Pacchetto di una versione più nuova: aggiorna l\'app'], warnings, pkg: null };
    // integrity code (detects a truncated / edited / mistyped file; it is NOT a signature)
    let checkState = 'none';
    if (raw.check) {
      const copy = Object.assign({}, raw); delete copy.check;
      checkState = sha256hex(JSON.stringify(copy)).slice(0, 12) === String(raw.check) ? 'ok' : 'mismatch';
      if (checkState === 'mismatch') warnings.push('Il codice di controllo non corrisponde: il file è stato modificato o è incompleto. Controlla bene i numeri.');
    }
    const arr = Array.isArray(raw.serie) ? raw.serie : (raw.serie && typeof raw.serie === 'object' ? [raw.serie] : []);
    const serie = [];
    arr.slice(0, 20).forEach((s, idx) => {
      const tag = arr.length > 1 ? 'Serie ' + (idx + 1) + ': ' : '';
      if (!s || typeof s !== 'object') { errors.push(tag + 'dati non validi'); return; }
      const base = numOf(s.base), gmin = numOf(s.giocoMin), gmax = numOf(s.giocoMax);
      let tol = s.tolleranza == null || s.tolleranza === '' ? 0.1 : numOf(s.tolleranza);
      const er = [];
      if (base == null || base < 1 || base > 300) er.push('base non valida (mm, tra 1 e 300)');
      if (tol == null || tol <= 0 || tol > 1) er.push('tolleranza non valida (± mm, tra 0 e 1)');
      if (gmin == null || gmax == null || !Number.isInteger(gmin) || !Number.isInteger(gmax)) er.push('gioco min/max non valido (µm interi)');
      else if (gmin < 0 || gmax > 100 || gmax <= gmin) er.push('gioco min/max non valido (0–100 µm, max > min)');
      let obj = null, flo = null, fhi = null;
      const opt = (v, name) => { if (v == null || v === '') return null; const x = numOf(v); if (x == null || x < 0 || x > 100) { er.push(name + ' non valido (µm)'); return null; } return x; };
      obj = opt(s.obiettivo, 'gioco obiettivo'); flo = opt(s.fasciaLo, 'fascia consigliata'); fhi = opt(s.fasciaHi, 'fascia consigliata');
      if (flo != null && fhi != null && flo > fhi) er.push('fascia consigliata: da > a');
      if (er.length) { errors.push(tag + er.join(', ')); return; }
      if (obj != null && (obj < gmin || obj > gmax)) warnings.push(tag + 'il gioco obiettivo (' + obj + ') è fuori dal gioco ' + gmin + '–' + gmax + ' µm');
      if ((flo != null && (flo < gmin || flo > gmax)) || (fhi != null && (fhi < gmin || fhi > gmax))) warnings.push(tag + 'la fascia consigliata esce dal gioco ' + gmin + '–' + gmax + ' µm');
      let lim = null;
      if (s.lim && typeof s.lim === 'object') {
        const l = { conOk: numOf(s.lim.conOk), conMax: numOf(s.lim.conMax), ovalOk: numOf(s.lim.ovalOk), ovalMax: numOf(s.lim.ovalMax) };
        if (Object.values(l).every((x) => x != null && x >= 0 && x <= 50) && l.conMax >= l.conOk && l.ovalMax >= l.ovalOk) lim = l; else warnings.push(tag + 'tolleranze di forma ignorate (non valide)');
      }
      let fixedF = null; if (s.fixedF != null && s.fixedF !== '') { fixedF = numOf(s.fixedF); if (fixedF == null || fixedF < 1 || fixedF > 300) { warnings.push(tag + 'femmina fissa ignorata (non valida)'); fixedF = null; } }
      const forma = !(s.forma === false || /^(no|false|0)$/i.test(String(s.forma == null ? '' : s.forma)));
      serie.push({ nome: str(s.nome, 60), base, tolleranza: tol, giocoMin: gmin, giocoMax: gmax, obiettivo: obj, fasciaLo: flo, fasciaHi: fhi, forma, lim, fixedF,
        codice: str(s.codice, 40), rev: str(s.rev, 12), lavorazione: str(s.lavorazione, 40), note: strNL(s.note, 600),
        checklist: normalizeChecklist(s.checklist, (m) => warnings.push(tag + m)) });
    });
    // Beta 0.9.1: «Controllo quota» (no mating part): controlli[] = [{nome, codice, rev, lavorazione, note, ovalita, quote:[…]}]
    const carr = Array.isArray(raw.controlli) ? raw.controlli : (raw.controllo && typeof raw.controllo === 'object' ? [raw.controllo] : []);
    const controlli = [];
    carr.slice(0, 10).forEach((c, idx) => {
      const tag = carr.length > 1 ? 'Controllo ' + (idx + 1) + ': ' : 'Controllo quota: ';
      const r = QT().normalizeControllo(c, (m) => warnings.push(tag + m));
      if (r.ok) controlli.push(r.c); else errors.push(tag + r.error);
    });
    if (!serie.length && !controlli.length) return { ok: false, errors: errors.length ? errors : ['Nessuna serie nel pacchetto'], warnings, pkg: null };
    const j = raw.job && typeof raw.job === 'object' ? raw.job : {};
    const first = serie[0] || { codice: controlli[0].codice, rev: controlli[0].rev, lavorazione: controlli[0].lav };
    const job = { lotto: str(j.lotto, 40), codice: str(j.codice, 40) || first.codice, rev: str(j.rev, 12) || first.rev, lavorazione: str(j.lavorazione, 40) || first.lavorazione, note: strNL(j.note, 300) };
    const checklist = normalizeChecklist(raw.checklist, (m) => warnings.push(m)) || (serie.length === 1 ? serie[0].checklist : null);
    return { ok: true, errors, warnings, pkg: { createdAt: str(raw.createdAt, 40), appVersion: str(raw.appVersion, 20), job, serie, controlli, checklist, checkState, check: raw.check ? String(raw.check) : '' } };
  }
  /** Existing series that this package series should update (same codice; or, with no codice, same base + same name). */
  function findMatch(list, ps) {
    const L = list || [];
    if (ps.codice) { const s = L.find((x) => eqCI(x.codice, ps.codice)); if (s) return { series: s, how: 'codice' }; return null; }
    if (ps.nome) { const s = L.find((x) => Math.abs(Number(x.base) - ps.base) < 0.0005 && eqCI(x.lotto, ps.nome)); if (s) return { series: s, how: 'nome' }; }
    return null;
  }
  /** What changes when an existing series is updated: [{label, from, to}] */
  function diffSeries(s, ps) {
    const d = [], add = (label, a, b) => { if (String(a == null ? '' : a) !== String(b == null ? '' : b)) d.push({ label, from: a == null || a === '' ? '—' : a, to: b == null || b === '' ? '—' : b }); };
    add('Base mm', fmtT(s.base), fmtT(ps.base)); add('Tolleranza ± mm', fmtT(s.tolleranza != null ? s.tolleranza : 0.1), fmtT(ps.tolleranza));
    add('Gioco µm', s.giocoMin + '–' + s.giocoMax, ps.giocoMin + '–' + ps.giocoMax);
    add('Gioco obiettivo µm', s.obiettivo, ps.obiettivo);
    add('Fascia consigliata µm', s.fasciaLo != null ? s.fasciaLo + '–' + s.fasciaHi : '', ps.fasciaLo != null ? ps.fasciaLo + '–' + ps.fasciaHi : '');
    add('Ovalità/conicità', s.forma === false ? 'non richieste' : 'controllate', ps.forma === false ? 'non richieste' : 'controllate');
    add('Nome', s.lotto, ps.nome); add('Codice', s.codice, ps.codice); add('Revisione', s.rev, ps.rev); add('Lavorazione', s.lav, ps.lavorazione);
    if (ps.note && ps.note !== (s.notes || '')) add('Note', 'diverse', 'aggiornate');
    return d;
  }
  /** Write the package series onto a series object (new or existing). History / stock / id are never touched. */
  function applyToSeries(s, ps, opts) {
    const o = opts || {};
    s.base = ps.base; s.tolleranza = ps.tolleranza; s.giocoMin = ps.giocoMin; s.giocoMax = ps.giocoMax;
    s.obiettivo = ps.obiettivo; s.fasciaLo = ps.fasciaLo; s.fasciaHi = ps.fasciaHi; s.fixedF = ps.fixedF;
    s.forma = ps.forma === false ? false : true;
    if (ps.lim) s.lim = Object.assign({}, ps.lim);
    if (ps.nome) s.lotto = ps.nome;
    s.codice = ps.codice; s.rev = ps.rev; s.lav = ps.lavorazione;
    if (ps.note) s.notes = ps.note;
    const cl = ps.checklist || o.checklist; if (cl) s.checklist = { inizio: cl.inizio.slice(), fine: cl.fine.slice() };
    if (o.name) s.name = o.name;
    if (o.locked != null) s.locked = !!o.locked;
    s.fromPackage = { at: o.now || new Date().toISOString(), check: o.check || '' };
    return s;
  }

  /* ---- text code: RTF1.<b64url(json)> | RTF2.<b64url(deflate-raw(json))>  (the same text goes into the QR) ---- */
  async function deflate(bytes) { const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(bytes).catch(() => {}); w.close().catch(() => {}); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); }
  async function inflate(bytes) { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(bytes).catch(() => {}); w.close().catch(() => {}); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); }
  async function encodeCode(pkg) {
    const raw = utf8(JSON.stringify(pkg)); let best = 'RTF1.' + b64urlFromBytes(raw);
    try { if (typeof CompressionStream !== 'undefined') { const z = 'RTF2.' + b64urlFromBytes(await deflate(raw)); if (z.length < best.length) best = z; } } catch (e) {}
    return best;
  }
  async function decodeCode(text) {
    const m = /RTF([12])\.([A-Za-z0-9_-]+)/.exec(String(text || '').replace(/\s+/g, ''));
    if (!m) throw new Error('nocode');
    let bytes = bytesFromB64url(m[2]); if (m[1] === '2') bytes = await inflate(bytes);
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  /** Any text (file contents, pasted code, a WhatsApp message with the code inside, QR text) → package object */
  async function parseAny(text) {
    const t = String(text == null ? '' : text).replace(/^\ufeff/, '').trim();
    if (!t) return { ok: false, error: 'Vuoto: nessun pacchetto' };
    if (t[0] === '{') { try { return { ok: true, obj: JSON.parse(t) }; } catch (e) { return { ok: false, error: 'File non leggibile (JSON non valido)' }; } }
    if (/RTF[12]\./.test(t.replace(/\s+/g, ''))) { try { return { ok: true, obj: await decodeCode(t) }; } catch (e) { return { ok: false, error: 'Codice incompleto o rovinato: copialo di nuovo per intero' }; } }
    const i = t.indexOf('{'), j = t.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return { ok: true, obj: JSON.parse(t.slice(i, j + 1)) }; } catch (e) {} }
    return { ok: false, error: 'Non è un pacchetto Rettifica' };
  }
  function packageFileName(pkg) {
    const j = pkg.job || {}, s = (pkg.serie || [])[0] || (pkg.controlli || [])[0] || {};
    const bit = [j.codice || s.codice, j.lotto ? 'L' + j.lotto : '', j.lavorazione || s.lavorazione].filter(Boolean).join('-').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 50);
    return 'rettifica-lavoro' + (bit ? '-' + bit : '') + '.rettifica';
  }
  function packageCaption(pkg) {
    const j = pkg.job || {}, s = (pkg.serie || [])[0] || (pkg.controlli || [])[0] || {};
    const bits = [j.codice || s.codice ? 'Codice ' + (j.codice || s.codice) : '', (j.rev || s.rev) ? 'rev ' + (j.rev || s.rev) : '', (j.lavorazione || s.lavorazione) ? 'lavorazione ' + (j.lavorazione || s.lavorazione) : '', j.lotto ? 'lotto ' + j.lotto : ''].filter(Boolean);
    return 'Nuovo lavoro per Rettifica' + (bits.length ? ': ' + bits.join(' · ') : '') + '. Apri il file con l\'app Rettifica.';
  }

  /* ---------- PIN lock (protection against mistakes) ---------- */
  function pinValid(p) { return /^\d{4,8}$/.test(String(p == null ? '' : p)); }
  function pinMake(pin) { const salt = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); return { salt, hash: sha256hex(salt + ':' + pin) }; }
  function pinCheck(rec, pin) { return !!(rec && rec.salt && rec.hash && sha256hex(rec.salt + ':' + String(pin)) === rec.hash); }

  /* ---------- Quaderno macchina + promemoria diamantatura ---------- */
  const EVENT_TYPES = {
    diamantatura: { label: 'Diamantatura', icon: '💎' }, mola: { label: 'Cambio mola', icon: '🔄' },
    manopola: { label: 'Regolazione manopola', icon: '🎛' }, nota: { label: 'Nota', icon: '📝' },
  };
  const machineKey = (n) => String(n == null ? '' : n).trim().toLowerCase();
  function cfgOf(state, key) {
    state.machCfg = state.machCfg || {};
    if (!state.machCfg[key]) state.machCfg[key] = { dressEvery: 0, since: null, snoozeAt: null, snoozeStep: 10, after: false };
    return state.machCfg[key];
  }
  /** timestamps (ISO strings) of every piece saved for the machine key: series history + femmine + interni */
  function pieceTimes(state, key, nameOf) {
    const out = [], nf = nameOf || ((h) => h.machineName);
    ((state.series || []).concat(state.seriesArchive || [])).forEach((s) => (s.history || []).forEach((h) => { if (h.ts && machineKey(nf(h, s)) === key) out.push(String(h.ts)); }));
    (state.femmine || []).forEach((r) => { if (r.ts && machineKey(r.machineName) === key) out.push(String(r.ts)); });
    (state.interni || []).forEach((r) => { if (r.ts && machineKey(r.machineName) === key) out.push(String(r.ts)); });
    (state.quotaPezzi || []).forEach((r) => { if (r.ts && machineKey(r.machineName) === key) out.push(String(r.ts)); });
    return out;
  }
  function piecesSince(state, key, sinceTs, nameOf) { const t = pieceTimes(state, key, nameOf); return sinceTs ? t.filter((x) => x > String(sinceTs)).length : t.length; }
  function eventsOf(state, key) { return (state.quaderno || []).filter((e) => machineKey(e.machine) === key).slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts))); }
  function lastEvent(state, key, type) { return eventsOf(state, key).find((e) => !type || e.type === type) || null; }
  function dressInfo(state, key, nameOf) {
    const c = cfgOf(state, key), every = Math.max(0, parseInt(c.dressEvery, 10) || 0), last = lastEvent(state, key, 'diamantatura');
    const base = last ? last.ts : c.since;
    const count = every || last ? piecesSince(state, key, base, nameOf) : 0;
    const threshold = c.snoozeAt != null ? c.snoozeAt : every;
    return { on: every > 0, every, count, threshold, due: every > 0 && count >= threshold, lastTs: last ? last.ts : null, base, after: !!c.after, snoozeStep: c.snoozeStep || 10 };
  }
  function setDressEvery(state, key, n, nowIso) {
    const c = cfgOf(state, key), v = Math.max(0, Math.min(9999, parseInt(n, 10) || 0));
    if (v > 0 && !(c.dressEvery > 0)) { c.since = nowIso || new Date().toISOString(); c.snoozeAt = null; }
    c.dressEvery = v; if (!v) c.snoozeAt = null; return c;
  }
  function addEvent(state, o) {
    const key = machineKey(o.machine), ts = o.ts || new Date().toISOString();
    state.quaderno = state.quaderno || [];
    const prev = lastEvent(state, key, null);
    const ev = { id: o.id || 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts, type: EVENT_TYPES[o.type] ? o.type : 'nota', machine: String(o.machine || '').trim(),
      note: strNL(o.note, 300), pz: prev ? piecesSince(state, key, prev.ts, o.nameOf) : null };
    state.quaderno.push(ev);
    const c = cfgOf(state, key);
    if (ev.type === 'diamantatura') { c.snoozeAt = null; c.after = true; }
    return ev;
  }
  function snoozeDress(state, key, x, nameOf) {
    const c = cfgOf(state, key), info = dressInfo(state, key, nameOf), step = Math.max(1, parseInt(x, 10) || c.snoozeStep || 10);
    c.snoozeAt = info.count + step; return c;
  }
  function removeEvent(state, id) { const n = (state.quaderno || []).length; state.quaderno = (state.quaderno || []).filter((e) => e.id !== id); return state.quaderno.length < n; }

  /* ---------- Report per lotto/turno ---------- */
  /** rows: [{ts, machine, serie, codice, rev, lav, lotto, base, tol, gmin, gmax, lavoro, S, d, chosen, gioco, con, conEnd, status}] */
  function reportStats(rows) {
    const R = (rows || []).filter((r) => !(r && r.qNome)), g = R.map((r) => r.gioco).filter((x) => x != null && Number.isFinite(Number(x))).map(Number);
    const c = R.map((r) => r.con).filter((x) => x != null && Number.isFinite(Number(x))).map(Number);
    const scarti = R.filter((r) => /scarto/i.test(r.status || '')).length, n = R.length;
    const ts = R.map((r) => String(r.ts || '')).filter(Boolean).sort();
    return { n, scarti, buoni: n - scarti, pctBuoni: n ? Math.round((n - scarti) / n * 1000) / 10 : null,
      gMin: g.length ? Math.min.apply(null, g) : null, gMax: g.length ? Math.max.apply(null, g) : null, gAvg: g.length ? Math.round(g.reduce((a, b) => a + b, 0) / g.length * 10) / 10 : null,
      conMax: c.length ? Math.max.apply(null, c) : null, first: ts[0] || null, last: ts[ts.length - 1] || null };
  }
  const REPORT_COLS_BASE = ['Data', 'Ora', 'Macchina', 'Serie', 'Codice', 'Revisione', 'Lavorazione', 'Numero lotto', 'Base mm', 'Tolleranza ± mm', 'Gioco min µm', 'Gioco max µm', 'Lavoro', 'Misura mm', 'Scarto dalla base µm', 'Pezzo accoppiato', 'Gioco µm', 'Conicità µm', 'Conicità lato', 'Esito'];
  // Beta 0.9.1: columns added at the END for «Controllo quota» rows (empty for the others)
  const REPORT_COLS_Q = ['Controllo quota', 'Tipo quota', 'Limite min mm', 'Limite max mm', 'Centro mm', 'Scostamento dal centro µm', 'Esito quota'];
  const REPORT_COLS = REPORT_COLS_BASE.concat(REPORT_COLS_Q);
  function reportCsv(rows) {
    const q = (x) => { const t = x == null ? '' : String(x); return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const p2 = (n) => String(n).padStart(2, '0'), out = [REPORT_COLS.join(';')], qc = (r) => QT().qCells(r);
    (rows || []).forEach((r) => {
      const d = r.ts ? new Date(r.ts) : null;
      out.push([d ? p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() : '', d ? p2(d.getHours()) + ':' + p2(d.getMinutes()) : '', q(r.machine), q(r.serie), q(r.codice), q(r.rev), q(r.lav), q(r.lotto),
        fmtC(r.base, 3), fmtC(r.tol, 3), fmtC(r.gmin, 0), fmtC(r.gmax, 0), q(r.lavoro === 'femmina' ? 'femmina' : r.lavoro === 'interno' ? 'interno' : r.lavoro === 'controllo quota' ? 'controllo quota' : 'maschio'), fmtC(r.S, 4), fmtC(r.d, 1),
        r.chosen == null ? '' : r.chosen, fmtC(r.gioco, 1), fmtC(r.con, 1), q(r.conEnd === 'fondo' ? 'in fondo' : r.conEnd === 'davanti' ? 'davanti' : ''), q(r.status || '')].concat(qc(r)).join(';'));
    });
    return '\ufeff' + out.join('\r\n') + '\r\n';
  }
  /* mini PDF writer: one A4 page, Helvetica (WinAnsi). The string returned holds one byte per char. */
  const WIN = { '−': '-', '–': '-', '—': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '→': '->', '✓': 'ok', '≤': '<=', '≥': '>=', '×': 'x', '·': '·', '…': '...', '±': '±', '≈': '~' };
  function pdfText(t) {
    let s = ''; for (const ch of String(t == null ? '' : t)) { let c = WIN[ch] != null ? WIN[ch] : ch; for (const x of c) { const k = x.charCodeAt(0); s += k < 256 ? x : '?'; } }
    return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ');
  }
  /** model: {title, sub, info:[[k,v]…], stats:[[k,v]…], cols:[{h,x,w}], rows:[[…]], notes:[…], footer} */
  function buildPdf(m) {
    const W = 595, H = 842, ops = [];
    const T = (x, y, s, size, bold) => ops.push('BT /F' + (bold ? 2 : 1) + ' ' + size + ' Tf ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' Td (' + pdfText(s) + ') Tj ET');
    const L = (x1, y1, x2, y2, w) => ops.push((w || 0.6) + ' w ' + x1 + ' ' + y1 + ' m ' + x2 + ' ' + y2 + ' l S');
    let y = H - 48;
    T(40, y, m.title || 'Report', 18, true); y -= 16; if (m.sub) { T(40, y, m.sub, 10); y -= 8; }
    L(40, y - 4, W - 40, y - 4, 1.2); y -= 20;
    (m.info || []).forEach((kv) => { T(40, y, kv[0], 9, true); T(150, y, kv[1], 10); y -= 14; });
    y -= 4; L(40, y + 6, W - 40, y + 6, 0.4); y -= 10;
    const st = m.stats || []; for (let i = 0; i < st.length; i += 2) { T(40, y, st[i][0] + ': ' + st[i][1], 10, false); if (st[i + 1]) T(300, y, st[i + 1][0] + ': ' + st[i + 1][1], 10, false); y -= 14; }
    (m.notes || []).forEach((n) => { T(40, y, n, 9); y -= 12; });
    y -= 6;
    const cols = m.cols || [], rowH = 12.5, bottom = 64, maxRows = Math.max(0, Math.floor((y - 20 - bottom) / rowH));
    let rows = m.rows || [], cut = 0; if (rows.length > maxRows) { cut = rows.length - maxRows; rows = rows.slice(-maxRows); }
    if (cols.length) {
      ops.push('0.93 g 36 ' + (y - 3) + ' ' + (W - 72) + ' 14 re f 0 g');
      cols.forEach((c) => T(c.x, y, c.h, 8, true)); y -= rowH + 3;
      rows.forEach((r, i) => { if (i % 2) ops.push('0.97 g 36 ' + (y - 3) + ' ' + (W - 72) + ' ' + rowH + ' re f 0 g'); cols.forEach((c, k) => T(c.x, y, String(r[k] == null ? '' : r[k]).slice(0, c.w || 14), 8)); y -= rowH; });
      if (cut) { y -= 4; T(40, y, 'Mostrate le ultime ' + rows.length + ' righe di ' + (rows.length + cut) + ': l\'elenco completo è nel CSV.', 8); }
    }
    L(40, 50, W - 40, 50, 0.4); T(40, 38, m.footer || '', 8);
    const stream = ops.join('\n'), objs = [];
    objs.push('<< /Type /Catalog /Pages 2 0 R >>'); objs.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>');
    objs.push('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    let pdf = '%PDF-1.4\n', offs = [];
    objs.forEach((o, i) => { offs.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xr = pdf.length; pdf += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF\n';
    return pdf;
  }
  function pdfToBase64(pdf) { return btoa(pdf); }

  const api = { PKG_FORMAT, MAX_CHECK_ITEMS, DEFAULT_CHECK, EVENT_TYPES, REPORT_COLS, sha256hex, b64urlFromBytes, bytesFromB64url, numOf,
    normalizeChecklist, checklistFor, checkNew, checkCount, checkToggle, checkAll,
    buildPackage, validatePackage, findMatch, diffSeries, applyToSeries, encodeCode, decodeCode, parseAny, packageFileName, packageCaption, seriesToPkg,
    pinValid, pinMake, pinCheck,
    machineKey, cfgOf, pieceTimes, piecesSince, eventsOf, lastEvent, dressInfo, setDressEvery, addEvent, snoozeDress, removeEvent,
    reportStats, reportCsv, buildPdf, pdfToBase64 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Lavoro = api;
})(typeof window !== 'undefined' ? window : globalThis);
