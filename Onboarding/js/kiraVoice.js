/**
 * Voz de Kira en vivo: la misma del CRM ZAK y del brochure (Gemini «Aoede»), servida por el
 * backend del CRM (POST /api/kira/tts). Se usa solo cuando falta el MP3 pregenerado de un texto
 * (tools/generar_voz.py), para que Kira no cambie de voz mientras tanto.
 * Devuelve la URL de un WAV en memoria, o null si el backend no responde (→ voz del navegador).
 */
import { CONFIG } from './config.js';

const cache = new Map();

function pcmToWav(pcm, rate) {
  const head = new DataView(new ArrayBuffer(44));
  const str = (o, s) => [...s].forEach((c, i) => head.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); head.setUint32(4, 36 + pcm.length, true); str(8, 'WAVE');
  str(12, 'fmt '); head.setUint32(16, 16, true); head.setUint16(20, 1, true); head.setUint16(22, 1, true);
  head.setUint32(24, rate, true); head.setUint32(28, rate * 2, true); head.setUint16(32, 2, true); head.setUint16(34, 16, true);
  str(36, 'data'); head.setUint32(40, pcm.length, true);
  return new Blob([head, pcm], { type: 'audio/wav' });
}

export function kiraVoiceUrl(text) {
  if (!CONFIG.kiraTtsUrl || !text) return Promise.resolve(null);
  if (!cache.has(text)) {
    const p = (async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      try {
        const res = await fetch(CONFIG.kiraTtsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { audioBase64, sampleRate } = await res.json();
        const bin = atob(audioBase64);
        const pcm = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);
        return URL.createObjectURL(pcmToWav(pcm, sampleRate || 24000));
      } catch {
        cache.delete(text); // reintenta la próxima vez
        return null;
      } finally {
        clearTimeout(t);
      }
    })();
    cache.set(text, p);
  }
  return cache.get(text);
}
