/**
 * Búsqueda en config/faq.json.
 * Normaliza (minúsculas, sin tildes ni signos) y compara palabras completas, para que «api» no
 * coincida con «rápido». Gana la entrada con más coincidencias; las frases largas pesan más.
 */
import { norm } from './dom.js';

const tokens = (s) => ` ${norm(s).replace(/[^a-z0-9ñ]+/g, ' ').trim()} `;

export function matchFaq(faq, text) {
  const t = tokens(text);
  let best = null;
  let bestScore = 0;
  for (const e of faq.entries) {
    // Coincidencias de la entrada, de la más larga a la más corta; una frase ya contada
    // no vuelve a sumar por sus palabras sueltas («que modulos» ya incluye «modulos»).
    const hits = e.keywords.map(tokens).filter((kt) => t.includes(kt)).sort((x, y) => y.length - x.length);
    const counted = [];
    for (const kt of hits) if (!counted.some((c) => c.includes(kt))) counted.push(kt);
    const score = counted.reduce((acc, kt) => acc + kt.trim().split(' ').length * 2 + kt.length / 10, 0);
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return best;
}
