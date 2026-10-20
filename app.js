/* Rettifica Beta v0.9.3 (base: Rettifica OmT v2.0.8) */
(function () {
  const STORAGE_KEY = 'rweb_v1';
  const PREFS_KEY = 'rweb_v1_prefs';
  const TEST_SEED_KEY = 'rweb_test_seed';
  const CLEAN_KEY = 'rweb_clean_206';       // v2.0.6 one-time clean start done
  const BACKUP_KEY = 'rweb_backup_pre206';
  const BACKUPS_KEY = 'rweb_backups';           // Beta 0.1.0: last 5 automatic backups (before migration / import / wipe)
  const APP_VERSION = '0.9.5';
  /** Beta 0.1.0: automatic local backup; also kept as the «hidden restore» backup (Setup). */
  function autoBackup(why, rawData, rawPrefs) {
    try {
      if (!rawData) return;
      const entry = { ts: new Date().toISOString(), from: why, appVersion: APP_VERSION, data: rawData, prefs: rawPrefs || null };
      let list = []; try { list = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]'); } catch (e) {}
      localStorage.setItem(BACKUPS_KEY, JSON.stringify(pushBackupList(list, entry, 5)));
      localStorage.setItem(BACKUP_KEY, JSON.stringify(entry));
    } catch (e) {}
  }  // automatic backup of the old data (restore: Setup, hidden)
  /** v2.0.6: first launch of this version → back up everything, then start CLEAN (only theme / voice / crop prefs kept). */
  (function cleanStartOnce() {
    try {
      if (localStorage.getItem(CLEAN_KEY)) return;
      const raw = localStorage.getItem(STORAGE_KEY), rawP = localStorage.getItem(PREFS_KEY);
      if (raw) autoBackup('pre-2.0.6', raw, rawP);
      let p = {}; try { p = JSON.parse(rawP || '{}') || {}; } catch (e) { p = {}; }
      const keep = {}; ['theme', 'voiceAuto', 'cropOff'].forEach((k) => { if (p[k] !== undefined) keep[k] = p[k]; });
      localStorage.removeItem(STORAGE_KEY); localStorage.setItem(PREFS_KEY, JSON.stringify(keep));
      localStorage.setItem(CLEAN_KEY, new Date().toISOString());
    } catch (e) {}
  })();
  const STUDER_NOTE = 'Su Studer il tasto + fa il pezzo più piccolo, − più grande.'; // legacy text only: the shown note is generated from the calibration (calNote)
  /** Beta 0.9.3: free user note without the old fixed Studer sentence (the +/− note comes from the calibration). */
  const userNote = (m) => String((m && m.note) || '').replace(STUDER_NOTE, '').replace(/^Rettificatrice\.\s*$/, 'Rettificatrice.').trim();
  const $ = (id) => document.getElementById(id);
  const L9 = window.Lavoro; // Beta 0.9.0 helpers (lavoro.js)
  const QT = window.Quota; // Beta 0.9.1–0.9.2 helpers (quota.js): ISO 286, Controllo quota, streak
  const esc = (t) => String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  let toastTimer = null;
  function clearToast() {
    const t = $('toast'); if (!t) return;
    clearTimeout(toastTimer); toastTimer = null;
    t.classList.remove('show'); t.classList.remove('warn');
  }
  function toast(msg, kind) {
    const t = $('toast'); if (!t) return;
    msg = String(msg == null ? '' : msg).split('\n')[0];
    if (msg.length > 56) msg = msg.slice(0, 54).trim() + '…';
    t.textContent = msg;
    t.className = 'toast show' + (kind === 'warn' ? ' warn' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove('show'); t.classList.remove('warn'); }, 2000);
  }
  function haptic(ms) {
    try { if (window.RettificaAndroid && RettificaAndroid.vibrate) RettificaAndroid.vibrate(ms || 30);
    else if (navigator.vibrate) navigator.vibrate(ms || 30); } catch (e) {}
  }
  function speakIt(text) {
    try { if (window.RettificaAndroid && RettificaAndroid.speak) { RettificaAndroid.speak(text); return; } } catch (e) {}
    try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(text); u.lang = 'it-IT'; speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch (e) {}
  }
  function uid() { return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function todayKey() { return new Date().toISOString().slice(0, 10); }
  function hasNativeOcr() { try { return !!(window.RettificaAndroid && RettificaAndroid.hasOcr && RettificaAndroid.hasOcr()); } catch (e) { return false; } }
  function setKeepScreen(on) { try { if (window.RettificaAndroid && RettificaAndroid.setKeepScreenOn) RettificaAndroid.setKeepScreenOn(!!on); } catch (e) {} }

  const HIST_MAX = 3000; // per series, oldest dropped
  // v2.0.6: the app starts EMPTY (no demo bases). Demo data only for the automated tests (localStorage 'rweb_test_seed').
  function defaultData() {
    let seed = false; try { seed = localStorage.getItem(TEST_SEED_KEY) === '1'; } catch (e) {}
    if (seed) return demoData();
    return { version: 2, singleMachine: true,
      machines: [{ id: 'm_mia', name: '', note: '', rule: 'studer', knob: { k: null, L0: null, trials: [], source: null, updatedAt: null } }],
      machinesArchive: [], series: [],
      pezzi: { entries: [], dayHistory: [] },
      turno: { startedAt: new Date().toISOString(), note: '', saves: [], checks: [], correzioni: 0 },
      turniArchivio: [], femmine: [], interni: [],
      training: { streak: 0, score: 0, todayCount: 0, todayKey: '', lastDay: '' },
    };
  }
  function demoData() {
    const mid = 'm_studer_o061';
    return { version: 2, singleMachine: true,
      machines: [{ id: mid, name: 'Studer O061', note: 'Rettificatrice.', rule: 'studer', knob: { k: null, L0: null, trials: [], source: null, updatedAt: null } }],
      machinesArchive: [],
      series: [
        { id: 's_24500', machineId: mid, name: 'Base 24,500', lotto: '', base: 24.5, tolleranza: 0.1, giocoMin: 10, giocoMax: 13, notes: '', history: [], stock: {} },
        { id: 's_24600', machineId: mid, name: 'Base 24,600', lotto: '', base: 24.6, tolleranza: 0.1, giocoMin: 10, giocoMax: 13, notes: '', history: [], stock: {} },
        { id: 's_20600', machineId: mid, name: 'Base 20,600', lotto: '', base: 20.6, tolleranza: 0.1, giocoMin: 10, giocoMax: 13, notes: '', history: [], stock: {} },
        { id: 's_22000', machineId: mid, name: 'Base 22,000', lotto: '', base: 22.0, tolleranza: 0.1, giocoMin: 7, giocoMax: 10, notes: '', history: [], stock: {} },
      ],
      pezzi: { entries: [], dayHistory: [] },
      turno: { startedAt: new Date().toISOString(), note: '', saves: [], checks: [], correzioni: 0 },
      turniArchivio: [],
      training: { streak: 0, score: 0, todayCount: 0, todayKey: '', lastDay: '' },
    };
  }
  // v1.9.3: manopola conicità per macchina. k = µm di conicità per tacca. Nessun valore pubblico → sconosciuto finché non si fa la taratura.
  function ensureKnob(m) {
    if (!m.knob || typeof m.knob !== 'object') m.knob = { k: null, L0: null, trials: [], source: null, updatedAt: null };
    if (!validKnobK(m.knob.k)) m.knob.k = null;
    if (!Array.isArray(m.knob.trials)) m.knob.trials = [];
    return m.knob;
  }
  function knobK(machine) { return machine && machine.knob && validKnobK(machine.knob.k) ? Number(machine.knob.k) : null; }
  function fmtK(k) { return String(Math.round(k * 100) / 100).replace('.', ','); }
  /**
   * v1.9.4: one machine ("la mia macchina"). Older data with several machines: the one in use stays,
   * the others go to machinesArchive (kept for history names), all series move to it.
   */
  function toSingleMachine(d) {
    d.machines = (d.machines || []).filter((m) => m && typeof m === 'object');
    d.machinesArchive = Array.isArray(d.machinesArchive) ? d.machinesArchive : [];
    let p = {}; try { p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch (e) { p = {}; }
    let cur = d.machines.find((m) => m.id === p.machineId) || d.machines[0];
    if (!cur) cur = { id: 'm_mia', name: 'La mia macchina', note: '', rule: 'studer' };
    ensureKnob(cur);
    if (cur.knob.k == null) { const donor = d.machines.find((m) => m !== cur && m.knob && validKnobK(m.knob.k)); if (donor) cur.knob = Object.assign({}, donor.knob); }
    if (!cur.rule) cur.rule = 'studer';
    d.machines.filter((m) => m !== cur).forEach((m) => { if (!d.machinesArchive.some((a) => a.id === m.id)) d.machinesArchive.push(m); });
    d.machines = [cur];
    (d.series || []).forEach((s) => { s.machineId = cur.id; });
    d.singleMachine = true;
  }
  function migrate(d) {
    if (!d) return defaultData();
    if (!d.pezzi) d.pezzi = { entries: [], dayHistory: [] };
    if (!d.turno) d.turno = { startedAt: new Date().toISOString(), note: '', saves: [], checks: [], correzioni: 0 };
    if (!Array.isArray(d.turno.saves)) d.turno.saves = [];
    if (!d.turniArchivio) d.turniArchivio = [];
    if (!d.training) d.training = { streak: 0, score: 0, todayCount: 0, todayKey: '', lastDay: '' };
    if (!Array.isArray(d.series)) d.series = [];
    if (!Array.isArray(d.controlli)) d.controlli = []; // Beta 0.9.1 Controllo quota
    if (!Array.isArray(d.quotaPezzi)) d.quotaPezzi = [];
    (d.machines || []).forEach((m) => { ensureKnob(m); });
    (d.series || []).forEach((s) => {
      if (!s.stock) s.stock = {};
      if (!s.history) s.history = [];
      if (!s.name || !/^Base /.test(s.name)) s.name = 'Base ' + fmtMm3(s.base);
      if (!d.v194 && !(Number(s.tolleranza) > 0)) s.tolleranza = 0.1; // v1.9.4: same ±0,1 everywhere
    });
    if (!d.singleMachine || (d.machines || []).length !== 1 || d.series.some((s) => s.machineId !== d.machines[0].id)) toSingleMachine(d);
    d.v194 = true;
    d.version = 2; return d;
  }
  function loadData() {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) { const d = defaultData(); d.v194 = true; d.preset072 = true; d.appVersion = APP_VERSION; saveData(d); return d; }
      const parsed = JSON.parse(raw);
      const d = migrate(JSON.parse(raw));
      // Beta 0.8.1: on update add the series «Corpo/Spillo Ø10» once, only if no series with base 10 exists (never touches other data)
      if (!d.preset072) { d.preset072 = true; d.series = d.series || [];
        if (!d.series.some((x) => Math.abs(Number(x.base) - 10) < 0.0005)) d.series.push(Object.assign({ id: 'corpo10_' + Date.now().toString(36), machineId: (d.machines && d.machines[0] && d.machines[0].id) || null, history: [], stock: {} }, presetCorpoSpillo10())); }
      // Beta 0.1.0: back up BEFORE a migration or an app update changes the saved data
      if (parsed.appVersion !== APP_VERSION || JSON.stringify(d) !== JSON.stringify(parsed)) { autoBackup('prima della migrazione ' + (parsed.appVersion || 'vecchia') + ' → ' + APP_VERSION, raw, localStorage.getItem(PREFS_KEY)); d.appVersion = APP_VERSION; }
      return d; }
    catch (e) { autoBackup('dati illeggibili all\'avvio', localStorage.getItem(STORAGE_KEY), localStorage.getItem(PREFS_KEY)); const d = defaultData(); saveData(d); return d; }
  }
  let jobsOn = false; // v1.9.6: active job follows every save once jobs are initialised
  function saveData(d) { if (jobsOn && d === state) captureJob(false); localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
  function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function savePrefs(p) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }

  let state = loadData(); saveData(state);
  let prefs = loadPrefs();
  let measureDigits = '';
  let manualPrefix = null; // v1.9.4: prefix for THIS measure only (Correggi, ULTIMI, photo); v2.0.2: explicit choice is sticky (stickyPrefix)
  /** v2.0.2: integer chosen explicitly in the «21, ▾» menu for this job / series (kept after Salva, Nuova, Annulla, restart). */
  function prefixCtx() { const s = currentContext().series; return s ? { jobId: jobsOn ? prefs.jobId : null, seriesId: s.id, base: s.base } : null; }
  function stickyPrefix() { return stickyPrefixFor(prefs.stickyPrefix, prefixCtx()); }
  function effPrefix() { return manualPrefix != null ? manualPrefix : stickyPrefix(); }
  let pezziDigits = '';
  let pendingTypo = null, lastCalc = null, trainQ = null;
  let savedFlash = false, saveLock = false, lastSaveRec = null, undoTimer = null;
  let undoFn = null; // v2.0.3: generic undo (job / machine / series delete); null → undo of the last save

  /* ---------- v1.9.6: Lavori (jobs) ---------- */
  let pendingJob = null; // { machineName, seriesOnly? } while «Nuovo lavoro» (or «Nuova serie» from the photo) waits for the photo
  const pjCancelMsg = () => (pendingJob && pendingJob.seriesOnly ? 'Nuova serie annullata' : 'Nuovo lavoro annullato');
  function activeJob() { return (state.jobs || []).find((j) => j.id === prefs.jobId) || null; }
  /** Keep the active job in sync with the context in use (machine name, knob k, series). */
  function captureJob(touch) {
    const j = activeJob(), m = myMachine(); if (!j || !m) return;
    const s = seriesById(prefs.seriesId);
    j.machineName = m.name; j.knob = cloneKnob(m.knob);
    if (s) { j.seriesId = s.id; j.base = s.base; j.giocoMin = s.giocoMin; j.giocoMax = s.giocoMax; }
    if (touch) j.updatedAt = new Date().toISOString();
  }
  function emptyKnob() { return { k: null, L0: null, trials: [], source: null, updatedAt: null }; }
  /** Put a job's machine (name + knob k) and series in use. */
  function applyJob(j) {
    const m = myMachine();
    if (m) {
      m.name = j.machineName || m.name;
      m.knob = knobForMachineName(state, m.name) || cloneKnob(j.knob) || emptyKnob(); ensureKnob(m);
    }
    prefs.jobId = j.id; savePrefs(prefs);
    let s = seriesById(j.seriesId);
    if (!s && j.base != null) s = state.series.find((x) => Math.abs(x.base - j.base) < 0.0005);
    if (s) setContext(null, s.id, false); else { captureJob(false); updateChip(); }
    saveData(state);
    return s;
  }
  function initJobs() {
    jobsOn = false;
    const { machine, series } = currentContext();
    ensureJobs(state, { machineName: machine ? machine.name : '', knob: machine && machine.knob, series });
    if (!activeJob()) {
      const list = jobsForToday(state, localDayKey(), null);
      const j = list[0] || state.jobs.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
      prefs.jobId = j.id; savePrefs(prefs);
      jobsOn = true; applyJob(j);
    }
    rolloverJobs(state, localDayKey(), prefs.jobId);
    jobsOn = true; captureJob(false); saveData(state); updateJobsPill();
  }
  function rememberMachineName(name, old) {
    if (!old || old === name) return;
    prefs.recentMachineNames = [old].concat((prefs.recentMachineNames || []).filter((n) => n !== old && n !== name)).slice(0, 5); savePrefs(prefs);
  }
  /** Start a new job; it becomes the active context. */
  function startJob(o) {
    captureJob(false);
    const m = myMachine();
    const name = String(o.machineName || (m && m.name) || 'Macchina').replace(/\s+/g, ' ').trim().slice(0, 40);
    const sameMachine = m && name.toLowerCase() === String(m.name).trim().toLowerCase();
    const knob = sameMachine ? cloneKnob(m.knob) : knobForMachineName(state, name);
    const j = makeJob({ machineName: name, knob, series: o.series, codice: o.codice, lotto: o.lotto, rev: o.rev, lav: o.lav });
    state.jobs = (state.jobs || []).filter((x) => x.machineName || x.seriesId || x.base != null); // v2.0.6: drop the empty first-start placeholder
    state.jobs.push(j);
    if (m) rememberMachineName(name, m.name);
    applyJob(j);
    rolloverJobs(state, localDayKey(), j.id);
    saveData(state); updateJobsPill();
    return j;
  }
  function updateJobsPill() {
    const el = $('jobsCount'); if (!el || !state.jobs) return;
    const n = jobsForToday(state, localDayKey(), prefs.jobId).length;
    // v2.0.5: one «Lavoro ▾» pill = machine name (end visible: the number matters) + count only when > 1
    const j = jobsOn ? activeJob() : null, m = myMachine();
    const name = (j && j.machineName) || (m && m.name) || '—';
    el.textContent = shortEnd(name, 13);
    const lb = $('jobsLbl'); if (lb) lb.textContent = n > 1 ? 'Lavori · ' + n : 'Lavoro';
  }
  function shortEnd(s, max) { s = String(s || ''); return s.length > max ? '…' + s.slice(-(max - 1)) : s; }
  /** v2.0.5: keypad sized to the free height (44–64 px rows) → full keypad + nav never overlap, on every phone */
  function fitPads() {
    requestAnimationFrame(() => {
      const nav = $('nav'); if (!nav) return;
      const limit = nav.getBoundingClientRect().top - 8;
      [['keypad', 'calcInputView'], ['fKeypad', 'page-femmina'], ['iKeypad', 'page-interno'], ['qKeypad', 'page-quota']].forEach(([id, host]) => {
        const pad = $(id), h = $(host); if (!pad) return;
        pad.style.gridTemplateRows = ''; pad.style.gap = ''; // stale sizes from another screen size never stay
        if (!h || !h.offsetParent || h.classList.contains('hidden')) return;
        const gap = innerHeight < 700 ? 5 : 8;
        const top = pad.getBoundingClientRect().top;
        const row = Math.max(44, Math.min(64, Math.floor((limit - top - 3 * gap) / 4)));
        pad.style.gap = gap + 'px'; pad.style.gridTemplateRows = `repeat(4,${row}px)`;
      });
    });
  }
  function fmtTime(ts) { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function jobCardHtml(j, active, archived) {
    const s = seriesById(j.seriesId);
    const base = s ? s.base : j.base, gmin = s ? s.giocoMin : j.giocoMin, gmax = s ? s.giocoMax : j.giocoMax;
    const st = jobStats(j, allSeries());
    const extra = metaLine(jobMeta(j, s));
    const last = st.last ? `ultima ${fmtMmS(st.last.S)} mm → pezzo ${st.last.chosen} · ${fmtTime(st.last.ts)}` : 'nessuna misura salvata';
    const when = j.day !== localDayKey() ? ' · ' + j.day.split('-').reverse().slice(0, 2).join('/') : '';
    return `<button type="button" class="job-card ${active ? 'on' : ''}" data-job="${esc(j.id)}" ${archived ? 'data-arch="1"' : ''}>
      <span class="jc-top"><b class="cond">${esc(j.machineName)}</b>${active ? '<span class="sheet-on">IN CORSO</span>' : ''}<span class="jc-n">${st.count} ${st.count === 1 ? 'pezzo' : 'pezzi'}</span></span>
      <span class="jc-mid">${base != null ? 'Base ' + esc(fmtMm3(base)) : 'Serie ?'}${gmin != null ? ' · gioco ' + gmin + '–' + gmax + ' µm' : ''}${esc(when)}</span>
      ${extra ? `<span class="jc-sub">${esc(extra)}</span>` : ''}
      <span class="jc-sub">${esc(last)}</span></button>`;
  }
  // ── v2.0.3: delete jobs / machine names (undo 8 s) ──
  const TRASH = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
  function jobRowHtml(j, active, archived) {
    return `<div class="job-row">${jobCardHtml(j, active, archived)}<button type="button" class="job-del" data-jdel="${esc(j.id)}" aria-label="Elimina lavoro ${esc(j.machineName)}">${TRASH}</button></div>`;
  }
  function findJob(id) { return (state.jobs || []).find((j) => j.id === id) || (state.jobsArchive || []).find((j) => j.id === id) || null; }
  function knobOfName(name) {
    const m = myMachine();
    const k = m && String(m.name).trim().toLowerCase() === String(name || '').trim().toLowerCase() ? knobK(m) : null;
    if (k != null) return k;
    const kn = knobForMachineName(state, name); return kn && validKnobK(kn.k) ? Number(kn.k) : null;
  }
  const knobChk = (id, name, k) => (k == null ? '' : `<label class="del-chk"><input type="checkbox" id="${id}"/><span>Elimina anche la taratura manopola di <b>${esc(name)}</b> (${esc(fmtK(k))} µm/tacca)</span></label>`);
  function openJobDelete(id) {
    if (prefs.jobId === id) captureJob(false);
    const j = findJob(id); if (!j) return;
    const n = jobStats(j, allSeries()).count, active = id === prefs.jobId, k = knobOfName(j.machineName);
    let nextName = '';
    if (active) { const nx = jobsForToday(state, localDayKey(), null).filter((x) => x.id !== id)[0] || (state.jobs || []).filter((x) => x.id !== id)[0]; nextName = nx ? nx.machineName : ''; }
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal del-confirm" id="jobDel">
      <h2>Eliminare il lavoro «${esc(j.machineName)}»?</h2>
      <p class="del-p">${n ? `${n} ${n === 1 ? 'pezzo salvato resta' : 'pezzi salvati restano'} nello <b>Storico</b> e nei conteggi del <b>Turno</b>.` : 'Nessun pezzo salvato in questo lavoro.'}</p>
      ${active ? `<p class="del-p meta">È il lavoro in corso: ${nextName ? `passi a «${esc(nextName)}».` : 'ne parte uno nuovo con la stessa macchina.'}</p>` : ''}
      ${knobChk('jdKnob', j.machineName, k)}
      <button type="button" class="btn btn-sec del-btn" id="jdKeep">${TRASH}<span>Elimina lavoro${n ? ' (tieni i pezzi)' : ''}</span></button>
      ${n ? `<button type="button" class="btn btn-danger primary-danger del-btn" id="jdAll">${TRASH}<span>Elimina anche i pezzi (${n})</span></button>` : ''}
      <button type="button" class="btn btn-sec del-btn" id="jdCancel">Annulla</button></div></div>`;
    const back = () => openJobsSheet();
    $('jdCancel').onclick = back;
    $('modalBg').onclick = (ev) => { if (ev.target.id === 'modalBg') back(); };
    const go = (withPieces) => { const wk = !!($('jdKnob') && $('jdKnob').checked); haptic(30); doDeleteJob(id, withPieces, wk); };
    $('jdKeep').onclick = () => go(false);
    if ($('jdAll')) $('jdAll').onclick = () => go(true);
  }
  function doDeleteJob(id, withPieces, withKnob) {
    const wasActive = id === prefs.jobId;
    if (wasActive) captureJob(false);
    const snap = deleteJob(state, id, { withPieces, withKnob }); if (!snap) return;
    const m = myMachine();
    if (withKnob && m && String(m.name).trim().toLowerCase() === String(snap.job.machineName).trim().toLowerCase()) { snap.machineKnob = m.knob; m.knob = emptyKnob(); }
    const removed = new Set(snap.removedIds || []);
    snap.prevHint = prefs.lastHint || null; snap.prevLastSave = lastSaveRec;
    if (prefs.lastHint && removed.has(prefs.lastHint.saveId)) prefs.lastHint = null;
    if (lastSaveRec && removed.has(lastSaveRec.id)) lastSaveRec = null;
    snap.wasActive = wasActive;
    if (wasActive) {
      const nx = nextActiveJob(state, localDayKey());
      if (nx) { applyJob(nx); nx.updatedAt = nx.updatedAt || new Date().toISOString(); }
      else { prefs.jobId = null; const nj = startJob({ machineName: (m && m.name) || snap.job.machineName, series: currentContext().series }); snap.createdJobId = nj.id; }
      newMeasure();
    }
    savePrefs(prefs); saveData(state); updateJobsPill(); updateChip(); renderRecent(); renderFatti(); renderRiepilogo();
    openJobsSheet();
    const msg = `Lavoro «${snap.job.machineName}» eliminato` + (withPieces && snap.pieces.length ? ` con ${snap.pieces.length} ${snap.pieces.length === 1 ? 'pezzo' : 'pezzi'}` : '');
    showUndo(msg, () => undoDeleteJob(snap), 'del');
  }
  function undoDeleteJob(snap) {
    if (snap.createdJobId) {
      const nj = (state.jobs || []).find((x) => x.id === snap.createdJobId);
      if (nj && !jobStats(nj, allSeries()).count) state.jobs = state.jobs.filter((x) => x.id !== snap.createdJobId);
    }
    restoreJob(state, snap);
    const m = myMachine();
    if (snap.machineKnob && m) m.knob = snap.machineKnob;
    prefs.lastHint = snap.prevHint; if (snap.prevLastSave) lastSaveRec = snap.prevLastSave;
    if (snap.wasActive) { applyJob(snap.job); newMeasure(); }
    savePrefs(prefs); saveData(state); updateJobsPill(); updateChip(); renderRecent(); renderFatti(); renderRiepilogo();
    if (document.querySelector('.jobs-sheet')) openJobsSheet();
    toast('Lavoro «' + snap.job.machineName + '» ripristinato');
  }
  /** Recent machine names (chips) with a delete button; the confirm opens inline in the same dialog. */
  function machineChipsHtml(recent) {
    if (!recent.length) return '';
    return `<div class="chips mch-chips">${recent.map((n) => `<span class="mch"><button type="button" class="chip" data-mname="${esc(n)}">${esc(n)}</button><button type="button" class="chip-del" data-mdel="${esc(n)}" aria-label="Elimina ${esc(n)} dall'elenco">${TRASH}</button></span>`).join('')}</div><div id="mchConfirm" class="mch-confirm hidden"></div>`;
  }
  function wireMachineChips(reopen) {
    $('modalRoot').querySelectorAll('[data-mdel]').forEach((b) => {
      b.onclick = (ev) => {
        ev.stopPropagation(); haptic(15);
        const name = b.dataset.mdel, k = knobOfName(name), box = $('mchConfirm');
        box.innerHTML = `<div class="del-p">Togliere <b>${esc(name)}</b> dall'elenco delle macchine? I lavori e i pezzi restano.</div>${knobChk('mdKnob', name, k)}
          <div class="mch-act"><button type="button" class="btn btn-sec" id="mdNo">Annulla</button><button type="button" class="btn btn-danger primary-danger" id="mdYes">${TRASH}<span>Togli</span></button></div>`;
        box.classList.remove('hidden');
        $('mdNo').onclick = () => { box.classList.add('hidden'); box.innerHTML = ''; };
        $('mdYes').onclick = () => {
          const withKnob = !!($('mdKnob') && $('mdKnob').checked);
          const list = prefs.recentMachineNames || [], idx = list.indexOf(name);
          const snap = { name, idx, knobs: null, machineKnob: null };
          prefs.recentMachineNames = list.filter((x) => x !== name);
          if (withKnob) {
            snap.knobs = clearKnobForName(state, name);
            const m = myMachine(); if (m && String(m.name).trim().toLowerCase() === name.trim().toLowerCase()) { snap.machineKnob = m.knob; m.knob = emptyKnob(); }
          }
          savePrefs(prefs); saveData(state); reopen();
          showUndo(`«${name}» tolta dall'elenco`, () => {
            const l = (prefs.recentMachineNames || []).filter((x) => x !== name); l.splice(Math.max(0, Math.min(snap.idx, l.length)), 0, name); prefs.recentMachineNames = l.slice(0, 5);
            if (snap.knobs) restoreKnobForName(state, name, snap.knobs);
            if (snap.machineKnob && myMachine()) myMachine().knob = snap.machineKnob;
            savePrefs(prefs); saveData(state);
            if (document.querySelector('.new-job') || document.querySelector('.mach-dialog')) reopen();
            toast('«' + name + '» ripristinata');
          }, 'del');
        };
      };
    });
  }
  function openSeriesDelete(id) {
    const s = seriesById(id); if (!s) return;
    const n = (s.history || []).length, active = (currentContext().series || {}).id === id;
    const nx = active ? nextSeriesAfterDelete(state.series.filter((x) => x.id !== id), prefs.lastMeasureBySeries) : null;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal del-confirm" id="seriesDel">
      <h2>Eliminare la serie Base ${esc(fmtMm3(s.base))}?</h2>
      <p class="del-p meta">gioco ${s.giocoMin}–${s.giocoMax} µm · tol ±${esc(fmtMm3(seriesTol(s)))}${s.lotto ? ' · ' + esc(s.lotto) : ''}</p>
      <p class="del-p">${n ? `${n} ${n === 1 ? 'misura salvata resta' : 'misure salvate restano'} nello <b>Storico</b>.` : 'Nessuna misura salvata.'}</p>
      ${active ? `<p class="del-p meta">È la serie in uso: ${nx ? `passi a <b>Base ${esc(fmtMm3(nx.base))}</b>.` : 'non restano altre serie, poi fai <b>Nuovo lavoro</b>.'}</p>` : ''}
      <button type="button" class="btn btn-danger primary-danger del-btn" id="sdYes">${TRASH}<span>Elimina serie</span></button>
      <button type="button" class="btn btn-sec del-btn" id="sdNo">Annulla</button></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('sdNo').onclick = close; $('modalBg').onclick = (ev) => { if (ev.target.id === 'modalBg') close(); };
    $('sdYes').onclick = () => { haptic(30); close(); doDeleteSeries(id); };
  }
  function doDeleteSeries(id) {
    const wasActive = (currentContext().series || {}).id === id, prevSid = prefs.seriesId;
    if (wasActive) captureJob(false);
    const snap = deleteSeries(state, id); if (!snap) return;
    snap.prevCalc = null;
    if (lastCalc && lastCalc.seriesId === id) { snap.prevCalc = lastCalc; lastCalc = null; showInputView(); }
    let nx = null;
    if (wasActive) {
      nx = nextSeriesAfterDelete(state.series, prefs.lastMeasureBySeries);
      if (nx) setContext(null, nx.id, false); else { prefs.seriesId = null; savePrefs(prefs); updateChip(); updatePrefix(); }
      measureDigits = ''; manualPrefix = null; refreshDisplay();
    }
    saveData(state);
    if ($('page-serie').classList.contains('active')) renderSeries();
    if ($('page-storico').classList.contains('active')) renderStorico();
    updateChip(); renderRecent();
    const msg = `Serie Base ${fmtMm3(snap.series.base)} eliminata` + (wasActive ? (nx ? ` · ora Base ${fmtMm3(nx.base)}` : '') : '');
    showUndo(msg, () => {
      restoreSeries(state, snap);
      if (wasActive) setContext(null, prevSid || id, false);
      if (snap.prevCalc && !lastCalc) { lastCalc = snap.prevCalc; }
      saveData(state); updateChip(); renderRecent();
      if ($('page-serie').classList.contains('active')) renderSeries();
      if ($('page-storico').classList.contains('active')) renderStorico();
      if (document.querySelector('.new-job') && state.series.length) $('modalRoot').innerHTML = '';
      toast('Serie Base ' + fmtMm3(snap.series.base) + ' ripristinata');
    }, 'del');
    if (wasActive && !nx) { toast('Nessuna serie: fai Nuovo lavoro', 'warn'); openNewJob(); }
  }
  function openJobsSheet() {
    captureJob(false);
    const today = localDayKey();
    const list = jobsForToday(state, today, prefs.jobId);
    const arch = (state.jobsArchive || []).slice(-30).reverse();
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal jobs-sheet">
      <h2>Lavori di oggi</h2>
      <button type="button" class="btn-job wide" id="jsNew"><span class="ji">📷</span><span><b>Nuovo lavoro</b><small>📷 Foto del foglio → dati del lavoro</small></span></button>
      <button type="button" class="btn btn-sec" id="jsMach" style="width:100%;min-height:52px;margin-top:8px">✎ Macchina: ${esc((myMachine() || {}).name || '—')} · rinomina / taratura</button>
      <div class="js-tools"><button type="button" class="btn btn-sec" id="jsData">✎ Dati lavoro</button><button type="button" class="btn btn-sec" id="jsRecv">📥 Ricevi lavoro</button><button type="button" class="btn btn-sec" id="jsSend">📤 Invia lavoro</button></div>
      <button type="button" class="btn btn-sec" id="jsQuota" style="width:100%;min-height:52px;margin-top:8px">📏 Controllo quota (DENTRO / FUORI)</button>
      <div class="job-list">${list.map((j) => jobRowHtml(j, j.id === prefs.jobId)).join('')}</div>
      ${arch.length ? `<details class="adv"><summary>Giorni precedenti (${(state.jobsArchive || []).length})</summary>
        <p class="meta" style="margin:4px 0 8px">Tocca per riprenderlo oggi (stessa macchina e serie).</p>
        <div class="job-list">${arch.map((j) => jobRowHtml(j, false, true)).join('')}</div></details>` : ''}
      <div class="actions" style="display:flex;margin-top:12px"><button type="button" class="btn btn-sec" id="jsClose" style="flex:1">Chiudi</button></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('jsClose').onclick = close;
    $('modalBg').onclick = (ev) => { if (ev.target.id === 'modalBg') close(); };
    $('jsNew').onclick = () => { close(); openNewJob(); };
    $('jsMach').onclick = () => { close(); openMachineDialog(); };
    $('jsData').onclick = () => { close(); openJobData(); }; $('jsRecv').onclick = () => { close(); openReceiveMenu(); }; $('jsSend').onclick = () => { close(); openSendJob(); }; $('jsQuota').onclick = () => { close(); openQuota(); };
    $('modalRoot').querySelectorAll('[data-jdel]').forEach((b) => { b.onclick = (ev) => { ev.stopPropagation(); haptic(15); openJobDelete(b.dataset.jdel); }; });
    $('modalRoot').querySelectorAll('[data-job]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.job;
        if (b.dataset.arch) { // resume an archived job as a new job today
          const a = (state.jobsArchive || []).find((x) => x.id === id); if (!a) return;
          close(); const j = startJob({ machineName: a.machineName, series: seriesById(a.seriesId) || null, codice: a.codice, lotto: a.lotto });
          if (!seriesById(j.seriesId)) { j.base = a.base; j.giocoMin = a.giocoMin; j.giocoMax = a.giocoMax; }
          newMeasure(); showPage('calc'); toast('Ripreso: ' + j.machineName); return;
        }
        if (id === prefs.jobId) { close(); return; }
        const j = state.jobs.find((x) => x.id === id); if (!j) return;
        captureJob(false); close();
        const s = applyJob(j); j.updatedAt = new Date().toISOString(); saveData(state); updateJobsPill();
        newMeasure(); showPage('calc');
        toast(s ? `Lavoro: ${j.machineName} · Base ${fmtMm3(s.base)}` : `Lavoro: ${j.machineName} · serie eliminata, scegli la serie`, s ? '' : 'warn');
      };
    });
  }
  function openNewJob() {
    const m = myMachine();
    const recent = (prefs.recentMachineNames || []).filter((n) => n && m && n !== m.name).slice(0, 3);
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal new-job">
      <h2>Nuovo lavoro</h2>
      <label for="njName">Macchina</label>
      <input id="njName" class="big-input cond" value="${esc(m ? m.name : '')}" maxlength="40" autocomplete="off" placeholder="es. S33 O060"/>
      ${machineChipsHtml(recent)}
      <button type="button" class="btn-job wide" id="njPhoto" style="margin-top:14px"><span class="ji">📷</span><span><b>Scatta foto del foglio</b><small>Legge base, tolleranza, gioco, codice e lotto (nessun calcolo)</small></span></button>
      <button type="button" class="btn btn-sec src-gal" id="njGallery" style="width:100%;margin-top:10px;min-height:56px">🖼 Dalla galleria <small>(foto già fatta)</small></button>
      <button type="button" class="btn btn-sec" id="njManual" style="width:100%;margin-top:10px;min-height:56px">Senza foto: scrivo a mano</button>
      <button type="button" class="btn btn-sec" id="njQuota" style="width:100%;margin-top:10px;min-height:56px">📏 Controllo quota <small>(senza accoppiamento)</small></button>
      <div id="njErr" class="form-err hidden"></div>
      <div class="actions" style="display:flex;margin-top:10px"><button type="button" class="btn btn-sec" id="njCancel" style="flex:1">Annulla</button></div></div></div>`;
    const inp = $('njName');
    const name = () => inp.value.replace(/\s+/g, ' ').trim();
    const need = () => { if (name()) return true; $('njErr').textContent = 'Scrivi il nome della macchina'; $('njErr').classList.remove('hidden'); return false; };
    $('modalRoot').querySelectorAll('[data-mname]').forEach((b) => { b.onclick = () => { inp.value = b.dataset.mname; }; });
    wireMachineChips(openNewJob);
    $('njCancel').onclick = () => { $('modalRoot').innerHTML = ''; };
    $('modalBg').onclick = (ev) => { if (ev.target.id === 'modalBg') $('modalRoot').innerHTML = ''; };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('njPhoto').click(); } });
    $('njPhoto').onclick = () => { if (!need()) return; pendingJob = { machineName: name() }; $('modalRoot').innerHTML = ''; openFoto('camera'); };
    $('njGallery').onclick = () => { if (!need()) return; pendingJob = { machineName: name() }; $('modalRoot').innerHTML = ''; openFoto('gallery'); };
    $('njQuota').onclick = () => { const nm = name(); if (nm && myMachine() && nm !== myMachine().name) { rememberMachineName(nm, myMachine().name); myMachine().name = nm; saveData(state); updateJobsPill(); } $('modalRoot').innerHTML = ''; openQuota(); };
    $('njManual').onclick = () => {
      if (!need()) return;
      $('modalRoot').innerHTML = '';
      const j = startJob({ machineName: name(), series: currentContext().series });
      newMeasure(); showPage('calc');
      toast('Nuovo lavoro: ' + j.machineName + ' · scegli la serie');
      openSeriesSheet();
    };
  }

  function machineById(id) { return state.machines.find((m) => m.id === id) || (state.machinesArchive || []).find((m) => m.id === id); }
  function myMachine() { return state.machines[0]; }
  function seriesById(id) { return state.series.find((s) => s.id === id); }
  /** v2.0.3: deleted series stay readable (Storico, CSV, job counts) */
  function allSeries() { return state.series.concat(state.seriesArchive || []); }
  function seriesAny(id) { return allSeries().find((s) => s.id === id); }
  function currentContext() {
    const machine = myMachine();
    let series = seriesById(prefs.seriesId);
    if (!series) series = state.series.find((s) => Math.abs(s.base - 24.6) < 0.001) || state.series[0] || null;
    return { machine, series };
  }
  function setContext(machineId, seriesId, announce) {
    const prev = prefs.seriesId;
    prefs.machineId = myMachine() ? myMachine().id : null; prefs.seriesId = seriesId; savePrefs(prefs);
    if (seriesId !== prev) manualPrefix = null;
    if (jobsOn) { captureJob(false); saveData(state); }
    updateChip(); updatePrefix(); renderLastHint();
    if (announce && seriesId && seriesId !== prev) {
      const s = seriesById(seriesId); if (s) toast('Gioco ' + s.giocoMin + '–' + s.giocoMax + ' µm');
    }
  }


  function showPage(name) {
    clearToast(); setTimeout(fitPads, 0);
    const prevActive = document.querySelector('.page.active');
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('.nv').forEach((b) => {
      const map = { macchine: 'setup', serie: 'setup', train: 'setup', guida: 'setup', chat: 'setup', quaderno: 'setup', disegno: 'aiuto', quota: 'calc', femmina: 'calc', interno: 'calc', manuale: 'calc' };
      b.classList.toggle('on', b.dataset.page === name || b.dataset.page === map[name]);
    });
    const page = $('page-' + name); if (page) page.classList.add('active');
    if (prefs.lastPage !== name) { prefs.lastPage = name; savePrefs(prefs); } // Beta 0.9.4: reopen «Controllo quota» after a restart
    document.body.dataset.page = name; // v2.0.6: the undo bar leaves the ← of «Adatta alla femmina» free
    if (!prevActive || prevActive !== page) $('mainWrap').scrollTop = 0; // v1.9.4: new page opens at the top
    if (name === 'calc') { renderEmpty(); updateChip(); updatePrefix(); refreshDisplay(); renderRecent(); }
    if (name === 'setup') { fillSetupSelects(); refreshSetup090(); }
    if (name === 'quaderno') renderQuaderno();
    if (name === 'quota') renderQuota();
    if (name === 'macchine') renderMachines();
    if (name === 'serie') renderSeries();
    if (name === 'storico') { histShown = 50; renderFemList(); renderIntList(); renderQuotaList(); renderManList(); renderStorico(); renderAndamento(); renderArchivio(); }
    if (name === 'turno') { renderTurno(); renderStock(); renderPezzi(); renderRiepilogo(); }
    if (name === 'train') renderTrain();
    if (name === 'femmina') renderFemPage();
    if (name === 'interno') renderIntPage();
    if (name === 'manuale') { if (prevActive !== page) manOnOpen(); renderMan(); } // Beta 0.8.1: draft back, current measure empty
    if (name === 'chat') renderChat();
    if (name === 'aiuto') renderAiuto();
    if (name !== 'calc' || $('calcResultView').classList.contains('hidden')) $('actBar').classList.add('hidden');
    else $('actBar').classList.remove('hidden');
    if (name !== 'calc' && !undoFn) hideUndo(); // v2.0.3: a delete undo stays for its 8 s across pages
    requestAnimationFrame(placeUndo);
  }
  window.addEventListener('resize', () => requestAnimationFrame(placeUndo));
  function updateChip() {
    renderEmpty();
    const { machine, series } = currentContext();
    renderLavoro();
    $('machCode').textContent = machine ? machine.name : '—';
    updateJobsPill(); renderJobStrip();
    if (series) {
      $('chipTitle').textContent = 'Base ' + fmtMm3(series.base);
      const sub = $('chipSub'); if (sub) sub.textContent = (machine ? machine.name : '') + ' · gioco ' + series.giocoMin + '–' + series.giocoMax + ' µm';
    } else {
      $('chipTitle').textContent = 'Scegli serie';
      const sub = $('chipSub'); if (sub) sub.textContent = 'Tocca per scegliere';
    }
  }
  function updatePrefix() {
    const { series } = currentContext(); if (!series) { $('measurePrefix').innerHTML = ''; $('prefixMenu').innerHTML = ''; return; }
    const bi = Math.floor(series.base);
    const sp = stickyPrefix();
    let cur = effPrefix() != null ? effPrefix() : bi; const cur0 = cur;
    if (measureDigits) { const p = interpretNearBase(measureDigits, series.base, seriesTol(series), effPrefix()); if (p && p.prefix != null && p.value != null) cur = p.prefix; }
    $('measurePrefix').innerHTML = cur + ',<i>▾</i>';
    $('measurePrefix').classList.toggle('sticky', sp != null && sp !== bi);
    $('measurePrefix').classList.toggle('auto-chg', cur !== cur0); // v2.0.8: integer changed by itself → orange
    $('prefixMenu').innerHTML = '<div class="pm-h">Intero · resta fisso</div>' + [bi - 1, bi, bi + 1].map((p) =>
      `<button type="button" data-pref="${p}" class="${p === cur ? 'on' : ''}">${p},</button>`).join('');
  }
  /** Beta 0.8.1: big live preview of the measure the app will use, with machine, job, base and gioco nearby. */
  function renderLivePrev(series, p) {
    const el = $('livePreview'), cx = $('liveCtx'); if (!el) return;
    const m = myMachine(), j = jobsOn ? activeJob() : null;
    el.innerHTML = 'Misura interpretata: <b class="cond">' + (p && p.value != null ? esc(fmtMm4(p.value)) + ' mm' : '—') + '</b>';
    $('livePrev').classList.toggle('bad', !!(measureDigits && !(p && p.value != null)));
    const dl = $('dispLbl'); if (dl) dl.textContent = innerHeight <= 700 && series ? 'Maschio S · gioco ' + series.giocoMin + '–' + series.giocoMax + ' µm' : 'Misura maschio S'; // short screens: gioco next to the measure, machine/base in the pills above
    cx.textContent = [m && m.name ? 'Macchina ' + m.name : null, j ? 'Lavoro ' + (j.name || j.machineName || '') : null,
      series ? 'Base ' + fmtMm3(series.base) + ' mm' : 'nessuna base', series ? 'gioco ' + series.giocoMin + '–' + series.giocoMax + ' µm' : null, series && series.fixedF != null ? 'femmina fissa ' + fmtMm4(series.fixedF) : null].filter(Boolean).join(' · ');
  }
  function refreshDisplay() {
    const { series } = currentContext(); $('digDisplay').textContent = measureDigits;
    const st = $('liveStatus'), txt = $('liveStatusTxt');
    updatePrefix();
    if (!series || !measureDigits) {
      renderLivePrev(series, null);
      st.classList.remove('bad'); const sp = stickyPrefix(); fitPads();
      txt.textContent = 'inserisci misura' + (sp != null && sp !== Math.floor(series.base) ? ' · intero ' + sp + ', fisso' : ''); return;
    }
    const p = interpretNearBase(measureDigits, series.base, seriesTol(series), effPrefix());
    renderLivePrev(series, p);
    if (!p || p.value == null) { st.classList.add('bad'); txt.textContent = 'misura non valida'; return; }
    const d = round1((p.value - series.base) * 1000);
    const ok = Math.abs(d) <= seriesTol(series) * 1000 + 1e-6;
    st.classList.toggle('bad', !ok);
    const base0 = effPrefix() != null ? effPrefix() : Math.floor(series.base);
    const autoChg = p.prefix != null && p.prefix !== base0;
    txt.textContent = (d >= 0 ? '+' : '') + fmtUm(d) + (autoChg ? ' µm · ' : ' µm dalla base · ') + (ok ? 'ok' : 'controlla') + (autoChg ? ' · intero ' + p.prefix + ', (auto)' : '');
    fitPads();
  }
  function renderRecent() {
    renderLastHint();
    const { series } = currentContext(); const row = $('recentRow');
    const hist = (series && series.history) || [];
    const last = hist.slice().sort((a, b) => (b.ts || '').localeCompare(a.ts || '')).slice(0, 3);
    if (!last.length) { row.innerHTML = '<span class="h mono">ULTIMI</span><span class="empty" style="padding:0;font-size:13px">nessuna ancora</span>'; return; }
    row.innerHTML = '<span class="h mono">ULTIMI</span>' + last.map((h) => {
      const frac = String(fmtMmS(h.S).split(',')[1] || '');
      return `<button type="button" class="rc cond" data-reuse="${esc(String(h.S))}">${esc(frac)} → <b>${esc(String(h.chosen))}</b></button>`;
    }).join('');
  }
  function showInputView() { $('calcInputView').classList.remove('hidden'); fitPads(); $('calcResultView').classList.add('hidden'); $('actBar').classList.add('hidden'); savedFlash = false; }
  function showResultView() { $('calcInputView').classList.add('hidden'); $('calcResultView').classList.remove('hidden'); $('actBar').classList.remove('hidden'); }
  function newMeasure() {
    measureDigits = ''; manualPrefix = null; lastCalc = null; pendingTypo = null;
    $('typoBox').classList.add('hidden'); showInputView(); refreshDisplay(); renderRecent();
  }

  function showTypoBox(value, display, guard) {
    const { series } = currentContext();
    pendingTypo = { value, display, suggestion: guard.suggestion };
    const box = $('typoBox'); box.classList.remove('hidden'); box.classList.toggle('hard', !!guard.hard);
    const sp = stickyPrefix();
    const pin = guard.suggestion != null && sp != null && Math.floor(guard.suggestion + 1e-9) !== sp
      ? `<div class="pin-note">Intero fisso: <b>${sp},</b> — «Correggi» vale solo per questa misura. Per cambiarlo tocca <b>${sp}, ▾</b>.</div>` : '';
    const sug = guard.suggestion != null ? `<div style="margin:.4rem 0">Intendevi <b>${esc(fmtMmS(guard.suggestion))}</b>?</div>${pin}` : '';
    if (guard.hard) {
      box.innerHTML = `<div><b>Misura impossibile per Base ${esc(fmtMm3(series.base))}</b> (${esc(fmtMmS(value))}, ${esc(fmtUm(round1((value - series.base) * 1000)))} µm). Riscrivi la misura${guard.suggestion != null ? ' o correggi' : ''}.</div>${sug}
        <div class="actions">${guard.suggestion != null ? '<button type="button" class="btn btn-orange" id="typoFix" style="flex:1">Correggi</button>' : ''}
        <button type="button" class="btn btn-sec" id="typoRetype" style="flex:1">Riscrivi</button></div>`;
      return;
    }
    box.innerHTML = `<div>${esc(guard.warnings.join(' · '))}</div>${sug || '<div style="margin:.4rem 0">Controlla</div>'}
      <div class="actions">${guard.suggestion != null ? '<button type="button" class="btn btn-orange" id="typoFix" style="flex:1">Correggi</button>' : ''}
      <button type="button" class="btn btn-teal" id="typoOk" style="flex:1">Conferma ${esc(fmtMmS(value))}</button></div>`;
  }
  function doCalcFlow(force) {
    const { machine, series } = currentContext();
    if (!series || !machine) { toast('Scegli la serie'); return; }
    if (!measureDigits) { toast('Inserisci la misura'); return; }
    const p = interpretNearBase(measureDigits, series.base, seriesTol(series), effPrefix());
    if (!p || p.value == null) { toast((p && p.warning) || 'Misura non valida'); return; }
    const lastS = (prefs.lastMeasureBySeries && prefs.lastMeasureBySeries[series.id] && prefs.lastMeasureBySeries[series.id].S) || null;
    const guard = typoGuard(p.value, series.base, seriesTol(series), lastS);
    // v2.0.2: digits like 21996 while the chosen integer is 22 → never switch silently: ask
    if (p.altCompact != null) {
      guard.warn = true; guard.suggestion = p.altCompact;
      guard.warnings = ['Hai scelto l\'intero ' + p.prefix + ',: ' + p.display + ' non è vicino alla base'].concat(guard.warnings.filter((w) => !/incoerente/.test(w)));
    }
    if (guard.hard || (guard.warn && !force)) { showTypoBox(p.value, p.display, guard); return; }
    $('typoBox').classList.add('hidden'); runCalc(p.value, p.display || fmtMmS(p.value));
  }
  /** Gioco used by the current calculation: photo override (G row) or series. */
  function calcGioco(lc, series) {
    if (lc && lc.giocoMin != null && lc.giocoMax != null) return { min: lc.giocoMin, max: lc.giocoMax, src: lc.giocoSrc || 'serie' };
    return { min: series.giocoMin, max: series.giocoMax, src: 'serie' };
  }
  function currentDrift(series, machine, extraS) {
    const pts = driftPoints((state.turno && state.turno.saves) || [], series.id, todayKey());
    if (extraS != null) pts.push(extraS);
    return detectDrift(pts, { base: series.base, machineRule: (machine && machine.rule) || 'studer' });
  }
  function runCalc(S, display, opts) {
    const { machine, series } = currentContext();
    if (!series) { toast('Scegli la serie'); return; }
    const aj0 = jobsOn ? activeJob() : null, jOv = aj0 && aj0.giocoOv && aj0.giocoOv.seriesId === series.id ? { min: aj0.giocoOv.min, max: aj0.giocoOv.max, src: 'lavoro' } : null;
    const gOv = opts && opts.gioco && opts.gioco.min != null && opts.gioco.max != null ? opts.gioco : jOv;
    const gMin = gOv ? gOv.min : series.giocoMin, gMax = gOv ? gOv.max : series.giocoMax;
    const mode = lavoroMode();
    const acc = applyObjective(calcAccoppiamento(S, series.base, gMin, gMax, mode), seriesObjective(Object.assign({}, series, { giocoMin: gMin, giocoMax: gMax }))); // Beta 0.8.1: only series with an objective change the recommendation
    // Beta 0.2.0: when the user manages the pieces on the table, classify and recommend available + valid first
    const stockCls = classifyStock(acc, series.stock || {});
    const stockRec = stockCls.managed
      ? { recommended: stockCls.recommended, reason: stockCls.reason, outOfStock: stockCls.adattiNonDisp.map((x) => x.n),
          correctionTarget: !stockCls.adattiDisp.length && stockCls.dispCorr.length ? stockCls.dispCorr[0].n : null,
          stockWarn: stockWarnNear(acc.valid, series.stock || {}, acc.ideal) }
      : recommendWithStock(acc, series.stock || {});
    hideUndo();
    lastCalc = { S, display: display || fmtMmS(S), seriesId: series.id, machineId: machine.id, acc, stockRec, stockCls, mode, maschioS: mode === 'femmina' ? lastMaschioS(series.id) : null,
      giocoMin: gMin, giocoMax: gMax, giocoSrc: gOv ? (gOv.src || 'foto') : 'serie',
      selected: stockRec.recommended[0] != null ? stockRec.recommended[0] : null, oval: null, con: null, conEnd: null, taper: { dav: null, fondo: null }, status: 'ok',
      wantPezzo: null, corrDone: false, savedId: null };
    const fxF = mode !== 'femmina' && series.fixedF != null ? Number(series.fixedF) : null; // Beta 0.8.1: femmina fissa
    if (fxF != null && Number.isFinite(fxF)) { lastCalc.fixed = Object.assign({ F: fxF }, fixedFemale(fxF, S, series.base, gMin, gMax)); lastCalc.selected = lastCalc.fixed.n; }
    $('vaBeneBox').classList.add('hidden');
    if ($('fInput')) $('fInput').value = '';
    $('fResult').classList.add('hidden');
    updateCorr(); renderResult(); showResultView();
    if (prefs.voiceAuto) speakIt('Pezzo ' + (lastCalc.selected != null ? lastCalc.selected : ''));
    const drift = currentDrift(series, machine, S);
    const da = $('driftAlert');
    if (drift.alert) { da.classList.remove('hidden'); da.textContent = drift.alert; } else da.classList.add('hidden');
    if (stockRec.stockWarn) toast(stockRec.stockWarn, 'warn');
  }
  function defaultWant() {
    // Beta 0.2.1: the card follows the selected (best) part; another target only when the user picks one
    if (lastCalc.selected != null) return lastCalc.selected;
    const sr = lastCalc.stockRec;
    if (sr.correctionTarget != null) return sr.correctionTarget;
    if (sr.recommended && sr.recommended[0] != null) return sr.recommended[0];
    if (lastCalc.acc.recommended[0] != null) return lastCalc.acc.recommended[0];
    return Math.round(lastCalc.acc.ideal);
  }
  // ── Beta 0.8.1: per-machine calibration (µm per tocco, diametro/raggio, verso del +, stato). Default = identical to before. ──
  function taperOpts(m) { const L = limOf(); return { invert: calOf(m).taper === 'invertito', okUm: L.conOk, maxUm: L.conMax }; }
  function calOf(m) { return machineCal(m || myMachine()); }
  function calT(o, diffKey, m) { // tocchi from the µm change (configuration only)
    if (!o || o.none) return o; const d = o[diffKey || 'diffUm']; if (d == null) return o;
    const c = calOf(m); o.presses = tocchiFor(d, c);
    o.valTxt = c.modo === 'valore' && o.key ? valoreFor(d, o.key, c) : ''; // Beta 0.9.3: «valore diretto» (e.g. Studer favorit CNC)
    return o;
  }
  function calHint(h, m) { if (!h || h.none) return h; calT(h, 'diffUm', m); const w = corrWords(h.diffUm, h.presses, h.key, h.none, h.valTxt); h.words = w; h.text = w.short; h.full = w.text; return h; }
  function updateCorr() {
    if (!lastCalc) return;
    const series = seriesById(lastCalc.seriesId), machine = machineById(lastCalc.machineId) || myMachine();
    if (!series) return;
    const want = lastCalc.wantPezzo != null ? lastCalc.wantPezzo : defaultWant();
    const gc = calcGioco(lastCalc, series);
    lastCalc.corr = calT(calcCorrezioneCard(lastCalc.S, series.base, gc.min, gc.max, want, (machine && machine.rule) || 'studer', lastCalc.mode), 'diffUm', machine);
    lastCalc.corrWant = want;
    if (lastCalc.corr.none) lastCalc.corrDone = false;
  }
  function isStuder(machine) { return !machine || machine.rule === 'studer' || machine.rule === 'plus_smaller'; }
  // ── v2.0.4: Lavoro Maschio / Femmina (per job, remembered per series; default Maschio) ──
  // v2.0.5: Calcolo is Maschio only; the female has its own page (Femmina tab)
  function lavoroMode() { return 'maschio'; }
  function setLavoro(mode) {
    mode = normLavoro(mode);
    const j = jobsOn ? activeJob() : null, s = currentContext().series;
    if (j) j.lavoro = mode; if (s) s.lavoro = mode;
    saveData(state); renderLavoro();
    if (lastCalc && !lastCalc.savedId && lastCalc.mode !== mode) runCalc(lastCalc.S, lastCalc.display, lastCalc.giocoSrc === 'foto' ? { gioco: { min: lastCalc.giocoMin, max: lastCalc.giocoMax, src: 'foto' } } : null);
    renderLastHint();
  }
  function renderLavoro() {
    const m = lavoroMode();
    document.querySelectorAll('[data-lav]').forEach((b) => { const on = b.dataset.lav === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    const card = document.querySelector('#calcInputView .card.disp'); if (card) card.classList.toggle('fem', m === 'femmina');
  }
  /** last male measure on the machine for this series (saved in Maschio mode), for the Femmina target */
  function lastMaschioS(seriesId) { const r = prefs.lastMaschioBySeries && prefs.lastMaschioBySeries[seriesId]; return r && r.day === todayKey() ? r.S : null; }
  const FORM_LBL = { ok: '✓', lim: 'limite', no: 'fuori', na: 'non misurata' };
  function worstStatus(a, b) { const r = { na: 0, ok: 0, lim: 1, no: 2 }; return r[a] >= r[b] ? a : b; }
  // ── v2.0.1: one Conicità control, two sides (Davanti / In fondo); ovalità no longer entered here ──
  function taperSides() { if (!lastCalc.taper) lastCalc.taper = { dav: null, fondo: null }; return lastCalc.taper; }
  function applyTaper(sides) {
    lastCalc.taper = sides; const t = taperFromSides(sides);
    lastCalc.con = t.con; lastCalc.conEnd = t.conEnd;
  }
  function renderTaper() {
    const s = taperSides(), st = conStatus(lastCalc);
    for (const [k, id] of [['dav', 'conDav'], ['fondo', 'conFondo']]) {
      const v = s[k], el = $(id + 'Val'); if (!el) continue;
      el.innerHTML = (v == null ? '—' : fmtUm(v)) + ' <small>µm</small>';
      el.classList.toggle('na', v == null);
      $(id + 'Row').classList.toggle('big', v != null && v > 0);
      $(id + 'Row').classList.toggle(st, v != null && v > 0);
      ['ok', 'lim', 'no'].forEach((c) => { if (c !== st || !(v > 0)) $(id + 'Row').classList.remove(c); });
    }
    const ok = $('conOk');
    ok.textContent = FORM_LBL[st] + (lastCalc.conEnd ? ' · più grande ' + TAPER_SIDE_LBL[lastCalc.conEnd] : '');
    ok.className = 'okm ' + st;
  }
  function renderFormBox() {
    const box = $('formBox'); if (!box || !lastCalc) return;
    const machine = machineById(lastCalc.machineId) || myMachine();
    const k = knobK(machine);
    const th = taperHint(lastCalc.con, lastCalc.conEnd, Object.assign({ studer: isStuder(machine), k, always: true }, taperOpts(machine)));
    const serR = seriesById(lastCalc.seriesId) || {}, gR = serR.geo || {}, LR = limOf(serR);
    const OVAL_REM = (gR.circ != null || gR.cyl != null) ? '<div class="rem" id="ovalRemGeo">Ovalità: si controlla dopo, non alla macchina. Dal disegno: ovalità entro ' + fmtUm(LR.ovalMax) + ' µm, conicità entro ' + fmtUm(LR.conMax) + ' µm.</div>'
      : '<div class="rem">Ovalità: si controlla dopo, non alla macchina. Ovalità e conicità devono restare entro circa 2–3 µm.</div>';
    if (lastCalc.con == null) {
      box.classList.remove('hidden');
      box.innerHTML = `<div class="rem na-rem">⚠ Conicità non misurata: misura davanti e in fondo e segna di quanti µm è più grande (+ sul lato più grande). Tocca il numero se è 0.</div>${OVAL_REM}`;
      return;
    }
    if (!th.show) { box.classList.remove('hidden'); box.innerHTML = `<div class="rem">✓ Conicità 0 µm.</div>${OVAL_REM}`; return; }
    let html = `<div class="tt ${th.status === 'no' ? 'no' : th.status === 'ok' ? 'ok' : ''}"><span class="dot"></span>${esc(th.title)}</div>`;
    const parts = th.hint.split(' → ');
    const knobIco = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 4v6"/></svg>`;
    const pre = th.status === 'ok' ? '<small class="kopt">Entro tolleranza: correggi solo se vuoi</small>' : '';
    if (th.tacche != null) {
      html += `<div class="knob-hint tacche" id="knobHint"><div class="kn">${knobIco}</div><div class="kt">${pre}${esc(parts[0])} →<br/><b class="kbig">${esc(th.knobText)}</b>
        <small>${esc(fmtUm(lastCalc.con))} µm ÷ ${esc(fmtK(k))} µm/tacca = ${esc(String(knobTacche(lastCalc.con, k).exact).replace('.', ','))} → arrotondato per difetto</small></div></div>`;
    } else {
      html += `<div class="knob-hint" id="knobHint"><div class="kn">${knobIco}</div><div class="kt">${pre}${esc(parts[0])} →<br/><b>${esc(parts.slice(1).join(' → '))}</b></div></div>`;
    }
    if (k == null) {
      html += `<button type="button" class="btn btn-sec calib-cta" data-calib="1"><span class="ci">⟲</span><span>Quante tacche? <small>Fai la taratura della manopola</small></span><span class="chev">›</span></button>`;
    } else {
      html += `<div class="rem knob-k">Manopola: ${esc(fmtK(k))} µm per tacca${machine && machine.knob && machine.knob.L0 ? ' (conicità su ' + esc(fmtUm(machine.knob.L0)) + ' mm)' : ''} · <a href="#" data-calib="1">rifai taratura</a></div>`;
    }
    html += `<div class="rem">Correggi poco alla volta e rimisura. Gioco della manopola: arriva sempre dallo stesso lato (se superi, torna indietro oltre e riavvicinati). La manopola è in basso sulla macchina.</div>${OVAL_REM}`;
    box.innerHTML = html; box.classList.remove('hidden');
  }
  function pieceStatus(n, acc) {
    if (n == null) return 'no';
    if (acc.valid.includes(n)) return acc.edges.includes(n) ? 'lim' : 'ok';
    return 'no';
  }
  function tickRange(acc, sel) {
    let lo, hi;
    if (acc.valid.length) { lo = acc.valid[0] - 1; hi = acc.valid[acc.valid.length - 1] + 1; }
    else { lo = Math.round(acc.ideal) - 2; hi = Math.round(acc.ideal) + 3; }
    while (hi - lo + 1 > 8) { if (Math.abs(lo - acc.ideal) > Math.abs(hi - acc.ideal)) lo++; else hi--; }
    while (hi - lo + 1 < 6) { if (hi - acc.ideal <= acc.ideal - lo) hi++; else lo--; }
    if (sel != null && sel < lo) lo = sel; if (sel != null && sel > hi) hi = sel;
    const out = []; for (let n = lo; n <= hi; n++) out.push(n === 0 ? 0 : n); return out;
  }
  function fmtForm(v) { return v == null ? '—' : esc(fmtUm(v)); }

  function limOf(series) { return jobLimits(series || seriesById(lastCalc && lastCalc.seriesId)); }
  function conStatus(lc, series) { const L = limOf(series); return formStatus(lc.con, L.conOk, L.conMax); }
  function renderQual() {
    const box = $('qualBox'); if (!box || !lastCalc) return;
    const series = seriesById(lastCalc.seriesId); if (!series) return;
    const acc = lastCalc.acc, sel = lastCalc.selected, gc = calcGioco(lastCalc, series);
    const lines = qualityLines({ S: lastCalc.S, base: series.base, tolMm: seriesTol(series), gioco: sel != null ? giocoOf(sel, acc) : null, giocoMin: gc.min, giocoMax: gc.max, con: lastCalc.con, oval: lastCalc.oval, lim: limOf(series) });
    if (series.forma === false) lines.splice(2, 2, { k: 'forma', label: 'Ovalità/conicità', st: 'na', word: 'non richieste', val: 'questa serie non le controlla' });
    if (lastCalc.fixed) { lines[0].val = fmtUm(lastCalc.fixed.gioco) + ' µm con la femmina fissa (' + gc.min + '–' + gc.max + ' µm)'; }
    const pst = pieceStatus(sel, acc); lines[0].st = sel == null ? 'no' : pst; lines[0].word = { ok: 'conforme', lim: 'al limite', no: 'fuori' }[lines[0].st];
    box.innerHTML = '<div class="lbl"><span>Esito per voce</span><span class="meta">limiti del lavoro</span></div>' + lines.map((l) =>
      `<div class="ql ${l.st}" data-q="${l.k}"><span class="ql-l">${esc(l.label)}</span><span class="ql-w">${l.st === 'ok' ? '✓ ' : l.st === 'no' ? '✗ ' : l.st === 'lim' ? '! ' : ''}${esc(l.word)}</span><small class="ql-v">${esc(l.val)}</small>${l.k === 'oval' && !lastCalc.savedId ? '<button type="button" class="ql-btn" id="ovalSet">' + (lastCalc.oval == null ? 'Segna' : 'Cambia') + '</button>' : ''}</div>`).join('');
    if ($('ovalSet')) $('ovalSet').onclick = () => askOval();
  }
  async function askOval() {
    if (!lastCalc) return;
    const v = await askBig({ title: 'Ovalità (µm)', withVals: true, html: '<label for="ovalIn">Ovalità misurata in µm (es. 1,5) · vuoto = non registrata</label><input id="ovalIn" class="big-input" inputmode="decimal" value="' + (lastCalc.oval != null ? esc(fmtUm(lastCalc.oval)) : '') + '"/>', ok: 'Salva ovalità' });
    if (!v || !lastCalc) return;
    const raw = String(v.ovalIn || '').trim().replace(',', '.');
    if (!raw) lastCalc.oval = null; else { const n = Number(raw); if (!Number.isFinite(n) || n < 0 || n > 100) { toast('Ovalità non valida (µm)', 'warn'); return; } lastCalc.oval = round1(n); }
    renderResult();
  }
  function renderResult() {
    if (!lastCalc) return;
    const series = seriesById(lastCalc.seriesId); if (!series) return;
    const acc = lastCalc.acc, sel = lastCalc.selected;
    $('resS').innerHTML = esc(fmtMmS(lastCalc.S)) + ' <small>mm</small>';
    const fem = lastCalc.mode === 'femmina';
    if ($('resSLbl')) $('resSLbl').textContent = fem ? 'Femmina già fatta F' : 'Misura maschio S';
    if ($('resPairLbl')) $('resPairLbl').textContent = fem ? 'Pezzo maschio (numerato)' : 'Pezzo femmina (numerato)';
    $('calcResultView').classList.toggle('fem', fem);
    renderFemTarget();
    $('resD').textContent = (acc.d >= 0 ? '+' : '') + fmtUm(acc.d) + ' µm';
    const mk = $('scaleMarker');
    if (mk) {
      const span = 30; // ±30 µm visual
      const pct = Math.max(4, Math.min(96, 50 + (acc.d / span) * 50));
      mk.style.left = pct + '%';
    }
    const gcR = calcGioco(lastCalc, series);
    $('resGiocoRange').textContent = 'gioco ' + gcR.min + '–' + gcR.max + ' µm' + (gcR.src === 'foto' ? ' (dalla foto)' : gcR.src === 'lavoro' ? ' (solo questo lavoro)' : '');
    const on = $('objNote');
    if (on) { const a = lastCalc.acc, sg = (n) => (n > 0 ? '+' : '') + n; const fx = lastCalc.fixed;
      const parts = [];
      if (fx) parts.push(`<div class="fixed-box ${fx.ok ? 'ok' : 'no'}" id="fixedBox">Femmina fissa ${esc(fmtMm4(fx.F))} mm (${sg(fx.n)}) · gioco F − S <b>${esc(fmtUm(fx.gioco))} µm</b> → <b>${fx.ok ? '✓ OK' : '✗ NO'}</b> <small>(${gcR.min}–${gcR.max} µm)</small></div>`);
      if (a.obiettivo != null) parts.push(`<div class="obj-line" id="objLine">Consigliata <b>${a.consigliata == null ? '—' : sg(a.consigliata)}</b> (gioco obiettivo ${esc(fmtUm(a.obiettivo))} µm) · consigliate <b>${a.fascia.length ? sg(a.fascia[0]) + '…' + sg(a.fascia[a.fascia.length - 1]) : '—'}</b> (gioco ${esc(fmtUm(a.fasciaLo))}–${esc(fmtUm(a.fasciaHi))}) · valide <b>${a.valid.length ? sg(a.valid[0]) + '…' + sg(a.valid[a.valid.length - 1]) : 'nessuna'}</b> (gioco ${gcR.min}–${gcR.max})</div>`);
      on.innerHTML = parts.join(''); on.classList.toggle('hidden', !parts.length); }
    const noForm = series.forma === false; // Beta 0.8.1: series without ovalità/conicità
    ['taperCard', 'formBox'].forEach((id) => { if ($(id)) $(id).classList.toggle('noform', noForm); });
    document.body.classList.toggle('no-forma', noForm);
    const pn = $('resPhotoNote'); if (pn) { pn.textContent = lastCalc.photoNote || ''; pn.classList.toggle('hidden', !lastCalc.photoNote); }
    const rec = lastCalc.stockRec.recommended.length ? lastCalc.stockRec.recommended : acc.recommended;
    $('recGrid').innerHTML = rec.map((n) => {
      return `<button type="button" class="pz ${n === sel ? 'sel' : ''}" data-pick="${n}"><div class="n">${n}</div><div class="g mono">gioco ${fmtUm(giocoOf(n, acc))} µm</div></button>`;
    }).join('') || '<div class="empty">Nessun pezzo valido: controlla il gioco della serie</div>';
    renderStockPanel(series);
    renderMating();
    renderHintRow();
    const ticks = tickRange(acc, sel);
    const tr = $('tickRow'); tr.style.setProperty('--n', String(Math.min(ticks.length, 6)));
    tr.innerHTML = ticks.map((n) => {
      const st = pieceStatus(n, acc);
      return `<button type="button" class="tk ${st} ${n === sel ? 'sel' : ''} ${acc.fascia && acc.fascia.includes(n) ? 'fa' : ''}" data-pick="${n}">${n}</button>`;
    }).join('');
    renderTaper();
    renderFormBox();
    const corr = lastCalc.corr || { none: true, presses: 0, diffUm: 0, key: '' };
    const cal = calOf(machineById(lastCalc.machineId) || myMachine()), unver = cal.stato !== 'verificata';
    const selN = lastCalc.selected, selSt = pieceStatus(selN, acc);
    const nowTxt = selN == null ? 'nessun pezzo valido: non accoppiare' : 'accoppia con il pezzo ' + selN + ' (gioco ' + fmtUm(giocoOf(selN, acc)) + ' µm' + (selSt === 'no' ? ', FUORI' : '') + ')';
    $('corrNow').innerHTML = '<b>Sul pezzo attuale</b> · ' + esc(nowTxt);
    if (corr.none) {
      $('corrKey').textContent = '✓'; $('corrX').textContent = '';
      $('corrTxt').innerHTML = '<span class="cw-next">Per il prossimo pezzo</span>Nessuna correzione<small>pezzo ' + esc(String(lastCalc.corrWant)) + ' centrato nel gioco · tocca per un altro pezzo</small>';
    } else {
      $('corrKey').textContent = corr.valTxt || corr.key || '±'; $('corrX').textContent = corr.valTxt ? 'mm' : corr.key ? '×' + corr.presses : corr.presses + ' µm';
      $('corrKey').classList.toggle('val', !!corr.valTxt);
      const w = corrWords(corr.diffUm, corr.presses, corr.key, corr.none, corr.valTxt);
      $('corrTxt').innerHTML = '<span class="cw-next">Per il prossimo pezzo</span><span class="cw-pos">Pezzo ' + esc(String(lastCalc.corrWant)) + ': misura ' + esc(w.pos) + '</span>' +
        '<small class="cw-words">' + esc(corrWordsDiam(corr.diffUm)) + (cal.scala === 'raggio' ? ' (sul raggio: ' + fmtUm(Math.abs(corr.diffUm) / 2) + ' µm)' : '') + '</small>' +
        '<small class="cw-act">→ ' + esc(w.act) + ': ' + esc(w.keys) + ' (' + (corr.valTxt ? 'valore in mm sul ' + cal.scala : esc(fmtTocchi(corr.presses)) + (cal.umPerTocco !== 1 || cal.scala === 'raggio' ? ' · 1 tocco = ' + fmtUm(cal.umPerTocco) + ' µm sul ' + cal.scala : '')) + ') · centro gioco ' + fmtUm(corr.centro) + ' µm</small>' +
        (unver ? '<small class="cw-warn" id="corrUnver">⚠ Taratura macchina da verificare: controlla il verso del + sul primo pezzo (Macchina ✎ → Taratura)</small>' : '') +
        `<button type="button" class="corr-done ${lastCalc.corrDone ? 'on' : ''}" id="corrDone">${lastCalc.corrDone ? '✓ Correzione fatta' : 'Segna come fatta'}</button>`;
    }
    $('corrCard').classList.toggle('unver', unver && !corr.none);
    renderQual();
    $('corrCard').classList.toggle('none', !!corr.none);
    $('spiegazioneText').textContent = spiegazione(lastCalc.S, series.base, gcR.min, gcR.max, acc.recommended, lastCalc.mode).text;
    const st = pieceStatus(sel, acc);
    lastCalc.status = st;
    const saveBtn = $('btnSalva');
    const saved = !!lastCalc.savedId;
    saveBtn.textContent = saved ? '✓ Salvato · ' + sel : (st === 'no' ? '⚠ Salva scarto ' : '✓ Salva pezzo ') + (sel != null ? sel : '');
    saveBtn.classList.toggle('done', saved || savedFlash);
    saveBtn.classList.toggle('danger', !saved && st === 'no');
  }
  // ── Beta 0.2.0: availability of the numbered pieces on the result screen ──
  function renderStockPanel(series) {
    const box = $('stockPanel'); if (!box || !lastCalc) return;
    const cls = lastCalc.stockCls;
    if (!cls || !cls.managed) {
      box.innerHTML = '<button type="button" class="sp-open" id="btnStockOpen">📦 Segna i pezzi che hai sul tavolo</button>';
      return;
    }
    const machine = machineById(lastCalc.machineId) || myMachine(); const gc = calcGioco(lastCalc, series);
    const chip = (x, cls2, extra) => `<button type="button" class="sp-chip ${cls2}" data-pick="${x.n}"><b>${x.n}</b>${x.qty != null ? `<span class="q">×${x.qty}</span>` : ''}<small>gioco ${fmtUm(x.gioco)} µm${extra || ''}</small></button>`;
    const corrRows = cls.dispCorr.map((x) => {
      const c = calT(calcCorrezioneCard(lastCalc.S, series.base, gc.min, gc.max, x.n, (machine && machine.rule) || 'studer', lastCalc.mode), 'diffUm', machine);
      const w = c.none ? 'nessuna correzione' : (c.valTxt ? 'inserisci ' + c.valTxt : c.key ? c.key + ' ×' + c.presses : c.presses + ' µm ' + c.action);
      return `<button type="button" class="sp-chip sp-cr" data-want="${x.n}"><b>${x.n}</b><span class="q">×${x.qty}</span><small>ora gioco ${fmtUm(x.gioco)} µm · correggi ${esc(w)}</small></button>`;
    }).join('');
    box.innerHTML = `<div class="sp-why">${esc(stockReasonText(cls))}</div>
      <div class="sp-g ok"><div class="sp-t">✓ Adatto e disponibile</div><div class="sp-row">${cls.adattiDisp.map((x) => chip(x, 'ok')).join('') || '<span class="sp-none">nessuno</span>'}</div></div>
      ${cls.adattiNonDisp.length ? `<div class="sp-g nd"><div class="sp-t">Adatto ma non disponibile</div><div class="sp-row">${cls.adattiNonDisp.map((x) => chip(x, 'nd')).join('')}</div></div>` : ''}
      ${corrRows ? `<div class="sp-g cr"><div class="sp-t">Disponibile, ma richiede una correzione</div><div class="sp-row">${corrRows}</div>
        <div class="sp-note">Previsione: dopo la correzione rimisura e conferma con una nuova misura.</div></div>` : ''}
      <button type="button" class="sp-open small" id="btnStockOpen">📦 Pezzi sul tavolo</button>`;
  }
  /** Glove-sized editor: tap a number, then its quantity. Changes counts only when the user taps. */
  let stockSel = null;
  function openStockEditor() {
    const { series } = currentContext(); if (!series) { toast('Scegli la serie'); return; }
    series.stock = series.stock || {};
    const center = lastCalc && lastCalc.seriesId === series.id ? Math.round(lastCalc.acc.ideal) : Math.round((series.giocoMin + series.giocoMax) / 2);
    const nums = stockVisibleNums(series.stock, center, !!prefs.stockShowAll, -10, 25);
    if (stockSel == null || !nums.includes(stockSel)) stockSel = nums.includes(center) ? center : nums[0];
    const valid = lastCalc && lastCalc.seriesId === series.id ? lastCalc.acc.valid : [];
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal stock-ed" id="stockEd" role="dialog" aria-modal="true">
      <h2>Pezzi sul tavolo · Base ${esc(fmtMm3(series.base))}</h2>
      <p class="meta">1) Tocca il numero · 2) tocca quanti ne hai. I pezzi calano da soli solo quando premi Salva.</p>
      <div class="se-grid">${nums.map((n) => { const q = stockQty(series.stock, n);
        return `<button type="button" class="se-n ${n === stockSel ? 'sel' : ''} ${q ? 'has' : ''} ${valid.includes(n) ? 'fit' : ''}" data-sen="${n}"><b>${n}</b><span>${q}</span></button>`; }).join('')}</div>
      <div class="se-sel">Numero <b>${stockSel}</b>: <b class="se-q">${stockQty(series.stock, stockSel)}</b> pezzi</div>
      <div class="se-q-keys">${[0, 1, 2, 3, 4, 5, 6, 8, 10].map((q) => `<button type="button" data-seq="${q}">${q}</button>`).join('')}
        <button type="button" class="fn" data-sed="-1">−1</button><button type="button" class="fn" data-sed="1">+1</button></div>
      <div class="ask-btns"><button type="button" class="btn btn-sec" id="seAll">${prefs.stockShowAll ? 'Solo i vicini' : 'Tutti (−10 … 25)'}</button>
        <button type="button" class="btn btn-sec" id="seClear">Azzera tutti</button>
        <button type="button" class="btn btn-orange" id="seDone">Fatto</button></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; if (lastCalc && lastCalc.seriesId === series.id && !lastCalc.savedId) refreshStockAdvice(); renderStock(); };
    $('modalBg').onclick = async (e) => {
      if (e.target.id === 'modalBg' || e.target.closest('#seDone')) return close();
      const n = e.target.closest('[data-sen]'); if (n) { stockSel = parseInt(n.dataset.sen, 10); haptic(10); return openStockEditor(); }
      const q = e.target.closest('[data-seq]'); if (q) { stockSet(series.stock, stockSel, q.dataset.seq); saveData(state); haptic(15); return openStockEditor(); }
      const d = e.target.closest('[data-sed]'); if (d) { stockSet(series.stock, stockSel, stockQty(series.stock, stockSel) + Number(d.dataset.sed)); saveData(state); haptic(10); return openStockEditor(); }
      if (e.target.closest('#seAll')) { prefs.stockShowAll = !prefs.stockShowAll; savePrefs(prefs); return openStockEditor(); }
      if (e.target.closest('#seClear')) {
        if (!(await askBig({ title: 'Azzerare tutti i pezzi di questa base?', html: '<p class="meta">L\'app torna al consiglio teorico (senza magazzino).</p>', ok: 'Azzera', danger: true }))) return openStockEditor();
        series.stock = {}; saveData(state); return openStockEditor();
      }
    };
  }
  /** Re-classify the current (unsaved) result after the stock changed. Selection follows the new advice. */
  function refreshStockAdvice() {
    const series = seriesById(lastCalc.seriesId); if (!series) return;
    const acc = lastCalc.acc; const cls = classifyStock(acc, series.stock || {});
    lastCalc.stockCls = cls;
    lastCalc.stockRec = cls.managed
      ? { recommended: cls.recommended, reason: cls.reason, outOfStock: cls.adattiNonDisp.map((x) => x.n), correctionTarget: !cls.adattiDisp.length && cls.dispCorr.length ? cls.dispCorr[0].n : null, stockWarn: null }
      : recommendWithStock(acc, series.stock || {});
    lastCalc.selected = lastCalc.stockRec.recommended[0] != null ? lastCalc.stockRec.recommended[0] : lastCalc.selected;
    lastCalc.wantPezzo = null; updateCorr(); renderResult();
  }
  // ── v2.0.0: mating-part measure range (S + gioco), for machines without numbered parts ──
  function matingHtml(m, src, id) {
    if (!m) return '';
    return `<div class="mt-h"><span>Misura ${m.of === 'maschio' ? 'maschio (da fare)' : 'femmina (accoppiata)'}</span><span>gioco ${m.giocoMin}–${m.giocoMax} µm${src === 'foto' ? ' (dalla foto)' : ''}</span></div>
      <div class="mt-r cond"><span class="mt-w">da</span><b class="mt-min">${fmtMm4(m.min)}</b><span class="mt-w">a</span><b class="mt-max">${fmtMm4(m.max)}</b><span class="mt-u">mm</span></div>
      <div class="mt-f"><div class="mt-c"><span>centro ideale</span><span class="mt-cv"><b class="mt-cen">${fmtMm4(m.centro)}</b> mm</span></div>
      <button type="button" class="mt-copy" id="${id}" data-copy="${esc(matingRangeText(m))}" aria-label="Copia: ${esc(matingRangeText(m))}">Copia</button></div>`;
  }
  function renderMating() {
    const el = $('matingBox'); if (!el || !lastCalc) return;
    const series = seriesById(lastCalc.seriesId); if (!series) { el.innerHTML = ''; return; }
    const gc = calcGioco(lastCalc, series);
    const m = matingRange(lastCalc.S, gc.min, gc.max, lastCalc.mode);
    lastCalc.mating = m;
    // femmina: the range is shown big in the «Misura da fare» box at the top → not repeated here
    el.innerHTML = lastCalc.mode === 'femmina' ? '' : matingHtml(m, gc.src, 'btnCopyMating');
    el.classList.toggle('hidden', lastCalc.mode === 'femmina');
    el.setAttribute('aria-label', matingRangeText(m));
  }
  /** v2.0.4 «Femmina già fatta → Misura da fare (maschio)»: big target + distance of the male on the machine */
  function renderFemTarget() {
    const el = $('femTarget'); if (!el) return;
    if (!lastCalc || lastCalc.mode !== 'femmina') { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const series = seriesById(lastCalc.seriesId); if (!series) return;
    const gc = calcGioco(lastCalc, series), machine = machineById(lastCalc.machineId) || myMachine();
    const ft = calT(femminaTarget(lastCalc.S, gc.min, gc.max, lastCalc.maschioS, (machine && machine.rule) || 'studer'), 'diffUm', machine);
    lastCalc.femTarget = ft;
    const copy = matingRangeText(matingRange(lastCalc.S, gc.min, gc.max, 'femmina'));
    let corr = '';
    if (ft.S != null) {
      const k = ft.none ? '✓' : (ft.valTxt || ft.key || '±'), x = ft.none ? '' : (ft.valTxt ? 'mm' : ft.key ? '×' + ft.presses : ft.presses + ' µm');
      corr = `<div class="ft-corr ${ft.none ? 'ok' : ''}" id="ftCorr"><div class="ft-k cond">${esc(k)}<small>${esc(x)}</small></div>
        <div class="ft-ct">${ft.none ? 'Maschio già al centro' : 'Maschio ' + esc(corrWords(ft.diffUm, ft.presses, ft.key, ft.none, ft.valTxt).pos)} <small>${ft.none ? '' : '→ ' + esc(corrWords(ft.diffUm, ft.presses, ft.key, ft.none, ft.valTxt).act + ': ' + corrWords(ft.diffUm, ft.presses, ft.key, ft.none, ft.valTxt).keys) + ' · '}ora ${esc(fmtMm4(ft.S))} mm · gioco ${esc(fmtUm(ft.gioco))} µm ${ft.inRange ? '✓' : '(fuori)'}</small></div></div>`;
    }
    el.innerHTML = `<div class="ft-h"><span>Femmina già fatta ${esc(fmtMm4(lastCalc.S))} → <b>Misura da fare (maschio)</b></span><span>gioco ${gc.min}–${gc.max} µm${gc.src === 'foto' ? ' (dalla foto)' : ''}</span></div>
      <div class="ft-big cond" id="ftCentro">${esc(fmtMm4(ft.centro))}<small> mm · centro</small></div>
      <div class="ft-r cond">da <b id="ftMin">${esc(fmtMm4(ft.min))}</b> a <b id="ftMax">${esc(fmtMm4(ft.max))}</b> mm</div>
      ${corr}
      <div class="ft-f"><label class="ft-s" for="ftS">Maschio sulla macchina (S)<input id="ftS" class="cond" inputmode="decimal" placeholder="es. ${esc(fmtMm4(ft.centro))}" value="${ft.S != null ? esc(fmtMm4(ft.S)) : ''}" autocomplete="off"/></label>
      <button type="button" class="mt-copy" id="btnCopyFem" data-copy="${esc(copy)}" aria-label="Copia: ${esc(copy)}">Copia</button></div>`;
    el.classList.remove('hidden');
    const inp = $('ftS');
    const apply = () => { const v = setupNum(inp.value); lastCalc.maschioS = v != null && v > 0 ? v : null; renderFemTarget(); };
    inp.addEventListener('change', apply);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
  }
  // ── v2.0.5 FEMMINA page: female already made → maschio to grind (own keypad, own tolerances per job, saves female pieces) ──
  const fem = { field: 'F', buf: { F: '', S: '', GMIN: '', GMAX: '' }, sTouched: false };
  let pendingFem = false; // v2.0.6 «Adatta alla femmina» 📷 → fills the fields
  function femCfg() {
    const j = jobsOn ? activeJob() : null, s = currentContext().series;
    const c = (j && j.fem) || (s && s.fem);
    if (c) return c;
    return { nom: s ? s.base : null, tolM: s && s.tolleranza != null ? s.tolleranza : 0.1, tolP: s && s.tolleranza != null ? s.tolleranza : 0.1,
      gmin: s ? s.giocoMin : null, gmax: s ? s.giocoMax : null, auto: true };
  }
  function saveFemCfg(c) {
    const j = jobsOn ? activeJob() : null, s = currentContext().series;
    delete c.auto; if (j) j.fem = c; else if (s) s.fem = c;
    saveData(state);
  }
  /** typed digits → mm: «022» after the shown integer = 20,022; with a comma = full number; long digits starting with the integer = full */
  function femValue(buf, nom) {
    if (!buf) return null;
    if (buf.includes(',')) { const v = setupNum(buf); return v != null && v > 0 ? v : null; }
    const I = String(Math.floor(nom || 0));
    if (nom != null && buf.length > 4 && buf.startsWith(I)) return Number(I + '.' + buf.slice(I.length));
    if (nom == null) return null;
    return Number(I + '.' + buf);
  }
  function femShow(buf, nom) {
    if (!buf) return null;
    if (buf.includes(',')) return buf;
    const v = femValue(buf, nom); return v == null ? buf : (buf.length > 4 ? fmtMm4(v) : Math.floor(nom) + ',' + buf);
  }
  function femNow() {
    const c = Object.assign({}, femCfg()), s = currentContext().series, machine = myMachine();
    const F = femValue(fem.buf.F, c.nom);
    let S = femValue(fem.buf.S, c.nom);
    if (S == null && !fem.sTouched && s) S = lastMaschioS(s.id);
    [c.gmin, c.gmax] = orderGioco(c.gmin, c.gmax); // min < max always
    const okCfg = c.nom != null && c.gmin != null && c.gmax != null;
    const st = F != null && c.nom != null ? { dev: round1((F - c.nom) * 1000), in: F >= c.nom - (c.tolM || 0) - 1e-9 && F <= c.nom + (c.tolP || 0) + 1e-9 } : null;
    const ft = F != null && okCfg ? femminaTarget(F, c.gmin, c.gmax, S, (machine && machine.rule) || 'studer') : null;
    return { c, F, S, st, ft, okCfg };
  }
  function renderFemPage() {
    const n = femNow(), c = n.c;
    $('femCfgTxt').textContent = c.nom != null ? `${fmtMm3(c.nom)} −${fmtMm3(c.tolM)}/+${fmtMm3(c.tolP)}` : 'nominale da impostare ✎';
    const gShow = (k, v) => { const b = fem.buf[k]; if (b) { const u = normGiocoUm(b); return esc(b) + (u != null && b.includes(',') ? ` <small>→ ${fmtUm(u)}</small>` : ' <small>µm</small>'); } return v != null ? fmtUm(v) + ' <small>µm</small>' : '—'; };
    $('fValGmin').innerHTML = gShow('GMIN', n.c.gmin); $('fValGmax').innerHTML = gShow('GMAX', n.c.gmax);
    $('fValF').textContent = fem.buf.F ? femShow(fem.buf.F, c.nom) : (c.nom != null ? Math.floor(c.nom) + ',' : '—');
    $('fValS').textContent = fem.buf.S ? femShow(fem.buf.S, c.nom) : (n.S != null ? fmtMm4(n.S) + ' mm' : '—');
    $('fFieldS').classList.toggle('auto', !fem.buf.S && n.S != null);
    document.querySelectorAll('.fm-field').forEach((b) => b.classList.toggle('on', b.dataset.ff === fem.field));
    let h = '';
    if (!n.okCfg) h = `<div class="fr-empty">${c.nom == null ? 'Tocca <b>nom. ± tol ✎</b> per il nominale della femmina' : 'Scrivi <b>Gioco minimo</b> e <b>Gioco massimo</b> (µm, es. 7 e 10, oppure come sul foglio −0,007 / −0,01)'} — o usa 📷.</div>`;
    else if (n.F == null) h = `<div class="fr-empty">Scrivi la <b>femmina</b> misurata, anche maggiorata (es. 0220 = ${Math.floor(c.nom)},0220). Vedi subito la misura da fare del maschio.</div>`;
    else {
      const st = n.st, ft = n.ft;
      const sgn = (x) => (x >= 0 ? '+' : '−') + fmtUm(Math.abs(x));
      const over = st.in ? 0 : st.dev > 0 ? round1(st.dev - c.tolP * 1000) : round1(-c.tolM * 1000 - st.dev);
      const tolTxt = Math.abs(c.tolP - c.tolM) < 1e-9 ? '±' + fmtMm3(c.tolP) : '−' + fmtMm3(c.tolM) + '/+' + fmtMm3(c.tolP);
      const lab = st.in ? '✓ Femmina in tolleranza (' + tolTxt + ')' : st.dev > 0 ? `⚠ Femmina maggiorata ${sgn(st.dev)} µm` : `⚠ Femmina minorata ${sgn(st.dev)} µm`;
      h = `<div class="fr-st" id="femSt"><span class="pillst ${st.in ? 'ok' : 'no'}">${lab}</span><span class="fr-dev">${st.in ? sgn(st.dev) + ' µm dal nominale' : 'fuori tolleranza di ' + fmtUm(over) + ' µm'}</span></div>
        <div class="fr-h">Misura da fare (maschio) · centro</div>
        <div class="fr-big cond" id="femCentro">${fmtMm4(ft.centro)}<small> mm</small></div>
        <div class="fr-r cond" id="femRange">da <b>${fmtMm4(ft.min)}</b> a <b>${fmtMm4(ft.max)}</b> mm</div>
        ${ft.S != null ? `<div class="fr-corr ${ft.none ? 'ok' : ''}" id="femCorr"><span class="fk cond">${ft.none ? '✓' : ft.valTxt ? esc(ft.valTxt) : esc(ft.key || '±') + (ft.key ? '×' + ft.presses : '')}</span>
          <span>${ft.none ? 'S già al centro' : 'S ' + esc(corrWords(ft.diffUm, ft.presses, ft.key, ft.none, ft.valTxt).pos)}<small>${ft.none ? '' : '→ ' + esc(corrWords(ft.diffUm, ft.presses, ft.key, ft.none, ft.valTxt).act + ': ' + corrWords(ft.diffUm, ft.presses, ft.key, ft.none, ft.valTxt).keys) + ' · '}gioco ${fmtUm(ft.gioco)} µm ${ft.inRange ? '✓' : '(fuori)'}</small></span></div>`
          : `<div class="fr-empty fr-hint" style="font-size:13px">Facoltativo: tocca <b>Maschio ora S</b> e scrivi la misura per vedere le pressioni.</div>`}`;
    }
    $('femRes').innerHTML = h;
    $('fSave').classList.toggle('off', n.F == null);
    fitPads();
  }
  function femKey(k) {
    haptic(10);
    const f = fem.field; let b = fem.buf[f];
    if (k === 'SAVE') { saveFemmina(); return; }
    if (f === 'GMIN' || f === 'GMAX') { // gioco boxes: µm or sheet format, saved live for this job
      if (k === 'BS') b = b.slice(0, -1); else if (k === 'AC') b = ''; else if (k === ',') { if (!b.includes(',')) b = (b || '0') + ','; } else if (b.length < 7) b += k;
      fem.buf[f] = b; const c = Object.assign({}, femCfg()), u = normGiocoUm(b);
      if (f === 'GMIN') c.gmin = u; else c.gmax = u; saveFemCfg(c); renderFemPage(); return;
    }
    if (k === 'BS') b = b.slice(0, -1);
    else if (k === 'AC') b = '';
    else if (k === ',') { if (!b.includes(',')) b = (b && b.length >= 2 ? b : String(Math.floor(femCfg().nom || 0))) + ','; }
    else if (b.replace(',', '').length < 9) b += k;
    fem.buf[f] = b; if (f === 'S') fem.sTouched = true;
    renderFemPage();
  }
  function saveFemmina() { // keeps a record (Storico «Femmine salvate», CSV)
    const n = femNow(); clearToast();
    if (n.F == null) { toast('Scrivi prima la misura della femmina'); return; }
    if (!n.okCfg) { openFemCfg(); return; }
    const j = jobsOn ? activeJob() : null, s = currentContext().series;
    const rec = { id: 'f_' + Date.now().toString(36), ts: new Date().toISOString(), jobId: j ? j.id : null, seriesId: s ? s.id : null,
      machineName: (j && j.machineName) || (myMachine() || {}).name || '', F: n.F, nom: n.c.nom, tolM: n.c.tolM, tolP: n.c.tolP,
      gmin: n.c.gmin, gmax: n.c.gmax, dev: n.st.dev, inTol: n.st.in, target: n.ft.centro, tMin: n.ft.min, tMax: n.ft.max, S: n.S != null ? n.S : null };
    state.femmine = state.femmine || []; state.femmine.push(rec); saveData(state);
    fem.buf.F = ''; fem.field = 'F'; renderFemPage();
    showUndo(`Salvata F ${fmtMm4(rec.F)} mm → M ${fmtMm4(rec.target)} mm`, () => {
      state.femmine = (state.femmine || []).filter((x) => x.id !== rec.id); saveData(state); renderFemPage(); toast('Femmina annullata');
    });
    if (prefs.voiceAuto) speakIt('Maschio ' + fmtMm4(rec.target).replace('.', ','));
  }
  function openFemCfg() {
    const c = femCfg(), v = (x, f) => (x == null ? '' : (f ? f(x) : String(x)));
    const fld = (id, l, val, ph) => `<div><label for="${id}">${l}</label><input id="${id}" class="neu" inputmode="decimal" value="${esc(val)}" placeholder="${ph}" autocomplete="off"/></div>`;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal fem-cfg ctx-panel" id="femCfgModal">
      <h2>Tolleranze femmina</h2><p class="meta">Valgono per questo lavoro. Femmina: nominale −/+ tolleranza. Gioco: maschio = F − gioco.</p>
      ${fld('fcNom', 'Nominale femmina mm', v(c.nom, fmtMm3), 'es. 20,000')}
      <div class="field-row">${fld('fcTm', 'Tolleranza − mm', v(c.tolM, fmtMm3), '0,100')}${fld('fcTp', 'Tolleranza + mm', v(c.tolP, fmtMm3), '0,100')}</div>
      <div class="field-row">${fld('fcGmin', 'Gioco min µm', v(c.gmin), '8')}${fld('fcGmax', 'Gioco max µm', v(c.gmax), '11')}</div>
      <div class="actions" style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-sec" id="fcCancel" style="flex:1;min-height:52px">Annulla</button>
      <button type="button" class="btn btn-primary" id="fcSave" style="flex:1.4;min-height:52px">✓ Salva</button></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('fcCancel').onclick = close; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') close(); };
    $('fcSave').onclick = () => {
      const nom = setupNum($('fcNom').value), tm = setupNum($('fcTm').value), tp = setupNum($('fcTp').value);
      let gmin = setupNum($('fcGmin').value), gmax = setupNum($('fcGmax').value);
      if (gmin != null && gmax != null && gmin > gmax) [gmin, gmax] = [gmax, gmin];
      saveFemCfg({ nom, tolM: tm != null ? Math.abs(tm) : 0, tolP: tp != null ? Math.abs(tp) : 0, gmin, gmax });
      close(); renderFemPage(); toast('Tolleranze femmina salvate');
    };
  }
  $('fKeypad').addEventListener('click', (e) => { const b = e.target.closest('[data-fk]'); if (b) femKey(b.dataset.fk); });
  function femSetField(ff) {
    // leaving a gioco box: normalise (positive µm, min < max) and show the clean value
    if (fem.field !== ff && (fem.field === 'GMIN' || fem.field === 'GMAX') && ff !== 'GMIN' && ff !== 'GMAX') {
      const c = Object.assign({}, femCfg()); [c.gmin, c.gmax] = orderGioco(c.gmin, c.gmax); saveFemCfg(c); fem.buf.GMIN = ''; fem.buf.GMAX = '';
    }
    fem.field = ff; if (ff === 'GMIN' || ff === 'GMAX') fem.buf[ff] = ''; renderFemPage();
  }
  document.querySelectorAll('.fm-field').forEach((b) => b.addEventListener('click', () => { haptic(10); femSetField(b.dataset.ff); }));
  /** v2.0.6 photo of the three blue rows → fields (never blocks; what is missing stays editable) */
  function femFromPhoto(parsed) {
    const f = femFromParsed(parsed), c = Object.assign({}, femCfg()), got = [], miss = [];
    if (f.nom != null) { c.nom = f.nom; got.push('nominale ' + fmtMm3(f.nom)); } else miss.push('nominale');
    if (f.tol != null) { c.tolM = f.tol; c.tolP = f.tol; }
    if (f.gmin != null && f.gmax != null) { c.gmin = f.gmin; c.gmax = f.gmax; got.push(`gioco ${fmtUm(f.gmin)}–${fmtUm(f.gmax)} µm`); } else miss.push('gioco (riga G)');
    saveFemCfg(c);
    fem.buf.GMIN = ''; fem.buf.GMAX = '';
    if (f.F != null) { fem.buf.F = fmtMm4(f.F); got.unshift('F ' + fmtMm4(f.F)); } else miss.unshift('F1A');
    if (f.S != null) { fem.buf.S = fmtMm4(f.S); fem.sTouched = true; }
    fem.field = f.F == null ? 'F' : (f.gmin == null ? 'GMIN' : 'F');
    showPage('femmina'); renderFemPage();
    toast((got.length ? 'Dalla foto: ' + got.join(' · ') : 'Foto non letta') + (miss.length ? ' — scrivi: ' + miss.join(', ') : ''), miss.length ? 'warn' : undefined);
  }
  $('femFoto').addEventListener('click', () => { haptic(12); pickPhotoSource('Adatta alla femmina: foto', 'Legge F1A (femmina), nominale ± tol, gioco (riga G) e S1A.', () => { pendingJob = null; pendingFem = true; }); });
  $('femFoto').addEventListener('contextmenu', (e) => { e.preventDefault(); pendingJob = null; pendingFem = true; openFoto('gallery'); });
  $('femCfgBtn').addEventListener('click', openFemCfg);
  const openFem = () => { haptic(12); fem.field = 'F'; showPage('femmina'); };
  $('btnFemOpen').addEventListener('click', openFem); $('btnFemOpen2').addEventListener('click', openFem);
  $('femBack').addEventListener('click', () => showPage('calc'));
  function femRows() {
    return (state.femmine || []).map((r) => ({ ts: r.ts, machine: r.machineName, base: r.nom, lotto: '', S: r.F, d: r.dev, chosen: null, gioco: null,
      status: r.inTol ? 'in tolleranza' : (r.dev > 0 ? 'maggiorata' : 'minorata') + ' (fuori tolleranza)', lavoro: 'femmina', target: r.target }));
  }
  function renderFemList() {
    const el = $('femList'); if (!el) return;
    const l = (state.femmine || []).slice().reverse().slice(0, 50);
    el.innerHTML = l.length ? l.map((r) => `<div class="hist-row fem-row"><span class="mono">${esc(new Date(r.ts).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) + ' ' + fmtTime(r.ts))}</span>
      <span><b class="cond">F ${esc(fmtMm4(r.F))} mm</b> ${r.inTol ? '✓' : '<b style="color:#ff8a8a">fuori tol.</b>'} → maschio <b class="cond">${esc(fmtMm4(r.target))} mm</b><small> ${esc(r.machineName || '')}</small></span></div>`).join('')
      : '<p class="meta">Nessuna femmina salvata (Adatta alla femmina).</p>';
  }
  // ── Beta 0.3.0: «Interno (femmina)» — internal grinding of the bore ──
  const intS = { buf: '', rel: false }; let pendingInt = false, intLock = false;
  function intSeries() { return currentContext().series; }
  /** Target config for THIS series (saved). Without a saved one: from today's male + gioco of the series, shown as «auto». */
  // Beta 0.4.2: the bore quota is FIXED (job → series), never «auto» from the last male in Calcolo; it carries its origin.
  function intCfg() {
    const s = intSeries(), j = jobsOn ? activeJob() : null;
    if (j && j.interno && (!s || j.interno.seriesId == null || j.interno.seriesId === s.id)) return j.interno;
    if (s && s.interno) return s.interno;
    return { mode: 'tol', nom: s ? s.base : null, tolM: null, tolP: null, none: true };
  }
  function saveIntCfg(c, src) {
    const s = intSeries(); if (!s) return; delete c.auto; delete c.none;
    c.src = src || 'mano'; c.at = new Date().toISOString(); c.seriesId = s.id;
    const j = jobsOn ? activeJob() : null;
    if (j) { j.interno = c; c.jobName = j.name || j.machineName || ''; }
    s.interno = c; saveData(state);
  }
  function intOrigin(c) {
    if (!c || c.none) return '';
    const t = c.at ? new Date(c.at) : null, when = t ? t.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) + ' ' + fmtTime(c.at) : '';
    return (c.src === 'foto' ? 'da foto' : c.src === 'mano' ? 'scritta a mano' : 'salvata') + (when ? ' ' + when : '');
  }
  /** Beta 0.4.2: default on Lizzini and Studer (user): + stringe il foro, − allarga. Per machine it can be changed or set to «non lo so». */
  const INT_RULE_DEFAULT = 'plus_smaller';
  function intRule() {
    const m = myMachine(); if (!m) return INT_RULE_DEFAULT;
    if (m.cal && m.cal.bore) return m.cal.bore === 'allarga' ? 'plus_bigger' : 'plus_smaller';
    if (m.internoRule === 'plus_bigger' || m.internoRule === 'plus_smaller') return m.internoRule;
    if (m.internoRule === 'none') return null;
    return INT_RULE_DEFAULT;
  }
  function intBoreValue() {
    const c = intCfg(), s = intSeries(), base = s ? s.base : (c.nom != null ? c.nom : null);
    if (intS.rel) return internoBore(intS.buf, base, true);
    const b = intS.buf; if (!b) return null;
    if (b.includes(',')) return internoBore(b, base, false);
    const ref = c.mode === 'maschio' ? c.M : (c.nom != null ? c.nom : base); if (ref == null) return null;
    const I = String(Math.floor(ref)); if (b.length > 4 && b.startsWith(I)) return Number(I + '.' + b.slice(I.length));
    return Number(I + '.' + b);
  }
  function intNow() { const c = intCfg(), tgt = internoTarget(c), bore = intBoreValue(), rule = intRule(); return { c, tgt, bore, rule, r: calT(calcInterno(bore, tgt, rule), 'needUm') }; }
  // Beta 0.4.2: compact, one line (keypad always visible); the choice opens only on «Cambia»
  function renderIntDir() {
    const m = myMachine(), rule = intRule(), el = $('intDir'); if (!el) return;
    const isDef = !(m && (m.internoRule === 'plus_bigger' || m.internoRule === 'plus_smaller' || m.internoRule === 'none'));
    if (intS.dirEdit) {
      el.innerHTML = `<div class="int-dir" id="intDirAsk"><p class="int-dnote">Non copiare il segno dell'esterno. Controlla sul 1° pezzo.</p><div class="row"><button type="button" data-ir="plus_smaller" class="${rule === 'plus_smaller' ? 'on' : ''}">+ stringe<small>− allarga</small></button><button type="button" data-ir="plus_bigger" class="${rule === 'plus_bigger' ? 'on' : ''}">+ allarga<small>− stringe</small></button><button type="button" data-ir="none" class="${!rule ? 'on' : ''}">Non so<small>solo parole</small></button></div></div>`;
    } else {
      el.innerHTML = `<div class="int-dir set" id="intDirSet"><span>${rule ? 'Interno: <b>' + (rule === 'plus_smaller' ? '+ stringe · − allarga' : '+ allarga · − stringe') + '</b>' + (isDef ? ' <i class="nt">(predef.)</i>' : '') : '<b>Verso + / − non impostato</b> · solo parole'}</span><button type="button" data-ir="edit">Cambia</button></div>`;
    }
  }
  function setIntRule(v) {
    const m = myMachine();
    if (v === 'edit') { intS.dirEdit = !intS.dirEdit; renderIntPage(); return; }
    intS.dirEdit = false;
    if (m) { m.internoRule = v; m.internoAsked = true; saveData(state); }
    renderIntPage();
  }
  function renderIntPage() {
    const n = intNow(), c = n.c, s = intSeries();
    $('intCfgTxt').textContent = n.tgt ? `${fmtMm4(n.tgt.lo)}–${fmtMm4(n.tgt.hi)}${c.src === 'foto' ? ' · foto' : c.src === 'mano' ? ' · a mano' : ''}` : 'quota da impostare ✎';
    const wide = internoTolWide(c);
    renderIntDir();
    document.querySelectorAll('.int-mode .ims').forEach((b) => b.classList.toggle('on', (b.dataset.im === 'rel') === intS.rel));
    $('intFieldLbl').innerHTML = intS.rel ? `Foro misurato · numero <span class="nt">(µm dalla base ${s ? fmtMm3(s.base) : '—'})</span>` : 'Foro misurato (diametro, <span class="nt">mm</span>)';
    $('iComma').textContent = intS.rel ? '±' : ',';
    const ref = c.mode === 'maschio' ? c.M : c.nom;
    $('intVal').textContent = intS.buf ? (intS.rel ? intS.buf.replace('-', '−') + ' µm' + (n.bore != null ? ' = ' + fmtMm4(n.bore) + ' mm' : '') : (intS.buf.includes(',') || n.bore == null ? intS.buf : fmtMm4(n.bore)) + ' mm') : (intS.rel ? '— µm' : (ref != null ? Math.floor(ref) + ',' : '—'));
    let h = '';
    if (!s) h = '<div class="fr-empty">Scegli prima la serie (base) in Calcolo.</div>';
    else if (!n.tgt) h = `<div class="fr-empty int-warn" id="intNoTgt"><b>Manca la quota del foro.</b> Tocca <b>quota foro ✎</b>: nominale ± tolleranza <b>vera del foro</b>, oppure maschio + gioco. ${c.nom != null && c.none ? '' : ''}Senza quota l'app non dice se è buono.</div>`;
    else if (n.bore == null) h = `<div class="fr-empty">Foro: da <b>${fmtMm4(n.tgt.lo)}</b> a <b>${fmtMm4(n.tgt.hi)}</b> mm, centro <b>${fmtMm4(n.tgt.centro)}</b>. Scrivi il <b>foro misurato</b>.</div>`;
    else {
      const r = n.r, sg = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + fmtUm(Math.abs(x));
      const big = r.state === 'stretto' ? `STRETTO di ${fmtUm(r.belowLo)} µm` : r.state === 'largo' ? `LARGO di ${fmtUm(r.aboveHi)} µm` : '✓ In quota';
      const lim = r.state === 'stretto' ? 'sotto il limite minimo' : r.state === 'largo' ? 'sopra il limite massimo' : `${fmtUm(-r.belowLo)} µm dal minimo · ${fmtUm(-r.aboveHi)} µm dal massimo`;
      // Beta 0.4.1: green/red gauge like the main result: green band = target lo…hi, marker = measured bore
      const span = Math.max(n.tgt.hi - n.tgt.lo, 0.002), g0 = n.tgt.lo - span, g1 = n.tgt.hi + span;
      const pct = (v) => Math.max(0, Math.min(100, ((v - g0) / (g1 - g0)) * 100));
      const gauge = `<div class="int-gauge ${r.state}" id="intGauge" aria-label="foro rispetto alla quota"><div class="ig-bar"><div class="ig-ok" style="left:${pct(n.tgt.lo)}%;right:${100 - pct(n.tgt.hi)}%"></div>
        <div class="ig-c" style="left:${pct(n.tgt.centro)}%"></div><div class="ig-m" style="left:${pct(n.bore)}%"></div></div>
        <div class="ig-lab"><span>stretto</span><span>${fmtMm4(n.tgt.lo)} · ${fmtMm4(n.tgt.hi)}</span><span>largo</span></div></div>`;
      const adv = r.none ? '✓ nessuna correzione' : r.valTxt ? `inserisci ${esc(r.valTxt)}` : (r.key ? `dai ${esc(r.key)} ×${r.presses}` : (r.action === 'allarga' ? 'allarga ' : 'stringi ') + fmtUm(Math.abs(r.needUm)) + ' µm');
      // Beta 0.4.1: material, literally, on the diameter (grinding a bore only removes material → it only grows)
      const toLo = round1((n.tgt.lo - n.bore) * 1000), toHi = round1((n.tgt.hi - n.bore) * 1000), toC = round1((n.tgt.centro - n.bore) * 1000);
      const mat = r.state === 'largo'
        ? `<b>Foro largo di ${fmtUm(r.aboveHi)} µm: non si recupera (rettificando il foro cresce)</b><small>correggi la macchina per i prossimi pezzi ↓</small>`
        : toC > 0.5 ? `<b>Togli ancora ${fmtUm(toC)} µm sul Ø <span class="nt">(${fmtUm(round1(toC / 2))} µm per lato)</span> → centro ${fmtMm4(n.tgt.centro)}</b>`
        : toC < -0.5 ? `<b>Non togliere altro: ${fmtUm(-toC)} µm sopra il centro ${fmtMm4(n.tgt.centro)}</b>` : `<b>Al centro ${fmtMm4(n.tgt.centro)}: non togliere altro</b>`;
      const lims = `<small>${toLo > 0 ? 'al minimo mancano ' + fmtUm(toLo) + ' µm' : toLo === 0 ? 'proprio sul minimo' : fmtUm(-toLo) + ' µm sopra il minimo'} · ${toHi >= 0 ? 'al massimo restano ' + fmtUm(toHi) + ' µm' : 'oltre il massimo di ' + fmtUm(-toHi) + ' µm'}</small>`;
      h = `<div class="is-big ${r.state}" id="intState">${big}</div><div class="int-mat ${r.state}" id="intMat">${mat}${lims}</div>${gauge}
        <div class="int-adv ${r.none ? 'ok' : r.state}" id="intAdv">${adv}<small id="intCorr">${r.none ? calLegend() : 'Per i prossimi pezzi · ' + esc(internoWords(r).replace(/ → .*$/, '')) + ' sul Ø (' + fmtUm(round1(Math.abs(r.needUm) / 2)) + ' per lato) · ' + calLegend()}${n.rule && !(myMachine() || {}).internoRule ? ' · segno predefinito: verifica al 1° pezzo' : ''}</small></div>
        <div class="is-lines">${r.state === 'ok' ? esc(lim) : esc(lim)} · dal centro ${fmtMm4(n.tgt.centro)}: <b>${sg(r.devUm)} µm</b></div>
        `;
    }
    const nPz = (state.interni || []).filter((x) => x.seriesId === (s && s.id) && (!jobsOn || !activeJob() || x.jobId === activeJob().id)).length;
    if (s && n.tgt) h = `<div class="int-count" id="intCount">Pezzo n. ${nPz + 1} · quota <span id="intOrigin">${esc(intOrigin(c))}</span>${c.mode === 'maschio' && c.M != null ? ' · maschio ' + fmtMm4(c.M) : ''}</div>`
      + (wide ? `<div class="int-warn" id="intWide">⚠ Tolleranza ±${fmtUm(wide)} µm: sembra quella del foglio, non del foro. Controlla ✎</div>` : '') + h;
    $('intRes').innerHTML = h;
    $('iSave').classList.toggle('off', n.bore == null || !n.tgt);
    fitPads();
  }
  function intKey(k) {
    haptic(10);
    if (k === 'SAVE') { saveInterno(); return; }
    let b = intS.buf;
    if (k === 'BS') b = b.slice(0, -1);
    else if (k === 'AC') b = '';
    else if (k === ',') { if (intS.rel) b = b.startsWith('-') ? b.slice(1) : '-' + b; else if (!b.includes(',')) { const c = intCfg(); b = (b && b.length >= 2 ? b : String(Math.floor((c.mode === 'maschio' ? c.M : c.nom) || 0))) + ','; } }
    else if (b.replace(/[,-]/g, '').length < (intS.rel ? 4 : 9)) b += k;
    intS.buf = b; renderIntPage();
  }
  function saveInterno() {
    if (intLock) return;
    const n = intNow();
    if (!n.tgt) { openIntCfg(); return; }
    if (n.bore == null) { toast('Scrivi prima la misura del foro'); return; }
    intLock = true; setTimeout(() => { intLock = false; }, 700);
    const s = intSeries(), j = jobsOn ? activeJob() : null, r = n.r;
    const rec = { id: 'i_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ts: new Date().toISOString(), lavoro: 'interno', seriesId: s ? s.id : null, jobId: j ? j.id : null,
      machineName: (j && j.machineName) || (myMachine() || {}).name || '', base: s ? s.base : null, bore: n.bore, lo: n.tgt.lo, hi: n.tgt.hi, centro: n.tgt.centro,
      mode: n.c.mode, M: n.c.M != null ? n.c.M : null, gmin: n.c.gmin != null ? n.c.gmin : null, gmax: n.c.gmax != null ? n.c.gmax : null,
      devUm: r.devUm, state: r.state, action: r.action, presses: r.presses, key: r.key || null, rule: n.rule };
    state.interni = state.interni || []; state.interni.push(rec); saveData(state);
    intS.buf = ''; intS.fromPhoto = false; clearToast(); renderIntPage(); renderFatti();
    const lab = r.state === 'stretto' ? 'STRETTO' : r.state === 'largo' ? 'LARGO' : 'in quota';
    showUndo(`Salvato interno ${fmtMm4(rec.bore)} mm · ${lab}`, () => {
      const before = (state.interni || []).length; state.interni = (state.interni || []).filter((x) => x.id !== rec.id);
      if (state.interni.length < before) { saveData(state); renderIntPage(); renderFatti(); toast('Interno annullato'); }
    });
    if (prefs.voiceAuto) speakIt('Foro ' + lab + (r.none ? '' : ', ' + internoWords(r).replace('×', 'per ')));
  }
  function openIntCfg() {
    const c = intCfg(), v = (x, f) => (x == null ? '' : (f ? f(x) : String(x)));
    const fld = (id, l, val, ph) => `<div><label for="${id}">${l}</label><input id="${id}" class="neu" inputmode="decimal" value="${esc(val)}" placeholder="${ph}" autocomplete="off"/></div>`;
    const draw = (mode) => {
      $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal fem-cfg ctx-panel" id="intCfgModal">
        <h2>Quota del foro (interno)</h2><p class="meta">Diametri. Resta fissa per questo lavoro finché non la cambi. Usa la tolleranza <b>del foro</b>, non quella generale del foglio.</p>
        <div class="int-mode"><button type="button" class="ims ${mode === 'tol' ? 'on' : ''}" data-icm="tol">Nominale ± tolleranza</button><button type="button" class="ims ${mode === 'maschio' ? 'on' : ''}" data-icm="maschio">Dal maschio + gioco</button></div>
        ${mode === 'tol' ? `${fld('icNom', 'Nominale foro mm', v(c.nom, fmtMm3), 'es. 20,000')}<div class="field-row">${fld('icTm', 'Tolleranza − mm', v(c.tolM, fmtMm3), '0,005')}${fld('icTp', 'Tolleranza + mm', v(c.tolP, fmtMm3), '0,010')}</div>${c.sheetTol != null ? `<p class="int-warn" id="icSheetTol">Il foglio dice ±${fmtMm3(c.sheetTol)} mm: è la tolleranza generale, non quella del foro. Scrivi quella vera.</p>` : ''}`
          : `${fld('icM', 'Maschio misurato mm', v(c.M, fmtMm4), 'es. 20,0120')}<div class="field-row">${fld('icGmin', 'Gioco min µm', v(c.gmin), '8')}${fld('icGmax', 'Gioco max µm', v(c.gmax), '11')}</div><p class="meta">Foro = maschio + gioco.</p>`}
        <div class="actions" style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-sec" id="icCancel" style="flex:1;min-height:52px">Annulla</button>
        <button type="button" class="btn btn-primary" id="icSave" style="flex:1.4;min-height:52px">✓ Salva</button></div></div></div>`;
      const close = () => { $('modalRoot').innerHTML = ''; };
      $('icCancel').onclick = close; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') close(); const m = e.target.closest('[data-icm]'); if (m) draw(m.dataset.icm); };
      $('icSave').onclick = () => {
        if (mode === 'tol') { const nom = setupNum($('icNom').value), tm = setupNum($('icTm').value), tp = setupNum($('icTp').value);
          if (nom == null || tm == null || tp == null) { toast('Scrivi nominale e tolleranze', 'warn'); return; }
          saveIntCfg({ mode: 'tol', nom, tolM: Math.abs(tm), tolP: Math.abs(tp) }, 'mano');
        } else { const M = setupNum($('icM').value); let a = normGiocoUm($('icGmin').value), b = normGiocoUm($('icGmax').value);
          if (M == null || a == null || b == null) { toast('Scrivi maschio e gioco min/max', 'warn'); return; }
          [a, b] = orderGioco(normGiocoUm($('icGmin').value), normGiocoUm($('icGmax').value)); // µm or sheet format (−0,007)
          saveIntCfg({ mode: 'maschio', M, gmin: a, gmax: b }, 'mano');
        }
        close(); renderIntPage(); toast('Quota del foro salvata');
      };
    };
    draw(c.mode === 'maschio' ? 'maschio' : 'tol');
  }
  /** Photo (same reader as Adatta): F1A = the bore; S1A + gioco = target from the male, else nominale ± tol. */
  function intFromPhoto(parsed) {
    const f = femFromParsed(parsed), got = [], miss = [];
    if (f.S != null && f.gmin != null && f.gmax != null) { saveIntCfg({ mode: 'maschio', M: f.S, gmin: f.gmin, gmax: f.gmax }, 'foto'); got.push(`maschio ${fmtMm4(f.S)} + gioco ${fmtUm(f.gmin)}–${fmtUm(f.gmax)} µm`); }
    else { // Beta 0.4.2: never use the sheet ± tolerance for the bore → ask for the real one
      const s = intSeries(); if (s && !(s.interno && !s.interno.none)) s.interno = { mode: 'tol', nom: f.nom != null ? f.nom : s.base, tolM: null, tolP: null, sheetTol: f.tol != null ? f.tol : null, none: true };
      else if (s && s.interno) s.interno.sheetTol = f.tol != null ? f.tol : null;
      miss.push('tolleranza vera del foro (✎)');
    }
    // Beta 0.4.1: F1A is only the FIRST measure; after Salva the keypad is empty for the next piece
    if (f.F != null) { intS.rel = false; intS.buf = fmtMm4(f.F); intS.fromPhoto = true; got.unshift('1° foro F ' + fmtMm4(f.F)); } else { intS.buf = ''; intS.fromPhoto = false; }
    showPage('interno'); renderIntPage();
    if (miss.length && !internoTarget(intCfg())) setTimeout(openIntCfg, 400);
    toast((got.length ? 'Dalla foto: ' + got.join(' · ') : 'Foto non letta') + (miss.length ? ' — scrivi: ' + miss.join(', ') : ''), miss.length ? 'warn' : undefined);
  }
  $('iKeypad').addEventListener('click', (e) => { const b = e.target.closest('[data-ik]'); if (b) intKey(b.dataset.ik); });
  $('intDir').addEventListener('click', (e) => { const b = e.target.closest('[data-ir]'); if (b) { haptic(15); setIntRule(b.dataset.ir); } });
  document.querySelectorAll('.int-mode [data-im]').forEach((b) => b.addEventListener('click', () => { haptic(10); const rel = b.dataset.im === 'rel'; if (rel !== intS.rel) { intS.rel = rel; intS.buf = ''; } renderIntPage(); }));
  $('intCfgBtn').addEventListener('click', openIntCfg);
  $('intFoto').addEventListener('click', () => { haptic(12); pickPhotoSource('Interno: foto', 'Legge F1A (foro), S1A e gioco (riga G) o nominale ± tol.', () => { pendingJob = null; pendingFem = false; pendingInt = true; }); });
  $('intFoto').addEventListener('contextmenu', (e) => { e.preventDefault(); pendingJob = null; pendingFem = false; pendingInt = true; openFoto('gallery'); });
  const openInt = () => { haptic(12); showPage('interno'); };
  $('btnIntOpen').addEventListener('click', openInt); $('btnIntOpen2').addEventListener('click', openInt);
  $('intBack').addEventListener('click', () => showPage('calc'));
  function intShift() { const t0 = (state.turno && state.turno.startedAt) || ''; return (state.interni || []).filter((r) => String(r.ts || '') >= t0).length; }
  // ── Beta 0.8.1: Rettifica manuale (everything by hand; no series, no photo). Math in calc.js: manualTarget / manualStatus ──
  function calLegend() { const c = calOf(); return c.modo === 'valore' ? 'valore diretto in mm sul ' + c.scala + ' · ' + (c.outer === 'allarga' ? '+ = più grande' : '+ = più piccolo') : '1 tocco = ' + fmtUm(c.umPerTocco) + ' µm sul ' + c.scala; }
  const man = { mode: 'maschio', mk: 'mis', last: null };
  function manNum(id) { const v = $(id) ? parseMmNumber($(id).value) : null; return v == null ? null : v; }
  function manCompute() {
    const mode = man.mode;
    let mate = null;
    if (man.mk === 'mis') { const v = manNum('manMate'); if (v != null) mate = { lo: v, hi: v, src: 'misurata' }; }
    else { const n = manNum('manMateNomV'); if (n != null) { const r = rangeFromNominal(n, parseTolMm($('manMateT1').value), parseTolMm($('manMateT2').value)); mate = Object.assign(r, { src: 'nominale', nom: n }); } }
    let gMin = parseGiocoSheet($('manGmin').value), gMax = parseGiocoSheet($('manGmax').value), gSwap = false;
    if (gMin != null && gMax != null && gMin > gMax) { [gMin, gMax] = [gMax, gMin]; gSwap = true; } // Beta 0.8.1: same as Calcolo, min/max never inverted
    const on = manNum('manOwnNom'), draw = on != null ? rangeFromNominal(on, parseTolMm($('manOwnT1').value), parseTolMm($('manOwnT2').value)) : null;
    const t = manualTarget(mode, mate, gMin, gMax, draw);
    const cur = manNum('manCur'), cal = calOf();
    const st = t.ok ? manualStatus(mode, cur, t.target, cal) : null;
    return { mode, mate, gMin, gMax, gSwap, draw, t, cur, st, cal };
  }
  function renderMan() {
    document.querySelectorAll('[data-mm]').forEach((b) => b.classList.toggle('on', b.dataset.mm === man.mode));
    document.querySelectorAll('[data-mk]').forEach((b) => b.classList.toggle('on', b.dataset.mk === man.mk));
    $('manMateMisRow').classList.toggle('hidden', man.mk !== 'mis'); $('manMateNomRow').classList.toggle('hidden', man.mk === 'mis');
    const fem = man.mode === 'femmina';
    $('manMateH').textContent = fem ? 'Maschio esistente' : 'Femmina esistente (foro)';
    $('manOwnH').innerHTML = (fem ? 'Il tuo foro (femmina)' : 'Il tuo maschio') + ' · disegno <span class="meta">(facoltativo)</span>';
    $('manCurL').innerHTML = 'Misura attuale ' + (fem ? 'del tuo foro' : 'del tuo maschio') + ' <b>mm</b> <span class="meta">(facoltativa)</span>';
    const r = manCompute(); man.last = r;
    document.querySelectorAll('[data-gp]').forEach((b) => { const [a, c] = b.dataset.gp.split('-').map(Number); b.classList.toggle('on', r.gMin === a && r.gMax === c); });
    const box = $('manRes');
    if (!r.t.ok) { box.innerHTML = `<div class="meta" id="manErr">${esc(r.t.error)}</div>`; $('manSave').disabled = true; return; }
    const T = r.t.target, who = fem ? 'Foro da fare' : 'Maschio da fare';
    let h = `<div class="mr-t">${who}</div><div class="mr-big cond" id="manRange">da ${esc(fmtMm4(T.lo))} a ${esc(fmtMm4(T.hi))} mm</div><div class="mr-c">centro <b class="cond" id="manCentro">${esc(fmtMm4(T.centro))} mm</b></div>`;
    h += `<div class="meta">${r.mate.src === 'nominale' ? 'pezzo da accoppiare ' + fmtMm4(r.mate.lo) + '–' + fmtMm4(r.mate.hi) + ' mm (caso peggiore)' : 'pezzo da accoppiare ' + fmtMm4(r.mate.lo) + ' mm'} · gioco ${fmtUm(Math.min(r.gMin, r.gMax))}–${fmtUm(Math.max(r.gMin, r.gMax))} µm${r.draw ? ' · disegno ' + fmtMm4(r.draw.lo) + '–' + fmtMm4(r.draw.hi) + ' mm' : ''}</div>`;
    if (r.t.overlap === true && (T.lo !== r.t.fit.lo || T.hi !== r.t.fit.hi)) h += `<div class="meta">Ristretto dal disegno (solo gioco: ${fmtMm4(r.t.fit.lo)}–${fmtMm4(r.t.fit.hi)} mm)</div>`;
    if (r.t.warn) h += `<div class="mr-w" id="manWarn">⚠ ${esc(r.t.warn)}</div>`;
    const s2 = r.st;
    if (s2) {
      const unver = r.cal.stato !== 'verificata';
      if (s2.state === 'no') h += `<div class="mr-st no" id="manSt">✗ NON RECUPERABILE<br><small>${esc(s2.words)}</small></div>`;
      else {
        h += `<div class="mr-st ${s2.state}" id="manSt">${s2.state === 'ok' ? '✓ IN QUOTA' : '! DA TOGLIERE ANCORA'} · ${esc(fmtMm4(r.cur))} mm<br><small>${s2.none ? 'al centro: non togliere altro' : 'da togliere ' + fmtUm(s2.removeUm) + ' µm sul Ø · ' + fmtUm(s2.perSideUm) + ' µm per lato'}${s2.state === 'da_togliere' ? ' · ' + fmtUm(s2.toLimitUm) + ' µm al limite' : ''}</small></div>`;
        if (!s2.none) h += `<div class="mr-c" id="manCorr">${fem ? 'Allarga il foro' : 'Stringi il diametro'}: ${s2.valTxt ? `inserisci <span class="mr-k cond">${esc(s2.valTxt)}</span> mm` : `<span class="mr-k cond">${esc(s2.key)} ×${s2.presses}</span> ${s2.presses === 1 ? 'tocco' : 'tocchi'}`} <small class="meta">(${esc(calLegend())}${unver ? ' · ⚠ taratura da verificare: controlla il verso del + sul primo pezzo' : ''})</small></div>`;
      }
    }
    box.innerHTML = h; $('manSave').disabled = false;
  }
  function manSave() {
    const r = man.last; if (!r || !r.t.ok || saveLock) return;
    saveLock = true; setTimeout(() => { saveLock = false; }, 700);
    const m = myMachine();
    const rec = { id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ts: new Date().toISOString(), lavoro: 'manuale', mode: r.mode,
      mate: r.mate, giocoMin: Math.min(r.gMin, r.gMax), giocoMax: Math.max(r.gMin, r.gMax), draw: r.draw, target: r.t.target, warn: r.t.warn || '',
      cur: r.cur, state: r.st ? r.st.state : null, removeUm: r.st ? r.st.removeUm : null, key: r.st ? r.st.key : '', presses: r.st ? r.st.presses : 0,
      machineName: (m && m.name) || '', cal: { outer: r.cal.outer, bore: r.cal.bore, umPerTocco: r.cal.umPerTocco, scala: r.cal.scala, stato: r.cal.stato, modo: r.cal.modo } };
    state.manuali = (state.manuali || []).concat([rec]).slice(-500); saveData(state); haptic(30);
    showUndo('Salvato nello Storico · rettifica manuale', () => { state.manuali = (state.manuali || []).filter((x) => x.id !== rec.id); saveData(state); toast('Annullato'); });
  }
  function renderManList() {
    const el = $('manList'); if (!el) return;
    const l = (state.manuali || []).slice().reverse().slice(0, 50);
    el.innerHTML = l.length ? l.map((r) => `<div class="hist-row fem-row"><span class="mono">${esc(new Date(r.ts).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) + ' ' + fmtTime(r.ts))}</span>
      <span><b class="cond">${r.mode === 'femmina' ? 'Foro' : 'Maschio'} da ${esc(fmtMm4(r.target.lo))} a ${esc(fmtMm4(r.target.hi))} mm</b>${r.cur != null ? ' · misura ' + esc(fmtMm4(r.cur)) + ' mm ' + (r.state === 'ok' ? '<b style="color:var(--green)">✓ in quota</b>' : r.state === 'no' ? '<b style="color:#ff8a8a">non recuperabile</b>' : '<b style="color:var(--amber)">da togliere ' + esc(fmtUm(r.removeUm)) + ' µm</b>') : ''}<small> gioco ${esc(fmtUm(r.giocoMin))}–${esc(fmtUm(r.giocoMax))} µm${r.machineName ? ' · ' + esc(r.machineName) : ''}</small></span></div>`).join('')
      : '<p class="meta">Nessuna rettifica manuale salvata (Calcolo → ✍ Manuale).</p>';
  }
  // ── Beta 0.8.1: last manual draft in prefs (never the current measure: each piece starts empty) ──
  const MAN_DRAFT_IDS = ['manMate', 'manMateNomV', 'manMateT1', 'manMateT2', 'manGmin', 'manGmax', 'manOwnNom', 'manOwnT1', 'manOwnT2'];
  function manSaveDraft() {
    const f = {}; MAN_DRAFT_IDS.forEach((id) => { const v = $(id) ? String($(id).value || '') : ''; if (v) f[id] = v.slice(0, 24); });
    prefs.manDraft = { mode: man.mode, mk: man.mk, f }; savePrefs(prefs);
  }
  function manRestoreDraft() {
    const d = prefs.manDraft; if (!d || typeof d !== 'object') return;
    if (d.mode === 'maschio' || d.mode === 'femmina') man.mode = d.mode;
    if (d.mk === 'mis' || d.mk === 'nom') man.mk = d.mk;
    const f = (d.f && typeof d.f === 'object') ? d.f : {};
    MAN_DRAFT_IDS.forEach((id) => { if ($(id)) $(id).value = typeof f[id] === 'string' ? f[id] : ''; });
  }
  /** min > max (both readable) → put the boxes back in order; called when leaving a gioco box, not while typing */
  function manFixGioco() {
    const a = parseGiocoSheet($('manGmin').value), c = parseGiocoSheet($('manGmax').value);
    if (a == null || c == null || a <= c) return false;
    const t = $('manGmin').value; $('manGmin').value = $('manGmax').value; $('manGmax').value = t;
    $('manGswap').classList.remove('hidden'); clearTimeout(manFixGioco.tm); manFixGioco.tm = setTimeout(() => $('manGswap').classList.add('hidden'), 4000);
    return true;
  }
  function manOnOpen() { manRestoreDraft(); $('manCur').value = ''; }
  $('btnManOpen').addEventListener('click', () => { haptic(12); showPage('manuale'); });
  $('manBack').addEventListener('click', () => { manFixGioco(); manSaveDraft(); showPage('calc'); });
  document.querySelectorAll('[data-mm]').forEach((b) => b.addEventListener('click', () => { man.mode = b.dataset.mm; haptic(12); renderMan(); manSaveDraft(); }));
  document.querySelectorAll('[data-mk]').forEach((b) => b.addEventListener('click', () => { man.mk = b.dataset.mk; haptic(12); renderMan(); manSaveDraft(); }));
  document.querySelectorAll('[data-gp]').forEach((b) => b.addEventListener('click', () => {
    const [a, c] = b.dataset.gp.split('-'); $('manGmin').value = a; $('manGmax').value = c; $('manGswap').classList.add('hidden');
    haptic(15); renderMan(); manSaveDraft();
  }));
  $('page-manuale').addEventListener('input', (e) => { if (e.target.classList.contains('man-in')) { renderMan(); manSaveDraft(); } });
  $('page-manuale').addEventListener('change', (e) => { if ((e.target.id === 'manGmin' || e.target.id === 'manGmax') && manFixGioco()) { renderMan(); manSaveDraft(); } });
  $('manSave').addEventListener('click', manSave);
  function intRows() {
    return (state.interni || []).map((r) => ({ ts: r.ts, machine: r.machineName, base: r.base, lotto: '', S: r.bore, d: r.base != null ? round1((r.bore - r.base) * 1000) : null, chosen: null, gioco: null,
      status: r.state === 'ok' ? 'in quota' : r.state, lavoro: 'interno', target: null, interno: r }));
  }
  function renderIntList() {
    const el = $('intList'); if (!el) return;
    const l = (state.interni || []).slice().reverse().slice(0, 50);
    el.innerHTML = l.length ? l.map((r) => `<div class="hist-row fem-row"><span class="mono">${esc(new Date(r.ts).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) + ' ' + fmtTime(r.ts))}</span>
      <span><b class="cond">Foro ${esc(fmtMm4(r.bore))} mm</b> ${r.state === 'ok' ? '✓ in quota' : `<b style="color:#ff8a8a">${r.state === 'stretto' ? 'STRETTO' : 'LARGO'}</b>`} · quota ${esc(fmtMm4(r.lo))}–${esc(fmtMm4(r.hi))} mm<small> ${esc(r.machineName || '')}</small></span></div>`).join('')
      : '<p class="meta">Nessun interno salvato (Interno femmina).</p>';
  }
  function copyText(text) {
    let done = false;
    try { if (window.RettificaAndroid && RettificaAndroid.copyText) { RettificaAndroid.copyText(text); done = true; } } catch (e) {}
    if (!done) {
      try { if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).catch(() => {}); done = true; } } catch (e) {}
    }
    if (!done) {
      try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); done = document.execCommand('copy'); ta.remove(); } catch (e) {}
    }
    window.__lastCopied = text;
    haptic(15); toast(done ? 'Copiato: ' + text : text);
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-copy]'); if (b) { e.stopPropagation(); copyText(b.dataset.copy); } }, true);

  // ── v1.9.9: correction hints for the recommended part and its neighbours ──
  function hintsForCalc(calc, center, extra) {
    const series = calc && seriesById(calc.seriesId); if (!series || center == null) return null;
    const machine = machineById(calc.machineId) || myMachine();
    const gc = calcGioco(calc, series);
    const nh = neighbourHints(calc.S, series.base, gc.min, gc.max, center, (machine && machine.rule) || 'studer', extra, calc.mode);
    if (nh) ['center', 'up', 'down', 'extra'].forEach((k) => calHint(nh[k], machine));
    return nh;
  }
  function hintChip(h, cls) {
    const txt = h.none ? '✓ nessuna correzione' : h.text;
    // v2.0.10: two short lines that never wrap (position · keys) instead of one long wrapping text
    const w = h.words || {};
    const l1 = h.none ? 'al centro' : (w.posShort || ''), l2 = h.none ? '✓ nessuna' : (w.keys || h.text);
    return `<button type="button" class="hc ${h.none ? 'hc-ok' : ''} ${cls || ''}" data-hint="${h.n}" aria-label="Pezzo ${h.n}: ${esc(txt)}"><b>${h.n}</b><small class="hc-l1">${esc(l1)}</small><span class="hc-l2">${esc(l2)}</span></button>`;
  }
  function hintCenter() { return lastCalc ? (lastCalc.selected != null ? lastCalc.selected : defaultWant()) : null; }
  function renderHintRow() {
    const el = $('hintRow'); if (!el || !lastCalc) return;
    const center = hintCenter();
    const hs = hintsForCalc(lastCalc, center, lastCalc.hintExtra);
    if (!hs) { el.innerHTML = ''; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const tgt = (h) => (h.n === lastCalc.corrWant ? ' hc-tgt' : '');
    el.innerHTML = `<div class="hr-h"><span class="hr-t">Correzione per il pezzo</span><span class="mono">${esc(keyLegend())}</span></div>
      <div class="hr-c">${hintChip(hs.down, 'hc-nb' + tgt(hs.down))}${hintChip(hs.center, 'hc-cur' + tgt(hs.center))}${hintChip(hs.up, 'hc-nb' + tgt(hs.up))}</div>
      <div class="hr-c2">${hs.extra ? hintChip(hs.extra, 'hc-ex' + tgt(hs.extra)) : ''}<button type="button" class="hc hc-more" id="hintMore">Altro pezzo…</button></div>`;
  }
  /** Picker: every part around center with its presses. onPick(n) */
  function openHintPicker(calc, center, current, onPick) {
    const series = seriesById(calc.seriesId);
    const parts = hintPickerParts(center, 8);
    const cells = parts.map((n) => {
      const h = hintsForCalc(calc, n, null).center;
      const st = calc.acc ? pieceStatus(n, calc.acc) : '';
      return `<button type="button" class="hp ${st ? 'hp-' + st : ''} ${n === center ? 'hp-cen' : ''} ${n === current ? 'hp-sel' : ''}" data-hp="${n}"><b>${n}</b>${h.none ? '<span>✓ nessuna</span>' : `<small class="hp-pos">${esc(h.words.posShort)} →</small><span class="hp-k">${esc(h.words.keys)}</span>`}</button>`;
    }).join('');
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal hint-pick">
      <h2>Correzione per un altro pezzo</h2>
      <div class="mating mt-pick">${matingHtml(matingRange(calc.S, calcGioco(calc, series).min, calcGioco(calc, series).max, calc.mode), calcGioco(calc, series).src, 'btnCopyMatingPick')}</div>
      <p class="meta" style="margin:4px 0 10px">Misura ${esc(fmtMmS(calc.S))} · Base ${esc(fmtMm3(series.base))}. Tocca il pezzo che vuoi · ${esc(keyLegend())}.</p>
      <div class="hp-grid">${cells}</div>
      <button type="button" class="btn btn-sec" id="hpClose" style="width:100%;margin-top:12px">Chiudi</button></div></div>`;
    $('hpClose').onclick = () => { $('modalRoot').innerHTML = ''; };
    $('modalBg').addEventListener('click', (e) => {
      if (e.target.id === 'modalBg') { $('modalRoot').innerHTML = ''; return; }
      const b = e.target.closest('[data-hp]'); if (!b) return;
      haptic(15); $('modalRoot').innerHTML = ''; onPick(parseInt(b.dataset.hp, 10));
    });
  }
  $('hintRow').addEventListener('click', (e) => {
    if (!lastCalc) return;
    if (e.target.closest('#hintMore')) {
      openHintPicker(lastCalc, hintCenter(), lastCalc.hintExtra, (n) => {
        lastCalc.hintExtra = n; lastCalc.wantPezzo = n; updateCorr(); renderResult();
        const h = lastCalc.corr; toast('Pezzo ' + n + ': ' + (h.none ? 'nessuna correzione' : corrKeysTxt(h)));
      });
      return;
    }
    const c = e.target.closest('[data-hint]'); if (!c) return;
    haptic(12); lastCalc.wantPezzo = parseInt(c.dataset.hint, 10); updateCorr(); renderResult();
  });
  // post-save strip: last piece's hints stay visible while measuring the next one
  function makeLastHint(calc, n, saveId) {
    const series = seriesById(calc.seriesId); if (!series || n == null) return null;
    const machine = machineById(calc.machineId) || myMachine(); const gc = calcGioco(calc, series);
    return { seriesId: series.id, machineId: calc.machineId, S: calc.S, n, giocoMin: gc.min, giocoMax: gc.max, giocoSrc: gc.src,
      rule: (machine && machine.rule) || 'studer', extra: null, day: todayKey(), saveId, mode: calc.mode || 'maschio' };
  }
  function lastHintCalc(lh) { return { S: lh.S, seriesId: lh.seriesId, machineId: lh.machineId, giocoMin: lh.giocoMin, giocoMax: lh.giocoMax, giocoSrc: lh.giocoSrc, mode: lh.mode || 'maschio' }; }
  function renderLastHint() {
    _renderLastHint(); fitPads(); // v2.0.8: size the keypad AFTER the strip has its final (longer) text
  }
  function _renderLastHint() {
    const el = $('lastHint'); if (!el) return;
    const lh = prefs.lastHint;
    const ser = lh && seriesById(lh.seriesId);
    const iv = $('calcInputView');
    if (!lh || !ser || lh.seriesId !== prefs.seriesId || lh.day !== todayKey()) { el.classList.add('hidden'); el.innerHTML = ''; if (iv) iv.classList.remove('has-hint'); return; }
    if (iv) iv.classList.add('has-hint');
    const hs = neighbourHints(lh.S, ser.base, lh.giocoMin, lh.giocoMax, lh.n, lh.rule, lh.extra, lh.mode);
    const t = (h) => (h.none ? '✓' : esc(h.text));
    const mr = matingRange(lh.S, lh.giocoMin, lh.giocoMax, lh.mode);
    el.innerHTML = `<span class="lh-h mono">ULTIMO</span><span class="lh-c"><b>${lh.n}</b> ${t(hs.center)} · <b>${hs.up.n}</b> ${t(hs.up)} · <b>${hs.down.n}</b> ${t(hs.down)}${hs.extra ? ` · <b>${hs.extra.n}</b> ${t(hs.extra)}` : ''}
      ${mr ? `<span class="lh-m">${mr.of === 'maschio' ? 'Maschio da fare' : 'Femmina accoppiata'} <b class="lh-r">${fmtMm4(mr.min)}–${fmtMm4(mr.max)}</b> · centro <b class="lh-r">${fmtMm4(mr.centro)}</b></span>` : ''}</span><span class="chev">›</span>`;
    el.setAttribute('aria-label', 'Ultimo pezzo ' + lh.n + ': ' + (hs.center.none ? 'nessuna correzione' : hs.center.text) + '. ' + hs.line + '. ' + matingRangeText(mr) + '. Tocca per un altro pezzo');
    el.classList.remove('hidden');
  }
  $('lastHint').addEventListener('click', () => {
    const lh = prefs.lastHint; if (!lh || !seriesById(lh.seriesId)) return;
    openHintPicker(lastHintCalc(lh), lh.n, lh.extra, (n) => { lh.extra = n === lh.n ? null : n; savePrefs(prefs); renderLastHint(); });
  });

  function selectPiece(n) {
    if (!lastCalc) return;
    const prev = lastCalc.selected;
    lastCalc.selected = n;
    lastCalc.wantPezzo = null; updateCorr(); // Beta 0.2.1: correction follows the selected part
    const acc = lastCalc.acc, st = pieceStatus(n, acc), box = $('vaBeneBox');
    const gioco = giocoOf(n, acc);
    renderResult();
    let msg = 'Pezzo ' + n + ' · gioco ' + fmtUm(gioco) + ' µm · ';
    msg += st === 'ok' ? 'va bene' : st === 'lim' ? 'al limite' : 'FUORI GIOCO (' + acc.valid[0] + '…' + acc.valid[acc.valid.length - 1] + ' vanno bene)';
    if (!acc.valid.length) msg = 'Pezzo ' + n + ' · gioco ' + fmtUm(gioco) + ' µm · FUORI GIOCO';
    box.classList.remove('hidden'); box.classList.toggle('bad', st === 'no');
    box.innerHTML = `<div><b>Va bene?</b> ${esc(msg)}</div><div class="actions">
      <button type="button" class="btn ${st === 'no' ? 'btn-danger' : 'btn-teal'}" id="vaOk" style="flex:1">${st === 'no' ? 'Sì, è uno scarto' : 'Sì, usa ' + n}</button>
      <button type="button" class="btn btn-sec" id="vaNo" data-prev="${prev == null ? '' : prev}" style="flex:1">Annulla</button></div>`;
  }
  /** v2.0.8: one key legend for the active machine: «1 tocco = 1 µm · − = più grande» (Studer). */
  function keyLegend() { const c = calOf(); // Beta 0.9.3: from the calibration (tocchi or valore diretto)
    const dir = c.outer === 'allarga' ? '+ = più grande' : '− = più grande';
    return (c.modo === 'valore' ? 'valore in mm sul ' + c.scala : '1 tocco = ' + fmtUm(c.umPerTocco) + ' µm' + (c.scala === 'raggio' ? ' sul raggio' : '')) + ' · ' + dir; }
  /** v2.0.8: in-app confirm with glove-sized buttons (replaces the browser's small confirm()). Resolves true/false. */
  function askBig(o) {
    return new Promise((resolve) => {
      const root = $('modalRoot');
      root.innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ask-big" id="askBig" role="dialog" aria-modal="true">
        <h2>${esc(o.title)}</h2>${o.html ? `<div class="ask-body">${o.html}</div>` : ''}
        <div class="ask-btns"><button type="button" class="btn btn-sec" id="askNo">${esc(o.cancel || 'Annulla')}</button>
        <button type="button" class="btn ${o.danger ? 'btn-danger' : 'btn-orange'}" id="askYes">${esc(o.ok || 'Conferma')}</button></div></div></div>`;
      const done = (v) => { const vals = {}; root.querySelectorAll('input').forEach((i) => { vals[i.id] = i.value; }); root.innerHTML = ''; resolve(v && o.withVals ? vals : v); };
      $('askYes').addEventListener('click', () => { haptic(15); done(true); });
      $('askNo').addEventListener('click', () => done(false));
      $('modalBg').addEventListener('click', (e) => { if (e.target.id === 'modalBg') done(false); });
    });
  }
  function askSaveNo() {
    const n = lastCalc.selected, g = giocoOf(n, lastCalc.acc);
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal danger-modal">
      <h2>⚠ Pezzo ${esc(String(n))} fuori gioco</h2>
      <p style="font-size:17px;font-weight:700;margin:6px 0 12px">Con il pezzo ${esc(String(n))} il gioco è ${esc(fmtUm(g))} µm (va bene ${lastCalc.giocoMin}–${lastCalc.giocoMax} µm). Lo salvo come <b>SCARTO</b>?</p>
      <div class="actions" style="display:flex;flex-direction:column;gap:10px">
        <button type="button" class="btn btn-red-solid" id="noSaveYes">Sì, salva come scarto</button>
        <button type="button" class="btn btn-sec" id="noSaveNo">Annulla</button></div></div></div>`;
    $('noSaveYes').onclick = () => { $('modalRoot').innerHTML = ''; saveCurrent(true); };
    $('noSaveNo').onclick = () => { $('modalRoot').innerHTML = ''; };
    $('modalBg').onclick = (ev) => { if (ev.target.id === 'modalBg') $('modalRoot').innerHTML = ''; };
  }
  function saveCurrent(confirmedNo) {
    if (!lastCalc) return;
    if (saveLock) return;
    const series = seriesById(lastCalc.seriesId);
    if (!series) { toast('Serie eliminata: rifai la misura', 'warn'); newMeasure(); return; }
    if (lastCalc.savedId) { toast('Già salvato · tocca Nuova misura'); return; }
    if (lastCalc.selected == null) { toast('Scegli un pezzo'); return; }
    const acc = lastCalc.acc, n = lastCalc.selected;
    const st = pieceStatus(n, acc);
    if (st === 'no' && !confirmedNo) { askSaveNo(); return; }
    saveLock = true; setTimeout(() => { saveLock = false; }, 700);
    const gioco = giocoOf(n, acc);
    const L0 = limOf(series);
    const nf = series.forma === false;
    const status = (st === 'no' || (!nf && formStatus(lastCalc.con, L0.conOk, L0.conMax) === 'no') || (!nf && formStatus(lastCalc.oval, L0.ovalOk, L0.ovalMax) === 'no')) ? 'scarto' : 'buono'; // Beta 0.8.1: job limits
    const id = uid(), ts = new Date().toISOString();
    series.history = series.history || [];
    series.history.push({ id, ts, S: lastCalc.S, chosen: n, gioco: lastCalc.fixed ? lastCalc.fixed.gioco : gioco, fixedF: lastCalc.fixed ? lastCalc.fixed.F : undefined, oval: lastCalc.oval != null ? lastCalc.oval : null,
      snap: historySnap(series, lastCalc.giocoMin, lastCalc.giocoMax, calOf(machineById(lastCalc.machineId) || myMachine())),
      con: lastCalc.con, conEnd: lastCalc.con > 0 ? (lastCalc.conEnd || null) : null, status, lavoro: lastCalc.mode || 'maschio', machineId: lastCalc.machineId, machineName: (myMachine() || {}).name || '', jobId: prefs.jobId || null, meta: metaSnap() });
    if (series.history.length > HIST_MAX) series.history = series.history.slice(-HIST_MAX);
    const stockTaken = stockTake(series.stock, n); // Beta 0.2.0: only on Salva; Annulla gives it back (undoSave)
    state.turno = state.turno || { saves: [], note: '', startedAt: ts };
    state.turno.saves = state.turno.saves || [];
    const corrected = !!(lastCalc.corrDone && lastCalc.corr && !lastCalc.corr.none);
    const aj = activeJob();
    state.turno.saves.push({ id, ts, seriesId: series.id, seriesName: series.name, chosen: n, status,
      S: lastCalc.S, gioco, correction: corrected, jobId: prefs.jobId || null, lavoro: lastCalc.mode || 'maschio',
      machineName: (aj && aj.machineName) || (myMachine() || {}).name || '', meta: metaSnap() });
    captureJob(true);
    prefs.lastMeasureBySeries = prefs.lastMeasureBySeries || {};
    const prevLast = prefs.lastMeasureBySeries[series.id] || null;
    prefs.lastMeasureBySeries[series.id] = { S: lastCalc.S, ts };
    // v2.0.4: the male on the machine, for «Femmina già fatta → misura da fare»
    if (lastCalc.mode !== 'femmina') { prefs.lastMaschioBySeries = prefs.lastMaschioBySeries || {}; prefs.lastMaschioBySeries[series.id] = { S: lastCalc.S, day: todayKey() }; }
    savePrefs(prefs); saveData(state);
    lastCalc.savedId = id;
    // v1.9.7: snapshot of the result so «Annulla» can bring it back exactly as it was
    const prevHint = prefs.lastHint || null;
    prefs.lastHint = makeLastHint(lastCalc, n, id); savePrefs(prefs);
    lastSaveRec = { id, seriesId: series.id, chosen: n, stockTaken, prevLast, prevHint,
      calc: lastCalc, digits: measureDigits, prefix: manualPrefix };
    haptic(40);
    if (prefs.voiceAuto) speakIt('Salvato ' + n);
    // v1.9.7: straight to a fresh measure (cleared keypad, ovalità/conicità back to «non misurata»)
    newMeasure(); clearToast();
    renderFatti(); renderRiepilogo(); dressAfterSave(); // Beta 0.9.0: promemoria diamantatura
    showUndo(fmtSaveMsg(n, gioco, status));
    // Beta 0.9.2: promemoria ovalità/conicità after pairing save (skip Corpo/Spillo / forma === false)
    if (series.forma !== false) setTimeout(() => toast(formReminderTxt(series), 'warn'), 450);
  }

  function showUndo(msg, fn, kind) {
    const u = $('undoBar'); if (!u) return;
    undoFn = fn || null;
    u.innerHTML = `<span class="ub-ok">${kind === 'del' ? '🗑' : '✓'}</span><span class="ub-t">${esc(msg)}</span><button type="button" id="btnUndo">↶ Annulla</button>`;
    u.classList.toggle('scarto', /SCARTO/.test(msg)); u.classList.toggle('del', kind === 'del');
    u.classList.remove('hidden');
    placeUndo(); requestAnimationFrame(placeUndo);
    clearTimeout(undoTimer); undoTimer = setTimeout(hideUndo, 8000);
  }
  /** v2.0.8: on Calcolo the undo bar sits over the ULTIMO strip (same info), so Lavoro/Serie stay reachable. */
  function placeUndo() {
    const u = $('undoBar'), lh = $('lastHint'); if (!u) return;
    const onCalc = document.body.dataset.page === 'calc' && lh && !lh.classList.contains('hidden') && lh.getBoundingClientRect().height > 0;
    const pg = document.body.dataset.page, top = (pg === 'femmina' || pg === 'interno' || pg === 'quota') ? document.querySelector('#page-' + pg + ' .fm-top') : null;
    if (onCalc) { const r = lh.getBoundingClientRect(); u.style.top = Math.round(r.top) + 'px'; u.style.minHeight = Math.round(r.height) + 'px'; u.classList.add('ub-strip'); }
    else if (top && top.getBoundingClientRect().height > 0) { const r = top.getBoundingClientRect(); u.style.top = Math.round(r.top) + 'px'; u.style.minHeight = Math.round(r.height) + 'px'; u.style.maxHeight = Math.round(r.height) + 'px'; u.classList.add('ub-strip', 'ub-fm'); }
    else { u.style.top = ''; u.style.minHeight = ''; u.style.maxHeight = ''; u.classList.remove('ub-strip', 'ub-fm'); }
  }
  function hideUndo() { const u = $('undoBar'); if (u) u.classList.add('hidden'); clearTimeout(undoTimer); undoFn = null; }
  function doUndo() {
    if (!lastSaveRec) return hideUndo();
    const rec = lastSaveRec; lastSaveRec = null;
    const ok = undoSave(state, rec);
    if (ok) {
      prefs.lastMeasureBySeries = prefs.lastMeasureBySeries || {};
      if (rec.prevLast) prefs.lastMeasureBySeries[rec.seriesId] = rec.prevLast; else delete prefs.lastMeasureBySeries[rec.seriesId];
      if (prefs.lastHint && prefs.lastHint.saveId === rec.id) prefs.lastHint = rec.prevHint || null;
      savePrefs(prefs); saveData(state);
      if (lastCalc && lastCalc.savedId === rec.id) { lastCalc.savedId = null; savedFlash = false; renderResult(); }
      else if (!lastCalc && rec.calc && $('page-calc').classList.contains('active')) {
        // v1.9.7: still on the new-measure screen → bring back the previous result exactly as it was
        lastCalc = rec.calc; lastCalc.savedId = null; savedFlash = false;
        measureDigits = rec.digits || ''; manualPrefix = rec.prefix != null ? rec.prefix : null;
        if (prefs.seriesId !== lastCalc.seriesId && seriesById(lastCalc.seriesId)) setContext(null, lastCalc.seriesId, false);
        refreshDisplay(); showResultView(); renderResult();
      }
      renderRecent(); renderFatti(); renderRiepilogo(); toast('Salvataggio annullato');
    }
    hideUndo();
  }

  $('keypad').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k; haptic(12);
    if (k === 'GO') { doCalcFlow(); return; }
    if (k === 'AC') { measureDigits = ''; manualPrefix = null; pendingTypo = null; $('typoBox').classList.add('hidden'); refreshDisplay(); return; }
    if (k === 'BS') { measureDigits = measureDigits.slice(0, -1); refreshDisplay(); return; }
    if (k === ',') { if (!measureDigits.includes(',')) measureDigits += ','; refreshDisplay(); return; }
    if (measureDigits.length < 8) measureDigits += k; refreshDisplay();
  });
  document.addEventListener('click', (e) => {
    const id = e.target.id;
    if (id === 'typoOk' && pendingTypo) { runCalc(pendingTypo.value, pendingTypo.display); pendingTypo = null; $('typoBox').classList.add('hidden'); }
    if (id === 'typoRetype') { measureDigits = ''; manualPrefix = null; pendingTypo = null; $('typoBox').classList.add('hidden'); refreshDisplay(); }
    if (id === 'typoFix' && pendingTypo && pendingTypo.suggestion != null) {
      const sug = pendingTypo.suggestion;
      manualPrefix = Math.floor(sug + 1e-9);
      measureDigits = String(round4(sug)).split('.')[1] || '0'; pendingTypo = null; $('typoBox').classList.add('hidden');
      refreshDisplay(); runCalc(sug, fmtMmS(sug));
    }
    if (id === 'vaOk') $('vaBeneBox').classList.add('hidden');
    if (id === 'vaNo' && lastCalc) {
      const pv = e.target.dataset.prev; lastCalc.selected = pv === '' ? null : parseInt(pv, 10);
      $('vaBeneBox').classList.add('hidden'); renderResult();
    }
    if (id === 'btnUndo') { if (undoFn) { const f = undoFn; hideUndo(); f(); return; } doUndo(); return; }
    const pick = e.target.closest('[data-pick]'); if (pick && lastCalc) selectPiece(parseInt(pick.dataset.pick, 10));
    if (id === 'btnStockOpen' || e.target.closest('#btnStockOpen')) { openStockEditor(); return; }
    const want = e.target.closest('[data-want]');
    if (want && lastCalc && !lastCalc.savedId) { lastCalc.wantPezzo = parseInt(want.dataset.want, 10); updateCorr(); renderResult(); haptic(15); toast('Correzione verso il pezzo ' + want.dataset.want + ' · è una previsione: rimisura dopo'); }
    const reuse = e.target.closest('[data-reuse]');
    if (reuse) { const S = parseFloat(reuse.dataset.reuse); if (!Number.isNaN(S)) { manualPrefix = Math.floor(S + 1e-9); measureDigits = String(round4(S)).split('.')[1] || '0'; refreshDisplay(); runCalc(S, fmtMmS(S)); } }
  });
  document.querySelectorAll('.lav-seg [data-lav]').forEach((b) => b.addEventListener('click', () => {
    haptic(15); const m = b.dataset.lav; if (m === lavoroMode()) return;
    setLavoro(m); toast(m === 'femmina' ? 'Femmina già fatta: scrivi F → misura da fare del maschio' : 'Maschio: scrivi S → femmina da accoppiare');
  }));
  $('measurePrefix').addEventListener('click', (e) => { e.stopPropagation(); $('prefixMenu').classList.toggle('open'); });
  $('prefixMenu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pref]'); if (!b) return;
    manualPrefix = null;
    prefs.stickyPrefix = setStickyPrefix(prefs.stickyPrefix, prefixCtx(), parseInt(b.dataset.pref, 10)); savePrefs(prefs);
    $('prefixMenu').classList.remove('open'); refreshDisplay();
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('#measurePrefix') && !e.target.closest('#prefixMenu')) $('prefixMenu').classList.remove('open'); });
  $('btnRimisura').addEventListener('click', () => { hideUndo(); showInputView(); });
  $('btnNuova').addEventListener('click', () => { hideUndo(); newMeasure(); });
  $('btnSalva').addEventListener('click', () => saveCurrent(false));
  [['dav', 'conDav'], ['fondo', 'conFondo']].forEach(([side, id]) => {
    const step = (d) => {
      if (!lastCalc) return; haptic(12);
      const before = lastCalc.conEnd;
      applyTaper(taperStep(taperSides(), side, d)); renderResult();
      if (prefs.voiceAuto && lastCalc.conEnd && lastCalc.conEnd !== before) {
        const mm = myMachine(); const th = taperHint(lastCalc.con, lastCalc.conEnd, Object.assign({ studer: isStuder(mm), k: knobK(mm), always: true }, taperOpts(mm)));
        if (th.turn) speakIt(th.hint.replace('→', ','));
      }
    };
    $(id + 'Minus').addEventListener('click', () => step(-1));
    $(id + 'Plus').addEventListener('click', () => step(1));
    $(id + 'Val').addEventListener('click', () => { if (!lastCalc) return; if (lastCalc.con == null) { applyTaper(taperTouch(taperSides())); haptic(15); renderResult(); } });
  });
  $('formBox').addEventListener('click', (e) => {
    const cb = e.target.closest('[data-calib]');
    if (cb && lastCalc) { e.preventDefault(); openCalib(myMachine().id); return; }
  });
  $('corrCard').addEventListener('click', (e) => {
    if (!lastCalc) return;
    if (e.target.closest('#corrDone')) { lastCalc.corrDone = !lastCalc.corrDone; haptic(20); renderResult(); return; }
    // Beta 0.2.2 (= OmT 2.0.9): no tap-to-cycle (stray taps moved the target 4→5→6→7). The body opens the «Altro pezzo» picker.
    openHintPicker(lastCalc, lastCalc.corrWant, lastCalc.corrWant, (n) => { lastCalc.hintExtra = n; lastCalc.wantPezzo = n; lastCalc.corrDone = false; updateCorr(); renderResult(); });
  });
  $('btnOfficina').addEventListener('click', () => {
    if (!lastCalc) return;
    const v = $('officinaView'), pst = pieceStatus(lastCalc.selected, lastCalc.acc);
    const conSt = conStatus(lastCalc);
    const st = worstStatus(pst, conSt);
    v.className = 'officina ' + (st === 'ok' || st === 'na' ? 'ok' : st === 'lim' ? 'lim' : 'no');
    const sel = lastCalc.selected;
    const g = sel != null ? giocoOf(sel, lastCalc.acc) : null;
    const forma = [];
    if (conSt === 'lim' || conSt === 'no') {
      const mm = myMachine();
      const th = taperHint(lastCalc.con, lastCalc.conEnd, Object.assign({ studer: isStuder(mm), k: knobK(mm), always: true }, taperOpts(mm)));
      const verso = th.turn ? (th.turn === 'verso' ? 'verso\u00a0di\u00a0te' : "dall'altra\u00a0parte") : '';
      let line = 'Conicità ' + fmtUm(lastCalc.con) + ' µm' + (lastCalc.conEnd ? ' (più grande ' + TAPER_SIDE_LBL[lastCalc.conEnd] + ')' : '');
      if (th.tacche != null && th.tacche > 0) line += ' · gira ~' + th.taccheText + (verso ? ' ' + verso : '');
      else if (th.tacche === 0) line += ' · gira pochissimo' + (verso ? ' ' + verso : '');
      else if (verso) line += ' · manopola ' + verso;
      forma.push(line);
    }
    const accTxt = sel == null ? 'Nessun pezzo valido' : 'gioco ' + fmtUm(g) + ' µm · ' + (pst === 'ok' ? 'ACCOPPIAMENTO OK' : pst === 'lim' ? 'AL LIMITE' : 'FUORI GIOCO');
    const na = conSt === 'na' && (seriesById(lastCalc.seriesId) || {}).forma !== false ? '<div class="sub" style="font-size:19px;margin-top:14px">Conicità non misurata: misurala (l\'ovalità si controlla dopo)</div>' : '';
    const serO = seriesById(lastCalc.seriesId), gcO = serO ? calcGioco(lastCalc, serO) : null;
    const mO = gcO ? matingRange(lastCalc.S, gcO.min, gcO.max, lastCalc.mode) : null;
    const femO = lastCalc.mode === 'femmina';
    const matO = mO ? (femO
      ? `<div class="sub of-fh">Femmina già fatta ${fmtMm4(lastCalc.S)} → misura da fare (maschio)</div><div class="big cond of-fc">${fmtMm4(mO.centro)}</div><div class="sub of-mt cond">Maschio da ${fmtMm4(mO.min)} a ${fmtMm4(mO.max)} mm</div>`
      : `<div class="sub of-mt cond">Femmina da ${fmtMm4(mO.min)} a ${fmtMm4(mO.max)} mm</div><div class="sub of-mc">centro ${fmtMm4(mO.centro)} mm</div>`) : '';
    const ftO = femO && lastCalc.femTarget && lastCalc.femTarget.S != null ? lastCalc.femTarget : null;
    const ftLine = ftO ? `<div class="sub of-fcorr cond">${ftO.none ? '✓ maschio già al centro' : `Maschio ora ${fmtMm4(ftO.S)}: ${esc(corrWords(ftO.diffUm, ftO.presses, ftO.key, ftO.none, ftO.valTxt).text)}`}</div>` : '';
    v.innerHTML = femO
      ? `${matO}${ftLine}<div class="sub" style="margin-top:10px">pezzo maschio <b>${sel == null ? '—' : esc(String(sel))}</b> · ${esc(accTxt)}</div>`
      : `<div class="big cond">${sel == null ? '—' : esc(String(sel))}</div><div class="sub">${esc(accTxt)}</div>${matO}${(() => { const c = lastCalc.corr; if (!c) return ''; const w = corrWords(c.diffUm, c.presses, c.key, c.none, c.valTxt);
        return `<div class="sub of-corr cond">${c.none ? '✓ Pezzo ' + esc(String(lastCalc.corrWant)) + ' al centro: nessuna correzione' : 'Pezzo ' + esc(String(lastCalc.corrWant)) + ': misura ' + esc(w.text)}</div>`; })()}`;
    v.innerHTML += `
      ${forma.length ? `<div class="sub" style="font-size:24px;margin-top:16px;font-weight:800">⚠ CONTROLLA CONICITÀ</div><div class="sub" style="font-size:19px;margin-top:4px">${forma.map(esc).join('<br/>')}</div>` : ''}${na}
      <div style="margin-top:24px;font-weight:700;opacity:.8">Tocca per chiudere</div>`;
    v.classList.remove('hidden'); setKeepScreen(true);
  });
  $('officinaView').addEventListener('click', () => { $('officinaView').classList.add('hidden'); setKeepScreen(false); });


  // v1.9.4: Serie pill → quick sheet (switch series + edit quote). No machine list any more.
  function openSeriesSheet() {
    const { series: cur } = currentContext();
    const items = state.series.map((s) =>
      `<div class="sheet-item ${cur && cur.id === s.id ? 'on' : ''}" data-ctx-s="${esc(s.id)}">
        <div class="mc cond">${esc(fmtMm3(s.base))}</div>
        <div style="flex:1"><b>Base ${fmtMm3(s.base)}${s.lotto ? ' · ' + esc(s.lotto) : ''}</b><div class="meta">gioco ${s.giocoMin}–${s.giocoMax} µm · tol ±${esc(fmtMm3(seriesTol(s)))}</div></div>
        ${cur && cur.id === s.id ? '<span class="sheet-on">IN USO</span>' : ''}</div>`).join('') || '<div class="empty">Nessuna serie</div>';
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal"><h2>Serie</h2>
      ${cur ? `<button type="button" class="btn btn-primary" id="sheetEditQuote" style="width:100%;margin-bottom:12px">✎ Modifica quote Base ${esc(fmtMm3(cur.base))}</button>` : ''}
      ${items}
      <div class="actions" style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn btn-sec" id="sheetNew" style="flex:1">+ Nuova serie</button>
      <button type="button" class="btn btn-sec" id="sheetClose" style="flex:1">Chiudi</button></div></div></div>`;
    $('sheetClose').onclick = () => { $('modalRoot').innerHTML = ''; };
    $('sheetNew').onclick = () => openSeriesModal(null);
    if ($('sheetEditQuote')) $('sheetEditQuote').onclick = () => openSeriesModal(cur.id);
    $('modalBg').onclick = (ev) => { if (ev.target.id === 'modalBg') $('modalRoot').innerHTML = ''; };
    $('modalRoot').querySelectorAll('[data-ctx-s]').forEach((el) => {
      el.onclick = () => {
        setContext(null, el.dataset.ctxS, true);
        $('modalRoot').innerHTML = ''; newMeasure();
      };
    });
  }
  const openContextSheet = openSeriesSheet;
  // v1.9.4: Macchina pill → rename "la mia macchina" (e.g. "S33 O060" at the start of the shift)
  function openMachineDialog() {
    const m = myMachine(); if (!m) return;
    const { series } = currentContext();
    const k = knobK(m);
    const recent = (prefs.recentMachineNames || []).filter((n) => n && n !== m.name).slice(0, 3);
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal mach-dialog">
      <h2>La mia macchina</h2>
      <label for="mdName">Nome (scrivilo a inizio turno)</label>
      <input id="mdName" class="big-input cond" value="${esc(m.name)}" maxlength="40" autocomplete="off" placeholder="es. S33 O060"/>
      ${machineChipsHtml(recent)}
      <button type="button" class="knob-row ${k == null ? 'unk' : ''}" id="mdCalib"><span class="ci">⟲</span><span class="kr-t">Manopola conicità<small>${k == null ? 'Non tarata · tocca per la taratura' : esc(fmtK(k)) + ' µm per tacca'}</small></span><span class="chev">›</span></button>
      ${series ? `<button type="button" class="knob-row" id="mdQuote"><span class="ci">✎</span><span class="kr-t">Quote serie in uso<small>Base ${esc(fmtMm3(series.base))} · gioco ${series.giocoMin}–${series.giocoMax} µm · tol ±${esc(fmtMm3(seriesTol(series)))}</small></span><span class="chev">›</span></button>` : ''}
      ${(() => { const c = machineCal(m); const sel = (a, b) => (a === b ? 'selected' : '');
        return `<div class="cal-box ${c.stato === 'verificata' ? 'ok' : 'unver'}" id="mdCal"><div class="cal-h">Taratura macchina <span class="cal-st" id="mdCalSt">${c.stato === 'verificata' ? '✓ verificata' : '⚠ da verificare'}</span></div>
        <label>Preimpostazioni</label><div class="md-pre" id="mdPre"><button type="button" data-pre="studer_o061">Studer O061<small>+ stringe · tocchi</small></button><button type="button" data-pre="studer_favorit">Studer favorit CNC<small>+ allarga · valore in mm</small></button></div>
        <label for="mdModo">Come scrivi la correzione</label><select id="mdModo"><option value="tocchi" ${sel(c.modo, 'tocchi')}>tocchi (tasti + / −)</option><option value="valore" ${sel(c.modo, 'valore')}>valore diretto in mm (es. −0.004)</option></select>
        <p class="meta md-note" id="mdNote">${esc(calNote(c))}</p>
        <label for="mdRule">Tasto + sul diametro esterno (maschio)</label><select id="mdRule">
          <option value="studer" ${sel(c.outer, 'stringe')}>+ stringe (diametro più piccolo) · − allarga</option>
          <option value="plus_bigger" ${sel(c.outer, 'allarga')}>+ allarga (diametro più grande) · − stringe</option></select>
        <label for="mdBore">Tasto + sul foro (interno)</label><select id="mdBore">
          <option value="stringe" ${sel(c.bore, 'stringe')}>+ stringe il foro · − allarga</option>
          <option value="allarga" ${sel(c.bore, 'allarga')}>+ allarga il foro · − stringe</option></select>
        <div class="field-row"><div><label for="mdUm">µm per tocco <small>(solo modo tocchi)</small></label><input id="mdUm" inputmode="decimal" value="${esc(fmtUm(c.umPerTocco))}"/></div>
        <div><label for="mdScala">Il tocco / valore vale sul</label><select id="mdScala"><option value="diametro" ${sel(c.scala, 'diametro')}>diametro</option><option value="raggio" ${sel(c.scala, 'raggio')}>raggio (per lato)</option></select></div></div>
        <label for="mdTaper">Manopola conicità</label><select id="mdTaper"><option value="normale" ${sel(c.taper, 'normale')}>verso normale (come in Guida)</option><option value="invertito" ${sel(c.taper, 'invertito')}>verso invertito</option></select>
        <label for="mdStato">Stato</label><select id="mdStato"><option value="da_verificare" ${sel(c.stato, 'da_verificare')}>da verificare</option><option value="verificata" ${sel(c.stato, 'verificata')}>verificata sul primo pezzo</option></select>
        <p class="meta">Finché è «da verificare» l'app scrive la correzione anche a parole (diametro da ridurre / aumentare) con un avviso.</p></div>`; })()}
      <div id="mdErr" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-sec" id="mdCancel" style="flex:1">Annulla</button>
      <button type="button" class="btn btn-primary" id="mdSave" style="flex:1.4">✓ Salva</button></div></div></div>`;
    const inp = $('mdName');
    setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) {} }, 60);
    const save = () => {
      const name = inp.value.replace(/\s+/g, ' ').trim();
      if (!name) { $('mdErr').textContent = 'Scrivi il nome della macchina'; $('mdErr').classList.remove('hidden'); return false; }
      const old = m.name;
      m.name = name;
      const umv = Number(String($('mdUm').value).replace(',', '.'));
      if (!(umv > 0 && umv <= 50)) { $('mdErr').textContent = 'µm per tocco non valido (es. 1)'; $('mdErr').classList.remove('hidden'); return false; }
      m.cal = { outer: $('mdRule').value === 'plus_bigger' ? 'allarga' : 'stringe', bore: $('mdBore').value, umPerTocco: umv, scala: $('mdScala').value, taper: $('mdTaper').value, stato: $('mdStato').value, modo: $('mdModo').value === 'valore' ? 'valore' : 'tocchi' };
      const rr = calRules(machineCal(m)); m.rule = rr.rule; m.internoRule = rr.internoRule;
      if (old !== name) { const kn = knobForMachineName(state, name); if (kn) m.knob = kn; } // v1.9.6: knob k follows the machine name
      if (old !== name) { prefs.recentMachineNames = [old].concat((prefs.recentMachineNames || []).filter((n) => n !== old && n !== name)).slice(0, 5); savePrefs(prefs); }
      saveData(state); updateChip();
      if ($('page-setup').classList.contains('active')) fillSetupSelects();
      return true;
    };
    $('mdSave').onclick = () => { if (save()) { $('modalRoot').innerHTML = ''; toast('Macchina: ' + m.name); } };
    // Beta 0.9.3: presets + live note from the calibration fields
    const formCal = () => machineCal({ cal: { outer: $('mdRule').value === 'plus_bigger' ? 'allarga' : 'stringe', bore: $('mdBore').value, umPerTocco: Number(String($('mdUm').value).replace(',', '.')), scala: $('mdScala').value, taper: $('mdTaper').value, stato: $('mdStato').value, modo: $('mdModo').value } });
    const upNote = () => { const c = formCal(); $('mdNote').textContent = calNote(c); $('mdCalSt').textContent = c.stato === 'verificata' ? '✓ verificata' : '⚠ da verificare'; $('mdCal').classList.toggle('ok', c.stato === 'verificata'); $('mdCal').classList.toggle('unver', c.stato !== 'verificata'); };
    ['mdRule', 'mdBore', 'mdUm', 'mdScala', 'mdTaper', 'mdStato', 'mdModo'].forEach((id) => { $(id).addEventListener('change', upNote); $(id).addEventListener('input', upNote); });
    $('mdPre').querySelectorAll('[data-pre]').forEach((b) => { b.onclick = () => { haptic(12); const p = MACHINE_PRESETS[b.dataset.pre]; if (!p) return; const c = p.cal;
      $('mdRule').value = c.outer === 'allarga' ? 'plus_bigger' : 'studer'; $('mdBore').value = c.bore; $('mdUm').value = fmtUm(c.umPerTocco); $('mdScala').value = c.scala; $('mdTaper').value = c.taper; $('mdStato').value = 'da_verificare'; $('mdModo').value = c.modo;
      if (!inp.value.trim() || /^studer/i.test(inp.value.trim())) inp.value = p.name; upNote(); toast(p.name + ': controlla sul primo pezzo'); }; });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('mdSave').click(); } });
    $('mdCancel').onclick = () => { $('modalRoot').innerHTML = ''; };
    $('modalBg').onclick = (ev) => { if (ev.target.id === 'modalBg') $('modalRoot').innerHTML = ''; };
    $('modalRoot').querySelectorAll('[data-mname]').forEach((b) => { b.onclick = () => { inp.value = b.dataset.mname; }; });
    wireMachineChips(openMachineDialog);
    $('mdCalib').onclick = () => { if (inp.value.trim() && inp.value.trim() !== m.name) save(); openCalib(m.id); };
    if ($('mdQuote')) $('mdQuote').onclick = () => { if (inp.value.trim() && inp.value.trim() !== m.name) save(); openSeriesModal(series.id); };
  }
  $('pillMach').addEventListener('click', (e) => { e.stopPropagation(); openMachineDialog(); });
  $('btnSpeak').addEventListener('click', () => { if (!lastCalc) return; const n = lastCalc.selected; const c = lastCalc.corr;
    speakIt('Pezzo ' + (n != null ? n : '') + (c && !c.none && c.valTxt ? ', inserisci ' + (c.valTxt[0] === '−' ? 'meno ' : 'più ') + c.valTxt.slice(1).replace('.', ' virgola ') : c && !c.none && c.key ? ', correzione ' + (c.key === '+' ? 'più' : 'meno') + ' ' + c.presses : '')); });
  addEventListener('resize', () => fitPads());
  $('pillSerie').addEventListener('click', (e) => { e.stopPropagation(); openSeriesSheet(); });
  $('btnVoice').addEventListener('click', (e) => {
    e.stopPropagation(); prefs.voiceAuto = !prefs.voiceAuto; savePrefs(prefs);
    toast(prefs.voiceAuto ? 'Voce automatica ON' : 'Voce automatica OFF'); updateVoiceBtn();
  });
  function updateVoiceBtn() {
    const on = !!prefs.voiceAuto;
    if ($('btnVoice')) $('btnVoice').style.color = on ? 'var(--orange)' : '';
    const lab = $('voiceLabel'); if (lab) lab.textContent = on ? 'On' : 'Off';
    const tog = $('voiceToggle'); if (tog) tog.classList.toggle('on', on);
  }
  $('nav').addEventListener('click', (e) => { const b = e.target.closest('.nv'); if (b) showPage(b.dataset.page); });
  function applyTheme() {
    const t = prefs.theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    const lab = $('themeLabel'); if (lab) lab.textContent = t === 'light' ? 'Chiaro' : 'Scuro';
  }
  $('btnTheme').addEventListener('click', () => { prefs.theme = prefs.theme === 'light' ? 'dark' : 'light'; savePrefs(prefs); applyTheme(); });
  function updateSplashBtn() { const on = prefs.splash !== false; $('splashLabel').textContent = on ? 'On' : 'Off'; $('splashToggle').classList.toggle('on', on); }
  $('btnSplash').addEventListener('click', () => { prefs.splash = prefs.splash === false; savePrefs(prefs); updateSplashBtn(); toast(prefs.splash ? 'Logo all\'avvio ON' : 'Logo all\'avvio OFF'); });
  updateSplashBtn();
  $('btnVoiceAuto').addEventListener('click', () => { prefs.voiceAuto = !prefs.voiceAuto; savePrefs(prefs); updateVoiceBtn(); toast(prefs.voiceAuto ? 'Voce automatica ON' : 'Voce automatica OFF'); });

  function fillSetupSelects() {
    const sm = $('selMachine'), ss = $('selSeries'), { machine, series } = currentContext();
    sm.innerHTML = machine ? `<option value="${esc(machine.id)}">${esc(machine.name)}</option>` : '';
    fillSeriesSelect(ss, null, series && series.id); updateSeriesInfo();
    const ml = $('machLabel'); if (ml) ml.textContent = machine ? machine.name : '—';
  }
  function fillSeriesSelect(sel, machineId, keepId) {
    const list = state.series;
    sel.innerHTML = list.map((s) => `<option value="${esc(s.id)}">Base ${fmtMm3(s.base)}${s.lotto ? ' · ' + esc(s.lotto) : ''}</option>`).join('') || '<option value="">—</option>';
    if (keepId && list.some((s) => s.id === keepId)) sel.value = keepId;
  }
  function updateSeriesInfo() {
    const s = seriesById($('selSeries').value);
    if (!s) { $('seriesInfo').textContent = ''; return; }
    $('seriesInfo').textContent = `Base ${fmtMm3(s.base)} · gioco ${s.giocoMin}–${s.giocoMax} µm · tol ±${fmtMm3(seriesTol(s))}`;
  }
  $('selSeries').addEventListener('change', updateSeriesInfo);
  $('btnUseContext').addEventListener('click', () => { if (!$('selSeries').value) { toast('Nessuna serie'); return; } setContext(null, $('selSeries').value, true); showPage('calc'); newMeasure(); });
  $('btnGoMachines').addEventListener('click', () => openMachineDialog());
  $('btnGoSeries').addEventListener('click', () => showPage('serie'));
  $('btnBackSetup1').addEventListener('click', () => showPage('setup'));
  $('btnBackSetup2').addEventListener('click', () => showPage('setup'));
  $('btnBackTrain').addEventListener('click', () => showPage('setup'));
  let guidaFrom = 'setup';
  function openGuida(from) { guidaFrom = from || 'setup'; showPage('guida'); }
  $('btnGuida').addEventListener('click', () => openGuida('setup'));
  $('btnHelp').addEventListener('click', () => openGuida('calc'));
  $('btnBackGuida').addEventListener('click', () => showPage(guidaFrom));
  $('btnAllenamento').addEventListener('click', () => { showPage('train'); newTrainQ(); });

  // Old machine list page: kept (not linked) — single machine, no delete.
  function renderMachines() {
    $('machineList').innerHTML = state.machines.map((m) => { const k = knobK(m);
      return `<div class="item"><h3 style="font-size:1.1rem">${esc(m.name)}</h3><div class="meta">${esc(calNote(machineCal(m)))}${userNote(m) ? ' · ' + esc(userNote(m)) : ''}</div>
      <button type="button" class="knob-row ${k == null ? 'unk' : ''}" data-calib-m="${esc(m.id)}"><span class="ci">⟲</span>
        <span class="kr-t">Manopola conicità<small>${k == null ? 'Non tarata · tocca per la taratura' : esc(fmtK(k)) + ' µm per tacca'}</small></span><span class="chev">›</span></button>
      <div class="actions"><button type="button" class="btn btn-sec" data-edit-m="${esc(m.id)}" style="flex:1">Rinomina</button></div></div>`; }).join('') || '<div class="empty">Nessuna</div>';
  }
  $('machineList').addEventListener('click', (e) => {
    const cm = e.target.closest('[data-calib-m]'); if (cm) { openCalib(cm.dataset.calibM); return; }
    if (e.target.closest('[data-edit-m]')) openMachineDialog();
  });
  $('btnAddMachine').addEventListener('click', () => openMachineDialog());

  // ---- v1.9.3: Taratura manopola conicità (guidata) ----
  let calib = null;
  function openCalib(machineId) {
    const m = machineById(machineId); if (!m) return;
    const kn = ensureKnob(m);
    calib = { machineId, t0: 0, end0: 'fondo', n: 1, t1: 0, end1: 'fondo', trials: kn.trials.map((t) => Object.assign({}, t)),
      L0: kn.L0 != null ? kn.L0 : '', typed: '', dirty: false };
    renderCalib();
  }
  function calibStepper(key, val, unit) {
    return `<div class="stp cond cstp"><button type="button" class="b" data-cs="${key}" data-d="-1">−</button>
      <div class="v">${esc(String(val).replace('.', ','))} <small>${unit}</small></div>
      <button type="button" class="b" data-cs="${key}" data-d="1">+</button></div>`;
  }
  function calibSeg(key, val) {
    return `<div class="seg cond cseg"><button type="button" data-ce="${key}" data-v="davanti" class="${val === 'davanti' ? 'on' : ''}">Più grande<small>DAVANTI</small></button>
      <button type="button" data-ce="${key}" data-v="fondo" class="${val === 'fondo' ? 'on' : ''}">Più grande<small>IN FONDO</small></button></div>`;
  }
  function renderCalib() {
    if (!calib) return;
    const m = machineById(calib.machineId); if (!m) { calib = null; return; }
    const kNow = knobK(m);
    const tr = knobTrialK(calib);
    const avg = calibrateKnob(calib.trials.concat(tr.ok && !calib.justAdded ? [calib] : []));
    const trialsHtml = calib.trials.length ? calib.trials.map((t, i) => { const r = knobTrialK(t);
      return `<div class="ctrial"><span class="mono">#${i + 1}</span><span>${esc(fmtUm(t.t0))}${t.end0 === 'davanti' ? ' dav.' : ' fondo'} → ${esc(fmtUm(t.t1))}${t.end1 === 'davanti' ? ' dav.' : ' fondo'} · ${esc(String(t.n).replace('.', ','))} t.</span>
        <b class="mono">${r.ok ? esc(fmtK(r.k)) + ' µm/t' : '—'}</b><button type="button" class="cdel" data-cdel="${i}" aria-label="Elimina">×</button></div>`; }).join('') : '';
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal calib" id="calibModal">
      <div class="calib-hd"><div class="kn big"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 4v6"/></svg></div>
        <div><h2 style="margin:0">Taratura manopola conicità</h2><div class="meta">${esc(m.name)} · ${kNow == null ? '<span style="color:var(--amber)">non tarata</span>' : '<b style="color:var(--orange)">' + esc(fmtK(kNow)) + ' µm per tacca</b>'}</div></div></div>
      <div class="rem" style="margin:8px 0 4px">Serve a sapere quanti µm di conicità toglie una tacca. Non esiste un valore ufficiale: lo misuriamo sulla tua macchina. Tocca +/− per 1 µm, tieni premuto per ½ µm.</div>

      <div class="cstep"><div class="cn">1</div><div class="cb"><div class="ct">Misura la conicità di partenza <b>T0</b></div>
        ${calibStepper('t0', calib.t0, 'µm')}${calibSeg('end0', calib.end0)}</div></div>
      <div class="cstep"><div class="cn">2</div><div class="cb"><div class="ct">Gira la manopola di <b>N</b> tacche</div>
        ${calibStepper('n', calib.n, 'tacche')}
        <div class="rem">Arriva <b>sempre dallo stesso lato</b> (la manopola ha gioco): se superi, torna indietro oltre e riavvicinati. Ricorda da che parte hai girato.</div></div></div>
      <div class="cstep"><div class="cn">3</div><div class="cb"><div class="ct">Rettifica un pezzo e misura <b>T1</b></div>
        ${calibStepper('t1', calib.t1, 'µm')}${calibSeg('end1', calib.end1)}</div></div>
      <div class="cstep last"><div class="cn">4</div><div class="cb"><div class="ct">Risultato</div>
        <div class="cres ${tr.ok ? 'ok' : ''}"><span class="mono">k = |T1 − T0| ÷ N</span>
          <b class="cond">${tr.ok && !calib.justAdded ? esc(fmtK(tr.k)) + ' <small>µm/tacca</small>' : '—'}</b>
          <div class="meta">${calib.justAdded ? 'Prova ' + calib.trials.length + ' aggiunta ✓ Per un\'altra: T0 è la misura appena fatta, gira ancora e misura T1.' : tr.ok ? esc(fmtUm(tr.delta)) + ' µm ÷ ' + esc(String(calib.n).replace('.', ',')) + ' = ' + esc(fmtK(tr.k)) : esc(tr.error)}</div></div>
        <button type="button" class="btn btn-sec" id="cAdd" style="width:100%;margin-top:8px" ${tr.ok && !calib.justAdded ? '' : 'disabled'}>+ Aggiungi prova</button></div></div>

      ${calib.trials.length ? `<div class="ctrials"><div class="lbl" style="margin-bottom:6px"><span>Prove</span><span style="text-transform:none;letter-spacing:0;color:var(--orange)">media ${avg.k != null ? esc(fmtK(avg.k)) + ' µm/tacca' : '—'}</span></div>${trialsHtml}
        ${avg.warn ? '<div class="rem" style="color:var(--amber)">⚠ Le prove sono molto diverse tra loro: fanne un\'altra, sempre dallo stesso lato.</div>' : ''}
        ${avg.count < 2 ? '<div class="rem">Consiglio: ripeti 2–3 volte e usa la media.</div>' : ''}</div>` : ''}
      <button type="button" class="btn btn-primary" id="cSaveAvg" style="width:100%;margin-top:10px" ${avg.k != null ? '' : 'disabled'}>✓ Salva ${avg.k != null ? esc(fmtK(avg.k)) + ' µm per tacca' : '(inserisci T0, N e T1)'}</button>

      <div class="cdiv">oppure</div>
      <label>Sai già quanto vale una tacca? (µm)</label>
      <div style="display:flex;gap:8px"><input id="cTyped" inputmode="decimal" placeholder="es. 1,5" value="${esc(calib.typed)}" style="flex:1"/>
        <button type="button" class="btn btn-sec" id="cSaveTyped">Usa</button></div>
      <label>Lunghezza su cui misuri la conicità (mm, facoltativo)</label>
      <input id="cL0" inputmode="decimal" placeholder="es. 30" value="${esc(String(calib.L0).replace('.', ','))}"/>
      <div class="actions" style="margin-top:12px">
        ${kNow != null ? '<button type="button" class="btn btn-danger" id="cClear" style="flex:1">Cancella taratura</button>' : ''}
        <button type="button" class="btn btn-sec" id="cClose" style="flex:1">Chiudi</button></div>
    </div></div>`;
    const modal = $('calibModal');
    modal.addEventListener('click', onCalibClick);
    $('cTyped').addEventListener('input', (e) => { calib.typed = e.target.value; });
    $('cL0').addEventListener('input', (e) => { calib.L0 = e.target.value; });
  }
  function readL0() {
    const v = Number(String(calib.L0 == null ? '' : calib.L0).trim().replace(',', '.'));
    return Number.isFinite(v) && v > 0 && v < 2000 ? v : null;
  }
  function saveKnob(k, source) {
    const m = machineById(calib.machineId); if (!m) return;
    const kn = ensureKnob(m);
    kn.k = k; kn.source = source; kn.L0 = readL0(); kn.trials = calib.trials.slice(); kn.updatedAt = new Date().toISOString();
    saveData(state); closeCalib();
    toast(m.name + ': ' + fmtK(k) + ' µm per tacca', 'ok');
  }
  function closeCalib() {
    calib = null; $('modalRoot').innerHTML = '';
    if (lastCalc) renderFormBox();
    if ($('page-macchine').classList.contains('active')) renderMachines();
  }
  function onCalibClick(e) {
    const st = e.target.closest('[data-cs]');
    if (st) { if (calibLongDone) { calibLongDone = false; return; }
      stepCalib(st.dataset.cs, Number(st.dataset.d), false); return; }
    const se = e.target.closest('[data-ce]');
    if (se) { haptic(10); calib[se.dataset.ce] = se.dataset.v; calib.justAdded = false; renderCalibKeepScroll(); return; }
    const del = e.target.closest('[data-cdel]');
    if (del) { calib.trials.splice(Number(del.dataset.cdel), 1); renderCalibKeepScroll(); return; }
    const id = e.target.id;
    if (id === 'cAdd') { const r = knobTrialK(calib); if (!r.ok) return toast(r.error);
      calib.trials.push({ t0: calib.t0, end0: calib.end0, n: calib.n, t1: calib.t1, end1: calib.end1, at: new Date().toISOString() });
      // la prossima prova parte dalla misura appena fatta
      calib.t0 = calib.t1; calib.end0 = calib.end1; calib.justAdded = true; haptic(20); renderCalibKeepScroll(); toast('Prova ' + calib.trials.length + ': ' + fmtK(r.k) + ' µm/tacca'); return; }
    if (id === 'cSaveAvg') {
      // v1.9.4: a valid trial on screen counts even without "Aggiungi prova"
      const cur = knobTrialK(calib);
      if (cur.ok && !calib.justAdded) calib.trials.push({ t0: calib.t0, end0: calib.end0, n: calib.n, t1: calib.t1, end1: calib.end1, at: new Date().toISOString() });
      const a = calibrateKnob(calib.trials); if (a.k != null) saveKnob(a.k, 'prove'); return; }
    if (id === 'cSaveTyped') { const k = parseKnobK(calib.typed); if (k == null) return toast('Scrivi un numero tra 0,05 e 50 µm'); saveKnob(k, 'manuale'); return; }
    if (id === 'cClear') {
      const mid = calib.machineId, keep = calib;
      askBig({ title: 'Cancellare la taratura della manopola?', html: '<p class="meta">Le prove e il valore µm/tacca di questa macchina vengono tolti.</p>', ok: '🗑 Cancella taratura', danger: true }).then((yes) => {
        if (!yes) { calib = keep; renderCalib(); return; }
        const m = machineById(mid); const kn = ensureKnob(m); kn.k = null; kn.trials = []; kn.source = null; kn.updatedAt = new Date().toISOString();
        saveData(state); closeCalib(); toast('Taratura cancellata'); });
      return; }
    if (id === 'cClose') { closeCalib(); }
  }
  // v1.9.4: tap = 1 µm (N: ½ tacca), long-press = ½ µm fine step
  let calibLongDone = false, calibLongTimer = null;
  function stepCalib(key, d, fine) {
    haptic(10);
    if (key === 'n') calib.n = Math.min(20, Math.max(0.5, calib.n + d * 0.5));
    else calib[key] = Math.min(30, Math.max(0, Math.round((calib[key] + d * (fine ? 0.5 : 1)) * 10) / 10));
    calib.justAdded = false; renderCalibKeepScroll();
  }
  document.addEventListener('pointerdown', (e) => {
    const st = e.target.closest && e.target.closest('#calibModal [data-cs]'); if (!st || st.dataset.cs === 'n') return;
    clearTimeout(calibLongTimer); calibLongDone = false;
    const key = st.dataset.cs, d = Number(st.dataset.d);
    calibLongTimer = setTimeout(() => { calibLongDone = true; stepCalib(key, d, true); toast('½ µm'); }, 500);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => document.addEventListener(ev, () => clearTimeout(calibLongTimer)));
  function renderCalibKeepScroll() {
    const md = $('calibModal'); const y = md ? md.scrollTop : 0;
    renderCalib(); const md2 = $('calibModal'); if (md2) md2.scrollTop = y;
  }
  function renderSeries() {
    const fm = $('filterMachineSerie'); if (fm) fm.classList.add('hidden');
    const list = state.series; const { series: cur } = currentContext();
    $('seriesList').innerHTML = list.map((s) => {
      const sm = metaLine({ codice: s.codice, rev: s.rev, lav: s.lav, lotto: '' });
      return `<div class="item ${cur && cur.id === s.id ? 'on' : ''}"><h3>Base ${fmtMm3(s.base)}${s.lotto ? ' · ' + esc(s.lotto) : ''}${lockedNow(s) ? ' <span class="lock-ic" title="Bloccata dal PIN">🔒</span>' : ''}</h3><div class="meta">gioco ${s.giocoMin}–${s.giocoMax} µm · tol ±${esc(fmtMm3(seriesTol(s)))}${cur && cur.id === s.id ? ' · <b style="color:var(--orange)">in uso</b>' : ''}</div>${sm ? `<div class="meta">${esc(sm)}</div>` : ''}
        <div class="actions"><button type="button" class="btn btn-sec" data-edit-s="${esc(s.id)}" style="flex:1">Modifica</button><button type="button" class="btn btn-sec" data-pkg-s="${esc(s.id)}" aria-label="Pacchetto: invia o esporta" style="flex:0 0 auto;min-width:56px">📦</button>
        <button type="button" class="btn btn-sec" data-dup-s="${esc(s.id)}" style="flex:1">Duplica</button>
        <button type="button" class="btn btn-teal" data-use-s="${esc(s.id)}" style="flex:1">Usa</button>
        <button type="button" class="btn btn-danger s-del" data-del-s="${esc(s.id)}" aria-label="Elimina serie Base ${esc(fmtMm3(s.base))}">${TRASH}</button></div></div>`;
    }).join('') || '<div class="empty">Nessuna serie: aggiungine una</div>';
  }
  $('seriesList').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit-s]'), del = e.target.closest('[data-del-s]');
    const use = e.target.closest('[data-use-s]'), dup = e.target.closest('[data-dup-s]'), pk = e.target.closest('[data-pkg-s]');
    if (pk) { openSendJob(pk.dataset.pkgS); return; }
    if (ed) { unlockedSess.clear(); openSeriesModal(ed.dataset.editS); }
    if (dup) { const src = seriesById(dup.dataset.dupS); if (!src) return;
      const copy = Object.assign({}, src, { id: uid(), name: 'Base ' + fmtMm3(src.base) + ' (copia)', history: [], stock: {} }); delete copy.fromPackage;
      state.series.push(copy); saveData(state); openSeriesModal(copy.id); }
    if (del) { haptic(15); openSeriesDelete(del.dataset.delS); }
    if (use) { const s = seriesById(use.dataset.useS); if (s) { setContext(null, s.id, true); showPage('calc'); newMeasure(); } }
  });
  $('btnAddSeries').addEventListener('click', () => openSeriesModal(null));
  const unlockedSess = new Set(); // series unlocked with the PIN while the editor is open
  function openSeriesModal(id) {
    const s = id ? seriesById(id) : { lotto: '', base: '', tolleranza: 0.1, giocoMin: 10, giocoMax: 13, notes: '', history: [], stock: {} };
    if (!s) return;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal"><h2>${id ? 'Modifica quote' : 'Nuova serie'}</h2>
      ${id ? '' : `<button type="button" class="btn-job wide" id="sPhoto"><span class="ji">📷</span><span><b>Foto del foglio</b><small>Legge base, tolleranza, gioco, codice e lotto (come Nuovo lavoro)</small></span></button>
      <button type="button" class="btn btn-sec src-gal" id="sGallery" style="width:100%;margin:8px 0 10px;min-height:52px">🖼 Dalla galleria <small>(foto già fatta)</small></button>
      <button type="button" class="btn btn-sec preset-btn" id="sPreset10">⚡ Preset Corpo/Spillo Ø10 (gioco 10–30, obiettivo 20)</button>`}
      <div class="field-row"><div><label>Base mm</label><input id="sBase" inputmode="decimal" placeholder="es. 24,600" value="${s.base === '' ? '' : esc(String(s.base).replace('.', ','))}"/></div>
      <div><label>Tol ± mm</label><input id="sTol" inputmode="decimal" placeholder="0,1" value="${s.tolleranza != null ? esc(String(s.tolleranza).replace('.', ',')) : ''}"/></div></div>
      <div class="field-row"><div><label>Gioco min µm</label><input id="sGmin" inputmode="numeric" value="${s.giocoMin}"/></div>
      <div><label>Gioco max µm</label><input id="sGmax" inputmode="numeric" value="${s.giocoMax}"/></div></div>
      ${(() => { const L = jobLimits(s); return `<div class="lim-h">Tolleranze di forma del lavoro (µm)</div>
      <div class="field-row"><div><label>Conicità ok ≤ µm</label><input id="sConOk" inputmode="decimal" value="${esc(fmtUm(L.conOk))}"/></div><div><label>Conicità max µm</label><input id="sConMax" inputmode="decimal" value="${esc(fmtUm(L.conMax))}"/></div></div>
      <div class="field-row"><div><label>Ovalità ok ≤ µm</label><input id="sOvOk" inputmode="decimal" value="${esc(fmtUm(L.ovalOk))}"/></div><div><label>Ovalità max µm</label><input id="sOvMax" inputmode="decimal" value="${esc(fmtUm(L.ovalMax))}"/></div></div>
      <div class="lim-h">Riquadro del disegno (facoltativo)</div>
      <div class="field-row"><div><label for="sCirc">○ Circolarità</label><input id="sCirc" inputmode="decimal" placeholder="es. 0,003 o 3" value="${s.geo && s.geo.circ != null ? esc(fmtUm(s.geo.circ)) : ''}"/></div><div><label for="sCyl">⌭ Cilindricità</label><input id="sCyl" inputmode="decimal" placeholder="es. 0,005 o 5" value="${s.geo && s.geo.cyl != null ? esc(fmtUm(s.geo.cyl)) : ''}"/></div></div>
      <p class="meta">Se li scrivi, il promemoria usa questi valori (µm) al posto di 2–3 µm: circolarità → ovalità, cilindricità → ovalità e conicità.</p>`; })()}
      <div class="lim-h">Pezzo consigliato (facoltativo)</div>
      <div class="field-row"><div><label>Gioco obiettivo µm</label><input id="sObj" inputmode="decimal" placeholder="centro" value="${s.obiettivo != null ? esc(fmtUm(s.obiettivo)) : ''}"/></div>
      <div><label>Fascia consigliata µm</label><div style="display:flex;gap:6px"><input id="sFLo" inputmode="decimal" placeholder="da" value="${s.fasciaLo != null ? esc(fmtUm(s.fasciaLo)) : ''}"/><input id="sFHi" inputmode="decimal" placeholder="a" value="${s.fasciaHi != null ? esc(fmtUm(s.fasciaHi)) : ''}"/></div></div></div>
      <div class="field-row"><div><label>Femmina fissa mm <small>(vuoto = no)</small></label><input id="sFixF" inputmode="decimal" placeholder="es. 10,009" value="${s.fixedF != null ? esc(fmtMm4(s.fixedF)) : ''}"/></div>
      <div><label class="chk-big" style="margin-top:22px"><input type="checkbox" id="sForma" ${s.forma === false ? '' : 'checked'}/><span>Controlla ovalità/conicità</span></label></div></div>
      ${id ? '<p class="meta" id="sHistNote">Le misure già salvate tengono le quote di quando sono state fatte: modificare qui non le ricalcola.</p>' : ''}
      <label>Lotto / codice</label><input id="sLotto" value="${esc(s.lotto || '')}"/>
      <div class="field-row"><div><label>Codice disegno</label><input id="sCod" value="${esc(s.codice || '')}" maxlength="40" placeholder="es. 12345-A"/></div><div><label>Revisione</label><input id="sRev" value="${esc(s.rev || '')}" maxlength="12" placeholder="es. B"/></div></div>
      <label>Lavorazione / operazione</label><input id="sLav" value="${esc(s.lav || '')}" maxlength="40" placeholder="es. 0522"/>
      <label>Note</label><textarea id="sNotes">${esc(s.notes || '')}</textarea>
      <div id="sErr" class="form-err hidden"></div>
      <div class="actions" style="margin-top:10px"><button type="button" class="btn btn-sec" id="sCancel" style="flex:1">Annulla</button>
      <button type="button" class="btn btn-teal" id="sSave" style="flex:1">Salva</button></div>
      ${id ? `<button type="button" class="btn btn-danger del-btn" id="sDelete">${TRASH}<span>Elimina serie</span></button>` : ''}</div></div>`;
    $('sCancel').onclick = () => { unlockedSess.clear(); $('modalRoot').innerHTML = ''; };
    // «Nuova serie» from the sheet photo: same reading as «Nuovo lavoro», but only the series is saved (no new job)
    const serPhoto = (mode) => { unlockedSess.clear(); pendingFem = false; pendingInt = false; pendingJob = { machineName: (myMachine() || {}).name || '', seriesOnly: true }; $('modalRoot').innerHTML = ''; openFoto(mode); };
    if ($('sPhoto')) { $('sPhoto').onclick = () => { haptic(12); serPhoto('camera'); }; $('sGallery').onclick = () => { haptic(12); serPhoto('gallery'); }; }
    if ($('sPreset10')) $('sPreset10').onclick = () => { const p = presetCorpoSpillo10(); $('sBase').value = '10,000'; $('sTol').value = '0,1'; $('sGmin').value = p.giocoMin; $('sGmax').value = p.giocoMax;
      $('sObj').value = p.obiettivo; $('sFLo').value = p.fasciaLo; $('sFHi').value = p.fasciaHi; $('sForma').checked = false; $('sLotto').value = p.lotto; $('sNotes').value = p.notes; haptic(15); toast('Preset Corpo/Spillo Ø10: controlla e Salva'); };
    if ($('sDelete')) $('sDelete').onclick = () => { haptic(15); openSeriesDelete(id); };
    // Beta 0.9.0: locked series (PIN) – fields read-only until the PIN is typed (protection against mistakes)
    const lockedUI = !!(id && lockedNow(s) && !unlockedSess.has(id));
    if (lockedUI) {
      ['sBase', 'sTol', 'sGmin', 'sGmax', 'sConOk', 'sConMax', 'sOvOk', 'sOvMax', 'sObj', 'sFLo', 'sFHi', 'sFixF', 'sForma', 'sLotto', 'sCod', 'sRev', 'sLav'].forEach((x) => { if ($(x)) $(x).disabled = true; }); $('sSave').disabled = true;
      $('modalRoot').querySelector('.modal h2').insertAdjacentHTML('afterend', '<div class="lock-bar" id="sLockBar">🔒 Serie bloccata dal PIN: protegge tolleranze e gioco dagli errori.<button type="button" class="btn btn-teal" id="sUnlock">Sblocca con PIN</button></div>');
      $('sUnlock').onclick = async () => { if (await askPin('🔒 Sblocca la serie', 'Base ' + fmtMm3(s.base))) unlockedSess.add(id); openSeriesModal(id); };
    }
    $('sSave').onclick = () => {
      if (lockedUI) return;
      const v = validateSeriesInput({ base: $('sBase').value, tol: $('sTol').value, gmin: $('sGmin').value, gmax: $('sGmax').value });
      if (!v.ok) { const er = $('sErr'); er.textContent = v.error; er.classList.remove('hidden'); haptic(60); return; }
      const nv = (id2) => { const x = Number(String($(id2).value).replace(',', '.')); return Number.isFinite(x) && x >= 0 && x <= 50 ? x : null; };
      const lim = { conOk: nv('sConOk'), conMax: nv('sConMax'), ovalOk: nv('sOvOk'), ovalMax: nv('sOvMax') };
      if (Object.values(lim).some((x) => x == null) || lim.conMax < lim.conOk || lim.ovalMax < lim.ovalOk) { const er = $('sErr'); er.textContent = 'Tolleranze di forma non valide: numeri in µm, max ≥ ok (es. 2 e 3)'; er.classList.remove('hidden'); haptic(60); return; }
      const gT = (id4) => String($(id4).value).trim(), gC = gT('sCirc'), gY = gT('sCyl'), geo = { circ: gC ? QT.geoUm(gC) : null, cyl: gY ? QT.geoUm(gY) : null };
      if ((gC && geo.circ == null) || (gY && geo.cyl == null)) { const er = $('sErr'); er.textContent = 'Circolarità / cilindricità: scrivi il valore del riquadro (es. 0,003 mm o 3 µm)'; er.classList.remove('hidden'); haptic(60); return; }
      const mid = myMachine() ? myMachine().id : null;
      const on = (id3) => { const t = String($(id3).value).trim(); if (!t) return null; const x = Number(t.replace(',', '.')); return Number.isFinite(x) && x >= 0 && x <= 100 ? x : NaN; };
      const obiettivo = on('sObj'), fasciaLo = on('sFLo'), fasciaHi = on('sFHi'), fxT = String($('sFixF').value).trim(), fixedF = fxT ? parseMmNumber(fxT) : null;
      if ([obiettivo, fasciaLo, fasciaHi].some((x) => Number.isNaN(x)) || (fxT && fixedF == null)) { const er = $('sErr'); er.textContent = 'Obiettivo / fascia in µm (es. 20 e 20–25), femmina fissa in mm (es. 10,009)'; er.classList.remove('hidden'); haptic(60); return; }
      const payload = Object.assign({ lim, geo: geo.circ != null || geo.cyl != null ? geo : null, obiettivo, fasciaLo, fasciaHi, fixedF: fixedF != null ? round4(fixedF) : null, forma: $('sForma').checked ? true : false, machineId: mid, name: 'Base ' + fmtMm3(v.value.base), lotto: $('sLotto').value.trim(), codice: $('sCod').value.trim().slice(0, 40), rev: $('sRev').value.trim().slice(0, 12), lav: $('sLav').value.trim().slice(0, 40), notes: $('sNotes').value }, v.value);
      let sid = id;
      if (id) Object.assign(seriesById(id), payload);
      else { sid = uid(); state.series.push(Object.assign({ id: sid, history: [], stock: {} }, payload)); }
      saveData(state); unlockedSess.clear(); $('modalRoot').innerHTML = '';
      if (!id && !seriesById(prefs.seriesId)) setContext(null, sid, false);
      if (lastCalc && lastCalc.seriesId === sid) { lastCalc = null; showInputView(); }
      if ($('page-serie').classList.contains('active')) renderSeries();
      fillSetupSelects(); updateChip(); updatePrefix(); refreshDisplay(); toast('Quote salvate');
    };
  }


  function renderStock() {
    const { series } = currentContext(); const box = $('stockBox');
    if (!series) { box.innerHTML = '<div class="empty">Scegli una serie</div>'; return; }
    series.stock = series.stock || {};
    const showAll = !!prefs.stockShowAll;
    let center = (series.giocoMin + series.giocoMax) / 2; // only a default, replaced below
    if (lastCalc && lastCalc.seriesId === series.id) center = lastCalc.acc.ideal;
    else {
      const h = (series.history || []).slice().sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))[0];
      if (h && h.chosen != null) center = h.chosen;
    }
    const nums = stockVisibleNums(series.stock, center, showAll, -10, 25);
    const anyStock = Object.keys(series.stock).some((k) => Number(series.stock[k]) > 0);
    box.innerHTML = `<div class="meta" style="margin-bottom:6px;color:var(--muted);font-size:13px">Serie Base ${fmtMm3(series.base)}${showAll ? ' · tutti' : ' · vicino al consigliato'}</div>
      ${anyStock ? '' : '<div class="meta" style="margin-bottom:6px">Conta i pezzi di accoppiamento sul tavolo con +: l\'app ti avvisa se il numero consigliato è finito.</div>'}
      <div class="stock-grid">${nums.map((n) => {
        const count = Number(series.stock[String(n)] || 0);
        const cls = count === 0 ? 'empty' : count <= 2 ? 'low' : '';
        return `<div class="stock-cell ${cls}"><div class="n">${n}</div><div class="c">${count}</div>
          <div class="row"><button type="button" data-sdec="${n}">−</button><button type="button" data-sinc="${n}">+</button></div></div>`;
      }).join('')}</div>
      <button type="button" class="btn btn-sec stock-more" id="btnStockAll">${showAll ? 'Mostra solo i vicini' : 'Mostra tutti (−10 … 25)'}</button>`;
  }
  $('stockBox').addEventListener('click', (e) => {
    const { series } = currentContext(); if (!series) return; series.stock = series.stock || {};
    if (e.target.closest('#btnStockAll')) { prefs.stockShowAll = !prefs.stockShowAll; savePrefs(prefs); renderStock(); return; }
    const inc = e.target.closest('[data-sinc]'), dec = e.target.closest('[data-sdec]');
    if (inc) { series.stock[inc.dataset.sinc] = (Number(series.stock[inc.dataset.sinc]) || 0) + 1; saveData(state); renderStock(); }
    if (dec) { series.stock[dec.dataset.sdec] = Math.max(0, (Number(series.stock[dec.dataset.sdec]) || 0) - 1); saveData(state); renderStock(); }
  });
  function ensurePezzi() { if (!state.pezzi) state.pezzi = { entries: [], dayHistory: [] }; }
  function renderPezzi() {
    ensurePezzi(); setPezziDig();
    const tot = pezziSum(state.pezzi.entries);
    const totEl = $('pezziTotale'); if (totEl) totEl.textContent = String(tot);
    $('pezziList').innerHTML = state.pezzi.entries.length
      ? state.pezzi.entries.map((e) => `<div class="pezzi-item">
          <div class="pn cond">${e.n}</div>
          <div class="pm">${esc(e.note || (e.ts ? new Date(e.ts).toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'}) : ''))}</div>
          <button type="button" class="del" data-del-p="${e.id}" title="Elimina" aria-label="Elimina">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
          </button></div>`).join('')
      : '<div class="empty">Nessun pezzo portato via</div>';
  }
  function setPezziDig() { $('pezziDig').textContent = pezziDigits; const ph = $('pezziPh'); if (ph) ph.classList.toggle('hidden', !!pezziDigits); }
  $('pezziPad').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pk]'); if (!b) return; const k = b.dataset.pk; haptic(12);
    if (k === 'GO') {
      const n = parseInt(pezziDigits, 10); if (!(n > 0)) { toast('Inserisci un numero > 0'); return; }
      ensurePezzi(); state.pezzi.entries.push({ id: uid(), n, note: '', ts: new Date().toISOString() });
      saveData(state); pezziDigits = ''; renderPezzi(); renderRiepilogo(); toast('+' + n); return;
    }
    if (k === 'AC') pezziDigits = ''; else if (k === 'BS') pezziDigits = pezziDigits.slice(0, -1);
    else if (pezziDigits.length < 4) pezziDigits = (pezziDigits === '0' ? '' : pezziDigits) + k;
    setPezziDig();
  });
  $('pezziList').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del-p]'); if (!del) return; ensurePezzi();
    state.pezzi.entries = state.pezzi.entries.filter((x) => x.id !== del.dataset.delP);
    saveData(state); renderPezzi(); renderRiepilogo();
  });
  $('btnPezziAzzera').addEventListener('click', async () => {
    ensurePezzi(); if (!state.pezzi.entries.length) { toast('Già vuoto'); return; }
    if (!(await askBig({ title: 'Azzerare il conteggio dei pezzi portati via?', html: '<p class="meta">Il totale di oggi resta salvato.</p>', ok: '↻ Azzera conteggio', danger: true }))) return;
    const tot = pezziSum(state.pezzi.entries), day = todayKey();
    const prev = state.pezzi.dayHistory.find((d) => d.date === day);
    if (prev) prev.total += tot; else state.pezzi.dayHistory.push({ date: day, total: tot, closedAt: new Date().toISOString() });
    state.pezzi.entries = []; saveData(state); renderPezzi(); renderRiepilogo(); toast('Conteggio azzerato · salvato ' + tot);
  });
  // ── v2.0.0 «Pezzi fatti»: pieces saved this shift, per machine name ──
  function saveMachineName(s) {
    if (s.machineName) return s.machineName;
    if (s.jobId) { const j = (state.jobs || []).concat(state.jobsArchive || []).find((x) => x && x.id === s.jobId); if (j && j.machineName) return j.machineName; }
    const ser = seriesById(s.seriesId); const h = ser && (ser.history || []).find((x) => x.id === s.id);
    if (h && h.machineName) return h.machineName;
    return (myMachine() || {}).name || '';
  }
  function shiftSum(note) {
    ensurePezzi();
    return summarizeShift({ saves: (state.turno && state.turno.saves) || [], pezziPortati: pezziSum(state.pezzi.entries),
      note: note != null ? note : ((state.turno && state.turno.note) || ''), nameOf: saveMachineName });
  }
  function renderFatti() {
    const el = $('fattiTotale'); if (!el) return;
    const f = shiftPieces((state.turno && state.turno.saves) || [], saveMachineName);
    el.textContent = String(f.total);
    const fd = femShift();
    const id0 = intShift(), qd0 = qtShift();
    if ($('femTurno')) $('femTurno').textContent = [fd ? `+ ${fd} ${fd === 1 ? 'femmina salvata' : 'femmine salvate'} (Adatta alla femmina)` : '', id0 ? `+ ${id0} ${id0 === 1 ? 'interno salvato' : 'interni salvati'} (foro)` : '', qd0.length ? `+ ${qd0.length} ${qd0.length === 1 ? 'controllo quota' : 'controlli quota'} (${qd0.filter((x) => x.esito !== 'fuori').length} dentro, ${qd0.filter((x) => x.esito === 'fuori').length} fuori)` : ''].filter(Boolean).join(' · ') + (fd || id0 || qd0.length ? ' in questo turno' : '');
    $('fattiSplit').innerHTML = f.total ? `<span class="fs-ok">${f.buoni} buoni</span> · <span class="fs-no">${f.scarti} ${f.scarti === 1 ? 'scarto' : 'scarti'}</span>` : 'Nessun pezzo salvato in questo turno';
    $('fattiMacchine').innerHTML = f.byMachine.map((m) =>
      `<div class="fm-row"><span class="fm-n">${esc(m.name)}</span><span class="fm-c cond">${m.total}</span>${m.scarti ? `<span class="fm-s">${m.buoni} buoni · <b class="fs-no">${m.scarti} ${m.scarti === 1 ? 'scarto' : 'scarti'}</b></span>` : '<span class="fm-s ok">tutti buoni</span>'}</div>`).join('');
    $('fattiMacchine').classList.toggle('hidden', !f.byMachine.length);
  }
  function renderTurno() {
    renderFatti();
    const t = state.turno || { saves: [] };
    const n = (t.saves || []).length;
    $('turnoLive').innerHTML = `<div style="font-size:13px;color:var(--muted);font-weight:700">IN CORSO</div>
      <div style="font-size:28px;font-weight:800">${n} pezzi salvati</div>
      <div class="meta">dal ${t.startedAt ? new Date(t.startedAt).toLocaleString('it-IT') : '—'}</div>`;
    const badge = $('turnoBadge');
    if (badge) badge.innerHTML = '<span class="dot"></span> In corso · ' + n + (n === 1 ? ' salvato' : ' salvati');
    ensurePezzi(); if ($('turnoMore') && state.pezzi.entries.length) $('turnoMore').open = true;
    const pc = t.prevClosed, pb = $('turnoClosed');
    if (pb) { const show = !!pc && !n; pb.classList.toggle('hidden', !show);
      pb.innerHTML = show ? `✓ Turno precedente chiuso e archiviato alle ${esc(new Date(pc.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))} (${pc.total} ${pc.total === 1 ? 'pezzo' : 'pezzi'}${pc.femmine ? ', ' + pc.femmine + ' femmin' + (pc.femmine === 1 ? 'a' : 'e') : ''}). Nuovo turno iniziato.` : ''; }
    $('turnoNote').value = t.note || '';
  }
  $('turnoNote').addEventListener('change', () => { state.turno = state.turno || {}; state.turno.note = $('turnoNote').value; saveData(state); });
  function formatMostUsed(arr) {
    if (!arr || !arr.length) return '—';
    const top = arr[0];
    if (top.count < 2) return '—'; // v2.0.8: no ranking when every number was used once
    const volta = top.count === 1 ? '1 volta' : (top.count + ' volte');
    let s = 'Pezzo più usato: ' + top.n + ' (' + volta + ')';
    if (arr.length > 1) {
      s += ' · poi ' + arr.slice(1, 3).map((x) => x.n + ' (' + x.count + ')').join(', ');
    }
    return s;
  }
  function renderRiepilogo() {
    ensurePezzi();
    const sum = shiftSum();
    $('riepilogoBox').innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><div class="meta">Pezzi fatti</div><b style="font-size:28px">${sum.total}</b></div>
      <div><div class="meta">Portati via</div><b style="font-size:28px">${sum.pezziPortati}</b></div>
      <div><div class="meta">Buoni</div><b style="color:var(--green)">${sum.buoni}</b></div>
      <div><div class="meta">Scarti</div><b style="color:var(--red)">${sum.scarti}</b></div>
      <div><div class="meta">Correzioni</div><b>${sum.correzioni}</b></div>
      <div style="grid-column:1/-1"><div class="meta">Utilizzo</div><b>${formatMostUsed(sum.mostUsed)}</b></div></div>
      ${sum.byMachine.length ? `<div class="meta" style="margin-top:8px">Pezzi fatti per macchina</div><div class="rp-mac">${sum.byMachine.map((m) => `<div>${esc(fmtMachineLine(m))}</div>`).join('')}</div>` : ''}
      <div class="meta" style="margin-top:8px">${sum.bySeries.map((s) => esc(s.name) + ': ' + s.count).join(' · ') || ''}</div>
      ${(() => { const l = turnoLavori((state.turno && state.turno.saves) || []); return l.length ? `<div class="meta" style="margin-top:8px">Lavori</div><div class="rp-mac" id="rpLavori">${l.map((x) => `<div>${esc(x)}</div>`).join('')}</div>` : ''; })()}`;
  }
  /** Beta 0.9.0: distinct «Cod. · rev · Lav. · Lotto» lines of the jobs worked in a list of saves */
  function turnoLavori(saves) {
    const out = [];
    (saves || []).forEach((sv) => { const l = metaLine(sv.meta || jobMeta(sv.jobId ? findJob(sv.jobId) : null, seriesAny(sv.seriesId))); if (l && !out.includes(l)) out.push(l); });
    return out;
  }
  function shiftText() {
    ensurePezzi();
    const sum = shiftSum();
    let t = 'Rettifica Beta — riepilogo turno\n' + turnoLavori((state.turno && state.turno.saves) || []).map((l) => 'Lavoro: ' + l + '\n').join('') + 'Pezzi fatti: ' + sum.total + ' · Buoni: ' + sum.buoni + ' · Scarti: ' + sum.scarti + '\n';
    sum.byMachine.forEach((m) => { t += '  ' + fmtMachineLine(m) + '\n'; });
    const qd = qtShift(); if (qd.length) t += 'Controllo quota: ' + qd.length + ' ' + (qd.length === 1 ? 'pezzo' : 'pezzi') + ' (' + qd.filter((x) => x.esito !== 'fuori').length + ' dentro, ' + qd.filter((x) => x.esito === 'fuori').length + ' fuori)\n';
    t += 'Correzioni: ' + sum.correzioni + ' · Portati via: ' + sum.pezziPortati + '\n';
    t += formatMostUsed(sum.mostUsed) + '\n';
    sum.bySeries.forEach((s) => { t += '- ' + s.name + ': ' + s.count + '\n'; });
    if (sum.note) t += 'Nota: ' + sum.note + '\n'; return t;
  }
  $('btnShareTxt').addEventListener('click', () => {
    const text = shiftText();
    try { if (window.RettificaAndroid && RettificaAndroid.sharePlainText) { RettificaAndroid.sharePlainText('Rettifica turno', text); return; } } catch (e) {}
    if (navigator.share) navigator.share({ title: 'Rettifica Beta · turno', text }).catch(() => {});
    else toast('Usa APK per condividere');
  });
  $('btnShareImg').addEventListener('click', () => {
    const c = $('shareCanvas'), ctx = c.getContext('2d');
    const sum = shiftSum();
    ctx.fillStyle = '#121418'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#ff8a1f'; ctx.font = 'bold 36px sans-serif'; ctx.fillText('Rettifica Beta — Turno', 40, 70);
    ctx.fillStyle = '#eef3fa'; ctx.font = '28px sans-serif';
    const lines = ['Pezzi fatti: ' + sum.total]
      .concat(sum.byMachine.slice(0, 10).map((m) => '   ' + fmtMachineLine(m)))
      .concat(sum.byMachine.length > 10 ? ['   … altre ' + (sum.byMachine.length - 10) + ' macchine'] : [])
      .concat(['Buoni: ' + sum.buoni, 'Scarti: ' + sum.scarti, 'Correzioni: ' + sum.correzioni, 'Portati via: ' + sum.pezziPortati, formatMostUsed(sum.mostUsed)]);
    lines.forEach((ln, i) => {
      ctx.font = i === 0 ? 'bold 34px sans-serif' : '28px sans-serif';
      let s = ln; while (ctx.measureText(s).width > c.width - 80 && s.length > 4) s = s.slice(0, -2) + '…';
      ctx.fillText(s, 40, 140 + i * 48);
    });
    const data = c.toDataURL('image/png');
    try {
      if (window.RettificaAndroid && RettificaAndroid.shareImageBase64) {
        RettificaAndroid.shareImageBase64('rettifica-beta-turno.png', data.split(',')[1]); return;
      }
    } catch (e) {}
    const a = document.createElement('a'); a.href = data; a.download = 'rettifica-beta-turno.png'; a.click(); toast('Immagine creata');
  });
  function femShift() { const t0 = (state.turno && state.turno.startedAt) || ''; return (state.femmine || []).filter((r) => String(r.ts || '') >= t0).length; }
  $('btnChiudiTurno').addEventListener('click', async () => {
    ensurePezzi();
    const f0 = shiftPieces((state.turno && state.turno.saves) || [], saveMachineName), fd0 = femShift();
    const ok0 = await askBig({ title: 'Chiudere il turno?', ok: '✓ Chiudi turno',
      html: `<div class="ask-sum"><b>${f0.total}</b> ${f0.total === 1 ? 'pezzo fatto' : 'pezzi fatti'} · <span class="fs-ok">${f0.buoni} buoni</span> · <span class="fs-no">${f0.scarti} ${f0.scarti === 1 ? 'scarto' : 'scarti'}</span>${fd0 ? `<br/>${fd0} ${fd0 === 1 ? 'femmina salvata' : 'femmine salvate'} (Adatta alla femmina)` : ''}</div>
        <p class="meta">Il turno va nell'archivio (Storico) e ne parte uno nuovo. Le misure salvate restano nello Storico.</p>` });
    if (!ok0) return;
    const sum = shiftSum($('turnoNote').value || '');
    state.turniArchivio = state.turniArchivio || [];
    // v2.0.0: archived saves keep their machine name, so «Pezzi fatti» per machine survives the archive
    const savesArch = ((state.turno && state.turno.saves) || []).map((s) => Object.assign({}, s, { machineName: saveMachineName(s) }));
    const closedAt = new Date().toISOString();
    state.turniArchivio.unshift({ id: uid(), closedAt, summary: Object.assign({}, sum, { femmine: fd0, lavori: turnoLavori(savesArch) }), saves: savesArch });
    state.turno = { startedAt: closedAt, note: '', saves: [], checks: [], correzioni: 0, prevClosed: { at: closedAt, total: f0.total, femmine: fd0 } };
    state.pezzi.entries = []; saveData(state); lastSaveRec = null; hideUndo(); renderTurno(); renderPezzi(); renderRiepilogo();
    toast('✓ Turno chiuso e archiviato (' + f0.total + (f0.total === 1 ? ' pezzo' : ' pezzi') + ')'); window.scrollTo(0, 0);
  });


  function renderAndamento() {
    const { series, machine } = currentContext(); const box = $('andamentoBox');
    if (!series) { box.innerHTML = '<div class="empty">Scegli serie</div>'; return; }
    const hist = (series.history || []).slice().sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
    const last = hist.slice(-20);
    if (last.length < 3) {
      box.innerHTML = `<div class="card" style="padding:18px;text-align:center"><div style="font-size:28px;opacity:.5;margin-bottom:6px">▁▂▃▅</div>
        <b>Base ${fmtMm3(series.base)}</b>
        <div class="empty" style="padding:.6rem">Servono almeno 3 misure salvate per il grafico</div></div>`; return;
    }
    const vals = last.map((h) => h.S);
    const drift = currentDrift(series, machine, null);
    const min = Math.min(...vals), max = Math.max(...vals), pad = 0.005;
    const y0 = min - pad, y1 = max + pad, w = 320, h = 120, l = 8, t = 8;
    const pts = vals.map((v, i) => {
      const x = l + (i / Math.max(1, vals.length - 1)) * (w - 2 * l);
      const y = t + (1 - (v - y0) / (y1 - y0)) * (h - 2 * t);
      return [x, y];
    });
    const baseY = t + (1 - (series.base - y0) / (y1 - y0)) * (h - 2 * t);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    box.innerHTML = `<div class="card" style="padding:12px"><div class="lbl"><span>Ultime ${last.length} · Base ${fmtMm3(series.base)}</span></div>
      <div class="chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <line x1="0" y1="${baseY}" x2="${w}" y2="${baseY}" stroke="rgba(25,227,208,.45)" stroke-width="1.5" stroke-dasharray="4 3"/>
        <path d="${path}" fill="none" stroke="#3ddc84" stroke-width="2.5"/>
        ${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#19e3d0"/>`).join('')}
      </svg></div>
      ${drift.alert ? `<div class="drift">${esc(drift.alert)}</div>` : `<div class="meta" style="margin-top:6px;color:var(--muted)">${drift.points < 5 ? 'Avviso andamento: servono almeno 5 pezzi di questo turno (dopo l\'ultima correzione)' : 'Nessun andamento rilevante'}</div>`}</div>`;
  }
  let histShown = 50;
  function renderStorico() {
    const sel = $('filterHistSeries'), prev = sel.value;
    sel.innerHTML = '<option value="">Tutte</option>' + allSeries().filter((s) => !s.deletedAt || (s.history || []).length).map((s) => {
      const m = machineById(s.machineId);
      return `<option value="${s.id}">${esc(m ? m.name : '?')} · Base ${fmtMm3(s.base)}${s.deletedAt ? ' (serie eliminata)' : ''}</option>`;
    }).join('');
    if (prev) sel.value = prev;
    const filter = sel.value, items = [];
    allSeries().forEach((s) => { if (filter && s.id !== filter) return; (s.history || []).forEach((h) => items.push(Object.assign({}, h, { series: s }))); });
    items.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    const shown = items.slice(0, histShown);
    $('histList').innerHTML = items.length ? shown.map((h) => {
      const m = machineById(h.machineId || h.series.machineId);
      const mname = h.machineName || (m ? m.name : '');
      return `<div class="item"><div><strong>${esc(mname)}</strong> · Base ${fmtMm3(h.series.base)}${h.series.deletedAt ? ' <span class="meta">(serie eliminata)</span>' : ''}</div>
        <div class="meta">${h.ts ? new Date(h.ts).toLocaleString('it-IT') : ''}</div>
        ${(() => { const ml = metaLine(rowMeta(h, h.series)); return ml ? `<div class="meta hist-meta">${esc(ml)}</div>` : ''; })()}
        <div>S ${esc(fmtMmS(h.S))} → pezzo <b>${esc(String(h.chosen))}</b> · gioco ${fmtUm(h.gioco)} µm${h.con != null ? ` · conicità ${fmtUm(h.con)} µm${h.conEnd ? ' ' + (h.conEnd === 'fondo' ? 'in fondo' : 'davanti') : ''}` : ''}
          ${h.status === 'scarto' ? ' · <span class="scarto-badge">scarto</span>' : ''}</div>
        <div class="actions"><button type="button" class="btn btn-sec" data-edit-h="${h.series.id}|${h.id}" style="flex:1">Modifica</button>
        <button type="button" class="btn btn-sec" data-del-h="${h.series.id}|${h.id}" style="flex:1">Elimina</button></div></div>`;
    }).join('') + (items.length > shown.length ? `<button type="button" class="btn btn-sec" id="histMore" style="width:100%">Mostra altre ${Math.min(50, items.length - shown.length)} (di ${items.length})</button>` : '') : '<div class="empty">Nessuna misura</div>';
  }
  $('filterHistSeries').addEventListener('change', () => { histShown = 50; renderStorico(); });
  $('histList').addEventListener('click', (e) => {
    if (e.target.id === 'histMore') { histShown += 50; renderStorico(); return; }
    const del = e.target.closest('[data-del-h]'), ed = e.target.closest('[data-edit-h]');
    if (ed) { const [sid, hid] = ed.dataset.editH.split('|'); openHistModal(sid, hid); return; }
    if (!del) return;
    const [sid, hid] = del.dataset.delH.split('|'); const s = seriesAny(sid);
    const hRec = s && (s.history || []).find((h) => h.id === hid);
    askBig({ title: 'Eliminare questa misura?', html: hRec ? `<p class="meta">S ${esc(fmtMm4(hRec.S))} · ${esc(new Date(hRec.ts).toLocaleString('it-IT'))}</p>` : '', ok: '🗑 Elimina', danger: true }).then((yes) => { if (!yes) return;
    if (s) s.history = (s.history || []).filter((h) => h.id !== hid);
    saveData(state); renderStorico(); renderAndamento(); });
  });
  function openHistModal(sid, hid) {
    const s = seriesAny(sid), h = s && (s.history || []).find((x) => x.id === hid); if (!h) return;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal"><h2>Modifica misura</h2>
      <label>S mm</label><input id="hS" inputmode="decimal" value="${esc(fmtMmS(h.S))}"/><label>Pezzo</label><input id="hChosen" inputmode="numeric" value="${h.chosen}"/>
      <div class="meta" style="margin-top:6px" id="hSnapNote">Il gioco si ricalcola da S e pezzo con le quote salvate con la misura: base ${esc(fmtMm3((h.snap || s).base))} mm · gioco ${(h.snap || s).giocoMin}–${(h.snap || s).giocoMax} µm. Il valore precedente resta nello storico della misura.</div>
      ${(h.edits || []).length ? `<div class="meta" id="hEdits">Modificata ${h.edits.length} volta/e · prima: S ${esc(fmtMmS(h.edits[h.edits.length - 1].S))} mm → pezzo ${h.edits[h.edits.length - 1].chosen}</div>` : ''}
      <div id="hErr" class="form-err hidden"></div>
      <div class="actions" style="margin-top:10px"><button type="button" class="btn btn-sec" id="hCancel" style="flex:1">Annulla</button>
      <button type="button" class="btn btn-teal" id="hSave" style="flex:1">Salva</button></div></div></div>`;
    $('hCancel').onclick = () => { $('modalRoot').innerHTML = ''; };
    $('hSave').onclick = () => {
      const sv = parseMmNumber($('hS').value), chosen = parseGiocoInt($('hChosen').value);
      const err = (t) => { $('hErr').textContent = t; $('hErr').classList.remove('hidden'); };
      if (sv == null) return err('S non valido (es. 21,9966)');
      const sb = h.snap || s;
      if (Math.abs(sv - sb.base) > hardLimitMm(sb.tolMm != null ? sb.tolMm : s.tolleranza)) return err('S troppo lontano dalla base ' + fmtMm3(sb.base));
      if (chosen == null) return err('Pezzo non valido');
      if (round4(sv) === h.S && chosen === h.chosen) { $('modalRoot').innerHTML = ''; return; }
      editHistoryRecord(h, s, sv, chosen, new Date().toISOString());
      saveData(state); $('modalRoot').innerHTML = ''; renderStorico(); renderAndamento();
    };
  }
  function renderArchivio() {
    const list = state.turniArchivio || [];
    $('archivioList').innerHTML = list.length ? list.map((t) =>
      `<div class="item"><b>${new Date(t.closedAt).toLocaleString('it-IT')}</b>
        <div class="meta">${t.summary.total} pezzi fatti · buoni ${t.summary.buoni} · scarti ${t.summary.scarti} · portati ${t.summary.pezziPortati}</div>
        ${(t.summary.byMachine || []).length ? `<div class="meta">${t.summary.byMachine.map((m) => esc(m.name + ' · ' + m.total)).join(' · ')}</div>` : ''}${(t.summary.lavori || []).length ? `<div class="meta">${t.summary.lavori.map(esc).join(' | ')}</div>` : ''}</div>`
    ).join('') : '<div class="empty">Nessun turno chiuso</div>';
  }

  function renderTrain() {
    const tr = state.training;
    if (tr.todayKey !== todayKey()) { tr.todayKey = todayKey(); tr.todayCount = 0; saveData(state); }
    $('trainStats').innerHTML = `<div>Oggi <b>${tr.todayCount}/5</b> · Streak <b>${tr.streak}</b> · Score <b>${tr.score}</b></div>`;
    if (!trainQ) { $('trainCard').innerHTML = '<button type="button" class="btn btn-teal" id="trainStart" style="width:100%">Nuova domanda</button>'; return; }
    const { series } = trainQ;
    $('trainCard').innerHTML = `<div class="meta">Base ${fmtMm3(series.base)} · gioco ${series.giocoMin}–${series.giocoMax} µm</div>
      <div class="S cond">${fmtMm3(trainQ.S)} <small style="font-size:18px">mm</small></div>
      <div style="margin:8px 0;font-weight:700">Quale pezzo accoppi?</div>
      <div class="val cond" style="justify-content:center"><span class="dig" id="trainDig" style="font-size:42px">${trainQ.userDigits || ''}</span><span class="cur"></span></div>
      <div class="pad cond" id="trainPad" style="grid-template-rows:repeat(4,52px);margin-top:8px">
        <button type="button" class="k" data-tk="7">7</button><button type="button" class="k" data-tk="8">8</button><button type="button" class="k" data-tk="9">9</button><button type="button" class="k fn" data-tk="BS">⌫</button>
        <button type="button" class="k" data-tk="4">4</button><button type="button" class="k" data-tk="5">5</button><button type="button" class="k" data-tk="6">6</button>
        <button type="button" class="k go" data-tk="GO" style="grid-row:span 3"><span>✓</span></button>
        <button type="button" class="k" data-tk="1">1</button><button type="button" class="k" data-tk="2">2</button><button type="button" class="k" data-tk="3">3</button>
        <button type="button" class="k fn" data-tk="PM">+/−</button><button type="button" class="k" data-tk="0">0</button><button type="button" class="k fn" data-tk="AC">AC</button>
      </div><div id="trainFb" style="margin-top:10px"></div>`;
  }
  function newTrainQ() {
    const { series, machine } = currentContext(); if (!series) { toast('Scegli una serie'); return; }
    const q = randomTrainingS(series.base, series.giocoMin, series.giocoMax);
    trainQ = Object.assign({}, q, { series, machine, userDigits: '', neg: false }); renderTrain();
  }
  $('trainCard').addEventListener('click', (e) => {
    if (e.target.id === 'trainStart' || e.target.id === 'trainNext') { newTrainQ(); return; }
    const b = e.target.closest('[data-tk]'); if (!b || !trainQ) return;
    const k = b.dataset.tk; haptic(12);
    if (k === 'GO') {
      if (trainQ.answered) { toast('Tocca «Prossima»'); return; }
      let raw = trainQ.userDigits || ''; if (trainQ.neg && raw && raw[0] !== '-') raw = '-' + raw;
      const chosen = parseInt(raw, 10); if (Number.isNaN(chosen)) { toast('Inserisci pezzo'); return; }
      const r = checkTrainingAnswer(trainQ.S, trainQ.series.base, trainQ.series.giocoMin, trainQ.series.giocoMax, chosen);
      trainQ.answered = true;
      const fb = $('trainFb');
      if (r.correct) {
        fb.innerHTML = `<div class="ok-badge">Corretto</div><div style="margin-top:6px">${esc(r.explanation)}</div>`;
        state.training.score += r.pieceBest ? 2 : 1;
        state.training.todayCount = (state.training.todayCount || 0) + 1;
        if (state.training.todayCount === 5 && state.training.lastDay !== todayKey()) {
          const yest = new Date(); yest.setDate(yest.getDate() - 1);
          if (state.training.lastDay === yest.toISOString().slice(0, 10)) state.training.streak += 1; else state.training.streak = 1;
          state.training.lastDay = todayKey();
        }
        saveData(state);
      } else fb.innerHTML = `<div class="scarto-badge">Sbagliato</div><div style="margin-top:6px">${esc(r.explanation)}</div>`;
      fb.innerHTML += `<button type="button" class="btn btn-teal" id="trainNext" style="width:100%;margin-top:10px">Prossima</button>`;
      $('trainStats').innerHTML = `<div>Oggi <b>${state.training.todayCount}/5</b> · Streak <b>${state.training.streak}</b> · Score <b>${state.training.score}</b></div>`;
      return;
    }
    if (trainQ.answered) return;
    if (k === 'AC') { trainQ.userDigits = ''; trainQ.neg = false; }
    else if (k === 'BS') trainQ.userDigits = (trainQ.userDigits || '').slice(0, -1);
    else if (k === 'PM') trainQ.neg = !trainQ.neg;
    else if ((trainQ.userDigits || '').length < 4) trainQ.userDigits = (trainQ.userDigits || '') + k;
    const dig = $('trainDig'); if (dig) dig.textContent = (trainQ.neg ? '−' : '') + (trainQ.userDigits || '');
  });


  // v1.9.4: Controllo F with its own field (no keypad switching)
  $('btnCheckF').addEventListener('click', () => {
    if (!lastCalc) return;
    const series = seriesById(lastCalc.seriesId); if (!series) return;
    const raw = String($('fInput').value || '').trim();
    const p = interpretMeasure(raw, series.base, seriesTol(series), null);
    if (!raw || !p || p.value == null || Math.abs(p.value - series.base) > hardLimitMm(series.tolleranza)) { toast('Misura F non valida', 'warn'); return; }
    const g = giocoSF(lastCalc.S, p.value);
    const gcF = calcGioco(lastCalc, series);
    const gap = -g.gUm; // G = S − F is negative when there is clearance
    const ok = gap >= gcF.min - 0.05 && gap <= gcF.max + 0.05;
    const el = $('fResult'); el.classList.remove('hidden');
    el.innerHTML = `F ${esc(fmtMmS(p.value))} → G = <b>${fmtUm(g.gUm)} µm</b> · <span class="${ok ? 'ok-badge' : 'scarto-badge'}">${ok ? 'Buono' : 'Scarto'}</span> <span class="meta">(gioco ${gcF.min}–${gcF.max} µm)</span>`;
  });
  $('fInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('btnCheckF').click(); } });

  // ── v1.9.8: crop step after the photo (default = whole photo; one tap «Leggi») ──
  let lastPhoto = null; // { img, w, h, box } – kept for «Ritaglia di nuovo»
  const FULL_BOX = () => ({ l: 0, t: 0, r: 1, b: 1 });
  const hasNativeCrop = () => { try { return !!(window.RettificaAndroid && RettificaAndroid.hasOcrCrop && RettificaAndroid.hasOcrCrop()); } catch (e) { return false; } };
  function sendCrop(box) {
    const full = box.l <= 0.01 && box.t <= 0.01 && box.r >= 0.99 && box.b >= 0.99;
    const b = full ? FULL_BOX() : box;
    if (lastPhoto) lastPhoto.box = b;
    toast(full ? 'Lettura della foto…' : 'Lettura del riquadro…');
    ocrAuto = null;
    if (ocrRead(b, lastPhoto ? lastPhoto.rot || 0 : 0)) return;
    const raw = prompt('Testo OCR del riquadro (solo test nel browser):');
    if (raw == null || !String(raw).trim()) { pendingJob = null; return; } applyOcrText(raw);
  }
  function closeCrop() { const r = $('cropRoot'); if (r) r.innerHTML = ''; document.removeEventListener('keydown', cropKey); }
  function cropKey(e) { if (e.key === 'Escape') { e.preventDefault(); cancelCrop(); } }
  function cancelCrop() {
    closeCrop(); lastPhoto = null;
    try { if (window.RettificaAndroid && RettificaAndroid.ocrCancel) RettificaAndroid.ocrCancel(); } catch (e) {}
    pendingFem = false; pendingInt = false; if (pendingJob) { toast(pjCancelMsg()); pendingJob = null; } else toast('Foto annullata');
  }
  function openCrop(photo, startBox) {
    lastPhoto = photo;
    const box = Object.assign(FULL_BOX(), startBox || {});
    $('cropRoot').innerHTML = `<div class="crop-bg" id="cropBg" role="dialog" aria-label="Ritaglio foto">
      <div class="crop-head"><h2>${pendingJob ? (pendingJob.seriesOnly ? 'Nuova serie' : 'Nuovo lavoro') + ' · ritaglio' : 'Scegli cosa leggere'}</h2>
      <p class="crop-hint" id="cropHint">Trascina gli angoli sulle righe <b>F1A · S1A · G1A</b> (etichette e valori). Lascia fuori barre e «Buono». Per tutta la foto tocca subito <b>Leggi</b>.</p></div>
      <div class="crop-stage" id="cropStage"><img id="cropImg" alt="Foto da leggere" draggable="false"/>
        <div class="crop-box" id="cropBox"><div class="crop-guide" id="cropGuide"><i class="gl" style="top:33.3%"></i><i class="gl" style="top:66.6%"></i>
          <span class="gt" style="top:4px">F1A</span><span class="gt" style="top:calc(33.3% + 4px)">S1A</span><span class="gt" style="top:calc(66.6% + 4px)">G1A</span></div>
          <span class="crop-h" data-h="tl" style="left:0;top:0"></span><span class="crop-h" data-h="tr" style="left:100%;top:0"></span>
          <span class="crop-h" data-h="bl" style="left:0;top:100%"></span><span class="crop-h" data-h="br" style="left:100%;top:100%"></span></div></div>
      <div class="crop-actions"><button type="button" class="btn btn-sec" id="cropCancel">Annulla</button>
        <button type="button" class="btn btn-sec" id="cropFull">Tutta la foto</button>
        <button type="button" class="btn btn-sec" id="cropRot" aria-label="Ruota la foto di 90 gradi">↻</button>
        <button type="button" class="btn btn-teal" id="cropGo">Leggi</button></div>
      <p class="crop-foot">Il ritaglio si può disattivare in Setup.</p></div>`;
    const stage = $('cropStage'), img = $('cropImg'), el = $('cropBox');
    let fit = { x: 0, y: 0, w: 1, h: 1 };
    const MIN = 0.06;
    const layout = () => {
      const sw = stage.clientWidth, sh = stage.clientHeight, iw = photo.w || img.naturalWidth || 1, ih = photo.h || img.naturalHeight || 1;
      const sc = Math.min(sw / iw, sh / ih); fit = { w: iw * sc, h: ih * sc, x: (sw - iw * sc) / 2, y: (sh - ih * sc) / 2 };
      Object.assign(img.style, { left: fit.x + 'px', top: fit.y + 'px', width: fit.w + 'px', height: fit.h + 'px' });
      draw();
    };
    const draw = () => {
      if (!$('cropGuide') || !$('cropGo')) return; // crop closed meanwhile (late resize/load)
      Object.assign(el.style, { left: (fit.x + box.l * fit.w) + 'px', top: (fit.y + box.t * fit.h) + 'px', width: ((box.r - box.l) * fit.w) + 'px', height: ((box.b - box.t) * fit.h) + 'px' });
      $('cropGuide').classList.toggle('hidden', box.b - box.t > 0.7);
      $('cropGo').textContent = box.l <= 0.01 && box.t <= 0.01 && box.r >= 0.99 && box.b >= 0.99 ? 'Leggi tutta la foto' : 'Leggi riquadro';
    };
    const pt = (e) => { const rc = stage.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - rc.left - fit.x) / fit.w)), y: Math.max(0, Math.min(1, (e.clientY - rc.top - fit.y) / fit.h)) }; };
    let drag = null;
    stage.addEventListener('pointerdown', (e) => {
      e.preventDefault(); const p = pt(e), h = e.target.closest('.crop-h');
      if (h) drag = { mode: h.dataset.h };
      else if (p.x > box.l && p.x < box.r && p.y > box.t && p.y < box.b && e.target.closest('#cropBox')) drag = { mode: 'move', p0: p, b0: Object.assign({}, box) };
      else drag = { mode: 'new', p0: p };
      try { stage.setPointerCapture(e.pointerId); } catch (er) {}
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) return; e.preventDefault(); const p = pt(e);
      if (drag.mode === 'move') {
        const w = drag.b0.r - drag.b0.l, h = drag.b0.b - drag.b0.t;
        const l = Math.max(0, Math.min(1 - w, drag.b0.l + p.x - drag.p0.x)), t = Math.max(0, Math.min(1 - h, drag.b0.t + p.y - drag.p0.y));
        Object.assign(box, { l, t, r: l + w, b: t + h });
      } else if (drag.mode === 'new') {
        if (Math.abs(p.x - drag.p0.x) < 0.02 && Math.abs(p.y - drag.p0.y) < 0.02) return;
        Object.assign(box, { l: Math.min(p.x, drag.p0.x), r: Math.max(p.x, drag.p0.x), t: Math.min(p.y, drag.p0.y), b: Math.max(p.y, drag.p0.y) });
      } else {
        if (drag.mode[1] === 'l') box.l = Math.min(p.x, box.r - MIN); else box.r = Math.max(p.x, box.l + MIN);
        if (drag.mode[0] === 't') box.t = Math.min(p.y, box.b - MIN); else box.b = Math.max(p.y, box.t + MIN);
      }
      draw();
    });
    const end = () => {
      if (drag && drag.mode === 'new' && (box.r - box.l < MIN || box.b - box.t < MIN)) Object.assign(box, FULL_BOX()); // a tap, not a drag
      drag = null; draw();
    };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    img.onload = layout; img.src = photo.img; if (img.complete) layout();
    window.addEventListener('resize', layout, { once: true });
    $('cropCancel').onclick = cancelCrop;
    $('cropRot').onclick = async () => { haptic(10); if (await setPhotoRot(((photo.rot || 0) + 90) % 360)) { closeCrop(); openCrop(lastPhoto); } };
    $('cropFull').onclick = () => { Object.assign(box, FULL_BOX()); draw(); };
    $('cropGo').onclick = () => { haptic(15); const b = Object.assign({}, box); closeCrop(); sendCrop(b); };
    document.addEventListener('keydown', cropKey);
    return box;
  }
  /** Native: photo ready (preview + size) → crop step, or straight to OCR when the step is off. */
  window.__onOcrPhoto = function (m) {
    if (!m || m.ok === false) { window.__onOcrResult(m || { ok: false }); return; }
    lastPhoto = { img: m.img, w: m.w, h: m.h, box: FULL_BOX() };
    if (prefs.cropOff) { sendCrop(FULL_BOX()); return; }
    openCrop(lastPhoto);
  };
  function updateCropRow() {
    const on = !prefs.cropOff;
    const lab = $('cropLabel'); if (lab) lab.textContent = on ? 'On · scegli le righe da leggere' : 'Off · legge tutta la foto';
    const tog = $('cropToggle'); if (tog) tog.classList.toggle('on', on);
  }
  if ($('btnCropStep')) $('btnCropStep').addEventListener('click', () => { prefs.cropOff = !prefs.cropOff; savePrefs(prefs); updateCropRow(); toast(prefs.cropOff ? 'Ritaglio foto OFF' : 'Ritaglio foto ON'); });
  updateCropRow();

  // Beta 0.4.1: remember what the photo is for, so a WebView reloaded while the camera was open
  // (activity killed) still routes the result correctly; stale flags never survive a new Calcolo photo.
  const PURPOSE_KEY = 'rweb_photo_purpose';
  function savePhotoPurpose() {
    const p = pendingJob ? (pendingJob.seriesOnly ? 'serie' : 'job') : pendingInt ? 'int' : pendingFem ? 'fem' : 'calc';
    try { localStorage.setItem(PURPOSE_KEY, JSON.stringify({ p, machineName: pendingJob ? pendingJob.machineName : null, t: Date.now() })); } catch (e) {}
  }
  function clearPhotoPurpose() { try { localStorage.removeItem(PURPOSE_KEY); } catch (e) {} }
  function restorePhotoPurpose() {
    let o = null; try { o = JSON.parse(localStorage.getItem(PURPOSE_KEY) || 'null'); } catch (e) {}
    if (!o || !(Date.now() - o.t < 20 * 60 * 1000)) { clearPhotoPurpose(); return; }
    if (o.p === 'job') pendingJob = { machineName: o.machineName };
    else if (o.p === 'serie') pendingJob = { machineName: o.machineName, seriesOnly: true };
    else if (o.p === 'int') pendingInt = true;
    else if (o.p === 'fem') pendingFem = true;
  }
  restorePhotoPurpose();
  function openFoto(mode) {
    lastPhoto = null; savePhotoPurpose();
    if (hasNativeOcr()) { try { RettificaAndroid.startOcr(mode || 'camera'); } catch (e) { showCameraProblem(); } return; }
    if (window.RETTIFICA_WEB) { webPhoto(mode); return; }
    const raw = prompt('Nell\'APK: ML Kit offline.\n\nIncolla testo OCR per test:');
    if (raw == null || !String(raw).trim()) { pendingJob = null; return; } applyOcrText(raw);
  }
  function applyOcrText(raw) {
    let parsed;
    if (typeof parseElencoText === 'function') parsed = parseElencoText(raw);
    else {
      parsed = { S1A: null, F1A: null, G1A: null, paired: null, header: {}, lowConfidence: [] };
      const mS = String(raw).match(/S1A[^\d\-]*([\d]+[,.]\d+)/i);
      const mF = String(raw).match(/F1A[^\d\-]*([\d]+[,.]\d+)/i);
      const mG = String(raw).match(/G1A[^\d\-]*(\-?[\d]+[,.]\d+)/i);
      if (mS) parsed.S1A = parseFloat(mS[1].replace(',', '.'));
      if (mF) parsed.F1A = parseFloat(mF[1].replace(',', '.'));
      if (mG) parsed.G1A = parseFloat(mG[1].replace(',', '.'));
      const ml = String(raw).match(/Lotto\s*[:.]?\s*(\d+)/i); if (ml) parsed.header.lotto = ml[1];
    }
    if (FG && !(parsed && (parsed.S1A != null || parsed.F1A != null || parsed.G1A != null)) && FG.foglioScore(raw).isFoglio) { pendingInt = false; pendingFem = false; openSheetConfirm(FG.parseFoglioText(raw)); return; }
    openOcrConfirm(parsed);
  }
  function pickSeriesForPhoto(parsed) {
    return pickSeriesForValues(state.series, { S: parsed.S1A, F: parsed.F1A, nominal: parsed.baseSource === 'foto' ? parsed.base : null }, prefs.seriesId);
  }
  /** Does this series match what the photo says? (nominal printed, or S close to its base) */
  function photoMatchesSeries(parsed, ser) {
    if (!ser) return false;
    if (parsed.baseSource === 'foto' && parsed.base != null) return Math.abs(ser.base - parsed.base) < 0.0005;
    const ref = parsed.S1A != null ? parsed.S1A : parsed.F1A;
    return ref != null && Math.abs(ref - ser.base) <= seriesTol(ser) + 1e-9;
  }
  /**
   * v2.0.3 «Nuovo lavoro» photo = SETUP ONLY: read & store the job data (machine, base, tol, gioco, codice, lotto).
   * No pairing, no plausibility block, no verdict. Every field editable; empty is allowed; Salva never blocks.
   */
  function openJobSetup(parsed) {
    const f = jobSetupFromParsed(parsed || {}, pendingJob ? pendingJob.machineName : (myMachine() || {}).name);
    const v = (x, fmt) => (x == null ? '' : esc(fmt ? fmt(x) : String(x)));
    const fld = (id, label, val, mode, ph, cls) => `<div class="js-f"><label for="${id}">${label}</label><input id="${id}" class="big-input cond${val === '' ? ' empty' : ''}${cls ? ' ' + cls : ''}" inputmode="${mode}" value="${val}" placeholder="${esc(ph || '')}" autocomplete="off"/></div>`;
    const tolStr = (t) => fmtMm3(t).replace(/0+$/, '').replace(/,$/, ',0');
    const serOnly = !!(pendingJob && pendingJob.seriesOnly); // «Nuova serie» from the photo: same sheet reading, no job
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal job-setup" id="jobSetup">
      <h2>${serOnly ? 'Nuova serie' : 'Nuovo lavoro'} · dati dal foglio</h2>
      <p class="meta js-sub">${serOnly ? 'Controlla e correggi base, tolleranza e gioco: servono per la serie. Il lavoro in corso non cambia.' : 'Controlla e correggi. Se un campo è vuoto scrivilo tu (o lascialo vuoto). Nessun calcolo qui: dopo scrivi le misure dei pezzi.'}</p>
      ${serOnly ? `<input type="hidden" id="jsMach" value="${v(f.machineName)}"/>` : fld('jsMach', 'Macchina', v(f.machineName), 'text', 'es. S33 O060')}
      <div class="field-row">${fld('jsBase', 'Nominale / base mm', v(f.base, fmtMm3), 'decimal', 'es. 18,000')}${fld('jsTol', 'Tolleranza ± mm', v(f.tol, tolStr), 'decimal', '0,1')}</div>
      ${f.base == null && f.baseGuess != null ? `<button type="button" class="chip js-guess" id="jsGuess">Usa base ${esc(fmtMm3(f.baseGuess))}? <small>(dalla misura letta)</small></button>` : ''}
      <label class="js-gl">Gioco µm (riga G)</label>
      <div class="field-row">${fld('jsGmin', 'min', v(f.gmin), 'numeric', 'es. 8')}${fld('jsGmax', 'max', v(f.gmax), 'numeric', 'es. 11')}</div>
      <div class="field-row">${fld('jsCod', 'Codice', v(f.codice), 'text', '')}${fld('jsLotto', 'Lotto', v(f.lotto), 'text', '')}</div>
      <div class="meta js-plan" id="jsPlan"></div>
      <div id="jsErr" class="form-err hidden"></div>
      ${lastPhoto ? '<button type="button" class="btn btn-sec js-recrop" id="jsRecrop">✂ Ritaglia di nuovo</button>' : ''}
      <div class="actions js-act"><button type="button" class="btn btn-sec" id="jsCancel">Annulla</button>
      <button type="button" class="btn btn-primary" id="jsSave">${serOnly ? '✓ Salva serie' : '✓ Salva lavoro'}</button></div></div></div>`;
    const read = () => ({ machineName: $('jsMach').value.replace(/\s+/g, ' ').trim(), base: setupNum($('jsBase').value), tol: (() => { const t = setupNum($('jsTol').value); return t != null && t > 0 && t < 5 ? t : null; })(),
      gmin: setupInt($('jsGmin').value), gmax: setupInt($('jsGmax').value), codice: $('jsCod').value.trim(), lotto: $('jsLotto').value.trim() });
    const showPlan = () => {
      const r = read(), pl = planJobSetup(state.series, r), el = $('jsPlan');
      document.querySelectorAll('#jobSetup .big-input').forEach((i) => i.classList.toggle('empty', !i.value.trim()));
      el.textContent = pl.action === 'create' ? `Nuova serie Base ${fmtMm3(pl.base)} · gioco ${pl.gioco.min}–${pl.gioco.max} µm · tol ±${tolStr(pl.tol)}`
        : pl.action === 'use' ? `Serie Base ${fmtMm3(pl.base)}${pl.gioco ? ' · gioco ' + pl.gioco.min + '–' + pl.gioco.max + ' µm' : ' · gioco ' + pl.series.giocoMin + '–' + pl.series.giocoMax + ' µm'}${pl.changes ? ' (aggiornata dal foglio)' : ''}`
        : serOnly ? (pl.reason === 'base' ? 'Scrivi la base (mm) della serie.' : 'Scrivi gioco min e max (µm) della serie.')
        : pl.reason === 'base' ? 'Base vuota: la scegli dopo in Calcolo (serie).' : 'Gioco vuoto: lo completi dopo in Calcolo (serie).';
    };
    document.querySelectorAll('#jobSetup input').forEach((i) => i.addEventListener('input', showPlan));
    let jsLav = 'maschio';
    document.querySelectorAll('#jobSetup [data-jslav]').forEach((b) => { b.onclick = () => { haptic(12); jsLav = b.dataset.jslav;
      document.querySelectorAll('#jobSetup [data-jslav]').forEach((x) => x.classList.toggle('on', x === b)); }; });
    if ($('jsGuess')) $('jsGuess').onclick = () => { $('jsBase').value = fmtMm3(f.baseGuess); $('jsGuess').remove(); showPlan(); };
    showPlan();
    const cancel = () => { $('modalRoot').innerHTML = ''; lastPhoto = null; try { if (window.RettificaAndroid && RettificaAndroid.ocrCancel) RettificaAndroid.ocrCancel(); } catch (e) {} toast(pjCancelMsg()); pendingJob = null; };
    $('jsCancel').onclick = cancel;
    if ($('jsRecrop')) $('jsRecrop').onclick = () => { $('modalRoot').innerHTML = ''; if (lastPhoto) openCrop(lastPhoto, lastPhoto.box); };
    $('jsSave').onclick = () => {
      haptic(20);
      const r = read(); const pl = planJobSetup(state.series, r);
      if (serOnly && pl.action !== 'create' && pl.action !== 'use') { const er = $('jsErr'); er.textContent = pl.reason === 'base' ? 'Scrivi la base (mm): serve per la serie.' : 'Scrivi gioco min e max (µm): servono per la serie.'; er.classList.remove('hidden'); haptic(60); return; }
      let ser = null, note = '';
      if (pl.action === 'create') {
        ser = { id: uid(), machineId: myMachine() ? myMachine().id : null, name: 'Base ' + fmtMm3(pl.base), lotto: r.lotto, notes: serOnly ? 'Creata dal foglio (Nuova serie)' : 'Creata dal foglio (Nuovo lavoro)',
          base: pl.base, tolleranza: pl.tol, giocoMin: pl.gioco.min, giocoMax: pl.gioco.max, history: [], stock: {} };
        state.series.push(ser); note = 'Nuova serie Base ' + fmtMm3(ser.base);
      } else if (pl.action === 'use') {
        ser = pl.series;
        if (lockedNow(ser)) { if (pl.gioco || pl.tol != null) toast('Serie bloccata dal PIN: quote non cambiate', 'warn'); } else {
        if (pl.gioco) { ser.giocoMin = pl.gioco.min; ser.giocoMax = pl.gioco.max; }
        if (pl.tol != null) ser.tolleranza = pl.tol; }
      }
      if (serOnly) {
        if (pl.action === 'create' && r.codice) ser.codice = r.codice.slice(0, 40);
        pendingJob = null; lastPhoto = null; saveData(state); $('modalRoot').innerHTML = '';
        setContext(null, ser.id, false); fillSetupSelects(); renderSeriesIfOpen(); newMeasure(); showPage('calc');
        toast(`${pl.action === 'create' ? 'Nuova serie' : 'Serie'} Base ${fmtMm3(ser.base)} · gioco ${ser.giocoMin}–${ser.giocoMax} µm · scrivi la misura`);
        return;
      }
      const name = r.machineName || (pendingJob && pendingJob.machineName) || (myMachine() || {}).name || 'Macchina';
      pendingJob = null; lastPhoto = null;
      const j = startJob({ machineName: name, series: ser || null, codice: r.codice, lotto: r.lotto });
      if (!ser && pl.base != null) j.base = pl.base;
      if (!ser) { j.giocoMin = r.gmin; j.giocoMax = r.gmax; }
      if (j.fem) delete j.fem.auto;
      saveData(state);
      $('modalRoot').innerHTML = '';
      newMeasure(); showPage('calc');
      if (ser) toast(`Lavoro ${j.machineName} · Base ${fmtMm3(ser.base)} · gioco ${ser.giocoMin}–${ser.giocoMax} µm · scrivi la misura`);
      else { toast(`Lavoro ${j.machineName} salvato · ${pl.reason === 'base' ? 'scegli la serie (base)' : 'completa il gioco della serie'}`, 'warn'); }
      if (note && ser) { /* series created from the sheet */ }
      // Beta 0.4.1: the sheet also has the measures → same MASCHIO / FEMMINA choice, straight to the calculation
      if (ser && parsed && (parsed.S1A != null || parsed.F1A != null)) openPhotoChoice(Object.assign({}, parsed, { _lavoro: null, _afterJob: true }));
    };
  }
  // ── Beta 0.4.0: one photo flow → «Lavoro il MASCHIO» or «Lavoro la FEMMINA (interno)» ──
  function photoChoiceKey() { return (jobsOn && prefs.jobId) || '_nojob'; }
  function lastPhotoChoice() { return (prefs.photoLavoro || {})[photoChoiceKey()] || null; }
  function rememberPhotoChoice(v) { prefs.photoLavoro = prefs.photoLavoro || {}; prefs.photoLavoro[photoChoiceKey()] = v; savePrefs(prefs); }
  function openPhotoChoice(parsed) {
    const last = lastPhotoChoice(), S = parsed.S1A, F = parsed.F1A;
    const nominal = parsed.baseSource === 'foto' && parsed.base != null ? parsed.base : null;
    const gTxt = parsed.giocoMin != null && parsed.giocoMax != null ? `gioco ${parsed.giocoMin}–${parsed.giocoMax} µm` : 'gioco non letto';
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal photo-choice" id="photoChoice" role="dialog" aria-modal="true">
      <h2>${parsed._afterJob ? 'Lavoro salvato · cosa lavori?' : 'Cosa stai lavorando?'}</h2>
      <p class="meta">${nominal != null ? 'Nominale ' + esc(fmtMm3(nominal)) + ' · ' : ''}${esc(gTxt)}${last ? ' · ultima scelta evidenziata' : ''}</p>
      <button type="button" class="pc-btn pc-m ${last === 'maschio' ? 'last' : ''}" id="pcMaschio">${last === 'maschio' ? '<span class="pc-last">ultima scelta</span>' : ''}<b>Lavoro il MASCHIO</b>
        <span>misura <b>S1A</b> ${S != null ? esc(fmtMm4(S)) + ' mm' : '— non letta'}</span><small>pezzo femmina numerato, misura femmina, correzione</small></button>
      <button type="button" class="pc-btn pc-f ${last === 'interno' ? 'last' : ''}" id="pcFemmina">${last === 'interno' ? '<span class="pc-last">ultima scelta</span>' : ''}<b>Lavoro la FEMMINA (interno)</b>
        <span>foro <b>F1A</b> ${F != null ? esc(fmtMm4(F)) + ' mm' : '— non letto'}</span><small>quota da S1A + gioco (o nominale ± tol), stretto/largo, correzione</small></button>
      <button type="button" class="btn btn-sec" id="pcCancel" style="width:100%;min-height:52px;margin-top:6px">${parsed._afterJob ? 'Solo lavoro · scrivo la misura' : 'Annulla'}</button></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('pcCancel').onclick = () => { close(); if (!parsed._afterJob) toast('Foto annullata'); };
    $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') { close(); toast('Foto annullata'); } };
    $('pcMaschio').onclick = () => { haptic(20); rememberPhotoChoice('maschio'); close(); parsed._lavoro = 'maschio'; openOcrConfirm(parsed); };
    $('pcFemmina').onclick = () => { haptic(20); rememberPhotoChoice('interno'); close(); photoToInterno(parsed); };
  }
  /** FEMMINA (interno): same series/nominal choice as the MASCHIO path, then the Interno page with F1A as the bore. */
  function photoToInterno(parsed) {
    const nominal = parsed.baseSource === 'foto' && parsed.base != null ? parsed.base : null;
    const plan = planPhotoSeries(state.series, { S: parsed.S1A, F: parsed.F1A, nominal, tol: parsed.tolleranza, gmin: parsed.giocoMin, gmax: parsed.giocoMax }, prefs.seriesId);
    let ser = plan.series || null;
    if (!ser && plan.action === 'create' && plan.base != null && plan.gmin != null && plan.gmax != null) {
      ser = state.series.find((x) => Math.abs(x.base - plan.base) < 0.0005) || null;
      if (!ser) { ser = { id: uid(), machineId: myMachine() ? myMachine().id : null, name: 'Base ' + fmtMm3(plan.base), lotto: (parsed.header && parsed.header.lotto) || '', notes: 'Creata dalla foto',
        base: round4(plan.base), tolleranza: plan.tol != null ? plan.tol : 0.1, giocoMin: plan.gmin, giocoMax: plan.gmax, history: [], stock: {} }; state.series.push(ser); saveData(state); }
    }
    if (ser && (!currentContext().series || currentContext().series.id !== ser.id)) setContext(null, ser.id, false);
    intFromPhoto(parsed);
  }
  function openOcrConfirm(parsed) {
    clearPhotoPurpose();
    if (pendingInt) { pendingInt = false; intFromPhoto(parsed); return; } // Beta 0.3.0 Interno
    if (pendingFem) { pendingFem = false; femFromPhoto(parsed); return; } // v2.0.6 Adatta alla femmina
    if (pendingJob) { openJobSetup(parsed); return; } // v2.0.3: «Nuovo lavoro» photo = setup only
    if (!parsed._lavoro) { openPhotoChoice(parsed); return; } // Beta 0.4.0: MASCHIO or FEMMINA (interno) first
    const S = parsed.S1A, F = parsed.F1A, G = parsed.G1A;
    const useF = lavoroMode() === 'femmina'; // v2.0.4: Femmina fatta → the photo's F1A is the measure
    const nominal = parsed.baseSource === 'foto' && parsed.base != null ? parsed.base : null;
    const plan = planPhotoSeries(state.series, { S, F, nominal, tol: parsed.tolleranza, gmin: parsed.giocoMin, gmax: parsed.giocoMax }, prefs.seriesId);
    const NEW = '__new';
    const startId = plan.action === 'create' ? NEW : (plan.series ? plan.series.id : (currentContext().series || {}).id);
    const ser0 = startId === NEW ? null : seriesById(startId);
    const base0 = startId === NEW ? plan.base : (ser0 ? ser0.base : null);
    const paired = parsed.paired != null ? parsed.paired : (F != null && base0 != null ? Math.abs(F - base0) <= 0.05 : null);
    const newOpt = plan.action === 'create' ? `<option value="${NEW}" selected>＋ Nuova serie Base ${fmtMm3(plan.base)} (dalla foto)</option>` : '';
    const seriesOpts = newOpt + state.series.map((s) =>
      `<option value="${esc(s.id)}" ${startId === s.id ? 'selected' : ''}>Base ${fmtMm3(s.base)} · gioco ${s.giocoMin}–${s.giocoMax}</option>`).join('');
    const gUm = G != null ? round1(G * 1000) : null;
    const fromPhoto = parsed.giocoMin != null && parsed.giocoMax != null;
    const gMin0 = plan.gmin != null ? plan.gmin : (ser0 ? ser0.giocoMin : '');
    const gMax0 = plan.gmax != null ? plan.gmax : (ser0 ? ser0.giocoMax : '');
    // idea 7: paired photo → verdict straight from the G row
    let pairedBox = '';
    const gi = interpretG(G, paired ? F : null, paired ? S : null); // Beta 0.8.1: G with its own sign, gioco = F − S, never flipped silently
    if (paired && gUm != null && fromPhoto && !useF && gi.giocoUm != null) {
      const gap = gi.giocoUm, ok = !gi.interferenza && gap >= parsed.giocoMin - 0.05 && gap <= parsed.giocoMax + 0.05;
      pairedBox = `<div class="paired-verdict ${ok ? 'ok' : 'no'}">Pezzo già accoppiato · gioco di accoppiamento ${esc((gap > 0 ? '+' : gap < 0 ? '−' : '') + fmtUm(Math.abs(gap)))} µm → <b>${gi.interferenza ? 'INTERFERENZA' : ok ? 'GIOCO CONFORME' : 'FUORI GIOCO'}</b> <span>(${parsed.giocoMin}–${parsed.giocoMax} µm)</span><small class="pv-g">${esc(gi.note)}</small></div>`;
    }
    const needCheck = !!(parsed._ai || ['S1A', 'F1A', 'G1A'].some((k) => parsed.rows && parsed.rows[k] && parsed.rows[k].value != null && parsed.rows[k].confidence < 0.8));
    const sg = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmtUm(Math.abs(x));
    const mNow = myMachine(), jNow = pendingJob ? { machineName: pendingJob.machineName } : (jobsOn ? activeJob() : null);
    const tolPh = parsed.tolleranza != null ? parsed.tolleranza : null;
    const ocrSum = `<div class="ocr-sum" id="ocrSum">
      <div>Macchina <b>${esc((pendingJob && pendingJob.machineName) || (mNow && mNow.name) || '—')}</b> · Lavoro <b>${esc(jNow ? (jNow.name || jNow.machineName || '—') : 'nessuno')}</b></div>
      <div>Nominale <b>${nominal != null ? esc(fmtMm3(nominal)) + ' mm' : 'non letto'}</b>${tolPh != null ? ' · tolleranza <b>±' + esc(fmtMm3(tolPh)) + ' mm</b>' : ''}</div>
      <div>Gioco min/max <b>${fromPhoto ? parsed.giocoMin + '–' + parsed.giocoMax + ' µm' : 'non letti (uso la serie)'}</b></div>
      <div>S (maschio) <b>${S != null ? esc(fmtMmS(S)) + ' mm' : '—'}</b> · F (foro) <b>${F != null ? esc(fmtMmS(F)) + ' mm' : '—'}</b></div>
      <div>G letto dallo strumento <b class="${gUm != null && gUm < 0 ? 'neg' : ''}">${gUm != null ? esc(sg(gUm)) + ' µm' : '—'}</b> <span class="meta">(segno originale)</span></div>
      ${gi.giocoUm != null ? `<div>Gioco di accoppiamento F − S <b class="${gi.interferenza ? 'intf' : ''}">${esc(sg(gi.giocoUm))} µm</b>${gi.interferenza ? ' <span class="intf">INTERFERENZA</span>' : ' (positivo = gioco)'}${gi.dedotto ? ' <span class="meta">dedotto da G, da controllare</span>' : ''}</div>` : ''}
      <div class="meta">Diametri in mm · scostamenti e giochi in µm.</div></div>`;
    if (plan.action === 'update' && plan.series) plan.note = `Base ${fmtMm3(plan.series.base)} letta dalla foto · il foglio ha gioco ${plan.gmin}–${plan.gmax} µm, la serie ${plan.series.giocoMin}–${plan.series.giocoMax} µm: scegli sotto`;
    const planNote = (plan.action === 'block' || !plan.note ? '' :
      `<div class="photo-note ${plan.action === 'create' || plan.action === 'update' ? 'new' : ''}" id="ocrPlanNote">${esc(plan.note)}</div>`) +
      ((parsed.notes || []).length ? `<div class="photo-note warn" id="ocrParseNote">${parsed.notes.map(esc).join('<br>')}</div>` : '');
    const lowCls = (k) => (parsed.rows && parsed.rows[k] && parsed.rows[k].value != null && parsed.rows[k].confidence < 0.8 ? ' class="low"' : '');
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ocr-confirm">
      <h2>${pendingJob ? 'Nuovo lavoro · ' + esc(pendingJob.machineName) : 'Conferma lettura foto'}</h2>
      ${pairedBox || `<div class="typo-box" style="margin-bottom:8px">${paired === false ? 'Non ancora accoppiato → useremo S1A' : (paired ? 'Accoppiato' : 'Verifica i valori')}</div>`}
      ${ocrSum}
      ${planNote}
      ${needCheck ? `<label class="chk-big" id="ocrCheckRow"><input type="checkbox" id="ocrChecked"/><span>Ho controllato i valori sullo schermo della macchina${parsed._ai ? ' (letti con AI)' : ' (alcuni letti male)'}</span></label>` : ''}
      <div id="ocrWarn" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin:10px 0 4px"><button type="button" class="btn btn-sec" id="ocrCancel" style="flex:1">Annulla</button>
      <button type="button" class="btn btn-teal" id="ocrGo" style="flex:1.6">${pairedBox && (useF ? F : S) == null ? 'OK' : 'Conferma e calcola'}</button></div>
      ${lastPhoto ? '<button type="button" class="btn btn-sec" id="ocrRecrop" style="width:100%;margin:4px 0">✂ Ritaglia di nuovo</button>' : ''}
      ${lastPhoto && FG ? '<button type="button" class="btn btn-sec" id="ocrRotate" style="width:100%;margin:4px 0">↻ Ruota foto e rileggi</button>' : ''}
      ${lastPhoto && AI ? (() => { const c = AI.cfgOf(prefs), why = !c.vision ? c.label + ' non legge le foto: scegli Gemini, OpenRouter, Qwen o xAI in Setup' : (!AI.hasKey(c.provider) ? 'Manca la chiave API (Setup → Intelligenza artificiale)' : '');
        return `<button type="button" class="btn btn-sec ai-photo ${why ? 'off' : ''}" id="ocrAi" data-why="${esc(why)}" style="width:100%;margin:4px 0;min-height:52px">✨ Leggi foto con AI</button>${why ? `<p class="meta ai-why" id="ocrAiWhy">${esc(why)}</p>` : ''}`; })() : ''}
      <label>Serie</label><select id="ocrSeries">${seriesOpts}</select>
      <label id="ocrGLbl">${fromPhoto ? `Gioco ${parsed.giocoMin}–${parsed.giocoMax} µm (dalla foto)` : 'Gioco µm · riga G non trovata, uso quello della serie'}</label>
      <div class="field-row" id="ocrGRow"><div><input id="ocrGmin" inputmode="numeric" aria-label="Gioco minimo µm" value="${esc(String(gMin0))}"${fromPhoto ? '' : ' class="low"'}/></div>
      <div><input id="ocrGmax" inputmode="numeric" aria-label="Gioco massimo µm" value="${esc(String(gMax0))}"${fromPhoto ? '' : ' class="low"'}/></div></div>
      <div id="ocrGSave" class="hidden" style="margin-top:8px"><div class="meta" id="ocrGSaveTxt"></div>
        <div class="apply-choice" id="ocrApply"><label id="ocrApJobL" class="on"><input type="radio" name="ocrAp" id="ocrApJob" value="job" checked/><span>Applica solo a questo lavoro</span></label>
        <label id="ocrApSerL"><input type="radio" name="ocrAp" id="ocrApSer" value="serie"/><span>Aggiorna anche la serie</span></label></div></div>
      <div id="ocrGNoSave" class="meta hidden" style="margin-top:6px"></div>
      <div class="field-row"><div><label>S1A maschio (mm)${useF ? '' : ' · <b>misura usata</b>'}</label><input id="ocrS" inputmode="decimal" value="${S != null ? esc(fmtMmS(S)) : ''}"${lowCls('S1A')}/></div>
      <div><label>F1A foro (mm)${useF ? ' · <b>femmina usata</b>' : ''}</label><input id="ocrF" inputmode="decimal" value="${F != null ? esc(fmtMmS(F)) : ''}"${lowCls('F1A')}/></div></div>
      <div><label>G letto dallo strumento · G1A (µm, segno originale)</label><input id="ocrG" value="${gUm != null ? esc(fmtUm(gUm)) : ''}"${lowCls('G1A')}/></div>
      <div class="field-row"><div><label>Codice</label><input id="ocrCod" value="${esc((parsed.header && parsed.header.codice) || '')}"/></div>
      <div><label>Lotto</label><input id="ocrLotto" value="${esc((parsed.header && parsed.header.lotto) || '')}"/></div></div>
      </div></div>`;
    if ($('ocrAi')) $('ocrAi').onclick = () => aiReadPhoto(parsed);
    const warn = (t) => { const w = $('ocrWarn'); w.innerHTML = t; w.classList.toggle('hidden', !t); };
    const readG = () => {
      const a = parseGiocoInt($('ocrGmin').value), b = parseGiocoInt($('ocrGmax').value);
      if (a == null || b == null) return null;
      return { min: Math.min(a, b), max: Math.max(a, b) };
    };
    // target the measures are checked against: the selected series, or the new one from the photo
    const target = () => {
      const sid = $('ocrSeries').value;
      if (sid === NEW) return { isNew: true, base: plan.base, tol: plan.tol != null ? plan.tol : 0.1, ser: null };
      const ser = seriesById(sid); if (!ser) return null;
      return { isNew: false, base: ser.base, tol: seriesTol(ser), ser };
    };
    // the photo is the truth for its own series: new series, or the existing series with the photo base
    const photoOwns = (t) => !!t && (t.isNew || (nominal != null && plan.series && t.ser && t.ser.id === plan.series.id && (plan.action === 'update' || plan.action === 'use')));
    let gTouched = false, warned = false, applyJobOnly = false;
    const refreshGSave = () => {
      const t = target(), g = readG(), box = $('ocrGSave'), ns = $('ocrGNoSave');
      ns.classList.add('hidden'); box.classList.add('hidden');
      if (!t || !g) return;
      if (t.isNew) { ns.textContent = `Verrà creata la serie Base ${fmtMm3(t.base)} · gioco ${g.min}–${g.max} µm · tol ±${fmtMm3(t.tol)}`; ns.classList.remove('hidden'); return; }
      const ser = t.ser;
      if (g.min === ser.giocoMin && g.max === ser.giocoMax) return;
      if (!photoOwns(t) && !photoMatchesSeries(parsed, ser)) { // never write the photo's gioco into a series that does not match the photo
        ns.textContent = `Il gioco ${g.min}–${g.max} µm vale solo per questo calcolo: la Base ${fmtMm3(ser.base)} non corrisponde alla foto.`; ns.classList.remove('hidden'); return;
      }
      $('ocrGSaveTxt').textContent = `Il foglio dice gioco ${g.min}–${g.max} µm, la serie Base ${fmtMm3(ser.base)} ha ${ser.giocoMin}–${ser.giocoMax} µm. Scegli:`;
      box.classList.remove('hidden');
    };
    const checkPlaus = () => {
      const t = target(); warned = false; $('ocrGo').textContent = pairedBox && parseMmNumber($(useF ? 'ocrF' : 'ocrS').value) == null ? 'OK' : 'Conferma e calcola';
      const sv = parseMmNumber($(useF ? 'ocrF' : 'ocrS').value);
      if (!t || sv == null) { warn(''); return; }
      const dist = Math.abs(sv - t.base);
      if (dist > hardLimitMm(t.tol)) warn(`S ${esc(fmtMmS(sv))} è troppo lontano dalla Base ${esc(fmtMm3(t.base))} (${esc(fmtUm(round1((sv - t.base) * 1000)))} µm): scegli la serie giusta.`);
      else if (dist > t.tol + 1e-9) warn(`S ${esc(fmtMmS(sv))} è fuori tolleranza per Base ${esc(fmtMm3(t.base))}: controlla.`);
      else warn('');
    };
    $('ocrSeries').addEventListener('change', () => {
      const t = target();
      if (!fromPhoto && !gTouched && t && t.ser) { $('ocrGmin').value = t.ser.giocoMin; $('ocrGmax').value = t.ser.giocoMax; }
      refreshGSave(); checkPlaus();
    });
    ['ocrGmin', 'ocrGmax'].forEach((id) => $(id).addEventListener('input', () => { gTouched = true; refreshGSave(); }));
    ['ocrApJob', 'ocrApSer'].forEach((id) => $(id).addEventListener('change', () => { $('ocrApJobL').classList.toggle('on', $('ocrApJob').checked); $('ocrApSerL').classList.toggle('on', $('ocrApSer').checked); }));
    $('ocrS').addEventListener('input', checkPlaus); $('ocrF').addEventListener('input', checkPlaus);
    refreshGSave(); checkPlaus();
    if (plan.action === 'block' && S != null) warn(esc(plan.note));
    $('ocrCancel').onclick = () => { $('modalRoot').innerHTML = ''; lastPhoto = null; try { if (window.RettificaAndroid && RettificaAndroid.ocrCancel) RettificaAndroid.ocrCancel(); } catch (e) {} if (pendingJob) { toast(pjCancelMsg()); pendingJob = null; } };
    if ($('ocrRotate')) $('ocrRotate').onclick = () => { haptic(12); rotateReread(); };
    if ($('ocrRecrop')) $('ocrRecrop').onclick = () => { $('modalRoot').innerHTML = ''; if (lastPhoto) openCrop(lastPhoto, lastPhoto.box); };
    $('ocrGo').onclick = () => {
      const t = target();
      if (!t) { warn('Scegli una serie'); return; }
      if (needCheck && !$('ocrChecked').checked) { warn('Valori non sicuri: controllali sullo schermo e spunta «Ho controllato i valori». L\'app non calcola su valori indovinati.'); haptic(60); return; }
      const g = readG();
      if (!g || g.min < 0 || g.max > 100 || g.max - g.min < 1) { warn('Gioco non valido: numeri interi in µm (es. 7 e 10)'); return; }
      const sv = parseMmNumber($(useF ? 'ocrF' : 'ocrS').value);
      if (sv != null) {
        const dist = Math.abs(sv - t.base);
        if (dist > hardLimitMm(t.tol)) { checkPlaus(); haptic(60); return; }
        if (dist > t.tol + 1e-9 && !warned) { checkPlaus(); warned = true; $('ocrGo').textContent = 'Conferma comunque'; return; }
      } else if (!pairedBox) { warn(useF ? 'F1A non letto: scrivi la femmina a mano (es. 20,0220)' : 'S1A non letto: scrivilo a mano (es. 21,9966)'); return; }
      // apply the photo to the series (create / update) – the photo is the truth for this job
      let ser = t.ser, note = '';
      if (t.isNew) {
        const dup = state.series.find((s) => Math.abs(s.base - t.base) < 0.0005);
        if (dup) { ser = dup; if (!lockedNow(dup)) { ser.giocoMin = g.min; ser.giocoMax = g.max; } }
        else {
          ser = { id: uid(), machineId: myMachine() ? myMachine().id : null, name: 'Base ' + fmtMm3(t.base), lotto: $('ocrLotto').value.trim(), notes: 'Creata dalla foto',
            base: round4(t.base), tolleranza: t.tol, giocoMin: g.min, giocoMax: g.max, history: [], stock: {} };
          state.series.push(ser);
        }
        note = `Nuova serie Base ${fmtMm3(ser.base)} · gioco ${g.min}–${g.max} creata dalla foto`;
        saveData(state);
      } else if (!$('ocrGSave').classList.contains('hidden') && $('ocrApSer').checked && !lockedNow(ser)) { // Beta 0.8.1: the user chose «Aggiorna anche la serie»
        note = `Base ${fmtMm3(ser.base)}: gioco della serie aggiornato ${ser.giocoMin}–${ser.giocoMax} → ${g.min}–${g.max} µm (era ${ser.giocoMin}–${ser.giocoMax})`;
        ser.giocoPrev = (ser.giocoPrev || []).concat([{ ts: new Date().toISOString(), min: ser.giocoMin, max: ser.giocoMax }]).slice(-10);
        ser.giocoMin = g.min; ser.giocoMax = g.max;
        if (plan.tol != null && ser.tolleranza == null) ser.tolleranza = plan.tol;
        saveData(state);
      } else if (!$('ocrGSave').classList.contains('hidden')) { // «Applica solo a questo lavoro»
        applyJobOnly = true;
      }
      const codice = $('ocrCod').value.trim(), lotto = $('ocrLotto').value.trim();
      const gJobOnly = applyJobOnly ? { seriesId: ser.id, min: g.min, max: g.max } : null;
      if (pendingJob) { // «Nuovo lavoro»: this photo starts the job, which becomes the active context
        const j = startJob({ machineName: pendingJob.machineName, series: ser, codice, lotto }); pendingJob = null;
        note = (note ? note + ' · ' : '') + 'Lavoro: ' + j.machineName;
      } else {
        const j = activeJob();
        if (j && codice && !j.codice) j.codice = codice;
        if (j && lotto && !j.lotto) j.lotto = lotto;
      }
      setContext(null, ser.id, false);
      if (gJobOnly) { const jj = activeJob(); if (jj) { jj.giocoOv = gJobOnly; saveData(state); note = (note ? note + ' · ' : '') + `Gioco ${g.min}–${g.max} µm solo per questo lavoro (la serie resta ${ser.giocoMin}–${ser.giocoMax})`; } else note = (note ? note + ' · ' : '') + `Gioco ${g.min}–${g.max} µm solo per questo calcolo (la serie resta ${ser.giocoMin}–${ser.giocoMax})`; }
      $('modalRoot').innerHTML = '';
      if (sv == null) { // paired photo without S: verdict only
        const okP = pairedBox.includes('GIOCO CONFORME');
        toast((note ? note + ' · ' : '') + (okP ? 'Accoppiato: gioco conforme' : pairedBox.includes('INTERFERENZA') ? 'Accoppiato: INTERFERENZA' : 'Accoppiato: FUORI GIOCO'), okP ? '' : 'warn'); return;
      }
      const S4 = round4(sv);
      manualPrefix = Math.floor(S4 + 1e-9);
      measureDigits = String(S4).split('.')[1] || '0';
      const same = g.min === ser.giocoMin && g.max === ser.giocoMax;
      runCalc(S4, fmtMmS(S4), { gioco: { min: g.min, max: g.max, src: same ? 'serie' : 'foto' } });
      if (note) toast(note);
      else if (!fromPhoto) toast('Riga G non letta: gioco della serie ' + g.min + '–' + g.max + ' µm', 'warn');
      else toast('Gioco ' + g.min + '–' + g.max + ' µm (dalla foto)');
      if (note && lastCalc) { lastCalc.photoNote = note; renderResult(); }
    };
  }
  /** v2.0.6: every photo button → clear choice «Scatta foto» / «Dalla galleria» (same crop + OCR) */
  function pickPhotoSource(title, sub, before) {
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal src-pick" id="srcPick"><h2>${esc(title)}</h2>
      <p class="meta">${esc(sub)}</p>
      <button type="button" class="btn-job wide" id="srcCam"><span class="ji">📷</span><span><b>Scatta foto</b><small>con la fotocamera</small></span></button>
      <button type="button" class="btn btn-sec src-gal" id="srcGal" style="width:100%;margin-top:10px;min-height:64px;font-size:18px">🖼 Dalla galleria <small>(foto già fatta)</small></button>
      <button type="button" class="btn btn-sec" id="srcNo" style="width:100%;margin-top:10px;min-height:52px">Annulla</button></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('srcNo').onclick = close; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') close(); };
    $('srcCam').onclick = () => { haptic(12); close(); before(); openFoto('camera'); };
    $('srcGal').onclick = () => { haptic(12); close(); before(); openFoto('gallery'); };
  }
  $('btnFoto').addEventListener('click', () => pickPhotoSource('Leggi la misura S', 'Righe F1A · S1A · G1A, poi ritaglio e conferma.', () => { pendingJob = null; pendingFem = false; pendingInt = false; }));
  $('btnFoto').addEventListener('contextmenu', (e) => { e.preventDefault(); pendingJob = null; pendingFem = false; pendingInt = false; openFoto('gallery'); });
  $('btnNewJob').addEventListener('click', openNewJob);
  $('btnNewJob').addEventListener('contextmenu', (e) => { e.preventDefault(); openNewJob(); });
  $('pillJobs').addEventListener('click', openJobsSheet);
  function showCameraProblem() {
    const canSettings = !!(window.RettificaAndroid && RettificaAndroid.openAppSettings);
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal">
      <h2>Fotocamera non disponibile</h2>
      <p class="meta" style="margin:6px 0 12px">Non riesco ad aprire la fotocamera. Puoi scegliere una foto dalla galleria, oppure controllare le autorizzazioni dell'app nelle Impostazioni.</p>
      <div class="actions" style="display:flex;flex-direction:column;gap:8px">
        <button type="button" class="btn btn-teal" id="camGal">Scegli dalla galleria</button>
        ${canSettings ? '<button type="button" class="btn btn-sec" id="camSet">Apri impostazioni app</button>' : ''}
        <button type="button" class="btn btn-sec" id="camClose">Chiudi</button>
      </div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('camGal').onclick = () => { close(); openFoto('gallery'); };
    if ($('camSet')) $('camSet').onclick = () => { pendingJob = null; close(); try { RettificaAndroid.openAppSettings(); } catch (e) { toast('Impostazioni non disponibili'); } };
    $('camClose').onclick = () => { pendingJob = null; close(); };
    $('modalBg').addEventListener('click', (e) => { if (e.target.id === 'modalBg') close(); });
  }
  const OCR_MSG = { cancel: 'Foto annullata', image: 'Foto non leggibile', ocr: 'Testo non letto, riprova', gallery: 'Galleria non disponibile' };
  window.__onOcrResult = function (res) {
    if (ocrAuto && (!res || res.ok === false || res.error)) { if (res && res.code === 'cancel') ocrAuto = null; else { autoNext(); return; } }
    if (!res || res.ok === false || res.error) {
      const code = res && res.code;
      if (code === 'camera') { showCameraProblem(); return; } // gallery can still finish «Nuovo lavoro»
      if (pendingJob) pendingJob = null;
      pendingFem = false; pendingInt = false; clearPhotoPurpose();
      if (code === 'cancel') { toast(res.error && res.error.length <= 30 ? res.error : 'Foto annullata'); return; }
      toast(OCR_MSG[code] || 'Lettura foto non riuscita', 'warn'); return;
    }
    if (FG && !res._noRotate) { // Beta 0.8.1: drawing-requirements sheet (or a photo to rotate) – PC screens are never touched
      const pc = typeof parseElencoBlocks === 'function' && res.blocks ? parseElencoBlocks(res.blocks) : (typeof parseElencoText === 'function' ? parseElencoText(res.fullText || '') : null);
      if (!(pc && (pc.S1A != null || pc.F1A != null || pc.G1A != null)) && sheetOrRotate(res)) return;
    }
    ocrAuto = null;
    if (typeof parseElencoBlocks === 'function' && res.blocks) openOcrConfirm(parseElencoBlocks(res.blocks));
    else applyOcrText(res.fullText || '');
  };
  if ($('fotoHint')) $('fotoHint').textContent = hasNativeOcr() ? 'Foto più precisa: da vicino solo le righe F1A · S1A · G1A, dritto davanti allo schermo (📷 → Scatta foto o Dalla galleria; tieni premuto 📷 per la galleria). Anche il foglio «Requisiti Disegno» si legge da foto. Conferma sempre.' : '';

  // ── Beta 0.8.1: «Requisiti Disegno» sheet photos (any series / layout / rotation) ──
  const FG = window.FoglioParse || null;
  let ocrAuto = null; // automatic rotation tries after a photo that is neither a PC screen nor a readable sheet
  const hasNativeRot = () => { try { return !!(window.RettificaAndroid && RettificaAndroid.hasOcrRot && RettificaAndroid.hasOcrRot()); } catch (e) { return false; } };
  /** One OCR read of the photo: native ML Kit (optionally rotated first), or the test hook. */
  function ocrRead(b, rot) {
    rot = rot || 0;
    if (hasNativeCrop()) { try { if (rot && hasNativeRot()) RettificaAndroid.ocrCropRot(b.l, b.t, b.r, b.b, rot); else RettificaAndroid.ocrCrop(b.l, b.t, b.r, b.b); return true; } catch (e) {} }
    if (typeof window.__ocrCropHook === 'function') { window.__ocrCropHook(b, rot); return true; }
    return false;
  }
  function rotImg(dataUrl, deg) {
    return new Promise((resolve) => { const im = new Image(); im.onload = () => { try {
      const sw = deg % 180 !== 0, W = im.naturalWidth, H = im.naturalHeight, cv = document.createElement('canvas'); cv.width = sw ? H : W; cv.height = sw ? W : H;
      const cx = cv.getContext('2d'); cx.translate(cv.width / 2, cv.height / 2); cx.rotate(deg * Math.PI / 180); cx.drawImage(im, -W / 2, -H / 2);
      resolve({ img: cv.toDataURL('image/jpeg', 0.9), w: cv.width, h: cv.height }); } catch (e) { resolve(null); } }; im.onerror = () => resolve(null); im.src = dataUrl; });
  }
  /** Absolute rotation (degrees clockwise) of the kept photo; the preview used for AI / crop is rotated the same way. */
  async function setPhotoRot(deg) {
    const p = lastPhoto; if (!p) return false;
    deg = ((deg % 360) + 360) % 360; p.img0 = p.img0 || p.img; p.w0 = p.w0 || p.w; p.h0 = p.h0 || p.h;
    const r = deg ? await rotImg(p.img0, deg) : { img: p.img0, w: p.w0, h: p.h0 };
    if (!r) return false; Object.assign(p, { img: r.img, w: r.w, h: r.h, rot: deg, box: FULL_BOX() }); return true;
  }
  async function rotateReread() {
    if (!lastPhoto) { toast('Foto non più disponibile: rifai la foto', 'warn'); return; }
    const deg = ((lastPhoto.rot || 0) + 90) % 360; await setPhotoRot(deg); $('modalRoot').innerHTML = ''; ocrAuto = null;
    if (window.RETTIFICA_WEB) { webPhotoData(lastPhoto.img, lastPhoto.w, lastPhoto.h, true); return; }
    toast('Rileggo la foto ruotata…'); if (!ocrRead(FULL_BOX(), deg)) toast('Rotazione non disponibile', 'warn');
  }
  const sheetOf = (res) => (res.blocks && res.blocks.length ? FG.parseFoglioBlocks(res.blocks) : FG.parseFoglioText(res.fullText || ''));
  /** Called for every OCR result without PC-screen values: sheet? → form; unknown → try the other orientations; else old path. */
  function sheetOrRotate(res) {
    if (!FG) return false;
    const blocks = res.blocks || [], sc = FG.foglioScore(blocks.length ? blocks : (res.fullText || ''));
    if (sc.isFoglio) {
      const ocrAuto0 = !!ocrAuto, rot = ocrAuto ? ocrAuto.cur : (lastPhoto && lastPhoto.rot) || 0, sheet = sheetOf(res); ocrAuto = null;
      pendingInt = false; pendingFem = false;
      if (lastPhoto && rot && !lastPhoto.rot && ocrAuto0) setPhotoRot(rot); // the native re-read was rotated: keep the rotated preview too
      if (lastPhoto && !lastPhoto.rot && sheet.rotation) setPhotoRot(sheet.rotation); // geometry said the photo is sideways: keep an upright copy for the AI
      openSheetConfirm(sheet); return true;
    }
    if (ocrAuto) { // a try just came back without a sheet: next orientation
      if (sc.score > ocrAuto.bestScore) { ocrAuto.bestScore = sc.score; }
      return autoNext();
    }
    if (lastPhoto && !lastPhoto.rot && !pendingInt && !pendingFem && (hasNativeCrop() || window.__ocrCropHook) && (hasNativeRot() || window.__ocrCropHook)) {
      const hint = FG.orientationHint(blocks);
      ocrAuto = { base: res, order: hint === 'sideways' ? [270, 90, 180] : [180, 90, 270], i: 0, cur: 0, bestScore: sc.score };
      toast('Provo a ruotare la foto…'); return autoNext();
    }
    return false;
  }
  function autoNext() {
    const a = ocrAuto; if (!a) return false;
    if (a.i >= a.order.length) { const base = a.base; ocrAuto = null; window.__onOcrResult(Object.assign({}, base, { _noRotate: true })); return true; }
    a.cur = a.order[a.i++];
    if (!ocrRead(FULL_BOX(), a.cur)) { const base = a.base; ocrAuto = null; window.__onOcrResult(Object.assign({}, base, { _noRotate: true })); }
    return true;
  }
  function sheetNum(id) { const el = $(id); if (!el) return null; const t = String(el.value || '').trim().replace(/\s+/g, '').replace(',', '.'); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : null; }
  function openSheetConfirm(sheet, opt) {
    clearPhotoPurpose();
    const fm = FG.foglioToForm(sheet), v = (x) => (x == null ? '' : esc(String(x).replace('.', ',')));
    const mNow = myMachine(), jNow = pendingJob ? { machineName: pendingJob.machineName } : (jobsOn ? activeJob() : null);
    const near = fm.base != null ? state.series.find((s) => Math.abs(Number(s.base) - fm.base) < 0.0005) : null;
    const NEW = '__new';
    const part = (k, label, p, instr) => `<div class="sh-part" id="shP${k}"><h3>${label}</h3>
      <div><label for="sh${k}Name">Nome sul foglio</label><input id="sh${k}Name" value="${esc(p ? p.name : '')}" autocomplete="off"/></div>
      <div class="sh-3"><div><label for="sh${k}Nom">Nominale Ø mm</label><input id="sh${k}Nom" inputmode="decimal" value="${v(p && p.nominal)}"/></div>
      <div><label for="sh${k}Up">Limite sup. mm</label><input id="sh${k}Up" inputmode="decimal" value="${v(p && p.upper)}"/></div>
      <div><label for="sh${k}Lo">Limite inf. mm</label><input id="sh${k}Lo" inputmode="decimal" value="${v(p && p.lower)}"/></div></div>
      <div><label for="sh${k}In">Strumento</label><input id="sh${k}In" value="${esc(instr || '')}" autocomplete="off"/></div></div>`;
    const seriesOpts = (near ? '' : `<option value="${NEW}" selected>＋ Nuova serie «${esc(fm.name || 'dal foglio')}»</option>`) + state.series.map((s) => `<option value="${esc(s.id)}" ${near && near.id === s.id ? 'selected' : ''}>${esc(s.name || 'Base ' + fmtMm3(s.base))} · Base ${fmtMm3(s.base)} · gioco ${s.giocoMin}–${s.giocoMax}</option>`).join('');
    const cfgAi = AI ? AI.cfgOf(prefs) : null, whyAi = !AI ? 'AI non disponibile' : (!cfgAi.vision ? cfgAi.label + ' non legge le foto: scegli Gemini, OpenRouter, Qwen o xAI in Setup' : (!AI.hasKey(cfgAi.provider) ? 'Manca la chiave API (Setup → Intelligenza artificiale)' : ''));
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ocr-confirm sheet-confirm" id="sheetConfirm">
      <h2>${pendingJob ? (pendingJob.seriesOnly ? 'Nuova serie · ' : 'Nuovo lavoro · ') : ''}Foglio disegno · conferma</h2>
      <div class="ocr-sum" id="shSum">
        <div>Macchina <b>${esc((pendingJob && pendingJob.machineName) || (mNow && mNow.name) || '—')}</b> · Lavoro <b>${esc(jNow ? (jNow.name || jNow.machineName || '—') : 'nessuno')}</b></div>
        <div>Letto ${sheet.source === 'ai' ? 'con <b>AI</b>' : sheet.source === 'testo' ? 'dal <b>testo</b>' : 'con <b>lettura offline</b>'}${sheet.rotation ? ' · foto girata di ' + sheet.rotation + '°' : ''}</div>
        <div id="shFormula">${fm.formula ? 'Formula del foglio: <b>' + esc(fm.formula) + '</b> (foro − maschio)' : 'Formula non letta'}</div>
        <div class="meta">Diametri in mm · giochi in µm (0,01 mm = 10 µm).</div></div>
      ${fm.warnings.length ? `<div class="photo-note warn" id="shNotes">${fm.warnings.map(esc).join('<br>')}</div>` : ''}
      ${part('F', 'Foro / femmina', fm.F, fm.instrF)}${part('S', 'Maschio', fm.S, fm.instrS)}
      <button type="button" class="btn btn-sec sh-swap" id="shSwap">⇄ Scambia foro e maschio</button>
      <label>Gioco di accoppiamento µm (foro − maschio)</label>
      <div class="field-row"><div><input id="shGmin" inputmode="decimal" aria-label="Gioco minimo µm" value="${v(fm.giocoMin)}" placeholder="min µm"/></div><div><input id="shGmax" inputmode="decimal" aria-label="Gioco massimo µm" value="${v(fm.giocoMax)}" placeholder="max µm"/></div></div>
      <div class="meta" id="shGnote"></div>
      <label class="chk-big" id="shFormaRow"><input type="checkbox" id="shNoForma" ${fm.forma ? '' : 'checked'}/><span>Senza ovalità/conicità (nascondi campi e promemoria)</span></label>
      <label for="shName">Nome serie</label><input id="shName" value="${esc(fm.name)}" autocomplete="off"/>
      <label for="shSeries">Serie</label><select id="shSeries">${seriesOpts}</select>
      <div id="shApplyBox" class="hidden"><div class="meta" id="shApplyTxt"></div>
        <div class="apply-choice" id="shApply"><label id="shApJobL" class="on"><input type="radio" name="shAp" id="shApJob" value="job" checked/><span>Applica solo a questo lavoro</span></label>
        <label id="shApSerL"><input type="radio" name="shAp" id="shApSer" value="serie"/><span>Aggiorna anche la serie</span></label></div></div>
      <div id="shPlan" class="meta"></div>
      <label for="shNotesTxt">Note (altre quote, strumenti)</label><textarea id="shNotesTxt" rows="3">${esc(FG.formNotes(fm))}</textarea>
      <label class="chk-big" id="shCheckRow"><input type="checkbox" id="shChecked"/><span>Ho controllato i valori sul foglio${fm.ai || sheet.source === 'ai' ? ' (letti con AI)' : ''}</span></label>
      <div id="shErr" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin:10px 0 4px"><button type="button" class="btn btn-sec" id="shCancel" style="flex:1">Annulla</button>
      <button type="button" class="btn btn-teal" id="shGo" style="flex:1.6">Conferma</button></div>
      ${lastPhoto ? '<button type="button" class="btn btn-sec" id="shRotate" style="width:100%;margin:4px 0;min-height:52px">↻ Ruota foto e rileggi</button>' : ''}
      ${lastPhoto && AI ? `<button type="button" class="btn btn-sec ai-photo ${whyAi ? 'off' : ''}" id="shAi" data-why="${esc(whyAi)}" style="width:100%;margin:4px 0;min-height:52px">✨ Leggi foto con AI</button>${whyAi ? `<p class="meta ai-why" id="shAiWhy">${esc(whyAi)}</p>` : ''}` : ''}
      </div></div>`;
    const err = (t) => { const e = $('shErr'); e.textContent = t || ''; e.classList.toggle('hidden', !t); };
    const readForm = () => {
      const S = { name: $('shSName').value.trim(), nom: sheetNum('shSNom'), up: sheetNum('shSUp'), lo: sheetNum('shSLo'), instr: $('shSIn').value.trim() };
      const F = { name: $('shFName').value.trim(), nom: sheetNum('shFNom'), up: sheetNum('shFUp'), lo: sheetNum('shFLo'), instr: $('shFIn').value.trim() };
      const base = S.nom != null ? S.nom : (F.nom != null ? F.nom : null);
      let tol = null; [S, F].forEach((p) => { if (tol == null && p.nom != null && p.up != null && p.lo != null && Math.abs(p.up - p.lo) > 1e-9) tol = round4(Math.max(Math.abs(p.up - p.nom), Math.abs(p.nom - p.lo))); });
      return { S, F, base, tol: tol != null ? tol : (fm.tol != null ? fm.tol : 0.1), gmin: sheetNum('shGmin'), gmax: sheetNum('shGmax'), noForma: $('shNoForma').checked, name: $('shName').value.trim(), notes: $('shNotesTxt').value.trim() };
    };
    const target = () => { const id = $('shSeries').value; return id === NEW ? null : seriesById(id); };
    const refresh = () => {
      const r = readForm(), t = target(), box = $('shApplyBox'), gn = $('shGnote'), pl = $('shPlan');
      gn.textContent = r.gmin != null && r.gmax != null ? `Gioco ${String(r.gmin).replace('.', ',')}–${String(r.gmax).replace('.', ',')} µm = ${fmtMm3(r.gmin / 1000)}–${fmtMm3(r.gmax / 1000)} mm` : 'Scrivi minimo e massimo in µm.';
      box.classList.add('hidden');
      if (!t) { pl.textContent = r.base != null ? `Verrà creata la serie «${r.name || 'Base ' + fmtMm3(r.base)}» · Base ${fmtMm3(r.base)} mm · gioco ${r.gmin != null ? r.gmin + '–' + r.gmax + ' µm' : '—'}${r.noForma ? ' · senza ovalità/conicità' : ''}` : 'Scrivi il nominale.'; return; }
      const diff = r.gmin != null && (Number(t.giocoMin) !== r.gmin || Number(t.giocoMax) !== r.gmax) || (!!r.noForma) !== (t.forma === false);
      pl.textContent = `Serie ${t.name || 'Base ' + fmtMm3(t.base)} · Base ${fmtMm3(t.base)} mm${Math.abs(t.base - (r.base == null ? t.base : r.base)) > 0.0005 ? ' (il foglio dice ' + fmtMm3(r.base) + ')' : ''}`;
      if (diff) { box.classList.remove('hidden'); $('shApplyTxt').textContent = `Il foglio dice gioco ${r.gmin != null ? r.gmin + '–' + r.gmax : '—'} µm${r.noForma ? ', senza ovalità/conicità' : ''}; la serie ha ${t.giocoMin}–${t.giocoMax} µm${t.forma === false ? ', senza ovalità/conicità' : ''}. Scegli:`; }
    };
    document.querySelectorAll('#sheetConfirm input, #sheetConfirm select, #sheetConfirm textarea').forEach((i) => { i.addEventListener('input', refresh); i.addEventListener('change', refresh); });
    ['shApJob', 'shApSer'].forEach((id) => $(id).addEventListener('change', () => { $('shApJobL').classList.toggle('on', $('shApJob').checked); $('shApSerL').classList.toggle('on', $('shApSer').checked); }));
    $('shSwap').onclick = () => { haptic(12); ['Name', 'Nom', 'Up', 'Lo', 'In'].forEach((s) => { const a = $('shF' + s), b = $('shS' + s), t = a.value; a.value = b.value; b.value = t; }); refresh(); };
    refresh();
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('shCancel').onclick = () => { close(); lastPhoto = null; try { if (window.RettificaAndroid && RettificaAndroid.ocrCancel) RettificaAndroid.ocrCancel(); } catch (e) {} if (pendingJob) { toast(pjCancelMsg()); pendingJob = null; } };
    if ($('shRotate')) $('shRotate').onclick = () => { haptic(12); rotateReread(); };
    if ($('shAi')) $('shAi').onclick = async () => {
      const btn = $('shAi'); if (btn.classList.contains('off')) { toast(btn.dataset.why || 'Non disponibile', 'warn'); return; }
      btn.classList.add('off'); btn.textContent = '✨ Leggo con AI…'; haptic(12);
      const r = await AI.readPhoto(prefs, await aiPhotoData(), { mode: 'foglio' });
      if (!$('shAi')) return;
      if (!r.ok || r.kind !== 'foglio') { btn.classList.remove('off'); btn.textContent = '✨ Leggi foto con AI'; err('⚠ ' + (r.error || 'Non sembra un foglio «Requisiti Disegno».') + ' Restano i valori di prima.'); return; }
      openSheetConfirm(r.sheet); toast('Letto con AI: controlla i valori');
    };
    $('shGo').onclick = () => {
      const r = readForm(), t = target();
      if (!$('shChecked').checked) { err('Controlla i valori sul foglio e spunta «Ho controllato i valori». L\'app non calcola su valori indovinati.'); haptic(60); return; }
      if (r.base == null || !(r.base > 0.5 && r.base < 2000)) { err('Scrivi il nominale del maschio o del foro (mm).'); return; }
      if (r.gmin == null || r.gmax == null || r.gmin < 0 || r.gmax > 500 || r.gmax - r.gmin < 0.5) { err('Gioco non valido: minimo e massimo in µm (es. 10 e 30).'); return; }
      if (r.S.nom != null && r.F.nom != null && Math.abs(r.S.nom - r.F.nom) > 0.0005 && !$('shGo').dataset.warned) { err(`Nominali diversi (maschio ${fmtMm3(r.S.nom)}, foro ${fmtMm3(r.F.nom)}): la base sarà ${fmtMm3(r.base)}. Tocca ancora Conferma se è giusto.`); $('shGo').dataset.warned = '1'; return; }
      const gmin = round4(r.gmin), gmax = round4(r.gmax);
      let ser = t, note = '', jobOnly = false;
      const lim = {}; if (!r.noForma) { if (sheet.oval && sheet.oval.limUm != null) { lim.ovalOk = sheet.oval.limUm; lim.ovalMax = Math.max(sheet.oval.limUm, 3); } if (sheet.taper && sheet.taper.limUm != null) { lim.conOk = sheet.taper.limUm; lim.conMax = Math.max(sheet.taper.limUm, 3); } }
      if (!ser) {
        ser = { id: uid(), machineId: myMachine() ? myMachine().id : null, name: r.name || 'Base ' + fmtMm3(r.base), lotto: r.name || '', notes: r.notes, base: round4(r.base), tolleranza: r.tol, giocoMin: gmin, giocoMax: gmax, history: [], stock: {} };
        if (r.noForma) ser.forma = false; if (Object.keys(lim).length) ser.lim = lim;
        state.series.push(ser); note = `Nuova serie ${ser.name} · gioco ${gmin}–${gmax} µm`;
      } else if (!$('shApplyBox').classList.contains('hidden') && $('shApSer').checked && !lockedNow(ser)) {
        ser.giocoPrev = (ser.giocoPrev || []).concat([{ ts: new Date().toISOString(), min: ser.giocoMin, max: ser.giocoMax }]).slice(-10);
        note = `Serie ${ser.name || 'Base ' + fmtMm3(ser.base)} aggiornata: gioco ${ser.giocoMin}–${ser.giocoMax} → ${gmin}–${gmax} µm`;
        ser.giocoMin = gmin; ser.giocoMax = gmax; if (r.noForma) ser.forma = false; else delete ser.forma; if (Object.keys(lim).length) ser.lim = Object.assign({}, ser.lim, lim);
        if (!ser.name || /^Base /.test(ser.name)) ser.name = r.name || ser.name;
        if (r.notes && !String(ser.notes || '').includes(r.notes)) ser.notes = (ser.notes ? ser.notes + '\n' : '') + r.notes;
      } else if (!$('shApplyBox').classList.contains('hidden')) jobOnly = true;
      saveData(state);
      if (pendingJob && pendingJob.seriesOnly) pendingJob = null; // «Nuova serie» from the photo: no job
      if (pendingJob) { const j = startJob({ machineName: pendingJob.machineName, series: ser, codice: '', lotto: '' }); pendingJob = null; note = (note ? note + ' · ' : '') + 'Lavoro: ' + j.machineName; }
      setContext(null, ser.id, false);
      if (jobOnly) { const jj = activeJob(); if (jj) { jj.giocoOv = { seriesId: ser.id, min: gmin, max: gmax }; saveData(state); note = `Gioco ${gmin}–${gmax} µm solo per questo lavoro (la serie resta ${ser.giocoMin}–${ser.giocoMax})`; } else note = `Gioco ${gmin}–${gmax} µm: serve un lavoro attivo per applicarlo solo a questo lavoro`; }
      close(); lastPhoto = null; newMeasure(); showPage('calc');
      toast((note || `Serie ${ser.name || 'Base ' + fmtMm3(ser.base)}`) + ' · scrivi la misura');
    };
  }

  function shareFile(filename, content, mime) {
    try { if (window.RettificaAndroid && RettificaAndroid.shareText) { RettificaAndroid.shareText(filename, content); return; } } catch (e) {}
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    toast('File creato: ' + filename);
  }
  $('btnExport').addEventListener('click', () => {
    shareFile('rettifica-beta-backup-' + todayKey() + '.json', JSON.stringify(wrapBackup(state, APP_VERSION, new Date().toISOString()), null, 2), 'application/json');
  });
  // v1.9.4: CSV of all saved measures (Excel, Italian decimals, separator ;)
  function exportCsv() {
    const rows = [];
    allSeries().forEach((s) => (s.history || []).forEach((h) => {
      const m = machineById(h.machineId);
      rows.push({ ts: h.ts, machine: h.machineName || (m ? m.name : ''), base: s.base, lotto: s.lotto || '', S: h.S,
        d: h.S != null ? round1((h.S - s.base) * 1000) : null, chosen: h.chosen, gioco: h.gioco, oval: h.oval, con: h.con, conEnd: h.conEnd || null, status: h.status || '', lavoro: h.lavoro || 'maschio',
        codice: rowMeta(h, s).codice, rev: rowMeta(h, s).rev, lav: rowMeta(h, s).lav, lot: rowMeta(h, s).lotto, serie: s.lotto || ('Base ' + fmtMm3(s.base)), tol: (h.snap && h.snap.tolMm != null) ? h.snap.tolMm : seriesTol(s), gmin: h.snap ? h.snap.giocoMin : s.giocoMin, gmax: h.snap ? h.snap.giocoMax : s.giocoMax });
    }));
    femRows().forEach((r) => rows.push(r)); // v2.0.5 female pieces (page Femmina)
    intRows().forEach((r) => rows.push(r)); // Beta 0.3.0 interno (bore)
    qtQuotaRows().forEach((r) => rows.push(Object.assign({}, r, { lot: r.lotto, lotto: r.serie }))); // Beta 0.9.1 controllo quota (one row per quota)
    rows.sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
    if (!rows.length) { toast('Nessuna misura da esportare'); return; }
    shareFile('rettifica-beta-misure-' + todayKey() + '.csv', historyCsv(rows), 'text/csv');
  }
  $('btnCsv').addEventListener('click', exportCsv);
  if ($('btnCsvStorico')) $('btnCsvStorico').addEventListener('click', exportCsv);
  $('btnImport').addEventListener('click', () => { $('importFile').value = ''; $('importFile').click(); });
  $('importFile').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    try {
      if (!f) return;
      let raw;
      try { raw = JSON.parse(await f.text()); } catch (err) { toast('File non leggibile (serve il backup .json)', 'warn'); return; }
      // Beta 0.1.0: check the file first and show what it contains
      const res = inspectBackup(raw);
      if (!res.ok) { toast('Import fallito: ' + res.error, 'warn'); return; }
      const dd = importDuplicates(state, res.data); res.data = dd.data;
      const inf = res.info;
      const when = inf.exportedAt ? new Date(inf.exportedAt).toLocaleString('it-IT') : 'data non indicata';
      const html = `<p class="meta">Backup: <b>${esc(inf.app)}${inf.appVersion ? ' ' + esc(inf.appVersion) : ''}</b> · ${esc(when)}</p>
        <p class="meta">Contiene: ${inf.machines} macchina/e · ${inf.series} basi · ${inf.measures} misure · ${inf.femmine} femmine · ${inf.turni} turni archiviati.</p>
        ${inf.dropped ? `<p class="meta">${inf.dropped} basi non valide verranno saltate.</p>` : ''}
        ${dd.inFile ? `<p class="meta dup-warn" id="impDupFile">⚠ ${dd.inFile} misure doppie nel file: verranno importate una volta sola.</p>` : ''}
        ${dd.already ? `<p class="meta dup-warn" id="impDupHave">⚠ ${dd.already} misure del file ci sono già sul telefono (stesso backup già importato?).</p>` : ''}
        <p class="meta">I dati attuali vengono <b>sostituiti</b>. Prima l'app ne salva una copia automatica.</p>`;
      if (!(await askBig({ title: 'Sostituire i dati con il backup?', html, ok: 'Sostituisci', danger: true }))) return;
      autoBackup('prima di importare un backup', JSON.stringify(state), JSON.stringify(prefs));
      jobsOn = false; pendingJob = null;
      state = migrate(res.data); state.appVersion = APP_VERSION; saveData(state);
      lastCalc = null; lastSaveRec = null; hideUndo(); manualPrefix = null; measureDigits = '';
      if (!seriesById(prefs.seriesId)) { const s = currentContext().series; prefs.seriesId = s ? s.id : null; savePrefs(prefs); }
      if (!(state.jobs || []).some((j) => j.id === prefs.jobId)) { prefs.jobId = null; savePrefs(prefs); }
      initJobs();
      updateChip(); showInputView(); fillSetupSelects();
      toast('Import ok' + (res.dropped ? ' · ' + res.dropped + ' serie saltate' : ''));
    } finally { e.target.value = ''; }
  });
  /** v2.0.6 «Azzera tutto»: back up, then wipe series, jobs, machine, history, turno, stock, taratura, femmine (prefs theme/voice/crop kept) */
  function wipeAll(why) {
    autoBackup(why, JSON.stringify(state), JSON.stringify(prefs));
    jobsOn = false; pendingJob = null; pendingFem = false; pendingInt = false; intS.buf = '';
    state = defaultData(); state.v194 = true;
    prefs = { theme: prefs.theme, voiceAuto: prefs.voiceAuto, cropOff: prefs.cropOff }; savePrefs(prefs);
    saveData(state); lastCalc = null; lastSaveRec = null; hideUndo();
    fem.buf = { F: '', S: '', GMIN: '', GMAX: '' }; fem.sTouched = false;
    initJobs(); setContext(null, null); showPage('calc'); newMeasure(); renderEmpty();
  }
  $('btnReset').addEventListener('click', () => {
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal del-confirm" id="wipeConfirm"><h2>Azzera tutto?</h2>
      <p class="del-p">Cancella <b>basi e serie, lavori, macchina, storico, conteggi del turno, magazzino, taratura, femmine, controlli quota e quaderno macchina</b>. Restano solo le preferenze (tema, voce).</p>
      <p class="meta">Prima l'app salva un backup automatico (recuperabile da Setup).</p>
      <div class="actions" style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-sec" id="wipeNo" style="flex:1;min-height:56px">Annulla</button>
      <button type="button" class="btn btn-danger" id="wipeYes" style="flex:1.3;min-height:56px">🗑 Azzera tutto</button></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('wipeNo').onclick = close; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') close(); };
    $('wipeYes').onclick = () => { close(); wipeAll('azzera-tutto'); toast('Tutto azzerato · backup salvato'); };
  });
  /** hidden: long-press the version line in Setup → restore the automatic backup */
  function backupInfo() { try { const b = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null'); return b && b.data ? b : null; } catch (e) { return null; } }
  function openRestoreBackup() {
    const b = backupInfo();
    if (!b) { toast('Nessun backup automatico'); return; }
    let n = 0, ser = 0; try { const d = JSON.parse(b.data); ser = (d.series || []).length; (d.series || []).forEach((s) => { n += (s.history || []).length; }); } catch (e) {}
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal del-confirm" id="restoreBk"><h2>Ripristina backup</h2>
      <p class="del-p">Backup automatico del ${esc(new Date(b.ts).toLocaleString('it-IT'))}: <b>${ser} serie</b>, <b>${n} misure</b>.</p>
      <p class="meta">I dati attuali vengono sostituiti (e salvati a loro volta come backup).</p>
      <div class="actions" style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-sec" id="rbNo" style="flex:1;min-height:56px">Annulla</button>
      <button type="button" class="btn btn-primary" id="rbYes" style="flex:1.3;min-height:56px">↶ Ripristina</button></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('rbNo').onclick = close; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') close(); };
    $('rbYes').onclick = () => {
      const cur = JSON.stringify({ ts: new Date().toISOString(), from: 'prima-del-ripristino', data: JSON.stringify(state), prefs: JSON.stringify(prefs) });
      let d; try { d = migrate(JSON.parse(b.data)); } catch (e) { toast('Backup non leggibile', 'warn'); return; }
      let p = {}; try { p = JSON.parse(b.prefs || '{}') || {}; } catch (e) {}
      p.theme = prefs.theme; p.voiceAuto = prefs.voiceAuto; p.cropOff = prefs.cropOff;
      localStorage.setItem(BACKUP_KEY, cur);
      jobsOn = false; state = d; prefs = p; savePrefs(prefs); saveData(state);
      close(); lastCalc = null; initJobs(); setContext(null, prefs.seriesId || (state.series[0] && state.series[0].id) || null); showPage('calc'); newMeasure(); renderEmpty();
      toast('Backup ripristinato');
    };
  }
  (function wireRestore() {
    const v = document.querySelector('#page-setup .ver'); if (!v) return;
    let tmr = null, taps = 0, tt = null;
    const start = () => { tmr = setTimeout(openRestoreBackup, 1200); }, stop = () => clearTimeout(tmr);
    v.addEventListener('pointerdown', start); v.addEventListener('pointerup', stop); v.addEventListener('pointerleave', stop);
    v.addEventListener('click', () => { taps++; clearTimeout(tt); tt = setTimeout(() => { taps = 0; }, 1500); if (taps >= 5) { taps = 0; openRestoreBackup(); } }); // or 5 taps
  })();
  /** v2.0.6 empty state: no base yet → welcome card with Nuovo lavoro / Aggiungi base */
  function renderEmpty() {
    const iv = $('calcInputView'), el = $('emptyCard'); if (!iv || !el) return;
    const none = !state.series.length;
    iv.classList.toggle('is-empty', none);
    el.classList.toggle('hidden', !none);
    const qb = $('emQuota'), qc = none && qtCur(); // Beta 0.9.4: a saved Controllo quota is never «lost» behind the welcome card
    if (qb) { qb.classList.toggle('hidden', !qc); if (qc) $('emQuotaTxt').textContent = qc.nome + ' · ' + (qc.quote || []).length + ' ' + ((qc.quote || []).length === 1 ? 'quota' : 'quote') + (qtList().length > 1 ? ' · altri ' + (qtList().length - 1) : ''); }
    if (none) $('actBar').classList.add('hidden');
    fitPads();
  }
  $('emNewJob').addEventListener('click', () => { haptic(12); openNewJob(); });
  $('emAddBase').addEventListener('click', () => { haptic(12); openSeriesModal(null); });
  $('emQuota').addEventListener('click', () => { haptic(12); openQuota(); });

  // ── Beta 0.5.0: AI (Assistente + Leggi foto con AI). The AI never computes: the app's numbers are shown, the AI explains. ──
  const AI = window.RettificaAI;
  function aiCtx() {
    const { series } = currentContext(), m = myMachine(), cl = calOf(m), c = { machine: ((m && m.name) || '') + ' (taratura ' + (cl.stato === 'verificata' ? 'verificata' : 'da verificare') + ', + ' + cl.outer + ' sull\'esterno, 1 tocco = ' + fmtUm(cl.umPerTocco) + ' µm sul ' + cl.scala + ')' };
    if (series) {
      c.base = fmtMm3(series.base); c.giocoMin = series.giocoMin; c.giocoMax = series.giocoMax; c.tol = series.tolleranza != null ? fmtMm3(series.tolleranza) : null;
      c.last = (series.history || []).slice(-3).map((h) => fmtMmS(h.S) + ' mm → pezzo ' + h.chosen + (h.status === 'scarto' ? ' (scarto)' : ''));
      try { const d = currentDrift(series, m, null); if (d && d.alert) c.trend = d.alert; } catch (e) {}
    }
    c.lavoro = lavoroMode() === 'femmina' ? 'femmina (adatta)' : 'maschio';
    if (lastCalc && lastCalc.acc) {
      const a = lastCalc.acc, v = a.valid || [], co = lastCalc.corr;
      c.calc = `misura ${lastCalc.display} mm; pezzi validi ${v.length ? v[0] + '…' + v[v.length - 1] : 'nessuno'}; centro ${fmtUm(a.ideal)}; scelto ${lastCalc.selected != null ? lastCalc.selected : '—'}`
        + (co ? (co.none ? '; correzione: nessuna' : co.valTxt ? `; correzione: inserisci ${co.valTxt} mm (${fmtUm(Math.abs(co.diffUm))} µm sul diametro, valore diretto)` : `; correzione: ${co.key} ×${co.presses} tocchi (${fmtUm(Math.abs(co.diffUm))} µm sul diametro)`) : '');
    }
    try { const n = intNow(); if (n.tgt) c.interno = `quota foro ${fmtMm4(n.tgt.lo)}–${fmtMm4(n.tgt.hi)} mm` + (n.r ? `; foro ${fmtMm4(n.bore)} → ${n.r.state}; ${internoWords(n.r)}` : ''); const r = intRule(); c.intDir = r ? (r === 'plus_smaller' ? '+ stringe il foro, − allarga' : '+ allarga il foro, − stringe') : 'non impostato'; } catch (e) {}
    return AI.buildContext(c);
  }
  // ── Beta 0.5.2: real chat page (💬 tab). History saved locally (never the key); last N turns sent each time. ──
  const CHAT_KEY = 'rweb_chat', CHAT_MAX = 80, CHAT_TURNS = 10;
  let aiBusy = false, aiWaitTxt = 'Sto pensando…', aiWaitT = null;
  function loadChat() { try { const c = JSON.parse(localStorage.getItem(CHAT_KEY) || '{}'); return Array.isArray(c.msgs) ? c.msgs : []; } catch (e) { return []; } }
  let chatMsgs = loadChat();
  function saveChat() { chatMsgs = chatMsgs.slice(-CHAT_MAX); try { localStorage.setItem(CHAT_KEY, JSON.stringify({ v: 1, msgs: chatMsgs.map((m) => ({ role: m.role, content: m.content, ts: m.ts, warn: m.warn || null, err: !!m.err })) })); } catch (e) {} }
  function chatHistory() { return chatMsgs.filter((m) => !m.err && (m.role === 'user' || m.role === 'assistant')).slice(-CHAT_TURNS * 2).map((m) => ({ role: m.role, content: m.content })); }
  function renderChat(scroll) {
    if (!$('chatMsgs')) return;
    const cfg = AI ? AI.cfgOf(prefs) : null;
    $('chatProv').textContent = cfg ? cfg.label + (AI.hasKey(cfg.provider) ? '' : ' · manca la chiave (Setup)') : 'AI non disponibile';
    const ctx = aiCtx();
    $('aiApp').innerHTML = ctx.split('\n').filter((l) => /CALCOLO|INTERNO|Verso|Serie/.test(l)).map(esc).join('<br>') || 'Nessun calcolo in corso: fai prima una misura.';
    const noKey = cfg && !AI.hasKey(cfg.provider);
    $('chatMsgs').innerHTML = (noKey ? `<div class="chat-key" id="chatKey"><b>Manca la chiave API (${esc(cfg.label)})</b><p>Copia la chiave e tocca «Incolla chiave». Resta solo su questo telefono.</p>${keyHelpHtml(cfg.provider)}</div>` : '') + (chatMsgs.length ? chatMsgs.map((m, k) => `<div class="bub ${m.err ? 'err' : m.role === 'user' ? 'me' : 'ai'}" data-i="${k}">${m.err ? '⚠ ' + esc(m.content) + (k === chatMsgs.length - 1 && !aiBusy ? '<button type="button" class="btn btn-teal chat-retry" id="chatRetry">↻ Riprova</button>' : '') : m.role === 'user' ? esc(m.content) : AI.md(m.content)}${m.warn ? `<div class="ai-note">ℹ️ Per i numeri dei pezzi fa fede il Calcolo dell'app.</div>` : ''}</div>`).join('')
      : '<div class="chat-hello">Chiedi qualcosa: «perché il pezzo 5?», «cosa vuol dire gioco?», «come misuro la conicità?».<br>L\'AI spiega, i numeri li dà l\'app.<br>Ricorda: ovalità e conicità entro 2–3 µm.</div>')
      + (aiBusy ? `<div class="bub ai wait" id="chatWait">💭 ${esc(aiWaitTxt)}</div>` : '');
    if (scroll !== false) { const el = $('chatMsgs'); el.scrollTop = noKey ? 0 : el.scrollHeight; }
    $('chatSend').classList.toggle('off', aiBusy);
    $('chatMic').classList.toggle('hidden', !(window.RettificaAndroid && RettificaAndroid.startVoice));
    if (noKey) bindKeyHelp(() => renderChat());
    if ($('chatRetry')) $('chatRetry').onclick = () => chatRetry();
  }
  async function chatSend(text, isRetry) {
    const q = String(text != null ? text : $('chatQ').value).trim(); if (!q || aiBusy || !AI) return;
    const ctx = aiCtx();
    if (!isRetry) { chatMsgs.push({ role: 'user', content: q, ts: new Date().toISOString() }); saveChat(); $('chatQ').value = ''; }
    const hist = chatHistory().slice(0, -1); // everything before this question
    aiBusy = true; aiWaitTxt = 'Sto pensando…'; haptic(10); renderChat();
    const t0 = Date.now(); clearInterval(aiWaitT);
    aiWaitT = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); if (s >= 8 && $('chatWait')) $('chatWait').textContent = '💭 ' + aiWaitTxt.replace(/…$/, '') + '… ' + s + ' s'; }, 1000);
    const r = await AI.ask(prefs, ctx, q, hist, (st) => { aiWaitTxt = st; if ($('chatWait')) $('chatWait').textContent = '💭 ' + st; });
    clearInterval(aiWaitT); aiBusy = false;
    if (!r.ok) chatMsgs.push({ role: 'assistant', content: r.error, ts: new Date().toISOString(), err: true });
    else { const extra = AI.foreignNumbers(r.text, ctx); chatMsgs.push({ role: 'assistant', content: r.text, ts: new Date().toISOString(), warn: extra.length ? extra.join(', ') : null }); if (prefs.voiceAuto) speakIt(r.text.replace(/[*_`#]/g, '').slice(0, 300)); }
    saveChat(); renderChat();
  }
  function chatRetry() {
    if (aiBusy) return; while (chatMsgs.length && chatMsgs[chatMsgs.length - 1].err) chatMsgs.pop();
    const last = chatMsgs[chatMsgs.length - 1]; if (!last || last.role !== 'user') { renderChat(); return; }
    haptic(12); saveChat(); chatSend(last.content, true);
  }
  function openAssistant() { showPage('chat'); }
  /** Beta 0.5.2: big «Incolla chiave» + «Crea chiave gratis» (+3 steps). No key is ever embedded in the app. */
  function keyHelpHtml(pid) {
    const P = AI.PROVIDERS[pid] || {}, gem = pid === 'gemini';
    return `<div class="key-help" id="keyHelp"><div class="kh-btns"><button type="button" class="btn btn-teal" id="khPaste" data-p="${esc(pid)}">📋 Incolla chiave</button>
      ${P.keyLink ? `<button type="button" class="btn btn-sec" id="khCreate" data-url="${esc(gem ? 'https://aistudio.google.com/apikey' : P.keyLink)}">🔑 Crea chiave${gem ? ' gratis' : ''}</button>` : ''}</div>
      ${gem ? `<ol class="kh-steps" id="khSteps">${AI.KEY_STEPS.map((x) => '<li>' + esc(x) + '</li>').join('')}</ol>` : ''}</div>`;
  }
  function bindKeyHelp(after) {
    const pa = $('khPaste'), cr = $('khCreate');
    if (pa) pa.onclick = async () => { haptic(15); const r = await AI.pasteKey(pa.dataset.p); if (r.ok) { toast('Chiave salvata ' + r.hint); renderAiRow(); if (after) after(); } else toast(r.error, 'warn'); };
    if (cr) cr.onclick = () => { haptic(10); AI.openLink(cr.dataset.url); };
  }
  if ($('chatSend')) {
    $('chatSend').addEventListener('click', () => chatSend());
    $('chatQ').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatSend(); } });
    $('chatNew').addEventListener('click', () => { if (aiBusy) return; haptic(15); chatMsgs = []; saveChat(); renderChat(); toast('Nuova chat'); });
    $('chatMic').addEventListener('click', () => { haptic(15); $('chatMic').textContent = '🎤 Ascolto…'; try { RettificaAndroid.startVoice(); } catch (e) { $('chatMic').textContent = '🎤 Parla'; toast('Voce non disponibile', 'warn'); } });
  }
  window.__onVoiceResult = (res) => {
    const mic = $('chatMic'); if (mic) mic.textContent = '🎤 Parla';
    if (!res || !res.ok) { toast((res && res.error) || 'Voce non capita', 'warn'); return; }
    if (res.text) { if (document.body.dataset.page !== 'chat') showPage('chat'); chatSend(res.text); }
  };
  function openAiSettings() {
    const draw = (pid) => {
      const P = AI.PROVIDERS, a = prefs.ai || {}, sel = P[pid] ? pid : AI.DEFAULT_PROVIDER, p = P[sel], cus = sel === 'custom';
      const cfg = AI.cfgOf({ ai: sel === a.provider ? a : { provider: sel } }), hint = AI.keyHint(sel);
      $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ai-set" id="aiSet">
        <h2>Intelligenza artificiale</h2><p class="meta">Facoltativa. Senza AI l'app funziona uguale (anche offline).</p>
        <label for="aiProv">Servizio</label><select id="aiProv">${Object.keys(P).map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(P[k].label)}${P[k].vision ? ' · foto ✓' : ' · solo testo'}</option>`).join('')}</select>
        <p class="meta" id="aiFree">${esc(p.free)}${p.keyUrl ? '<br>Chiave: <b>' + esc(p.keyUrl) + '</b>' : ''}</p>
        <label for="aiKey">Chiave API ${hint ? '(salvata ' + esc(hint) + ')' : '(non salvata)'}</label>
        <input id="aiKey" type="password" autocomplete="off" placeholder="${hint ? 'lascia vuoto per tenerla' : 'incolla la chiave'}"/>
        ${keyHelpHtml(sel)}
        <p class="meta">La chiave resta solo su questo telefono: non va nei backup né negli export.</p>
        <label for="aiUrl">Indirizzo (URL)</label><input id="aiUrl" value="${esc(cfg.baseUrl)}" ${cus ? '' : 'readonly'} autocomplete="off"/>
        <div class="field-row"><div><label for="aiModel">Modello</label><input id="aiModel" value="${esc(cfg.model)}" autocomplete="off"/></div>
        <div><label for="aiVModel">Modello foto</label><input id="aiVModel" value="${esc(cfg.visionModel || '')}" ${cfg.vision || cus ? '' : 'disabled placeholder="non legge foto"'} autocomplete="off"/></div></div>
        <div class="actions" style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-sec" id="aiDelKey" style="flex:1;min-height:52px">Cancella chiave</button>
        <button type="button" class="btn btn-primary" id="aiSave" style="flex:1.4;min-height:52px">✓ Salva</button></div>
        <button type="button" class="btn btn-sec" id="aiCancel" style="width:100%;margin-top:8px;min-height:52px">Annulla</button></div></div>`;
      const close = () => { $('modalRoot').innerHTML = ''; };
      $('aiCancel').onclick = close; $('aiProv').onchange = () => draw($('aiProv').value);
      bindKeyHelp(() => draw(sel));
      $('aiDelKey').onclick = () => { AI.setKey(sel, ''); toast('Chiave cancellata'); draw(sel); };
      $('aiSave').onclick = () => {
        const k = $('aiKey').value.trim(); if (k) AI.setKey(sel, k);
        const o = { provider: sel }, mo = $('aiModel').value.trim(), vm = $('aiVModel').value.trim();
        if (cus) { o.baseUrl = $('aiUrl').value.trim(); o.model = mo; o.visionModel = vm; o.vision = !!vm; }
        else { if (mo && mo !== p.model) o.model = mo; if (vm && p.vision && vm !== p.visionModel) o.visionModel = vm; }
        prefs.ai = o; savePrefs(prefs); close(); renderAiRow(); toast('AI salvata · ' + p.label);
      };
    };
    draw((prefs.ai && prefs.ai.provider) || AI.DEFAULT_PROVIDER);
  }
  function renderAiRow() { const l = $('aiLabel'); if (!l || !AI) return; const c = AI.cfgOf(prefs); l.textContent = c.label + (AI.hasKey(c.provider) ? ' · chiave ✓' : ' · manca la chiave') + (c.vision ? '' : ' · niente foto'); }
  if ($('btnAiSet')) $('btnAiSet').addEventListener('click', () => { haptic(10); openAiSettings(); });
  if ($('btnAssist')) $('btnAssist').addEventListener('click', () => { haptic(10); openAssistant(); });
  if ($('btnAssistCalc')) $('btnAssistCalc').addEventListener('click', () => { haptic(10); openAssistant(); });
  renderAiRow();
  /** Photo for the AI: the preview, cropped to the chosen box (better detail). */
  function aiPhotoData() {
    return new Promise((resolve) => {
      if (!lastPhoto || !lastPhoto.img) { resolve(null); return; }
      const b = lastPhoto.box, full = !b || (b.l <= 0.01 && b.t <= 0.01 && b.r >= 0.99 && b.b >= 0.99);
      if (full || typeof document === 'undefined') { resolve(lastPhoto.img); return; }
      const im = new Image(); im.onload = () => { try {
        const W = im.naturalWidth, H = im.naturalHeight, x = Math.floor(b.l * W), y = Math.floor(b.t * H), w = Math.max(1, Math.ceil((b.r - b.l) * W)), h = Math.max(1, Math.ceil((b.b - b.t) * H));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(im, x, y, w, h, 0, 0, w, h); resolve(cv.toDataURL('image/jpeg', 0.9));
      } catch (e) { resolve(lastPhoto.img); } }; im.onerror = () => resolve(lastPhoto.img); im.src = lastPhoto.img;
    });
  }
  /** Web build: no ML Kit → pick/take a photo and read it with the AI vision model; otherwise an empty editable form. */
  function webPhoto(mode) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; if (mode !== 'gallery') inp.setAttribute('capture', 'environment');
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) { pendingJob = null; return; } webPhotoFile(f); };
    inp.click();
  }
  function webPhotoFile(f) {
    const rd = new FileReader();
    rd.onload = () => { const im = new Image(); im.onload = () => {
      const sc = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * sc), h = Math.round(im.naturalHeight * sc);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(im, 0, 0, w, h);
      webPhotoData(cv.toDataURL('image/jpeg', 0.88), w, h);
    }; im.onerror = () => toast('Foto non leggibile', 'warn'); im.src = rd.result; };
    rd.readAsDataURL(f);
  }
  async function webPhotoData(img, w, h, keep) {
    if (!keep || !lastPhoto) lastPhoto = { img, w, h, box: FULL_BOX() };
    const empty = (msg) => ({ S1A: null, F1A: null, G1A: null, rows: {}, header: {}, notes: [msg], lowConfidence: [] });
    const cfg = AI.cfgOf(prefs);
    if (!cfg.vision || !AI.hasKey(cfg.provider)) {
      const msg = 'Versione web: la lettura offline (ML Kit) non c’è. Usa «✨ Leggi foto con AI»' + (AI.hasKey(cfg.provider) ? ' (scegli in Setup un servizio che legge le foto)' : ' (metti la chiave AI in Setup)') + ' oppure scrivi i valori.';
      toast('Foto: serve l’AI per leggerla', 'warn'); openOcrConfirm(empty(msg)); return;
    }
    toast('✨ Leggo la foto con AI…');
    const r = await AI.readPhoto(prefs, img);
    if (r.ok && r.kind === 'foglio') { pendingInt = false; pendingFem = false; openSheetConfirm(r.sheet); toast('Foglio disegno letto con AI: controlla i valori'); return; }
    if (r.ok) { openOcrConfirm(r.parsed); toast('Letto con AI: controlla i valori'); return; }
    toast(r.error, 'warn'); openOcrConfirm(empty(r.error + ' Scrivi i valori a mano o riprova.'));
  }
  async function aiReadPhoto(parsed) {
    const btn = $('ocrAi'); if (!btn || btn.classList.contains('off')) { if (btn) toast(btn.dataset.why || 'Non disponibile', 'warn'); return; }
    const w = $('ocrWarn'); btn.classList.add('off'); btn.textContent = '✨ Leggo con AI…'; haptic(12);
    const r = await AI.readPhoto(prefs, await aiPhotoData());
    if (!$('ocrAi')) return;
    if (!r.ok) { btn.classList.remove('off'); btn.textContent = '✨ Leggi foto con AI'; if (w) { w.innerHTML = '⚠ ' + esc(r.error) + ' Restano i valori della lettura normale.'; w.classList.remove('hidden'); } return; }
    if (r.kind === 'foglio') { openSheetConfirm(r.sheet); toast('Foglio disegno riconosciuto: controlla i valori'); return; }
    openOcrConfirm(Object.assign(r.parsed, { _lavoro: parsed._lavoro }));
    const n = $('ocrParseNote'); if (n) n.classList.add('ai');
    toast('Letto con AI: controlla i valori');
  }
  // ── Beta 0.8.1: Aiuto – contacts + «Chiedi aiuto» (WhatsApp / SMS / Chiama). Numbers stay on this device (own key,
  //    never in exports/backups/CSV); the app only OPENS WhatsApp/SMS/phone with the text: the user taps Send. ──
  const CONTACTS_KEY = 'rweb_contacts';
  let contacts = (() => { try { const a = JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'); return Array.isArray(a) ? a.filter((c) => c && typeof c === 'object' && c.name).map((c) => ({ id: String(c.id || uid()), name: String(c.name).slice(0, 60), role: String(c.role || '').slice(0, 60), phone: String(c.phone || '').slice(0, 30), onShift: !!c.onShift })) : []; } catch (e) { return []; } })();
  function saveContacts() { try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts)); } catch (e) {} }
  /** Open WhatsApp (wa.me), the SMS app (sms:) or the dialer (tel:) – nothing is sent by the app itself. */
  function openExt(url) {
    const b = window.RettificaAndroid;
    if (b && b.openExternal) { try { b.openExternal(url); return true; } catch (e) {} }
    if (/^(tel|sms):/i.test(url)) { try { window.location.href = url; return true; } catch (e) { return false; } }
    try { window.open(url, '_blank', 'noopener'); return true; } catch (e) { return false; }
  }
  window.__openedExt = window.__openedExt || [];
  const openExtTracked = (u) => { window.__openedExt.push(u); return window.__noExt ? true : openExt(u); };
  function helpCtx() {
    const { machine, series } = currentContext(), aj = jobsOn ? activeJob() : null;
    const macchina = (aj && aj.machineName) || (machine && machine.name) || '';
    const serie = series ? (series.name && !/^Base /.test(series.name) ? series.name : 'Base ' + fmtMm3(series.base)) : '';
    let measure = '';
    if (lastCalc && lastCalc.S != null) measure = (lastCalc.display || fmtMmS(lastCalc.S)) + ' mm';
    else if (series && series.history && series.history.length) { const h = series.history[series.history.length - 1]; const v = h && (h.S != null ? h.S : h.F); if (v != null && isFinite(v)) measure = fmtMmS(v) + ' mm'; }
    return { macchina, serie, measure };
  }
  function renderAiuto() {
    const list = $('ctList'); if (!list) return;
    const c = helpCtx(), sh = contacts.find((x) => x.onShift);
    $('helpSub').innerHTML = c.macchina || c.serie ? `Macchina <b>${esc(c.macchina || '—')}</b> · lavoro <b>${esc(c.serie || '—')}</b>` : 'Nessun lavoro scelto: puoi scrivere tu la nota.';
    list.innerHTML = contacts.length ? contacts.map((x) => `<div class="ct-card${x.onShift ? ' shift' : ''}" data-id="${esc(x.id)}">
      <div class="ct-main"><b class="ct-name">${esc(x.name)}</b>${x.onShift ? '<span class="ct-badge">DI TURNO</span>' : ''}<span class="ct-role">${esc(x.role || '—')}</span><span class="ct-phone">${esc(x.phone)}</span></div>
      <div class="ct-btns"><button type="button" class="btn ${x.onShift ? 'btn-teal' : 'btn-sec'}" data-act="shift">${x.onShift ? '✓ Di turno' : 'Metti di turno'}</button>
      <button type="button" class="btn btn-sec" data-act="edit">✎ Modifica</button><button type="button" class="btn btn-sec" data-act="del" aria-label="Elimina ${esc(x.name)}">🗑</button></div></div>`).join('')
      : '<p class="meta ct-empty">Nessun contatto. Aggiungi il responsabile di turno, il capoturno, la manutenzione…</p>';
    list.querySelectorAll('.ct-card').forEach((card) => card.querySelectorAll('button').forEach((bt) => { bt.onclick = () => { haptic(12); const id = card.dataset.id, a = bt.dataset.act;
      if (a === 'shift') { contacts = setOnShift(contacts, id); saveContacts(); renderAiuto(); const x = contacts.find((y) => y.id === id); toast(x && x.onShift ? x.name + ' è di turno' : 'Nessuno di turno'); }
      else if (a === 'edit') openContactForm(id); else if (a === 'del') confirmDeleteContact(id); }; }));
    $('helpAsk').classList.toggle('dim', !contacts.length);
    $('helpAskSub').textContent = contacts.length ? (sh ? 'Scrive a ' + sh.name + ' (di turno)' : 'Scegli a chi scrivere') : 'Prima aggiungi un contatto';
  }
  function openContactForm(id) {
    const x = contacts.find((c) => c.id === id) || { name: '', role: '', phone: '', onShift: !contacts.some((c) => c.onShift) && !contacts.length };
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ct-form" id="ctForm"><h2>${id ? 'Modifica contatto' : 'Nuovo contatto'}</h2>
      <label for="ctName">Nome</label><input id="ctName" value="${esc(x.name)}" autocomplete="off" placeholder="es. Marco Rossi"/>
      <label for="ctRole">Ruolo</label><input id="ctRole" list="ctRoles" value="${esc(x.role)}" autocomplete="off" placeholder="es. responsabile di turno"/>
      <datalist id="ctRoles"><option value="Responsabile di turno"></option><option value="Capoturno"></option><option value="Manutenzione"></option><option value="Qualità"></option><option value="Collega"></option><option value="Capo reparto"></option></datalist>
      <label for="ctPhone">Telefono</label><input id="ctPhone" type="tel" inputmode="tel" value="${esc(x.phone)}" autocomplete="off" placeholder="es. 333 123 4567 o +39 333…"/>
      <label class="chk-big"><input type="checkbox" id="ctShift" ${x.onShift ? 'checked' : ''}/><span>È di turno adesso</span></label>
      <div id="ctErr" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-sec" id="ctCancel" style="flex:1;min-height:56px">Annulla</button><button type="button" class="btn btn-teal" id="ctSave" style="flex:1.4;min-height:56px">✓ Salva</button></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('ctCancel').onclick = close; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') close(); };
    $('ctSave').onclick = () => {
      const name = $('ctName').value.replace(/\s+/g, ' ').trim(), role = $('ctRole').value.replace(/\s+/g, ' ').trim(), phone = $('ctPhone').value.trim(), sh = $('ctShift').checked;
      const er = (t) => { const e = $('ctErr'); e.textContent = t; e.classList.remove('hidden'); haptic(60); };
      if (!name) { er('Scrivi il nome.'); return; }
      if (!phoneValid(phone)) { er('Numero non valido: servono da 6 a 15 cifre (es. 333 123 4567).'); return; }
      if (id) { const c = contacts.find((y) => y.id === id); Object.assign(c, { name, role, phone }); } else contacts.push({ id: uid(), name, role, phone, onShift: false });
      const cid = id || contacts[contacts.length - 1].id;
      if (sh) contacts = contacts.map((y) => Object.assign({}, y, { onShift: y.id === cid })); else if (id) contacts = contacts.map((y) => (y.id === cid ? Object.assign({}, y, { onShift: false }) : y));
      saveContacts(); close(); renderAiuto(); toast('Contatto salvato');
    };
    setTimeout(() => { try { $('ctName').focus(); } catch (e) {} }, 50);
  }
  function confirmDeleteContact(id) {
    const x = contacts.find((c) => c.id === id); if (!x) return;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal del-confirm" id="ctDel"><h2>Eliminare il contatto?</h2><p class="meta"><b>${esc(x.name)}</b> · ${esc(x.phone)}</p>
      <div class="actions" style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-sec" id="ctDelNo" style="flex:1;min-height:56px">Annulla</button><button type="button" class="btn btn-danger" id="ctDelYes" style="flex:1.3;min-height:56px">🗑 Elimina</button></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('ctDelNo').onclick = close; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') close(); };
    $('ctDelYes').onclick = () => { contacts = contacts.filter((c) => c.id !== id); saveContacts(); close(); renderAiuto(); toast('Contatto eliminato'); };
  }
  function openHelp() {
    if (!contacts.length) { toast('Prima aggiungi un contatto', 'warn'); openContactForm(null); return; }
    const ctx = helpCtx(), sh = shiftContact(contacts) || contacts[0];
    let sel = sh.id, msgId = 'aiuto', edited = false;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal help-modal" id="helpModal"><h2>🆘 Chiedi aiuto</h2>
      <div class="meta">A chi scrivere</div><div class="hp-cts" id="hpCts">${contacts.map((x) => `<label class="hp-ct${x.id === sel ? ' on' : ''}" data-id="${esc(x.id)}"><input type="radio" name="hpC" value="${esc(x.id)}" ${x.id === sel ? 'checked' : ''}/><span><b>${esc(x.name)}</b>${x.onShift ? ' <i class="ct-badge">DI TURNO</i>' : ''}<small>${esc(x.role || '—')} · ${esc(x.phone)}</small></span></label>`).join('')}</div>
      <div class="meta">Messaggio rapido</div><div class="hp-quick" id="hpQuick">${HELP_MSGS.map((m) => `<button type="button" class="chip${m.id === msgId ? ' on' : ''}" data-hq="${m.id}">${esc(m.label)}</button>`).join('')}</div>
      <label class="chk-big"><input type="checkbox" id="hpMeasChk" ${ctx.measure ? '' : 'disabled'}/><span>Aggiungi l'ultima misura${ctx.measure ? ': <b>' + esc(ctx.measure) + '</b>' : ' (nessuna misura)'}</span></label>
      <label for="hpNote">Nota libera (facoltativa)</label><input id="hpNote" placeholder="es. vieni al banco 3" autocomplete="off"/>
      <label for="hpText">Testo del messaggio (puoi modificarlo)</label><textarea id="hpText" rows="4"></textarea>
      <button type="button" class="btn btn-sec hidden" id="hpRegen" style="width:100%;min-height:44px;margin:4px 0">↺ Rigenera il testo</button>
      <div class="hp-send"><button type="button" class="btn hp-wa" id="hpWa">WhatsApp</button><button type="button" class="btn hp-sms" id="hpSms">SMS</button><button type="button" class="btn hp-call" id="hpCall">📞 Chiama</button></div>
      <p class="meta hp-note">L'app non invia nulla da sola: si apre WhatsApp, SMS o il telefono e tocchi tu <b>Invia</b> / <b>Chiama</b>.</p>
      <button type="button" class="btn btn-sec" id="hpClose" style="width:100%;min-height:52px;margin-top:6px">Chiudi</button></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    const compose = () => { const m = HELP_MSGS.find((x) => x.id === msgId) || HELP_MSGS[0]; return helpMessage(m.tpl, ctx, { measure: $('hpMeasChk').checked ? ctx.measure : '', note: $('hpNote').value }); };
    const refill = () => { if (!edited) $('hpText').value = compose(); $('hpRegen').classList.toggle('hidden', !edited); };
    document.querySelectorAll('#hpCts .hp-ct').forEach((l) => l.addEventListener('click', () => { sel = l.dataset.id; document.querySelectorAll('#hpCts .hp-ct').forEach((x) => x.classList.toggle('on', x === l)); }));
    document.querySelectorAll('#hpQuick [data-hq]').forEach((b) => { b.onclick = () => { haptic(10); msgId = b.dataset.hq; edited = false; document.querySelectorAll('#hpQuick .chip').forEach((x) => x.classList.toggle('on', x === b)); refill(); }; });
    $('hpMeasChk').addEventListener('change', refill); $('hpNote').addEventListener('input', refill);
    $('hpText').addEventListener('input', () => { edited = true; $('hpRegen').classList.remove('hidden'); });
    $('hpRegen').onclick = () => { edited = false; refill(); };
    refill();
    const go = (kind) => {
      const c = contacts.find((x) => x.id === sel); if (!c) { toast('Scegli a chi scrivere', 'warn'); return; }
      const text = $('hpText').value.trim(); if (!text && kind !== 'tel') { toast('Scrivi il messaggio', 'warn'); return; }
      const L = helpLinks(c.phone, text); haptic(20);
      const ok = openExtTracked(L[kind]);
      toast(!ok ? 'Non riesco ad aprire l’app' : kind === 'wa' ? 'Si apre WhatsApp: tocca Invia' : kind === 'sms' ? 'Si apre SMS: tocca Invia' : 'Si apre il telefono: tocca Chiama', ok ? '' : 'warn');
    };
    $('hpWa').onclick = () => go('wa'); $('hpSms').onclick = () => go('sms'); $('hpCall').onclick = () => go('tel');
    $('hpClose').onclick = close; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') close(); };
  }
  function openContactsExport() {
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal del-confirm" id="ctExpWarn"><h2>⚠ Esportare i contatti?</h2>
      <p>Il file contiene <b>nomi e numeri di telefono</b>. Condividilo solo con persone di fiducia. I contatti <b>non</b> sono mai nel backup normale.</p>
      <div class="actions" style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-sec" id="ctExpNo" style="flex:1;min-height:56px">Annulla</button><button type="button" class="btn btn-teal" id="ctExpYes" style="flex:1.3;min-height:56px">Esporta comunque</button></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('ctExpNo').onclick = close; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') close(); };
    $('ctExpYes').onclick = () => { close(); shareFile('rettifica-contatti-' + todayKey() + '.json', JSON.stringify({ tipo: 'contatti', contatti: contacts.map((x) => ({ name: x.name, role: x.role, phone: x.phone })) }, null, 2), 'application/json'); };
  }
  if ($('helpAsk')) {
    $('helpAsk').addEventListener('click', () => { haptic(15); openHelp(); });
    $('ctAdd').addEventListener('click', () => { haptic(10); openContactForm(null); });
    $('ctExport').addEventListener('click', () => { haptic(10); if (!contacts.length) { toast('Nessun contatto da esportare', 'warn'); return; } openContactsExport(); });
    $('ctImport').addEventListener('click', () => $('ctImportFile').click());
    $('ctImportFile').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { try { const j = JSON.parse(String(rd.result || '')); const r = mergeContacts(contacts, Array.isArray(j) ? j : j.contatti); contacts = r.list; saveContacts(); renderAiuto(); toast(`Contatti importati: ${r.added}${r.dup ? ' · già presenti ' + r.dup : ''}`); } catch (er) { toast('File contatti non valido', 'warn'); } e.target.value = ''; };
      rd.readAsText(f);
    });
    if ($('chatBack')) $('chatBack').addEventListener('click', () => { haptic(10); showPage('setup'); });
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // Beta 0.9.0 – Pacchetto serie / Lavoro ricevuto, blocco PIN, promemoria diamantatura, Quaderno macchina,
  // checklist per lavoro, report per lotto/turno. Nothing here touches the pairing math.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  function mKey() { return L9.machineKey((myMachine() || {}).name); }
  function nameOfHist(h, s) { return h.machineName || (machineById(h.machineId || (s && s.machineId)) || {}).name || ''; }
  function nowIso() { return new Date().toISOString(); }
  function dmHm(ts) { const d = new Date(ts), p = (n) => String(n).padStart(2, '0'); return p(d.getDate()) + '/' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  /** code / revision / lavorazione / lotto of a job (job fields first, then the series') */
  function jobMeta(j, s) { return { lotto: (j && j.lotto) || '', codice: (j && j.codice) || (s && s.codice) || '', rev: (j && j.rev) || (s && s.rev) || '', lav: (j && j.lav) || (s && s.lav) || '' }; }
  function metaLine(m) { return [m.codice ? 'Cod. ' + m.codice : '', m.rev ? 'rev ' + m.rev : '', m.lav ? 'Lav. ' + m.lav : '', m.lotto ? 'Lotto ' + m.lotto : ''].filter(Boolean).join(' · '); }
  function curMeta() { return jobMeta(jobsOn ? activeJob() : null, currentContext().series); }
  function metaSnap() { const m = curMeta(); return (m.lotto || m.codice || m.rev || m.lav) ? m : null; }
  function rowMeta(h, s) { return h.meta || jobMeta(h.jobId ? findJob(h.jobId) : null, s); }
  function infoModal(title, html, okTxt) {
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ask-big" id="infoModal" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><div class="ask-body">${html}</div>
      <div class="ask-btns"><button type="button" class="btn btn-orange" id="infoOk" style="flex:1">${esc(okTxt || 'OK')}</button></div></div></div>`;
    $('infoOk').onclick = () => { $('modalRoot').innerHTML = ''; }; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') $('modalRoot').innerHTML = ''; };
  }
  /** hand a file to the share sheet (Android bridge) / Web Share / download. Returns 'native' | 'share' | 'download' | 'cancel'. */
  async function shareOut(filename, content, mime, caption, b64) {
    try {
      if (window.RettificaAndroid) {
        if (b64 != null && RettificaAndroid.shareFileBase64) { RettificaAndroid.shareFileBase64(filename, b64, mime); return 'native'; }
        if (b64 == null && RettificaAndroid.shareFile) { RettificaAndroid.shareFile(filename, content, mime, caption || ''); return 'native'; }
        if (b64 == null && RettificaAndroid.shareText) { RettificaAndroid.shareText(filename, content); return 'native'; }
      }
    } catch (e) {}
    const blob = b64 != null ? new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: mime }) : new Blob([content], { type: mime });
    try {
      const file = typeof File !== 'undefined' ? new File([blob], filename, { type: mime }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename, text: caption || '' }); return 'share'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    toast('File creato: ' + filename); return 'download';
  }

  /* ───────── PIN: blocco quote (protezione contro gli ERRORI, non sicurezza) ───────── */
  function lockOn() { return !!(prefs.pin && prefs.pin.hash); }
  function lockedNow(s) { return !!(s && s.locked && lockOn()); }
  function askPin(title, hint) {
    return new Promise((resolve) => {
      $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ask-big" id="pinAsk" role="dialog" aria-modal="true"><h2>${esc(title || '🔒 Scrivi il PIN')}</h2>
        <div class="ask-body">${hint ? `<p class="meta">${esc(hint)}</p>` : ''}<input id="pinIn" class="big-input pin-in" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="PIN"/>
        <div id="pinErr" class="form-err hidden"></div><p class="meta" style="margin-top:8px"><button type="button" class="linkish" id="pinForgot">PIN dimenticato?</button></p></div>
        <div class="ask-btns"><button type="button" class="btn btn-sec" id="pinNo">Annulla</button><button type="button" class="btn btn-orange" id="pinYes">Sblocca</button></div></div></div>`;
      const done = (v) => { $('modalRoot').innerHTML = ''; resolve(v); };
      const go = () => { if (L9.pinCheck(prefs.pin, $('pinIn').value)) { haptic(20); done(true); } else { const e = $('pinErr'); e.textContent = 'PIN sbagliato'; e.classList.remove('hidden'); haptic(60); $('pinIn').value = ''; } };
      $('pinYes').onclick = go; $('pinNo').onclick = () => done(false); $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') done(false); };
      $('pinIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      $('pinForgot').onclick = () => { const e = $('pinErr'); e.innerHTML = 'Il PIN protegge dagli errori, non è una cassaforte. Per toglierlo: fai un backup (Setup → Esporta), poi Setup → Azzera tutto, poi Importa il backup: le serie tornano modificabili.'; e.classList.remove('hidden'); };
      setTimeout(() => { try { $('pinIn').focus(); } catch (x) {} }, 50);
    });
  }
  function openPinSetup() {
    const on = lockOn(), nLocked = state.series.filter((s) => s.locked).length;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="pinModal"><h2>🔒 Blocco quote</h2>
      <p class="meta">Con un PIN le serie ricevute dal pacchetto (e quelle che scegli) non si possono più modificare per sbaglio: tolleranze, gioco, base. <b>È una protezione contro gli errori, non una sicurezza</b>: chi cancella i dati o l'app toglie anche il PIN.</p>
      <p class="meta" id="pinState">${on ? '🔒 PIN attivo · ' + nLocked + (nLocked === 1 ? ' serie bloccata' : ' serie bloccate') : 'PIN non impostato'}</p>
      ${on ? '<label>PIN attuale</label><input id="pinCur" class="big-input pin-in" type="password" inputmode="numeric" maxlength="8" autocomplete="off"/>' : ''}
      <label>${on ? 'Nuovo PIN (lascia vuoto per togliere il PIN)' : 'Scegli un PIN (4–8 cifre)'}</label><input id="pinNew" class="big-input pin-in" type="password" inputmode="numeric" maxlength="8" autocomplete="off"/>
      <label>Ripeti il PIN</label><input id="pinNew2" class="big-input pin-in" type="password" inputmode="numeric" maxlength="8" autocomplete="off"/>
      <label class="chk-big"><input type="checkbox" id="pinAll"/><span>Blocca anche le serie già presenti</span></label>
      <div id="pinErr2" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-sec" id="pinCancel" style="flex:1">Chiudi</button><button type="button" class="btn btn-teal" id="pinSave" style="flex:1">${on ? 'Salva' : 'Imposta PIN'}</button></div></div></div>`;
    const err = (t) => { const e = $('pinErr2'); e.textContent = t; e.classList.remove('hidden'); haptic(60); };
    $('pinCancel').onclick = () => { $('modalRoot').innerHTML = ''; }; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') $('modalRoot').innerHTML = ''; };
    $('pinSave').onclick = () => {
      const n1 = $('pinNew').value, n2 = $('pinNew2').value;
      if (on && !L9.pinCheck(prefs.pin, $('pinCur').value)) return err('PIN attuale sbagliato');
      if (on && !n1) { // remove
        delete prefs.pin; state.series.forEach((s) => { delete s.locked; }); qtList().forEach((c) => { delete c.locked; }); savePrefs(prefs); saveData(state); $('modalRoot').innerHTML = ''; toast('PIN tolto · serie sbloccate'); renderSeriesIfOpen(); return;
      }
      if (!L9.pinValid(n1)) return err('Il PIN deve avere da 4 a 8 cifre');
      if (n1 !== n2) return err('I due PIN sono diversi');
      prefs.pin = L9.pinMake(n1); savePrefs(prefs);
      if ($('pinAll').checked) { state.series.forEach((s) => { s.locked = true; }); qtList().forEach((c) => { c.locked = true; }); }
      saveData(state); $('modalRoot').innerHTML = ''; toast('PIN impostato'); renderSeriesIfOpen();
    };
  }
  function renderSeriesIfOpen() { if ($('page-serie').classList.contains('active')) renderSeries(); }

  /* ───────── Dati lavoro (numero lotto, codice, revisione, lavorazione) + intestazione ───────── */
  function renderJobStrip() {
    const el = $('jobStrip'); if (!el) return;
    const j = jobsOn ? activeJob() : null, s = currentContext().series;
    if (!j || !s) { el.classList.add('hidden'); renderDress(); return; }
    el.classList.remove('hidden');
    const ml = metaLine(jobMeta(j, s));
    $('jsMeta').innerHTML = ml ? esc(ml) : '＋ Lotto · codice · lavorazione';
    $('jsMeta').classList.toggle('empty', !ml);
    const ck = checkStateOf(j, s), ph = ck.inizio.complete || !ck.inizio.total ? 'fine' : 'inizio', c = ck[ph];
    $('jsChkT').textContent = (ph === 'inizio' ? 'Inizio ' : 'Fine ') + c.done + '/' + c.total;
    $('jsChk').classList.toggle('done', c.complete); $('jsChk').classList.toggle('hidden', !ck.inizio.total && !ck.fine.total);
    renderDress();
  }
  function openJobData() {
    const j = activeJob(); if (!j) { toast('Prima scegli un lavoro', 'warn'); return; }
    const s = currentContext().series || {};
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="jdModal"><h2>Dati del lavoro</h2>
      <p class="meta">Compaiono in alto in Calcolo, nello Storico, nel CSV e nel riepilogo turno.</p>
      <label>Numero lotto</label><input id="jdLotto" class="big-input" value="${esc(j.lotto || '')}" maxlength="40" autocomplete="off" placeholder="es. 24-1187"/>
      <label>Codice (disegno / articolo)</label><input id="jdCod" class="big-input" value="${esc(j.codice || '')}" maxlength="40" autocomplete="off" placeholder="${esc(s.codice || 'es. 12345-A')}"/>
      <div class="field-row"><div><label>Revisione</label><input id="jdRev" class="big-input" value="${esc(j.rev || '')}" maxlength="12" autocomplete="off" placeholder="${esc(s.rev || 'es. B')}"/></div>
      <div><label>Lavorazione</label><input id="jdLav" class="big-input" value="${esc(j.lav || '')}" maxlength="40" autocomplete="off" placeholder="${esc(s.lav || 'es. 0522')}"/></div></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-sec" id="jdCancel" style="flex:1">Annulla</button><button type="button" class="btn btn-teal" id="jdSave" style="flex:1">Salva</button></div></div></div>`;
    $('jdCancel').onclick = () => { $('modalRoot').innerHTML = ''; }; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') $('modalRoot').innerHTML = ''; };
    $('jdSave').onclick = () => {
      const v = (id) => $(id).value.replace(/\s+/g, ' ').trim();
      j.lotto = v('jdLotto').slice(0, 40); j.codice = v('jdCod').slice(0, 40); j.rev = v('jdRev').slice(0, 12); j.lav = v('jdLav').slice(0, 40); j.updatedAt = nowIso();
      saveData(state); $('modalRoot').innerHTML = ''; renderJobStrip(); toast('Dati lavoro salvati');
    };
  }
  $('jsMeta').addEventListener('click', () => { haptic(10); openJobData(); });
  $('jsChk').addEventListener('click', () => { haptic(10); const ck = checkStateOf(activeJob(), currentContext().series); openChecklist(ck.inizio.complete || !ck.inizio.total ? 'fine' : 'inizio'); });

  /* ───────── Checklist per lavoro ───────── */
  /** make sure the job has its checklist state (items copied from the series / the user's default / the built-in list) */
  function ensureJobCheck(j, s) {
    if (!j) return null;
    const cl = L9.checklistFor(s, prefs.checkDefault);
    if (!j.check) j.check = { inizio: L9.checkNew(cl.inizio), fine: L9.checkNew(cl.fine) };
    return j.check;
  }
  function checkStateOf(j, s) {
    const c = ensureJobCheck(j, s) || { inizio: { items: [] }, fine: { items: [] } };
    return { inizio: L9.checkCount(c.inizio), fine: L9.checkCount(c.fine) };
  }
  let ckPhase = 'inizio';
  function openChecklist(phase) {
    const j = activeJob(); if (!j) { toast('Prima scegli un lavoro', 'warn'); return; }
    const s = currentContext().series; ensureJobCheck(j, s); ckPhase = phase || ckPhase;
    const cnt = (ph) => L9.checkCount(j.check[ph]);
    const st = j.check[ckPhase], c = cnt(ckPhase);
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ck-modal" id="ckModal"><h2>📋 Checklist</h2>
      <div class="man-seg sm ck-tabs" id="ckTabs"><button type="button" data-ph="inizio" class="${ckPhase === 'inizio' ? 'on' : ''}">Inizio lavoro <small>${cnt('inizio').done}/${cnt('inizio').total}</small></button><button type="button" data-ph="fine" class="${ckPhase === 'fine' ? 'on' : ''}">Fine lavoro <small>${cnt('fine').done}/${cnt('fine').total}</small></button></div>
      <div class="ck-list" id="ckItems">${st.items.length ? st.items.map((t, i) => `<button type="button" class="ck-item ${st.done[i] ? 'on' : ''}" data-i="${i}" aria-pressed="${st.done[i] ? 'true' : 'false'}"><span class="ck-box">${st.done[i] ? '✓' : ''}</span><span class="ck-t">${esc(t)}</span></button>`).join('') : '<p class="meta">Nessuna voce: tocca «Modifica voci».</p>'}</div>
      <div class="meta" id="ckState">${c.complete ? '✓ Completata' + (st.at ? ' alle ' + esc(fmtTime(st.at)) : '') : c.done + ' di ' + c.total + ' fatte'}</div>
      <button type="button" class="btn btn-teal ck-all" id="ckAll" ${st.items.length ? '' : 'disabled'}>✓ Tutto ok <small>(tieni premuto)</small></button>
      <div class="actions" style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-sec" id="ckEdit" style="flex:1">✎ Modifica voci</button><button type="button" class="btn btn-sec" id="ckClose" style="flex:1">Chiudi</button></div></div></div>`;
    const redraw = () => { saveData(state); openChecklist(ckPhase); renderJobStrip(); };
    $('ckClose').onclick = () => { $('modalRoot').innerHTML = ''; renderJobStrip(); }; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') { $('modalRoot').innerHTML = ''; renderJobStrip(); } };
    $('ckTabs').querySelectorAll('[data-ph]').forEach((b) => { b.onclick = () => { ckPhase = b.dataset.ph; openChecklist(ckPhase); }; });
    $('ckItems').querySelectorAll('.ck-item').forEach((b) => { b.onclick = () => { haptic(15); L9.checkToggle(st, Number(b.dataset.i), nowIso()); redraw(); }; });
    // long press = «tutto ok»; a short tap only explains
    let tmr = null, fired = false; const all = $('ckAll');
    const start = () => { fired = false; clearTimeout(tmr); tmr = setTimeout(() => { fired = true; haptic(50); L9.checkAll(st, nowIso()); redraw(); toast('Tutto ok · checklist completa'); }, 600); };
    const stop = () => { clearTimeout(tmr); tmr = null; };
    all.addEventListener('pointerdown', start); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => all.addEventListener(ev, stop));
    all.addEventListener('click', () => { if (!fired) toast('Tieni premuto per spuntare tutto'); });
    $('ckEdit').onclick = () => openChecklistEdit();
  }
  function openChecklistEdit() {
    const j = activeJob(), s = currentContext().series; if (!j || !s) return;
    const cl = L9.checklistFor(s, prefs.checkDefault);
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ck-modal" id="ckeModal"><h2>✎ Voci della checklist</h2>
      <p class="meta">Una voce per riga, massimo ${L9.MAX_CHECK_ITEMS} per parte. Valgono per questa serie (e per i lavori nuovi).</p>
      <label>Inizio lavoro</label><textarea id="ckeInizio" class="neu" rows="5">${esc(cl.inizio.join('\n'))}</textarea>
      <label>Fine lavoro</label><textarea id="ckeFine" class="neu" rows="3">${esc(cl.fine.join('\n'))}</textarea>
      <label class="chk-big"><input type="checkbox" id="ckeDef"/><span>Usa queste voci anche per le altre serie</span></label>
      <div id="ckeErr" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-sec" id="ckeCancel" style="flex:1">Annulla</button><button type="button" class="btn btn-teal" id="ckeSave" style="flex:1">Salva</button></div></div></div>`;
    $('ckeCancel').onclick = () => openChecklist(ckPhase);
    $('ckeSave').onclick = () => {
      const raw = { inizio: $('ckeInizio').value, fine: $('ckeFine').value }, n = (t) => String(t).split(/\r?\n/).map((x) => x.trim()).filter(Boolean).length;
      if (n(raw.inizio) > L9.MAX_CHECK_ITEMS || n(raw.fine) > L9.MAX_CHECK_ITEMS) { const e = $('ckeErr'); e.textContent = 'Massimo ' + L9.MAX_CHECK_ITEMS + ' voci per parte'; e.classList.remove('hidden'); haptic(60); return; }
      const nc = L9.normalizeChecklist(raw) || { inizio: [], fine: [] };
      s.checklist = { inizio: nc.inizio, fine: nc.fine };
      if ($('ckeDef').checked) { prefs.checkDefault = { inizio: nc.inizio.slice(), fine: nc.fine.slice() }; savePrefs(prefs); }
      // keep the ticks of the entries that did not change
      ['inizio', 'fine'].forEach((ph) => { const old = j.check && j.check[ph], nw = L9.checkNew(nc[ph]); if (old) nw.items.forEach((t, i) => { const k = old.items.indexOf(t); if (k >= 0 && old.done[k]) nw.done[i] = true; }); if (nw.items.length && nw.done.every(Boolean)) nw.at = nowIso(); j.check = j.check || {}; j.check[ph] = nw; });
      saveData(state); toast('Checklist salvata'); openChecklist(ckPhase);
    };
  }

  /* ───────── Promemoria diamantatura + Quaderno macchina ───────── */
  function renderDress() {
    const b = $('dressBanner'), n = $('dressNote'); if (!b || !n) return;
    const info = L9.dressInfo(state, mKey(), nameOfHist);
    if (info.on && info.due) {
      b.innerHTML = `<div class="db-t">🔔 Promemoria: diamantatura – ${info.count} pezzi dall'ultima</div><div class="db-b"><button type="button" class="btn btn-teal" id="dbDone">💎 Fatta</button><button type="button" class="btn btn-sec" id="dbSnooze">⏱ Rimanda di ${info.snoozeStep} pezzi</button></div>`;
      b.classList.remove('hidden');
    } else { b.classList.add('hidden'); b.innerHTML = ''; }
    n.classList.toggle('hidden', !info.after);
    n.innerHTML = info.after ? `<span>✋ Primo pezzo dopo diamantatura: controlla con calma</span><button type="button" class="dn-x" id="dnX" aria-label="Chiudi">✕</button>` : '';
    fitPads();
  }
  $('dressBanner').addEventListener('click', (e) => {
    if (e.target.closest('#dbDone')) { haptic(30); L9.addEvent(state, { type: 'diamantatura', machine: (myMachine() || {}).name, nameOf: nameOfHist }); saveData(state); renderDress(); toast('Diamantatura registrata'); }
    if (e.target.closest('#dbSnooze')) { haptic(15); const c = L9.snoozeDress(state, mKey(), null, nameOfHist); saveData(state); renderDress(); toast('Te lo ricordo tra ' + c.snoozeStep + ' pezzi'); }
  });
  $('dressNote').addEventListener('click', (e) => { if (e.target.closest('#dnX')) { L9.cfgOf(state, mKey()).after = false; saveData(state); renderDress(); } });
  /** after a saved piece: the first piece after a dressing clears the «controlla con calma» note */
  function dressAfterSave() { const c = L9.cfgOf(state, mKey()); if (c.after) { c.after = false; saveData(state); } renderDress(); }

  let qdSel = null;
  function qdMachines() {
    const seen = new Map(), add = (n) => { const k = L9.machineKey(n); if (n && !seen.has(k)) seen.set(k, String(n).trim()); };
    add((myMachine() || {}).name); (state.quaderno || []).forEach((e) => add(e.machine)); (state.jobs || []).concat(state.jobsArchive || []).forEach((j) => add(j.machineName));
    return [...seen.entries()].map(([k, n]) => ({ k, n }));
  }
  function renderQuaderno() {
    const list = qdMachines(), cur = L9.machineKey((myMachine() || {}).name);
    if (!qdSel || !list.some((m) => m.k === qdSel)) qdSel = cur;
    const key = qdSel, mname = (list.find((m) => m.k === key) || { n: '' }).n;
    const info = L9.dressInfo(state, key, nameOfHist), cfg = L9.cfgOf(state, key), evs = L9.eventsOf(state, key);
    $('qdSel').innerHTML = list.length ? list.map((m) => `<option value="${esc(m.k)}" ${m.k === key ? 'selected' : ''}>${esc(m.n)}</option>`).join('') : '<option value="">(macchina senza nome)</option>';
    $('qdEvery').value = info.every || ''; $('qdStep').value = cfg.snoozeStep || 10;
    document.querySelectorAll('#qdPre [data-n]').forEach((b) => b.classList.toggle('on', Number(b.dataset.n) === info.every));
    $('qdCount').innerHTML = info.on
      ? `<b class="cond" style="font-size:26px">${info.count}</b> / ${info.every} pezzi dall'ultima diamantatura${info.lastTs ? `<div class="meta">ultima: ${esc(dmHm(info.lastTs))}</div>` : '<div class="meta">nessuna diamantatura registrata: il conteggio parte da quando hai acceso il promemoria</div>'}${info.due ? '<div class="qd-due">🔔 Promemoria: è ora della diamantatura</div>' : ''}`
      : '<span class="meta">Promemoria spento. Scegli ogni quanti pezzi (es. 50): ti ricorda la diamantatura, senza bloccare nulla.</span>';
    $('qdList').innerHTML = evs.length ? evs.map((e) => { const t = L9.EVENT_TYPES[e.type] || L9.EVENT_TYPES.nota;
      return `<div class="qd-ev" data-id="${esc(e.id)}"><div class="qd-ic">${t.icon}</div><div class="qd-bd"><b>${esc(t.label)}</b> <span class="meta">${esc(dmHm(e.ts))}</span>${e.pz != null ? `<div class="meta">${e.pz} ${e.pz === 1 ? 'pezzo' : 'pezzi'} dalla voce precedente</div>` : ''}${e.note ? `<div class="qd-note">${esc(e.note)}</div>` : ''}</div><button type="button" class="job-del" data-evdel="${esc(e.id)}" aria-label="Elimina voce">${TRASH}</button></div>`; }).join('') : '<div class="empty">Nessuna voce: registra la prima con i pulsanti sopra</div>';
    $('qdHead').textContent = mname ? 'Macchina: ' + mname : 'Macchina';
  }
  function openEventModal(type) {
    const t = L9.EVENT_TYPES[type] || L9.EVENT_TYPES.nota;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="evModal"><h2>${t.icon} ${esc(t.label)}</h2>
      <label>Nota ${type === 'nota' ? '' : '(facoltativa)'}</label><textarea id="evNote" class="neu" rows="3" maxlength="300" placeholder="${type === 'manopola' ? 'es. conicità: 2 tacche verso di me' : type === 'mola' ? 'es. mola nuova, codice…' : ''}"></textarea>
      <div id="evErr" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-sec" id="evCancel" style="flex:1">Annulla</button><button type="button" class="btn btn-teal" id="evSave" style="flex:1">✓ Registra</button></div></div></div>`;
    $('evCancel').onclick = () => { $('modalRoot').innerHTML = ''; }; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') $('modalRoot').innerHTML = ''; };
    $('evSave').onclick = () => {
      const note = $('evNote').value.trim();
      if (type === 'nota' && !note) { const e = $('evErr'); e.textContent = 'Scrivi la nota'; e.classList.remove('hidden'); return; }
      const mn = (qdMachines().find((m) => m.k === qdSel) || {}).n || (myMachine() || {}).name || '';
      L9.addEvent(state, { type, machine: mn, note, nameOf: nameOfHist }); saveData(state); $('modalRoot').innerHTML = ''; haptic(30); toast(t.label + ' registrata'); renderQuaderno(); renderDress();
    };
  }
  $('qdSel').addEventListener('change', () => { qdSel = $('qdSel').value; renderQuaderno(); });
  $('qdBtns').addEventListener('click', (e) => { const b = e.target.closest('[data-ev]'); if (b) { haptic(15); openEventModal(b.dataset.ev); } });
  function qdSetEvery(n) {
    const key = qdSel || mKey(); L9.setDressEvery(state, key, n, nowIso());
    const step = parseInt($('qdStep').value, 10); if (step > 0) L9.cfgOf(state, key).snoozeStep = Math.min(999, step);
    saveData(state); renderQuaderno(); renderDress();
  }
  $('qdPre').addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (b) { haptic(10); $('qdEvery').value = b.dataset.n === '0' ? '' : b.dataset.n; qdSetEvery(Number(b.dataset.n)); toast(Number(b.dataset.n) ? 'Promemoria ogni ' + b.dataset.n + ' pezzi' : 'Promemoria spento'); } });
  $('qdSet').addEventListener('click', () => { const n = parseInt($('qdEvery').value, 10) || 0; qdSetEvery(n); toast(n ? 'Promemoria ogni ' + n + ' pezzi' : 'Promemoria spento'); });
  $('qdList').addEventListener('click', async (e) => {
    const d = e.target.closest('[data-evdel]'); if (!d) return;
    if (await askBig({ title: 'Eliminare questa voce?', ok: '🗑 Elimina', danger: true })) { L9.removeEvent(state, d.dataset.evdel); saveData(state); renderQuaderno(); renderDress(); }
  });
  $('qdBack').addEventListener('click', () => showPage('setup'));

  /* ───────── Pacchetto: Lavoro ricevuto / Invia lavoro ───────── */
  function fmtT3(x) { return fmtMm3(x); }
  function pkgSeriesHtml(ps) {
    const rows = [['Nome', ps.nome || '—'], ['Base', fmtT3(ps.base) + ' mm ± ' + fmtT3(ps.tolleranza)], ['Gioco', ps.giocoMin + '–' + ps.giocoMax + ' µm']];
    if (ps.obiettivo != null) rows.push(['Consigliata', 'gioco obiettivo ' + fmtUm(ps.obiettivo) + ' µm' + (ps.fasciaLo != null ? ' · fascia ' + fmtUm(ps.fasciaLo) + '–' + fmtUm(ps.fasciaHi) : '')]);
    else if (ps.fasciaLo != null) rows.push(['Consigliata', 'fascia ' + fmtUm(ps.fasciaLo) + '–' + fmtUm(ps.fasciaHi) + ' µm']);
    rows.push(['Ovalità/conicità', ps.forma === false ? 'non richieste' : 'controllate' + (ps.lim ? ` (conicità ok ≤ ${fmtUm(ps.lim.conOk)}, max ${fmtUm(ps.lim.conMax)} µm)` : '')]);
    if (ps.fixedF != null) rows.push(['Femmina fissa', fmtMm4(ps.fixedF) + ' mm']);
    return `<div class="pk-ser">${rows.map((r) => `<div class="pk-r"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('')}${ps.note ? `<div class="pk-note">${esc(ps.note)}</div>` : ''}</div>`;
  }
  function pkgControlloHtml(pc, withName) {
    const rows = (pc.quote || []).map((q) => [q.nome + ' · ' + QT.TIPI[q.tipo], QT.quotaText(q)]);
    return `<div class="pk-ser" id="rcvControllo"><div class="pk-r"><span>📏 Controllo quota</span><b>${esc(pc.nome)}</b></div>${rows.map((r) => `<div class="pk-r"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('')}<div class="pk-r"><span>Ovalità/conicità</span><b>${pc.forma ? 'da controllare' : 'non richieste'}</b></div>${pc.note ? `<div class="pk-note">${esc(pc.note)}</div>` : ''}</div>`;
  }
  async function receivePackage(text, source) {
    const r = await L9.parseAny(text);
    if (!r.ok) { infoModal('Pacchetto non letto', `<p>${esc(r.error)}</p>`); return false; }
    const v = L9.validatePackage(r.obj);
    if (!v.ok) { infoModal('Pacchetto non valido', `<p>${v.errors.map(esc).join('<br/>')}</p>`); return false; }
    openReceived(v, source); return true;
  }
  function openReceived(v, source) {
    const p = v.pkg, nQ = (p.controlli || []).length, onlyQ = !p.serie.length && nQ > 0, one = p.serie.length === 1 || (onlyQ && nQ === 1), m = myMachine() || {};
    const matches = p.serie.map((ps) => L9.findMatch(state.series, ps));
    const matchesQ = (p.controlli || []).map((pc) => QT.findControllo(qtList(), pc));
    const anyMatch = matches.some(Boolean) || matchesQ.some(Boolean);
    const already = state.series.some((s) => s.fromPackage && p.check && s.fromPackage.check === p.check) || qtList().some((c) => c.fromPackage && p.check && c.fromPackage.check === p.check);
    const j = p.job, cl = p.checklist;
    const metaRows = [['Codice', j.codice], ['Revisione', j.rev], ['Lavorazione', j.lavorazione], ['Numero lotto', j.lotto]];
    const integ = p.checkState === 'ok' ? '<div class="pk-ok">✓ Controllo integrità OK (il file è completo)</div>' : p.checkState === 'mismatch' ? '<div class="pk-warn">⚠ Il codice di controllo non corrisponde: controlla bene i numeri</div>' : '<div class="meta">Pacchetto senza codice di controllo.</div>';
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal pk-recv" id="rcvModal" role="dialog" aria-modal="true"><h2>📥 ${one ? 'Lavoro ricevuto' : onlyQ ? 'Controlli ricevuti (' + nQ + ')' : 'Serie ricevute (' + p.serie.length + ')'}</h2>
      <p class="meta">Controlla i dati: l'app non li usa finché non tocchi <b>${one ? 'Accetta e inizia' : onlyQ ? 'Importa i controlli' : 'Importa le serie'}</b>.${source ? '' : ''}</p>
      ${one || j.lotto || j.codice ? `<div class="pk-meta">${metaRows.map((r) => `<div><span>${r[0]}</span><b id="rcv${r[0].replace(/\W/g, '')}">${esc(r[1] || '—')}</b></div>`).join('')}</div>` : ''}
      ${p.serie.map((ps, i) => (p.serie.length > 1 ? `<h3 class="pk-h">${esc(ps.nome || 'Base ' + fmtT3(ps.base))}${ps.codice ? ' · ' + esc(ps.codice) : ''}</h3>` : '') + pkgSeriesHtml(ps)).join('')}
      ${(p.controlli || []).map((pc) => pkgControlloHtml(pc, nQ > 1)).join('')}
      ${j.note ? `<div class="pk-cl" id="rcvNote"><b>💬 Nota del responsabile</b><div class="pk-note">${esc(j.note)}</div></div>` : ''}
      ${cl ? `<div class="pk-cl"><b>📋 Checklist</b><div class="meta">Inizio: ${cl.inizio.map(esc).join(' · ') || '—'}</div><div class="meta">Fine: ${cl.fine.map(esc).join(' · ') || '—'}</div></div>` : ''}
      ${integ}${already ? '<div class="pk-warn" id="rcvAlready">⚠ Hai già importato questo pacchetto.</div>' : ''}
      ${v.warnings.map((w) => `<div class="pk-warn">⚠ ${esc(w)}</div>`).join('')}
      ${anyMatch ? `<div class="pk-choice" id="rcvChoiceBox"><b>Esiste già ${matches.some(Boolean) ? 'una serie' : 'un controllo quota'} con lo stesso ${(matches.find(Boolean) || matchesQ.find(Boolean)).how === 'codice' ? 'codice' : matches.some(Boolean) ? 'nome e base' : 'nome'}</b>
        <label class="pk-rad"><input type="radio" name="rcvChoice" id="rcvUpd" value="update" checked/><span>Aggiorna ${matches.some(Boolean) ? 'la serie' : 'il controllo'} esistente <small>(le misure salvate restano)</small></span></label>
        <label class="pk-rad"><input type="radio" name="rcvChoice" id="rcvNew" value="new"/><span>Crea ${matches.some(Boolean) ? 'una nuova serie' : 'un nuovo controllo'}</span></label>
        <div class="pk-diff" id="rcvDiff">${matchesQ.map((mm, i) => { if (!mm) return ''; const d = QT.diffControllo(mm.c, p.controlli[i]); return `<div class="meta">«${esc(mm.c.nome)}»: ${d.length ? '' : 'nessuna differenza'}</div>` + d.map((x) => `<div class="pk-d"><span>${esc(x.label)}</span><s>${esc(x.from)}</s> → <b>${esc(x.to)}</b></div>`).join(''); }).join('')}${matches.map((mm, i) => { if (!mm) return ''; const d = L9.diffSeries(mm.series, p.serie[i]); return `<div class="meta">«${esc(mm.series.lotto || 'Base ' + fmtT3(mm.series.base))}»: ${d.length ? '' : 'nessuna differenza'}</div>` + d.map((x) => `<div class="pk-d"><span>${esc(x.label)}</span><s>${esc(x.from)}</s> → <b>${esc(x.to)}</b></div>`).join(''); }).join('')}</div></div>` : ''}
      ${lockOn() ? '<div class="meta" id="rcvLockNote">🔒 Le serie importate saranno bloccate dal tuo PIN.</div>' : ''}
      ${p.serie.length === 1 ? `<label for="rcvMachine">Macchina</label><input id="rcvMachine" class="big-input cond" value="${esc(m.name || '')}" maxlength="40" autocomplete="off" placeholder="es. S33 O060"/>` : ''}
      ${onlyQ ? `<div class="meta" id="rcvMachQ">Macchina: <b>${esc(m.name || '—')}</b> (si cambia da Calcolo)</div>` : ''}
      <div id="rcvErr" class="form-err hidden"></div>
      <div class="pk-bar"><button type="button" class="btn btn-orange pk-go" id="rcvGo">${one ? '✅ Accetta e inizia' : onlyQ ? '✅ Importa i controlli' : '✅ Importa le serie'}</button>
      <div class="actions" style="display:flex;gap:8px;margin-top:8px">${one ? `<button type="button" class="btn btn-sec" id="rcvSave" style="flex:1">${onlyQ ? 'Salva solo il controllo' : 'Salva solo la serie'}</button>` : ''}<button type="button" class="btn btn-sec" id="rcvNo" style="flex:1">Rifiuta</button></div></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('rcvNo').onclick = close;
    const go = (start) => {
      const choice = anyMatch ? ($('rcvNew').checked ? 'new' : 'update') : 'new';
      let machineName = '';
      if (start && $('rcvMachine')) { machineName = $('rcvMachine').value.replace(/\s+/g, ' ').trim(); if (!machineName) { const e = $('rcvErr'); e.textContent = 'Scrivi il nome della macchina'; e.classList.remove('hidden'); haptic(60); return; } }
      const res = acceptPackage(v, { choice, start, machineName });
      close(); if (res && res.msg) toast(res.msg);
      if (start && res && res.checkInizio) setTimeout(() => openChecklist('inizio'), 250);
    };
    $('rcvGo').onclick = () => go(one);
    if ($('rcvSave')) $('rcvSave').onclick = () => go(false);
  }
  /** Create / update the series from the package and (single series, start=true) start the job. */
  function acceptPackage(v, o) {
    const p = v.pkg, now = nowIso(); const made = [];
    p.serie.forEach((ps) => {
      const match = o.choice === 'update' ? L9.findMatch(state.series, ps) : null;
      const s = match ? match.series : { id: uid(), machineId: myMachine() ? myMachine().id : null, history: [], stock: {} };
      L9.applyToSeries(s, ps, { name: 'Base ' + fmtMm3(ps.base), locked: lockOn(), check: p.check, now, checklist: p.serie.length === 1 ? p.checklist : null });
      if (!match) state.series.push(s);
      made.push({ s, updated: !!match });
    });
    const madeC = [];
    (p.controlli || []).forEach((pc) => {
      const match = o.choice === 'update' ? QT.findControllo(qtList(), pc) : null;
      const c = match ? match.c : { id: 'c_' + uid(), nome: '', quote: [] };
      QT.applyControllo(c, pc, { lotto: p.job.lotto, check: p.check, now }); c.locked = lockOn() ? true : undefined; if (c.locked === undefined) delete c.locked;
      if (!match) qtList().push(c);
      madeC.push({ c, updated: !!match });
    });
    saveData(state);
    let msg = made.length === 1 ? (made[0].updated ? 'Serie aggiornata' : 'Serie creata') + ' · Base ' + fmtMm3(made[0].s.base) : made.length + ' serie importate';
    let checkInizio = false;
    if (o.start && made.length === 1) {
      const s = made[0].s, jb = p.job;
      const job = startJob({ machineName: o.machineName, series: s, codice: jb.codice, lotto: jb.lotto, rev: jb.rev, lav: jb.lavorazione });
      job.pkg = { check: p.check, at: now }; if (jb.note) job.pkgNote = jb.note;
      ensureJobCheck(job, s); checkInizio = job.check.inizio.items.length > 0;
      saveData(state); newMeasure(); showPage('calc'); msg = 'Lavoro iniziato · ' + metaLine(jobMeta(job, s) ) || msg;
    } else if (o.start && !made.length && madeC.length === 1) {
      qtSetCur(madeC[0].c.id); saveData(state); showPage('quota'); msg = (madeC[0].updated ? 'Controllo aggiornato' : 'Controllo creato') + ' · ' + madeC[0].c.nome;
    } else { fillSetupSelects(); renderSeriesIfOpen(); updateChip(); if (!made.length && madeC.length) msg = madeC.length === 1 ? (madeC[0].updated ? 'Controllo aggiornato' : 'Controllo creato') : madeC.length + ' controlli importati'; }
    return { msg, checkInizio, made, madeC };
  }
  function openReceiveMenu() {
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="rmModal"><h2>📥 Ricevi lavoro</h2>
      <p class="meta">Il responsabile ti manda un <b>pacchetto</b> (file, QR o codice). Apri qui sotto il modo in cui l'hai ricevuto.</p>
      <button type="button" class="btn-job wide" id="rmFile"><span class="ji">📂</span><span><b>Apri un file</b><small>.rettifica o .json ricevuto (WhatsApp, email…)</small></span></button>
      <button type="button" class="btn-job wide" id="rmQr" style="margin-top:8px"><span class="ji">▦</span><span><b>Leggi un QR da foto</b><small>scatta il QR o scegli la foto</small></span></button>
      <button type="button" class="btn-job wide" id="rmPaste" style="margin-top:8px"><span class="ji">📋</span><span><b>Incolla il codice</b><small>testo che inizia con RTF…</small></span></button>
      <div class="actions" style="display:flex;margin-top:12px"><button type="button" class="btn btn-sec" id="rmClose" style="flex:1">Chiudi</button></div></div></div>`;
    $('rmClose').onclick = () => { $('modalRoot').innerHTML = ''; }; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') $('modalRoot').innerHTML = ''; };
    $('rmFile').onclick = () => { $('pkFile').value = ''; $('pkFile').click(); };
    $('rmQr').onclick = () => { $('pkQrFile').value = ''; $('pkQrFile').click(); };
    $('rmPaste').onclick = () => openPasteCode();
  }
  function openPasteCode() {
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="pasteModal"><h2>📋 Incolla il codice</h2>
      <p class="meta">Incolla il codice del pacchetto (inizia con <b>RTF1.</b> o <b>RTF2.</b>) o l'intero messaggio che hai ricevuto.</p>
      <textarea id="pasteTxt" class="neu" rows="6" placeholder="RTF2.…"></textarea><div id="pasteErr" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-sec" id="pasteNo" style="flex:1">Annulla</button><button type="button" class="btn btn-teal" id="pasteGo" style="flex:1">Leggi</button></div></div></div>`;
    $('pasteNo').onclick = () => { $('modalRoot').innerHTML = ''; };
    $('pasteGo').onclick = async () => { const t = $('pasteTxt').value; const r = await L9.parseAny(t); if (!r.ok) { const e = $('pasteErr'); e.textContent = r.error; e.classList.remove('hidden'); return; } await receivePackage(t, 'paste'); };
  }
  $('pkFile').addEventListener('change', async (e) => { const f = e.target.files && e.target.files[0]; try { if (f) await receivePackage(await f.text(), 'file'); } finally { e.target.value = ''; } });
  /** decode a QR from a photo (jsQR) – tries a few sizes */
  async function qrFromBlob(blob) {
    if (typeof window.jsQR !== 'function') throw new Error('noqr');
    const bmp = await createImageBitmap(blob);
    for (const maxSide of [1400, 900, 2000, 600]) {
      const sc = Math.min(1, maxSide / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(bmp, 0, 0, w, h);
      const r = window.jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' }); if (r && r.data) return r.data;
    }
    return null;
  }
  $('pkQrFile').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    try {
      if (!f) return;
      let txt = null; try { txt = await qrFromBlob(f); } catch (err) { infoModal('QR non letto', '<p>Lettura del QR non disponibile su questo telefono. Usa il file o incolla il codice.</p>'); return; }
      if (!txt) { infoModal('QR non trovato', '<p>Non riesco a leggere un QR in questa foto. Avvicinati, tieni il QR dritto e intero, senza riflessi; oppure usa il file o il codice.</p>'); return; }
      await receivePackage(txt, 'qr');
    } finally { e.target.value = ''; }
  });
  // ── entry points: Android intent (file / share / text), PWA file handler ──
  window.__pkgCheck = function () {
    try { if (!(window.RettificaAndroid && RettificaAndroid.takePackage)) return; const raw = RettificaAndroid.takePackage(); if (!raw) return; const o = JSON.parse(raw); if (o && o.text) receivePackage(o.text, 'intent'); } catch (e) {}
  };
  if ('launchQueue' in window) { try { window.launchQueue.setConsumer(async (lp) => { for (const h of lp.files || []) { try { const f = await h.getFile(); await receivePackage(await f.text(), 'file'); } catch (e) {} } }); } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') window.__pkgCheck(); });

  function sendCtx() {
    const j = jobsOn ? activeJob() : null, cur = currentContext().series;
    return { j, cur };
  }
  function openSendJob(seriesId) {
    const { j, cur } = sendCtx(); const list = state.series, cls = qtList();
    if (!list.length && !cls.length) { toast('Prima crea una serie', 'warn'); return; }
    let sid = seriesId || (cur && cur.id) || (list[0] ? list[0].id : 'c:' + cls[0].id);
    const fill = () => {
      const sv0 = $('sjSeries').value;
      if (sv0.indexOf('c:') === 0) { const c = cls.find((x) => x.id === sv0.slice(2)); if (c) { $('sjLotto').value = c.lotto || ''; $('sjCod').value = c.codice || ''; $('sjRev').value = c.rev || ''; $('sjLav').value = c.lav || ''; $('sjChk').checked = false; $('sjChk').disabled = true; return; } }
      $('sjChk').disabled = false;
      const s = seriesById(sv0) || list[0], same = j && cur && s.id === cur.id;
      $('sjLotto').value = same ? (j.lotto || '') : ''; $('sjCod').value = same ? (j.codice || s.codice || '') : (s.codice || ''); $('sjRev').value = same ? (j.rev || s.rev || '') : (s.rev || ''); $('sjLav').value = same ? (j.lav || s.lav || '') : (s.lav || '');
      $('sjChk').checked = !!s.checklist;
    };
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="sdModal"><h2>📤 Invia lavoro</h2>
      <p class="meta">Crea il pacchetto e lo condividi con WhatsApp, email… (o QR). L'app <b>non invia niente da sola</b>: scegli tu l'app e la persona. Non contiene numeri di telefono né dati personali.</p>
      <label>Serie</label><select id="sjSeries" class="neu">${list.map((s) => `<option value="${esc(s.id)}" ${s.id === sid ? 'selected' : ''}>${esc((s.lotto ? s.lotto + ' · ' : '') + 'Base ' + fmtMm3(s.base) + ' · gioco ' + s.giocoMin + '–' + s.giocoMax)}</option>`).join('')}${cls.length ? `<optgroup label="Controllo quota">${cls.map((c) => `<option value="c:${esc(c.id)}" ${('c:' + c.id) === sid ? 'selected' : ''}>${esc('📏 ' + c.nome + ' · ' + c.quote.length + (c.quote.length === 1 ? ' quota' : ' quote'))}</option>`).join('')}</optgroup>` : ''}</select>
      <label>Numero lotto</label><input id="sjLotto" class="big-input" maxlength="40" autocomplete="off"/>
      <label>Codice (disegno / articolo)</label><input id="sjCod" class="big-input" maxlength="40" autocomplete="off"/>
      <div class="field-row"><div><label>Revisione</label><input id="sjRev" class="big-input" maxlength="12" autocomplete="off"/></div><div><label>Lavorazione</label><input id="sjLav" class="big-input" maxlength="40" autocomplete="off" placeholder="es. 0522"/></div></div>
      <label>Nota per l'operatore (facoltativa)</label><textarea id="sjNote" class="neu" rows="2" maxlength="300"></textarea>
      <label class="chk-big"><input type="checkbox" id="sjChk"/><span>Includi la checklist</span></label>
      <div id="sjErr" class="form-err hidden"></div>
      <button type="button" class="btn btn-orange pk-go" id="sjShare">📤 Invia (WhatsApp, email…)</button>
      <div class="actions" style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button type="button" class="btn btn-sec" id="sjQr" style="flex:1">▦ Mostra QR</button><button type="button" class="btn btn-sec" id="sjCopy" style="flex:1">📋 Copia codice</button></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn btn-sec" id="sjSave" style="flex:1">💾 Salva file</button><button type="button" class="btn btn-sec" id="sjClose" style="flex:1">Chiudi</button></div></div></div>`;
    fill(); $('sjSeries').onchange = fill;
    $('sjClose').onclick = () => { $('modalRoot').innerHTML = ''; }; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') $('modalRoot').innerHTML = ''; };
    const build = () => {
      const sv = $('sjSeries').value, v = (id) => $(id).value.replace(/\s+/g, ' ').trim();
      if (sv.indexOf('c:') === 0) { const c = cls.find((x) => x.id === sv.slice(2)); return L9.buildPackage({ series: [], controlli: [Object.assign({}, c, { lotto: v('sjLotto'), codice: v('sjCod') || c.codice, rev: v('sjRev'), lav: v('sjLav') })], job: { lotto: v('sjLotto'), codice: v('sjCod'), rev: v('sjRev'), lav: v('sjLav'), note: $('sjNote').value }, checklist: null, appVersion: APP_VERSION, now: nowIso() }); }
      const s = seriesById(sv);
      const clb = $('sjChk').checked ? L9.checklistFor(s, prefs.checkDefault) : null;
      return L9.buildPackage({ series: s, job: { lotto: v('sjLotto'), codice: v('sjCod'), rev: v('sjRev'), lav: v('sjLav'), note: $('sjNote').value }, checklist: clb, appVersion: APP_VERSION, now: nowIso() });
    };
    $('sjShare').onclick = async () => { const pkg = build(); haptic(20); await shareOut(L9.packageFileName(pkg), JSON.stringify(pkg, null, 1), 'application/json', L9.packageCaption(pkg)); };
    $('sjSave').onclick = async () => { const pkg = build(); const fn = L9.packageFileName(pkg), txt = JSON.stringify(pkg, null, 1); try { if (window.RettificaAndroid) { await shareOut(fn, txt, 'application/json', L9.packageCaption(pkg)); return; } } catch (e) {} const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = fn; document.body.appendChild(a); a.click(); a.remove(); toast('File creato: ' + fn); };
    $('sjCopy').onclick = async () => {
      const code = await L9.encodeCode(build()); let ok = false;
      try { if (window.RettificaAndroid && RettificaAndroid.copyText) { RettificaAndroid.copyText(code); ok = true; } else if (navigator.clipboard) { await navigator.clipboard.writeText(code); ok = true; } } catch (e) {}
      toast(ok ? 'Codice copiato' : 'Copia non riuscita', ok ? '' : 'warn'); window.__lastCode = code;
    };
    $('sjQr').onclick = async () => {
      const pkg = build(), code = await L9.encodeCode(pkg);
      if (code.length > 2400) { const e = $('sjErr'); e.textContent = 'Pacchetto troppo grande per un QR (' + code.length + ' caratteri): togli la checklist o accorcia le note, oppure usa il file.'; e.classList.remove('hidden'); return; }
      let img = '';
      try { const q = window.qrcode(0, 'L'); q.addData(code); q.make(); const n = q.getModuleCount(); img = q.createDataURL(Math.max(3, Math.floor(300 / (n + 8))), 16); } catch (er) { const e = $('sjErr'); e.textContent = 'QR non creato: usa il file o il codice'; e.classList.remove('hidden'); return; }
      $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ask-big" id="qrModal"><h2>▦ QR del lavoro</h2><div class="ask-body" style="text-align:center"><img id="qrImg" alt="QR del pacchetto" src="${img}" style="width:min(86vw,320px);image-rendering:pixelated;background:#fff;border-radius:8px"/>
        <p class="meta">Sull'altro telefono: <b>Setup → Ricevi lavoro → Leggi un QR da foto</b>. Tieni il QR intero e dritto.</p></div><div class="ask-btns"><button type="button" class="btn btn-orange" id="qrClose" style="flex:1">Chiudi</button></div></div></div>`;
      $('qrClose').onclick = () => { $('modalRoot').innerHTML = ''; }; window.__lastCode = code;
    };
  }

  /* ───────── Report per lotto / turno (CSV a colonne fisse + PDF di una pagina) ───────── */
  function reportRows(pred) {
    const rows = [];
    allSeries().forEach((s) => (s.history || []).forEach((h) => {
      const m = rowMeta(h, s), sn = h.snap || {}, base = sn.base != null ? sn.base : s.base;
      const r = { ts: h.ts, machine: nameOfHist(h, s), serie: s.lotto || ('Base ' + fmtMm3(s.base)), codice: m.codice, rev: m.rev, lav: m.lav, lotto: m.lotto, base, tol: sn.tolMm != null ? sn.tolMm : seriesTol(s),
        gmin: sn.giocoMin != null ? sn.giocoMin : s.giocoMin, gmax: sn.giocoMax != null ? sn.giocoMax : s.giocoMax, lavoro: h.lavoro || 'maschio', S: h.S, d: h.S != null ? round1((h.S - base) * 1000) : null,
        chosen: h.chosen, gioco: h.gioco, con: h.con, conEnd: h.conEnd, status: h.status || '' };
      if (!pred || pred(r, h)) rows.push(r);
    }));
    qtQuotaRows().forEach((r) => { if (!pred || pred(r, null)) rows.push(Object.assign({}, r, { tol: null, gmin: null, gmax: null })); }); // Beta 0.9.1 controllo quota (one row per quota)
    return rows.sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
  }
  function reportLotti() { return [...new Set(reportRows().map((r) => r.lotto).filter(Boolean))]; }
  function reportScopeRows(scope, lotto) {
    if (scope === 'turno') { const t0 = (state.turno && state.turno.startedAt) || ''; return { rows: reportRows((r) => String(r.ts || '') >= t0), label: 'Turno in corso' }; }
    if (scope === 'oggi') return { rows: reportRows((r) => r.ts && localDayKey(r.ts) === localDayKey()), label: 'Oggi' };
    if (scope === 'lotto') return { rows: reportRows((r) => L9.machineKey(r.lotto) === L9.machineKey(lotto) && r.lotto), label: 'Lotto ' + lotto };
    return { rows: reportRows(), label: 'Tutte le misure' };
  }
  function uniq(a) { return [...new Set(a.filter(Boolean))]; }
  function reportModel(scope, lotto) {
    const { rows, label } = reportScopeRows(scope, lotto), st = L9.reportStats(rows);
    const srows = rows.filter((r) => !r.qNome), qrows = rows.filter((r) => r.qNome), qpz = uniq(qrows.map((r) => r.pid)).length;
    const quad = ((state.quaderno || []).filter((e) => e.type === 'diamantatura' && (!st.first || (e.ts >= st.first && e.ts <= (st.last || e.ts)))));
    const j = jobsOn ? activeJob() : null, ck = j && j.check ? { a: L9.checkCount(j.check.inizio), b: L9.checkCount(j.check.fine) } : null;
    const p2 = (ts) => ts ? dmHm(ts) : '—';
    const info = [['Perimetro', label], ['Periodo', st.n ? p2(st.first) + ' – ' + p2(st.last) : '—'], ['Macchina', uniq(rows.map((r) => r.machine)).join(', ') || '—'],
      ['Codice / rev.', uniq(rows.map((r) => [r.codice, r.rev && 'rev ' + r.rev].filter(Boolean).join(' '))).join(', ') || '—'], ['Lavorazione', uniq(rows.map((r) => r.lav)).join(', ') || '—'], ['Numero lotto', uniq(rows.map((r) => r.lotto)).join(', ') || '—'],
      ['Serie', uniq(srows.map((r) => r.serie + ' (base ' + fmtMm3(r.base) + ' ± ' + fmtMm3(r.tol) + ', gioco ' + r.gmin + '–' + r.gmax + ' µm)')).join('; ') || '—']];
    if (qrows.length) info.push(['Controllo quota', uniq(qrows.map((r) => r.qNome + ' ' + fmtMm3(r.qLo) + '–' + fmtMm3(r.qHi))).join('; ')]);
    const stats = [['Pezzi', st.n], ['Buoni', st.buoni + (st.pctBuoni != null ? ' (' + String(st.pctBuoni).replace('.', ',') + '%)' : '')], ['Scarti', st.scarti], ['Gioco misurato', st.gMin != null ? fmtUm(st.gMin) + '–' + fmtUm(st.gMax) + ' µm (medio ' + String(st.gAvg).replace('.', ',') + ')' : '—'],
      ['Conicità max', st.conMax != null ? fmtUm(st.conMax) + ' µm' : '—'], ['Diamantature', quad.length]];
    if (qrows.length) { const fz = uniq(qrows.filter((r) => r.status === 'fuori').map((r) => r.pid)).length; stats.push(['Pezzi controllo quota', qpz], ['Dentro / fuori', (qpz - fz) + ' / ' + fz]); }
    const notes = []; if (ck) notes.push('Checklist del lavoro in corso: inizio ' + ck.a.done + '/' + ck.a.total + ', fine ' + ck.b.done + '/' + ck.b.total + '.');
    if (scope === 'turno' && state.turno && state.turno.note) notes.push('Nota turno: ' + String(state.turno.note).replace(/\s+/g, ' ').slice(0, 110));
    return { rows, label, st, model: { title: 'Rettifica – Report ' + label.toLowerCase(), sub: 'Creato il ' + new Date().toLocaleString('it-IT') + ' · v' + APP_VERSION, info, stats, notes,
      cols: [{ h: 'Data ora', x: 40, w: 11 }, { h: 'Serie', x: 100, w: 20 }, { h: 'Lotto', x: 215, w: 11 }, { h: 'Misura mm', x: 275, w: 10 }, { h: 'Pezzo', x: 335, w: 6 }, { h: 'Gioco/Scost.', x: 375, w: 8 }, { h: 'Conicità', x: 430, w: 8 }, { h: 'Esito', x: 485, w: 10 }],
      rows: rows.map((r) => r.qNome ? [dmHm(r.ts), r.serie + ' · ' + r.qNome, r.lotto, fmtMmS(r.S), '', QT.sg(r.qDev), '', r.qEsito] : [dmHm(r.ts), r.serie, r.lotto, fmtMmS(r.S), r.chosen == null ? '' : r.chosen, fmtUm(r.gioco), r.con == null ? '' : fmtUm(r.con), r.status]),
      footer: 'Rettifica Beta · misure salvate in Calcolo · nessun dato personale' } };
  }
  function openReport(scope0) {
    const lotti = reportLotti(); let scope = scope0 || 'turno';
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="rpModal"><h2>📄 Report</h2>
      <p class="meta">Riepilogo di una pagina (PDF) o tabella (CSV) di tutte le misure. Nessun dato personale. Lo condividi tu.</p>
      <div class="rp-scope" id="rpScope">${[['turno', 'Turno in corso'], ['oggi', 'Oggi'], ['lotto', 'Un lotto'], ['tutto', 'Tutto']].map(([k, t]) => `<label class="pk-rad"><input type="radio" name="rpScope" value="${k}" ${k === scope ? 'checked' : ''}/><span>${t}</span></label>`).join('')}</div>
      <select id="rpLotto" class="neu ${scope === 'lotto' ? '' : 'hidden'}">${lotti.length ? lotti.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('') : '<option value="">(nessun lotto salvato)</option>'}</select>
      <div class="meta" id="rpInfo"></div><div id="rpErr" class="form-err hidden"></div>
      <button type="button" class="btn btn-orange pk-go" id="rpPdf">📄 Report PDF (1 pagina)</button>
      <div class="actions" style="display:flex;gap:8px;margin-top:8px"><button type="button" class="btn btn-sec" id="rpCsv" style="flex:1">📊 CSV</button><button type="button" class="btn btn-sec" id="rpClose" style="flex:1">Chiudi</button></div></div></div>`;
    const cur = () => { const sc = document.querySelector('input[name="rpScope"]:checked').value; return { sc, lt: $('rpLotto').value }; };
    const upd = () => { const { sc, lt } = cur(); $('rpLotto').classList.toggle('hidden', sc !== 'lotto'); const r = reportScopeRows(sc, lt); $('rpInfo').textContent = r.rows.length + (r.rows.length === 1 ? ' pezzo' : ' pezzi') + ' · ' + r.label; return r; };
    document.querySelectorAll('input[name="rpScope"]').forEach((i) => { i.onchange = upd; }); $('rpLotto').onchange = upd; upd();
    $('rpClose').onclick = () => { $('modalRoot').innerHTML = ''; }; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') $('modalRoot').innerHTML = ''; };
    const nameFor = (sc, lt, ext) => 'rettifica-report-' + (sc === 'lotto' ? 'lotto-' + String(lt).replace(/[^A-Za-z0-9._-]+/g, '_') : sc) + '-' + todayKey() + '.' + ext;
    const need = (r) => { if (r.rows.length) return true; const e = $('rpErr'); e.textContent = 'Nessuna misura in questo perimetro'; e.classList.remove('hidden'); return false; };
    $('rpPdf').onclick = async () => { const { sc, lt } = cur(), rep = reportModel(sc, lt); if (!need(rep)) return; const pdf = L9.buildPdf(rep.model); await shareOut(nameFor(sc, lt, 'pdf'), null, 'application/pdf', 'Report Rettifica', L9.pdfToBase64(pdf)); };
    $('rpCsv').onclick = async () => { const { sc, lt } = cur(), rep = reportModel(sc, lt); if (!need(rep)) return; await shareOut(nameFor(sc, lt, 'csv'), L9.reportCsv(rep.rows), 'text/csv', 'Report Rettifica'); };
  }
  $('btnTurnoReport').addEventListener('click', () => openReport('turno'));
  $('btnReportStorico').addEventListener('click', () => openReport('oggi'));

  // ── Setup rows + Quaderno page ──
  $('btnRecv').addEventListener('click', openReceiveMenu);
  $('btnSend').addEventListener('click', () => openSendJob());
  $('btnQuaderno').addEventListener('click', () => { qdSel = null; showPage('quaderno'); });
  $('btnPin').addEventListener('click', openPinSetup);
  $('btnReport').addEventListener('click', () => openReport('turno'));
  function refreshSetup090() {
    refreshQuotaLabel();
    const s = $('pinLabel'); if (s) s.textContent = lockOn() ? '🔒 PIN attivo · ' + state.series.filter((x) => x.locked).length + ' serie bloccate' : 'PIN non impostato · protegge dagli errori';
    const q = $('qdLabel'); if (q) { const i = L9.dressInfo(state, mKey(), nameOfHist); q.textContent = i.on ? 'Promemoria diamantatura: ogni ' + i.every + ' pezzi (' + i.count + ' fatti)' : 'Diamantatura, cambio mola, note · promemoria spento'; }
  }

  /* ───────── Beta 0.9.1–0.9.2: Controllo quota (lavoro senza accoppiamento: DENTRO / FUORI per quota) ───────── */
  const qS = { buf: '', sel: null, vals: {}, ctl: null, lock: false, live: { spoken: null, haptic: null } };
  // Beta 0.9.4: the piece being measured survives leaving the page or a reloaded WebView (app closed, camera, Back)
  const QT_DRAFT_KEY = 'rweb_quota_draft';
  (function qtLoadDraft() { try { const d = JSON.parse(localStorage.getItem(QT_DRAFT_KEY) || 'null'); if (d && d.ctl && d.vals && typeof d.vals === 'object') { qS.ctl = d.ctl; qS.vals = d.vals; qS.sel = d.sel || null; qS.buf = typeof d.buf === 'string' ? d.buf.slice(0, 12) : ''; } } catch (e) {} })();
  function qtSaveDraft() { try { if (qS.ctl && (Object.keys(qS.vals).length || qS.buf)) localStorage.setItem(QT_DRAFT_KEY, JSON.stringify({ ctl: qS.ctl, vals: qS.vals, sel: qS.sel, buf: qS.buf })); else localStorage.removeItem(QT_DRAFT_KEY); } catch (e) {} }
  const qtUnlocked = new Set();
  const numTxt = (x) => (x == null ? '' : String(x).replace('.', ','));
  function qtList() { if (!Array.isArray(state.controlli)) state.controlli = []; return state.controlli; }
  function qtPezzi() { if (!Array.isArray(state.quotaPezzi)) state.quotaPezzi = []; return state.quotaPezzi; }
  function qtCur() { const l = qtList(); return l.find((c) => c.id === prefs.controlloId) || l[0] || null; }
  function qtSetCur(id) { prefs.controlloId = id; savePrefs(prefs); qS.ctl = null; qS.buf = ''; qS.vals = {}; qS.sel = null; qS.live = { spoken: null, haptic: null }; }
  function qtMachine() { return (myMachine() || {}).name || ''; }
  function qtMeta(c) { return { codice: c.codice || '', rev: c.rev || '', lav: c.lav || '', lotto: c.lotto || '' }; }
  function qtActive(c) { return (c.quote || []).find((q) => q.id === qS.sel) || (c.quote || []).find((q) => qS.vals[q.id] == null) || (c.quote || [])[0] || null; }
  function qtLive(c) { const q = qtActive(c); if (!q) return { q: null, v: null }; return { q, v: qS.buf ? QT.parseMeasure(qS.buf, q) : null }; }
  function qtVals(c) { const o = Object.assign({}, qS.vals), l = qtLive(c); if (l.q && l.v != null) o[l.q.id] = l.v; return o; }
  async function qtGuard(c) { if (!lockedNow(c) || qtUnlocked.has(c.id)) return true; const ok = await askPin('🔒 Sblocca il controllo', c.nome); if (ok) qtUnlocked.add(c.id); return ok; }
  function qtShift() { const t0 = (state.turno && state.turno.startedAt) || ''; return qtPezzi().filter((r) => String(r.ts || '') >= t0); }
  function qtAdvice(ev, cal) {
    // correction block: words, never claims more than the data allows
    const cr = ev.corr, diam = ev.tipo !== 'posizione';
    if (cr.kind === 'nessuna' || cr.kind === 'centro') return `<div class="qt-corr ok" id="qtCorr"><b>${cr.kind === 'centro' ? '✓ Al centro: nessuna correzione' : '✓ Non serve correggere'}</b></div>`;
    const note = diam && cr.key ? `<small>${esc(calLegend())} · ${ev.verify ? '+ / − <b>da verificare</b>: controlla sempre dopo il 1° pezzo' : 'segno verificato'}</small>` : (diam && cr.next ? `<small>${esc(calLegend())} · ${ev.verify ? '+ / − da verificare: controlla sempre dopo il 1° pezzo' : 'segno verificato'}</small>` : '');
    const next = cr.next ? `<div style="margin-top:4px">${esc(cr.next.words)}</div>` : '';
    return `<div class="qt-corr ${cr.recoverable ? '' : 'no'}" id="qtCorr"><b>${esc(cr.words)}</b>${next}${note}</div>`;
  }

  function qtStreakHtml(c) {
    if (!c) return { html: '<span class="qs-lab">Ultimi:</span><span class="qs-ok">Nessun pezzo ancora</span>', empty: true, label: 'Nessun pezzo ancora' };
    const pieces = QT.lastPieces(qtPezzi(), c.id, c.lotto || '', 12);
    const st = QT.streakOf(pieces);
    if (!st.n) return { html: '<span class="qs-lab">Ultimi:</span><span class="qs-ok">Nessun pezzo ancora</span>', empty: true, label: 'Nessun pezzo ancora' };
    const dots = st.states.map((s) => `<span class="qs-dot ${s}" title="${s === 'fuori' ? 'FUORI' : 'DENTRO'}"></span>`).join('');
    return { html: `<span class="qs-lab">Ultimi:</span><span class="qs-dots">${dots}</span><span class="qs-ok">di fila OK: <b>${st.streakOk}</b></span>`, empty: false, label: 'Ultimi ' + st.n + ' pezzi, di fila OK ' + st.streakOk, streakOk: st.streakOk, n: st.n };
  }
  function qtApplyLive(ev) {
    if (!ev || (ev.state !== 'dentro' && ev.state !== 'fuori')) return;
    const fb = QT.liveFeedback(qS.live, ev.state);
    qS.live = fb.next;
    if (fb.hapticMs) haptic(fb.hapticMs);
    if (fb.speak && prefs.voiceAuto) speakIt(fb.speak === 'fuori' ? 'fuori' : 'dentro');
  }
  function renderQuota() {
    const c = qtCur(), cal = calOf();
    const hide = (ids, on) => ids.forEach((i) => $(i).classList.toggle('hidden', on));
    $('qtCfgTxt').textContent = c ? c.nome : 'nessun controllo';
    if (!c || !(c.quote || []).length) {
      hide(['qtList', 'qtField', 'qtRes', 'qKeypad', 'qtDet', 'qtStreak'], true); $('qtMeta').classList.toggle('hidden', !c); hide(['qtEmpty'], false);
      if (c) { $('qtMeta').textContent = metaLine(qtMeta(c)) || '＋ Lotto · codice · lavorazione'; $('qtMeta').classList.toggle('empty', !metaLine(qtMeta(c))); }
      $('qtEmpty').innerHTML = c ? `<h2>${esc(c.nome)}</h2><p class="meta">Questo controllo non ha ancora quote. Aggiungi la prima: nominale e tolleranza, oppure un codice ISO (h6, H7…).</p><button type="button" class="btn btn-orange" id="qtAddFirst">＋ Aggiungi quota</button>`
        : `<h2>📏 Controllo quota</h2><p class="meta">Per i pezzi <b>senza accoppiamento</b>: misuri e l'app dice <b>DENTRO</b> o <b>FUORI</b> tolleranza, con quanto correggere.</p><button type="button" class="btn btn-orange" id="qtTpl">📐 Usa il modello del disegno A-A<br/><small>Ø42 h6 · 29,5 ± 0,02</small></button><button type="button" class="btn btn-sec" id="qtNew">＋ Nuovo controllo vuoto</button><button type="button" class="btn btn-sec" id="qtRecv">📥 Ricevi un lavoro (file, QR, codice)</button>`;
      fitPads(); return;
    }
    hide(['qtEmpty'], true); hide(['qtList', 'qtField', 'qtRes', 'qKeypad', 'qtMeta', 'qtStreak'], false);
    if (qS.ctl !== c.id) { qS.ctl = c.id; qS.vals = {}; qS.buf = ''; qS.sel = null; qS.live = { spoken: null, haptic: null }; }
    const act = qtActive(c); qS.sel = act ? act.id : null;
    const vals = qtVals(c), ec = QT.evalControllo(c, vals, cal), live = qtLive(c);
    const ml = metaLine(qtMeta(c)); $('qtMeta').textContent = (ml ? ml + ' · ' : '') + (qtMachine() || 'macchina?'); $('qtMeta').classList.toggle('empty', !ml);
    $('qtList').innerHTML = ec.items.map((it) => {
      const ev = it.ev, st = !ev ? '' : ev.state === 'fuori' ? 'fuori' : ev.near ? 'limite' : 'dentro';
      return `<button type="button" class="qt-row ${st} ${it.q.id === qS.sel ? 'on' : ''}" data-qid="${esc(it.q.id)}" aria-label="Quota ${esc(it.q.nome)}"><span class="qr-n"><b>${esc(it.q.nome)}</b><small>${esc(QT.TIPI[it.q.tipo])} · ${esc(QT.quotaText(it.q))}</small></span>
        <span class="qr-r"><b class="cond">${ev ? QT.fmtN(ev.value, 4) : '—'}</b><small>${!ev ? 'da misurare' : ev.state === 'fuori' ? 'FUORI ' + QT.sg(ev.devUm) + ' µm' : (ev.near ? 'DENTRO · limite' : 'DENTRO') + ' ' + QT.sg(ev.devUm) + ' µm'}</small></span></button>`;
    }).join('') + (ec.measured ? `<div class="qt-all ${ec.overall}" id="qtAll">PEZZO: ${ec.overall === 'fuori' ? 'FUORI' : '✓ DENTRO'}<small>${ec.fuori ? ec.fuori + (ec.fuori === 1 ? ' quota fuori' : ' quote fuori') + ' · ' : ''}${ec.measured} di ${ec.total} ${ec.total === 1 ? 'quota misurata' : 'quote misurate'}</small></div>` : '');
    // entry field with the full-value preview
    const q = act, av = live.v != null ? live.v : (qS.vals[q.id] != null && !qS.buf ? qS.vals[q.id] : null);
    $('qtFieldLbl').innerHTML = `Misura · ${esc(q.nome)}${qS.buf ? ` <i>scritto ${esc(qS.buf)}</i>` : ''}`;
    $('qtVal').textContent = qS.buf && live.v == null ? qS.buf + ' …' : (av != null ? QT.fmtMeasure(av, qS.buf || String(av)) + ' mm' : '—');
    const nPz = qtPezzi().filter((p) => p.controlloId === c.id && (p.lotto || '') === (c.lotto || '')).length;
    let h = '', det = '';
    if (av == null) h = `<div class="fr-empty" id="qtHint">${esc(QT.TIPI[q.tipo])}: da <b>${QT.fmtN(QT.quotaLimits(q).lo, 3)}</b> a <b>${QT.fmtN(QT.quotaLimits(q).hi, 3)}</b> mm, centro <b>${QT.fmtN(QT.quotaLimits(q).centro, 3)}</b>. Scrivi la misura (anche solo le ultime cifre, es. <b>${QT.fmtN(QT.quotaLimits(q).centro, 4).split(',')[1].slice(0, 3)}</b>).<br/><small>Pezzo n. ${nPz + 1}${c.lotto ? ' · lotto ' + esc(c.lotto) : ''}</small></div>`;
    else {
      const ev = QT.evalQuota(q, av, cal), l = QT.quotaLimits(q), um = QT.fmtUm;
      const vf = ev.verify && ev.tipo !== 'posizione' && (ev.corr.key || (ev.corr.next && ev.corr.next.key)) ? (cal && cal.modo === 'valore' ? ' · segno da verificare' : ' · tocchi da verificare') : '';
      const big = ev.state === 'fuori' ? `<div class="qt-big fuori" id="qtBig"><b>FUORI</b><small>${um(ev.outByUm)} µm ${ev.side === 'sotto' ? 'sotto il minimo' : 'sopra il massimo'}${vf}</small></div>`
        : `<div class="qt-big ${ev.near ? 'limite' : 'dentro'}" id="qtBig"><b>DENTRO</b><small>${ev.near ? 'vicino al limite ' + (ev.marginLoUm <= ev.marginHiUm ? 'inferiore' : 'superiore') : 'in tolleranza'} · margini ${um(ev.marginLoUm)} / ${um(ev.marginHiUm)} µm${vf}</small></div>`;
      const mg = (x, nm) => (x >= 0 ? 'restano ' + um(x) + ' µm' : 'oltre di ' + um(x) + ' µm');
      const nums = `<div class="qt-nums"><span>Misura</span><b class="cond" id="qtN_m">${QT.fmtMeasure(av, qS.buf || String(av))} mm</b>
        <span>Dal centro ${QT.fmtN(l.centro, 3)}</span><b class="cond" id="qtN_d">${QT.sg(ev.devUm)} µm</b>
        <span>Al minimo ${QT.fmtN(l.lo, 3)}</span><b id="qtN_lo">${mg(ev.marginLoUm)}</b>
        <span>Al massimo ${QT.fmtN(l.hi, 3)}</span><b id="qtN_hi">${mg(ev.marginHiUm)}</b></div>`;
      const span = Math.max(l.hi - l.lo, 0.002), g0 = l.lo - span, g1 = l.hi + span, pct = (v) => Math.max(0, Math.min(100, ((v - g0) / (g1 - g0)) * 100));
      const gauge = `<div class="int-gauge ${ev.state}" id="qtGauge" aria-label="misura rispetto ai limiti"><div class="ig-bar"><div class="ig-ok" style="left:${pct(l.lo)}%;right:${100 - pct(l.hi)}%"></div><div class="ig-c" style="left:${pct(l.centro)}%"></div><div class="ig-m" id="qtNeedle" style="left:${pct(av)}%"></div></div>
        <div class="ig-lab"><span>sotto</span><span>${QT.fmtN(l.lo, 3)} · ${QT.fmtN(l.hi, 3)}</span><span>sopra</span></div></div>`;
      h = big + gauge + qtAdvice(ev, cal); det = nums + (q.tipo !== 'posizione' && QT.formLimitsOf(q) ? '<div class="qt-forma" id="qtForma">' + esc(QT.formLimitsOf(q).txt) + '</div>' : c.forma && q.tipo !== 'posizione' ? '<div class="qt-forma" id="qtForma">Ovalità e conicità: controllale sempre, devono restare entro circa 2–3 µm.</div>' : '') + `<div class="qt-rem">Pezzo n. ${nPz + 1}${c.lotto ? ' · lotto ' + esc(c.lotto) : ''}</div>`;
    }
    $('qtRes').innerHTML = h; $('qtDet').innerHTML = det; $('qtDet').classList.toggle('hidden', !det);
    // Beta 0.9.2: striscia ultimi pezzi + live haptic/voce (solo misura completa, debounce per flip di stato)
    const sk = $('qtStreak'); if (sk) { const info = qtStreakHtml(c); sk.innerHTML = info.html; sk.classList.toggle('empty', !!info.empty); sk.classList.remove('hidden'); sk.setAttribute('aria-label', info.label || ''); }
    if (av != null) { const lev = QT.evalQuota(q, av, cal); if (lev) qtApplyLive(lev); }
    // contextual OK / SALVA key
    const go = $('qGo'), typed = !!qS.buf, ok = typed ? live.v != null : ec.measured > 0;
    const nextQ = (() => { const i = c.quote.findIndex((x) => x.id === q.id); for (let k = 1; k <= c.quote.length; k++) { const n = c.quote[(i + k) % c.quote.length]; if (n.id !== q.id && qS.vals[n.id] == null) return n; } return null; })();
    go.innerHTML = typed ? `<span>→</span>OK<small>${nextQ ? 'prossima quota' : 'conferma'}</small>` : `<span>✓</span>SALVA<small>pezzo</small>`;
    go.classList.toggle('off', !ok);
    qtSaveDraft(); fitPads();
  }
  function qtKey(k) {
    haptic(10); const c = qtCur(); if (!c || !(c.quote || []).length) return;
    if (k === 'GO') { qtGo(); return; }
    const q = qtActive(c);
    if (k === 'BS') qS.buf = qS.buf.slice(0, -1);
    else if (k === 'AC') { if (qS.buf) { qS.buf = ''; qS.live = { spoken: null, haptic: null }; } else if (q && qS.vals[q.id] != null) { delete qS.vals[q.id]; qS.live = { spoken: null, haptic: null }; } }
    else if (k === ',') { if (qS.buf && !/[,]/.test(qS.buf)) qS.buf += ','; }
    else if (qS.buf.replace(/,/g, '').length < 9) qS.buf += k;
    renderQuota();
  }
  function qtGo() {
    const c = qtCur(); if (!c) return; const q = qtActive(c); if (!q) return;
    if (qS.buf) {
      const v = QT.parseMeasure(qS.buf, q);
      if (v == null) { toast('Scrivi almeno 3 cifre (es. 9915) oppure il valore con la virgola', 'warn'); haptic(60); return; }
      qS.vals[q.id] = v; qS.buf = ''; qS.live = { spoken: null, haptic: null };
      const i = c.quote.findIndex((x) => x.id === q.id); let nx = null;
      for (let k = 1; k < c.quote.length; k++) { const n = c.quote[(i + k) % c.quote.length]; if (qS.vals[n.id] == null) { nx = n; break; } }
      qS.sel = nx ? nx.id : q.id; renderQuota(); return;
    }
    if (!Object.keys(qS.vals).length) { toast('Scrivi prima una misura'); return; }
    qtSave();
  }
  function qtSave() {
    if (qS.lock) return; const c = qtCur(); if (!c) return;
    const rec = QT.makePiece(c, qS.vals, calOf(), { machineName: qtMachine(), lotto: c.lotto || '' }); if (!rec) { toast('Scrivi prima una misura'); return; }
    qS.lock = true; setTimeout(() => { qS.lock = false; }, 700);
    qtPezzi().push(rec); saveData(state);
    const n = qtPezzi().filter((p) => p.controlloId === c.id && (p.lotto || '') === (c.lotto || '')).length;
    qS.vals = {}; qS.buf = ''; qS.sel = null; qS.live = { spoken: null, haptic: null }; renderQuota(); renderFatti(); dressAfterSave();
    const lab = rec.esito === 'fuori' ? 'FUORI' : 'DENTRO';
    showUndo(`Salvato pezzo ${n} · ${lab}${rec.parziale ? ' (quote misurate ' + rec.quote.length + ' di ' + c.quote.length + ')' : ''}`, () => {
      const before = qtPezzi().length; state.quotaPezzi = qtPezzi().filter((x) => x.id !== rec.id);
      if (state.quotaPezzi.length < before) { saveData(state); renderQuota(); renderFatti(); toast('Pezzo annullato'); }
    });
    if (prefs.voiceAuto) speakIt('Pezzo ' + (rec.esito === 'fuori' ? 'fuori tolleranza' : 'dentro'));
  }
  $('qKeypad').addEventListener('click', (e) => { const b = e.target.closest('[data-qk]'); if (b) qtKey(b.dataset.qk); });
  $('qtList').addEventListener('click', (e) => { const r = e.target.closest('[data-qid]'); if (!r) return; haptic(10); qS.sel = r.dataset.qid; qS.buf = ''; qS.live = { spoken: null, haptic: null }; renderQuota(); });
  $('qtBack').addEventListener('click', () => showPage('calc'));
  $('qtCfgBtn').addEventListener('click', () => openControlli());
  $('qtMeta').addEventListener('click', () => { const c = qtCur(); if (c) openControlloData(c.id); });
  $('qtEmpty').addEventListener('click', (e) => {
    if (e.target.closest('#qtTpl')) qtNewFromTemplate(); else if (e.target.closest('#qtNew')) qtNewEmpty(); else if (e.target.closest('#qtRecv')) openReceiveMenu();
    else if (e.target.closest('#qtAddFirst')) { const c = qtCur(); if (c) openQuotaEdit(c.id, null); }
  });
  function openQuota() { showPage('quota'); }
  function qtNewFromTemplate() {
    const c = QT.templateAA(); c.id = 'c_' + uid(); c.quote.forEach((q) => { q.id = 'q_' + Math.random().toString(36).slice(2, 8); });
    if (lockOn()) c.locked = true; qtList().push(c); saveData(state); qtSetCur(c.id); renderQuota();
    openControlloData(c.id, 'Dati del disegno: scrivi codice e lotto');
  }
  function qtNewEmpty() { const c = { id: 'c_' + uid(), nome: 'Nuovo controllo', codice: '', rev: '', lav: '', lotto: '', note: '', forma: false, quote: [] }; qtList().push(c); saveData(state); qtSetCur(c.id); renderQuota(); openControlloData(c.id, 'Nuovo controllo'); }
  function openControlli() {
    const l = qtList(), cur = qtCur();
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="ctlModal"><h2>📏 Controllo quota</h2>
      ${l.length ? l.map((c) => `<button type="button" class="qt-ctl ${cur && cur.id === c.id ? 'on' : ''}" data-cid="${esc(c.id)}"><span style="flex:1;min-width:0"><b>${esc(c.nome)}${lockedNow(c) ? ' 🔒' : ''}</b><small>${c.quote.length} ${c.quote.length === 1 ? 'quota' : 'quote'}${metaLine(qtMeta(c)) ? ' · ' + esc(metaLine(qtMeta(c))) : ''}</small></span>${cur && cur.id === c.id ? '<span class="sheet-on">IN USO</span>' : ''}</button>`).join('') : '<p class="meta">Nessun controllo ancora.</p>'}
      <button type="button" class="btn btn-orange" id="ctlTpl" style="width:100%;min-height:56px;margin-top:6px">📐 Modello disegno A-A <small>(Ø42 h6 · 29,5 ± 0,02)</small></button>
      <button type="button" class="btn btn-sec" id="ctlNew" style="width:100%;min-height:52px;margin-top:8px">＋ Nuovo controllo vuoto</button>
      ${cur ? `<div class="js-tools"><button type="button" class="btn btn-sec" id="ctlQuote">✎ Quote</button><button type="button" class="btn btn-sec" id="ctlData">✎ Dati</button><button type="button" class="btn btn-sec" id="ctlSend">📤 Invia</button></div>
      <button type="button" class="btn btn-sec" id="ctlDel" style="width:100%;min-height:48px;margin-top:8px">🗑 Elimina questo controllo</button>` : ''}
      <div class="actions" style="display:flex;margin-top:12px"><button type="button" class="btn btn-sec" id="ctlClose" style="flex:1">Chiudi</button></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('ctlClose').onclick = close; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') close(); };
    $('ctlModal').querySelectorAll('[data-cid]').forEach((b) => { b.onclick = () => { qtSetCur(b.dataset.cid); close(); renderQuota(); }; });
    $('ctlTpl').onclick = () => { close(); qtNewFromTemplate(); };
    $('ctlNew').onclick = () => { close(); qtNewEmpty(); };
    if (cur) {
      $('ctlQuote').onclick = async () => { if (await qtGuard(cur)) openQuoteList(cur.id); else openControlli(); };
      $('ctlData').onclick = async () => { if (await qtGuard(cur)) openControlloData(cur.id); else openControlli(); };
      $('ctlSend').onclick = () => { close(); openSendJob('c:' + cur.id); };
      $('ctlDel').onclick = async () => { if (await askBig({ title: 'Eliminare «' + cur.nome + '»?', html: '<p class="meta">I pezzi già salvati restano nello Storico.</p>', ok: '🗑 Elimina', danger: true })) { state.controlli = qtList().filter((x) => x.id !== cur.id); prefs.controlloId = null; savePrefs(prefs); qS.ctl = null; saveData(state); renderQuota(); toast('Controllo eliminato'); } else openControlli(); };
    }
  }
  function openControlloData(cid, title) {
    const c = qtList().find((x) => x.id === cid); if (!c) return;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="cdModal"><h2>${esc(title || 'Dati del controllo')}</h2>
      <label>Nome del controllo (disegno)</label><input id="cdNome" class="big-input" maxlength="60" autocomplete="off" value="${esc(c.nome)}"/>
      <label>Codice (disegno / articolo)</label><input id="cdCod" class="big-input" maxlength="40" autocomplete="off" value="${esc(c.codice)}" placeholder="es. 12345-A"/>
      <div class="field-row"><div><label>Revisione</label><input id="cdRev" class="big-input" maxlength="12" autocomplete="off" value="${esc(c.rev)}"/></div><div><label>Lavorazione</label><input id="cdLav" class="big-input" maxlength="40" autocomplete="off" value="${esc(c.lav)}" placeholder="es. 0522"/></div></div>
      <label>Numero lotto</label><input id="cdLotto" class="big-input" maxlength="40" autocomplete="off" value="${esc(c.lotto)}"/>
      <label>Note</label><textarea id="cdNote" class="neu" rows="3" maxlength="600">${esc(c.note)}</textarea>
      <label class="chk-big"><input type="checkbox" id="cdForma" ${c.forma ? 'checked' : ''}/><span>Ricordami ovalità/conicità <small style="display:block;font-weight:600;color:var(--muted)">(spenta di default per questo tipo di lavoro)</small></span></label>
      <div class="actions" style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-sec" id="cdNo" style="flex:1;min-height:52px">Annulla</button><button type="button" class="btn btn-primary" id="cdOk" style="flex:1.4;min-height:52px">✓ Salva</button></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; };
    $('cdNo').onclick = () => { close(); renderQuota(); }; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') { close(); renderQuota(); } };
    $('cdOk').onclick = () => {
      const v = (id) => $(id).value.replace(/\s+/g, ' ').trim();
      c.nome = v('cdNome') || 'Controllo quota'; c.codice = v('cdCod'); c.rev = v('cdRev'); c.lav = v('cdLav'); c.lotto = v('cdLotto'); c.note = $('cdNote').value.trim().slice(0, 600); c.forma = $('cdForma').checked;
      saveData(state); close(); renderQuota(); toast('Dati salvati');
    };
  }
  /* ───────── Beta 0.9.3: «Leggi il disegno» page, fit tool, drawing text → quote ───────── */
  let disegnoFrom = 'aiuto';
  function openDisegno(from) { disegnoFrom = from || 'aiuto'; showPage('disegno'); }
  function fitHtml(f) {
    if (!f.ok) return { bad: true, html: esc(f.error) };
    const lim = (r) => `${QT.fmtN(r.lo, 3)}–${QT.fmtN(r.hi, 3)} mm <small>(${QT.sg(r.esUm)} / ${QT.sg(r.eiUm)} µm)</small>`;
    return { bad: false, html: `Foro <b>${esc(f.hole.code)}</b>: ${lim(f.hole)}<br/>Albero <b>${esc(f.shaft.code)}</b>: ${lim(f.shaft)}<br/><b>${esc(f.words)}</b>${f.sys ? '<br/><small>sistema ' + esc(f.sys) + '</small>' : ''}` };
  }
  function fitInput(t) { const p = QT.fitParse(String(t || '').trim()); return p ? QT.fitLimits(p.nom, p.hole, p.shaft) : { ok: false, error: 'Scrivi nominale, foro e albero, es. 40 H7/g6 (maiuscola = foro, minuscola = albero)' }; }
  if ($('ldBack')) {
    $('ldBack').addEventListener('click', () => { if (disegnoFrom === 'quota') { showPage('quota'); const c = qtCur(); if (c) openQuoteList(c.id); } else showPage(disegnoFrom); });
    $('btnDisegno').addEventListener('click', () => { haptic(12); openDisegno('aiuto'); });
    const fitGo = () => { const o = $('ldFitOut'), r = fitHtml(fitInput($('ldFitIn').value)); o.classList.remove('hidden'); o.classList.toggle('bad', r.bad); o.innerHTML = r.html; };
    $('ldFitGo').addEventListener('click', fitGo); $('ldFitIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fitGo(); } });
    const genUp = () => { const o = $('ldGenOut'), t = String($('ldGenNom').value).trim(); if (!t) { o.classList.add('hidden'); return; }
      const g = QT.genTol(t.replace(',', '.'), $('ldGenCls').value); o.classList.remove('hidden'); o.classList.toggle('bad', !g.ok);
      o.innerHTML = g.ok ? `ISO 2768-${esc(g.cls)}: <b>± ${esc(QT.fmtN(g.tol, g.tol < 0.1 ? 2 : 1))} mm</b> → ${QT.fmtN(g.lo, 3)}–${QT.fmtN(g.hi, 3)} mm` : esc(g.error); };
    $('ldGenNom').addEventListener('input', genUp); $('ldGenCls').addEventListener('change', genUp);
    const tUp = () => { const o = $('ldTOut'), L = String($('ldTL').value).trim(), T = String($('ldTT').value).trim(); if (!L || !T) { o.classList.add('hidden'); return; }
      const um = QT.thermalUm(L.replace(',', '.'), T.replace(',', '.'), $('ldTM').value); o.classList.remove('hidden'); o.classList.toggle('bad', um == null);
      o.innerHTML = um == null ? 'Scrivi misura (mm) e quanti gradi è più caldo' : `Il pezzo è circa <b>${esc(QT.fmtUm(um))} µm</b> più grande da caldo.<br/><small>Aspetta che si raffreddi prima di misurare (o misura sempre alla stessa temperatura).</small>`; };
    ['ldTL', 'ldTT'].forEach((id) => $(id).addEventListener('input', tUp)); $('ldTM').addEventListener('change', tUp);
  }
  function openFitTool(cid) {
    const c = qtList().find((x) => x.id === cid); if (!c) return;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="fitModal"><h2>⇄ Accoppiamento ISO</h2>
      <p class="meta">Maiuscola = foro, minuscola = albero. L'app aggiunge due quote: il foro e l'albero.</p>
      <label for="fitIn">Accoppiamento</label><input id="fitIn" class="big-input" autocomplete="off" autocapitalize="none" placeholder="es. 40 H7/g6"/>
      <div class="ld-out hidden" id="fitOut"></div><div id="fitErr" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-sec" id="fitNo" style="flex:1;min-height:56px">Annulla</button><button type="button" class="btn btn-primary" id="fitOk" style="flex:1.4;min-height:56px">＋ Aggiungi foro e albero</button></div></div></div>`;
    const back = () => openQuoteList(cid);
    $('fitNo').onclick = back; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') back(); };
    const up = () => { const o = $('fitOut'); if (!$('fitIn').value.trim()) { o.classList.add('hidden'); return; } const r = fitHtml(fitInput($('fitIn').value)); o.classList.remove('hidden'); o.classList.toggle('bad', r.bad); o.innerHTML = r.html; };
    $('fitIn').addEventListener('input', up);
    $('fitOk').onclick = () => {
      const f = fitInput($('fitIn').value);
      if (!f.ok) { const e = $('fitErr'); e.textContent = f.error; e.classList.remove('hidden'); haptic(60); return; }
      if (c.quote.length + 2 > QT.MAX_QUOTE) { const e = $('fitErr'); e.textContent = 'Massimo ' + QT.MAX_QUOTE + ' quote'; e.classList.remove('hidden'); return; }
      const note = f.code + ': ' + f.words;
      const a = QT.normalizeQuota({ tipo: 'foro', mode: 'iso', nom: f.nom, iso: f.hole.code, note }), b = QT.normalizeQuota({ tipo: 'esterno', mode: 'iso', nom: f.nom, iso: f.shaft.code, note });
      if (!a.ok || !b.ok) return; c.quote.push(a.q, b.q); saveData(state); qS.sel = b.q.id; toast(f.code + ' aggiunto'); back();
    };
    setTimeout(() => { try { $('fitIn').focus(); } catch (e) {} }, 60);
  }
  function openDrawingText(cid) {
    const c = qtList().find((x) => x.id === cid); if (!c) return;
    let parsed = null;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="dtModal"><h2>📋 Quote dal testo del disegno</h2>
      <p class="meta">Una quota per riga, come sul disegno (puoi copiare il testo da una foto, es. con Google Lens). Esempi: Ø42 h6 · 29,5 ±0,02 · Ø30 0/−0,016 · 42,000/41,984 · 40 H7/g6 · ISO 2768-mK · circolarità 0,003. Le quote tra parentesi (ausiliarie) vengono saltate.</p>
      <textarea id="dtIn" class="neu" rows="6" placeholder="Ø42 h6&#10;29,5 ±0,02"></textarea>
      <button type="button" class="btn btn-orange ld-btn" id="dtRead">Leggi</button>
      <div id="dtList"></div><div id="dtErr" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-sec" id="dtNo" style="flex:1;min-height:56px">Annulla</button><button type="button" class="btn btn-primary" id="dtOk" style="flex:1.4;min-height:56px" disabled>＋ Aggiungi le spuntate</button></div></div></div>`;
    const back = () => openQuoteList(cid);
    $('dtNo').onclick = back; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') back(); };
    const defsOf = (it) => [it.def, it.pair].filter(Boolean).map((d) => Object.assign({}, d, it.fit ? { note: it.fit.code + ': ' + it.fit.words } : {}, parsed.geo && d.tipo !== 'posizione' && d.circ == null && d.cyl == null ? { circ: parsed.geo.circ, cyl: parsed.geo.cyl } : {}));
    $('dtRead').onclick = () => {
      parsed = QT.parseDrawingText($('dtIn').value); const box = $('dtList');
      if (!parsed.items.length) { box.innerHTML = '<p class="meta">Nessuna quota riconosciuta: controlla il testo o aggiungile a mano.</p>'; $('dtOk').disabled = true; return; }
      box.innerHTML = (parsed.gen ? `<p class="meta">Tolleranza generale del cartiglio: <b>ISO 2768-${esc(parsed.gen.cls)}${esc(parsed.gen.geo)}</b></p>` : '') + parsed.items.map((it, i) => {
        if (it.aux) return `<div class="dt-item aux"><span>—</span><span>${esc(it.raw)}<small>quota ausiliaria (tra parentesi): non si controlla</small></span></div>`;
        if (!it.def) return `<div class="dt-item aux"><span>—</span><span>${esc(it.raw)}<small>${esc(it.warn || (it.noTol ? 'senza tolleranza e nessuna ISO 2768 nel testo: scrivila a mano' : 'non riconosciuta'))}</small></span></div>`;
        const qs = defsOf(it).map((d) => QT.normalizeQuota(d)), ok = qs.every((r) => r.ok);
        const txt = ok ? qs.map((r) => `${esc(r.q.nome)} · ${esc(QT.TIPI[r.q.tipo])} · ${esc(QT.quotaText(r.q))}`).join('<br/>') : esc(qs.find((r) => !r.ok).error);
        return `<label class="dt-item"><input type="checkbox" data-i="${i}" ${ok ? 'checked' : 'disabled'}/><span><b>${esc(it.raw)}</b><small>${txt}${it.fit ? '<br/>' + esc(it.fit.words) : ''}${it.general ? '<br/>tolleranza generale del cartiglio' : ''}${it.tipoGuess === false ? '<br/>senza Ø: messa come posizione / lunghezza (cambiala se è un diametro)' : ''}${it.warn ? '<br/>⚠ ' + esc(it.warn) : ''}</small></span></label>`;
      }).join('');
      $('dtOk').disabled = !box.querySelector('input[data-i]:checked');
      box.querySelectorAll('input[data-i]').forEach((x) => { x.onchange = () => { $('dtOk').disabled = !box.querySelector('input[data-i]:checked'); }; });
    };
    $('dtOk').onclick = () => {
      if (!parsed) return; const add = [];
      $('dtList').querySelectorAll('input[data-i]:checked').forEach((x) => { defsOf(parsed.items[Number(x.dataset.i)]).forEach((d) => { const r = QT.normalizeQuota(d); if (r.ok) add.push(r.q); }); });
      if (!add.length) return;
      if (c.quote.length + add.length > QT.MAX_QUOTE) { const e = $('dtErr'); e.textContent = 'Massimo ' + QT.MAX_QUOTE + ' quote: togli qualche spunta'; e.classList.remove('hidden'); haptic(60); return; }
      c.quote.push(...add); saveData(state); toast(add.length + (add.length === 1 ? ' quota aggiunta' : ' quote aggiunte')); back();
    };
  }
  /** «0,003» mm or «3» µm (as typed in the frame field) → value for QT.normalizeQuota (circ/cyl). */
  function geoIn(v) { const t = String(v == null ? '' : v).trim(); return t ? t : null; }
  function openQuoteList(cid) {
    const c = qtList().find((x) => x.id === cid); if (!c) return;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="qlModal"><h2>✎ Quote · ${esc(c.nome)}</h2>
      <p class="meta">Una quota per riga. Per ognuna: nominale e tolleranza a mano, oppure codice ISO. Massimo ${QT.MAX_QUOTE}.</p>
      ${c.quote.map((q) => `<div class="qt-qrow"><div class="qq-t"><b>${esc(q.nome)}</b><small>${esc(QT.TIPI[q.tipo])} · ${esc(QT.quotaText(q))}</small></div><button type="button" class="btn btn-sec" data-qe="${esc(q.id)}" aria-label="Modifica quota">✎</button><button type="button" class="btn btn-sec" data-qd="${esc(q.id)}" aria-label="Elimina quota">🗑</button></div>`).join('') || '<p class="meta">Nessuna quota.</p>'}
      <button type="button" class="btn btn-orange" id="qlAdd" style="width:100%;min-height:56px" ${c.quote.length >= QT.MAX_QUOTE ? 'disabled' : ''}>＋ Aggiungi quota</button>
      <div class="ld-row" style="margin-top:8px"><button type="button" class="btn btn-sec" id="qlFit" style="min-height:56px" ${c.quote.length >= QT.MAX_QUOTE - 1 ? 'disabled' : ''}>⇄ Accoppiamento<small style="display:block;font-weight:600">es. 40 H7/g6</small></button>
      <button type="button" class="btn btn-sec" id="qlText" style="min-height:56px" ${c.quote.length >= QT.MAX_QUOTE ? 'disabled' : ''}>📋 Dal testo<small style="display:block;font-weight:600">del disegno</small></button></div>
      <button type="button" class="btn btn-sec" id="qlGuide" style="width:100%;min-height:52px;margin-top:8px">📐 Leggi il disegno (guida)</button>
      <div class="actions" style="display:flex;margin-top:10px"><button type="button" class="btn btn-sec" id="qlClose" style="flex:1">Fatto</button></div></div></div>`;
    const close = () => { $('modalRoot').innerHTML = ''; renderQuota(); };
    $('qlClose').onclick = close; $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') close(); };
    $('qlAdd').onclick = () => openQuotaEdit(cid, null);
    $('qlFit').onclick = () => openFitTool(cid); $('qlText').onclick = () => openDrawingText(cid); $('qlGuide').onclick = () => { close(); openDisegno('quota'); };
    $('qlModal').querySelectorAll('[data-qe]').forEach((b) => { b.onclick = () => openQuotaEdit(cid, b.dataset.qe); });
    $('qlModal').querySelectorAll('[data-qd]').forEach((b) => { b.onclick = async () => { const q = c.quote.find((x) => x.id === b.dataset.qd); if (q && await askBig({ title: 'Eliminare la quota «' + q.nome + '»?', ok: '🗑 Elimina', danger: true })) { c.quote = c.quote.filter((x) => x.id !== q.id); delete qS.vals[q.id]; qS.sel = null; saveData(state); } openQuoteList(cid); }; });
  }
  function openQuotaEdit(cid, qid) {
    const c = qtList().find((x) => x.id === cid); if (!c) return;
    const old = qid ? c.quote.find((x) => x.id === qid) : null;
    const f = old ? { nome: old.nome, tipo: old.tipo, mode: old.mode, nom: numTxt(old.nom), iso: old.iso || '', tol: numTxt(old.tol), up: numTxt(old.up), low: numTxt(old.low), gen: old.gen || 'm', circ: old.circ != null ? numTxt(old.circ) : '', cyl: old.cyl != null ? numTxt(old.cyl) : '' } : { nome: '', tipo: 'esterno', mode: 'iso', nom: '', iso: '', tol: '', up: '', low: '', gen: 'm', circ: '', cyl: '' };
    const grab = () => { ['nom', 'iso', 'tol', 'up', 'low', 'circ', 'cyl'].forEach((k) => { const el = $('eq_' + k); if (el) f[k] = el.value; }); const n = $('eq_nome'); if (n) f.nome = n.value; };
    const model = () => ({ id: old ? old.id : undefined, nome: f.nome, tipo: f.tipo, mode: f.mode, nom: String(f.nom).replace(/^Ø/, ''), iso: f.iso, tol: String(f.tol).replace(/^±/, ''), up: f.up, low: f.low, gen: f.gen, circ: f.tipo !== 'posizione' ? geoIn(f.circ) : null, cyl: f.tipo !== 'posizione' ? geoIn(f.cyl) : null });
    const prev = () => {
      const el = $('eqPrev'); if (!el) return; const m = model();
      if ((String(f.circ).trim() && QT.geoUm(geoIn(f.circ)) == null) || (String(f.cyl).trim() && QT.geoUm(geoIn(f.cyl)) == null)) { el.className = 'qt-prev bad'; el.textContent = 'Circolarità / cilindricità: scrivi il valore del riquadro (es. 0,003 o 3 µm)'; return; }
      if (!String(f.nom).trim()) { el.className = 'qt-prev'; el.textContent = 'Scrivi il nominale'; return; }
      const r = QT.normalizeQuota(Object.assign({}, m, { nome: '' }));
      if (!r.ok) { el.className = 'qt-prev bad'; el.textContent = r.error; return; }
      const iso = r.q.mode === 'iso' ? QT.isoLimits(r.q.nom, r.q.iso) : null;
      const fl = QT.formLimitsOf(r.q);
      el.className = 'qt-prev'; el.innerHTML = (fl ? `<small>${esc(fl.txt)}</small><br/>` : '') + `${esc(r.q.nome)}: <b>${QT.fmtN(r.q.lo, 3)}–${QT.fmtN(r.q.hi, 3)}</b> mm · centro <b>${QT.fmtN(r.q.centro, 3)}</b>${iso ? `<br/><small>IT${QT.isoParse(r.q.iso).grade} = ${iso.it} µm · ${iso.kind === 'foro' ? 'ES' : 'es'} ${QT.sg(iso.esUm)} / ${iso.kind === 'foro' ? 'EI' : 'ei'} ${QT.sg(iso.eiUm)} µm</small>` : ''}${r.q.warn ? `<br/><small>⚠ ${esc(r.q.warn)}</small>` : ''}`;
    };
    const draw = () => {
      $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal" id="eqModal"><h2>${old ? 'Modifica quota' : 'Nuova quota'}</h2>
        <label>Tipo di quota</label><div class="qt-chips" id="eqTipo">${[['esterno', 'Diametro esterno'], ['foro', 'Foro'], ['posizione', 'Posizione / lunghezza']].map(([k, t]) => `<button type="button" data-t="${k}" class="${f.tipo === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <label>Come scrivi la tolleranza</label><div class="qt-chips" id="eqMode">${[['iso', 'Codice ISO'], ['sim', '± simmetrica'], ['asim', 'Sup. / inf.'], ['gen', 'Generale ISO 2768']].map(([k, t]) => `<button type="button" data-m="${k}" class="${f.mode === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <label for="eq_nom">Nominale mm</label><input id="eq_nom" class="big-input" inputmode="decimal" autocomplete="off" value="${esc(f.nom)}" placeholder="es. 42 oppure 29,5"/>
        ${f.mode === 'iso' ? `<label for="eq_iso">Codice ISO ${f.tipo === 'foro' ? '(maiuscolo: H6, H7…)' : '(minuscolo: h6, g6, js6…)'}</label><input id="eq_iso" class="big-input" autocomplete="off" autocapitalize="none" value="${esc(f.iso)}" placeholder="${f.tipo === 'foro' ? 'es. H7' : 'es. h6'}"/>`
          : f.mode === 'gen' ? `<label>Classe ISO 2768 (scritta nel cartiglio, es. «ISO 2768-mK» = m)</label><div class="qt-chips" id="eqGen">${['f', 'm', 'c', 'v'].map((k) => `<button type="button" data-g="${k}" class="${f.gen === k ? 'on' : ''}">${k} · ${QT.GEN_NAMES[k]}</button>`).join('')}</div>`
          : f.mode === 'sim' ? `<label for="eq_tol">Tolleranza ± mm</label><input id="eq_tol" class="big-input" inputmode="decimal" autocomplete="off" value="${esc(f.tol)}" placeholder="es. 0,02"/>`
          : `<div class="field-row"><div><label for="eq_up">Scostamento sup. mm</label><input id="eq_up" class="big-input" inputmode="text" autocomplete="off" value="${esc(f.up)}" placeholder="es. 0 o +0,02"/></div><div><label for="eq_low">Scostamento inf. mm</label><input id="eq_low" class="big-input" inputmode="text" autocomplete="off" value="${esc(f.low)}" placeholder="es. −0,016"/></div></div>`}
        ${f.tipo !== 'posizione' ? `<div class="field-row qt-geo"><div><label for="eq_circ">○ Circolarità (facolt.)</label><input id="eq_circ" class="big-input" inputmode="decimal" autocomplete="off" value="${esc(f.circ)}" placeholder="es. 0,003"/></div><div><label for="eq_cyl">⌭ Cilindricità (facolt.)</label><input id="eq_cyl" class="big-input" inputmode="decimal" autocomplete="off" value="${esc(f.cyl)}" placeholder="es. 0,005"/></div></div>` : ''}
        <label for="eq_nome">Nome (facoltativo)</label><input id="eq_nome" class="big-input" maxlength="40" autocomplete="off" value="${esc(f.nome)}" placeholder="automatico, es. Ø42 h6"/>
        <div class="qt-prev" id="eqPrev"></div><div id="eqErr" class="form-err hidden"></div>
        <div class="actions" style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-sec" id="eqNo" style="flex:1;min-height:52px">Annulla</button><button type="button" class="btn btn-primary" id="eqOk" style="flex:1.4;min-height:52px">✓ Salva quota</button></div></div></div>`;
      $('eqTipo').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { grab(); f.tipo = b.dataset.t; draw(); } };
      $('eqMode').onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) { grab(); f.mode = b.dataset.m; draw(); } };
      if ($('eqGen')) $('eqGen').onclick = (e) => { const b = e.target.closest('[data-g]'); if (b) { grab(); f.gen = b.dataset.g; draw(); } };
      $('eqModal').addEventListener('input', () => { grab(); prev(); });
      $('eqNo').onclick = () => openQuoteList(cid); $('modalBg').onclick = (e) => { if (e.target.id === 'modalBg') openQuoteList(cid); };
      $('eqOk').onclick = () => {
        grab(); const r = QT.normalizeQuota(model());
        if (!r.ok) { const e = $('eqErr'); e.textContent = r.error; e.classList.remove('hidden'); haptic(60); return; }
        if (old) { Object.keys(old).forEach((k) => delete old[k]); Object.assign(old, r.q); } else c.quote.push(r.q);
        saveData(state); qS.sel = r.q.id; openQuoteList(cid);
      };
      prev();
    };
    draw();
  }
  /* Storico: lista dei pezzi controllati */
  function renderQuotaList() {
    const el = $('quotaList'); if (!el) return;
    const l = qtPezzi().slice().reverse().slice(0, 50);
    const andStrip = (() => { const last = qtPezzi().slice(-12); if (last.length < 1) return ''; const st = QT.streakOf(last); const dots = st.states.map((s) => `<span class="qs-dot ${s}"></span>`).join(''); return `<div class="qt-streak" style="margin-bottom:8px"><span class="qs-lab">Andamento:</span><span class="qs-dots">${dots}</span><span class="qs-ok">di fila OK: <b>${st.streakOk}</b></span></div>`; })();
    el.innerHTML = andStrip + (l.length ? l.map((p) => `<div class="hist-row fem-row qt-hrow"><span class="mono">${esc(dmHm(p.ts))}</span>
      <span><b class="cond">${esc(p.nome)}</b> ${p.esito === 'fuori' ? '<b style="color:#ff8a8a">FUORI</b>' : '✓ DENTRO'}${p.parziale ? ' <small>(parziale)</small>' : ''}${metaLine({ codice: p.codice, rev: p.rev, lav: p.lav, lotto: p.lotto }) ? '<small class="hist-meta"> ' + esc(metaLine({ codice: p.codice, rev: p.rev, lav: p.lav, lotto: p.lotto })) + '</small>' : ''}
      ${p.quote.map((q) => `<small> ${esc(q.nome)} ${esc(QT.fmtN(q.misura, 4))} (${esc(QT.sg(q.devUm))} µm${q.esito === 'fuori' ? ' · FUORI' : ''})</small>`).join('')}<small> ${esc(p.machineName || '')}</small></span></div>`).join('')
      : '<p class="meta">Nessun controllo quota salvato.</p>');
  }
  function qtQuotaRows() { return QT.pieceRows(qtPezzi()); }
  $('btnQuota').addEventListener('click', openQuota);
  function refreshQuotaLabel() { const c = qtCur(), l = $('qtLabel'); if (l) l.textContent = c ? c.nome + ' · ' + c.quote.length + (c.quote.length === 1 ? ' quota' : ' quote') : 'Misuri un pezzo: DENTRO o FUORI tolleranza (senza accoppiamento)'; }

  window.__rettifica = {
    get contacts() { return contacts; }, renderAiuto: () => renderAiuto(), openHelp: () => openHelp(),
    openSheetConfirm: (x) => openSheetConfirm(x), get lastPhoto() { return lastPhoto; },
    man, renderMan: () => renderMan(),
    openHistModal: (a, b) => openHistModal(a, b), openMachineDialog: () => openMachineDialog(), openSeriesModal: (id) => openSeriesModal(id), saveCurrent: (x) => saveCurrent(x), refreshDisplay: () => refreshDisplay(), setDigits: (d) => { measureDigits = d; refreshDisplay(); },
    webPhotoData: (i, w, h) => webPhotoData(i, w, h), runCalc, showPage, setContext, openAssistant, chatSend: (t) => chatSend(t), get chatMsgs() { return chatMsgs; }, openAiSettings, aiCtx, get state() { return state; }, get prefs() { return prefs; },
    openCrop: (p, b) => openCrop(p, b), renderLastHint: () => renderLastHint(), shiftText: () => shiftText(), get lastPhoto() { return lastPhoto; }, openOcrConfirm: (p) => openOcrConfirm(p),
    get lastCalc() { return lastCalc; }, fem, renderFemPage: () => renderFemPage(), renderEmpty: () => renderEmpty(), backupInfo: () => backupInfo(), openRestoreBackup: () => openRestoreBackup(), wipeAll: (w) => wipeAll(w), femFromPhoto: (p) => femFromPhoto(p), setPendingFem: (v) => { pendingFem = !!v; }, femSetField: (f) => femSetField(f), femKey: (k) => femKey(k), openOcrConfirm: (p) => openOcrConfirm(p), applyOcrText: (t) => applyOcrText(t), intS, intKey: (k) => intKey(k), intFromPhoto: (p) => intFromPhoto(p), setPendingInt: (v) => { pendingInt = !!v; }, renderIntPage: () => renderIntPage(), fitPads: () => fitPads(), lavoroMode: () => lavoroMode(), setLavoro: (m) => setLavoro(m), openJobSetup: (p) => openJobSetup(p),
    loadFixtureAndamento() {
      const { series } = currentContext(); if (!series) return;
      const base = series.base;
      const samples = [0, -1, -2, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8].map((d, i) => ({
        id: 'fix_' + i, ts: new Date(Date.now() - (15 - i) * 60000).toISOString(),
        S: round4(base + d / 1000), chosen: d + 11, gioco: 11, status: 'buono', _fixture: true,
      }));
      series.history = (series.history || []).filter((h) => !h._fixture).concat(samples);
      saveData(state);
    },
    seedStock() {
      const { series } = currentContext(); if (!series) return;
      series.stock = series.stock || {};
      [1, 2, 3, 4, 5].forEach((n) => { series.stock[String(n)] = n === 1 ? 0 : 5; });
      series.stock['18'] = 2; series.stock['19'] = 1; series.stock['20'] = 2;
      saveData(state);
    },
    measureDigitsSet(d) { measureDigits = d; refreshDisplay(); },
    doCalcFlow, newTrainQ, saveCurrent, openMachineDialog, openSeriesSheet, exportCsv,
    openNewJob, openJobsSheet, startJob, get activeJob() { return activeJob(); }, initJobs,
    openQuota, renderQuota, qtCur, qtList, qtPezzi, qtSave, qtKey, qtNewFromTemplate, openControlli, openQuoteList, openQuotaEdit, openControlloData, qS, QT, receivePackage: (t, src) => receivePackage(t, src), openReceived: (v) => openReceived(v), acceptPackage: (v, o) => acceptPackage(v, o), openSendJob: (id) => openSendJob(id), openChecklist: (p) => openChecklist(p), openJobData: () => openJobData(), renderQuaderno: () => renderQuaderno(), renderJobStrip: () => renderJobStrip(), renderDress: () => renderDress(), openReport: (s) => openReport(s), reportModel: (s, l) => reportModel(s, l), reportRows: (p) => reportRows(p), lockedNow: (s) => lockedNow(s), lockOn: () => lockOn(), openPinSetup: () => openPinSetup(), openReceiveMenu: () => openReceiveMenu(), L9, metaLine, jobMeta, ensureJobCheck,
    setPendingJob(n) { pendingJob = n ? { machineName: n } : null; },
  };

  applyTheme(); updateVoiceBtn();
  initJobs();
  const ctx = currentContext();
  if (ctx.series) setContext(null, ctx.series.id, false);
  const lastPage0 = prefs.lastPage;
  showPage('calc'); showInputView(); refreshDisplay(); renderRecent();
  if (lastPage0 === 'quota' && qtCur()) showPage('quota'); // Beta 0.9.4: the app was closed on Controllo quota → back there
  setTimeout(() => window.__pkgCheck(), 0); // Beta 0.9.0: a package opened from a file / the share sheet
})();
