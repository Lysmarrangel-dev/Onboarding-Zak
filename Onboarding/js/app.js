/**
 * Onboarding ZAK · aplicación principal.
 * Pantallas: bienvenida → chat → resumen → éxito.
 * El chat es una proyección del estado: se reconstruye a partir de las respuestas,
 * así editar o retroceder nunca desordena la conversación.
 */
import { CONFIG } from './config.js';
import { h, icon, prefersReducedMotion } from './dom.js';
import { matchFaq } from './faq.js';
import { createEngine } from './engine.js';
import { renderForm } from './inputs.js';
import { freshState, loadState, saveState, clearState, getTheme, setTheme } from './store.js';
import { submitOnboarding, isDemo } from './api.js';
import { createIntro } from './intro.js';
import { buildModuleSchema, buildConfigSchema } from './readiness.js';
import { computeInfo, pendingText, consultTriggered, consultRequests } from './info.js';
import * as kira from './kira.js';
import { setKnowledge } from './kiraChat.js';
import { createKiraWidget } from './kiraWidget.js';

const root = document.getElementById('app');
const clone = (x) => JSON.parse(JSON.stringify(x ?? {}));
const ASSET = {
  logoWhite: 'assets/brand/itech-logo-blanco.svg',
  logoPositive: 'assets/brand/itech-logo-positivo.svg',
  logoNegative: 'assets/brand/itech-logo-negativo.svg',
  isoGradient: 'assets/brand/itech-isotipo-degradado.svg',
  isoWhite: 'assets/brand/itech-isotipo-blanco.svg',
  kira: 'assets/brand/kira.png',
};

/** Avatar de Kira (el mismo pulpo del brochure) en sus mensajes del chat. */
const kiraAvatar = () => h('span', { class: 'avatar avatar-kira', 'aria-hidden': 'true' }, h('img', { src: ASSET.kira, alt: '' }));

let engine, faq, mapping, schema, modulesCfg, introCfg, scoringCfg, ndaCfg;
let ndaHash = ''; // huella SHA-256 del texto del acuerdo que se muestra
let state;
let introCtl = null; // controlador de la presentación audiovisual
// Estado de interfaz (no se guarda).
const ui = {
  editing: null, returnTo: null, draft: {}, errors: {}, uploads: {},
  typing: false, pending: null, clarified: {},
  drawer: false, modal: null, sending: false, sendAttempt: 0, sendError: null,
};

/* ==========================================================================
   Arranque
   ========================================================================== */
async function boot() {
  setTheme(getTheme());
  try {
    const files = ['questions', 'faq', 'form-mapping', 'modules', 'intro', 'scoring', 'nda'];
    const [q, f, m, mods, intro, scoring, nda] = await Promise.all(
      files.map((n) => fetch(`config/${n}.json`, { cache: 'no-cache' }).then((r) => r.json())),
    );
    schema = q; faq = f; mapping = m; modulesCfg = mods; introCfg = intro; scoringCfg = scoring; ndaCfg = nda;
    ndaHash = await sha256(ndaText());
    setKnowledge({ faq, modulesCfg });
    // Tras «Datos de la empresa» se inserta la selección de módulos
    // (generada desde modules.json; el Apps Script aplica las mismas reglas).
    const gen = buildModuleSchema(modulesCfg);
    // Orden: acuerdo de confidencialidad → datos de la empresa → módulos → cuestionario.
    const afterIdx = schema.questions.findLastIndex((x) => x.section === 's0') + 1;
    schema.sections.splice(schema.sections.findIndex((x) => x.id === 's0') + 1, 0, ...gen.sections);
    schema.questions.splice(afterIdx, 0, ...gen.questions);
    // Configuración técnica por módulo: antes del cierre (sección 13).
    const cfgX = buildConfigSchema(modulesCfg);
    schema.sections.splice(schema.sections.findIndex((x) => x.id === 's13'), 0, ...cfgX.sections);
    schema.questions.splice(schema.questions.findIndex((x) => x.section === 's13'), 0, ...cfgX.questions);
  } catch (e) {
    root.replaceChildren(h('div', { class: 'summary' }, h('div', { class: 'status-card error' },
      h('strong', {}, 'No se pudo cargar el cuestionario.'),
      h('p', {}, 'Abre la app desde un servidor web (por ejemplo Vercel) y vuelve a intentarlo.'))));
    return;
  }
  engine = createEngine(schema);
  state = loadState() || freshState();
  render();
}

function persist() { saveState(state); }

/* ==========================================================================
   Enrutado de pantallas
   ========================================================================== */
function render() {
  closeOverlays(false);
  ui.summaryShown = false;
  ui.confirmReset = false;
  introCtl?.stop();
  kira.stop();
  kiraW.show(['chat', 'summary'].includes(state.screen)); // Kira flotante: en el chat y en el resumen
  if (state.screen === 'chat') renderChat();
  else if (state.screen === 'summary') renderSummary();
  else if (state.screen === 'success') renderSuccess();
  else renderWelcome();
  window.scrollTo(0, state.screen === 'chat' ? document.body.scrollHeight : 0);
}

function go(screen) {
  state.screen = screen;
  persist();
  render();
}

/* ==========================================================================
   1. Bienvenida
   ========================================================================== */
function renderWelcome() {
  const started = Object.keys(state.done).length > 0;
  const nSections = schema.sections.filter((s) => s.number > 0).length; // máximo, con todos los módulos
  root.replaceChildren(
    h('main', { class: 'welcome brand-surface', id: 'main' },
      h('header', { class: 'welcome-top' },
        h('img', { class: 'logo', src: ASSET.logoWhite, alt: 'iTech' }),
        h('span', { class: 'eyebrow' }, 'ONBOARDING · ZAK · iTech')),
      h('section', { class: 'welcome-main enter', 'aria-labelledby': 'w-title' },
        h('p', { class: 'eyebrow' }, 'Implementación de ZAK'),
        h('h1', { class: 'h1', id: 'w-title' }, 'Bienvenido al onboarding de ZAK'),
        h('p', { class: 'lead' }, 'Con estos datos configuramos ZAK según la operación de tu empresa. Te haré una pregunta a la vez.'),
        h('div', { class: 'meta' },
          h('span', {}, icon('clock'), `Entre 10 y ${schema.meta.estimatedMinutes} minutos, según tus módulos`),
          h('span', {}, icon('layers'), 'Solo te preguntamos por los módulos que contrates'),
          h('span', {}, icon('shield'), 'Protegido por un acuerdo de confidencialidad'),
          h('span', {}, icon('save'), 'Tu progreso se guarda en este dispositivo')),
        h('div', { class: 'welcome-actions' },
          h('button', {
            class: 'btn btn-white', type: 'button', onclick: () => {
              state.startedAt ||= new Date().toISOString();
              ui.autoplayIntro = true; // el clic permite arrancar la presentación con voz
              go(state.submittedAt ? 'success' : Object.keys(state.done).length && !engine.nextPending(state) ? 'summary' : 'chat');
            },
          }, started ? 'Continuar onboarding' : 'Comenzar onboarding', icon('arrowRight', 'icon btn-arrow')),
          started && !ui.confirmReset ? h('button', {
            class: 'btn btn-ghost-white', type: 'button', 'data-fk': 'reset', onclick: () => { ui.confirmReset = true; renderWelcome(); document.querySelector('[data-fk="reset-no"]')?.focus(); },
          }, 'Empezar de nuevo') : null),
        started && ui.confirmReset ? resetConfirm('Se borrarán las respuestas guardadas en este dispositivo. ¿Empezar de nuevo?', renderWelcome) : null),
      h('footer', { class: 'welcome-foot' },
        h('span', { class: 'brand-text' }, 'Inteligencia que construye.'),
        h('span', {}, `© ${new Date().getFullYear()} iTech`))),
  );
}

/** Confirmación en la propia página (sin el cuadro del navegador, que bloquea la pantalla). */
function resetConfirm(text, rerender) {
  return h('div', { class: 'reset-confirm', role: 'alert' },
    h('p', {}, text),
    h('div', { class: 'welcome-actions' },
      h('button', { class: 'btn btn-white btn-sm', type: 'button', onclick: () => { clearState(); state = freshState(); render(); } }, 'Sí, borrar y empezar'),
      h('button', {
        class: 'btn btn-ghost-white btn-sm', type: 'button', 'data-fk': 'reset-no',
        onclick: () => { ui.confirmReset = false; rerender(); document.querySelector('[data-fk="reset"]')?.focus(); },
      }, 'Cancelar')));
}

/* ==========================================================================
   2. Chat
   ========================================================================== */
let logEl, dockEl, headerEl, liveEl;
const nodes = new Map(); // clave → nodo del log (reconciliación por clave)

function renderChat() {
  nodes.clear();
  headerEl = h('header', { class: 'app-header' });
  logEl = h('div', { class: 'chat-log', role: 'log', 'aria-label': 'Conversación con ' + CONFIG.agentName, 'aria-live': 'polite', 'aria-relevant': 'additions' });
  dockEl = h('div', { class: 'dock' });
  liveEl = h('div', { class: 'sr-only', 'aria-live': 'assertive' });
  root.replaceChildren(
    h('a', { class: 'skip-link', href: '#dock' }, 'Ir a la respuesta'),
    h('div', { class: 'chat-shell' }, headerEl, h('main', { id: 'main', style: { flex: '1', display: 'flex', flexDirection: 'column' } }, logEl), dockEl, liveEl),
  );
  dockEl.id = 'dock';
  refreshChat({ scroll: true });
}

/** Pregunta activa: la que se edita o la siguiente pendiente. */
function currentQuestion() {
  if (ui.editing) return engine.byId[ui.editing];
  return engine.nextPending(state);
}

const introActive = () => CONFIG.intro?.enabled && !state.introDone && !ui.editing;

function finishIntro() {
  if (state.introDone) return;
  state.introDone = true;
  persist();
  if (state.screen === 'chat') refreshChat();
}

function refreshChat({ scroll = true, focus = true } = {}) {
  if (introActive()) {
    renderHeader(engine.flow(state.answers)[0]);
    const added = renderLog(null);
    renderIntroDock();
    if (scroll) scrollChat(added);
    return;
  }
  const q = currentQuestion();
  // Primera vez que el agente formula esta pregunta: indicador «escribiendo…».
  if (q && !state.revealed[q.id] && !ui.typing) {
    ui.typing = true;
    const delay = prefersReducedMotion() ? 0 : CONFIG.typingDelayMs;
    setTimeout(() => {
      ui.typing = false;
      state.revealed[q.id] = true;
      persist();
      if (state.screen === 'chat') { refreshChat(); speakQuestion(q); }
    }, delay);
  }
  if (q && ui.draftFor !== q.id) { ui.draft = clone(state.answers[q.id]); ui.errors = {}; ui.draftFor = q.id; }
  renderHeader(q);
  const added = renderLog(q);
  renderDock(q, focus);
  if (scroll) scrollChat(added);
}

function renderHeader(q) {
  const sections = schema.sections;
  const main = activeSections();
  const flow = engine.flow(state.answers);
  const prog = engine.progress(state);
  const sec = q ? engine.sectionById[q.section] : (main[main.length - 1] || sections[0]);
  const label = sec.number === 0 ? `${sec.tag || 'INICIO'} · ${prog.pct}%` : `SECCIÓN ${sectionNumber(sec)} DE ${main.length} · ${prog.pct}%`;
  const segs = sections.map((s, i) => {
    const qs = flow.filter((x) => x.section === s.id);
    const fill = qs.length ? qs.filter((x) => state.done[x.id]).length / qs.length : 0;
    const seg = h('span', { class: 'progress-seg' }, h('i', { style: { backgroundPosition: `${(i / (sections.length - 1)) * 100}% 0` } }));
    seg.firstChild.style.setProperty('--fill', fill);
    seg.firstChild.style.setProperty('--n', sections.length);
    return seg;
  });
  const theme = document.documentElement.getAttribute('data-theme');
  headerEl.replaceChildren(
    h('div', { class: 'header-row' },
      h('img', { class: 'logo logo-positive', src: ASSET.logoPositive, alt: 'iTech' }),
      h('img', { class: 'logo logo-negative', src: ASSET.logoNegative, alt: 'iTech' }),
      h('span', { class: 'header-spacer' }),
      h('div', { class: 'header-actions' },
        infoMeter(),
        h('button', { class: 'btn-text', type: 'button', onclick: openDrawer, 'aria-haspopup': 'dialog' }, icon('list'), h('span', {}, 'Editar mis respuestas')),
        h('button', {
          class: `icon-btn kira-toggle ${kira.isOn() ? 'is-on' : ''}`, type: 'button', 'aria-pressed': String(kira.isOn()),
          'aria-label': kira.isOn() ? 'Kira lee las preguntas en voz alta. Silenciar' : 'Activar la voz de Kira', title: 'Voz de Kira',
          onclick: () => { kira.setOn(!kira.isOn()); renderHeader(currentQuestion()); if (kira.isOn()) speakQuestion(currentQuestion()); },
        }, icon(kira.isOn() ? 'volume' : 'volumeOff')),
        h('button', {
          class: 'icon-btn', type: 'button', 'aria-label': theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
          onclick: toggleTheme,
        }, icon(theme === 'dark' ? 'sun' : 'moon')))),
    h('div', { class: 'progress-wrap' },
      h('div', { class: 'progress-meta' },
        h('span', { class: 'eyebrow' }, label),
        h('span', { class: 'section-name' }, sec.title)),
      h('div', {
        class: 'progress-track', role: 'progressbar', 'aria-label': 'Avance del onboarding',
        'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': prog.pct, 'aria-valuetext': `${label}, ${sec.title}`,
      }, segs)),
  );
}

function toggleTheme() {
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  if (state.screen === 'chat') renderHeader(currentQuestion());
  if (state.screen === 'summary') renderSummary();
}

/* ---------- Log de mensajes ---------- */

function agentMsg(content, { withAvatar = true } = {}) {
  return h('div', { class: 'msg msg-agent' },
    withAvatar ? kiraAvatar() : h('span', { class: 'avatar-spacer' }),
    h('div', { class: 'bubble' }, h('span', { class: 'sr-only' }, `${CONFIG.agentName}: `), content));
}

function userMsg(content, extra, srLabel = 'Tu respuesta: ') {
  return h('div', { class: 'msg msg-user' },
    h('div', { style: { display: 'grid', gap: '4px', justifyItems: 'end', maxWidth: '100%' } },
      h('div', { class: 'bubble' }, h('span', { class: 'sr-only' }, srLabel), content),
      extra));
}

function answerContent(q) {
  const parts = engine.formatAnswer(q, state.answers);
  if (parts.length === 1) return h('p', {}, parts[0].value);
  return h('ul', { class: 'answer-lines' }, parts.map((p) => h('li', {}, h('span', { class: 'k' }, p.label), p.value)));
}

function renderLog(current) {
  const items = [];
  const push = (key, sig, build) => items.push({ key, sig, build });

  if (CONFIG.intro?.enabled) {
    // Presentación audiovisual como primer mensaje del agente.
    push('intro', 'v1', () => {
      introCtl?.stop();
      introCtl = createIntro({ config: CONFIG.intro, script: introCfg, autoplay: Boolean(ui.autoplayIntro) && !state.introDone, ended: state.introDone, onEnd: finishIntro });
      ui.autoplayIntro = false;
      return h('div', { class: 'msg msg-agent msg-media' },
        kiraAvatar(),
        h('div', { class: 'bubble bubble-media' }, introCtl.el));
    });
  } else {
    push('hello', 'v1', () => agentMsg([
      h('p', {}, `Hola, soy ${CONFIG.agentName}. Te acompaño en el onboarding de ZAK.`),
      h('p', {}, 'Con tus respuestas configuramos ZAK según la operación de tu empresa. Puedes volver atrás para editar cualquier respuesta.'),
    ]));
  }
  if (introActive()) return reconcile(items);

  let lastSection = null;
  const flow = engine.flow(state.answers);
  const pendingQ = engine.nextPending(state);
  for (const q of flow) {
    const shown = state.done[q.id] || (q === pendingQ && state.revealed[q.id]);
    if (!shown) continue;
    if (q.section !== lastSection) {
      lastSection = q.section;
      const s = engine.sectionById[q.section];
      push(`sec-${s.id}`, `${s.title}|${sectionNumber(s)}`, () => h('div', { class: 'section-card brand-surface', role: 'heading', 'aria-level': 2 },
        h('span', { class: 'num', 'aria-hidden': 'true' }, s.number === 0 ? '·' : String(sectionNumber(s)).padStart(2, '0')),
        h('div', {}, h('div', { class: 'eyebrow' }, s.number === 0 ? (s.tag === undefined ? 'ANTES DE EMPEZAR' : s.tag) : `SECCIÓN ${sectionNumber(s)}`), h('div', { class: 'title' }, s.title))));
      if (s.intro) push(`intro-${s.id}`, s.intro, () => agentMsg(h('p', {}, s.intro)));
    }
    const editing = ui.editing === q.id;
    push(`q-${q.id}`, `${q.prompt}|${editing}`, () => {
      const m = agentMsg([h('span', { class: 'q-label' }, q.label || `Pregunta ${q.id}`), h('p', {}, q.prompt), q.hint ? h('p', { class: 'hint' }, q.hint) : null,
        q.document === 'nda' ? ndaDocument() : null,
        h('button', { class: 'listen-btn', type: 'button', onclick: () => kira.speak([q.prompt], { force: true }), 'aria-label': `Escuchar la pregunta ${q.label || q.id}` }, icon('volume'), 'Escuchar'),
        q.links?.length ? h('p', { class: 'q-links' }, q.links.map((l) => h('a', { href: l.href, target: '_blank', rel: 'noopener noreferrer' }, l.label, ' ↗'))) : null]);
      m.id = `q-${q.id.replace('.', '-')}`;
      if (editing) m.classList.add('is-editing');
      return m;
    });
    (state.extras[q.id] || []).forEach((x, i) =>
      push(`x-${q.id}-${i}`, x.text, () => (x.role === 'user' ? userMsg(h('p', {}, x.text), null, 'Tu pregunta: ') : agentMsg(h('p', {}, x.text)))));
    if (state.done[q.id]) {
      const sig = JSON.stringify(state.answers[q.id]) + editing;
      push(`a-${q.id}`, sig, () => {
        const m = userMsg(answerContent(q), editing ? null : h('div', { class: 'answer-meta' },
          h('button', { class: 'edit-link', type: 'button', onclick: () => startEdit(q.id), 'aria-label': `Editar respuesta ${q.id}` }, icon('edit', 'icon'), 'Editar')));
        if (editing) m.classList.add('is-editing');
        return m;
      });
    }
  }
  if (ui.typing) {
    push('typing', 't', () => h('div', { class: 'msg msg-agent' },
      kiraAvatar(),
      h('div', { class: 'bubble typing', role: 'status', 'aria-label': `${CONFIG.agentName} está escribiendo` },
        h('span', { class: 'node' }), h('span', { class: 'node' }), h('span', { class: 'node' }))));
  }
  if (!current && !ui.typing) {
    push('done', 'd', () => agentMsg([
      h('p', {}, 'Listo, respondiste todas las preguntas. Gracias por tu tiempo.'),
      h('p', {}, 'Revisa el resumen antes de enviarlo. Desde ahí puedes editar cualquier respuesta.'),
    ]));
  }
  return reconcile(items);
}

/** Inserta/actualiza nodos por clave sin rehacer todo el log (evita relecturas del lector de pantalla). */
function reconcile(items) {
  const added = [];
  const keep = new Set();
  items.forEach(({ key, sig, build }, i) => {
    keep.add(key);
    let entry = nodes.get(key);
    if (!entry || entry.sig !== sig) {
      const node = build();
      if (!entry) { node.classList.add('enter'); added.push(node); }
      if (entry) entry.node.replaceWith(node);
      entry = { node, sig };
      nodes.set(key, entry);
    }
    if (logEl.children[i] !== entry.node) logEl.insertBefore(entry.node, logEl.children[i] || null);
  });
  for (const [key, entry] of nodes) if (!keep.has(key)) { entry.node.remove(); nodes.delete(key); }
  return added;
}

function scrollChat(added) {
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (ui.editing) {
    document.getElementById(`q-${ui.editing.replace('.', '-')}`)?.scrollIntoView({ block: 'center', behavior });
  } else if (added.length && dockEl.classList.contains('is-inline')) {
    // Formulario largo: se muestra la pregunta y el inicio del formulario, no su final.
    const last = [...logEl.querySelectorAll('.msg-agent')].pop();
    requestAnimationFrame(() => last?.scrollIntoView({ block: 'start', behavior }));
  } else if (added.length) {
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior }));
  }
}

/* ---------- Dock de respuesta ---------- */

/* ---------- Acuerdo de confidencialidad ---------- */

/** Texto canónico del acuerdo (lo que se muestra, se descarga y se firma con la huella). */
function ndaText() {
  const n = ndaCfg;
  return [`${n.title} · Versión ${n.version}`, n.subtitle, '', n.parties, '', ...n.clauses.map((c) => `${c.title}\n${c.text}`)].join('\n');
}

async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; } // crypto.subtle exige HTTPS o localhost
}

/** Registro de aceptación que llega al Form (ítem de control). */
function ndaRecord() {
  const a = state.answers['N.1'] || {};
  if (!a.acepto) return null;
  return [
    `Acuerdo: ${ndaCfg.title} v${ndaCfg.version}`,
    `Huella SHA-256: ${ndaHash || 'no disponible'}`,
    `Aceptado: ${a.acepto}`,
    `Facultad declarada: ${a.facultad || '—'}`,
    `Por: ${a.firmante || ''} · C.I. ${a.cedula || ''} · ${a.cargo || ''}`,
    `Empresa: ${state.answers['0.1']?.empresa || ''} · RIF ${state.answers['0.2']?.rif || ''}`,
    `Sesión: ${state.sessionId}`,
  ].join('\n');
}

/** El acuerdo dentro del chat: resumen en lenguaje claro y texto completo desplegable. */
function ndaDocument() {
  const n = ndaCfg;
  return h('div', { class: 'nda' },
    h('div', { class: 'nda-head' }, icon('shield'), h('div', {}, h('strong', {}, n.title), h('span', {}, `${n.subtitle} · Versión ${n.version}`))),
    h('ul', { class: 'nda-summary' }, n.summary.map((x) => h('li', {}, x))),
    h('details', { class: 'nda-full' },
      h('summary', {}, 'Leer el acuerdo completo'),
      h('div', { class: 'nda-body', tabindex: '0', 'aria-label': 'Texto completo del acuerdo' },
        h('p', {}, n.parties),
        n.clauses.map((c) => h('p', {}, h('strong', {}, c.title), ' ', c.text)))));
}


/**
 * Secciones del cuestionario que le tocan a este cliente (según sus módulos) y su número visible.
 * Si solo ve 5 secciones, se numeran 1 a 5, sin huecos.
 */
function activeSections() {
  const flowSecs = new Set(engine.flow(state.answers).map((q) => q.section));
  return schema.sections.filter((s) => s.number > 0 && flowSecs.has(s.id));
}
function sectionNumber(s) {
  if (!s || s.number === 0) return null;
  const i = activeSections().findIndex((x) => x.id === s.id);
  return i >= 0 ? i + 1 : s.number;
}

function currentInfo() {
  return computeInfo(scoringCfg, engine, state);
}

/** Medidor compacto del encabezado: cuánta información hay para configurar ZAK. */
function infoMeter() {
  const info = currentInfo();
  const pct = info.overall ?? 0;
  return h('div', {
    class: 'info-meter', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct,
    'aria-label': 'Información para configurar ZAK', 'aria-valuetext': info.overall === null ? 'Aún sin datos' : `${pct} %, ${info.level.label}`,
    title: info.overall === null ? 'Responde algunas preguntas para calcularla' : `${info.level.label}: ${info.level.client}`,
  },
  h('span', { class: 'info-lbl' }, 'Información'),
  h('span', { class: 'info-bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${pct}%` } })),
  h('span', { class: 'info-val' }, info.overall === null ? '—' : `${pct} %`));
}

/** Tarjeta del resumen: información disponible, desglose y consultoría recomendada. */
function infoCard(info) {
  return h('div', { class: 'ready-card info-card' },
    h('div', { class: 'ready-head' },
      h('div', { class: 'ready-ring', style: { '--p': info.overall }, role: 'img', 'aria-label': `Información disponible: ${info.overall} por ciento` },
        h('span', { class: 'ready-pct' }, String(info.overall), h('small', {}, '%'))),
      h('div', {},
        h('span', { class: 'eyebrow' }, 'INFORMACIÓN PARA CONFIGURAR ZAK'),
        h('h3', { class: 'ready-level' }, info.level.label),
        h('p', {}, info.level.client))),
    h('ul', { class: 'ready-mods' },
      [['Respuestas del cuestionario', info.questionnaire]].filter(([, v]) => v !== null).map(([k, v]) =>
        h('li', {}, h('span', { class: 'ready-name' }, k), h('span', { class: 'ready-bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${v}%` } })), h('span', { class: 'ready-val' }, `${v} %`)))),
    info.pending.length ? h('details', { class: 'ready-missing' },
      h('summary', {}, `Información por completar (${info.pending.length})`),
      h('ul', { class: 'info-pending' }, info.pending.map((p) => h('li', {}, h('strong', {}, `${p.id} · `), p.reasons.join(' · '))))) : null);
}

/** Dock mientras se ve la presentación: saltar o empezar. */
function renderIntroDock() {
  requestAnimationFrame(placeKira);
  dockEl.replaceChildren(h('div', { class: 'dock-card' },
    h('div', { class: 'dock-actions' },
      h('span', { class: 'field-hint' }, 'Mira la presentación o empieza cuando quieras.'),
      h('div', { class: 'right' },
        h('button', { class: 'btn btn-primary', type: 'button', 'data-fk': 'intro-start', onclick: () => { introCtl?.skip(); finishIntro(); } },
          'Empezar el onboarding', icon('arrowRight', 'icon btn-arrow'))))));
}

/** Respuesta rápida (se envía al tocar la opción): un solo campo de opción única, sin «Otro» y sin opciones que abran consultoría. */
function quickQuestion(q) {
  if (q.fields.length !== 1) return false;
  const f = q.fields[0];
  if (f.type !== 'single' || f.other) return false;
  const triggers = new Set([...scoringCfg.unknownValues, ...(scoringCfg.consultValues || []), ...(scoringCfg.lacks[q.id]?.[f.id] || [])]);
  return !f.options.some((o) => triggers.has(o));
}

function moduleName(id) {
  for (const g of modulesCfg.groups) for (const m of g.modules) if (m.id === id) return m.name;
  return null;
}

/** Kira lee la introducción de la sección (si es nueva) y la pregunta. */
function speakQuestion(q) {
  if (!q || state.screen !== 'chat' || introActive() || kiraW.voiceActive()) return;
  const flow = engine.flow(state.answers);
  const i = flow.findIndex((x) => x.id === q.id);
  const newSection = i === 0 || flow[i - 1]?.section !== q.section;
  const sec = engine.sectionById[q.section];
  kira.speak([newSection ? sec.intro : null, q.prompt]);
}

function formCtx(q, rerender) {
  return {
    engine, answers: state.answers, draft: ui.draft, errors: ui.errors, uploads: ui.uploads, sessionId: state.sessionId,
    rerender, submit: () => commit(q), msOpen: (ui.msOpen ||= {}),
    consultCheck: (qq, draft, fields) => consultTriggered(scoringCfg, qq, draft, fields),
    chosenModules: () => (state.answers['M.1']?.modulos || []).map((id) => moduleName(id)).filter(Boolean),
    clearError: (fid) => { if (ui.errors[fid]) { delete ui.errors[fid]; } },
    setError: (fid, msg) => { ui.errors[fid] = msg; rerender(); },
    // Respuesta rápida: pregunta de un solo campo de opción única sin «Otro».
    isQuick: (f) => quickQuestion(q) && !ui.editing && !ui.modal,
  };
}

function renderDock(q, focus = true) {
  requestAnimationFrame(placeKira);
  const prevKey = document.activeElement?.dataset?.fk;
  const hadFocusInDock = dockEl.contains(document.activeElement);

  if (!q) {
    dockEl.replaceChildren(h('div', { class: 'dock-card' },
      h('div', { class: 'dock-actions' },
        h('div', { class: 'left' }, h('button', { class: 'btn-text', type: 'button', onclick: () => startEdit(prevQuestionId(null)) }, icon('arrowLeft'), 'Anterior')),
        h('div', { class: 'right' }, h('button', { class: 'btn btn-primary', type: 'button', 'data-fk': 'summary', onclick: () => go('summary') }, 'Ver resumen', icon('arrowRight', 'icon btn-arrow'))))));
    if (focus) dockEl.querySelector('[data-fk="summary"]')?.focus({ preventScroll: true });
    return;
  }
  if (ui.typing && !ui.editing) { dockEl.replaceChildren(); dockEl.classList.remove('is-inline'); return; }

  const rerender = (focusKey) => { renderDock(q); if (typeof focusKey === 'string') dockEl.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true }); };
  const uploading = Object.values(ui.uploads).some((l) => l.length);
  const prevId = prevQuestionId(q.id);

  let body;
  {
    const ctx = formCtx(q, rerender);
    const hideSend = !ui.editing && quickQuestion(q);
    body = [
      ui.editing ? h('div', { class: 'dock-banner' }, icon('edit'), `Editando la pregunta ${q.id}`) : null,
      ui.pending?.kind === 'question' ? h('div', { class: 'dock-actions' },
        h('span', { class: 'field-hint' }, `¿Es una duda para ${CONFIG.agentName} o es tu respuesta?`),
        h('div', { class: 'right' },
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { const t = ui.pending.text; ui.pending = null; clearTextOf(q); renderDock(q); kiraW.ask(t); } }, 'Es una duda'),
          h('button', { class: 'btn btn-primary btn-sm', type: 'button', 'data-fk': 'is-answer', onclick: () => { ui.pending = null; commit(q, { force: true }); } }, 'Es mi respuesta'))) : null,
      h('form', {
        novalidate: true, 'aria-label': `Respuesta a la pregunta ${q.id}`,
        onsubmit: (e) => { e.preventDefault(); commit(q); },
      }, renderForm(q, ctx)),
      h('div', { class: 'dock-actions' },
        h('div', { class: 'left' },
          ui.editing
            ? h('button', { class: 'btn-text', type: 'button', onclick: cancelEdit }, icon('close'), 'Cancelar')
            : prevId ? h('button', { class: 'btn-text', type: 'button', onclick: () => startEdit(prevId) }, icon('arrowLeft'), 'Anterior') : null),
        h('div', { class: 'right' },
          h('span', { class: 'kbd-hint' }, q.fields.some((f) => f.type === 'textarea') ? 'Ctrl + Enter para enviar' : ''),
          hideSend ? null : h('button', {
            class: 'btn btn-primary', type: 'button', disabled: uploading, 'data-fk': 'send',
            onclick: () => commit(q),
          }, uploading ? 'Subiendo archivo…' : ui.editing ? 'Guardar' : ui.clarified[q.id] ? 'Enviar así' : 'Enviar', icon(ui.editing ? 'save' : 'arrowRight', 'icon btn-arrow')))),
    ];
  }
  // Conservar la posición de lectura del panel al re-renderizar (evita el salto hacia arriba).
  const prevScroll = dockEl.querySelector('.dock-card')?.scrollTop || 0;
  const pageScroll = window.scrollY;
  dockEl.replaceChildren(h('div', { class: 'dock-card' }, body));
  // Formularios largos (tablas, KPIs, usuarios…): el panel deja de flotar sobre la conversación
  // y pasa a ser parte de la página, que se desplaza con normalidad. Los cortos siguen fijos abajo.
  dockEl.classList.toggle('is-inline', dockEl.firstChild.scrollHeight > window.innerHeight * 0.45);
  if (ui.dockFor === q.id) { dockEl.querySelector('.dock-card').scrollTop = prevScroll; window.scrollTo(0, pageScroll); }
  ui.dockFor = q.id;

  // Restaurar el foco tras re-renderizar (o llevarlo al primer campo en una pregunta nueva).
  const target = (prevKey && hadFocusInDock && dockEl.querySelector(`[data-fk="${CSS.escape(prevKey)}"]`)) ||
    (focus && !hadFocusInDock ? firstFocusable() : null);
  if (target && (hadFocusInDock || focus)) target.focus({ preventScroll: true });
}

function firstFocusable() {
  const invalid = dockEl.querySelector('[aria-invalid="true"]');
  if (invalid) return invalid;
  // En móvil no abrimos el teclado automáticamente.
  if (window.matchMedia('(pointer: coarse)').matches) return null;
  return dockEl.querySelector('input:not([type=file]), textarea, select, .chip, [data-fk="send"]');
}

function clearTextOf(q) {
  for (const f of q.fields) if (f.type === 'textarea') ui.draft[f.id] = '';
}

function prevQuestionId(currentId) {
  const flow = engine.flow(state.answers).filter((x) => state.done[x.id]);
  if (!currentId) return flow[flow.length - 1]?.id || null;
  const all = engine.flow(state.answers);
  const idx = all.findIndex((x) => x.id === currentId);
  for (let i = idx - 1; i >= 0; i--) if (state.done[all[i].id]) return all[i].id;
  return null;
}

function startEdit(id) {
  if (!id) return;
  ui.editing = id; ui.draftFor = null; ui.pending = null;
  refreshChat({ scroll: true });
}

function cancelEdit() {
  ui.editing = null; ui.draftFor = null;
  if (ui.returnTo === 'summary') { ui.returnTo = null; go('summary'); return; }
  refreshChat();
}

/* ---------- Confirmar respuesta ---------- */

function normalizeDraft(q, draft) {
  const out = clone(draft);
  for (const f of q.fields) {
    if (['users', 'plans'].includes(f.type) && Array.isArray(out[f.id]))
      out[f.id] = out[f.id].filter((r) => Object.values(r).some((v) => String(v || '').trim()))
        .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v).trim()])));
    if (typeof out[f.id] === 'string') out[f.id] = out[f.id].trim();
  }
  return out;
}

function commit(q, { force = false, fromModal = false } = {}) {
  const draft = normalizeDraft(q, ui.draft);
  const errors = engine.validate(q, draft, state.answers);
  if (Object.keys(errors).length) {
    ui.errors = errors;
    if (fromModal) renderModal(); else renderDock(q, true);
    const first = (fromModal ? document.getElementById('s-edit') : dockEl)?.querySelector('[aria-invalid="true"], .field-error');
    first?.scrollIntoView({ block: 'nearest' });
    announce(Object.values(errors)[0]);
    return;
  }
  // Aclaración amable (una sola vez por pregunta): texto ambiguo o que parece una duda.
  if (!force && !fromModal && !ui.clarified[q.id]) {
    const soft = engine.softCheck(q, draft, state.answers);
    if (soft?.kind === 'question') { ui.pending = soft; renderDock(q); dockEl.querySelector('[data-fk="is-answer"]')?.focus(); return; }
    if (soft?.kind === 'vague') {
      ui.clarified[q.id] = true;
      addExtra(q.id, 'agent', '¿Puedes darme un poco más de detalle? Nos ayuda a configurar ZAK con precisión. Si prefieres, envíala así.');
      refreshChat();
      return;
    }
  }

  const before = JSON.stringify(state.answers[q.id] || null);
  state.answers[q.id] = draft;
  state.done[q.id] = true;
  state.revealed[q.id] = true;
  // Si cambian los datos de los que depende otra pregunta (p. ej. la lista de usuarios), hay que revisarla.
  if (before !== 'null' && before !== JSON.stringify(draft)) {
    for (const other of engine.questions)
      if (other.fields.some((f) => f.source?.q === q.id) && state.done[other.id]) delete state.done[other.id];
  }
  ui.errors = {}; ui.pending = null; ui.draftFor = null;
  const wasEditing = ui.editing;
  ui.editing = null;
  persist();

  if (fromModal) { ui.modal = null; renderSummary(); return; }
  if (wasEditing && ui.returnTo === 'summary') { ui.returnTo = null; go('summary'); return; }
  announce('Respuesta guardada.');
  refreshChat();
}

function addExtra(qid, role, text) {
  (state.extras[qid] ||= []).push({ role, text });
  persist();
}

function announce(text) {
  if (!liveEl) return;
  liveEl.textContent = '';
  setTimeout(() => { liveEl.textContent = text; }, 30);
}

/* ---------- Kira flotante (dudas sobre la pregunta o sobre ZAK) ---------- */

function faqAnswer(text) {
  const hit = matchFaq(faq, text);
  return hit ? `${hit.answer} Sigamos con la pregunta ${currentQuestion()?.id || ''}.`.trim() : faq.fallback;
}

/** Contexto de la conversación para Kira: empresa, módulos elegidos y la pregunta en pantalla. */
function kiraContext(q) {
  return {
    question: q,
    section: q ? engine.sectionById[q.section]?.title : null,
    company: state.answers['0.1']?.empresa || '',
    modules: (state.answers['M.1']?.modulos || []).map((id) => moduleName(id)).filter(Boolean),
  };
}

/* ---------- Kira por voz: llena la pregunta en pantalla y lee el acuerdo ---------- */

// Campos que Kira puede llenar con lo que dice el cliente. Archivos, tablas, planes, usuarios y
// KPIs se llenan en pantalla.
const VOICE_TYPES = new Set(['text', 'textarea', 'email', 'phone', 'url', 'taxid', 'idcard', 'number', 'date', 'time',
  'single', 'select', 'multi', 'multiselect', 'modules', 'consent', 'grid']);
const CONSULT_FIELD = '__consultoria';
const CONSULT_OPTIONS = ['Sí, quiero consultoría', 'No, por ahora'];
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9@.+-]+/g, ' ').replace(/[\s.]+$/, '').trim();

/** La opción que dijo el cliente: exacta primero; si no, la parecida más larga («No sé» antes que «No»). */
function matchOption(options, said) {
  const n = fold(said);
  if (!n) return null;
  const longest = [...options].sort((a, b) => fold(b).length - fold(a).length);
  return options.find((o) => fold(o) === n)
    || longest.find((o) => fold(o).startsWith(n) || n.startsWith(fold(o)))
    || longest.find((o) => fold(o).includes(n)) || null;
}

const allModules = () => modulesCfg.groups.flatMap((g) => g.modules);
const optionLabel = (o) => (typeof o === 'string' ? o : o.label);

function voiceOptions(f) {
  if (f.type === 'single' || f.type === 'multi') return f.other ? [...f.options, 'Otro'] : f.options;
  if (f.type === 'select') return f.options;
  if (f.type === 'multiselect') return f.optionsFrom === 'modules' ? kiraContext(null).modules : f.options.map(optionLabel);
  if (f.type === 'modules') return allModules().map((m) => m.name);
  if (f.type === 'grid') return f.states ? f.states.map((s) => s.label) : f.columns;
  return null;
}

/** Valor actual del borrador, en texto (para que Kira no pise lo que el cliente ya escribió). */
function draftText(f) {
  const v = ui.draft[f.id];
  if (f.type === 'modules') return (v || []).map((id) => moduleName(id)).filter(Boolean).join(', ');
  if (f.type === 'consent') return v ? 'marcada' : '';
  if (f.type === 'grid') return Object.entries(v || {}).map(([r, c]) => `${r}: ${c}`).join(' · ');
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', ');
  const other = ui.draft[`${f.id}__other`];
  return [v, other && (v === 'Otro' || (Array.isArray(v) && v.includes('Otro'))) ? `(${other})` : ''].filter(Boolean).join(' ');
}

/** La pregunta en pantalla para Kira: campos visibles, opciones, lo que ya hay y qué se llena por voz. */
function voiceQuestion() {
  if (state.screen === 'summary') return { estado: 'El cliente ya respondió el cuestionario y está en el resumen: puede revisarlo y tocar «Enviar onboarding».' };
  if (state.screen !== 'chat') return { estado: 'El cliente todavía no está en el cuestionario.' };
  // Hablar con Kira es empezar: si la presentación sigue, se salta.
  if (introActive()) { introCtl?.skip(); finishIntro(); }
  const q = currentQuestion();
  if (!q) return { estado: 'Ya respondió todas las preguntas: que toque «Ver resumen» para revisar y enviar.' };
  const draft = normalizeDraft(q, ui.draft);
  const campos = engine.visibleFields(q, state.answers, ui.draft).filter((f) => f.type !== 'notice').map((f) => ({
    id: f.id,
    tipo: f.type,
    etiqueta: f.label,
    obligatorio: f.required !== false,
    opciones: voiceOptions(f) || undefined,
    filas: f.type === 'grid' ? f.rows : undefined,
    valorActual: draftText(f) || '',
    porVoz: VOICE_TYPES.has(f.type) ? 'sí' : 'no: se completa en pantalla',
  }));
  if (consultTriggered(scoringCfg, q, draft, engine.visibleFields(q, state.answers, ui.draft)))
    campos.push({ id: CONSULT_FIELD, tipo: 'single', etiqueta: '¿Quiere que un consultor de iTech lo ayude con esto?', obligatorio: false, opciones: CONSULT_OPTIONS, valorActual: ui.draft[CONSULT_FIELD] || '', porVoz: 'sí' });
  return {
    pregunta: q.id,
    seccion: engine.sectionById[q.section]?.title || '',
    enunciado: q.prompt,
    aclaracion: q.hint || undefined,
    esAcuerdo: q.document === 'nda' || undefined,
    campos,
  };
}

/** Pone en el campo lo que dijo el cliente, con el formato que pide el formulario. */
function voiceFill({ field, value, values } = {}) {
  const q = state.screen === 'chat' ? currentQuestion() : null;
  if (!q) return { ok: false, error: 'No hay una pregunta abierta en pantalla.' };
  const d = ui.draft;
  const list = (Array.isArray(values) && values.length ? values : String(value ?? '').split(/\s*[,;]\s*/)).map((s) => String(s).trim()).filter(Boolean);
  const raw = String(value ?? list.join(', ')).trim();

  if (field === CONSULT_FIELD) {
    const m = matchOption(CONSULT_OPTIONS, raw);
    if (!m) return { ok: false, error: `Opciones: ${CONSULT_OPTIONS.join(' / ')}` };
    d[CONSULT_FIELD] = m;
    renderDock(q, false);
    return { ok: true, campo: 'Consultoría', valor: m };
  }

  const fields = engine.visibleFields(q, state.answers, d).filter((f) => f.type !== 'notice');
  const f = fields.find((x) => x.id === field);
  if (!f) return { ok: false, error: `La pregunta ${q.id} no tiene el campo «${field}». Sus campos son: ${fields.map((x) => x.id).join(', ')}.` };
  if (!VOICE_TYPES.has(f.type)) return { ok: false, error: 'Este campo se completa en pantalla: pídele al cliente que lo llene y te avise.' };
  const opts = voiceOptions(f);

  switch (f.type) {
    case 'single':
    case 'select': {
      const m = matchOption(opts, raw);
      if (m) d[f.id] = m;
      else if (f.other && raw) { d[f.id] = 'Otro'; d[`${f.id}__other`] = raw; }
      else return { ok: false, error: `«${raw}» no es una de las opciones: ${opts.join(' / ')}.` };
      break;
    }
    case 'multi':
    case 'multiselect':
    case 'modules': {
      const picked = [];
      const extra = [];
      for (const s of list) { const m = matchOption(opts, s); if (m) picked.push(m); else extra.push(s); }
      if (extra.length && !(f.type === 'multi' && f.other)) return { ok: false, error: `No encontré: ${extra.join(', ')}. Opciones: ${opts.join(' / ')}.` };
      if (extra.length) { picked.push('Otro'); d[`${f.id}__other`] = extra.join(', '); }
      const unique = [...new Set(picked)];
      d[f.id] = f.type === 'modules' ? unique.map((name) => allModules().find((m) => m.name === name)?.id).filter(Boolean) : unique;
      break;
    }
    case 'consent':
      d[f.id] = /^(si|true|acepto|acepta|de acuerdo|1)\b/.test(fold(raw)) ? new Date().toISOString() : '';
      break;
    case 'grid': {
      const grid = (d[f.id] ||= {});
      for (const pair of list) {
        const [rowSaid, colSaid] = pair.split(/\s*:\s*/);
        const row = matchOption(f.rows, rowSaid);
        const col = matchOption(opts, colSaid);
        if (!row || !col) return { ok: false, error: `Usa «fila: opción». Filas: ${f.rows.join(' / ')}. Opciones: ${opts.join(' / ')}.` };
        grid[row] = col;
      }
      break;
    }
    case 'idcard': {
      const m = raw.toUpperCase().replace(/[\s.]/g, '').match(/^([VE])-?(\d{6,9})$/);
      d[f.id] = m ? `${m[1]}-${m[2]}` : raw;
      break;
    }
    case 'taxid': {
      const m = raw.toUpperCase().replace(/[\s.]/g, '').match(/^([VEJPG])-?(\d{7,9})-?(\d)$/);
      d[f.id] = m ? `${m[1]}-${m[2]}-${m[3]}` : raw;
      break;
    }
    case 'email':
      d[f.id] = raw.replace(/\s+arroba\s+/gi, '@').replace(/\s+punto\s+/gi, '.').replace(/\s+/g, '').toLowerCase();
      break;
    case 'number':
      d[f.id] = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
      break;
    default:
      d[f.id] = raw;
  }
  delete ui.errors[f.id];
  renderDock(q, false);
  const problem = engine.validate(q, normalizeDraft(q, d), state.answers)[f.id];
  return { ok: true, campo: f.label, valor: draftText(f), ...(problem ? { revisar: problem } : {}) };
}

/** Envía la respuesta (como el botón «Enviar») y devuelve la siguiente pregunta o lo que falta. */
function voiceSubmit() {
  const q = state.screen === 'chat' ? currentQuestion() : null;
  if (!q) return { ok: false, error: 'No hay una pregunta abierta en pantalla.' };
  commit(q, { force: true });
  if (currentQuestion()?.id === q.id && Object.keys(ui.errors).length) {
    const label = (id) => q.fields.find((f) => f.id === id)?.label || id;
    return { ok: false, faltaCorregir: Object.entries(ui.errors).map(([id, msg]) => `${label(id)}: ${msg}`) };
  }
  return { ok: true, guardada: q.id, siguiente: voiceQuestion() };
}

/** El acuerdo en partes, para que Kira lo lea completo en voz alta sin turnos eternos. */
function ndaParts() {
  const n = ndaCfg;
  const parts = [];
  for (let i = 0; i < n.clauses.length; i += 4) parts.push(n.clauses.slice(i, i + 4).map((c) => `${c.title}. ${c.text}`).join('\n'));
  parts[0] = `${n.title}. ${n.subtitle}. Versión ${n.version}.\n${n.parties}\n${parts[0]}`;
  return parts;
}

function voiceReadNda({ parte } = {}) {
  const parts = ndaParts();
  const i = Math.min(parts.length, Math.max(1, Number(parte) || 1));
  // Mientras Kira lo lee, el texto completo queda abierto en pantalla.
  const full = logEl?.querySelector('.nda-full');
  if (full) { full.open = true; if (i === 1) full.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); }
  return {
    parte: i,
    de: parts.length,
    texto: parts[i - 1],
    despues: i < parts.length
      ? `Léela textual y, sin detenerte, llama a read_nda con parte ${i + 1}.`
      : 'Era la última parte. Ahora pídele nombre y apellido, cédula y cargo, y que acepte en voz alta el acuerdo y su facultad para aceptarlo.',
  };
}

const kiraW = createKiraWidget({
  avatar: ASSET.kira,
  getContext: () => kiraContext(state?.screen === 'chat' ? currentQuestion() : null),
  fallback: (text) => faqAnswer(text),
  voiceForm: { question: voiceQuestion, fill: voiceFill, submit: voiceSubmit, readNda: voiceReadNda },
  // Las dudas escritas llegan al equipo con el envío. Lo dicho por voz no: ahora son respuestas
  // del formulario (cédula, correo...), no dudas.
  onDoubt: (text) => {
    if (!state || !text) return;
    state.doubts.push({ qid: (state.screen === 'chat' && currentQuestion()?.id) || 'resumen', text, at: new Date().toISOString() });
    persist();
  },
  onVoice: (on) => { if (on) kira.stop(); }, // la narración de las preguntas se calla durante la llamada
  speak: (text) => { if (!kiraW.voiceActive()) kira.speak([text]); },
});

/** El botón de Kira se apoya sobre el panel de respuesta o la barra del resumen, sin taparlos. */
function placeKira() {
  if (window.innerWidth >= 1180) { kiraW.setBottom(20); return; } // en pantallas anchas no se cruzan
  let h0 = 0;
  if (state.screen === 'chat' && dockEl?.isConnected) {
    h0 = dockEl.classList.contains('is-inline')
      ? dockEl.querySelector('.dock-card > .dock-actions:last-child')?.offsetHeight || 0
      : dockEl.offsetHeight;
  } else if (state.screen === 'summary') {
    h0 = document.querySelector('.summary-bar')?.offsetHeight || 0;
  }
  kiraW.setBottom(h0 + 12);
}
window.addEventListener('resize', () => placeKira());


/* ---------- Panel «Mis respuestas» ---------- */

function openDrawer() {
  const trigger = document.activeElement;
  const cq = currentQuestion();
  const flow = engine.flow(state.answers);
  const close = () => { closeOverlays(); trigger?.focus?.(); };
  const panel = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'drawer-title' },
    h('div', { class: 'drawer-head' },
      h('h2', { class: 'h2', id: 'drawer-title', style: { fontSize: '1.3rem' } }, 'Editar mis respuestas'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onclick: close }, icon('close'))),
    h('div', { class: 'drawer-body' },
      schema.sections.map((s) => {
        const qs = flow.filter((x) => x.section === s.id);
        if (!qs.length) return null;
        return h('div', { class: 'drawer-section' },
          h('h3', {}, s.number === 0 ? s.title : `${sectionNumber(s)}. ${s.title}`),
          qs.map((x) => h('button', {
            class: 'drawer-item', type: 'button', disabled: !state.done[x.id],
            onclick: () => { closeOverlays(); startEdit(x.id); },
          },
          h('span', { class: `dot-state ${state.done[x.id] ? 'done' : ''} ${cq?.id === x.id ? 'current' : ''}` }),
          h('span', { class: 'qid' }, x.id),
          h('span', { class: 'qtext' }, x.prompt))));
      })));
  const scrim = h('div', { class: 'scrim', onclick: close });
  document.body.append(scrim, panel);
  trapFocus(panel, close);
  panel.querySelector('button')?.focus();
}

function closeOverlays(restore = true) {
  document.querySelectorAll('.scrim, .drawer, .modal').forEach((n) => n.remove());
  document.removeEventListener('keydown', trapHandler);
  if (restore === false) ui.modal = null;
}

let trapHandler = null;
function trapFocus(container, onEscape) {
  document.removeEventListener('keydown', trapHandler);
  trapHandler = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onEscape(); return; }
    if (e.key !== 'Tab') return;
    const f = [...container.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    const [first, last] = [f[0], f[f.length - 1]];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', trapHandler);
}

/* ==========================================================================
   3. Resumen
   ========================================================================== */
function pendingQuestions() {
  return engine.flow(state.answers).filter((q) => !state.done[q.id]);
}

let honeypot = '';
function renderSummary() {
  requestAnimationFrame(placeKira);
  document.querySelectorAll('.scrim, .modal').forEach((n) => n.remove());
  const flow = engine.flow(state.answers);
  const pending = pendingQuestions();
  const theme = document.documentElement.getAttribute('data-theme');
  const main = activeSections();

  const animate = !ui.summaryShown; // la entrada animada de las tarjetas, solo la primera vez
  ui.summaryShown = true;
  const cards = schema.sections.map((s, idx) => {
    const qs = flow.filter((x) => x.section === s.id);
    if (!qs.length) return null;
    return h('section', { class: 's-card', style: animate ? { animationDelay: `${Math.min(idx * 30, 300)}ms` } : { animation: 'none' }, 'aria-labelledby': `sum-${s.id}` },
      h('div', { class: 's-card-head' },
        h('span', { class: 'num', 'aria-hidden': 'true' }, s.number === 0 ? '·' : String(sectionNumber(s))),
        h('h2', { id: `sum-${s.id}` }, s.title)),
      qs.map((q) => {
        const done = state.done[q.id];
        const parts = done ? engine.formatAnswer(q, state.answers) : [];
        if (ui.modal === q.id) return h('div', { class: 's-item s-editing', id: 's-edit' });
        return h('div', { class: `s-item ${done ? '' : 'pending'}` },
          h('div', { class: 'q' }, `${q.id} · ${q.prompt}`),
          h('div', { class: 'a' }, done
            ? parts.map((p, i) => [i ? '\n' : '', parts.length > 1 ? h('span', { class: 'k' }, `${p.label}: `) : null, p.value])
            : 'Pendiente de respuesta'),
          h('button', { class: 'edit-link', type: 'button', onclick: () => openModal(q.id), 'aria-label': `${done ? 'Editar' : 'Responder'} pregunta ${q.id}` },
            icon('edit', 'icon'), done ? 'Editar' : 'Responder'));
      }));
  });

  const statusBox = ui.sending
    ? h('div', { class: 'status-card', role: 'status' },
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
        h('span', { class: 'typing', style: { padding: 0 } }, h('span', { class: 'node' }), h('span', { class: 'node' }), h('span', { class: 'node' })),
        h('strong', {}, ui.sendAttempt > 1 ? `Reintentando el envío (intento ${ui.sendAttempt})…` : 'Enviando tus respuestas…')))
    : ui.sendError
      ? h('div', { class: 'status-card error', role: 'alert' },
        h('strong', {}, 'No pudimos enviar tus respuestas.'),
        h('p', {}, 'Tus respuestas siguen guardadas en este dispositivo. Revisa tu conexión y vuelve a intentarlo.'),
        h('p', { class: 'field-hint' }, `Detalle: ${ui.sendError}`),
        h('div', {}, h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: submit }, 'Reintentar')))
      : null;

  root.replaceChildren(
    h('header', { class: 'app-header' },
      h('div', { class: 'header-row' },
        h('img', { class: 'logo logo-positive', src: ASSET.logoPositive, alt: 'iTech' }),
        h('img', { class: 'logo logo-negative', src: ASSET.logoNegative, alt: 'iTech' }),
        h('span', { class: 'header-spacer' }),
        h('div', { class: 'header-actions' },
        infoMeter(),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', onclick: toggleTheme }, icon(theme === 'dark' ? 'sun' : 'moon')))),
      h('div', { class: 'progress-wrap' },
        h('div', { class: 'progress-meta' }, h('span', { class: 'eyebrow' }, `RESUMEN · ${main.length} SECCIONES · ${engine.progress(state).pct}%`)),
        h('div', { class: 'progress-track' }, schema.sections.map((_, i, all) => {
          const seg = h('span', { class: 'progress-seg' }, h('i', { style: { backgroundPosition: `${(i / (all.length - 1)) * 100}% 0` } }));
          seg.firstChild.style.setProperty('--n', all.length);
          seg.firstChild.style.setProperty('--fill', 1);
          return seg;
        })))),
    h('main', { class: 'summary', id: 'main' },
      h('div', { class: 'summary-head' },
        h('span', { class: 'eyebrow' }, 'ÚLTIMO PASO'),
        h('h1', { class: 'h2' }, 'Revisa tus respuestas'),
        h('p', {}, 'Confirma que todo está correcto. Puedes editar cualquier respuesta antes de enviarla al equipo de iTech.')),
      (() => {
        const info = currentInfo();
        return info.overall !== null ? h('section', { class: 's-card s-ready', 'aria-label': 'Información para configurar ZAK' }, infoCard(info)) : null;
      })(),
      pending.length ? h('div', { class: 'status-card error', role: 'alert', style: { marginBottom: '16px' } },
        h('strong', {}, pending.length === 1 ? 'Falta 1 respuesta.' : `Faltan ${pending.length} respuestas.`),
        h('p', {}, 'Tus cambios abrieron preguntas nuevas. Respóndelas para poder enviar.')) : null,
      h('div', { class: 'summary-grid' }, cards),
      // Campo trampa anti-spam: invisible para personas.
      h('div', { 'aria-hidden': 'true', style: { position: 'absolute', left: '-9999px' } },
        h('label', {}, 'No completar', h('input', { tabindex: '-1', autocomplete: 'off', oninput: (e) => { honeypot = e.target.value; } }))),
      statusBox),
    h('div', { class: 'summary-bar' },
      h('div', { class: 'summary-bar-inner' },
        h('button', { class: 'btn-text', type: 'button', onclick: () => go('chat') }, icon('arrowLeft'), 'Volver al chat'),
        h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
          isDemo() ? h('span', { class: 'demo-badge', title: 'Configura appsScriptUrl en js/config.js' }, 'Modo demostración') : null,
          h('button', { class: 'btn btn-primary', type: 'button', disabled: ui.sending || pending.length > 0, onclick: submit },
            ui.sending ? 'Enviando…' : 'Confirmar y enviar', icon('arrowRight', 'icon btn-arrow'))))),
  );
  if (ui.modal) renderModal({ reveal: true });
}

/** Editar desde el resumen: el formulario se abre dentro de la tarjeta, sin ventana encima. */
function openModal(qid) {
  ui.modal = qid;
  ui.draftFor = null;
  ui.draft = clone(state.answers[qid]);
  ui.errors = {};
  renderSummary();
}

function closeInlineEdit() {
  const qid = ui.modal;
  ui.modal = null; ui.errors = {};
  renderSummary();
  document.querySelector(`[aria-label$="pregunta ${CSS.escape(qid)}"]`)?.focus({ preventScroll: true });
}

function renderModal({ reveal = false } = {}) {
  const box = document.getElementById('s-edit');
  const q = engine.byId[ui.modal];
  if (!box || !q) return;
  const prevKey = box.contains(document.activeElement) ? document.activeElement?.dataset?.fk : null;
  const pageScroll = window.scrollY;
  const ctx = formCtx(q, () => renderModal());
  const uploading = Object.values(ui.uploads).some((l) => l.length);
  box.replaceChildren(
    h('div', { class: 'q' }, `${q.id} · ${q.prompt}`),
    ...(q.hint ? [h('p', { class: 'field-hint' }, q.hint)] : []),
    h('form', {
      novalidate: true, 'aria-label': `Editar la pregunta ${q.id}`,
      onsubmit: (e) => { e.preventDefault(); commit(q, { fromModal: true }); },
      onkeydown: (e) => { if (e.key === 'Escape') { e.preventDefault(); closeInlineEdit(); } },
    }, renderForm(q, { ...ctx, submit: () => commit(q, { fromModal: true }), alwaysLabel: false })),
    h('div', { class: 'dock-actions' },
      h('div', { class: 'left' }, h('button', { class: 'btn-text', type: 'button', onclick: closeInlineEdit }, icon('close'), 'Cancelar')),
      h('div', { class: 'right' }, h('button', { class: 'btn btn-primary btn-sm', type: 'button', disabled: uploading, 'data-fk': 'save', onclick: () => commit(q, { fromModal: true }) }, uploading ? 'Subiendo archivo…' : 'Guardar', icon('save', 'icon')))));
  if (reveal) {
    box.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    const first = box.querySelector('[aria-invalid="true"]') || (window.matchMedia('(pointer: coarse)').matches ? null : box.querySelector('input:not([type=file]), textarea, select, .chip'));
    first?.focus({ preventScroll: true });
    return;
  }
  window.scrollTo(0, pageScroll);
  if (prevKey) box.querySelector(`[data-fk="${CSS.escape(prevKey)}"]`)?.focus({ preventScroll: true });
}

/* ---------- Envío ---------- */

function buildPayload() {
  const flow = engine.flow(state.answers);
  return {
    sessionId: state.sessionId,
    startedAt: state.startedAt,
    clientSubmittedAt: new Date().toISOString(),
    website: honeypot, // trampa anti-spam
    company: state.answers['0.1']?.empresa || '',
    legalName: state.answers['0.2']?.razonSocial || '',
    taxId: state.answers['0.2']?.rif || '',
    // Archivos ya subidos a Drive: el Apps Script los archiva juntos en la carpeta del cliente («RIF de clientes»).
    rifFile: state.answers['0.2']?.comprobante?.id ? { id: state.answers['0.2'].comprobante.id } : null,
    contactsFile: contactsFileRef(),
    contactName: state.answers['0.3']?.contacto || '',
    contactEmail: state.answers['0.4']?.correo || '',
    answers: flow.map((q) => ({
      id: q.id,
      itemId: mapping.items?.[q.id] || null,
      type: q.formType,
      section: engine.sectionById[q.section].title,
      title: q.formTitle,
      value: engine.serialize(q, state.answers),
    })),
    doubts: state.doubts.map((d) => `[${d.qid}] ${d.text}`).join('\n'),
    info: infoPayload(),
    nda: ndaRecord(),
    consulting: consultRequests(engine, state).join('\n'),
  };
}

/** Base de contactos adjunta en la 1.5, solo si la pregunta sigue visible y dice que hay base. */
function contactsFileRef() {
  const a = state.answers['1.5'];
  const file = [].concat(a?.base || [])[0];
  if (!file?.id || a.tiene !== 'Sí' || !engine.isVisible(engine.byId['1.5'], state.answers)) return null;
  return { id: file.id };
}

/** Nivel de información y consultoría recomendada, para el Form y el correo. */
function infoPayload() {
  const info = currentInfo();
  if (info.overall === null) return null;
  return {
    overall: info.overall,
    consulting: info.level.label,
    detail: `Cuestionario: ${info.questionnaire ?? '—'} %`,
    pending: pendingText(info) || 'Ninguna',
  };
}

async function submit() {
  if (ui.sending || pendingQuestions().length) return;
  ui.sending = true; ui.sendError = null; ui.sendAttempt = 1;
  renderSummary();
  try {
    const res = await submitOnboarding(buildPayload(), (n) => {
      ui.sendAttempt = n;
      if (n > 1) renderSummary();
    });
    state.reference = res.reference;
    state.submittedAt = new Date().toISOString();
    state.demo = Boolean(res.demo);
    ui.sending = false;
    go('success');
  } catch (e) {
    ui.sending = false;
    ui.sendError = e.name === 'AbortError' ? 'El servidor tardó demasiado en responder.'
      : e instanceof TypeError ? 'No hay conexión con el servidor.' : e.message || 'Error de red';
    renderSummary();
    document.querySelector('.status-card.error button')?.focus();
  }
}

/* ==========================================================================
   4. Éxito
   ========================================================================== */
function renderSuccess() {
  const email = state.answers['0.4']?.correo;
  root.replaceChildren(
    h('main', { class: 'success brand-surface', id: 'main' },
      h('header', { class: 'welcome-top' },
        h('img', { class: 'logo', src: ASSET.logoWhite, alt: 'iTech' }),
        h('span', { class: 'eyebrow' }, 'ONBOARDING · ZAK · iTech')),
      h('section', { class: 'success-main', 'aria-labelledby': 's-title' },
        h('div', { class: 'success-mark', 'aria-hidden': 'true' }, h('img', { src: ASSET.isoWhite, alt: '' })),
        h('h1', { class: 'h1', id: 's-title', tabindex: '-1', style: { fontSize: 'clamp(2rem, 5vw, 3.2rem)' } }, 'Onboarding enviado'),
        h('p', { class: 'lead', style: { margin: 0, color: 'rgba(255,255,255,.95)' } }, 'Gracias. Con esta información empezamos a configurar ZAK para tu empresa.'),
        h('div', { class: 'ref-box' },
          h('span', { class: 'eyebrow' }, 'NÚMERO DE REFERENCIA'),
          h('span', { class: 'ref' }, state.reference || '—')),
        state.demo ? h('span', { class: 'demo-badge' }, 'Modo demostración: no se envió al Google Form') : null,
        h('div', { class: 'next-steps' },
          h('h2', {}, 'Próximos pasos'),
          h('ol', {},
            h('li', {}, 'Un consultor de iTech revisa tus respuestas.'),
            h('li', {}, email ? `Te escribimos a ${email} para coordinar los siguientes pasos.` : 'Te contactamos para coordinar los siguientes pasos.'),
            h('li', {}, 'Ten a mano los accesos que mencionaste en el onboarding. Los usaremos durante la configuración.'))),
        h('div', { class: 'welcome-actions', style: { justifyContent: 'center' } },
          h('button', { class: 'btn btn-white', type: 'button', onclick: downloadCopy }, icon('download'), 'Descargar una copia'),
          ui.confirmReset ? null : h('button', {
            class: 'btn btn-ghost-white', type: 'button', 'data-fk': 'reset', onclick: () => { ui.confirmReset = true; renderSuccess(); document.querySelector('[data-fk="reset-no"]')?.focus(); },
          }, 'Nuevo onboarding')),
        ui.confirmReset ? resetConfirm('La copia local de este onboarding se borrará de este dispositivo. ¿Empezar uno nuevo?', renderSuccess) : null),
      h('footer', { class: 'welcome-foot' }, h('span', { class: 'brand-text' }, 'Inteligencia que construye.'), h('span', {}, `© ${new Date().getFullYear()} iTech`))),
  );
  document.getElementById('s-title')?.focus?.();
}

function downloadCopy() {
  const lines = [`Onboarding ZAK · iTech`, `Referencia: ${state.reference || '—'}`, `Enviado: ${new Date(state.submittedAt).toLocaleString('es-VE')}`, ''];
  const flow = engine.flow(state.answers);
  for (const s of schema.sections) {
    const qs = flow.filter((x) => x.section === s.id);
    if (!qs.length) continue;
    lines.push(`== ${s.number === 0 ? '' : `${sectionNumber(s)}. `}${s.title} ==`, '');
    for (const q of qs) {
      lines.push(`${q.id} ${q.formTitle}`);
      for (const p of engine.formatAnswer(q, state.answers)) lines.push(`   ${p.label}: ${p.value}`);
      lines.push('');
    }
  }
  if (ndaRecord()) lines.push('== Acuerdo de confidencialidad ==', '', ndaText(), '', 'REGISTRO DE ACEPTACIÓN', ndaRecord(), '');
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `onboarding-zak-${state.reference || 'copia'}.txt` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

boot();
