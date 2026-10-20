# Onboarding ZAK · iTech

Asistente conversacional que guía a cada cliente nuevo en el onboarding de ZAK. Hace las preguntas del cuestionario oficial una a una, valida las respuestas y las envía a un Google Form vinculado a una hoja de Google Sheets.

- **App:** HTML + CSS + JS (módulos ES), sin compilación. Se despliega en Vercel (Root Directory = `Onboarding`), igual que el CRM y el brochure; cada push a `main` publica.
- **Preguntas:** `config/questions.json`. Se pueden cambiar sin tocar el código.
- **Kira:** la asistente del onboarding lee cada pregunta en voz alta con **la misma voz que en el CRM y el brochure** (Gemini «Aoede», servida por el backend del CRM en `/api/kira/tts`). `js/kira.js` usa los MP3 pregenerados con `tools/generar_voz.py --kira`; si falta alguno, pide la voz en vivo al backend (`js/kiraVoice.js`) y solo en último caso usa la del navegador.
- **Presentación:** el primer mensaje es un audiovisual de unos 25 s con subtítulos (`js/intro.js`), narrado con la voz de Kira (`config/intro.json`; los audios se generan con `tools/generar_voz.py`). Se puede sustituir por un video real desde `js/config.js`.
- **Módulos y checklist:** `config/modules.json`. El cliente elige sus módulos, completa un checklist por módulo y obtiene su porcentaje de preparación, que también llega al Form.
- **Acuerdo de confidencialidad:** primer paso del chat (`config/nda.json`). Es mutuo, se acepta electrónicamente y queda registrado con fecha, versión y huella SHA-256.
- **Solo lo contratado:** el cuestionario se adapta a los módulos elegidos (`"modules"` en `config/questions.json`). Con 2 módulos solo se pregunta por esos 2; con todos, por todo.
- **Configuración por módulo:** cada módulo contratado trae sus preguntas técnicas (`config` en `config/modules.json`), para que el equipo de implementación tenga todo lo necesario.
- **Agentes de IA:** `config/agents.json`. Por cada departamento elegido, el cliente describe su agente y sube los documentos que puede leer.
- **Nivel de información:** `config/scoring.json`. Barra en el encabezado que indica cuánta información hay para configurar ZAK y qué consultoría se recomienda.
- **Archivos:** el único archivo del onboarding es el RIF **en PDF** de la pregunta 0.2. Los demás documentos (catálogo, manual de marca, plantillas, guiones, políticas, organigrama…) se piden con un aviso y un enlace para enviarlos a zak@itech.com.ve; el Apps Script rechaza cualquier otra subida. La 0.2 pide el RIF **en PDF** (obligatorio; se valida que el archivo sea un PDF real) para verificar la empresa en WhatsApp Business. Al enviar, el Apps Script guarda una copia en la carpeta de Drive **«RIF de clientes»**, dentro de una subcarpeta por día (`2026-10-16`; solo se crea el día que llega al menos un RIF), como `RIF · J-12345678-9 · Razón social · ZAK-2026-XXXXXX.pdf`, y su enlace queda en la columna «RIF en PDF (enlace para revisión)» de la hoja y en el correo de aviso.
- **Kira flotante:** botón de Kira en la esquina (en el chat y en el resumen) que abre su panel de conversación, como en el brochure y el CRM. Kira (el mismo pulpo y el mismo motor de IA) responde las dudas del cliente sobre la pregunta en pantalla o sobre ZAK, y las lee con su voz si está activa. Con el micrófono del panel se conversa con Kira por voz (Gemini Live por el relay `wss://…/api/kira/live` del backend, `kiraLiveUrl` en `js/config.js`); las dudas escritas o dichas llegan al equipo con el envío. Usa `/api/kira/generate` del backend del CRM (rewrite en `vercel.json`, `kiraChatUrl` en `js/config.js`) y toma como fuente `config/faq.json` y `config/modules.json`. Si el backend no responde, contesta con `config/faq.json` (respuestas con `keywords` y `answer`).
- **Onboarding por voz:** en la llamada, Kira lleva el cuestionario conversando. Lee la pregunta en pantalla, llena los campos con lo que dice el cliente (`fill_field`), envía la respuesta (`submit_answer`) y pasa a la siguiente. Antes de pedir los datos del acuerdo de confidencialidad, lo lee completo en voz alta por partes (`read_nda`). Las casillas de aceptación solo las marca si el cliente acepta en voz alta. Archivos (RIF en PDF), tablas, planes, usuarios y KPIs se llenan en pantalla. Las herramientas viven en `app.js` (`voiceQuestion`, `voiceFill`, `voiceSubmit`, `voiceReadNda`). Lo dicho por voz ya no se guarda como «duda», porque son respuestas del formulario; las dudas escritas sí llegan al equipo.
- **«Kira» para llamarla:** con el panel disponible, el micrófono escucha la palabra «Kira» usando el reconocimiento de voz del navegador (`js/kiraWakeWord.js`, Chrome/Edge; no gasta API). «Kira» sola abre la llamada; «Kira, …» la abre con ese pedido. Empieza tras el primer toque en la página y se pausa durante la llamada y mientras suena la narración. Se apaga con el botón de la oreja del panel.
- **Marca:** `css/tokens.css` (paleta, degradado a 125°, Iquost + Inter) y `assets/brand/` (vectores del Manual de Marca v1.0).
- **Backend:** Google Apps Script (`apps-script/Code.gs`), publicado como aplicación web.

Guía paso a paso: **[docs/GUIA.md](docs/GUIA.md)** · Verificación de preguntas: **[docs/VERIFICACION.md](docs/VERIFICACION.md)**

## Probar en local

```bash
python3 -m http.server 5173
```

Abre <http://localhost:5173>. Sin `appsScriptUrl` en `js/config.js`, la app funciona en modo demostración: no envía nada y muestra en la consola el JSON que enviaría.
