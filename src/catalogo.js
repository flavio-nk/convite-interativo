// Catálogo dos temas prontos. Usado pela galeria de temas, pelo formulário de pedido e pelo
// servidor, que monta os convites dos pedidos sem passar pelo navegador.
import { fontKeyOf } from './fontes.js';

function build() {
  const CG = "'Cormorant Garamond', Georgia, serif", PF = "'Playfair Display', Georgia, serif", BM = "'Bodoni Moda', Georgia, serif";
  const GV = "'Great Vibes', cursive", IT = "'Italiana', serif", DM = "'DM Serif Display', Georgia, serif";
  const BG = "'Bricolage Grotesque', sans-serif", SY = "'Syne', sans-serif", JO = "'Josefin Sans', sans-serif";
  const CV = "'Caveat', cursive", PJ = "'Plus Jakarta Sans', sans-serif";
  const CZ = "'Cinzel', Georgia, serif", PY = "'Pinyon Script', cursive", FR = "'Fraunces', Georgia, serif", AB = "'Abril Fatface', Georgia, serif", UB = "'Unbounded', sans-serif";
  const t = (id, name, cat, desc, bg, fg, accent, paper, ph, btnFg, font, weight, fstyle, layout, anim, radius, kicker, sample, date, ts, custom) =>
    ({ id, name, cat, desc, bg, fg, accent, paper, ph, btnFg, font, weight, fstyle, layout, anim, radius, kicker, sample, date, ts: ts || 1, custom: !!custom });
  return [
    Object.assign(t('savedate', 'Save the Date', 'Casamento', 'Foto do casal de fundo, moldura fina, letra cursiva e nomes em versalete.', '#2A211A', '#FBF8F2', '#E3D3B5', '#3A2E24', '#5A4835', '#2A211A', GV, '400', 'normal', 'fina', 'neblina', '2px', 'Save the Date', 'Ana & Pedro', '05 . 06 . 2027', 1.3), { bodyKey: 'cormorant', starter: 'savedate', openKicker: 'Casamento' }),
    Object.assign(t('botanico', 'Jardim botânico', 'Casamento', 'Ramos de folhas, foto oval e chuva de pétalas ao abrir.', '#F4F1E8', '#2F3B2A', '#6B7F4E', '#E4DCC8', '#D8D3C0', '#FFFFFF', PY, '400', 'normal', 'botanico', 'petalas', '999px', 'Casamento', 'Helena & Rafael', '12 · 09 · 2027', 1.25), { fx: 'petalas', bodyKey: 'cormorant', isNew: true }),
    Object.assign(t('romance', 'Romance', 'Casamento', 'Rosa antigo, letra caligráfica e carta que se desdobra.', '#F7E9E7', '#5A2A35', '#B8566B', '#EFD3D0', '#E7C3C2', '#FFFFFF', PY, '400', 'normal', 'arco', 'dobradura', '999px', 'Casamento', 'Lia & Tomás', '20 · 11 · 2027', 1.25), { fx: 'coracoes', isNew: true }),
    t('jardim', 'Jardim', 'Casamento', 'Verde profundo, dourado e tipografia clássica.', '#1F3329', '#F3EEE4', '#CDAE6B', '#E9E1D0', '#2B4538', '#1F3329', CG, '500', 'normal', 'arco', 'envelope', '999px', 'Casamento', 'Ana & Pedro', '17 · 04 · 2027'),
    t('terracota', 'Terracota', 'Casamento', 'Barro, areia e serifas elegantes, clima rústico.', '#F4E7DC', '#5A2E1F', '#A8482A', '#C9673F', '#E3CBB8', '#FFF6EF', PF, '600', 'normal', 'foto-topo', 'envelope', '999px', 'Casamento', 'Lia & Davi', '22 · 05 · 2027'),
    t('noite', 'Noite estrelada', 'Casamento', 'Azul-noite profundo com detalhes dourados.', '#0F1A3A', '#EDE6D6', '#D8B868', '#16244F', '#1C2B55', '#0F1A3A', BM, '500', 'normal', 'centro', 'cortina', '999px', 'Casamento', 'Clara & Hugo', '09 · 10 · 2027'),
    t('rosa', 'Rosa seco', 'Casamento', 'Rosé suave e letra cursiva romântica.', '#F3E3E1', '#5B2E3A', '#9E4A60', '#E8C9C6', '#E6CBC8', '#FFF5F6', GV, '400', 'normal', 'arco', 'lacre', '999px', 'Casamento', 'Bia & Leo', '14 · 02 · 2027', 1.25),
    t('praia', 'Pé na areia', 'Casamento', 'Turquesa e areia para cerimônias ao ar livre.', '#EAF4F4', '#103C4A', '#1F7C8A', '#F6EFE2', '#BFDCDC', '#FFFFFF', IT, '400', 'normal', 'foto-fundo', 'neblina', '999px', 'Casamento na praia', 'Nina & Rui', '30 · 01 · 2027'),
    Object.assign(t('revista', 'Capa de revista', 'Aniversário', 'Título gigante como capa de revista e convite em forma de ingresso.', '#F5F0EA', '#141414', '#E0342C', '#FFFFFF', '#D9D2C8', '#FFFFFF', AB, '400', 'normal', 'revista', 'ingresso', '0px', 'Aniversário', 'Duda 15 anos', '05 · 09 · 2027', 0.9), { pageFx: 'virar', isNew: true }),
    Object.assign(t('aurora', 'Aurora', 'Aniversário', 'Luzes coloridas em movimento, vidro fosco e céu estrelado.', '#1A1033', '#F6F1FF', '#FF7AC8', '#2A1B52', '#4B2E8C', '#1A1033', UB, '700', 'normal', 'aurora', 'persiana', '999px', 'Aniversário', 'Sofia 18', '22 · 07 · 2027', 0.8), { fx: 'estrelas', pageFx: 'deslizar', isNew: true }),
    Object.assign(t('memorias', 'Memórias', 'Aniversário', 'Colagem de fotos com fita adesiva e foto que se revela ao abrir.', '#F3EBDD', '#3A2A1E', '#C9572F', '#E8D7BC', '#D9C7A8', '#FFFFFF', CV, '700', 'normal', 'colagem', 'polaroid', '6px', 'Aniversário', 'Os 30 da Bia', '14 · 03 · 2027', 1.1), { isNew: true }),
    Object.assign(t('surpresa', 'Festa surpresa', 'Aniversário', 'Explosão de confete ao abrir e letras fortes.', '#2B2D42', '#F8F7FF', '#FFD23F', '#FFD23F', '#3D405B', '#2B2D42', SY, '800', 'normal', 'editorial', 'confete', '999px', 'Festa surpresa', 'Shhh! É surpresa', '18 · 06 · 2027', 0.8), { fx: 'confete', pageFx: 'zoom', isNew: true }),
    t('festa', 'Festa', 'Aniversário', 'Cores vivas e letras grandes para comemorar.', '#C2361F', '#FFF4EE', '#FFD166', '#FFD166', '#A82C18', '#3A1208', BG, '800', 'normal', 'editorial', 'presente', '12px', 'Aniversário', '40 anos da Carla', '12 · 03 · 2027', 0.85),
    t('neon', 'Neon', 'Aniversário', 'Roxo escuro com verde neon para festas à noite.', '#14082B', '#F5F0FF', '#2FE6C8', '#2A1260', '#22124A', '#14082B', SY, '800', 'normal', 'foto-fundo', 'iris', '999px', 'Festa', 'Noite Neon', '27 · 11 · 2026', 0.85),
    t('tropical', 'Tropical', 'Aniversário', 'Verde-folha e laranja vibrante, clima de verão.', '#0E4D3A', '#FFF7E6', '#FF8A3D', '#FF8A3D', '#146149', '#2B1406', BG, '800', 'normal', 'dividido', 'cortina', '999px', 'Aniversário', 'Luau do Rafa', '06 · 02 · 2027', 0.9),
    t('boteco', 'Boteco', 'Aniversário', 'Amarelo e vermelho, descontraído e divertido.', '#F6C744', '#2B1A0E', '#9E2A17', '#9E2A17', '#E8B42C', '#FFF4DE', JO, '700', 'normal', 'polaroid', 'presente', '6px', 'Aniversário', 'Boteco do Beto', '20 · 03 · 2027'),
    t('pop', 'Pop', 'Aniversário', 'Branco com roxo elétrico, moderno e divertido.', '#FFFFFF', '#1D1A2E', '#7A3CF0', '#7A3CF0', '#F1EAFE', '#FFFFFF', BG, '800', 'normal', 'polaroid', 'presente', '16px', 'Aniversário', 'Duda 15', '05 · 09 · 2027'),
    Object.assign(t('baloes', 'Balões', 'Infantil', 'Balões coloridos levam a capa embora; confete o tempo todo.', '#EAF6FF', '#23365C', '#E5484D', '#CFE8FF', '#CFE3F5', '#FFFFFF', BG, '800', 'normal', 'polaroid', 'baloes', '999px', 'Festa infantil', 'Theo faz 5!', '10 · 04 · 2027', 0.85), { fx: 'confete', pageFx: 'zoom', isNew: true }),
    Object.assign(t('revelacao', 'Chá revelação', 'Infantil', 'O convidado raspa o cartão para descobrir; bolhas suaves no fundo.', '#FFF5F7', '#3B3355', '#C2507A', '#FCE4EC', '#F4D9E4', '#FFFFFF', FR, '600', 'italic', 'arco', 'raspadinha', '999px', 'Chá revelação', 'Menino ou menina?', '02 · 05 · 2027', 0.9), { fx: 'bolhas', isNew: true }),
    t('delicado', 'Delicado', 'Infantil', 'Tons suaves para chá de bebê e batizado.', '#EBDDD3', '#4A3328', '#8C5638', '#F7EFE8', '#D9C6B8', '#FFF7F1', CG, '500', 'italic', 'moldura', 'lacre', '999px', 'Chá de bebê', 'Theo está chegando', '15 · 11 · 2026', 0.85),
    t('confete', 'Confete', 'Infantil', 'Divertido e colorido para festas infantis.', '#FFF1D6', '#2A2340', '#C42F3E', '#D93A4A', '#F5DDB0', '#FFFFFF', BG, '800', 'normal', 'polaroid', 'presente', '14px', 'Festa infantil', 'Lara faz 6!', '08 · 05 · 2027'),
    t('aventura', 'Aventura', 'Infantil', 'Verde claro e laranja para pequenos exploradores.', '#DFF2D8', '#1E3B1A', '#B04414', '#4E8A3E', '#C5E5BA', '#FFFFFF', BG, '800', 'normal', 'centro', 'livro', '999px', 'Festa infantil', 'Dino Party do Gui', '11 · 04 · 2027', 0.8),
    t('espacial', 'Espacial', 'Infantil', 'Céu profundo e amarelo estrela.', '#1B1446', '#F2EEFF', '#FFC94D', '#2A2163', '#2A2163', '#1B1446', JO, '700', 'normal', 'arco', 'iris', '999px', 'Festa infantil', 'Missão Lua da Mia', '02 · 07 · 2027', 0.85),
    t('nuvem', 'Nuvem azul', 'Infantil', 'Azul suave e letra manuscrita para chá de bebê.', '#EEF3FA', '#2C3E5C', '#4F6FA5', '#DCE6F4', '#D3DFF0', '#FFFFFF', CV, '700', 'normal', 'moldura', 'neblina', '999px', 'Chá de bebê', 'Bem-vindo, Davi', '16 · 01 · 2027', 1.15),
    Object.assign(t('minimal', 'Minimalista', 'Corporativo', 'Muito respiro, alinhamento à esquerda e serifa moderna.', '#FAFAF7', '#1B1B1B', '#1B1B1B', '#EDEBE6', '#E3E1DC', '#FAFAF7', FR, '600', 'normal', 'minimal', 'neblina', '0px', 'Lançamento', 'Coleção Verão', '18 · 03 · 2027', 0.95), { pageFx: 'subir', isNew: true }),
    t('corporativo', 'Corporativo', 'Corporativo', 'Sóbrio e direto para eventos de empresa.', '#1F3A5F', '#EAF0F7', '#8FBCEB', '#EAF0F7', '#2B4C76', '#10213A', PJ, '800', 'normal', 'dividido', 'portas', '8px', 'Evento', 'Encontro de parceiros', '25 · 02 · 2027', 0.8),
    t('mono', 'Monocromo', 'Corporativo', 'Preto e branco, tipografia forte e editorial.', '#F2F2F0', '#111111', '#111111', '#111111', '#DADAD6', '#F2F2F0', SY, '800', 'normal', 'editorial', 'iris', '0px', 'Lançamento', 'Coleção Outono', '18 · 03 · 2027', 0.85),
    t('tech', 'Tech', 'Corporativo', 'Escuro e azul elétrico para eventos de tecnologia.', '#0B0F14', '#E6EDF3', '#4F8CFF', '#111925', '#18202B', '#0B0F14', SY, '800', 'normal', 'editorial', 'portas', '6px', 'Conferência', 'Dev Summit 27', '14 · 05 · 2027', 0.85),
    t('conferencia', 'Conferência', 'Corporativo', 'Branco limpo com azul-marinho e coral.', '#FFFFFF', '#0F2A44', '#C23E22', '#0F2A44', '#EEF1F5', '#FFFFFF', PJ, '800', 'normal', 'dividido', 'iris', '8px', 'Workshop', 'Inovação em Saúde', '08 · 06 · 2027', 0.85),
    Object.assign(t('gatsby', 'Gatsby', 'Formatura', 'Art déco em preto e dourado, monograma e brilhos.', '#121212', '#F1E6C8', '#C9A24B', '#1C1C1C', '#2A2620', '#121212', CZ, '600', 'normal', 'deco', 'monograma', '0px', 'Baile de gala', 'Noite de Gala', '11 · 12 · 2027', 0.8), { fx: 'brilhos', pageFx: 'zoom', isNew: true }),
    t('classico', 'Clássico', 'Formatura', 'Preto e dourado para formaturas e galas.', '#222026', '#E9E2CF', '#C9A961', '#5A1622', '#34313A', '#222026', CG, '600', 'normal', 'moldura', 'cortina', '2px', 'Formatura', 'Turma 2026', '03 · 10 · 2026'),
    t('bordo', 'Bordô', 'Formatura', 'Vinho e caramelo para galas e jantares.', '#3A0F1C', '#F5E6D8', '#D9A35B', '#5A1A2B', '#521728', '#3A0F1C', PF, '600', 'normal', 'moldura', 'portas', '2px', 'Jantar de gala', 'Baile de Formatura', '11 · 12 · 2026', 0.85),
    t('beca', 'Beca', 'Formatura', 'Azul acadêmico e dourado, sóbrio e solene.', '#0D2B4E', '#F4F1E8', '#C9A961', '#F4F1E8', '#183B63', '#0D2B4E', BM, '600', 'normal', 'centro', 'livro', '2px', 'Formatura', 'Medicina 2027', '17 · 12 · 2027', 0.9),
    t('lavanda', 'Lavanda', 'Religioso', 'Lavanda delicada para batizados.', '#EDE8F5', '#3B2C5A', '#6E51A0', '#DCD1EE', '#DED5EE', '#FFFFFF', CG, '500', 'italic', 'arco', 'lacre', '999px', 'Batizado', 'Batizado da Alice', '07 · 03 · 2027', 0.85),
    t('oliveira', 'Oliveira', 'Religioso', 'Verde oliva e creme, sereno e natural.', '#E9E8DA', '#2F3A22', '#5A6532', '#5F6A35', '#D6D4C0', '#F5F4EA', IT, '400', 'normal', 'moldura', 'livro', '999px', 'Primeira comunhão', 'Pedro Henrique', '23 · 05 · 2027', 0.9),
    Object.assign(t('natal', 'Noite de Natal', 'Temático', 'Azul de inverno, neve caindo e carta dobrada.', '#10233A', '#EEF3F8', '#C9D8E8', '#1A3352', '#24456B', '#10233A', CG, '500', 'italic', 'moldura', 'dobradura', '999px', 'Natal', 'Ceia da família', '24 · 12 · 2026', 1), { fx: 'neve', isNew: true }),
    t('arraia', 'Arraiá', 'Temático', 'Palha, chita e vermelho para festas juninas.', '#F2E3C6', '#4A2410', '#A8301C', '#B8351F', '#E3CDA3', '#FFF4DE', JO, '700', 'normal', 'polaroid', 'cortina', '6px', 'Festa junina', 'Arraiá da Firma', '19 · 06 · 2027'),
    t('retro', 'Retrô 70', 'Temático', 'Laranja queimado e marrom, estilo anos 70.', '#F3D9B1', '#3D1F0F', '#9C4317', '#3D1F0F', '#E8C48F', '#FFF1DC', DM, '400', 'normal', 'editorial', 'neblina', '999px', 'Festa anos 70', 'Disco Night', '13 · 11 · 2026'),
    t('branco', 'Em branco', 'Qualquer evento', 'Comece do zero e monte cada página.', '#FFFFFF', '#17151F', '#17151F', '#F1F0F4', '#ECEBF0', '#FFFFFF', PJ, '700', 'normal', 'centro', 'neblina', '10px', 'Seu evento', 'Título do evento', 'Data do evento', 0.8)
  ];
}

let cache = null;
export function themes() {
  if (!cache) cache = build();
  // cópias: quem usa pode acrescentar campos sem mexer no catálogo
  return cache.map((x) => Object.assign({}, x));
}

export function themeById(id) {
  return themes().find((x) => x.id === id) || null;
}

// tema no formato salvo no convite (theme / themeBase)
export function themePayload(x) {
  const fontKey = x.fontKey || fontKeyOf(x.font);
  const radiusKey = x.radius === '999px' ? 'pilula' : (x.radius === '0px' || x.radius === '2px') ? 'reto' : 'arredondado';
  return {
    name: x.name, baseName: x.name, cat: x.custom ? x.kicker : x.cat, bg: x.bg, fg: x.fg, accent: x.accent, btnFg: x.btnFg, paper: x.paper, ph: x.ph,
    fontKey, italic: x.fstyle === 'italic', layout: x.layout, radiusKey, anim: x.anim, fx: x.fx || 'nenhum', pageFx: x.pageFx || 'suave',
    kicker: x.kicker, sample: x.sample, date: x.date, titleScale: x.ts,
    bodyKey: x.bodyKey || 'jakarta', starter: x.starter || '', openKicker: x.openKicker || ''
  };
}

// categoria da galeria para cada tipo de evento
export const CAT_OF = { casamento: 'Casamento', aniversario: 'Aniversário', infantil: 'Infantil', cha: 'Infantil', formatura: 'Formatura', corporativo: 'Corporativo', religioso: 'Religioso' };
