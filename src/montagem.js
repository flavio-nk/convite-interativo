// Montagem automática do convite: transforma os dados do evento nas páginas do convite.
// Usada pelo editor (convite criado em "Novo convite") e pelo servidor, que monta sozinho
// as versões iniciais dos pedidos feitos pelos clientes. Não depende do navegador.

// Tipos de evento: rótulos, chamada da abertura, frase da capa e título interno do convite
export const KINDS = {
  casamento: { label: 'Casamento', kicker: 'Casamento', phrase: 'convidam para a celebração do seu casamento', names: 'Nomes do casal', ph: 'Ex.: Amanda & Flávio', title: (n) => 'Casamento ' + n },
  aniversario: { label: 'Aniversário', kicker: 'Aniversário', phrase: 'Venha comemorar comigo!', names: 'Nome do aniversariante', ph: 'Ex.: Carla 40 anos', title: (n) => 'Aniversário de ' + n },
  infantil: { label: 'Festa infantil', kicker: 'Festa infantil', phrase: 'Venha brincar e comemorar com a gente!', names: 'Nome da criança', ph: 'Ex.: Lara faz 6!', title: (n) => 'Festa de ' + n },
  cha: { label: 'Chá de bebê', kicker: 'Chá de bebê', phrase: 'Venha celebrar a chegada do nosso bebê!', names: 'Nome do bebê (ou dos pais)', ph: 'Ex.: Theo', title: (n) => 'Chá de bebê de ' + n },
  formatura: { label: 'Formatura', kicker: 'Formatura', phrase: 'Celebre essa conquista com a gente!', names: 'Nome da turma ou do formando', ph: 'Ex.: Medicina 2027', title: (n) => 'Formatura ' + n },
  corporativo: { label: 'Corporativo', kicker: 'Evento', phrase: 'Contamos com a sua presença.', names: 'Nome do evento', ph: 'Ex.: Encontro de parceiros', title: (n) => n },
  religioso: { label: 'Religioso', kicker: 'Celebração', phrase: 'Participe deste momento especial conosco.', names: 'Nome do evento ou da pessoa', ph: 'Ex.: Batizado da Alice', title: (n) => n },
  outro: { label: 'Outro', kicker: 'Convite', phrase: '', names: 'Nome do convite', ph: 'Ex.: Festa de fim de ano', title: (n) => n }
};

const WDL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MOL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const pad = (n) => (n < 10 ? '0' : '') + n;
// Os eventos são no Brasil (sem horário de verão desde 2019): 19h no formulário = 19h -03:00
const BR_OFFSET = '-03:00';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "2027-04-17" + "16:00" → data ISO do evento (horário de Brasília)
export function eventDateOf(day, time) {
  if (!DAY.test(String(day || ''))) return null;
  const t = TIME.test(String(time || '')) ? time : '19:00';
  const d = new Date(day + 'T' + t + ':00' + BR_OFFSET);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// "Sábado, 17 de abril de 2027\nÀs 16h" (mesmo texto que o editor escreve)
export function whenText(day, time) {
  const m = String(day || '').match(DAY);
  if (!m) return '';
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  const wd = new Date(Date.UTC(y, mo, d)).getUTCDay();
  const tm = String(time || '').match(TIME);
  const h = tm ? (+tm[1]) + 'h' + (+tm[2] ? tm[2] : '') : '';
  return WDL[wd] + ', ' + d + ' de ' + MOL[mo] + ' de ' + y + (h ? '\nÀs ' + h : '');
}

// "05 . 06 . 2027" (capa do tema Save the Date)
export function dotsOf(day) {
  const m = String(day || '').match(DAY);
  return m ? m[3] + ' . ' + m[2] + ' . ' + m[1] : '';
}

// prazo de resposta sugerido: 30 dias antes do evento, às 23h59 (só se ainda der tempo)
export function deadlineOf(day, now) {
  const m = String(day || '').match(DAY);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] - 30) + (23 * 60 + 59) * 60000 + 3 * 3600000);
  return d.getTime() > (now || Date.now()) + 2 * 86400000 ? d.toISOString() : null;
}

// Link do local (perfil no Instagram, site…): aceita "@perfil" (Instagram), endereços sem
// "https://" (www.espaco.com.br, instagram.com/espaco) e http(s). Devolve '' se não for um link.
export function placeLink(raw) {
  let u = String(raw || '').trim();
  if (!u) return '';
  const handle = u.match(/^@([A-Za-z0-9._]{1,30})$/);
  if (handle) return 'https://instagram.com/' + handle[1];
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u) && /^[\w-]+(\.[\w-]+)+(\/|$|\?|#)/.test(u)) u = 'https://' + u;
  return /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(u) && u.length <= 300 ? u : '';
}

// texto do selo sobre a foto do local, conforme o tipo de link
export function placeLinkLabel(url) {
  const host = (String(url).match(/^https?:\/\/([^/?#]+)/i) || [])[1] || '';
  const h = host.toLowerCase().replace(/^www\./, '');
  if (/(^|\.)instagram\.com$/.test(h) || h === 'instagr.am') return 'Instagram';
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(h)) return 'Facebook';
  if (/(^|\.)tiktok\.com$/.test(h)) return 'TikTok';
  if (/(^|\.)(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl)$/.test(h)) return 'Ver no Google';
  return 'Ver site';
}

export function block(id, type, extra) {
  return Object.assign({ id, type, text: '', label: '', src: 'upload', anim: 'nenhuma' }, extra);
}

const lines = (v) => String(v || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const photo = (p) => (p && p.url ? { fileUrl: p.url, fileName: p.name || '' } : {});

// Páginas do convite.
// it.setup: dados do evento. Os campos de pedido (full: true) trazem fotos e textos prontos, e então
// os blocos que ficariam com texto de exemplo (galeria vazia, orientações genéricas) não entram.
// opts: { b (fábrica de blocos), when, deadline, dots }
export function pages(it, opts) {
  it = it || {};
  opts = opts || {};
  const b = opts.b || block;
  const su = it.setup || {};
  const full = !!su.full;
  const kind = su.kind || '';
  const K = KINDS[kind] || {};
  const names = String(su.names || '').trim();
  const fotos = su.photos || {};
  const gallery = (fotos.gallery || []).filter((p) => p && p.url);
  const when = opts.when || 'Data e horário do evento';
  const deadline = opts.deadline || null;

  const capa = { id: 'capa', name: 'Capa', blocks: [
    b('c1', 'foto', Object.assign({ label: 'Foto principal', anim: 'surgir' }, photo(fotos.main))),
    b('c2', 'titulo', { text: names || it.sample || 'Título do evento', anim: 'deslizar' }),
    b('c3', 'texto', { text: String(su.phrase || '').trim() || K.phrase || (names ? 'Você está convidado!' : 'Escreva aqui a frase do convite') }),
    b('c4', 'contagem', {}),
    b('c5', 'botao', { text: 'Ver detalhes' })
  ] };

  // orientações: traje e outras informações, uma por linha
  const orient = (su.dress ? ['Traje: ' + String(su.dress).trim()] : []).concat(lines(su.notes));
  const gifts = String(su.gifts || '').trim();
  const det = [
    b('d1', 'titulo', { text: 'Quando e onde' }),
    b('d2', 'texto', { text: when }),
    b('d3', 'mapa', Object.assign({ text: String(su.place || '').trim() || 'Nome do local', address: String(su.address || '').trim() },
      placeLink(su.placeUrl) ? { placeUrl: placeLink(su.placeUrl) } : {},
      fotos.venue && fotos.venue.url ? { photoUrl: fotos.venue.url, photoName: fotos.venue.name || '' } : {}))
  ];
  if (!full) det.push(b('d4', 'orientacoes', { text: 'Traje\nEstacionamento\nOutras orientações' }));
  else if (orient.length) det.push(b('d4', 'orientacoes', { text: orient.join('\n') }));
  det.push(gifts ? b('d5', 'botao', { text: 'Lista de presentes', action: 'link', dest: gifts }) : b('d5', 'botao', { text: 'Saiba mais' }));
  const out = [capa, { id: 'detalhes', name: 'Detalhes', blocks: det }];

  const prog = lines(su.program);
  if (prog.length) {
    out.push({ id: 'programacao', name: 'Programação', blocks: [
      b('r1', 'titulo', { text: 'Programação' }),
      b('r2', 'programacao', { text: prog.join('\n') })
    ] });
  }

  if (!full) {
    out.push({ id: 'galeria', name: 'Galeria', blocks: [
      b('g1', 'titulo', { text: 'Galeria' }),
      b('g2', 'foto', { label: 'Foto 1' }),
      b('g3', 'foto', { label: 'Foto 2' })
    ] });
  } else if (gallery.length) {
    out.push({ id: 'galeria', name: 'Galeria', blocks: [
      b('g1', 'titulo', { text: 'Galeria' }),
      b('g2', 'galeria', { gstyle: gallery.length >= 4 ? 'mosaico' : 'carrossel', items: gallery.map((p) => ({ url: p.url, fileName: p.name || '' })) })
    ] });
  }

  if (su.rsvp !== false) {
    out.push({ id: 'presenca', name: 'Presença', blocks: [
      b('p1', 'titulo', { text: 'Confirme sua presença' }),
      b('p2', 'texto', { text: 'Responda até {prazo}' }),
      b('p3', 'rsvp', deadline ? { deadline } : {})
    ] });
  }

  if (it.starter === 'savedate') {
    // Capa no estilo "Save the Date": foto do casal como fundo da página, letra cursiva, nomes em versalete e data
    // posições fixas (tela de 390 px): texto no alto, deixando o casal livre na foto
    out[0] = { id: 'capa', name: 'Capa', free: true, bg: { url: (fotos.main && fotos.main.url) || '', dim: 40 }, blocks: [
      b('c1', 'titulo', { text: 'Save the Date', anim: 'surgir', fontSize: 54, pos: { x: 20, y: 44, w: 350 } }),
      b('c2', 'texto', { text: names ? names.toUpperCase() : 'NOME & NOME', anim: 'surgir', fontSize: 24, pos: { x: 20, y: 124, w: 350 } }),
      b('c3', 'texto', { text: '──────  ◆  ──────', fontSize: 12, pos: { x: 95, y: 164, w: 200 } }),
      b('c4', 'texto', { text: opts.dots || 'DD . MM . AAAA', anim: 'deslizar', fontSize: 30, pos: { x: 20, y: 186, w: 350 } }),
      b('c5', 'botao', { text: 'Ver detalhes', pos: { x: 115, y: 690, w: 160 } })
    ] };
    if (!out[0].bg.url) out[0].bg = { url: '', dim: 40 };
  }
  return out;
}

const MUSIC = ['valsa', 'caixinha', 'festa'];

// Convite completo a partir de um pedido de cliente (já validado) e de um tema do catálogo (formato salvo).
export function fromOrder(order, theme, now) {
  const kind = KINDS[order.kind] ? order.kind : 'outro';
  const K = KINDS[kind];
  const names = String(order.names || '').trim();
  const th = Object.assign({}, theme);
  if (order.palette) Object.assign(th, order.palette);
  const setup = {
    kind, names, place: order.place || '', address: order.address || '', placeUrl: order.placeUrl || '', rsvp: order.rsvp !== false, full: true,
    phrase: order.phrase || '', dress: order.dress || '', notes: order.notes || '', program: order.program || '', gifts: order.gifts || '',
    photos: order.photos || {}
  };
  const eventDate = eventDateOf(order.day, order.time);
  const main = order.photos && order.photos.main;
  return {
    title: names ? K.title(names) : 'Pedido de ' + (order.contact && order.contact.name ? order.contact.name : 'cliente'),
    kicker: th.openKicker || K.kicker || th.kicker || 'Convite',
    coverTitle: names || 'Título do evento',
    status: 'rascunho',
    theme: th, themeBase: th, eventDate, setup,
    opening: Object.assign({ headline: 'Você recebeu um convite', title: '', subtitle: '', hint: '', trigger: 'toque', initials: '' }, main && main.url ? { photoUrl: main.url } : {}),
    music: { kind: MUSIC.includes(order.music) ? 'biblioteca' : 'nenhuma', preset: MUSIC.includes(order.music) ? order.music : 'valsa', fileUrl: '', fileName: '', link: '', volume: 70, loop: true },
    pages: pages({ setup, sample: names, starter: th.starter, eventDate }, { when: whenText(order.day, order.time), deadline: setup.rsvp ? deadlineOf(order.day, now) : null, dots: dotsOf(order.day) })
  };
}
