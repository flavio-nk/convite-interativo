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
    photoH: photo[0], photoW: photo[1], photoM: photo[2], photoR: photo[3], photoRot: photo[4], photoBorder: photo[5]
  };
}

export const api = {
  fmt,
  themeTokens,
  async me() {
    config = await call('GET', '/api/auth?action=me');
    return config;
  },
  config: () => config,
  login: (password) => call('POST', '/api/auth?action=login', { password }),
  logout: () => call('POST', '/api/auth?action=logout', {}),

  listInvites: () => call('GET', '/api/invites'),
  getInvite: (id) => call('GET', '/api/invites?id=' + enc(id)),
  createInvite: (data) => call('POST', '/api/invites', data),
  saveInvite: (id, data, opts) => call('PUT', '/api/invites?id=' + enc(id), data, opts),
  deleteInvite: (id) => call('DELETE', '/api/invites?id=' + enc(id)),
  restoreInvite: async (deleted) => {
    if (!deleted || !deleted.invite) return null;
    const inv = await call('PUT', '/api/invites?id=' + enc(deleted.invite.id), Object.assign({}, deleted.invite, { __rsvps: deleted.rsvps || {} }));
    return inv;
  },

  listRsvps: (id) => call('GET', '/api/rsvp?invite=' + enc(id)),
  sendRsvp: (id, data) => call('POST', '/api/rsvp?invite=' + enc(id), data),
  deleteRsvp: (id, rid) => call('DELETE', '/api/rsvp?invite=' + enc(id) + '&id=' + enc(rid)),

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
  guestLink(id) {
    return window.location.origin + window.location.pathname + '#/c/' + id;
  },
  local: {
    get(k) { try { return JSON.parse(window.localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  }
};
