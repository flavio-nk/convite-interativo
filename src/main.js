import React, { render } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { getComponent, screenTitle } from './runtime.js';
import { api } from './api.js';

const h = React.createElement;

const ADMIN = new Set(['Main', 'Novo', 'Temas', 'CriarTema', 'Editor', 'Respostas', 'Usuarios', 'Pedidos']);
// telas só de administradores
const ADMIN_ONLY = new Set(['Usuarios', 'Pedidos']);
// telas abertas sem login: link de acesso do cliente e formulário de pedido
const PUBLIC = new Set(['Acesso', 'Pedido']);
// telas que a conta de cliente não usa (ela não cria convites nem temas)
const NOT_CLIENT = new Set(['Novo', 'CriarTema', 'Usuarios', 'Pedidos']);

// #/Editor/abc?x=1  →  { name: 'Editor', params: { id: 'abc', x: '1' } }
// #/c/abc           →  convite do convidado
// #/c/abc/x1y2z3    →  convite individual (personalizado) daquele convidado
function parseRoute() {
  // link curto do convidado: /c/<link-ou-id>[/<código individual>]
  const pm = window.location.pathname.match(/^\/c\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (pm && !window.location.hash) {
    const params = { id: decodeURIComponent(pm[1]) };
    if (pm[2]) params.g = decodeURIComponent(pm[2]);
    return { name: 'Convite', params, key: window.location.pathname };
  }
  // formulário de pedido: /pedido (link fácil de divulgar)
  if (/^\/pedido\/?$/.test(window.location.pathname) && !window.location.hash) return { name: 'Pedido', params: {}, key: 'pedido' };
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
  if (name !== 'Convite' && !PUBLIC.has(name) && !ADMIN.has(name)) name = 'Main';
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

// página aberta no convite (avisada pela tela do convite), para as setas ao lado dele
function usePagesInfo() {
  const [p, setP] = useState({ n: 0, i: 0 });
  useEffect(() => {
    const f = (e) => setP(e.detail || { n: 0, i: 0 });
    window.addEventListener('ci:pages', f);
    return () => window.removeEventListener('ci:pages', f);
  }, []);
  return p;
}

const ARROW = {
  '-1': 'M15 18l-6-6 6-6',
  '1': 'M9 6l6 6-6 6'
};

function PageArrow({ d, disabled, light }) {
  const label = d < 0 ? 'Página anterior' : 'Próxima página';
  return h('button', {
    type: 'button', 'aria-label': label, title: label + (d < 0 ? ' (←)' : ' (→)'), disabled, 'data-page-arrow': d < 0 ? 'prev' : 'next',
    onClick: (e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('ci:go', { detail: { d } })); },
    class: 'ci-arrow',
    style: 'flex:none;width:56px;height:56px;border-radius:50%;border:1px solid ' + (light ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.28)') + ';background:' + (light ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.12)') + ';color:' + (light ? '#1B1916' : '#FFFFFF') + ';display:flex;align-items:center;justify-content:center;cursor:' + (disabled ? 'default' : 'pointer') + ';opacity:' + (disabled ? '0.25' : '1') + ';transition:background .2s,transform .2s'
  }, h('svg', { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, h('path', { d: ARROW[String(d)] })));
}

// o fundo ao redor do convite (cor do tema escurecida a 78%) é claro? então as setas ficam escuras
function isLight(color) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(color || ''));
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.78 * (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
}

if (!document.getElementById('ci-arrow-css')) {
  const css = document.createElement('style');
  css.id = 'ci-arrow-css';
  css.textContent = '.ci-arrow:not(:disabled):hover{transform:scale(1.07)}.ci-arrow:focus-visible{outline:3px solid #FFFFFF;outline-offset:3px}';
  document.head.appendChild(css);
}

function PhoneFrame({ children }) {
  const vp = useViewport();
  const color = useFrameColor();
  const pagesInfo = usePagesInfo();
  const mobile = vp.w < 640;
  // no computador, setas dos dois lados do convite para trocar de página
  const arrows = !mobile && pagesInfo.n > 1;
  const light = !mobile && isLight(color);
  const scale = mobile ? Math.min(vp.w / 390, vp.h / 844) : Math.min(1, (vp.h - 32) / 844);
  // ao redor do celular: a cor do tema (no computador, um tom mais escuro dela)
  const bg = color ? (mobile ? color : 'color-mix(in srgb, ' + color + ' 78%, #000)') : (mobile ? '#000' : '#1C1B22');
  // Toques nas faixas ao redor do convite (quando a tela do aparelho não tem a mesma
  // proporção do convite) valem como toque no convite: a abertura "toque" recebe o aviso.
  const onOutside = (e) => {
    const frame = e.currentTarget.querySelector('[data-frame]');
    if (frame && frame.contains(e.target)) return;
    window.dispatchEvent(new CustomEvent('ci:tap-outside'));
  };
  return h('div', {
    onClick: onOutside,
    style: 'min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;gap:32px;cursor:pointer;-webkit-tap-highlight-color:transparent;background:' + bg
  },
  arrows ? h(PageArrow, { d: -1, disabled: pagesInfo.i <= 0, light }) : null,
  h('div', {
    'data-frame': '1',
    style: 'flex:none;width:' + 390 * scale + 'px;height:' + 844 * scale + 'px;overflow:hidden;position:relative;cursor:auto;' + (mobile ? '' : 'border-radius:' + 36 * scale + 'px;box-shadow:0 20px 60px rgba(0,0,0,.45);')
  },
  h('div', { style: 'width:390px;height:844px;transform:scale(' + scale + ');transform-origin:top left' }, children)),
  arrows ? h(PageArrow, { d: 1, disabled: pagesInfo.i >= pagesInfo.n - 1, light }) : null);
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
  // link de acesso do cliente: abre mesmo sem login (é nele que a senha é criada)
  if (route.name === 'Pedido') {
    const Pedido = getComponent('Pedido');
    return h(Pedido, { key: route.key, route });
  }
  if (route.name === 'Acesso') {
    const Acesso = getComponent('Acesso');
    return h(Acesso, { key: route.key, route, onLogin: () => refreshMe().then(() => { window.location.hash = '#/Main'; }) });
  }
  if (!me) return h(Loading);
  if (!me.logged) {
    const Login = getComponent('Login');
    return h(Login, { me, onLogin: refreshMe });
  }
  // o painel de administração (Usuários) é só para administradores
  let name = ADMIN_ONLY.has(route.name) && !me.admin ? 'Main' : route.name;
  // cliente: Temas só para trocar o tema de um convite dele
  if (me.client && (NOT_CLIENT.has(name) || (name === 'Temas' && !route.params.invite))) name = 'Main';
  const Screen = getComponent(name);
  // cada visita começa do zero, como um carregamento real de página
  return h(Screen, { key: route.key + ':' + visit, route, onLogout: refreshMe });
}

const root = document.getElementById('app');
root.textContent = ''; // remove a tela de carregamento desenhada antes do app chegar
render(h(App), root);
