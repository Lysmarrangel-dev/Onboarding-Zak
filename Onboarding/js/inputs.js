/**
 * Componentes de respuesta según el tipo de campo (chips, fecha, número, archivos, tablas…).
 * Cada componente escribe en `ctx.draft`. Los cambios que alteran qué campos se ven
 * (opciones) llaman a `ctx.rerender()`; los de texto no, para no perder el foco.
 */
import { h, icon } from './dom.js';
import { uploadFile } from './api.js';

const INPUT_TYPES = { text: 'text', email: 'email', phone: 'tel', url: 'url', taxid: 'text', idcard: 'text', number: 'text', date: 'date', time: 'time' };
const AUTOCOMPLETE = { email: 'email', phone: 'tel', url: 'url' };

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

export function renderForm(q, ctx) {
  const fields = ctx.engine.visibleFields(q, ctx.answers, ctx.draft);
  const wrap = h('div', { class: 'fields', style: { display: 'grid', gap: '16px' } });
  // Etiqueta visible sólo si la pregunta tiene varias partes; si no, la etiqueta es la pregunta.
  const showLabels = fields.filter((f) => f.type !== 'notice').length > 1 || ctx.alwaysLabel;
  for (const f of fields) wrap.appendChild(renderField(f, q, ctx, showLabels));
  // «No» / «No sé» → ofrecemos consultoría de iTech.
  if (ctx.consultCheck?.(q, ctx.draft, fields)) wrap.appendChild(renderConsultCta(q, ctx));
  return wrap;
}

const CONSULT_KEY = '__consultoria';

/** Llamada a la acción de consultoría cuando la respuesta indica que algo falta o no se sabe. */
function renderConsultCta(q, ctx) {
  const v = ctx.draft[CONSULT_KEY];
  return h('div', { class: 'consult-cta', role: 'group', 'aria-label': 'Consultoría de iTech' },
    h('span', { class: 'consult-ico', 'aria-hidden': 'true' }, icon('help')),
    h('div', { class: 'consult-body' },
      h('strong', {}, '¿Quieres que un consultor de iTech te ayude con esto?'),
      h('span', {}, 'Lo anotamos y lo vemos contigo en la implementación.'),
      h('div', { class: 'chips' },
        ['Sí, quiero consultoría', 'No, por ahora'].map((o) => h('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(v === o), 'data-fk': `${CONSULT_KEY}:${o}`,
          onclick: () => { ctx.draft[CONSULT_KEY] = v === o ? '' : o; ctx.rerender(); },
        }, o)))));
}

function renderField(f, q, ctx, showLabel) {
  if (f.type === 'notice') return h('div', { class: 'field' }, noticeControl(f));
  const id = nextId(`f-${q.id}-${f.id}`).replace(/\./g, '_');
  const hintId = f.hint ? `${id}-hint` : null;
  const errId = ctx.errors[f.id] ? `${id}-err` : null;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || null;
  const optional = f.required === false;
  const label = showLabel ? f.label : `${f.label}`;
  const labelEl = h('span', { class: showLabel ? 'field-label' : 'sr-only', id: `${id}-label` },
    label, optional ? h('span', { class: 'opt' }, ' (opcional)') : null);

  const control = CONTROLS[f.type]?.(f, q, ctx, { id, describedBy, labelId: `${id}-label` }) || h('span', {}, `Tipo no soportado: ${f.type}`);

  const usesLabelFor = ['text', 'email', 'phone', 'url', 'taxid', 'idcard', 'number', 'date', 'time', 'textarea', 'select'].includes(f.type);
  return h('div', { class: 'field' },
    f.type === 'consent' ? null // la casilla lleva su propio texto como etiqueta
      : usesLabelFor ? h('label', { for: id, class: showLabel ? 'field-label' : 'sr-only', id: `${id}-label` }, label, optional ? h('span', { class: 'opt' }, ' (opcional)') : null) : labelEl,
    f.hint ? h('div', { class: 'field-hint', id: hintId }, f.hint) : null,
    control,
    ctx.errors[f.id] ? h('div', { class: 'field-error', id: errId, role: 'alert' }, icon('alert', 'icon'), ctx.errors[f.id]) : null,
  );
}

/* ---------- Controles ---------- */

function textInput(f, q, ctx, { id, describedBy }) {
  const isNumber = f.type === 'number';
  const input = h('input', {
    id, class: 'input', type: INPUT_TYPES[f.type] || 'text',
    value: ctx.draft[f.id] ?? '',
    placeholder: f.placeholder || (f.type === 'number' ? 'Escribe un número' : null),
    inputmode: isNumber ? 'decimal' : null,
    autocomplete: AUTOCOMPLETE[f.type] || 'off',
    'aria-describedby': describedBy, 'aria-invalid': ctx.errors[f.id] ? 'true' : null,
    'aria-required': f.required === false ? null : 'true',
    'data-fk': f.id,
    min: f.type === 'date' && f.minToday ? new Date().toISOString().slice(0, 10) : null,
    oninput: (e) => { ctx.draft[f.id] = e.target.value; ctx.clearError(f.id); },
    onchange: (e) => { ctx.draft[f.id] = e.target.value; },
    onkeydown: (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ctx.submit(); } },
  });
  return input;
}

function textarea(f, q, ctx, { id, describedBy }) {
  return h('textarea', {
    id, class: 'textarea', rows: 3, placeholder: f.placeholder || 'Escribe tu respuesta',
    'aria-describedby': describedBy, 'aria-invalid': ctx.errors[f.id] ? 'true' : null,
    'aria-required': f.required === false ? null : 'true',
    'data-fk': f.id, maxlength: 5000,
    oninput: (e) => { ctx.draft[f.id] = e.target.value; ctx.clearError(f.id); },
    onkeydown: (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ctx.submit(); } },
  }, ctx.draft[f.id] ?? '');
}

function otherInput(f, ctx) {
  const key = `${f.id}__other`;
  return h('input', {
    class: 'input', type: 'text', placeholder: '¿Cuál?', 'aria-label': `${f.label}: otra opción`,
    value: ctx.draft[key] ?? '', 'data-fk': key,
    oninput: (e) => { ctx.draft[key] = e.target.value; ctx.clearError(f.id); },
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); ctx.submit(); } },
  });
}

function singleChips(f, q, ctx, { labelId, describedBy }) {
  const options = f.other ? [...f.options, 'Otro'] : f.options;
  const group = h('div', { class: 'chips', role: 'group', 'aria-labelledby': labelId, 'aria-describedby': describedBy });
  for (const opt of options) {
    const pressed = ctx.draft[f.id] === opt;
    group.appendChild(h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(pressed), 'data-fk': `${f.id}:${opt}`,
      onclick: () => {
        ctx.draft[f.id] = opt;
        ctx.clearError(f.id);
        // Respuesta rápida: si es el único campo de la pregunta, se envía al tocar.
        if (ctx.isQuick(f) && opt !== 'Otro') ctx.submit();
        else ctx.rerender();
      },
    }, opt));
  }
  const out = h('div', { style: { display: 'grid', gap: '8px' } }, group);
  if (f.other && ctx.draft[f.id] === 'Otro') out.appendChild(otherInput(f, ctx));
  return out;
}

function multiChips(f, q, ctx, { labelId, describedBy }) {
  const options = f.other ? [...f.options, 'Otro'] : f.options;
  const exclusive = f.exclusive || [];
  const group = h('div', { class: 'chips', role: 'group', 'aria-labelledby': labelId, 'aria-describedby': describedBy });
  const current = () => ctx.draft[f.id] || [];
  for (const opt of options) {
    const checked = current().includes(opt);
    group.appendChild(h('button', {
      type: 'button', class: 'chip', role: 'checkbox', 'aria-checked': String(checked), 'data-fk': `${f.id}:${opt}`,
      onclick: () => {
        let next = current().includes(opt) ? current().filter((x) => x !== opt) : [...current(), opt];
        // Opciones excluyentes («Ninguno», «Aún no…») desmarcan las demás y viceversa.
        if (!current().includes(opt)) {
          next = exclusive.includes(opt) ? [opt] : next.filter((x) => !exclusive.includes(x));
        }
        ctx.draft[f.id] = next;
        ctx.clearError(f.id);
        ctx.rerender();
      },
    }, h('span', { class: 'check' }, icon('check')), opt));
  }
  const out = h('div', { style: { display: 'grid', gap: '8px' } }, group);
  if (f.other && current().includes('Otro')) {
    // «Otro» con catálogo: lista completa con descripción, más un campo libre.
    if (f.otherCatalog) {
      out.appendChild(h('div', { class: 'field-hint' }, 'Elige de la lista completa de indicadores o escribe otro:'));
      out.appendChild(multiselectBox({ ctx, key: `${f.id}__cat`, options: f.otherCatalog, label: 'Más indicadores', open: true }));
    }
    out.appendChild(otherInput(f, ctx));
  }
  // Un campo por cada opción elegida (p. ej. el usuario o enlace de cada red social).
  if (f.optionInputs) {
    const det = (ctx.draft[`${f.id}__det`] ||= {});
    current().filter((o) => o !== 'Otro' && !(f.exclusive || []).includes(o)).forEach((o, i) => out.appendChild(
      h('label', { class: 'option-input' },
        h('span', {}, f.optionInputs.label.replace('{opt}', o)),
        h('input', {
          class: 'input', type: 'text', value: det[o] || '', placeholder: f.optionInputs.placeholder || '', 'data-fk': `${f.id}__det:${i}`,
          oninput: (e) => { det[o] = e.target.value; },
          onkeydown: (e) => { if (e.key === 'Enter') e.preventDefault(); },
        }))));
  }
  return out;
}

function select(f, q, ctx, { id, describedBy }) {
  const sel = h('select', {
    id, class: 'select', 'aria-describedby': describedBy, 'aria-invalid': ctx.errors[f.id] ? 'true' : null,
    'data-fk': f.id,
    onchange: (e) => { ctx.draft[f.id] = e.target.value; ctx.clearError(f.id); ctx.rerender(); },
  }, h('option', { value: '', disabled: true, selected: !ctx.draft[f.id] }, 'Elige una opción'),
  f.options.map((o) => h('option', { value: o, selected: ctx.draft[f.id] === o }, o)));
  return sel;
}

function fileControl(f, q, ctx, { id, describedBy, labelId }) {
  const list = [].concat(ctx.draft[f.id] || []);
  const uploading = ctx.uploads[f.id] || [];
  const inputId = `${id}-input`;
  const input = h('input', {
    id: inputId, type: 'file', accept: f.accept || null, multiple: f.multiple || null,
    'aria-labelledby': labelId, 'aria-describedby': describedBy, 'data-fk': f.id,
    onchange: (e) => handleFiles([...e.target.files], f, q, ctx),
  });
  const zone = h('label', {
    class: 'dropzone', for: inputId,
    ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('is-over'); },
    ondragleave: (e) => e.currentTarget.classList.remove('is-over'),
    ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove('is-over'); handleFiles([...e.dataTransfer.files], f, q, ctx); },
  },
  input,
  h('span', { class: 'dz-icon' }, icon('upload')),
  h('span', {}, h('strong', {}, list.length && !f.multiple ? 'Reemplazar archivo' : 'Elegir archivo'),
    h('small', {}, `o arrástralo aquí · máx. ${f.maxMB || 10} MB`)));

  const items = h('div', { class: 'file-list' },
    list.map((file, i) => h('div', { class: 'file-item' },
      icon('check'), h('span', { class: 'name' }, file.name),
      h('span', { class: 'state' }, file.url ? 'Subido' : file.demo ? 'Listo (demo)' : 'Listo'),
      h('button', {
        type: 'button', class: 'icon-btn', 'aria-label': `Quitar ${file.name}`,
        onclick: () => {
          const next = list.filter((_, j) => j !== i);
          ctx.draft[f.id] = f.multiple ? next : next[0] || null;
          ctx.rerender();
        },
      }, icon('trash')))),
    uploading.map((u) => h('div', { class: 'file-item', 'aria-live': 'polite' },
      h('span', { class: 'typing', style: { padding: 0 } }, h('span', { class: 'node' }), h('span', { class: 'node' }), h('span', { class: 'node' })),
      h('span', { class: 'name' }, u.name), h('span', { class: 'state' }, 'Subiendo…'))));
  return h('div', { style: { display: 'grid', gap: '8px' } }, zone, items);
}

function acceptMatches(file, accept) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept.split(',').map((s) => s.trim().toLowerCase()).some((rule) =>
    rule.startsWith('.') ? name.endsWith(rule) : rule.endsWith('/*') ? (file.type || '').startsWith(rule.slice(0, -1)) : file.type === rule);
}

const isPdfOnly = (accept) => Boolean(accept) && accept.split(',').every((s) => /^(\.pdf|application\/pdf)$/i.test(s.trim()));

async function isRealPdf(file) {
  try { return (await file.slice(0, 5).text()) === '%PDF-'; } catch { return false; }
}

async function handleFiles(files, f, q, ctx) {
  if (!files.length) return;
  const chosen = f.multiple ? files : files.slice(0, 1);
  for (const file of chosen) {
    if (!acceptMatches(file, f.accept)) { ctx.setError(f.id, `«${file.name}» no tiene un formato admitido.`); return; }
    if (file.size > (f.maxMB || 10) * 1024 * 1024) { ctx.setError(f.id, `«${file.name}» supera los ${f.maxMB || 10} MB.`); return; }
    // Campos solo-PDF (el RIF): se comprueba que el contenido sea un PDF real, no solo la extensión.
    if (isPdfOnly(f.accept) && !(await isRealPdf(file))) { ctx.setError(f.id, `«${file.name}» no es un PDF válido.`); return; }
  }
  ctx.clearError(f.id);
  for (const file of chosen) {
    const token = { name: file.name };
    ctx.uploads[f.id] = [...(ctx.uploads[f.id] || []), token];
    ctx.rerender();
    try {
      const res = await uploadFile(file, { sessionId: ctx.sessionId, questionId: q.id });
      ctx.draft[f.id] = f.multiple ? [...[].concat(ctx.draft[f.id] || []), res] : res;
    } catch (e) {
      ctx.setError(f.id, `No pudimos subir «${file.name}». Revisa tu conexión e inténtalo de nuevo.`);
    } finally {
      ctx.uploads[f.id] = (ctx.uploads[f.id] || []).filter((x) => x !== token);
      ctx.rerender();
    }
  }
}

function rowsEditor({ f, ctx, emptyRow, title, addLabel, cells }) {
  if (!Array.isArray(ctx.draft[f.id]) || !ctx.draft[f.id].length) ctx.draft[f.id] = [emptyRow()];
  const rows = ctx.draft[f.id];
  return h('div', { class: 'rows' },
    rows.map((row, i) => h('div', { class: 'row-card', role: 'group', 'aria-label': `${title} ${i + 1}` },
      h('div', { class: 'row-head' }, `${title} ${i + 1}`,
        rows.length > 1 ? h('button', {
          type: 'button', class: 'icon-btn', 'aria-label': `Quitar ${title.toLowerCase()} ${i + 1}`,
          onclick: () => { rows.splice(i, 1); ctx.rerender(); },
        }, icon('trash')) : null),
      h('div', { class: 'row-grid' }, cells(row, i)))),
    h('div', {}, h('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', 'data-fk': `${f.id}:add`,
      onclick: () => { rows.push(emptyRow()); ctx.rerender(`${f.id}:${rows.length - 1}:0`); },
    }, icon('plus'), addLabel)));
}

function cellInput(f, ctx, row, key, i, col, attrs) {
  return h('input', {
    class: 'input', value: row[key] ?? '', 'data-fk': `${f.id}:${i}:${col}`,
    oninput: (e) => { row[key] = e.target.value; ctx.clearError(f.id); },
    ...attrs,
  });
}

function usersControl(f, q, ctx) {
  return rowsEditor({
    f, ctx, title: 'Usuario', addLabel: 'Agregar usuario',
    emptyRow: () => ({ nombre: '', apellido: '', correo: '' }),
    cells: (row, i) => [
      cellInput(f, ctx, row, 'nombre', i, 0, { placeholder: 'Nombre', 'aria-label': `Nombre del usuario ${i + 1}`, autocomplete: 'off' }),
      cellInput(f, ctx, row, 'apellido', i, 1, { placeholder: 'Apellido', 'aria-label': `Apellido del usuario ${i + 1}`, autocomplete: 'off' }),
      cellInput(f, ctx, row, 'correo', i, 2, { type: 'email', placeholder: 'correo@empresa.com', 'aria-label': `Correo del usuario ${i + 1}`, autocomplete: 'off' }),
    ],
  });
}

function plansControl(f, q, ctx) {
  return rowsEditor({
    f, ctx, title: 'Plan', addLabel: 'Agregar plan',
    emptyRow: () => ({ nombre: '', precio: '', ciclo: '' }),
    cells: (row, i) => [
      cellInput(f, ctx, row, 'nombre', i, 0, { placeholder: 'Nombre del plan', 'aria-label': `Nombre del plan ${i + 1}` }),
      cellInput(f, ctx, row, 'precio', i, 1, { placeholder: 'Precio', inputmode: 'decimal', 'aria-label': `Precio del plan ${i + 1}` }),
      h('select', {
        class: 'select', 'aria-label': `Ciclo de cobro del plan ${i + 1}`, 'data-fk': `${f.id}:${i}:2`,
        onchange: (e) => { row.ciclo = e.target.value; ctx.clearError(f.id); },
      }, h('option', { value: '', disabled: true, selected: !row.ciclo }, 'Ciclo de cobro'),
      f.cycles.map((c) => h('option', { value: c, selected: row.ciclo === c }, c))),
    ],
  });
}

function gridControl(f, q, ctx, { labelId }) {
  const value = (ctx.draft[f.id] = ctx.draft[f.id] || {});
  const answered = f.rows.filter((r) => value[r]).length;
  // Acceso rápido: marcar todas las filas con la primera opción (p. ej. «Sí, lo tengo»).
  const bulk = f.bulk ? h('div', { class: 'grid-bulk' },
    h('span', { class: 'field-hint' }, `${answered} de ${f.rows.length} respondidos`),
    h('button', {
      type: 'button', class: 'btn-text', 'data-fk': `${f.id}:bulk`,
      onclick: () => { f.rows.forEach((r) => { value[r] = f.bulk; }); ctx.clearError(f.id); ctx.rerender(); },
    }, icon('check'), `Marcar todo «${f.bulk}»`)) : null;
  const det = (ctx.draft[`${f.id}__det`] ||= {});
  const cons = (ctx.draft[`${f.id}__cons`] ||= {});
  const stateOf = (label) => (f.states || []).find((st) => st.label === label);

  return h('div', { class: `grid-table ${f.stacked ? 'is-stacked' : ''} ${f.display === 'select' ? 'is-select' : ''}`, role: 'group', 'aria-labelledby': labelId },
    bulk,
    f.rows.map((r, i) => {
      const st = stateOf(value[r]);
      const rowId = `${labelId}-r${i}`;
      const control = f.display === 'select'
        ? h('select', {
          class: 'select', 'aria-labelledby': rowId, 'data-fk': `${f.id}:sel:${i}`,
          onchange: (e) => { value[r] = e.target.value; ctx.clearError(f.id); ctx.rerender(stateOf(e.target.value)?.input ? `${f.id}__det:${i}` : undefined); },
        }, h('option', { value: '', disabled: true, selected: !value[r] }, 'Elige una opción'),
        (f.states ? f.states.map((x) => x.label) : f.columns).map((c) => h('option', { value: c, selected: value[r] === c }, c)))
        : h('div', { class: 'chips', role: 'group', 'aria-labelledby': rowId },
          f.columns.map((c) => h('button', {
            type: 'button', class: 'chip', 'aria-pressed': String(value[r] === c), 'data-fk': `${f.id}:${r}:${c}`,
            onclick: () => { value[r] = c; ctx.clearError(f.id); ctx.rerender(); },
          }, c)));
      return h('div', { class: `grid-row ${value[r] ? 'is-answered' : ''} ${st && st.score === 0 ? 'is-missing' : ''}` },
        h('span', { class: 'label', id: rowId }, r),
        control,
        // Detalle contextual según la opción elegida (p. ej. «¿Para cuándo lo tendrás?»).
        st?.input ? h('label', { class: 'missing-note' },
          h('span', { class: 'missing-q' }, st.input.label),
          h('input', {
            class: 'input', type: 'text', maxlength: 500, value: det[r] || '', placeholder: st.input.placeholder || '',
            'data-fk': `${f.id}__det:${i}`,
            oninput: (e) => { det[r] = e.target.value; },
            onkeydown: (e) => { if (e.key === 'Enter') e.preventDefault(); },
          })) : null,
        st?.consult ? h('label', { class: 'consult-check' },
          h('input', { type: 'checkbox', checked: Boolean(cons[r]), 'data-fk': `${f.id}__cons:${i}`, onchange: (e) => { cons[r] = e.target.checked; } }),
          h('span', {}, 'Quiero consultoría de iTech para esto')) : null);
    }));
}

function userRolesControl(f, q, ctx, { labelId }) {
  const users = (ctx.answers[f.source.q]?.[f.source.f] || []).filter((u) => u.nombre);
  const value = (ctx.draft[f.id] = ctx.draft[f.id] || {});
  if (!users.length) return h('p', { class: 'field-hint' }, 'Primero agrega la lista de usuarios en la pregunta anterior.');
  return h('div', { class: 'grid-table', role: 'group', 'aria-labelledby': labelId },
    users.map((u, i) => h('div', { class: 'grid-row' },
      h('span', { class: 'label', id: `${labelId}-u${i}` }, `${u.nombre} ${u.apellido}`),
      h('div', { class: 'chips', role: 'group', 'aria-labelledby': `${labelId}-u${i}` },
        f.options.map((o) => h('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(value[String(i)] === o), 'data-fk': `${f.id}:${i}:${o}`,
          onclick: () => { value[String(i)] = o; ctx.clearError(f.id); ctx.rerender(); },
        }, o))))));
}

/** Selector de módulos de ZAK: tarjetas agrupadas por bloque, con selección múltiple. */
function modulesControl(f, q, ctx, { labelId, describedBy }) {
  const current = () => ctx.draft[f.id] || [];
  const set = (ids) => { ctx.draft[f.id] = ids; ctx.clearError(f.id); ctx.rerender(); };
  const total = f.groups.reduce((a, g) => a + g.modules.length, 0);
  return h('div', { class: 'mod-picker', role: 'group', 'aria-labelledby': labelId, 'aria-describedby': describedBy },
    h('div', { class: 'mod-top' },
      h('span', { class: 'mod-count', 'aria-live': 'polite' }, `${current().length} de ${total} ${f.noun || 'módulos'} elegidos`),
      h('button', {
        type: 'button', class: 'btn-text', 'data-fk': `${f.id}:all`,
        onclick: () => set(current().length === total ? [] : f.groups.flatMap((g) => g.modules.map((m) => m.id))),
      }, current().length === total ? 'Quitar todos' : `Elegir los ${total}`)),
    f.groups.map((g) => {
      const ids = g.modules.map((m) => m.id);
      const allOn = ids.every((id) => current().includes(id));
      return h('div', { class: 'mod-group' },
        f.groups.length > 1 && h('div', { class: 'mod-group-head' },
          h('span', { class: 'eyebrow', id: `${labelId}-${g.id}` }, g.title),
          h('button', {
            type: 'button', class: 'btn-text btn-xs', 'data-fk': `${f.id}:g:${g.id}`,
            onclick: () => set(allOn ? current().filter((x) => !ids.includes(x)) : [...new Set([...current(), ...ids])]),
          }, allOn ? 'Quitar bloque' : 'Elegir bloque')),
        h('div', { class: 'mod-grid', role: 'group', 'aria-labelledby': f.groups.length > 1 ? `${labelId}-${g.id}` : labelId },
          g.modules.map((m) => {
            const on = current().includes(m.id);
            return h('button', {
              type: 'button', class: 'mod-card', role: 'checkbox', 'aria-checked': String(on), 'data-fk': `${f.id}:${m.id}`,
              onclick: () => set(on ? current().filter((x) => x !== m.id) : [...current(), m.id]),
            },
            h('span', { class: 'mod-ico' }, icon(m.icon)),
            h('span', { class: 'mod-txt' }, h('span', { class: 'mod-name' }, m.name), h('span', { class: 'mod-desc' }, m.desc)),
            h('span', { class: 'mod-check' }, icon('check')));
          })));
    }));
}

/** Casilla de aceptación: guarda la fecha y hora exactas en que se marcó. */
function consentControl(f, q, ctx, { id, describedBy }) {
  return h('label', { class: `consent ${ctx.errors[f.id] ? 'is-invalid' : ''}` },
    h('input', {
      id, type: 'checkbox', checked: Boolean(ctx.draft[f.id]), 'aria-describedby': describedBy, 'data-fk': f.id,
      'aria-invalid': ctx.errors[f.id] ? 'true' : null,
      onchange: (e) => { ctx.draft[f.id] = e.target.checked ? new Date().toISOString() : ''; ctx.clearError(f.id); ctx.rerender(); },
    }),
    h('span', { class: 'consent-box', 'aria-hidden': 'true' }, icon('check')),
    h('span', { class: 'consent-text' }, f.label));
}

/** Aviso informativo (no se responde). Puede llevar un enlace, p. ej. a una plantilla. */
function noticeControl(f) {
  return h('div', { class: `notice ${f.tone ? `notice-${f.tone}` : ''}`, role: 'note' },
    icon(f.icon || 'shield'),
    h('div', {}, h('p', {}, f.text),
      f.link ? h('a', { href: f.link.href, target: f.link.href.startsWith('mailto:') ? null : '_blank', rel: 'noopener', download: f.link.download || null }, icon(f.link.download ? 'download' : 'arrowRight'), f.link.label) : null));
}

/**
 * Lista desplegable de selección múltiple. Opciones como texto o { label, desc }.
 * Se queda abierta entre re-renderizados (ctx.msOpen).
 */
function multiselectBox({ ctx, key, options, label, open, getValue, setValue, fk }) {
  const read = getValue || (() => ctx.draft[key] || []);
  const write = setValue || ((v) => { ctx.draft[key] = v; });
  const sel = read();
  const opts = options.map((o) => (typeof o === 'string' ? { label: o } : o));
  const k = fk || key;
  ctx.msOpen ||= {};
  const isOpen = ctx.msOpen[k] ?? open ?? false;
  const box = h('details', {
    class: 'ms', open: isOpen || null,
    ontoggle: (e) => { ctx.msOpen[k] = e.currentTarget.open; },
  },
  h('summary', { 'data-fk': `${k}:summary` },
    h('span', { class: 'ms-label' }, sel.length ? sel.join(', ') : `${label}: elige una o varias`),
    h('span', { class: 'ms-count' }, sel.length ? String(sel.length) : '')),
  h('div', { class: 'ms-list', role: 'group', 'aria-label': label },
    opts.map((o, i) => h('label', { class: 'ms-item' },
      h('input', {
        type: 'checkbox', checked: sel.includes(o.label), 'data-fk': `${k}:${i}`,
        onchange: (e) => {
          const cur = read();
          write(e.target.checked ? [...cur, o.label] : cur.filter((x) => x !== o.label));
          ctx.rerender(`${k}:${i}`);
        },
      }),
      h('span', {}, h('span', { class: 'ms-name' }, o.label), o.desc ? h('span', { class: 'ms-desc' }, o.desc) : null)))));
  return box;
}

function multiselectControl(f, q, ctx) {
  const options = f.optionsFrom === 'modules' ? (ctx.chosenModules?.() || []) : f.options;
  return multiselectBox({ ctx, key: f.id, options, label: f.label, open: f.open });
}

/** Tabla de filas con columnas configurables (texto, correo, teléfono, hora, lista o selección múltiple). */
function rowsControl(f, q, ctx) {
  const empty = () => Object.fromEntries(f.columns.map((c) => [c.id, c.type === 'multiselect' ? [] : '']));
  return rowsEditor({
    f, ctx, title: f.rowLabel || 'Fila', addLabel: f.addLabel || 'Agregar',
    emptyRow: empty,
    cells: (row, i) => f.columns.map((c, col) => {
      if (c.showIf && row[c.showIf.col] !== c.showIf.eq) return null;
      const aria = `${c.label} (${(f.rowLabel || 'fila').toLowerCase()} ${i + 1})`;
      if (c.type === 'select') {
        return h('select', {
          class: 'select', 'aria-label': aria, 'data-fk': `${f.id}:${i}:${col}`,
          onchange: (e) => { row[c.id] = e.target.value; ctx.clearError(f.id); ctx.rerender(`${f.id}:${i}:${col}`); },
        }, h('option', { value: '', disabled: true, selected: !row[c.id] }, c.label),
        c.options.map((o) => h('option', { value: o, selected: row[c.id] === o }, o)));
      }
      if (c.type === 'multiselect') {
        const options = c.optionsFrom === 'modules' ? (ctx.chosenModules?.() || []) : c.options;
        return h('div', { class: 'row-ms' }, multiselectBox({
          ctx, key: `${f.id}:${i}:${c.id}`, fk: `${f.id}:${i}:${col}`, options, label: c.label,
          getValue: () => row[c.id] || [], setValue: (v) => { row[c.id] = v; ctx.clearError(f.id); },
        }));
      }
      const type = { email: 'email', phone: 'tel', time: 'time', number: 'text' }[c.type] || 'text';
      return cellInput(f, ctx, row, c.id, i, col, { type, placeholder: c.placeholder || c.label, 'aria-label': aria, autocomplete: 'off', inputmode: c.type === 'number' ? 'decimal' : null });
    }),
  });
}

/** KPIs por módulo: casillas con descripción y, por cada grupo con KPIs marcados, frecuencia y canal. */
function kpiGroupsControl(f, q, ctx, { labelId }) {
  const val = (ctx.draft[f.id] ||= {});
  const freq = (ctx.draft[`${f.id}__freq`] ||= {});
  const canal = (ctx.draft[`${f.id}__canal`] ||= {});
  const toggle = (store, gid, item, fk) => {
    const cur = store[gid] || [];
    store[gid] = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    ctx.clearError(f.id);
    ctx.rerender(fk);
  };
  const chips = (store, gid, opts, kind, label) => h('div', { class: 'kpi-sel' },
    h('span', { class: 'kpi-sel-label', id: `${labelId}-${gid}-${kind}` }, label),
    h('div', { class: 'chips', role: 'group', 'aria-labelledby': `${labelId}-${gid}-${kind}` },
      opts.map((o, i) => h('button', {
        type: 'button', class: 'chip', role: 'checkbox', 'aria-checked': String((store[gid] || []).includes(o)), 'data-fk': `${f.id}:${gid}:${kind}:${i}`,
        onclick: () => toggle(store, gid, o, `${f.id}:${gid}:${kind}:${i}`),
      }, h('span', { class: 'check' }, icon('check')), o))));

  return h('div', { class: 'kpi-groups', role: 'group', 'aria-labelledby': labelId },
    ctx.engine.kpiGroupsFor(f, ctx.answers).map((g) => {
      const sel = val[g.id] || [];
      return h('section', { class: `kpi-group ${sel.length ? 'is-active' : ''}`, 'aria-labelledby': `${labelId}-${g.id}` },
        h('div', { class: 'kpi-head' },
          h('h4', { id: `${labelId}-${g.id}` }, g.title),
          h('span', { class: 'kpi-count' }, sel.length ? `${sel.length} elegidos` : '')),
        h('div', { class: 'ms-list kpi-list' },
          g.kpis.map((k, i) => h('label', { class: 'ms-item' },
            h('input', {
              type: 'checkbox', checked: sel.includes(k.label), 'data-fk': `${f.id}:${g.id}:k:${i}`,
              onchange: () => toggle(val, g.id, k.label, `${f.id}:${g.id}:k:${i}`),
            }),
            h('span', {}, h('span', { class: 'ms-name' }, k.label), h('span', { class: 'ms-desc' }, k.desc))))),
        sel.length ? h('div', { class: 'kpi-extra' },
          chips(freq, g.id, f.frequencies, 'f', 'Frecuencia del resumen ejecutivo'),
          chips(canal, g.id, f.channels, 'c', 'Canal o destino de recepción')) : null);
    }));
}

const CONTROLS = {
  kpiGroups: kpiGroupsControl,
  notice: noticeControl,
  multiselect: multiselectControl,
  rows: rowsControl,
  consent: consentControl,
  idcard: textInput,
  modules: modulesControl,
  text: textInput, email: textInput, phone: textInput, url: textInput, taxid: textInput,
  number: textInput, date: textInput, time: textInput,
  textarea,
  single: singleChips,
  multi: multiChips,
  select,
  file: fileControl,
  users: usersControl,
  plans: plansControl,
  grid: gridControl,
  userRoles: userRolesControl,
};
