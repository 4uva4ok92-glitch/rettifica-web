/* Rettifica Web: service worker, «Aggiungi a Home», web notes. Loaded only in the web build. */
(function () {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(function () {});
  var deferred = null;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; draw(); });
  window.addEventListener('appinstalled', function () { deferred = null; draw(); });
  function draw() {
    var page = document.getElementById('page-setup'); if (!page) return;
    var box = document.getElementById('webInstall');
    if (!box) { box = document.createElement('div'); box.id = 'webInstall'; box.className = 'card web-install'; afterHead(page, box); }
    if (standalone) { box.innerHTML = '<b>📲 App installata</b><p class="meta">Funziona anche senza rete (tranne l’AI).</p>'; return; }
    box.innerHTML = '<b>📲 Aggiungi a Home</b><p class="meta">' + (deferred ? 'Installa l’app sul telefono: si apre a schermo intero e funziona senza rete.' :
      ios ? 'Su iPhone: tocca Condividi ⬆︎ e poi «Aggiungi alla schermata Home».' : 'Nel menu del browser (⋮) tocca «Aggiungi a schermata Home» o «Installa app».') + '</p>' +
      (deferred ? '<button type="button" class="btn btn-teal" id="webInstallBtn" style="width:100%;min-height:56px;font-size:17px">📲 Aggiungi a Home</button>' : '');
    var b = document.getElementById('webInstallBtn');
    if (b) b.onclick = function () { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; draw(); }); };
  }
  // Beta 0.6.0: browser data can be lost → clear notice + backup button (Setup and Storico)
  function drawData() {
    [['page-setup', 'webData'], ['page-storico', 'webDataSt']].forEach(function (pair) {
      var page = document.getElementById(pair[0]); if (!page || document.getElementById(pair[1])) return;
      var box = document.createElement('div'); box.id = pair[1]; box.className = 'card web-data';
      box.innerHTML = '<b>⚠ Versione web: i dati restano solo in questo browser</b><p class="meta">Se cancelli i dati del browser, usi la navigazione privata o cambi telefono, misure e lavori si perdono. Fai spesso un backup e conservalo (Drive, email).</p>' +
        '<button type="button" class="btn btn-orange web-bk" style="width:100%;min-height:56px;font-size:17px">💾 Fai backup adesso</button>';
      box.querySelector('.web-bk').onclick = function () { var b = document.getElementById('btnExport'); if (b) b.click(); };
      var after = pair[0] === 'page-setup' ? document.getElementById('webInstall') : null;
      if (after) page.insertBefore(box, after.nextSibling); else afterHead(page, box);
    });
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  }
  function afterHead(page, box) { var h = page.querySelector('.page-head'); if (h) page.insertBefore(box, h.nextSibling); else page.insertBefore(box, page.firstChild); }
  function init() { draw(); drawData(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
