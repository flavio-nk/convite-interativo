import React, { render } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { getComponent, screenTitle } from './runtime.js';
import { api } from './api.js';

const h = React.createElement;

const ADMIN = new Set(['Main', 'Temas', 'CriarTema', 'Editor', 'Respostas', 'Usuarios']);

// #/Editor/abc?x=1  →  { name: 'Editor', params: { id: 'abc', x: '1' } }
// #/c/abc           →  convite do convidado
// #/c/abc/x1y2z3    →  convite individual (personalizado) daquele convidado
function parseRoute() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const params = {};
  new URLSearchParams(queryPart || '').forEach((v, k) => { params[k] = v; });
  let name = parts[0] || 'Main';
  if (name === 'c') { name = 'Convite'; }
  if (name === 'Convidados') name = 'Respostas'; // a tela de convites individuais foi unida à de respostas
  if (parts[1]) params.id = decodeURIComponent(parts[1]);
  if (name === 'Convite' && parts[2]) params.g = decodeURIComponent(parts[2]);
  if (name !== 'Convite' && !ADMIN.has(name)) name = 'Main';
  return { name, params, key: raw };
}

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const f = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return vp;
}

function useFrameColor() {
  const [c, setC] = useState(window.__ciFrame || null);
  useEffect(() => {
    const f = (e) => setC(e.detail);
    window.addEventListener('ci:frame', f);
    return () => window.removeEventListener('ci:frame', f);
  }, []);
  return c;
}

function PhoneFrame({ children }) {
  const vp = useViewport();
  const color = useFrameColor();
  const mobile = vp.w < 640;
  const scale = mobile ? Math.min(vp.w / 390, vp.h / 844) : Math.min(1, (vp.h - 32) / 844);
  // ao redor do celular: a cor do tema (no computador, um tom mais escuro dela)
  const bg = color ? (mobile ? color : 'color-mix(in srgb, ' + color + ' 78%, #000)') : (mobile ? '#000' : '#1C1B22');
  // Toques nas faixas ao redor do convite (quando a tela do aparelho não tem a mesma
  // proporção do convite) valem como toque no convite: a abertura "toque" recebe o aviso.
  const onOutside = (e) => {
    const frame = e.currentTarget.firstChild;
    if (frame && frame.contains(e.target)) return;
    window.dispatchEvent(new CustomEvent('ci:tap-outside'));
  };
  return h('div', {
    onClick: onOutside,
    style: 'min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;background:' + bg
  },
  h('div', {
    style: 'width:' + 390 * scale + 'px;height:' + 844 * scale + 'px;overflow:hidden;position:relative;' + (mobile ? '' : 'border-radius:' + 36 * scale + 'px;box-shadow:0 20px 60px rgba(0,0,0,.45);')
  },
  h('div', { style: 'width:390px;height:844px;transform:scale(' + scale + ');transform-origin:top left' }, children)));
}

function Loading() {
  return h('div', { style: 'min-height:100vh;display:flex;align-items:center;justify-content:center;font:500 15px "Plus Jakarta Sans",system-ui,sans-serif;color:#5E5A6B' }, 'Carregando…');
}

function App() {
  const [route, setRoute] = useState(parseRoute());
  const [visit, setVisit] = useState(0);
  const [me, setMe] = useState(null);

  const refreshMe = () => api.me().then(setMe).catch(() => setMe({ admin: false, logged: false, error: true }));

  useEffect(() => {
    refreshMe();
    const f = () => { setRoute(parseRoute()); setVisit((v) => v + 1); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  useEffect(() => {
    const t = route.name === 'Convite' ? 'Convite' : screenTitle(route.name);
    document.title = t + ' · Convite Interativo';
  }, [route.name]);

  if (route.name === 'Convite') {
    const Guest = getComponent('Convite');
    return h(PhoneFrame, null, h(Guest, { key: route.key + ':' + visit, route }));
  }
  if (!me) return h(Loading);
  if (!me.logged) {
    const Login = getComponent('Login');
    return h(Login, { me, onLogin: refreshMe });
  }
  // o painel de administração (Usuários) é só para administradores
  const name = route.name === 'Usuarios' && !me.admin ? 'Main' : route.name;
  const Screen = getComponent(name);
  // cada visita começa do zero, como um carregamento real de página
  return h(Screen, { key: route.key + ':' + visit, route, onLogout: refreshMe });
}

const root = document.getElementById('app');
root.textContent = ''; // remove a tela de carregamento desenhada antes do app chegar
render(h(App), root);
