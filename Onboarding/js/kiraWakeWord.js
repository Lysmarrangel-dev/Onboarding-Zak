/**
 * "Kira" como palabra de activación: el micrófono queda escuchando con el reconocimiento de voz
 * del navegador (Web Speech API, sin costo de API) y, al oír "Kira", se abre la sesión Live de
 * Gemini. Si la frase sigue ("Kira, llévame a contactos"), el resto se le pasa como primer pedido.
 *
 * - Solo Chrome/Edge (y Safari a medias). Sin soporte, Kira sigue igual: con el clic.
 * - Arranca después del primer gesto del usuario en la página: sin ese gesto el navegador no deja
 *   sonar la voz de Kira, así que activarla antes sería en vano.
 * - Mientras Kira está en sesión, o hay otro dictado usando el micrófono, se pausa (`hold`) para
 *   no competir por el micrófono ni activarse con la propia voz de Kira.
 * - Tampoco se activa mientras suena audio de la página (o justo después): un audio que diga
 *   "soy Kira" no debe llamarla.
 *
 * Versión en JS de frontend/src/services/kiraWakeWord.ts del repo itech-crm (también en
 * brochure/src/kiraWakeWord.ts). Si cambia la lógica, cambiarla en las tres.
 */

const getCtor = () =>
  typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null;

export const wakeWordSupported = () => !!getCtor();

// "Kira" como suele transcribirlo el reconocedor en español. "quiera" no: es una palabra común.
const WAKE_RE = /(?:^|[^a-záéíóúñü])(?:kira|kyra|quira|kiira|kiara)(?![a-záéíóúñü])[\s,.;:!¡?¿-]*/i;
const AFTER_INTERIM_MS = 1400; // espera para oír el pedido que sigue a "Kira"
const AUDIO_COOLDOWN_MS = 1500;
const PREF_KEY = 'zak-kira-wake-word';

// Audio de la página sonando (o recién terminado): se registra cada <audio>/<video> al darle play.
const playingMedia = new Set();
let lastAudioAt = 0;
if (typeof HTMLMediaElement !== 'undefined' && !HTMLMediaElement.prototype.__kiraWakePatched) {
  const proto = HTMLMediaElement.prototype;
  proto.__kiraWakePatched = true;
  const play = proto.play;
  proto.play = function (...args) {
    if (!this.__kiraWakeTracked) {
      this.__kiraWakeTracked = true;
      this.addEventListener('playing', () => playingMedia.add(this));
      const off = () => { playingMedia.delete(this); lastAudioAt = Date.now(); };
      ['pause', 'ended', 'emptied', 'error'].forEach((ev) => this.addEventListener(ev, off));
    }
    return play.apply(this, args);
  };
}
const pageAudioBusy = () => {
  const busy = playingMedia.size > 0 || !!window.speechSynthesis?.speaking;
  if (busy) lastAudioAt = Date.now();
  return busy || Date.now() - lastAudioAt < AUDIO_COOLDOWN_MS;
};

export function readWakePref() {
  try { return localStorage.getItem(PREF_KEY) !== '0'; } catch { return true; }
}
export function saveWakePref(on) {
  try { localStorage.setItem(PREF_KEY, on ? '1' : '0'); } catch { /* sin almacenamiento */ }
}

/** Corre `cb` en cuanto el usuario haya tocado o tecleado algo en la página. Devuelve la cancelación. */
export function whenUserActive(cb) {
  if (navigator.userActivation?.hasBeenActive) { cb(); return () => {}; }
  const events = ['pointerdown', 'keydown'];
  const go = () => { off(); cb(); };
  const off = () => events.forEach((ev) => window.removeEventListener(ev, go, true));
  events.forEach((ev) => window.addEventListener(ev, go, true));
  return off;
}

/** handlers: { onWake(command), onListening(listening), onBlocked() } — command = lo que siguió a «Kira». */

export class KiraWakeWord {
  constructor(lang = 'es-US') {
    this.lang = lang;
    this.handlers = { onWake: () => {} };
    this.rec = null;
    this.enabled = false;
    this.holds = new Set();
    this.failures = 0;
    this.restartTimer = undefined;
    this.pendingTimer = undefined;
    this.pendingCommand = '';
    this.listening = false;
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this.sync());
  }

  setHandlers(handlers) { this.handlers = handlers; }
  enable() { this.enabled = true; this.sync(); }
  disable() { this.enabled = false; this.sync(); }
  /** Pausa la escucha mientras dure `reason` (sesión de Kira, otro dictado...). */
  hold(reason) { this.holds.add(reason); this.sync(); }
  release(reason) { if (this.holds.delete(reason)) this.sync(); }

  shouldRun() {
    return this.enabled && this.holds.size === 0 && document.visibilityState === 'visible' && !!getCtor();
  }

  sync() {
    window.clearTimeout(this.restartTimer);
    if (this.shouldRun()) this.start(); else this.stop();
  }

  setListening(on) {
    if (this.listening === on) return;
    this.listening = on;
    this.handlers.onListening?.(on);
  }

  start() {
    if (this.rec) return;
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => this.onResult(e);
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.enabled = false;
        this.handlers.onBlocked?.();
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        this.failures++;
      }
    };
    // El reconocedor se corta solo (silencio largo, ~1 min): se vuelve a abrir mientras siga activo.
    rec.onend = () => {
      if (this.rec !== rec) return;
      this.rec = null;
      this.setListening(false);
      if (this.shouldRun()) this.restartTimer = window.setTimeout(() => this.sync(), Math.min(15000, 300 * 2 ** this.failures));
    };
    this.rec = rec;
    try {
      rec.start();
      this.setListening(true);
    } catch {
      this.rec = null;
    }
  }

  stop() {
    this.clearPending();
    const rec = this.rec;
    this.rec = null;
    this.setListening(false);
    try { rec?.abort(); } catch { /* ya estaba cerrado */ }
  }

  clearPending() {
    window.clearTimeout(this.pendingTimer);
    this.pendingTimer = undefined;
    this.pendingCommand = '';
  }

  onResult(e) {
    this.failures = 0;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = String(result[0]?.transcript || '');
      const m = WAKE_RE.exec(text);
      if (!m) continue;
      if (pageAudioBusy()) return; // lo dijo un audio de la página, no la persona
      const command = text.slice(m.index + m[0].length).trim();
      if (result.isFinal) { this.fire(command); return; }
      // Resultado parcial: se espera un poco por el pedido que sigue ("Kira, abre ventas").
      this.pendingCommand = command;
      if (this.pendingTimer === undefined) this.pendingTimer = window.setTimeout(() => this.fire(this.pendingCommand), AFTER_INTERIM_MS);
    }
  }

  fire(command) {
    this.clearPending();
    // Se suelta el micrófono antes de que Kira lo pida; la app pone su propio hold en cuanto abre
    // la sesión, y este se libera solo por si la sesión no llegó a arrancar.
    this.hold('waking');
    window.setTimeout(() => this.release('waking'), 4000);
    this.handlers.onWake(command.replace(/^[\s,.;:!¡?¿-]+/, ''));
  }
}

