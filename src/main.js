import React, { render } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { getComponent, screenTitle, setNavigate } from './runtime.js';

const h = React.createElement;

const PHONE = new Set(['Abertura', 'ConviteCapa', 'ConviteDetalhes', 'ConviteGaleria', 'ConviteRSVP']);
const MENU = [
  { group: 'Organizador', items: [
    ['Main', 'Painel · Meus convites'],
    ['Temas', 'Novo convite · Escolher tema'],
    ['CriarTema', 'Criar tema'],
    ['Editor', 'Editor do convite'],
    ['Respostas', 'Confirmações de presença']
  ] },
  { group: 'Convidado (celular)', items: [
    ['Abertura', 'Convite fechado e abertura'],
    ['ConviteCapa', 'Capa'],
    ['ConviteDetalhes', 'Detalhes e mapa'],
    ['ConviteGaleria', 'Galeria'],
    ['ConviteRSVP', 'Confirmar presença']
  ] }
];
const VALID = new Set(MENU.flatMap((g) => g.items.map((i) => i[0])));

function currentRoute() {
  const name = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return VALID.has(name) ? name : 'Main';
}

setNavigate((name) => {
  if (window.location.hash === '#/' + name) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = '#/' + name;
});

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const f = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return vp;
}

function PhoneFrame({ children }) {
  const vp = useViewport();
  const mobile = vp.w < 640;
  const scale = mobile ? Math.min(vp.w / 390, vp.h / 844) : Math.min(1, (vp.h - 32) / 844);
  return h('div', {
    style: 'min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:' + (mobile ? '#000' : '#1C1B22')
  },
  h('div', {
    style: 'width:' + 390 * scale + 'px;height:' + 844 * scale + 'px;overflow:hidden;position:relative;' + (mobile ? '' : 'border-radius:' + 36 * scale + 'px;box-shadow:0 20px 60px rgba(0,0,0,.45);')
  },
  h('div', { style: 'width:390px;height:844px;transform:scale(' + scale + ');transform-origin:top left' }, children)));
}

function ScreensMenu({ current }) {
  const [open, setOpen] = useState(false);
  const go = (name) => { setOpen(false); window.location.hash = '#/' + name; };
  const btn = h('button', {
    onClick: () => setOpen(!open),
    'aria-expanded': open ? 'true' : 'false',
    style: 'position:fixed;left:12px;bottom:12px;z-index:9999;min-height:40px;padding:0 14px;border-radius:999px;border:0;background:rgba(23,21,31,.82);color:#fff;font:600 13px/1 "Plus Jakarta Sans",system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;gap:8px'
  },
  h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'aria-hidden': 'true' }, h('path', { d: 'M4 6h16M4 12h16M4 18h16' })),
  'Telas');
  if (!open) return btn;
  return h(React.Fragment, null,
    h('div', { onClick: () => setOpen(false), style: 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.25)' }),
    h('nav', {
      'aria-label': 'Telas do protótipo',
      style: 'position:fixed;left:12px;bottom:60px;z-index:9999;width:280px;max-height:75vh;overflow:auto;background:#fff;color:#17151F;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);padding:10px;font:14px/1.4 "Plus Jakarta Sans",system-ui,sans-serif'
    },
    MENU.map((g) => h('div', { key: g.group, style: 'padding:4px 0' },
      h('div', { style: 'font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5E5A6B;padding:6px 8px' }, g.group),
      g.items.map(([name, label]) => h('button', {
        key: name,
        onClick: () => go(name),
        style: 'display:block;width:100%;text-align:left;min-height:40px;padding:8px 10px;border:0;border-radius:8px;cursor:pointer;font:inherit;' + (name === current ? 'background:#EFECFB;color:#3B26A8;font-weight:700' : 'background:transparent;color:#17151F')
      }, label))))),
    btn);
}

function App() {
  const [route, setRoute] = useState(currentRoute());
  const [visit, setVisit] = useState(0);
  useEffect(() => {
    const f = () => { setRoute(currentRoute()); setVisit((v) => v + 1); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  useEffect(() => { document.title = screenTitle(route) + ' · Convite Interativo'; }, [route]);
  const Screen = getComponent(route);
  // key muda a cada visita: cada tela começa do zero, como um carregamento real de página
  const screen = h(Screen, { key: route + ':' + visit });
  return h(React.Fragment, null,
    PHONE.has(route) ? h(PhoneFrame, null, screen) : screen,
    h(ScreensMenu, { current: route }));
}

render(h(App), document.getElementById('app'));
