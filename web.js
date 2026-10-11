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
    if (!box) { box = document.createElement('div'); box.id = 'webInstall'; box.className = 'card web-install'; page.insertBefore(box, page.firstChild); }
    if (standalone) { box.innerHTML = '<b>📲 App installata</b><p class="meta">Funziona anche senza rete (tranne l’AI).</p>'; return; }
    box.innerHTML = '<b>📲 Aggiungi a Home</b><p class="meta">' + (deferred ? 'Installa l’app sul telefono: si apre a schermo intero e funziona senza rete.' :
      ios ? 'Su iPhone: tocca Condividi ⬆︎ e poi «Aggiungi alla schermata Home».' : 'Nel menu del browser (⋮) tocca «Aggiungi a schermata Home» o «Installa app».') + '</p>' +
      (deferred ? '<button type="button" class="btn btn-teal" id="webInstallBtn" style="width:100%;min-height:56px;font-size:17px">📲 Aggiungi a Home</button>' : '');
    var b = document.getElementById('webInstallBtn');
    if (b) b.onclick = function () { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; draw(); }); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', draw); else draw();
})();
