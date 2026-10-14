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
    { id: 'sM', number: 0, tag: 'MÓDULOS', title: 'Módulos de ZAK', intro: 'Elige los módulos que vas a contratar. Con eso preparamos tu checklist.', source: 'itech' },
    { id: 'sC', number: 0, tag: 'PREPARACIÓN', title: 'Checklist de preparación', intro: 'Revisemos, módulo por módulo, qué tienes listo. Así sabemos qué tan preparada está tu empresa para arrancar.', source: 'itech' },
  ];

  const questions = [
    {
      id: mod.selection.id, section: 'sM', formType: 'CHECKBOX', required: true, formValueField: SELECTION_FIELD,
      formTitle: mod.selection.formTitle, prompt: mod.selection.prompt, hint: mod.selection.hint,
      fields: [{ id: SELECTION_FIELD, type: 'modules', label: 'Módulos', groups: mod.groups, labels, options: all.map((m) => m.name) }],
    },
    ...all.map((m) => ({
      id: `C.${m.id}`, section: 'sC', formType: 'GRID', required: true, formValueField: CHECK_FIELD, module: m.id,
      showIf: { q: mod.selection.id, f: SELECTION_FIELD, op: 'includes', value: m.id },
      formTitle: `Checklist · ${m.name}`,
      prompt: mod.checklist.promptTemplate.replace('{module}', m.name),
      hint: mod.checklist.hint,
      fields: [{ id: CHECK_FIELD, type: 'grid', label: 'Requisitos', rows: m.requirements.map((r) => r.text), columns: stateLabels, bulk: stateLabels[0], stacked: true }],
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

  const modules = all.filter((m) => selected.includes(m.id)).map((m) => {
    const grid = answers[`C.${m.id}`]?.[CHECK_FIELD] || {};
    const rows = m.requirements.map((r) => ({ text: r.text, state: grid[r.text] }));
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
    .map((m) => `${m.name} (${m.pct} %):\n${m.missing.map((x) => `  - ${x.text} [${x.state}]`).join('\n')}`)
    .join('\n');
}
