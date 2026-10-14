/**
 * Comunicación con Google Apps Script (aplicación web doPost).
 * Se envía como text/plain para evitar el preflight CORS, que Apps Script no admite.
 */
import { CONFIG } from './config.js';

export const isDemo = () => !CONFIG.appsScriptUrl;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(body, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(CONFIG.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.ok) {
      const err = new Error(json.error || 'Error del servidor');
      err.fatal = Boolean(json.fatal); // errores de validación: no tiene sentido reintentar
      throw err;
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

/** Ejecuta fn con reintentos automáticos (esperas de CONFIG.retryDelays). */
async function withRetry(fn, onAttempt) {
  let lastErr;
  for (let i = 0; i <= CONFIG.retryDelays.length; i++) {
    try {
      onAttempt?.(i + 1);
      return await fn();
    } catch (e) {
      lastErr = e;
      if (e.fatal || i === CONFIG.retryDelays.length) break;
      await wait(CONFIG.retryDelays[i]);
    }
  }
  throw lastErr;
}

export async function submitOnboarding(payload, onAttempt) {
  if (isDemo()) {
    await wait(1400);
    const ref = `ZAK-DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    console.info('[demo] Payload que se enviaría al Apps Script:', payload);
    return { ok: true, reference: ref, demo: true };
  }
  return withRetry(() => post({ action: 'submit', ...payload }, CONFIG.requestTimeoutMs), onAttempt);
}

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    r.readAsDataURL(file);
  });

/** Sube un archivo a la carpeta de Drive del onboarding. Devuelve { name, size, url }. */
export async function uploadFile(file, { sessionId, questionId }) {
  if (isDemo()) {
    await wait(700);
    return { name: file.name, size: file.size, url: null, demo: true };
  }
  const data = await toBase64(file);
  const res = await withRetry(() =>
    post({ action: 'upload', sessionId, questionId, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, data }, CONFIG.uploadTimeoutMs),
  );
  return { name: res.name || file.name, size: file.size, url: res.url, id: res.id };
}
