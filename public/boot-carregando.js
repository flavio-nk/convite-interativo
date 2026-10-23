(function () {
  var c = window.__ciLoad, a = document.getElementById('app');
  if (!c || !a) return;
  a.innerHTML = '<div role="status" style="min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:' + c.fg +
    ';font:500 15px system-ui,-apple-system,sans-serif"><span aria-hidden="true" style="width:42px;height:42px;border-radius:50%;border:2px solid color-mix(in srgb,' + c.fg + ' 24%,transparent);border-top-color:' + c.ac +
    ';box-sizing:border-box;animation:ciS .9s linear infinite"></span><span style="opacity:.85;letter-spacing:.02em">Abrindo convite…</span></div>';
})();
