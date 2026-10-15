/**
 * Configuración de la app. Es el único archivo que hay que tocar al desplegar.
 * La URL del Apps Script es pública por diseño (no es una clave privada).
 */
export const CONFIG = {
  agentName: 'Kira',

  // URL de la aplicación web de Apps Script (termina en /exec). Ver docs/GUIA.md, paso 4.
  // Vacía = modo demostración: la app funciona completa pero no envía nada.
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbx4_h4UlxmrShKBTEGvVNYi9m_NyX0h7y4ZAb8j6N6xl2LvpE_VLHlbdfyKpaPLjjm3/exec',

  // Voz de Kira (la misma del CRM y del brochure), servida por el backend del CRM. Se usa cuando falta
  // el MP3 pregenerado de un texto. Vacía = esos textos usan la voz del navegador.
  // El dominio del onboarding debe estar en FRONTEND_URL del backend (CORS).
  kiraTtsUrl: 'https://itech-crm-production.up.railway.app/api/kira/tts',

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
    voice: true,        // narración con la voz de Kira; el cliente puede silenciarla
    // Si producen un video (p. ej. con el avatar), pon su URL aquí y reemplaza la animación:
    videoSrc: '',       // 'assets/video/intro-zak.mp4'
    videoPoster: '',    // imagen de portada opcional
    captionsSrc: '',    // subtítulos .vtt opcionales
  },
};
