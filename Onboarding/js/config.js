/**
 * Configuración de la app. Es el único archivo que hay que tocar al desplegar.
 * La URL del Apps Script es pública por diseño (no es una clave privada).
 */
export const CONFIG = {
  agentName: 'ZAK Assistant',

  // URL de la aplicación web de Apps Script (termina en /exec). Ver docs/GUIA.md, paso 4.
  // Vacía = modo demostración: la app funciona completa pero no envía nada.
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbx4_h4UlxmrShKBTEGvVNYi9m_NyX0h7y4ZAb8j6N6xl2LvpE_VLHlbdfyKpaPLjjm3/exec',

  // Reintentos automáticos del envío (esperas en ms entre intentos).
  retryDelays: [1000, 3000, 6000],
  requestTimeoutMs: 30000,
  uploadTimeoutMs: 120000,

  // Clave de guardado local del progreso.
  storageKey: 'zak-onboarding-v1',

  // Ritmo del indicador «escribiendo…» (ms). Se anula con prefers-reduced-motion.
  typingDelayMs: 650,

  // Presentación audiovisual de bienvenida (primer mensaje del chat).
  intro: {
    enabled: true,
    voice: true,        // narración con la voz del navegador; el cliente puede silenciarla
    // Si producen un video (p. ej. con el avatar), pon su URL aquí y reemplaza la animación:
    videoSrc: '',       // 'assets/video/intro-zak.mp4'
    videoPoster: '',    // imagen de portada opcional
    captionsSrc: '',    // subtítulos .vtt opcionales
  },
};
