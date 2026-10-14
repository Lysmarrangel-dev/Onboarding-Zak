# Onboarding ZAK · iTech

Asistente conversacional que guía a cada cliente nuevo en el onboarding de ZAK. Hace las preguntas del cuestionario oficial una a una, valida las respuestas y las envía a un Google Form vinculado a una hoja de Google Sheets.

- **App:** HTML + CSS + JS (módulos ES), sin compilación. Se despliega en Netlify arrastrando la carpeta.
- **Preguntas:** `config/questions.json`. Se pueden cambiar sin tocar el código.
- **Presentación:** el primer mensaje es un audiovisual de unos 25 s con subtítulos (`js/intro.js`), narrado con la voz de ElevenLabs (`config/intro.json`; los audios se generan con `tools/generar_voz.py`). Se puede sustituir por un video real desde `js/config.js`.
- **Módulos y checklist:** `config/modules.json`. El cliente elige sus módulos, completa un checklist por módulo y obtiene su porcentaje de preparación, que también llega al Form.
- **Dudas sobre ZAK:** `config/faq.json` (47 respuestas basadas en el cuestionario y en el brochure de ZAK). Para añadir una, agrega una entrada con `keywords` y `answer`.
- **Marca:** `css/tokens.css` (paleta, degradado a 125°, Iquost + Inter) y `assets/brand/` (vectores del Manual de Marca v1.0).
- **Backend:** Google Apps Script (`apps-script/Code.gs`), publicado como aplicación web.

Guía paso a paso: **[docs/GUIA.md](docs/GUIA.md)** · Verificación de preguntas: **[docs/VERIFICACION.md](docs/VERIFICACION.md)**

## Probar en local

```bash
python3 -m http.server 5173
```

Abre <http://localhost:5173>. Sin `appsScriptUrl` en `js/config.js`, la app funciona en modo demostración: no envía nada y muestra en la consola el JSON que enviaría.
