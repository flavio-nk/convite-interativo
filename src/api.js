// Acesso aos dados salvos (funções em /api). Disponível para as telas como `api`.

let config = null;

async function call(method, url, body, opts = {}) {
  const r = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
    keepalive: !!opts.keepalive
  });
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (!r.ok) {
    const err = new Error((data && data.error) || 'Não foi possível concluir (erro ' + r.status + ').');
    err.status = r.status;
    throw err;
  }
  return data;
}

const enc = encodeURIComponent;

function safeName(name) {
  const base = String(name || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return 'convites/' + base.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80);
}


const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WDL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MOL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const pad = (n) => (n < 10 ? '0' + n : String(n));
const toDate = (iso) => { if (!iso) return null; const d = new Date(iso); return isNaN(d.getTime()) ? null : d; };
const hour = (d) => d.getHours() + 'h' + (d.getMinutes() ? pad(d.getMinutes()) : '');

export const fmt = {
  card(iso) { const d = toDate(iso); return d ? WD[d.getDay()] + ', ' + d.getDate() + ' ' + MO[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + hour(d) : 'Data a definir'; },
  dots(iso) { const d = toDate(iso); return d ? pad(d.getDate()) + ' · ' + pad(d.getMonth() + 1) + ' · ' + d.getFullYear() : ''; },
  long(iso) { const d = toDate(iso); return d ? WDL[d.getDay()] + ', ' + d.getDate() + ' de ' + MOL[d.getMonth()] + ' de ' + d.getFullYear() + ', às ' + hour(d) : ''; },
  day(iso) { const d = toDate(iso); return d ? d.getDate() + ' de ' + MOL[d.getMonth()] + ' de ' + d.getFullYear() : ''; },
  short(iso) { const d = toDate(iso); return d ? d.getDate() + ' ' + MO[d.getMonth()] : ''; },
  monthShort(iso) { const d = toDate(iso); return d ? MO[d.getMonth()].toUpperCase() : ''; },
  dayNum(iso) { const d = toDate(iso); return d ? String(d.getDate()) : ''; },
  // valor para <input type="datetime-local"> no fuso do navegador
  toLocalInput(iso) { const d = toDate(iso); return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : ''; },
  fromLocalInput(v) { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); },
  toDateInput(iso) { const d = toDate(iso); return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : ''; },
  fromDateInput(v) { if (!v) return null; const d = new Date(v + 'T23:59:00'); return isNaN(d.getTime()) ? null : d.toISOString(); },
  isPast(iso) { const d = toDate(iso); return !!d && d.getTime() < Date.now(); }
};

const FONTS = {
  cormorant: ["'Cormorant Garamond', Georgia, serif", '500', 40], playfair: ["'Playfair Display', Georgia, serif", '600', 36],
  bodoni: ["'Bodoni Moda', Georgia, serif", '500', 36], dmserif: ["'DM Serif Display', Georgia, serif", '400', 36],
  italiana: ["'Italiana', serif", '400', 38], greatvibes: ["'Great Vibes', cursive", '400', 46], caveat: ["'Caveat', cursive", '700', 44],
  bricolage: ["'Bricolage Grotesque', sans-serif", '800', 34], syne: ["'Syne', sans-serif", '800', 30],
  josefin: ["'Josefin Sans', sans-serif", '700', 34], jakarta: ["'Plus Jakarta Sans', sans-serif", '800', 32]
};

// Valores visuais derivados de um tema (mesma regra do editor).
export function themeTokens(th) {
  th = th || {};
  const f = FONTS[th.fontKey] || FONTS.cormorant;
  const radii = { pilula: '999px', arredondado: '10px', reto: '0px' };
  const L = th.layout || 'centro';
  const photo = {
    centro: ['200px', '100%', '0', '10px', 'none', '0'],
    'foto-topo': ['240px', 'calc(100% + 40px)', '-24px -20px 0', '0', 'none', '0'],
    'foto-fundo': ['320px', 'calc(100% + 40px)', '-24px -20px 0', '0', 'none', '0'],
    moldura: ['190px', '100%', '0', '0', 'none', '0'],
    dividido: ['200px', '100%', '0', '4px', 'none', '0'],
    editorial: ['190px', '100%', '0', '0', 'none', '0'],
    arco: ['230px', '72%', '0 auto', '999px 999px 0 0', 'none', '0'],
    polaroid: ['210px', '78%', '6px auto 10px', '2px', 'rotate(-3deg)', '8px solid #FFFFFF']
  }[L] || ['200px', '100%', '0', '10px', 'none', '0'];
  const bg = th.bg || '#1F3329', fg = th.fg || '#F3EEE4', accent = th.accent || '#CDAE6B';
  return {
    bg, fg, accent, btnFg: th.btnFg || '#1F3329', paper: th.paper || '#E9E1D0', ph: th.ph || '#2B4538',
    layout: L, anim: th.anim || 'envelope',
    font: f[0], weight: f[1], titleSize: (L === 'editorial' ? f[2] + 8 : f[2]) + 'px',
    fstyle: th.italic ? 'italic' : 'normal',
    body: "'Plus Jakarta Sans', system-ui, sans-serif",
    radius: radii[th.radiusKey] || '999px',
    line: 'color-mix(in srgb, ' + fg + ' 24%, ' + bg + ')',
    surface: 'color-mix(in srgb, ' + fg + ' 9%, ' + bg + ')',
    align: (L === 'editorial' || L === 'dividido') ? 'left' : 'center',
    frame: L === 'moldura' ? '5px double ' + accent : '0',
    band: L === 'dividido' ? '10px solid ' + accent : (L === 'moldura' ? '5px double ' + accent : '0'),
    framePad: L === 'moldura' ? '14px' : (L === 'dividido' ? '0 0 0 12px' : '0'),
    photoRatio: LAYOUT_RATIOS[L] || LAYOUT_RATIOS.centro,
    photoH: photo[0], photoW: photo[1], photoM: photo[2], photoR: photo[3], photoRot: photo[4], photoBorder: photo[5]
  };
}

// ---------- Fotos: enquadramento, giro e filtros (não destrutivo) ----------
// A foto original nunca é alterada: as edições ficam salvas junto do bloco e
// são aplicadas na exibição. Proporção do quadro = largura / altura.
const LAYOUT_RATIOS = {
  centro: 350 / 200, 'foto-topo': 390 / 240, 'foto-fundo': 390 / 320, moldura: 312 / 190,
  dividido: 328 / 200, editorial: 350 / 190, arco: 252 / 230, polaroid: 257 / 194
};
const FORMATS = [
  ['tema', 'Padrão do layout', 0], ['1:1', 'Quadrado (1:1)', 1], ['4:5', 'Retrato (4:5)', 4 / 5],
  ['3:4', 'Retrato alto (3:4)', 3 / 4], ['3:2', 'Paisagem (3:2)', 3 / 2], ['16:9', 'Panorâmica (16:9)', 16 / 9],
  ['9:16', 'Vertical (9:16)', 9 / 16]
];
const FILTERS = [
  ['nenhum', 'Original', ''],
  ['pb', 'P&B', 'grayscale(1)'],
  ['noir', 'Noir', 'grayscale(1) contrast(1.35) brightness(0.95)'],
  ['sepia', 'Sépia', 'sepia(0.8)'],
  ['vintage', 'Vintage', 'sepia(0.35) contrast(1.1) saturate(0.8) brightness(1.05)'],
  ['quente', 'Quente', 'sepia(0.28) saturate(1.3) hue-rotate(-8deg)'],
  ['frio', 'Frio', 'saturate(0.9) hue-rotate(14deg) brightness(1.03)'],
  ['vivido', 'Vívido', 'saturate(1.6) contrast(1.1)'],
  ['suave', 'Suave', 'contrast(0.85) brightness(1.1) saturate(0.85)'],
  ['dramatico', 'Dramático', 'contrast(1.4) saturate(1.2) brightness(0.9)'],
  ['desbotado', 'Desbotado', 'contrast(0.75) saturate(0.6) brightness(1.1)'],
  ['rosado', 'Rosado', 'sepia(0.2) saturate(1.2) hue-rotate(-20deg) brightness(1.05)']
];
export const PAGE_RATIO = 390 / 844;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

function filterCss(e) {
  e = e || {};
  const f = FILTERS.find((x) => x[0] === e.filter);
  const parts = [];
  if (f && f[2]) parts.push(f[2]);
  const b = num(e.brightness, 100), c = num(e.contrast, 100), s = num(e.saturate, 100), bl = num(e.blur, 0);
  if (b !== 100) parts.push('brightness(' + b / 100 + ')');
  if (c !== 100) parts.push('contrast(' + c / 100 + ')');
  if (s !== 100) parts.push('saturate(' + s / 100 + ')');
  if (bl > 0) parts.push('blur(' + bl + 'px)');
  return parts.join(' ');
}

// Geometria em "unidades de quadro": largura 1, altura 1/r.
function photoGeom(e, r) {
  const a = num(e.ar, 0);
  const W = 1, H = 1 / r;
  const deg = num(e.rot, 0) + 90 * (num(e.quarter, 0) % 4);
  const th = deg * Math.PI / 180;
  const ct = Math.cos(th), st = Math.sin(th);
  const c = Math.abs(ct), s = Math.abs(st);
  const Wp = W * c + H * s, Hp = W * s + H * c; // quadro visto no eixo da foto
  const k = Math.max(Wp / a, Hp) * (1.02 + num(e.blur, 0) * 0.01) * Math.max(1, num(e.zoom, 1));
  const iw = k * a, ih = k;
  return { a, W, H, deg, ct, st, Wp, Hp, iw, ih, slackX: (iw - Wp) / 2, slackY: (ih - Hp) / 2 };
}

function photoStyle(e, r) {
  e = e || {};
  const f = filterCss(e);
  const fil = f ? 'filter:' + f + ';' : '';
  if (!num(e.ar, 0) || !r) return 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block;' + fil;
  const g = photoGeom(e, r);
  const dlx = clamp(num(e.px, 0), -1, 1) * g.slackX, dly = clamp(num(e.py, 0), -1, 1) * g.slackY;
  const dx = dlx * g.ct - dly * g.st, dy = dlx * g.st + dly * g.ct;
  const pct = (v) => (Math.round(v * 10000) / 100) + '%';
  return 'position:absolute;display:block;max-width:none;max-height:none;object-fit:fill;' +
    'left:' + pct((g.W / 2 + dx - g.iw / 2) / g.W) + ';top:' + pct((g.H / 2 + dy - g.ih / 2) / g.H) + ';' +
    'width:' + pct(g.iw / g.W) + ';height:' + pct(g.ih / g.H) + ';' +
    'transform:rotate(' + g.deg + 'deg) scale(' + (e.flipH ? -1 : 1) + ',' + (e.flipV ? -1 : 1) + ');' + fil;
}

export const photo = {
  formats: FORMATS.map((f) => ({ key: f[0], label: f[1] })),
  filters: FILTERS.map((f) => ({ key: f[0], label: f[1], css: f[2] })),
  pageRatio: PAGE_RATIO,
  // proporção do quadro de um bloco de foto, conforme o formato escolhido e o layout do tema
  ratio(edit, layout) {
    const fmtKey = edit && edit.frame;
    const f = FORMATS.find((x) => x[0] === fmtKey);
    return f && f[2] ? f[2] : (LAYOUT_RATIOS[layout] || LAYOUT_RATIOS.centro);
  },
  filterCss,
  style: photoStyle,
  // desloca a foto ao arrastar (dx, dy em frações da largura do quadro)
  pan(e, r, dx, dy) {
    if (!num(e.ar, 0)) return e;
    const g = photoGeom(e, r);
    const lx = dx * g.ct + dy * g.st, ly = -dx * g.st + dy * g.ct;
    const out = Object.assign({}, e);
    if (g.slackX > 1e-6) out.px = clamp(num(e.px, 0) + lx / g.slackX, -1, 1);
    if (g.slackY > 1e-6) out.py = clamp(num(e.py, 0) + ly / g.slackY, -1, 1);
    return out;
  },
  isEdited(e) {
    if (!e) return false;
    return !!(e.filter && e.filter !== 'nenhum') || num(e.zoom, 1) !== 1 || num(e.rot, 0) !== 0 || num(e.quarter, 0) % 4 !== 0 ||
      !!e.flipH || !!e.flipV || num(e.px, 0) !== 0 || num(e.py, 0) !== 0 || num(e.brightness, 100) !== 100 ||
      num(e.contrast, 100) !== 100 || num(e.saturate, 100) !== 100 || num(e.blur, 0) !== 0 || (!!e.frame && e.frame !== 'tema');
  }
};

// ---------- Tamanho da fonte dos blocos ----------
// O tamanho escolhido vale para o texto principal do bloco (em px); os demais
// textos do bloco (rótulos, legendas) acompanham na mesma proporção.
const FONT_BASE = { texto: 15, orientacoes: 14, botao: 15, mapa: 16, contagem: 30, rsvp: 15 };
const FONT_RANGE = { titulo: [16, 96], contagem: [14, 72] };
export function fontBase(type, T) {
  if (type === 'titulo') return parseInt((T && T.titleSize) || '40', 10) || 40;
  return FONT_BASE[type] || 0;
}
export function fontScale(block, T) {
  const base = fontBase(block && block.type, T);
  const fs = block && Number(block.fontSize);
  if (!base || !fs || !isFinite(fs)) return 1;
  return fs / base;
}
export const fontRange = (type) => FONT_RANGE[type] || [9, 48];

// ---------- Cores do tema antes de o convite carregar ----------
// O link do convidado leva as 3 cores principais (?t=fundo.texto.destaque) e o
// aparelho guarda as cores do último acesso; assim a tela de carregamento já
// aparece no tema do convite. Sem nenhuma das duas, usa um fundo neutro.
const HEX6 = /^[0-9A-Fa-f]{6}$/;
export const NEUTRAL_THEME = { bg: '#1C1B22', fg: '#F3F2F7', accent: '#B9A6FF' };
export const themeHint = {
  encode(th) {
    if (!th) return '';
    const parts = [th.bg, th.fg, th.accent].map((c) => String(c || '').replace('#', ''));
    return parts.every((c) => HEX6.test(c)) ? parts.join('.').toUpperCase() : '';
  },
  parse(str) {
    const parts = String(str || '').split('.');
    if (parts.length !== 3 || !parts.every((c) => HEX6.test(c))) return null;
    return { bg: '#' + parts[0], fg: '#' + parts[1], accent: '#' + parts[2] };
  },
  load(id) {
    try { return themeHint.parse(localStorage.getItem('ci:tema:' + id)); } catch (e) { return null; }
  },
  save(id, th) {
    const v = themeHint.encode(th);
    try { if (v && id) localStorage.setItem('ci:tema:' + id, v); } catch (e) {}
  }
};
// Cor ao redor do celular na tela do convidado (e barra do navegador).
export function setFrameColor(bg) {
  if (typeof window === 'undefined' || !bg) return;
  window.__ciFrame = bg;
  try {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', bg);
    window.dispatchEvent(new CustomEvent('ci:frame', { detail: bg }));
  } catch (e) {}
}

export const api = {
  fmt,
  themeTokens,
  themeHint,
  setFrameColor,
  NEUTRAL_THEME,
  photo,
  fontBase,
  fontScale,
  fontRange,
  async me() {
    config = await call('GET', '/api/auth?action=me');
    return config;
  },
  config: () => config,
  login: (password) => call('POST', '/api/auth?action=login', { password }),
  logout: () => call('POST', '/api/auth?action=logout', {}),

  listInvites: () => call('GET', '/api/invites'),
  getInvite: (id, guestCode) => call('GET', '/api/invites?id=' + enc(id) + (guestCode ? '&g=' + enc(guestCode) : '')),
  createInvite: (data) => call('POST', '/api/invites', data),
  saveInvite: (id, data, opts) => call('PUT', '/api/invites?id=' + enc(id), data, opts),
  deleteInvite: (id) => call('DELETE', '/api/invites?id=' + enc(id)),
  restoreInvite: async (deleted) => {
    if (!deleted || !deleted.invite) return null;
    const inv = await call('PUT', '/api/invites?id=' + enc(deleted.invite.id), Object.assign({}, deleted.invite, { __rsvps: deleted.rsvps || {}, __guests: deleted.guests || {} }));
    return inv;
  },

  listRsvps: (id) => call('GET', '/api/rsvp?invite=' + enc(id)),
  sendRsvp: (id, data) => call('POST', '/api/rsvp?invite=' + enc(id), data),
  deleteRsvp: (id, rid) => call('DELETE', '/api/rsvp?invite=' + enc(id) + '&id=' + enc(rid)),

  listGuests: (id) => call('GET', '/api/guests?invite=' + enc(id)),
  createGuests: (id, items) => call('POST', '/api/guests?invite=' + enc(id), { items }),
  saveGuest: (id, gid, data) => call('PUT', '/api/guests?invite=' + enc(id) + '&id=' + enc(gid), data),
  deleteGuest: (id, gid) => call('DELETE', '/api/guests?invite=' + enc(id) + '&id=' + enc(gid)),

  listThemes: () => call('GET', '/api/themes'),
  getTheme: (id) => call('GET', '/api/themes?id=' + enc(id)),
  saveTheme: (t) => call('POST', '/api/themes', t),
  deleteTheme: (id) => call('DELETE', '/api/themes?id=' + enc(id)),

  async upload(file, onProgress) {
    const cfg = config || (await api.me());
    if (cfg.uploads === 'missing') throw new Error('Armazenamento de arquivos não configurado no Vercel (conecte um Blob ao projeto em Storage e faça um novo deploy).');
    if (cfg.uploads === 'blob' || cfg.uploads === 'blob-oidc') {
      const mod = await import('@vercel/blob/client');
      const send = cfg.uploads === 'blob-oidc' ? mod.uploadPresigned : mod.upload;
      const opts = {
        handleUploadUrl: '/api/upload',
        contentType: file.type || undefined,
        onUploadProgress: onProgress ? (e) => onProgress(Math.round(e.percentage)) : undefined
      };
      const name = safeName(file.name);
      try {
        const b = await send(name, file, Object.assign({ access: 'public' }, opts));
        return { url: /\.private\./.test(b.url) ? '/api/upload?media=' + enc(b.url) : b.url };
      } catch (err) {
        // Blob criado como privado: envia como privado e entrega por link assinado
        if (!/private|access|public/i.test(String(err && err.message))) throw err;
        const b = await send(name, file, Object.assign({ access: 'private' }, opts));
        return { url: '/api/upload?media=' + enc(b.url) };
      }
    }
    const r = await fetch('/api/upload?name=' + enc(file.name), {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
      credentials: 'same-origin'
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Falha no envio do arquivo.');
    return data;
  },

  navigate(path) {
    const target = '#/' + String(path).replace(/^#?\/?/, '');
    if (window.location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else window.location.hash = target;
  },
  // link do convidado; com o código de um convite individual, o link é só daquele convidado
  guestLink(id, theme, guestCode) {
    const t = themeHint.encode(theme);
    return window.location.origin + window.location.pathname + '#/c/' + id + (guestCode ? '/' + guestCode : '') + (t ? '?t=' + t : '');
  },
  local: {
    get(k) { try { return JSON.parse(window.localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  }
};
