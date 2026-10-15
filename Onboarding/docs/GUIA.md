# Guía de puesta en marcha · Onboarding ZAK

Tiempo estimado: 20–30 minutos. Necesitas una cuenta de Google (idealmente la del equipo iTech, que será dueña del Form y de la hoja) y una cuenta de Netlify.

El orden importa: primero se publica la app, porque el Apps Script lee las preguntas desde `config/questions.json` para crear el Form.

---

## Paso 1 · Publicar la app en Netlify (modo demostración)

La app es estática (HTML + CSS + JS), no necesita compilación.

1. Entra en <https://app.netlify.com/drop>.
2. Arrastra la carpeta **`Onboarding`** completa.
3. Netlify te da una URL, por ejemplo `https://zak-onboarding.netlify.app`. En *Site configuration → Change site name* puedes cambiarla.
4. Abre la URL. La app funciona completa en **modo demostración**: no envía nada y lo indica con la etiqueta "Modo demostración".
5. Comprueba que carga: `https://TU-SITIO.netlify.app/config/questions.json`.

> Alternativa con Git: sube la carpeta a un repositorio y conéctalo en Netlify (*Add new site → Import an existing project*). `netlify.toml` ya indica que se publica la raíz sin comando de compilación.

## Paso 1b · Generar la voz de la presentación (ElevenLabs)

La presentación usa la voz de ElevenLabs `O5hbneAmtjLMgfg5UFIm`, definida en `config/intro.json`. Los audios se generan **una sola vez** y se publican como archivos MP3: la clave de API nunca llega a la web.

1. En ElevenLabs, abre la voz y pulsa **Add to My Voices**. Las voces de la Voice Library deben estar en tu cuenta para usarse por API.
2. Crea una clave en *Settings → API Keys*. Basta con el permiso **Text to Speech**.
3. En la Terminal, dentro de la carpeta `Onboarding`:
   ```bash
   export ELEVENLABS_API_KEY="tu_clave"
   python3 tools/generar_voz.py
   ```
   Se crean 6 archivos en `assets/audio/intro/` (`hello.mp3`, `zak.mp3`, …).
4. Abre la app en local o vuelve a subir la carpeta a Netlify, y escucha la presentación.

- Para cambiar una frase, edita `caption` o `say` en `config/intro.json` y ejecuta `python3 tools/generar_voz.py --force`, o `--only <escena>` para una sola.
- Si algún audio falta, esa escena usa la voz del navegador, así que la presentación nunca se queda muda.
- **Kira leyendo las preguntas:** `python3 tools/generar_voz.py --kira` genera unos 176 audios (≈ 13.000 caracteres de ElevenLabs) en `assets/audio/kira/`. Solo genera los textos nuevos o cambiados: ejecútalo de nuevo cada vez que edites preguntas. Sin estos audios, Kira usa la voz del navegador.
- Para ajustar el tono, cambia `voiceSettings` en `config/intro.json` (estabilidad, similitud y estilo) y regenera.

## Paso 2 · Crear el proyecto de Apps Script

1. Entra en <https://script.google.com> → **Nuevo proyecto**. Llámalo "Onboarding ZAK".
2. Borra el contenido de `Código.gs` y pega el de **`apps-script/Code.gs`**.
3. Muestra el manifiesto: ⚙️ *Configuración del proyecto* → activa **"Mostrar el archivo de manifiesto appsscript.json"**. Abre `appsscript.json` y reemplázalo por **`apps-script/appsscript.json`**. Ajusta `timeZone` si no estás en Caracas.
4. En ⚙️ *Configuración del proyecto → Propiedades del script*, añade:

   | Propiedad | Valor |
   |---|---|
   | `QUESTIONS_URL` | `https://TU-SITIO.netlify.app/config/questions.json` (el script lee también `modules.json` y `agents.json` en la misma carpeta) |
   | `NOTIFY_EMAIL` | (opcional) correo o correos del equipo, separados por comas |

## Paso 3 · Crear el Google Form y la hoja de respuestas

1. En el editor, elige la función **`setupForm`** y pulsa **Ejecutar**.
2. Autoriza los permisos (Forms, Sheets, Drive, correo y conexión externa). Si Google avisa de que la app no está verificada: *Configuración avanzada → Ir a Onboarding ZAK*. El script es tuyo.
3. Al terminar, abre **Registro de ejecución**. Verás:
   - la URL de edición del Form: 65 preguntas + selección de módulos + 18 checklists + agentes de IA (1 + 9) + 12 ítems de control, en 17 secciones;
   - la URL de la hoja **"Onboarding ZAK · Respuestas"**, ya vinculada;
   - la carpeta de Drive **"Onboarding ZAK · Archivos"**;
   - un bloque JSON `{ "items": { ... } }`.
4. Copia ese JSON y pégalo en **`config/form-mapping.json`** (sustituye `"items": {}`).
   *Si te lo saltas, el envío igual funciona: el script localiza cada ítem por su ID en el título (`1.1 · …`). El mapa lo hace más robusto si alguien edita los títulos en el Form.*
5. Revisa el Form. **No cambies el texto de las opciones** (Sí/No, chips, etc.): la app envía exactamente esos valores.

> No ejecutes `setupForm` dos veces: crearía otro Form. Si necesitas rehacerlo, borra las propiedades `FORM_ID`, `SHEET_ID`, `UPLOAD_FOLDER_ID` e `ITEM_MAP` antes.

## Paso 4 · Publicar el script como aplicación web

1. **Implementar → Nueva implementación** → tipo **Aplicación web**.
2. *Ejecutar como*: **Yo** (la cuenta de iTech). *Quién tiene acceso*: **Cualquier usuario**. Es necesario para que los clientes, sin cuenta de Google, puedan enviar. No da acceso al Form ni a la hoja: solo permite llamar a `doPost`.
3. Pulsa **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
4. Prueba en el navegador: `https://script.google.com/macros/s/…/exec` debe responder `{"ok":true,"service":"onboarding-zak","formConfigured":true}`.

## Paso 5 · Conectar la app con el script

1. Abre **`js/config.js`** y pega la URL en `appsScriptUrl`:
   ```js
   appsScriptUrl: 'https://script.google.com/macros/s/AKfy…/exec',
   ```
2. Vuelve a subir la carpeta a Netlify: en *Deploys*, arrastra la carpeta otra vez.
3. La etiqueta "Modo demostración" desaparece.

> La URL `/exec` no es secreta: es un punto de entrada público, como la dirección de un formulario. La app no guarda ninguna clave privada. El script rechaza el spam con un campo trampa, valida el ID de sesión, limita los archivos a 10 MB y a formatos permitidos, y evita duplicados si la app reintenta.

## Paso 6 · Prueba de extremo a extremo

1. Abre la app en una ventana de incógnito y completa el onboarding. Para ir rápido, contesta con datos de prueba.
2. En una pregunta con archivo (4.4, 7.1, 8.2, 8.4 o 13.1), sube un PDF o un audio pequeño.
3. Confirma y envía. Anota la referencia `ZAK-2026-XXXXXX`.
4. Verifica:
   - **Form → Respuestas**: aparece una respuesta nueva;
   - **Hoja**: una fila nueva, con una columna por pregunta (`1.1 · …`) y las columnas de control al final;
   - **Drive**: una carpeta con el ID de sesión y el archivo, cuyo enlace aparece en la celda de esa pregunta;
   - **Correo** (si configuraste `NOTIFY_EMAIL`): el resumen con la referencia.
5. Borra la respuesta de prueba en el Form y la fila en la hoja.

## Mantenimiento

| Quiero… | Qué hacer |
|---|---|
| Añadir o cambiar preguntas de configuración de un módulo | Editar el arreglo `config` del módulo en `config/modules.json` (mismos tipos de campo que el cuestionario). Si el Form ya existe, añade el ítem con el título `X.<módulo>.<n> · <pregunta>`. |
| Cambiar qué preguntas dependen de qué módulo | En `config/questions.json`, edita `"modules"` en la sección (o en una pregunta concreta) con los IDs de `config/modules.json`. Sin `"modules"`, la pregunta se hace siempre. Si el Form ya existe, desmarca «Obligatoria» en esas preguntas. |
| Cambiar el acuerdo de confidencialidad | Editar `config/nda.json` y **subir `version`**. Las aceptaciones anteriores conservan su versión y huella. Haz revisar el texto con el asesor legal antes de publicarlo. |
| Cambiar los departamentos o los campos de los agentes de IA | Editar `config/agents.json`. Si el Form ya existe, actualiza también sus opciones, o vuelve a crearlo. |
| Ajustar cómo se calcula el nivel de información o la consultoría recomendada | Editar `config/scoring.json` (respuestas que restan, archivos esperados, pesos y niveles). No requiere tocar el Form. |
| Cambiar módulos, requisitos del checklist o umbrales de calificación | Editar `config/modules.json`. Si el Form ya existe, cambia también sus opciones y filas (mismo texto), o vuelve a crearlo con `setupForm()`. |
| Usar un video real como presentación (p. ej. con el avatar) | Subir el `.mp4` a `assets/video/` y poner su ruta en `intro.videoSrc` de `js/config.js` (opcional: `videoPoster` y subtítulos `.vtt` en `captionsSrc`). |
| Quitar la voz de la presentación | `intro.voice: false` en `js/config.js`. |
| Cambiar la voz de ElevenLabs | Cambiar `elevenlabs.voiceId` en `config/intro.json` y ejecutar `python3 tools/generar_voz.py --force`. |
| Cambiar el texto de una pregunta en la app | Editar `prompt` o `hint` en `config/questions.json`. No requiere tocar el Form. |
| Cambiar el texto en el Form | Editar el ítem en el Form, conservando el prefijo `ID · `. |
| Añadir, quitar o cambiar las opciones de una pregunta | Editar el JSON **y** el ítem del Form (mismas opciones). Luego `python3 docs/verificar.py Onboarding.docx`. |
| Añadir una pregunta nueva | Añadirla al JSON, crear el ítem en el Form con título `ID · texto` y añadir su ID al mapa. |
| Cambiar la URL del script tras una nueva implementación | Con *Gestionar implementaciones → Editar → Nueva versión*, la URL se mantiene. Si creas otra implementación, actualiza `js/config.js`. |
| Ver errores del servidor | Apps Script → *Ejecuciones*. |
| Probar la app en local | `python3 -m http.server 5173` dentro de la carpeta y abrir `http://localhost:5173`. Necesita un servidor, porque no funciona abriendo `index.html` directamente. |

## Estructura del proyecto

```
Onboarding/
├── index.html                 Punto de entrada
├── netlify.toml               Configuración de despliegue y cabeceras de seguridad
├── config/
│   ├── questions.json         Cuestionario completo (fuente única de preguntas)
│   ├── intro.json             Guion de la presentación y voz de ElevenLabs
│   ├── (plantillas en assets/plantillas/: usuarios y Number Master)
│   ├── nda.json               Acuerdo de confidencialidad (texto y versión)
│   ├── agents.json            Departamentos y campos de los agentes de IA
│   ├── scoring.json           Reglas del nivel de información y consultoría recomendada
│   ├── modules.json           18 módulos, requisitos del checklist y niveles de preparación
│   ├── form-mapping.json      Mapa id de pregunta ↔ id de ítem del Form
│   └── faq.json               Respuestas breves sobre ZAK para el chat
├── css/
│   ├── tokens.css             Colores, fuentes y radios de marca (único lugar)
│   └── app.css                Estilos de la interfaz
├── js/
│   ├── config.js              URL del Apps Script, nombre del agente, reintentos
│   ├── app.js                 Pantallas y flujo del chat
│   ├── engine.js              Condiciones, validación, formato y serialización
│   ├── intro.js               Presentación audiovisual de bienvenida
│   ├── readiness.js           Módulos, checklist, agentes de IA y cálculo de preparación
│   ├── info.js                Nivel de información y consultoría recomendada
│   ├── faq.js                 Búsqueda en las preguntas frecuentes
│   ├── kira.js                Kira lee las preguntas (ElevenLabs o voz del navegador)
│   ├── inputs.js              Componentes por tipo de respuesta
│   ├── api.js                 Envío con reintentos y subida de archivos
│   ├── store.js               Guardado del progreso en el navegador
│   └── dom.js                 Utilidades de DOM e íconos
├── assets/
│   ├── brand/                 Logotipos e isotipos (vectores del Manual de Marca v1.0)
│   └── fonts/Iquost.woff2     Tipografía corporativa
├── tools/generar_voz.py       Genera los MP3 de la narración con ElevenLabs
├── apps-script/
│   ├── Code.gs                setupForm(), doPost(), subida a Drive, correo
│   └── appsscript.json        Permisos y configuración de la aplicación web
└── docs/
    ├── GUIA.md                Esta guía
    ├── VERIFICACION.md        Tabla documento ↔ app ↔ Form
    └── verificar.py           Script que genera la comprobación
```
