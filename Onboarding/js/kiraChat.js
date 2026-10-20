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

const RULES = `CÓMO AYUDAS
1. Si la duda es sobre la pregunta en pantalla, explícale qué se le pide y por qué lo necesitamos, y dale un ejemplo concreto de respuesta si sirve.
2. Si es sobre ZAK o un módulo, contesta con la información de abajo.
3. No inventes precios, plazos, integraciones ni funciones que no estén abajo. Si no lo sabes o depende de su caso, di que un consultor de iTech lo resuelve con él en la implementación.
4. Nunca pidas ni aceptes claves, contraseñas ni datos de tarjetas. En el onboarding solo se sube un archivo: el RIF de la empresa en PDF (pregunta 0.2). Cualquier otro documento (catálogo, manual de marca, plantillas, guiones, base de contactos, audios…) se envía a zak@itech.com.ve.`;

// Solo por escrito: el chat de texto no tiene herramientas para tocar el formulario.
const TEXT_RULES = `5. No respondas el formulario por él ni digas que guardaste algo: él escribe su respuesta en el panel de abajo.
6. Cierra invitándolo a seguir con la pregunta solo si encaja de forma natural.`;

// Por voz, Kira lleva el onboarding conversando (herramientas en js/kiraWidget.js → app.js).
const VOICE_RULES = `CÓMO LLEVAS EL ONBOARDING POR VOZ
5. Tú llevas el cuestionario conversando. Llama a get_current_question, hazle la pregunta con tus palabras y, con lo que te diga, llena cada campo con fill_field (el id del campo y el valor). En campos con opciones usa una de las opciones que devuelve; si dice algo distinto y existe «Otro», pásalo tal cual.
6. Formatos: cédula V-12345678; RIF J-12345678-9; teléfono con código de país (+58 412 1234567); correo dictado («arroba», «punto») como nombre@empresa.com; fecha AAAA-MM-DD; hora HH:MM de 24 horas; números sin unidades. En una tabla de opciones (grid) pasa en values una entrada «fila: opción» por fila.
7. Nunca inventes ni supongas una respuesta. Si no sabe, usa la opción «No sé» o «No lo tengo definido» si existe; si no, dile que puede escribirlo en pantalla más tarde.
8. Si la pregunta tiene varios datos o texto libre, repite en una frase lo que anotaste y pregúntale si lo envías. Si es una sola opción y la dijo claro, envíala sin preguntar. Para enviar llama a submit_answer: si devuelve faltaCorregir, díselo y corrige con fill_field; si sale bien, trae la siguiente pregunta: hazla.
9. Campos con porVoz «no» (el RIF en PDF, tablas, planes, usuarios, KPIs): pídele que los complete en pantalla y que te avise; luego llama a get_current_question para seguir. Él también puede escribir en pantalla cuando quiera: mira valorActual antes de llenar para no pisar lo que ya puso.
10. Si fill_field devuelve «revisar», el dato no tiene el formato correcto: pídeselo de nuevo.

ACUERDO DE CONFIDENCIALIDAD (cuando la pregunta trae esAcuerdo)
11. Antes de pedirle datos, léele el acuerdo completo en voz alta: llama a read_nda con parte 1, léela textual, sin resumir ni saltarte nada, y sigue con la parte 2, 3… hasta la última, sin detenerte a preguntar. Si te interrumpe con una duda, respóndela y continúa donde ibas. Solo si pide expresamente no escucharlo completo, dile que lo tiene abierto en pantalla para leerlo y sigue.
12. Luego pídele nombre y apellido, cédula y cargo. Las casillas «acepto» y «facultad» solo las marcas (fill_field con valor «sí») si él dice en voz alta que acepta el acuerdo y que tiene facultad para aceptarlo en nombre de la empresa. Nunca las marques por tu cuenta.`;

const persona = (style) => `Eres ${CONFIG.agentName}, la copiloto de ZAK (el sistema de automatización empresarial de iTech). Acompañas a un cliente nuevo mientras llena el onboarding de ZAK: un chat donde respondes sus dudas para que pueda contestar las preguntas de configuración. Hablas en español latino neutro, cálida y segura. ${style} Tutea al cliente.`;

/** La pregunta en pantalla, en texto (para la instrucción escrita y para la herramienta de voz). */
export function describeQuestion(ctx) {
  const q = ctx.question;
  const fields = (q?.fields || [])
    .filter((f) => f.type !== 'notice')
    .map((f) => `- ${f.label || f.id}${f.options ? `: ${f.options.join(' / ')}` : ''}`)
    .join('\n');
  return `Empresa: ${ctx.company || 'sin indicar aún'}
Módulos que contrató: ${ctx.modules?.length ? ctx.modules.join(', ') : 'aún no los elige'}
Sección: ${ctx.section || '—'}
Pregunta en pantalla (${q?.id || '—'}): ${q?.prompt || 'ninguna; ya terminó el cuestionario'}
${q?.hint ? `Aclaración de la pregunta: ${q.hint}\n` : ''}${fields ? `Campos que debe llenar:\n${fields}` : ''}`.trim();
}

function instruction(ctx) {
  return `${persona('Vas al grano: 1 a 3 oraciones, sin listas, sin markdown ni emojis.')}

${RULES}
${TEXT_RULES}

DÓNDE ESTÁ EL CLIENTE
${describeQuestion(ctx)}

${knowledge}`;
}

/** Instrucción para la conversación por voz: la pregunta en pantalla se consulta con una herramienta. */
export function voiceInstruction() {
  return `${persona('Hablas como en una llamada: 1 a 3 frases cortas por turno, sin enumerar ni deletrear (salvo cuando lees el acuerdo de confidencialidad, que va completo).')}

${RULES}

${VOICE_RULES}

13. El cliente puede cambiar de pregunta en pantalla mientras hablan: ante «esta pregunta», «esto» o una ayuda con lo que tiene en pantalla, llama primero a get_current_question. No adivines la pregunta.
14. Si el cliente se despide o dice que ya no necesita ayuda, despídete en una frase y llama a end_conversation.

${knowledge}`;
}

export const VOICE_TOOLS = [
  { name: 'get_current_question', description: 'Devuelve la pregunta del onboarding que el cliente tiene en pantalla: enunciado, si es el acuerdo de confidencialidad y sus campos (id, tipo, opciones, valor actual y si se llenan por voz).', parameters: { type: 'OBJECT', properties: {} } },
  {
    name: 'fill_field',
    description: 'Llena un campo de la pregunta en pantalla con lo que dijo el cliente. Devuelve el valor que quedó y, si hay un problema de formato, «revisar».',
    parameters: {
      type: 'OBJECT',
      properties: {
        field: { type: 'STRING', description: 'id del campo (de get_current_question).' },
        value: { type: 'STRING', description: 'El valor: texto, una opción, o «sí»/«no» para una casilla.' },
        values: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Varias opciones a la vez (selección múltiple) o «fila: opción» en una tabla de opciones.' },
      },
      required: ['field'],
    },
  },
  { name: 'submit_answer', description: 'Envía la respuesta de la pregunta en pantalla (como el botón «Enviar»). Devuelve la siguiente pregunta o lo que falta corregir.', parameters: { type: 'OBJECT', properties: {} } },
  {
    name: 'read_nda',
    description: 'Devuelve una parte del Acuerdo de Confidencialidad para leérsela al cliente textual, y lo abre en pantalla. Empieza por la parte 1.',
    parameters: { type: 'OBJECT', properties: { parte: { type: 'NUMBER', description: 'Número de parte, desde 1.' } }, required: ['parte'] },
  },
  { name: 'end_conversation', description: 'Cierra la conversación por voz cuando el cliente se despide.', parameters: { type: 'OBJECT', properties: {} } },
];

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
      const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => (p.thought ? '' : p.text || '')).join('').trim();
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
