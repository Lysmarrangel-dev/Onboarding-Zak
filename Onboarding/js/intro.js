/**
 * Presentación audiovisual de bienvenida.
 * - Modo animado (por defecto): 6 escenas con animación de marca, subtítulos y narración.
 *   La narración usa la voz de Kira (la misma del CRM y el brochure): los MP3 pregenerados
 *   (config/intro.json → tools/generar_voz.py) o, si faltan, la voz en vivo del backend del CRM
 *   (js/kiraVoice.js); solo si eso falla, la voz del navegador (Web Speech API).
 *   Cada escena avanza cuando termina su frase y su tiempo mínimo.
 * - Modo video: si CONFIG.intro.videoSrc tiene una URL (p. ej. un video del avatar), se muestra ese
 *   video con sus subtítulos en lugar de la animación.
 * Respeta prefers-reduced-motion (no arranca solo) y se puede pausar, silenciar, repetir o saltar.
 */
import { h, icon, prefersReducedMotion } from './dom.js';
import { kiraVoiceUrl } from './kiraVoice.js';

const ISO_WHITE = 'assets/brand/itech-isotipo-blanco.svg';

// Guion por defecto (el real se carga desde config/intro.json).
// `say` es lo que se narra; `caption`, lo que se lee en pantalla.
export let SCRIPT = [
  { id: 'hello', min: 3600, caption: 'Hola, soy Kira, la asistente que maneja ZAK hablando contigo. Te acompaño en este onboarding.' },
  { id: 'zak', min: 4600, caption: 'ZAK es el sistema de automatización empresarial de iTech: tu empresa en un solo lugar.' },
  { id: 'stats', min: 4200, caption: '18 módulos, 6 canales y un solo panel.', say: 'Dieciocho módulos, seis canales y un solo panel.' },
  { id: 'voice', min: 5400, caption: 'Captas, vendes, cobras y diriges a tu equipo… incluso hablando.' },
  { id: 'cycle', min: 4600, caption: 'Con tus respuestas configuramos ZAK según la operación de tu empresa.' },
  { id: 'go', min: 4400, caption: 'Toma unos 35 minutos y puedes editar cualquier respuesta. Empecemos.', say: 'Toma unos treinta y cinco minutos, y puedes editar cualquier respuesta. Empecemos.' },
];

/* ---------- Voz ---------- */
const tts = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;
function pickVoice() {
  if (!tts) return null;
  const vs = tts.getVoices().filter((v) => /^es/i.test(v.lang));
  if (!vs.length) return null;
  const rank = (v) =>
    (/(es-(US|MX|419|VE|CO))/i.test(v.lang) ? 4 : 0) +
    (/(Google|Paulina|Mónica|Monica|Sabina|Dalia|Elvira|Paloma|Natural|Premium|Enhanced)/i.test(v.name) ? 3 : 0) +
    (v.localService ? 1 : 0);
  return vs.sort((a, b) => rank(b) - rank(a))[0];
}
if (tts) {
  voice = pickVoice();
  tts.addEventListener?.('voiceschanged', () => { voice = pickVoice(); });
}

/* ---------- Escenas ---------- */
function scene(id, ...children) {
  return h('div', { class: `iv-scene iv-${id}`, 'data-scene': id }, children);
}

function buildStage() {
  return h('div', { class: 'iv-stage brand-surface', 'aria-hidden': 'true' },
    scene('hello',
      h('div', { class: 'iv-iso' }, h('span', { class: 'iv-ring' }), h('img', { src: ISO_WHITE, alt: '' })),
      h('div', { class: 'iv-title' }, 'Hola, soy Kira')),
    scene('zak',
      h('div', { class: 'iv-zak' }, ...'ZAK'.split('').map((c, i) => h('span', { style: { animationDelay: `${120 + i * 140}ms` } }, c))),
      h('div', { class: 'iv-acro' }, ['Central', 'Automated', 'Kinetic', 'System'].map((w, i) =>
        h('span', { style: { animationDelay: `${700 + i * 180}ms` } }, h('b', {}, w[0]), w.slice(1)))),
      h('div', { class: 'iv-sub' }, 'Sistema de Automatización Empresarial · iTech')),
    scene('stats',
      h('div', { class: 'iv-stats' },
        [['18', 'módulos'], ['6', 'canales'], ['1', 'panel']].map(([n, l], i) =>
          h('div', { class: 'iv-stat', style: { animationDelay: `${i * 260}ms` } }, h('span', { class: 'iv-num', 'data-to': n }, '0'), h('span', { class: 'iv-lbl' }, l))))),
    scene('voice',
      h('div', { class: 'iv-cmd' }, icon('mic', 'iv-mic'), h('span', { class: 'iv-typed', 'data-text': 'Muéstrame las ventas de hoy' }), h('span', { class: 'iv-caret' })),
      h('div', { class: 'iv-tiles' },
        [['Cobrado hoy', '€12.400'], ['Ventas del mes', '68 %'], ['Citas de hoy', '9'], ['Tareas vencidas', '2']].map(([k, v], i) =>
          h('div', { class: 'iv-tile', style: { animationDelay: `${1900 + i * 180}ms` } }, h('span', {}, k), h('b', {}, v)))),
      h('div', { class: 'iv-note' }, 'Ejemplo ilustrativo')),
    scene('cycle',
      h('div', { class: 'iv-cycle' },
        ['Captar', 'Publicitar', 'Vender', 'Cobrar', 'Atender', 'Dirigir'].map((w, i) =>
          h('span', { class: 'iv-step', style: { animationDelay: `${i * 260}ms` } }, w))),
      h('div', { class: 'iv-title iv-small', style: { animationDelay: '1700ms' } }, 'Configurado según tu operación')),
    scene('go',
      h('div', { class: 'iv-iso iv-iso-sm' }, h('img', { src: ISO_WHITE, alt: '' })),
      h('div', { class: 'iv-title' }, 'Empecemos'),
      h('div', { class: 'iv-sub' }, 'Solo lo de tus módulos · puedes editar cualquier respuesta'),
      h('div', { class: 'iv-tag' }, 'Inteligencia que construye.')),
  );
}

/**
 * @param {object} opts
 * @param {object} opts.config   CONFIG.intro
 * @param {boolean} opts.autoplay  arrancar al montar (solo tras un clic del usuario)
 * @param {boolean} opts.ended     mostrar directamente el último cuadro (ya visto antes)
 * @param {Function} opts.onEnd    se llama al terminar o al saltar
 */
export function createIntro({ config = {}, script = null, autoplay = false, ended = false, onEnd = () => {} }) {
  if (config.videoSrc) return createVideoIntro({ config, autoplay, onEnd });
  if (script?.scenes?.length) SCRIPT = script.scenes;
  const audioDir = script?.audioDir || '';
  // Un solo elemento de audio reutilizado: se «desbloquea» con el clic inicial (necesario en iOS).
  const audio = audioDir ? new Audio() : null;
  if (audio) audio.preload = 'auto';

  let i = 0;
  let playing = false;
  let muted = !config.voice || (!tts && !audio);
  let token = 0;
  let timers = [];

  const stage = buildStage();
  const caption = h('p', { class: 'iv-caption' }, SCRIPT[0].caption);
  const segs = SCRIPT.map(() => h('span', { class: 'iv-seg' }, h('i')));
  const playBtn = h('button', { class: 'iv-btn', type: 'button', 'aria-label': 'Reproducir presentación', onclick: () => (playing ? pause() : play()) }, icon('play'));
  const muteBtn = h('button', {
    class: 'iv-btn', type: 'button', disabled: !config.voice || (!tts && !audio),
    'aria-label': muted ? 'Activar voz' : 'Silenciar voz', onclick: toggleMute,
  }, icon(muted ? 'volumeOff' : 'volume'));
  const replayBtn = h('button', { class: 'iv-btn', type: 'button', 'aria-label': 'Ver desde el inicio', onclick: () => { stop(); i = 0; play(); } }, icon('replay'));
  const bigPlay = h('button', { class: 'iv-bigplay', type: 'button', 'aria-label': 'Reproducir presentación de ZAK', onclick: () => { if (ended) { i = 0; } play(); } },
    h('span', {}, icon('play')), h('span', { class: 'iv-bigplay-lbl' }, ended ? 'Ver de nuevo' : 'Ver presentación · 25 s'));

  const el = h('section', { class: 'intro-video', 'aria-label': 'Presentación de ZAK' },
    h('div', { class: 'iv-frame' }, stage, bigPlay),
    h('div', { class: 'iv-bar' }, playBtn, h('div', { class: 'iv-progress', 'aria-hidden': 'true' }, segs), muteBtn, replayBtn),
    caption,
    h('p', { class: 'sr-only' }, `Transcripción: ${SCRIPT.map((s) => s.caption).join(' ')}`));

  function setScene(n) {
    stage.querySelectorAll('.iv-scene').forEach((s, k) => s.classList.toggle('is-on', k === n));
    segs.forEach((s, k) => { s.classList.toggle('done', k < n); s.classList.toggle('on', k === n); });
    caption.textContent = SCRIPT[n].caption;
    if (SCRIPT[n].id === 'stats') countUp(stage);
    if (SCRIPT[n].id === 'voice') typeText(stage, token);
  }

  function runScene() {
    const my = ++token;
    setScene(i);
    const s = SCRIPT[i];
    let timeDone = false;
    let speechDone = muted;
    const next = () => {
      if (my !== token || !playing || !timeDone || !speechDone) return;
      if (i < SCRIPT.length - 1) { i++; runScene(); } else finish();
    };
    const minMs = prefersReducedMotion() ? Math.max(2500, s.min - 1200) : s.min;
    timers.push(setTimeout(() => { timeDone = true; next(); }, minMs));
    if (!muted) {
      const done = () => { if (my === token && !speechDone) { speechDone = true; next(); } };
      // Seguridad: si el audio o el motor de voz no avisan, no bloqueamos la presentación.
      timers.push(setTimeout(done, s.min + 8000));
      narrate(s, my, done);
      prefetch(i + 1);
    }
  }

  /**
   * Narra la escena con la voz de Kira: primero el MP3 pregenerado; si no existe, la voz en vivo
   * del backend del CRM; si tampoco, la voz del navegador.
   */
  function narrate(s, my, done) {
    if (!audio) return browserSpeak(s, done);
    let fellBack = false;
    const fallback = async () => {
      if (fellBack || my !== token) return;
      fellBack = true;
      const live = await kiraVoiceUrl(s.say || s.caption);
      if (my !== token) return;
      if (!live) return browserSpeak(s, done);
      audio.onerror = () => browserSpeak(s, done);
      audio.src = live;
      audio.play().catch((e) => { if (e?.name !== 'AbortError') browserSpeak(s, done); });
    };
    audio.onended = done;
    audio.onerror = fallback;
    audio.src = `${audioDir}/${s.id}.mp3`;
    audio.currentTime = 0;
    audio.play().catch((e) => { if (e?.name !== 'AbortError') fallback(); });
  }

  function browserSpeak(s, done) {
    if (!tts) return done();
    const u = new SpeechSynthesisUtterance(s.say || s.caption);
    u.lang = voice?.lang || 'es-ES';
    if (voice) u.voice = voice;
    u.rate = 1.02;
    u.onend = u.onerror = done;
    tts.speak(u);
  }

  function prefetch(n) {
    const s = SCRIPT[n];
    if (!audio || !s) return;
    // Sin MP3 pregenerado, se pide ya la voz en vivo para que la escena no espere.
    fetch(`${audioDir}/${s.id}.mp3`).then((r) => { if (!r.ok) kiraVoiceUrl(s.say || s.caption); }).catch(() => {});
  }

  function silence() {
    tts?.cancel();
    if (audio) { audio.onended = audio.onerror = null; audio.pause(); }
  }

  function play() {
    if (playing) return;
    playing = true;
    ended = false;
    el.classList.add('is-playing');
    el.classList.remove('is-paused', 'is-ended');
    playBtn.replaceChildren(icon('pause'));
    playBtn.setAttribute('aria-label', 'Pausar presentación');
    runScene();
  }

  function pause() {
    playing = false;
    token++;
    clearTimers();
    silence();
    el.classList.add('is-paused');
    playBtn.replaceChildren(icon('play'));
    playBtn.setAttribute('aria-label', 'Reanudar presentación');
  }

  function stop() { pause(); el.classList.remove('is-paused'); }

  function finish() {
    playing = false;
    clearTimers();
    el.classList.remove('is-playing');
    el.classList.add('is-ended');
    playBtn.replaceChildren(icon('play'));
    bigPlay.querySelector('.iv-bigplay-lbl').textContent = 'Ver de nuevo';
    ended = true;
    onEnd({ skipped: false });
  }

  function toggleMute() {
    muted = !muted;
    if (muted) silence();
    muteBtn.replaceChildren(icon(muted ? 'volumeOff' : 'volume'));
    muteBtn.setAttribute('aria-label', muted ? 'Activar voz' : 'Silenciar voz');
    if (playing) { token++; clearTimers(); runScene(); } // reinicia la escena con o sin voz
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // Estado inicial
  if (ended) { i = SCRIPT.length - 1; setScene(i); el.classList.add('is-ended'); segs.forEach((s) => s.classList.add('done')); }
  else setScene(0);
  if (autoplay && !prefersReducedMotion()) play();

  return {
    el,
    stop,
    skip() { const was = !ended; stop(); if (was) { ended = true; i = SCRIPT.length - 1; setScene(i); el.classList.add('is-ended'); onEnd({ skipped: true }); } },
  };
}

function countUp(stage) {
  stage.querySelectorAll('.iv-num').forEach((n) => {
    const to = Number(n.dataset.to);
    if (prefersReducedMotion()) { n.textContent = String(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 900);
      n.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function typeText(stage, token) {
  const el = stage.querySelector('.iv-typed');
  const text = el.dataset.text;
  if (prefersReducedMotion()) { el.textContent = `"${text}"`; return; }
  el.textContent = '';
  let k = 0;
  const tick = () => {
    if (!el.isConnected) return;
    el.textContent = `"${text.slice(0, ++k)}${k >= text.length ? '"' : ''}`;
    if (k < text.length) setTimeout(tick, 45);
  };
  setTimeout(tick, 400);
}

/* ---------- Modo video real ---------- */
function createVideoIntro({ config, autoplay, onEnd }) {
  const video = h('video', {
    class: 'iv-video', src: config.videoSrc, poster: config.videoPoster || null,
    controls: true, playsinline: true, preload: 'metadata',
  }, config.captionsSrc ? h('track', { kind: 'captions', srclang: 'es', label: 'Español', src: config.captionsSrc, default: true }) : null);
  video.addEventListener('ended', () => onEnd({ skipped: false }));
  const el = h('section', { class: 'intro-video', 'aria-label': 'Presentación de ZAK' }, h('div', { class: 'iv-frame' }, video));
  if (autoplay && !prefersReducedMotion()) video.play().catch(() => { /* el navegador exige interacción */ });
  return {
    el,
    stop() { video.pause(); },
    skip() { video.pause(); onEnd({ skipped: true }); },
  };
}
