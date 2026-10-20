/**
 * Kira flotante: botón en la esquina y panel de conversación, como en el brochure y el CRM.
 * - Texto: /api/kira/generate (js/kiraChat.js); sin backend, responde con config/faq.json.
 * - Voz: botón del micrófono del panel → Gemini Live por el relay del backend (js/kiraLive.js).
 *   Lo que el cliente escribe en plena llamada va a la misma conversación y Kira lo contesta con voz.
 * - Por escrito, Kira responde dudas y no llena el formulario. Por voz, lleva el onboarding
 *   conversando: lee la pregunta en pantalla, llena los campos con lo que dice el cliente, envía la
 *   respuesta y lee el acuerdo de confidencialidad completo (opts.voiceForm, en app.js).
 * - Decir «Kira» la llama (js/kiraWakeWord.js): el micrófono escucha esa palabra mientras el panel
 *   está disponible, y se pausa durante la llamada y mientras suena la narración.
 * El panel no bloquea la página: no hay fondo oscuro y el cliente puede seguir respondiendo.
 */
import { h, icon } from './dom.js';
import { CONFIG } from './config.js';
import { askKira, describeQuestion, voiceInstruction, VOICE_TOOLS } from './kiraChat.js';
import { KiraLive, voiceSupported } from './kiraLive.js';
import { KiraWakeWord, readWakePref, saveWakePref, wakeWordSupported, whenUserActive } from './kiraWakeWord.js';

const STATE_LABEL = { idle: 'Lista para ayudarte', connecting: 'Conectando…', listening: 'Te escucho', thinking: 'Pensando…', speaking: 'Hablando' };
const GREETING = 'El cliente acaba de activar tu voz en el onboarding. Llama a get_current_question. Salúdalo en una frase corta y dile que pueden llenar el onboarding conversando. Si la pregunta en pantalla es el acuerdo de confidencialidad, empieza a leérselo con read_nda; si no, hazle esa pregunta.';
const SUGGESTIONS = [
  ['Explícame esta pregunta', 'Explícame la pregunta que tengo en pantalla y dame un ejemplo de respuesta.'],
  ['¿Qué es ZAK?', '¿Qué es ZAK en pocas palabras?'],
  ['¿Por qué piden el RIF?', '¿Para qué necesitan el RIF de la empresa en PDF?'],
  ['¿Qué envío por correo?', '¿Qué documentos tengo que enviar por correo y a dónde?'],
];

/**
 * opts: { avatar, getContext() → { question, section, company, modules }, fallback(texto) → respuesta,
 *         voiceForm: { question(), fill({ field, value, values }), submit(), readNda({ parte }) },
 *         onDoubt(texto) (la duda escrita llega al equipo), onVoice(activa), speak(texto) (voz de Kira para las respuestas escritas) }
 */
export function createKiraWidget(opts) {
  let state = 'idle';
  let userBubble = null;
  let kiraBubble = null;
  let busy = false;

  // La bolita de Kira del brochure y el CRM: núcleo claro con el pulpo y dos anillos que laten.
  const orb = (cls = '') => h('span', { class: `kira-orb ${cls}`, 'aria-hidden': 'true' },
    h('span', { class: 'kira-orb-core' }, h('img', { src: opts.avatar, alt: '', draggable: 'false' })),
    h('span', { class: 'kira-orb-ring' }), h('span', { class: 'kira-orb-ring r2' }));
  const stateEl = h('span', { class: 'kira-panel-state' }, STATE_LABEL.idle);
  const msgs = h('div', { class: 'kira-msgs', 'aria-live': 'polite' },
    h('div', { class: 'kira-msg kira' }, `Hola, soy ${CONFIG.agentName}. Pregúntame lo que necesites sobre la pregunta en pantalla o sobre ZAK${voiceSupported() ? ', por escrito o por voz con el micrófono' : ''}.`));
  const input = h('input', { class: 'kira-input', type: 'text', placeholder: `Escríbele a ${CONFIG.agentName}…`, 'aria-label': `Mensaje para ${CONFIG.agentName}`, maxlength: 500 });
  const wakeBtn = voiceSupported() && wakeWordSupported()
    ? h('button', { type: 'button', class: 'icon-btn kira-wake', 'aria-pressed': 'false', onclick: () => setWake(!wakeOn) }, icon('ear'))
    : null;
  const micBtn = voiceSupported()
    ? h('button', { type: 'button', class: 'icon-btn kira-mic', 'aria-label': 'Hablar con Kira por voz', 'aria-pressed': 'false', onclick: () => toggleVoice() }, icon('mic'))
    : null;
  const panel = h('div', { class: 'kira-panel', role: 'dialog', 'aria-label': `Conversación con ${CONFIG.agentName}`, hidden: true },
    h('div', { class: 'kira-panel-head' },
      orb('sm'),
      h('div', {}, h('strong', {}, CONFIG.agentName), stateEl),
      wakeBtn,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar', onclick: () => setOpen(false) }, icon('close'))),
    msgs,
    h('div', { class: 'kira-suggest' }, SUGGESTIONS.map(([label, text]) => h('button', { type: 'button', onclick: () => ask(text) }, label))),
    h('form', {
      class: 'kira-composer', autocomplete: 'off',
      onsubmit: (e) => { e.preventDefault(); const t = input.value.trim(); if (!t) return; input.value = ''; ask(t); },
    }, micBtn, input, h('button', { type: 'submit', class: 'icon-btn kira-send', 'aria-label': 'Enviar' }, icon('arrowRight'))));
  const fab = h('button', {
    type: 'button', class: 'kira-fab', 'aria-expanded': 'false', 'aria-label': `Hablar con ${CONFIG.agentName}`, title: `Pregúntale a ${CONFIG.agentName}`,
    onclick: () => setOpen(panel.hidden),
  }, orb('lg'));
  // Etiqueta junto a la bolita mientras dura la voz («Kira escuchando…»), como en el CRM.
  const pill = h('span', { class: 'kira-pill', role: 'status' });
  const root = h('aside', { class: 'kira-dock', 'aria-label': CONFIG.agentName, hidden: true }, panel, h('div', { class: 'kira-fab-row' }, pill, fab));
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
    pill.textContent = voiceOn ? ({ connecting: 'Conectando con Kira…', listening: 'Kira escuchando…', speaking: 'Kira hablando…', thinking: 'Kira pensando…' }[s] || '') : '';
    opts.onVoice?.(Boolean(voiceOn));
    // Durante la llamada, la escucha de «Kira» suelta el micrófono.
    if (voiceOn) wake.hold('llamada'); else wake.release('llamada');
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
      tools: opts.voiceForm
        ? {
          get_current_question: () => opts.voiceForm.question(),
          fill_field: (args) => opts.voiceForm.fill(args),
          submit_answer: () => opts.voiceForm.submit(),
          read_nda: (args) => opts.voiceForm.readNda(args),
        }
        : { get_current_question: () => ({ pregunta: describeQuestion(opts.getContext()) }) },
      onState: setState,
      onUserText: (text, final) => {
        if (!userBubble) userBubble = bubble('user', text); else userBubble.textContent = text;
        if (final) userBubble = null;
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

  // «Kira» como palabra de activación: sola abre la llamada; «Kira, <pedido>» la abre con ese pedido.
  const wake = new KiraWakeWord();
  let wakeOn = Boolean(wakeBtn) && readWakePref();
  let stopWaitingGesture = () => {};
  wake.hold('oculta'); // hasta que el widget se muestre (chat o resumen)

  function updateWake() {
    wakeBtn?.classList.toggle('on', wakeOn);
    wakeBtn?.setAttribute('aria-pressed', String(wakeOn));
    const title = wakeOn ? 'Di «Kira» para llamarla. Toca para dejar de escuchar.' : 'Activar: llamar a Kira diciendo «Kira»';
    wakeBtn?.setAttribute('title', title);
    wakeBtn?.setAttribute('aria-label', title);
    root.classList.toggle('is-wake', wake.listening);
  }

  function setWake(on) {
    wakeOn = on;
    saveWakePref(on);
    stopWaitingGesture();
    if (on) stopWaitingGesture = whenUserActive(() => wake.enable());
    else wake.disable();
    updateWake();
  }

  wake.setHandlers({
    onWake: (command) => {
      const k = getLive();
      setOpen(true);
      if (k.live) { if (command) ask(command); return; }
      if (state === 'connecting') return;
      if (command) bubble('user', command);
      void k.start(command || GREETING);
    },
    onListening: () => updateWake(),
    onBlocked: () => { wakeOn = false; updateWake(); },
  });
  if (wakeOn) setWake(true); else updateWake();

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
      if (!visible) { setOpen(false); live?.stop(); wake.hold('oculta'); } else wake.release('oculta');
    },
    open: () => setOpen(true),
    ask,
    voiceActive: () => Boolean(live?.live) || state === 'connecting',
    /** Distancia al borde inferior (para no tapar el panel de respuesta ni la barra del resumen). */
    setBottom(px) { root.style.setProperty('--kira-bottom', `${Math.round(px)}px`); },
  };
}
