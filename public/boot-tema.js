/* Convite do convidado: pinta a tela de carregamento nas cores do tema antes de o app
   chegar. Cores do link (?t=fundo.texto.destaque) ou do último acesso neste aparelho. */
(function () {
  try {
    var m = location.hash.match(/^#\/c\/([^?\/]+)(?:\?(.*))?/);
    if (!m) return;
    var hex = /^[0-9A-Fa-f]{6}$/;
    var parse = function (v) { var p = String(v || '').split('.'); return p.length === 3 && p.every(function (c) { return hex.test(c); }) ? p : null; };
    var t = parse(new URLSearchParams(m[2] || '').get('t'));
    if (!t) { try { t = parse(localStorage.getItem('ci:tema:' + decodeURIComponent(m[1]))); } catch (e) {} }
    var bg = t ? '#' + t[0] : '#1C1B22', fg = t ? '#' + t[1] : '#F3F2F7', ac = t ? '#' + t[2] : '#B9A6FF';
    window.__ciFrame = bg;
    window.__ciLoad = { bg: bg, fg: fg, ac: ac };
    var st = document.createElement('style');
    st.textContent = 'html,body{background:' + bg + ' !important}' +
      '@media (min-width:640px){html,body{background:color-mix(in srgb,' + bg + ' 78%,#000) !important}}' +
      '@keyframes ciS{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', bg);
  } catch (e) {}
})();
