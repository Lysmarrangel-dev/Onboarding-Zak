/**
 * Kira flotante: botón en la esquina y panel de conversación, como en el brochure y el CRM.
 * - Texto: /api/kira/generate (js/kiraChat.js); sin backend, responde con config/faq.json.
 * - Voz: botón del micrófono del panel → Gemini Live por el relay del backend (js/kiraLive.js).
 *   Lo que el cliente escribe en plena llamada va a la misma conversación y Kira lo contesta con voz.
 * - Kira sabe en qué pregunta está el cliente (getContext) y no llena el formulario por él.
 * El panel no bloquea la página: no hay fondo oscuro y el cliente puede seguir respondiendo.
 */
import { h, icon } from './dom.js';
import { CONFIG } from './config.js';
import { askKira, describeQuestion, voiceInstruction, VOICE_TOOLS } from './kiraChat.js';
import { KiraLive, voiceSupported } from './kiraLive.js';

const STATE_LABEL = { idle: 'Lista para ayudarte', connecting: 'Conectando…', listening: 'Te escucho', thinking: 'Pensando…', speaking: 'Hablando' };
const GREETING = 'El cliente acaba de activar tu voz en el onboarding. Llama a get_current_question y salúdalo en una sola frase corta: ofrécele ayuda con esa pregunta o con cualquier duda sobre ZAK.';
const SUGGESTIONS = [
  ['Explícame esta pregunta', 'Explícame la pregunta que tengo en pantalla y dame un ejemplo de respuesta.'],
  ['¿Qué es ZAK?', '¿Qué es ZAK en pocas palabras?'],
  ['¿Por qué piden el RIF?', '¿Para qué necesitan el RIF de la empresa en PDF?'],
  ['¿Qué envío por correo?', '¿Qué documentos tengo que enviar por correo y a dónde?'],
];

/**
 * opts: { avatar, getContext() → { question, section, company, modules }, fallback(texto) → respuesta,
 *         onDoubt(texto) (la duda llega al equipo), onVoice(activa), speak(texto) (voz de Kira para las respuestas escritas) }
 */
export function createKiraWidget(opts) {
  let state = 'idle';
  let userBubble = null;
  let kiraBubble = null;
  let busy = false;

  const orb = (cls = '') => h('span', { class: `kira-orb ${cls}`, 'aria-hidden': 'true' }, h('img', { src: opts.avatar, alt: '' }));
  const stateEl = h('span', { class: 'kira-panel-state' }, STATE_LABEL.idle);
  const msgs = h('div', { class: 'kira-msgs', 'aria-live': 'polite' },
    h('div', { class: 'kira-msg kira' }, `Hola, soy ${CONFIG.agentName}. Pregúntame lo que necesites sobre la pregunta en pantalla o sobre ZAK${voiceSupported() ? ', por escrito o por voz con el micrófono' : ''}.`));
  const input = h('input', { class: 'kira-input', type: 'text', placeholder: `Escríbele a ${CONFIG.agentName}…`, 'aria-label': `Mensaje para ${CONFIG.agentName}`, maxlength: 500 });
  const micBtn = voiceSupported()
    ? h('button', { type: 'button', class: 'icon-btn kira-mic', 'aria-label': 'Hablar con Kira por voz', 'aria-pressed': 'false', onclick: () => toggleVoice() }, icon('mic'))
    : null;
  const panel = h('div', { class: 'kira-panel', role: 'dialog', 'aria-label': `Conversación con ${CONFIG.agentName}`, hidden: true },
    h('div', { class: 'kira-panel-head' },
      orb('sm'),
      h('div', {}, h('strong', {}, CONFIG.agentName), stateEl),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar', onclick: () => setOpen(false) }, icon('close'))),
    msgs,
    h('div', { class: 'kira-suggest' }, SUGGESTIONS.map(([label, text]) => h('button', { type: 'button', onclick: () => ask(text) }, label))),
    h('form', {
      class: 'kira-composer', autocomplete: 'off',
      onsubmit: (e) => { e.preventDefault(); const t = input.value.trim(); if (!t) return; input.value = ''; ask(t); },
    }, micBtn, input, h('button', { type: 'submit', class: 'icon-btn kira-send', 'aria-label': 'Enviar' }, icon('arrowRight'))));
  const fab = h('button', { type: 'button', class: 'kira-fab', 'aria-expanded': 'false', onclick: () => setOpen(panel.hidden) },
    orb(), h('span', {}, CONFIG.agentName));
  const root = h('aside', { class: 'kira-dock', 'aria-label': CONFIG.agentName, hidden: true }, panel, fab);
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); fab.focus(); } });
  document.body.appendChild(root);

  function setOpen(open) {
    panel.hidden = !open;
    fab.setAttribute('aria-expanded', String(open));
    root.classList.toggle('is-open', open);
    if (open) { msgs.scrollTop = 1e9; if (!window.matchMedia('(pointer: coarse)').matches) input.focus(); }
  }

  function bubble(role, text) {
    const el = h('div', { class: `kira-msg ${role}` }, text);
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function setState(s) {
    state = s;
    stateEl.textContent = STATE_LABEL[s] || '';
    root.dataset.kira = s;
    const voiceOn = live?.live || s === 'connecting';
    micBtn?.classList.toggle('on', Boolean(voiceOn));
    micBtn?.setAttribute('aria-pressed', String(Boolean(voiceOn)));
    micBtn?.setAttribute('aria-label', voiceOn ? 'Terminar la conversación por voz' : 'Hablar con Kira por voz');
    if (s === 'idle' || s === 'thinking') root.style.setProperty('--level', '0');
    opts.onVoice?.(Boolean(voiceOn));
  }

  let pendingLevel = null;
  function setLevel(l) {
    const first = pendingLevel === null;
    pendingLevel = l;
    if (!first) return;
    requestAnimationFrame(() => { root.style.setProperty('--level', (pendingLevel ?? 0).toFixed(2)); pendingLevel = null; });
  }

  let live = null;
  function getLive() {
    live ||= new KiraLive({
      systemInstruction: voiceInstruction(),
      functionDeclarations: VOICE_TOOLS,
      tools: { get_current_question: () => ({ pregunta: describeQuestion(opts.getContext()) }) },
      onState: setState,
      onUserText: (text, final) => {
        if (!userBubble) userBubble = bubble('user', text); else userBubble.textContent = text;
        if (final) { opts.onDoubt?.(`(voz) ${text.trim()}`); userBubble = null; }
        kiraBubble = null;
      },
      onKiraText: (text, final) => {
        if (!kiraBubble) kiraBubble = bubble('kira', text); else kiraBubble.textContent = text;
        msgs.scrollTop = 1e9;
        if (final) kiraBubble = null;
      },
      onLevel: setLevel,
      onNotice: (m) => { setOpen(true); bubble('note', m); },
    });
    return live;
  }

  async function toggleVoice() {
    const k = getLive();
    if (state === 'connecting') return;
    if (k.live) { k.stop(); return; }
    setOpen(true);
    await k.start(GREETING);
  }

  /** Pregunta escrita (o desde una sugerencia). */
  async function ask(text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    setOpen(true);
    bubble('user', clean);
    opts.onDoubt?.(clean);
    if (live?.live) { live.sendText(clean); return; }
    if (busy) return;
    busy = true;
    setState('thinking');
    const typing = h('div', { class: 'kira-msg kira typing', role: 'status', 'aria-label': `${CONFIG.agentName} está escribiendo` },
      h('span', { class: 'node' }), h('span', { class: 'node' }), h('span', { class: 'node' }));
    msgs.appendChild(typing);
    msgs.scrollTop = 1e9;
    const answer = (await askKira(clean, opts.getContext())) || opts.fallback(clean);
    typing.remove();
    bubble('kira', answer);
    busy = false;
    setState('idle');
    opts.speak?.(answer);
  }

  return {
    show(visible) {
      root.hidden = !visible;
      if (!visible) { setOpen(false); live?.stop(); }
    },
    open: () => setOpen(true),
    ask,
    voiceActive: () => Boolean(live?.live) || state === 'connecting',
    /** Distancia al borde inferior (para no tapar el panel de respuesta ni la barra del resumen). */
    setBottom(px) { root.style.setProperty('--kira-bottom', `${Math.round(px)}px`); },
  };
}
