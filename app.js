/* Rettifica Beta v0.5.2 (base: Rettifica OmT v2.0.8) */
(function () {
  const STORAGE_KEY = 'rweb_v1';
  const PREFS_KEY = 'rweb_v1_prefs';
  const TEST_SEED_KEY = 'rweb_test_seed';
  const CLEAN_KEY = 'rweb_clean_206';       // v2.0.6 one-time clean start done
  const BACKUP_KEY = 'rweb_backup_pre206';
  const BACKUPS_KEY = 'rweb_backups';           // Beta 0.1.0: last 5 automatic backups (before migration / import / wipe)
  const APP_VERSION = '0.5.2';
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
  const STUDER_NOTE = 'Su Studer il tasto + fa il pezzo più piccolo, − più grande.';
  const $ = (id) => document.getElementById(id);
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
    if (msg.length > 48) msg = msg.slice(0, 46).trim() + '…';
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
      machines: [{ id: 'm_mia', name: '', note: STUDER_NOTE, rule: 'studer', knob: { k: null, L0: null, trials: [], source: null, updatedAt: null } }],
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
      machines: [{ id: mid, name: 'Studer O061', note: 'Rettificatrice. ' + STUDER_NOTE, rule: 'studer', knob: { k: null, L0: null, trials: [], source: null, updatedAt: null } }],
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
    try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) { const d = defaultData(); d.v194 = true; d.appVersion = APP_VERSION; saveData(d); return d; }
      const parsed = JSON.parse(raw);
      const d = migrate(JSON.parse(raw));
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
  let pendingJob = null; // { machineName } while «Nuovo lavoro» waits for the photo
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
    const j = makeJob({ machineName: name, knob, series: o.series, codice: o.codice, lotto: o.lotto });
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
      [['keypad', 'calcInputView'], ['fKeypad', 'page-femmina'], ['iKeypad', 'page-interno']].forEach(([id, host]) => {
        const pad = $(id), h = $(host); if (!pad || !h || !h.offsetParent || h.classList.contains('hidden')) return;
        pad.style.gridTemplateRows = ''; pad.style.gap = '';
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
    const extra = [j.codice ? 'Cod. ' + j.codice : '', j.lotto ? 'Lotto ' + j.lotto : ''].filter(Boolean).join(' · ');
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
      const map = { macchine: 'setup', serie: 'setup', train: 'setup', guida: 'setup', femmina: 'calc', interno: 'calc' };
      b.classList.toggle('on', b.dataset.page === name || b.dataset.page === map[name]);
    });
    const page = $('page-' + name); if (page) page.classList.add('active');
    document.body.dataset.page = name; // v2.0.6: the undo bar leaves the ← of «Adatta alla femmina» free
    if (!prevActive || prevActive !== page) $('mainWrap').scrollTop = 0; // v1.9.4: new page opens at the top
    if (name === 'calc') { renderEmpty(); updateChip(); updatePrefix(); refreshDisplay(); renderRecent(); }
    if (name === 'setup') fillSetupSelects();
    if (name === 'macchine') renderMachines();
    if (name === 'serie') renderSeries();
    if (name === 'storico') { histShown = 50; renderFemList(); renderIntList(); renderStorico(); renderAndamento(); renderArchivio(); }
    if (name === 'turno') { renderTurno(); renderStock(); renderPezzi(); renderRiepilogo(); }
    if (name === 'train') renderTrain();
    if (name === 'femmina') renderFemPage();
    if (name === 'interno') renderIntPage();
    if (name === 'chat') renderChat();
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
    updateJobsPill();
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
    if (measureDigits) { const p = interpretMeasure(measureDigits, series.base, seriesTol(series), effPrefix()); if (p && p.prefix != null && p.value != null) cur = p.prefix; }
    $('measurePrefix').innerHTML = cur + ',<i>▾</i>';
    $('measurePrefix').classList.toggle('sticky', sp != null && sp !== bi);
    $('measurePrefix').classList.toggle('auto-chg', cur !== cur0); // v2.0.8: integer changed by itself → orange
    $('prefixMenu').innerHTML = '<div class="pm-h">Intero · resta fisso</div>' + [bi - 1, bi, bi + 1].map((p) =>
      `<button type="button" data-pref="${p}" class="${p === cur ? 'on' : ''}">${p},</button>`).join('');
  }
  function refreshDisplay() {
    const { series } = currentContext(); $('digDisplay').textContent = measureDigits;
    const st = $('liveStatus'), txt = $('liveStatusTxt');
    updatePrefix();
    if (!series || !measureDigits) {
      st.classList.remove('bad'); const sp = stickyPrefix(); fitPads();
      txt.textContent = 'inserisci misura' + (sp != null && sp !== Math.floor(series.base) ? ' · intero ' + sp + ', fisso' : ''); return;
    }
    const p = interpretMeasure(measureDigits, series.base, seriesTol(series), effPrefix());
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
    const p = interpretMeasure(measureDigits, series.base, seriesTol(series), effPrefix());
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
    const gOv = opts && opts.gioco && opts.gioco.min != null && opts.gioco.max != null ? opts.gioco : null;
    const gMin = gOv ? gOv.min : series.giocoMin, gMax = gOv ? gOv.max : series.giocoMax;
    const mode = lavoroMode();
    const acc = calcAccoppiamento(S, series.base, gMin, gMax, mode);
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
  function updateCorr() {
    if (!lastCalc) return;
    const series = seriesById(lastCalc.seriesId), machine = machineById(lastCalc.machineId) || myMachine();
    if (!series) return;
    const want = lastCalc.wantPezzo != null ? lastCalc.wantPezzo : defaultWant();
    const gc = calcGioco(lastCalc, series);
    lastCalc.corr = calcCorrezioneCard(lastCalc.S, series.base, gc.min, gc.max, want, (machine && machine.rule) || 'studer', lastCalc.mode);
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
    const s = taperSides(), st = formStatus(lastCalc.con);
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
    const th = taperHint(lastCalc.con, lastCalc.conEnd, { studer: isStuder(machine), k, always: true });
    const OVAL_REM = '<div class="rem">Ovalità: si controlla dopo, non alla macchina. Ovalità e conicità devono restare entro circa 2–3 µm.</div>';
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
    $('resGiocoRange').textContent = 'gioco ' + gcR.min + '–' + gcR.max + ' µm' + (gcR.src === 'foto' ? ' (dalla foto)' : '');
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
      return `<button type="button" class="tk ${st} ${n === sel ? 'sel' : ''}" data-pick="${n}">${n}</button>`;
    }).join('');
    renderTaper();
    renderFormBox();
    const corr = lastCalc.corr || { none: true, presses: 0, diffUm: 0, key: '' };
    if (corr.none) {
      $('corrKey').textContent = '✓'; $('corrX').textContent = '';
      $('corrTxt').innerHTML = 'Nessuna correzione<small>pezzo ' + esc(String(lastCalc.corrWant)) + ' centrato nel gioco · tocca per un altro pezzo</small>';
    } else {
      $('corrKey').textContent = corr.key || '±'; $('corrX').textContent = corr.key ? '×' + corr.presses : corr.presses + ' µm';
      const w = corrWords(corr.diffUm, corr.presses, corr.key, corr.none);
      $('corrTxt').innerHTML = '<span class="cw-pos">Pezzo ' + esc(String(lastCalc.corrWant)) + ': misura ' + esc(w.pos) + '</span>' +
        '<small class="cw-act">→ ' + esc(w.act) + ': ' + esc(w.keys) + ' · centro gioco ' + fmtUm(corr.centro) + ' µm</small>' +
        `<button type="button" class="corr-done ${lastCalc.corrDone ? 'on' : ''}" id="corrDone">${lastCalc.corrDone ? '✓ Correzione fatta' : 'Segna come fatta'}</button>`;
    }
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
      const c = calcCorrezioneCard(lastCalc.S, series.base, gc.min, gc.max, x.n, (machine && machine.rule) || 'studer', lastCalc.mode);
      const w = c.none ? 'nessuna correzione' : (c.key ? c.key + ' ×' + c.presses : c.presses + ' µm ' + c.action);
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
    const ft = femminaTarget(lastCalc.S, gc.min, gc.max, lastCalc.maschioS, (machine && machine.rule) || 'studer');
    lastCalc.femTarget = ft;
    const copy = matingRangeText(matingRange(lastCalc.S, gc.min, gc.max, 'femmina'));
    let corr = '';
    if (ft.S != null) {
      const k = ft.none ? '✓' : (ft.key || '±'), x = ft.none ? '' : (ft.key ? '×' + ft.presses : ft.presses + ' µm');
      corr = `<div class="ft-corr ${ft.none ? 'ok' : ''}" id="ftCorr"><div class="ft-k cond">${esc(k)}<small>${esc(x)}</small></div>
        <div class="ft-ct">${ft.none ? 'Maschio già al centro' : 'Maschio ' + esc(corrWords(ft.diffUm, ft.presses, ft.key).pos)} <small>${ft.none ? '' : '→ ' + esc(corrWords(ft.diffUm, ft.presses, ft.key).act + ': ' + corrWords(ft.diffUm, ft.presses, ft.key).keys) + ' · '}ora ${esc(fmtMm4(ft.S))} mm · gioco ${esc(fmtUm(ft.gioco))} µm ${ft.inRange ? '✓' : '(fuori)'}</small></div></div>`;
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
        ${ft.S != null ? `<div class="fr-corr ${ft.none ? 'ok' : ''}" id="femCorr"><span class="fk cond">${ft.none ? '✓' : esc(ft.key || '±') + (ft.key ? '×' + ft.presses : '')}</span>
          <span>${ft.none ? 'S già al centro' : 'S ' + esc(corrWords(ft.diffUm, ft.presses, ft.key).pos)}<small>${ft.none ? '' : '→ ' + esc(corrWords(ft.diffUm, ft.presses, ft.key).act + ': ' + corrWords(ft.diffUm, ft.presses, ft.key).keys) + ' · '}gioco ${fmtUm(ft.gioco)} µm ${ft.inRange ? '✓' : '(fuori)'}</small></span></div>`
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
  function intNow() { const c = intCfg(), tgt = internoTarget(c), bore = intBoreValue(), rule = intRule(); return { c, tgt, bore, rule, r: calcInterno(bore, tgt, rule) }; }
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
      const adv = r.none ? '✓ nessuna correzione' : (r.key ? `dai ${esc(r.key)} ×${r.presses}` : (r.action === 'allarga' ? 'allarga ' : 'stringi ') + fmtUm(Math.abs(r.needUm)) + ' µm');
      // Beta 0.4.1: material, literally, on the diameter (grinding a bore only removes material → it only grows)
      const toLo = round1((n.tgt.lo - n.bore) * 1000), toHi = round1((n.tgt.hi - n.bore) * 1000), toC = round1((n.tgt.centro - n.bore) * 1000);
      const mat = r.state === 'largo'
        ? `<b>Foro largo di ${fmtUm(r.aboveHi)} µm: non si recupera (rettificando il foro cresce)</b><small>correggi la macchina per i prossimi pezzi ↓</small>`
        : toC > 0.5 ? `<b>Togli ancora ${fmtUm(toC)} µm sul Ø <span class="nt">(${fmtUm(round1(toC / 2))} µm per lato)</span> → centro ${fmtMm4(n.tgt.centro)}</b>`
        : toC < -0.5 ? `<b>Non togliere altro: ${fmtUm(-toC)} µm sopra il centro ${fmtMm4(n.tgt.centro)}</b>` : `<b>Al centro ${fmtMm4(n.tgt.centro)}: non togliere altro</b>`;
      const lims = `<small>${toLo > 0 ? 'al minimo mancano ' + fmtUm(toLo) + ' µm' : toLo === 0 ? 'proprio sul minimo' : fmtUm(-toLo) + ' µm sopra il minimo'} · ${toHi >= 0 ? 'al massimo restano ' + fmtUm(toHi) + ' µm' : 'oltre il massimo di ' + fmtUm(-toHi) + ' µm'}</small>`;
      h = `<div class="is-big ${r.state}" id="intState">${big}</div><div class="int-mat ${r.state}" id="intMat">${mat}${lims}</div>${gauge}
        <div class="int-adv ${r.none ? 'ok' : r.state}" id="intAdv">${adv}<small id="intCorr">${r.none ? '1 tocco = 1 µm sul diametro' : 'Per i prossimi pezzi · ' + esc(internoWords(r).replace(/ → .*$/, '')) + ' sul Ø (' + fmtUm(round1(Math.abs(r.needUm) / 2)) + ' per lato) · 1 tocco = 1 µm sul diametro'}${n.rule && !(myMachine() || {}).internoRule ? ' · segno predefinito: verifica al 1° pezzo' : ''}</small></div>
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
    return neighbourHints(calc.S, series.base, gc.min, gc.max, center, (machine && machine.rule) || 'studer', extra, calc.mode);
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
        const h = lastCalc.corr; toast('Pezzo ' + n + ': ' + (h.none ? 'nessuna correzione' : (h.key ? h.key + ' ×' + h.presses : h.presses + ' µm')));
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
  function keyLegend() { const m = myMachine(); const r = (m && m.rule) || 'studer';
    return r === 'plus_bigger' ? '1 tocco = 1 µm · + = più grande' : r === 'studer' || r === 'plus_smaller' ? '1 tocco = 1 µm · − = più grande' : '1 tocco = 1 µm'; }
  /** v2.0.8: in-app confirm with glove-sized buttons (replaces the browser's small confirm()). Resolves true/false. */
  function askBig(o) {
    return new Promise((resolve) => {
      const root = $('modalRoot');
      root.innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ask-big" id="askBig" role="dialog" aria-modal="true">
        <h2>${esc(o.title)}</h2>${o.html ? `<div class="ask-body">${o.html}</div>` : ''}
        <div class="ask-btns"><button type="button" class="btn btn-sec" id="askNo">${esc(o.cancel || 'Annulla')}</button>
        <button type="button" class="btn ${o.danger ? 'btn-danger' : 'btn-orange'}" id="askYes">${esc(o.ok || 'Conferma')}</button></div></div></div>`;
      const done = (v) => { root.innerHTML = ''; resolve(v); };
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
    const status = (st === 'no' || formStatus(lastCalc.con) === 'no') ? 'scarto' : 'buono'; // v2.0.1: taper only (ovalità checked later)
    const id = uid(), ts = new Date().toISOString();
    series.history = series.history || [];
    series.history.push({ id, ts, S: lastCalc.S, chosen: n, gioco,
      con: lastCalc.con, conEnd: lastCalc.con > 0 ? (lastCalc.conEnd || null) : null, status, lavoro: lastCalc.mode || 'maschio', machineId: lastCalc.machineId, machineName: (myMachine() || {}).name || '', jobId: prefs.jobId || null });
    if (series.history.length > HIST_MAX) series.history = series.history.slice(-HIST_MAX);
    const stockTaken = stockTake(series.stock, n); // Beta 0.2.0: only on Salva; Annulla gives it back (undoSave)
    state.turno = state.turno || { saves: [], note: '', startedAt: ts };
    state.turno.saves = state.turno.saves || [];
    const corrected = !!(lastCalc.corrDone && lastCalc.corr && !lastCalc.corr.none);
    const aj = activeJob();
    state.turno.saves.push({ id, ts, seriesId: series.id, seriesName: series.name, chosen: n, status,
      S: lastCalc.S, gioco, correction: corrected, jobId: prefs.jobId || null, lavoro: lastCalc.mode || 'maschio',
      machineName: (aj && aj.machineName) || (myMachine() || {}).name || '' });
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
    renderFatti(); renderRiepilogo();
    showUndo(fmtSaveMsg(n, gioco, status));
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
    const pg = document.body.dataset.page, top = (pg === 'femmina' || pg === 'interno') ? document.querySelector('#page-' + pg + ' .fm-top') : null;
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
        const mm = myMachine(); const th = taperHint(lastCalc.con, lastCalc.conEnd, { studer: isStuder(mm), k: knobK(mm), always: true });
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
    const conSt = formStatus(lastCalc.con);
    const st = worstStatus(pst, conSt);
    v.className = 'officina ' + (st === 'ok' || st === 'na' ? 'ok' : st === 'lim' ? 'lim' : 'no');
    const sel = lastCalc.selected;
    const g = sel != null ? giocoOf(sel, lastCalc.acc) : null;
    const forma = [];
    if (conSt === 'lim' || conSt === 'no') {
      const mm = myMachine();
      const th = taperHint(lastCalc.con, lastCalc.conEnd, { studer: isStuder(mm), k: knobK(mm), always: true });
      const verso = th.turn ? (th.turn === 'verso' ? 'verso\u00a0di\u00a0te' : "dall'altra\u00a0parte") : '';
      let line = 'Conicità ' + fmtUm(lastCalc.con) + ' µm' + (lastCalc.conEnd ? ' (più grande ' + TAPER_SIDE_LBL[lastCalc.conEnd] + ')' : '');
      if (th.tacche != null && th.tacche > 0) line += ' · gira ~' + th.taccheText + (verso ? ' ' + verso : '');
      else if (th.tacche === 0) line += ' · gira pochissimo' + (verso ? ' ' + verso : '');
      else if (verso) line += ' · manopola ' + verso;
      forma.push(line);
    }
    const accTxt = sel == null ? 'Nessun pezzo valido' : 'gioco ' + fmtUm(g) + ' µm · ' + (pst === 'ok' ? 'ACCOPPIAMENTO OK' : pst === 'lim' ? 'AL LIMITE' : 'FUORI GIOCO');
    const na = conSt === 'na' ? '<div class="sub" style="font-size:19px;margin-top:14px">Conicità non misurata: misurala (l\'ovalità si controlla dopo)</div>' : '';
    const serO = seriesById(lastCalc.seriesId), gcO = serO ? calcGioco(lastCalc, serO) : null;
    const mO = gcO ? matingRange(lastCalc.S, gcO.min, gcO.max, lastCalc.mode) : null;
    const femO = lastCalc.mode === 'femmina';
    const matO = mO ? (femO
      ? `<div class="sub of-fh">Femmina già fatta ${fmtMm4(lastCalc.S)} → misura da fare (maschio)</div><div class="big cond of-fc">${fmtMm4(mO.centro)}</div><div class="sub of-mt cond">Maschio da ${fmtMm4(mO.min)} a ${fmtMm4(mO.max)} mm</div>`
      : `<div class="sub of-mt cond">Femmina da ${fmtMm4(mO.min)} a ${fmtMm4(mO.max)} mm</div><div class="sub of-mc">centro ${fmtMm4(mO.centro)} mm</div>`) : '';
    const ftO = femO && lastCalc.femTarget && lastCalc.femTarget.S != null ? lastCalc.femTarget : null;
    const ftLine = ftO ? `<div class="sub of-fcorr cond">${ftO.none ? '✓ maschio già al centro' : `Maschio ora ${fmtMm4(ftO.S)}: ${esc(corrWords(ftO.diffUm, ftO.presses, ftO.key).text)}`}</div>` : '';
    v.innerHTML = femO
      ? `${matO}${ftLine}<div class="sub" style="margin-top:10px">pezzo maschio <b>${sel == null ? '—' : esc(String(sel))}</b> · ${esc(accTxt)}</div>`
      : `<div class="big cond">${sel == null ? '—' : esc(String(sel))}</div><div class="sub">${esc(accTxt)}</div>${matO}${(() => { const c = lastCalc.corr; if (!c) return ''; const w = corrWords(c.diffUm, c.presses, c.key, c.none);
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
      <details class="adv"><summary>Altro</summary>
        <label for="mdRule">Cosa fa il tasto + sulla macchina</label><select id="mdRule">
          <option value="studer" ${isStuder(m) ? 'selected' : ''}>+ fa il pezzo più piccolo (Studer)</option>
          <option value="plus_bigger" ${m.rule === 'plus_bigger' ? 'selected' : ''}>+ fa il pezzo più grande</option>
          <option value="generic" ${m.rule === 'generic' ? 'selected' : ''}>Non so / solo µm</option></select>
      </details>
      <div id="mdErr" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn btn-sec" id="mdCancel" style="flex:1">Annulla</button>
      <button type="button" class="btn btn-primary" id="mdSave" style="flex:1.4">✓ Salva</button></div></div></div>`;
    const inp = $('mdName');
    setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) {} }, 60);
    const save = () => {
      const name = inp.value.replace(/\s+/g, ' ').trim();
      if (!name) { $('mdErr').textContent = 'Scrivi il nome della macchina'; $('mdErr').classList.remove('hidden'); return false; }
      const old = m.name;
      m.name = name; m.rule = $('mdRule').value;
      if (old !== name) { const kn = knobForMachineName(state, name); if (kn) m.knob = kn; } // v1.9.6: knob k follows the machine name
      if (old !== name) { prefs.recentMachineNames = [old].concat((prefs.recentMachineNames || []).filter((n) => n !== old && n !== name)).slice(0, 5); savePrefs(prefs); }
      saveData(state); updateChip();
      if ($('page-setup').classList.contains('active')) fillSetupSelects();
      return true;
    };
    $('mdSave').onclick = () => { if (save()) { $('modalRoot').innerHTML = ''; toast('Macchina: ' + m.name); } };
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
    speakIt('Pezzo ' + (n != null ? n : '') + (c && !c.none && c.key ? ', correzione ' + (c.key === '+' ? 'più' : 'meno') + ' ' + c.presses : '')); });
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
      return `<div class="item"><h3 style="font-size:1.1rem">${esc(m.name)}</h3><div class="meta">${esc(m.note || '')}</div>
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
      return `<div class="item ${cur && cur.id === s.id ? 'on' : ''}"><h3>Base ${fmtMm3(s.base)}${s.lotto ? ' · ' + esc(s.lotto) : ''}</h3><div class="meta">gioco ${s.giocoMin}–${s.giocoMax} µm · tol ±${esc(fmtMm3(seriesTol(s)))}${cur && cur.id === s.id ? ' · <b style="color:var(--orange)">in uso</b>' : ''}</div>
        <div class="actions"><button type="button" class="btn btn-sec" data-edit-s="${esc(s.id)}" style="flex:1">Modifica</button>
        <button type="button" class="btn btn-sec" data-dup-s="${esc(s.id)}" style="flex:1">Duplica</button>
        <button type="button" class="btn btn-teal" data-use-s="${esc(s.id)}" style="flex:1">Usa</button>
        <button type="button" class="btn btn-danger s-del" data-del-s="${esc(s.id)}" aria-label="Elimina serie Base ${esc(fmtMm3(s.base))}">${TRASH}</button></div></div>`;
    }).join('') || '<div class="empty">Nessuna serie: aggiungine una</div>';
  }
  $('seriesList').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit-s]'), del = e.target.closest('[data-del-s]');
    const use = e.target.closest('[data-use-s]'), dup = e.target.closest('[data-dup-s]');
    if (ed) openSeriesModal(ed.dataset.editS);
    if (dup) { const src = seriesById(dup.dataset.dupS); if (!src) return;
      const copy = Object.assign({}, src, { id: uid(), name: 'Base ' + fmtMm3(src.base) + ' (copia)', history: [], stock: {} });
      state.series.push(copy); saveData(state); openSeriesModal(copy.id); }
    if (del) { haptic(15); openSeriesDelete(del.dataset.delS); }
    if (use) { const s = seriesById(use.dataset.useS); if (s) { setContext(null, s.id, true); showPage('calc'); newMeasure(); } }
  });
  $('btnAddSeries').addEventListener('click', () => openSeriesModal(null));
  function openSeriesModal(id) {
    const s = id ? seriesById(id) : { lotto: '', base: '', tolleranza: 0.1, giocoMin: 10, giocoMax: 13, notes: '', history: [], stock: {} };
    if (!s) return;
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal"><h2>${id ? 'Modifica quote' : 'Nuova serie'}</h2>
      <div class="field-row"><div><label>Base mm</label><input id="sBase" inputmode="decimal" placeholder="es. 24,600" value="${s.base === '' ? '' : esc(String(s.base).replace('.', ','))}"/></div>
      <div><label>Tol ± mm</label><input id="sTol" inputmode="decimal" placeholder="0,1" value="${s.tolleranza != null ? esc(String(s.tolleranza).replace('.', ',')) : ''}"/></div></div>
      <div class="field-row"><div><label>Gioco min µm</label><input id="sGmin" inputmode="numeric" value="${s.giocoMin}"/></div>
      <div><label>Gioco max µm</label><input id="sGmax" inputmode="numeric" value="${s.giocoMax}"/></div></div>
      <label>Lotto / codice</label><input id="sLotto" value="${esc(s.lotto || '')}"/>
      <label>Note</label><textarea id="sNotes">${esc(s.notes || '')}</textarea>
      <div id="sErr" class="form-err hidden"></div>
      <div class="actions" style="margin-top:10px"><button type="button" class="btn btn-sec" id="sCancel" style="flex:1">Annulla</button>
      <button type="button" class="btn btn-teal" id="sSave" style="flex:1">Salva</button></div>
      ${id ? `<button type="button" class="btn btn-danger del-btn" id="sDelete">${TRASH}<span>Elimina serie</span></button>` : ''}</div></div>`;
    $('sCancel').onclick = () => { $('modalRoot').innerHTML = ''; };
    if ($('sDelete')) $('sDelete').onclick = () => { haptic(15); openSeriesDelete(id); };
    $('sSave').onclick = () => {
      const v = validateSeriesInput({ base: $('sBase').value, tol: $('sTol').value, gmin: $('sGmin').value, gmax: $('sGmax').value });
      if (!v.ok) { const er = $('sErr'); er.textContent = v.error; er.classList.remove('hidden'); haptic(60); return; }
      const mid = myMachine() ? myMachine().id : null;
      const payload = Object.assign({ machineId: mid, name: 'Base ' + fmtMm3(v.value.base), lotto: $('sLotto').value.trim(), notes: $('sNotes').value }, v.value);
      let sid = id;
      if (id) Object.assign(seriesById(id), payload);
      else { sid = uid(); state.series.push(Object.assign({ id: sid, history: [], stock: {} }, payload)); }
      saveData(state); $('modalRoot').innerHTML = '';
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
    const id0 = intShift();
    if ($('femTurno')) $('femTurno').textContent = [fd ? `+ ${fd} ${fd === 1 ? 'femmina salvata' : 'femmine salvate'} (Adatta alla femmina)` : '', id0 ? `+ ${id0} ${id0 === 1 ? 'interno salvato' : 'interni salvati'} (foro)` : ''].filter(Boolean).join(' · ') + (fd || id0 ? ' in questo turno' : '');
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
      <div class="meta" style="margin-top:8px">${sum.bySeries.map((s) => esc(s.name) + ': ' + s.count).join(' · ') || ''}</div>`;
  }
  function shiftText() {
    ensurePezzi();
    const sum = shiftSum();
    let t = 'Rettifica Beta — riepilogo turno\nPezzi fatti: ' + sum.total + ' · Buoni: ' + sum.buoni + ' · Scarti: ' + sum.scarti + '\n';
    sum.byMachine.forEach((m) => { t += '  ' + fmtMachineLine(m) + '\n'; });
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
    state.turniArchivio.unshift({ id: uid(), closedAt, summary: Object.assign({}, sum, { femmine: fd0 }), saves: savesArch });
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
      <div class="meta" style="margin-top:6px">Il gioco si ricalcola da S e pezzo (gioco ${s.giocoMin}–${s.giocoMax} µm).</div>
      <div id="hErr" class="form-err hidden"></div>
      <div class="actions" style="margin-top:10px"><button type="button" class="btn btn-sec" id="hCancel" style="flex:1">Annulla</button>
      <button type="button" class="btn btn-teal" id="hSave" style="flex:1">Salva</button></div></div></div>`;
    $('hCancel').onclick = () => { $('modalRoot').innerHTML = ''; };
    $('hSave').onclick = () => {
      const sv = parseMmNumber($('hS').value), chosen = parseGiocoInt($('hChosen').value);
      const err = (t) => { $('hErr').textContent = t; $('hErr').classList.remove('hidden'); };
      if (sv == null) return err('S non valido (es. 21,9966)');
      if (Math.abs(sv - s.base) > hardLimitMm(s.tolleranza)) return err('S troppo lontano dalla base ' + fmtMm3(s.base));
      if (chosen == null) return err('Pezzo non valido');
      h.S = round4(sv); h.chosen = chosen;
      const acc = calcAccoppiamento(h.S, s.base, s.giocoMin, s.giocoMax, h.lavoro); h.gioco = giocoOf(chosen, acc);
      if (!acc.valid.includes(chosen)) h.status = 'scarto'; else if (h.status === 'scarto' && formStatus(h.oval) !== 'no' && formStatus(h.con) !== 'no') h.status = 'buono';
      saveData(state); $('modalRoot').innerHTML = ''; renderStorico(); renderAndamento();
    };
  }
  function renderArchivio() {
    const list = state.turniArchivio || [];
    $('archivioList').innerHTML = list.length ? list.map((t) =>
      `<div class="item"><b>${new Date(t.closedAt).toLocaleString('it-IT')}</b>
        <div class="meta">${t.summary.total} pezzi fatti · buoni ${t.summary.buoni} · scarti ${t.summary.scarti} · portati ${t.summary.pezziPortati}</div>
        ${(t.summary.byMachine || []).length ? `<div class="meta">${t.summary.byMachine.map((m) => esc(m.name + ' · ' + m.total)).join(' · ')}</div>` : ''}</div>`
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
    if (hasNativeCrop()) { try { RettificaAndroid.ocrCrop(b.l, b.t, b.r, b.b); return; } catch (e) {} }
    if (typeof window.__ocrCropHook === 'function') { window.__ocrCropHook(b); return; }
    const raw = prompt('Testo OCR del riquadro (solo test nel browser):');
    if (raw == null || !String(raw).trim()) { pendingJob = null; return; } applyOcrText(raw);
  }
  function closeCrop() { const r = $('cropRoot'); if (r) r.innerHTML = ''; document.removeEventListener('keydown', cropKey); }
  function cropKey(e) { if (e.key === 'Escape') { e.preventDefault(); cancelCrop(); } }
  function cancelCrop() {
    closeCrop(); lastPhoto = null;
    try { if (window.RettificaAndroid && RettificaAndroid.ocrCancel) RettificaAndroid.ocrCancel(); } catch (e) {}
    pendingFem = false; pendingInt = false; if (pendingJob) { pendingJob = null; toast('Nuovo lavoro annullato'); } else toast('Foto annullata');
  }
  function openCrop(photo, startBox) {
    lastPhoto = photo;
    const box = Object.assign(FULL_BOX(), startBox || {});
    $('cropRoot').innerHTML = `<div class="crop-bg" id="cropBg" role="dialog" aria-label="Ritaglio foto">
      <div class="crop-head"><h2>${pendingJob ? 'Nuovo lavoro · ritaglio' : 'Scegli cosa leggere'}</h2>
      <p class="crop-hint" id="cropHint">Trascina gli angoli sulle righe <b>F1A · S1A · G1A</b> (etichette e valori). Lascia fuori barre e «Buono». Per tutta la foto tocca subito <b>Leggi</b>.</p></div>
      <div class="crop-stage" id="cropStage"><img id="cropImg" alt="Foto da leggere" draggable="false"/>
        <div class="crop-box" id="cropBox"><div class="crop-guide" id="cropGuide"><i class="gl" style="top:33.3%"></i><i class="gl" style="top:66.6%"></i>
          <span class="gt" style="top:4px">F1A</span><span class="gt" style="top:calc(33.3% + 4px)">S1A</span><span class="gt" style="top:calc(66.6% + 4px)">G1A</span></div>
          <span class="crop-h" data-h="tl" style="left:0;top:0"></span><span class="crop-h" data-h="tr" style="left:100%;top:0"></span>
          <span class="crop-h" data-h="bl" style="left:0;top:100%"></span><span class="crop-h" data-h="br" style="left:100%;top:100%"></span></div></div>
      <div class="crop-actions"><button type="button" class="btn btn-sec" id="cropCancel">Annulla</button>
        <button type="button" class="btn btn-sec" id="cropFull">Tutta la foto</button>
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
    const p = pendingJob ? 'job' : pendingInt ? 'int' : pendingFem ? 'fem' : 'calc';
    try { localStorage.setItem(PURPOSE_KEY, JSON.stringify({ p, machineName: pendingJob ? pendingJob.machineName : null, t: Date.now() })); } catch (e) {}
  }
  function clearPhotoPurpose() { try { localStorage.removeItem(PURPOSE_KEY); } catch (e) {} }
  function restorePhotoPurpose() {
    let o = null; try { o = JSON.parse(localStorage.getItem(PURPOSE_KEY) || 'null'); } catch (e) {}
    if (!o || !(Date.now() - o.t < 20 * 60 * 1000)) { clearPhotoPurpose(); return; }
    if (o.p === 'job') pendingJob = { machineName: o.machineName };
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
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal job-setup" id="jobSetup">
      <h2>Nuovo lavoro · dati dal foglio</h2>
      <p class="meta js-sub">Controlla e correggi. Se un campo è vuoto scrivilo tu (o lascialo vuoto). Nessun calcolo qui: dopo scrivi le misure dei pezzi.</p>
      ${fld('jsMach', 'Macchina', v(f.machineName), 'text', 'es. S33 O060')}
      <div class="field-row">${fld('jsBase', 'Nominale / base mm', v(f.base, fmtMm3), 'decimal', 'es. 18,000')}${fld('jsTol', 'Tolleranza ± mm', v(f.tol, tolStr), 'decimal', '0,1')}</div>
      ${f.base == null && f.baseGuess != null ? `<button type="button" class="chip js-guess" id="jsGuess">Usa base ${esc(fmtMm3(f.baseGuess))}? <small>(dalla misura letta)</small></button>` : ''}
      <label class="js-gl">Gioco µm (riga G)</label>
      <div class="field-row">${fld('jsGmin', 'min', v(f.gmin), 'numeric', 'es. 8')}${fld('jsGmax', 'max', v(f.gmax), 'numeric', 'es. 11')}</div>
      <div class="field-row">${fld('jsCod', 'Codice', v(f.codice), 'text', '')}${fld('jsLotto', 'Lotto', v(f.lotto), 'text', '')}</div>
      <div class="meta js-plan" id="jsPlan"></div>
      ${lastPhoto ? '<button type="button" class="btn btn-sec js-recrop" id="jsRecrop">✂ Ritaglia di nuovo</button>' : ''}
      <div class="actions js-act"><button type="button" class="btn btn-sec" id="jsCancel">Annulla</button>
      <button type="button" class="btn btn-primary" id="jsSave">✓ Salva lavoro</button></div></div></div>`;
    const read = () => ({ machineName: $('jsMach').value.replace(/\s+/g, ' ').trim(), base: setupNum($('jsBase').value), tol: (() => { const t = setupNum($('jsTol').value); return t != null && t > 0 && t < 5 ? t : null; })(),
      gmin: setupInt($('jsGmin').value), gmax: setupInt($('jsGmax').value), codice: $('jsCod').value.trim(), lotto: $('jsLotto').value.trim() });
    const showPlan = () => {
      const r = read(), pl = planJobSetup(state.series, r), el = $('jsPlan');
      document.querySelectorAll('#jobSetup .big-input').forEach((i) => i.classList.toggle('empty', !i.value.trim()));
      el.textContent = pl.action === 'create' ? `Nuova serie Base ${fmtMm3(pl.base)} · gioco ${pl.gioco.min}–${pl.gioco.max} µm · tol ±${tolStr(pl.tol)}`
        : pl.action === 'use' ? `Serie Base ${fmtMm3(pl.base)}${pl.gioco ? ' · gioco ' + pl.gioco.min + '–' + pl.gioco.max + ' µm' : ' · gioco ' + pl.series.giocoMin + '–' + pl.series.giocoMax + ' µm'}${pl.changes ? ' (aggiornata dal foglio)' : ''}`
        : pl.reason === 'base' ? 'Base vuota: la scegli dopo in Calcolo (serie).' : 'Gioco vuoto: lo completi dopo in Calcolo (serie).';
    };
    document.querySelectorAll('#jobSetup input').forEach((i) => i.addEventListener('input', showPlan));
    let jsLav = 'maschio';
    document.querySelectorAll('#jobSetup [data-jslav]').forEach((b) => { b.onclick = () => { haptic(12); jsLav = b.dataset.jslav;
      document.querySelectorAll('#jobSetup [data-jslav]').forEach((x) => x.classList.toggle('on', x === b)); }; });
    if ($('jsGuess')) $('jsGuess').onclick = () => { $('jsBase').value = fmtMm3(f.baseGuess); $('jsGuess').remove(); showPlan(); };
    showPlan();
    const cancel = () => { $('modalRoot').innerHTML = ''; lastPhoto = null; try { if (window.RettificaAndroid && RettificaAndroid.ocrCancel) RettificaAndroid.ocrCancel(); } catch (e) {} pendingJob = null; toast('Nuovo lavoro annullato'); };
    $('jsCancel').onclick = cancel;
    if ($('jsRecrop')) $('jsRecrop').onclick = () => { $('modalRoot').innerHTML = ''; if (lastPhoto) openCrop(lastPhoto, lastPhoto.box); };
    $('jsSave').onclick = () => {
      haptic(20);
      const r = read(); const pl = planJobSetup(state.series, r);
      let ser = null, note = '';
      if (pl.action === 'create') {
        ser = { id: uid(), machineId: myMachine() ? myMachine().id : null, name: 'Base ' + fmtMm3(pl.base), lotto: r.lotto, notes: 'Creata dal foglio (Nuovo lavoro)',
          base: pl.base, tolleranza: pl.tol, giocoMin: pl.gioco.min, giocoMax: pl.gioco.max, history: [], stock: {} };
        state.series.push(ser); note = 'Nuova serie Base ' + fmtMm3(ser.base);
      } else if (pl.action === 'use') {
        ser = pl.series;
        if (pl.gioco) { ser.giocoMin = pl.gioco.min; ser.giocoMax = pl.gioco.max; }
        if (pl.tol != null) ser.tolleranza = pl.tol;
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
    if (paired && gUm != null && fromPhoto && !useF) {
      const gap = Math.abs(gUm), ok = gap >= parsed.giocoMin - 0.05 && gap <= parsed.giocoMax + 0.05;
      pairedBox = `<div class="paired-verdict ${ok ? 'ok' : 'no'}">Pezzo già accoppiato · gioco ${esc(fmtUm(gap))} µm → <b>${ok ? 'BUONO' : 'FUORI GIOCO'}</b> <span>(${parsed.giocoMin}–${parsed.giocoMax} µm)</span></div>`;
    }
    const planNote = (plan.action === 'block' || !plan.note ? '' :
      `<div class="photo-note ${plan.action === 'create' || plan.action === 'update' ? 'new' : ''}" id="ocrPlanNote">${esc(plan.note)}</div>`) +
      ((parsed.notes || []).length ? `<div class="photo-note warn" id="ocrParseNote">${parsed.notes.map(esc).join('<br>')}</div>` : '');
    const lowCls = (k) => (parsed.rows && parsed.rows[k] && parsed.rows[k].value != null && parsed.rows[k].confidence < 0.8 ? ' class="low"' : '');
    $('modalRoot').innerHTML = `<div class="modal-bg" id="modalBg"><div class="modal ocr-confirm">
      <h2>${pendingJob ? 'Nuovo lavoro · ' + esc(pendingJob.machineName) : 'Conferma lettura foto'}</h2>
      ${pairedBox || `<div class="typo-box" style="margin-bottom:8px">${paired === false ? 'Non ancora accoppiato → useremo S1A' : (paired ? 'Accoppiato' : 'Verifica i valori')}</div>`}
      ${planNote}
      <div id="ocrWarn" class="form-err hidden"></div>
      <div class="actions" style="display:flex;gap:8px;margin:10px 0 4px"><button type="button" class="btn btn-sec" id="ocrCancel" style="flex:1">Annulla</button>
      <button type="button" class="btn btn-teal" id="ocrGo" style="flex:1.6">${pairedBox && (useF ? F : S) == null ? 'OK' : 'Conferma e calcola'}</button></div>
      ${lastPhoto ? '<button type="button" class="btn btn-sec" id="ocrRecrop" style="width:100%;margin:4px 0">✂ Ritaglia di nuovo</button>' : ''}
      ${lastPhoto && AI ? (() => { const c = AI.cfgOf(prefs), why = !c.vision ? c.label + ' non legge le foto: scegli Gemini, OpenRouter, Qwen o xAI in Setup' : (!AI.hasKey(c.provider) ? 'Manca la chiave API (Setup → Intelligenza artificiale)' : '');
        return `<button type="button" class="btn btn-sec ai-photo ${why ? 'off' : ''}" id="ocrAi" data-why="${esc(why)}" style="width:100%;margin:4px 0;min-height:52px">✨ Leggi foto con AI</button>${why ? `<p class="meta ai-why" id="ocrAiWhy">${esc(why)}</p>` : ''}`; })() : ''}
      <label>Serie</label><select id="ocrSeries">${seriesOpts}</select>
      <label id="ocrGLbl">${fromPhoto ? `Gioco ${parsed.giocoMin}–${parsed.giocoMax} µm (dalla foto)` : 'Gioco µm · riga G non trovata, uso quello della serie'}</label>
      <div class="field-row" id="ocrGRow"><div><input id="ocrGmin" inputmode="numeric" aria-label="Gioco minimo µm" value="${esc(String(gMin0))}"${fromPhoto ? '' : ' class="low"'}/></div>
      <div><input id="ocrGmax" inputmode="numeric" aria-label="Gioco massimo µm" value="${esc(String(gMax0))}"${fromPhoto ? '' : ' class="low"'}/></div></div>
      <div id="ocrGSave" class="hidden" style="margin-top:8px"><label style="display:flex;align-items:center;gap:10px;min-height:48px;font-size:14px;color:var(--text);margin:0">
        <input type="checkbox" id="ocrGSaveChk" style="width:26px;min-height:26px;height:26px;flex:none"/><span id="ocrGSaveTxt"></span></label></div>
      <div id="ocrGNoSave" class="meta hidden" style="margin-top:6px"></div>
      <div class="field-row"><div><label>S1A (mm)${useF ? '' : ' · <b>misura usata</b>'}</label><input id="ocrS" inputmode="decimal" value="${S != null ? esc(fmtMmS(S)) : ''}"${lowCls('S1A')}/></div>
      <div><label>F1A (mm)${useF ? ' · <b>femmina usata</b>' : ''}</label><input id="ocrF" inputmode="decimal" value="${F != null ? esc(fmtMmS(F)) : ''}"${lowCls('F1A')}/></div></div>
      <div><label>G1A (µm)</label><input id="ocrG" value="${gUm != null ? esc(fmtUm(gUm)) : ''}"${lowCls('G1A')}/></div>
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
    let gTouched = false, warned = false;
    const refreshGSave = () => {
      const t = target(), g = readG(), box = $('ocrGSave'), ns = $('ocrGNoSave');
      ns.classList.add('hidden'); box.classList.add('hidden');
      if (!t || !g) { $('ocrGSaveChk').checked = false; return; }
      if (t.isNew) { ns.textContent = `Verrà creata la serie Base ${fmtMm3(t.base)} · gioco ${g.min}–${g.max} µm · tol ±${fmtMm3(t.tol)}`; ns.classList.remove('hidden'); return; }
      const ser = t.ser;
      if (g.min === ser.giocoMin && g.max === ser.giocoMax) { $('ocrGSaveChk').checked = false; return; }
      if (photoOwns(t)) { ns.textContent = `Il gioco della serie Base ${fmtMm3(ser.base)} diventa ${g.min}–${g.max} µm (era ${ser.giocoMin}–${ser.giocoMax})`; ns.classList.remove('hidden'); return; }
      if (!photoMatchesSeries(parsed, ser)) { // never write the photo's gioco into a series that does not match the photo
        $('ocrGSaveChk').checked = false;
        ns.textContent = `Il gioco ${g.min}–${g.max} µm vale solo per questo calcolo: la Base ${fmtMm3(ser.base)} non corrisponde alla foto.`; ns.classList.remove('hidden'); return;
      }
      $('ocrGSaveTxt').textContent = `La serie Base ${fmtMm3(ser.base)} ha ${ser.giocoMin}–${ser.giocoMax} µm. Salva ${g.min}–${g.max} µm nella serie`;
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
    $('ocrS').addEventListener('input', checkPlaus); $('ocrF').addEventListener('input', checkPlaus);
    refreshGSave(); checkPlaus();
    if (plan.action === 'block' && S != null) warn(esc(plan.note));
    $('ocrCancel').onclick = () => { $('modalRoot').innerHTML = ''; lastPhoto = null; try { if (window.RettificaAndroid && RettificaAndroid.ocrCancel) RettificaAndroid.ocrCancel(); } catch (e) {} if (pendingJob) { pendingJob = null; toast('Nuovo lavoro annullato'); } };
    if ($('ocrRecrop')) $('ocrRecrop').onclick = () => { $('modalRoot').innerHTML = ''; if (lastPhoto) openCrop(lastPhoto, lastPhoto.box); };
    $('ocrGo').onclick = () => {
      const t = target();
      if (!t) { warn('Scegli una serie'); return; }
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
        if (dup) { ser = dup; ser.giocoMin = g.min; ser.giocoMax = g.max; }
        else {
          ser = { id: uid(), machineId: myMachine() ? myMachine().id : null, name: 'Base ' + fmtMm3(t.base), lotto: $('ocrLotto').value.trim(), notes: 'Creata dalla foto',
            base: round4(t.base), tolleranza: t.tol, giocoMin: g.min, giocoMax: g.max, history: [], stock: {} };
          state.series.push(ser);
        }
        note = `Nuova serie Base ${fmtMm3(ser.base)} · gioco ${g.min}–${g.max} creata dalla foto`;
        saveData(state);
      } else if (photoOwns(t) && (g.min !== ser.giocoMin || g.max !== ser.giocoMax)) {
        note = `Base ${fmtMm3(ser.base)}: gioco aggiornato ${ser.giocoMin}–${ser.giocoMax} → ${g.min}–${g.max} µm (dalla foto)`;
        ser.giocoMin = g.min; ser.giocoMax = g.max;
        if (plan.tol != null && ser.tolleranza == null) ser.tolleranza = plan.tol;
        saveData(state);
      } else if (!$('ocrGSave').classList.contains('hidden') && $('ocrGSaveChk').checked && photoMatchesSeries(parsed, ser)) {
        ser.giocoMin = g.min; ser.giocoMax = g.max; saveData(state); note = `Gioco ${g.min}–${g.max} µm salvato nella serie`;
      }
      const codice = $('ocrCod').value.trim(), lotto = $('ocrLotto').value.trim();
      if (pendingJob) { // «Nuovo lavoro»: this photo starts the job, which becomes the active context
        const j = startJob({ machineName: pendingJob.machineName, series: ser, codice, lotto }); pendingJob = null;
        note = (note ? note + ' · ' : '') + 'Lavoro: ' + j.machineName;
      } else {
        const j = activeJob();
        if (j && codice && !j.codice) j.codice = codice;
        if (j && lotto && !j.lotto) j.lotto = lotto;
      }
      setContext(null, ser.id, false);
      $('modalRoot').innerHTML = '';
      if (sv == null) { // paired photo without S: verdict only
        const okP = pairedBox.includes('BUONO');
        toast((note ? note + ' · ' : '') + (okP ? 'Accoppiato: BUONO' : 'Accoppiato: FUORI GIOCO'), okP ? '' : 'warn'); return;
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
    if (!res || res.ok === false || res.error) {
      const code = res && res.code;
      if (code === 'camera') { showCameraProblem(); return; } // gallery can still finish «Nuovo lavoro»
      if (pendingJob) pendingJob = null;
      pendingFem = false; pendingInt = false; clearPhotoPurpose();
      if (code === 'cancel') { toast(res.error && res.error.length <= 30 ? res.error : 'Foto annullata'); return; }
      toast(OCR_MSG[code] || 'Lettura foto non riuscita', 'warn'); return;
    }
    if (typeof parseElencoBlocks === 'function' && res.blocks) openOcrConfirm(parseElencoBlocks(res.blocks));
    else applyOcrText(res.fullText || '');
  };
  if ($('fotoHint')) $('fotoHint').textContent = hasNativeOcr() ? 'Foto più precisa: da vicino solo le righe F1A · S1A · G1A, dritto davanti allo schermo (📷 → Scatta foto o Dalla galleria; tieni premuto 📷 per la galleria). Conferma sempre.' : '';

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
        d: h.S != null ? round1((h.S - s.base) * 1000) : null, chosen: h.chosen, gioco: h.gioco, oval: h.oval, con: h.con, conEnd: h.conEnd || null, status: h.status || '', lavoro: h.lavoro || 'maschio' });
    }));
    femRows().forEach((r) => rows.push(r)); // v2.0.5 female pieces (page Femmina)
    intRows().forEach((r) => rows.push(r)); // Beta 0.3.0 interno (bore)
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
      const inf = res.info;
      const when = inf.exportedAt ? new Date(inf.exportedAt).toLocaleString('it-IT') : 'data non indicata';
      const html = `<p class="meta">Backup: <b>${esc(inf.app)}${inf.appVersion ? ' ' + esc(inf.appVersion) : ''}</b> · ${esc(when)}</p>
        <p class="meta">Contiene: ${inf.machines} macchina/e · ${inf.series} basi · ${inf.measures} misure · ${inf.femmine} femmine · ${inf.turni} turni archiviati.</p>
        ${inf.dropped ? `<p class="meta">${inf.dropped} basi non valide verranno saltate.</p>` : ''}
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
      <p class="del-p">Cancella <b>basi e serie, lavori, macchina, storico, conteggi del turno, magazzino, taratura e femmine</b>. Restano solo le preferenze (tema, voce).</p>
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
    if (none) $('actBar').classList.add('hidden');
    fitPads();
  }
  $('emNewJob').addEventListener('click', () => { haptic(12); openNewJob(); });
  $('emAddBase').addEventListener('click', () => { haptic(12); openSeriesModal(null); });

  // ── Beta 0.5.0: AI (Assistente + Leggi foto con AI). The AI never computes: the app's numbers are shown, the AI explains. ──
  const AI = window.RettificaAI;
  function aiCtx() {
    const { series } = currentContext(), m = myMachine(), c = { machine: (m && m.name) || '' };
    if (series) {
      c.base = fmtMm3(series.base); c.giocoMin = series.giocoMin; c.giocoMax = series.giocoMax; c.tol = series.tolleranza != null ? fmtMm3(series.tolleranza) : null;
      c.last = (series.history || []).slice(-3).map((h) => fmtMmS(h.S) + ' mm → pezzo ' + h.chosen + (h.status === 'scarto' ? ' (scarto)' : ''));
      try { const d = currentDrift(series, m, null); if (d && d.alert) c.trend = d.alert; } catch (e) {}
    }
    c.lavoro = lavoroMode() === 'femmina' ? 'femmina (adatta)' : 'maschio';
    if (lastCalc && lastCalc.acc) {
      const a = lastCalc.acc, v = a.valid || [], co = lastCalc.corr;
      c.calc = `misura ${lastCalc.display} mm; pezzi validi ${v.length ? v[0] + '…' + v[v.length - 1] : 'nessuno'}; centro ${fmtUm(a.ideal)}; scelto ${lastCalc.selected != null ? lastCalc.selected : '—'}`
        + (co ? (co.none ? '; correzione: nessuna' : `; correzione: ${co.key} ×${co.presses} (${fmtUm(Math.abs(co.diffUm))} µm)`) : '');
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
  async function webPhotoData(img, w, h) {
    lastPhoto = { img, w, h, box: FULL_BOX() };
    const empty = (msg) => ({ S1A: null, F1A: null, G1A: null, rows: {}, header: {}, notes: [msg], lowConfidence: [] });
    const cfg = AI.cfgOf(prefs);
    if (!cfg.vision || !AI.hasKey(cfg.provider)) {
      const msg = 'Versione web: la lettura offline (ML Kit) non c’è. Usa «✨ Leggi foto con AI»' + (AI.hasKey(cfg.provider) ? ' (scegli in Setup un servizio che legge le foto)' : ' (metti la chiave AI in Setup)') + ' oppure scrivi i valori.';
      toast('Foto: serve l’AI per leggerla', 'warn'); openOcrConfirm(empty(msg)); return;
    }
    toast('✨ Leggo la foto con AI…');
    const r = await AI.readPhoto(prefs, img);
    if (r.ok) { openOcrConfirm(r.parsed); toast('Letto con AI: controlla i valori'); return; }
    toast(r.error, 'warn'); openOcrConfirm(empty(r.error + ' Scrivi i valori a mano o riprova.'));
  }
  async function aiReadPhoto(parsed) {
    const btn = $('ocrAi'); if (!btn || btn.classList.contains('off')) { if (btn) toast(btn.dataset.why || 'Non disponibile', 'warn'); return; }
    const w = $('ocrWarn'); btn.classList.add('off'); btn.textContent = '✨ Leggo con AI…'; haptic(12);
    const r = await AI.readPhoto(prefs, await aiPhotoData());
    if (!$('ocrAi')) return;
    if (!r.ok) { btn.classList.remove('off'); btn.textContent = '✨ Leggi foto con AI'; if (w) { w.innerHTML = '⚠ ' + esc(r.error) + ' Restano i valori della lettura normale.'; w.classList.remove('hidden'); } return; }
    openOcrConfirm(Object.assign(r.parsed, { _lavoro: parsed._lavoro }));
    const n = $('ocrParseNote'); if (n) n.classList.add('ai');
    toast('Letto con AI: controlla i valori');
  }
  window.__rettifica = {
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
    setPendingJob(n) { pendingJob = n ? { machineName: n } : null; },
  };

  applyTheme(); updateVoiceBtn();
  initJobs();
  const ctx = currentContext();
  if (ctx.series) setContext(null, ctx.series.id, false);
  showPage('calc'); showInputView(); refreshDisplay(); renderRecent();
})();
