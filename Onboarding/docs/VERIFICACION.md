# Tabla de verificación · Onboarding ZAK

Generada automáticamente comparando **Onboarding.docx** con `config/questions.json` (script en `docs/verificar.py`).

- Preguntas en el documento: **60** · Preguntas del documento en la app: **60** · Coincidencias (misma sección, mismo orden, texto ≥ 90 % idéntico): **60/60**
- El título de cada ítem del Form es `ID · texto del documento`, generado por `setupForm()` desde el mismo JSON: app y Form no pueden desalinearse.
- Obligatorias: el documento no marca ninguna, así que todas lo son (no hay "comentarios adicionales"). Las condicionales son obligatorias en la app solo cuando aparecen; en el Form quedan como no obligatorias para que el envío no falle cuando no aplican.

## Sección 0 · Datos de la empresa (añadida con aprobación de iTech, no está en el documento)

| ID | Pregunta | Componente en la app | Ítem en Form | Obligatoria |
|---|---|---|---|---|
| 0.1 | Nombre de la empresa | texto | Respuesta corta | Sí |
| 0.2 | RIF o ID fiscal | RIF | Respuesta corta | Sí |
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
| 4.4 | ¿Quieren clonar la voz de alguien del equipo? Si es así, ¿pueden enviar un audio limpio de 1 a 2 minutos, con la autorización de esa persona? ¿O prefieren una voz de catálogo? | chips (única), archivo | Párrafo | Sí | Sí | — | ✅ |
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
| ID de sesión | UUID de la sesión del navegador |
| Dudas registradas durante el onboarding | Preguntas sobre ZAK que hizo el cliente en el chat |
| Preparación global (%) | Promedio de preparación de los módulos elegidos (número) |
| Calificación de preparación | Nivel para el cliente · etiqueta interna (p. ej. «Preparación media · Requiere completar requisitos») |
| Preparación por módulo | Porcentaje de cada módulo elegido |
| Requisitos pendientes | Requisitos «No lo tengo» o «En proceso», agrupados por módulo |

La marca de tiempo la añade Google Forms automáticamente en la primera columna de la hoja.

## Lógica condicional aplicada

| Pregunta | Se muestra cuando… |
|---|---|
| 2.2 | 2.1 = "Activo en WhatsApp" o "Activo en WhatsApp Business" |
| 6.2, 6.3, 6.4 | 6.1 ≠ "No usamos ERP" (la sección dice "si aplica") |
| Campos internos | Formato y registros (1.5) si hay base; audio y autorización (4.4) si se clona la voz; monto (5.3) si se elige ese caso; lista de usuarios o archivo (7.1) según el modo; roles por usuario o texto libre (7.2) según 7.1; % de descuento y archivo (8.2); planes (8.3); datos del avatar (10.3); URL (11.1); detalle (7.5, 12.3, 13.1, 13.3) |
