import qrcode from 'qrcode-generator';
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

// ---------- envio de mídia: limites e redução de fotos ----------
const MB = 1024 * 1024;
export const MEDIA_LIMITS = { image: 10 * MB, video: 20 * MB, audio: 10 * MB };
const PHOTO_MAX_SIDE = 2000;

function mediaKind(file) {
  const t = String(file.type || '');
  const n = String(file.name || '').toLowerCase();
  if (/^image\//.test(t) || /\.(jpe?g|png|webp|gif|avif|heic|heif)$/.test(n)) return 'image';
  if (/^video\//.test(t) || /\.(mp4|mov|webm|m4v|ogv)$/.test(n)) return 'video';
  if (/^audio\//.test(t) || /\.(mp3|m4a|aac|ogg|oga|wav)$/.test(n)) return 'audio';
  return '';
}

const fmtMB = (b) => (b / MB).toFixed(b < 10 * MB ? 1 : 0).replace('.', ',') + ' MB';

// Foto grande vira WebP de até 2000 px no lado maior (mantém a orientação da câmera).
// GIF fica como está (pode ser animado). Se não der para reduzir, envia o original.
async function shrinkPhoto(file) {
  if (/gif|svg/i.test(file.type)) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { return file; }
  const big = Math.max(bmp.width, bmp.height);
  if (file.size <= 400 * 1024 && big <= PHOTO_MAX_SIDE) { bmp.close && bmp.close(); return file; }
  const k = Math.min(1, PHOTO_MAX_SIDE / big);
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close && bmp.close();
  const toBlob = (type, q) => new Promise((res) => canvas.toBlob(res, type, q));
  let blob = await toBlob('image/webp', 0.82);
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    // navegador sem WebP: JPEG (PNG com transparência fica no formato original)
    if (/png/i.test(file.type)) return file;
    blob = await toBlob('image/jpeg', 0.85); ext = 'jpg';
  }
  if (!blob || blob.size >= file.size) return file;
  const name = String(file.name || 'foto').replace(/\.[^.]+$/, '') + '.' + ext;
  try { return new File([blob], name, { type: blob.type }); } catch (e) { blob.name = name; return blob; }
}

export async function prepareMedia(file) {
  const kind = mediaKind(file);
  if (!kind) throw new Error('Envie uma foto (JPG, PNG, WebP ou GIF), um vídeo ou um áudio.');
  if (kind === 'image') file = await shrinkPhoto(file);
  const max = MEDIA_LIMITS[kind];
  if (file.size > max) {
    const what = kind === 'image' ? 'A foto' : (kind === 'video' ? 'O vídeo' : 'A música');
    const tip = kind === 'video' ? ' Reduza a qualidade ou corte o vídeo (no celular, compartilhe em qualidade menor).' : (kind === 'audio' ? ' Use um MP3 de até ' + fmtMB(max) + ' (128 kbps cabem uns 10 minutos).' : '');
    throw new Error(what + ' tem ' + fmtMB(file.size) + '; o máximo é ' + fmtMB(max) + '.' + tip);
  }
  return file;
}

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
  josefin: ["'Josefin Sans', sans-serif", '700', 34], jakarta: ["'Plus Jakarta Sans', sans-serif", '800', 32],
  cinzel: ["'Cinzel', Georgia, serif", '600', 32], pinyon: ["'Pinyon Script', cursive", '400', 46],
  fraunces: ["'Fraunces', Georgia, serif", '600', 38], abril: ["'Abril Fatface', Georgia, serif", '400', 38],
  unbounded: ["'Unbounded', sans-serif", '700', 28]
};
export { FONTS };
// nome da fonte a partir da família CSS (temas prontos descrevem a fonte pela família)
export function fontKeyOf(css) {
  const c = String(css || '');
  return Object.keys(FONTS).find((k) => FONTS[k][0] === c) || Object.keys(FONTS).find((k) => c.indexOf(FONTS[k][0].split(',')[0]) !== -1) || 'cormorant';
}

// Fonte dos textos (o título usa a fonte do tema)
export const BODY_FONTS = {
  jakarta: "'Plus Jakarta Sans', system-ui, sans-serif",
  josefin: "'Josefin Sans', sans-serif",
  cormorant: "'Cormorant Garamond', Georgia, serif"
};

// Valores visuais derivados de um tema (mesma regra do editor).
export function themeTokens(th) {
  th = th || {};
  const f = FONTS[th.fontKey] || FONTS.cormorant;
  const radii = { pilula: '999px', arredondado: '10px', reto: '0px' };
  const L = th.layout || 'centro';
  const bg = th.bg || '#1F3329', fg = th.fg || '#F3EEE4', accent = th.accent || '#CDAE6B';
  // [altura, largura, margem, cantos, giro, borda] do quadro de foto padrão de cada layout
  const photo = {
    centro: ['200px', '100%', '0', '10px', 'none', '0'],
    'foto-topo': ['240px', 'calc(100% + 40px)', '-24px -20px 0', '0', 'none', '0'],
    'foto-fundo': ['320px', 'calc(100% + 40px)', '-24px -20px 0', '0', 'none', '0'],
    moldura: ['190px', '100%', '0', '0', 'none', '0'],
    fina: ['190px', '100%', '0', '0', 'none', '0'],
    dividido: ['200px', '100%', '0', '4px', 'none', '0'],
    editorial: ['190px', '100%', '0', '0', 'none', '0'],
    arco: ['230px', '72%', '0 auto', '999px 999px 0 0', 'none', '0'],
    polaroid: ['210px', '78%', '6px auto 10px', '2px', 'rotate(-3deg)', '8px solid #FFFFFF'],
    revista: ['300px', '100%', '0', '0', 'none', '0'],
    minimal: ['220px', '100%', '0', '0', 'none', '0'],
    botanico: ['300px', '74%', '0 auto', '50%', 'none', '0'],
    deco: ['220px', '86%', '0 auto', '0', 'none', '0'],
    aurora: ['220px', '100%', '0', '26px', 'none', '0'],
    colagem: ['215px', '82%', '6px auto 10px', '2px', 'rotate(-2deg)', '0']
  }[L] || ['200px', '100%', '0', '10px', 'none', '0'];
  // "Moldura fina": filete claro e fino a alguns px da borda, como nos convites impressos
  const thin = '1px solid color-mix(in srgb, ' + fg + ' 82%, transparent)';
  const glass = L === 'aurora';
  const bump = { editorial: 8, revista: 14, minimal: -6 }[L] || 0;
  return {
    bg, fg, accent, btnFg: th.btnFg || '#1F3329', paper: th.paper || '#E9E1D0', ph: th.ph || '#2B4538',
    layout: L, anim: th.anim || 'envelope',
    fx: th.fx || 'nenhum', pageFx: th.pageFx || 'suave',
    font: f[0], weight: f[1], titleSize: (f[2] + bump) + 'px',
    fstyle: th.italic ? 'italic' : 'normal',
    titleCase: L === 'deco' || L === 'revista' ? 'uppercase' : 'none',
    titleTrack: L === 'deco' ? '0.08em' : (L === 'minimal' ? '0.01em' : 'normal'),
    body: BODY_FONTS[th.bodyKey] || BODY_FONTS.jakarta,
    radius: radii[th.radiusKey] || '999px',
    line: glass ? 'color-mix(in srgb, ' + fg + ' 28%, transparent)' : 'color-mix(in srgb, ' + fg + ' 24%, ' + bg + ')',
    surface: glass ? 'color-mix(in srgb, ' + fg + ' 12%, transparent)' : 'color-mix(in srgb, ' + fg + ' 9%, ' + bg + ')',
    align: (L === 'editorial' || L === 'dividido' || L === 'revista' || L === 'minimal') ? 'left' : 'center',
    frame: L === 'moldura' ? '5px double ' + accent : (L === 'fina' ? thin : (L === 'deco' ? '1px solid ' + accent : '0')),
    band: L === 'dividido' ? '10px solid ' + accent : (L === 'moldura' ? '5px double ' + accent : (L === 'fina' ? thin : (L === 'deco' ? '1px solid ' + accent : '0'))),
    framePad: L === 'moldura' ? '14px' : (L === 'fina' ? '18px' : (L === 'dividido' ? '0 0 0 12px' : (L === 'deco' ? '22px' : '0'))),
    frameInset: L === 'fina' ? '14px 14px 16px' : (L === 'deco' ? '16px 16px 18px' : '22px 20px 28px'),
    decor: ['botanico', 'deco', 'aurora', 'minimal', 'revista'].indexOf(L) !== -1 ? L : '',
    photoRatio: LAYOUT_RATIOS[L] || LAYOUT_RATIOS.centro,
    photoH: photo[0], photoW: photo[1], photoM: photo[2], photoR: photo[3], photoRot: photo[4], photoBorder: photo[5],
    photoClip: L === 'deco' ? 'polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%)' : 'none',
    photoShadow: L === 'aurora' ? '0 18px 40px rgba(0, 0, 0, 0.28)' : ((L === 'polaroid' || L === 'colagem') ? '0 8px 18px rgba(0, 0, 0, 0.18)' : 'none')
  };
}

// ---------- Catálogos de design (os mesmos nomes em todas as telas) ----------
export const design = {
  fonts: [
    ['cormorant', 'Cormorant Garamond', 'clássica'], ['playfair', 'Playfair Display', 'elegante'], ['bodoni', 'Bodoni Moda', 'sofisticada'],
    ['dmserif', 'DM Serif Display', 'marcante'], ['fraunces', 'Fraunces', 'serifa moderna'], ['cinzel', 'Cinzel', 'maiúsculas clássicas'],
    ['abril', 'Abril Fatface', 'pôster'], ['italiana', 'Italiana', 'leve'], ['greatvibes', 'Great Vibes', 'cursiva'],
    ['pinyon', 'Pinyon Script', 'caligrafia'], ['caveat', 'Caveat', 'manuscrita'], ['bricolage', 'Bricolage Grotesque', 'divertida'],
    ['syne', 'Syne', 'moderna'], ['unbounded', 'Unbounded', 'futurista'], ['josefin', 'Josefin Sans', 'geométrica'], ['jakarta', 'Plus Jakarta Sans', 'neutra']
  ].map((x) => ({ key: x[0], label: x[1], desc: x[2] })),
  layouts: [
    ['centro', 'Centralizado'], ['foto-topo', 'Foto no topo'], ['foto-fundo', 'Foto de fundo'], ['moldura', 'Moldura'], ['fina', 'Moldura fina'],
    ['dividido', 'Dividido'], ['editorial', 'Editorial'], ['arco', 'Arco'], ['polaroid', 'Polaroid'],
    ['revista', 'Capa de revista'], ['minimal', 'Minimalista'], ['botanico', 'Botânico'], ['deco', 'Art déco'], ['aurora', 'Aurora'], ['colagem', 'Colagem']
  ].map((x) => ({ key: x[0], label: x[1] })),
  anims: [
    ['envelope', 'Carta', 'O envelope abre e o cartão sobe', 'M3 7l9 6 9-6M3 7h18v12H3z'],
    ['cortina', 'Cortina', 'Cortinas se abrem para os lados', 'M3 3h18M5 3v18c3-4 4-10 4-18M19 3v18c-3-4-4-10-4-18'],
    ['portas', 'Portas', 'Portas duplas se abrem em 3D', 'M4 21V3h16v18M12 3v18M9.5 12h.01M14.5 12h.01'],
    ['lacre', 'Lacre de cera', 'O selo se rompe e o papel se abre', 'M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM9 12l-2 9 5-3 5 3-2-9'],
    ['presente', 'Presente', 'O laço se desfaz e a tampa sobe', 'M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9c-2-4-6-4-6-1s6 1 6 1Zm0 0c2-4 6-4 6-1s-6 1-6 1Z'],
    ['livro', 'Livro', 'A capa vira como um livro', 'M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z'],
    ['iris', 'Íris', 'Um círculo se fecha e revela o convite', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'],
    ['neblina', 'Neblina', 'O véu se dissipa e o convite ganha foco', 'M3 8h12M6 12h15M3 16h12M8 20h10'],
    ['dobradura', 'Carta dobrada', 'O papel se desdobra em três partes', 'M4 3h16v6H4zM4 9l16 6M4 15h16v6H4z'],
    ['ingresso', 'Ingresso', 'O canhoto se destaca como num ingresso', 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM15 7v10'],
    ['raspadinha', 'Raspadinha', 'O convidado raspa para descobrir', 'M4 4h16v16H4zM8 15l3-3M11 16l5-5M7 11l3-3'],
    ['confete', 'Explosão de confete', 'Confetes estouram e o convite aparece', 'M5 19l4-11 7 7zM14 4v2M19 9h2M17 6l1.5-1.5M12 2l.5 1'],
    ['baloes', 'Balões', 'Balões sobem e levam a capa', 'M9 3a5 5 0 0 0-5 5c0 4 5 7 5 7s5-3 5-7a5 5 0 0 0-5-5ZM9 15v6M17 6a3 3 0 0 0-3 3c0 2.5 3 4.5 3 4.5s3-2 3-4.5a3 3 0 0 0-3-3Z'],
    ['petalas', 'Chuva de pétalas', 'Pétalas caem e o convite surge', 'M12 3c3 3 3 7 0 10-3-3-3-7 0-10ZM5 14c4-1 7 1 7 5-4 1-7-1-7-5ZM19 14c-4-1-7 1-7 5 4 1 7-1 7-5Z'],
    ['persiana', 'Persianas', 'Lâminas giram e deixam o convite passar', 'M3 4h18M3 8h18M3 12h18M3 16h18M3 20h18'],
    ['polaroid', 'Foto revelada', 'Uma foto instantânea se revela aos poucos', 'M5 3h14v18H5zM7 5h10v10H7z'],
    ['monograma', 'Monograma', 'Mergulho nas iniciais do evento', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8 15V9l4 4 4-4v6'],
    ['nenhuma', 'Sem abertura', 'O convite já aparece aberto', 'M5 5l14 14M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z']
  ].map((x) => ({ key: x[0], label: x[1], desc: x[2], icon: x[3] })),
  fx: [
    ['nenhum', 'Nenhum'], ['brilhos', 'Brilhos dourados'], ['petalas', 'Pétalas caindo'], ['confete', 'Confete'], ['bolhas', 'Bolhas'],
    ['neve', 'Neve'], ['coracoes', 'Corações'], ['estrelas', 'Céu estrelado']
  ].map((x) => ({ key: x[0], label: x[1] })),
  pageFx: [
    ['suave', 'Surgir suavemente'], ['deslizar', 'Deslizar para o lado'], ['zoom', 'Aproximar'], ['virar', 'Virar a página'], ['subir', 'Subir']
  ].map((x) => ({ key: x[0], label: x[1] })),
  blockAnims: [
    ['nenhuma', 'Nenhuma'], ['surgir', 'Surgir suavemente'], ['deslizar', 'Deslizar de baixo'], ['zoom', 'Aproximar (zoom)'],
    ['lateral', 'Entrar pela lateral'], ['desfoque', 'Sair do desfoque'], ['girar', 'Girar de leve'], ['quicar', 'Quicar'], ['maquina', 'Máquina de escrever']
  ].map((x) => ({ key: x[0], label: x[1] })),
  ornaments: (() => {
    const dots = [40, 56, 72, 88, 104, 136, 152, 168, 184, 200].map((x) => 'M' + (x - 2) + ' 15a2 2 0 1 0 4 0a2 2 0 1 0 -4 0').join('') + 'M116 15a4 4 0 1 0 8 0a4 4 0 1 0 -8 0';
    return [
      ['floral', 'Laços', 'M20 15H92M148 15H220M92 15c8-10 18-10 28 0M120 15c10-10 20-10 28 0M92 15c8 10 18 10 28 0M120 15c10 10 20 10 28 0', 'M116 15a4 4 0 1 0 8 0a4 4 0 1 0 -8 0'],
      ['losango', 'Losango', 'M10 15H100M140 15H230', 'M120 5l10 10-10 10-10-10z'],
      ['folhas', 'Folhas', 'M24 15H216', 'M120 15c-8-9-20-10-28-4 8 7 20 8 28 4ZM120 15c8-9 20-10 28-4-8 7-20 8-28 4ZM62 15c-5-6-12-6-17-3 5 4 12 5 17 3ZM178 15c5-6 12-6 17-3-5 4-12 5-17 3Z'],
      ['deco', 'Art déco', 'M10 15H84M156 15H230M84 9v12M156 9v12M94 15l26-12 26 12-26 12z', 'M120 9l6 6-6 6-6-6z'],
      ['coracao', 'Coração', 'M20 15H98M142 15H220', 'M120 26c-9-6-14-10-14-15a6 6 0 0 1 14-3 6 6 0 0 1 14 3c0 5-5 9-14 15Z'],
      ['estrelas', 'Estrelas', 'M30 15H92M148 15H210', 'M120 2l3 10 10 3-10 3-3 10-3-10-10-3 10-3zM103 11l1.5 3 3 1-3 1.5-1.5 3-1.5-3-3-1.5 3-1zM137 11l1.5 3 3 1-3 1.5-1.5 3-1.5-3-3-1.5 3-1z'],
      ['ondas', 'Ondas', 'M10 15c10-8 20-8 30 0s20 8 30 0 20-8 30 0 20 8 30 0 20-8 30 0 20 8 30 0 20-8 30 0', ''],
      ['pontos', 'Pontilhado', '', dots]
    ].map((x) => ({ key: x[0], label: x[1], d: x[2], f: x[3] }));
  })(),
  label(list, key) { const f = (design[list] || []).find((x) => x.key === key); return f ? f.label : ''; }
};

// ---------- Fotos: enquadramento, giro e filtros (não destrutivo) ----------
// A foto original nunca é alterada: as edições ficam salvas junto do bloco e
// são aplicadas na exibição. Proporção do quadro = largura / altura.
const LAYOUT_RATIOS = {
  centro: 350 / 200, 'foto-topo': 390 / 240, 'foto-fundo': 390 / 320, moldura: 312 / 190, fina: 314 / 190,
  dividido: 328 / 200, editorial: 350 / 190, arco: 252 / 230, polaroid: 257 / 194,
  revista: 350 / 300, minimal: 350 / 220, botanico: 259 / 300, deco: 301 / 220, aurora: 350 / 220, colagem: 271 / 199
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
// faixa de foto do bloco de mapa (foto do local): largura padrão do bloco / 120 px
export const PLACE_RATIO = 2.6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// tamanho da foto no quadro: abaixo de 1 a foto fica menor que o quadro (sobra borda na cor da área de foto)
export const ZOOM_MIN = 0.5, ZOOM_MAX = 4;
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
  const k = Math.max(Wp / a, Hp) * (1.02 + num(e.blur, 0) * 0.01) * clamp(num(e.zoom, 1), ZOOM_MIN, ZOOM_MAX);
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


// Formas do quadro: [chave, nome, cantos ou recorte, proporção quando o formato é o do layout]
const HEART = 'url(data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 92"><path d="M50 90C22 70 2 52 2 28 2 13 14 2 28 2c9 0 17 5 22 13C55 7 63 2 72 2c14 0 26 11 26 26 0 24-20 42-48 62Z"/></svg>') + ')';
const SHAPES = [
  ['tema', 'Padrão do layout', null, 0],
  ['reto', 'Retângulo', 'r:0', 0],
  ['arredondado', 'Cantos arredondados', 'r:22px', 0],
  ['circulo', 'Círculo', 'r:50%', 1],
  ['oval', 'Oval', 'r:50%', 0.8],
  ['arco', 'Arco', 'r:999px 999px 0 0', 0.82],
  ['blob', 'Orgânica', 'r:62% 38% 46% 54% / 45% 55% 45% 55%', 1],
  ['coracao', 'Coração', 'm:' + HEART, 1.08],
  ['losango', 'Losango', 'c:polygon(50% 0, 100% 50%, 50% 100%, 0 50%)', 1],
  ['hexagono', 'Hexágono', 'c:polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%)', 1.12],
  ['rasgado', 'Papel rasgado', 'c:polygon(0 3%, 8% 0, 17% 2.5%, 26% 0.5%, 36% 3%, 46% 0, 57% 2.5%, 67% 0.5%, 78% 3%, 88% 0.5%, 100% 2.5%, 100% 97%, 91% 100%, 81% 97.5%, 70% 99.5%, 60% 97%, 49% 100%, 39% 97.5%, 28% 99.5%, 18% 97%, 8% 99.5%, 0 97%)', 0]
];
const FRAMES = [['tema', 'Padrão do layout'], ['nenhuma', 'Sem moldura'], ['polaroid', 'Polaroid'], ['fita', 'Fita adesiva'], ['sombra', 'Sombra suave'], ['contorno', 'Contorno deslocado'], ['dupla', 'Filete duplo']];
const MOTIONS = [['nenhum', 'Parada'], ['kenburns', 'Zoom lento (cinema)'], ['flutuar', 'Flutuar'], ['respirar', 'Respirar']];

function photoLook(b, T, idx) {
  b = b || {}; T = T || {};
  const L = T.layout || 'centro';
  const shapeKey = SHAPES.some((x) => x[0] === b.shape) ? b.shape : 'tema';
  let frameKey = FRAMES.some((x) => x[0] === b.pframe) ? b.pframe : 'tema';
  const byTheme = shapeKey === 'tema' && frameKey === 'tema';
  // colagem: fotos tortas, alternando o giro, com fita adesiva
  if (frameKey === 'tema' && L === 'colagem') frameKey = 'fita';
  const tilt = L === 'colagem' ? ((idx || 0) % 2 ? 'rotate(2.4deg)' : 'rotate(-2.2deg)') : T.photoRot;
  const sh = SHAPES.find((x) => x[0] === shapeKey);
  let radius = T.photoR || '0', clip = T.photoClip || 'none', mask = '';
  if (sh && sh[2]) {
    const kind = sh[2].slice(0, 2), v = sh[2].slice(2);
    radius = kind === 'r:' ? v : '0'; clip = kind === 'c:' ? v : 'none'; mask = kind === 'm:' ? v : '';
  }
  const outer = ['position: relative', 'box-sizing: border-box'];
  const inner = ['position: relative', 'display: flex', 'flex-direction: column', 'align-items: center', 'justify-content: center', 'gap: 6px', 'box-sizing: border-box', 'overflow: hidden', 'background: ' + (T.ph || '#2B4538'), 'border-radius: ' + radius];
  if (clip !== 'none') inner.push('clip-path: ' + clip);
  if (mask) inner.push('-webkit-mask-image: ' + mask, 'mask-image: ' + mask, '-webkit-mask-size: 100% 100%', 'mask-size: 100% 100%');
  let tape = false, polaroid = false;
  if (byTheme || frameKey === 'tema') {
    outer.push('width: ' + (T.photoW || '100%'), 'margin: ' + (T.photoM || '0'), 'transform: ' + (tilt || 'none'));
    if (T.photoBorder && T.photoBorder !== '0') inner.push('border: ' + T.photoBorder);
    if (T.photoShadow && T.photoShadow !== 'none') outer.push('filter: drop-shadow(' + T.photoShadow + ')');
  } else {
    outer.push('width: 100%', 'margin: 0');
    if (frameKey === 'polaroid') { polaroid = true; outer.push('padding: 10px 10px 44px', 'background: #FFFFFF', 'box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22)', 'transform: rotate(' + ((idx || 0) % 2 ? '2deg' : '-2deg') + ')'); }
    else if (frameKey === 'fita') { tape = true; outer.push('padding: 7px', 'background: #FFFFFF', 'box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18)', 'transform: rotate(' + ((idx || 0) % 2 ? '1.6deg' : '-1.8deg') + ')'); }
    else if (frameKey === 'sombra') outer.push('filter: drop-shadow(0 16px 26px rgba(0, 0, 0, 0.32))');
    else if (frameKey === 'contorno') outer.push('padding: 0 10px 10px 0');
    else if (frameKey === 'dupla') outer.push('padding: 5px', 'border: 4px double ' + (T.accent || '#CDAE6B'));
  }
  if (frameKey === 'fita' && byTheme) { tape = true; outer.push('padding: 7px', 'background: #FFFFFF'); }
  const offset = frameKey === 'contorno' && !byTheme;
  return {
    outer: outer.join('; '), inner: inner.join('; '),
    tape, polaroid, offset,
    offsetStyle: offset ? 'position: absolute; left: 10px; top: 10px; right: 0; bottom: 0; border: 1.5px solid ' + (T.accent || '#CDAE6B') + '; border-radius: ' + radius + (clip !== 'none' ? '; clip-path: ' + clip : '') : '',
    motion: ['kenburns', 'flutuar', 'respirar'].indexOf(b.motion) !== -1 ? 'pm-' + b.motion : '',
    caption: !!b.caption && !!String(b.label || '').trim(),
    shape: shapeKey, frame: frameKey
  };
}

export const photo = {
  formats: FORMATS.map((f) => ({ key: f[0], label: f[1] })),
  filters: FILTERS.map((f) => ({ key: f[0], label: f[1], css: f[2] })),
  pageRatio: PAGE_RATIO,
  zoomMin: ZOOM_MIN, zoomMax: ZOOM_MAX,
  placeRatio: PLACE_RATIO,
  // proporção (largura/altura) do espaço da foto do local num bloco de mapa
  placeRatioOf(b) { const r = b && Number(b.photoRatio); return r && isFinite(r) ? clamp(r, 0.6, 6) : PLACE_RATIO; },
  // proporção do quadro de um bloco de foto, conforme o formato escolhido, a forma e o layout do tema
  ratio(edit, layout, shape) {
    const fmtKey = edit && edit.frame;
    const f = FORMATS.find((x) => x[0] === fmtKey);
    if (f && f[2]) return f[2];
    const sh = SHAPES.find((x) => x[0] === shape);
    return sh && sh[3] ? sh[3] : (LAYOUT_RATIOS[layout] || LAYOUT_RATIOS.centro);
  },
  shapes: SHAPES.map((x) => ({ key: x[0], label: x[1] })),
  frames: FRAMES.map((x) => ({ key: x[0], label: x[1] })),
  motions: MOTIONS.map((x) => ({ key: x[0], label: x[1] })),
  // aparência do quadro de um bloco de foto: forma, moldura, legenda e movimento
  look(b, T, idx) { return photoLook(b, T, idx); },
  filterCss,
  style: photoStyle,
  // desloca a foto ao arrastar (dx, dy em frações da largura do quadro)
  pan(e, r, dx, dy) {
    if (!num(e.ar, 0)) return e;
    const g = photoGeom(e, r);
    const lx = dx * g.ct + dy * g.st, ly = -dx * g.st + dy * g.ct;
    const out = Object.assign({}, e);
    // com a foto menor que o quadro a folga é negativa: a foto passeia dentro do quadro
    if (Math.abs(g.slackX) > 1e-6) out.px = clamp(num(e.px, 0) + lx / g.slackX, -1, 1);
    if (Math.abs(g.slackY) > 1e-6) out.py = clamp(num(e.py, 0) + ly / g.slackY, -1, 1);
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
const FONT_BASE = { texto: 15, orientacoes: 14, botao: 15, mapa: 16, contagem: 30, rsvp: 15, programacao: 16, citacao: 22 };
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

// QR code do link do convite: caminho SVG (para mostrar na tela) e PNG (para baixar).
export function qr(text) {
  const q = qrcode(0, 'M');
  q.addData(String(text || ''));
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + 4) + ' ' + (r + 4) + 'h1v1h-1z';
  return { size: n + 8, path: d };
}
export function qrPng(text, px) {
  const m = qr(text);
  const scale = Math.max(4, Math.floor((px || 1024) / m.size));
  const c = document.createElement('canvas');
  c.width = c.height = m.size * scale;
  const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#000000';
  g.scale(scale, scale);
  g.fill(new Path2D(m.path));
  return c.toDataURL('image/png');
}

// Textos de exemplo que o convite traz ao nascer (mesma regra do servidor)
const PLACEHOLDER = [/\[[^\]]*\]/, /\{prazo\}/i, /^NOME & NOME$/i, /DD \. MM \. AAAA/, /^Escreva aqui/, /^Título do evento$/, /^Nome do local$/, /^Data e horário do evento$/, /^Outras orientações$/m];
export function placeholderIn(text, hasDeadline) {
  let t = String(text || '');
  if (hasDeadline) t = t.replace(/\[data limite\]|\{prazo\}/gi, '');
  return PLACEHOLDER.some((re) => re.test(t));
}

// ---------- cores a partir de uma foto ----------
const hx = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const lum = (r, g, b) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => { const x = lum(...a), y = lum(...b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const sat = (c) => { const mx = Math.max(...c), mn = Math.min(...c); return mx === 0 ? 0 : (mx - mn) / mx; };

// Sugere fundo, texto, destaque e demais cores do tema a partir das cores mais presentes na foto.
export async function paletteFromImage(file) {
  const bmp = await createImageBitmap(file);
  const W = 72, H = Math.max(1, Math.round((72 * bmp.height) / bmp.width));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, W, H); bmp.close && bmp.close();
  const px = g.getImageData(0, 0, W, H).data;
  const buckets = {};
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const k = (px[i] >> 4) + ',' + (px[i + 1] >> 4) + ',' + (px[i + 2] >> 4);
    const b = buckets[k] || (buckets[k] = { n: 0, r: 0, g: 0, b: 0 });
    b.n++; b.r += px[i]; b.g += px[i + 1]; b.b += px[i + 2];
  }
  const cols = Object.values(buckets).map((b) => ({ n: b.n, c: [b.r / b.n, b.g / b.n, b.b / b.n] })).sort((a, b) => b.n - a.n);
  if (!cols.length) throw new Error('Não foi possível ler as cores dessa foto.');
  // fundo: a cor mais presente, levada para um tom bem claro ou bem escuro (o texto precisa aparecer)
  let bg = cols[0].c;
  const dark = lum(...bg) < 0.35;
  bg = dark ? mix(bg, [0, 0, 0], 0.45) : mix(bg, [255, 255, 255], 0.55);
  // destaque: a cor mais viva entre as frequentes, com contraste suficiente com o fundo
  const cands = cols.slice(0, 24).map((x) => x.c).filter((x) => sat(x) > 0.25);
  let accent = cands.find((x) => contrast(x, bg) >= 3) || cands[0] || (dark ? [227, 211, 181] : [91, 63, 214]);
  if (contrast(accent, bg) < 3) accent = dark ? mix(accent, [255, 255, 255], 0.5) : mix(accent, [0, 0, 0], 0.45);
  const fg = dark ? mix(bg, [255, 255, 255], 0.92) : mix(bg, [0, 0, 0], 0.85);
  const btnFg = contrast([255, 255, 255], accent) >= contrast([20, 20, 20], accent) ? [255, 255, 255] : mix(bg, [0, 0, 0], 0.6);
  return {
    bg: hx(...bg), fg: hx(...fg), accent: hx(...accent), btnFg: hx(...btnFg),
    paper: hx(...mix(accent, bg, 0.55)), ph: hx(...mix(bg, fg, 0.14))
  };
}

export const api = {
  paletteFromImage,
  placeholderIn,
  qr,
  qrPng,
  fmt,
  themeTokens,
  design,
  FONTS,
  fontKeyOf,
  BODY_FONTS,
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
  login: (username, password) => call('POST', '/api/auth?action=login', { username, password }),
  // usuário logado (do último /api/auth?action=me)
  user: () => (config && config.user) || null,
  isAdmin: () => !!(config && config.admin),
  // conta de cliente: só edita os convites que estão nela e acompanha as respostas
  isClient: () => !!(config && config.client),

  // link de acesso do cliente
  accessInfo: (token) => call('POST', '/api/auth?action=access', { token }),
  setPasswordByLink: (token, password) => call('POST', '/api/auth?action=setpw', { token, password }),
  giveClientAccess: (data) => call('POST', '/api/users?action=client', data),
  newAccessLink: (id) => call('POST', '/api/users?action=link&id=' + enc(id), {}),
  transferInvite: (id, ownerId) => call('PUT', '/api/invites?action=transfer&id=' + enc(id), { ownerId }),

  listUsers: () => call('GET', '/api/users'),
  createUser: (data) => call('POST', '/api/users', data),
  saveUser: (id, data) => call('PUT', '/api/users?id=' + enc(id), data),

  // cópias de segurança (só administradores)
  listBackups: () => call('GET', '/api/backup'),
  runBackup: () => call('POST', '/api/backup?action=run', {}),
  restoreBackup: (src) => call('POST', '/api/backup?action=restore', src),
  backupUrl: (name) => '/api/backup?action=download&name=' + enc(name),
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
    // limites por tipo (economizam espaço e transferência do armazenamento) e fotos reduzidas antes do envio
    file = await prepareMedia(file);
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
  // (link curto: /c/<nome-do-link>, sem os códigos de cor)
  guestLink(id, theme, guestCode, slug) {
    return window.location.origin + '/c/' + encodeURIComponent(slug || id) + (guestCode ? '/' + guestCode : '');
  },
  // o mesmo link sem "https://" (para mostrar na tela)
  shortLink(link) { return String(link || '').replace(/^https?:\/\//, ''); },
  setSlug: (id, slug) => call('PUT', '/api/invites?id=' + enc(id) + '&action=slug', { slug }),
  slugify(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '');
  },
  local: {
    get(k) { try { return JSON.parse(window.localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  }
};
