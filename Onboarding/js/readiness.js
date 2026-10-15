/**
 * Módulos de ZAK + checklist de preparación.
 * - buildModuleSchema(): genera, a partir de config/modules.json, la sección de selección de módulos
 *   y una pregunta de checklist por módulo (visible solo si el módulo fue elegido).
 *   apps-script/Code.gs aplica exactamente las mismas reglas para crear los ítems del Form.
 * - computeReadiness(): porcentaje de preparación por módulo y global (promedio de los módulos),
 *   nivel y requisitos pendientes.
 */

export const SELECTION_FIELD = 'modulos';
export const CHECK_FIELD = 'estado';

export function buildModuleSchema(mod) {
  const all = mod.groups.flatMap((g) => g.modules);
  const labels = Object.fromEntries(all.map((m) => [m.id, m.name]));
  const stateLabels = mod.checklist.states.map((s) => s.label);

  const sections = [
    { ...mod.sections.modules, number: 0, source: 'itech' },
    { ...mod.sections.checklist, number: 0, source: 'itech' },
  ];

  const questions = [
    {
      id: mod.selection.id, label: 'Módulos de ZAK', section: 'sM', formType: 'CHECKBOX', required: true, formValueField: SELECTION_FIELD,
      formTitle: mod.selection.formTitle, prompt: mod.selection.prompt, hint: mod.selection.hint,
      fields: [{ id: SELECTION_FIELD, type: 'modules', label: 'Módulos', groups: mod.groups, labels, options: all.map((m) => m.name) }],
    },
    ...all.filter((m) => m.requirements?.length).map((m) => ({
      id: `C.${m.id}`, label: `Checklist · ${m.name}`, section: 'sC', formType: 'GRID', required: true, formValueField: CHECK_FIELD, module: m.id,
      showIf: { q: mod.selection.id, f: SELECTION_FIELD, op: 'includes', value: m.id },
      formTitle: `Checklist · ${m.name}`,
      prompt: mod.checklist.promptTemplate.replace('{module}', m.name),
      hint: mod.checklist.hint,
      fields: [{
        id: CHECK_FIELD, type: 'grid', label: 'Requisitos', rows: m.requirements.map((r) => r.text), columns: stateLabels, bulk: stateLabels[0], stacked: true,
        // Menú desplegable por requisito; cada opción abre su campo de detalle y, si aplica, la consultoría.
        display: 'select', states: mod.checklist.states,
      }],
    })),
  ];

  return { sections, questions, modules: all };
}

/**
 * @returns {{ selected, modules: [{id, name, pct, answered, missing: [{text, state}]}], overall, level, complete }}
 */
export function computeReadiness(mod, answers) {
  const all = mod.groups.flatMap((g) => g.modules);
  const selected = answers[mod.selection.id]?.[SELECTION_FIELD] || [];
  const scoreOf = Object.fromEntries(mod.checklist.states.map((s) => [s.label, s.score]));
  const doneLabel = mod.checklist.states[0].label;

  const modules = all.filter((m) => selected.includes(m.id) && m.requirements?.length).map((m) => {
    const a = answers[`C.${m.id}`] || {};
    const grid = a[CHECK_FIELD] || {};
    const det = a[`${CHECK_FIELD}__det`] || {};
    const cons = a[`${CHECK_FIELD}__cons`] || {};
    const rows = m.requirements.map((r) => ({ text: r.text, state: grid[r.text], note: (det[r.text] || '').trim(), consult: Boolean(cons[r.text]) }));
    const answered = rows.every((r) => r.state);
    const pct = answered ? Math.round((rows.reduce((a, r) => a + (scoreOf[r.state] ?? 0), 0) / rows.length) * 100) : null;
    return { id: m.id, name: m.name, pct, answered, missing: rows.filter((r) => r.state && r.state !== doneLabel) };
  });

  const scored = modules.filter((m) => m.answered);
  const overall = scored.length ? Math.round(scored.reduce((a, m) => a + m.pct, 0) / scored.length) : null;
  const level = overall === null ? null : mod.levels.find((l) => overall >= l.min);
  return { selected, modules, overall, level, complete: modules.length > 0 && scored.length === modules.length };
}

/** Texto plano de los requisitos pendientes (para el Form y el correo). */
export function missingText(r) {
  return r.modules
    .filter((m) => m.missing.length)
    .map((m) => `${m.name} (${m.pct} %):\n${m.missing.map((x) => `  - ${x.text} [${x.state}]${x.note ? ` — ${x.note}` : ''}${x.consult ? ' · PIDE CONSULTORÍA' : ''}`).join('\n')}`)
    .join('\n');
}

/* ==========================================================================
   Agentes de IA por departamento (config/agents.json)
   ========================================================================== */
export const DEPT_FIELD = 'departamentos';

export function buildAgentSchema(cfg, mod) {
  const showModule = { q: mod.selection.id, f: SELECTION_FIELD, op: 'includes', value: cfg.requiresModule };
  const labels = Object.fromEntries(cfg.departments.map((d) => [d.id, d.name]));
  const sections = [{ ...cfg.section, number: 0, source: 'itech' }];
  const questions = [
    {
      id: cfg.selection.id, label: 'Agentes de IA', section: cfg.section.id, formType: 'CHECKBOX', required: true, formValueField: DEPT_FIELD, showIf: showModule,
      formTitle: cfg.selection.formTitle, prompt: cfg.selection.prompt, hint: cfg.selection.hint,
      fields: [{ id: DEPT_FIELD, type: 'modules', label: 'Departamentos', groups: [{ id: 'dept', title: 'Departamentos', modules: cfg.departments }], labels, options: cfg.departments.map((d) => d.name), noun: 'departamentos' }],
    },
    ...cfg.departments.map((d) => ({
      id: `A.${d.id}`, label: `Agente de IA · ${d.name}`, section: cfg.section.id, formType: 'PARAGRAPH_TEXT', required: true,
      showIf: { all: [showModule, { q: cfg.selection.id, f: DEPT_FIELD, op: 'includes', value: d.id }] },
      formTitle: cfg.agent.formTitleTemplate.replace('{dept}', d.name),
      prompt: cfg.agent.promptTemplate.replace('{dept}', d.askName ? 'otro departamento' : d.name),
      hint: cfg.agent.hint,
      fields: [
        d.askName ? { id: 'departamento', type: 'text', label: '¿Qué departamento?', placeholder: 'Ej.: Logística' } : null,
        { id: 'nombre', type: 'text', label: 'Nombre del agente', placeholder: 'Ej.: Sofía' },
        { id: 'rol', type: 'text', label: 'Rol del agente', placeholder: `Ej.: asistente de ${d.askName ? 'logística' : d.name.toLowerCase()}` },
        { id: 'funciones', type: 'textarea', label: '¿Qué debe hacer este agente?', placeholder: 'Ej.: responder precios, tomar pedidos y pasar los reclamos a un humano' },
        { id: 'solo', type: 'textarea', label: '¿Qué puede hacer el agente por sí solo?', placeholder: 'Ej.: agendar citas, enviar el catálogo y el enlace de pago' },
        { id: 'consulta', type: 'textarea', label: '¿Qué debe consultar antes de actuar?', placeholder: 'Ej.: descuentos, devoluciones y ventas sobre USD 1.000' },
        { id: 'canales', type: 'multi', label: 'Canales donde atiende', options: cfg.agent.channels, other: true },
        { id: 'documentos', type: 'file', label: 'Documentos que puede leer (catálogo, precios, políticas, guiones…)', multiple: true, required: false, maxMB: 10,
          accept: '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,image/*', hint: 'Opcional. Puedes subir varios archivos o enviarlos después.' },
      ].filter(Boolean),
    })),
  ];
  return { sections, questions };
}

/* ==========================================================================
   Configuración técnica por módulo (modules.json → «config» de cada módulo)
   Una sección por módulo, visible solo si el cliente lo contrató. Cubre lo que el
   equipo de implementación necesita y el cuestionario general no pregunta.
   ========================================================================== */
export function buildConfigSchema(mod) {
  const all = mod.groups.flatMap((g) => g.modules).filter((m) => m.config?.length);
  const cs = mod.configSection;
  const sections = all.map((m, i) => ({
    id: `sX-${m.id}`, number: 100 + i, modules: [m.id], source: 'itech',
    title: cs.titleTemplate.replace('{module}', m.name),
    intro: cs.intro.replace('{module}', m.name),
  }));
  const questions = all.flatMap((m) => m.config.map((c, k) => ({
    id: `X.${m.id}.${k + 1}`, label: `${m.name} · ${k + 1}`, section: `sX-${m.id}`,
    formType: 'PARAGRAPH_TEXT', required: true,
    formTitle: c.prompt, prompt: c.prompt, hint: c.hint, fields: c.fields,
    showIf: c.showIf, requireOneOf: c.requireOneOf, noAttach: c.noAttach,
  })));
  return { sections, questions };
}
