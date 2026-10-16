# Tabla de verificación · Onboarding ZAK

Generada automáticamente comparando **Onboarding.docx** con `config/questions.json` (script en `docs/verificar.py`).

- Preguntas en el documento: **60** · Preguntas del documento en la app: **60** · Coincidencias (misma sección, mismo orden, texto ≥ 90 % idéntico): **60/60**
- El título de cada ítem del Form es `ID · texto del documento`, generado por `setupForm()` desde el mismo JSON: app y Form no pueden desalinearse.
- Obligatorias: el documento no marca ninguna, así que todas lo son (no hay "comentarios adicionales"). Las condicionales son obligatorias en la app solo cuando aparecen; en el Form quedan como no obligatorias para que el envío no falle cuando no aplican.

## Acuerdo de confidencialidad (primer paso, a petición de iTech)

| ID | Pregunta | Componente en la app | Ítem en Form | Obligatoria |
|---|---|---|---|---|
| N.1 | Aceptación del Acuerdo de Confidencialidad y Protección de Datos | Acuerdo en el chat (resumen y texto completo) + nombre, cédula, cargo y 2 casillas de aceptación | Párrafo | Sí. Sin aceptación, el Apps Script rechaza el envío |

El texto está en `config/nda.json` (versión 1.0, **borrador pendiente de revisión legal**). Cada aceptación registra la fecha y hora de cada casilla, la versión y la huella SHA-256 del texto aceptado.

## Sección 0 · Datos de la empresa (añadida con aprobación de iTech, no está en el documento)

| ID | Pregunta | Componente en la app | Ítem en Form | Obligatoria |
|---|---|---|---|---|
| 0.1 | Nombre de la empresa | texto | Respuesta corta | Sí |
| 0.2 | RIF o ID fiscal, razón social y comprobante (verificación de WhatsApp Business) | RIF + texto + archivo (con enlace al SENIAT) | Párrafo | Sí (los tres datos, incluido el comprobante) |
| 0.3 | Nombre de la persona de contacto | texto | Respuesta corta | Sí |
| 0.4 | Correo de contacto | correo | Respuesta corta | Sí |
| 0.5 | Teléfono de contacto | teléfono | Respuesta corta | Sí |

## Secciones añadidas a petición de iTech: Módulos de ZAK y checklist de preparación

Se generan desde `config/modules.json` (lista oficial de 18 módulos). La app (`js/readiness.js`) y `setupForm()` (Apps Script) aplican las mismas reglas.

| ID | Pregunta | Componente en la app | Ítem en Form | Obligatoria |
|---|---|---|---|---|
| M.1 | ¿Qué módulos de ZAK contratará la empresa? | Tarjetas de módulos (selección múltiple) | Casillas (18 opciones) | Sí |
| C.dashboard | Checklist · Dashboard (3 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.adstudio | Checklist · AdStudio (4 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.agentes-ia | Checklist · Agentes IA (4 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.contactos | Checklist · Contactos (3 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.inbox | Checklist · Inbox Omnicanal (6 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.call-center | Checklist · Call Center (5 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.pipelines | Checklist · Pipelines (4 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.web-funnels | Checklist · Web & Funnels (4 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.ventas | Checklist · Ventas (6 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.email-marketing | Checklist · Email Marketing (4 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.calendario | Checklist · Calendario (3 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.workforce | Checklist · Workforce Center (4 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.rrhh | Checklist · Recursos Humanos (4 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.cowork | Checklist · Cowork (3 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.number-master | Checklist · Number Master (3 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.contabilidad | Checklist · Contabilidad (4 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.workflows | Checklist · Workflows (3 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |
| C.piloto-automatico | Checklist · Piloto Automático (4 requisitos) | Cuadrícula Lo tengo / En proceso / No lo tengo | Cuadrícula | Sí, si se elige el módulo |

**Puntuación:** Lo tengo = 100 %, En proceso = 50 %, No lo tengo = 0 %. Cada módulo es el promedio de sus requisitos, y la preparación global es el promedio de los módulos elegidos. Niveles: ≥ 80 % alta, 50–79 % media, < 50 % inicial.

**Ítems de control nuevos:** Preparación global (%), Calificación de preparación, Preparación por módulo y Requisitos pendientes.

## Agentes de IA por departamento (a petición de iTech)

Se generan desde `config/agents.json` y solo aparecen si el cliente elige el módulo **Agentes IA**.

| ID | Pregunta | Componente en la app | Ítem en Form | Obligatoria |
|---|---|---|---|---|
| A.1 | ¿Para qué departamentos necesita la empresa agentes de IA? | Tarjetas de departamentos | Casillas (9 opciones) | Sí, si se elige Agentes IA |
| A.recepcion | Agente de IA · Recepción | nombre y puesto, funciones, autonomía, canales, documentos | Párrafo (con enlaces de Drive) | Sí, si se elige el departamento |
| A.ventas | Agente de IA · Ventas | nombre y puesto, funciones, autonomía, canales, documentos | Párrafo (con enlaces de Drive) | Sí, si se elige el departamento |
| A.cotizador | Agente de IA · Cotizador | nombre y puesto, funciones, autonomía, canales, documentos | Párrafo (con enlaces de Drive) | Sí, si se elige el departamento |
| A.cobranza | Agente de IA · Cobranza | nombre y puesto, funciones, autonomía, canales, documentos | Párrafo (con enlaces de Drive) | Sí, si se elige el departamento |
| A.soporte | Agente de IA · Soporte | nombre y puesto, funciones, autonomía, canales, documentos | Párrafo (con enlaces de Drive) | Sí, si se elige el departamento |
| A.agenda | Agente de IA · Agenda | nombre y puesto, funciones, autonomía, canales, documentos | Párrafo (con enlaces de Drive) | Sí, si se elige el departamento |
| A.rrhh | Agente de IA · Recursos Humanos | nombre y puesto, funciones, autonomía, canales, documentos | Párrafo (con enlaces de Drive) | Sí, si se elige el departamento |
| A.reportes | Agente de IA · Reportes | nombre y puesto, funciones, autonomía, canales, documentos | Párrafo (con enlaces de Drive) | Sí, si se elige el departamento |
| A.otro | Agente de IA · Otro departamento | ¿Qué departamento?, nombre y puesto, funciones, autonomía, canales, documentos | Párrafo (con enlaces de Drive) | Sí, si se elige el departamento |

## Funciones transversales

- **Adjuntos en todas las preguntas:** botón «Adjuntar documento o imagen» (PDF, Word, Excel, PowerPoint, texto o imágenes de hasta 10 MB). No aparece en las preguntas que ya piden su propio archivo. Los enlaces van en el ítem de la pregunta, si es de párrafo, y siempre en «Adjuntos por pregunta».
- **«No lo tengo» → «¿Qué te falta?»:** en el checklist, cada requisito marcado «No lo tengo» abre un campo de texto. La nota va a «Requisitos pendientes».
- **Nivel de información:** barra en el encabezado y tarjeta en el resumen. Reglas en `config/scoring.json`: «No sé» = 0, respuestas parciales = 0,5, carencias clave (p. ej. sin tarjeta en Meta) = 0, comprobante del RIF sin adjuntar = 0,5. Global = 50 % cuestionario + 50 % checklist. Recomendación: ≥ 80 % consultoría básica, 50–79 % estándar, < 50 % intensiva.

## Revisión del 14-10-2026 (lista de mejoras de iTech)

| Área | Cambio aplicado |
|---|---|
| Kira | Es la asistente del onboarding: lee en voz alta la introducción de cada sección y cada pregunta, con un botón «Escuchar» en cada una y un interruptor de voz en el encabezado. Audios de ElevenLabs con `tools/generar_voz.py --kira`; sin ellos, voz del navegador. |
| Lectura y scroll | Al elegir opciones, el panel conserva la posición de lectura y el foco no desplaza la vista. |
| Navegación | El botón superior dice «Editar mis respuestas». |
| Checklist | Menú desplegable por requisito: «Sí, lo tengo» (detalle), «Lo estoy preparando» (¿para cuándo?), «No lo tengo» (¿qué te falta? + consultoría) y «No sé / necesito orientación» (consultoría). |
| Archivos | «Adjuntar archivo» (documentos o imágenes) en las preguntas sin archivo propio. El onboarding no recibe audios: el de la voz clonada (4.4) se envía a zak@itech.com.ve. |
| Consultoría | Con «No sé», con un «No» que indica una carencia (p. ej. sin tarjeta en Meta), con un texto «no»/«no sé» o con «No lo tengo definido», aparece «¿Quieres que un consultor de iTech te ayude con esto?». Todo llega al Form en «Consultoría solicitada por el cliente». |
| Agentes de IA | Nombre y Rol separados. «¿Qué puede hacer el agente por sí solo?» y «¿Qué debe consultar antes de actuar?» separados. |
| Horarios | Una sola pregunta de horario (4.6 si hay Call Center; si no, la de Agentes IA), con opción 24/7 que oculta días y horas, y «¿Qué debe indicar el agente autorizado fuera del horario de atención?». |
| Agentes de voz | Roles: Prospección, Ventas, Soporte técnico, Confirmación de citas, Cobranza y Otro. Género de la voz. «Objetivos de la llamada» con 11 opciones. |
| Inbox | 5.1 pide adjuntar o listar los documentos clave. 5.5: «Temas que la IA nunca debe hacer o responder». |
| Redes y Meta | 10.1: un campo por cada red elegida. 3.2: vinculación Instagram–Facebook y quién administra la página. |
| Marca y guiones | Manual de marca (9.2 y AdStudio): adjuntarlo o crearlo con iTech. Guiones de llamada: adjuntarlos o pedir consultoría. |
| KPIs y tableros | Vista principal del Dashboard en lista desplegable. 1.3 «Otro» abre el catálogo de 14 KPIs con descripción. Workforce: tiempo de ejecución, tiempo vencido y tiempo total de la tarea. Resúmenes del equipo con listas de KPIs de Pipeline y Ventas y frecuencia. Objetivos cuantitativos y cualitativos. Público objetivo con opciones + «Otro». Género del avatar. |
| Equipo y usuarios | 1.6 admite varios responsables. Organigrama: «Muéstrame tu organigrama en el Workforce». Plantilla de usuarios en Excel (Nombre, Apellido, Correo, Teléfono). La tabla de usuarios incluye tipo (Colaborador/Administrador) y módulos autorizados, por lo que 7.2 y 7.3 solo se preguntan si se sube la plantilla. Externos con datos y módulos. |
| Operación y finanzas | SLA en tabla por canal (con «No lo tengo definido» → consultoría). Base de contactos y listas de llamadas: no se suben; se envían a zak@itech.com.ve. Nota de iTech en la sincronización con el ERP, más la descripción departamental. Delegación de escaladas sin respuesta. Excel de Number Master obligatorio o consultoría. Cuentas bancarias nacionales e internacionales. |
| KPIs de la gerencia (12.2) | Menú de 23 KPIs con descripción en 4 grupos por módulo: Agentes de IA y Conversaciones; CRM y Ventas; Equipo y Productividad; Finanzas, Cobranza y ERP. Solo se muestran los grupos de los módulos contratados (si ninguno aplica, por ejemplo solo Dashboard, se muestran todos). Por cada grupo con KPIs marcados se pide la frecuencia (diaria, semanal o mensual) y el canal (correo, notificación en el panel o mensaje directo de Kira). |
| Redundancias | «Upsell» → «post-venta». Sin sección duplicada de Web & Funnels (DNS y medición pasan a 11.1). Email Marketing consolidado en la sección 9 (nueva 9.4), sin checklist repetido. Se omite «¿Qué debe pasar automáticamente en cada etapa?». Calendario: cada pregunta combina opciones y texto (tipos de cita con duración y modalidad presencial/virtual; agendas por persona con días y horas). |

## Preguntas según los módulos contratados

El cliente solo ve las preguntas de los módulos que eligió en M.1. Una sección o pregunta aparece si el cliente eligió **al menos uno** de sus módulos. La regla está en `config/questions.json` (`"modules"` en la sección o en la pregunta).

**Preguntas que se hacen siempre** (necesarias en cualquier implementación): 1.1 actividad, 1.2 problema a resolver, 1.4 herramientas actuales, 1.6 responsable del proyecto, 7.1 usuarios, 7.2 roles, 7.3 módulos por persona, 7.5 usuarios externos, 12.1 acciones por voz con Kira, 12.2 KPIs de los resúmenes y reportes, 12.3 restricciones de Kira y datos financieros, 13.1 políticas de datos, 13.3 fecha de salida y 13.4 capacitación. A estas se suman el acuerdo de confidencialidad, los datos de la empresa y la selección de módulos.

| Sección | Se pregunta si elige… | Excepciones por pregunta |
|---|---|---|
| 1. Contexto del negocio y objetivos | Siempre, salvo las excepciones | 1.3: Dashboard, Number Master, Workforce Center; 1.5: Contactos, Pipelines, Inbox Omnicanal, Ventas, Email Marketing |
| 2. WhatsApp (vía Zernio / API) | Call Center, Inbox Omnicanal, Agentes IA | — |
| 3. Instagram DMs | Inbox Omnicanal | — |
| 4. Agentes de voz (Call Center IA) | Call Center | — |
| 5. Agente de texto (Inbox omnicanal) | Inbox Omnicanal, Agentes IA, Piloto Automático | — |
| 6. Integración con ERP (si aplica) | Contabilidad, Ventas | — |
| 7. Estructura organizacional (equipo y roles) | Siempre, salvo las excepciones | 7.4: Pipelines, Inbox Omnicanal, Ventas, Contactos, Call Center |
| 8. Ventas (Motor de Ventas) | Ventas | 8.5: Ventas, Pipelines |
| 9. Email marketing | Email Marketing | 9.1: Email Marketing, Contactos |
| 10. Ad Studio | AdStudio | 10.1: AdStudio, Web & Funnels; 10.2: AdStudio, Web & Funnels |
| 11. Web (sitios, formularios y análisis) | Web & Funnels | 11.4: Web & Funnels, Dashboard, Number Master |
| 12. Kira (copiloto de voz) y reportes IA | Siempre: Kira es la voz que maneja ZAK en el panel de cada módulo | — |
| 13. Seguridad, cumplimiento y cierre | Siempre, salvo las excepciones | 13.2: Call Center, Agentes IA, Inbox Omnicanal, Piloto Automático |

En el Form, las preguntas que dependen de módulos son no obligatorias. El checklist (C.*), los agentes (A.*) y la configuración por módulo (X.*) también dependen de los módulos elegidos.

Ejemplos verificados (sin contar acuerdo, datos de la empresa y selección de módulos): solo Calendario, 19 pasos; solo Pipelines, 22; solo Dashboard, 20; los 18 módulos, 144 pasos en total.

## Configuración técnica por módulo (a petición de iTech)

Cada módulo contratado añade una sección «Configuración · <módulo>» antes del cierre (sección 13). Se genera desde `config/modules.json` (campo `config`). Web & Funnels y Email Marketing no tienen sección propia, para no duplicar las secciones 11 y 9.
Total: **47 preguntas**.


**Dashboard**

| ID | Pregunta | Campos |
|---|---|---|
| X.dashboard.1 | ¿Qué indicadores quieres ver al entrar al panel de ZAK? | Indicadores de la vista principal (lista desplegable), Otro indicador (texto) |
| X.dashboard.2 | ¿A qué objetivos mensuales responderá el panel? | Objetivos cuantitativos (texto largo), Objetivos cualitativos (texto largo) |
| X.dashboard.3 | ¿Quiénes verán el panel y qué datos no deben ver algunos roles? | Quién ve qué (texto largo) |

**AdStudio**

| ID | Pregunta | Campos |
|---|---|---|
| X.adstudio.1 | ¿Quién aprueba los anuncios antes de publicarlos? | Responsable de aprobación (texto) |
| X.adstudio.2 | ¿En qué idiomas y países se publicarán las campañas? | Idiomas (texto), Países (texto) |
| X.adstudio.3 | ¿Cuál es el presupuesto mensual aproximado de publicidad? | Presupuesto mensual (número), Moneda (opción única) |
| X.adstudio.4 | ¿Tienes manual de marca y material de tus productos? | Manual de marca (opción única), Manual de marca y fotos o videos de productos (archivos) |

**Agentes IA**

| ID | Pregunta | Campos |
|---|---|---|
| X.agentes-ia.1 | ¿Qué límite de uso o gasto mensual de IA quieres fijar? | Tope de uso o gasto (texto largo) |
| X.agentes-ia.2 | ¿En qué horario deben atender los agentes de IA? | Días (casillas), Desde (hora), Hasta (hora), ¿Qué debe indicar el agente autorizado fuera del horario de atención? (texto largo) |

**Contactos**

| ID | Pregunta | Campos |
|---|---|---|
| X.contactos.1 | ¿Qué datos guardan de cada contacto? | Campos del contacto (casillas) |
| X.contactos.2 | ¿Qué etiquetas o segmentos usan para clasificar a los contactos? | Etiquetas o segmentos (texto largo) |
| X.contactos.3 | Si un contacto llega repetido, ¿cómo lo unimos? | Contactos duplicados (opción única) |

**Inbox Omnicanal**

| ID | Pregunta | Campos |
|---|---|---|
| X.inbox.1 | Además de WhatsApp e Instagram, ¿qué canales conectamos al inbox? | Otros canales (casillas) |
| X.inbox.2 | ¿Cómo se reparten las conversaciones entre las personas del equipo? | Reparto de conversaciones (opción única) |
| X.inbox.3 | ¿Tienen respuestas rápidas o mensajes predefinidos que usan hoy? | Respuestas rápidas (texto largo), Archivo con respuestas rápidas (archivos) |

**Call Center**

| ID | Pregunta | Campos |
|---|---|---|
| X.call-center.1 | ¿Usarán un número nuevo o el actual? ¿De qué país y ciudad? | Número del call center (opción única), País y ciudad del número (texto) |
| X.call-center.2 | Cuando la IA transfiere a un humano, ¿a qué número o persona va la llamada? | Destino de la transferencia (texto) |
| X.call-center.3 | ¿Tienes guiones para las llamadas? | Guiones (opción única), Guiones de llamada (archivos), Las listas de clientes para llamadas sal (aviso) |

**Pipelines**

| ID | Pregunta | Campos |
|---|---|---|
| X.pipelines.1 | ¿Qué embudos necesitas y cuáles son sus etapas? | Embudos y etapas (texto largo) |
| X.pipelines.2 | ¿Qué datos debe tener cada trato? | Datos del trato (casillas) |
| X.pipelines.3 | ¿Por qué motivos se pierden las ventas hoy? | Motivos de pérdida (texto largo) |

**Ventas**

| ID | Pregunta | Campos |
|---|---|---|
| X.ventas.1 | Sube tu catálogo o lista de precios para cargarlo en ZAK. | Catálogo o lista de precios (archivos) |
| X.ventas.2 | ¿Qué numeración usan para cotizaciones y facturas? | Formato de numeración (texto) |

**Calendario**

| ID | Pregunta | Campos |
|---|---|---|
| X.calendario.1 | ¿Qué tipos de cita manejan, cuánto dura cada una y son presenciales o virtuales? | Tipos de cita (tabla de filas) |
| X.calendario.2 | ¿Quiénes reciben citas y en qué horario? | Agendas (tabla de filas) |
| X.calendario.3 | ¿Cuándo y por dónde se envían los recordatorios? | Anticipación (opción única), Canal del recordatorio (casillas), Detalle de los recordatorios (texto largo) |
| X.calendario.4 | ¿Qué calendario usan hoy? | Calendario actual (opción única), Cuenta o correo del calendario (texto) |

**Workforce Center**

| ID | Pregunta | Campos |
|---|---|---|
| X.workforce.1 | Muéstrame tu organigrama en el Workforce. | Organigrama (imagen o PDF) (archivos), O descríbelo (texto largo) |
| X.workforce.2 | ¿Qué indicadores se miden por colaborador? | Indicadores por colaborador (casillas) |
| X.workforce.3 | ¿Qué resúmenes del equipo quieres recibir y con qué frecuencia? | Resúmenes del Pipeline (lista desplegable), Resúmenes de Ventas (lista desplegable), Frecuencia (opción única) |

**Recursos Humanos**

| ID | Pregunta | Campos |
|---|---|---|
| X.rrhh.1 | ¿Cuántos empleados tiene la empresa? | Número de empleados (número) |
| X.rrhh.2 | ¿Qué procesos de Recursos Humanos quieres gestionar en ZAK? | Procesos de RR. HH. (casillas) |
| X.rrhh.3 | Sube la lista de empleados con su cargo y área. | Lista de empleados (archivos) |
| X.rrhh.4 | ¿Usan algún sistema de nómina o RR. HH. que debamos conectar? | Sistema de nómina o RR. HH. (texto) |

**Cowork**

| ID | Pregunta | Campos |
|---|---|---|
| X.cowork.1 | ¿Qué grupos o canales internos necesitas crear en Cowork? | Grupos internos (texto largo) |
| X.cowork.2 | ¿Qué usan hoy para comunicarse internamente? | Herramienta actual (opción única) |
| X.cowork.3 | ¿Quién abrirá los casos con el soporte de ZAK? | Responsable de soporte (texto) |

**Number Master**

| ID | Pregunta | Campos |
|---|---|---|
| X.number-master.1 | Completa el Excel de Number Master: indicador, peso, meta y responsable por área. | Descarga la plantilla, complétala y súbe (aviso), ¿Cómo lo prefieres? (opción única), Excel de Number Master completado (archivos) |

**Contabilidad**

| ID | Pregunta | Campos |
|---|---|---|
| X.contabilidad.1 | ¿Qué cuentas bancarias se concilian? | Cuentas bancarias nacionales a conciliar (texto largo), Cuentas bancarias internacionales (si aplica) (texto largo) |
| X.contabilidad.2 | ¿Cómo obtendremos los movimientos bancarios? | Origen de los movimientos (opción única) |
| X.contabilidad.3 | Sube tu plan de cuentas o catálogo contable. | Plan de cuentas (archivos) |

**Workflows**

| ID | Pregunta | Campos |
|---|---|---|
| X.workflows.1 | Describe los procesos repetitivos que quieres automatizar. | Procesos a automatizar (texto largo) |
| X.workflows.2 | ¿Qué eventos deben disparar automatizaciones? | Eventos (casillas) |
| X.workflows.3 | ¿Quién aprueba las automatizaciones nuevas? | Responsable de aprobación (texto) |

**Piloto Automático**

| ID | Pregunta | Campos |
|---|---|---|
| X.piloto-automatico.1 | ¿Hasta qué monto puede la IA cerrar una venta sin pedir autorización? | Monto máximo (número), Moneda (opción única) |
| X.piloto-automatico.2 | ¿Qué descuento máximo puede ofrecer la IA sin consultar? | Descuento máximo (%) (número) |
| X.piloto-automatico.3 | ¿Quién autoriza lo que la IA consulta y por qué canal le llega el aviso? | Quién autoriza (texto), Canal del aviso (casillas) |

## Secciones 1–13 · Preguntas del documento

| ID | Pregunta del documento (texto original) | Componente en la app | Ítem en Form | Obligatoria (app) | Obligatoria (Form) | Condicional | Verificada |
|---|---|---|---|---|---|---|---|
| 1.1 | ¿Cuál es la actividad principal de la empresa y en qué países o ciudades opera? | texto largo, texto | Párrafo | Sí | Sí | — | ✅ |
| 1.2 | ¿Qué problema concreto quieren resolver con ZAK en los próximos 90 días? | texto largo | Párrafo | Sí | Sí | — | ✅ |
| 1.3 | ¿Qué indicadores usarán para medir el éxito? Por ejemplo: tiempo de respuesta, tasa de conversión, ingresos cobrados o tickets resueltos. | casillas | Casillas | Sí | Sí | — | ✅ |
| 1.4 | ¿Qué herramientas usan hoy para ventas, atención, cobros y marketing? ¿Cuáles vamos a reemplazar y cuáles deben convivir con ZAK? | texto largo, texto | Párrafo | Sí | Sí | — | ✅ |
| 1.5 | ¿Tienen una base de contactos o clientes para migrar? ¿En qué formato está (Excel, CSV u otro CRM) y cuántos registros tiene aproximadamente? | chips (única), texto, número | Párrafo | Sí | Sí | — | ✅ |
| 1.6 | ¿Quién será el responsable interno del proyecto y quién tiene la autoridad para aprobar decisiones? | texto | Párrafo | Sí | Sí | — | ✅ |
| 2.1 | ¿Qué número usaremos? ¿Está activo hoy en la app de WhatsApp o WhatsApp Business de algún celular? | teléfono, chips (única) | Párrafo | Sí | Sí | — | ✅ |
| 2.2 | Si está en uso, ¿aceptan migrarlo a la API? Deben saber que dejará de funcionar en la app móvil. ¿O prefieren habilitar una línea nueva? | chips (única) | Opción múltiple | Sí, si aplica | No (condicional) | Sí | ✅ |
| 2.3 | ¿Tienen acceso de administrador al Meta Business Portfolio (Business Manager) de la empresa? ¿Quién es el titular? | chips (única), texto | Párrafo | Sí | Sí | — | ✅ |
| 2.4 | ¿Cuál es el nombre comercial oficial que debe aparecer en el perfil verificado? ¿Coincide con el registro legal o fiscal? | texto, chips (única) | Párrafo | Sí | Sí | — | ✅ |
| 2.5 | ¿Hay una tarjeta de pago registrada en Meta para cubrir las tarifas por conversación? | chips (única) | Opción múltiple | Sí | Sí | — | ✅ |
| 2.6 | ¿Cuántos mensajes o conversaciones reciben al día? ¿Harán envíos masivos o de plantillas, como recordatorios, promociones o cobros? | número, casillas | Párrafo | Sí | Sí | — | ✅ |
| 3.1 | ¿La cuenta de Instagram ya está configurada como Profesional o Empresa? | chips (única) | Opción múltiple | Sí | Sí | — | ✅ |
| 3.2 | ¿Está vinculada a la página de Facebook del negocio? ¿Quién administra esa página? | chips (única), texto | Párrafo | Sí | Sí | — | ✅ |
| 3.3 | ¿Tienen permisos de administrador sobre la página y la cuenta de Instagram dentro del Business Portfolio? | chips (única) | Opción múltiple | Sí | Sí | — | ✅ |
| 3.4 | ¿Tienen activado el acceso a mensajes? La ruta es Configuración ➔ Mensajes y respuestas a historias ➔ Permitir acceso a los mensajes. | chips (única) | Opción múltiple | Sí | Sí | — | ✅ |
| 3.5 | ¿Qué tipo de mensajes llegan por Instagram (consultas de precio, respuestas a historias, reclamos)? ¿Deben tratarse igual que los de WhatsApp? | casillas, chips (única) | Párrafo | Sí | Sí | — | ✅ |
| 4.1 | ¿Cuántos agentes de voz necesitan y qué rol tendrá cada uno? Por ejemplo: prospección en frío, soporte técnico, confirmación de citas o cobranza. | número, casillas, texto largo | Párrafo | Sí | Sí | — | ✅ |
| 4.2 | ¿Las llamadas serán entrantes, salientes o ambas? ¿Qué volumen diario estiman? | chips (única), número | Párrafo | Sí | Sí | — | ✅ |
| 4.3 | ¿Qué tono debe usar el agente (formal, cercano o corporativo)? ¿Qué saludo, modismos regionales o expresiones deben usarse o evitarse? | chips (única), texto largo | Párrafo | Sí | Sí | — | ✅ |
| 4.4 | ¿Quieren clonar la voz de alguien del equipo? Si es así, ¿pueden enviar un audio limpio de 1 a 2 minutos, con la autorización de esa persona? ¿O prefieren una voz de catálogo? | chips (única), aviso | Párrafo | Sí | Sí | — | ✅ |
| 4.5 | ¿Qué debe pasar al final de cada llamada? Por ejemplo: crear un contacto, agendar una cita, mover un trato o transferir a un humano. | casillas | Casillas | Sí | Sí | — | ✅ |
| 4.6 | ¿En qué horario deben operar los agentes? ¿Qué hacen fuera de ese horario? | casillas, hora, texto largo | Párrafo | Sí | Sí | — | ✅ |
| 5.1 | ¿Tienen documentado el catálogo, la lista de precios, los enlaces de pago y las políticas de garantía o devolución (PDF, Word o Excel) | casillas | Párrafo | Sí | Sí | — | ✅ |
| 5.2 | ¿Quién mantendrá actualizada esa base de conocimiento y con qué frecuencia cambian precios y promociones? | texto, chips (única) | Párrafo | Sí | Sí | — | ✅ |
| 5.3 | ¿En qué casos exactos debe pausarse la IA y pasar a un humano? Por ejemplo: si piden un supervisor, si el presupuesto supera un monto determinado, si hay un reclamo o si detecta un lenguaje agresivo. | casillas, número | Párrafo | Sí | Sí | — | ✅ |
| 5.4 | ¿Quién recibe esas conversaciones escaladas y en cuánto tiempo deben responder? | texto, chips (única) | Párrafo | Sí | Sí | — | ✅ |
| 5.5 | ¿Hay temas que la IA nunca debe responder, como descuentos no autorizados, diagnósticos o asesoría legal? | casillas | Casillas | Sí | Sí | — | ✅ |
| 6.1 | ¿Qué ERP o sistema contable usan (Odoo, Siigo, Alegra, SAP, QuickBooks u otro) y en qué versión? | desplegable, texto | Párrafo | Sí | Sí | — | ✅ |
| 6.2 | ¿Pueden generar una API Key o un Token con permisos de lectura y escritura? ¿Quién de su equipo o proveedor puede hacerlo? | chips (única), texto | Párrafo | Sí, si aplica | No (condicional) | Sí | ✅ |
| 6.3 | ¿En qué momento exacto debe sincronizarse? Por ejemplo: cuando un trato pasa a "Ganado" en ZAK, se crea la factura o el cliente en el ERP. | texto largo | Párrafo | Sí, si aplica | No (condicional) | Sí | ✅ |
| 6.4 | ¿Qué dato manda en caso de conflicto, ZAK o el ERP? Por ejemplo, para precios, stock o datos del cliente. | cuadrícula | Cuadrícula | Sí, si aplica | No (condicional) | Sí | ✅ |
| 7.1 | ¿Pueden enviarnos la lista de usuarios con nombre, apellido y correo? | chips (única), tabla de usuarios, archivo | Párrafo | Sí | Sí | — | ✅ |
| 7.2 | ¿Quiénes serán Administradores y quiénes Colaboradores? | rol por usuario, texto largo | Párrafo | Sí | Sí | — | ✅ |
| 7.3 | ¿Qué módulos debe ver cada persona? Por ejemplo: un asesor solo Pipelines e Inbox; un contador solo Contabilidad y RR. HH. | texto largo | Párrafo | Sí | Sí | — | ✅ |
| 7.4 | ¿Cómo se asignan hoy los clientes a los vendedores (por zona, por turno o round-robin)? | chips (única) | Opción múltiple | Sí | Sí | — | ✅ |
| 7.5 | ¿Hay usuarios externos (agencias, freelancers) que necesiten acceso limitado? | chips (única), texto largo | Párrafo | Sí | Sí | — | ✅ |
| 8.1 | Pagos: ¿Qué métodos de cobro usan (Pago Móvil, transferencia, tarjeta, Zelle, efectivo)? ¿En qué monedas facturan (USD, MXN, EUR, moneda local)? | casillas | Párrafo | Sí | Sí | — | ✅ |
| 8.2 | Cotizaciones: ¿Qué tasa de impuesto aplican? ¿Hay descuentos máximos por vendedor? ¿Tienen un formato o logo de cotización que debamos replicar? | número, chips (única), archivo | Párrafo | Sí | Sí | — | ✅ |
| 8.3 | Suscripciones: ¿Venden planes recurrentes? ¿Cuáles son sus nombres, precios y ciclos de cobro? | chips (única), lista de planes | Párrafo | Sí | Sí | — | ✅ |
| 8.4 | Contratos: ¿Pueden compartir sus plantillas o un contrato de ejemplo? ¿Quién firma por la empresa? ¿Aceptan la firma electrónica? | archivo, texto, chips (única) | Párrafo | Sí | Sí | — | ✅ |
| 8.5 | Revenue Engine: ¿Qué productos o servicios son candidatos a upsell? | texto largo | Párrafo | Sí | Sí | — | ✅ |
| 9.1 | ¿Cómo quieren segmentar sus contactos (por ejemplo: VIP, prospectos, inactivos)? | casillas | Casillas | Sí | Sí | — | ✅ |
| 9.2 | ¿Tienen manual de marca (logo, colores, tipografías) para las plantillas? | chips (única) | Opción múltiple | Sí | Sí | — | ✅ |
| 9.3 | ¿Con qué frecuencia planean enviar campañas? ¿Tienen el consentimiento (opt-in) de sus contactos? | chips (única) | Párrafo | Sí | Sí | — | ✅ |
| 10.1 | ¿En qué plataformas publicitan (Meta, TikTok, Google, YouTube)? | casillas | Casillas | Sí | Sí | — | ✅ |
| 10.2 | ¿Cuál es el público objetivo y la propuesta de valor principal? | texto largo | Párrafo | Sí | Sí | — | ✅ |
| 10.3 | ¿Quieren crear un avatar propio? ¿Quién aparecerá, con qué fondo y con qué tono? ¿Cuentan con su autorización de imagen? | chips (única), texto | Párrafo | Sí | Sí | — | ✅ |
| 10.4 | ¿Necesitan generar video real? Eso implica un costo adicional. ¿O les basta con la biblioteca de muestra al inicio? | chips (única) | Opción múltiple | Sí | Sí | — | ✅ |
| 11.1 | ¿Tienen sitio web actual y dominio propio? ¿Necesitan landings para campañas, embudos o lanzamientos? | chips (única), URL | Párrafo | Sí | Sí | — | ✅ |
| 11.2 | ¿Usan formularios externos (Google Forms, Typeform) que debamos conectar para que cada envío cree un contacto? | casillas | Casillas | Sí | Sí | — | ✅ |
| 11.3 | ¿Qué campos mínimos debe capturar un formulario de lead? | casillas | Casillas | Sí | Sí | — | ✅ |
| 11.4 | ¿Qué reportes en Excel o CSV revisan hoy y les gustaría convertir en dashboards? | texto largo | Párrafo | Sí | Sí | — | ✅ |
| 12.1 | ¿Qué acciones repetitivas del día a día les gustaría ejecutar por voz? Por ejemplo: crear contactos, mover tratos o agendar citas. | casillas | Casillas | Sí | Sí | — | ✅ |
| 12.2 | ¿Qué KPIs quiere ver la gerencia en el resumen diario y en los reportes ejecutivos de cada módulo? | texto largo | Párrafo | Sí | Sí | — | ✅ |
| 12.3 | ¿Hay restricciones para que ciertos usuarios usen Kira o consulten datos financieros? | chips (única), texto largo | Párrafo | Sí | Sí | — | ✅ |
| 13.1 | ¿Existen políticas internas o legales sobre el manejo de datos personales, grabación de llamadas o uso de IA? | chips (única), texto largo, archivo | Párrafo | Sí | Sí | — | ✅ |
| 13.2 | ¿Deben informar al cliente final que habla con una IA o que la llamada se graba? | casillas | Casillas | Sí | Sí | — | ✅ |
| 13.3 | ¿Qué fecha de salida a producción esperan? ¿Prefieren un lanzamiento por fases (por ejemplo: WhatsApp e Inbox primero, luego voz y ERP)? | fecha, chips (única), texto largo | Párrafo | Sí | Sí | — | ✅ |
| 13.4 | ¿Qué capacitación necesita el equipo y en qué horarios? | texto largo, texto | Párrafo | Sí | Sí | — | ✅ |

## Ítems de control del Form (no son preguntas)

| Ítem | Contenido |
|---|---|
| Referencia de onboarding | `ZAK-AAAA-XXXXXX`, generada por el Apps Script |
| Registro de aceptación del NDA | Versión, huella SHA-256, fecha y hora de aceptación, firmante, cédula, cargo, empresa, RIF y sesión |
| ID de sesión | UUID de la sesión del navegador |
| Dudas registradas durante el onboarding | Preguntas sobre ZAK que hizo el cliente en el chat |
| Preparación global (%) | Promedio de preparación de los módulos elegidos (número) |
| Calificación de preparación | Nivel para el cliente · etiqueta interna (p. ej. «Preparación media · Requiere completar requisitos») |
| Preparación por módulo | Porcentaje de cada módulo elegido |
| Requisitos pendientes | Requisitos «No lo tengo» o «En proceso», agrupados por módulo, con la nota «¿Qué te falta?» |
| Información disponible (%) | Nivel de información global (número) |
| Consultoría recomendada | Básica, estándar o intensiva |
| Desglose de información | Porcentaje del cuestionario y del checklist |
| Información por completar | Preguntas con «No sé», carencias o archivos esperados sin adjuntar |
| Adjuntos por pregunta | «ID · archivo (enlace de Drive)» de cada pregunta con adjuntos |

La marca de tiempo la añade Google Forms automáticamente en la primera columna de la hoja.

## Lógica condicional aplicada

| Pregunta | Se muestra cuando… |
|---|---|
| 2.2 | 2.1 = "Activo en WhatsApp" o "Activo en WhatsApp Business" |
| 6.2, 6.3, 6.4 | 6.1 ≠ "No usamos ERP" (la sección dice "si aplica") |
| Campos internos | Formato y registros (1.5) si hay base; aviso del audio por correo y autorización (4.4) si se clona la voz; monto (5.3) si se elige ese caso; lista de usuarios o archivo (7.1) según el modo; roles por usuario o texto libre (7.2) según 7.1; % de descuento y archivo (8.2); planes (8.3); datos del avatar (10.3); URL (11.1); detalle (7.5, 12.3, 13.1, 13.3) |
