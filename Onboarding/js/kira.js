/**
 * Kira lee el onboarding en voz alta: la introducción de cada sección y cada pregunta.
 * - Si existe el audio generado con ElevenLabs (assets/audio/kira/<sha1 del texto>.mp3), lo usa.
 *   Ver tools/generar_voz.py --kira.
 * - Si no, usa la voz del navegador en español.
 * El cliente puede activarla o silenciarla desde el encabezado; la preferencia se guarda.
 */
const KEY = 'zak-kira-voz';
const AUDIO_DIR = 'assets/audio/kira';
const tts = 'speechSynthesis' in window ? window.speechSynthesis : null;
const audio = new Audio();
audio.preload = 'auto';
// Índice de audios generados (lo escribe tools/generar_voz.py). Sin índice → voz del navegador.
let manifest = new Set();
fetch(`${AUDIO_DIR}/manifest.json`, { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : []))
  .then((keys) => { manifest = new Set(keys); })
  .catch(() => {});
let queue = [];
let token = 0;
let voice = null;

function pickVoice() {
  if (!tts) return null;
  const vs = tts.getVoices().filter((v) => /^es/i.test(v.lang));
  const rank = (v) =>
    (/(es-(US|MX|419|VE|CO))/i.test(v.lang) ? 4 : 0) +
    (/(Google|Paulina|Mónica|Monica|Sabina|Dalia|Elvira|Paloma|Natural|Premium|Enhanced)/i.test(v.name) ? 3 : 0) +
    (/female|mujer|paulina|m[oó]nica|sabina|dalia|elvira|paloma|helena/i.test(v.name) ? 2 : 0);
  return vs.sort((a, b) => rank(b) - rank(a))[0] || null;
}
if (tts) { voice = pickVoice(); tts.addEventListener?.('voiceschanged', () => { voice = pickVoice(); }); }

export function isOn() {
  try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
}
export function setOn(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* sin almacenamiento */ }
  if (!on) stop();
}

export function stop() {
  token++;
  queue = [];
  tts?.cancel();
  audio.onended = audio.onerror = null;
  audio.pause();
}

export async function sha1(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text.normalize('NFC')));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}

/** Lee una lista de textos en orden. `force` lee aunque la voz esté desactivada (botón «Escuchar»). */
export function speak(texts, { force = false } = {}) {
  stop();
  if (!force && !isOn()) return;
  const my = token;
  queue = texts.filter(Boolean);
  const next = () => {
    if (my !== token || !queue.length) return;
    play(queue.shift(), my, next);
  };
  next();
}

async function play(text, my, done) {
  const key = await sha1(text);
  if (my !== token) return;
  const fallback = () => {
    if (my !== token) return;
    if (!tts) return done();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice?.lang || 'es-ES';
    if (voice) u.voice = voice;
    u.rate = 1.03;
    u.onend = u.onerror = () => done();
    tts.speak(u);
  };
  if (!key || !manifest.has(key)) return fallback();
  let fell = false;
  audio.onended = () => done();
  audio.onerror = () => { if (!fell) { fell = true; fallback(); } };
  audio.src = `${AUDIO_DIR}/${key}.mp3`;
  audio.play().catch((e) => { if (e?.name !== 'AbortError' && !fell) { fell = true; fallback(); } });
}
