/**
 * Módulos de ZAK y configuración técnica por módulo.
 * - buildModuleSchema(): genera, a partir de config/modules.json, la sección de selección de módulos (M.1).
 *   apps-script/Code.gs aplica exactamente las mismas reglas para crear los ítems del Form.
 * - buildConfigSchema(): preguntas técnicas de cada módulo contratado.
 */

export const SELECTION_FIELD = 'modulos';

export function buildModuleSchema(mod) {
  const all = mod.groups.flatMap((g) => g.modules);
  const labels = Object.fromEntries(all.map((m) => [m.id, m.name]));
  const sections = [{ ...mod.sections.modules, number: 0, source: 'itech' }];
  const questions = [{
    id: mod.selection.id, label: 'Módulos de ZAK', section: 'sM', formType: 'CHECKBOX', required: true, formValueField: SELECTION_FIELD,
    formTitle: mod.selection.formTitle, prompt: mod.selection.prompt, hint: mod.selection.hint,
    fields: [{ id: SELECTION_FIELD, type: 'modules', label: 'Módulos', groups: mod.groups, labels, options: all.map((m) => m.name) }],
  }];
  return { sections, questions, modules: all };
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
    showIf: c.showIf, requireOneOf: c.requireOneOf, requireOneOfMsg: c.requireOneOfMsg,
  })));
  return { sections, questions };
}
