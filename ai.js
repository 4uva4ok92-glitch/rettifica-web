/* Rettifica Beta 0.5.0 — AI helpers (Assistente + Leggi foto con AI).
 * OpenAI-compatible chat/completions API, base URL + model configurable (default xAI).
 * The API key is NEVER in the app data / prefs / backups: on Android it lives in native SharedPreferences
 * (excluded from Android backup); in the browser (PWA/tests) in its own localStorage key, never exported. */
(function (root) {
  'use strict';
  /** Presets (checked Oct 2026). vision = can read photos. Default = best free option with vision (Gemini). */
  const PROVIDERS = {
    gemini: { label: 'Google Gemini (gratis)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.8-flash', visionModel: 'gemini-3.8-flash', vision: true,
      keyUrl: 'aistudio.google.com/apikey', keyLink: 'https://aistudio.google.com/apikey', free: 'Gratis con limiti al minuto/giorno (vedi AI Studio). Nel piano gratis Google può usare i dati per migliorare i prodotti.' },
    openrouter: { label: 'OpenRouter (modelli :free)', baseUrl: 'https://openrouter.ai/api/v1', model: 'qwen/qwen3.8-27b:free', visionModel: 'qwen/qwen3.8-27b:free', vision: true,
      keyUrl: 'openrouter.ai/keys', keyLink: 'https://openrouter.ai/keys', free: 'Modelli :free gratis: 20 richieste/minuto, 50 al giorno (1000 al giorno dopo 10 $ di credito).' },
    qwen: { label: 'Qwen · Alibaba DashScope', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', visionModel: 'qwen-vl-plus', vision: true,
      keyUrl: 'modelstudio.console.alibabacloud.com (Singapore)', keyLink: 'https://modelstudio.console.alibabacloud.com', free: 'Nuovi utenti: ~1 milione di token gratis per modello per 90 giorni (regione Singapore). Poi molto economico.' },
    deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', visionModel: null, vision: false,
      keyUrl: 'platform.deepseek.com', keyLink: 'https://platform.deepseek.com/api_keys', free: 'Non gratis ma economicissimo (~0,15–0,30 $ per milione di token in ingresso). Qui solo Assistente.' },
    xai: { label: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', model: 'grok-4.3', visionModel: 'grok-4.3', vision: true,
      keyUrl: 'console.x.ai', keyLink: 'https://console.x.ai', free: 'A pagamento: 1,25 $ / 2,50 $ per milione di token (ingresso/uscita).' },
    custom: { label: 'Personalizzato', baseUrl: '', model: '', visionModel: '', vision: true, keyUrl: '', free: 'Qualsiasi servizio compatibile OpenAI (chat/completions).' },
  };
  const DEFAULT_PROVIDER = 'gemini';
  const DEFAULTS = Object.assign({ provider: DEFAULT_PROVIDER, timeoutMs: 60000 }, PROVIDERS[DEFAULT_PROVIDER]);
  const WEB_KEY = 'rweb_ai_key_local'; // browser only, never in rbeta_v1 / prefs / exports
  const REGOLE = [
    'Tutte le misure sono DIAMETRI, differenze in µm (1 mm = 1000 µm). Mai «millesimi».',
    'Pezzi numerati in µm rispetto alla base: pezzo +5 = base + 0,005 mm.',
    'Gioco G = S − F (femmina − maschio). Buono se giocoMin ≤ gioco ≤ giocoMax.',
    'Maschio M: d = (M − base) in µm; femmine valide da d + giocoMin a d + giocoMax; consigliato d + (min+max)/2.',
    'Correzione: 1 tocco ≈ 1 µm sul diametro. Esterno Studer: + fa il pezzo PIÙ PICCOLO, − PIÙ GRANDE (verificare sempre).',
    'Interno (foro): il segno è impostato per macchina (predefinito «+ stringe il foro»); non copiare il segno dell’esterno; verificare sul primo pezzo.',
    'Interno: da togliere = quota − misura (sul Ø); per lato = metà. Esterno: da togliere = misura − quota.',
    'Un esterno già troppo piccolo o un foro già troppo largo non si recuperano: si corregge la macchina per i pezzi dopo.',
    'Conicità: misurare in due sezioni A e B; ovalità e conicità entro 2–3 µm (≤2 buono, 2–3 al limite, >3 fuori).',
    'Conicità S33: più grande in fondo → manopola contropunta verso di te; più grande davanti → dall’altra parte. Regolazione fine contropunta ±20 µm.',
  ];
  const S33 = 'Promemoria S33: misurare pezzo pulito e a temperatura; ripetere la misura; correggere una causa alla volta; registrare valore prima/dopo; dopo diamantatura ricontrollare la quota; non sommare correzioni manuali e automatiche senza verificarle; bruciature/vibrazioni → fermarsi.';
  const REMINDER = 'Ricorda sempre di controllare ovalità e conicità: entro 2–3 µm.';

  function cfgOf(prefs) {
    const a = (prefs && prefs.ai) || {}, id = PROVIDERS[a.provider] ? a.provider : DEFAULT_PROVIDER, P = PROVIDERS[id];
    const custom = id === 'custom';
    const vision = custom ? a.vision !== false : P.vision;
    return { provider: id, label: P.label, baseUrl: String((custom ? a.baseUrl : (a.baseUrl || P.baseUrl)) || '').replace(/\/+$/, ''),
      model: (custom ? a.model : (a.model || P.model)) || '', visionModel: vision ? ((custom ? (a.visionModel || a.model) : (a.visionModel || P.visionModel)) || '') : null,
      vision, timeoutMs: a.timeoutMs || DEFAULTS.timeoutMs };
  }
  function bridge() { return root.RettificaAndroid && typeof root.RettificaAndroid.aiPost === 'function' ? root.RettificaAndroid : null; }
  // one key per provider
  function webKey(p) { try { return root.localStorage.getItem(WEB_KEY + '_' + p) || ''; } catch (e) { return ''; } }
  function hasKey(p) {
    const b = bridge(); if (b) { try { return !!b.aiHasKey(p); } catch (e) { return false; } }
    return !!webKey(p);
  }
  function setKey(p, k) {
    k = String(k || '').trim(); const b = bridge();
    if (b) { b.aiSetKey(p, k); return; }
    try { if (k) root.localStorage.setItem(WEB_KEY + '_' + p, k); else root.localStorage.removeItem(WEB_KEY + '_' + p); } catch (e) {}
  }
  /** Beta 0.5.1: paste the key from the clipboard and save it. Resolves {ok, hint} or {ok:false, error}. */
  function looksLikeKey(k) { return typeof k === 'string' && k.length >= 16 && k.length <= 300 && !/\s/.test(k); }
  function pasteKey(p) {
    const b = bridge();
    if (b && b.aiPasteKey) { let h = ''; try { h = b.aiPasteKey(p) || ''; } catch (e) {} return Promise.resolve(h ? { ok: true, hint: h } : { ok: false, error: 'Negli appunti non c’è una chiave. Copiala prima (tieni premuto → Copia).' }); }
    const cb = root.navigator && root.navigator.clipboard;
    if (!cb || !cb.readText) return Promise.resolve({ ok: false, error: 'Non riesco a leggere gli appunti: incolla la chiave nel campo.' });
    return cb.readText().then((t) => { t = String(t || '').trim(); if (!looksLikeKey(t)) return { ok: false, error: 'Negli appunti non c’è una chiave. Copiala prima (tieni premuto → Copia).' }; setKey(p, t); return { ok: true, hint: '…' + t.slice(-4) }; },
      () => ({ ok: false, error: 'Permesso appunti negato: incolla la chiave nel campo.' }));
  }
  function openLink(url) {
    if (!/^https:\/\//.test(url || '')) return; const b = root.RettificaAndroid;
    if (b && b.openUrl) { try { b.openUrl(url); return; } catch (e) {} }
    try { root.open(url, '_blank', 'noopener'); } catch (e) {}
  }
  const KEY_STEPS = ['Accedi con il tuo account Google.', 'Tocca «Create API key» e poi copia la chiave.', 'Torna qui e tocca «📋 Incolla chiave».'];
  function keyHint(p) {
    const b = bridge(); if (b) { try { return b.aiKeyHint(p) || ''; } catch (e) { return ''; } }
    const k = webKey(p); return k ? '…' + k.slice(-4) : '';
  }

  /** Context sent to the AI: only facts the app already computed. */
  function buildContext(c) {
    c = c || {}; const L = [];
    if (c.machine) L.push('Macchina: ' + c.machine);
    if (c.base != null) L.push('Serie: base ' + c.base + ' mm' + (c.giocoMin != null ? ', gioco ' + c.giocoMin + '–' + c.giocoMax + ' µm' : '') + (c.tol != null ? ', tolleranza ±' + c.tol + ' mm' : ''));
    if (c.lavoro) L.push('Lavoro: ' + c.lavoro);
    if (c.last && c.last.length) L.push('Ultime misure salvate: ' + c.last.join('; '));
    if (c.trend) L.push('Andamento: ' + c.trend);
    if (c.calc) L.push('CALCOLO DELL’APP (ultimo risultato): ' + c.calc);
    if (c.interno) L.push('INTERNO (calcolo dell’app): ' + c.interno);
    if (c.intDir) L.push('Verso del + su interno: ' + c.intDir);
    return L.join('\n') || 'Nessun lavoro attivo.';
  }
  /** Beta 0.5.2: short, friendly prompt. Grinding knowledge + job context are background only. */
  function systemPrompt(ctxText) {
    return [
      'Sei un collega di lavoro simpatico e alla mano, dentro l’app «Rettifica Beta». Parli italiano, in modo informale e breve (di solito 1–4 frasi). Puoi chiacchierare di tutto: se ti salutano, saluta e basta; se parlano d’altro, rispondi normalmente.',
      'Solo se la domanda riguarda il lavoro (rettifica, misure, pezzi, gioco, correzioni) usa le informazioni qui sotto. In quel caso: i numeri su pezzi, misure e correzioni li dà l’app, tu non fare calcoli tuoi; se manca un numero, di’ di guardarlo in Calcolo o Interno. Il verso del +/− dipende dalla macchina: se non è indicato, consiglia di verificarlo sul primo pezzo. Usa µm, non «millesimi». Quando parli di misure puoi ricordare: ' + REMINDER,
      'Promemoria regole dell’app (solo se servono): ' + REGOLE.slice(0, 6).join(' · '),
      'Lavoro attuale (sfondo, non citarlo se non serve):\n' + ctxText,
    ].join('\n\n');
  }
  /** Numbers in the AI answer that are not in the app context → flag them (the AI must not compute). */
  function foreignNumbers(answer, ctxText) {
    const norm = (s) => s.replace(/[−–]/g, '-').replace(/\./g, ',');
    const known = new Set((norm(ctxText + ' ' + REGOLE.join(' ') + ' ' + REMINDER).match(/\d+(?:,\d+)?/g) || []).map((x) => x.replace(/^0+(?=\d)/, '')));
    const A = norm(String(answer || ''));
    const found = (A.match(/\d+(?:,\d+)?(?=\s*(?:µm|um\b|micron|tocch|pression))/gi) || []).concat((A.match(/×\s*\d+/g) || []).map((x) => x.replace(/×\s*/, '')))
      .map((x) => x.replace(/^0+(?=\d)/, ''));
    return [...new Set(found.filter((n) => !known.has(n)))];
  }

  const VISION_PROMPT = 'Questa è la foto dello schermo di misura «Elenco caratteristiche» di una rettifica. Leggi SOLO quello che vedi, non calcolare. '
    + 'Rispondi SOLO con JSON valido, senza testo prima o dopo, con questa forma (null se non leggibile): '
    + '{"nominale":number|null,"tolMeno":number|null,"tolPiu":number|null,"giocoMinMm":number|null,"giocoMaxMm":number|null,'
    + '"righe":{"F1A":number|null,"F1B":number|null,"F1C":number|null,"S1A":number|null,"S1B":number|null,"S1C":number|null,"G1A":number|null,"G1B":number|null,"G1C":number|null},'
    + '"codice":string|null,"lotto":string|null,"note":string|null}. '
    + 'F e S in mm (diametro, es. 18.0098). G in mm con il segno (es. -0.0081). giocoMinMm/giocoMaxMm = limiti della riga G in mm (es. -0.008 e -0.011). Punto decimale.';

  function num(v) {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).trim().replace(/[−–]/g, '-').replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  /** Safe mini-markdown → HTML (bold, italic, lists, line breaks). Input is escaped first. */
  function md(text) {
    const e = String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inl = (l) => l.replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, '$1<i>$2</i>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
    const out = []; let list = null;
    e.split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/);
      if (m) { const t = m[1] ? 'ol' : 'ul'; if (list !== t) { if (list) out.push('</' + list + '>'); out.push('<' + t + '>'); list = t; } out.push('<li>' + inl(m[2]) + '</li>'); return; }
      if (list) { out.push('</' + list + '>'); list = null; }
      out.push(l.trim() ? inl(l.replace(/^#{1,6}\s+/, '')) + '<br>' : '<br>');
    });
    if (list) out.push('</' + list + '>');
    return out.join('').replace(/(<br>)+$/, '').replace(/(<br>){3,}/g, '<br><br>');
  }
  /** Tolerant JSON extraction: plain, ```json fenced, or the first {...} block. */
  function extractJson(text) {
    if (text == null) return null; let t = String(text).trim();
    const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (f) t = f[1].trim();
    try { return JSON.parse(t); } catch (e) {}
    const i = t.indexOf('{'), j = t.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch (e) {} }
    return null;
  }
  /** Vision JSON → the same «parsed» shape ocr-parse.js gives to the confirm form. Never throws. */
  function visionToParsed(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const r = obj.righe || obj.rows || {}, out = { rows: {}, header: {}, notes: ['Letto con AI: controlla ogni valore prima di confermare.'], _ai: true };
    const sane = (v, lo, hi) => (v != null && v >= lo && v <= hi ? v : null);
    ['F1A', 'F1B', 'F1C', 'S1A', 'S1B', 'S1C'].forEach((k) => { const v = sane(num(r[k]), 0.5, 2000); if (v != null) out.rows[k] = { value: v, confidence: 0.7, ai: true }; });
    ['G1A', 'G1B', 'G1C'].forEach((k) => { const v = sane(num(r[k]), -1, 1); if (v != null) out.rows[k] = { value: v, confidence: 0.7, ai: true }; });
    out.S1A = out.rows.S1A ? out.rows.S1A.value : null; out.F1A = out.rows.F1A ? out.rows.F1A.value : null; out.G1A = out.rows.G1A ? out.rows.G1A.value : null;
    const nom = sane(num(obj.nominale), 0.5, 2000); if (nom != null) { out.base = nom; out.baseSource = 'foto'; }
    const tm = num(obj.tolMeno), tp = num(obj.tolPiu);
    if (tm != null || tp != null) { const t = Math.max(Math.abs(tm || 0), Math.abs(tp || 0)); if (t > 0 && t < 5) out.tolleranza = t; }
    let a = num(obj.giocoMinMm), b = num(obj.giocoMaxMm);
    if (a != null && b != null) { a = Math.round(Math.abs(a) * 10000) / 10; b = Math.round(Math.abs(b) * 10000) / 10; if (a > 0 && b > 0 && a < 500 && b < 500) { out.giocoMin = Math.min(a, b); out.giocoMax = Math.max(a, b); } }
    if (out.rows.F1A && nom != null) { out.rows.F1A.tolBase = nom; if (out.tolleranza != null) out.rows.F1A.tolMm = out.tolleranza; }
    if (obj.codice) out.header.codice = String(obj.codice).slice(0, 40);
    if (obj.lotto) out.header.lotto = String(obj.lotto).slice(0, 40);
    if (obj.note) out.notes.push(String(obj.note).slice(0, 160));
    if (out.S1A == null && out.F1A == null) return null;
    return out;
  }

  /** Italian messages for every failure. */
  function errText(code, status, where, detail) {
    const chat = where === 'chat';
    if (code === 'timeout' && chat) return 'L’AI ci sta mettendo troppo (nessuna risposta in tempo). Tocca «Riprova».';
    if (code === 'offline' && chat) return 'Niente internet: l’AI non è raggiungibile. Controlla la rete e tocca «Riprova».';
    if (code === 'empty') return 'L’AI ha mandato una risposta vuota. Tocca «Riprova».';
    const d = detail ? ' (' + String(detail).slice(0, 140) + ')' : '';
    if (status === 400 && /api key/i.test(detail || '')) return 'Chiave API non valida: incollala di nuovo in Setup.' + d;
    if (status && status !== 200 && !code) code = 'http';
    if (status && ![401, 403, 404, 429].includes(status) && status < 500) return 'Richiesta AI rifiutata (' + status + ')' + d + '.';

    if (code === 'nokey') return 'Manca la chiave API: mettila in Setup → Intelligenza artificiale.';
    if (code === 'offline') return 'Niente internet: l’AI non è raggiungibile. Usa la lettura normale (funziona senza rete).';
    if (code === 'timeout') return 'L’AI non risponde (tempo scaduto). Riprova o usa la lettura normale.';
    if (code === 'badjson') return 'L’AI ha risposto in modo non leggibile. Riprova o scrivi i valori a mano.';
    if (code === 'nocfg') return 'Indirizzo o modello AI mancante: completali in Setup → Intelligenza artificiale.';
    if (code === 'novision') return 'Questo servizio AI non legge le foto. Scegli Gemini, OpenRouter, Qwen o xAI in Setup.';
    if (code === 'nophoto') return 'Foto non più disponibile: rifai la foto.';
    if (status === 401 || status === 403) return 'Chiave API non valida o senza credito. Controllala in Setup.' + d;
    if (status === 404) return 'Modello o indirizzo non trovato. Controlla modello e URL in Setup.' + d;
    if (status === 429) return 'Limite gratuito raggiunto (troppe richieste). Aspetta un minuto e riprova.' + d;
    if (status >= 500) return 'Il servizio AI ha un problema in questo momento. Riprova tra poco.' + d;
    return 'Richiesta AI non riuscita' + (status ? ' (' + status + ')' : '') + '.';
  }

  let seq = 0; const waiting = {};
  root.__onAiResult = function (res) { const w = res && waiting[res.id]; if (!w) return; delete waiting[res.id]; clearTimeout(w.t); w.done(res); };
  /** POST {base}/chat/completions. Resolves {ok, text, status, code, error}. Never rejects. */
  function apiErr(text) {
    try { let o = typeof text === 'string' ? JSON.parse(text) : text; if (Array.isArray(o)) o = o[0]; const e = o && (o.error || o); return (e && (e.message || (typeof e === 'string' ? e : ''))) || ''; } catch (e) { return ''; }
  }
  function contentOf(text) {
    const o = typeof text === 'string' ? JSON.parse(text) : text, ch = o.choices && o.choices[0]; if (!ch) return null;
    let c = ch.message && ch.message.content; if (Array.isArray(c)) c = c.map((p) => p.text || '').join('');
    return c == null ? '' : String(c);
  }
  function post(cfg, body, where) {
    return new Promise((resolve) => {
      if (!cfg.baseUrl || !cfg.model) { resolve({ ok: false, code: 'nocfg', error: errText('nocfg') }); return; }
      if (!hasKey(cfg.provider)) { resolve({ ok: false, code: 'nokey', error: errText('nokey') }); return; }
      if (root.navigator && root.navigator.onLine === false) { resolve({ ok: false, code: 'offline', error: errText('offline') }); return; }
      const url = cfg.baseUrl + '/chat/completions', json = JSON.stringify(body), b = bridge();
      const finish = (r) => {
        if (r.ok) { let text = null; try { text = contentOf(r.text); } catch (e) {}
          if (text == null) { resolve({ ok: false, code: 'badjson', error: errText('badjson') }); return; }
          if (!text.trim()) { resolve({ ok: false, code: 'empty', error: errText('empty') }); return; }
          resolve({ ok: true, text }); return; }
        const det = r.text ? apiErr(r.text) : '';
        resolve({ ok: false, status: r.status || 0, code: r.code || 'http', detail: det, error: errText(r.code, r.status, where, det) });
      };
      if (b) {
        const id = 'ai' + (++seq); const t = setTimeout(() => { if (waiting[id]) { delete waiting[id]; finish({ ok: false, code: 'timeout' }); } }, cfg.timeoutMs + 5000);
        waiting[id] = { t, done: finish };
        try { b.aiPost(id, cfg.provider, url, json, cfg.timeoutMs); } catch (e) { delete waiting[id]; clearTimeout(t); finish({ ok: false, code: 'http' }); }
        return;
      }
      const key = webKey(cfg.provider);
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = setTimeout(() => { if (ctl) ctl.abort(); }, cfg.timeoutMs);
      root.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: json, signal: ctl ? ctl.signal : undefined })
        .then((r) => r.text().then((text) => { clearTimeout(t); finish({ ok: r.ok, status: r.status, text }); }))
        .catch((e) => { clearTimeout(t); finish({ ok: false, code: e && e.name === 'AbortError' ? 'timeout' : 'offline' }); });
    });
  }
  const FALLBACK = { gemini: ['gemini-flash-latest', 'gemini-2.5-flash'] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Retry 429/5xx (2×, backoff), on 404 try the provider's fallback models, drop reasoning_effort if refused. */
  async function postRetry(cfg, body, where, onStatus) {
    const models = [body.model].concat((FALLBACK[cfg.provider] || []).filter((m) => m !== body.model));
    let r, mi = 0, tries = 0;
    for (;;) {
      r = await post(cfg, body, where);
      if (r.ok) { r.model = body.model; return r; }
      if (r.status === 404 && mi + 1 < models.length && cfg.provider !== 'custom') { body = Object.assign({}, body, { model: models[++mi] }); if (onStatus) onStatus('Provo un altro modello…'); continue; }
      if (r.status === 400 && body.reasoning_effort && /reason|think/i.test(r.detail || '')) { body = Object.assign({}, body); delete body.reasoning_effort; continue; }
      if ((r.status === 429 || r.status >= 500 || r.code === 'empty') && tries < 2) { tries++; if (onStatus) onStatus('Riprovo (' + tries + '/2)…'); await sleep(ask.backoff[tries - 1]); continue; }
      return r;
    }
  }
  function ask(prefs, ctxText, question, history, onStatus) {
    const cfg = cfgOf(prefs);
    const hist = (history || []).slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 700) }));
    const messages = [{ role: 'system', content: systemPrompt(ctxText) }].concat(hist, [{ role: 'user', content: String(question).slice(0, 1500) }]);
    // Gemini 3 always "thinks"; thinking tokens count in max_tokens → 500 left the answer empty/slow. Keep thinking low and leave room.
    const body = { model: cfg.model, messages, temperature: 0.7, max_tokens: 2048 };
    if (cfg.provider === 'gemini') body.reasoning_effort = 'low';
    return postRetry(cfg, body, 'chat', onStatus);
  }
  ask.backoff = [2000, 5000];
  function readPhoto(prefs, dataUrl) {
    const cfg = cfgOf(prefs);
    if (!cfg.vision || !cfg.visionModel) return Promise.resolve({ ok: false, code: 'novision', error: errText('novision') });
    if (!dataUrl) return Promise.resolve({ ok: false, code: 'nophoto', error: errText('nophoto') });
    const vb = { model: cfg.visionModel, temperature: 0, max_tokens: 3000,
      messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: dataUrl } }, { type: 'text', text: VISION_PROMPT }] }] };
    if (cfg.provider === 'gemini') vb.reasoning_effort = 'low';
    return postRetry(cfg, vb, 'photo')
      .then((r) => { if (!r.ok) return r; const p = visionToParsed(extractJson(r.text)); return p ? { ok: true, parsed: p } : { ok: false, code: 'badjson', error: errText('badjson') }; });
  }
  const api = { md, apiErr, postRetry, FALLBACK, pasteKey, openLink, looksLikeKey, KEY_STEPS, PROVIDERS, DEFAULT_PROVIDER, DEFAULTS, WEB_KEY, REGOLE, REMINDER, cfgOf, hasKey, setKey, keyHint, buildContext, systemPrompt, foreignNumbers, extractJson, visionToParsed, errText, ask, readPhoto, VISION_PROMPT };
  root.RettificaAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
