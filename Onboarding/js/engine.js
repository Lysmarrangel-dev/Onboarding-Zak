/**
 * Motor del cuestionario: condiciones, flujo, validación, formato y serialización.
 * No toca el DOM. Todo sale de config/questions.json.
 */

/* ---------- Condiciones ---------- */

const isEmpty = (v) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Evalúa una condición { q?, f, op, value } contra las respuestas.
 * Sin `q`, la condición mira el borrador de la misma pregunta (`local`).
 */
export function evalCondition(cond, answers, local) {
  if (!cond) return true;
  if (cond.all) return cond.all.every((c) => evalCondition(c, answers, local));
  const src = cond.q ? answers[cond.q] || {} : local || {};
  const v = src[cond.f];
  switch (cond.op) {
    case 'eq': return v === cond.value;
    case 'neq': return v !== cond.value;
    case 'in': return cond.value.includes(v);
    case 'notIn': return !cond.value.includes(v ?? '');
    case 'includes': return Array.isArray(v) && v.includes(cond.value);
    case 'notIncludes': return !(Array.isArray(v) && v.includes(cond.value));
    case 'hasAnyExcept': return Array.isArray(v) && v.some((x) => !cond.value.includes(x));
    case 'notEmpty': return !isEmpty(v);
    default: return true;
  }
}

export function createEngine(schema) {
  const { sections, questions } = schema;
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const sectionById = Object.fromEntries(sections.map((s) => [s.id, s]));

  /**
   * Módulos a los que pertenece una pregunta: los suyos («modules») o los de su sección.
   * Sin módulos = pregunta general, se hace siempre.
   */
  const gate = schema.meta?.moduleGate;
  const modulesOf = (q) => q.modules || sectionById[q.section]?.modules || null;

  /** Solo se pregunta lo de los módulos contratados (si ya se eligieron). */
  const moduleAllowed = (q, answers) => {
    const mods = modulesOf(q);
    if (!gate || !mods) return true;
    const chosen = answers[gate.q]?.[gate.f] || [];
    return mods.some((m) => chosen.includes(m));
  };

  const isVisible = (q, answers) => moduleAllowed(q, answers) && evalCondition(q.showIf, answers);

  const visibleFields = (q, answers, draft) =>
    q.fields.filter((f) => evalCondition(f.showIf, answers, draft));

  /** Preguntas visibles, en orden, según las respuestas actuales. */
  const flow = (answers) => questions.filter((q) => isVisible(q, answers));

  const isAnswered = (q, state) => Boolean(state.done[q.id]);

  /** Primera pregunta visible sin responder (o null si terminó). */
  const nextPending = (state) => flow(state.answers).find((q) => !isAnswered(q, state)) || null;

  function progress(state) {
    const f = flow(state.answers);
    const answered = f.filter((q) => isAnswered(q, state)).length;
    return { answered, total: f.length, pct: f.length ? Math.round((answered / f.length) * 100) : 0 };
  }

  /* ---------- Validación ---------- */

  const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RE_RIF = /^[VEJPG]-?\d{7,9}-?\d$/i;
  const RE_TAXID = /^[A-Z0-9][A-Z0-9.\- ]{4,19}$/i;

  /** Grupos de KPIs de los módulos contratados (si ninguno aplica, todos). */
  function kpiGroupsFor(field, answers) {
    const chosen = gate ? answers[gate.q]?.[gate.f] || [] : [];
    const mine = field.groups.filter((g) => !g.modules || g.modules.some((m) => chosen.includes(m)));
    return mine.length ? mine : field.groups;
  }

  /** Tablas de filas (responsables, usuarios, citas…): valida cada columna de cada fila con datos. */
  function validateRows(field, value) {
    const rows = (value || []).filter((r) => Object.values(r).some((x) => !isEmpty(x)));
    if (field.required !== false && !rows.length) return `Agrega al menos ${field.minLabel || 'una fila'}.`;
    for (const [i, r] of rows.entries()) {
      for (const c of field.columns) {
        const v = r[c.id];
        const needed = c.requiredIf ? r[c.requiredIf.col] === c.requiredIf.eq : c.required !== false;
        if (needed && isEmpty(typeof v === 'string' ? v.trim() : v)) return `${field.rowLabel || 'Fila'} ${i + 1}: completa «${c.label}».`;
        if (!isEmpty(v) && c.type === 'email' && !RE_EMAIL.test(String(v).trim())) return `${field.rowLabel || 'Fila'} ${i + 1}: revisa el correo.`;
        if (!isEmpty(v) && c.type === 'phone' && String(v).replace(/\D/g, '').length < 8) return `${field.rowLabel || 'Fila'} ${i + 1}: revisa el teléfono.`;
      }
    }
    return null;
  }

  function validateField(field, value, draft) {
    const required = field.required !== false;
    const t = typeof value === 'string' ? value.trim() : value;

    if (field.type === 'modules') return required && isEmpty(t) ? 'Elige al menos un módulo.' : null;
    if (field.type === 'notice') return null;
    if (field.type === 'kpiGroups') return null; // se valida en validate(): necesita los grupos visibles
    if (field.type === 'multiselect') return required && isEmpty(t) ? 'Elige al menos una opción.' : null;
    if (field.type === 'rows') return validateRows(field, t);
    if (field.type === 'consent') return required && !t ? 'Debes marcar esta casilla para continuar.' : null;
    if (field.type === 'multi' || field.type === 'single' || field.type === 'select') {
      if (required && isEmpty(t)) return field.type === 'multi' ? 'Elige al menos una opción.' : 'Elige una opción.';
      const other = draft[`${field.id}__other`];
      const choseOther = field.type === 'multi' ? (t || []).includes('Otro') : t === 'Otro' && field.other;
      const catalog = draft[`${field.id}__cat`] || [];
      if (choseOther && isEmpty(other?.trim?.()) && !catalog.length) return field.otherCatalog ? 'Elige un indicador de la lista o escribe cuál.' : 'Cuéntanos cuál es la otra opción.';
      return null;
    }
    if (field.type === 'file') {
      if (required && isEmpty(t)) return 'Adjunta el archivo para continuar.';
      // Progreso guardado con un formato que ya no se admite (p. ej. el RIF en imagen, antes de exigir PDF).
      const pdfOnly = field.accept && field.accept.split(',').every((s) => /^(\.pdf|application\/pdf)$/i.test(s.trim()));
      if (pdfOnly && [].concat(t || []).some((x) => !/\.pdf$/i.test(x?.name || ''))) return 'Sube el archivo en PDF.';
      return null;
    }
    if (field.type === 'users') {
      const rows = (t || []).filter((r) => r.nombre || r.apellido || r.correo);
      if (required && rows.length === 0) return 'Agrega al menos un usuario.';
      for (const [i, r] of rows.entries()) {
        if (!r.nombre?.trim() || !r.apellido?.trim()) return `Usuario ${i + 1}: completa nombre y apellido.`;
        if (!RE_EMAIL.test(r.correo?.trim() || '')) return `Usuario ${i + 1}: revisa el correo.`;
      }
      return null;
    }
    if (field.type === 'plans') {
      const rows = (t || []).filter((r) => r.nombre || r.precio || r.ciclo);
      if (required && rows.length === 0) return 'Agrega al menos un plan.';
      for (const [i, r] of rows.entries()) {
        if (!r.nombre?.trim()) return `Plan ${i + 1}: escribe el nombre.`;
        if (isEmpty(r.precio) || Number.isNaN(Number(r.precio)) || Number(r.precio) < 0) return `Plan ${i + 1}: revisa el precio.`;
        if (!r.ciclo) return `Plan ${i + 1}: elige el ciclo de cobro.`;
      }
      return null;
    }
    if (field.type === 'grid') {
      const missing = field.rows.filter((r) => !(t || {})[r]);
      if (required && missing.length) return `Elige una opción para: ${missing.join(', ')}.`;
      return null;
    }
    if (field.type === 'userRoles') return null; // se valida en validate(), necesita la lista de 7.1

    // Campos de texto y numéricos.
    if (isEmpty(t)) return required ? 'Este dato es obligatorio.' : null;

    switch (field.type) {
      case 'email':
        return RE_EMAIL.test(t) ? null : 'Revisa el correo. Debe tener el formato nombre@empresa.com.';
      case 'phone': {
        const digits = t.replace(/\D/g, '');
        if (!/^[+\d][\d\s().-]*$/.test(t) || digits.length < 8 || digits.length > 15)
          return 'Revisa el teléfono. Incluye el código de país, por ejemplo +58 412 1234567.';
        return null;
      }
      case 'taxid': {
        const up = t.toUpperCase().replace(/\s/g, '');
        // Si empieza como un RIF venezolano (letra + dígito), exige su formato completo.
        if (/^[VEJPG]-?\d/.test(up))
          return RE_RIF.test(up) ? null : 'Revisa el RIF. El formato es J-12345678-9.';
        return RE_TAXID.test(up) ? null : 'Revisa el ID fiscal: usa solo letras, números y guiones.';
      }
      case 'idcard': {
        const up = t.toUpperCase().replace(/\s|\./g, '');
        if (/^[VE]-?\d/.test(up)) return /^[VE]-?\d{6,9}$/.test(up) ? null : 'Revisa la cédula. El formato es V-12345678.';
        return /^[A-Z0-9-]{5,20}$/.test(up) ? null : 'Revisa el documento de identidad.';
      }
      case 'url': {
        const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
        try {
          const u = new URL(withProto);
          return u.hostname.includes('.') ? null : 'Revisa la dirección del sitio.';
        } catch {
          return 'Revisa la dirección del sitio.';
        }
      }
      case 'number': {
        const n = Number(String(t).replace(',', '.'));
        if (Number.isNaN(n)) return 'Escribe un número.';
        if (field.integer && !Number.isInteger(n)) return 'Escribe un número entero.';
        if (field.min !== undefined && n < field.min) return `El valor mínimo es ${field.min}.`;
        if (field.max !== undefined && n > field.max) return `El valor máximo es ${field.max}.`;
        return null;
      }
      case 'date': {
        const d = new Date(`${t}T00:00:00`);
        if (Number.isNaN(d.getTime())) return 'Elige una fecha válida.';
        if (field.minToday) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (d < today) return 'La fecha no puede ser anterior a hoy.';
        }
        return null;
      }
      case 'time':
        return /^\d{2}:\d{2}$/.test(t) ? null : 'Elige una hora válida.';
      default:
        return t.length > 5000 ? 'El texto es demasiado largo (máx. 5.000 caracteres).' : null;
    }
  }

  /** Devuelve { fieldId: mensaje } con los errores de los campos visibles. */
  function validate(q, draft, answers) {
    const errors = {};
    const fields = visibleFields(q, answers, draft);
    for (const f of fields) {
      const msg = validateField(f, draft[f.id], draft);
      if (msg) errors[f.id] = msg;
    }
    // KPIs por módulo: al menos un indicador; y por cada grupo con indicadores, su frecuencia y su canal.
    for (const f of fields.filter((x) => x.type === 'kpiGroups')) {
      const v = draft[f.id] || {};
      const groups = kpiGroupsFor(f, answers).filter((g) => (v[g.id] || []).length);
      if (!groups.length) { errors[f.id] = 'Elige al menos un indicador.'; continue; }
      const freq = draft[`${f.id}__freq`] || {};
      const canal = draft[`${f.id}__canal`] || {};
      const g = groups.find((x) => !(freq[x.id] || []).length || !(canal[x.id] || []).length);
      if (g) errors[f.id] = `Elige la frecuencia y el canal de «${g.title}».`;
    }
    // «Responde al menos uno de estos campos» (p. ej. organigrama: archivo o descripción).
    if (q.requireOneOf && q.requireOneOf.every((id) => isEmpty(draft[id]))) {
      errors[q.requireOneOf[0]] = q.requireOneOfMsg || (q.fields.some((f) => f.type === 'file') ? 'Adjunta un archivo o escribe una descripción.' : 'Elige al menos una opción.');
    }
    for (const f of fields.filter((x) => x.type === 'userRoles')) {
      const users = (answers[f.source.q]?.[f.source.f] || []).filter((u) => u.nombre);
      if (users.some((_, i) => !(draft[f.id] || {})[String(i)])) errors[f.id] = 'Asigna un rol a cada usuario.';
    }
    // Horario: «hasta» debe ser posterior a «desde».
    if (q.id === '4.6' && draft.desde && draft.hasta && draft.hasta <= draft.desde && !errors.hasta)
      errors.hasta = 'La hora final debe ser posterior a la inicial.';
    return errors;
  }

  /* ---------- Comprobaciones «suaves» (aclaración amable) ---------- */

  const VAGUE = /^(no s[eé]|n\/?a|nada|ninguno|ninguna|-+|\.+|x+|ok|si|sí|no|tal vez|quiz[aá]s?)$/i;

  /**
   * Si la respuesta parece ambigua, devuelve el tipo de aclaración.
   * 'question' = el texto parece una duda del usuario, no una respuesta.
   * 'vague'    = respuesta de texto libre demasiado corta o imprecisa.
   */
  function softCheck(q, draft, answers) {
    const textFields = visibleFields(q, answers, draft).filter((f) => f.type === 'textarea');
    for (const f of textFields) {
      const v = (draft[f.id] || '').trim();
      if (!v) continue;
      if (/^¿|\?$/.test(v) && v.length < 160 && textFields.length === 1 && q.fields.length === 1) return { kind: 'question', text: v };
      if (VAGUE.test(v) || v.split(/\s+/).length < 2) return { kind: 'vague', field: f };
    }
    return null;
  }

  /* ---------- Formato legible ---------- */

  const fmtNumber = (v) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isNaN(n) ? String(v) : n.toLocaleString('es-VE');
  };

  const fmtDate = (v) => {
    const d = new Date(`${v}T00:00:00`);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  /** Valor final de un campo de opción, sustituyendo «Otro» por el texto escrito. */
  function choiceValue(field, draft) {
    const v = draft[field.id];
    if (field.type === 'modules') return (v || []).map((id) => field.labels[id]).filter(Boolean);
    const other = (draft[`${field.id}__other`] || '').trim();
    if (field.type === 'multi') {
      const cat = draft[`${field.id}__cat`] || [];
      return (v || []).flatMap((x) => (x === 'Otro' ? [...cat, other] : [x])).filter(Boolean);
    }
    return v === 'Otro' ? other : v;
  }

  function formatField(field, draft, answers) {
    const v = draft[field.id];
    if (isEmpty(v)) return null;
    switch (field.type) {
      case 'multi': {
        const det = draft[`${field.id}__det`] || {};
        return choiceValue(field, draft).map((x) => (det[x]?.trim() ? `${x} (${det[x].trim()})` : x)).join(', ');
      }
      case 'multiselect': return [].concat(v).join(', ');
      case 'notice': return null;
      case 'kpiGroups': {
        const freq = draft[`${field.id}__freq`] || {};
        const canal = draft[`${field.id}__canal`] || {};
        return kpiGroupsFor(field, answers).filter((g) => (v[g.id] || []).length)
          .map((g) => `${g.title}: ${v[g.id].join(', ')} · Frecuencia: ${(freq[g.id] || []).join(', ') || '—'} · Canal: ${(canal[g.id] || []).join(', ') || '—'}`)
          .join('\n') || null;
      }
      case 'rows':
        return v.filter((r) => Object.values(r).some((x) => !isEmpty(x)))
          .map((r) => field.columns.map((c) => [].concat(r[c.id] ?? []).join(', ')).filter(Boolean).join(' · ')).join('\n');
      case 'modules': return choiceValue(field, draft).join(', ');
      case 'single':
      case 'select': return choiceValue(field, draft);
      case 'number': return fmtNumber(v) + (/\(%\)/.test(field.label) ? ' %' : '');
      case 'date': return fmtDate(v);
      case 'consent': {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? 'Aceptado' : `Aceptado el ${d.toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' })}`;
      }
      case 'file': return (Array.isArray(v) ? v : [v]).map((x) => x.name).join(', ');
      case 'users':
        return v.filter((r) => r.nombre || r.correo).map((r) => `${r.nombre} ${r.apellido} <${r.correo}>`).join('; ');
      case 'plans':
        return v.filter((r) => r.nombre).map((r) => `${r.nombre} · ${fmtNumber(r.precio)} · ${r.ciclo}`).join('; ');
      case 'grid': {
        const det = draft[`${field.id}__det`] || {};
        const cons = draft[`${field.id}__cons`] || {};
        return field.rows.map((r) => `${r}: ${v[r] || '—'}${det[r]?.trim() ? ` — ${det[r].trim()}` : ''}${cons[r] ? ' [pide consultoría]' : ''}`).join('\n');
      }
      case 'userRoles': {
        const users = answers[field.source.q]?.[field.source.f] || [];
        return users
          .map((u, i) => ({ u, role: v[String(i)] }))
          .filter(({ u }) => u.nombre)
          .map(({ u, role }) => `${u.nombre} ${u.apellido}: ${role || '—'}`)
          .join('; ');
      }
      default: return String(v).trim();
    }
  }

  /** Lista [{label, value}] con los campos visibles respondidos. */
  function formatAnswer(q, answers) {
    const draft = answers[q.id] || {};
    return visibleFields(q, answers, draft)
      .map((f) => ({ label: f.label, value: formatField(f, draft, answers), field: f }))
      .filter((x) => x.value);
  }

  /* ---------- Serialización para Google Forms ---------- */

  /**
   * Convierte la respuesta al valor que espera el ítem del Form:
   *  TEXT / PARAGRAPH_TEXT → string · MULTIPLE_CHOICE → string
   *  CHECKBOX → string[] · GRID → string[] (una columna por fila)
   */
  function serialize(q, answers) {
    const draft = answers[q.id] || {};
    if (q.formType === 'MULTIPLE_CHOICE') {
      const f = q.fields.find((x) => x.id === q.formValueField);
      return choiceValue(f, draft);
    }
    if (q.formType === 'CHECKBOX') {
      const f = q.fields.find((x) => x.id === q.formValueField);
      if (f.type !== 'multi') return choiceValue(f, draft);
      // El Form acepta UNA sola respuesta fuera de sus opciones (la de «Otro»): con varios
      // indicadores de «Más indicadores» o uno más el texto propio, Google rechazaba el envío
      // completo. Las opciones del Form van como tales y todo lo demás, junto en ese único «Otro».
      const values = choiceValue(f, draft);
      const known = [...new Set(values.filter((x) => f.options.includes(x)))];
      const extra = [...new Set(values.filter((x) => !f.options.includes(x)))];
      return extra.length ? [...known, extra.join(', ')] : known;
    }
    if (q.formType === 'GRID') {
      const f = q.fields.find((x) => x.id === q.formValueField);
      return f.rows.map((r) => draft[f.id]?.[r] || '');
    }
    const parts = formatAnswer(q, answers);
    if (q.formType === 'TEXT') return parts.map((p) => p.value).join(' ');
    // PARAGRAPH_TEXT: una línea por parte; el archivo (el PDF del RIF) incluye su enlace de Drive.
    return parts
      .map(({ label, value, field }) => {
        if (field.type === 'file') {
          const files = [].concat(draft[field.id] || []);
          value = files.map((x) => `${x.name}${x.url ? ` (${x.url})` : ''}`).join(', ');
        }
        return parts.length === 1 ? value : `${label}: ${value}`;
      })
      .join('\n');
  }

  return {
    sections, questions, byId, sectionById,
    isVisible, visibleFields, flow, nextPending, progress, isAnswered, modulesOf,
    validate, softCheck, formatAnswer, serialize, isEmpty, kpiGroupsFor,
  };
}
