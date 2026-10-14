/**
 * Onboarding ZAK · iTech — Google Apps Script
 * ------------------------------------------------------------
 * 1) setupForm()   Crea el Google Form (mismas preguntas, orden y tipos que config/questions.json),
 *                  lo vincula a una hoja de Google Sheets y crea la carpeta de Drive para archivos.
 *                  Registra en el log el JSON de mapeo para pegar en config/form-mapping.json.
 * 2) doPost(e)     Aplicación web que recibe las respuestas de la app y las envía al Form con
 *                  form.createResponse() → withItemResponse() → submit().
 *                  También recibe archivos (action: "upload") y los guarda en Drive.
 * 3) doGet()       Comprobación de estado.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script):
 *   QUESTIONS_URL    URL pública de config/questions.json (tu sitio en Netlify). Solo para setupForm().
 *   NOTIFY_EMAIL     (opcional) Correo(s) del equipo iTech para recibir un resumen de cada onboarding.
 *   FORM_ID, SHEET_ID, UPLOAD_FOLDER_ID, ITEM_MAP  → las escribe setupForm() automáticamente.
 */

var MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB por archivo
var ALLOWED_MIME = /^(audio\/|image\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.|application\/vnd\.ms-excel|text\/csv|application\/octet-stream)/;

/* ============================================================
   1. Creación del Form (ejecutar una sola vez desde el editor)
   ============================================================ */
function setupForm() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('QUESTIONS_URL');
  if (!url) throw new Error('Define la propiedad QUESTIONS_URL con la URL de config/questions.json');
  var schema = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: false }).getContentText());
  // Módulos + checklist: mismas reglas que js/readiness.js (buildModuleSchema).
  var mods = JSON.parse(UrlFetchApp.fetch(url.replace(/questions\.json.*$/, 'modules.json')).getContentText());
  addModuleSchema_(schema, mods);

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
    // Las condicionales no pueden ser obligatorias en el Form: solo se responden si aplican.
    if (item.setRequired) item.setRequired(Boolean(q.required && !q.showIf));
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

/** Inserta las secciones «Módulos de ZAK» y «Checklist» tras la primera sección (igual que la app). */
function addModuleSchema_(schema, mod) {
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
  }].concat(all.map(function (m) {
    return {
      id: 'C.' + m.id, section: 'sC', formType: 'GRID', required: true, showIf: { q: mod.selection.id }, formValueField: 'estado',
      formTitle: 'Checklist · ' + m.name,
      fields: [{ id: 'estado', rows: m.requirements.map(function (r) { return r.text; }), columns: states }],
    };
  }));
  var first = schema.sections[0].id;
  var idx = 0;
  schema.questions.forEach(function (q, i) { if (q.section === first) idx = i + 1; });
  Array.prototype.splice.apply(schema.sections, [1, 0].concat(sections));
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
      'ctl.session': body.sessionId,
      'ctl.doubts': String(body.doubts || '').slice(0, 20000),
      'ctl.readiness': rd.overall != null ? String(rd.overall) : '',
      'ctl.level': rd.level || '',
      'ctl.byModule': rd.byModule || '',
      'ctl.missing': rd.missing || '',
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
    'ctl.reference': 'Referencia de onboarding', 'ctl.session': 'ID de sesión', 'ctl.doubts': 'Dudas registradas durante el onboarding',
    'ctl.readiness': 'Preparación global (%)', 'ctl.level': 'Calificación de preparación',
    'ctl.byModule': 'Preparación por módulo', 'ctl.missing': 'Requisitos pendientes',
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
    (body.readiness ? '<div style="margin-top:10px;font-size:18px">Preparación: <b>' + esc(body.readiness.overall) + ' %</b> · ' + esc(body.readiness.level) + '</div>' : '') +
    '</div>' +
    (body.readiness ? '<h3 style="color:#53037B">Preparación por módulo</h3><p style="white-space:pre-line">' + esc(body.readiness.byModule) + '</p>' +
      '<h3 style="color:#53037B">Requisitos pendientes</h3><p style="white-space:pre-line">' + esc(body.readiness.missing) + '</p>' : '') +
    (sheetUrl ? '<p><a href="' + sheetUrl + '" style="color:#53037B">Abrir la hoja de respuestas</a></p>' : '') +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' + rows + '</table>' +
    (body.doubts ? '<h3 style="color:#53037B">Dudas registradas</h3><p style="white-space:pre-line">' + esc(body.doubts) + '</p>' : '') +
    '</div>';
  MailApp.sendEmail({
    to: to,
    subject: 'Nuevo onboarding ZAK · ' + (body.company || 'Sin nombre') + (body.readiness ? ' · ' + body.readiness.overall + ' % preparado' : '') + ' · ' + reference,
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
