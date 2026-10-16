/**
 * Kira conversa en el onboarding: responde las dudas del cliente sobre la pregunta en pantalla
 * o sobre ZAK, con el mismo motor que el CRM y el brochure (Gemini por el backend del CRM).
 *
 * - La llamada va a /api/kira/generate del mismo dominio; vercel.json la reenvía al backend en
 *   Railway (como /api/kira/tts), así que no hay claves en el navegador ni CORS que configurar.
 * - Lo que Kira sabe: config/faq.json, los módulos de config/modules.json, los módulos que eligió
 *   el cliente y la pregunta que está respondiendo.
 * - Si el backend no responde, se usa la búsqueda en faq.json (js/faq.js) como antes.
 * Mismos modelos REST que brochure/src/kira.ts del repo itech-crm; si allá cambian, cambiarlos acá.
 */
import { CONFIG } from './config.js';

const REST_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
const TIMEOUT_MS = 20000;
const MAX_TURNS = 12; // mensajes del historial que viajan en cada pedido

let history = []; // [{ role: 'user' | 'model', parts: [{ text }] }]
let knowledge = '';

/** Ficha fija de ZAK (se arma una vez con la configuración cargada). */
export function setKnowledge({ faq, modulesCfg }) {
  const modules = modulesCfg.groups.flatMap((g) => g.modules.map((m) => `- ${m.name}: ${m.desc}`)).join('\n');
  const answers = faq.entries.map((e) => `- ${e.answer}`).join('\n');
  knowledge = `MÓDULOS DE ZAK\n${modules}\n\nRESPUESTAS OFICIALES (úsalas como fuente; no las contradigas)\n${answers}`;
}

function instruction(ctx) {
  const q = ctx.question;
  const fields = (q?.fields || [])
    .filter((f) => f.type !== 'notice')
    .map((f) => `- ${f.label || f.id}${f.options ? `: ${f.options.join(' / ')}` : ''}`)
    .join('\n');
  return `Eres ${CONFIG.agentName}, la copiloto de ZAK (el sistema de automatización empresarial de iTech). Acompañas a un cliente nuevo mientras llena el onboarding de ZAK: un chat donde respondes sus dudas para que pueda contestar las preguntas de configuración. Hablas en español latino neutro, cálida y segura. Vas al grano: 1 a 3 oraciones, sin listas, sin markdown ni emojis. Tutea al cliente.

CÓMO AYUDAS
1. Si la duda es sobre la pregunta en pantalla, explícale qué se le pide y por qué lo necesitamos, y dale un ejemplo concreto de respuesta si sirve.
2. Si es sobre ZAK o un módulo, contesta con la información de abajo.
3. No inventes precios, plazos, integraciones ni funciones que no estén abajo. Si no lo sabes o depende de su caso, di que un consultor de iTech lo resuelve con él en la implementación.
4. Nunca pidas ni aceptes claves, contraseñas ni datos de tarjetas. La base de contactos y los audios para clonar voz no se suben aquí: se envían a zak@itech.com.ve.
5. No respondas el formulario por él ni digas que guardaste algo: él escribe su respuesta en el panel de abajo.
6. Cierra invitándolo a seguir con la pregunta solo si encaja de forma natural.

DÓNDE ESTÁ EL CLIENTE
Empresa: ${ctx.company || 'sin indicar aún'}
Módulos que contrató: ${ctx.modules?.length ? ctx.modules.join(', ') : 'aún no los elige'}
Sección: ${ctx.section || '—'}
Pregunta en pantalla (${q?.id || '—'}): ${q?.prompt || 'ninguna; ya terminó el cuestionario'}
${q?.hint ? `Aclaración de la pregunta: ${q.hint}\n` : ''}${fields ? `Campos que debe llenar:\n${fields}\n` : ''}
${knowledge}`;
}

async function generate(body) {
  let lastError = null;
  for (const model of REST_MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${CONFIG.kiraChatUrl}?model=${encodeURIComponent(model)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
      if (text) return text;
      throw new Error('Respuesta vacía');
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/** Respuesta de Kira (texto limpio) o null si el backend no está disponible. */
export async function askKira(text, ctx) {
  if (!CONFIG.kiraChatUrl) return null;
  history.push({ role: 'user', parts: [{ text }] });
  const body = JSON.stringify({
    contents: history.slice(-MAX_TURNS),
    systemInstruction: { parts: [{ text: instruction(ctx) }] },
    generationConfig: { temperature: 0.6 },
  });
  try {
    const answer = (await generate(body)).replace(/[*_#`]+/g, '').replace(/\s+\n/g, '\n').trim();
    history.push({ role: 'model', parts: [{ text: answer }] });
    return answer;
  } catch {
    history.pop();
    return null;
  }
}
