# Onboarding ZAK · iTech

Asistente conversacional que guía a cada cliente nuevo en el onboarding de ZAK. Hace las preguntas del cuestionario oficial una a una, valida las respuestas y las envía a un Google Form vinculado a una hoja de Google Sheets.

- **App:** HTML + CSS + JS (módulos ES), sin compilación. Se despliega en Netlify arrastrando la carpeta.
- **Preguntas:** `config/questions.json`. Se pueden cambiar sin tocar el código.
- **Kira:** la asistente del onboarding lee cada pregunta en voz alta (`js/kira.js`; audios con `tools/generar_voz.py --kira`).
- **Presentación:** el primer mensaje es un audiovisual de unos 25 s con subtítulos (`js/intro.js`), narrado con la voz de ElevenLabs (`config/intro.json`; los audios se generan con `tools/generar_voz.py`). Se puede sustituir por un video real desde `js/config.js`.
- **Módulos y checklist:** `config/modules.json`. El cliente elige sus módulos, completa un checklist por módulo y obtiene su porcentaje de preparación, que también llega al Form.
- **Acuerdo de confidencialidad:** primer paso del chat (`config/nda.json`). Es mutuo, se acepta electrónicamente y queda registrado con fecha, versión y huella SHA-256.
- **Solo lo contratado:** el cuestionario se adapta a los módulos elegidos (`"modules"` en `config/questions.json`). Con 2 módulos solo se pregunta por esos 2; con todos, por todo.
- **Configuración por módulo:** cada módulo contratado trae sus preguntas técnicas (`config` en `config/modules.json`), para que el equipo de implementación tenga todo lo necesario.
- **Agentes de IA:** `config/agents.json`. Por cada departamento elegido, el cliente describe su agente y sube los documentos que puede leer.
- **Nivel de información:** `config/scoring.json`. Barra en el encabezado que indica cuánta información hay para configurar ZAK y qué consultoría se recomienda.
- **Adjuntos:** cualquier pregunta acepta documentos o imágenes de respaldo. La 0.2 pide el RIF y su comprobante (obligatorio) para verificar la empresa en WhatsApp Business.
- **Dudas sobre ZAK:** `config/faq.json` (56 respuestas basadas en el cuestionario y en el brochure de ZAK). Para añadir una, agrega una entrada con `keywords` y `answer`.
- **Marca:** `css/tokens.css` (paleta, degradado a 125°, Iquost + Inter) y `assets/brand/` (vectores del Manual de Marca v1.0).
- **Backend:** Google Apps Script (`apps-script/Code.gs`), publicado como aplicación web.

Guía paso a paso: **[docs/GUIA.md](docs/GUIA.md)** · Verificación de preguntas: **[docs/VERIFICACION.md](docs/VERIFICACION.md)**

## Probar en local

```bash
python3 -m http.server 5173
```

Abre <http://localhost:5173>. Sin `appsScriptUrl` en `js/config.js`, la app funciona en modo demostración: no envía nada y muestra en la consola el JSON que enviaría.
