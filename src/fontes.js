// Fontes dos convites (usadas no navegador e no servidor, que monta convites dos pedidos).
export const FONTS = {
  cormorant: ["'Cormorant Garamond', Georgia, serif", '500', 40], playfair: ["'Playfair Display', Georgia, serif", '600', 36],
  bodoni: ["'Bodoni Moda', Georgia, serif", '500', 36], dmserif: ["'DM Serif Display', Georgia, serif", '400', 36],
  italiana: ["'Italiana', serif", '400', 38], greatvibes: ["'Great Vibes', cursive", '400', 46], caveat: ["'Caveat', cursive", '700', 44],
  bricolage: ["'Bricolage Grotesque', sans-serif", '800', 34], syne: ["'Syne', sans-serif", '800', 30],
  josefin: ["'Josefin Sans', sans-serif", '700', 34], jakarta: ["'Plus Jakarta Sans', sans-serif", '800', 32],
  cinzel: ["'Cinzel', Georgia, serif", '600', 32], pinyon: ["'Pinyon Script', cursive", '400', 46],
  fraunces: ["'Fraunces', Georgia, serif", '600', 38], abril: ["'Abril Fatface', Georgia, serif", '400', 38],
  unbounded: ["'Unbounded', sans-serif", '700', 28]
};
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

