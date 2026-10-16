/* Rettifica Web: service worker, «Aggiungi a Home», web notes. Loaded only in the web build. */
(function () {
  // 0.9.2: inside the Android APK (window.RettificaAndroid) the files are already in the app: no service worker, no «Aggiungi a Home»
  var apk = !!(window.RettificaAndroid && window.RettificaAndroid.isApk);
  if (!apk && 'serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(function () {});
  var deferred = null;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; draw(); });
  window.addEventListener('appinstalled', function () { deferred = null; draw(); });
  function draw() {
    var page = document.getElementById('page-setup'); if (!page || apk) return;
    var box = document.getElementById('webInstall');
    if (!box) { box = document.createElement('div'); box.id = 'webInstall'; box.className = 'card web-install'; page.insertBefore(box, page.firstChild); }
    var apkLink = /android/i.test(navigator.userAgent) ? '<a class="btn btn-sec" href="https://github.com/4uva4ok92-glitch/rettifica-web/releases/latest/download/rettifica.apk" style="display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;margin-top:8px;text-decoration:none">🤖 Scarica l’app Android (APK)</a>' : '';
    if (standalone) { box.innerHTML = '<b>📲 App installata</b><p class="meta">Funziona anche senza rete (tranne l’AI).</p>' + apkLink; return; }
    box.innerHTML = '<b>📲 Aggiungi a Home</b><p class="meta">' + (deferred ? 'Installa l’app sul telefono: si apre a schermo intero e funziona senza rete.' :
      ios ? 'Su iPhone: tocca Condividi ⬆︎ e poi «Aggiungi alla schermata Home».' : 'Nel menu del browser (⋮) tocca «Aggiungi a schermata Home» o «Installa app».') + '</p>' +
      (deferred ? '<button type="button" class="btn btn-teal" id="webInstallBtn" style="width:100%;min-height:56px;font-size:17px">📲 Aggiungi a Home</button>' : '') + apkLink;
    var b = document.getElementById('webInstallBtn');
    if (b) b.onclick = function () { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; draw(); }); };
  }
  // 0.9.2: backup notice that tracks the last backup. Big orange card only when a backup is really due
  // (data saved and no backup in 7 days); otherwise one compact line. Same on Setup and Storico.
  var BK_KEY = 'rweb_lastBackup', BK_DAYS = 7;
  function savedCount() {
    var raw; try { raw = localStorage.getItem('rweb_v1'); } catch (e) { return 0; }
    if (!raw) return 0;
    // records with a timestamp, without the shift lists (turno/turni repeat the same pieces)
    var n = 0;
    function walk(o, k) {
      if (k === 'turno' || k === 'turni' || !o || typeof o !== 'object') return;
      if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i]); return; }
      if (o.ts != null) n++;
      for (var key in o) if (Object.prototype.hasOwnProperty.call(o, key)) walk(o[key], key);
    }
    try { walk(JSON.parse(raw)); } catch (e) { return 0; }
    return n;
  }
  function mis(n) { return n === 1 ? '1 misura' : n + ' misure'; }
  function lastBackup() { var v; try { v = Number(localStorage.getItem(BK_KEY)); } catch (e) { v = 0; } return v > 0 ? v : 0; }
  function agoText(ts) {
    var d0 = new Date(); d0.setHours(0, 0, 0, 0);
    var d1 = new Date(ts); d1.setHours(0, 0, 0, 0);
    var days = Math.round((d0 - d1) / 86400000);
    return days <= 0 ? 'oggi' : days === 1 ? 'ieri' : days + ' giorni fa';
  }
  function injectCss() {
    if (document.getElementById('webDataCss')) return;
    var st = document.createElement('style'); st.id = 'webDataCss';
    st.textContent = '.web-data.ok{display:flex;align-items:center;gap:10px;padding:12px 14px}' +
      '.web-data.ok .wd-t{flex:1;font-size:14px;font-weight:700;color:var(--green)}' +
      '.web-data.ok .wd-t small{display:block;color:var(--muted);font-weight:600;font-size:12px;margin-top:2px}' +
      '.web-data.ok .btn{min-height:44px;padding:0 14px;font-size:14px;white-space:nowrap}' +
      '.web-data details{margin-top:6px}.web-data summary{cursor:pointer;color:var(--muted);font-size:13px;font-weight:700}';
    document.head.appendChild(st);
  }
  function drawData() {
    injectCss();
    var n = savedCount(), last = lastBackup();
    var due = n > 0 && (!last || Date.now() - last > BK_DAYS * 86400000);
    var where = apk ? 'su questo telefono' : 'in questo browser';
    var why = '<details><summary>Perché serve?</summary><p class="meta">' + (apk ? 'I dati restano solo in questa app: se la disinstalli, cancelli i dati dell’app o cambi telefono, misure e lavori si perdono.' : 'Nella versione web i dati restano solo in questo browser: se cancelli i dati del browser, usi la navigazione privata o cambi telefono, misure e lavori si perdono.') + ' Il backup si apre in «Condividi»: mandalo su Drive, email o WhatsApp.</p></details>';
    [['page-setup', 'webData'], ['page-storico', 'webDataSt']].forEach(function (pair) {
      var page = document.getElementById(pair[0]); if (!page) return;
      var box = document.getElementById(pair[1]);
      if (!box) {
        box = document.createElement('div'); box.id = pair[1];
        var after = pair[0] === 'page-setup' ? document.getElementById('webInstall') : null;
        if (after && after.nextSibling) page.insertBefore(box, after.nextSibling); else page.insertBefore(box, page.firstChild);
      }
      if (due) {
        box.className = 'card web-data';
        box.innerHTML = '<b>💾 Backup da fare</b><p class="meta">' + mis(n) + ' salvate solo ' + where + ' · ultimo backup: <b>' + (last ? agoText(last) : 'mai') + '</b>.</p>' +
          '<button type="button" class="btn btn-orange web-bk" style="width:100%;min-height:56px;font-size:17px">💾 Fai backup adesso</button>' + why;
      } else {
        box.className = 'card web-data ok';
        box.innerHTML = '<div class="wd-t">' + (last ? '✓ Backup fatto ' + agoText(last) : '💾 Backup') +
          '<small>' + (n ? mis(n) + ' · i dati restano solo ' + where : 'Nessuna misura ancora: fai il backup dopo i primi pezzi') + '</small></div>' +
          '<button type="button" class="btn btn-sec web-bk">' + (last ? 'Rifai' : 'Backup') + '</button>';
      }
      box.querySelector('.web-bk').onclick = function () { var b = document.getElementById('btnExport'); if (b) b.click(); };
    });
  }
  window.addEventListener('rweb-backup-done', drawData);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) drawData(); });
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-page="storico"],[data-page="setup"]');
    if (t) setTimeout(drawData, 0);
  }, true);
  function init() {
    draw(); drawData();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
