/**
 * Nivel de información disponible para configurar ZAK (config/scoring.json).
 *
 * Cuestionario: cada pregunta respondida vale de 0 a 1.
 *   - Respuestas «No sé» → 0; «En trámite», «Parcialmente», etc. → 0,5.
 *   - Respuestas que indican que falta algo clave (p. ej. «No» tiene tarjeta en Meta) → 0.
 *   - Archivo esperado sin adjuntar (p. ej. comprobante del RIF) → 0,5.
 *   - El resto (texto escrito, datos concretos) → 1.
 * Global = promedio de las preguntas respondidas.
 * El nivel resultante indica la consultoría recomendada.
 */

export function computeInfo(cfg, engine, state) {
  const unknown = new Set(cfg.unknownValues);
  const partial = new Set(cfg.partialValues);
  const pending = [];
  let sum = 0;
  let n = 0;

  for (const q of engine.flow(state.answers)) {
    // El acuerdo de confidencialidad no aporta información de configuración.
    if (!state.done[q.id] || q.section === 'sN') continue;
    const draft = state.answers[q.id] || {};
    const fields = engine.visibleFields(q, state.answers, draft);
    const scores = [];
    const reasons = [];

    for (const f of fields) {
      if (!['single', 'select', 'multi'].includes(f.type)) continue;
      const vals = [].concat(draft[f.id] ?? []);
      if (!vals.length) continue;
      const lack = cfg.lacks[q.id]?.[f.id] || [];
      let sc = 1;
      if (vals.some((v) => unknown.has(v) || lack.includes(v))) sc = 0;
      else if (vals.some((v) => partial.has(v))) sc = 0.5;
      scores.push(sc);
      if (sc < 1) reasons.push(`${f.label}: ${vals.join(', ')}`);
    }
    const expected = cfg.expectedFiles[q.id];
    if (expected && fields.some((f) => f.id === expected) && !([].concat(draft[expected] || []).length)) {
      scores.push(0.5);
      reasons.push(`${fields.find((f) => f.id === expected).label}: sin adjuntar`);
    }

    const qs = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;
    sum += qs;
    n++;
    if (qs < 1) pending.push({ id: q.id, prompt: q.prompt, reasons });
  }

  const questionnaire = n ? Math.round((sum / n) * 100) : null;
  const overall = questionnaire;
  const level = overall === null ? null : cfg.levels.find((l) => overall >= l.min);
  return { overall, questionnaire, level, pending, answered: n };
}

/** Texto plano de la información pendiente (Form y correo). */
export function pendingText(info) {
  return info.pending.map((p) => `${p.id} · ${p.reasons.join(' · ')}`).join('\n');
}

/* ==========================================================================
   Consultoría: cuándo ofrecerla y qué pidió el cliente
   ========================================================================== */
const RE_NO_TEXT = /^\s*(no|no s[eé]|no lo s[eé]|no tengo|ninguno|ninguna|nada)\s*[.!]?\s*$/i;

/**
 * ¿La respuesta merece ofrecer consultoría? «No sé» siempre; «No» solo cuando indica que falta
 * algo clave (scoring.lacks); textos como «no» o «no sé»; y respuestas tipo «No lo tengo definido».
 */
export function consultTriggered(cfg, q, draft, fields) {
  const triggers = new Set([...cfg.unknownValues, ...(cfg.consultValues || [])]);
  for (const f of fields) {
    const v = draft[f.id];
    if (v === undefined || v === null || v === '') continue;
    if (['single', 'select', 'multi'].includes(f.type)) {
      const vals = [].concat(v);
      const lack = cfg.lacks[q.id]?.[f.id] || [];
      if (vals.some((x) => triggers.has(x) || lack.includes(x))) return true;
    } else if (f.type === 'grid' && !f.states) {
      // Tablas como la de SLA: «No lo tengo definido» en cualquier fila ofrece consultoría.
      const opts = new Set([...triggers, ...(f.consultOptions || [])]);
      if (Object.values(v).some((x) => opts.has(x))) return true;
    } else if (['text', 'textarea'].includes(f.type) && RE_NO_TEXT.test(String(v))) {
      return true;
    }
  }
  return false;
}

/** Lista de consultorías pedidas: CTA aceptado y opciones que la piden. */
export function consultRequests(engine, state) {
  const out = [];
  for (const q of engine.flow(state.answers)) {
    if (!state.done[q.id]) continue;
    const d = state.answers[q.id] || {};
    if (d.__consultoria === 'Sí, quiero consultoría') out.push(`${q.id} · ${q.prompt}`);
    for (const f of engine.visibleFields(q, state.answers, d)) {
      const raw = d[f.id];
      if (f.type === 'grid' && raw && !f.states) {
        Object.entries(raw).filter(([, x]) => (f.consultOptions || []).includes(x)).forEach(([row, x]) => out.push(`${q.id} · ${f.label} · ${row}: ${x}`));
        continue;
      }
      const hit = [].concat(raw ?? []).find((x) => (f.consultOptions || []).includes(x));
      if (hit) out.push(`${q.id} · ${f.label}: ${hit}`);
    }
  }
  return out;
}
