/**
 * Onboarding ZAK · iTech — Google Apps Script
 * ------------------------------------------------------------
 * 1) setupForm()   Crea el Google Form (mismas preguntas, orden y tipos que config/questions.json),
 *                  lo vincula a una hoja de Google Sheets y crea la carpeta de Drive para archivos.
 *                  Registra en el log el JSON de mapeo para pegar en config/form-mapping.json.
 * 1b) updateForm() Pone al día el Form existente tras cambiar las preguntas, sin perder la hoja,
 *                  la carpeta ni las respuestas. Es lo que hay que ejecutar en cada actualización.
 * 2) doPost(e)     Aplicación web que recibe las respuestas de la app y las envía al Form con
 *                  form.createResponse() → withItemResponse() → submit().
 *                  También recibe archivos (action: "upload") y los guarda en Drive.
 * 3) doGet()       Comprobación de estado.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script):
 *   QUESTIONS_URL    (opcional) URL pública de config/questions.json. Por defecto, la de onboarding.zak.ia.ve.
 *   NOTIFY_EMAIL     (opcional) Correo(s) del equipo iTech para recibir un resumen de cada onboarding.
 *   FORM_ID, SHEET_ID, UPLOAD_FOLDER_ID, ITEM_MAP  → las escribe setupForm() automáticamente.
 */

var MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB por archivo
var ALLOWED_MIME = /^(audio\/|image\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.|application\/vnd\.ms-excel|application\/vnd\.ms-powerpoint|text\/csv|text\/plain|application\/octet-stream)/;

/* ============================================================
   1. Creación del Form (ejecutar una sola vez desde el editor)
   ============================================================ */
var DEFAULT_QUESTIONS_URL = 'https://onboarding.zak.ia.ve/config/questions.json';

/** Lee questions.json (+ modules.json y agents.json) del sitio publicado. */
function loadSchema_(props) {
  var url = (props.getProperty('QUESTIONS_URL') || DEFAULT_QUESTIONS_URL).trim();
  // Si solo se puso el dominio del sitio, se completa la ruta del JSON.
  if (!/questions\.json/.test(url)) url = url.replace(/\/+$/, '') + '/config/questions.json';
  var schema = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: false }).getContentText());
  // Módulos + checklist: mismas reglas que js/readiness.js (buildModuleSchema).
  var mods = JSON.parse(UrlFetchApp.fetch(url.replace(/questions\.json.*$/, 'modules.json')).getContentText());
  var agents = JSON.parse(UrlFetchApp.fetch(url.replace(/questions\.json.*$/, 'agents.json')).getContentText());
  addModuleSchema_(schema, mods, agents);
  return schema;
}

/** Las condicionales (por respuesta o por módulo contratado) no pueden ser obligatorias en el Form. */
function isRequired_(schema, q) {
  var sec = schema.sections.filter(function (x) { return x.id === q.section; })[0] || {};
  return Boolean(q.required && !(q.showIf || q.modules || sec.modules));
}

function setupForm() {
  var props = PropertiesService.getScriptProperties();
  var schema = loadSchema_(props);

  var form = FormApp.create('Onboarding ZAK · iTech');
  form.setDescription('Respuestas del asistente de onboarding de ZAK. Las respuestas llegan desde la app; no compartas este formulario con clientes.');
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setProgressBar(true);

  var sectionTitle = {};
  schema.sections.forEach(function (s) { sectionTitle[s.id] = s.number === 0 ? s.title : s.number + '. ' + s.title; });
  var firstSection = schema.sections[0].id;

  var map = {};
  var lastSection = null;
  schema.questions.forEach(function (q) {
    if (q.section !== lastSection) {
      lastSection = q.section;
      var sec = schema.sections.filter(function (s) { return s.id === q.section; })[0];
      if (q.section === firstSection) form.addSectionHeaderItem().setTitle(sectionTitle[q.section]).setHelpText(sec.intro || '');
      else form.addPageBreakItem().setTitle(sectionTitle[q.section]).setHelpText(sec.intro || '');
    }
    var item = addItem_(form, q);
    if (item.setRequired) item.setRequired(isRequired_(schema, q));
    map[q.id] = item.getId();
  });

  // Ítems de control (no son preguntas del cuestionario).
  form.addPageBreakItem().setTitle('Control interno iTech');
  schema.controlItems.forEach(function (c) {
    var it = c.formType === 'PARAGRAPH_TEXT' ? form.addParagraphTextItem() : form.addTextItem();
    it.setTitle(c.formTitle);
    map[c.id] = it.getId();
  });

  // Hoja de respuestas vinculada.
  var ss = SpreadsheetApp.create('Onboarding ZAK · Respuestas');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // Carpeta de Drive para archivos adjuntos.
  var folder = DriveApp.createFolder('Onboarding ZAK · Archivos');

  props.setProperties({
    FORM_ID: form.getId(),
    SHEET_ID: ss.getId(),
    UPLOAD_FOLDER_ID: folder.getId(),
    ITEM_MAP: JSON.stringify(map),
  });

  Logger.log('Form (edición): ' + form.getEditUrl());
  Logger.log('Hoja de respuestas: ' + ss.getUrl());
  Logger.log('Carpeta de archivos: ' + folder.getUrl());
  Logger.log('Pega esto en config/form-mapping.json →\n' + JSON.stringify({ items: map }, null, 2));
}

/* ============================================================
   1b. Actualización del Form existente (tras cambiar las preguntas)
   Conserva el Form, la hoja de respuestas, la carpeta de Drive y las respuestas anteriores:
   añade las preguntas e ítems de control nuevos, actualiza títulos, opciones y obligatoriedad,
   y sustituye los ítems cuyo tipo cambió (el anterior queda como «(obsoleta)»).
   ============================================================ */
function updateForm() {
  var props = PropertiesService.getScriptProperties();
  var schema = loadSchema_(props);
  var form = FormApp.openById(prop_('FORM_ID'));
  var map = JSON.parse(props.getProperty('ITEM_MAP') || '{}');

  var byItemId = {}, byPrefix = {}, byTitle = {};
  form.getItems().forEach(function (it) {
    byItemId[it.getId()] = it;
    byTitle[it.getTitle()] = it;
    var m = /^([\w.-]+) · /.exec(it.getTitle());
    if (m) byPrefix[m[1]] = it;
  });
  var controlPage = form.getItems(FormApp.ItemType.PAGE_BREAK).filter(function (it) { return it.getTitle() === 'Control interno iTech'; })[0];
  var sectionTitle = {};
  schema.sections.forEach(function (s) { sectionTitle[s.id] = s.number === 0 ? s.title : s.number + '. ' + s.title; });

  var added = [], updated = [], replaced = [], lastSection = null;
  // Coloca un ítem recién creado justo antes de la sección «Control interno iTech».
  var place = function (item) { if (controlPage) form.moveItem(item, controlPage.getIndex()); };

  schema.questions.forEach(function (q) {
    var item = byItemId[map[q.id]] || byPrefix[q.id] || null;
    var want = FormApp.ItemType[q.formType] || FormApp.ItemType.PARAGRAPH_TEXT;
    if (item && item.getType() !== want) {
      item.setTitle('(obsoleta) ' + item.getTitle());
      if (item.setRequired) item.setRequired(false); // ya no recibe respuestas
      replaced.push(q.id);
      item = null;
    }
    var isNew = !item;
    if (item) {
      refreshItem_(item, q);
      updated.push(q.id);
    } else {
      if (q.section !== lastSection) {
        var sec = schema.sections.filter(function (s) { return s.id === q.section; })[0] || {};
        place(form.addPageBreakItem().setTitle(sectionTitle[q.section] || q.section).setHelpText(sec.intro || ''));
      }
      item = addItem_(form, q);
      place(item);
      if (replaced.indexOf(q.id) < 0) added.push(q.id);
    }
    // Las preguntas nuevas seguidas de una misma sección comparten un solo salto de página.
    lastSection = isNew ? q.section : null;
    if (item.setRequired) item.setRequired(isRequired_(schema, q));
    map[q.id] = item.getId();
  });

  // Preguntas que ya no están en el cuestionario: se conservan (con sus respuestas) pero dejan de ser obligatorias.
  var current = {};
  schema.questions.forEach(function (q) { current[q.id] = true; });
  Object.keys(byPrefix).forEach(function (id) {
    var it = byPrefix[id];
    if (current[id] || map[id] === it.getId()) return;
    it.setTitle('(obsoleta) ' + it.getTitle());
    if (it.setRequired) it.setRequired(false);
    replaced.push(id);
  });

  // Ítems de control nuevos (al final, dentro de «Control interno iTech»).
  if (!controlPage) form.addPageBreakItem().setTitle('Control interno iTech');
  schema.controlItems.forEach(function (c) {
    var it = byItemId[map[c.id]] || byTitle[c.formTitle];
    if (!it) {
      it = c.formType === 'PARAGRAPH_TEXT' ? form.addParagraphTextItem() : form.addTextItem();
      it.setTitle(c.formTitle);
      added.push(c.id);
    }
    map[c.id] = it.getId();
  });

  props.setProperty('ITEM_MAP', JSON.stringify(map));
  Logger.log('Añadidas (' + added.length + '): ' + added.join(', '));
  Logger.log('Marcadas «(obsoleta)» (cambio de tipo o eliminadas) (' + replaced.length + '): ' + replaced.join(', '));
  Logger.log('Actualizadas (' + updated.length + ')');
  Logger.log('Form (edición): ' + form.getEditUrl());
}

/** Pone al día el título y las opciones de un ítem existente del mismo tipo. */
function refreshItem_(item, q) {
  var field = q.formValueField ? q.fields.filter(function (f) { return f.id === q.formValueField; })[0] : null;
  item.setTitle(q.id + ' · ' + q.formTitle);
  switch (q.formType) {
    case 'MULTIPLE_CHOICE':
      item.asMultipleChoiceItem().setChoiceValues(field.options).showOtherOption(Boolean(field.other)); break;
    case 'CHECKBOX':
      item.asCheckboxItem().setChoiceValues(field.options).showOtherOption(Boolean(field.other)); break;
    case 'GRID':
      item.asGridItem().setRows(field.rows).setColumns(field.columns); break;
  }
}

/**
 * Inserta tras la primera sección «Módulos de ZAK», «Checklist» y «Agentes de IA por departamento»
 * (mismas reglas que js/readiness.js: buildModuleSchema + buildAgentSchema).
 */
function addModuleSchema_(schema, mod, agents) {
  var all = [];
  mod.groups.forEach(function (g) { all = all.concat(g.modules); });
  var states = mod.checklist.states.map(function (s) { return s.label; });
  var sections = [
    { id: 'sM', number: 0, title: 'Módulos de ZAK', intro: 'Módulos que contratará la empresa.' },
    { id: 'sC', number: 0, title: 'Checklist de preparación', intro: 'Requisitos por módulo: Lo tengo / En proceso / No lo tengo.' },
  ];
  var questions = [{
    id: mod.selection.id, section: 'sM', formType: 'CHECKBOX', required: true, formValueField: 'modulos', formTitle: mod.selection.formTitle,
    fields: [{ id: 'modulos', options: all.map(function (m) { return m.name; }) }],
  }].concat(all.filter(function (m) { return m.requirements && m.requirements.length; }).map(function (m) {
    return {
      id: 'C.' + m.id, section: 'sC', formType: 'GRID', required: true, showIf: { q: mod.selection.id }, formValueField: 'estado',
      formTitle: 'Checklist · ' + m.name,
      fields: [{ id: 'estado', rows: m.requirements.map(function (r) { return r.text; }), columns: states }],
    };
  }));
  if (agents) {
    sections.push({ id: agents.section.id, number: 0, title: agents.section.title, intro: 'Agentes de IA por departamento (solo si se elige el módulo ' + agents.requiresModule + ').' });
    questions.push({
      id: agents.selection.id, section: agents.section.id, formType: 'CHECKBOX', required: true, showIf: { q: mod.selection.id },
      formValueField: 'departamentos', formTitle: agents.selection.formTitle,
      fields: [{ id: 'departamentos', options: agents.departments.map(function (d) { return d.name; }) }],
    });
    agents.departments.forEach(function (d) {
      questions.push({
        id: 'A.' + d.id, section: agents.section.id, formType: 'PARAGRAPH_TEXT', required: true, showIf: { q: agents.selection.id },
        formTitle: agents.agent.formTitleTemplate.replace('{dept}', d.name), fields: [],
      });
    });
  }
  // Configuración técnica por módulo: antes del cierre (s13), igual que js/readiness.js (buildConfigSchema).
  var cfgSecs = [], cfgQs = [];
  all.forEach(function (m, i) {
    if (!m.config || !m.config.length) return;
    var sid = 'sX-' + m.id;
    cfgSecs.push({ id: sid, number: 100 + i, modules: [m.id], title: mod.configSection.titleTemplate.replace('{module}', m.name), intro: 'Solo si se contrata ' + m.name + '.' });
    m.config.forEach(function (c, k) {
      cfgQs.push({ id: 'X.' + m.id + '.' + (k + 1), section: sid, formType: 'PARAGRAPH_TEXT', required: true, formTitle: c.prompt, fields: [] });
    });
  });
  var s13 = 0, q13 = 0;
  schema.sections.forEach(function (s, i) { if (s.id === 's13') s13 = i; });
  schema.questions.forEach(function (q, i) { if (q.section === 's13' && !q13) q13 = i; });
  Array.prototype.splice.apply(schema.sections, [s13, 0].concat(cfgSecs));
  Array.prototype.splice.apply(schema.questions, [q13, 0].concat(cfgQs));

  // Se insertan después de «Datos de la empresa» (s0), igual que en la app.
  var idx = 0;
  schema.questions.forEach(function (q, i) { if (q.section === 's0') idx = i + 1; });
  var secIdx = 0;
  schema.sections.forEach(function (s, i) { if (s.id === 's0') secIdx = i + 1; });
  Array.prototype.splice.apply(schema.sections, [secIdx, 0].concat(sections));
  Array.prototype.splice.apply(schema.questions, [idx, 0].concat(questions));
}

function addItem_(form, q) {
  var title = q.id + ' · ' + q.formTitle;
  var field = q.formValueField ? q.fields.filter(function (f) { return f.id === q.formValueField; })[0] : null;
  switch (q.formType) {
    case 'TEXT':
      return form.addTextItem().setTitle(title);
    case 'MULTIPLE_CHOICE':
      return form.addMultipleChoiceItem().setTitle(title).setChoiceValues(field.options).showOtherOption(Boolean(field.other));
    case 'CHECKBOX':
      return form.addCheckboxItem().setTitle(title).setChoiceValues(field.options).showOtherOption(Boolean(field.other));
    case 'GRID':
      return form.addGridItem().setTitle(title).setRows(field.rows).setColumns(field.columns);
    case 'DATE':
      return form.addDateItem().setTitle(title);
    default:
      return form.addParagraphTextItem().setTitle(title);
  }
}

/* ============================================================
   2. Aplicación web
   ============================================================ */
function doGet() {
  return json_({ ok: true, service: 'onboarding-zak', formConfigured: Boolean(prop_('FORM_ID')) });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'upload') return json_(handleUpload_(body));
    if (body.action === 'submit') return json_(handleSubmit_(body));
    return json_({ ok: false, fatal: true, error: 'Acción no válida' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, fatal: Boolean(err.fatal), error: String(err.message || err) });
  }
}

function handleSubmit_(body) {
  if (body.website) return fatal_('Solicitud rechazada'); // campo trampa anti-spam
  if (!body.sessionId || !/^[\w-]{8,64}$/.test(body.sessionId)) return fatal_('ID de sesión no válido');
  if (!Array.isArray(body.answers) || !body.answers.length) return fatal_('No hay respuestas');
  if (!body.nda) return fatal_('Falta la aceptación del acuerdo de confidencialidad');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Idempotencia: si la app reintenta tras un envío que sí llegó, devolvemos la misma referencia.
    var cache = PropertiesService.getScriptProperties();
    var prev = cache.getProperty('sub_' + body.sessionId);
    if (prev) return { ok: true, reference: prev, duplicate: true };

    var form = FormApp.openById(prop_('FORM_ID'));
    var map = JSON.parse(prop_('ITEM_MAP') || '{}');
    var itemsById = {};
    var itemsByPrefix = {};
    form.getItems().forEach(function (it) {
      itemsById[it.getId()] = it;
      var m = /^([\w.-]+) · /.exec(it.getTitle());
      if (m) itemsByPrefix[m[1]] = it;
    });
    var find = function (id, itemId) {
      return itemsById[itemId] || itemsById[map[id]] || itemsByPrefix[id] || null;
    };

    var reference = makeReference_();
    var response = form.createResponse();
    var missing = [];

    body.answers.forEach(function (a) {
      var item = find(a.id, a.itemId);
      if (!item) { missing.push(a.id); return; }
      var r = itemResponse_(item, a.value);
      if (r) response.withItemResponse(r);
    });
    if (missing.length) return fatal_('El Form no tiene los ítems: ' + missing.join(', ') + '. Revisa config/form-mapping.json.');

    var rd = body.readiness || {};
    var ctl = {
      'ctl.reference': reference,
      'ctl.nda': String(body.nda || ''),
      'ctl.session': body.sessionId,
      'ctl.doubts': String(body.doubts || '').slice(0, 20000),
      'ctl.readiness': rd.overall != null ? String(rd.overall) : '',
      'ctl.level': rd.level || '',
      'ctl.byModule': rd.byModule || '',
      'ctl.missing': rd.missing || '',
      'ctl.info': body.info ? String(body.info.overall) : '',
      'ctl.consulting': body.info ? body.info.consulting : '',
      'ctl.infoDetail': body.info ? body.info.detail : '',
      'ctl.infoPending': body.info ? body.info.pending : '',
      'ctl.attachments': String(body.attachments || '').slice(0, 30000),
      'ctl.consulting2': String(body.consulting || '').slice(0, 20000),
    };
    Object.keys(ctl).forEach(function (id) {
      var item = itemsById[map[id]] || findByTitle_(form, id);
      if (item && ctl[id]) response.withItemResponse(itemResponse_(item, ctl[id]));
    });

    response.submit();
    cache.setProperty('sub_' + body.sessionId, reference);

    notify_(body, reference);
    return { ok: true, reference: reference, submittedAt: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

/** Crea la respuesta de un ítem según su tipo. */
function itemResponse_(item, value) {
  var type = item.getType();
  var str = function (v) { return String(v == null ? '' : v).slice(0, 30000); };
  switch (type) {
    case FormApp.ItemType.TEXT:
      return item.asTextItem().createResponse(str(value));
    case FormApp.ItemType.PARAGRAPH_TEXT:
      return item.asParagraphTextItem().createResponse(str(value));
    case FormApp.ItemType.MULTIPLE_CHOICE:
      return value ? item.asMultipleChoiceItem().createResponse(str(value)) : null;
    case FormApp.ItemType.CHECKBOX:
      return value && value.length ? item.asCheckboxItem().createResponse([].concat(value).map(str)) : null;
    case FormApp.ItemType.GRID:
      return item.asGridItem().createResponse([].concat(value).map(str));
    case FormApp.ItemType.DATE:
      return item.asDateItem().createResponse(new Date(value));
    default:
      throw new Error('Tipo de ítem no soportado: ' + type);
  }
}

function findByTitle_(form, id) {
  var titles = {
    'ctl.reference': 'Referencia de onboarding', 'ctl.nda': 'Registro de aceptación del NDA (versión, huella SHA-256, fecha)', 'ctl.session': 'ID de sesión', 'ctl.doubts': 'Dudas registradas durante el onboarding',
    'ctl.readiness': 'Preparación global (%)', 'ctl.level': 'Calificación de preparación',
    'ctl.byModule': 'Preparación por módulo', 'ctl.missing': 'Requisitos pendientes',
    'ctl.info': 'Información disponible (%)', 'ctl.consulting': 'Consultoría recomendada', 'ctl.infoDetail': 'Desglose de información',
    'ctl.infoPending': 'Información por completar', 'ctl.attachments': 'Adjuntos por pregunta', 'ctl.consulting2': 'Consultoría solicitada por el cliente',
  };
  var hit = form.getItems().filter(function (it) { return it.getTitle() === titles[id]; });
  return hit[0] || null;
}

function handleUpload_(body) {
  if (!body.sessionId || !/^[\w-]{8,64}$/.test(body.sessionId)) return fatal_('ID de sesión no válido');
  if (!body.data || !body.name) return fatal_('Archivo vacío');
  var bytes = Utilities.base64Decode(body.data);
  if (bytes.length > MAX_UPLOAD_BYTES) return fatal_('El archivo supera los 10 MB');
  var mime = String(body.mimeType || 'application/octet-stream');
  if (!ALLOWED_MIME.test(mime)) return fatal_('Formato de archivo no admitido');

  var root = DriveApp.getFolderById(prop_('UPLOAD_FOLDER_ID'));
  var sub = root.getFoldersByName(body.sessionId);
  var folder = sub.hasNext() ? sub.next() : root.createFolder(body.sessionId);
  var safeName = String(body.name).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
  var file = folder.createFile(Utilities.newBlob(bytes, mime, (body.questionId || 'archivo') + ' · ' + safeName));
  // El archivo queda privado: solo lo ven quienes tienen acceso a la carpeta (equipo iTech).
  return { ok: true, id: file.getId(), url: file.getUrl(), name: safeName };
}

/* ============================================================
   3. Notificación por correo (opcional)
   ============================================================ */
function notify_(body, reference) {
  var to = prop_('NOTIFY_EMAIL');
  if (!to) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var rows = body.answers.map(function (a) {
    var v = Array.isArray(a.value) ? a.value.join(', ') : a.value;
    return '<tr><td style="padding:6px 10px;color:#5E5866;vertical-align:top;white-space:nowrap">' + esc(a.id) + '</td>' +
      '<td style="padding:6px 10px"><div style="color:#5E5866;font-size:12px">' + esc(a.title) + '</div>' +
      '<div style="white-space:pre-line;color:#1C1C1C">' + esc(v) + '</div></td></tr>';
  }).join('');
  var sheetUrl = prop_('SHEET_ID') ? 'https://docs.google.com/spreadsheets/d/' + prop_('SHEET_ID') : '';
  var html =
    '<div style="font-family:Inter,Arial,sans-serif;max-width:720px">' +
    '<div style="background:linear-gradient(125deg,#53037B 0%,#A72DBC 100%);color:#fff;padding:20px 24px;border-radius:16px">' +
    '<div style="font-size:11px;letter-spacing:.24em">ONBOARDING · ZAK · iTech</div>' +
    '<div style="font-size:22px;margin-top:6px">Nuevo onboarding: ' + esc(body.company) + '</div>' +
    '<div style="margin-top:6px">Referencia <b>' + esc(reference) + '</b> · ' + esc(body.contactName) + ' · ' + esc(body.contactEmail) + '</div>' +
    (body.info ? '<div style="margin-top:10px;font-size:18px">Información: <b>' + esc(body.info.overall) + ' %</b> · ' + esc(body.info.consulting) + '</div>' : '') +
    (body.readiness ? '<div style="margin-top:4px">Preparación de módulos: <b>' + esc(body.readiness.overall) + ' %</b> · ' + esc(body.readiness.level) + '</div>' : '') +
    (body.taxId ? '<div style="margin-top:4px">RIF: ' + esc(body.taxId) + ' · ' + esc(body.legalName) + '</div>' : '') +
    '</div>' +
    (body.consulting ? '<h3 style="color:#53037B">Consultoría solicitada</h3><p style="white-space:pre-line">' + esc(body.consulting) + '</p>' : '') +
    (body.info ? '<h3 style="color:#53037B">Información por completar</h3><p style="white-space:pre-line">' + esc(body.info.pending) + '</p>' : '') +
    (body.readiness ? '<h3 style="color:#53037B">Preparación por módulo</h3><p style="white-space:pre-line">' + esc(body.readiness.byModule) + '</p>' +
      '<h3 style="color:#53037B">Requisitos pendientes</h3><p style="white-space:pre-line">' + esc(body.readiness.missing) + '</p>' : '') +
    (sheetUrl ? '<p><a href="' + sheetUrl + '" style="color:#53037B">Abrir la hoja de respuestas</a></p>' : '') +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' + rows + '</table>' +
    (body.doubts ? '<h3 style="color:#53037B">Dudas registradas</h3><p style="white-space:pre-line">' + esc(body.doubts) + '</p>' : '') +
    '</div>';
  MailApp.sendEmail({
    to: to,
    subject: 'Nuevo onboarding ZAK · ' + (body.company || 'Sin nombre') + (body.info ? ' · ' + body.info.overall + ' % info · ' + body.info.consulting : '') + ' · ' + reference,
    htmlBody: html,
    replyTo: body.contactEmail || undefined,
  });
}

/* ============================================================
   Utilidades
   ============================================================ */
function makeReference_() {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para evitar confusiones
  var s = '';
  for (var i = 0; i < 6; i++) s += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  return 'ZAK-' + new Date().getFullYear() + '-' + s;
}

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function fatal_(msg) { var e = new Error(msg); e.fatal = true; throw e; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
