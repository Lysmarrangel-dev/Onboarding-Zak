/**
 * Persistencia del progreso en este navegador (localStorage).
 * Si el almacenamiento no está disponible (modo privado, bloqueado), la app sigue funcionando en memoria.
 */
import { CONFIG } from './config.js';

const VERSION = 1;

const uuid = () =>
  (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export function freshState() {
  return {
    v: VERSION,
    sessionId: uuid(),
    startedAt: null,
    screen: 'welcome',
    answers: {},   // { [questionId]: { [fieldId]: valor } }
    done: {},      // { [questionId]: true } preguntas confirmadas
    revealed: {},  // preguntas que el agente ya formuló (evita repetir «escribiendo…»)
    extras: {},    // { [questionId]: [{ role, text }] } aclaraciones y dudas en el chat
    doubts: [],    // dudas sobre ZAK que el cliente planteó
    reference: null,
    submittedAt: null,
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.v === VERSION ? { ...freshState(), ...s } : null;
  } catch {
    return null;
  }
}

let timer = null;
export function saveState(state) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
  }, 120);
}

export function clearState() {
  try { localStorage.removeItem(CONFIG.storageKey); } catch { /* nada */ }
}

export function getTheme() {
  try { return localStorage.getItem('zak-theme') || 'light'; } catch { return 'light'; }
}
export function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('zak-theme', t); } catch { /* nada */ }
}
